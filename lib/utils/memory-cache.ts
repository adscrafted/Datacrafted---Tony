/**
 * Memory-efficient caching with automatic cleanup
 */

interface CacheEntry<T> {
  value: T
  timestamp: number
  size: number
  accessCount: number
  lastAccessed: number
}

interface CacheOptions {
  maxSize?: number // Max cache size in bytes
  maxAge?: number // Max age in milliseconds
  maxEntries?: number // Max number of entries
  onEvict?: (key: string, value: any) => void
}

export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private currentSize = 0
  private options: Required<CacheOptions>
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: 50 * 1024 * 1024, // 50MB default
      maxAge: 5 * 60 * 1000, // 5 minutes default
      maxEntries: 1000,
      onEvict: () => {},
      ...options
    }

    // Start periodic cleanup
    this.startCleanup()
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    const size = this.estimateSize(value)
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      size,
      accessCount: 0,
      lastAccessed: Date.now()
    }

    // Check if we need to evict entries
    if (this.currentSize + size > this.options.maxSize) {
      this.evictLRU(size)
    }

    // Remove old entry if exists
    const existing = this.cache.get(key)
    if (existing) {
      this.currentSize -= existing.size
    }

    this.cache.set(key, entry)
    this.currentSize += size

    // Set custom TTL if provided
    if (ttl) {
      setTimeout(() => this.delete(key), ttl)
    }

    // Check max entries
    if (this.cache.size > this.options.maxEntries) {
      this.evictOldest()
    }
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check if expired
    if (Date.now() - entry.timestamp > this.options.maxAge) {
      this.delete(key)
      return undefined
    }

    // Update access info
    entry.accessCount++
    entry.lastAccessed = Date.now()

    return entry.value
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check expiration
    if (Date.now() - entry.timestamp > this.options.maxAge) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    this.currentSize -= entry.size
    this.cache.delete(key)
    this.options.onEvict(key, entry.value)
    return true
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.forEach((entry, key) => {
      this.options.onEvict(key, entry.value)
    })
    this.cache.clear()
    this.currentSize = 0
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.currentSize,
      entries: this.cache.size,
      hitRate: this.calculateHitRate()
    }
  }

  /**
   * Estimate size of a value
   */
  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2 // 2 bytes per char
    }
    
    try {
      return JSON.stringify(value).length * 2
    } catch {
      return 1024 // Default 1KB for non-serializable
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    let freedSpace = 0
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break
      
      freedSpace += entry.size
      this.delete(key)
    }
  }

  /**
   * Evict oldest entries
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)

    // Remove oldest 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1)
    for (let i = 0; i < toRemove; i++) {
      this.delete(entries[i][0])
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateHitRate(): number {
    let totalAccess = 0
    this.cache.forEach(entry => {
      totalAccess += entry.accessCount
    })
    return this.cache.size > 0 ? totalAccess / this.cache.size : 0
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > this.options.maxAge) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => this.delete(key))
    }, 60000) // Run every minute
  }

  /**
   * Destroy the cache
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.clear()
  }
}

// Global caches for different data types
export const dataCache = new MemoryCache({
  maxSize: 100 * 1024 * 1024, // 100MB for data
  maxAge: 10 * 60 * 1000 // 10 minutes
})

export const chartCache = new MemoryCache({
  maxSize: 20 * 1024 * 1024, // 20MB for charts
  maxAge: 5 * 60 * 1000 // 5 minutes
})