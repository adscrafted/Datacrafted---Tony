# AI Chat System - Prompt Engineering Best Practices

## Prompt Library

This document contains tested prompt templates and best practices for the AI chat system.

---

## 1. System Prompts by Use Case

### 1.1 General Data Analysis (Default)

```typescript
const GENERAL_ANALYST_PROMPT = `You are an expert data analyst assistant. Your role is to help users understand their data through natural language conversation.

CAPABILITIES:
- Answer questions about data patterns, trends, and distributions
- Recommend appropriate visualizations
- Identify anomalies and outliers
- Provide actionable business insights
- Generate SQL-like data transformations

RESPONSE GUIDELINES:
1. Be direct and concise (2-3 sentences for answers)
2. Always reference specific data values and column names
3. Highlight surprising or noteworthy findings
4. Suggest follow-up questions to deepen analysis
5. Recommend visualizations in structured JSON format

TONE: Professional, helpful, and insightful. Avoid jargon unless the user demonstrates expertise.

When recommending charts, ALWAYS use this exact JSON format within code blocks:
\`\`\`json
{
  "id": "unique_id",
  "type": "line|bar|pie|scatter|table|scorecard|area",
  "title": "Specific, actionable title",
  "description": "What insight this chart reveals",
  "confidence": 0.0-1.0,
  "reasoning": "Why this is the best visualization",
  "chartConfig": {
    "xAxis": "column_name",
    "yAxis": ["metric1", "metric2"]
  },
  "priority": "high|medium|low",
  "tags": ["relevant", "tags"]
}
\`\`\`
`
```

---

### 1.2 Marketing Analytics Specialist

```typescript
const MARKETING_ANALYST_PROMPT = `You are a marketing analytics expert helping users optimize their campaigns.

EXPERTISE:
- Campaign performance analysis (CTR, CPC, ROAS, CAC)
- Customer segmentation and cohort analysis
- Funnel optimization and conversion rate analysis
- A/B test result interpretation
- Attribution modeling insights

MARKETING-SPECIFIC PATTERNS TO RECOGNIZE:
- ROAS (Return on Ad Spend) = Revenue / Ad Spend
- CTR (Click-Through Rate) = Clicks / Impressions
- CPC (Cost Per Click) = Spend / Clicks
- Conversion Rate = Conversions / Clicks
- CAC (Customer Acquisition Cost) = Total Marketing Spend / New Customers

RESPONSE APPROACH:
1. Frame insights in terms of ROI and business impact
2. Compare performance against industry benchmarks when possible
3. Identify underperforming campaigns/segments for optimization
4. Suggest actionable next steps (e.g., "Pause Campaign X", "Increase budget for Segment Y")
5. Highlight seasonal trends and timing opportunities

When analyzing marketing data:
- Flag ROAS < 1.0 as unprofitable
- Identify CTR outliers (>2% is excellent, <0.5% needs attention)
- Point out CPC trends (rising CPC = increasing competition)
- Celebrate conversion rate improvements
`
```

---

### 1.3 E-commerce Analytics Specialist

```typescript
const ECOMMERCE_ANALYST_PROMPT = `You are an e-commerce analytics specialist focused on revenue optimization.

EXPERTISE:
- Product performance and inventory analysis
- Customer lifetime value (CLV) calculation
- Shopping cart and checkout funnel analysis
- Price elasticity and discount impact
- Customer retention and churn prediction

KEY METRICS:
- AOV (Average Order Value) = Total Revenue / Number of Orders
- Cart Abandonment Rate = Abandoned Carts / Total Carts
- Repeat Purchase Rate = Repeat Customers / Total Customers
- Product Return Rate = Returns / Total Orders
- Revenue Per Visitor (RPV) = Total Revenue / Total Visitors

ANALYSIS PRIORITIES:
1. Identify high-value products and categories
2. Flag inventory issues (low stock on bestsellers, overstock on slow movers)
3. Analyze discount effectiveness (is margin sacrifice worth the volume?)
4. Track customer cohort behavior
5. Recommend upsell/cross-sell opportunities

VISUALIZATION PREFERENCES:
- Product rankings: Bar charts or tables
- Time-based trends: Line charts
- Category breakdown: Pie charts (if <7 categories) or treemaps
- Cohort analysis: Heatmaps
- Price sensitivity: Scatter plots
`
```

---

### 1.4 Financial Analytics Specialist

```typescript
const FINANCIAL_ANALYST_PROMPT = `You are a financial data analyst expert helping users understand financial performance.

EXPERTISE:
- P&L (Profit & Loss) analysis
- Cash flow analysis
- Budget vs. actual variance analysis
- Financial ratio calculation and interpretation
- Trend analysis and forecasting

KEY FINANCIAL METRICS:
- Gross Margin = (Revenue - COGS) / Revenue
- Operating Margin = Operating Income / Revenue
- Net Profit Margin = Net Income / Revenue
- Current Ratio = Current Assets / Current Liabilities
- Burn Rate = Monthly Cash Outflow

ANALYSIS APPROACH:
1. Calculate and interpret standard financial ratios
2. Flag negative trends early (declining margins, increasing costs)
3. Compare actuals vs. budget and explain variances
4. Identify cost drivers and revenue opportunities
5. Assess financial health and runway

CRITICAL ALERTS:
- Negative cash flow
- Margins below 20% (for SaaS) or 40% (for software)
- Budget variances > 10%
- Unusual expense spikes

VISUALIZATION BEST PRACTICES:
- Use waterfall charts for variance analysis
- Line charts for trend analysis
- Combo charts for comparing actuals vs. budget
- Gauges for key financial ratios
`
```

---

## 2. Prompt Templates for Common Questions

### 2.1 Trend Analysis

```typescript
const TREND_ANALYSIS_TEMPLATE = {
  userIntent: "Analyze trends over time",

  systemPrompt: `The user wants to understand how {metric} has changed over {timeColumn}.

DATA CONTEXT:
- Time range: {dateRange}
- Granularity: {granularity}
- Row count: {rowCount}

ANALYSIS CHECKLIST:
1. Calculate trend direction (up/down/flat)
2. Identify peak and trough periods
3. Detect seasonal patterns if applicable
4. Calculate growth rate (YoY, MoM, or period-over-period)
5. Flag anomalies (values >2 std deviations from mean)

VISUALIZATION RECOMMENDATION:
- Primary: Line chart with {metric} on Y-axis, {timeColumn} on X-axis
- Optional: Add trend line or moving average
- If multiple metrics: Use combo chart or dual-axis line chart

INSIGHTS TO PROVIDE:
- Overall trend direction with % change
- Best and worst performing periods
- Any notable inflection points
- Forecast or projection if sufficient data
`,

  exampleQueries: [
    "How have sales trended over the past 6 months?",
    "Show me the trend of website traffic over time",
    "What's the growth rate of revenue by month?"
  ]
}
```

---

### 2.2 Comparison Analysis

```typescript
const COMPARISON_TEMPLATE = {
  userIntent: "Compare values across categories",

  systemPrompt: `The user wants to compare {metric} across different {dimension}.

DATA CONTEXT:
- Number of categories: {categoryCount}
- Categories: {categoryList}
- Metric type: {metricType} (currency/count/percentage)

ANALYSIS CHECKLIST:
1. Rank categories by {metric} (descending)
2. Calculate each category's share of total
3. Identify top 3 and bottom 3 performers
4. Calculate average {metric} across all categories
5. Flag outliers (categories significantly above/below average)

VISUALIZATION RECOMMENDATION:
- If categories <= 10: Horizontal bar chart (sorted by metric)
- If categories > 10: Show top 10 + "Others" category
- Alternative: Table with sorting, filtering, highlighting

INSIGHTS TO PROVIDE:
- Top performer with its metric value and % of total
- Bottom performer with improvement potential
- Middle performers that could be optimized
- Pareto principle check (do top 20% account for 80%?)
`,

  exampleQueries: [
    "Which product categories generate the most revenue?",
    "Compare conversion rates across different campaigns",
    "What are the top 10 customers by sales?"
  ]
}
```

---

### 2.3 Correlation Analysis

```typescript
const CORRELATION_TEMPLATE = {
  userIntent: "Analyze relationship between two metrics",

  systemPrompt: `The user wants to understand the relationship between {metric1} and {metric2}.

DATA CONTEXT:
- Data points: {rowCount}
- {metric1} range: {metric1Range}
- {metric2} range: {metric2Range}

ANALYSIS CHECKLIST:
1. Calculate correlation coefficient (Pearson's r)
2. Determine relationship strength:
   - |r| > 0.7: Strong correlation
   - 0.4 < |r| <= 0.7: Moderate correlation
   - |r| <= 0.4: Weak correlation
3. Identify outliers that may skew correlation
4. Check for non-linear patterns
5. Consider causation vs. correlation disclaimer

VISUALIZATION RECOMMENDATION:
- Primary: Scatter plot with {metric1} on X-axis, {metric2} on Y-axis
- Add: Regression line with R² value
- Color code: By category if available
- Size encode: Third dimension if relevant

INSIGHTS TO PROVIDE:
- Correlation strength and direction
- Real-world interpretation (what does this mean for the business?)
- Outlier identification
- Actionable recommendations based on relationship
- Caveat about correlation ≠ causation
`,

  exampleQueries: [
    "Is there a relationship between ad spend and conversions?",
    "How does price correlate with sales volume?",
    "Do higher engagement rates lead to more revenue?"
  ]
}
```

---

### 2.4 Anomaly Detection

```typescript
const ANOMALY_DETECTION_TEMPLATE = {
  userIntent: "Find unusual patterns or outliers",

  systemPrompt: `The user wants to identify anomalies in {metric}.

DATA CONTEXT:
- Metric: {metric}
- Normal range: {mean} ± {stdDev}
- Total data points: {rowCount}

ANALYSIS CHECKLIST:
1. Calculate mean and standard deviation
2. Identify outliers (values > mean + 2*σ or < mean - 2*σ)
3. Check for temporal anomalies (unusual spikes/drops)
4. Detect pattern breaks (sudden trend changes)
5. Assess severity of each anomaly

ANOMALY SCORING:
- Critical: >3σ from mean OR >50% deviation from recent average
- Warning: 2-3σ from mean OR 25-50% deviation
- Notable: 1.5-2σ from mean OR 10-25% deviation

VISUALIZATION RECOMMENDATION:
- Scatter plot with anomalies highlighted in red
- Line chart with confidence interval bands
- Table of top 10 anomalies with severity score

INSIGHTS TO PROVIDE:
- Number and severity of anomalies detected
- Specific examples with context (dates, values, % deviation)
- Potential causes to investigate
- Impact assessment (revenue, users, performance)
- Recommended actions
`,

  exampleQueries: [
    "Are there any unusual spikes in website traffic?",
    "Find products with abnormal return rates",
    "Detect any anomalies in daily revenue"
  ]
}
```

---

## 3. Chart Suggestion Best Practices

### 3.1 Chart Type Decision Tree

```typescript
function selectChartType(context: {
  questionType: 'trend' | 'comparison' | 'distribution' | 'correlation' | 'composition'
  numericColumns: number
  categoricalColumns: number
  dateColumns: number
  rowCount: number
}): ChartType {

  // TREND ANALYSIS (time-based)
  if (context.dateColumns > 0 && context.numericColumns > 0) {
    if (context.numericColumns === 1) return 'line'
    if (context.numericColumns === 2) return 'combo'  // dual-axis
    return 'area'  // stacked area for multiple metrics
  }

  // COMPARISON (categorical vs numeric)
  if (context.categoricalColumns > 0 && context.numericColumns > 0) {
    const uniqueCategories = estimateUniqueCategories()

    if (uniqueCategories <= 5) return 'bar'
    if (uniqueCategories <= 10) return 'bar'  // horizontal
    if (uniqueCategories <= 20) return 'table'  // with sorting
    return 'table'  // with pagination
  }

  // DISTRIBUTION (single categorical)
  if (context.categoricalColumns === 1 && context.numericColumns === 1) {
    const uniqueCategories = estimateUniqueCategories()

    if (uniqueCategories <= 7) return 'pie'
    if (uniqueCategories <= 15) return 'bar'
    return 'treemap'
  }

  // CORRELATION (two numeric)
  if (context.numericColumns >= 2 && context.categoricalColumns === 0) {
    return 'scatter'
  }

  // SINGLE VALUE (KPI)
  if (context.numericColumns === 1 && context.rowCount === 1) {
    return 'scorecard'
  }

  // DETAILED DATA
  if (context.rowCount > 50) {
    return 'table'
  }

  // DEFAULT
  return 'table'
}
```

---

### 3.2 Chart Configuration Examples

#### Line Chart (Time Series)
```json
{
  "id": "trend_sales_2024",
  "type": "line",
  "title": "Monthly Sales Trend (2024)",
  "description": "Sales show 23% growth over the past 6 months",
  "confidence": 0.92,
  "reasoning": "Time series data with clear trend - line chart is optimal",
  "chartConfig": {
    "xAxis": "order_date",
    "yAxis": ["total_sales"],
    "aggregation": "sum"
  },
  "dataTransform": {
    "filter": [
      { "column": "order_date", "operator": "greater_than", "value": "2024-01-01" }
    ],
    "groupBy": ["order_date"],
    "aggregations": [
      { "column": "total_sales", "function": "sum", "alias": "monthly_sales" }
    ],
    "orderBy": [{ "column": "order_date", "direction": "asc" }]
  },
  "priority": "high",
  "tags": ["trends", "revenue", "growth"]
}
```

#### Bar Chart (Comparison)
```json
{
  "id": "top_products_revenue",
  "type": "bar",
  "title": "Top 10 Products by Revenue",
  "description": "Product A generates 34% of total revenue - clear market leader",
  "confidence": 0.88,
  "reasoning": "Categorical comparison with clear ranking - bar chart best shows relative performance",
  "chartConfig": {
    "xAxis": "product_name",
    "yAxis": ["revenue"],
    "aggregation": "sum"
  },
  "dataTransform": {
    "groupBy": ["product_name"],
    "aggregations": [
      { "column": "revenue", "function": "sum", "alias": "total_revenue" }
    ],
    "orderBy": [{ "column": "total_revenue", "direction": "desc" }],
    "limit": 10
  },
  "priority": "high",
  "tags": ["products", "revenue", "ranking"]
}
```

#### Scatter Plot (Correlation)
```json
{
  "id": "price_volume_correlation",
  "type": "scatter",
  "title": "Price vs. Sales Volume Correlation",
  "description": "Moderate negative correlation (r=-0.62) - higher prices correlate with lower volume",
  "confidence": 0.75,
  "reasoning": "Two numeric variables - scatter plot reveals correlation and outliers",
  "chartConfig": {
    "xAxis": "unit_price",
    "yAxis": ["units_sold"],
    "size": "total_revenue",
    "color": "product_category"
  },
  "dataTransform": {
    "columns": [
      {
        "name": "total_revenue",
        "expression": "unit_price * units_sold",
        "alias": "total_revenue"
      }
    ]
  },
  "priority": "medium",
  "tags": ["correlation", "pricing", "volume"]
}
```

#### Table (Detailed Data)
```json
{
  "id": "high_acos_campaigns",
  "type": "table",
  "title": "Campaigns with ACOS > 50% (Needs Optimization)",
  "description": "12 campaigns identified with poor efficiency - recommend pausing or adjusting",
  "confidence": 0.95,
  "reasoning": "Multiple dimensions with filtering and sorting - table provides actionable detail",
  "tableConfig": {
    "columns": [
      { "key": "campaign_name", "label": "Campaign", "type": "text", "sortable": true },
      { "key": "spend", "label": "Spend", "type": "currency", "format": "$0,0.00", "sortable": true },
      { "key": "revenue", "label": "Revenue", "type": "currency", "format": "$0,0.00", "sortable": true },
      { "key": "acos", "label": "ACOS", "type": "percentage", "format": "0.0%", "sortable": true },
      { "key": "impressions", "label": "Impressions", "type": "number", "format": "0,0", "sortable": true }
    ],
    "sortBy": "acos",
    "sortOrder": "desc",
    "pagination": true,
    "pageSize": 10
  },
  "dataTransform": {
    "filter": [
      { "column": "acos", "operator": "greater_than", "value": 0.5 }
    ],
    "orderBy": [{ "column": "spend", "direction": "desc" }]
  },
  "priority": "high",
  "tags": ["campaigns", "optimization", "acos", "inefficiency"]
}
```

---

## 4. Context Optimization Strategies

### 4.1 Smart Column Selection

```typescript
function selectRelevantColumns(
  query: string,
  allColumns: ColumnSchema[]
): ColumnSchema[] {

  const queryLower = query.toLowerCase()
  const relevantColumns: ColumnSchema[] = []

  // 1. Explicitly mentioned columns (highest priority)
  allColumns.forEach(col => {
    if (queryLower.includes(col.name.toLowerCase())) {
      relevantColumns.push(col)
    }
  })

  // 2. If no explicit mentions, use heuristics
  if (relevantColumns.length === 0) {

    // Trend questions -> date + numeric columns
    if (queryLower.match(/trend|over time|growth|change/)) {
      const dateCol = allColumns.find(c => c.type === 'date')
      const numericCols = allColumns.filter(c => c.type === 'number').slice(0, 3)

      if (dateCol) relevantColumns.push(dateCol)
      relevantColumns.push(...numericCols)
    }

    // Comparison questions -> categorical + numeric
    else if (queryLower.match(/compare|best|worst|top|bottom/)) {
      const categoricalCol = allColumns.find(c =>
        c.type === 'categorical' || (c.type === 'string' && c.uniqueValues < 50)
      )
      const numericCols = allColumns.filter(c => c.type === 'number').slice(0, 2)

      if (categoricalCol) relevantColumns.push(categoricalCol)
      relevantColumns.push(...numericCols)
    }

    // Correlation questions -> numeric columns
    else if (queryLower.match(/correlat|relationship|impact|affect/)) {
      const numericCols = allColumns.filter(c => c.type === 'number').slice(0, 3)
      relevantColumns.push(...numericCols)
    }

    // Default: all key metrics (numeric) + first categorical
    else {
      const numericCols = allColumns.filter(c => c.type === 'number').slice(0, 4)
      const categoricalCol = allColumns.find(c => c.type === 'categorical')

      relevantColumns.push(...numericCols)
      if (categoricalCol) relevantColumns.push(categoricalCol)
    }
  }

  return relevantColumns.length > 0 ? relevantColumns : allColumns.slice(0, 5)
}
```

---

### 4.2 Data Sampling Strategy

```typescript
function sampleDataForQuery(
  data: DataRow[],
  query: string,
  maxRows: number = 1000
): DataRow[] {

  // Small dataset - use all data
  if (data.length <= maxRows) {
    return data
  }

  const queryLower = query.toLowerCase()

  // Trend analysis - sample evenly across time range
  if (queryLower.match(/trend|over time|timeline/)) {
    return evenSample(data, maxRows)
  }

  // Comparison - ensure all categories represented
  else if (queryLower.match(/compare|top|bottom/)) {
    return stratifiedSample(data, maxRows)
  }

  // Anomaly detection - keep outliers
  else if (queryLower.match(/anomal|unusual|outlier/)) {
    return outlierPreservingSample(data, maxRows)
  }

  // Default - random sample
  return randomSample(data, maxRows)
}

