/**
 * Chart Performance Optimization Examples
 *
 * This file contains practical, production-ready code examples
 * for optimizing React chart components with Recharts.
 *
 * Each example is self-contained and can be copied into your codebase.
 */

import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

// ============================================================================
// EXAMPLE 1: Optimized Chart Component with React.memo
// ============================================================================

interface DataRow {
  [key: string]: string | number
}

interface OptimizedChartProps {
  data: DataRow[]
  dataKeys: string[]
  title: string
  showGrid?: boolean
}

// Custom comparison to prevent unnecessary re-renders
function chartPropsAreEqual(prev: OptimizedChartProps, next: OptimizedChartProps): boolean {
  // Compare primitive props
  if (prev.title !== next.title) return false
  if (prev.showGrid !== next.showGrid) return false

  // Compare dataKeys array
  if (prev.dataKeys.length !== next.dataKeys.length) return false
  if (!prev.dataKeys.every((key, i) => key === next.dataKeys[i])) return false

  // For data, use smart comparison
  if (prev.data.length !== next.data.length) return false

  // For large datasets, use hash comparison
  if (prev.data.length > 100) {
    const prevHash = `${prev.data.length}-${JSON.stringify(prev.data[0])}`
    const nextHash = `${next.data.length}-${JSON.stringify(next.data[0])}`
    return prevHash === nextHash
  }

  // For small datasets, compare first and last
  if (JSON.stringify(prev.data[0]) !== JSON.stringify(next.data[0])) return false
  if (JSON.stringify(prev.data[prev.data.length - 1]) !== JSON.stringify(next.data[next.data.length - 1])) return false

  return true
}

export const OptimizedLineChart = memo<OptimizedChartProps>(
  function OptimizedLineChart({ data, dataKeys, title, showGrid = true }) {
    console.log(`[OptimizedLineChart] Rendering: ${title}`)

    return (
      <div className="w-full h-96">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={dataKeys[0]} />
            <YAxis />
            <Tooltip />
            <Legend />
            {dataKeys.slice(1).map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                isAnimationActive={data.length < 1000} // Disable animation for large datasets
                dot={data.length < 100} // Only show dots for small datasets
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  },
  chartPropsAreEqual
)

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

// ============================================================================
// EXAMPLE 2: Data Decimation (LTTB Algorithm)
// ============================================================================

interface Point {
  x: number
  y: number
  [key: string]: any
}

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling
 * Reduces data points while preserving visual shape
 */
export function downsampleLTTB<T extends Point>(
  data: T[],
  threshold: number
): T[] {
  if (data.length <= threshold) {
    return data
  }

  const sampled: T[] = []
  const bucketSize = (data.length - 2) / (threshold - 2)

  // Always include first point
  sampled.push(data[0])

  for (let i = 0; i < threshold - 2; i++) {
    // Calculate average point in next bucket
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1
    const avgRangeLength = avgRangeEnd - avgRangeStart

    let avgX = 0
    let avgY = 0
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += data[j].x
      avgY += data[j].y
    }
    avgX /= avgRangeLength
    avgY /= avgRangeLength

    // Find point with largest triangle area
    const rangeStart = Math.floor(i * bucketSize) + 1
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1

    let maxArea = -1
    let maxAreaPoint: T = data[rangeStart]

    const pointAX = sampled[sampled.length - 1].x
    const pointAY = sampled[sampled.length - 1].y

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].y - pointAY) -
        (pointAX - data[j].x) * (avgY - pointAY)
      ) * 0.5

      if (area > maxArea) {
        maxArea = area
        maxAreaPoint = data[j]
      }
    }

    sampled.push(maxAreaPoint)
  }

  // Always include last point
  sampled.push(data[data.length - 1])

  return sampled
}

