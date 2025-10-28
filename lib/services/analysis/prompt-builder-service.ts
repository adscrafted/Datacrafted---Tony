/**
 * Prompt Builder Service
 * Handles AI prompt construction for data analysis
 */

import type { DataRow, DataSchema } from '@/lib/store'
import type { DataContext, BusinessDomain } from './schema-service'
import type { SupportedChartType } from './chart-recommendation-service'

const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.log(...args)
  },
  info: console.log,
  warn: console.warn,
  error: console.error
}

export interface PromptConfig {
  data: DataRow[]
  schema: DataSchema
  dataContext: DataContext
  businessDomain: BusinessDomain
  userFeedback?: string
  fileName?: string
}

export class PromptBuilderService {
  /**
   * Build enhanced prompt for OpenAI analysis
   */
  buildAnalysisPrompt(config: PromptConfig): string {
    const {
      data,
      schema,
      dataContext,
      businessDomain,
      userFeedback,
      fileName
    } = config

    const dataSample = this.getDataSample(data)
    const domainGuidance = this.getDataDrivenGuidance(businessDomain)
    const schemaDescription = this.formatSchemaDescription(schema)

    const prompt = `
You are an expert data analyst tasked with analyzing data and generating visualization recommendations.
${fileName ? `The data comes from file: ${fileName}` : ''}

DATA CONTEXT:
- ${dataContext.rowCount} total rows, ${dataContext.columnCount} columns
- ${dataContext.patternSummary}
${dataContext.hasTimeSeries ? '- Contains time-series data suitable for trend analysis' : ''}
${dataContext.hasMultipleMetrics ? '- Multiple metrics available for comparison and correlation' : ''}
${dataContext.hasCategories ? '- Categorical data present for segmentation' : ''}
- Detected business domain: ${businessDomain}

DATA SCHEMA:
${schemaDescription}

${domainGuidance}

${userFeedback ? `USER FEEDBACK: ${userFeedback}\n` : ''}

DATA SAMPLE (first ${dataSample.length} rows):
${JSON.stringify(dataSample, null, 2)}

ANALYSIS INSTRUCTIONS:
${this.getAnalysisInstructions()}

RESPONSE FORMAT:
${this.getResponseFormat()}
`

    logger.debug('[PromptBuilder] Prompt built:', {
      length: prompt.length,
      domain: businessDomain,
      hasUserFeedback: !!userFeedback
    })

    return prompt
  }

  /**
   * Get a sample of data for the prompt
   */
  private getDataSample(data: DataRow[], maxRows: number = 25): DataRow[] {
    if (data.length <= maxRows) {
      return data
    }

    // Smart sampling: include first, last, and evenly distributed rows
    const sample: DataRow[] = []
    const step = Math.floor(data.length / maxRows)

    // Always include first row
    sample.push(data[0])

    // Add evenly distributed rows
    for (let i = step; i < data.length - 1 && sample.length < maxRows - 1; i += step) {
      sample.push(data[i])
    }

    // Always include last row
    if (data.length > 1) {
      sample.push(data[data.length - 1])
    }

    return sample
  }

  /**
   * Format schema description for prompt
   */
  private formatSchemaDescription(schema: DataSchema): string {
    const lines = schema.columns.map(col => {
      const parts = [`- ${col.name}: ${col.type}`]
      if (col.confidence < 80) {
        parts.push(`(confidence: ${col.confidence}%)`)
      }
      if (col.description) {
        parts.push(`- ${col.description}`)
      }
      return parts.join(' ')
    })
    return lines.join('\n')
  }

