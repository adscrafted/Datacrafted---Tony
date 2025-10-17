/**
 * Intelligent field mapping logic for chart type transitions
 * Maps existing fields to appropriate fields when changing chart types
 */

import { ChartType, DataMapping } from '../types'

/**
 * Intelligently map existing fields when changing chart types
 * Preserves as much existing configuration as possible
 */
export function mapFieldsForChartType(
  newChartType: ChartType,
  currentMapping: DataMapping
): DataMapping {
  let newMapping: DataMapping = {}

  switch (newChartType) {
    case 'funnel':
      // Map xAxis/category → stage, yAxis/value → value
      newMapping = {
        stage: currentMapping.xAxis || currentMapping.category || currentMapping.stage,
        value: currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
      }
      break

    case 'waterfall':
      // Map xAxis/category → category, yAxis/value → value
      newMapping = {
        category: currentMapping.xAxis || currentMapping.category,
        value: currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
      }
      break

    case 'gauge':
      // Map metric/yAxis/value → value
      newMapping = {
        value: currentMapping.metric || currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
      }
      break

    case 'heatmap':
      // Map xAxis → xAxis, yAxis → yAxis, value → value
      newMapping = {
        xAxis: currentMapping.xAxis || currentMapping.category,
        yAxis: currentMapping.yAxis || currentMapping.metric,
        value: currentMapping.value || currentMapping.values?.[0]
      }
      break

    case 'treemap':
      // Map xAxis/category → category, yAxis/value → value
      newMapping = {
        category: currentMapping.xAxis || currentMapping.category,
        value: currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
      }
      break

    case 'bullet':
      // Map metrics to actual/comparative
      newMapping = {
        actual: currentMapping.actual || currentMapping.metric || currentMapping.yAxis,
        comparative: currentMapping.comparative || currentMapping.target
      }
      break

    case 'cohort':
      // Try to preserve cohort fields
      newMapping = {
        cohort: currentMapping.cohort || currentMapping.xAxis,
        period: currentMapping.period || currentMapping.category,
        value: currentMapping.value || currentMapping.yAxis
      }
      break

    case 'sparkline':
      // Map xAxis/trend → trend
      newMapping = {
        trend: currentMapping.trend || currentMapping.xAxis || currentMapping.metric
      }
      break

    case 'pie':
      // Map xAxis/category → category, yAxis/value → value
      newMapping = {
        category: currentMapping.xAxis || currentMapping.category,
        value: currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
      }
      break

    case 'scorecard':
      // Map yAxis/value → metric
      newMapping = {
        metric: currentMapping.metric || currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
      }
      break

    case 'table':
      // Preserve columns if they exist, otherwise use all available fields
      newMapping = {
        columns: currentMapping.columns
      }
      break

    default:
      // For standard charts (bar, line, area, scatter, combo), preserve existing mapping
      newMapping = currentMapping
      break
  }

  // Only include fields that have values
  const cleanedMapping = Object.entries(newMapping)
    .filter(([_, value]) => value !== undefined && value !== null)
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

  console.log('🔄 [FIELD_MAPPING] Chart type change:', {
    newChartType,
    oldMapping: currentMapping,
    newMapping: cleanedMapping
  })

  return cleanedMapping
}

/**
 * Get user-friendly field name for UI display
 */
export function getFieldLabel(fieldKey: string): string {
  const labels: Record<string, string> = {
    xAxis: 'X-Axis',
    yAxis: 'Y-Axis',
    yAxis1: 'Left Y-Axis',
    yAxis2: 'Right Y-Axis',
    category: 'Category',
    value: 'Value',
    values: 'Values',
    metric: 'Metric',
    stage: 'Stage',
    cohort: 'Cohort',
    period: 'Period',
    actual: 'Actual',
    comparative: 'Comparative',
    source: 'Source',
    target_node: 'Target',
    trend: 'Trend',
    size: 'Size',
    color: 'Color',
    columns: 'Columns',
    aggregation: 'Aggregation',
    sortBy: 'Sort By',
    sortOrder: 'Sort Order',
    limit: 'Limit'
  }

  return labels[fieldKey] || fieldKey
}

/**
 * Check if a field accepts multiple values
 */
export function isMultiValueField(fieldKey: string): boolean {
  return ['yAxis', 'yAxis1', 'yAxis2', 'values', 'columns'].includes(fieldKey)
}

/**
 * Check if a field requires numeric type
 */
export function requiresNumericType(fieldKey: string): boolean {
  return ['yAxis', 'yAxis1', 'yAxis2', 'value', 'values', 'metric', 'size', 'actual', 'comparative', 'trend'].includes(fieldKey)
}
