/**
 * Chart field validation utilities
 * Determines which field types are allowed for different chart types and axes
 */

export type FieldType = 'string' | 'number' | 'date' | 'categorical' | 'boolean'
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' |
                        'table' | 'combo' | 'waterfall' | 'heatmap' | 'gauge' |
                        'cohort' | 'bullet' | 'treemap' | 'sparkline'

interface FieldRequirement {
  allowNumeric: boolean
  allowCategorical: boolean
  allowDate: boolean
  preferredTypes?: FieldType[]
}

/**
 * Determines if a field type is allowed for a specific chart axis/field
 * Philosophy: Be permissive by default, let the chart renderer handle edge cases
 */
export function isFieldAllowedForChart(
  chartType: ChartType,
  fieldRole: 'xAxis' | 'yAxis' | 'yAxis1' | 'yAxis2' | 'category' | 'value' | 'metric' | 'dimension' | 'source' | 'target',
  fieldType: string
): boolean {
  // Convert string type to our field type
  const normalizedType = normalizeFieldType(fieldType)

  // Special cases where we need specific field types
  const strictRequirements: Record<string, Record<string, FieldRequirement>> = {
    gauge: {
      value: { allowNumeric: true, allowCategorical: false, allowDate: false },
      metric: { allowNumeric: true, allowCategorical: false, allowDate: false }
    },
    bullet: {
      actual: { allowNumeric: true, allowCategorical: false, allowDate: false },
      comparative: { allowNumeric: true, allowCategorical: false, allowDate: false },
      target: { allowNumeric: true, allowCategorical: false, allowDate: false }
    },
    scorecard: {
      metric: { allowNumeric: true, allowCategorical: false, allowDate: false },
      value: { allowNumeric: true, allowCategorical: false, allowDate: false }
    }
  }

  // Check if this chart/field combo has strict requirements
  if (strictRequirements[chartType]?.[fieldRole]) {
    const req = strictRequirements[chartType][fieldRole]
    if (normalizedType === 'number' && req.allowNumeric) return true
    if ((normalizedType === 'string' || normalizedType === 'categorical') && req.allowCategorical) return true
    if (normalizedType === 'date' && req.allowDate) return true
    return false
  }

  // Default permissive approach for most charts
  // Let users experiment - the chart renderer will handle invalid combinations gracefully

  // For Y-axes, we're generally more flexible now
  if (fieldRole === 'yAxis' || fieldRole === 'yAxis1' || fieldRole === 'yAxis2') {
    // These chart types can handle categorical Y-axes well
    if (['bar', 'combo', 'heatmap', 'scatter', 'cohort'].includes(chartType)) {
      return true // Allow all field types
    }

    // Line and area charts work best with numeric but can handle categorical for discrete points
    if (['line', 'area', 'sparkline'].includes(chartType)) {
      return true // Allow experimentation
    }

    // Default: allow all
    return true
  }

  // X-axis and category fields - always allow all types
  if (fieldRole === 'xAxis' || fieldRole === 'category' || fieldRole === 'dimension') {
    return true
  }

  // Value fields typically prefer numeric but can work with counts
  if (fieldRole === 'value') {
    // Pie, treemap, etc. can count occurrences if no numeric field
    if (['pie', 'treemap', 'waterfall'].includes(chartType)) {
      return true
    }
    // For others, prefer numeric but don't restrict
    return true
  }

  // Source/target for flow charts - typically categorical
  if (fieldRole === 'source' || fieldRole === 'target') {
    return true
  }

  // Default: be permissive
  return true
}

/**
 * Normalize field type strings to our internal representation
 */
function normalizeFieldType(fieldType: string): FieldType {
  const type = fieldType.toLowerCase()
  if (type === 'number' || type === 'numeric' || type === 'integer' || type === 'float' || type === 'decimal') {
    return 'number'
  }
  if (type === 'date' || type === 'datetime' || type === 'timestamp') {
    return 'date'
  }
  if (type === 'boolean' || type === 'bool') {
    return 'boolean'
  }
  if (type === 'categorical' || type === 'category') {
    return 'categorical'
  }
  // Default to string for text types
  return 'string'
}

/**
 * Get helpful text for what field types are recommended
 */
export function getFieldTypeHelpText(
  chartType: ChartType,
  fieldRole: string
): string {
  // Special messages for specific chart/field combinations
  if (chartType === 'gauge' && (fieldRole === 'value' || fieldRole === 'metric')) {
    return 'Numeric fields required for gauge values'
  }

  if (chartType === 'bullet' && ['actual', 'comparative', 'target'].includes(fieldRole)) {
    return 'Numeric fields required for bullet chart metrics'
  }

  if (chartType === 'scorecard' && (fieldRole === 'metric' || fieldRole === 'value')) {
    return 'Numeric fields required for scorecard values'
  }

  // General helpful messages
  if (fieldRole === 'yAxis' || fieldRole === 'yAxis1' || fieldRole === 'yAxis2') {
    if (['bar', 'combo'].includes(chartType)) {
      return 'Drag any field - numeric for values, text for categories'
    }
    if (['line', 'area', 'sparkline'].includes(chartType)) {
      return 'Works best with numeric fields, but categorical is supported'
    }
    return 'Drag any field from the left'
  }

  if (fieldRole === 'xAxis' || fieldRole === 'category') {
    return 'Drag any field for grouping or categories'
  }

  if (fieldRole === 'value') {
    if (['pie', 'treemap'].includes(chartType)) {
      return 'Optional: numeric for values, or leave empty to count occurrences'
    }
    return 'Drag numeric fields for values'
  }

  return 'Drag fields from the left'
}