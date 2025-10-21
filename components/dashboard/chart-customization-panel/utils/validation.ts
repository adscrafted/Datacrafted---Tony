/**
 * Validation logic for chart data mappings
 * Ensures required fields are configured before generating charts
 */

import type { ChartType, DataMapping, ValidationResult } from '../types'

/**
 * Validate chart data mapping based on chart type
 * Returns validation result with specific error messages
 */
export function validateChartMapping(
  chartType: ChartType,
  mapping: DataMapping
): ValidationResult {
  let isValid = false
  let missingFields = ''

  console.log('🔍 [VALIDATION] Validating chart:', {
    chartType,
    mapping,
    hasMapping: Object.keys(mapping).length > 0
  })

  switch (chartType) {
    case 'line':
    case 'bar':
      isValid = !!(mapping.xAxis || mapping.category)
      if (!isValid) missingFields = 'Please select an X-axis field'
      break

    case 'area':
      // Area charts need both X-axis AND Y-axis
      const hasXAxisArea = !!(mapping.xAxis || mapping.category)
      const hasYAxisArea = !!(mapping.yAxis || mapping.yAxis1 || mapping.values)
      isValid = hasXAxisArea && hasYAxisArea
      if (!hasXAxisArea) missingFields = 'Please select an X-axis field'
      else if (!hasYAxisArea) missingFields = 'Please select a Y-axis field'
      break

    case 'scatter':
      // Scatter charts need both X-axis AND Y-axis
      const hasXAxisScatter = !!(mapping.xAxis || mapping.category)
      const hasYAxisScatter = !!(mapping.yAxis || mapping.yAxis1 || mapping.values)
      isValid = hasXAxisScatter && hasYAxisScatter
      if (!hasXAxisScatter) missingFields = 'Please select an X-axis field'
      else if (!hasYAxisScatter) missingFields = 'Please select a Y-axis field'
      break

    case 'pie':
      isValid = !!mapping.category
      if (!isValid) missingFields = 'Please select a category field'
      break

    case 'scorecard':
      isValid = !!mapping.metric
      if (!isValid) missingFields = 'Please select a metric field'
      break

    case 'table':
      isValid = !!(mapping.columns && mapping.columns.length > 0) || !!mapping.yAxis
      if (!isValid) missingFields = 'Please select at least one column'
      break

    case 'combo':
      isValid = !!(mapping.xAxis && (mapping.yAxis || mapping.yAxis1))
      if (!mapping.xAxis) missingFields = 'Please select an X-axis field'
      else if (!mapping.yAxis && !mapping.yAxis1) missingFields = 'Please select at least one Y-axis field'
      break

    case 'waterfall':
      isValid = !!(mapping.category && mapping.value)
      if (!mapping.category) missingFields = 'Please select a category field'
      else if (!mapping.value) missingFields = 'Please select a value field'
      break

    case 'heatmap':
      isValid = !!(mapping.xAxis && mapping.yAxis && mapping.value)
      if (!mapping.xAxis) missingFields = 'Please select an X-axis field'
      else if (!mapping.yAxis) missingFields = 'Please select a Y-axis field'
      else if (!mapping.value) missingFields = 'Please select a value field'
      break

    case 'gauge':
      isValid = !!mapping.metric
      if (!isValid) missingFields = 'Please select a metric field'
      break

    case 'cohort':
      isValid = !!(mapping.cohort && mapping.period && mapping.value)
      if (!mapping.cohort) missingFields = 'Please select a cohort field'
      else if (!mapping.period) missingFields = 'Please select a period field'
      else if (!mapping.value) missingFields = 'Please select a value field'
      break

    case 'bullet':
      isValid = !!(mapping.actual && mapping.comparative)
      if (!mapping.actual) missingFields = 'Please select an actual field'
      else if (!mapping.comparative) missingFields = 'Please select a comparative field'
      break

    case 'treemap':
      isValid = !!(mapping.category && mapping.value)
      if (!mapping.category) missingFields = 'Please select a category field'
      else if (!mapping.value) missingFields = 'Please select a value field'
      break

    case 'sparkline':
      isValid = !!mapping.trend
      if (!isValid) missingFields = 'Please select a trend field'
      break

    default:
      isValid = true
  }

  if (!isValid) {
    console.warn('⚠️ [VALIDATION] Validation failed:', missingFields)
  } else {
    console.log('✅ [VALIDATION] Validation passed')
  }

  return { isValid, missingFields }
}

/**
 * Get required fields for a chart type
 * Useful for UI hints and documentation
 */
export function getRequiredFields(chartType: ChartType): string[] {
  const requiredFieldsMap: Record<ChartType, string[]> = {
    line: ['xAxis'],
    bar: ['xAxis'],
    area: ['xAxis', 'yAxis'],
    scatter: ['xAxis', 'yAxis'],
    pie: ['category'],
    scorecard: ['metric'],
    table: ['columns'],
    combo: ['xAxis', 'yAxis'],
    waterfall: ['category', 'value'],
    heatmap: ['xAxis', 'yAxis', 'value'],
    gauge: ['metric'],
    cohort: ['cohort', 'period', 'value'],
    bullet: ['actual', 'comparative'],
    treemap: ['category', 'value'],
    sankey: ['source', 'target', 'value'],
    sparkline: ['trend']
  }

  return requiredFieldsMap[chartType] || []
}

/**
 * Get optional fields for a chart type
 */
export function getOptionalFields(chartType: ChartType): string[] {
  const optionalFieldsMap: Record<ChartType, string[]> = {
    line: ['yAxis', 'aggregation'],
    bar: ['yAxis', 'aggregation', 'sortBy', 'sortOrder', 'limit'],
    area: ['aggregation'],
    scatter: ['size', 'color'],
    pie: ['value'],
    scorecard: [],
    table: [],
    combo: ['yAxis2'],
    waterfall: ['type'],
    heatmap: [],
    gauge: ['aggregation', 'max', 'min'],
    cohort: [],
    bullet: ['category'],
    treemap: [],
    sankey: [],
    sparkline: []
  }

  return optionalFieldsMap[chartType] || []
}
