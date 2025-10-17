/**
 * Web Vitals Performance Monitoring
 *
 * Track and report Core Web Vitals metrics for dashboard performance monitoring
 */

'use client';

import { useEffect, useRef } from 'react';

// Type definitions for Web Vitals metrics
interface Metric {
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

// Thresholds based on web.dev recommendations
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Get rating based on metric value
 */
function getRating(
  name: Metric['name'],
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name];

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Send metrics to analytics service
 */
function sendToAnalytics(metric: Metric) {
  // Example: Send to Google Analytics
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as any).gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
    });
  }

  // Example: Send to custom analytics endpoint
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
    navigator.sendBeacon(
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
      JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
      })
    );
  }

  // Console logging in development
  if (process.env.NODE_ENV === 'development') {
    const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
    console.log(
      `${emoji} ${metric.name}:`,
      Math.round(metric.value),
      'ms',
      `(${metric.rating})`
    );
  }
}

/**
 * React hook to monitor Web Vitals
 */
export function useWebVitals(
  options: {
    onMetric?: (metric: Metric) => void;
    enableConsoleLogging?: boolean;
    enableAnalytics?: boolean;
  } = {}
) {
  const {
    onMetric,
    enableConsoleLogging = process.env.NODE_ENV === 'development',
    enableAnalytics = true,
  } = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dynamically import web-vitals library
    import('web-vitals').then(({ onCLS, onFCP, onFID, onINP, onLCP, onTTFB }) => {
      const handleMetric = (metric: any) => {
        const enrichedMetric: Metric = {
          ...metric,
          rating: getRating(metric.name, metric.value),
        };

        if (enableConsoleLogging) {
          console.table({
            [metric.name]: {
              Value: `${Math.round(metric.value)}ms`,
              Rating: enrichedMetric.rating,
              Delta: `${Math.round(metric.delta)}ms`,
            },
          });
        }

        if (enableAnalytics) {
          sendToAnalytics(enrichedMetric);
        }

        if (onMetric) {
          onMetric(enrichedMetric);
        }
      };

      // Register all metrics
      onCLS(handleMetric);
      onFCP(handleMetric);
      onFID(handleMetric);
      onINP(handleMetric);
      onLCP(handleMetric);
      onTTFB(handleMetric);
    });
  }, [onMetric, enableConsoleLogging, enableAnalytics]);
}

/**
 * Performance metrics dashboard component
 */
export function usePerformanceDashboard() {
  const metrics = useRef<Map<string, Metric>>(new Map());

  useWebVitals({
    onMetric: (metric) => {
      metrics.current.set(metric.name, metric);
    },
  });

  return {
    getMetric: (name: Metric['name']) => metrics.current.get(name),
    getAllMetrics: () => Array.from(metrics.current.values()),
    getScore: () => {
      const allMetrics = Array.from(metrics.current.values());
      if (allMetrics.length === 0) return 0;

      const goodCount = allMetrics.filter(m => m.rating === 'good').length;
      return Math.round((goodCount / allMetrics.length) * 100);
    },
  };
}

/**
 * Custom performance markers for specific operations
 */
export class PerformanceTracker {
  private marks: Map<string, number> = new Map();

  start(label: string) {
    this.marks.set(label, performance.now());
  }

  end(label: string): number | null {
    const startTime = this.marks.get(label);
    if (!startTime) return null;

    const duration = performance.now() - startTime;
    this.marks.delete(label);

    if (process.env.NODE_ENV === 'development') {
      const emoji = duration < 100 ? '✅' : duration < 500 ? '⚠️' : '❌';
      console.log(`${emoji} ${label}: ${Math.round(duration)}ms`);
    }

    return duration;
  }

  measure<T>(label: string, callback: () => T): T {
    this.start(label);
    const result = callback();
    this.end(label);
    return result;
  }

  async measureAsync<T>(label: string, callback: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await callback();
    } finally {
      this.end(label);
    }
  }
}

/**
 * React hook for operation-specific performance tracking
 */
export function usePerformanceTracker() {
  const tracker = useRef(new PerformanceTracker());
  return tracker.current;
}

/**
 * Memory monitoring utilities
 */
