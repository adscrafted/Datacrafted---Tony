import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { DataRow, AnalysisResult, DataSchema, ColumnSchema } from '@/lib/store'
import { scoreRecommendation, rankRecommendations, ScoredRecommendation, DataProfile, CorrectedColumn as ScorerCorrectedColumn } from '@/lib/utils/recommendation-scorer'
import { ChartSuggestion } from '@/lib/types/chart-suggestion'
import { detectDateWithConfidence, analyzeDataSchema } from '@/lib/utils/schema-analyzer'

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

// Supported chart types - SINGLE SOURCE OF TRUTH
const SUPPORTED_CHART_TYPES = [
  'line', 'bar', 'pie', 'area', 'scatter', 'scorecard', 'table', 'combo',
  'waterfall', 'funnel', 'heatmap', 'gauge', 'cohort', 'bullet', 'treemap',
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

    // Funnel specific
    stage?: string              // Funnel stage/step column
    // value already covered above

    // Heatmap specific
    // xAxis, yAxis already covered
    // value already covered

    // Gauge specific
    target?: string             // Target/goal value column
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
      console.warn('⚠️ [VALIDATION] Filtering out unsupported chart type:', {
        type: config.type,
        title: config.title,
        supportedTypes: SUPPORTED_CHART_TYPES
      })
    }

    return isSupported
  })

  if (filtered.length < chartConfigs.length) {
    console.log('🔍 [VALIDATION] Filtered chart recommendations:', {
      original: chartConfigs.length,
      filtered: filtered.length,
      removed: chartConfigs.length - filtered.length,
      removedTypes: chartConfigs
        .filter(c => !SUPPORTED_CHART_TYPES.includes(c.type))
        .map(c => c.type)
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

// Rate limiting (simple in-memory store for demo)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds
const MAX_ENTRIES = 10000 // Prevent unbounded growth

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()

  // Periodically clean up expired entries to prevent memory leak
  if (requestCounts.size > MAX_ENTRIES) {
    console.log(`🧹 [RATE-LIMIT] Cleaning up expired entries (current size: ${requestCounts.size})`)
    Array.from(requestCounts.entries()).forEach(([key, value]) => {
      if (now > value.resetTime) {
        requestCounts.delete(key)
      }
    })
    console.log(`✅ [RATE-LIMIT] Cleanup complete (new size: ${requestCounts.size})`)
  }

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

function getDataSample(data: DataRow[], maxRows: number = 25): DataRow[] {
  // Get a strategic sample: top performers + bottom performers + random diversity
  if (data.length <= maxRows) return data

  const sample: DataRow[] = []

  // Try to find a key numeric column for sorting (revenue, sales, spend, etc.)
  const columns = Object.keys(data[0] || {})
  const numericColumns = columns.filter(col => {
    const values = data.slice(0, 100).map(row => row[col])
    return values.some(v => typeof v === 'number' || (!isNaN(parseFloat(String(v))) && String(v).match(/\d/)))
  })

  // Priority columns for sorting (business-relevant metrics)
  const priorityKeywords = ['sales', 'revenue', 'total', 'amount', 'spend', 'value']
  const sortColumn = numericColumns.find(col =>
    priorityKeywords.some(kw => col.toLowerCase().includes(kw))
  ) || numericColumns[0]

  if (sortColumn) {
    // Parse numeric values, handling currency formats
    const parseNumeric = (val: any): number => {
      if (typeof val === 'number') return val
      if (typeof val !== 'string') return 0
      const cleaned = String(val).replace(/[€$£¥,\s%]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    // Sort by the key column
    const sorted = [...data].sort((a, b) =>
      parseNumeric(b[sortColumn]) - parseNumeric(a[sortColumn])
    )

    // Top 10 performers
    sample.push(...sorted.slice(0, Math.min(10, data.length)))

    // Bottom 5 performers
    if (data.length > 15) {
      sample.push(...sorted.slice(-5))
    }

    // Random 10 for diversity (avoid duplicates)
    const remaining = maxRows - sample.length
    if (remaining > 0 && data.length > sample.length) {
      const usedIndices = new Set<number>()
      while (sample.length < maxRows && usedIndices.size < data.length) {
        const randomIndex = Math.floor(Math.random() * data.length)
        if (!usedIndices.has(randomIndex)) {
          usedIndices.add(randomIndex)
          const row = data[randomIndex]
          // Check if this row is already in sample
          if (!sample.some(s => JSON.stringify(s) === JSON.stringify(row))) {
            sample.push(row)
          }
        }
      }
    }
  } else {
    // Fallback: evenly distributed sample if no numeric columns
    const step = Math.floor(data.length / maxRows)
    for (let i = 0; i < maxRows && i * step < data.length; i++) {
      sample.push(data[i * step])
    }
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
 * Get domain-specific prompt guidance
 */
function getDomainSpecificGuidance(domain: string): string {
  const guidance: Record<string, string> = {
    advertising: `
## ADVERTISING METRICS FRAMEWORK

YOU MUST INCLUDE THESE VISUALIZATIONS (MANDATORY):

1. **Executive Summary Scorecards** (4 scorecards minimum):
   - Total Ad Spend (sum)
   - Total Revenue/Sales (sum)
   - Average ROAS or ROI (calculated metric)
   - Active Campaigns count

2. **Campaign Performance Ranking** (bar chart):
   - Top 10-20 campaigns by revenue or sales
   - Sorted descending, business context in title
   - Example title: "Top 10 Revenue-Generating Campaigns"

3. **Efficiency Analysis** (scatter plot with 4 dimensions):
   - X = Spend, Y = Sales/Revenue
   - Size = Impressions or Clicks
   - Color = Campaign or Region
   - Title should mention "Efficiency Matrix" or "ROI Analysis"

4. **Performance Trends** (combo chart REQUIRED for multi-scale - if date column exists):
   - Daily/weekly trends of key metrics
   - MUST use combo chart if scale ratio > 10x (see MANDATORY SCALE DETECTION RULE)
   - Use dual Y-axis to separate metrics with different scales (e.g., Impressions vs Sales)

ADVERTISING-SPECIFIC RULES:
- Calculate ROAS or ROI metrics when Spend and Sales columns exist
- Filter out campaigns with all zeros (inactive campaigns)
- Use scatter plots for efficiency analysis
- NEVER use pie charts for >10 campaigns
- Prioritize Top-N analysis (top 10, top 20)
`,
    ecommerce: `
## E-COMMERCE METRICS FRAMEWORK

YOU MUST INCLUDE THESE VISUALIZATIONS (MANDATORY):

1. **Business Scorecards** (4 scorecards minimum):
   - Total Revenue (sum)
   - Average Order Value (avg)
   - Total Orders (count)
   - Conversion Rate (calculated if sessions/visits exist)

2. **Top Products** (bar chart):
   - Top 10-20 products by revenue or units sold
   - Sorted descending

3. **Customer Segmentation** (scatter plot):
   - X = Order Frequency, Y = Average Order Value
   - Size = Total Spend
   - Identifies VIP customers

4. **Revenue Trends** (line or combo chart - check scale ratios):
   - Daily/weekly/monthly revenue patterns
   - Use combo chart if comparing metrics with different scales (apply SCALE DETECTION RULE)

E-COMMERCE-SPECIFIC RULES:
- Calculate Average Order Value if Orders and Revenue exist
- Show product performance rankings
- Identify seasonality patterns in time-series
`,
    sales: `
## SALES PERFORMANCE FRAMEWORK

YOU MUST INCLUDE THESE VISUALIZATIONS (MANDATORY):

1. **Sales Scorecards** (4 scorecards minimum):
   - Total Pipeline Value (sum)
   - Average Deal Size (avg)
   - Win Rate (calculated if won/total deals exist)
   - Total Deals Closed (count)

2. **Rep Performance** (bar or scatter chart):
   - Top performers by revenue or deals closed
   - Identify coaching opportunities

3. **Pipeline Analysis** (line or bar chart):
   - Deals by stage, time to close trends

SALES-SPECIFIC RULES:
- Calculate win rates, average deal sizes
- Show rep comparisons for accountability
`,
    general: ''
  }

  return guidance[domain] || ''
}

/**
 * Build enhanced AI prompt with chain-of-thought reasoning and calculated fields
 * Based on research: multi-stage analysis produces higher quality insights than single-shot prompts
 */
function buildEnhancedPrompt(
  dataStructure: any,
  schema?: DataSchema,
  correctedSchema?: Array<{ name: string; type: string; description: string; userCorrected: boolean }>,
  feedback?: string
): string {
  // Detect business domain
  const domain = detectBusinessDomain(dataStructure.columns.map((c: any) => c.name))
  const domainGuidance = getDomainSpecificGuidance(domain)

  let prompt = `# DATA ANALYSIS TASK

You are analyzing ${domain.toUpperCase()} DATA.
You have ${dataStructure.rowCount} rows and ${dataStructure.columnCount} columns to analyze.

${domainGuidance}

## AVAILABLE COLUMNS (USE ONLY THESE):
`

  // Show all columns with their statistics
  dataStructure.columns.forEach((col: any) => {
    prompt += `\n### "${col.name}" (${col.type})`
    if (col.stats && Object.keys(col.stats).length > 0) {
      if (col.type === 'number') {
        prompt += `\n  Range: ${col.stats.min} to ${col.stats.max} | Avg: ${col.stats.avg} | Sum: ${col.stats.sum}`
        if (col.stats.nonZeroCount < dataStructure.rowCount * 0.5) {
          prompt += ` | ⚠️ ${Math.round((1 - col.stats.nonZeroCount / dataStructure.rowCount) * 100)}% zeros`
        }
      } else if (col.type === 'categorical' && col.stats.distribution) {
        prompt += `\n  Top categories: ${col.stats.distribution.slice(0, 3).map((d: any) => `${d.value} (${d.percentage}%)`).join(', ')}`
        prompt += ` | ${col.stats.categoryCount} unique values`
      } else if (col.type === 'date' && col.stats.earliest) {
        prompt += `\n  Date range: ${col.stats.earliest} to ${col.stats.latest} (${col.stats.spanDays} days)`
      }
    }
    if (col.nullPercentage > 0) {
      prompt += `\n  ⚠️ ${col.nullPercentage}% missing values`
    }
  })

  if (correctedSchema && correctedSchema.length > 0) {
    prompt += `\n\n## ⚠️ USER CORRECTIONS (HIGHEST PRIORITY):\n`
    correctedSchema.forEach(col => {
      prompt += `- ${col.name}: ${col.type} - "${col.description}"\n`
    })
    if (feedback) prompt += `\nUser Feedback: ${feedback}\n`
  }

  prompt += `\n\n## YOUR ANALYSIS PROCESS (FOLLOW THESE STEPS):

### STEP 1: DOMAIN & CONTEXT ANALYSIS
Think through these questions in your "reasoning" section:
- What business domain does this data represent? (advertising, e-commerce, operations, etc.)
- What are the key entities? (campaigns, products, customers, time periods)
- What business process is being tracked? (sales funnel, ad performance, customer journey)
- What decisions would stakeholders make with this data?

### STEP 2: KEY BUSINESS QUESTIONS
Identify 3-5 critical questions that stakeholders would want answered:
- What are they trying to optimize? (ROI, efficiency, growth, cost reduction)
- What comparisons matter? (time periods, segments, channels, products)
- What patterns or anomalies would be actionable? (trends, outliers, correlations)
- Include these questions in your "businessQuestions" array

### STEP 3: IDENTIFY KEY METRICS AND RELATIONSHIPS
Analyze which existing columns contain the most valuable information:
- Which metrics indicate performance or outcomes? (orders, sales, clicks, revenue)
- Which metrics indicate investment or cost? (spend, budget, impressions)
- What relationships between columns would reveal insights? (clicks vs impressions, orders vs spend)
- Which dimensions allow for meaningful segmentation? (campaign, date, category, location)

⚠️ IMPORTANT: Work ONLY with existing columns. Do NOT create or imagine new calculated fields.

### STEP 4: VISUALIZATION STRATEGY
Now recommend 5-7 high-value visualizations that:
1. Answer the business questions from Step 2
2. ⚠️ ONLY use columns that ALREADY EXIST in the "AVAILABLE COLUMNS" list at the top of this prompt
3. ⚠️ To show efficiency or relationships, use TWO columns in a scatter plot or multi-series chart (e.g., "Clicks" vs "Impressions")
4. ⚠️ Before adding ANY column to dataMapping, verify it exists in AVAILABLE COLUMNS
5. Prioritize actionable insights over basic aggregations
6. Follow visual best practices for readability

🚨 COLUMN NAME VALIDATION REQUIRED:
- Double-check EVERY column name against the AVAILABLE COLUMNS list
- Use exact spelling, capitalization, and spacing from AVAILABLE COLUMNS
- If a column doesn't exist, DO NOT USE IT

## COMBO CHARTS (DUAL Y-AXIS) - WHEN TO USE:
- Use combo charts when comparing metrics with DIFFERENT SCALES or UNITS
- Examples: Revenue ($) vs Conversion Rate (%), Sales vs Temperature, Count vs Percentage
- PRIMARY Y-axis (yAxis): Typically higher magnitude metric (sales, revenue, counts)
- SECONDARY Y-axis (yAxis2): Typically ratio/rate/percentage metric
- Use bars for volumes/counts, lines for rates/trends
- ALWAYS specify yAxis1Label and yAxis2Label with units
- Generate combo charts when you see metrics with different units in the same category

### MANDATORY SCALE DETECTION RULE:
🚨 BEFORE creating ANY multi-metric chart, calculate scale differences:
1. Calculate: ratio = (largest metric max value) / (smallest metric max value)
2. Apply this decision tree:
   - If ratio > 10x → MUST use combo chart (NOT line, NOT bar)
   - If ratio > 3x → STRONGLY RECOMMEND combo chart
   - If ratio < 3x → Single-axis line or bar is acceptable

📊 SCALE DETECTION EXAMPLES:
Example 1 - MUST use combo (ratio = 50x):
  - Impressions: max = 500,000
  - Clicks: max = 10,000
  - Ratio: 500,000 / 10,000 = 50x → COMBO REQUIRED
  - Put Impressions on yAxis (bars), Clicks on yAxis2 (line)

Example 2 - MUST use combo (ratio = 100x):
  - Impressions: max = 1,000,000
  - Sales: max = 10,000
  - Ratio: 1,000,000 / 10,000 = 100x → COMBO REQUIRED
  - Put Impressions on yAxis (bars), Sales on yAxis2 (line)

Example 3 - STRONGLY recommend combo (ratio = 5x):
  - Revenue: max = 50,000
  - Orders: max = 10,000
  - Ratio: 50,000 / 10,000 = 5x → COMBO STRONGLY RECOMMENDED

Example 4 - Single axis OK (ratio = 2x):
  - Clicks: max = 20,000
  - Conversions: max = 10,000
  - Ratio: 20,000 / 10,000 = 2x → Single axis line/bar acceptable

⚠️ COMMON ADVERTISING METRICS THAT REQUIRE COMBO CHARTS:
- Impressions vs Clicks (typically 20-100x ratio)
- Impressions vs Sales (typically 50-1000x ratio)
- Clicks vs Sales (typically 5-50x ratio)
- Spend vs Sales (can vary, check ratio)
- Any volume metric vs rate/percentage (always different scales)

## QUALITY REQUIREMENTS:

### DEPTH OVER BREADTH:
❌ DON'T: "Total Impressions" scorecard alone
✅ DO: "Campaign Performance: Impressions and Clicks by Campaign" with clear comparisons

### COMPARISON & SEGMENTATION REQUIRED:
- Every chart must compare across: time, categories, or segments
- Generate multiple scorecards with different aggregations (sum, avg, count, min, max) for numeric columns
- Prioritize scorecards for columns with high business value (revenue, sales, key metrics)
- Use color, size, or multiple series to show relationships

### INSIGHT LEVELS (classify each chart):
- HIGH: Reveals patterns, correlations, outliers, or anomalies requiring action
- MEDIUM: Provides useful context or confirms expectations
- LOW: Shows basic aggregations without additional insight
- You MUST include at least 4 HIGH insight visualizations

### SCORECARD GENERATION STRATEGY:
- Create scorecards for key business metrics like totals (sum), averages (avg), and counts (count)
- Use min/max scorecards to highlight extremes (highest revenue, lowest cost, etc.)
- Each scorecard should have a clear aggregation type specified
- Diverse aggregations provide richer insights (use different aggregations: sum, avg, count, min, max)

### AVOID:
- Duplicate scorecards (same metric AND same aggregation) - instead use different aggregations on the same metric
- Same chart at different granularities
- Charts that don't answer different business questions
- Using column names that don't exist (like CTR, ROAS, CPC if they're not in AVAILABLE COLUMNS)

## REAL-WORLD BUSINESS EXAMPLES (LEARN FROM THESE):

### Example 1: ADVERTISING CAMPAIGN ANALYSIS
**Available Columns**: Campaign Name, Start Date, Impressions, Clicks, Spend, 7 Day Total Sales, 7 Day Total Orders (#)

**HIGH-QUALITY ANALYSIS**:
1. **Executive Dashboard** (4 scorecards):
   - "Total Ad Spend" (sum of Spend) - Shows total investment
   - "Average ROAS" (avg of [7 Day Total Sales / Spend]) - Wait, we can't calculate! Use scatter plot instead
   - "Total Sales Generated" (sum of 7 Day Total Sales) - Shows revenue impact
   - "Average Orders per Campaign" (avg of 7 Day Total Orders (#)) - Shows typical campaign performance
   - "Peak Single-Day Sales" (max of 7 Day Total Sales) - Shows best-case potential

2. **Efficiency Analysis** (scatter plot):
   - Title: "Campaign Advertising Efficiency: Spend vs Sales"
   - X=Spend, Y=7 Day Total Sales, Size=Impressions, Color=Campaign Name
   - Description: "Bubble size represents reach (Impressions). Campaigns in upper-left quadrant (high sales, low spend) are most efficient. Outliers indicate opportunities for optimization."
   - Answers: "Which campaigns deliver best ROI? Which are overspending?"

3. **Performance Over Time** (COMBO chart - multi-scale metrics):
   - Title: "Daily Campaign Performance Trends"
   - X=Start Date, yAxis=[Impressions], yAxis2=[Clicks, 7 Day Total Sales]
   - Description: "Track how campaign reach, engagement, and sales evolve over time. Identify seasonality and momentum shifts. Uses dual Y-axis to handle scale differences."
   - Answers: "Are campaigns improving or declining? When did performance spike?"
   - Note: Impressions vs Clicks/Sales have 20-100x scale difference - MUST use combo chart

4. **Top Performers** (Top 10 bar chart):
   - Title: "Top 10 Campaigns by Sales Revenue"
   - Category=Campaign Name, Values=[7 Day Total Sales], sortBy=7 Day Total Sales, sortOrder=desc, limit=10
   - Description: "Identify star performers generating the most revenue. Focus budget on these winners."
   - Answers: "Where should we allocate more budget?"

5. **Engagement Funnel** (dual Y-axis combo):
   - Title: "Campaign Reach vs Engagement"
   - X=Campaign Name, Y1=[Impressions] (bars), Y2=[Clicks] (line), Y1Label="Impressions", Y2Label="Clicks"
   - Description: "Bars show reach, line shows engagement. Gaps indicate low click-through campaigns."
   - Answers: "Which campaigns have good reach but poor engagement?"

### Example 2: E-COMMERCE PRODUCT ANALYSIS
**Available Columns**: Product Name, Category, Price, Units Sold, Revenue, Stock Level, Customer Rating

**HIGH-QUALITY ANALYSIS**:
1. **Scorecards**:
   - "Total Revenue" (sum of Revenue)
   - "Average Product Price" (avg of Price)
   - "Best-Selling Product Units" (max of Units Sold)
   - "Lowest Stock Alert" (min of Stock Level)

2. **Price-Performance Matrix** (scatter):
   - X=Price, Y=Units Sold, Size=Revenue, Color=Category
   - "Products in upper-left (high volume, low price) are volume drivers. Upper-right (high price, high volume) are premium winners."

3. **Category Winners** (Top 10):
   - Category=Category, Values=[Revenue, Units Sold], sortBy=Revenue, desc, limit=10
   - "Focus inventory on these top-grossing categories"

4. **Inventory Risk** (Bottom 5):
   - Category=Product Name, Values=[Stock Level], sortBy=Stock Level, asc, limit=5
   - "Products at risk of stockout - reorder immediately"

### Example 3: SALES OPERATIONS
**Available Columns**: Sales Rep, Region, Deals Closed, Revenue, Average Deal Size, Days to Close

**HIGH-QUALITY ANALYSIS**:
1. **Scorecards**:
   - "Total Deals Closed" (sum)
   - "Average Deal Size" (avg)
   - "Fastest Deal Closed" (min of Days to Close)

2. **Rep Performance** (scatter):
   - X=Deals Closed, Y=Revenue, Size=Average Deal Size, Color=Region
   - "Identifies top performers and coaching opportunities. Size shows deal quality."

3. **Regional Winners** (grouped bar):
   - Category=Region, Values=[Revenue, Deals Closed]
   - "Compare regional performance side-by-side"

4. **Efficiency Leaders** (Top 10):
   - Category=Sales Rep, Values=[Average Deal Size], sortBy=Average Deal Size, desc, limit=10
   - "Reps closing highest-value deals"

## SUPPORTED CHART TYPES & DATA MAPPING:

⚠️ CRITICAL RULES:
1. **ONLY USE THESE SUPPORTED CHART TYPES**: ${SUPPORTED_CHART_TYPES.join(', ')}
2. **ALL examples below use placeholder column names** - YOU MUST replace them with actual column names from the "AVAILABLE COLUMNS" section above!
3. **INTELLIGENT CHART SELECTION** - Match chart type to data characteristics:
   - Financial variance data (revenue changes, P&L) → waterfall
   - Conversion stages (sales funnel, user journey) → funnel
   - Two categorical dimensions + metric → heatmap
   - Performance vs target with thresholds → gauge or bullet
   - Cohort retention over time → cohort
   - Flow/journey data (traffic sources, budget allocation) → sankey
   - Hierarchical proportions (category breakdowns) → treemap
   - Compact trends in limited space → sparkline

## AVAILABLE CHART TYPES WITH USE CASES:

### CORE CHARTS (Use for most analyses):
- **line**: Time series trends, continuous data over time
- **bar**: Category comparisons, rankings (use with sortBy/limit for Top/Bottom X)
- **pie**: Part-to-whole relationships (3-7 slices max)
- **area**: Cumulative trends, volume over time
- **scatter**: Correlation and relationships (always use size + color dimensions)
- **scorecard**: Single KPI metrics (use diverse aggregations: sum, avg, count, min, max)
- **table**: Detailed tabular data (5-10 key columns)
- **combo**: Dual-axis comparisons for different scales (e.g., volume vs rate)

### ADVANCED CHARTS (Use when data patterns match):
- **waterfall**: Sequential variance analysis - shows cumulative impact of increases/decreases
  * Use for: Revenue bridges, P&L waterfall, budget variance, cost breakdowns
  * Detect: Columns with "variance", "change", "increase", "decrease", or step-by-step calculations

- **funnel**: Conversion funnels - shows progressive drop-off through stages
  * Use for: Sales process, user journey, conversion analysis
  * Detect: Columns with "stage", "step", "phase" and decreasing values

- **heatmap**: 2D correlation matrices - intensity map for two categorical dimensions
  * Use for: Time × category analysis (day of week × hour), category × category patterns
  * Detect: Two categorical dimensions + one metric to visualize as color intensity

- **gauge**: Performance vs target - radial gauge with zones
  * Use for: KPI tracking with thresholds (sales vs quota, performance vs target)
  * Detect: Columns with "target", "goal", "threshold", "quota" paired with actual values

- **cohort**: Retention analysis - cohort grid showing retention over time
  * Use for: Customer retention, user engagement over cohort lifecycle
  * Detect: Cohort identifier (signup month) + time period + retention metric

- **bullet**: Performance ranges - compact linear gauge with zones
  * Use for: Actual vs target with performance zones (poor/good/excellent)
  * Detect: Similar to gauge but more compact format

- **treemap**: Hierarchical proportions - nested rectangles for category breakdowns
  * Use for: Market share, category composition, hierarchical budget allocation
  * Detect: Parent-child category hierarchy + size metric

- **sankey**: Flow diagrams - shows flow between nodes
  * Use for: Traffic sources, budget allocation flows, conversion paths
  * Detect: Source column + target column + flow value

- **sparkline**: Compact trends - minimal line chart for dashboard tables
  * Use for: Inline trends in tables, small multiples for comparison
  * Detect: Time series where space is limited (embed in tables/dashboards)

**LEARN FROM THE BUSINESS EXAMPLES ABOVE - Your analysis should have:**
- Clear business context in titles ("Campaign Efficiency" not "Spend vs Sales")
- Descriptions that explain what to look for ("upper-left quadrant = most efficient")
- Answers to specific business questions ("Which campaigns deliver best ROI?")
- Multi-dimensional thinking (scatter plots with size AND color)
- Actionable insights ("Focus budget on these winners")

### SCORECARD (Single Metric KPIs - Generate Multiple for Different Aggregations):
// Sum aggregation - with business context
{
  "type": "scorecard",
  "title": "Total Ad Spend",
  "description": "Total investment across all campaigns - use to track budget utilization",
  "dataMapping": {"metric": "Spend", "aggregation": "sum"},
  "insight_level": "high",
  "answers_question": "How much total budget have we invested?"
}

// Average aggregation - with business context
{
  "type": "scorecard",
  "title": "Average Campaign Sales",
  "description": "Average revenue per campaign - benchmark for campaign performance expectations",
  "dataMapping": {"metric": "7 Day Total Sales", "aggregation": "avg"},
  "insight_level": "high",
  "answers_question": "What's typical campaign revenue?"
}

// Max aggregation - with business context
{
  "type": "scorecard",
  "title": "Peak Campaign Sales",
  "description": "Highest sales from a single campaign - shows best-case potential and target to beat",
  "dataMapping": {"metric": "7 Day Total Sales", "aggregation": "max"},
  "insight_level": "medium",
  "answers_question": "What's our best campaign performance?"
}

// Count aggregation - with business context
{
  "type": "scorecard",
  "title": "Total Active Campaigns",
  "description": "Number of campaigns running - use to track campaign portfolio size",
  "dataMapping": {"metric": "Campaign Name", "aggregation": "count"},
  "insight_level": "medium",
  "answers_question": "How many campaigns are we managing?"
}

### TOP/BOTTOM X CHARTS (Rankings and Comparisons):
// Top 10 - with business context
{
  "type": "bar",
  "title": "Top 10 Campaigns by Revenue",
  "description": "Star performers generating the most sales - allocate more budget to these winners",
  "dataMapping": {
    "category": "Campaign Name",
    "values": ["7 Day Total Sales"],
    "aggregation": "sum",
    "sortBy": "7 Day Total Sales",
    "sortOrder": "desc",
    "limit": 10
  },
  "insight_level": "high",
  "answers_question": "Which campaigns should we invest more in?"
}

// Bottom 5 - with business context
{
  "type": "bar",
  "title": "Bottom 5 Campaigns by Sales",
  "description": "Underperformers needing optimization or budget reallocation - investigate or pause",
  "dataMapping": {
    "category": "Campaign Name",
    "values": ["7 Day Total Sales"],
    "aggregation": "sum",
    "sortBy": "7 Day Total Sales",
    "sortOrder": "asc",
    "limit": 5
  },
  "insight_level": "high",
  "answers_question": "Which campaigns should we optimize or pause?"
}

// Top with multiple metrics - with business context
{
  "type": "bar",
  "title": "Top 15 Campaigns: Reach vs Results",
  "description": "Compare top campaigns by both impressions (reach) and sales (results) to identify efficiency gaps",
  "dataMapping": {
    "category": "Campaign Name",
    "values": ["Impressions", "7 Day Total Sales"],
    "aggregation": "sum",
    "sortBy": "7 Day Total Sales",
    "sortOrder": "desc",
    "limit": 15
  },
  "insight_level": "high",
  "answers_question": "Which high-reach campaigns convert poorly?"
}

### BAR (for 3-12 category comparisons):
{
  "type": "bar",
  "title": "Campaign Performance: Reach vs Engagement",
  "description": "Compare each campaign's impressions (reach) and clicks (engagement) to identify low-converting campaigns",
  "dataMapping": {
    "category": "Campaign Name",
    "values": ["Impressions", "Clicks"],
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "Which campaigns have good reach but poor engagement?"
}

### COMBO (for time series with different scales - REQUIRED for multi-scale metrics):
{
  "type": "combo",
  "title": "Daily Performance Trends: Reach vs Engagement & Sales",
  "description": "Track how impressions (volume/reach) compares to clicks and sales (engagement/results) over time - identify momentum shifts and conversion patterns",
  "dataMapping": {
    "xAxis": "Start Date",
    "yAxis": ["Impressions"],
    "yAxis2": ["Clicks", "7 Day Total Sales"],
    "yAxis1Type": "bar",
    "yAxis2Type": "line",
    "yAxis1Label": "Impressions (Reach)",
    "yAxis2Label": "Clicks & Sales (Results)",
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "Are campaigns improving or declining over time? How does reach correlate with results?"
}

### PIE (3-5 slices max):
{
  "type": "pie",
  "title": "Sales Distribution by Country",
  "description": "Geographic breakdown showing which markets generate most revenue - focus expansion on high-performing regions",
  "dataMapping": {
    "category": "Country",
    "value": "7 Day Total Sales",
    "aggregation": "sum"
  },
  "insight_level": "medium",
  "answers_question": "Which geographic markets drive the most revenue?"
}

### SCATTER (MULTI-DIMENSIONAL ANALYSIS - ALWAYS use size AND color):
// Efficiency Analysis - with full business context
{
  "type": "scatter",
  "title": "Advertising Efficiency: Spend vs Sales by Campaign",
  "description": "Bubble size = Impressions (reach), Color = Campaign Name. Campaigns in upper-left quadrant (high sales, low spend) are most efficient. Outliers indicate opportunities for optimization.",
  "dataMapping": {
    "xAxis": "Spend",
    "yAxis": "7 Day Total Sales",
    "size": "Impressions",
    "color": "Campaign Name"
  },
  "insight_level": "high",
  "answers_question": "Which campaigns deliver best ROI? Which are overspending?"
}

// Performance Clustering - with full business context
{
  "type": "scatter",
  "title": "Click Performance: Reach vs Engagement",
  "description": "Bubble size = Spend (investment), Color = Country (market). Identifies high-impressions, low-click campaigns needing creative refresh.",
  "dataMapping": {
    "xAxis": "Impressions",
    "yAxis": "Clicks",
    "size": "Spend",
    "color": "Country"
  },
  "insight_level": "high",
  "answers_question": "Which campaigns/markets have good reach but poor click-through?"
}

### AREA (cumulative trends):
{
  "type": "area",
  "title": "Cumulative Campaign Reach Over Time",
  "description": "Stacked area showing how impressions and clicks accumulate over campaign lifecycle",
  "dataMapping": {
    "xAxis": "Start Date",
    "yAxis": ["Impressions", "Clicks"],
    "aggregation": "sum"
  },
  "insight_level": "medium",
  "answers_question": "How fast are we building audience reach?"
}

### TABLE (5-10 key columns):
{
  "type": "table",
  "title": "Detailed Campaign Metrics",
  "description": "Comprehensive view of all campaign data for detailed analysis and export",
  "dataMapping": {
    "columns": ["Campaign Name", "Impressions", "Clicks", "Spend", "7 Day Total Sales", "7 Day Total Orders (#)"]
  },
  "insight_level": "low",
  "answers_question": "What are the exact numbers for each campaign?"
}

### WATERFALL (sequential changes showing cumulative impact):
// Use for profit/loss breakdowns, budget changes, or step-by-step calculations
{
  "type": "waterfall",
  "title": "Campaign Cost Breakdown",
  "description": "Shows how different cost components (Media Spend, Creative Costs, Management Fees) build up to Total Campaign Cost. Green bars are increases, red bars are decreases.",
  "dataMapping": {
    "category": "Cost Component",
    "value": "Amount",
    "isTotal": "Is Total"  // Optional: marks final total bar
  },
  "insight_level": "medium",
  "answers_question": "How do individual cost elements contribute to total campaign spend?"
}

// Use case 2: Profit & Loss waterfall
{
  "type": "waterfall",
  "title": "Monthly Revenue to Profit Flow",
  "description": "Start with Total Revenue, subtract costs sequentially to arrive at Net Profit. Visualizes where money is being spent.",
  "dataMapping": {
    "category": "Line Item",  // E.g., "Revenue", "COGS", "Marketing", "Operating Expenses", "Net Profit"
    "value": "Amount"
  },
  "insight_level": "high",
  "answers_question": "What are the main drivers of our profitability?"
}

### DUAL Y-AXIS / COMBO CHARTS (when metrics have different scales or units):
// Reach (volume) + Engagement (rate) - with full context
{
  "type": "combo",
  "title": "Campaign Reach vs Engagement Rate",
  "description": "Bars show volume (Impressions), line shows engagement efficiency (Clicks). Identifies campaigns with high reach but low engagement needing creative optimization.",
  "dataMapping": {
    "xAxis": "Campaign Name",
    "yAxis": ["Impressions"],
    "yAxis2": ["Clicks"],
    "yAxis1Type": "bar",
    "yAxis2Type": "line",
    "yAxis1Label": "Impressions (Reach)",
    "yAxis2Label": "Clicks (Engagement)",
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "Which high-reach campaigns have low engagement?"
}

// Investment (cost) + Return (sales) - with full context
{
  "type": "combo",
  "title": "Campaign Investment vs Returns",
  "description": "Bars show ad spend (investment), line shows sales generated (returns). Campaigns where line exceeds bars are profitable.",
  "dataMapping": {
    "xAxis": "Campaign Name",
    "yAxis": ["Spend"],
    "yAxis2": ["7 Day Total Sales"],
    "yAxis1Type": "bar",
    "yAxis2Type": "line",
    "yAxis1Label": "Ad Spend ($)",
    "yAxis2Label": "Sales Revenue ($)",
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "Which campaigns are profitable vs loss-making?"
}

### FUNNEL (conversion stages with progressive drop-off):
{
  "type": "funnel",
  "title": "Sales Conversion Funnel",
  "description": "Visualize drop-off at each stage of the sales process - from leads to closed deals. Identifies bottlenecks needing attention.",
  "dataMapping": {
    "stage": "Sales Stage",  // Column with stage names (e.g., "Lead", "Qualified", "Proposal", "Closed")
    "value": "Count",         // Number of prospects at each stage
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "Where are we losing the most prospects in our sales process?"
}

// E-commerce funnel example
{
  "type": "funnel",
  "title": "User Journey Conversion Funnel",
  "description": "Track user drop-off from product view to purchase. Optimize steps with highest abandonment rates.",
  "dataMapping": {
    "stage": "Journey Step",   // "Product View", "Add to Cart", "Checkout", "Purchase"
    "value": "Users",
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "At which step are we losing the most customers?"
}

### HEATMAP (2D correlation matrix with color intensity):
{
  "type": "heatmap",
  "title": "Sales Performance by Day and Hour",
  "description": "Color intensity shows sales volume. Darker cells = higher sales. Identifies peak selling times for staffing and promotions.",
  "dataMapping": {
    "xAxis": "Hour of Day",
    "yAxis": "Day of Week",
    "value": "Sales",
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "When should we schedule promotions and staff for peak traffic?"
}

// Category correlation heatmap
{
  "type": "heatmap",
  "title": "Campaign Performance by Country and Product Category",
  "description": "Heat intensity reveals which product categories perform best in each market. Focus resources on hot zones.",
  "dataMapping": {
    "xAxis": "Product Category",
    "yAxis": "Country",
    "value": "Revenue",
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "Which product-market combinations are our winners?"
}

### GAUGE (performance vs target with visual zones):
{
  "type": "gauge",
  "title": "Monthly Sales Performance",
  "description": "Gauge shows actual sales vs monthly target. Red zone = below 80%, yellow = 80-100%, green = above target.",
  "dataMapping": {
    "metric": "Total Sales",
    "target": "Sales Target",
    "aggregation": "sum",
    "min": 0,
    "max": "Sales Target",  // Can reference a column or use static value
    "thresholds": [
      {"value": 0.8, "color": "red"},
      {"value": 1.0, "color": "yellow"},
      {"value": 1.2, "color": "green"}
    ]
  },
  "insight_level": "high",
  "answers_question": "Are we on track to hit our sales target?"
}

### COHORT (retention analysis over time):
{
  "type": "cohort",
  "title": "Customer Retention by Signup Cohort",
  "description": "Grid showing retention rates for each monthly cohort over time. Identifies cohort quality and retention trends.",
  "dataMapping": {
    "cohort": "Signup Month",      // Cohort identifier (when they signed up)
    "period": "Months Active",      // Time since signup
    "retention": "Retention Rate",  // % or count still active
    "aggregation": "avg"
  },
  "insight_level": "high",
  "answers_question": "Which signup cohorts have the best long-term retention?"
}

### BULLET (compact performance indicator with ranges):
{
  "type": "bullet",
  "title": "Quarterly Revenue Performance",
  "description": "Bullet chart showing actual revenue vs target with performance zones. Compact format ideal for dashboards.",
  "dataMapping": {
    "metric": "Actual Revenue",
    "target": "Target Revenue",
    "aggregation": "sum",
    "ranges": [
      {"label": "Poor", "value": 0.7},
      {"label": "Good", "value": 0.9},
      {"label": "Excellent", "value": 1.0}
    ]
  },
  "insight_level": "medium",
  "answers_question": "How do we compare to our quarterly targets?"
}

### TREEMAP (hierarchical proportions with nested rectangles):
{
  "type": "treemap",
  "title": "Revenue Distribution by Category and Subcategory",
  "description": "Rectangle size shows revenue proportion. Larger rectangles = higher revenue. Quickly spot top categories and subcategories.",
  "dataMapping": {
    "category": "Category",        // Parent level
    "parent": "Subcategory",       // Child level (optional for hierarchy)
    "value": "Revenue",
    "aggregation": "sum"
  },
  "insight_level": "medium",
  "answers_question": "Which categories and subcategories contribute most to revenue?"
}

// Flat treemap (no hierarchy)
{
  "type": "treemap",
  "title": "Market Share by Product",
  "description": "Visual representation of product portfolio. Rectangle size = market share or revenue.",
  "dataMapping": {
    "category": "Product Name",
    "value": "Market Share",
    "aggregation": "sum"
  },
  "insight_level": "medium",
  "answers_question": "What's our product portfolio composition?"
}

### SANKEY (flow diagram showing transitions):
{
  "type": "sankey",
  "title": "Traffic Source to Conversion Flow",
  "description": "Flow thickness shows volume. Visualizes customer journey from traffic source to conversion outcome. Identify most valuable channels.",
  "dataMapping": {
    "source": "Traffic Source",    // Starting node (e.g., "Google", "Facebook", "Direct")
    "target": "Landing Page",      // Ending node or intermediate step
    "flow": "Sessions",            // Flow volume
    "aggregation": "sum"
  },
  "insight_level": "high",
  "answers_question": "Which traffic sources drive the most valuable conversions?"
}

// Budget allocation flow
{
  "type": "sankey",
  "title": "Marketing Budget Allocation Flow",
  "description": "Visualize how marketing budget flows from channels to campaigns to outcomes.",
  "dataMapping": {
    "source": "Marketing Channel",
    "target": "Campaign Type",
    "flow": "Budget",
    "aggregation": "sum"
  },
  "insight_level": "medium",
  "answers_question": "How is our marketing budget distributed across channels and campaigns?"
}

### SPARKLINE (compact trend for tables and dashboards):
{
  "type": "sparkline",
  "title": "Daily Sales Trend (Compact)",
  "description": "Minimal line chart showing trend at a glance. Ideal for embedding in tables or dashboard tiles.",
  "dataMapping": {
    "xAxis": "Date",
    "yAxis": "Sales",
    "aggregation": "sum"
  },
  "insight_level": "low",
  "answers_question": "What's the recent sales trend?"
}

## RESPONSE FORMAT:
{
  "reasoning": {
    "domain": "What business domain is this?",
    "keyEntities": ["List", "Of", "Entities"],
    "businessProcess": "What process is tracked?"
  },
  "businessQuestions": [
    "Question 1 that stakeholders want answered",
    "Question 2...",
    "Question 3..."
  ],
  "insights": [
    "Key insight 1 from data analysis",
    "Key insight 2..."
  ],
  "chartConfig": [
    {
      "type": "scorecard",
      "title": "Total Ad Spend",
      "description": "Total investment across all campaigns - use to track budget utilization and spending pace",
      "insight_level": "high",
      "answers_question": "How much total budget have we invested in advertising?",
      "dataMapping": {"metric": "Spend", "aggregation": "sum"},
      "confidence": 95,
      "reasoning": "Critical executive KPI showing total advertising investment - helps track budget burn rate"
    },
    {
      "type": "scatter",
      "title": "Campaign Advertising Efficiency: Spend vs Sales",
      "description": "Bubble size = Impressions (reach), Color = Campaign Name. Campaigns in upper-left quadrant (high sales, low spend) are most efficient. Outliers indicate optimization opportunities.",
      "insight_level": "high",
      "answers_question": "Which campaigns deliver best ROI? Which are overspending for results?",
      "dataMapping": {
        "xAxis": "Spend",
        "yAxis": "7 Day Total Sales",
        "size": "Impressions",
        "color": "Campaign Name"
      },
      "confidence": 90,
      "reasoning": "Multi-dimensional efficiency analysis revealing ROI patterns and underperforming campaigns needing optimization"
    },
    {
      "type": "bar",
      "title": "Top 10 Campaigns by Revenue",
      "description": "Star performers generating the most sales - allocate more budget to these winners",
      "insight_level": "high",
      "answers_question": "Which campaigns should we invest more in to maximize returns?",
      "dataMapping": {
        "category": "Campaign Name",
        "values": ["7 Day Total Sales"],
        "aggregation": "sum",
        "sortBy": "7 Day Total Sales",
        "sortOrder": "desc",
        "limit": 10
      },
      "confidence": 95,
      "reasoning": "Identifies proven winners for budget reallocation decisions - focus on what works"
    }
  ],
  "summary": {
    "dataQuality": "good|fair|poor",
    "keyFindings": "Executive summary of main insights"
  }
}

⚠️ FINAL REMINDER - CRITICAL REQUIREMENTS:
- Every column name in chartConfig MUST exist in the AVAILABLE COLUMNS list
- To show efficiency or performance, use multiple existing columns in scatter or multi-series charts
- Verify column names match exactly (spelling, capitalization, spacing)

⚠️ CHART DIVERSITY & BUSINESS FRAMEWORK REQUIREMENT:
MANDATORY CHART MIX (aim for 7-10 visualizations total):
1. **EXECUTIVE SUMMARY**: 2-4 scorecards with DIFFERENT aggregations (sum, avg, count, min, max)
2. **SEGMENTATION**: 1-2 Top/Bottom X ranking charts (use sortBy + sortOrder + limit)
3. **RELATIONSHIPS**: 1-2 scatter plots with size AND color dimensions (show efficiency, correlations)
4. **TIME PATTERNS**: 1-2 line/combo/area charts if date/time columns exist (show trends, seasonality)
   - Use COMBO for multi-metric time series with scale ratio > 10x
5. **COMPARISONS**: 1-2 grouped/stacked bar charts (compare categories, show breakdowns)
6. **MULTI-SCALE**: MUST use combo charts when scale ratio > 10x (see MANDATORY SCALE DETECTION RULE)

THINK LIKE A BUSINESS ANALYST:
- What questions would an executive ask about this data?
- What patterns would reveal opportunities or problems?
- What comparisons would drive decision-making?
- What trends would indicate success or failure?

🎯 QUALITY CHECKLIST - EVERY CHART MUST HAVE:
✅ **Business-Focused Title**: Not "Spend vs Sales" but "Campaign Advertising Efficiency: Spend vs Sales"
✅ **Actionable Description**: Explain what to look for ("Campaigns in upper-left quadrant are most efficient")
✅ **Clear Business Question**: What decision does this chart support? ("Which campaigns should we invest more in?")
✅ **Reasoning**: Why is this chart valuable? What insight does it reveal?
✅ **High Confidence**: Only recommend charts you're confident will provide value (80%+ confidence)

❌ REJECT THESE LOW-QUALITY PATTERNS:
- Generic titles: "Total Impressions", "Campaign Comparison" (add business context!)
- Vague descriptions: "Shows data" (explain what patterns to look for!)
- No business question: Charts must answer specific stakeholder questions
- Single-dimensional thinking: Use scatter plots with size+color, not just X vs Y
- Missing insights: Every chart should reveal patterns, trends, or opportunities`

  if (dataStructure.dataSample && dataStructure.dataSample.length > 0) {
    prompt += `\n\n## SAMPLE DATA (for context):\n`
    dataStructure.dataSample.slice(0, 5).forEach((row: any, idx: number) => {
      prompt += `Row ${idx + 1}: ${JSON.stringify(row).slice(0, 200)}...\n`
    })
  }

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
        if (dm.metric) dataKey.push(dm.metric)
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

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  console.log('🔵 [API-ANALYZE] POST request received:', {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  })
  
  try {
    // Check API key - REQUIRED
    console.log('🔍 [API-ANALYZE] Checking OpenAI API key...')
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ [API-ANALYZE] OpenAI API key not configured')
      return NextResponse.json(
        {
          error: 'OpenAI API key not configured. Please add your API key to .env.local',
          details: 'Set OPENAI_API_KEY=your-key-here in .env.local file'
        },
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

    // Parse request body with enhanced interface
    console.log('🔵 [API-ANALYZE] Parsing request body...')
    const {
      data,
      schema,
      correctedSchema,
      feedback,
      fileName
    }: AnalyzeRequest = await request.json()
    
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

    // Build enhanced prompt with confidence scores and user corrections
      console.log('🔍 [API-ANALYZE] Building enhanced AI prompt with schema confidence:', {
        hasSchema: !!schema,
        hasCorrectedSchema: !!correctedSchema,
        correctedColumnsCount: correctedSchema?.length || 0,
        hasFeedback: !!feedback
      })

      const prompt = buildEnhancedPrompt(dataStructure, schema, correctedSchema, feedback)

      // Get OpenAI client and call API with timeout
      console.log('🔵 [API-ANALYZE] Initializing OpenAI client...')
      const openai = getOpenAIClient()
      console.log('✅ [API-ANALYZE] OpenAI client initialized')

      console.log('🚀 [API-ANALYZE] Making OpenAI API call...')
      const startTime = Date.now()

      // Add explicit timeout wrapper around OpenAI call with proper cleanup
      let timeoutId: NodeJS.Timeout | null = null

      const completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o", // Upgraded to GPT-4o for superior analytical reasoning
          messages: [
            {
              role: "system",
              content: `You are a senior data analyst with 10+ years of experience in business intelligence and data visualization strategy. You excel at identifying actionable insights and creating dashboards that drive business decisions.

## YOUR EXPERTISE:
- Deep understanding of business metrics across industries (advertising, e-commerce, SaaS, operations)
- Expert at understanding data relationships and patterns without creating calculated fields
- Master of visual design principles for maximum clarity and impact
- Skilled at asking the right questions to uncover valuable insights

## YOUR APPROACH (FRAMEWORK-DRIVEN ANALYSIS):
1. **Identify Business Domain**: Determine industry (advertising, e-commerce, operations, finance)
2. **Detect Data Patterns**: Look for time series, categorical hierarchies, numeric distributions, correlations
3. **Framework-Based Analysis**: Organize insights by business framework:
   - 📊 PERFORMANCE OVER TIME: Trends, patterns, seasonality (use line charts, area charts)
   - ⚖️ EFFICIENCY & PROFITABILITY: ROI, conversion rates, cost efficiency (use scatter plots, dual-axis)
   - 📈 FUNNELS: Conversion steps, drop-off analysis (use funnel charts for stage-based drop-off)
   - 📦 SEGMENTATION: Compare groups, identify winners/losers (use Top/Bottom X, grouped bars)
   - 💡 DISTRIBUTIONS: Outliers, ranges, variance (use scatter with size/color dimensions)
   - 🌍 GEOGRAPHIC/CATEGORICAL: Regional or category performance (use bars, pies, treemap for hierarchy)
   - 📌 EXECUTIVE SUMMARY: High-level KPIs with context (use scorecards, gauge for targets)
4. **Multi-Dimensional Thinking**: Use scatter plots with size/color, dual Y-axes, time breakdowns, heatmaps for 2D patterns
5. **Actionable Insights**: Every chart should answer "What action should we take?"

## BUSINESS LOGIC HEURISTICS - INTELLIGENT CHART SELECTION:

### DETECT WATERFALL OPPORTUNITIES:
- Column names contain: "variance", "change", "increase", "decrease", "delta", "difference"
- Financial data: "revenue", "profit", "expense", "cost" with breakdown components
- Sequential calculations: starting value → adjustments → final value
- P&L statements, budget variance, revenue bridges
→ **Recommend waterfall chart** showing cumulative impact of changes

### DETECT FUNNEL OPPORTUNITIES:
- Column names contain: "stage", "step", "phase", "level", "funnel"
- Progressive stages: "lead", "qualified", "proposal", "closed"
- E-commerce: "view", "add to cart", "checkout", "purchase"
- Values naturally decrease at each stage (conversion funnel pattern)
→ **Recommend funnel chart** showing drop-off between stages

### DETECT HEATMAP OPPORTUNITIES:
- Two categorical dimensions present (e.g., day of week + hour, country + product category)
- Time patterns: day × hour, month × category, week × region
- Correlation matrix: multiple categories vs multiple metrics
- Need to identify hot/cold zones in 2D space
→ **Recommend heatmap** showing intensity patterns across dimensions

### DETECT GAUGE/BULLET OPPORTUNITIES:
- Column pairs: "actual" + "target", "current" + "goal", "performance" + "quota"
- KPI tracking with thresholds
- Performance monitoring with target comparison
- Sales vs quota, completion vs goal
→ **Recommend gauge or bullet chart** for at-a-glance target tracking

### DETECT COHORT OPPORTUNITIES:
- Three dimensions present: cohort identifier + time period + metric
- Column names contain: "cohort", "signup date", "acquisition", "retention", "period"
- User/customer lifecycle analysis
- Retention rates over time by cohort
→ **Recommend cohort chart** showing retention grid

### DETECT TREEMAP OPPORTUNITIES:
- Hierarchical categories: parent-child relationships (category + subcategory)
- Part-to-whole with many components (>10 categories)
- Portfolio composition, market share breakdown
- Need to show relative sizes at a glance
→ **Recommend treemap** for hierarchical proportions

### DETECT SANKEY OPPORTUNITIES:
- Flow/journey data: source + destination + volume
- Column names contain: "source", "target", "from", "to", "channel", "path"
- Traffic flow, budget allocation, conversion paths
- Multi-step transitions between states
→ **Recommend sankey diagram** for flow visualization

### GENERAL BUSINESS DOMAIN PATTERNS:
- **E-commerce**: Likely has conversion funnels, product hierarchies (treemap), customer cohorts
- **Advertising**: Performance vs targets (gauge), campaign efficiency (scatter), geographic distribution (heatmap)
- **Finance**: P&L waterfalls, variance analysis (waterfall), budget allocation (sankey)
- **Operations**: Process stages (funnel), resource allocation (sankey), time patterns (heatmap)
- **SaaS**: User cohorts (cohort), conversion funnels (funnel), usage patterns (heatmap)

## CRITICAL REQUIREMENTS:
- Always respond with valid JSON in the EXACT format specified in the user prompt
- ONLY use column names listed in the "AVAILABLE COLUMNS" section
- Verify EVERY column name exists before using it (non-existent columns cause failures)
- Include your reasoning process to show analytical thinking
- Classify each visualization by insight level (high/medium/low)
- Every chart must answer a specific business question

## SCORECARD GENERATION - CRITICAL GUIDELINES:
- ALWAYS generate 2-4 scorecards for key business metrics (revenue, sales, orders, clicks, impressions, etc.)
- Use DIVERSE aggregations: sum (totals), avg (averages), count (totals), min (lowest), max (highest)
- Each scorecard must have a DIFFERENT aggregation type (don't repeat aggregations)
- Prioritize high-business-value metrics (revenue > vanity metrics)
- Examples: "Total Revenue" (sum), "Average Order Value" (avg), "Peak Sales Day" (max)
- Scorecards provide critical KPIs at-a-glance - they are HIGH priority visualizations

## TOP/BOTTOM X CHARTS - CRITICAL GUIDELINES:
- ALWAYS generate at least 1-2 "Top X" or "Bottom X" ranking charts
- Use sortBy to specify which column to sort by (must be a numeric column)
- Use sortOrder: "desc" for Top X (highest values), "asc" for Bottom X (lowest values)
- Use limit to control number of items (recommended: Top 10, Bottom 5, Top 15)
- Include both category and values fields in dataMapping
- Prioritize Top/Bottom charts for business-critical rankings (best/worst campaigns, products, regions)
- Examples: "Top 10 Campaigns by Revenue", "Bottom 5 Products by Sales"

## SCATTER PLOT MULTI-DIMENSIONAL ANALYSIS - CRITICAL GUIDELINES:
- Use scatter plots to show RELATIONSHIPS and EFFICIENCY (not just single metrics)
- ALWAYS include size and/or color dimensions when using scatter plots
- Common patterns:
  * Efficiency Analysis: X=Input (Spend, Cost), Y=Output (Revenue, Orders), Size=Volume, Color=Category
  * Correlation Analysis: X=Metric1, Y=Metric2, Size=Impact, Color=Segment
  * Performance Clustering: X=Efficiency%, Y=Volume, Size=Revenue, Color=Region
- Examples:
  * "Campaign Efficiency": X=Spend, Y=Revenue, Size=Orders, Color=Country
  * "Click Performance": X=Impressions, Y=Clicks, Size=Spend, Color=Campaign
  * "ROAS Analysis": X=Spend, Y=Sales, Size=Orders, Color=ACOS category

## TIME-SERIES ANALYSIS - CRITICAL GUIDELINES:
- When date/time columns exist, ALWAYS create time-series visualizations
- Use line charts for SINGLE METRIC or metrics with similar scales (ratio < 3x)
- Use COMBO charts for MULTIPLE METRICS with different scales (ratio > 10x)
- Use area charts for cumulative or volume-based time series
- ALWAYS check scale ratios before choosing chart type (see MANDATORY SCALE DETECTION RULE)
- Examples: "Impressions vs Clicks Over Time" (COMBO), "Daily Revenue Trend" (LINE)

## QUALITY STANDARDS:
- Focus on depth over breadth - fewer high-value charts beats many shallow ones
- Always compare across dimensions (time, segments, categories)
- Use existing columns to show relationships (e.g., scatter plot of Clicks vs Impressions)
- Prioritize actionable insights over simple aggregations
- Use visual best practices: limit complexity, choose appropriate chart types, emphasize key insights`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }).finally(() => {
          // Clear timeout when OpenAI completes
          if (timeoutId) clearTimeout(timeoutId)
        }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('OpenAI API call timed out after 180 seconds'))
          }, 180000)
        })
      ])

      // Cleanup timeout if still pending
      if (timeoutId) clearTimeout(timeoutId)

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
        // Parse OpenAI response - handle markdown code blocks
        console.log('🔵 [API-ANALYZE] Parsing OpenAI JSON response...')

        // Strip markdown code blocks if present
        let cleanResponse = response.trim()

        // Remove leading ```json or ``` with optional whitespace
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.slice(7) // Remove ```json
        } else if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.slice(3) // Remove ```
        }

        // Remove trailing ``` with optional whitespace
        if (cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(0, -3)
        }

        // Trim any remaining whitespace
        cleanResponse = cleanResponse.trim()

        console.log('🔍 [API-ANALYZE] Cleaned response preview:', {
          originalLength: response.length,
          cleanedLength: cleanResponse.length,
          hadMarkdown: response !== cleanResponse,
          preview: cleanResponse.substring(0, 100)
        })

        const aiAnalysis = JSON.parse(cleanResponse)
      
      // Log the number of charts generated (before filtering)
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

      // ========================================
      // VALIDATION - Filter out unsupported chart types
      // ========================================
      console.log('🔍 [VALIDATION] Filtering chart types...')
      const originalChartCount = aiAnalysis.chartConfig.length
      aiAnalysis.chartConfig = filterSupportedChartTypes(aiAnalysis.chartConfig)
      const filteredChartCount = aiAnalysis.chartConfig.length

      console.log('✅ [VALIDATION] Chart type filtering completed:', {
        original: originalChartCount,
        filtered: filteredChartCount,
        removed: originalChartCount - filteredChartCount
      })

      // ========================================
      // VALIDATION - Validate dataMapping against dataset columns
      // ========================================
      console.log('🔍 [VALIDATION] Validating data mappings...')
      const availableColumns = dataStructure.columns.map((col: any) => col.name)

      // Create a normalized column name map (trim spaces for fuzzy matching)
      const columnNameMap = new Map<string, string>()
      availableColumns.forEach((col: string) => {
        const normalized = col.trim()
        columnNameMap.set(normalized, col) // Map normalized -> actual
        columnNameMap.set(col, col) // Also keep exact match
      })

      // Helper function to find column (tries exact match, then trimmed match)
      const findColumn = (colName: string): string | null => {
        if (columnNameMap.has(colName)) return columnNameMap.get(colName)!
        const trimmed = colName.trim()
        if (columnNameMap.has(trimmed)) return columnNameMap.get(trimmed)!
        return null
      }

      const availableColumnsSet = new Set(availableColumns)

      let dataMappingValidationWarnings = 0
      let dataMappingValidationErrors = 0

      // Normalize all column names in chartConfig before validation
      console.log('🔧 [VALIDATION] Normalizing column names to match data (handling trailing spaces)...')
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
          console.log(`⚠️ [VALIDATION] Chart "${config.title}" missing dataMapping, attempting migration...`)

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
              // Scorecards require: metric + aggregation
              if (!dm.metric) {
                errors.push('Scorecard missing required "metric" field in dataMapping')
              } else if (!availableColumnsSet.has(dm.metric)) {
                invalidCols.push(dm.metric)
              }

              // Validate aggregation field
              if (!dm.aggregation) {
                errors.push('Scorecard missing required "aggregation" field in dataMapping')
              } else if (!['sum', 'avg', 'count', 'min', 'max', 'distinct'].includes(dm.aggregation)) {
                errors.push(`Invalid aggregation type: ${dm.aggregation}. Must be one of: sum, avg, count, min, max, distinct`)
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

            case 'funnel':
              // Funnel requires: stage + value
              if (!dm.stage) {
                errors.push('Funnel chart missing required "stage" field')
              } else if (!availableColumnsSet.has(dm.stage)) {
                invalidCols.push(dm.stage)
              }
              if (!dm.value) {
                errors.push('Funnel chart missing required "value" field')
              } else if (!availableColumnsSet.has(dm.value)) {
                invalidCols.push(dm.value)
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
              // Gauge requires: metric
              if (!dm.metric) {
                errors.push('Gauge chart missing required "metric" field')
              } else if (!availableColumnsSet.has(dm.metric)) {
                invalidCols.push(dm.metric)
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
          console.error(`❌ [VALIDATION] Chart "${config.title}" has errors:`, errors.join('; '))
          dataMappingValidationErrors++
          return false // Filter out charts with errors
        }

        if (warnings.length > 0) {
          console.warn(`⚠️ [VALIDATION] Chart "${config.title}" has warnings:`, warnings.join('; '))
          dataMappingValidationWarnings++
        }

        return true // Keep valid charts
      })

      console.log('✅ [VALIDATION] Data mapping validation completed:', {
        totalCharts: aiAnalysis.chartConfig.length,
        warningCount: dataMappingValidationWarnings,
        errorCount: dataMappingValidationErrors,
        availableColumns: availableColumns.length
      })

      // ========================================
      // CHART DIVERSITY VALIDATION
      // ========================================
      console.log('🔍 [VALIDATION] Checking chart type diversity...')
      const scorecardCount = aiAnalysis.chartConfig.filter((c: any) => c.type === 'scorecard').length
      const topBottomCount = aiAnalysis.chartConfig.filter((c: any) =>
        c.type === 'bar' && c.dataMapping?.sortBy && c.dataMapping?.limit
      ).length
      const comboCount = aiAnalysis.chartConfig.filter((c: any) => c.type === 'combo').length

      console.log('📊 [VALIDATION] Chart diversity breakdown:', {
        scorecards: scorecardCount,
        topBottomCharts: topBottomCount,
        comboCharts: comboCount,
        otherCharts: aiAnalysis.chartConfig.length - scorecardCount - comboCount,
        total: aiAnalysis.chartConfig.length
      })

      if (scorecardCount === 0) {
        console.warn('⚠️ [VALIDATION] No scorecards generated - AI should generate 2-4 scorecards per analysis')
      }
      if (topBottomCount === 0) {
        console.warn('⚠️ [VALIDATION] No Top/Bottom X charts generated - AI should generate ranking charts when appropriate')
      }

      // Ensure we still have enough recommendations after filtering
      if (aiAnalysis.chartConfig.length < 4) {
        console.warn('⚠️ [VALIDATION] Too few charts after filtering:', {
          count: aiAnalysis.chartConfig.length,
          minimum: 4
        })
        // Note: We continue with what we have rather than failing
      }

      // ========================================
      // SCORING INTEGRATION - Score and rank all recommendations
      // ========================================
      console.log('🎯 [API-ANALYZE] Starting recommendation scoring...')

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

        console.log('✅ [API-ANALYZE] Recommendation scoring completed:', {
          totalRecommendations: scoredRecommendations.length,
          avgQualityScore: Math.round(avgQualityScore),
          highQuality: highQualityCount,
          mediumQuality: mediumQualityCount,
          lowQuality: lowQualityCount,
          withUserCorrections: recommendationsWithCorrections,
          topScore: scoredRecommendations[0]?.qualityScore || 0,
          lowestScore: scoredRecommendations[scoredRecommendations.length - 1]?.qualityScore || 0
        })

      } catch (scoringError) {
        console.error('⚠️ [API-ANALYZE] Scoring failed, continuing without scores:', {
          error: scoringError instanceof Error ? scoringError.message : 'Unknown error',
          stack: scoringError instanceof Error ? scoringError.stack : undefined
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
      
      // Log enhanced analysis details for debugging
      const totalDuration = Date.now() - requestStartTime
      console.log('✅ [API-ANALYZE] Enhanced analysis completed successfully:', {
        dataContext: aiAnalysis.dataContext,
        keyQuestions: aiAnalysis.keyQuestions,
        totalVisualizations: aiAnalysis.chartConfig?.length || 0,
        scorecards: aiAnalysis.chartConfig?.filter((c: any) => c.type === 'scorecard').length || 0,
        charts: aiAnalysis.chartConfig?.filter((c: any) => c.type !== 'scorecard').length || 0,
        userCorrections: correctedColumnNames.length,
        correctedColumns: correctedColumnNames,
        hasFeedback: !!feedback,
        averageConfidence: Math.round(
          aiAnalysis.chartConfig.reduce((acc: number, c: any) => acc + (c.confidence || 85), 0) /
          aiAnalysis.chartConfig.length
        ),
        totalRequestDuration: totalDuration + 'ms',
        openaiDuration: openaiDuration + 'ms',
        timestamp: new Date().toISOString()
      })

        // CRITICAL LOGGING: Log EXACT response being returned to frontend
        console.log('🚀 [API-ANALYZE] ===== RESPONSE TO FRONTEND =====')
        console.log('📊 [API-ANALYZE] analysisResult.chartConfig.length:', analysisResult.chartConfig.length)
        console.log('📊 [API-ANALYZE] Chart titles being sent:', analysisResult.chartConfig.map((c: any) => c.title))
        console.log('📊 [API-ANALYZE] Chart types being sent:', analysisResult.chartConfig.map((c: any) => c.type))
        console.log('📊 [API-ANALYZE] Full chartConfig structure:', JSON.stringify(analysisResult.chartConfig.map((c: any) => ({
          title: c.title,
          type: c.type,
          hasDataMapping: !!c.dataMapping,
          dataMapping: c.dataMapping,
          hasDataKey: !!c.dataKey,
          dataKey: c.dataKey
        })), null, 2))
        console.log('🚀 [API-ANALYZE] ===== END RESPONSE =====')

        return NextResponse.json(analysisResult)

      } catch (parseError) {
        console.error('❌ [API-ANALYZE] Error parsing OpenAI response:', {
          error: parseError,
          message: parseError instanceof Error ? parseError.message : 'Unknown error',
          responseLength: response?.length,
          responsePreview: response?.substring(0, 200)
        })
        console.error('❌ [API-ANALYZE] Raw response:', response)

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


// Fallback function removed - OpenAI API key is now required