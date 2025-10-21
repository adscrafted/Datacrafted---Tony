/**
 * Chart Data Processor
 *
 * Integrates the calculation system with chart components.
 * Processes raw data according to chart configuration and applies:
 * - Aggregations
 * - Grouping
 * - Derived metrics
 * - Filtering and sorting
 */

import type { DataRow } from '@/lib/store'
import type {
  AggregationType,
  AggregationConfig,
  DerivedMetricConfig,
  GroupByConfig
} from './data-calculations'
import {
  DataCalculator,
  calculateScorecard,
  calculateGroupedData,
  calculateTrendData,
  calculatePeriodComparison
} from './data-calculations'

export interface ChartDataMapping {
  // Basic mappings
  xAxis?: string
  yAxis?: string | string[]
  category?: string
  value?: string
  metric?: string

  // Aggregation settings
  aggregation?: AggregationType
  percentile?: number
  groupBy?: string[]

  // Formula-based calculations
  formula?: string // Custom calculation formula (e.g., "(Revenue - Cost) / Revenue * 100")
  formulaAlias?: string // Name for calculated column
  formulaOptions?: {
    aggregateFirst?: boolean // Calculate aggregations before applying formula
    round?: number // Decimal places to round result
  }

  // Derived metrics
  derivedMetrics?: Array<{
    type: 'ratio' | 'percentage' | 'difference' | 'growth_rate' | 'percent_change' | 'running_total' | 'moving_average' | 'period_over_period' | 'year_over_year'
    alias: string
    column?: string
    numerator?: string
    denominator?: string
    window?: number
    periods?: number
  }>

  // Filtering and sorting
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
}

export interface ProcessedChartData {
  data: DataRow[]
  metadata: {
    originalRowCount: number
    processedRowCount: number
    aggregationType?: AggregationType
    groupedBy?: string[]
    derivedMetricsApplied?: string[]
  }
}

/**
 * Process data for scorecard charts
 */
export function processScoreCardData(
  data: DataRow[],
  mapping: ChartDataMapping
): ProcessedChartData {
  // Check if using formula-based calculation
  if (mapping.formula && mapping.formulaAlias) {
    const { calculateFormula } = require('./data-calculations')

    try {
      const result = calculateFormula(data, mapping.formula, mapping.formulaAlias, {
        aggregateFirst: mapping.formulaOptions?.aggregateFirst ?? true, // Default to aggregated for scorecards
        round: mapping.formulaOptions?.round
      })

      const value = result.data[0]?.[mapping.formulaAlias]

      return {
        data: [{ [mapping.formulaAlias]: value, _calculationType: 'formula' }],
        metadata: {
          originalRowCount: data.length,
          processedRowCount: 1
        }
      }
    } catch (error) {
      console.error('Formula calculation error:', error)
      return {
        data: [{ [mapping.formulaAlias]: null, _error: error instanceof Error ? error.message : 'Unknown error' }],
        metadata: {
          originalRowCount: data.length,
          processedRowCount: 0
        }
      }
    }
  }

  // Original column-based aggregation
  const column = mapping.metric || mapping.value || mapping.yAxis as string

  if (!column) {
    return {
      data: [],
      metadata: {
        originalRowCount: data.length,
        processedRowCount: 0
      }
    }
  }

  const aggregationType = mapping.aggregation || 'sum'
  const value = DataCalculator.aggregate(data, {
    column,
    type: aggregationType,
    percentile: mapping.percentile
  })

  return {
    data: [{ [column]: value, _aggregationType: aggregationType }],
    metadata: {
      originalRowCount: data.length,
      processedRowCount: 1,
      aggregationType
    }
  }
}

/**
 * Process data for bar/column charts with grouping and aggregation
 */
export function processBarChartData(
  data: DataRow[],
  mapping: ChartDataMapping
): ProcessedChartData {
  if (!data || data.length === 0) {
    return {
      data: [],
      metadata: {
        originalRowCount: 0,
        processedRowCount: 0
      }
    }
  }

  // Apply formula calculation if specified (before grouping)
  let processedData = data
  if (mapping.formula && mapping.formulaAlias) {
    const { calculateFormula } = require('./data-calculations')

    try {
      const result = calculateFormula(data, mapping.formula, mapping.formulaAlias, {
        aggregateFirst: mapping.formulaOptions?.aggregateFirst ?? false, // Default to row-level for bar charts
        round: mapping.formulaOptions?.round
      })

      processedData = result.data
    } catch (error) {
      console.error('Formula calculation error:', error)
      // Continue with original data
    }
  }

  const xAxis = mapping.xAxis || mapping.category
  const yAxisColumns = Array.isArray(mapping.yAxis) ? mapping.yAxis : [mapping.yAxis].filter(Boolean) as string[]

  // If using formula, use formula alias as yAxis
  const actualYAxisColumns =
    mapping.formula && mapping.formulaAlias ? [mapping.formulaAlias] : yAxisColumns

  if (!xAxis || actualYAxisColumns.length === 0) {
    return {
      data: processedData,
      metadata: {
        originalRowCount: data.length,
        processedRowCount: processedData.length
      }
    }
  }

  // Apply grouping if specified
  const groupByColumns = mapping.groupBy || [xAxis]
  const aggregationType = mapping.aggregation || 'sum'

  const result = DataCalculator.groupBy(processedData, {
    columns: groupByColumns,
    aggregations: actualYAxisColumns.map(col => ({
      column: col,
      type: aggregationType,
      alias: col,
      percentile: mapping.percentile
    }))
  })

  // Apply sorting if specified
  let finalData = result.data
  if (mapping.sortBy) {
    finalData = [...finalData].sort((a, b) => {
      const aVal = a[mapping.sortBy!]
      const bVal = b[mapping.sortBy!]

      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal)) || 0
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal)) || 0

      return mapping.sortOrder === 'asc' ? aNum - bNum : bNum - aNum
    })
  }

  // Apply limit if specified
  if (mapping.limit && mapping.limit > 0) {
    finalData = finalData.slice(0, mapping.limit)
  }

  return {
    data: finalData,
    metadata: {
      originalRowCount: data.length,
      processedRowCount: finalData.length,
      aggregationType,
      groupedBy: groupByColumns
    }
  }
}

