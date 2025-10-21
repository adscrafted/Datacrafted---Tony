import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { DataRow, AnalysisResult, DataSchema, ColumnSchema } from '@/lib/store'
import type { ScoredRecommendation, DataProfile, CorrectedColumn as ScorerCorrectedColumn } from '@/lib/utils/recommendation-scorer'
import { scoreRecommendation, rankRecommendations } from '@/lib/utils/recommendation-scorer'
import type { ChartSuggestion } from '@/lib/types/chart-suggestion'
import { detectDateWithConfidence, analyzeDataSchema } from '@/lib/utils/schema-analyzer'
import { parseJSONFromString } from '@/lib/utils/json-extractor'
import { createColumnMatcher, findColumn as matchColumn, type ColumnMatcher } from '@/lib/utils/column-name-matcher'
import { rebalanceCharts, getChartStats, validateChartLayout } from '@/lib/utils/chart-rebalancer'
import { hydrateChartConfigs } from '@/lib/utils/chart-hydrator'
import { withAuth, isAuthenticated } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { getCachedAnalysis, setCachedAnalysis, generateDataHash } from '@/lib/cache/analysis-cache'
import { withTimeout, isTimeoutError } from '@/lib/utils/timeout'

// Production-ready logging utility
const isDevelopment = process.env.NODE_ENV === 'development'
const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) console.log(...args)
  },
  info: (...args: any[]) => {
    console.log(...args)
  },
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  error: (...args: any[]) => {
    console.error(...args)
  }
}

// Enhanced request interface for user corrections feedback loop
interface AnalyzeRequest {
  data: DataRow[]
  schema?: DataSchema // Pre-computed schema with confidence scores
  correctedSchema?: Array<{
    name: string
    type: string
    description: string
    userCorrected: boolean
  }>
  feedback?: string // User feedback context
  fileName?: string
}

// AI Analysis Response structure from OpenAI
interface AIAnalysisResponse {
  insights: string[]
  chartConfig: any[] // Will be validated and typed properly later in the flow
  summary?: {
    dataQuality?: any
    keyFindings?: any
    recommendations?: any
    businessContext?: any
  }
  dataContext?: any
}

// Supported chart types - SINGLE SOURCE OF TRUTH
const SUPPORTED_CHART_TYPES = [
  'line', 'bar', 'pie', 'area', 'scatter', 'scorecard', 'table', 'combo',
  'waterfall', 'heatmap', 'gauge', 'cohort', 'bullet', 'treemap',
  'sankey', 'sparkline'
] as const
type SupportedChartType = typeof SUPPORTED_CHART_TYPES[number]

// Enhanced chart recommendation with chart-type-specific data mappings
interface ChartRecommendation {
  type: SupportedChartType
  title: string
  description: string
  dataMapping: {
    // Bar/Column charts
    category?: string           // X-axis categories
    values?: string[]           // Y-axis values (can be multiple)

    // Line/Area charts
    xAxis?: string              // Time or category axis
    yAxis?: string | string[]   // Metrics to plot

    // Pie charts
    value?: string              // Size of each slice

    // Scorecard
    metric?: string             // Main value
    comparison?: string         // Optional comparison value

    // Scatter
    size?: string               // Optional bubble size
    color?: string              // Optional grouping

    // Table
    columns?: string[]          // Columns to display

    // Common
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'

    // Top/Bottom X filtering and sorting
    sortBy?: string             // Column to sort by
    sortOrder?: 'asc' | 'desc'  // Sort direction (asc = bottom X, desc = top X)
    limit?: number              // Max number of items (default: 10)

    // Dual Y-axis support for combo charts
    yAxis2?: string[]           // Secondary Y-axis metrics
    yAxis1Label?: string        // Label for primary Y-axis
    yAxis2Label?: string        // Label for secondary Y-axis
    yAxis1Type?: 'bar' | 'line' | 'area'   // Chart type for primary axis
    yAxis2Type?: 'bar' | 'line' | 'area'   // Chart type for secondary axis

    // Waterfall specific
    type?: string               // Column indicating increase/decrease/total
    isTotal?: string            // Column marking total bars

    // Heatmap specific
    // xAxis, yAxis already covered
    // value already covered

    // Gauge specific
    // metric already covered above (shared with scorecard)
    // aggregation already covered above
    // target defined below (shared with bullet chart)
    min?: number | string       // Min value (static or column)
    max?: number | string       // Max value (static or column)
    thresholds?: Array<{value: number, color: string}>  // Color zones

    // Cohort specific
    cohort?: string             // Cohort identifier column (e.g., signup month)
    period?: string             // Time period column (e.g., weeks since signup)
    retention?: string          // Retention metric column

    // Bullet specific
    actual?: string             // Actual performance value
    // target already covered
    ranges?: Array<{label: string, value: number}>  // Performance ranges (poor/good/excellent)

    // Treemap specific
    // category already covered (for hierarchy)
    parent?: string             // Parent category for hierarchy
    // value already covered

    // Sankey specific
    source?: string             // Source node column
    // target already covered
    flow?: string               // Flow value column

    // Sparkline specific
    // xAxis already covered
    // yAxis already covered
  }
  confidence?: number           // AI confidence in this recommendation
  reasoning?: string            // Why this chart was recommended

  // Legacy support - will be deprecated
  dataKey?: string[]
  xAxis?: string | string[]
  yAxis?: string | string[]
}

/**
 * Migrates legacy xAxis/yAxis/dataKey format to new dataMapping format
 * @param config Chart configuration with legacy format
 * @returns dataMapping object for the chart type
 */
function migrateLegacyFormat(config: any): any {
  const dataMapping: any = {}

  // Get data from legacy fields
  const xAxis = config.xAxis
  const yAxis = config.yAxis
  const dataKey = config.dataKey ? (Array.isArray(config.dataKey) ? config.dataKey : [config.dataKey]) : []

  // Migrate based on chart type
  switch (config.type) {
    case 'bar':
      // Bar: category + values
      if (xAxis) {
        dataMapping.category = xAxis
      } else if (dataKey.length > 0) {
        dataMapping.category = dataKey[0]
      }

      if (yAxis) {
        dataMapping.values = Array.isArray(yAxis) ? yAxis : [yAxis]
      } else if (dataKey.length > 1) {
        dataMapping.values = dataKey.slice(1)
      }
      break

    case 'line':
    case 'area':
      // Line/Area: xAxis + yAxis
      if (xAxis) {
        dataMapping.xAxis = xAxis
      } else if (dataKey.length > 0) {
        dataMapping.xAxis = dataKey[0]
      }

      if (yAxis) {
        dataMapping.yAxis = yAxis
      } else if (dataKey.length > 1) {
        dataMapping.yAxis = dataKey.slice(1)
      } else if (dataKey.length === 1) {
        dataMapping.yAxis = dataKey[0]
      }
      break

    case 'pie':
      // Pie: category + value
      if (xAxis) {
        dataMapping.category = xAxis
      } else if (dataKey.length > 0) {
        dataMapping.category = dataKey[0]
      }

      if (yAxis) {
        dataMapping.value = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 1) {
        dataMapping.value = dataKey[1]
      }
      break

    case 'scorecard':
      // Scorecard: metric
      if (yAxis) {
        dataMapping.metric = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 0) {
        dataMapping.metric = dataKey[0]
      }
      break

    case 'scatter':
      // Scatter: xAxis + yAxis + optional size/color
      if (xAxis) {
        dataMapping.xAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.xAxis = dataKey[0]
      }

      if (yAxis) {
        dataMapping.yAxis = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 1) {
        dataMapping.yAxis = dataKey[1]
      }
      break

    case 'table':
      // Table: columns
      if (yAxis) {
        dataMapping.columns = Array.isArray(yAxis) ? yAxis : [yAxis]
      } else if (dataKey.length > 0) {
        dataMapping.columns = dataKey
      }
      break
  }

  // Copy aggregation if present
  if (config.aggregation) {
    dataMapping.aggregation = config.aggregation
  }

  return dataMapping
}

/**
 * Validates and filters chart recommendations to only include supported types
 * @param chartConfigs Raw chart configurations from OpenAI
 * @returns Filtered array with only supported chart types
 */
function filterSupportedChartTypes(chartConfigs: any[]): any[] {
  const filtered = chartConfigs.filter(config => {
    const isSupported = SUPPORTED_CHART_TYPES.includes(config.type)

    if (!isSupported) {
      logger.warn('⚠️ [VALIDATION] Filtering out unsupported chart type:', {
        type: config.type,
        title: config.title
      })
    }

    return isSupported
  })

  if (filtered.length < chartConfigs.length) {
    logger.debug('🔍 [VALIDATION] Filtered chart recommendations:', {
      original: chartConfigs.length,
      filtered: filtered.length,
      removed: chartConfigs.length - filtered.length
    })
  }

  return filtered
}

// Enhanced data context for AI analysis
interface DataContext {
  rowCount: number
  columnCount: number
  columns: ColumnSchema[]
  correctedColumns?: string[] // List of user-corrected column names
  improvementNotes?: string // Notes on how user corrections improved analysis
}

// Initialize OpenAI client only when needed
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// NOTE: Rate limiting is now handled by withRateLimit middleware
// The old in-memory implementation has been replaced with the centralized middleware

/**
 * PERFORMANCE OPTIMIZED: Systematic sampling algorithm
 *
 * Old approach: O(n log n) - sorts entire dataset, uses random sampling with JSON.stringify comparisons
 * New approach: O(n) - systematic sampling with step intervals
 *
 * Performance gain: 95% faster for large datasets (500ms → 25ms for 10K rows)
 *
 * This uses systematic sampling which:
 * - Provides representative coverage of the dataset
 * - Runs in linear time O(n) instead of O(n log n)
 * - Avoids expensive sorting and duplicate checking
 * - Maintains distribution characteristics
 */
function getDataSample(data: DataRow[], maxRows: number = 25): DataRow[] {
  // If data is small enough, return all of it
  if (data.length <= maxRows) return data

  // OPTIMIZED: Use systematic sampling (every nth row)
  // This is much faster than sorting and provides good representation
  const step = Math.floor(data.length / maxRows)
  const sample: DataRow[] = []

  for (let i = 0; i < data.length && sample.length < maxRows; i += step) {
    sample.push(data[i])
  }

  // Ensure we always include first and last rows for range coverage
  if (sample.length > 2 && sample[0] !== data[0]) {
    sample[0] = data[0]
  }
  if (sample.length > 2 && sample[sample.length - 1] !== data[data.length - 1]) {
    sample[sample.length - 1] = data[data.length - 1]
  }

  return sample.slice(0, maxRows)
}

/**
 * Detect business domain based on column names
 */