function evenSample(data: DataRow[], n: number): DataRow[] {
  const step = Math.floor(data.length / n)
  return data.filter((_, index) => index % step === 0).slice(0, n)
}

function stratifiedSample(data: DataRow[], n: number): DataRow[] {
  // Group by first categorical column, sample proportionally
  // Implementation depends on data structure
  return data.slice(0, n)  // Simplified
}

function randomSample(data: DataRow[], n: number): DataRow[] {
  const shuffled = [...data].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}
```

---

## 5. Error Handling & Edge Cases

### 5.1 Handling Insufficient Data

```typescript
const INSUFFICIENT_DATA_RESPONSE = `I don't have enough data to provide a meaningful analysis for "{query}".

ISSUE: {reason}

WHAT I NEED:
- {requirement1}
- {requirement2}

SUGGESTED NEXT STEPS:
1. {suggestion1}
2. {suggestion2}

Alternatively, I can help you with:
- {alternative1}
- {alternative2}
`

// Example usage
if (numericColumns.length === 0) {
  return formatResponse(INSUFFICIENT_DATA_RESPONSE, {
    query: userQuery,
    reason: "No numeric columns found in the dataset",
    requirement1: "At least one numeric column (e.g., sales, revenue, count)",
    requirement2: "Data with measurable values",
    suggestion1: "Check if your data upload was successful",
    suggestion2: "Verify that numeric columns aren't being treated as text",
    alternative1: "Exploring the data structure and column types",
    alternative2: "Analyzing categorical distributions"
  })
}
```

---

### 5.2 Handling Ambiguous Questions

```typescript
const CLARIFICATION_PROMPT = `I want to help you analyze "{query}", but I need a bit more information.

POSSIBLE INTERPRETATIONS:
1. {interpretation1}
2. {interpretation2}
3. {interpretation3}

Please clarify:
- {clarifyingQuestion1}
- {clarifyingQuestion2}

Or choose one of the above options (1, 2, or 3).
`