/**
 * Process data for line/area charts with optional trend calculations
 */
export function processLineChartData(
  data: DataRow[],
  mapping: ChartDataMapping
): ProcessedChartData {
  if (!data || data.length === 0) {
    return {
      data: [],
      metadata: {
        originalRowCount: 0,
        processedRowCount: 0
      }
    }
  }

  let processedData = [...data]
  const derivedMetricsApplied: string[] = []

  // Apply derived metrics if specified
  if (mapping.derivedMetrics && mapping.derivedMetrics.length > 0) {
    for (const metric of mapping.derivedMetrics) {
      const result = DataCalculator.calculateDerivedMetric(processedData, metric as DerivedMetricConfig)
      processedData = result.data
      derivedMetricsApplied.push(metric.alias)
    }
  }

  // Apply grouping if specified
  if (mapping.groupBy && mapping.groupBy.length > 0) {
    const xAxis = mapping.xAxis
    const yAxisColumns = Array.isArray(mapping.yAxis) ? mapping.yAxis : [mapping.yAxis].filter(Boolean) as string[]
    const aggregationType = mapping.aggregation || 'avg'

    const result = DataCalculator.groupBy(processedData, {
      columns: mapping.groupBy,
      aggregations: yAxisColumns.map(col => ({
        column: col,
        type: aggregationType,
        alias: col,
        percentile: mapping.percentile
      }))
    })

    processedData = result.data
  }

  return {
    data: processedData,
    metadata: {
      originalRowCount: data.length,
      processedRowCount: processedData.length,
      aggregationType: mapping.aggregation,
      groupedBy: mapping.groupBy,
      derivedMetricsApplied
    }
  }
}

/**
 * Process data for scatter plots with optional derived metrics
 */
export function processScatterChartData(
  data: DataRow[],
  mapping: ChartDataMapping
): ProcessedChartData {
  if (!data || data.length === 0) {
    return {
      data: [],
      metadata: {
        originalRowCount: 0,
        processedRowCount: 0
      }
    }
  }

  let processedData = [...data]
  const derivedMetricsApplied: string[] = []

  // Apply derived metrics for calculated dimensions
  if (mapping.derivedMetrics && mapping.derivedMetrics.length > 0) {
    for (const metric of mapping.derivedMetrics) {
      const result = DataCalculator.calculateDerivedMetric(processedData, metric as DerivedMetricConfig)
      processedData = result.data
      derivedMetricsApplied.push(metric.alias)
    }
  }

  // Apply grouping if needed (for aggregated scatter plots)
  if (mapping.groupBy && mapping.groupBy.length > 0) {
    const xAxis = mapping.xAxis
    const yAxis = Array.isArray(mapping.yAxis) ? mapping.yAxis[0] : mapping.yAxis
    const aggregationType = mapping.aggregation || 'avg'

    if (xAxis && yAxis) {
      const result = DataCalculator.groupBy(processedData, {
        columns: mapping.groupBy,
        aggregations: [
          {
            column: xAxis,
            type: aggregationType,
            alias: xAxis,
            percentile: mapping.percentile
          },
          {
            column: yAxis,
            type: aggregationType,
            alias: yAxis,
            percentile: mapping.percentile
          }
        ]
      })

      processedData = result.data
    }
  }

  return {
    data: processedData,
    metadata: {
      originalRowCount: data.length,
      processedRowCount: processedData.length,
      aggregationType: mapping.aggregation,
      groupedBy: mapping.groupBy,
      derivedMetricsApplied
    }
  }
}

/**
 * Process data for pie charts with aggregation
 */
