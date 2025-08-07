'use client'

import React, { useMemo, Component, ReactNode, memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2, Download, X, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataRow, ChartCustomization, useDataStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'
import { smartSample, getOptimalSampleSize } from '@/lib/utils/data-sampling'
import { logger } from '@/lib/utils/logger'
import { startTiming, endTiming } from '@/lib/utils/performance-monitor'

// Lazy load heavy chart components
const LineChart = dynamic(() => import('recharts').then(mod => ({ default: mod.LineChart })), { ssr: false })
const Line = dynamic(() => import('recharts').then(mod => ({ default: mod.Line })), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(mod => ({ default: mod.BarChart })), { ssr: false })
const Bar = dynamic(() => import('recharts').then(mod => ({ default: mod.Bar })), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(mod => ({ default: mod.PieChart })), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => ({ default: mod.Pie })), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(mod => ({ default: mod.AreaChart })), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => ({ default: mod.Area })), { ssr: false })
const ScatterChart = dynamic(() => import('recharts').then(mod => ({ default: mod.ScatterChart })), { ssr: false })
const Scatter = dynamic(() => import('recharts').then(mod => ({ default: mod.Scatter })), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.XAxis })), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.YAxis })), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => ({ default: mod.Tooltip })), { ssr: false })
const Legend = dynamic(() => import('recharts').then(mod => ({ default: mod.Legend })), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => ({ default: mod.Cell })), { ssr: false })

// Lazy load scorecard separately
const Scorecard = dynamic(() => import('./scorecard').then(mod => ({ default: mod.Scorecard })), { ssr: false })

interface ChartWrapperProps {
  id?: string
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard'
  title: string
  description: string
  data: DataRow[]
  dataKey: string[]
}

const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

// Chart data cache
const chartDataCache = new Map<string, { data: DataRow[], timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds

// Optimized Chart Component
export const ChartWrapperOptimized = memo<ChartWrapperProps>(function ChartWrapperOptimized({
  id,
  type,
  title,
  description,
  data,
  dataKey
}) {
  const { 
    currentTheme, 
    showFullScreen, 
    setFullScreen, 
    setSelectedChartId,
    getChartCustomization,
    dashboardFilters
  } = useDataStore()

  const chartId = id || `chart-${type}-${dataKey.join('-')}`
  const customization = getChartCustomization?.(chartId)

  // Optimize data processing with memoization and sampling
  const processedData = useMemo(() => {
    startTiming(`chart-data-processing-${chartId}`, { type, dataLength: data.length })
    const startTime = performance.now()
    
    // Check cache first
    const cacheKey = `${chartId}-${JSON.stringify(dashboardFilters)}`
    const cached = chartDataCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.debug(`[ChartWrapper] Using cached data for ${chartId}`)
      return cached.data
    }
    
    // Apply smart sampling for large datasets
    const optimalSize = getOptimalSampleSize(data.length, type)
    let sampled = data
    
    if (data.length > optimalSize) {
      logger.debug(`[ChartWrapper] Sampling data from ${data.length} to ${optimalSize} rows`)
      sampled = smartSample(data, optimalSize, {
        preserveFirst: 10,
        preserveLast: 10,
        method: type === 'scatter' ? 'random' : 'uniform'
      })
    }
    
    // Process data based on chart type
    let processed = sampled
    
    if (type === 'pie' && dataKey.length >= 2) {
      // Aggregate data for pie charts
      const aggregated = new Map<string, number>()
      sampled.forEach(row => {
        const category = String(row[dataKey[0]])
        const value = Number(row[dataKey[1]]) || 0
        aggregated.set(category, (aggregated.get(category) || 0) + value)
      })
      
      processed = Array.from(aggregated.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10) // Limit to top 10 for pie charts
    }
    
    // Cache the processed data
    chartDataCache.set(cacheKey, { data: processed, timestamp: Date.now() })
    
    const endTime = performance.now()
    logger.debug(`[ChartWrapper] Data processing took ${endTime - startTime}ms`)
    endTiming(`chart-data-processing-${chartId}`, { processedLength: processed.length })
    
    return processed
  }, [data, dataKey, type, chartId, dashboardFilters])

  // Optimize event handlers
  const handleMaximize = useCallback(() => {
    setFullScreen(chartId)
  }, [chartId, setFullScreen])

  const handleSettings = useCallback(() => {
    setSelectedChartId(chartId)
  }, [chartId, setSelectedChartId])

  const handleExport = useCallback(() => {
    const csv = [
      dataKey.join(','),
      ...processedData.map(row => 
        dataKey.map(key => row[key]).join(',')
      )
    ].join('\\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [processedData, dataKey, title])

  // Show data warning for large datasets
  const showDataWarning = data.length > getOptimalSampleSize(data.length, type)

  // Render different chart types
  const renderChart = () => {
    const chartProps = {
      width: 500,
      height: 300,
      data: processedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (type) {
      case 'line':
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.colors.muted + '20'} />
            <XAxis dataKey={dataKey[0]} stroke={currentTheme.colors.muted} />
            <YAxis stroke={currentTheme.colors.muted} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: currentTheme.colors.surface,
                border: `1px solid ${currentTheme.colors.muted}20`,
                borderRadius: '6px'
              }}
            />
            <Legend />
            {dataKey.slice(1).map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={customization?.colors?.[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        )

      case 'bar':
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={currentTheme.colors.muted + '20'} />
            <XAxis dataKey={dataKey[0]} stroke={currentTheme.colors.muted} />
            <YAxis stroke={currentTheme.colors.muted} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: currentTheme.colors.surface,
                border: `1px solid ${currentTheme.colors.muted}20`,
                borderRadius: '6px'
              }}
            />
            <Legend />
            {dataKey.slice(1).map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={customization?.colors?.[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </BarChart>
        )

      case 'pie':
        return (
          <PieChart {...chartProps}>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {processedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={customization?.colors?.[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        )

      case 'scorecard':
        return <Scorecard data={processedData} dataKey={dataKey} customization={customization} />

      default:
        return <div>Unsupported chart type</div>
    }
  }

  return (
    <Card 
      className={cn(
        "relative group transition-all duration-200",
        showFullScreen === chartId && "ring-2 ring-primary"
      )}
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.muted + '20'
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">
            {customization?.title || title}
          </CardTitle>
          <CardDescription className="text-xs" style={{ color: currentTheme.colors.muted }}>
            {customization?.description || description}
          </CardDescription>
          {showDataWarning && (
            <p className="text-xs text-amber-600">
              Showing {processedData.length} of {data.length} data points
            </p>
          )}
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSettings}
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMaximize}
            className="h-8 w-8 p-0"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-8 w-8 p-0"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.id === nextProps.id &&
    prevProps.type === nextProps.type &&
    prevProps.title === nextProps.title &&
    prevProps.description === nextProps.description &&
    prevProps.data.length === nextProps.data.length &&
    JSON.stringify(prevProps.dataKey) === JSON.stringify(nextProps.dataKey)
  )
})

// Export optimized version as default
export { ChartWrapperOptimized as ChartWrapper }