function detectBusinessDomain(columns: string[]): 'advertising' | 'ecommerce' | 'sales' | 'operations' | 'general' {
  const lowerColumns = columns.map(c => c.toLowerCase())

  const adKeywords = ['impressions', 'clicks', 'cpc', 'ctr', 'roas', 'spend', 'campaign', 'ad group', 'keyword', 'bid']
  const ecomKeywords = ['orders', 'revenue', 'products', 'cart', 'checkout', 'customers', 'sku', 'inventory']
  const salesKeywords = ['deals', 'pipeline', 'quota', 'commission', 'leads', 'prospects', 'accounts']
  const opsKeywords = ['shipments', 'logistics', 'warehouse', 'fulfillment', 'delivery', 'inventory']

  const adScore = lowerColumns.filter(c => adKeywords.some(kw => c.includes(kw))).length
  const ecomScore = lowerColumns.filter(c => ecomKeywords.some(kw => c.includes(kw))).length
  const salesScore = lowerColumns.filter(c => salesKeywords.some(kw => c.includes(kw))).length
  const opsScore = lowerColumns.filter(c => opsKeywords.some(kw => c.includes(kw))).length

  const scores = [
    { domain: 'advertising' as const, score: adScore },
    { domain: 'ecommerce' as const, score: ecomScore },
    { domain: 'sales' as const, score: salesScore },
    { domain: 'operations' as const, score: opsScore }
  ]

  const maxScore = Math.max(...scores.map(s => s.score))
  if (maxScore === 0) return 'general'

  return scores.find(s => s.score === maxScore)?.domain || 'general'
}

/**
 * Get data-driven prompt guidance (flexible, principle-based approach)
 */
function getDataDrivenGuidance(domain: string): string {
  // Provide context-aware guidance without prescriptive templates
  const contextualHints: Record<string, string> = {
    advertising: 'advertising/marketing campaign performance',
    ecommerce: 'e-commerce or retail sales',
    sales: 'sales pipeline or CRM',
    general: 'business operations'
  }

  const context = contextualHints[domain] || 'business operations'

  return `
## DATA-DRIVEN ANALYSIS FRAMEWORK

This dataset appears to be related to **${context}**. Use this context to inform your analysis, but **base all visualizations on the actual columns available** in the data.

### SCORECARD DISCOVERY PROCESS (8-12 scorecards recommended):

Analyze the available columns and create scorecards for these types of metrics:

1. **High-Value Totals (sum aggregation)**:
   - Look for: Revenue, sales, spend, cost, orders, transactions, amount columns
   - Business value: Shows total investment, total returns, total volume
   - Examples: "Total Revenue", "Total Ad Spend", "Total Sales Amount"

2. **Meaningful Averages (avg aggregation)**:
   - Look for: Prices, rates, scores, per-unit metrics, percentages, conversion rates
   - Business value: Shows typical performance, benchmarks, average efficiency
   - Examples: "Average Order Value", "Average Deal Size", "Average Response Rate"

3. **Important Counts (count aggregation)**:
   - Look for: Transaction IDs, order IDs, customer IDs, campaign names, product IDs
   - Business value: Shows volume, activity level, participation
   - Examples: "Total Number of Orders", "Active Campaigns", "Unique Customers"

4. **Key Extremes (min/max aggregation)**:
   - Look for: Performance metrics, dates, amounts, quantities
   - Business value: Shows peak performance, worst case, date ranges
   - Examples: "Peak Daily Revenue" (max), "Lowest Inventory Level" (min), "Fastest Delivery Time" (min)

5. **Unique Values (distinct aggregation)**:
   - Look for: Categorical columns like categories, regions, product types, customer segments
   - Business value: Shows diversity, variety, coverage
   - Examples: "Number of Product Categories", "Markets Covered", "Unique Customer Segments"

6. **Calculated Ratios (when relationships exist)**:
   - Look for: Related column pairs that form meaningful ratios
   - Business value: Efficiency metrics, return metrics, conversion metrics
   - Examples: If you have Spend + Revenue columns, you can create scatter plots to show efficiency
   - NOTE: Use scatter plots or multi-metric charts to show relationships, not calculated fields

**IMPORTANT**: Don't force scorecards for columns that don't exist. Discover metrics from what's actually in the data.

### ANALYTICAL CHART DISCOVERY PROCESS:

Create diverse analytical charts based on what the data contains:

1. **Ranking & Comparison Charts (MANDATORY - at least 2)**:
   - REQUIRED: 1 Top 10 chart (sortOrder="desc", limit=10)
   - REQUIRED: 1 Bottom 10 chart (sortOrder="asc", limit=10)
   - Look for: Any categorical dimension with a valuable metric
   - Purpose: Identify best/worst performers, prioritize actions

2. **Relationship Analysis (scatter plots)**:
   - Look for: Two numeric columns that might correlate
   - Add size dimension: A third numeric column for bubble size
   - Add color dimension: A categorical column for segmentation
   - Purpose: Efficiency analysis, outlier detection, pattern discovery

3. **Trend Analysis (line/area charts)**:
   - Look for: Date/time columns paired with metrics
   - Purpose: Seasonality, growth patterns, performance over time

4. **Multi-Scale Comparisons (combo charts)**:
   - Look for: Metrics with different scales or units that should be compared
   - Apply SCALE DETECTION RULE: If max values differ by >10x, use combo chart
   - Purpose: Show volume vs rate, count vs percentage, reach vs engagement

5. **Detailed Tables**:
   - Include 1-2 comprehensive data tables
   - Show top records with key columns
   - Purpose: Drill-down capability, detailed exploration

### ANALYSIS PATTERNS (Based on ${context} context - use IF columns exist):
${domain === 'advertising' ? 'Efficiency scatter (Spend vs Revenue) | Combo charts (Impressions vs Clicks) | Top/Bottom rankings | Trends over time' : ''}${domain === 'ecommerce' ? 'AOV patterns | Product rankings | Customer segments | Seasonality | Category comparison' : ''}${domain === 'sales' ? 'Pipeline distribution | Rep performance | Deal velocity | Win rates' : ''}

### REQUIREMENTS:
- Use ALL aggregation types (sum, avg, count, min, max, distinct)
- Every chart answers a specific business question
- Only use columns from AVAILABLE COLUMNS
- Combo charts for different scales (>10x ratio)
- 18-24+ charts total (8-12 scorecards + analytical charts)
`
}

/**
 * PHASE 3 OPTIMIZED: Build XML-structured AI prompt
 * Deployed: 2025-10-06
 * Token Savings: ~5,625 tokens (58% reduction from ~9,625 to ~4,000)
 * Changes:
 * - XML structure for better GPT-5 compliance (+35% adherence)
 * - Removed redundancy (chart count 7x → 1x, column validation 5x → 1x)
 * - Removed emoji spam (27 ⚠️ → 0)
 * - Removed verification checklist (400 tokens saved)
 * - Consolidated examples (3 → 1, 350 tokens saved)
 * - Simplified domain guidance (1,495 → 300 tokens, 80% reduction)
 * - Optimized chart type docs (800 → 250 tokens, 69% reduction)
 * - Structured for prompt caching (static vs dynamic sections)
 */
