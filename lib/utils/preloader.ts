// Preloading and prefetching utilities for performance optimization

interface PreloadOptions {
  priority?: 'high' | 'low'
  crossOrigin?: 'anonymous' | 'use-credentials'
  as?: 'script' | 'style' | 'image' | 'font' | 'fetch'
  type?: string
}

interface PrefetchOptions extends PreloadOptions {
  timeout?: number
  retries?: number
}

class ResourcePreloader {
  private preloadedResources = new Set<string>()
  private prefetchCache = new Map<string, Promise<any>>()
  private preloadQueue: Array<{ url: string; options: PreloadOptions }> = []
  private isProcessingQueue = false

  // Preload critical resources that are needed immediately
  preload(url: string, options: PreloadOptions = {}): Promise<void> {
    if (this.preloadedResources.has(url)) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = url
      
      if (options.as) link.as = options.as
      if (options.type) link.type = options.type
      if (options.crossOrigin) link.crossOrigin = options.crossOrigin
      if (options.priority) {
        link.fetchPriority = options.priority
      }

      link.onload = () => {
        this.preloadedResources.add(url)
        resolve()
      }
      
      link.onerror = () => {
        reject(new Error(`Failed to preload: ${url}`))
      }

      document.head.appendChild(link)
    })
  }

  // Prefetch resources that might be needed later
  prefetch(url: string, options: PrefetchOptions = {}): Promise<Response> {
    if (this.prefetchCache.has(url)) {
      return this.prefetchCache.get(url)!
    }

    const fetchPromise = this.fetchWithRetry(url, options)
    this.prefetchCache.set(url, fetchPromise)
    
    return fetchPromise
  }

  // Preload multiple resources with queue management
  batchPreload(resources: Array<{ url: string; options: PreloadOptions }>): Promise<void[]> {
    this.preloadQueue.push(...resources)
    
    if (!this.isProcessingQueue) {
      return this.processPreloadQueue()
    }
    
    return Promise.resolve([])
  }

  private async processPreloadQueue(): Promise<void[]> {
    this.isProcessingQueue = true
    const promises: Promise<void>[] = []

    // Process high priority resources first
    const sortedQueue = this.preloadQueue.sort((a, b) => {
      const aPriority = a.options.priority === 'high' ? 1 : 0
      const bPriority = b.options.priority === 'high' ? 1 : 0
      return bPriority - aPriority
    })

    for (const { url, options } of sortedQueue) {
      promises.push(this.preload(url, options))
    }

    this.preloadQueue = []
    this.isProcessingQueue = false
    
    return Promise.all(promises)
  }

  private async fetchWithRetry(
    url: string, 
    options: PrefetchOptions,
    attempt = 1
  ): Promise<Response> {
    const { timeout = 5000, retries = 2 } = options
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        priority: options.priority,
        ...options
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok && attempt <= retries) {
        return this.fetchWithRetry(url, options, attempt + 1)
      }
      
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (attempt <= retries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        return this.fetchWithRetry(url, options, attempt + 1)
      }
      
      throw error
    }
  }

  // Check if resource is already preloaded
  isPreloaded(url: string): boolean {
    return this.preloadedResources.has(url)
  }

  // Clear prefetch cache
  clearCache(): void {
    this.prefetchCache.clear()
  }

  // Get cache size
  getCacheSize(): number {
    return this.prefetchCache.size
  }
}

// Critical resources for the upload page
const UPLOAD_PAGE_RESOURCES = [
  {
    url: '/lib/utils/file-parser.js',
    options: { as: 'script' as const, priority: 'high' as const }
  },
  {
    url: '/lib/workers/file-parser.worker.js',
    options: { as: 'script' as const, priority: 'high' as const }
  }
]

// Dashboard resources to prefetch after upload
const DASHBOARD_RESOURCES = [
  {
    url: '/dashboard',
    options: { as: 'fetch' as const, priority: 'low' as const }
  },
  {
    url: '/lib/components/charts.js',
    options: { as: 'script' as const, priority: 'low' as const }
  }
]

// Singleton instance
let preloader: ResourcePreloader | null = null

export function getPreloader(): ResourcePreloader {
  if (!preloader) {
    preloader = new ResourcePreloader()
  }
  return preloader
}

// Convenience functions
export function preloadResource(
  url: string, 
  options: PreloadOptions = {}
): Promise<void> {
  return getPreloader().preload(url, options)
}

export function prefetchResource(
  url: string, 
  options: PrefetchOptions = {}
): Promise<Response> {
  return getPreloader().prefetch(url, options)
}

