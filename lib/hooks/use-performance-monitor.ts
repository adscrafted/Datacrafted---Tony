import React, { useEffect, useRef, useCallback } from 'react'

interface PerformanceMetrics {
  renderTime: number
  componentCount: number
  memoryUsage: number
  dataSize: number
}

interface PerformanceOptions {
  trackRenders?: boolean
  trackMemory?: boolean
  logThreshold?: number // ms
  onMetrics?: (metrics: PerformanceMetrics) => void
}

/**
 * Hook for monitoring dashboard performance metrics
 */
export function usePerformanceMonitor(
  componentName: string, 
  options: PerformanceOptions = {}
) {
  const {
    trackRenders = true,
    trackMemory = false,
    logThreshold = 16, // 60fps = 16.67ms per frame
    onMetrics
  } = options

  const renderStartTime = useRef<number>(0)
  const renderCount = useRef<number>(0)
  const metricsHistory = useRef<PerformanceMetrics[]>([])

  const startMeasure = useCallback(() => {
    if (trackRenders) {
      renderStartTime.current = performance.now()
    }
  }, [trackRenders])

  const endMeasure = useCallback((dataSize: number = 0) => {
    if (!trackRenders) return

    const renderTime = performance.now() - renderStartTime.current
    renderCount.current++

    let memoryUsage = 0
    if (trackMemory && 'memory' in performance) {
      // @ts-ignore - performance.memory is not in standard types
      memoryUsage = performance.memory?.usedJSHeapSize || 0
    }

    const metrics: PerformanceMetrics = {
      renderTime: Math.round(renderTime * 100) / 100,
      componentCount: renderCount.current,
      memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
      dataSize
    }

    // Store metrics history (keep last 50 measurements)
    metricsHistory.current = [...metricsHistory.current, metrics].slice(-50)

    // Log slow renders
    if (renderTime > logThreshold) {
      console.warn(`🐌 Slow render in ${componentName}:`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        threshold: `${logThreshold}ms`,
        dataSize: dataSize > 0 ? `${dataSize} rows` : 'unknown',
        memoryUsage: memoryUsage > 0 ? `${metrics.memoryUsage}MB` : 'not tracked'
      })
    }

    // Call callback if provided
    onMetrics?.(metrics)
  }, [trackRenders, trackMemory, logThreshold, componentName, onMetrics])

  const getMetricsSummary = useCallback(() => {
    const history = metricsHistory.current
    if (history.length === 0) return null

    const recentMetrics = history.slice(-10) // Last 10 measurements
    const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length
    const maxRenderTime = Math.max(...recentMetrics.map(m => m.renderTime))
    const currentMemory = recentMetrics[recentMetrics.length - 1]?.memoryUsage || 0

    return {
      componentName,
      averageRenderTime: Math.round(avgRenderTime * 100) / 100,
      maxRenderTime: Math.round(maxRenderTime * 100) / 100,
      totalRenders: renderCount.current,
      currentMemoryUsage: currentMemory,
      fps: avgRenderTime > 0 ? Math.round(1000 / avgRenderTime) : 0
    }
  }, [componentName])

  // Performance observer for Core Web Vitals (if available)
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          console.log(`📊 LCP for ${componentName}:`, `${entry.startTime.toFixed(2)}ms`)
        }
        if (entry.entryType === 'first-input' && 'processingStart' in entry) {
          // @ts-ignore - FID properties not in standard types
          const fid = entry.processingStart - entry.startTime
          console.log(`📊 FID for ${componentName}:`, `${fid.toFixed(2)}ms`)
        }
      })
    })

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })
    } catch (e) {
      // Some browsers don't support all entry types
    }

    return () => observer.disconnect()
  }, [componentName])

  return {
    startMeasure,
    endMeasure,
    getMetricsSummary,
    renderCount: renderCount.current,
    metricsHistory: metricsHistory.current
  }
}

/**
 * Higher-order component for automatic performance monitoring
 */
export function withPerformanceMonitoring<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  componentName: string,
  options?: PerformanceOptions
): React.ComponentType<T> {
  const PerformanceMonitoredComponent: React.ComponentType<T> = (props: T) => {
    const { startMeasure, endMeasure } = usePerformanceMonitor(componentName, options)

    useEffect(() => {
      startMeasure()
      return () => {
        endMeasure()
      }
    })

    return React.createElement(Component, props)
  }
  
  return PerformanceMonitoredComponent
}

/**
 * Development-only performance logger
 */
export function logPerformanceMetrics(metrics: PerformanceMetrics, componentName: string) {
  if (process.env.NODE_ENV !== 'development') return

  console.group(`📊 Performance Metrics: ${componentName}`)
  console.log(`Render time: ${metrics.renderTime}ms`)
  console.log(`Component renders: ${metrics.componentCount}`)
  console.log(`Data size: ${metrics.dataSize} rows`)
  if (metrics.memoryUsage > 0) {
    console.log(`Memory usage: ${metrics.memoryUsage}MB`)
  }
  console.groupEnd()
}