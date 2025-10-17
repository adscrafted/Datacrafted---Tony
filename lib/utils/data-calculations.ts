/**
 * Comprehensive Data Calculation System
 *
 * Production-ready calculation engine that supports:
 * - Basic aggregations (sum, avg, count, min, max, median, mode)
 * - Statistical functions (std dev, variance, percentiles)
 * - Derived metrics (ratios, percentages, differences, growth rates)
 * - Time-based calculations (period-over-period, moving averages, running totals)
 * - Group operations (group by with multiple aggregations, pivot tables)
 *
 * Designed to integrate with chart components and AI recommendations.
 */

import { DataRow } from '@/lib/store'

// ============================================================================
// Security Constants
// ============================================================================

/** Maximum rows for general calculations (performance limit) */
const CALCULATION_MAX_ROWS = 10000

/** Maximum rows for sorting-intensive operations (median, percentile) */
const CALCULATION_MAX_PERCENTILE_ROWS = 5000

// ============================================================================
// Type Definitions
// ============================================================================

export type AggregationType =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'median'
  | 'mode'
  | 'std'
  | 'variance'
  | 'percentile'
  | 'distinct'
  | 'first'
  | 'last'

export type DerivedMetricType =
  | 'ratio'
  | 'percentage'
  | 'difference'
  | 'growth_rate'
  | 'percent_change'
  | 'running_total'
  | 'moving_average'
  | 'period_over_period'
  | 'year_over_year'

export interface AggregationConfig {
  column: string
  type: AggregationType
  alias?: string
  percentile?: number // For percentile aggregation (0-100)
}

export interface DerivedMetricConfig {
  type: DerivedMetricType
  alias: string
  numerator?: string
  denominator?: string
  column?: string
  window?: number // For moving averages
  periods?: number // For period-over-period
}

export interface GroupByConfig {
  columns: string[]
  aggregations: AggregationConfig[]
  includeOriginalColumns?: boolean
}

export interface PivotConfig {
  index: string[]       // Row labels
  columns: string[]     // Column labels
  values: string        // Values to aggregate
  aggFunc: AggregationType
  fill?: number | null  // Fill missing values
}

export interface CalculationResult {
  data: DataRow[]
  metadata?: {
    calculationType: string
    originalRowCount: number
    resultRowCount: number
    columns: string[]
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse numeric value from various formats (currency, percentages, etc.)
 * Handles: $1,234.56, (€1,234.56), -$1,234.56, 50%, etc.
 */
export function parseNumericValue(value: any): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    // Filter out NaN, Infinity, -Infinity for safety
    if (!isFinite(value)) return null
    return value
  }
  if (typeof value !== 'string') return null

  let cleaned = String(value).trim()

  // Handle parentheses for negative numbers (accounting format)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1).trim() // Remove parentheses
  }

  // Remove currency symbols, commas, spaces, percentages
  cleaned = cleaned.replace(/[€$£¥,\s%]/g, '')
  const num = parseFloat(cleaned)

  // Validate finite numbers only and add overflow protection
  if (!isFinite(num)) return null

  // Add overflow protection (reasonable business metric limit)
  const MAX_SAFE_VALUE = 1e15
  if (Math.abs(num) > MAX_SAFE_VALUE) return null

  return isNegative ? -num : num
}

/**
 * Extract numeric values from data rows with optional row limit for performance
 */
function extractNumericValues(data: DataRow[], column: string, maxRows?: number): number[] {
  const limit = maxRows || CALCULATION_MAX_ROWS
  const limitedData = data.length > limit ? data.slice(0, limit) : data

  if (data.length > limit && process.env.NODE_ENV === 'development') {
    console.warn(`[SECURITY] Calculation limited to ${limit} rows (${column}). Original: ${data.length} rows`)
  }

  return limitedData
    .map(row => parseNumericValue(row[column]))
    .filter((v): v is number => v !== null)
}