export function useMemoryMonitor(
  options: {
    interval?: number;
    warnThreshold?: number;
    onHighMemory?: (usage: number) => void;
  } = {}
) {
  const { interval = 10000, warnThreshold = 0.9, onHighMemory } = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('memory' in performance)) {
      console.warn('Memory monitoring not supported in this browser');
      return;
    }

    const checkMemory = () => {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      if (usageRatio > warnThreshold) {
        const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
        const limitMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);

        console.warn(
          `⚠️ High memory usage: ${usedMB} MB / ${limitMB} MB (${Math.round(usageRatio * 100)}%)`
        );

        if (onHighMemory) {
          onHighMemory(usageRatio);
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('💾 Memory:', {
          used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
          usage: `${Math.round(usageRatio * 100)}%`,
        });
      }
    };

    const intervalId = setInterval(checkMemory, interval);
    checkMemory(); // Check immediately

    return () => clearInterval(intervalId);
  }, [interval, warnThreshold, onHighMemory]);
}

/**
 * Chart-specific performance monitoring
 */
export function useChartPerformanceMonitor(chartId: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const tracker = usePerformanceTracker();

  useEffect(() => {
    renderCount.current++;
    const timeSinceLastRender = Date.now() - lastRenderTime.current;
    lastRenderTime.current = Date.now();

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Chart ${chartId}:`, {
        renderCount: renderCount.current,
        timeSinceLastRender: `${timeSinceLastRender}ms`,
      });
    }
  });

  return {
    trackDataProcessing: <T,>(callback: () => T) => {
      return tracker.measure(`Chart ${chartId} - Data Processing`, callback);
    },
    trackRender: () => {
      tracker.start(`Chart ${chartId} - Render`);
      return () => {
        tracker.end(`Chart ${chartId} - Render`);
      };
    },
    getRenderCount: () => renderCount.current,
  };
}

/**
 * Network performance monitoring
 */
export function useNetworkMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;

          if (process.env.NODE_ENV === 'development') {
            console.log('🌐 Network:', {
              name: resource.name.split('/').pop(),
              duration: `${Math.round(resource.duration)}ms`,
              size: resource.transferSize ? `${Math.round(resource.transferSize / 1024)}KB` : 'cached',
              type: resource.initiatorType,
            });
          }

          // Warn about slow requests
          if (resource.duration > 3000) {
            console.warn(`⚠️ Slow network request (${Math.round(resource.duration)}ms):`, resource.name);
          }
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => observer.disconnect();
  }, []);
}

/**
 * Comprehensive performance monitoring suite
 */
export function usePerformanceMonitoring(
  options: {
    enableWebVitals?: boolean;
    enableMemoryMonitor?: boolean;
    enableNetworkMonitor?: boolean;
    enableChartMonitor?: boolean;
  } = {}
) {
  const {
    enableWebVitals = true,
    enableMemoryMonitor = true,
    enableNetworkMonitor = process.env.NODE_ENV === 'development',
    enableChartMonitor = process.env.NODE_ENV === 'development',
  } = options;

  // Web Vitals - always call hook, control behavior with options
  useWebVitals({
    enableConsoleLogging: enableWebVitals,
    enableAnalytics: enableWebVitals,
  });

  // Memory monitoring - always call hook, control behavior with options
  useMemoryMonitor({
    interval: enableMemoryMonitor ? 10000 : 3600000, // Check rarely if disabled
    onHighMemory: enableMemoryMonitor ? (usage) => {
      // You could trigger cleanup or show warning to user
      console.error('Memory usage is critically high:', usage);
    } : undefined,
  });

  // Network monitoring - always call hook, control behavior internally
  useNetworkMonitor();

  // Performance tracker
  const tracker = usePerformanceTracker();

  return {
    tracker,
    trackOperation: tracker.measure.bind(tracker),
    trackAsyncOperation: tracker.measureAsync.bind(tracker),
  };
}

/**
 * Usage Examples:
 *
 * // In app layout:
 * export default function RootLayout({ children }) {
 *   usePerformanceMonitoring();
 *   return <html><body>{children}</body></html>;
 * }
 *
 * // In a chart component:
 * const MyChart = ({ chartId, data }) => {
 *   const { trackDataProcessing, trackRender } = useChartPerformanceMonitor(chartId);
 *
 *   const processedData = useMemo(() => {
 *     return trackDataProcessing(() => {
 *       return processChartData(data);
 *     });
 *   }, [data, trackDataProcessing]);
 *
 *   useEffect(() => {
 *     const endTracking = trackRender();
 *     return endTracking;
 *   });
 *
 *   return <LineChart data={processedData} />;
 * };
 *
 * // For async operations:
 * const { trackAsyncOperation } = usePerformanceMonitoring();
 *
 * const fetchData = async () => {
 *   const data = await trackAsyncOperation('Fetch BigQuery Data', async () => {
 *     return await bigquery.query('SELECT * FROM dataset');
 *   });
 * };
 */
