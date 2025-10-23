/**
 * CHART-LEVEL FILTERING UTILITIES
 *
 * Purpose: Apply chart-specific filters (date aggregation and categorical filtering)
 * These filters are applied PER CHART, not globally across the dashboard
 */

import type { ChartFilter } from '@/lib/stores/chart-store'
import type { DataRow } from '@/lib/store'
import { parseISO, startOfWeek, startOfMonth, startOfQuarter, startOfYear, format } from 'date-fns'

/**
 * Apply all active filters to chart data
 */
export function applyChartFilters(
  data: DataRow[],
  filters: ChartFilter[] | undefined,
  schema?: Array<{ name: string; type: string }>
): DataRow[] {
  if (!filters || filters.length === 0) {
    return data
  }

  let filteredData = data

  // Apply each active filter in order
  for (const filter of filters) {
    if (!filter.isActive) continue

    switch (filter.type) {
      case 'date_aggregation':
        filteredData = applyDateAggregation(filteredData, filter, schema)
        break
      case 'categorical':
        filteredData = applyCategoricalFilter(filteredData, filter)
        break
      case 'numeric_range':
        filteredData = applyNumericRangeFilter(filteredData, filter)
        break
    }
  }

  return filteredData
}

/**
 * Apply date aggregation filter (group by day/week/month/quarter/year)
 */
function applyDateAggregation(
  data: DataRow[],
  filter: ChartFilter,
  schema?: Array<{ name: string; type: string }>
): DataRow[] {
  const { column, dateGranularity } = filter

  if (!dateGranularity || !column) return data

  // Group data by date granularity
  const grouped = new Map<string, DataRow[]>()

  for (const row of data) {
    const dateValue = row[column]
    if (!dateValue) continue

    let dateKey: string
    try {
      // Convert to Date object (handle string, number, Date, but skip booleans)
      let date: Date
      if (typeof dateValue === 'string') {
        date = parseISO(dateValue)
      } else if (typeof dateValue === 'number' || dateValue instanceof Date) {
        date = new Date(dateValue)
      } else {
        continue // Skip boolean or null values
      }

      switch (dateGranularity) {
        case 'day':
          dateKey = format(date, 'yyyy-MM-dd')
          break
        case 'week':
          const weekStart = startOfWeek(date, { weekStartsOn: 1 })
          dateKey = format(weekStart, 'yyyy-MM-dd')
          break
        case 'month':
          const monthStart = startOfMonth(date)
          dateKey = format(monthStart, 'yyyy-MM')
          break
        case 'quarter':
          const quarterStart = startOfQuarter(date)
          dateKey = format(quarterStart, 'yyyy-QQQ')
          break
        case 'year':
          const yearStart = startOfYear(date)
          dateKey = format(yearStart, 'yyyy')
          break
        default:
          dateKey = format(date, 'yyyy-MM-dd')
      }
    } catch (error) {
      console.warn('Invalid date value:', dateValue)
      continue
    }

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(row)
  }

  // Aggregate grouped data
  const aggregatedData: DataRow[] = []

  for (const [dateKey, rows] of grouped.entries()) {
    // Create aggregated row
    const aggregatedRow: DataRow = {
      [column]: dateKey, // Use the aggregated date key
      _aggregatedDate: dateKey,
      _granularity: dateGranularity,
      _rowCount: rows.length,
    }

    // Aggregate numeric columns (sum by default)
    const numericColumns = schema
      ?.filter(col => col.type === 'number' && col.name !== column)
      .map(col => col.name) || []

    for (const numCol of numericColumns) {
      const values = rows
        .map(row => parseFloat(String(row[numCol] || 0)))
        .filter(val => !isNaN(val))

      aggregatedRow[numCol] = values.reduce((sum, val) => sum + val, 0)
    }

    // For non-numeric columns, take the first value (or most common)
    const otherColumns = Object.keys(rows[0] || {}).filter(
      key => key !== column && !numericColumns.includes(key)
    )

    for (const col of otherColumns) {
      // Take the most common value
      const values = rows.map(row => row[col]).filter(Boolean)
      const valueCounts = new Map<any, number>()

      for (const val of values) {
        valueCounts.set(val, (valueCounts.get(val) || 0) + 1)
      }

      // Find most common value
      let mostCommon = values[0]
      let maxCount = 0
      for (const [val, count] of valueCounts.entries()) {
        if (count > maxCount) {
          maxCount = count
          mostCommon = val
        }
      }

      aggregatedRow[col] = mostCommon
    }

    aggregatedData.push(aggregatedRow)
  }

  // Sort by date
  return aggregatedData.sort((a, b) => {
    const dateA = a._aggregatedDate || a[column]
    const dateB = b._aggregatedDate || b[column]
    return String(dateA).localeCompare(String(dateB))
  })
}

/**
 * Apply categorical filter (filter by selected values)
 */
function applyCategoricalFilter(data: DataRow[], filter: ChartFilter): DataRow[] {
  const { column, selectedValues } = filter

  if (!selectedValues || selectedValues.length === 0) return data

  return data.filter(row => {
    const value = String(row[column] || '')
    return selectedValues.includes(value)
  })
}

/**
 * Apply numeric range filter
 */
function applyNumericRangeFilter(data: DataRow[], filter: ChartFilter): DataRow[] {
  const { column, min, max } = filter

  return data.filter(row => {
    const value = parseFloat(String(row[column] || 0))
    if (isNaN(value)) return false

    if (min !== undefined && value < min) return false
    if (max !== undefined && value > max) return false

    return true
  })
}

/**
 * Get unique values from a column (for categorical filter options)
 */
export function getUniqueValues(data: DataRow[], column: string): string[] {
  const uniqueSet = new Set<string>()

  for (const row of data) {
    const value = row[column]
    if (value !== null && value !== undefined) {
      uniqueSet.add(String(value))
    }
  }

  return Array.from(uniqueSet).sort()
}

/**
 * Count active filters
 */
export function getActiveFilterCount(filters: ChartFilter[] | undefined): number {
  if (!filters) return 0
  return filters.filter(f => f.isActive).length
}

/**
 * Get filter summary text for display
 */
export function getFilterSummary(filter: ChartFilter): string {
  if (!filter.isActive) return ''

  switch (filter.type) {
    case 'date_aggregation':
      return `Group by ${filter.dateGranularity}`
    case 'categorical':
      const count = filter.selectedValues?.length || 0
      return `${filter.column}: ${count} selected`
    case 'numeric_range':
      if (filter.min !== undefined && filter.max !== undefined) {
        return `${filter.column}: ${filter.min} - ${filter.max}`
      } else if (filter.min !== undefined) {
        return `${filter.column} ≥ ${filter.min}`
      } else if (filter.max !== undefined) {
        return `${filter.column} ≤ ${filter.max}`
      }
      return ''
    default:
      return ''
  }
}
