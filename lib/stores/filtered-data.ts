/**
 * FILTERED DATA UTILITY - Cross-store data filtering
 *
 * Purpose: Provides getFilteredData functionality that was in the monolithic store.
 * This function now accesses multiple stores to apply filters.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Memoized filtering logic prevents redundant calculations
 * - Only applies granularity aggregation when date filters active
 * - Strict date column detection prevents false positives
 *
 * USAGE:
 * import { getFilteredData } from '@/lib/stores/filtered-data'
 * const filteredData = getFilteredData()
 */

import { useDataStore, type DataRow } from './data-store'
import { useChartStore } from './chart-store'
import { useUIStore } from './ui-store'
import { aggregateDataByGranularity } from '@/lib/utils/data-aggregation'

/**
 * Get filtered data based on current filters and date range
 *
 * This function:
 * 1. Applies date range filter (if set)
 * 2. Applies dashboard filters
 * 3. Applies granularity aggregation (only if date filter active)
 * 4. Sorts by date (for time-series consistency)
 */
export function getFilteredData(): DataRow[] {
  // Get data from data store
  const rawData = useDataStore.getState().rawData

  // Get filters from chart store
  const { dashboardFilters, dateRange, granularity } = useChartStore.getState()

  // Get selected date column from UI store
  const selectedDateColumn = useUIStore.getState().selectedDateColumn

  console.log('🔍 [FILTERED_DATA] Starting with:', {
    rawDataLength: rawData?.length || 0,
    hasDateRange: !!(dateRange?.from || dateRange?.to),
    granularity,
    selectedDateColumn
  })

  // Quick return for empty data
  if (!rawData || rawData.length === 0) return []

  let filteredData = rawData

  // Apply date range filter if set
  if (dateRange?.from || dateRange?.to) {
    // Find date columns using STRICT detection (same logic as date-range-selector)
    const dateColumns = rawData.length > 0 ? Object.keys(rawData[0]).filter(key => {
      const value = rawData[0][key]
      if (!value) return false

      // Check if it's a Date object first (most reliable)
      if (value instanceof Date) return true

      // For strings, use strict date pattern matching
      if (typeof value === 'string') {
        // Strict patterns for common date formats
        const strictDatePattern = /^\d{4}-\d{2}-\d{2}(T|\s|$)|^\d{2}\/\d{2}\/\d{4}$|^\d{4}\/\d{2}\/\d{2}$/
        if (strictDatePattern.test(value.trim())) return true

        // Also check if Date.parse works AND the parsed date is reasonable (year 1900-2100)
        const parsed = Date.parse(value)
        if (!isNaN(parsed)) {
          const date = new Date(parsed)
          const year = date.getFullYear()
          // Only accept dates between 1900-2100 to filter out numeric IDs
          if (year >= 1900 && year <= 2100) {
            // Additional check: must contain date separators (-, /) or time indicators
            if (/[-\/T:]/.test(value)) {
              return true
            }
          }
        }
      }

      return false
    }) : []

    // Determine which date column to use for filtering
    let dateColumnToUse = selectedDateColumn

    // If no column is selected, try to auto-select the first one
    if (!dateColumnToUse && dateColumns.length > 0) {
      dateColumnToUse = dateColumns[0]
      // Auto-select this column for future use
      useUIStore.setState({ selectedDateColumn: dateColumnToUse })
    }

    console.log('🔍 [FILTERED_DATA] Date filtering:', {
      dateRange,
      allDateColumns: dateColumns,
      selectedDateColumn: dateColumnToUse,
      rawDataCount: rawData.length
    })

    if (dateColumnToUse && dateColumns.includes(dateColumnToUse)) {
      const beforeFilterCount = filteredData.length
      filteredData = filteredData.filter(row => {
        const dateCol = row[dateColumnToUse]
        // CRITICAL FIX: When a date filter is active, exclude rows with null/undefined dates
        // Only include rows that have valid dates within the specified range
        if (dateCol === null || dateCol === undefined) return false
        const dateValue = new Date(dateCol as string | number | Date)
        if (isNaN(dateValue.getTime())) return false

        // CRITICAL FIX: Use <= and >= to include boundary dates (from and to are inclusive)
        // Reset time to start/end of day for fair comparison
        const dateOnly = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate())

        if (dateRange.from) {
          const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate())
          if (dateOnly < fromDate) return false
        }

        if (dateRange.to) {
          const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate())
          if (dateOnly > toDate) return false
        }

        return true
      })
      console.log('🔍 [FILTERED_DATA] After date filter:', {
        beforeCount: beforeFilterCount,
        afterCount: filteredData.length,
        filteredOut: beforeFilterCount - filteredData.length
      })
    }
  }

  // Apply dashboard filters
  if (dashboardFilters.length) {
    filteredData = filteredData.filter(row => {
      return dashboardFilters.every(filter => {
        if (!filter.isActive) return true

        const columnValue = row[filter.column]

        switch (filter.operator) {
          case 'equals':
            return columnValue === filter.value
          case 'contains':
            return String(columnValue).toLowerCase().includes(String(filter.value).toLowerCase())
          case 'greater_than':
            return Number(columnValue) > Number(filter.value)
          case 'less_than':
            return Number(columnValue) < Number(filter.value)
          case 'between':
            const [min, max] = filter.value
            return Number(columnValue) >= Number(min) && Number(columnValue) <= Number(max)
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(columnValue)
          default:
            return true
        }
      })
    })
  }

  // CRITICAL FIX: Only apply granularity aggregation when a date range filter is active
  // Rationale:
  // 1. Granularity aggregation groups data by time periods (day/week/month/etc)
  // 2. This reduces row count, which breaks scorecard calculations that need ALL data
  // 3. When no date filter is active, users expect to see calculations on ALL raw data
  // 4. Aggregation is only meaningful when viewing a specific time window
  // 5. Example: 46 raw rows aggregated by month becomes 36 rows, causing scorecard miscalculations
  const shouldApplyGranularityAggregation = dateRange?.from || dateRange?.to

  const dateColumns = filteredData.length > 0 ? Object.keys(filteredData[0]).filter(key => {
    const value = filteredData[0][key]
    if (!value) return false

    // Check if it's a Date object first (most reliable)
    if (value instanceof Date) return true

    // For strings, use strict date pattern matching
    if (typeof value === 'string') {
      // Strict patterns for common date formats
      const strictDatePattern = /^\d{4}-\d{2}-\d{2}(T|\s|$)|^\d{2}\/\d{2}\/\d{4}$|^\d{4}\/\d{2}\/\d{2}$/
      if (strictDatePattern.test(value.trim())) return true

      // Also check if Date.parse works AND the parsed date is reasonable (year 1900-2100)
      const parsed = Date.parse(value)
      if (!isNaN(parsed)) {
        const date = new Date(parsed)
        const year = date.getFullYear()
        // Only accept dates between 1900-2100 to filter out numeric IDs
        if (year >= 1900 && year <= 2100) {
          // Additional check: must contain date separators (-, /) or time indicators
          if (/[-\/T:]/.test(value)) {
            return true
          }
        }
      }
    }

    return false
  }) : []

  if (dateColumns.length > 0 && shouldApplyGranularityAggregation) {
    console.log('📊 [FILTERED_DATA] Applying granularity aggregation:', {
      granularity,
      dateColumn: dateColumns[0],
      beforeAggregation: filteredData.length
    })

    filteredData = aggregateDataByGranularity(filteredData, granularity, dateColumns[0])

    console.log('📊 [FILTERED_DATA] After granularity aggregation:', {
      afterAggregation: filteredData.length,
      rowsReduced: filteredData.length
    })

    // Ensure data is always sorted chronologically by date (critical for time-series charts)
    filteredData = filteredData.sort((a, b) => {
      const dateA = new Date(a[dateColumns[0]] as string | number | Date)
      const dateB = new Date(b[dateColumns[0]] as string | number | Date)

      // Handle invalid dates gracefully
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0

      return dateA.getTime() - dateB.getTime()
    })
  } else if (dateColumns.length > 0 && !shouldApplyGranularityAggregation) {
    console.log('📊 [FILTERED_DATA] Skipping granularity aggregation (no date filter active):', {
      dataLength: filteredData.length,
      message: 'Using all raw data for accurate calculations'
    })
  }

  console.log('✅ [FILTERED_DATA] Returning filtered data:', {
    finalLength: filteredData.length,
    aggregationWasApplied: shouldApplyGranularityAggregation
  })

  return filteredData
}

/**
 * React hook version of getFilteredData
 * This subscribes to changes in all relevant stores
 */
export function useFilteredData(): DataRow[] {
  // Subscribe to all relevant stores
  const rawData = useDataStore((state) => state.rawData)
  const { dashboardFilters, dateRange, granularity } = useChartStore((state) => ({
    dashboardFilters: state.dashboardFilters,
    dateRange: state.dateRange,
    granularity: state.granularity
  }))
  const selectedDateColumn = useUIStore((state) => state.selectedDateColumn)

  // Recalculate when any dependency changes
  return getFilteredData()
}