/**
 * Calculate percentile with validation
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0

  // Validate percentile is in valid range (0-100)
  if (percentile < 0 || percentile > 100) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SECURITY] Invalid percentile: ${percentile}, clamping to 0-100 range`)
    }
    percentile = Math.max(0, Math.min(100, percentile))
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = (percentile / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index % 1

  if (lower === upper) return sorted[lower]
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/**
 * Calculate mode (most frequent value)
 */
function calculateMode(values: number[]): number {
  if (values.length === 0) return 0

  const frequency = new Map<number, number>()
  values.forEach(value => {
    frequency.set(value, (frequency.get(value) || 0) + 1)
  })

  let maxFreq = 0
  let mode = values[0]

  frequency.forEach((freq, value) => {
    if (freq > maxFreq) {
      maxFreq = freq
      mode = value
    }
  })

  return mode
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length

  return Math.sqrt(variance)
}

/**
 * Calculate variance
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))

  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
}

// ============================================================================
// Basic Aggregation Functions
// ============================================================================

export class DataCalculator {
  /**
   * Perform a single aggregation on a column
   */
  static aggregate(
    data: DataRow[],
    config: AggregationConfig
  ): number | null {
    // Apply limits based on operation complexity
    const maxRows = ['median', 'percentile', 'mode'].includes(config.type)
      ? CALCULATION_MAX_PERCENTILE_ROWS
      : CALCULATION_MAX_ROWS

    const values = extractNumericValues(data, config.column, maxRows)

    if (values.length === 0) return null

    switch (config.type) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0)

      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length

      case 'count':
        return values.length

      case 'min':
        return Math.min(...values)

      case 'max':
        return Math.max(...values)

      case 'median':
        const sorted = [...values].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid]

      case 'mode':
        return calculateMode(values)

      case 'std':
        return calculateStandardDeviation(values)

      case 'variance':
        return calculateVariance(values)

      case 'percentile':
        return calculatePercentile(values, config.percentile || 50)

      case 'distinct':
        return new Set(values).size

      case 'first':
        return values[0]

      case 'last':
        return values[values.length - 1]

      default:
        return null
    }
  }

  /**
   * Group data by columns and apply aggregations
   */
  static groupBy(
    data: DataRow[],
    config: GroupByConfig
  ): CalculationResult {
    if (!data || data.length === 0) {
      return { data: [], metadata: { calculationType: 'groupBy', originalRowCount: 0, resultRowCount: 0, columns: [] } }
    }

    // Create groups
    const groups = new Map<string, DataRow[]>()

    data.forEach(row => {
      const groupKey = config.columns
        .map(col => String(row[col] ?? ''))
        .join('|')

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(row)
    })

    // Aggregate each group
    const result: DataRow[] = []

    groups.forEach((groupRows, groupKey) => {
      const aggregatedRow: DataRow = {}

      // Add group columns
      const groupValues = groupKey.split('|')
      config.columns.forEach((col, idx) => {
        aggregatedRow[col] = groupRows[0][col]
      })

      // Add aggregations
      config.aggregations.forEach(aggConfig => {
        const alias = aggConfig.alias || `${aggConfig.type}_${aggConfig.column}`
        const value = this.aggregate(groupRows, aggConfig)
        aggregatedRow[alias] = value
      })

      // Include original columns if requested
      if (config.includeOriginalColumns) {
        const firstRow = groupRows[0]
        Object.keys(firstRow).forEach(key => {
          if (!config.columns.includes(key) && !aggregatedRow.hasOwnProperty(key)) {
            aggregatedRow[key] = firstRow[key]
          }
        })
      }

      result.push(aggregatedRow)
    })

    return {
      data: result,
      metadata: {
        calculationType: 'groupBy',
        originalRowCount: data.length,
        resultRowCount: result.length,
        columns: Object.keys(result[0] || {})
      }
    }
  }

  /**
   * Create pivot table
   */
  static pivot(
    data: DataRow[],
    config: PivotConfig
  ): CalculationResult {
    if (!data || data.length === 0) {
      return { data: [], metadata: { calculationType: 'pivot', originalRowCount: 0, resultRowCount: 0, columns: [] } }
    }

    // Get unique column values
    const columnValues = new Set<string>()
    data.forEach(row => {
      const colKey = config.columns.map(col => String(row[col] ?? '')).join('|')
      columnValues.add(colKey)
    })

    // Create index groups
    const indexGroups = new Map<string, DataRow[]>()

    data.forEach(row => {
      const indexKey = config.index.map(col => String(row[col] ?? '')).join('|')

      if (!indexGroups.has(indexKey)) {
        indexGroups.set(indexKey, [])
      }
      indexGroups.get(indexKey)!.push(row)
    })

    // Build pivot table
    const result: DataRow[] = []

    indexGroups.forEach((indexRows, indexKey) => {
      const pivotRow: DataRow = {}

      // Add index columns
      const indexVals = indexKey.split('|')
      config.index.forEach((col, idx) => {
        pivotRow[col] = indexRows[0][col]
      })

      // Add pivoted values
      columnValues.forEach(colKey => {
        const colVals = colKey.split('|')
        const columnLabel = colVals.join('_')

        // Filter rows for this column combination
        const matchingRows = indexRows.filter(row => {
          const rowColKey = config.columns.map(col => String(row[col] ?? '')).join('|')
          return rowColKey === colKey
        })

        // Aggregate value
        if (matchingRows.length > 0) {
          const aggResult = this.aggregate(matchingRows, {
            column: config.values,
            type: config.aggFunc
          })
          pivotRow[columnLabel] = aggResult ?? config.fill ?? null
        } else {
          pivotRow[columnLabel] = config.fill ?? null
        }
      })

      result.push(pivotRow)
    })

    return {
      data: result,
      metadata: {
        calculationType: 'pivot',
        originalRowCount: data.length,
        resultRowCount: result.length,
        columns: Object.keys(result[0] || {})
      }
    }
  }

  // ============================================================================
  // Derived Metrics
  // ============================================================================

  /**
   * Calculate derived metrics
   */
  static calculateDerivedMetric(
    data: DataRow[],
    config: DerivedMetricConfig
  ): CalculationResult {
    if (!data || data.length === 0) {
      return { data: [], metadata: { calculationType: 'derivedMetric', originalRowCount: 0, resultRowCount: 0, columns: [] } }
    }

    const result = data.map((row, index) => {
      const newRow = { ...row }

      switch (config.type) {
        case 'ratio':
          if (config.numerator && config.denominator) {
            const num = parseNumericValue(row[config.numerator])
            const denom = parseNumericValue(row[config.denominator])
            newRow[config.alias] = (num !== null && denom !== null && denom !== 0)
              ? num / denom
              : null
          }
          break

        case 'percentage':
          if (config.numerator && config.denominator) {
            const num = parseNumericValue(row[config.numerator])
            const denom = parseNumericValue(row[config.denominator])
            newRow[config.alias] = (num !== null && denom !== null && denom !== 0)
              ? (num / denom) * 100
              : null
          }
          break

        case 'difference':
          if (config.numerator && config.denominator) {
            const val1 = parseNumericValue(row[config.numerator])
            const val2 = parseNumericValue(row[config.denominator])
            newRow[config.alias] = (val1 !== null && val2 !== null)
              ? val1 - val2
              : null
          }
          break

        case 'growth_rate':
        case 'percent_change':
          if (index > 0 && config.column) {
            const current = parseNumericValue(row[config.column])
            const previous = parseNumericValue(data[index - 1][config.column])
            newRow[config.alias] = (current !== null && previous !== null && previous !== 0)
              ? ((current - previous) / previous) * 100
              : null
          } else {
            newRow[config.alias] = null
          }
          break

        case 'running_total':
          if (config.column) {
            const currentValue = parseNumericValue(row[config.column])
            const previousTotal = index > 0
              ? parseNumericValue(data[index - 1][config.alias])
              : 0
            newRow[config.alias] = (currentValue !== null)
              ? (previousTotal || 0) + currentValue
              : previousTotal
          }
          break

        case 'moving_average':
          if (config.column && config.window) {
            const window = Math.min(config.window, index + 1)
            const windowData = data.slice(Math.max(0, index - window + 1), index + 1)
            const values = extractNumericValues(windowData, config.column)
            newRow[config.alias] = values.length > 0
              ? values.reduce((sum, val) => sum + val, 0) / values.length
              : null
          }
          break

        case 'period_over_period':
          if (config.column && config.periods) {
            const currentIdx = index
            const previousIdx = index - config.periods

            if (previousIdx >= 0) {
              const current = parseNumericValue(row[config.column])
              const previous = parseNumericValue(data[previousIdx][config.column])
              newRow[config.alias] = (current !== null && previous !== null && previous !== 0)
                ? ((current - previous) / previous) * 100
                : null
            } else {
              newRow[config.alias] = null
            }
          }
          break

        case 'year_over_year':
          // Assumes data is sorted by date and has consistent frequency
          if (config.column && config.periods) {
            const periodsPerYear = config.periods || 12 // Default to monthly
            const currentIdx = index
            const previousIdx = index - periodsPerYear

            if (previousIdx >= 0) {
              const current = parseNumericValue(row[config.column])
              const previous = parseNumericValue(data[previousIdx][config.column])
              newRow[config.alias] = (current !== null && previous !== null && previous !== 0)
                ? ((current - previous) / previous) * 100
                : null
            } else {
              newRow[config.alias] = null
            }
          }
          break
      }

      return newRow
    })

    return {
      data: result,
      metadata: {
        calculationType: config.type,
        originalRowCount: data.length,
        resultRowCount: result.length,
        columns: Object.keys(result[0] || {})
      }
    }
  }

  // ============================================================================
  // Comprehensive Calculation Pipeline
  // ============================================================================

  /**
   * Apply multiple calculations in sequence
   */
  static calculatePipeline(
    data: DataRow[],
    steps: Array<{
      type: 'aggregate' | 'groupBy' | 'pivot' | 'derivedMetric'
      config: any
    }>
  ): CalculationResult {
    let currentData = data
    let metadata: any[] = []

    for (const step of steps) {
      let result: CalculationResult

      switch (step.type) {
        case 'groupBy':
          result = this.groupBy(currentData, step.config)
          break

        case 'pivot':
          result = this.pivot(currentData, step.config)
          break

        case 'derivedMetric':
          result = this.calculateDerivedMetric(currentData, step.config)
          break

        default:
          continue
      }

      currentData = result.data
      metadata.push(result.metadata)
    }

    return {
      data: currentData,
      metadata: {
        calculationType: 'pipeline',
        originalRowCount: data.length,
        resultRowCount: currentData.length,
        columns: Object.keys(currentData[0] || {}),
        steps: metadata
      } as any
    }
  }
}