// Example
if (isAmbiguous(query)) {
  return formatResponse(CLARIFICATION_PROMPT, {
    query: userQuery,
    interpretation1: "Total sales across all products",
    interpretation2: "Sales breakdown by product category",
    interpretation3: "Top 10 products by sales volume",
    clarifyingQuestion1: "Which specific metric are you interested in?",
    clarifyingQuestion2: "Would you like to see a total, breakdown, or ranking?"
  })
}
```

---

## 6. Performance Optimization Tips

### 6.1 Prompt Compression

```typescript
// Instead of sending full data samples
const VERBOSE_PROMPT = `
Here are 100 sample rows:
${JSON.stringify(data.slice(0, 100), null, 2)}
`  // ~20,000 tokens

// Send statistical summary
const COMPRESSED_PROMPT = `
Data Summary (1M rows):
- revenue: $45M total, avg $45, range $0-$5000
- products: 1200 unique, top 3: A (23%), B (18%), C (14%)
- dates: 2024-01-01 to 2024-12-31 (365 days)
`  // ~100 tokens
```

### 6.2 Caching Strategies

```typescript
// Cache data summaries by session
const dataContextCache = new Map<string, DataContext>()

function getCachedDataContext(sessionId: string): DataContext | null {
  const cached = dataContextCache.get(sessionId)
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.data
  }
  return null
}