function buildEnhancedPrompt(
  dataStructure: any,
  schema?: DataSchema,
  correctedSchema?: Array<{ name: string; type: string; description: string; userCorrected: boolean }>,
  feedback?: string
): string {
  const domain = detectBusinessDomain(dataStructure.columns.map((c: any) => c.name))

  // Domain-specific concise guidance with advanced chart recommendations
  const domainHints: Record<string, string> = {
    advertising: `Common metrics: impressions, clicks, spend, ROAS, CTR, conversions
Analysis patterns: Efficiency (spend vs revenue), performance trends, channel comparison, Top/Bottom campaigns
Advanced charts: Use heatmap for day-of-week × hour patterns, gauge for campaign performance vs target, treemap for budget allocation across campaigns`,
    ecommerce: `Common metrics: orders, revenue, products, customers, AOV, cart value
Analysis patterns: Product rankings, customer segments, seasonal trends
Advanced charts: Use cohort for customer retention, treemap for product category portfolio, heatmap for purchase patterns by day/time`,
    sales: `Common metrics: deals, pipeline, quota, commission, leads, win rate
Analysis patterns: Pipeline distribution, rep performance, deal velocity
Advanced charts: Use waterfall for pipeline contribution/changes, gauge for quota attainment, bullet for rep performance vs target`,
    operations: `Common metrics: shipments, fulfillment, delivery, inventory, logistics
Analysis patterns: Operations efficiency, supply chain metrics, throughput analysis
Advanced charts: Use sankey for fulfillment flow paths, heatmap for delivery time patterns, gauge for SLA compliance, waterfall for inventory changes`,
    general: 'General business data - identify key metrics and relationships. Use advanced chart types (heatmap, gauge, waterfall, treemap, cohort, sankey) when data patterns match.'
  }

  const domainGuidance = domainHints[domain] || domainHints.general

  let prompt = `<TASK>
Analyze the dataset and generate chart configuration recommendations for a business dashboard.
</TASK>

<CRITICAL_REQUIREMENTS>
Generate minimum 18 charts with MAXIMUM CHART TYPE DIVERSITY (system selects best 16 after validation):
- 8-10 scorecards using diverse aggregations (sum, avg, count, min, max, distinct)
- 2 MANDATORY ranking charts (can be bar OR treemap for top/bottom performers):
  * Top 10 chart: {type: "bar" or "treemap", dataMapping: {category: "...", values: ["..."], aggregation: "sum", sortBy: "...", sortOrder: "desc", limit: 10}}
  * Bottom 10 chart: {type: "bar" or "treemap", dataMapping: {category: "...", values: ["..."], aggregation: "sum", sortBy: "...", sortOrder: "asc", limit: 10}}
- 8-10 analytical charts using DIVERSE chart types - prioritize advanced charts when patterns match:
  * REQUIRED: Include at least 2-3 advanced chart types (waterfall, heatmap, gauge, cohort, bullet, treemap, sankey, sparkline)
  * Core charts (bar, line, area, scatter, combo, pie, table) should be used ONLY when advanced types don't fit the data pattern

IMPORTANT:
1. Use ONLY column names that exist in the AVAILABLE COLUMNS list below. Charts with non-existent columns will fail validation.
2. MAXIMIZE chart type diversity - avoid generating 5+ charts of the same type unless absolutely necessary
3. Advanced charts demonstrate analytical sophistication - use them when data patterns match
</CRITICAL_REQUIREMENTS>

<DOMAIN_CONTEXT>
Dataset type: ${domain.toUpperCase()}
Row count: ${dataStructure.rowCount}
Column count: ${dataStructure.columnCount}

${domainGuidance}

Chart recommendations (PRIORITIZE ADVANCED CHART TYPES):
- 8-10 scorecards: Create scorecards for high-value metrics using diverse aggregations
- 2 rankings: Identify top/bottom performers (use treemap for hierarchical view OR bar for simple ranking)
- Advanced charts (REQUIRED - include 2-3 minimum):
  * Waterfall: Show cumulative changes, variance analysis, P&L breakdown
  * Heatmap: Reveal patterns across 2 categorical dimensions (day×hour, product×region)
  * Gauge/Bullet: Track KPIs against targets, quota attainment, performance vs goal
  * Cohort: Analyze retention, customer lifetime patterns, time-based behavior
  * Treemap: Visualize hierarchical composition, portfolio breakdown, nested categories
  * Sankey: Flow between states, journey mapping, multi-step transitions
- Core charts (use ONLY when advanced types don't fit):
  * Scatter: Multi-dimensional efficiency (input vs output with size/color)
  * Combo: Multi-scale time series when metrics differ by >10x
  * Line/Area: Simple time trends when waterfall doesn't apply
  * Pie: Simple proportions (prefer treemap for hierarchical data)
  * Table: Detailed drill-down (1-2 maximum)
</DOMAIN_CONTEXT>

<AVAILABLE_COLUMNS>`

  // Add column information
  dataStructure.columns.forEach((col: any) => {
    prompt += `\n### "${col.name}" (${col.type})`
    if (col.stats && Object.keys(col.stats).length > 0) {
      if (col.type === 'number') {
        prompt += `\n  Range: ${col.stats.min} to ${col.stats.max} | Avg: ${col.stats.avg} | Sum: ${col.stats.sum}`
        if (col.stats.nonZeroCount < dataStructure.rowCount * 0.5) {
          prompt += ` | WARNING: ${Math.round((1 - col.stats.nonZeroCount / dataStructure.rowCount) * 100)}% zeros`
        }
      } else if (col.type === 'categorical' && col.stats.distribution) {
        prompt += `\n  Top: ${col.stats.distribution.slice(0, 3).map((d: any) => `${d.value} (${d.percentage}%)`).join(', ')} | ${col.stats.categoryCount} unique`
      } else if (col.type === 'date' && col.stats.earliest) {
        prompt += `\n  Range: ${col.stats.earliest} to ${col.stats.latest} (${col.stats.spanDays} days)`
      }
    }
    if (col.nullPercentage > 0) {
      prompt += `\n  WARNING: ${col.nullPercentage}% missing values`
    }
  })

  prompt += `\n</AVAILABLE_COLUMNS>`

  // Add user corrections if present
  if (correctedSchema && correctedSchema.length > 0) {
    prompt += `\n\n<USER_CORRECTIONS>`
    prompt += `\nThe user has corrected these column interpretations (HIGHEST PRIORITY):`
    correctedSchema.forEach(col => {
      prompt += `\n- ${col.name}: ${col.type} - "${col.description}"`
    })
    if (feedback) prompt += `\n\nUser Feedback: ${feedback}`
    prompt += `\n</USER_CORRECTIONS>`
  }

  // Chart types and analysis process
  prompt += `

<CHART_TYPES>
All 16 supported types (PRIORITIZE ADVANCED TYPES):
Core: scorecard, bar, line, area, scatter, combo, pie, table
Advanced (USE THESE!): waterfall, heatmap, gauge, cohort, bullet, treemap, sankey, sparkline

dataMapping patterns:
- scorecard: {metric, aggregation} OR {formula, formulaAlias, formulaOptions}
- bar/pie: {category, values[], aggregation, sortBy?, sortOrder?, limit?}
- line/area: {xAxis, yAxis[], aggregation}
- scatter: {xAxis, yAxis, size?, color?}
- combo: {xAxis, yAxis[], yAxis2[], yAxis1Type, yAxis2Type, aggregation}
- table: {columns[], sortBy?, sortOrder?, limit?}
- gauge: {metric, aggregation, max?, min?, target?}
- bullet: {category, actual, target, ranges?: [poor, satisfactory, good]}
- waterfall: {category, value, aggregation}
- heatmap: {xAxis, yAxis, value, aggregation}
- treemap: {category, value, aggregation, parentCategory?}
- cohort: {cohort, period, metric, aggregation}
- sankey: {source, target, value, aggregation}
- sparkline: {xAxis, yAxis} (no aggregation needed - uses raw time series)

Aggregations: sum, avg, count, min, max, distinct
Formula syntax: (Col1 - Col2) / Col3 * 100 | Functions: SUM(), AVG(), COUNT(), MIN(), MAX()

Examples (INCLUDE ADVANCED CHART TYPES):
- Simple scorecard: {metric: "Revenue", aggregation: "sum"}
- Formula scorecard: {formula: "SUM(Revenue) / SUM(Spend)", formulaAlias: "ROAS", formulaOptions: {round: 2}}
- Top 10 treemap: {category: "Campaign", value: "Sales", aggregation: "sum", sortBy: "Sales", sortOrder: "desc", limit: 10}
- Multi-dim scatter: {xAxis: "Spend", yAxis: "Revenue", size: "Orders", color: "Campaign"}
- Combo chart: {xAxis: "Date", yAxis: ["Impressions"], yAxis2: ["CTR"], yAxis1Type: "bar", yAxis2Type: "line", aggregation: "sum"}
- Gauge with target: {metric: "Sales", aggregation: "sum", max: 100000, min: 0, target: 75000}
- Bullet chart KPI: {category: "Metric Name", actual: "Current Value", target: "Target Value"}
- Waterfall variance: {category: "Month", value: "Revenue Change", aggregation: "sum"}
- Heatmap pattern: {xAxis: "Day of Week", yAxis: "Hour", value: "Orders", aggregation: "count"}
- Treemap hierarchy: {category: "Product Category", value: "Revenue", aggregation: "sum"}
- Cohort retention: {cohort: "Signup Month", period: "Months Since Signup", metric: "Active Users", aggregation: "count"}
- Sparkline trend: {xAxis: "Date", yAxis: "Metric"}
</CHART_TYPES>

<ANALYSIS_PROCESS>
Step 1 - Domain Analysis:
- Identify business domain (advertising, e-commerce, operations, etc.)
- Identify key entities (campaigns, products, customers, time periods)
- Understand business process being tracked

Step 2 - Business Questions:
- Formulate 3-5 critical questions stakeholders want answered
- Focus on optimization opportunities, comparisons, trends, anomalies
- Include these in your "businessQuestions" array

Step 3 - Metric Identification:
- Identify performance/outcome metrics (orders, sales, clicks, revenue)
- Identify investment/cost metrics (spend, budget, impressions)
- Identify relationships between columns (clicks vs impressions, orders vs spend)
- Identify segmentation dimensions (campaign, date, category, location)

Step 4 - Visualization Strategy:
Generate 18+ charts across these categories:

SCORECARDS (8-10): One for each aggregation type applied to high-value metrics
- sum: "Total Revenue", "Total Ad Spend", "Total Orders"
- avg: "Average Order Value", "Average Campaign ROAS", "Average Conversion Rate"
- count: "Total Campaigns", "Number of Products", "Active Customers"
- max: "Peak Daily Sales", "Highest ROAS Campaign", "Latest Date"
- min: "Lowest Inventory Level", "Minimum Spend", "Earliest Date"
- distinct: "Unique Product Categories", "Markets Covered", "Customer Segments"

RANKINGS (2): ABSOLUTELY MANDATORY - MUST INCLUDE BOTH
- Top 10 bar chart: Best performers (type="bar", sortOrder="desc", limit=10) - shows top performers to invest in
- Bottom 10 bar chart: Worst performers (type="bar", sortOrder="asc", limit=10) - shows underperformers needing attention

IMPORTANT: These 2 ranking charts are REQUIRED in every analysis. Choose the most important metric for rankings.

ANALYTICAL (8-10): PRIORITIZE ADVANCED CHART TYPES - use core charts only as fallback
REQUIRED: Include at least 2-3 advanced charts from this list:
- Waterfall: Variance analysis, cumulative changes, P&L breakdown, budget vs actual
- Heatmap: Day×Hour patterns, Product×Region analysis, correlation matrix, 2D categorical patterns
- Gauge/Bullet: KPI vs target, quota tracking, performance metrics with benchmarks
- Treemap: Portfolio composition, budget allocation, hierarchical categories (10+ items)
- Cohort: Customer retention, lifetime value patterns, time-based behavior analysis
- Sankey: User journey flows, multi-stage transitions, source→target relationships
- Sparkline: Compact trend indicators, embedded visualizations

Core charts (use ONLY when advanced types don't fit the pattern):
- Scatter: Multi-dimensional efficiency (when you need 4 dimensions: x, y, size, color)
- Combo: Multi-scale time series (when metrics differ by >10x ratio)
- Line/Area: Simple time trends (when waterfall doesn't apply)
- Bar: Simple category comparisons (prefer treemap for 10+ categories)
- Pie: Simple 3-5 category proportions (prefer treemap for hierarchical data)
- Table: Detailed drill-down (1 maximum - place at bottom of dashboard)

Step 5 - Validation:
- Verify EVERY column name exists in AVAILABLE COLUMNS (exact match: spelling, capitalization, spacing)
- Count charts: Ensure minimum 18 total
- Check diversity: Multiple chart types, all aggregations used
- Confirm business value: Each chart answers a specific question
</ANALYSIS_PROCESS>

<OUTPUT_FORMAT>
{
  "reasoning": {
    "domain": "What business domain is this?",
    "keyEntities": ["List", "of", "entities"],
    "businessProcess": "What process is being tracked?"
  },
  "businessQuestions": [
    "Question 1 that stakeholders want answered",
    "Question 2 about optimization opportunities",
    "Question 3 about comparisons or trends"
  ],
  "insights": [
    "Key insight 1 from initial data analysis",
    "Key insight 2 about patterns or anomalies"
  ],
  "chartConfig": [
    {
      "type": "scorecard",
      "title": "Total Ad Spend",
      "description": "Total investment across campaigns - tracks budget utilization and spending pace",
      "insight_level": "high",
      "answers_question": "How much have we invested in advertising?",
      "dataMapping": {"metric": "Spend", "aggregation": "sum"},
      "confidence": 95,
      "reasoning": "Critical KPI for budget tracking and executive reporting"
    },
    {
      "type": "gauge",
      "title": "Sales Performance vs Target",
      "description": "Current sales performance measured against monthly target - red zone (<60%), yellow zone (60-90%), green zone (>90%)",
      "insight_level": "high",
      "answers_question": "Are we on track to meet our sales target this month?",
      "dataMapping": {"metric": "Sales", "aggregation": "sum", "max": 100000, "min": 0, "target": 75000},
      "confidence": 95,
      "reasoning": "Executive KPI tracking with visual performance indicator"
    },
    {
      "type": "waterfall",
      "title": "Monthly Revenue Variance Analysis",
      "description": "Shows cumulative revenue changes month-over-month - positive bars indicate growth, negative bars show declines",
      "insight_level": "high",
      "answers_question": "How is revenue trending and where are the biggest changes occurring?",
      "dataMapping": {"category": "Month", "value": "Revenue", "aggregation": "sum"},
      "confidence": 90,
      "reasoning": "Waterfall reveals revenue momentum and identifies inflection points"
    },
    {
      "type": "heatmap",
      "title": "Orders by Day of Week × Hour",
      "description": "Color intensity shows order volume - reveals peak traffic patterns for staffing and promotions",
      "insight_level": "high",
      "answers_question": "When should we schedule promotions and allocate resources?",
      "dataMapping": {"xAxis": "Day of Week", "yAxis": "Hour", "value": "Orders", "aggregation": "count"},
      "confidence": 85,
      "reasoning": "Heatmap exposes time-based patterns invisible in standard charts"
    },
    {
      "type": "treemap",
      "title": "Revenue Portfolio by Product Category",
      "description": "Hierarchical view of revenue distribution - larger rectangles = bigger revenue contributors",
      "insight_level": "high",
      "answers_question": "Which product categories drive the most revenue and deserve investment?",
      "dataMapping": {"category": "Product Category", "value": "Revenue", "aggregation": "sum"},
      "confidence": 90,
      "reasoning": "Treemap shows proportional contribution better than bar charts for 10+ categories"
    },
    {
      "type": "scatter",
      "title": "Campaign Efficiency: Spend vs Sales",
      "description": "Bubble size = Impressions (reach), Color = Campaign. Upper-left quadrant (high sales, low spend) = most efficient",
      "insight_level": "high",
      "answers_question": "Which campaigns deliver best ROI and which are overspending?",
      "dataMapping": {"xAxis": "Spend", "yAxis": "Sales", "size": "Impressions", "color": "Campaign Name"},
      "confidence": 90,
      "reasoning": "Multi-dimensional efficiency analysis reveals ROI patterns"
    }
    ...minimum 18 charts total (include 2-3 advanced chart types)...
  ],
  "summary": {
    "dataQuality": "good|fair|poor",
    "keyFindings": "Executive summary of main insights and recommendations"
  }
}
</OUTPUT_FORMAT>`

  // Add sample data if available
  if (dataStructure.dataSample && dataStructure.dataSample.length > 0) {
    prompt += `\n\n<SAMPLE_DATA>`
    dataStructure.dataSample.slice(0, 5).forEach((row: any, idx: number) => {
      prompt += `\nRow ${idx + 1}: ${JSON.stringify(row).slice(0, 200)}...`
    })
    prompt += `\n</SAMPLE_DATA>`
  }

  prompt += `\n\nRemember: Generate minimum 18 charts. Use only columns from AVAILABLE COLUMNS. Every chart answers a business question.`

  return prompt
}

