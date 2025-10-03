import { ChartConfig, DataRow } from '@/lib/store'

interface ChartValidationResult {
  isValid: boolean
  reason?: string
  suggestions?: string[]
}

/**
 * Parses numeric values including currency-formatted strings
 * Handles: € 0, € 50.00, $1,234.56, £100, ¥1000, 50%, etc.
 */
function parseNumericValue(value: any): number | null {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null

  // Remove currency symbols, commas, spaces, and percentages
  const cleaned = value.replace(/[€$£¥,\s%]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
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
    switch (chartConfig.type) {
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
    }
  } else if (chartConfig.dataKey) {
    // Fallback to legacy format
    dataKeys = Array.isArray(chartConfig.dataKey)
      ? chartConfig.dataKey
      : [chartConfig.dataKey]
  }

  // If no dataKeys extracted, chart is invalid
  if (dataKeys.length === 0) {
    return {
      isValid: false,
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
  switch (chartConfig.type) {
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
          reason: `${chartConfig.type} chart needs at least 2 data points`,
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
  console.log('🔍 [CHART_VALIDATOR] Starting chart validation:', {
    totalCharts: chartConfigs.length,
    chartTypes: chartConfigs.map(c => c.type).join(', ')
  })

  const validCharts = chartConfigs.filter((config, index) => {
    const validation = validateChartData(config, data)

    console.log(`🔍 [CHART_VALIDATOR] Chart ${index} (${config.type} - "${config.title}"):`, {
      isValid: validation.isValid,
      reason: validation.reason,
      suggestions: validation.suggestions,
      dataKey: config.dataKey,
      dataMapping: (config as any).dataMapping
    })

    return validation.isValid
  })

  console.log('✅ [CHART_VALIDATOR] Validation complete:', {
    totalCharts: chartConfigs.length,
    validCharts: validCharts.length,
    filteredOut: chartConfigs.length - validCharts.length,
    validChartTypes: validCharts.map(c => c.type).join(', ')
  })

  return validCharts
}