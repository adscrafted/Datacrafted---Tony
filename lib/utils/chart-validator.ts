import type { ChartConfig } from '@/lib/types/chart-types'
import type { DataRow } from '@/lib/store'
import { parseNumericValue } from './data-calculations'

interface ChartValidationResult {
  isValid: boolean
  reason?: string
  suggestions?: string[]
  errors?: string[]
  warnings?: string[]
}

/**
 * Validates chart configuration structure and required fields
 */
export function validateChartConfig(config: ChartConfig): ChartValidationResult {
  const dm = (config as any).dataMapping

  // Allow charts with empty dataMapping (unconfigured charts will show placeholder)
  if (!dm || Object.keys(dm).length === 0) {
    return {
      isValid: true, // Allow unconfigured charts to be added
      warnings: ['Chart needs data configuration']
    }
  }

  switch ((config as any).type) {
    case 'funnel':
      if (!dm.stage) {
        return { isValid: false, errors: ['Funnel chart requires stage field in dataMapping'] }
      }
      if (!dm.value) {
        return { isValid: false, errors: ['Funnel chart requires value field in dataMapping'] }
      }
      break

    case 'heatmap':
      if (!dm.xAxis) {
        return { isValid: false, errors: ['Heatmap requires xAxis field in dataMapping'] }
      }
      if (!dm.yAxis) {
        return { isValid: false, errors: ['Heatmap requires yAxis field in dataMapping'] }
      }
      if (!dm.value) {
        return { isValid: false, errors: ['Heatmap requires value field in dataMapping'] }
      }
      break

    case 'gauge':
      if (!dm.metric) {
        return { isValid: false, errors: ['Gauge chart requires metric field in dataMapping'] }
      }
      break

    case 'cohort':
      if (!dm.cohort) {
        return { isValid: false, errors: ['Cohort chart requires cohort field in dataMapping'] }
      }
      if (!dm.period) {
        return { isValid: false, errors: ['Cohort chart requires period field in dataMapping'] }
      }
      if (!dm.retention) {
        return { isValid: false, errors: ['Cohort chart requires retention field in dataMapping'] }
      }
      break

    case 'bullet':
      if (!dm.actual && !dm.metric) {
        return { isValid: false, errors: ['Bullet chart requires actual or metric field in dataMapping'] }
      }
      break

    case 'treemap':
      if (!dm.category) {
        return { isValid: false, errors: ['Treemap requires category field in dataMapping'] }
      }
      if (!dm.value) {
        return { isValid: false, errors: ['Treemap requires value field in dataMapping'] }
      }
      break

    case 'sparkline':
      if (!dm.xAxis) {
        return { isValid: false, errors: ['Sparkline requires xAxis field in dataMapping'] }
      }
      if (!dm.yAxis) {
        return { isValid: false, errors: ['Sparkline requires yAxis field in dataMapping'] }
      }
      break
  }

  return { isValid: true }
}


/**
 * Validates if a chart has meaningful data to display
 */