  /**
   * Get domain-specific guidance for analysis
   */
  private getDataDrivenGuidance(domain: BusinessDomain): string {
    const guidance: Record<BusinessDomain, string> = {
      advertising: `
ADVERTISING ANALYTICS FOCUS:
- Campaign performance metrics (CTR, CPC, CPM, ROAS)
- Conversion funnel analysis and attribution
- Budget efficiency and spend optimization
- A/B test results and statistical significance
- Audience segmentation and targeting insights
- Creative performance comparisons
- Time-based trends (day-parting, seasonality)`,

      ecommerce: `
E-COMMERCE ANALYTICS FOCUS:
- Revenue and sales performance (total, by product, by category)
- Conversion rate optimization metrics
- Shopping cart and checkout funnel analysis
- Customer lifetime value and retention
- Product performance and inventory turnover
- Average order value and basket analysis
- Customer segmentation and behavior patterns`,

      sales: `
SALES ANALYTICS FOCUS:
- Pipeline velocity and stage progression
- Win/loss rates and deal size analysis
- Sales rep performance and quota attainment
- Lead quality and conversion metrics
- Revenue forecasting and trends
- Customer acquisition cost and ROI
- Territory and segment performance`,

      operations: `
OPERATIONS ANALYTICS FOCUS:
- Capacity utilization and efficiency metrics
- Throughput and cycle time analysis
- Quality control and defect rates
- Inventory levels and turnover
- Supply chain performance
- Resource allocation optimization
- Cost reduction opportunities`,

      general: `
GENERAL ANALYTICS FOCUS:
- Key performance indicators and trends
- Data distribution and statistical insights
- Correlation and relationship analysis
- Outliers and anomaly detection
- Comparative analysis across dimensions
- Top/bottom performers identification
- Time-based patterns and seasonality`
    }

    return guidance[domain] || guidance.general
  }

  /**
   * Get analysis instructions for the AI
   */
  private getAnalysisInstructions(): string {
    return `
1. Analyze the data structure, quality, and patterns
2. Generate 8-12 diverse, insightful visualizations
3. Include at least 2 KPI scorecards for key metrics
4. Ensure variety in chart types (mix of comparison, trend, distribution, relationship)
5. Each chart should reveal specific insights
6. Use appropriate aggregations (sum, average, count) based on context
7. For top/bottom analysis, include sortBy, sortOrder, and limit in dataMapping
8. Consider the business domain when selecting metrics and dimensions`
  }

  /**
   * Get the expected response format
   */
  private getResponseFormat(): string {
    return `
Return a JSON object with the following structure:
{
  "insights": [
    "Key insight 1 about the data",
    "Key insight 2 about trends or patterns",
    "Key insight 3 about relationships or anomalies"
  ],
  "chartConfig": [
    {
      "type": "chart_type", // MUST be one of: line, bar, pie, area, scatter, scorecard, table, combo, waterfall, heatmap, gauge, cohort, bullet, treemap, sparkline
      "title": "Chart Title",
      "description": "What this chart shows and why it's important",
      "dataMapping": {
        // Specific fields based on chart type:
        // For bar: { "category": "field", "values": ["field1", "field2"] }
        // For line/area: { "xAxis": "field", "yAxis": ["field1", "field2"] }
        // For pie: { "category": "field", "value": "field" }
        // For scorecard: { "metric": "field", "aggregation": "sum|avg|count" }
        // For scatter: { "xAxis": "field", "yAxis": "field", "size": "field" }
        // Include sortBy, sortOrder, limit for top/bottom analysis
      },
      "confidence": 85, // 0-100 confidence score
      "reasoning": "Why this visualization was chosen"
    }
  ],
  "summary": {
    "dataQuality": {
      "score": 85, // 0-100
      "issues": ["any data quality issues found"]
    },
    "keyFindings": ["main finding 1", "main finding 2"],
    "recommendations": ["actionable recommendation 1", "actionable recommendation 2"]
  }
}`
  }

  /**
   * Build a simpler prompt for quick analysis
   */
  buildQuickAnalysisPrompt(data: DataRow[], columns: string[]): string {
    const sample = this.getDataSample(data, 10)

    return `
Analyze this data and suggest 3-5 simple visualizations.

Columns: ${columns.join(', ')}
Sample data: ${JSON.stringify(sample, null, 2)}

Return JSON with chartConfig array containing chart objects with type, title, and dataMapping fields.
Supported types: line, bar, pie, area, scatter, scorecard, table.`
  }
}

// Export singleton instance
export const promptBuilderService = new PromptBuilderService()