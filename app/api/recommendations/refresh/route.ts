import { NextRequest, NextResponse } from 'next/server'
import type { DataRow, DataSchema, ColumnSchema } from '@/lib/store'
import type {
  ChartRecommendation,
  CorrectedColumn,
  DataContext,
  EnhancedAnalysisResult
} from '@/lib/types/recommendation'
import { analyzeDataSchema } from '@/lib/utils/schema-analyzer'
import { parseJSONFromString } from '@/lib/utils/json-extractor'
import { validateRequest, recommendationsRefreshRequestSchema } from '@/lib/utils/api-validation'
import {
  getAIProvider,
  generateCompletionWithRetry,
  type AIMessage
} from '@/lib/services/ai/ai-provider'

// Rate limiting (shared with analyze endpoint)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const clientData = requestCounts.get(clientId)

  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (clientData.count >= RATE_LIMIT) {
    return false
  }

  clientData.count++
  return true
}

// Get data sample for AI analysis
function getDataSample(data: DataRow[], maxRows: number = 3): DataRow[] {
  if (data.length <= maxRows) return data

  const firstRows = data.slice(0, Math.ceil(maxRows / 2))
  const randomRows = data
    .slice(Math.ceil(maxRows / 2))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(maxRows / 2))

  return [...firstRows, ...randomRows]
}

// Focus area instructions for the AI
const FOCUS_INSTRUCTIONS = {
  trends: `
    FOCUS: TIME SERIES ANALYSIS AND TRENDS

    Prioritize visualizations that show:
    - Changes over time (line charts, area charts)
    - Trends, growth rates, and patterns
    - Temporal comparisons (year-over-year, month-over-month)
    - Seasonality and cyclical patterns
    - Moving averages and forecasts

    Generate 70% line/area charts, 20% scorecards with trend indicators, 10% tables with temporal breakdowns.
    Emphasize date/time columns as x-axis. Look for metrics that change over time.
  `,
  comparisons: `
    FOCUS: CATEGORICAL COMPARISONS AND RANKINGS

    Prioritize visualizations that show:
    - Comparisons across categories (bar charts, grouped bars)
    - Rankings and top/bottom performers
    - Side-by-side comparisons
    - Performance benchmarking
    - Distribution across segments

    Generate 70% bar charts, 20% tables with sorting and rankings, 10% scorecards highlighting best/worst.
    Use categorical columns for grouping. Show clear winners and losers.
  `,
  distributions: `
    FOCUS: PART-TO-WHOLE RELATIONSHIPS AND DISTRIBUTIONS

    Prioritize visualizations that show:
    - Proportional breakdowns (pie charts, donut charts)
    - Distribution patterns (histograms)
    - Market share and composition
    - Percentage contributions
    - Segment analysis

    Generate 60% pie/donut charts, 30% stacked bar/area charts, 10% tables with percentages.
    Show how parts contribute to the whole. Calculate and display percentages prominently.
  `,
  kpis: `
    FOCUS: KEY PERFORMANCE INDICATORS AND METRICS

    Prioritize visualizations that show:
    - Single-value KPI scorecards
    - High-level summary metrics
    - Performance against targets
    - Critical business numbers
    - Executive dashboard metrics

    Generate 70% scorecards, 20% simple bar charts for KPI comparisons, 10% trend lines for KPI evolution.
    Focus on aggregated metrics like totals, averages, rates. Keep it simple and impactful.
  `,
  all: `
    FOCUS: BALANCED MIX OF ALL CHART TYPES

    Generate a diverse portfolio of visualizations:
    - Start with 2-4 scorecards for key metrics
    - Include 2-3 trend/time series charts
    - Add 2-3 comparison/ranking charts
    - Include 1-2 distribution charts
    - Add 1 detailed table for drill-down

    Ensure variety in chart types. Avoid repetition. Cover different aspects of the data.
  `
}

// Chart type filtering based on exclusions
function filterChartTypes(
  chartType: ChartRecommendation['type'],
  excludedTypes?: string[]
): boolean {
  if (!excludedTypes || excludedTypes.length === 0) return true
  return !excludedTypes.includes(chartType)
}

// Filter out chart combinations already used in the dashboard
interface DashboardFilter {
  chartType: string
  dataColumns: string[]
}

// Active filter definition
interface ActiveFilter {
  column: string
  operator: string
  value: any
}

