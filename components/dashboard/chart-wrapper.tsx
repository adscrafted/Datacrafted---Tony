'use client'

import React, { useMemo, Component, ReactNode, useEffect, useState, lazy } from 'react'
import { createPortal } from 'react-dom'
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
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Maximize2, Download, X, Settings, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Scorecard } from './scorecard'
import { DataRow, ChartCustomization, useDataStore, ChartType } from '@/lib/store'
import { cn } from '@/lib/utils/cn'
import { usePerformanceMonitor } from '@/lib/hooks/use-performance-monitor'
import { renderCollapsibleLegend } from './collapsible-legend'
import { processChartData, ChartDataMapping } from '@/lib/utils/chart-data-processor'
import { AggregationType } from '@/lib/utils/data-calculations'

// Lazy load table and waterfall components for better performance
const TableChartLazy = lazy(() => import('./charts/table-chart').then(m => ({ default: m.TableChart })))
const WaterfallChartLazy = lazy(() => import('./charts/waterfall-chart'))
const FunnelChart = lazy(() => import('./charts/funnel-chart'))
const HeatmapChart = lazy(() => import('./charts/heatmap-chart'))
const GaugeChart = lazy(() => import('./charts/gauge-chart'))
const CohortGrid = lazy(() => import('./charts/cohort-grid'))
const BulletChart = lazy(() => import('./charts/bullet-chart'))
const TreemapChart = lazy(() => import('./charts/treemap-chart'))
const SankeyChart = lazy(() => import('./charts/sankey-chart'))
const SparklineChart = lazy(() => import('./charts/sparkline-chart'))

interface ChartWrapperProps {
  id?: string
  type: ChartType
  title: string
  description: string
  data: DataRow[]
  dataKey: string[]
  dataMapping?: {
    xAxis?: string
    yAxis?: string
    size?: string
    color?: string
    xAxisLabel?: string
    yAxisLabel?: string
    category?: string
    value?: string
    type?: string
    // Funnel-specific
    stage?: string
    // Heatmap-specific
    xCategory?: string
    yCategory?: string
    intensity?: string
    // Gauge-specific
    metric?: string
    min?: number
    max?: number
    target?: number
    // Cohort-specific
    cohort?: string
    period?: string
    // Bullet-specific
    actual?: string
    comparative?: string
    ranges?: string
    // Treemap-specific
    parent?: string
    // Sankey-specific
    source?: string
    target_node?: string
    // Sparkline-specific
    trend?: string
  }
}

const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

// Chart Skeleton for Suspense fallback
const ChartSkeleton = () => (
  <div className="h-full flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
  </div>
)

