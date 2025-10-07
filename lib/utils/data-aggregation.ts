import { DataRow } from '@/lib/store'
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  format
} from 'date-fns'
import { parseNumericValue } from './data-calculations'

export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year'

export function aggregateDataByGranularity(
  data: DataRow[], 
  granularity: Granularity,
  dateColumn?: string
): DataRow[] {
  if (!data || data.length === 0) return data
  
  // Find date column if not specified
  if (!dateColumn) {
    const firstRow = data[0]
    const dateColumns = Object.keys(firstRow).filter(key => {
      const value = firstRow[key]
      if (!value) return false

      // Reject pure numbers to avoid Date.parse false positives
      const valueStr = String(value).trim()
      const isPureNumber = /^-?\d+(\.\d+)?$/.test(valueStr)
      const isYearLike = /^\d{4}$/.test(valueStr)
      if (isPureNumber && !isYearLike) return false

      const datePattern = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}/
      if (typeof value === 'string' && datePattern.test(value)) return true
      if (value instanceof Date) return true
      if (!isNaN(Date.parse(valueStr))) return true
      return false
    })
    
    if (dateColumns.length === 0) return data
    dateColumn = dateColumns[0]
  }
  
  // Group data by the specified granularity
  const groups = new Map<string, DataRow[]>()
  
  data.forEach(row => {
    const dateValue = row[dateColumn]
    if (!dateValue || dateValue === null || dateValue === undefined) return
    
    const date = new Date(dateValue as string | number | Date)
    if (isNaN(date.getTime())) return
    
    let groupKey: string
    let formattedDate: string
    
    switch (granularity) {
      case 'day':
        groupKey = format(startOfDay(date), 'yyyy-MM-dd')
        formattedDate = format(date, 'MMM d, yyyy')
        break
      case 'week':
        groupKey = format(startOfWeek(date), 'yyyy-MM-dd')
        formattedDate = format(startOfWeek(date), 'MMM d, yyyy')
        break
      case 'month':
        groupKey = format(startOfMonth(date), 'yyyy-MM')
        formattedDate = format(date, 'MMM yyyy')
        break
      case 'quarter':
        groupKey = format(startOfQuarter(date), 'yyyy-[Q]Q')
        formattedDate = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
        break
      case 'year':
        groupKey = format(startOfYear(date), 'yyyy')
        formattedDate = format(date, 'yyyy')
        break
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    
    const group = groups.get(groupKey)!
    group.push({ ...row, [dateColumn]: formattedDate, _originalDate: date })
  })
  
  // Aggregate each group
  const aggregatedData: DataRow[] = []
  
  groups.forEach((groupRows, groupKey) => {
    if (groupRows.length === 0) return
    
    const aggregatedRow: DataRow = {}
    const firstRow = groupRows[0]
    
    // Use the formatted date
    aggregatedRow[dateColumn] = firstRow[dateColumn]
    
    // For each column, aggregate based on data type
    Object.keys(firstRow).forEach(key => {
      if (key === dateColumn || key === '_originalDate') return
      
      const values = groupRows.map(row => row[key]).filter(v => v != null)
      
      if (values.length === 0) {
        aggregatedRow[key] = null
        return
      }
      
      // Check if all values are numbers
      const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v))
      
      if (numericValues.length === values.length) {
        // Sum numeric values
        aggregatedRow[key] = numericValues.reduce((sum, val) => sum + val, 0)
      } else {
        // For non-numeric values, use the first value or count unique values
        const uniqueValues = Array.from(new Set(values))
        if (uniqueValues.length === 1) {
          aggregatedRow[key] = uniqueValues[0]
        } else {
          aggregatedRow[key] = values[0] // Use first value as representative
        }
      }
    })
    
    aggregatedData.push(aggregatedRow)
  })
  
  // Sort by date
  return aggregatedData.sort((a, b) => {
    const dateA = new Date((a._originalDate || a[dateColumn]) as string | number | Date)
    const dateB = new Date((b._originalDate || b[dateColumn]) as string | number | Date)
    return dateA.getTime() - dateB.getTime()
  })
}

export type AggregationMethod = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'

/**
 * Aggregates chart data by grouping on X-axis and aggregating Y-axis values
 * Used for charts where multiple data points share the same X-axis value
 *
 * @param data - The data to aggregate
 * @param xAxisKey - The key to group by (X-axis)
 * @param yAxisKeys - The keys to aggregate (Y-axis values)
 * @param aggregationMethod - The aggregation method to use (default: 'sum')
 * @returns Aggregated data with one row per unique X-axis value
 */
export function aggregateChartData(
  data: DataRow[],
  xAxisKey: string,
  yAxisKeys: string[],
  aggregationMethod: AggregationMethod = 'sum'
): DataRow[] {
  if (!data || data.length === 0) return data
  if (!xAxisKey || yAxisKeys.length === 0) return data

  // Group data by X-axis value
  const groups = new Map<string, DataRow[]>()

  data.forEach(row => {
    const xValue = row[xAxisKey]
    if (xValue === null || xValue === undefined) return

    const groupKey = String(xValue)
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(row)
  })

  // Aggregate each group
  const aggregatedData: DataRow[] = []

  groups.forEach((groupRows, groupKey) => {
    if (groupRows.length === 0) return

    const aggregatedRow: DataRow = {}
    const firstRow = groupRows[0]

    // Preserve X-axis value from first row
    aggregatedRow[xAxisKey] = firstRow[xAxisKey]

    // Preserve other non-numeric columns from first row
    Object.keys(firstRow).forEach(key => {
      if (key === xAxisKey || yAxisKeys.includes(key)) return
      aggregatedRow[key] = firstRow[key]
    })

    // Aggregate each Y-axis key
    yAxisKeys.forEach(yKey => {
      const values = groupRows.map(row => parseNumericValue(row[yKey])).filter(v => v !== null) as number[]

      if (values.length === 0) {
        aggregatedRow[yKey] = null
        return
      }

      switch (aggregationMethod) {
        case 'sum':
          aggregatedRow[yKey] = values.reduce((sum, val) => sum + val, 0)
          break
        case 'avg':
          aggregatedRow[yKey] = values.reduce((sum, val) => sum + val, 0) / values.length
          break
        case 'count':
          aggregatedRow[yKey] = values.length
          break
        case 'min':
          aggregatedRow[yKey] = Math.min(...values)
          break
        case 'max':
          aggregatedRow[yKey] = Math.max(...values)
          break
        case 'distinct':
          aggregatedRow[yKey] = new Set(values).size
          break
        default:
          // Default to sum if method is not recognized
          aggregatedRow[yKey] = values.reduce((sum, val) => sum + val, 0)
      }
    })

    aggregatedData.push(aggregatedRow)
  })

  return aggregatedData
}