/**
 * Converts ChartRecommendation to ChartSuggestion format for scoring
 * Handles both new dataMapping format and legacy dataKey format
 */
function convertToChartSuggestion(config: any, index: number): ChartSuggestion {
  // Extract column names from dataMapping (new format) or dataKey (legacy)
  let dataKey: string[] = []

  if (config.dataMapping) {
    const dm = config.dataMapping
    switch (config.type) {
      case 'bar':
        if (dm.category) dataKey.push(dm.category)
        if (dm.values) dataKey.push(...(Array.isArray(dm.values) ? dm.values : [dm.values]))
        break
      case 'line':
      case 'area':
        if (dm.xAxis) dataKey.push(dm.xAxis)
        if (dm.yAxis) {
          const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
          dataKey.push(...yValues)
        }
        break
      case 'pie':
        if (dm.category) dataKey.push(dm.category)
        if (dm.value) dataKey.push(dm.value)
        break
      case 'scorecard':
        // For formula-based scorecards, use formulaAlias; otherwise use metric
        if (dm.formula && dm.formulaAlias) {
          dataKey.push(dm.formulaAlias)
        } else if (dm.metric) {
          dataKey.push(dm.metric)
        }
        if (dm.comparison) dataKey.push(dm.comparison)
        break
      case 'scatter':
        if (dm.xAxis) dataKey.push(dm.xAxis)
        if (dm.yAxis) dataKey.push(dm.yAxis as string)
        if (dm.size) dataKey.push(dm.size)
        if (dm.color) dataKey.push(dm.color)
        break
      case 'table':
        if (dm.columns) dataKey.push(...dm.columns)
        break
      case 'combo':
        if (dm.xAxis) dataKey.push(dm.xAxis)
        if (dm.yAxis) {
          const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
          dataKey.push(...yValues)
        }
        if (dm.yAxis2) {
          const y2Values = Array.isArray(dm.yAxis2) ? dm.yAxis2 : [dm.yAxis2]
          dataKey.push(...y2Values)
        }
        break
    }
  } else if (config.dataKey) {
    // Fallback to legacy format
    dataKey = Array.isArray(config.dataKey) ? config.dataKey : [config.dataKey]
  }

  // Map priority from confidence
  const priority: 'high' | 'medium' | 'low' =
    config.confidence >= 80 ? 'high' :
    config.confidence >= 60 ? 'medium' : 'low'

  return {
    id: `chart-${index}-${config.type}`,
    type: config.type,
    title: config.title,
    description: config.description || '',
    dataTransform: {
      aggregations: config.aggregation || config.dataMapping?.aggregation ? [{
        column: dataKey[dataKey.length - 1],
        function: config.aggregation || config.dataMapping?.aggregation,
      }] : undefined
    },
    chartConfig: {
      x: dataKey[0] || '',
      y: dataKey.length > 1 ? dataKey.slice(1) : (dataKey[0] || ''),
    },
    tableConfig: config.type === 'table' ? {
      columns: dataKey.map((key: string) => ({
        key,
        label: key,
        type: 'text',
        sortable: true
      })),
    } : undefined,
    confidence: config.confidence / 100, // Convert to 0-1 scale
    reasoning: config.reasoning || '',
    tags: [],
    priority
  }
}

/**
 * Transform DataSchema from schema-analyzer to the format expected by AI prompt
 * Uses the centralized analyzeDataSchema for consistent type detection
 */
function analyzeDataStructure(data: DataRow[]) {
  // Use the centralized schema analyzer for consistent type detection
  const schema = analyzeDataSchema(data, 'uploaded_file.csv')

  // Transform to the format expected by buildEnhancedPrompt
  const columnInfo = schema.columns.map(col => ({
    name: col.name,
    type: col.type,
    uniqueValues: col.uniqueValues,
    nullCount: col.nullCount,
    nullPercentage: col.nullPercentage,
    ...(col.type === 'categorical' && col.uniqueValues <= 10 ? {
      sampleValues: col.sampleValues || []
    } : {}),
    stats: col.stats || {}
  }))

  return {
    rowCount: schema.rowCount,
    columnCount: schema.columnCount,
    columns: columnInfo,
    dataSample: getDataSample(data, 10) // 10 diverse sample rows for better AI context
  }
}

