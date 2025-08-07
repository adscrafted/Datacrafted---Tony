/**
 * Application Monitoring and Error Tracking
 */
import React from 'react'

interface ErrorContext {
  userId?: string
  sessionId?: string
  component?: string
  action?: string
  metadata?: Record<string, any>
}

interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count'
  context?: Record<string, any>
}

class AppMonitoring {
  private static instance: AppMonitoring
  private isProduction: boolean
  private sentryDsn?: string

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production'
    this.sentryDsn = process.env.SENTRY_DSN
  }

  public static getInstance(): AppMonitoring {
    if (!AppMonitoring.instance) {
      AppMonitoring.instance = new AppMonitoring()
    }
    return AppMonitoring.instance
  }

  /**
   * Initialize monitoring services
   */
  public async initialize() {
    if (this.isProduction && this.sentryDsn) {
      // Initialize Sentry for error tracking (when installed)
      // Uncomment when Sentry is installed: npm install @sentry/nextjs
      /*
      try {
        const { init } = await import('@sentry/nextjs')
        init({
          dsn: this.sentryDsn,
          environment: process.env.NODE_ENV,
          tracesSampleRate: 0.1,
          beforeSend: (event: any) => {
            // Filter out common non-critical errors
            if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
              return null
            }
            return event
          }
        })
        console.log('Sentry initialized for error tracking')
      } catch (error) {
        console.warn('Failed to initialize Sentry:', error)
      }
      */
    }
  }

  /**
   * Log application errors
   */
  public logError(error: Error, context?: ErrorContext) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context
    }

    if (this.isProduction) {
      // Send to external monitoring service
      this.sendToMonitoring('error', errorData)
    } else {
      // Log to console in development
      console.error('Application Error:', errorData)
    }
  }

  /**
   * Log performance metrics
   */
  public logPerformance(metric: PerformanceMetric) {
    const performanceData = {
      ...metric,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.pathname : undefined
    }

    if (this.isProduction) {
      this.sendToMonitoring('performance', performanceData)
    } else {
      console.log('Performance Metric:', performanceData)
    }
  }

  /**
   * Log user interactions for analytics
   */
  public logUserEvent(event: string, properties?: Record<string, any>) {
    const eventData = {
      event,
      properties,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.pathname : undefined
    }

    if (this.isProduction) {
      this.sendToMonitoring('event', eventData)
    } else {
      console.log('User Event:', eventData)
    }
  }

  /**
   * Monitor API response times
   */
  public async monitorApiCall<T>(
    apiName: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await apiCall()
      const duration = Date.now() - startTime
      
      this.logPerformance({
        name: `api_${apiName}_success`,
        value: duration,
        unit: 'ms'
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      this.logPerformance({
        name: `api_${apiName}_error`,
        value: duration,
        unit: 'ms'
      })
      
      this.logError(error as Error, {
        component: 'api',
        action: apiName
      })
      
      throw error
    }
  }

  /**
   * Monitor file processing performance
   */
  public monitorFileProcessing(
    fileName: string,
    fileSize: number,
    processingTimeMs: number,
    success: boolean
  ) {
    this.logPerformance({
      name: 'file_processing_time',
      value: processingTimeMs,
      unit: 'ms',
      context: {
        fileName,
        fileSize,
        success,
        throughput: fileSize / (processingTimeMs / 1000) // bytes per second
      }
    })
  }

  /**
   * Monitor chart rendering performance
   */
  public monitorChartRendering(
    chartType: string,
    dataPoints: number,
    renderTimeMs: number
  ) {
    this.logPerformance({
      name: 'chart_rendering_time',
      value: renderTimeMs,
      unit: 'ms',
      context: {
        chartType,
        dataPoints,
        efficiency: dataPoints / renderTimeMs
      }
    })
  }

  /**
   * Track feature usage
   */
  public trackFeatureUsage(feature: string, properties?: Record<string, any>) {
    this.logUserEvent('feature_used', {
      feature,
      ...properties
    })
  }

  /**
   * Send data to monitoring service
   */
  private async sendToMonitoring(type: string, data: any) {
    try {
      // In production, send to analytics/monitoring service
      if (typeof window !== 'undefined') {
        // Client-side monitoring
        await fetch('/api/monitoring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ type, data })
        })
      }
    } catch (error) {
      console.warn('Failed to send monitoring data:', error)
    }
  }

  /**
   * Get system performance info
   */
  public getSystemPerformance() {
    if (typeof window === 'undefined') return null

    const performance = window.performance
    const memory = (performance as any).memory

    return {
      memory: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      } : null,
      timing: {
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')
          .find(entry => entry.name === 'first-paint')?.startTime || null
      },
      navigation: performance.navigation ? {
        type: performance.navigation.type,
        redirectCount: performance.navigation.redirectCount
      } : null
    }
  }
}

// Export singleton instance
export const monitoring = AppMonitoring.getInstance()

// Error boundary helper
export function withErrorBoundary<T extends Record<string, any>>(
  Component: React.ComponentType<T>
): React.ComponentType<T> {
  return function WrappedComponent(props: T) {
    const [hasError, setHasError] = React.useState(false)

    React.useEffect(() => {
      const handleError = (error: ErrorEvent) => {
        monitoring.logError(new Error(error.message), {
          component: Component.name,
          action: 'runtime_error'
        })
        setHasError(true)
      }

      window.addEventListener('error', handleError)
      return () => window.removeEventListener('error', handleError)
    }, [])

    if (hasError) {
      return React.createElement('div', {
        className: 'error-fallback'
      }, 'Something went wrong. Please refresh the page.')
    }

    return React.createElement(Component, props)
  }
}

// Performance monitoring hook
export function usePerformanceMonitoring(componentName: string) {
  React.useEffect(() => {
    const startTime = Date.now()
    
    return () => {
      const mountTime = Date.now() - startTime
      monitoring.logPerformance({
        name: 'component_mount_time',
        value: mountTime,
        unit: 'ms',
        context: { component: componentName }
      })
    }
  }, [componentName])
}