// ============================================================================
// Formula-Based Calculations
// ============================================================================

/**
 * Calculate custom formula for all rows or as aggregate
 */
export function calculateFormula(
  data: DataRow[],
  formula: string,
  alias: string,
  options?: {
    aggregateFirst?: boolean // If true, calculate aggregations then apply formula once
    round?: number // Decimal places to round to
  }
): CalculationResult {
  // Import formula parser functions
  const {
    tokenizeFormula,
    extractAggregateFunctions,
    calculateFormulaForRow,
    replaceAggregateFunctions,
    findMatchingColumn
  } = require('./formula-parser')

  if (!data || data.length === 0) {
    return {
      data: [],
      metadata: {
        calculationType: 'formula',
        originalRowCount: 0,
        resultRowCount: 0,
        columns: []
      }
    }
  }

  const availableColumns = Object.keys(data[0])

  // Parse formula
  const parseResult = tokenizeFormula(formula)
  if (!parseResult.success) {
    throw new Error(`Invalid formula: ${parseResult.error}`)
  }

  const tokens = parseResult.tokens

  // Extract aggregate functions
  const aggregations = extractAggregateFunctions(tokens)
  const hasAggregations = aggregations.length > 0

  // Calculate aggregations if present
  const aggregatedData = new Map<string, number>()

  if (hasAggregations || options?.aggregateFirst) {
    for (const agg of aggregations) {
      const matchingColumn = findMatchingColumn(agg.column, availableColumns)
      if (!matchingColumn) {
        throw new Error(`Column not found for aggregation: ${agg.column}`)
      }

      let value: number | null = null

      switch (agg.function) {
        case 'SUM':
          value = DataCalculator.aggregate(data, { column: matchingColumn, type: 'sum' })
          break
        case 'AVG':
          value = DataCalculator.aggregate(data, { column: matchingColumn, type: 'avg' })
          break
        case 'COUNT':
          value = DataCalculator.aggregate(data, { column: matchingColumn, type: 'count' })
          break
        case 'MIN':
          value = DataCalculator.aggregate(data, { column: matchingColumn, type: 'min' })
          break
        case 'MAX':
          value = DataCalculator.aggregate(data, { column: matchingColumn, type: 'max' })
          break
      }

      if (value !== null) {
        aggregatedData.set(agg.alias, value)
      }
    }
  }

  // If aggregateFirst is true, calculate formula once with aggregated values
  if (options?.aggregateFirst || hasAggregations) {
    // Replace aggregate functions with their values
    const processedTokens = replaceAggregateFunctions(tokens, aggregatedData)

    // Evaluate formula once (using first row as context, but values come from aggregatedData)
    const { evaluateFormula } = require('./formula-parser')
    const result = evaluateFormula(
      processedTokens,
      { row: data[0], aggregatedData, allData: data },
      availableColumns
    )

    if (!result.success) {
      throw new Error(`Formula evaluation failed: ${result.error}`)
    }

    let finalValue = result.value

    // Apply rounding if specified
    if (options?.round !== undefined && finalValue !== null) {
      finalValue = Number(finalValue.toFixed(options.round))
    }

    return {
      data: [{ [alias]: finalValue }],
      metadata: {
        calculationType: 'formula',
        originalRowCount: data.length,
        resultRowCount: 1,
        columns: [alias]
      }
    }
  }

  // Otherwise, calculate formula for each row
  const resultData = data.map(row => {
    const result = calculateFormulaForRow(formula, row, availableColumns, aggregatedData)

    if (!result.success) {
      return {
        ...row,
        [alias]: null
      }
    }

    let value = result.value

    // Apply rounding if specified
    if (options?.round !== undefined && value !== null && value !== undefined) {
      value = Number(value.toFixed(options.round))
    }

    return {
      ...row,
      [alias]: value
    }
  })

  return {
    data: resultData,
    metadata: {
      calculationType: 'formula',
      originalRowCount: data.length,
      resultRowCount: resultData.length,
      columns: [...availableColumns, alias]
    }
  }
}