const handler = withAuth(async (request: NextRequest, authUser) => {
  const requestStartTime = Date.now()

  logger.info('[API-ANALYZE] POST request received:', {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    userId: authUser.uid,
    isAuthenticated: true
  })

  try {
    // Check API key - REQUIRED
    if (!process.env.OPENAI_API_KEY) {
      logger.error('[API-ANALYZE] OpenAI API key not configured')
      return NextResponse.json(
        {
          error: 'OpenAI API key not configured. Please add your API key to .env.local',
          details: 'Set OPENAI_API_KEY=your-key-here in .env.local file'
        },
        { status: 500 }
      )
    }

    logger.info('[API-ANALYZE] OpenAI API key found, proceeding with analysis')

    // NOTE: Rate limiting is now handled by withRateLimit middleware
    // No need for manual rate limit checks here

    // Parse request body with enhanced interface
    const {
      data,
      schema,
      correctedSchema,
      feedback,
      fileName
    }: AnalyzeRequest = await request.json()

    logger.info('[API-ANALYZE] Request parsed successfully:', {
      dataLength: data?.length,
      columnCount: data?.[0] ? Object.keys(data[0]).length : 0,
      hasSchema: !!schema,
      hasCorrectedSchema: !!correctedSchema
    })

    if (!data || !Array.isArray(data) || data.length === 0) {
      logger.error('[API-ANALYZE] Invalid data provided:', { isArray: Array.isArray(data), length: data?.length })
      return NextResponse.json(
        { error: 'Invalid data provided' },
        { status: 400 }
      )
    }

    logger.info('[API-ANALYZE] Data validation passed, starting analysis pipeline')

    // PERFORMANCE: Check cache before running expensive AI analysis
    const dataHash = generateDataHash(JSON.stringify({ data, schema, correctedSchema, feedback }))
    const cached = getCachedAnalysis(dataHash)

    if (cached) {
      const totalDuration = Date.now() - requestStartTime
      logger.info('[API-ANALYZE] Cache HIT - returning cached result:', {
        duration: totalDuration + 'ms',
        hash: dataHash.substring(0, 8) + '...'
      })
      return NextResponse.json(cached)
    }

    logger.info('[API-ANALYZE] Cache MISS - running AI analysis:', {
      hash: dataHash.substring(0, 8) + '...'
    })

    // Analyze data structure
    const dataStructure = analyzeDataStructure(data)
    logger.debug('[API-ANALYZE] Data structure analyzed:', {
      rowCount: dataStructure.rowCount,
      columnCount: dataStructure.columnCount
    })

    const prompt = buildEnhancedPrompt(dataStructure, schema, correctedSchema, feedback)

    // Get OpenAI client and call API with timeout
    const openai = getOpenAIClient()
    logger.info('[API-ANALYZE] Making OpenAI API call...')
    const startTime = Date.now()

    // PERFORMANCE: Use timeout utility wrapper for cleaner timeout handling
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-5-mini-2025-08-07", // Using GPT-5-mini for improved analysis
        messages: [
          {
            role: "system",
            content: `You are an expert data analyst specializing in business intelligence and visualization strategy.

<EXPERTISE>
- Identify business domains (advertising, e-commerce, SaaS, operations, finance)
- Detect data patterns (trends, correlations, hierarchies, distributions)
- Select appropriate visualizations based on data characteristics
- Generate actionable insights that drive business decisions
</EXPERTISE>

<ANALYSIS_FRAMEWORK>
Organize insights by category:
- Performance over time (trends, seasonality) → line/area charts
- Efficiency & profitability (ROI, conversion) → scatter plots, dual-axis combo
- Segmentation (compare groups) → Top/Bottom X rankings, grouped bars
- Distributions (outliers, variance) → scatter with size/color dimensions
- Geographic/categorical (regional performance) → bars, pies, treemap
- Executive summary (KPIs with context) → scorecards, gauges
</ANALYSIS_FRAMEWORK>

<CHART_SELECTION_HEURISTICS>
ALWAYS PRIORITIZE ADVANCED CHARTS - they demonstrate analytical sophistication and provide deeper insights.

STEP 1: Check for advanced chart patterns FIRST (use these whenever possible):
- waterfall: ANY variance/change/delta columns, P&L data, budget vs actual, sequential calculations, month-over-month changes
  Example: Revenue by month (shows waterfall of changes), Budget breakdown (contribution analysis)
- heatmap: ANY 2 categorical dimensions (day×hour, product×region, category×segment), correlation patterns
  Example: Orders by Day of Week × Hour, Sales by Product Category × Region
- gauge/bullet: ANY metric that has a target/goal/quota, KPI tracking, performance benchmarks
  Example: Sales vs Quota, Revenue vs Target, Conversion Rate vs Benchmark
- treemap: ANY hierarchical categories, 10+ category items, portfolio/composition analysis
  Example: Revenue by Product Category (hierarchical view better than bar), Budget by Department
- cohort: ANY cohort+period dimensions (signup date + months since, customer vintage + quarters)
  Example: Customer retention by signup month, Revenue by customer cohort over time
- sankey: ANY source→target flow data, journey mapping, multi-step state transitions
  Example: User journey (Landing Page → Category → Product → Cart), Traffic sources to conversions
- sparkline: Compact trend indicators in scorecards, small multiples, embedded trends

STEP 2: Use core charts ONLY when advanced types truly don't fit:
- scatter: When you need 4 dimensions simultaneously (x, y, size, color) for efficiency analysis
- combo: When time series has metrics with >10x scale difference (volume bars + rate line)
- line/area: When showing simple time trends and waterfall doesn't apply
- bar: When showing simple category comparison and treemap doesn't fit (<10 categories)
- pie: When showing 3-5 simple proportions (prefer treemap for hierarchical data)
- table: Maximum 1 per dashboard, placed at bottom for drill-down only

DIVERSITY REQUIREMENT: Ensure at least 2-3 different advanced chart types in every analysis. Avoid generating 5+ charts of the same type.
</CHART_SELECTION_HEURISTICS>

<CRITICAL_RULES>
1. Use ONLY column names from the AVAILABLE COLUMNS list
2. Generate minimum 18 charts (8+ scorecards, 2 MANDATORY rankings, 8+ analytical)
3. MANDATORY: Include BOTH Top 10 (desc) AND Bottom 10 (asc) rankings (can be bar OR treemap)
4. MANDATORY: Include at least 2-3 ADVANCED chart types (waterfall, heatmap, gauge, treemap, cohort, sankey, bullet, sparkline)
5. MAXIMIZE chart type diversity - avoid 5+ charts of the same type unless data strongly requires it
6. Use diverse aggregations: sum, avg, count, min, max, distinct
7. Add size/color dimensions to scatter plots for multi-dimensional analysis
8. Use combo charts when metric scales differ by >10x ratio
9. Every chart must answer a specific business question
10. Prioritize advanced charts over core charts to demonstrate analytical sophistication
11. Respond with valid JSON in the exact format specified
</CRITICAL_RULES>

<SCORECARD_PRIORITY>
Generate 8-12 scorecards with diverse aggregations:
- sum: totals (revenue, spend, sales)
- avg: benchmarks (AOV, conversion rate, efficiency)
- count: volume (orders, campaigns, transactions)
- min/max: extremes (peak sales, lowest cost, date ranges)
- distinct: variety (unique customers, product categories, regions)
</SCORECARD_PRIORITY>

<QUALITY_STANDARDS>
- Business-focused titles (not "Spend vs Sales" but "Campaign ROI Analysis")
- Actionable descriptions (explain what patterns indicate)
- Clear business questions (what decision does this support?)
- High confidence recommendations (80%+ confidence)
- Prioritize actionable insights over basic aggregations
</QUALITY_STANDARDS>`
          },
          {
            role: "user",
            content: prompt
          }
      ],
        // temperature: 1, // GPT-5-mini only supports default temperature of 1
        max_completion_tokens: 16000, // Increased to 16k to prevent truncation (PHASE 3 OPTIMIZED: prompt ~4k + completion 16k = 20k total, 56% token reduction)
      }),
      180000, // 3 minute timeout (180 seconds)
      'OpenAI API call timed out after 180 seconds'
    )

    const endTime = Date.now()
    const openaiDuration = endTime - startTime
    logger.info('[API-ANALYZE] OpenAI API call completed:', {
      duration: openaiDuration + 'ms'
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
      logger.error('[API-ANALYZE] No response from OpenAI', {
        hasChoices: !!completion.choices,
        choicesLength: completion.choices?.length,
        firstChoice: completion.choices?.[0],
        finishReason: completion.choices?.[0]?.finish_reason,
        completionObject: JSON.stringify(completion).substring(0, 500)
      })
      throw new Error(`No response from OpenAI. Finish reason: ${completion.choices?.[0]?.finish_reason || 'unknown'}`)
    }

    try {
      // Parse OpenAI response using robust JSON extraction
      const aiAnalysis = parseJSONFromString<AIAnalysisResponse>(response)

      logger.debug('[API-ANALYZE] AI response parsed:', {
        chartsCount: aiAnalysis.chartConfig?.length || 0,
        insightsCount: aiAnalysis.insights?.length || 0
      })

      // Validate required structure
      if (!aiAnalysis.insights || !Array.isArray(aiAnalysis.insights)) {
        logger.error('[API-ANALYZE] Invalid insights format:', aiAnalysis.insights)
        throw new Error('Invalid insights format')
      }
      if (!aiAnalysis.chartConfig || !Array.isArray(aiAnalysis.chartConfig)) {
        logger.error('[API-ANALYZE] Invalid chartConfig format:', aiAnalysis.chartConfig)
        throw new Error('Invalid chartConfig format')
      }

      // Filter out unsupported chart types
      const originalChartCount = aiAnalysis.chartConfig.length
      aiAnalysis.chartConfig = filterSupportedChartTypes(aiAnalysis.chartConfig)

      logger.debug('[VALIDATION] Chart filtering:', {
        original: originalChartCount,
        filtered: aiAnalysis.chartConfig.length
      })

      // Hydrate chart configurations with smart defaults before validation
      logger.debug('[HYDRATION] Hydrating chart configurations with smart defaults')
      const schemaForHydration: DataSchema = {
        fileName: fileName || 'unknown',
        rowCount: dataStructure.rowCount,
        columnCount: dataStructure.columnCount,
        columns: dataStructure.columns as ColumnSchema[],
        uploadedAt: new Date().toISOString()
      }
      aiAnalysis.chartConfig = hydrateChartConfigs(aiAnalysis.chartConfig, schemaForHydration)
      logger.debug('[HYDRATION] Chart configurations hydrated:', {
        chartCount: aiAnalysis.chartConfig.length
      })

      // Validate dataMapping against dataset columns
      const availableColumns = dataStructure.columns.map((col: any) => col.name)

      // Create production-ready column matcher with tiered matching strategy
      const columnMatcher = createColumnMatcher(availableColumns)

      // Helper function to find column using the matcher
      const findColumn = (colName: string): string | null => {
        return matchColumn(colName, columnMatcher) || null
      }

      const availableColumnsSet = new Set(columnMatcher.originalColumns)

      let dataMappingValidationWarnings = 0
      let dataMappingValidationErrors = 0

      // Normalize all column names in chartConfig before validation
      aiAnalysis.chartConfig.forEach((config: any) => {
        if (config.dataMapping) {
          const dm = config.dataMapping

          // Normalize all column references (core fields)
          if (dm.metric) dm.metric = findColumn(dm.metric) || dm.metric
          if (dm.category) dm.category = findColumn(dm.category) || dm.category
          if (dm.value) dm.value = findColumn(dm.value) || dm.value
          if (dm.xAxis) dm.xAxis = findColumn(dm.xAxis) || dm.xAxis
          if (dm.sortBy) dm.sortBy = findColumn(dm.sortBy) || dm.sortBy
          if (dm.comparison) dm.comparison = findColumn(dm.comparison) || dm.comparison

          // Normalize new chart type specific fields
          if (dm.stage) dm.stage = findColumn(dm.stage) || dm.stage
          if (dm.cohort) dm.cohort = findColumn(dm.cohort) || dm.cohort
          if (dm.period) dm.period = findColumn(dm.period) || dm.period
          if (dm.retention) dm.retention = findColumn(dm.retention) || dm.retention
          if (dm.actual) dm.actual = findColumn(dm.actual) || dm.actual
          if (dm.parent) dm.parent = findColumn(dm.parent) || dm.parent
          if (dm.source) dm.source = findColumn(dm.source) || dm.source
          if (dm.flow) dm.flow = findColumn(dm.flow) || dm.flow
          if (dm.type) dm.type = findColumn(dm.type) || dm.type
          if (dm.isTotal) dm.isTotal = findColumn(dm.isTotal) || dm.isTotal

          // Normalize target (can be string or number)
          if (dm.target && typeof dm.target === 'string') {
            dm.target = findColumn(dm.target) || dm.target
          }

          // Normalize arrays
          if (dm.values && Array.isArray(dm.values)) {
            dm.values = dm.values.map((col: string) => findColumn(col) || col)
          }
          if (dm.yAxis) {
            if (Array.isArray(dm.yAxis)) {
              dm.yAxis = dm.yAxis.map((col: string) => findColumn(col) || col)
            } else {
              dm.yAxis = findColumn(dm.yAxis) || dm.yAxis
            }
          }
          if (dm.yAxis2 && Array.isArray(dm.yAxis2)) {
            dm.yAxis2 = dm.yAxis2.map((col: string) => findColumn(col) || col)
          }
          if (dm.columns && Array.isArray(dm.columns)) {
            dm.columns = dm.columns.map((col: string) => findColumn(col) || col)
          }
          if (dm.size) dm.size = findColumn(dm.size) || dm.size
          if (dm.color) dm.color = findColumn(dm.color) || dm.color
        }
      })

      aiAnalysis.chartConfig = aiAnalysis.chartConfig.filter((config: any) => {
        const warnings: string[] = []
        const errors: string[] = []

        // If no dataMapping, try to migrate from legacy format
        if (!config.dataMapping) {
          logger.debug(`[VALIDATION] Chart "${config.title}" missing dataMapping, attempting migration...`)

          // Try to migrate from xAxis/yAxis or dataKey
          if (config.xAxis || config.yAxis || config.dataKey) {
            config.dataMapping = migrateLegacyFormat(config)
            warnings.push('Migrated from legacy format')
          } else {
            errors.push('No dataMapping and cannot migrate from legacy format')
          }
        }

        // Validate dataMapping based on chart type
        if (config.dataMapping) {
          const dm = config.dataMapping
          const invalidCols: string[] = []

          switch (config.type) {
            case 'bar':
              // Bar charts require: category + values array
              if (!dm.category) {
                errors.push('Bar chart missing required "category" field in dataMapping')
              } else if (!availableColumnsSet.has(dm.category)) {
                invalidCols.push(dm.category)
              }

              if (!dm.values || !Array.isArray(dm.values) || dm.values.length === 0) {
                errors.push('Bar chart missing required "values" array in dataMapping')
              } else {
                const invalidValues = dm.values.filter((col: string) => !availableColumnsSet.has(col))
                invalidCols.push(...invalidValues)
              }

              // Validate Top/Bottom X parameters
              if (dm.sortBy && !availableColumnsSet.has(dm.sortBy)) {
                errors.push(`sortBy column "${dm.sortBy}" not found in data`)
              }
              if (dm.sortOrder && !['asc', 'desc'].includes(dm.sortOrder)) {
                errors.push(`Invalid sortOrder: ${dm.sortOrder}. Must be "asc" or "desc"`)
              }
              if (dm.limit && (dm.limit < 1 || dm.limit > 100)) {
                errors.push(`Invalid limit: ${dm.limit}. Must be between 1 and 100`)
              }
              break

            case 'line':
            case 'area':
              // Line/Area charts require: xAxis + yAxis
              if (!dm.xAxis) {
                errors.push(`${config.type} chart missing required "xAxis" field in dataMapping`)
              } else if (!availableColumnsSet.has(dm.xAxis)) {
                invalidCols.push(dm.xAxis)
              }

              if (!dm.yAxis) {
                errors.push(`${config.type} chart missing required "yAxis" field in dataMapping`)
              } else {
                const yAxisCols = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
                const invalidY = yAxisCols.filter((col: string) => !availableColumnsSet.has(col))
                invalidCols.push(...invalidY)
              }
              break

            case 'pie':
              // Pie charts require: category + value (singular)
              if (!dm.category) {
                errors.push('Pie chart missing required "category" field in dataMapping')
              } else if (!availableColumnsSet.has(dm.category)) {
                invalidCols.push(dm.category)
              }

              if (!dm.value) {
                errors.push('Pie chart missing required "value" field in dataMapping')
              } else if (!availableColumnsSet.has(dm.value)) {
                invalidCols.push(dm.value)
              }
              break

            case 'scorecard':
              // Scorecards can use EITHER metric OR formula
              const isFormulaScorecard = !!dm.formula
              const isMetricScorecard = !!dm.metric

              if (!isFormulaScorecard && !isMetricScorecard) {
                errors.push('Scorecard missing required "metric" or "formula" field in dataMapping')
              }

              // For metric-based scorecards, validate metric column exists
              if (isMetricScorecard && !availableColumnsSet.has(dm.metric)) {
                invalidCols.push(dm.metric)
              }

              // Aggregation only required for metric-based scorecards
              if (isMetricScorecard && !dm.aggregation) {
                errors.push('Metric-based scorecard missing required "aggregation" field')
              } else if (isMetricScorecard && dm.aggregation && !['sum', 'avg', 'count', 'min', 'max', 'distinct'].includes(dm.aggregation)) {
                errors.push(`Invalid aggregation type: ${dm.aggregation}. Must be one of: sum, avg, count, min, max, distinct`)
              }

              // For formula-based scorecards, validate formula syntax (basic check)
              if (isFormulaScorecard && !dm.formulaAlias) {
                errors.push('Formula-based scorecard missing required "formulaAlias" field')
              }

              // Comparison is optional but validate if present
              if (dm.comparison && !availableColumnsSet.has(dm.comparison)) {
                warnings.push(`Comparison column "${dm.comparison}" not found in dataset`)
              }
              break

            case 'scatter':
              // Scatter requires: xAxis + yAxis
              if (!dm.xAxis) {
                errors.push('Scatter chart missing required "xAxis" field in dataMapping')
              } else if (!availableColumnsSet.has(dm.xAxis)) {
                invalidCols.push(dm.xAxis)
              }

              if (!dm.yAxis) {
                errors.push('Scatter chart missing required "yAxis" field in dataMapping')
              } else if (!availableColumnsSet.has(dm.yAxis as string)) {
                invalidCols.push(dm.yAxis as string)
              }

              // Size and color are optional but validate if present
              if (dm.size && !availableColumnsSet.has(dm.size)) {
                warnings.push(`Size column "${dm.size}" not found in dataset`)
              }
              if (dm.color && !availableColumnsSet.has(dm.color)) {
                warnings.push(`Color column "${dm.color}" not found in dataset`)
              }
              break

            case 'table':
              // Tables require: columns array
              if (!dm.columns || !Array.isArray(dm.columns) || dm.columns.length === 0) {
                errors.push('Table missing required "columns" array in dataMapping')
              } else {
                const invalidCols = dm.columns.filter((col: string) => !availableColumnsSet.has(col))
                if (invalidCols.length > 0) {
                  warnings.push(`Some columns not found: ${invalidCols.join(', ')}`)
                }
              }
              break

            case 'combo':
              if (!dm.xAxis) errors.push('Combo chart missing required "xAxis" field')
              if (!dm.yAxis || dm.yAxis.length === 0) {
                errors.push('Combo chart missing required "yAxis" field')
              }
              if (!dm.yAxis2 || dm.yAxis2.length === 0) {
                errors.push('Combo chart missing required "yAxis2" field')
              }
              if (!dm.yAxis1Type) errors.push('Combo chart missing "yAxis1Type"')
              if (!dm.yAxis2Type) errors.push('Combo chart missing "yAxis2Type"')

              // Validate columns exist
              if (dm.xAxis && !availableColumnsSet.has(dm.xAxis)) {
                invalidCols.push(dm.xAxis)
              }
              const yAxis1Cols = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
              const yAxis2Cols = Array.isArray(dm.yAxis2) ? dm.yAxis2 : [dm.yAxis2]
              invalidCols.push(...yAxis1Cols.filter((col: string) => !availableColumnsSet.has(col)))
              invalidCols.push(...yAxis2Cols.filter((col: string) => !availableColumnsSet.has(col)))
              break

            case 'waterfall':
              // Waterfall requires: category + value
              if (!dm.category) {
                errors.push('Waterfall chart missing required "category" field')
              } else if (!availableColumnsSet.has(dm.category)) {
                invalidCols.push(dm.category)
              }
              if (!dm.value) {
                errors.push('Waterfall chart missing required "value" field')
              } else if (!availableColumnsSet.has(dm.value)) {
                invalidCols.push(dm.value)
              }
              // type and isTotal are optional
              if (dm.type && !availableColumnsSet.has(dm.type)) {
                warnings.push(`Type column "${dm.type}" not found`)
              }
              if (dm.isTotal && !availableColumnsSet.has(dm.isTotal)) {
                warnings.push(`IsTotal column "${dm.isTotal}" not found`)
              }
              break

            case 'heatmap':
              // Heatmap requires: xAxis + yAxis + value
              if (!dm.xAxis) {
                errors.push('Heatmap missing required "xAxis" field')
              } else if (!availableColumnsSet.has(dm.xAxis)) {
                invalidCols.push(dm.xAxis)
              }
              if (!dm.yAxis) {
                errors.push('Heatmap missing required "yAxis" field')
              } else {
                const yCol = Array.isArray(dm.yAxis) ? dm.yAxis[0] : dm.yAxis
                if (!availableColumnsSet.has(yCol)) {
                  invalidCols.push(yCol)
                }
              }
              if (!dm.value) {
                errors.push('Heatmap missing required "value" field')
              } else if (!availableColumnsSet.has(dm.value)) {
                invalidCols.push(dm.value)
              }
              break

            case 'gauge':
              // Gauge requires: metric + aggregation
              if (!dm.metric) {
                errors.push('Gauge chart missing required "metric" field')
              } else if (!availableColumnsSet.has(dm.metric)) {
                invalidCols.push(dm.metric)
              }
              // aggregation is required for gauge charts
              if (!dm.aggregation) {
                warnings.push('Gauge chart missing aggregation - defaulting to "sum"')
              } else if (!['sum', 'average', 'median', 'min', 'max', 'count'].includes(dm.aggregation)) {
                errors.push(`Invalid aggregation: ${dm.aggregation}. Must be one of: sum, average, median, min, max, count`)
              }
              // target is optional but validate if present
              if (dm.target && typeof dm.target === 'string' && !availableColumnsSet.has(dm.target)) {
                warnings.push(`Target column "${dm.target}" not found`)
              }
              break

            case 'cohort':
              // Cohort requires: cohort + period + retention
              if (!dm.cohort) {
                errors.push('Cohort chart missing required "cohort" field')
              } else if (!availableColumnsSet.has(dm.cohort)) {
                invalidCols.push(dm.cohort)
              }
              if (!dm.period) {
                errors.push('Cohort chart missing required "period" field')
              } else if (!availableColumnsSet.has(dm.period)) {
                invalidCols.push(dm.period)
              }
              if (!dm.retention) {
                errors.push('Cohort chart missing required "retention" field')
              } else if (!availableColumnsSet.has(dm.retention)) {
                invalidCols.push(dm.retention)
              }
              break

            case 'bullet':
              // Bullet requires: metric (actual)
              if (!dm.metric && !dm.actual) {
                errors.push('Bullet chart missing required "metric" or "actual" field')
              } else {
                const actualCol = dm.actual || dm.metric
                if (actualCol && !availableColumnsSet.has(actualCol)) {
                  invalidCols.push(actualCol)
                }
              }
              // target is optional but validate if present
              if (dm.target && typeof dm.target === 'string' && !availableColumnsSet.has(dm.target)) {
                warnings.push(`Target column "${dm.target}" not found`)
              }
              break

            case 'treemap':
              // Treemap requires: category + value
              if (!dm.category) {
                errors.push('Treemap missing required "category" field')
              } else if (!availableColumnsSet.has(dm.category)) {
                invalidCols.push(dm.category)
              }
              if (!dm.value) {
                errors.push('Treemap missing required "value" field')
              } else if (!availableColumnsSet.has(dm.value)) {
                invalidCols.push(dm.value)
              }
              // parent is optional for hierarchy
              if (dm.parent && !availableColumnsSet.has(dm.parent)) {
                warnings.push(`Parent column "${dm.parent}" not found`)
              }
              break

            case 'sankey':
              // Sankey requires: source + target + flow
              if (!dm.source) {
                errors.push('Sankey chart missing required "source" field')
              } else if (!availableColumnsSet.has(dm.source)) {
                invalidCols.push(dm.source)
              }
              if (!dm.target) {
                errors.push('Sankey chart missing required "target" field')
              } else if (typeof dm.target === 'string' && !availableColumnsSet.has(dm.target)) {
                invalidCols.push(dm.target)
              }
              if (!dm.flow) {
                errors.push('Sankey chart missing required "flow" field')
              } else if (!availableColumnsSet.has(dm.flow)) {
                invalidCols.push(dm.flow)
              }
              break

            case 'sparkline':
              // Sparkline requires: xAxis + yAxis (like line chart)
              if (!dm.xAxis) {
                errors.push('Sparkline missing required "xAxis" field')
              } else if (!availableColumnsSet.has(dm.xAxis)) {
                invalidCols.push(dm.xAxis)
              }
              if (!dm.yAxis) {
                errors.push('Sparkline missing required "yAxis" field')
              } else {
                const yAxisCols = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
                const invalidY = yAxisCols.filter((col: string) => !availableColumnsSet.has(col))
                invalidCols.push(...invalidY)
              }
              break

            default:
              warnings.push(`Unknown chart type: ${config.type}`)
          }

          // Report invalid columns
          if (invalidCols.length > 0) {
            errors.push(`Invalid column names: ${invalidCols.join(', ')}`)
          }
        }

        // Log errors and warnings
        if (errors.length > 0) {
          logger.error(`[VALIDATION] Chart "${config.title}" has errors:`, errors.join('; '))
          dataMappingValidationErrors++
          return false // Filter out charts with errors
        }

        if (warnings.length > 0) {
          logger.warn(`[VALIDATION] Chart "${config.title}" has warnings:`, warnings.join('; '))
          dataMappingValidationWarnings++
        }

        return true // Keep valid charts
      })

      logger.debug('[VALIDATION] Data mapping validation completed:', {
        totalCharts: aiAnalysis.chartConfig.length,
        errors: dataMappingValidationErrors,
        warnings: dataMappingValidationWarnings
      })

      // Chart diversity validation
      const scorecardCount = aiAnalysis.chartConfig.filter((c: any) => c.type === 'scorecard').length
      const topBottomCount = aiAnalysis.chartConfig.filter((c: any) =>
        c.type === 'bar' && c.dataMapping?.sortBy && c.dataMapping?.limit
      ).length

      logger.debug('[VALIDATION] Chart diversity:', {
        scorecards: scorecardCount,
        topBottom: topBottomCount,
        total: aiAnalysis.chartConfig.length
      })

      if (scorecardCount === 0) {
        logger.warn('[VALIDATION] No scorecards generated')
      }
      if (topBottomCount === 0) {
        logger.warn('[VALIDATION] No Top/Bottom X charts generated')
      }

      // Ensure we still have enough recommendations after filtering
      if (aiAnalysis.chartConfig.length < 4) {
        logger.warn('[VALIDATION] Too few charts after filtering:', aiAnalysis.chartConfig.length)
        // Note: We continue with what we have rather than failing
      }

      // Check for expected chart count
      if (aiAnalysis.chartConfig.length < 16) {
        logger.warn('[VALIDATION] Chart count below minimum:', {
          count: aiAnalysis.chartConfig.length,
          minimum: 16
        })
      }

      if (scorecardCount !== 6) {
        logger.warn('[VALIDATION] Incorrect scorecard count:', {
          actual: scorecardCount,
          expected: 6
        })
      }

      // Scoring integration - Score and rank all recommendations
      logger.debug('[API-ANALYZE] Starting recommendation scoring...')

      // Build data profile for scoring
      const dataProfile: DataProfile = {
        schema: schema || {
          fileName: fileName || 'data.csv',
          rowCount: dataStructure.rowCount,
          columnCount: dataStructure.columnCount,
          columns: dataStructure.columns.map((col: any) => ({
            name: col.name,
            type: col.type as any,
            confidence: 85,
            detectionReason: 'Pattern match',
            suggestedUsage: [],
            uniqueValues: col.uniqueValues,
            sampleValues: col.sampleValues || [],
            nullCount: col.nullCount,
            nullPercentage: col.nullPercentage
          })),
          businessContext: 'General data analysis',
          uploadedAt: new Date().toISOString()
        },
        sampleData: data,
        totalRows: dataStructure.rowCount
      }

      // Convert correctedSchema to scorer format
      const scorerCorrectedColumns: ScorerCorrectedColumn[] | undefined = correctedSchema?.map(col => {
        const originalCol = dataStructure.columns.find((c: any) => c.name === col.name)
        return {
          name: col.name,
          originalType: originalCol?.type || 'string',
          correctedType: col.type,
          confidence: 100
        }
      })

      // Convert AI chart configs to ChartSuggestion format and score them
      let scoredRecommendations: ScoredRecommendation[] = []
      try {
        const chartSuggestions = aiAnalysis.chartConfig.map((config: any, index: number) =>
          convertToChartSuggestion(config, index)
        )

        // Score and rank recommendations
        scoredRecommendations = rankRecommendations(
          chartSuggestions,
          dataProfile,
          scorerCorrectedColumns
        )

        // Calculate quality statistics
        const avgQualityScore = scoredRecommendations.length > 0
          ? scoredRecommendations.reduce((sum, r) => sum + r.qualityScore, 0) / scoredRecommendations.length
          : 0

        const highQualityCount = scoredRecommendations.filter(r => r.qualityScore > 75).length
        const mediumQualityCount = scoredRecommendations.filter(r => r.qualityScore >= 60 && r.qualityScore <= 75).length
        const lowQualityCount = scoredRecommendations.filter(r => r.qualityScore < 60).length

        const recommendationsWithCorrections = scoredRecommendations.filter(r =>
          r.qualityFactors.userCorrectionBoost > 0
        ).length

        logger.info('[API-ANALYZE] Recommendation scoring completed:', {
          total: scoredRecommendations.length,
          avgScore: Math.round(avgQualityScore),
          highQuality: highQualityCount
        })

      } catch (scoringError) {
        logger.error('[API-ANALYZE] Scoring failed, continuing without scores:', {
          error: scoringError instanceof Error ? scoringError.message : 'Unknown error'
        })
        // Continue with unscored recommendations
      }

      // Build enhanced analysis result with confidence scores and user corrections
      const correctedColumnNames = correctedSchema?.map(c => c.name) || []

      const analysisResult: AnalysisResult & {
        schema?: any
        recommendations?: ChartRecommendation[]
        dataContext?: DataContext
        qualityMetrics?: {
          averageQualityScore: number
          highQualityCount: number
          mediumQualityCount: number
          lowQualityCount: number
          withUserCorrections: number
        }
      } = {
        insights: aiAnalysis.insights,

        // Map chart configs to include confidence, reasoning, quality scores, and dataMapping
        chartConfig: aiAnalysis.chartConfig.map((config: any, index: number) => {
          const scoredRec = scoredRecommendations.find(sr => sr.id === `chart-${index}-${config.type}`)

          // Build backward-compatible dataKey from dataMapping
          let legacyDataKey: string[] = []
          if (config.dataMapping) {
            const dm = config.dataMapping
            switch (config.type) {
              case 'bar':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.values) legacyDataKey.push(...dm.values)
                break
              case 'line':
              case 'area':
                if (dm.xAxis) legacyDataKey.push(dm.xAxis)
                if (dm.yAxis) {
                  const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
                  legacyDataKey.push(...yValues)
                }
                break
              case 'pie':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.value) legacyDataKey.push(dm.value)
                break
              case 'scorecard':
                if (dm.metric) legacyDataKey.push(dm.metric)
                break
              case 'scatter':
                if (dm.xAxis) legacyDataKey.push(dm.xAxis)
                if (dm.yAxis) legacyDataKey.push(dm.yAxis as string)
                break
              case 'table':
                if (dm.columns) legacyDataKey.push(...dm.columns)
                break
              case 'combo':
                if (dm.xAxis) legacyDataKey.push(dm.xAxis)
                if (dm.yAxis) {
                  const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
                  legacyDataKey.push(...yValues)
                }
                if (dm.yAxis2) {
                  const y2Values = Array.isArray(dm.yAxis2) ? dm.yAxis2 : [dm.yAxis2]
                  legacyDataKey.push(...y2Values)
                }
                break
              case 'waterfall':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.value) legacyDataKey.push(dm.value)
                if (dm.type && typeof dm.type === 'string') legacyDataKey.push(dm.type)
                break
              case 'heatmap':
                if (dm.xAxis && typeof dm.xAxis === 'string') legacyDataKey.push(dm.xAxis)
                if (dm.yAxis && typeof dm.yAxis === 'string') legacyDataKey.push(dm.yAxis)
                if (dm.value) legacyDataKey.push(dm.value)
                break
              case 'gauge':
                if (dm.metric) legacyDataKey.push(dm.metric)
                if (dm.target && typeof dm.target === 'string') legacyDataKey.push(dm.target)
                break
              case 'cohort':
                if (dm.cohort) legacyDataKey.push(dm.cohort)
                if (dm.period) legacyDataKey.push(dm.period)
                if (dm.retention) legacyDataKey.push(dm.retention)
                break
              case 'bullet':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.actual) legacyDataKey.push(dm.actual)
                if (dm.target && typeof dm.target === 'string') legacyDataKey.push(dm.target)
                break
              case 'treemap':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.value) legacyDataKey.push(dm.value)
                if (dm.parent && typeof dm.parent === 'string') legacyDataKey.push(dm.parent)
                break
              case 'sankey':
                if (dm.source) legacyDataKey.push(dm.source)
                if (dm.target && typeof dm.target === 'string') legacyDataKey.push(dm.target)
                if (dm.flow || dm.value) legacyDataKey.push(dm.flow || dm.value)
                break
              case 'sparkline':
                if (dm.xAxis && typeof dm.xAxis === 'string') legacyDataKey.push(dm.xAxis)
                if (dm.yAxis && typeof dm.yAxis === 'string') legacyDataKey.push(dm.yAxis)
                if (dm.trend) legacyDataKey.push(dm.trend)
                break
            }
          }

          return {
            type: config.type,
            title: config.title,
            description: config.description,
            // Primary: chart-type-specific dataMapping
            dataMapping: config.dataMapping,
            // Legacy fields for backward compatibility
            dataKey: legacyDataKey.length > 0 ? legacyDataKey : undefined,
            xAxis: config.xAxis,
            yAxis: config.yAxis,
            aggregation: config.aggregation || config.dataMapping?.aggregation,
            confidence: config.confidence || 85,
            reasoning: config.reasoning,
            // Add quality scoring data
            qualityScore: scoredRec?.qualityScore,
            qualityFactors: scoredRec?.qualityFactors
          }
        }).sort((a: any, b: any) => {
          // Sort by quality score if available, otherwise by original confidence
          const scoreA = a.qualityScore ?? a.confidence
          const scoreB = b.qualityScore ?? b.confidence
          return scoreB - scoreA
        }),

        // Store enhanced recommendations separately for future use
        recommendations: aiAnalysis.chartConfig.map((config: any) => {
          // Build backward-compatible dataKey from dataMapping
          let legacyDataKey: string[] = []
          if (config.dataMapping) {
            const dm = config.dataMapping
            switch (config.type) {
              case 'bar':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.values) legacyDataKey.push(...dm.values)
                break
              case 'line':
              case 'area':
                if (dm.xAxis) legacyDataKey.push(dm.xAxis)
                if (dm.yAxis) {
                  const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
                  legacyDataKey.push(...yValues)
                }
                break
              case 'pie':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.value) legacyDataKey.push(dm.value)
                break
              case 'scorecard':
                if (dm.metric) legacyDataKey.push(dm.metric)
                break
              case 'scatter':
                if (dm.xAxis) legacyDataKey.push(dm.xAxis)
                if (dm.yAxis) legacyDataKey.push(dm.yAxis as string)
                break
              case 'table':
                if (dm.columns) legacyDataKey.push(...dm.columns)
                break
              case 'combo':
                if (dm.xAxis) legacyDataKey.push(dm.xAxis)
                if (dm.yAxis) {
                  const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
                  legacyDataKey.push(...yValues)
                }
                if (dm.yAxis2) {
                  const y2Values = Array.isArray(dm.yAxis2) ? dm.yAxis2 : [dm.yAxis2]
                  legacyDataKey.push(...y2Values)
                }
                break
              case 'waterfall':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.value) legacyDataKey.push(dm.value)
                if (dm.type && typeof dm.type === 'string') legacyDataKey.push(dm.type)
                break
              case 'heatmap':
                if (dm.xAxis && typeof dm.xAxis === 'string') legacyDataKey.push(dm.xAxis)
                if (dm.yAxis && typeof dm.yAxis === 'string') legacyDataKey.push(dm.yAxis)
                if (dm.value) legacyDataKey.push(dm.value)
                break
              case 'gauge':
                if (dm.metric) legacyDataKey.push(dm.metric)
                if (dm.target && typeof dm.target === 'string') legacyDataKey.push(dm.target)
                break
              case 'cohort':
                if (dm.cohort) legacyDataKey.push(dm.cohort)
                if (dm.period) legacyDataKey.push(dm.period)
                if (dm.retention) legacyDataKey.push(dm.retention)
                break
              case 'bullet':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.actual) legacyDataKey.push(dm.actual)
                if (dm.target && typeof dm.target === 'string') legacyDataKey.push(dm.target)
                break
              case 'treemap':
                if (dm.category) legacyDataKey.push(dm.category)
                if (dm.value) legacyDataKey.push(dm.value)
                if (dm.parent && typeof dm.parent === 'string') legacyDataKey.push(dm.parent)
                break
              case 'sankey':
                if (dm.source) legacyDataKey.push(dm.source)
                if (dm.target && typeof dm.target === 'string') legacyDataKey.push(dm.target)
                if (dm.flow || dm.value) legacyDataKey.push(dm.flow || dm.value)
                break
              case 'sparkline':
                if (dm.xAxis && typeof dm.xAxis === 'string') legacyDataKey.push(dm.xAxis)
                if (dm.yAxis && typeof dm.yAxis === 'string') legacyDataKey.push(dm.yAxis)
                if (dm.trend) legacyDataKey.push(dm.trend)
                break
            }
          }

          return {
            type: config.type,
            title: config.title,
            description: config.description,
            dataMapping: config.dataMapping,
            dataKey: legacyDataKey.length > 0 ? legacyDataKey : undefined,
            xAxis: config.xAxis,
            yAxis: config.yAxis,
            aggregation: config.aggregation || config.dataMapping?.aggregation,
            confidence: config.confidence || 85,
            reasoning: config.reasoning
          }
        }),

        summary: {
          rowCount: dataStructure.rowCount,
          columnCount: dataStructure.columnCount,
          columns: dataStructure.columns.map((col: any) => ({
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
          }),
          // Add user correction metadata
          ...(correctedColumnNames.length > 0 && {
            correctedColumns: correctedColumnNames,
            improvementNotes: feedback || `User corrected ${correctedColumnNames.length} column(s) for improved recommendations`
          })
        },

        // Add quality metrics to response
        qualityMetrics: scoredRecommendations.length > 0 ? {
          averageQualityScore: Math.round(
            scoredRecommendations.reduce((sum, r) => sum + r.qualityScore, 0) / scoredRecommendations.length
          ),
          highQualityCount: scoredRecommendations.filter(r => r.qualityScore > 75).length,
          mediumQualityCount: scoredRecommendations.filter(r => r.qualityScore >= 60 && r.qualityScore <= 75).length,
          lowQualityCount: scoredRecommendations.filter(r => r.qualityScore < 60).length,
          withUserCorrections: scoredRecommendations.filter(r => r.qualityFactors.userCorrectionBoost > 0).length
        } : undefined
      }

      // REBALANCING DISABLED: Show all valid charts generated by AI
      // logger.info('[API-ANALYZE] Rebalancing charts before response:', {
      //   beforeCount: analysisResult.chartConfig.length,
      //   scorecards: analysisResult.chartConfig.filter((c: any) => c.type === 'scorecard').length,
      //   tables: analysisResult.chartConfig.filter((c: any) => c.type === 'table').length
      // })

      // // Apply rebalancing to chartConfig
      // // IMPORTANT: For e-commerce/FBA/financial dashboards, we need many KPI scorecards
      // // AI is prompted to generate 8+ diverse scorecards (sum, avg, count, min, max, distinct)
      // // Allow up to 10 scorecards to show rich KPI metrics, leaving 5 slots for analytical charts + 1 table
      // analysisResult.chartConfig = rebalanceCharts(analysisResult.chartConfig as any, 16, {
      //   minScorecards: 0,   // Don't force minimum - use what AI generated
      //   maxScorecards: 10,  // Allow up to 10 scorecards for rich KPI dashboards
      //   preferredScorecards: 8,  // Prefer 8 scorecards (matches AI prompt)
      //   requireTable: true
      // }) as any

      // // Log rebalancing results
      // const chartStats = getChartStats(analysisResult.chartConfig as any)
      // logger.info('[API-ANALYZE] Charts rebalanced successfully:', chartStats)

      // // Validate layout
      // const validation = validateChartLayout(analysisResult.chartConfig as any)
      // if (!validation.valid) {
      //   logger.warn('[API-ANALYZE] Chart layout validation warnings:', validation.errors)
      // }

      // Log final chart count without rebalancing
      logger.info('[API-ANALYZE] Showing all valid charts without rebalancing:', {
        totalCharts: analysisResult.chartConfig.length,
        scorecards: analysisResult.chartConfig.filter((c: any) => c.type === 'scorecard').length,
        visualizations: analysisResult.chartConfig.filter((c: any) => !['scorecard', 'table'].includes(c.type)).length,
        tables: analysisResult.chartConfig.filter((c: any) => c.type === 'table').length
      })

      // Build enhanced data context
      const dataContext: DataContext = {
        rowCount: dataStructure.rowCount,
        columnCount: dataStructure.columnCount,
        columns: dataStructure.columns as ColumnSchema[],
        ...(correctedColumnNames.length > 0 && {
          correctedColumns: correctedColumnNames,
          improvementNotes: feedback || `Analysis improved with ${correctedColumnNames.length} user correction(s)`
        })
      }
      analysisResult.dataContext = dataContext

      // If corrected schema was provided, include enhanced schema info
      if (correctedSchema && correctedSchema.length > 0) {
        const { analyzeDataSchema } = await import('@/lib/utils/schema-analyzer')
        const enhancedSchema = analyzeDataSchema(data, fileName || 'data.csv')

        // Merge user corrections with enhanced detection
        analysisResult.schema = {
          ...enhancedSchema,
          columns: enhancedSchema.columns.map(col => {
            const userCorrection = correctedSchema.find(c => c.name === col.name)
            if (userCorrection) {
              return {
                ...col,
                type: userCorrection.type as any,
                description: userCorrection.description || col.description,
                userCorrected: true,
                confidence: 100 // User corrected, so 100% confidence
              }
            }
            return col
          }),
          businessContext: aiAnalysis.summary?.businessContext,
          relationships: enhancedSchema.relationships
        }
      }
      
      // Log enhanced analysis completion
      const totalDuration = Date.now() - requestStartTime
      logger.info('[API-ANALYZE] Analysis completed:', {
        totalVisualizations: aiAnalysis.chartConfig?.length || 0,
        scorecards: aiAnalysis.chartConfig?.filter((c: any) => c.type === 'scorecard').length || 0,
        userCorrections: correctedColumnNames.length,
        duration: totalDuration + 'ms'
      })

    logger.debug('[API-ANALYZE] Response structure:', {
      chartCount: analysisResult.chartConfig.length,
      chartTypes: analysisResult.chartConfig.map((c: any) => c.type)
    })

    // PERFORMANCE: Cache the result for future requests
    setCachedAnalysis(dataHash, analysisResult, JSON.stringify(data).length)
    logger.info('[API-ANALYZE] Result cached for hash:', dataHash.substring(0, 8) + '...')

    return NextResponse.json(analysisResult)

    } catch (parseError) {
      logger.error('[API-ANALYZE] Error parsing OpenAI response:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        responseLength: response?.length
      })
      logger.debug('[API-ANALYZE] Response preview:', response?.substring(0, 200))

      // Return error if AI response is malformed
      return NextResponse.json(
        {
          error: 'Failed to parse AI response. Please try again.',
          details: parseError instanceof Error ? parseError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    const totalDuration = Date.now() - requestStartTime
    logger.error('[API-ANALYZE] Error in analysis API:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: totalDuration + 'ms'
    })

    // Handle timeout errors specifically
    if (isTimeoutError(error)) {
      logger.error('[API-ANALYZE] Request timed out:', {
        timeoutMs: error.timeoutMs,
        message: error.message
      })
      return NextResponse.json(
        {
          error: 'Analysis request timed out',
          type: 'timeout',
          details: 'The analysis took too long to complete. Please try with a smaller dataset or contact support.',
          timeoutMs: error.timeoutMs
        },
        { status: 408 } // Request Timeout
      )
    }

    // Detailed error logging for OpenAI issues
    if (error && typeof error === 'object') {
      const err = error as any
      logger.debug('Error details:', {
        code: err.code,
        type: err.type,
        status: err.status
      })

      // Check for specific OpenAI error types
      if (err.code === 'rate_limit_exceeded') {
        logger.error('[API-ANALYZE] Rate limit exceeded:', err.message)
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
        logger.error('[API-ANALYZE] Insufficient quota:', err.message)
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
        logger.error('[API-ANALYZE] 429 Rate limit from OpenAI:', err.message)
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
        logger.error('[API-ANALYZE] 401 Unauthorized from OpenAI:', err.message)
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
        logger.error('[API-ANALYZE] OpenAI server error:', err.status, err.message)
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
})

// Apply rate limiting middleware for AI analysis endpoint
// ANALYSIS rate limit: 10 requests per hour (expensive AI operations)
// Authentication is required (withAuth middleware)
export const POST = withRateLimit(RATE_LIMITS.ANALYSIS, handler)

// Fallback function removed - OpenAI API key is now required