export function processPieChartData(
  data: DataRow[],
  mapping: ChartDataMapping
): ProcessedChartData {
  if (!data || data.length === 0) {
    return {
      data: [],
      metadata: {
        originalRowCount: 0,
        processedRowCount: 0
      }
    }
  }

  const category = mapping.category || mapping.xAxis
  const value = mapping.value || (Array.isArray(mapping.yAxis) ? mapping.yAxis[0] : mapping.yAxis)

  if (!category || !value) {
    return {
      data,
      metadata: {
        originalRowCount: data.length,
        processedRowCount: data.length
      }
    }
  }

  const aggregationType = mapping.aggregation || 'sum'

  const result = DataCalculator.groupBy(data, {
    columns: [category],
    aggregations: [{
      column: value,
      type: aggregationType,
      alias: value,
      percentile: mapping.percentile
    }]
  })

  // Sort by value descending and apply limit if specified
  let processedData = result.data.sort((a, b) => {
    const aVal = typeof a[value] === 'number' ? a[value] : 0
    const bVal = typeof b[value] === 'number' ? b[value] : 0
    return bVal - aVal
  })

  if (mapping.limit && mapping.limit > 0) {
    processedData = processedData.slice(0, mapping.limit)
  }

  return {
    data: processedData,
    metadata: {
      originalRowCount: data.length,
      processedRowCount: processedData.length,
      aggregationType,
      groupedBy: [category]
    }
  }
}

/**
 * Main chart data processor - routes to appropriate processor based on chart type
 */
export function processChartData(
  data: DataRow[],
  chartType: string,
  mapping: ChartDataMapping
): ProcessedChartData {
  switch (chartType) {
    case 'scorecard':
      return processScoreCardData(data, mapping)

    case 'bar':
    case 'column':
      return processBarChartData(data, mapping)

    case 'line':
    case 'area':
      return processLineChartData(data, mapping)

    case 'scatter':
      return processScatterChartData(data, mapping)

    case 'pie':
    case 'donut':
      return processPieChartData(data, mapping)

    default:
      // For other chart types, return data as-is with basic metadata
      return {
        data,
        metadata: {
          originalRowCount: data.length,
          processedRowCount: data.length
        }
      }
  }
}

/**
 * Helper to generate human-readable description of calculations applied
 */
export function getCalculationDescription(metadata: ProcessedChartData['metadata']): string {
  const parts: string[] = []

  if (metadata.aggregationType) {
    parts.push(`${metadata.aggregationType.toUpperCase()} aggregation`)
  }

  if (metadata.groupedBy && metadata.groupedBy.length > 0) {
    parts.push(`Grouped by ${metadata.groupedBy.join(', ')}`)
  }

  if (metadata.derivedMetricsApplied && metadata.derivedMetricsApplied.length > 0) {
    parts.push(`Calculated: ${metadata.derivedMetricsApplied.join(', ')}`)
  }

  if (parts.length === 0) {
    return 'Raw data'
  }

  return parts.join(' • ')
}

/**
 * Validate that required columns exist in data
 */
export function validateChartDataMapping(
  data: DataRow[],
  mapping: ChartDataMapping
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || data.length === 0) {
    errors.push('No data available')
    return { valid: false, errors }
  }

  const availableColumns = Object.keys(data[0])

  // Check xAxis
  if (mapping.xAxis && !availableColumns.includes(mapping.xAxis)) {
    errors.push(`Column "${mapping.xAxis}" not found in data`)
  }

  // Check yAxis
  const yAxisColumns = Array.isArray(mapping.yAxis) ? mapping.yAxis : [mapping.yAxis].filter(Boolean)
  yAxisColumns.forEach(col => {
    if (col && !availableColumns.includes(col)) {
      errors.push(`Column "${col}" not found in data`)
    }
  })

  // Check category
  if (mapping.category && !availableColumns.includes(mapping.category)) {
    errors.push(`Column "${mapping.category}" not found in data`)
  }

  // Check value
  if (mapping.value && !availableColumns.includes(mapping.value)) {
    errors.push(`Column "${mapping.value}" not found in data`)
  }

  // Check metric
  if (mapping.metric && !availableColumns.includes(mapping.metric)) {
    errors.push(`Column "${mapping.metric}" not found in data`)
  }

  // Check groupBy columns
  if (mapping.groupBy) {
    mapping.groupBy.forEach(col => {
      if (!availableColumns.includes(col)) {
        errors.push(`Group by column "${col}" not found in data`)
      }
    })
  }

  // Check derived metrics
  if (mapping.derivedMetrics) {
    mapping.derivedMetrics.forEach(metric => {
      if (metric.column && !availableColumns.includes(metric.column)) {
        errors.push(`Derived metric column "${metric.column}" not found in data`)
      }
      if (metric.numerator && !availableColumns.includes(metric.numerator)) {
        errors.push(`Derived metric numerator "${metric.numerator}" not found in data`)
      }
      if (metric.denominator && !availableColumns.includes(metric.denominator)) {
        errors.push(`Derived metric denominator "${metric.denominator}" not found in data`)
      }
    })
  }

  return { valid: errors.length === 0, errors }
}