// Cache common query responses (careful with this)
const responseCache = new Map<string, { response: string, timestamp: number }>()

function getCachedResponse(queryHash: string): string | null {
  const cached = responseCache.get(queryHash)
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.response
  }
  return null
}
```

---

## 7. Testing Your Prompts

### Test Cases

```typescript
const TEST_QUERIES = [
  // Trend analysis
  {
    query: "How have sales changed over time?",
    expectedChartType: 'line',
    expectedInsights: ['trend direction', 'growth rate', 'peak period']
  },

  // Comparison
  {
    query: "Which products sell the most?",
    expectedChartType: 'bar',
    expectedInsights: ['top performer', 'bottom performer', 'market share']
  },

  // Correlation
  {
    query: "Does price affect sales volume?",
    expectedChartType: 'scatter',
    expectedInsights: ['correlation coefficient', 'relationship strength', 'outliers']
  },

  // Anomaly
  {
    query: "Find unusual spikes in website traffic",
    expectedChartType: 'scatter',  // or line with highlights
    expectedInsights: ['anomaly count', 'severity', 'potential causes']
  },

  // Optimization
  {
    query: "Which campaigns have high spend but low conversions?",
    expectedChartType: 'table',
    expectedInsights: ['inefficient campaigns', 'wasted budget', 'recommendations']
  }
]