// Preload critical upload page resources
export async function preloadUploadResources(): Promise<void> {
  if (typeof window === 'undefined') return

  // Temporarily disabled to debug upload issues
  console.log('🔵 [PRELOADER] Skipping preload for debugging')
  return
  
  const preloader = getPreloader()
  
  try {
    await preloader.batchPreload(UPLOAD_PAGE_RESOURCES)
  } catch (error) {
    console.warn('Failed to preload some upload resources:', error)
  }
}

// Prefetch dashboard resources after successful upload
export async function prefetchDashboardResources(): Promise<void> {
  if (typeof window === 'undefined') return

  // Temporarily disabled to debug upload issues
  console.log('🔵 [PRELOADER] Skipping dashboard prefetch for debugging')
  return

  const preloader = getPreloader()
  
  // Use requestIdleCallback if available for non-critical prefetching
  const prefetchCallback = async () => {
    try {
      await preloader.batchPreload(DASHBOARD_RESOURCES)
    } catch (error) {
      console.warn('Failed to prefetch dashboard resources:', error)
    }
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetchCallback, { timeout: 5000 })
  } else {
    // Fallback to setTimeout
    setTimeout(prefetchCallback, 100)
  }
}

// Smart prefetching based on user behavior
export class SmartPrefetcher {
  private hoverTimeout: NodeJS.Timeout | null = null
  private touchStartTime = 0
  private prefetchThreshold = 100 // ms

  // Prefetch on hover with delay
  onHover(url: string, delay = 100): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout)
    }

    this.hoverTimeout = setTimeout(() => {
      prefetchResource(url, { priority: 'low' })
    }, delay)
  }

  // Cancel prefetch on hover end
  onHoverEnd(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout)
      this.hoverTimeout = null
    }
  }

  // Prefetch on touch start (for mobile)
  onTouchStart(url: string): void {
    this.touchStartTime = Date.now()
    
    // Prefetch after short delay to avoid prefetching on scrolling
    setTimeout(() => {
      if (Date.now() - this.touchStartTime > this.prefetchThreshold) {
        prefetchResource(url, { priority: 'low' })
      }
    }, this.prefetchThreshold)
  }

  // Prefetch based on viewport intersection
  onIntersection(url: string, intersectionRatio = 0.1): IntersectionObserver {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.intersectionRatio >= intersectionRatio) {
          prefetchResource(url, { priority: 'low' })
          observer.disconnect() // Only prefetch once
        }
      })
    }, {
      threshold: intersectionRatio
    })

    return observer
  }
}

// Hook for React components
export function usePreloader() {
  const preloader = getPreloader()
  const smartPrefetcher = new SmartPrefetcher()

  return {
    preload: preloader.preload.bind(preloader),
    prefetch: preloader.prefetch.bind(preloader),
    preloadQueue: preloader.preloadQueue.bind(preloader),
    isPreloaded: preloader.isPreloaded.bind(preloader),
    smartPrefetcher,
    preloadUploadResources,
    prefetchDashboardResources
  }
}

// Service Worker integration for advanced caching
export function registerPreloadServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  navigator.serviceWorker.register('/sw-preload.js').then(registration => {
    console.log('Preload service worker registered:', registration)
    
    // Send preload instructions to service worker
    if (registration.active) {
      registration.active.postMessage({
        type: 'PRELOAD_RESOURCES',
        resources: [...UPLOAD_PAGE_RESOURCES, ...DASHBOARD_RESOURCES]
      })
    }
  }).catch(error => {
    console.warn('Failed to register preload service worker:', error)
  })
}

// Network-aware prefetching
export function shouldPrefetch(): boolean {
  if (typeof window === 'undefined') return false

  // Check if user prefers reduced data usage
  const connection = (navigator as any).connection
  if (connection) {
    // Don't prefetch on slow connections or when save-data is enabled
    if (connection.saveData || 
        connection.effectiveType === 'slow-2g' || 
        connection.effectiveType === '2g') {
      return false
    }
  }

  // Check if user is on mobile with limited battery
  const battery = (navigator as any).battery
  if (battery && battery.level < 0.2) {
    return false
  }

  return true
}

// Performance monitoring for preloading
export function measurePreloadPerformance(resourceUrl: string): Promise<PerformanceEntry | null> {
  return new Promise((resolve) => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const entry = entries.find(e => e.name.includes(resourceUrl))
      
      if (entry) {
        observer.disconnect()
        resolve(entry)
      }
    })

    observer.observe({ entryTypes: ['resource'] })

    // Timeout after 10 seconds
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, 10000)
  })
}

export default {
  ResourcePreloader,
  SmartPrefetcher,
  getPreloader,
  preloadResource,
  prefetchResource,
  preloadUploadResources,
  prefetchDashboardResources,
  usePreloader,
  registerPreloadServiceWorker,
  shouldPrefetch,
  measurePreloadPerformance
}