function isChartAlreadyUsed(
  chartType: string,
  dataColumns: string[],
  dashboardFilters?: DashboardFilter[]
): boolean {
  if (!dashboardFilters || dashboardFilters.length === 0) return false

  return dashboardFilters.some(filter => {
    if (filter.chartType !== chartType) return false

    // Check if data columns overlap significantly (>50% overlap)
    const commonColumns = filter.dataColumns.filter(col => dataColumns.includes(col))
    return commonColumns.length / Math.max(filter.dataColumns.length, dataColumns.length) > 0.5
  })
}

// Build AI prompt with focus area
function buildFocusedPrompt(
  dataStructure: any,
  focus: 'trends' | 'comparisons' | 'distributions' | 'kpis' | 'all',
  schema?: DataSchema,
  correctedSchema?: CorrectedColumn[],
  excludedTypes?: string[],
  limit: number = 10,
  activeFilters?: ActiveFilter[]
): string {
  let prompt = `Analyze this dataset and recommend ${limit} visualizations with FOCUS on: ${focus.toUpperCase()}\n\n`

  // Add focus-specific instructions
  prompt += FOCUS_INSTRUCTIONS[focus] + '\n\n'

  // Add dataset overview
  prompt += `DATASET OVERVIEW:\n`
  prompt += `- Rows: ${dataStructure.rowCount}\n`
  prompt += `- Columns: ${dataStructure.columnCount}\n\n`

  // Add user corrections (HIGHEST PRIORITY)
  if (correctedSchema && correctedSchema.length > 0) {
    prompt += `USER CORRECTIONS - TRUST THESE 100%:\n`
    correctedSchema.forEach(col => {
      prompt += `• ${col.name}: ${col.type} - "${col.description}"\n`
    })
    prompt += `\n`
  }

  // Add columns with confidence scores
  prompt += `COLUMNS:\n`
  dataStructure.columns.forEach((col: any) => {
    const schemaCol = schema?.columns.find(c => c.name === col.name)
    const isUserCorrected = correctedSchema?.some(c => c.name === col.name)
    const confidence = isUserCorrected ? 100 : (schemaCol?.confidence || 85)

    prompt += `• ${col.name} (${col.type}) [${confidence}% confidence]${isUserCorrected ? ' ✓ USER CORRECTED' : ''}\n`
    prompt += `  - ${col.uniqueValues} unique values, ${col.nullPercentage.toFixed(1)}% missing\n`

    if (col.type === 'number' && col.stats) {
      prompt += `  - Range: ${col.stats.min.toFixed(2)}-${col.stats.max.toFixed(2)}, Avg: ${col.stats.avg.toFixed(2)}\n`
    }

    if (schemaCol?.suggestedUsage && schemaCol.suggestedUsage.length > 0) {
      const usageHints = schemaCol.suggestedUsage.slice(0, 3).join(', ')
      prompt += `  - Suggested usage: ${usageHints}\n`
    }

    prompt += `\n`
  })

  // Add sample data
  prompt += `SAMPLE DATA:\n`
  prompt += `${JSON.stringify(dataStructure.dataSample.slice(0, 2), null, 2)}\n\n`

  // Add exclusions
  if (excludedTypes && excludedTypes.length > 0) {
    prompt += `EXCLUDED CHART TYPES (do NOT generate these):\n`
    prompt += excludedTypes.map(type => `- ${type}`).join('\n') + '\n\n'
  }

  // Add filter awareness
  if (activeFilters && activeFilters.length > 0) {
    prompt += `ACTIVE DASHBOARD FILTERS:\n`
    prompt += `The following filters are currently applied to the dashboard:\n`
    prompt += activeFilters.map(f => `- ${f.column} ${f.operator} ${JSON.stringify(f.value)}`).join('\n') + '\n\n'
    prompt += `IMPORTANT FILTERING CONTEXT:\n`
    prompt += `- The data being analyzed is filtered. Consider this context when generating recommendations.\n`
    prompt += `- You can suggest additional filters in the dataMapping.filters field for each chart\n`
    prompt += `- Filters help focus analysis on specific segments or time periods\n\n`
  } else {
    prompt += `FILTERING CAPABILITIES:\n`
    prompt += `The dashboard supports inline filtering on ALL chart fields:\n`
    prompt += `- Text/Categorical fields: Multi-select specific items (like Excel filtering)\n`
    prompt += `- Date fields: Aggregate by week, month, or year\n`
    prompt += `- Numeric fields: Filter by value ranges\n`
    prompt += `- You can suggest filters in the dataMapping.filters field to focus the analysis\n`
    prompt += `- Example: filters: [{ column: "Region", operator: "in", value: ["North", "South"] }]\n\n`
  }

  // Add response format
  prompt += `Generate EXACTLY ${limit} recommendations. Respond with JSON only:\n`
  prompt += `{\n`
  prompt += `  "insights": ["insight1", "insight2", "insight3"],\n`
  prompt += `  "recommendations": [\n`
  prompt += `    {\n`
  prompt += `      "id": "rec-1",\n`
  prompt += `      "priority": 1,\n`
  prompt += `      "confidence": 0.95,\n`
  prompt += `      "type": "scorecard|bar|line|pie|area|scatter|table",\n`
  prompt += `      "title": "Chart Title",\n`
  prompt += `      "description": "What this shows",\n`
  prompt += `      "reasoning": "Why this chart is recommended for ${focus} analysis",\n`
  prompt += `      "businessValue": "Business impact",\n`
  prompt += `      "dataMapping": {\n`
  prompt += `        "xAxis": "column1",\n`
  prompt += `        "yAxis": ["column2", "column3"],\n`
  prompt += `        "category": "grouping_column",\n`
  prompt += `        "filters": [{ "column": "Region", "operator": "in", "value": ["North"] }]\n`
  prompt += `      },\n`
  prompt += `      "chartConfig": {\n`
  prompt += `        "aggregation": "sum|avg|count|min|max",\n`
  prompt += `        "sortBy": "column",\n`
  prompt += `        "sortOrder": "desc",\n`
  prompt += `        "limit": 10\n`
  prompt += `      },\n`
  prompt += `      "tags": ["${focus}", "high-priority"]\n`
  prompt += `    }\n`
  prompt += `  ],\n`
  prompt += `  "dataContext": {\n`
  prompt += `    "domain": "marketing|sales|finance|operations|general",\n`
  prompt += `    "description": "What this data represents",\n`
  prompt += `    "keyEntities": ["entity1", "entity2"],\n`
  prompt += `    "timeGranularity": "daily|weekly|monthly|none",\n`
  prompt += `    "suggestedQuestions": ["question1", "question2"]\n`
  prompt += `  }\n`
  prompt += `}\n\n`

  // Add final guidelines based on focus
  prompt += `CRITICAL REQUIREMENTS:\n`
  prompt += `1. Generate EXACTLY ${limit} recommendations\n`
  prompt += `2. Follow the ${focus} focus strictly - this is the primary objective\n`
  prompt += `3. Prioritize user-corrected columns in recommendations\n`
  prompt += `4. Include confidence score (0-1) and detailed reasoning for each chart\n`
  prompt += `5. Ensure chart types align with the ${focus} focus area\n`
  prompt += `6. Each recommendation must have unique data mappings\n`
  prompt += `7. Tag each recommendation with "${focus}" for filtering\n`

  return prompt
}