// Error Boundary Component
class ChartErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Chart rendering error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground bg-gray-50 rounded border-2 border-dashed border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium">Chart rendering failed</p>
            <p className="text-xs mt-1">Data may contain circular references</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export const ChartWrapper = React.memo<ChartWrapperProps>(function ChartWrapper({ id, type, title, description, data, dataKey }) {
  const chartId = id || `chart-${Date.now()}`
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Performance monitoring
  const { startMeasure, endMeasure } = usePerformanceMonitor(`ChartWrapper-${type}`, {
    trackRenders: true,
    trackMemory: process.env.NODE_ENV === 'development',
    logThreshold: 32 // Allow 32ms for chart rendering
  })
  // PERFORMANCE FIX: Separate selectors to prevent unnecessary re-renders
  // Only subscribe to the specific chart's customization, not all customizations
  const customization = useDataStore(
    (state) => state.chartCustomizations[chartId]
  )

  const currentTheme = useDataStore((state) => state.currentTheme)
  const updateChartCustomization = useDataStore((state) => state.updateChartCustomization)
  const setFullScreen = useDataStore((state) => state.setFullScreen)
  const exportChart = useDataStore((state) => state.exportChart)
  const isCustomizing = useDataStore((state) => state.isCustomizing)
  const setSelectedChartId = useDataStore((state) => state.setSelectedChartId)
  const selectedChartId = useDataStore((state) => state.selectedChartId)
  const setShowChartSettings = useDataStore((state) => state.setShowChartSettings)
  const analysis = useDataStore((state) => state.analysis)
  const setAnalysis = useDataStore((state) => state.setAnalysis)

  // CRITICAL: Get filter data separately to control re-renders
  const { rawData, dateRange, granularity, selectedDateColumn, dashboardFilters } = useDataStore(
    (state) => ({
      rawData: state.rawData,
      dateRange: state.dateRange,
      granularity: state.granularity,
      selectedDateColumn: state.selectedDateColumn,
      dashboardFilters: state.dashboardFilters
    })
  )

  // Get the filtering function (stable reference)
  const getFilteredData = useDataStore((state) => state.getFilteredData)

  // PERFORMANCE OPTIMIZATION: Compute filtered data only when filter dependencies change
  // This ensures we re-render on date changes but NOT on unrelated store changes
  const filteredData = useMemo(() => {
    const result = getFilteredData()
    console.log('🔄 [ChartWrapper] Filtered data for', title, ':', result.length, 'rows')
    return result
  }, [getFilteredData, dateRange, granularity, selectedDateColumn, dashboardFilters, rawData, title])

  // PERFORMANCE OPTIMIZATION: Memoize chart data processing with stable reference
  // Create a stable string key for data comparison to prevent unnecessary recalculations
  const dataKeyForCache = useMemo(() => {
    const sourceData = (data && data.length > 0) ? data : filteredData
    return `${sourceData.length}-${sourceData[0] ? Object.keys(sourceData[0]).length : 0}-${Date.now()}`
  }, [data, filteredData])

  // Apply customizations first (moved before chartData to avoid hoisting issues)
  const displayTitle = customization?.customTitle || title
  const displayDescription = customization?.customDescription || description
  const chartType = customization?.chartType || type
  const colors = customization?.colors || currentTheme.chartColors || DEFAULT_COLORS
  const showLegend = customization?.showLegend ?? true
  const showGrid = customization?.showGrid ?? true
  const isVisible = customization?.isVisible ?? true
  const axisLabels = customization?.axisLabels || {}

  const chartData = useMemo(() => {
    try {
      // Prioritize prop data over store data
      const sourceData = (data && data.length > 0) ? data : filteredData

      // Safety check for data
      if (!sourceData || !Array.isArray(sourceData) || sourceData.length === 0) {
        return []
      }

      // PERFORMANCE: Increased limit to 1000 for better data visibility
      // Only truncate for very large datasets
      const dataLimit = sourceData.length > 2000 ? 1000 : sourceData.length
      let sanitizedData = sourceData.slice(0, dataLimit).map((row, index) => {
        if (!row || typeof row !== 'object') {
          return { index, value: String(row || '') }
        }

        const sanitizedRow: Record<string, any> = {}
        Object.keys(row).forEach(key => {
          const value = row[key]
          // Only include primitive values and simple objects
          if (value === null || value === undefined) {
            sanitizedRow[key] = null
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            sanitizedRow[key] = value
          } else if (value instanceof Date) {
            sanitizedRow[key] = value.toISOString()
          } else {
            // Convert complex objects to strings
            sanitizedRow[key] = String(value)
          }
        })

        return sanitizedRow
      })

      // NEW: Apply calculation system if dataMapping specifies calculations
      if (customization?.dataMapping) {
        const mapping = customization.dataMapping as ChartDataMapping

        // Check if we have calculation configs (groupBy or derivedMetrics)
        const hasCalculations = mapping.groupBy || mapping.derivedMetrics

        if (hasCalculations) {
          // Use the chart data processor for advanced calculations
          const processed = processChartData(sanitizedData, chartType, mapping)
          sanitizedData = processed.data

          // Log calculation metadata for debugging
          console.log(`[ChartWrapper] Applied calculations:`, processed.metadata)
        } else {
          // Apply legacy bar chart sorting and limiting (backward compatibility)
          if (chartType === 'bar') {
            const { sortBy, sortOrder, limit } = mapping

            // Apply sorting if sortBy is configured
            if (sortBy) {
              // Helper to parse values (handles currency, percentages, etc.)
              const parseVal = (val: any): number => {
                if (typeof val === 'number') return val
                if (typeof val !== 'string') return 0
                const cleaned = String(val).replace(/[€$£¥,\s%]/g, '')
                const num = parseFloat(cleaned)
                return isNaN(num) ? 0 : num
              }

              // Sort data with currency parsing (always sort descending for proper slicing)
              sanitizedData = [...sanitizedData].sort((a, b) => {
                const aVal = parseVal(a[sortBy])
                const bVal = parseVal(b[sortBy])
                return bVal - aVal // Always sort high to low first
              })

              // Apply limit if configured
              if (limit) {
                // If ascending (bottom X), take from the end; if descending (top X), take from the start
                if (sortOrder === 'asc') {
                  sanitizedData = sanitizedData.slice(-limit) // Take last N items (smallest values)
                } else {
                  sanitizedData = sanitizedData.slice(0, limit) // Take first N items (largest values)
                }
              }

              // Now apply the final sort order for display
              if (sortOrder === 'asc') {
                sanitizedData = sanitizedData.reverse() // Reverse to show ascending order
              }
            }
          }
        }
      }

      // Add metadata about data truncation for better UX
      if (dataLimit < sourceData.length) {
        (sanitizedData as any)._meta = {
          truncated: true,
          totalRows: sourceData.length,
          displayedRows: dataLimit
        }
      }

      return sanitizedData
    } catch (error) {
      console.error('Error processing chart data:', error)
      return []
    }
  }, [dataKeyForCache, chartType, customization?.dataMapping]) // Add dependencies for bar chart sorting
  
  // Safety check for dataKey with intelligent fallback
  const safeDataKey = useMemo(() => {
    if (!dataKey || !Array.isArray(dataKey) || dataKey.length === 0) {
      // Try to extract keys from data
      const sourceData = (data && data.length > 0) ? data : filteredData
      const firstRow = sourceData?.[0] || {}
      const numericKeys = Object.keys(firstRow).filter(key =>
        typeof firstRow[key] === 'number'
      )
      if (numericKeys.length > 0) {
        return numericKeys.slice(0, 2)  // Return up to 2 numeric columns
      }
      return ['value']  // Better fallback than 'index'
    }
    return dataKey
  }, [dataKey, data, filteredData])
  
  // Performance measurement
  useEffect(() => {
    startMeasure()
    return () => {
      endMeasure(chartData.length)
    }
  }, [startMeasure, endMeasure, chartData.length])
  
  // PERFORMANCE OPTIMIZATION: Memoize margin calculation
  const calculateMargins = useMemo(() => {
    return (data: any[], xKey: string) => {
      if (!data || data.length === 0) return { top: 20, right: 30, left: 60, bottom: 100 }

      // Sample first 5 labels
      const sampleLabels = data.slice(0, 5).map(row => String(row[xKey] || ''))
      const maxLength = Math.max(...sampleLabels.map(l => l.length), 0)

      // Calculate needed bottom margin
      let bottomMargin = 80
      if (maxLength > 10) bottomMargin = 120
      if (maxLength > 20) bottomMargin = 150
      if (maxLength > 30) bottomMargin = 180

      return { top: 20, right: 30, left: 60, bottom: bottomMargin }
    }
  }, []) // Empty deps - this function logic never changes

  // Memoize pie data processing - always call useMemo
  const pieData = useMemo(() => {
    if (chartType !== 'pie' || safeDataKey.length === 0 || chartData.length === 0) {
      return []
    }

    const categoryKey = safeDataKey[0]
    const valueKey = safeDataKey[1] || 'count'

    // Count occurrences if no value key specified
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
  }, [chartType, safeDataKey, chartData])

  // Simple fallback chart component that doesn't use Recharts - memoized to prevent re-creation
  const renderSimpleChart = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No data available for this chart
        </div>
      )
    }

    // Handle scorecard type
    if (chartType === 'scorecard') {
      // Calculate the metric value
      let metricValue = 0
      let trend = undefined
      
      if (safeDataKey.length > 0 && chartData.length > 0) {
        const key = safeDataKey[0]
        const values = chartData.map(row => {
          const val = row[key]
          return typeof val === 'number' ? val : parseFloat(String(val)) || 0
        }).filter(v => !isNaN(v))
        
        if (values.length > 0) {
          // For scorecard, we typically show sum or average
          metricValue = values.reduce((a, b) => a + b, 0)
          
          // If we have multiple data points, calculate trend
          if (values.length > 1) {
            const recent = values.slice(-Math.ceil(values.length / 2))
            const older = values.slice(0, Math.floor(values.length / 2))
            const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
            const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
            if (olderAvg !== 0) {
              trend = ((recentAvg - olderAvg) / olderAvg) * 100
            }
          }
        }
      }
      
      return (
        <Scorecard
          title={displayTitle}
          value={metricValue}
          subtitle={displayDescription}
          trend={trend}
        />
      )
    }

    return (
      <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded border">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">Chart: {displayTitle}</p>
          <p className="text-xs text-gray-500 mt-1">{chartData.length} data points</p>
          <p className="text-xs text-gray-500">Chart type: {chartType}</p>
          <div className="mt-2 text-xs text-gray-400">
            Data keys: {safeDataKey.join(', ')}
          </div>
        </div>
      </div>
    )
  }, [chartData, chartType, safeDataKey, displayTitle, displayDescription])

  // PERFORMANCE OPTIMIZATION: Create stable keys for customization to prevent unnecessary re-renders
  const chartConfigKey = useMemo(() => {
    return `${chartType}-${showLegend}-${showGrid}`
  }, [chartType, showLegend, showGrid])

  const renderChart = useMemo(() => {
    // Safety check
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No data available for this chart
        </div>
      )
    }

    // Get customization options
    const showGridLocal = customization?.showGrid ?? true
    const showLegendLocal = customization?.showLegend ?? true
    const axisLabels = customization?.axisLabels || {}

    // Handle different chart types
    switch (chartType) {
      case 'scorecard':
        return renderSimpleChart
        
      case 'line':
        const lineMargins = calculateMargins(chartData, safeDataKey[0])
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={400}>
            <LineChart data={chartData} margin={lineMargins}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={lineMargins.bottom}
                tickFormatter={(value) => {
                  const str = String(value)
                  return str.length > 25 ? str.substring(0, 22) + '...' : str
                }}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              {showLegend && <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5, wrapperStyle: { fontSize: '12px', paddingTop: '30px', paddingBottom: '5px' } })} />}
              {safeDataKey.slice(1).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
      
      case 'bar':
        const barMargins = calculateMargins(chartData, safeDataKey[0])
        const barPercentageMode = customization?.percentageStack === true

        // Custom tooltip for percentage mode
        const BarCustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload || !payload.length) return null

          // Calculate total for percentage
          const total = payload.reduce((sum: number, item: any) => sum + (Number(item.value) || 0), 0)

          return (
            <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
              <p className="font-medium text-gray-900 mb-2">{label}</p>
              {payload.map((item: any, index: number) => {
                const value = Number(item.value) || 0
                const percentage = total > 0 ? (value / total * 100).toFixed(1) : '0.0'
                return (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-700">{item.name}:</span>
                    <span className="font-medium text-gray-900">
                      {barPercentageMode
                        ? `${percentage}% (${value.toLocaleString()})`
                        : value.toLocaleString()
                      }
                    </span>
                  </div>
                )
              })}
            </div>
          )
        }

        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={400}>
            <BarChart
              data={chartData}
              margin={barMargins}
              stackOffset={barPercentageMode ? "expand" : undefined}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                angle={-45}
                textAnchor="end"
                height={barMargins.bottom}
                tickFormatter={(value) => {
                  const str = String(value)
                  return str.length > 25 ? str.substring(0, 22) + '...' : str
                }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                tickFormatter={barPercentageMode
                  ? (value) => `${(value * 100).toFixed(0)}%`
                  : undefined
                }
              />
              <Tooltip content={<BarCustomTooltip />} />
              <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5, wrapperStyle: { fontSize: '12px', paddingTop: '30px', paddingBottom: '5px' } })} />
              {safeDataKey.slice(1).map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId={barPercentageMode ? "stack" : undefined}
                  fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  fillOpacity={0.6}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
      
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="40%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(Number(percent || 0) * 100).toFixed(0)}%`}
                outerRadius="60%"
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5, wrapperStyle: { fontSize: '12px', paddingTop: '30px', paddingBottom: '10px' } })} />
            </PieChart>
          </ResponsiveContainer>
        )
      
      case 'area':
        const areaMargins = calculateMargins(chartData, safeDataKey[0])
        const areaPercentageMode = customization?.percentageStack === true

        // Custom tooltip for percentage mode
        const AreaCustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload || !payload.length) return null

          // Calculate total for percentage
          const total = payload.reduce((sum: number, item: any) => sum + (Number(item.value) || 0), 0)

          return (
            <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
              <p className="font-medium text-gray-900 mb-2">{label}</p>
              {payload.map((item: any, index: number) => {
                const value = Number(item.value) || 0
                const percentage = total > 0 ? (value / total * 100).toFixed(1) : '0.0'
                return (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-700">{item.name}:</span>
                    <span className="font-medium text-gray-900">
                      {areaPercentageMode
                        ? `${percentage}% (${value.toLocaleString()})`
                        : value.toLocaleString()
                      }
                    </span>
                  </div>
                )
              })}
            </div>
          )
        }

        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={400}>
            <AreaChart
              data={chartData}
              margin={areaMargins}
              stackOffset={areaPercentageMode ? "expand" : undefined}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={areaMargins.bottom}
                tickFormatter={(value) => {
                  const str = String(value)
                  return str.length > 25 ? str.substring(0, 22) + '...' : str
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={areaPercentageMode
                  ? (value) => `${(value * 100).toFixed(0)}%`
                  : undefined
                }
              />
              <Tooltip content={<AreaCustomTooltip />} />
              <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5, wrapperStyle: { fontSize: '12px', paddingTop: '30px', paddingBottom: '5px' } })} />
              {safeDataKey.slice(1).map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId={areaPercentageMode ? "stack" : "1"}
                  stroke={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )
      
      case 'scatter':
        const scatterMargins = calculateMargins(chartData, safeDataKey[0])
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={400}>
            <ScatterChart margin={scatterMargins}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={scatterMargins.bottom}
                tickFormatter={(value) => {
                  const str = String(value)
                  return str.length > 25 ? str.substring(0, 22) + '...' : str
                }}
              />
              <YAxis dataKey={safeDataKey[1]} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Data" data={chartData} fill={DEFAULT_COLORS[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        )
      
      case 'table':
        return (
          <React.Suspense fallback={
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          }>
            <TableChartLazy data={chartData} dataKey={safeDataKey} />
          </React.Suspense>
        )

      case 'waterfall':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <WaterfallChartLazy
              data={chartData}
              dataMapping={{
                category: customization?.dataMapping?.category || safeDataKey[0] || 'category',
                value: customization?.dataMapping?.value || safeDataKey[1] || 'value',
                type: customization?.dataMapping?.type
              }}
              title={displayTitle}
              description={displayDescription}
              customization={{
                showLegend: showLegendLocal,
                showGrid: showGridLocal,
                showLabels: customization?.showLabels ?? true,
                showConnectors: customization?.showConnectors ?? true
              }}
            />
          </React.Suspense>
        )

      case 'funnel':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <FunnelChart
              data={chartData}
              dataMapping={{
                stage: customization?.dataMapping?.stage || safeDataKey[0] || 'stage',
                value: customization?.dataMapping?.value || safeDataKey[1] || 'value'
              }}
              customization={{
                colors: customization?.colors,
                showPercentages: true
              }}
            />
          </React.Suspense>
        )

      case 'heatmap':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <HeatmapChart
              data={chartData}
              dataMapping={{
                xAxis: customization?.dataMapping?.xCategory || (typeof customization?.dataMapping?.xAxis === 'string' ? customization?.dataMapping?.xAxis : safeDataKey[0]) || safeDataKey[0] || 'xCategory',
                yAxis: customization?.dataMapping?.yCategory || (typeof customization?.dataMapping?.yAxis === 'string' ? customization?.dataMapping?.yAxis : safeDataKey[1]) || safeDataKey[1] || 'yCategory',
                value: customization?.dataMapping?.intensity || customization?.dataMapping?.value || safeDataKey[2] || 'value'
              }}
              customization={{
                colorScale: 'blue',
                showValues: false
              }}
            />
          </React.Suspense>
        )

      case 'gauge':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <GaugeChart
              data={chartData}
              dataMapping={{
                metric: customization?.dataMapping?.metric || safeDataKey[0] || 'value',
                target: typeof customization?.dataMapping?.target === 'string' ? customization?.dataMapping?.target : undefined
              }}
              customization={{
                min: customization?.dataMapping?.min ?? 0,
                max: customization?.dataMapping?.max ?? 100
              }}
            />
          </React.Suspense>
        )

      case 'cohort':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <CohortGrid
              data={chartData}
              dataMapping={{
                cohort: (customization?.dataMapping as any)?.cohort || safeDataKey[0] || 'cohort',
                period: (customization?.dataMapping as any)?.period || safeDataKey[1] || 'period',
                retention: (customization?.dataMapping as any)?.retention || safeDataKey[2] || 'retention'
              }}
              customization={{
                maxPeriods: 12,
                colorIntensity: true
              }}
            />
          </React.Suspense>
        )

      case 'bullet':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <BulletChart
              data={chartData}
              dataMapping={{
                category: (customization?.dataMapping as any)?.category || safeDataKey[0] || 'category',
                actual: (customization?.dataMapping as any)?.actual || safeDataKey[1] || 'actual',
                target: typeof (customization?.dataMapping as any)?.target === 'string' ? (customization?.dataMapping as any)?.target : undefined,
                ranges: undefined  // Would need to be configured specifically
              }}
              customization={{
                showGrid: showGridLocal,
                showLabels: customization?.showLabels ?? true
              }}
            />
          </React.Suspense>
        )

      case 'treemap':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <TreemapChart
              data={chartData}
              dataMapping={{
                category: customization?.dataMapping?.category || safeDataKey[0] || 'name',
                value: customization?.dataMapping?.value || safeDataKey[1] || 'value',
                parentCategory: customization?.dataMapping?.parent
              }}
              customization={{
                colors: customization?.colors,
                showLabels: customization?.showLabels ?? true
              }}
            />
          </React.Suspense>
        )

      case 'sankey':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <SankeyChart
              data={chartData}
              dataMapping={{
                source: customization?.dataMapping?.source || safeDataKey[0] || 'source',
                target: customization?.dataMapping?.target_node || safeDataKey[1] || 'target',
                value: customization?.dataMapping?.value || safeDataKey[2] || 'value'
              }}
              customization={{
                colors: customization?.colors,
                nodeWidth: 12,
                nodePadding: 24
              }}
            />
          </React.Suspense>
        )

      case 'sparkline':
        return (
          <React.Suspense fallback={<ChartSkeleton />}>
            <SparklineChart
              data={chartData}
              dataMapping={{
                xAxis: typeof customization?.dataMapping?.xAxis === 'string' ? customization?.dataMapping?.xAxis : (safeDataKey[0] || 'x'),
                yAxis: customization?.dataMapping?.trend || (typeof customization?.dataMapping?.yAxis === 'string' ? customization?.dataMapping?.yAxis : (safeDataKey[1] || 'value'))
              }}
              color={customization?.colors?.[0]}
              showTooltip={true}
              showDots={false}
            />
          </React.Suspense>
        )

      default:
        return renderSimpleChart
    }
    
    /* OLD CODE - KEEPING FOR REFERENCE
    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <LineChart data={chartData}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={safeDataKey[0]} label={axisLabels.x ? { value: axisLabels.x, position: 'insideBottom', offset: -5 } : undefined} />
              <YAxis label={axisLabels.y ? { value: axisLabels.y, angle: -90, position: 'insideLeft' } : undefined} />
              <Tooltip />
              {showLegend && <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5 })} />}
              {safeDataKey.slice(1).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <BarChart data={chartData}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={safeDataKey[0]} label={axisLabels.x ? { value: axisLabels.x, position: 'insideBottom', offset: -5 } : undefined} />
              <YAxis label={axisLabels.y ? { value: axisLabels.y, angle: -90, position: 'insideLeft' } : undefined} />
              <Tooltip />
              {showLegend && <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5 })} />}
              {safeDataKey.slice(1).map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
      
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${percent ? (Number(percent) * 100).toFixed(0) : 0}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              {showLegend && <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5 })} />}
            </PieChart>
          </ResponsiveContainer>
        )
      
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <AreaChart data={chartData}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={safeDataKey[0]} label={axisLabels.x ? { value: axisLabels.x, position: 'insideBottom', offset: -5 } : undefined} />
              <YAxis label={axisLabels.y ? { value: axisLabels.y, angle: -90, position: 'insideLeft' } : undefined} />
              <Tooltip />
              {showLegend && <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5 })} />}
              {safeDataKey.slice(1).map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )
      
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <ScatterChart data={chartData}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey={safeDataKey[0]} type="number" label={axisLabels.x ? { value: axisLabels.x, position: 'insideBottom', offset: -5 } : undefined} />
              <YAxis dataKey={safeDataKey[1]} type="number" label={axisLabels.y ? { value: axisLabels.y, angle: -90, position: 'insideLeft' } : undefined} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Data" data={chartData} fill={colors[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        )
      
      default:
        return (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Unsupported chart type: {chartType}
          </div>
        )
    }
    */
  }, [chartType, chartData, safeDataKey, customization, pieData, renderSimpleChart])

  // Handle delete confirmation
  const handleDelete = () => {
    if (analysis) {
      const updatedChartConfig = analysis.chartConfig.filter((_, index) => 
        (analysis.chartConfig[index]?.id || `chart-${index}`) !== chartId
      )
      setAnalysis({
        ...analysis,
        chartConfig: updatedChartConfig
      })
    }
    setShowDeleteConfirm(false)
  }

  // Delete Confirmation Dialog
  const DeleteConfirmDialog = () => (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          setShowDeleteConfirm(false)
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <X className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Delete Chart</h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete <strong>"{displayTitle}"</strong>? This action cannot be undone.
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowDeleteConfirm(false)
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleDelete()
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors"
          >
            Delete Chart
          </button>
        </div>
      </div>
    </div>
  )

  // Handle chart selection for chat interaction
  const handleChartClick = (e: React.MouseEvent) => {
    // Don't trigger selection if we're in customize mode or clicking buttons
    if (isCustomizing || (e.target as HTMLElement).closest('button')) {
      return
    }
    
    // Toggle selection
    if (selectedChartId === chartId) {
      setSelectedChartId(null) // Deselect if already selected
    } else {
      setSelectedChartId(chartId) // Select this chart
    }
  }

  // Don't render if hidden - moved after all hooks
  if (!isVisible) return null

  // For scorecards, render with customize controls
  if (chartType === 'scorecard') {
    return (
      <>
        <div 
          className={cn("relative h-full cursor-pointer transition-all rounded-lg", {
            "ring-2 ring-blue-500": isCustomizing,
            "ring-2 ring-blue-500 shadow-lg": selectedChartId === chartId && !isCustomizing,
            "hover:ring-1 hover:ring-gray-300": !isCustomizing && selectedChartId !== chartId
          })}
          data-chart-id={chartId}
          onClick={handleChartClick}
          title={selectedChartId === chartId ? "Click to deselect chart for chat" : "Click to select chart for chat"}
        >
          
          {/* Customize Mode Controls for Scorecards */}
          {isCustomizing && (
            <>
              {/* Drag Handle */}
              <div className="absolute top-2 left-2 z-50 drag-handle" style={{ pointerEvents: 'auto' }}>
                <div className="bg-blue-500 text-white p-1.5 rounded shadow-lg cursor-move">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="5" r="1"></circle>
                    <circle cx="15" cy="5" r="1"></circle>
                    <circle cx="9" cy="12" r="1"></circle>
                    <circle cx="15" cy="12" r="1"></circle>
                    <circle cx="9" cy="19" r="1"></circle>
                    <circle cx="15" cy="19" r="1"></circle>
                  </svg>
                </div>
              </div>
              {/* Delete Button */}
              <div className="absolute top-2 right-2 z-50" style={{ pointerEvents: 'auto' }}>
                <button
                  className="bg-red-500 text-white p-1.5 rounded hover:bg-red-600 shadow-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setShowDeleteConfirm(true)
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  title="Delete chart"
                  type="button"
                >
                  <X className="w-4 h-4 pointer-events-none" />
                </button>
              </div>
            </>
          )}
          {renderChart}
        </div>
        {showDeleteConfirm && createPortal(<DeleteConfirmDialog />, document.body)}
      </>
    )
  }

  return (
    <>
      <div 
        className="h-full relative cursor-pointer"
        data-chart-id={chartId}
        onClick={handleChartClick}
        title={selectedChartId === chartId ? "Click to deselect chart for chat" : "Click to select chart for chat"}
      >
        
        {/* Customize Mode Controls */}
        {isCustomizing && (
          <>
            {/* Drag Handle */}
            <div className="absolute top-2 left-2 z-50 drag-handle" style={{ pointerEvents: 'auto' }}>
              <div className="bg-blue-500 text-white p-1.5 rounded shadow-lg cursor-move">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="5" r="1"></circle>
                  <circle cx="15" cy="5" r="1"></circle>
                  <circle cx="9" cy="12" r="1"></circle>
                  <circle cx="15" cy="12" r="1"></circle>
                  <circle cx="9" cy="19" r="1"></circle>
                  <circle cx="15" cy="19" r="1"></circle>
                </svg>
              </div>
            </div>
            {/* Delete Button */}
            <div className="absolute top-2 right-2 z-50" style={{ pointerEvents: 'auto' }}>
              <button
                className="bg-red-500 text-white p-1.5 rounded hover:bg-red-600 shadow-lg transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setShowDeleteConfirm(true)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
                title="Delete chart"
                type="button"
              >
                <X className="w-4 h-4 pointer-events-none" />
              </button>
            </div>
          </>
        )}
        
        <Card 
        className={cn("group relative transition-all h-full flex flex-col", {
          "hover:shadow-lg": isCustomizing,
          "ring-2 ring-blue-500 shadow-lg": selectedChartId === chartId && !isCustomizing,
          "hover:ring-1 hover:ring-gray-300": !isCustomizing && selectedChartId !== chartId,
          "ring-2 ring-blue-500": isCustomizing
        })}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{displayTitle}</CardTitle>
            <CardDescription className="text-sm">{displayDescription}</CardDescription>
          </div>
          {!isCustomizing && (
            <div 
              className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedChartId(chartId)
                  setShowChartSettings(true)
                }}
                className="h-8 w-8 p-0"
                title="Chart settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setFullScreen(chartId)
                }}
                className="h-8 w-8 p-0"
                title="Full screen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  exportChart(chartId, 'png')
                }}
                className="h-8 w-8 p-0"
                title="Export chart"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4" style={{ minHeight: '360px' }}>
        <div className="h-full w-full">
          <ChartErrorBoundary>
            {renderChart}
          </ChartErrorBoundary>
        </div>
      </CardContent>
    </Card>
      </div>
      {showDeleteConfirm && createPortal(<DeleteConfirmDialog />, document.body)}
    </>
  )
})