import React from 'react'
import type { DataRow } from '@/lib/stores/data-store'
import type { ChartType } from '@/lib/stores/chart-store'
import { aggregateChartData } from '@/lib/utils/data-aggregation'
import { processChartData, type ChartDataMapping } from '@/lib/utils/chart-data-processor'
import { logger } from '@/lib/utils/logger'
import { applyChartFilters } from '@/lib/utils/chart-filters'
import { isValidDate } from '@/lib/utils/date-detection'

interface UseChartDataOptions {
  data: DataRow[]
  type: ChartType
  title: string
  customization: any
  configDataMapping: any
  schema?: Array<{ name: string; type: string }>
}

/**
 * Hook to process and transform chart data based on chart type and configuration
 * Handles:
 * - Chart-level filters (date aggregation, categorical filtering)
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
  configDataMapping,
  schema
}: UseChartDataOptions): DataRow[] {
  // DATA MAPPING PRIORITY (highest to lowest):
  // 1. customization.dataMapping - User edits in chart customization panel (HIGHEST PRIORITY - FINAL AUTHORITY)
  // 2. configDataMapping - AI-generated from analysis.chartConfig
  // User edits completely override AI recommendations
  // PERFORMANCE: Stabilize effectiveMapping to prevent unnecessary recalculations
  const effectiveMapping = React.useMemo(() => ({
    ...configDataMapping,           // AI recommendations (base)
    ...customization?.dataMapping   // User overrides (takes precedence)
  }), [configDataMapping, customization?.dataMapping])

  return React.useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return []
    }

    // STEP 1: Apply chart-level filters FIRST (before any other processing)
    // This includes date aggregation and categorical filtering
    let processedData = applyChartFilters(data, customization?.filters, schema)

    if (customization?.filters && customization.filters.length > 0) {
      const activeFilters = customization.filters.filter((f: any) => f.isActive)
      if (activeFilters.length > 0) {
        logger.log(`🔍 [CHART_FILTERS] ${title}:`, {
          originalRows: data.length,
          filteredRows: processedData.length,
          activeFilters: activeFilters.map((f: any) => ({ type: f.type, column: f.column }))
        })
      }
    }

    // STEP 2: Data slicing for performance
    // CRITICAL FIX: For scorecards, gauge, heatmap, and treemap charts, we MUST use all data to ensure accurate aggregation
    // - Scorecards/Gauge: fullscreen view uses ALL filteredData for calculation details (see app/dashboard/page.tsx line 465-496)
    // - Heatmap: needs all data to build complete category sets for x/y axes
    // - Treemap: needs all data to show complete category hierarchy
    // For other chart types (line, bar, scatter, etc.), limit to 1000 rows for rendering performance
    const chartsNeedingAllData = ['scorecard', 'gauge', 'heatmap', 'treemap']
    processedData = chartsNeedingAllData.includes(type) ? processedData : processedData.slice(0, 1000)

    if (type === 'scorecard') {
      logger.log(`🔍 [SCORECARD_DATA_DEBUG] ${title} - Initial data:`, {
        inputDataLength: data.length,
        processedDataLength: processedData.length,
        metric: effectiveMapping.metric,
        aggregation: effectiveMapping.aggregation,
        formula: effectiveMapping.formula,
        formulaAlias: effectiveMapping.formulaAlias,
        customizationDataMapping: customization?.dataMapping,
        configDataMapping: configDataMapping,
        effectiveMapping: effectiveMapping
      })
    }

    if (type === 'gauge') {
      logger.log(`🔍 [GAUGE_DATA_DEBUG] ${title} - Initial data:`, {
        inputDataLength: data.length,
        processedDataLength: processedData.length,
        metric: effectiveMapping.metric,
        aggregation: effectiveMapping.aggregation,
        sampleRow: processedData[0],
        customizationDataMapping: customization?.dataMapping,
        configDataMapping: configDataMapping,
        effectiveMapping: effectiveMapping
      })
    }

    // Process formula-based scorecards using the chart data processor
    if (type === 'scorecard' && effectiveMapping.formula && effectiveMapping.formulaAlias) {
      try {
        const processed = processChartData(processedData, 'scorecard', effectiveMapping as ChartDataMapping)
        processedData = processed.data
        logger.log(`📊 [FORMULA_DEBUG] ${title}:`, {
          formula: effectiveMapping.formula,
          formulaAlias: effectiveMapping.formulaAlias,
          result: processedData[0],
          metadata: processed.metadata
        })
      } catch (error) {
        logger.error(`❌ [FORMULA_ERROR] ${title}:`, error)
      }
    }

    // Sort by X-axis for all charts that use X-axis (especially important for dates)
    // Apply before other processing like Top/Bottom filtering
    const xKey = effectiveMapping?.xAxis || effectiveMapping?.category
    if (xKey && processedData.length > 0) {
      // Check if X-axis appears to contain dates
      const sampleValue = processedData[0]?.[xKey]
      const isDateColumn = isValidDate(sampleValue)

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
        logger.log(`📊 [AGGREGATION_DEBUG] ${title}:`, {
          aggregationMethod,
          xKey,
          yAxisKeys,
          beforeAggregation: processedData.length
        })

        processedData = aggregateChartData(processedData, xKey, yAxisKeys, aggregationMethod)

        logger.log(`📊 [AGGREGATION_DEBUG] ${title} - After aggregation:`, {
          afterAggregation: processedData.length,
          sampleRow: processedData[0]
        })
      }
    }

    // Apply aggregation for treemap charts (group by category, aggregate value)
    if (type === 'treemap' && aggregationMethod && effectiveMapping.category && effectiveMapping.value) {
      logger.log(`🌳 [TREEMAP_AGGREGATION] ${title}:`, {
        aggregationMethod,
        category: effectiveMapping.category,
        value: effectiveMapping.value,
        beforeAggregation: processedData.length
      })

      processedData = aggregateChartData(
        processedData,
        effectiveMapping.category,
        [effectiveMapping.value],
        aggregationMethod
      )

      logger.log(`🌳 [TREEMAP_AGGREGATION] ${title} - After:`, {
        afterAggregation: processedData.length,
        sampleRow: processedData[0]
      })
    }

    // Apply aggregation for heatmap charts (2D grouping by xAxis AND yAxis)
    if (type === 'heatmap' && aggregationMethod && effectiveMapping.xAxis && effectiveMapping.yAxis && effectiveMapping.value) {
      logger.log(`🗺️ [HEATMAP_AGGREGATION] ${title}:`, {
        aggregationMethod,
        xAxis: effectiveMapping.xAxis,
        yAxis: effectiveMapping.yAxis,
        value: effectiveMapping.value,
        beforeAggregation: processedData.length
      })

      // For heatmap, we need 2D aggregation (group by BOTH xAxis and yAxis)
      // We'll create a composite key: "xValue|yValue"
      const groups = new Map<string, any[]>()

      processedData.forEach(row => {
        const xValue = row[effectiveMapping.xAxis]
        const yValue = row[effectiveMapping.yAxis]
        if (xValue === null || xValue === undefined || yValue === null || yValue === undefined) return

        const compositeKey = `${xValue}|${yValue}`
        if (!groups.has(compositeKey)) {
          groups.set(compositeKey, [])
        }
        groups.get(compositeKey)!.push(row)
      })

      // Aggregate each group
      const aggregatedData: any[] = []
      groups.forEach((groupRows, compositeKey) => {
        const [xValue, yValue] = compositeKey.split('|')
        const values = groupRows.map(row => {
          const val = row[effectiveMapping.value]
          // Parse numeric value (handles currency strings)
          if (typeof val === 'number') return val
          if (typeof val === 'string') {
            const cleaned = val.replace(/[€$£¥,\s%]/g, '')
            const num = parseFloat(cleaned)
            return isNaN(num) ? null : num
          }
          return null
        }).filter(v => v !== null) as number[]

        if (values.length === 0) return

        let aggregatedValue: number
        switch (aggregationMethod) {
          case 'sum':
            aggregatedValue = values.reduce((sum, val) => sum + val, 0)
            break
          case 'avg':
            aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length
            break
          case 'count':
            aggregatedValue = values.length
            break
          case 'min':
            aggregatedValue = Math.min(...values)
            break
          case 'max':
            aggregatedValue = Math.max(...values)
            break
          default:
            aggregatedValue = values.reduce((sum, val) => sum + val, 0)
        }

        aggregatedData.push({
          [effectiveMapping.xAxis]: xValue,
          [effectiveMapping.yAxis]: yValue,
          [effectiveMapping.value]: aggregatedValue
        })
      })

      processedData = aggregatedData

      logger.log(`🗺️ [HEATMAP_AGGREGATION] ${title} - After:`, {
        afterAggregation: processedData.length,
        sampleRow: processedData[0]
      })

      // SMART HEATMAP OPTIMIZATION: Auto-limit categories when there are too many
      // This makes heatmaps more readable without user intervention
      const uniqueXValues = new Set(processedData.map(row => row[effectiveMapping.xAxis]))
      const uniqueYValues = new Set(processedData.map(row => row[effectiveMapping.yAxis]))

      logger.log(`🗺️ [HEATMAP_DIMENSIONS] ${title}:`, {
        uniqueXCategories: uniqueXValues.size,
        uniqueYCategories: uniqueYValues.size,
        totalCells: processedData.length
      })

      // If Y-axis (typically merchants/categories) has too many values, limit to top N by total value
      const MAX_Y_CATEGORIES = 15
      if (uniqueYValues.size > MAX_Y_CATEGORIES) {
        // Calculate total value for each Y category
        const yTotals = new Map<string, number>()
        processedData.forEach(row => {
          const yValue = String(row[effectiveMapping.yAxis])
          const value = Number(row[effectiveMapping.value]) || 0
          yTotals.set(yValue, (yTotals.get(yValue) || 0) + value)
        })

        // Get top N Y categories by total value
        const topYCategories = Array.from(yTotals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_Y_CATEGORIES)
          .map(([category]) => category)

        // Filter data to only include top categories
        processedData = processedData.filter(row =>
          topYCategories.includes(String(row[effectiveMapping.yAxis]))
        )

        logger.log(`🗺️ [HEATMAP_Y_LIMIT] ${title}:`, {
          originalYCategories: uniqueYValues.size,
          limitedToTop: MAX_Y_CATEGORIES,
          topCategories: topYCategories,
          afterFiltering: processedData.length
        })
      }

      // If X-axis has too many date values, suggest weekly/monthly grouping
      // Check if X-axis contains dates
      const MAX_X_CATEGORIES = 30
      if (uniqueXValues.size > MAX_X_CATEGORIES) {
        const sampleXValue = processedData[0]?.[effectiveMapping.xAxis]
        const isDateColumn = isValidDate(sampleXValue)

        if (isDateColumn) {
          logger.log(`🗺️ [HEATMAP_X_DATES] ${title}:`, {
            message: 'X-axis has many dates - auto-aggregating to weeks',
            uniqueXDates: uniqueXValues.size,
            action: 'Grouping by week for better readability'
          })

          // Auto-aggregate dates to weekly buckets
          const weeklyGroups = new Map<string, Map<string, number>>()

          processedData.forEach(row => {
            const dateStr = String(row[effectiveMapping.xAxis])
            const date = new Date(dateStr)

            // Get start of week (Sunday)
            const dayOfWeek = date.getDay()
            const weekStart = new Date(date)
            weekStart.setDate(date.getDate() - dayOfWeek)
            const weekKey = weekStart.toISOString().split('T')[0]

            const yValue = String(row[effectiveMapping.yAxis])
            const value = Number(row[effectiveMapping.value]) || 0

            if (!weeklyGroups.has(weekKey)) {
              weeklyGroups.set(weekKey, new Map())
            }
            const weekGroup = weeklyGroups.get(weekKey)!
            weekGroup.set(yValue, (weekGroup.get(yValue) || 0) + value)
          })

          // Convert back to array format
          const weeklyData: any[] = []
          weeklyGroups.forEach((yGroups, weekKey) => {
            yGroups.forEach((value, yValue) => {
              weeklyData.push({
                [effectiveMapping.xAxis]: weekKey,
                [effectiveMapping.yAxis]: yValue,
                [effectiveMapping.value]: value
              })
            })
          })

          processedData = weeklyData

          logger.log(`🗺️ [HEATMAP_WEEKLY_AGGREGATION] ${title}:`, {
            originalDates: uniqueXValues.size,
            weeksCreated: weeklyGroups.size,
            afterAggregation: processedData.length
          })
        } else {
          // Non-date X-axis with too many categories - limit to top N
          const xTotals = new Map<string, number>()
          processedData.forEach(row => {
            const xValue = String(row[effectiveMapping.xAxis])
            const value = Number(row[effectiveMapping.value]) || 0
            xTotals.set(xValue, (xTotals.get(xValue) || 0) + value)
          })

          const topXCategories = Array.from(xTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_X_CATEGORIES)
            .map(([category]) => category)

          processedData = processedData.filter(row =>
            topXCategories.includes(String(row[effectiveMapping.xAxis]))
          )

          logger.log(`🗺️ [HEATMAP_X_LIMIT] ${title}:`, {
            originalXCategories: uniqueXValues.size,
            limitedToTop: MAX_X_CATEGORIES,
            afterFiltering: processedData.length
          })
        }
      }
    }

    // Apply Top/Bottom X filtering for bar charts
    if (type === 'bar') {
      const { sortBy, sortOrder, limit } = effectiveMapping

      logger.log(`📊 [BAR_CHART_DEBUG] ${title}:`, {
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
  }, [data, type, title, effectiveMapping, customization?.filters, schema, configDataMapping, customization?.dataMapping])
}