// ============================================================================
// Convenience Functions for Chart Integration
// ============================================================================

/**
 * Calculate aggregated value for scorecard
 */
export function calculateScorecard(
  data: DataRow[],
  column: string,
  aggregationType: AggregationType = 'sum'
): number | null {
  return DataCalculator.aggregate(data, { column, type: aggregationType })
}

/**
 * Calculate grouped data for bar/column charts
 */
export function calculateGroupedData(
  data: DataRow[],
  groupBy: string,
  valueColumns: string[],
  aggregationType: AggregationType = 'sum'
): DataRow[] {
  const result = DataCalculator.groupBy(data, {
    columns: [groupBy],
    aggregations: valueColumns.map(col => ({
      column: col,
      type: aggregationType,
      alias: col
    }))
  })

  return result.data
}

/**
 * Calculate trend data for line charts with moving averages
 */
export function calculateTrendData(
  data: DataRow[],
  column: string,
  window: number = 7
): DataRow[] {
  const result = DataCalculator.calculateDerivedMetric(data, {
    type: 'moving_average',
    alias: `${column}_ma${window}`,
    column,
    window
  })

  return result.data
}

/**
 * Calculate period-over-period comparison
 */
export function calculatePeriodComparison(
  data: DataRow[],
  column: string,
  periods: number = 1
): DataRow[] {
  const result = DataCalculator.calculateDerivedMetric(data, {
    type: 'period_over_period',
    alias: `${column}_change`,
    column,
    periods
  })

  return result.data
}

