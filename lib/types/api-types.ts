/**
 * Type definitions for API endpoints
 * Replaces 'any' types with proper TypeScript types for type safety
 */

import type { DataRow, ColumnSchema, DataSchema } from '@/lib/store'
import type { SupportedChartType } from './route-types'

/**
 * Column role classification for data schema
 * Defines the functional role of a column in data analysis
 */
export type ColumnRole = 'metric' | 'dimension' | 'timestamp' | 'identifier' | 'unknown'

/**
 * Semantic type classification for columns
 * Provides more granular typing for business context
 */
export type SemanticType =
  | 'currency'
  | 'percentage'
  | 'count'
  | 'ratio'
  | 'id'
  | 'uuid'
  | 'sku'
  | 'email'
  | 'url'
  | 'phone'
  | 'name'
  | 'label'
  | 'address'
  | 'city'
  | 'country'
  | 'zip'
  | 'category'
  | 'status'
  | 'score'
  | 'duration'
  | 'date'
  | 'datetime'
  | 'time'
  | 'generic'

/**
 * Logger interface with typed console methods
 */
export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/**
 * OpenAI API error response
 */
export interface OpenAIError extends Error {
  status?: number
  code?: string
  type?: string
}

/**
 * OpenAI chat completion parameters
 */
export interface OpenAIChatParams {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  response_format?: {
    type: 'json_object' | 'text'
  }
}

/**
 * OpenAI chat completion response
 */
export interface OpenAIChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Column statistics
 */
export interface ColumnStats {
  min?: number
  max?: number
  avg?: number
  median?: number
  std?: number
  sum?: number
  categoryCount?: number
  nonZeroCount?: number
  // Date-specific stats
  earliest?: string
  latest?: string
  spanDays?: number
  distribution?: Array<{
    value: string | number
    count: number
    percentage: number
  }>
}

/**
 * Data structure for analysis with typed columns
 */
export interface DataStructure {
  columns: Array<{
    name: string
    type: string
    nullPercentage?: number
    stats?: ColumnStats
  }>
  dataSample: DataRow[]
  rowCount: number
  columnCount?: number
}

/**
 * Analysis context for data
 */
export interface DataContext {
  rowCount: number
  columnCount: number
  columns: ColumnSchema[]
  correctedColumns?: string[]
  improvementNotes?: string
}

/**
 * Filter operator types
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'is_null'
  | 'is_not_null'

/**
 * Chart filter configuration
 */
export interface ChartFilter {
  column: string
  operator: FilterOperator
  value: string | number | boolean | null | Array<string | number>
  reason?: string
}

/**
 * Aggregation types
 */
export type AggregationType =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'distinct'
  | 'median'
  | 'mode'
  | 'std'
  | 'variance'
  | 'percentile'

/**
 * Data mapping for charts (supports all chart types)
 */
export interface DataMapping {
  // Common mappings
  category?: string
  values?: string[]
  xAxis?: string
  yAxis?: string | string[]
  value?: string
  metric?: string
  comparison?: string
  aggregation?: AggregationType

  // Dual Y-axis support
  yAxis1?: string[]
  yAxis2?: string[]
  yAxis1Label?: string
  yAxis2Label?: string
  yAxis1Type?: 'bar' | 'line' | 'area'
  yAxis2Type?: 'bar' | 'line' | 'area'

  // Table
  columns?: string[]

  // Scatter
  size?: string
  color?: string

  // Top/Bottom filtering
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number

  // Waterfall
  type?: string
  isTotal?: string

  // Gauge
  min?: number | string
  max?: number | string
  target?: number | string
  thresholds?: Array<{ value: number; color: string }>

  // Cohort
  cohort?: string
  period?: string
  retention?: string

  // Bullet
  actual?: string
  ranges?: Array<{ label: string; value: number }>

  // Treemap
  parent?: string

  // Sankey
  source?: string
  flow?: string

  // Formula support
  formula?: string
  formulaAlias?: string

  // Filters
  filters?: ChartFilter[]
}

/**
 * Chart recommendation from AI
 */
export interface ChartRecommendation {
  type: SupportedChartType
  title: string
  description: string
  dataMapping: DataMapping
  confidence?: number
  reasoning?: string
  aggregation?: AggregationType
  id?: string
  qualityScore?: number
  qualityFactors?: QualityFactors

  // Legacy support (deprecated)
  dataKey?: string[]
  xAxis?: string | string[]
  yAxis?: string | string[]
}

/**
 * Quality factors for chart recommendations
 */
export interface QualityFactors {
  // New factors
  dataCompleteness?: number
  typeAppropriate?: number
  businessValue?: number
  // Legacy factors
  dataTypeMatch?: number
  columnConfidence?: number
  userCorrectionBoost?: number
  clarityScore?: number
}

/**
 * AI analysis response structure
 */
export interface AIAnalysisResponse {
  insights: string[]
  chartConfig: ChartRecommendation[]
  summary?: {
    dataQuality?: string
    keyFindings?: string
    recommendations?: string
    businessContext?: string
  }
  dataContext?: DataContext
}

/**
 * Chart statistics for rebalancing
 */
export interface ChartStats {
  totalCharts: number
  scorecardCount: number
  visualizationCount: number
  tableCount: number
  chartTypes: Record<string, number>
}

/**
 * Column data type - the basic data classification
 */
export type ColumnDataType = 'string' | 'number' | 'boolean' | 'date' | 'categorical'

/**
 * Corrected column schema from user feedback
 * Captures user corrections and AI suggestions for column metadata
 */
export interface CorrectedColumn {
  /** Column name */
  name: string
  /** Data type classification (string for backwards compatibility, use ColumnDataType for strict typing) */
  type: string
  /** User-provided or AI-suggested description of column purpose */
  description?: string
  /** Whether this column was manually corrected by user */
  userCorrected: boolean
  /** Functional role of the column (metric, dimension, timestamp, identifier) */
  role?: ColumnRole
  /** Semantic type for business context (currency, percentage, count, etc.) */
  semanticType?: SemanticType
  /** Whether this column requires a description for good analysis */
  isRequired?: boolean
  /** AI-generated description suggestion */
  suggestedDescription?: string
}

/**
 * Analysis request payload
 */
export interface AnalyzeRequest {
  data: DataRow[]
  schema?: DataSchema
  correctedSchema?: CorrectedColumn[]
  feedback?: string
  fileName?: string
}

/**
 * User correction for chart
 */
export interface UserCorrection {
  chartId: string
  type: SupportedChartType
  dataMapping: DataMapping
  reason?: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Chart layout validation result
 */
export interface ChartLayoutValidation extends ValidationResult {
  totalCharts: number
  scorecardCount: number
  visualizationCount: number
  tableCount: number
}

/**
 * Rebalance options for charts
 */
export interface RebalanceOptions {
  targetScorecardCount: number
  minVisualizationCount: number
  maxTableCount: number
}

/**
 * Migration result from legacy format
 */
export interface MigrationResult {
  dataMapping: DataMapping
  warnings?: string[]
}

/**
 * Business domain types
 */
export type BusinessDomain = 'advertising' | 'ecommerce' | 'sales' | 'operations' | 'general'

/**
 * Chart suggestion with quality scores
 */
export interface ChartSuggestion {
  id: string
  type: SupportedChartType
  title: string
  description: string
  priority: number
  confidence: number
  reasoning: string
  dataMapping: DataMapping
  qualityScore?: number
  qualityFactors?: QualityFactors
}
