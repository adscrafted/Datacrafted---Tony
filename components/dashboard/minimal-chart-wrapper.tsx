'use client'

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Maximize2, Download, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { Scorecard } from './scorecard'
import { DataRow, useDataStore, ChartType } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

const TableChartLazy = React.lazy(() => import('./charts/table-chart').then(m => ({ default: m.TableChart })))

interface MinimalChartWrapperProps {
  id?: string
  type: ChartType
  title: string
  description: string
  data: DataRow[]
  dataKey: string[]
  dataMapping?: {
    xAxis?: string | string[]
    yAxis?: string | string[]
    size?: string
    color?: string
    xAxisLabel?: string
    yAxisLabel?: string
    category?: string
    value?: string
    metric?: string
    comparison?: string
    columns?: string[]
    values?: string[]
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'first'
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    limit?: number
  }
  qualityFactors?: any
}

// Apple iOS System Colors - colorblind-safe palette
const APPLE_COLORS = ['#007AFF', '#FF9500', '#4CD964', '#5856D6', '#FF2D55', '#5AC8FA', '#FFCC00', '#FF3B30']

export const MinimalChartWrapper = React.memo<MinimalChartWrapperProps>(function MinimalChartWrapper({
  id,
  type,
  title,
  description,
  data,
  dataKey,
  dataMapping
}) {
  const chartId = id || `chart-${Date.now()}`
  const { setFullScreen, exportChart, getFilteredData } = useDataStore()

  // Use filtered data with aggregation support
  const chartData = useMemo(() => {
    const filteredData = getFilteredData()
    if (!filteredData || !Array.isArray(filteredData) || filteredData.length === 0) {
      return []
    }

    let processedData = filteredData.slice(0, 1000) // Limit for performance

    // Apply aggregation, sorting, and limiting for bar charts
    if (type === 'bar' && dataMapping) {
      const { category, values, aggregation, sortBy, sortOrder, limit } = dataMapping

      console.log('📊 [BAR CHART] Processing with dataMapping:', {
        category,
        values,
        aggregation,
        sortBy,
        sortOrder,
        limit,
        rawDataLength: processedData.length
      })

      // If aggregation is specified, group and aggregate the data
      if (category && values && aggregation) {
        const categoryField = category
        const valueFields = Array.isArray(values) ? values : [values]

        // Group data by category
        const grouped = new Map<string, any>()

        processedData.forEach(row => {
          const categoryValue = String(row[categoryField] || 'Unknown')

          if (!grouped.has(categoryValue)) {
            grouped.set(categoryValue, {
              [categoryField]: categoryValue,
              _count: 0
            })
            // Initialize value fields
            valueFields.forEach(field => {
              grouped.get(categoryValue)![field] = 0
            })
          }

          const group = grouped.get(categoryValue)!
          group._count += 1

          // Aggregate values based on aggregation method
          valueFields.forEach(field => {
            const value = Number(row[field]) || 0

            switch (aggregation) {
              case 'sum':
                group[field] = (group[field] || 0) + value
                break
              case 'avg':
                // Store sum for now, we'll divide by count later
                group[field] = (group[field] || 0) + value
                break
              case 'count':
                group[field] = group._count
                break
              case 'min':
                group[field] = Math.min(group[field] || Infinity, value)
                break
              case 'max':
                group[field] = Math.max(group[field] || -Infinity, value)
                break
              default:
                group[field] = (group[field] || 0) + value
            }
          })
        })

        // Convert map to array and finalize averages
        processedData = Array.from(grouped.values()).map(group => {
          if (aggregation === 'avg') {
            valueFields.forEach(field => {
              group[field] = group[field] / group._count
            })
          }
          // Remove internal count field
          delete group._count
          return group
        })

        console.log('📊 [BAR CHART] After aggregation:', {
          aggregatedRows: processedData.length,
          sampleData: processedData.slice(0, 3)
        })
      }

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

        // Sort data with currency parsing
        processedData = [...processedData].sort((a, b) => {
          const aVal = parseVal(a[sortBy])
          const bVal = parseVal(b[sortBy])
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
        })
      }

      // Apply limit if configured
      if (limit && typeof limit === 'number') {
        processedData = processedData.slice(0, limit)
        console.log('📊 [BAR CHART] After limit:', {
          limitedRows: processedData.length,
          limit
        })
      }

      console.log('📊 [BAR CHART] Final processed data:', {
        finalRows: processedData.length,
        sampleData: processedData.slice(0, 3)
      })
    }

    return processedData
  }, [getFilteredData, type, dataMapping])

  // Safe dataKey handling
  const safeDataKey = useMemo(() => {
    if (!dataKey || !Array.isArray(dataKey) || dataKey.length === 0) {
      return ['index']
    }
    return dataKey
  }, [dataKey])

  // Pie chart data processing
  const pieData = useMemo(() => {
    if (type !== 'pie' || safeDataKey.length === 0 || chartData.length === 0) {
      return []
    }

    const categoryKey = safeDataKey[0]
    const valueKey = safeDataKey[1] || 'count'

    const counts: Record<string, number> = {}
    chartData.forEach(row => {
      if (!row || typeof row !== 'object') return

      const category = String(row[categoryKey] || 'Unknown')
      if (valueKey === 'count') {
        counts[category] = (counts[category] || 0) + 1
      } else {
        const value = Number(row[valueKey] || 0)
        if (!isNaN(value)) {
          counts[category] = (counts[category] || 0) + value
        }
      }
    })

    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [type, safeDataKey, chartData])

  // Scatter chart data processing
  const scatterData = useMemo(() => {
    if (type !== 'scatter' || chartData.length === 0) {
      return { grouped: {}, range: [0, 100], hasColorDimension: false }
    }

    // Get axis keys from dataMapping or fall back to dataKey
    const xKey = dataMapping?.xAxis || safeDataKey[0]
    const yKey = dataMapping?.yAxis || safeDataKey[1]
    const sizeKey = dataMapping?.size
    const colorKey = dataMapping?.color

    // Filter and validate data points
    const validPoints = chartData
      .map(row => {
        const x = Number(row[xKey])
        const y = Number(row[yKey])
        const size = sizeKey ? Number(row[sizeKey]) : 100
        const color = colorKey ? String(row[colorKey] || 'Default') : 'Default'

        // Only include points with valid x and y values
        if (isNaN(x) || isNaN(y)) return null

        return {
          x,
          y,
          size: isNaN(size) ? 100 : size,
          color,
          _raw: row // Keep raw data for tooltip
        }
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)
      .slice(0, 500) // Limit to 500 points for performance

    // Group by color dimension if provided
    const grouped: Record<string, any[]> = {}
    if (colorKey && validPoints.length > 0) {
      validPoints.forEach(point => {
        if (!grouped[point.color]) {
          grouped[point.color] = []
        }
        grouped[point.color].push(point)
      })
    } else {
      grouped['Default'] = validPoints
    }

    // Calculate size range for ZAxis
    const allSizes = validPoints.map(p => p.size)
    const sizeRange = allSizes.length > 0
      ? [Math.min(...allSizes), Math.max(...allSizes)]
      : [0, 100]

    return {
      grouped,
      range: sizeRange,
      hasColorDimension: !!colorKey,
      xKey,
      yKey,
      sizeKey
    }
  }, [type, chartData, dataMapping, safeDataKey])

  // Render chart based on type
  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <div className="text-sm">No data available</div>
          </div>
        </div>
      )
    }

    // Enhanced margins for better content visibility and legend spacing
    const getChartMargins = (chartType: string) => {
      switch (chartType) {
        case 'pie':
          return { top: 20, right: 20, left: 20, bottom: 60 } // Increased bottom space for legend
        case 'bar':
        case 'line':
        case 'area':
          return { top: 20, right: 30, left: 60, bottom: 100 } // Increased bottom space for axis labels and legends
        case 'scatter':
          return { top: 20, right: 30, left: 60, bottom: 80 } // Increased bottom space for legend
        default:
          return { top: 20, right: 20, left: 40, bottom: 60 }
      }
    }

    const commonProps = {
      data: chartData,
      margin: getChartMargins(type)
    }

    switch (type) {
      case 'scorecard':
        if (safeDataKey.length > 0 && chartData.length > 0) {
          const key = safeDataKey[0]
          const values = chartData.map(row => {
            const val = row[key]
            return typeof val === 'number' ? val : parseFloat(String(val)) || 0
          }).filter(v => !isNaN(v))

          const metricValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) : 0

          return (
            <Scorecard
              title={title}
              value={metricValue}
              unit=""
            />
          )
        }
        return <div className="flex items-center justify-center h-64 text-gray-400">Invalid data</div>

      case 'line': {
        // Detect if we need dual Y-axis based on data scale differences
        const series = safeDataKey.slice(1)
        const shouldUseDualAxis = series.length >= 2 && (() => {
          // Calculate the range of values for each series
          const ranges = series.map(key => {
            const values = chartData.map(row => Number(row[key]) || 0).filter(v => !isNaN(v))
            const max = Math.max(...values, 0)
            const min = Math.min(...values, 0)
            return { key, max, min, range: max - min }
          })

          // If any series has a range more than 10x different from another, use dual axis
          const maxRange = Math.max(...ranges.map(r => r.range))
          const minRange = Math.min(...ranges.filter(r => r.range > 0).map(r => r.range))
          return maxRange / minRange > 10
        })()

        // Split series between left and right Y-axis (alternate assignment)
        const leftSeries = series.filter((_, index) => index % 2 === 0)
        const rightSeries = series.filter((_, index) => index % 2 === 1)

        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...commonProps}>
              <CartesianGrid
                stroke="rgba(0, 0, 0, 0.08)"
                strokeWidth={1}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
              />
              {/* Left Y-Axis */}
              <YAxis
                yAxisId="left"
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={false}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
              />
              {/* Right Y-Axis (only if using dual axis) */}
              {shouldUseDualAxis && rightSeries.length > 0 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{
                    fontSize: 11,
                    fill: '#3C3C43',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                  }}
                  axisLine={false}
                  tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#FFFFFF',
                  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
                }}
                labelStyle={{
                  color: '#FFFFFF',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: '#FFFFFF',
                  fontSize: '13px',
                  padding: '2px 0',
                }}
              />
              {/* Render lines for left Y-axis */}
              {leftSeries.map((key, index) => (
                <Line
                  key={key}
                  yAxisId="left"
                  type="monotone"
                  dataKey={key}
                  stroke={APPLE_COLORS[index * 2 % APPLE_COLORS.length]}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: '#FFFFFF',
                    stroke: APPLE_COLORS[index * 2 % APPLE_COLORS.length]
                  }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              ))}
              {/* Render lines for right Y-axis (if applicable) */}
              {shouldUseDualAxis && rightSeries.map((key, index) => (
                <Line
                  key={key}
                  yAxisId="right"
                  type="monotone"
                  dataKey={key}
                  stroke={APPLE_COLORS[(index * 2 + 1) % APPLE_COLORS.length]}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5 5"
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: '#FFFFFF',
                    stroke: APPLE_COLORS[(index * 2 + 1) % APPLE_COLORS.length]
                  }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
      }

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...commonProps}>
              <CartesianGrid
                stroke="rgba(0, 0, 0, 0.08)"
                strokeWidth={1}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
              />
              <YAxis
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={false}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#FFFFFF',
                  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
                }}
                labelStyle={{
                  color: '#FFFFFF',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: '#FFFFFF',
                  fontSize: '13px',
                  padding: '2px 0',
                }}
              />
              {safeDataKey.slice(1).map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={APPLE_COLORS[index % APPLE_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="40%"
                outerRadius="60%"
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{
                  stroke: '#3C3C43',
                  strokeWidth: 1
                }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={APPLE_COLORS[index % APPLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#FFFFFF',
                  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
                }}
                itemStyle={{
                  color: '#FFFFFF',
                  fontSize: '13px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'area': {
        // Detect if we need dual Y-axis based on data scale differences (same logic as line chart)
        const areaSeries = safeDataKey.slice(1)
        const shouldUseDualAxisArea = areaSeries.length >= 2 && (() => {
          const ranges = areaSeries.map(key => {
            const values = chartData.map(row => Number(row[key]) || 0).filter(v => !isNaN(v))
            const max = Math.max(...values, 0)
            const min = Math.min(...values, 0)
            return { key, max, min, range: max - min }
          })
          const maxRange = Math.max(...ranges.map(r => r.range))
          const minRange = Math.min(...ranges.filter(r => r.range > 0).map(r => r.range))
          return maxRange / minRange > 10
        })()

        const leftAreaSeries = areaSeries.filter((_, index) => index % 2 === 0)
        const rightAreaSeries = areaSeries.filter((_, index) => index % 2 === 1)

        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...commonProps}>
              <CartesianGrid
                stroke="rgba(0, 0, 0, 0.08)"
                strokeWidth={1}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
              />
              {/* Left Y-Axis */}
              <YAxis
                yAxisId="left"
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={false}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
              />
              {/* Right Y-Axis (only if using dual axis) */}
              {shouldUseDualAxisArea && rightAreaSeries.length > 0 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{
                    fontSize: 11,
                    fill: '#3C3C43',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                  }}
                  axisLine={false}
                  tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#FFFFFF',
                  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
                }}
                labelStyle={{
                  color: '#FFFFFF',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: '#FFFFFF',
                  fontSize: '13px',
                  padding: '2px 0',
                }}
              />
              {/* Render areas for left Y-axis */}
              {leftAreaSeries.map((key, index) => (
                <Area
                  key={key}
                  yAxisId="left"
                  type="monotone"
                  dataKey={key}
                  stroke={APPLE_COLORS[index * 2 % APPLE_COLORS.length]}
                  strokeWidth={2.5}
                  fill={APPLE_COLORS[index * 2 % APPLE_COLORS.length]}
                  fillOpacity={0.2}
                />
              ))}
              {/* Render areas for right Y-axis (if applicable) */}
              {shouldUseDualAxisArea && rightAreaSeries.map((key, index) => (
                <Area
                  key={key}
                  yAxisId="right"
                  type="monotone"
                  dataKey={key}
                  stroke={APPLE_COLORS[(index * 2 + 1) % APPLE_COLORS.length]}
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  fill={APPLE_COLORS[(index * 2 + 1) % APPLE_COLORS.length]}
                  fillOpacity={0.1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )
      }

      case 'scatter': {
        const { grouped, range, hasColorDimension, xKey, yKey, sizeKey } = scatterData

        // Get axis labels
        const xLabel = dataMapping?.xAxisLabel || xKey || 'X Axis'
        const yLabel = dataMapping?.yAxisLabel || yKey || 'Y Axis'

        // Determine bubble size range (50-400px)
        const bubbleSizeRange = sizeKey ? [50, 400] : [100, 100] // Uniform size if no size dimension

        // Get series count for legend management
        const seriesCount = Object.keys(grouped).length

        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart {...commonProps}>
              <CartesianGrid
                stroke="rgba(0, 0, 0, 0.08)"
                strokeWidth={1}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                dataKey="x"
                name={xLabel}
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                label={{
                  value: xLabel,
                  position: 'bottom',
                  offset: 0,
                  style: {
                    fontSize: 11,
                    fill: '#3C3C43',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                  }
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yLabel}
                tick={{
                  fontSize: 11,
                  fill: '#3C3C43',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }}
                axisLine={false}
                tickLine={{ stroke: '#C6C6C8', strokeWidth: 1 }}
                label={{
                  value: yLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: {
                    fontSize: 11,
                    fill: '#3C3C43',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    textAnchor: 'middle'
                  }
                }}
              />
              {sizeKey && (
                <ZAxis
                  type="number"
                  dataKey="size"
                  range={bubbleSizeRange}
                  name={sizeKey}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#FFFFFF',
                  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
                }}
                labelStyle={{
                  color: '#FFFFFF',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: '#FFFFFF',
                  fontSize: '13px',
                  padding: '2px 0',
                }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const point = payload[0].payload
                    return (
                      <div
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.85)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          color: '#FFFFFF',
                          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        {hasColorDimension && (
                          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{point.color}</p>
                        )}
                        <p>{xLabel}: {typeof point.x === 'number' ? point.x.toFixed(2) : point.x}</p>
                        <p>{yLabel}: {typeof point.y === 'number' ? point.y.toFixed(2) : point.y}</p>
                        {sizeKey && (
                          <p>{sizeKey}: {typeof point.size === 'number' ? point.size.toLocaleString() : point.size}</p>
                        )}
                      </div>
                    )
                  }
                  return null
                }}
              />
              {/* Render scatter series - one per group */}
              {Object.entries(grouped).map(([groupName, points], index) => (
                <Scatter
                  key={groupName}
                  name={groupName === 'Default' && !hasColorDimension ? '' : groupName}
                  data={points}
                  fill={APPLE_COLORS[index % APPLE_COLORS.length]}
                  fillOpacity={0.6}
                  stroke={APPLE_COLORS[index % APPLE_COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )
      }

      case 'table':
        return (
          <React.Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-gray-400">Loading table...</div>
            </div>
          }>
            <TableChartLazy data={chartData} dataKey={safeDataKey} />
          </React.Suspense>
        )

      default:
        return <div className="flex items-center justify-center h-64 text-gray-400">Unsupported chart type</div>
    }
  }

  // For scorecards, render with minimal wrapper (no header/padding chrome)
  if (type === 'scorecard') {
    return (
      <div className="group relative bg-white transition-all duration-200 h-full">
        {/* Controls overlay - shown on hover */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center space-x-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setFullScreen(chartId)
              }}
              className="h-7 w-7 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="View fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="More options"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    exportChart(chartId, 'png')
                  }}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Export as PNG</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Scorecard Content - no padding wrapper */}
        <div className="h-full w-full">
          {renderChart()}
        </div>
      </div>
    )
  }

  // For all other chart types, render with full header/chrome
  return (
    <div className="group relative bg-white rounded-xl border border-gray-200/60 hover:border-gray-300/80 transition-all duration-200 hover:shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200/60">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h3>
            {type !== 'scorecard' && description && (
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{description}</p>
            )}
          </div>

          {/* Minimal controls - hidden by default, shown on hover */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setFullScreen(chartId)
              }}
              className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="View fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="More options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    exportChart(chartId, 'png')
                  }}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Export as PNG</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="px-6 py-6">
        <div className="h-96 min-h-[360px]">
          {renderChart()}
        </div>
      </div>
    </div>
  )
})