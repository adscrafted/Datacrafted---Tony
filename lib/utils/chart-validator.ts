import { ChartConfig, DataRow } from '@/lib/store'

interface ChartValidationResult {
  isValid: boolean
  reason?: string
  suggestions?: string[]
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

  // Extract the data keys
  const dataKeys = Array.isArray(chartConfig.dataKey) 
    ? chartConfig.dataKey 
    : [chartConfig.dataKey]

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
      // Scorecards need at least one numeric value
      const scorecardValue = data[0]?.[dataKeys[0]]
      if (scorecardValue === null || scorecardValue === undefined || isNaN(Number(scorecardValue))) {
        return {
          isValid: false,
          reason: 'Scorecard requires a numeric value',
          suggestions: ['Select a numeric field for the scorecard']
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
      const values = data.map(row => Number(row[dataKeys[1]]))
      const nonZeroValues = values.filter(v => !isNaN(v) && v !== 0)
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
        data.map(row => Number(row[key]))
      ).filter(v => !isNaN(v))
      
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
      
      // Check if we have mostly zeros (more than 90%)
      const nonZeroLineValues = lineValues.filter(v => v !== 0)
      if (nonZeroLineValues.length < lineValues.length * 0.1) {
        return {
          isValid: false,
          reason: 'Data is mostly zeros',
          suggestions: ['This metric has insufficient variation for meaningful visualization']
        }
      }
      break

    case 'bar':
      // Bar charts need at least some variation
      const barValues = dataKeys.flatMap(key => 
        data.map(row => Number(row[key]))
      ).filter(v => !isNaN(v))
      
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
      
      // Check if all points are at the same location
      const xValues = data.map(row => Number(row[dataKeys[0]])).filter(v => !isNaN(v))
      const yValues = data.map(row => Number(row[dataKeys[1]])).filter(v => !isNaN(v))
      
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
  return chartConfigs.filter(config => {
    const validation = validateChartData(config, data)
    if (!validation.isValid) {
      console.log(`📊 [CHART-VALIDATOR] Filtering out invalid chart:`, {
        title: config.title,
        type: config.type,
        reason: validation.reason
      })
    }
    return validation.isValid
  })
}