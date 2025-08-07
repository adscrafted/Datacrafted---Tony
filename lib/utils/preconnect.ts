/**
 * Network optimization utilities
 * Preconnect to external resources for faster loading
 */

interface PreconnectOptions {
  rel?: 'preconnect' | 'dns-prefetch' | 'preload' | 'prefetch'
  crossOrigin?: 'anonymous' | 'use-credentials'
  as?: string
  type?: string
}

class NetworkOptimizer {
  private addedLinks = new Set<string>()

  /**
   * Add a preconnect link to improve connection speed
   */
  preconnect(url: string, options: PreconnectOptions = {}) {
    const { rel = 'preconnect', crossOrigin = 'anonymous' } = options
    const key = `${rel}-${url}`

    if (this.addedLinks.has(key)) return

    const link = document.createElement('link')
    link.rel = rel
    link.href = url
    
    if (crossOrigin && rel === 'preconnect') {
      link.crossOrigin = crossOrigin
    }
    
    if (options.as) {
      link.setAttribute('as', options.as)
    }
    
    if (options.type) {
      link.setAttribute('type', options.type)
    }

    document.head.appendChild(link)
    this.addedLinks.add(key)
  }

  /**
   * Preload critical resources
   */
  preload(url: string, as: string, type?: string) {
    this.preconnect(url, { rel: 'preload', as, type })
  }

  /**
   * Prefetch resources for future navigation
   */
  prefetch(url: string) {
    this.preconnect(url, { rel: 'prefetch' })
  }

  /**
   * DNS prefetch for faster domain resolution
   */
  dnsPrefetch(url: string) {
    this.preconnect(url, { rel: 'dns-prefetch' })
  }

  /**
   * Optimize for common CDNs and services
   */
  optimizeCommonServices() {
    // Common CDNs
    this.preconnect('https://cdn.jsdelivr.net')
    this.preconnect('https://unpkg.com')
    this.preconnect('https://cdnjs.cloudflare.com')
    
    // Google Fonts
    this.preconnect('https://fonts.googleapis.com')
    this.preconnect('https://fonts.gstatic.com', { crossOrigin: 'anonymous' })
    
    // Analytics
    this.dnsPrefetch('https://www.google-analytics.com')
    this.dnsPrefetch('https://www.googletagmanager.com')
  }
}

// Singleton instance
export const networkOptimizer = new NetworkOptimizer()

/**
 * Resource hints for better performance
 */
export function addResourceHints() {
  if (typeof window === 'undefined') return

  // Add hints on idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      networkOptimizer.optimizeCommonServices()
    })
  } else {
    setTimeout(() => {
      networkOptimizer.optimizeCommonServices()
    }, 1000)
  }
}

/**
 * Lazy load images with native loading attribute
 */
export function optimizeImages() {
  if (!('loading' in HTMLImageElement.prototype)) return

  const images = document.querySelectorAll('img:not([loading])')
  images.forEach(img => {
    if (img instanceof HTMLImageElement) {
      img.loading = 'lazy'
    }
  })
}

/**
 * Connection-aware loading
 */
export function getConnectionQuality(): 'slow' | 'medium' | 'fast' {
  if (!('connection' in navigator)) return 'medium'
  
  const connection = (navigator as any).connection
  const effectiveType = connection.effectiveType
  
  switch (effectiveType) {
    case 'slow-2g':
    case '2g':
      return 'slow'
    case '3g':
      return 'medium'
    case '4g':
    case '5g':
    default:
      return 'fast'
  }
}

/**
 * Adaptive loading based on connection
 */
export function shouldLoadHighQuality(): boolean {
  const quality = getConnectionQuality()
  const saveData = (navigator as any).connection?.saveData || false
  
  return quality === 'fast' && !saveData
}