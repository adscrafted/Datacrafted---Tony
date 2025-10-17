import { DataRow, DataSchema } from '@/lib/store'

interface CacheEntry<T> {
  data: T
  timestamp: number
  size: number
  hits: number
  metadata?: Record<string, any>
}

interface CacheOptions {
  maxSize?: number // in bytes
  maxAge?: number // in milliseconds
  maxEntries?: number
  persistToStorage?: boolean
  compressionEnabled?: boolean
}

class CacheManager<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private options: Required<CacheOptions>
  private currentSize = 0

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB default
      maxAge: options.maxAge || 30 * 60 * 1000, // 30 minutes default
      maxEntries: options.maxEntries || 100,
      persistToStorage: options.persistToStorage || false,
      compressionEnabled: options.compressionEnabled || false
    }

    // Load from storage if persistence is enabled
    if (this.options.persistToStorage && typeof window !== 'undefined') {
      this.loadFromStorage()
    }

    // Cleanup interval
    setInterval(() => this.cleanup(), 5 * 60 * 1000) // Every 5 minutes
  }

  // Generate cache key from file or data characteristics
  private generateKey(input: File | string | object): string {
    if (input instanceof File) {
      return `file_${input.name}_${input.size}_${input.lastModified}`
    }
    
    if (typeof input === 'string') {
      return input
    }

    // For objects, create a hash based on content
    return `obj_${this.hashObject(input)}`
  }

  private hashObject(obj: object): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort())
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  private estimateSize(data: T): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      // Fallback estimation
      return JSON.stringify(data).length * 2
    }
  }

  private compress(data: T): string {
    if (!this.options.compressionEnabled) {
      return JSON.stringify(data)
    }

    // Simple compression using JSON + Unicode-safe encoding
    // Use TextEncoder to convert UTF-8 to bytes, then to base64
    const jsonStr = JSON.stringify(data)

    // Unicode-safe base64 encoding
    try {
      // Convert string to UTF-8 bytes, then to base64
      const uint8Array = new TextEncoder().encode(jsonStr)
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('')
      return btoa(binaryString)
    } catch (error) {
      // Fallback: return uncompressed if encoding fails
      console.warn('Compression failed, using uncompressed data:', error)
      return jsonStr
    }
  }

  private decompress(compressedData: string): T {
    if (!this.options.compressionEnabled) {
      return JSON.parse(compressedData)
    }

    try {
      // Decode base64 to bytes, then to UTF-8 string
      const binaryString = atob(compressedData)
      const uint8Array = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
      }
      const jsonStr = new TextDecoder().decode(uint8Array)
      return JSON.parse(jsonStr)
    } catch (error) {
      // Fallback for uncompressed or old format data
      try {
        return JSON.parse(compressedData)
      } catch {
        // Try old btoa format as last resort
        const jsonStr = atob(compressedData)
        return JSON.parse(jsonStr)
      }
    }
  }

  // Set data in cache
  set(key: string | File | object, data: T, metadata?: Record<string, any>): void {
    const cacheKey = this.generateKey(key)
    const size = this.estimateSize(data)
    
    // Check if we need to make space
    if (size > this.options.maxSize) {
      console.warn('Data too large for cache:', size)
      return
    }

    // Remove old entry if exists
    if (this.cache.has(cacheKey)) {
      const oldEntry = this.cache.get(cacheKey)!
      this.currentSize -= oldEntry.size
    }

    // Make space if needed
    while (
      this.currentSize + size > this.options.maxSize ||
      this.cache.size >= this.options.maxEntries
    ) {
      this.evictLeastUsed()
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      size,
      hits: 0,
      metadata
    }

    this.cache.set(cacheKey, entry)
    this.currentSize += size

    // Persist to storage if enabled
    if (this.options.persistToStorage) {
      this.saveToStorage(cacheKey, entry)
    }
  }

  // Get data from cache
  get(key: string | File | object): T | null {
    const cacheKey = this.generateKey(key)
    const entry = this.cache.get(cacheKey)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.options.maxAge) {
      this.cache.delete(cacheKey)
      this.currentSize -= entry.size
      return null
    }

    // Update hit count
    entry.hits++
    
    return entry.data
  }

  // Check if key exists in cache
  has(key: string | File | object): boolean {
    const cacheKey = this.generateKey(key)
    const entry = this.cache.get(cacheKey)
    
    if (!entry) return false
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.options.maxAge) {
      this.cache.delete(cacheKey)
      this.currentSize -= entry.size
      return false
    }
    
    return true
  }

  // Remove specific entry
  delete(key: string | File | object): boolean {
    const cacheKey = this.generateKey(key)
    const entry = this.cache.get(cacheKey)
    
    if (entry) {
      this.currentSize -= entry.size
      this.cache.delete(cacheKey)
      
      if (this.options.persistToStorage && typeof window !== 'undefined') {
        localStorage.removeItem(`cache_${cacheKey}`)
      }
      
      return true
    }
    
    return false
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
    this.currentSize = 0
    
    if (this.options.persistToStorage && typeof window !== 'undefined') {
      // Clear all cache entries from localStorage
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key)
        }
      })
    }
  }

  // Evict least recently used entry
  private evictLeastUsed(): void {
    let lruKey: string | null = null
    let lruTime = Date.now()
    let lruHits = Infinity

    for (const [key, entry] of Array.from(this.cache.entries())) {
      // Prioritize by hits first, then by time
      if (entry.hits < lruHits || (entry.hits === lruHits && entry.timestamp < lruTime)) {
        lruKey = key
        lruTime = entry.timestamp
        lruHits = entry.hits
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey)!
      this.currentSize -= entry.size
      this.cache.delete(lruKey)
    }
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > this.options.maxAge) {
        toDelete.push(key)
      }
    }

    toDelete.forEach(key => {
      const entry = this.cache.get(key)!
      this.currentSize -= entry.size
      this.cache.delete(key)
    })
  }

  // Get cache statistics
  getStats(): {
    size: number
    entries: number
    maxSize: number
    maxEntries: number
    hitRate: number
    oldestEntry: number
    newestEntry: number
  } {
    let totalHits = 0
    let totalRequests = 0
    let oldestTime = Date.now()
    let newestTime = 0

    for (const entry of Array.from(this.cache.values())) {
      totalHits += entry.hits
      totalRequests += entry.hits + 1 // +1 for the initial set
      oldestTime = Math.min(oldestTime, entry.timestamp)
      newestTime = Math.max(newestTime, entry.timestamp)
    }

    return {
      size: this.currentSize,
      entries: this.cache.size,
      maxSize: this.options.maxSize,
      maxEntries: this.options.maxEntries,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      oldestEntry: oldestTime,
      newestEntry: newestTime
    }
  }

  // Persist to localStorage
  private saveToStorage(key: string, entry: CacheEntry<T>): void {
    if (typeof window === 'undefined') return

    try {
      const storageKey = `cache_${key}`
      const storageData = {
        data: this.compress(entry.data),
        timestamp: entry.timestamp,
        metadata: entry.metadata
      }
      
      // Check size before saving (rough estimate)
      const dataSize = JSON.stringify(storageData).length
      if (dataSize > 2 * 1024 * 1024) { // Skip if > 2MB
        console.info('Skipping cache storage for large data:', key)
        return
      }
      
      localStorage.setItem(storageKey, JSON.stringify(storageData))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        // Clear old cache entries and try again
        this.clearOldStorageEntries()
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify({
            data: this.compress(entry.data),
            timestamp: entry.timestamp,
            metadata: entry.metadata
          }))
        } catch (retryError) {
          console.warn('Cache storage full, skipping:', key)
        }
      } else {
        console.warn('Failed to save cache entry to storage:', error)
      }
    }
  }
  
  private clearOldStorageEntries(): void {
    const keys = Object.keys(localStorage)
    const cacheKeys = keys.filter(key => key.startsWith('cache_'))
    
    // Sort by timestamp and remove oldest entries
    const entries = cacheKeys.map(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}')
        return { key, timestamp: data.timestamp || 0 }
      } catch {
        return { key, timestamp: 0 }
      }
    })
    
    entries.sort((a, b) => a.timestamp - b.timestamp)
    
    // Remove oldest 50% of entries
    const toRemove = Math.ceil(entries.length / 2)
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key)
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const keys = Object.keys(localStorage)
      const cacheKeys = keys.filter(key => key.startsWith('cache_'))

      for (const storageKey of cacheKeys) {
        const key = storageKey.replace('cache_', '')
        const storageData = JSON.parse(localStorage.getItem(storageKey) || '{}')
        
        // Check if expired
        if (Date.now() - storageData.timestamp > this.options.maxAge) {
          localStorage.removeItem(storageKey)
          continue
        }

        const data = this.decompress(storageData.data)
        const size = this.estimateSize(data)

        const entry: CacheEntry<T> = {
          data,
          timestamp: storageData.timestamp,
          size,
          hits: 0,
          metadata: storageData.metadata
        }

        this.cache.set(key, entry)
        this.currentSize += size
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error)
    }
  }
}