/**
 * Calculate statistical summary
 */
export function calculateStatisticalSummary(
  data: DataRow[],
  column: string
): {
  count: number
  sum: number
  avg: number
  min: number
  max: number
  median: number
  std: number
  variance: number
} {
  return {
    count: DataCalculator.aggregate(data, { column, type: 'count' }) || 0,
    sum: DataCalculator.aggregate(data, { column, type: 'sum' }) || 0,
    avg: DataCalculator.aggregate(data, { column, type: 'avg' }) || 0,
    min: DataCalculator.aggregate(data, { column, type: 'min' }) || 0,
    max: DataCalculator.aggregate(data, { column, type: 'max' }) || 0,
    median: DataCalculator.aggregate(data, { column, type: 'median' }) || 0,
    std: DataCalculator.aggregate(data, { column, type: 'std' }) || 0,
    variance: DataCalculator.aggregate(data, { column, type: 'variance' }) || 0
  }
}

/**
 * Calculate scorecard value with aggregation
 * Shared function to ensure consistent calculations across dashboard and fullscreen views
 * Handles dates, categorical data, and numeric values appropriately
 */
export function calculateScorecardValue(
  data: DataRow[],
  metric: string,
  aggregationType: AggregationType = 'sum'
): number | null {
  if (!data || data.length === 0) return null
  if (!metric) return null

  // Get raw values (before parsing)
  const rawValues = data.map(row => row[metric]).filter(v => v !== null && v !== undefined)
  if (rawValues.length === 0) return null

  // Check if this is a date column
  const sampleValue = rawValues[0]
  const isDateColumn = typeof sampleValue === 'string' && !isNaN(Date.parse(sampleValue))

  // Handle date min/max specially
  if (isDateColumn && (aggregationType === 'min' || aggregationType === 'max')) {
    const dates = rawValues
      .map(val => {
        const dateVal = new Date(String(val))
        return isNaN(dateVal.getTime()) ? null : dateVal.getTime()
      })
      .filter((v): v is number => v !== null)

    if (dates.length === 0) return null
    return aggregationType === 'min' ? Math.min(...dates) : Math.max(...dates)
  }

  // Handle distinct count - use raw values for categorical data
  if (aggregationType === 'distinct') {
    return new Set(rawValues).size
  }

  // For all other aggregations, parse as numeric
  const values = rawValues
    .map(v => parseNumericValue(v))
    .filter((v): v is number => v !== null)

  if (values.length === 0) return null

  // Apply the aggregation type
  switch (aggregationType) {
    case 'sum':
      return values.reduce((sum, v) => sum + v, 0)

    case 'avg':
      return values.reduce((sum, v) => sum + v, 0) / values.length

    case 'count':
      return values.length

    case 'min':
      return Math.min(...values)

    case 'max':
      return Math.max(...values)

    case 'median': {
      const sorted = [...values].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
    }

    case 'first':
      return values[0]

    case 'last':
      return values[values.length - 1]

    default:
      return values.reduce((sum, v) => sum + v, 0) // Default to sum
  }
}
