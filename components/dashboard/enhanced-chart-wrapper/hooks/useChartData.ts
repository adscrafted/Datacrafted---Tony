import React from 'react'
import { ChartType, DataRow } from '@/lib/store'
import { aggregateChartData } from '@/lib/utils/data-aggregation'
import { processChartData, ChartDataMapping } from '@/lib/utils/chart-data-processor'

interface UseChartDataOptions {
  data: DataRow[]
  type: ChartType
  title: string
  customization: any
  configDataMapping: any
}

/**
 * Hook to process and transform chart data based on chart type and configuration
 * Handles:
 * - Data slicing (limit to 1000 rows for performance, except scorecards)
 * - Formula-based scorecard processing
 * - Date-based sorting for time series
 * - Data aggregation (sum, avg, count, etc.)
 * - Top/Bottom X filtering for bar charts
 */
export function useChartData({
  data,
  type,
  title,
  customization,
  configDataMapping
}: UseChartDataOptions): DataRow[] {
  return React.useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return []
    }

    // CRITICAL FIX: For scorecards, we MUST use all data to ensure accurate aggregation
    // The fullscreen view uses ALL filteredData for calculation details (see app/dashboard/page.tsx line 465-496)
    // If we limit scorecard data here, the card value and calculation details will show different numbers
    // For other chart types (line, bar, scatter, etc.), limit to 1000 rows for rendering performance
    let processedData = type === 'scorecard' ? data : data.slice(0, 1000)

    if (type === 'scorecard') {
      console.log(`🔍 [SCORECARD_DATA_DEBUG] ${title} - Initial data:`, {
        inputDataLength: data.length,
        processedDataLength: processedData.length
      })
    }

    // Get effective data mapping
    const effectiveMapping = {
      ...configDataMapping,
      ...customization?.dataMapping
    }

    // Process formula-based scorecards using the chart data processor
    if (type === 'scorecard' && effectiveMapping.formula && effectiveMapping.formulaAlias) {
      try {
        const processed = processChartData(processedData, 'scorecard', effectiveMapping as ChartDataMapping)
        processedData = processed.data
        console.log(`📊 [FORMULA_DEBUG] ${title}:`, {
          formula: effectiveMapping.formula,
          formulaAlias: effectiveMapping.formulaAlias,
          result: processedData[0],
          metadata: processed.metadata
        })
      } catch (error) {
        console.error(`❌ [FORMULA_ERROR] ${title}:`, error)
      }
    }

    // Sort by X-axis for all charts that use X-axis (especially important for dates)
    // Apply before other processing like Top/Bottom filtering
    const xKey = effectiveMapping?.xAxis || effectiveMapping?.category
    if (xKey && processedData.length > 0) {
      // Check if X-axis appears to contain dates
      const sampleValue = processedData[0]?.[xKey]
      const isDateColumn = sampleValue && !isNaN(Date.parse(String(sampleValue)))

      if (isDateColumn) {
        // Sort chronologically by date for all chart types
        processedData = [...processedData].sort((a, b) => {
          const dateA = new Date(String(a[xKey]))
          const dateB = new Date(String(b[xKey]))
          return dateA.getTime() - dateB.getTime()
        })
      }
    }

    // Apply aggregation for line/bar/area/combo charts if aggregation method is set
    const aggregationMethod = effectiveMapping?.aggregation
    if (aggregationMethod && xKey && (type === 'line' || type === 'bar' || type === 'area' || type === 'combo')) {
      // Extract Y-axis keys from dataMapping
      const yAxisKeys: string[] = []

      // Handle different Y-axis configurations
      if (effectiveMapping.yAxis) {
        const yValues = Array.isArray(effectiveMapping.yAxis) ? effectiveMapping.yAxis : [effectiveMapping.yAxis]
        yAxisKeys.push(...yValues)
      }
      if (effectiveMapping.yAxis1) {
        const y1Values = Array.isArray(effectiveMapping.yAxis1) ? effectiveMapping.yAxis1 : [effectiveMapping.yAxis1]
        yAxisKeys.push(...y1Values)
      }
      if (effectiveMapping.yAxis2) {
        const y2Values = Array.isArray(effectiveMapping.yAxis2) ? effectiveMapping.yAxis2 : [effectiveMapping.yAxis2]
        yAxisKeys.push(...y2Values)
      }
      if (effectiveMapping.values) {
        const values = Array.isArray(effectiveMapping.values) ? effectiveMapping.values : [effectiveMapping.values]
        yAxisKeys.push(...values)
      }

      // Only aggregate if we have Y-axis keys
      if (yAxisKeys.length > 0) {
        console.log(`📊 [AGGREGATION_DEBUG] ${title}:`, {
          aggregationMethod,
          xKey,
          yAxisKeys,
          beforeAggregation: processedData.length
        })

        processedData = aggregateChartData(processedData, xKey, yAxisKeys, aggregationMethod)

        console.log(`📊 [AGGREGATION_DEBUG] ${title} - After aggregation:`, {
          afterAggregation: processedData.length,
          sampleRow: processedData[0]
        })
      }
    }

    // Apply Top/Bottom X filtering for bar charts
    if (type === 'bar') {
      const { sortBy, sortOrder, limit } = effectiveMapping

      console.log(`📊 [BAR_CHART_DEBUG] ${title}:`, {
        configDataMapping,
        customizationDataMapping: customization?.dataMapping,
        effectiveMapping,
        sortBy,
        sortOrder,
        limit,
        dataLength: processedData.length,
        firstRow: processedData[0]
      })

      // Apply sorting if sortBy is configured
      if (sortBy) {
        // Helper to parse currency values
        const parseVal = (val: any): number => {
          if (typeof val === 'number') return val
          if (typeof val !== 'string') return 0
          const cleaned = String(val).replace(/[€$£¥,\s%]/g, '')
          const num = parseFloat(cleaned)
          return isNaN(num) ? 0 : num
        }

        // Sort data with currency parsing (always sort descending for proper slicing)
        processedData = [...processedData].sort((a, b) => {
          const aVal = parseVal(a[sortBy])
          const bVal = parseVal(b[sortBy])
          return bVal - aVal // Always sort high to low first
        })

        // Apply limit if configured
        if (limit) {
          // If ascending (bottom X), take from the end; if descending (top X), take from the start
          if (sortOrder === 'asc') {
            processedData = processedData.slice(-limit) // Take last N items (smallest values)
          } else {
            processedData = processedData.slice(0, limit) // Take first N items (largest values)
          }
        }

        // Now apply the final sort order for display
        if (sortOrder === 'asc') {
          processedData = processedData.reverse() // Reverse to show ascending order
        }
      }
    }

    return processedData
  }, [data, type, title, customization?.dataMapping, configDataMapping])
}