// Specialized cache instances
export const fileDataCache = new CacheManager<{
  data: DataRow[]
  meta: any
}>({
  maxSize: 100 * 1024 * 1024, // 100MB for file data
  maxAge: 60 * 60 * 1000, // 1 hour
  maxEntries: 10,
  persistToStorage: true,
  compressionEnabled: true
})

export const schemaCache = new CacheManager<DataSchema>({
  maxSize: 10 * 1024 * 1024, // 10MB for schemas
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  maxEntries: 50,
  persistToStorage: true,
  compressionEnabled: true
})

export const analysisCache = new CacheManager<any>({
  maxSize: 20 * 1024 * 1024, // 20MB for analysis results
  maxAge: 2 * 60 * 60 * 1000, // 2 hours
  maxEntries: 25,
  persistToStorage: true,
  compressionEnabled: true
})

// Utility functions for cache management
export function getCacheKey(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`
}

export function clearAllCaches(): void {
  fileDataCache.clear()
  schemaCache.clear()
  analysisCache.clear()
}

export function getCacheStats() {
  return {
    fileData: fileDataCache.getStats(),
    schema: schemaCache.getStats(),
    analysis: analysisCache.getStats()
  }
}

// Cache warming for common operations
export function warmCache(file: File, data: DataRow[], schema?: DataSchema) {
  const key = getCacheKey(file)
  
  // Cache file data
  fileDataCache.set(key, {
    data,
    meta: {
      fileName: file.name,
      fileSize: file.size,
      rowCount: data.length,
      columnCount: Object.keys(data[0] || {}).length
    }
  })

  // Cache schema if provided
  if (schema) {
    schemaCache.set(key, schema)
  }
}

export { CacheManager }