// Analyze data structure (reused from analyze endpoint)
/**
 * Transform DataSchema from schema-analyzer to the format expected by refresh endpoint
 * Uses the centralized analyzeDataSchema for consistent type detection
 */
function analyzeDataStructure(data: DataRow[]) {
  // Use the centralized schema analyzer for consistent type detection
  const schema = analyzeDataSchema(data, 'uploaded_file.csv')

  // Transform to the format expected by buildFocusedPrompt
  const columnInfo = schema.columns.map(col => ({
    name: col.name,
    type: col.type,
    uniqueValues: col.uniqueValues,
    nullCount: col.nullCount,
    nullPercentage: col.nullPercentage,
    sampleValues: col.sampleValues || [],
    stats: col.stats || {}
  }))

  return {
    rowCount: schema.rowCount,
    columnCount: schema.columnCount,
    columns: columnInfo,
    dataSample: getDataSample(data, 2)
  }
}

// Calculate quality score for each recommendation
function calculateQualityScore(
  recommendation: ChartRecommendation,
  schema?: DataSchema,
  correctedColumns?: string[]
): number {
  let score = 0

  // Data type match (40 points)
  const dataTypeMatch = 35 // Base score, can be enhanced with more logic
  score += dataTypeMatch

  // Column confidence (30 points)
  if (schema) {
    const usedColumns = [
      recommendation.dataMapping.xAxis,
      ...(recommendation.dataMapping.yAxis || []),
      recommendation.dataMapping.category
    ].filter(Boolean) as string[]

    const avgConfidence = usedColumns.reduce((sum, col) => {
      const schemaCol = schema.columns.find(c => c.name === col)
      return sum + (schemaCol?.confidence || 85)
    }, 0) / usedColumns.length

    score += (avgConfidence / 100) * 30
  } else {
    score += 25 // Default if no schema
  }

  // Pattern strength (20 points)
  const patternStrength = recommendation.confidence * 20
  score += patternStrength

  // User correction boost (10 points)
  if (correctedColumns && correctedColumns.length > 0) {
    const usedColumns = [
      recommendation.dataMapping.xAxis,
      ...(recommendation.dataMapping.yAxis || []),
      recommendation.dataMapping.category
    ].filter(Boolean) as string[]

    const correctedCount = usedColumns.filter(col => correctedColumns.includes(col)).length
    const correctionBoost = (correctedCount / usedColumns.length) * 10
    score += correctionBoost
  }

  return Math.min(100, Math.round(score))
}

