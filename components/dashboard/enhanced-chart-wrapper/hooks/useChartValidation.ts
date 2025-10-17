import React from 'react'
import { ChartType } from '@/lib/store'

interface UseChartValidationOptions {
  effectiveChartType: ChartType
  customization: any
  configDataMapping: any
}

/**
 * Hook to check if chart has been configured with proper data mapping
 * Returns true if chart has required fields configured based on chart type
 */
export function useChartValidation({
  effectiveChartType,
  customization,
  configDataMapping
}: UseChartValidationOptions): boolean {
  return React.useMemo(() => {
    // Merge original config with customizations
    const effectiveMapping = {
      ...configDataMapping,
      ...customization?.dataMapping
    }

    // If both are empty, chart is not configured
    if (!effectiveMapping || Object.keys(effectiveMapping).length === 0) {
      return false
    }

    // Check if required fields are configured based on chart type
    switch (effectiveChartType) {
      case 'line':
      case 'bar':
        return !!(effectiveMapping.xAxis || effectiveMapping.category)
      case 'area':
        // Area charts need both X-axis AND Y-axis configured
        // Check for Y-axis in multiple formats: yAxis, yAxis1, or values
        const hasXAxis = !!(effectiveMapping.xAxis || effectiveMapping.category)
        const hasYAxis = !!(effectiveMapping.yAxis || effectiveMapping.yAxis1 || effectiveMapping.values)
        return hasXAxis && hasYAxis
      case 'scatter':
        // Scatter charts need both X-axis AND Y-axis configured
        // Check for Y-axis in multiple formats: yAxis, yAxis1, or values
        const hasXAxisScatter = !!(effectiveMapping.xAxis || effectiveMapping.category)
        const hasYAxisScatter = !!(effectiveMapping.yAxis || effectiveMapping.yAxis1 || effectiveMapping.values)
        return hasXAxisScatter && hasYAxisScatter
      case 'pie':
        return !!effectiveMapping.category
      case 'scorecard':
        // Scorecard is valid if it has either a metric field OR a formula field
        return !!(effectiveMapping.metric || effectiveMapping.formula)
      case 'table':
        return !!(effectiveMapping.columns && effectiveMapping.columns.length > 0) || !!effectiveMapping.yAxis
      case 'combo':
        return !!(effectiveMapping.xAxis && (effectiveMapping.yAxis || effectiveMapping.yAxis1))
      case 'waterfall':
        return !!(effectiveMapping.category && effectiveMapping.value)
      case 'funnel':
        return !!(effectiveMapping.stage && effectiveMapping.value)
      case 'heatmap':
        return !!(effectiveMapping.xAxis && effectiveMapping.yAxis && effectiveMapping.value)
      case 'gauge':
        return !!effectiveMapping.metric
      case 'cohort':
        return !!(effectiveMapping.cohort && effectiveMapping.period && effectiveMapping.value)
      case 'bullet':
        return !!(effectiveMapping.actual && effectiveMapping.comparative)
      case 'treemap':
        return !!(effectiveMapping.category && effectiveMapping.value)
      case 'sankey':
        return !!(effectiveMapping.source && effectiveMapping.target_node && effectiveMapping.value)
      case 'sparkline':
        return !!effectiveMapping.trend
      default:
        return true // Unknown chart types are considered configured
    }
  }, [customization?.dataMapping, configDataMapping, effectiveChartType])
}