// Usage Example
export function LargeDatasetChart({ rawData }: { rawData: Point[] }) {
  const decimatedData = useMemo(() => {
    const targetPoints = 500

    if (rawData.length <= targetPoints) {
      return rawData
    }

    console.log(`Decimating ${rawData.length} points to ${targetPoints}`)
    return downsampleLTTB(rawData, targetPoints)
  }, [rawData])

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={decimatedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis dataKey="y" />
          <Tooltip />
          <Line type="monotone" dataKey="y" stroke="#8884d8" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      {rawData.length > decimatedData.length && (
        <p className="text-sm text-gray-500 mt-2">
          Showing {decimatedData.length.toLocaleString()} of {rawData.length.toLocaleString()} data points
          ({Math.round((1 - decimatedData.length / rawData.length) * 100)}% reduction)
        </p>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 3: Lazy Loading with Intersection Observer
// ============================================================================

interface LazyChartProps {
  data: DataRow[]
  dataKeys: string[]
  title: string
  height?: number
}

export function LazyLoadedChart({ data, dataKeys, title, height = 400 }: LazyChartProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          setHasLoaded(true)
        } else if (hasLoaded) {
          // Optional: Unload chart when far from viewport to save memory
          setIsVisible(false)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px' // Load 100px before entering viewport
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [hasLoaded])

  return (
    <div
      ref={containerRef}
      style={{ minHeight: height }}
      className="border rounded-lg p-4"
    >
      {isVisible ? (
        <OptimizedLineChart
          data={data}
          dataKeys={dataKeys}
          title={title}
        />
      ) : hasLoaded ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          Scroll up to reload chart
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse space-y-4 w-full">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 4: Debounced Data Updates
// ============================================================================

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Usage: Debounce chart updates during rapid filter changes
export function FilterableChart({ data, filters }: { data: DataRow[], filters: any }) {
  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(row =>
      Object.entries(filters).every(([key, value]) => row[key] === value)
    )
  }, [data, filters])

  // Debounce the filtered data to prevent chart thrashing
  const debouncedData = useDebouncedValue(filteredData, 300)

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={debouncedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ============================================================================
// EXAMPLE 5: Throttled Callback Hook
// ============================================================================

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  const lastRan = useRef(Date.now())

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()

      if (now - lastRan.current >= delay) {
        callbackRef.current(...args)
        lastRan.current = now
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args)
          lastRan.current = Date.now()
        }, delay - (now - lastRan.current))
      }
    },
    [delay]
  ) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return throttledCallback
}

// Usage: Throttle resize events
export function ResponsiveChart({ data }: { data: DataRow[] }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleResize = useThrottledCallback((width: number, height: number) => {
    setDimensions({ width, height })
    console.log('Chart resized:', width, 'x', height)
  }, 200)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      handleResize(width, height)
    })

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [handleResize])

  return (
    <div ref={containerRef} className="w-full h-96">
      {dimensions.width > 0 && (
        <LineChart width={dimensions.width} height={dimensions.height} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Line type="monotone" dataKey="value" stroke="#8884d8" />
        </LineChart>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 6: Progressive Data Loading
// ============================================================================

export function useProgressiveData<T>(
  fullData: T[],
  chunkSize: number = 100,
  delay: number = 50
) {
  const [loadedData, setLoadedData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!fullData || fullData.length === 0) {
      setLoadedData([])
      setIsLoading(false)
      return
    }

    // Load initial chunk immediately
    setLoadedData(fullData.slice(0, chunkSize))

    if (fullData.length <= chunkSize) {
      setIsLoading(false)
      return
    }

    // Load remaining data progressively
    let currentIndex = chunkSize
    const intervalId = setInterval(() => {
      const nextChunk = fullData.slice(currentIndex, currentIndex + chunkSize)
      setLoadedData(prev => [...prev, ...nextChunk])

      currentIndex += chunkSize

      if (currentIndex >= fullData.length) {
        clearInterval(intervalId)
        setIsLoading(false)
      }
    }, delay)

    return () => clearInterval(intervalId)
  }, [fullData, chunkSize, delay])

  return {
    data: loadedData,
    isLoading,
    progress: fullData.length > 0 ? loadedData.length / fullData.length : 0
  }
}

// Usage
export function ProgressiveDataChart({ largeDataset }: { largeDataset: DataRow[] }) {
  const { data, isLoading, progress } = useProgressiveData(largeDataset, 200, 100)

  return (
    <div>
      {isLoading && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Loading data...</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis />
          <Line type="monotone" dataKey="y" stroke="#8884d8" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-sm text-gray-500 mt-2">
        Displaying {data.length.toLocaleString()} of {largeDataset.length.toLocaleString()} points
      </p>
    </div>
  )
}

// ============================================================================
// EXAMPLE 7: Adaptive Resolution Based on Container Width
// ============================================================================

export function useAdaptiveResolution(
  data: any[],
  containerRef: React.RefObject<HTMLElement | null>
) {
  const [resolution, setResolution] = useState(500)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width

      // Rule: 1 point per 2 pixels is optimal for line charts
      const targetPoints = Math.floor(width / 2)
      setResolution(Math.min(targetPoints, data.length))
    })

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [data.length])

  return resolution
}