// Request interface
interface RefreshRequest {
  dataId?: string
  data?: DataRow[]
  schema?: DataSchema
  correctedSchema?: CorrectedColumn[]
  filters?: DashboardFilter[]
  excludedTypes?: string[]
  focus?: 'trends' | 'comparisons' | 'distributions' | 'kpis' | 'all'
  limit?: number
  activeFilters?: ActiveFilter[]
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  const aiProvider = getAIProvider()

  console.log('🔵 [API-REFRESH] POST request received:', {
    timestamp: new Date().toISOString(),
    provider: aiProvider
  })

  try {
    // Check API key based on provider
    const hasApiKey = aiProvider === 'gemini'
      ? !!process.env.GOOGLE_GEMINI_API_KEY
      : !!process.env.OPENAI_API_KEY

    if (!hasApiKey) {
      return NextResponse.json(
        { error: `${aiProvider.toUpperCase()} API key not configured` },
        { status: 503 }
      )
    }

    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      console.log('❌ [API-REFRESH] Rate limit exceeded for client:', clientIp)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, recommendationsRefreshRequestSchema)
    if (!validation.success) {
      return validation.response
    }

    const {
      dataId,
      data,
      schema,
      correctedSchema,
      filters,
      excludedTypes,
      focus = 'all',
      limit = 10,
      activeFilters
    } = validation.data

    console.log('🔍 [API-REFRESH] Request parsed:', {
      hasDataId: !!dataId,
      hasData: !!data,
      dataLength: data?.length,
      hasSchema: !!schema,
      correctedColumnsCount: correctedSchema?.length || 0,
      dashboardFiltersCount: filters?.length || 0,
      activeFiltersCount: activeFilters?.length || 0,
      excludedTypes: excludedTypes || [],
      focus,
      limit
    })

    // Analyze data structure
    console.log('🔵 [API-REFRESH] Analyzing data structure...')
    const dataStructure = analyzeDataStructure((data || []) as DataRow[])

    // Build focused prompt
    console.log('🔍 [API-REFRESH] Building focused prompt:', {
      focus,
      hasSchema: !!schema,
      hasCorrectedSchema: !!correctedSchema,
      excludedTypes: excludedTypes || [],
      limit
    })

    const prompt = buildFocusedPrompt(
      dataStructure,
      focus,
      schema as DataSchema | undefined,
      correctedSchema as CorrectedColumn[] | undefined,
      excludedTypes,
      limit,
      activeFilters as ActiveFilter[] | undefined
    )

    // Call AI API
    console.log(`🚀 [API-REFRESH] Calling ${aiProvider.toUpperCase()} API...`)
    const startTime = Date.now()

    const messages: AIMessage[] = [
      {
        role: "system",
        content: `You are an expert data visualization specialist. Generate high-quality chart recommendations tailored to specific analytical needs. Always respond with valid JSON. Focus on the requested analytical perspective (${focus}). Each recommendation should be unique, valuable, and aligned with the focus area.

You MUST respond with valid JSON using the expected format with "recommendations" array and "dataContext" object.`
      },
      {
        role: "user",
        content: prompt
      }
    ]

