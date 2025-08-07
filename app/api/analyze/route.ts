import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { DataRow, AnalysisResult } from '@/lib/store'

// Initialize OpenAI client only when needed
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// Rate limiting (simple in-memory store for demo)
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

function getDataSample(data: DataRow[], maxRows: number = 3): DataRow[] {
  // Get a representative sample of the data - reduced to 3 rows for faster processing
  if (data.length <= maxRows) return data
  
  // Take first few rows and a few random rows
  const firstRows = data.slice(0, Math.ceil(maxRows / 2))
  const randomRows = data
    .slice(Math.ceil(maxRows / 2))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(maxRows / 2))
  
  return [...firstRows, ...randomRows]
}

function analyzeDataStructure(data: DataRow[]) {
  const columns = Object.keys(data[0] || {})
  const columnInfo = columns.map(col => {
    const values = data.map(row => row[col])
    const nonNullValues = values.filter(v => v !== null && v !== undefined)
    const uniqueValues = new Set(nonNullValues)
    const nullCount = values.length - nonNullValues.length
    
    // Determine column type
    let type = 'string'
    if (nonNullValues.length > 0) {
      if (nonNullValues.every(v => typeof v === 'number' && !isNaN(v))) {
        type = 'number'
      } else if (nonNullValues.every(v => v instanceof Date || (!isNaN(Date.parse(String(v))) && String(v).match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)))) {
        type = 'date'
      } else if (nonNullValues.every(v => typeof v === 'boolean' || ['true', 'false', '1', '0', 'yes', 'no'].includes(String(v).toLowerCase()))) {
        type = 'boolean'
      } else if (uniqueValues.size < Math.max(10, nonNullValues.length * 0.1)) {
        type = 'categorical'
      }
    }
    
    // Calculate basic statistics for numeric columns
    let stats = {}
    if (type === 'number') {
      const numericValues = nonNullValues.map(v => Number(v)).filter(v => !isNaN(v))
      if (numericValues.length > 0) {
        stats = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        }
      }
    }
    
    return {
      name: col,
      type,
      uniqueValues: uniqueValues.size,
      nullCount,
      nullPercentage: (nullCount / values.length) * 100,
      sampleValues: Array.from(uniqueValues).slice(0, 5),
      stats
    }
  })

  return {
    rowCount: data.length,
    columnCount: columns.length,
    columns: columnInfo,
    dataSample: getDataSample(data, 2) // Reduced to just 2 sample rows
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  console.log('🔵 [API-ANALYZE] POST request received:', {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  })
  
  try {
    // Check API key
    console.log('🔍 [API-ANALYZE] Checking OpenAI API key...')
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ [API-ANALYZE] OpenAI API key not configured')
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }
    console.log('✅ [API-ANALYZE] OpenAI API key found')

    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    
    console.log('🔍 [API-ANALYZE] Client IP for rate limiting:', clientIp)

    // Check rate limit
    console.log('🔍 [API-ANALYZE] Checking rate limit...')
    if (!checkRateLimit(clientIp)) {
      console.log('❌ [API-ANALYZE] Rate limit exceeded for client:', clientIp)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }
    console.log('✅ [API-ANALYZE] Rate limit check passed')

    // Parse request body
    console.log('🔵 [API-ANALYZE] Parsing request body...')
    const { data }: { data: DataRow[] } = await request.json()
    
    console.log('🔍 [API-ANALYZE] Request data parsed:', {
      hasData: !!data,
      isArray: Array.isArray(data),
      dataLength: data?.length,
      firstRowKeys: data?.[0] ? Object.keys(data[0]) : null,
      sampleData: data?.slice(0, 2)
    })

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('❌ [API-ANALYZE] Invalid data provided:', { data, isArray: Array.isArray(data), length: data?.length })
      return NextResponse.json(
        { error: 'Invalid data provided' },
        { status: 400 }
      )
    }
    console.log('✅ [API-ANALYZE] Data validation passed')

    // Analyze data structure
    console.log('🔵 [API-ANALYZE] Analyzing data structure...')
    const dataStructure = analyzeDataStructure(data)
    console.log('✅ [API-ANALYZE] Data structure analysis completed:', {
      rowCount: dataStructure.rowCount,
      columnCount: dataStructure.columnCount,
      columnTypes: dataStructure.columns.map(c => ({ name: c.name, type: c.type }))
    })

    // Create simplified prompt for OpenAI
    const prompt = `Analyze this dataset and create charts:

Dataset: ${dataStructure.rowCount} rows, ${dataStructure.columnCount} columns

Columns:
${dataStructure.columns.map(col => 
  `- ${col.name} (${col.type}): ${col.uniqueValues} unique, ${col.nullPercentage.toFixed(1)}% null`
).join('\n')}

Sample:
${JSON.stringify(dataStructure.dataSample.slice(0, 2), null, 2)}

Respond with JSON only:
{
  "insights": ["insight1", "insight2", "insight3"],
  "chartConfig": [
    {
      "type": "scorecard|bar|line|pie|area|scatter|table",
      "title": "Chart Title",
      "dataKey": ["column1", "column2"],
      "description": "What this shows",
      "aggregation": "sum|avg|count|min|max" // for scorecards only
    }
  ],
  "summary": {
    "dataQuality": "good|fair|poor",
    "keyFindings": "Main findings",
    "recommendations": "Actions to take",
    "businessContext": "What this data represents"
  }
}

IMPORTANT GUIDELINES:
1. Start with 2-4 scorecards for key metrics (total spend, ROI, conversion rate, etc.)
2. Include at least one table showing top/bottom performers or detailed breakdowns
3. Mix visualization types - don't repeat the same chart type more than twice
4. For marketing data, prioritize: scorecards for KPIs, tables for campaign details, trends for time series
5. Create 6-10 visualizations total, ensuring variety
6. AVOID creating charts for metrics that are all zeros or have no variation`

    // Get OpenAI client and call API with timeout
    console.log('🔵 [API-ANALYZE] Initializing OpenAI client...')
    const openai = getOpenAIClient()
    console.log('✅ [API-ANALYZE] OpenAI client initialized')
    
    console.log('🚀 [API-ANALYZE] Making OpenAI API call...')
    const startTime = Date.now()
    
    // Add explicit timeout wrapper around OpenAI call
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini", // Use faster model to avoid timeouts
        messages: [
          {
            role: "system",
            content: "You are an expert data analyst who provides comprehensive analysis of datasets. Always respond with valid JSON in the exact format requested. IMPORTANT: Generate DIVERSE and CREATIVE visualizations - avoid repetitive chart types. Each dataset has unique characteristics that should drive unique analytical approaches. Think like a business analyst solving real problems, not just displaying data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000, // Reduced token limit for faster processing
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API call timed out after 20 seconds')), 20000)
      )
    ]) as any
    
    const endTime = Date.now()
    const openaiDuration = endTime - startTime
    console.log('✅ [API-ANALYZE] OpenAI API call completed:', {
      duration: openaiDuration + 'ms',
      timestamp: new Date().toISOString()
    })

    const response = completion.choices[0]?.message?.content
    console.log('🔍 [API-ANALYZE] OpenAI response received:', {
      hasResponse: !!response,
      responseLength: response?.length,
      choicesCount: completion.choices?.length
    })
    
    if (!response) {
      console.error('❌ [API-ANALYZE] No response from OpenAI')
      throw new Error('No response from OpenAI')
    }

    try {
      // Parse OpenAI response
      console.log('🔵 [API-ANALYZE] Parsing OpenAI JSON response...')
      const aiAnalysis = JSON.parse(response)
      
      // Log the number of charts generated
      console.log('✅ [API-ANALYZE] AI response parsed successfully:', {
        chartsCount: aiAnalysis.chartConfig?.length || 0,
        chartTypes: aiAnalysis.chartConfig?.map((c: any) => c.type).join(', ') || 'none',
        insightsCount: aiAnalysis.insights?.length || 0,
        hasSummary: !!aiAnalysis.summary
      })
      
      // Validate required structure
      console.log('🔍 [API-ANALYZE] Validating AI response structure...')
      if (!aiAnalysis.insights || !Array.isArray(aiAnalysis.insights)) {
        console.error('❌ [API-ANALYZE] Invalid insights format:', aiAnalysis.insights)
        throw new Error('Invalid insights format')
      }
      if (!aiAnalysis.chartConfig || !Array.isArray(aiAnalysis.chartConfig)) {
        console.error('❌ [API-ANALYZE] Invalid chartConfig format:', aiAnalysis.chartConfig)
        throw new Error('Invalid chartConfig format')
      }
      console.log('✅ [API-ANALYZE] AI response structure validation passed')

      // Build final analysis result with SQL queries
      const analysisResult: AnalysisResult = {
        insights: aiAnalysis.insights,
        chartConfig: aiAnalysis.chartConfig.map((config: any) => ({
          type: config.type,
          title: config.title,
          dataKey: Array.isArray(config.dataKey) ? config.dataKey : [config.dataKey],
          description: config.description,
          aggregation: config.aggregation
        })),
        summary: {
          rowCount: dataStructure.rowCount,
          columnCount: dataStructure.columnCount,
          columns: dataStructure.columns.map(col => ({
            name: col.name,
            type: col.type,
            uniqueValues: col.uniqueValues,
            nullCount: col.nullCount
          })),
          // Add AI-generated summary fields
          ...(aiAnalysis.summary && {
            dataQuality: aiAnalysis.summary.dataQuality,
            keyFindings: aiAnalysis.summary.keyFindings,
            recommendations: aiAnalysis.summary.recommendations,
            businessContext: aiAnalysis.summary.businessContext || aiAnalysis.dataContext
          })
        }
      }
      
      // Log analysis details for debugging
      const totalDuration = Date.now() - requestStartTime
      console.log('✅ [API-ANALYZE] Analysis completed successfully:', {
        dataContext: aiAnalysis.dataContext,
        keyQuestions: aiAnalysis.keyQuestions,
        totalVisualizations: aiAnalysis.chartConfig?.length || 0,
        scorecards: aiAnalysis.chartConfig?.filter((c: any) => c.type === 'scorecard').length || 0,
        charts: aiAnalysis.chartConfig?.filter((c: any) => c.type !== 'scorecard').length || 0,
        totalRequestDuration: totalDuration + 'ms',
        openaiDuration: openaiDuration + 'ms',
        timestamp: new Date().toISOString()
      })

      console.log('🚀 [API-ANALYZE] Returning successful analysis result')
      return NextResponse.json(analysisResult)

    } catch (parseError) {
      console.error('❌ [API-ANALYZE] Error parsing OpenAI response:', {
        error: parseError,
        message: parseError instanceof Error ? parseError.message : 'Unknown error',
        responseLength: response?.length,
        responsePreview: response?.substring(0, 200)
      })
      console.error('❌ [API-ANALYZE] Raw response:', response)
      
      // Fallback to basic analysis if AI response is malformed
      return NextResponse.json({
        insights: [
          "AI analysis temporarily unavailable. Using basic statistical analysis.",
          `Dataset contains ${dataStructure.rowCount} rows and ${dataStructure.columnCount} columns.`,
          `Found ${dataStructure.columns.filter(c => c.type === 'number').length} numeric columns and ${dataStructure.columns.filter(c => c.type === 'categorical').length} categorical columns.`
        ],
        chartConfig: generateFallbackCharts(dataStructure.columns),
        summary: {
          rowCount: dataStructure.rowCount,
          columnCount: dataStructure.columnCount,
          columns: dataStructure.columns.map(col => ({
            name: col.name,
            type: col.type,
            uniqueValues: col.uniqueValues,
            nullCount: col.nullCount
          }))
        }
      }, { status: 200 })
    }

  } catch (error) {
    const totalDuration = Date.now() - requestStartTime
    console.error('❌ [API-ANALYZE] Error in analysis API:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: totalDuration + 'ms',
      timestamp: new Date().toISOString()
    })
    
    // Detailed error logging for OpenAI issues
    if (error && typeof error === 'object') {
      const err = error as any
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        code: err.code,
        type: err.type,
        status: err.status,
        headers: err.headers,
        stack: err.stack
      })
      
      // Check for specific OpenAI error types
      if (err.code === 'rate_limit_exceeded') {
        console.error('Rate limit exceeded! Details:', err.message)
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please wait a moment and try again.',
            type: 'rate_limit',
            details: err.message
          },
          { status: 429 }
        )
      }
      
      if (err.code === 'insufficient_quota') {
        console.error('Insufficient quota! Details:', err.message)
        return NextResponse.json(
          { 
            error: 'OpenAI quota exceeded. Please check your billing.',
            type: 'quota_exceeded',
            details: err.message
          },
          { status: 402 }
        )
      }
      
      if (err.status === 429) {
        console.error('429 Rate limit from OpenAI:', err.message)
        return NextResponse.json(
          { 
            error: 'Too many requests to OpenAI. Please try again in a few minutes.',
            type: 'rate_limit',
            details: err.message
          },
          { status: 429 }
        )
      }
      
      if (err.status === 401) {
        console.error('401 Unauthorized from OpenAI:', err.message)
        return NextResponse.json(
          { 
            error: 'OpenAI API key is invalid or expired.',
            type: 'auth_error',
            details: err.message
          },
          { status: 401 }
        )
      }
      
      if (err.status >= 500) {
        console.error('OpenAI server error:', err.status, err.message)
        return NextResponse.json(
          { 
            error: 'OpenAI service is temporarily unavailable.',
            type: 'server_error',
            details: err.message
          },
          { status: 503 }
        )
      }
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Analysis failed',
        type: 'unknown_error',
        details: 'Please check your data format and try again'
      },
      { status: 500 }
    )
  }
}


function generateFallbackCharts(columns: any[]) {
  const charts = []
  const numericColumns = columns.filter(c => c.type === 'number')
  const categoricalColumns = columns.filter(c => c.type === 'categorical')
  
  // Add a basic bar chart if we have categorical and numeric data
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    charts.push({
      type: 'bar',
      title: `${numericColumns[0].name} by ${categoricalColumns[0].name}`,
      dataKey: [categoricalColumns[0].name, numericColumns[0].name],
      description: 'Distribution of values across categories',
    })
  }
  
  // Add line chart for multiple numeric columns
  if (numericColumns.length >= 2) {
    charts.push({
      type: 'line',
      title: 'Numeric Values Comparison',
      dataKey: numericColumns.slice(0, 3).map(c => c.name),
      description: 'Trends and patterns in numeric data'
    })
  }
  
  return charts
}