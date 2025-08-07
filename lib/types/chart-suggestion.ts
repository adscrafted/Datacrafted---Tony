/**
 * Types for AI-generated chart suggestions
 */

export interface ChartSuggestion {
  id: string
  type: 'table' | 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'scorecard'
  title: string
  description: string
  
  // Data transformation instructions
  dataTransform: {
    // SQL-like operations
    filter?: FilterCondition[]
    groupBy?: string[]
    orderBy?: OrderByCondition[]
    limit?: number
    
    // Aggregations
    aggregations?: AggregationCondition[]
    
    // Column transformations
    columns?: ColumnTransform[]
  }
  
  // Chart configuration
  chartConfig: {
    x?: string // X-axis column
    y?: string | string[] // Y-axis column(s)
    color?: string // Color column for grouping
    size?: string // Size column for bubble charts
    
    // Chart-specific options
    options?: {
      showLegend?: boolean
      showGrid?: boolean
      stacked?: boolean
      orientation?: 'horizontal' | 'vertical'
    }
  }
  
  // Table configuration (if type is 'table')
  tableConfig?: {
    columns: TableColumn[]
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    pagination?: boolean
    pageSize?: number
  }
  
  // Metadata
  confidence: number // 0-1, how confident the AI is
  reasoning: string // Why this chart was suggested
  tags: string[]
  priority: 'high' | 'medium' | 'low'
}

export interface FilterCondition {
  column: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
  value: any
  logic?: 'AND' | 'OR' // For combining with next condition
}

export interface OrderByCondition {
  column: string
  direction: 'asc' | 'desc'
}

export interface AggregationCondition {
  column: string
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct'
  alias?: string
}

export interface ColumnTransform {
  name: string
  expression: string // e.g., "CAST(spend AS FLOAT)"
  alias?: string
}

export interface TableColumn {
  key: string
  label: string
  type?: 'text' | 'number' | 'currency' | 'percentage' | 'date'
  sortable?: boolean
  width?: number
  format?: string // e.g., "$0,0.00" for currency
}

// Example suggestions that AI can generate
export const exampleSuggestions: ChartSuggestion[] = [
  {
    id: 'top-10-high-acos-campaigns',
    type: 'table',
    title: 'Top 10 High Spend Campaigns with Bad ACOS',
    description: 'Campaigns spending the most money with ACOS above 50%, indicating poor performance',
    
    dataTransform: {
      filter: [
        {
          column: 'acos',
          operator: 'greater_than',
          value: 0.5 // 50%
        },
        {
          column: 'spend',
          operator: 'is_not_null',
          value: null
        }
      ],
      columns: [
        {
          name: 'spend',
          expression: 'CAST(REPLACE(REPLACE(spend, "$", ""), ",", "") AS FLOAT)',
          alias: 'spend_numeric'
        },
        {
          name: 'acos',
          expression: 'CAST(REPLACE(acos, "%", "") AS FLOAT) / 100',
          alias: 'acos_numeric'
        }
      ],
      orderBy: [
        {
          column: 'spend_numeric',
          direction: 'desc'
        }
      ],
      limit: 10
    },
    
    chartConfig: {},
    
    tableConfig: {
      columns: [
        { key: 'campaign_name', label: 'Campaign Name', type: 'text', sortable: true },
        { key: 'spend_numeric', label: 'Spend', type: 'currency', format: '$0,0.00', sortable: true },
        { key: 'acos_numeric', label: 'ACOS', type: 'percentage', format: '0.0%', sortable: true },
        { key: 'impressions', label: 'Impressions', type: 'number', format: '0,0', sortable: true },
        { key: 'clicks', label: 'Clicks', type: 'number', format: '0,0', sortable: true }
      ],
      sortBy: 'spend_numeric',
      sortOrder: 'desc',
      pagination: true,
      pageSize: 10
    },
    
    confidence: 0.9,
    reasoning: 'High spend with bad ACOS indicates campaigns that need immediate attention for optimization',
    tags: ['spend', 'acos', 'optimization', 'performance'],
    priority: 'high'
  },
  
  {
    id: 'spend-vs-acos-scatter',
    type: 'scatter',
    title: 'Campaign Spend vs ACOS Performance',
    description: 'Scatter plot showing the relationship between spend and ACOS to identify optimization opportunities',
    
    dataTransform: {
      filter: [
        {
          column: 'spend',
          operator: 'is_not_null',
          value: null
        },
        {
          column: 'acos',
          operator: 'is_not_null',
          value: null
        }
      ],
      columns: [
        {
          name: 'spend',
          expression: 'CAST(REPLACE(REPLACE(spend, "$", ""), ",", "") AS FLOAT)',
          alias: 'spend_numeric'
        },
        {
          name: 'acos',
          expression: 'CAST(REPLACE(acos, "%", "") AS FLOAT) / 100',
          alias: 'acos_numeric'
        }
      ]
    },
    
    chartConfig: {
      x: 'spend_numeric',
      y: 'acos_numeric',
      color: 'campaign_status',
      options: {
        showLegend: true,
        showGrid: true
      }
    },
    
    confidence: 0.85,
    reasoning: 'Scatter plot reveals spending efficiency patterns and helps identify outliers',
    tags: ['spend', 'acos', 'correlation', 'analysis'],
    priority: 'medium'
  }
]