    const response = await Promise.race([
      generateCompletionWithRetry(messages, {
        temperature: 0.8, // Higher temperature for more diverse recommendations
        maxTokens: 4000,
        jsonMode: true
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${aiProvider.toUpperCase()} API call timed out after 25 seconds`)), 25000)
      )
    ])

    const endTime = Date.now()
    const aiDuration = endTime - startTime
    console.log(`✅ [API-REFRESH] ${aiProvider.toUpperCase()} API call completed:`, {
      duration: aiDuration + 'ms'
    })

    if (!response) {
      throw new Error(`No response from ${aiProvider.toUpperCase()}`)
    }

    // Parse AI response using robust JSON extraction
    console.log('🔵 [API-REFRESH] Parsing AI response...')
    const aiAnalysis = parseJSONFromString<{
      recommendations: ChartRecommendation[]
      dataContext?: DataContext
    }>(response)

    // Validate response structure
    if (!aiAnalysis.recommendations || !Array.isArray(aiAnalysis.recommendations)) {
      throw new Error('Invalid recommendations format from AI')
    }

    // Filter out excluded chart types
    let recommendations = aiAnalysis.recommendations.filter((rec: ChartRecommendation) =>
      filterChartTypes(rec.type, excludedTypes)
    )

    // Filter out charts already on dashboard
    if (filters && filters.length > 0) {
      recommendations = recommendations.filter((rec: ChartRecommendation) => {
        const dataColumns = [
          rec.dataMapping.xAxis,
          ...(rec.dataMapping.yAxis || []),
          rec.dataMapping.category
        ].filter(Boolean) as string[]

        return !isChartAlreadyUsed(rec.type, dataColumns, filters)
      })
    }

    // Calculate quality scores
    const correctedColumnNames = correctedSchema?.map(c => c.name) || []
    recommendations = recommendations.map((rec: ChartRecommendation) => ({
      ...rec,
      qualityScore: calculateQualityScore(rec, schema as DataSchema | undefined, correctedColumnNames),
      metadata: {
        usesUserCorrections: correctedColumnNames.length > 0,
        correctedColumns: correctedColumnNames,
        generationVersion: 1
      }
    }))

    // Sort by quality score (descending)
    recommendations.sort((a: any, b: any) => (b.qualityScore || 0) - (a.qualityScore || 0))

    // Limit to requested count
    recommendations = recommendations.slice(0, limit)

    // Calculate summary statistics
    const totalGenerated = aiAnalysis.recommendations.length
    const averageQuality = recommendations.reduce((sum: number, rec: any) =>
      sum + (rec.qualityScore || 0), 0
    ) / recommendations.length
    const excludedCount = totalGenerated - recommendations.length

    const result = {
      recommendations,
      dataContext: aiAnalysis.dataContext || {
        domain: 'general',
        description: 'Data analysis',
        keyEntities: [],
        timeGranularity: 'none',
        suggestedQuestions: []
      },
      summary: {
        totalGenerated,
        averageQuality: Math.round(averageQuality),
        topRecommendation: recommendations[0] || null,
        focusArea: focus,
        excludedCount,
        timeTaken: Date.now() - requestStartTime
      }
    }

    const totalDuration = Date.now() - requestStartTime
    console.log('✅ [API-REFRESH] Refresh completed successfully:', {
      recommendationsReturned: recommendations.length,
      averageQuality: result.summary.averageQuality,
      focusArea: focus,
      excludedCount,
      totalDuration: totalDuration + 'ms',
      aiDuration: aiDuration + 'ms',
      provider: aiProvider
    })

    return NextResponse.json(result)

  } catch (error) {
    const totalDuration = Date.now() - requestStartTime
    console.error('❌ [API-REFRESH] Error in refresh API:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: totalDuration + 'ms'
    })

    // Handle specific AI provider errors
    if (error && typeof error === 'object') {
      const err = error as any

      if (err.code === 'rate_limit_exceeded' || err.status === 429) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. Please wait a moment and try again.',
            type: 'rate_limit'
          },
          { status: 429 }
        )
      }

      if (err.code === 'insufficient_quota' || err.status === 402) {
        return NextResponse.json(
          {
            error: 'AI quota exceeded. Please check your billing.',
            type: 'quota_exceeded'
          },
          { status: 402 }
        )
      }

      if (err.status === 401) {
        return NextResponse.json(
          {
            error: 'AI API key is invalid or expired.',
            type: 'auth_error'
          },
          { status: 401 }
        )
      }

      if (err.status >= 500) {
        return NextResponse.json(
          {
            error: 'AI service is temporarily unavailable.',
            type: 'server_error'
          },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Recommendation refresh failed',
        type: 'unknown_error'
      },
      { status: 500 }
    )
  }
}