export function validateChartData(
  chartConfig: ChartConfig,
  data: DataRow[]
): ChartValidationResult {
  // Check if data exists
  if (!data || data.length === 0) {
    return {
      isValid: false,
      reason: 'No data available',
      suggestions: ['Upload a dataset to see visualizations']
    }
  }

  // Extract the data keys from dataMapping (new format) or dataKey (legacy)
  let dataKeys: string[] = []

  if ((chartConfig as any).dataMapping) {
    const dm = (chartConfig as any).dataMapping
    switch ((chartConfig as any).type) {
      case 'bar':
        if (dm.category) dataKeys.push(dm.category)
        if (dm.values) dataKeys.push(...(Array.isArray(dm.values) ? dm.values : [dm.values]))
        break
      case 'line':
      case 'area':
        if (dm.xAxis) dataKeys.push(dm.xAxis)
        if (dm.yAxis) {
          const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
          dataKeys.push(...yValues)
        }
        break
      case 'pie':
        if (dm.category) dataKeys.push(dm.category)
        if (dm.value) dataKeys.push(dm.value)
        break
      case 'scorecard':
        if (dm.metric) dataKeys.push(dm.metric)
        if (dm.comparison) dataKeys.push(dm.comparison)
        break
      case 'scatter':
        if (dm.xAxis) dataKeys.push(dm.xAxis)
        if (dm.yAxis) dataKeys.push(dm.yAxis as string)
        if (dm.size) dataKeys.push(dm.size)
        if (dm.color) dataKeys.push(dm.color)
        break
      case 'table':
        if (dm.columns) dataKeys.push(...dm.columns)
        break
      case 'combo':
        // Combo charts combine line and bar data
        if (dm.xAxis) dataKeys.push(dm.xAxis)
        if (dm.yAxis) {
          const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
          dataKeys.push(...yValues)
        }
        if (dm.yAxis2) {
          const y2Values = Array.isArray(dm.yAxis2) ? dm.yAxis2 : [dm.yAxis2]
          dataKeys.push(...y2Values)
        }
        break
      case 'waterfall':
        if (dm.category) dataKeys.push(dm.category)
        if (dm.value) dataKeys.push(dm.value)
        break
      case 'funnel':
        if (dm.stage) dataKeys.push(dm.stage)
        if (dm.value) dataKeys.push(dm.value)
        break
      case 'heatmap':
        if (dm.xAxis) dataKeys.push(dm.xAxis)
        if (dm.yAxis) dataKeys.push(dm.yAxis as string)
        if (dm.value) dataKeys.push(dm.value)
        break
      case 'gauge':
        if (dm.metric) dataKeys.push(dm.metric)
        break
      case 'cohort':
        if (dm.cohort) dataKeys.push(dm.cohort)
        if (dm.period) dataKeys.push(dm.period)
        if (dm.retention) dataKeys.push(dm.retention)
        break
      case 'bullet':
        if (dm.actual) dataKeys.push(dm.actual)
        if (dm.metric) dataKeys.push(dm.metric)
        break
      case 'treemap':
        if (dm.category) dataKeys.push(dm.category)
        if (dm.value) dataKeys.push(dm.value)
        break
      case 'sparkline':
        if (dm.xAxis) dataKeys.push(dm.xAxis)
        if (dm.yAxis) {
          const yValues = Array.isArray(dm.yAxis) ? dm.yAxis : [dm.yAxis]
          dataKeys.push(...yValues)
        }
        break
    }
  } else if ((chartConfig as any).dataKey) {
    // Fallback to legacy format
    dataKeys = Array.isArray((chartConfig as any).dataKey)
      ? (chartConfig as any).dataKey
      : [(chartConfig as any).dataKey]
  }

  // If no dataKeys extracted, chart is unconfigured but still valid (will show placeholder)
  if (dataKeys.length === 0) {
    return {
      isValid: true, // Allow unconfigured charts to appear as placeholders
      warnings: ['Chart needs data configuration'],
      reason: 'No data fields configured for this chart',
      suggestions: ['Configure dataMapping or dataKey for the chart']
    }
  }

  // Check if all required data keys exist in the data
  const firstRow = data[0]
  const missingKeys = dataKeys.filter(key => !(key in firstRow))
  if (missingKeys.length > 0) {
    return {
      isValid: false,
      reason: `Missing data fields: ${missingKeys.join(', ')}`,
      suggestions: ['Check if the data structure matches the chart configuration']
    }
  }

  // Type-specific validations
  switch ((chartConfig as any).type) {
    case 'scorecard':
      // Scorecards need at least SOME numeric values (not necessarily in first row)
      // Check if any row has a valid numeric value for the metric
      const scorecardValues = data.map(row => parseNumericValue(row[dataKeys[0]])).filter(v => v !== null)
      if (scorecardValues.length === 0) {
        return {
          isValid: false,
          reason: 'Scorecard requires numeric values',
          suggestions: ['Select a field with numeric data for the scorecard']
        }
      }
      break

    case 'pie':
      // Pie charts need categorical data with numeric values
      if (dataKeys.length < 2) {
        return {
          isValid: false,
          reason: 'Pie chart requires both category and value fields',
          suggestions: ['Configure both label and value fields for the pie chart']
        }
      }
      
      // Check if we have meaningful categories (not all the same)
      const categories = data.map(row => row[dataKeys[0]])
      const uniqueCategories = new Set(categories)
      if (uniqueCategories.size === 1) {
        return {
          isValid: false,
          reason: 'All data points have the same category',
          suggestions: ['Pie charts need multiple categories to be meaningful']
        }
      }
      
      // Check if values are numeric and not all zero
      const values = data.map(row => parseNumericValue(row[dataKeys[1]])).filter(v => v !== null)
      const nonZeroValues = values.filter(v => v !== 0)
      if (nonZeroValues.length === 0) {
        return {
          isValid: false,
          reason: 'All values are zero or non-numeric',
          suggestions: ['Ensure the value field contains numeric data']
        }
      }
      break

    case 'line':
    case 'area':
      // Time series charts need sequential data
      if (data.length < 2) {
        return {
          isValid: false,
          reason: `${(chartConfig as any).type} chart needs at least 2 data points`,
          suggestions: ['Add more data points for meaningful visualization']
        }
      }
      
      // Check if all values are the same (flat line) or all zero
      const lineValues = dataKeys.flatMap(key =>
        data.map(row => parseNumericValue(row[key]))
      ).filter(v => v !== null)
      
      const uniqueLineValues = new Set(lineValues)
      if (uniqueLineValues.size === 1) {
        const value = Array.from(uniqueLineValues)[0]
        if (value === 0) {
          return {
            isValid: false,
            reason: 'All values are zero',
            suggestions: ['This metric has no data to visualize']
          }
        }
        return {
          isValid: false,
          reason: 'All data points have the same value',
          suggestions: ['Line charts are not meaningful when all values are identical']
        }
      }
      
      // Only reject if ALL values are zero (some zeros is normal for real-world data)
      const nonZeroLineValues = lineValues.filter(v => v !== 0)
      if (nonZeroLineValues.length === 0) {
        return {
          isValid: false,
          reason: 'All values are zero',
          suggestions: ['This metric has no data to visualize']
        }
      }
      break

    case 'bar':
      // Bar charts need at least some variation
      const barValues = dataKeys.flatMap(key =>
        data.map(row => parseNumericValue(row[key]))
      ).filter(v => v !== null)

      if (barValues.length === 0) {
        return {
          isValid: false,
          reason: 'No numeric values found',
          suggestions: ['Select numeric fields for bar chart visualization']
        }
      }

      // Check if all values are zero
      if (barValues.every(v => v === 0)) {
        return {
          isValid: false,
          reason: 'All values are zero',
          suggestions: ['Bar charts with all zero values provide no insight']
        }
      }
      break

    case 'scatter':
      // Scatter plots need at least 2 numeric dimensions
      if (dataKeys.length < 2) {
        return {
          isValid: false,
          reason: 'Scatter plot requires at least 2 numeric fields',
          suggestions: ['Configure both X and Y axis fields']
        }
      }
      
      // Check if we have enough data points
      if (data.length < 3) {
        return {
          isValid: false,
          reason: 'Scatter plot needs at least 3 data points',
          suggestions: ['Add more data points for meaningful patterns']
        }
      }
      
      // Check if we have enough valid numeric values (not nulls)
      const xValues = data.map(row => parseNumericValue(row[dataKeys[0]])).filter(v => v !== null)
      const yValues = data.map(row => parseNumericValue(row[dataKeys[1]])).filter(v => v !== null)

      if (xValues.length < 3 || yValues.length < 3) {
        return {
          isValid: false,
          reason: 'Not enough valid numeric values',
          suggestions: ['Scatter plots need numeric data with fewer null values']
        }
      }

      // Check if all points are at the same location
      const uniqueXValues = new Set(xValues)
      const uniqueYValues = new Set(yValues)

      if (uniqueXValues.size === 1 && uniqueYValues.size === 1) {
        return {
          isValid: false,
          reason: 'All data points are at the same location',
          suggestions: ['Scatter plots need variation in data to show patterns']
        }
      }
      break

    case 'combo':
      // Combo charts combine line and bar, similar validation to line charts
      if (data.length < 2) {
        return {
          isValid: false,
          reason: 'Combo chart needs at least 2 data points',
          suggestions: ['Add more data points for meaningful visualization']
        }
      }

      // Check if we have numeric values for the axes
      const comboValues = dataKeys.flatMap(key =>
        data.map(row => parseNumericValue(row[key]))
      ).filter(v => v !== null)

      if (comboValues.length === 0) {
        return {
          isValid: false,
          reason: 'No numeric values found',
          suggestions: ['Combo charts require numeric data fields']
        }
      }

      // Only reject if ALL values are zero (some zeros is normal for real-world data)
      const nonZeroComboValues = comboValues.filter(v => v !== 0)
      if (nonZeroComboValues.length === 0) {
        return {
          isValid: false,
          reason: 'All values are zero',
          suggestions: ['This metric has no data to visualize']
        }
      }
      break

    case 'waterfall':
      // Waterfall charts need at least 2 data points (start and end values)
      if (data.length < 2) {
        return {
          isValid: false,
          reason: 'Waterfall chart needs at least 2 data points',
          suggestions: ['Add more sequential steps for waterfall visualization']
        }
      }

      // Check if value field contains numeric data
      const waterfallValueKey = dataKeys.find(key => key.toLowerCase().includes('value') || key.toLowerCase().includes('amount'))
        || dataKeys[dataKeys.length - 1]

      const waterfallValues = data.map(row => parseNumericValue(row[waterfallValueKey])).filter(v => v !== null)

      if (waterfallValues.length === 0) {
        return {
          isValid: false,
          reason: 'Waterfall chart requires numeric value field',
          suggestions: ['Ensure the value column contains numeric data']
        }
      }

      // Check if we have category labels
      const waterfallCategoryKey = dataKeys[0]
      const waterfallCategories = data.map(row => row[waterfallCategoryKey]).filter(Boolean)

      if (waterfallCategories.length === 0) {
        return {
          isValid: false,
          reason: 'Waterfall chart requires category labels',
          suggestions: ['Ensure each step has a descriptive label']
        }
      }
      break

    case 'table':
      // Tables are always valid as long as we have data
      if (data.length === 0) {
        return {
          isValid: false,
          reason: 'No data to display in table',
          suggestions: ['Tables need at least one row of data']
        }
      }
      
      // Tables should have at least 2 columns to be meaningful
      if (dataKeys.length < 2) {
        return {
          isValid: false,
          reason: 'Table needs at least 2 columns',
          suggestions: ['Select multiple fields to create a meaningful table']
        }
      }
      break
  }

  // Additional check for empty data keys
  const hasAnyData = dataKeys.some(key => 
    data.some(row => row[key] !== null && row[key] !== undefined && row[key] !== '')
  )
  
  if (!hasAnyData) {
    return {
      isValid: false,
      reason: 'Selected fields contain no data',
      suggestions: ['Choose fields that contain actual values']
    }
  }

  return { isValid: true }
}