// Run tests
TEST_QUERIES.forEach(test => {
  const response = chatService.analyzeQuery(test.query, sampleData, dataContext, [])

  assert(response.suggestions.some(s => s.type === test.expectedChartType))
  test.expectedInsights.forEach(insight => {
    assert(response.content.toLowerCase().includes(insight.toLowerCase()))
  })
})
```

---

## 8. Monitoring & Improvement

### Metrics to Track

```typescript
interface ChatMetrics {
  // Quality metrics
  averageConfidence: number        // Avg confidence of suggestions
  suggestionAcceptanceRate: number // % of suggestions applied to dashboard
  conversationLength: number        // Avg messages per session

  // Performance metrics
  averageResponseTime: number       // ms
  tokenUsagePerQuery: number        // tokens
  cacheHitRate: number              // %

  // User satisfaction
  thumbsUpRate: number              // % of positive feedback
  retryRate: number                 // % of queries rephrased
  abandonmentRate: number           // % of sessions ending without action
}
```

### Continuous Improvement

```typescript
// Log queries with low confidence for review
if (response.suggestions.every(s => s.confidence < 0.6)) {
  await logLowConfidenceQuery({
    query: userQuery,
    dataContext: dataContext.fileName,
    suggestions: response.suggestions,
    timestamp: new Date()
  })
}

// A/B test prompt variations
const promptVariant = selectPromptVariant(sessionId)
const response = await chatService.analyzeQuery(
  query,
  data,
  dataContext,
  history,
  { promptVariant }
)

// Track which variant performs better
trackPromptPerformance(promptVariant, {
  confidence: avgConfidence(response.suggestions),
  acceptanceRate: /* track later */,
  responseTime: Date.now() - startTime
})
```

---

## Conclusion

Effective prompt engineering is crucial for a high-quality chat experience. Key takeaways:

1. **Be specific** in system prompts about expected output format
2. **Provide context** efficiently using summaries instead of raw data
3. **Test thoroughly** with diverse query types
4. **Monitor and iterate** based on user feedback and metrics
5. **Optimize for performance** by caching and compressing where possible

For implementation details, see `CHAT_BACKEND_ARCHITECTURE.md` and `CHAT_IMPLEMENTATION_GUIDE.md`.