// Usage
export function AdaptiveResolutionChart({ data }: { data: Point[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const targetResolution = useAdaptiveResolution(data, containerRef as React.RefObject<HTMLElement | null>)

  const adaptiveData = useMemo(() => {
    if (data.length <= targetResolution) {
      return data
    }

    // Use LTTB for downsampling
    return downsampleLTTB(data, targetResolution)
  }, [data, targetResolution])

  return (
    <div ref={containerRef} className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={adaptiveData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis dataKey="y" />
          <Tooltip />
          <Line type="monotone" dataKey="y" stroke="#8884d8" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-500 mt-2">
        Resolution: {adaptiveData.length} points (optimized for {targetResolution}px width)
      </p>
    </div>
  )
}

// ============================================================================
// EXAMPLE 8: Custom Tooltip with Memoization
// ============================================================================

// Memoize tooltip component to prevent unnecessary re-renders
const OptimizedTooltip = memo(function OptimizedTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-700">{entry.name}:</span>
          <span className="font-medium">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
})

export function ChartWithOptimizedTooltip({ data }: { data: DataRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip content={<OptimizedTooltip />} />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ============================================================================
// EXAMPLE 9: Batch Rendering Multiple Charts
// ============================================================================

interface ChartConfig {
  id: string
  data: DataRow[]
  dataKeys: string[]
  title: string
}

export function BatchedChartRenderer({
  charts,
  batchSize = 3,
  delay = 100
}: {
  charts: ChartConfig[]
  batchSize?: number
  delay?: number
}) {
  const [visibleCount, setVisibleCount] = useState(batchSize)

  useEffect(() => {
    if (visibleCount >= charts.length) return

    const timer = setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + batchSize, charts.length))
    }, delay)

    return () => clearTimeout(timer)
  }, [visibleCount, charts.length, batchSize, delay])

  return (
    <div className="space-y-4">
      {charts.slice(0, visibleCount).map(chart => (
        <OptimizedLineChart
          key={chart.id}
          data={chart.data}
          dataKeys={chart.dataKeys}
          title={chart.title}
        />
      ))}

      {visibleCount < charts.length && (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-pulse">
            Loading {charts.length - visibleCount} more charts...
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 10: Performance Monitoring Hook
// ============================================================================

interface PerformanceMetrics {
  renderTime: number
  renderCount: number
  dataSize: number
}

export function usePerformanceMonitor(
  componentName: string,
  logThreshold: number = 16 // 60fps = 16.67ms per frame
) {
  const renderStartTime = useRef<number>(0)
  const renderCount = useRef<number>(0)

  const startMeasure = useCallback(() => {
    renderStartTime.current = performance.now()
  }, [])

  const endMeasure = useCallback(
    (dataSize: number = 0) => {
      const renderTime = performance.now() - renderStartTime.current
      renderCount.current++

      const metrics: PerformanceMetrics = {
        renderTime: Math.round(renderTime * 100) / 100,
        renderCount: renderCount.current,
        dataSize
      }

      // Log slow renders
      if (renderTime > logThreshold) {
        console.warn(`🐌 Slow render in ${componentName}:`, {
          renderTime: `${metrics.renderTime}ms`,
          threshold: `${logThreshold}ms`,
          dataSize: dataSize > 0 ? `${dataSize} rows` : 'unknown',
          renderCount: metrics.renderCount
        })
      }

      return metrics
    },
    [componentName, logThreshold]
  )

  return { startMeasure, endMeasure, renderCount: renderCount.current }
}

// Usage
export function MonitoredChart({ data, dataKeys }: { data: DataRow[], dataKeys: string[] }) {
  const { startMeasure, endMeasure, renderCount } = usePerformanceMonitor('MonitoredChart', 32)

  useEffect(() => {
    startMeasure()
    return () => {
      endMeasure(data.length)
    }
  }, [startMeasure, endMeasure, data.length])

  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">
        Render count: {renderCount}
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={dataKeys[0]} />
          <YAxis />
          <Line type="monotone" dataKey={dataKeys[1]} stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