/**
 * Filters out invalid charts from the analysis
 */
export function filterValidCharts(
  chartConfigs: ChartConfig[],
  data: DataRow[]
): ChartConfig[] {
  // Defensive: return empty array if inputs are invalid
  if (!chartConfigs || !Array.isArray(chartConfigs)) {
    console.warn('⚠️ [CHART_VALIDATOR] Invalid chartConfigs provided:', chartConfigs)
    return []
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('⚠️ [CHART_VALIDATOR] Invalid or empty data provided')
    return []
  }

  console.log('🔍 [CHART_VALIDATOR] Starting chart validation:', {
    totalCharts: chartConfigs.length,
    chartTypes: chartConfigs.map(c => (c as any).type).join(', ')
  })

  const validCharts = chartConfigs.filter((config, index) => {
    const validation = validateChartData(config, data)

    console.log(`🔍 [CHART_VALIDATOR] Chart ${index} (${(config as any).type} - "${(config as any).title}"):`, {
      isValid: validation.isValid,
      reason: validation.reason,
      suggestions: validation.suggestions,
      dataKey: (config as any).dataKey,
      dataMapping: (config as any).dataMapping
    })

    return validation.isValid
  })

  console.log('✅ [CHART_VALIDATOR] Validation complete:', {
    totalCharts: chartConfigs.length,
    validCharts: validCharts.length,
    filteredOut: chartConfigs.length - validCharts.length,
    validChartTypes: validCharts.map(c => (c as any).type).join(', ')
  })

  return validCharts
}