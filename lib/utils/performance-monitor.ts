interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
  tags?: string[]
}

interface MemoryUsage {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface NetworkInfo {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

interface PerformanceReport {
  metrics: PerformanceMetric[]
  memoryUsage?: MemoryUsage
  networkInfo?: NetworkInfo
  deviceInfo: {
    userAgent: string
    platform: string
    hardwareConcurrency: number
    deviceMemory?: number
  }
  timestamp: number
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map()
  private observers: PerformanceObserver[] = []
  private memoryCheckInterval?: NodeJS.Timeout

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeBrowserAPIs()
    }
  }

  private initializeBrowserAPIs() {
    // Performance Observer for navigation timing
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            this.recordNavigationTiming(entry)
          })
        })
        observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] })
        this.observers.push(observer)
      } catch (error) {
        console.warn('PerformanceObserver not fully supported:', error)
      }
    }

    // Memory monitoring
    this.startMemoryMonitoring()

    // Page visibility change monitoring
    document.addEventListener('visibilitychange', () => {
      this.recordMetric('page_visibility_change', {
        visible: !document.hidden,
        timestamp: Date.now()
      })
    })
  }

  private recordNavigationTiming(entry: PerformanceEntry) {
    if (entry.entryType === 'navigation') {
      const navEntry = entry as PerformanceNavigationTiming
      this.recordMetric('page_load', {
        duration: navEntry.loadEventEnd - navEntry.fetchStart,
        domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
        firstContentfulPaint: this.getFirstContentfulPaint(),
        largestContentfulPaint: this.getLargestContentfulPaint()
      })
    }
  }

  private getFirstContentfulPaint(): number | null {
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]
    return fcpEntry ? fcpEntry.startTime : null
  }

  private getLargestContentfulPaint(): number | null {
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    const lcpEntry = lcpEntries[lcpEntries.length - 1]
    return lcpEntry ? lcpEntry.startTime : null
  }

  private startMemoryMonitoring() {
    if ('memory' in performance) {
      this.memoryCheckInterval = setInterval(() => {
        const memory = (performance as any).memory
        this.recordMetric('memory_usage', {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          timestamp: Date.now()
        })
      }, 5000) // Check every 5 seconds
    }
  }

  // Start timing a metric
  startTiming(name: string, metadata?: Record<string, any>, tags?: string[]): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata: metadata || {},
      tags: tags || []
    }
    this.metrics.set(name, metric)
  }

  // End timing a metric
  endTiming(name: string, additionalMetadata?: Record<string, any>): number | null {
    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`No metric found with name: ${name}`)
      return null
    }

    const endTime = performance.now()
    const duration = endTime - metric.startTime

    metric.endTime = endTime
    metric.duration = duration
    
    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata }
    }

    // Log significant metrics
    if (duration > 1000) {
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`, metric.metadata)
    }

    return duration
  }

  // Record a simple metric
  recordMetric(name: string, data: Record<string, any>, tags?: string[]): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      endTime: performance.now(),
      duration: 0,
      metadata: data,
      tags: tags || []
    }
    this.metrics.set(`${name}_${Date.now()}`, metric)
  }

  // Measure function execution
  measureFunction<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    this.startTiming(name, metadata)
    try {
      const result = fn()
      this.endTiming(name, { success: true })
      return result
    } catch (error) {
      this.endTiming(name, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  // Measure async function execution
  async measureAsyncFunction<T>(
    name: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startTiming(name, metadata)
    try {
      const result = await fn()
      this.endTiming(name, { success: true })
      return result
    } catch (error) {
      this.endTiming(name, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  // Get current memory usage
  getMemoryUsage(): MemoryUsage | null {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      }
    }
    return null
  }

  // Get network information
  getNetworkInfo(): NetworkInfo | null {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      }
    }
    return null
  }

  // Get device information
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory
    }
  }

  // Generate performance report
  generateReport(): PerformanceReport {
    const completedMetrics = Array.from(this.metrics.values()).filter(m => m.duration !== undefined)

    return {
      metrics: completedMetrics,
      memoryUsage: this.getMemoryUsage() || undefined,
      networkInfo: this.getNetworkInfo() || undefined,
      deviceInfo: this.getDeviceInfo(),
      timestamp: Date.now()
    }
  }

  // Get metrics by tag
  getMetricsByTag(tag: string): PerformanceMetric[] {
    return Array.from(this.metrics.values()).filter(m => 
      m.tags && m.tags.includes(tag)
    )
  }

  // Get metrics by name pattern
  getMetricsByPattern(pattern: RegExp): PerformanceMetric[] {
    return Array.from(this.metrics.values()).filter(m => 
      pattern.test(m.name)
    )
  }

  // Clear old metrics
  clearOldMetrics(maxAge: number = 5 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge
    const toDelete: string[] = []

    for (const [key, metric] of Array.from(this.metrics.entries())) {
      if (metric.startTime < cutoff) {
        toDelete.push(key)
      }
    }

    toDelete.forEach(key => this.metrics.delete(key))
  }

  // Log performance summary
  logSummary(tag?: string): void {
    const metrics = tag ? this.getMetricsByTag(tag) : Array.from(this.metrics.values())
    const completedMetrics = metrics.filter(m => m.duration !== undefined)

    if (completedMetrics.length === 0) {
      console.log('No completed metrics to summarize')
      return
    }

    console.group(`Performance Summary${tag ? ` (${tag})` : ''}`)
    
    // Group by metric name
    const grouped = completedMetrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = []
      }
      acc[metric.name].push(metric)
      return acc
    }, {} as Record<string, PerformanceMetric[]>)

    Object.entries(grouped).forEach(([name, metrics]) => {
      const durations = metrics.map(m => m.duration!).filter(d => d > 0)
      if (durations.length === 0) return

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      const min = Math.min(...durations)
      const max = Math.max(...durations)

      console.log(`${name}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms, count=${durations.length}`)
    })

    // Memory usage
    const memoryUsage = this.getMemoryUsage()
    if (memoryUsage) {
      console.log(`Memory: ${(memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB used`)
    }

    console.groupEnd()
  }

  // Cleanup
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval)
    }
    
    this.metrics.clear()
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor()
  }
  return performanceMonitor
}

// Convenience functions
export function startTiming(name: string, metadata?: Record<string, any>, tags?: string[]): void {
  getPerformanceMonitor().startTiming(name, metadata, tags)
}

export function endTiming(name: string, additionalMetadata?: Record<string, any>): number | null {
  return getPerformanceMonitor().endTiming(name, additionalMetadata)
}

export function measureFunction<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
  return getPerformanceMonitor().measureFunction(name, fn, metadata)
}

export function measureAsyncFunction<T>(
  name: string, 
  fn: () => Promise<T>, 
  metadata?: Record<string, any>
): Promise<T> {
  return getPerformanceMonitor().measureAsyncFunction(name, fn, metadata)
}

export function recordMetric(name: string, data: Record<string, any>, tags?: string[]): void {
  getPerformanceMonitor().recordMetric(name, data, tags)
}

export function logPerformanceSummary(tag?: string): void {
  getPerformanceMonitor().logSummary(tag)
}

export function getPerformanceReport(): PerformanceReport {
  return getPerformanceMonitor().generateReport()
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const monitor = getPerformanceMonitor()

  return {
    startTiming: monitor.startTiming.bind(monitor),
    endTiming: monitor.endTiming.bind(monitor),
    recordMetric: monitor.recordMetric.bind(monitor),
    measureFunction: monitor.measureFunction.bind(monitor),
    measureAsyncFunction: monitor.measureAsyncFunction.bind(monitor),
    getReport: monitor.generateReport.bind(monitor),
    logSummary: monitor.logSummary.bind(monitor)
  }
}