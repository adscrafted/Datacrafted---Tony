import { useState, useMemo, useCallback, useEffect } from 'react'
import { DataRow } from '@/lib/store'
import { logger } from '@/lib/utils/logger'

interface ProgressiveDataOptions {
  initialPageSize?: number
  incrementSize?: number
  maxRows?: number
}

interface ProgressiveDataResult<T = DataRow> {
  visibleData: T[]
  loadedRows: number
  totalRows: number
  hasMore: boolean
  isLoading: boolean
  loadMore: () => void
  loadAll: () => void
  reset: () => void
  progress: number
}

/**
 * Hook for progressively loading large datasets
 * Prevents UI blocking by loading data in chunks
 */
export function useProgressiveDataLoading<T = DataRow>(
  data: T[],
  options: ProgressiveDataOptions = {}
): ProgressiveDataResult<T> {
  const {
    initialPageSize = 1000,
    incrementSize = 1000,
    maxRows = Infinity
  } = options

  const [loadedRows, setLoadedRows] = useState(initialPageSize)
  const [isLoading, setIsLoading] = useState(false)

  const totalRows = Math.min(data.length, maxRows)

  // Calculate visible data
  const visibleData = useMemo(() => {
    const endIndex = Math.min(loadedRows, totalRows)
    return data.slice(0, endIndex)
  }, [data, loadedRows, totalRows])

  // Load more data progressively
  const loadMore = useCallback(() => {
    if (isLoading || loadedRows >= totalRows) return

    setIsLoading(true)
    
    // Use requestIdleCallback for better performance
    const loadChunk = () => {
      const newLoadedRows = Math.min(loadedRows + incrementSize, totalRows)
      setLoadedRows(newLoadedRows)
      setIsLoading(false)
      
      logger.debug(`[Progressive Loading] Loaded ${newLoadedRows} of ${totalRows} rows`)
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadChunk, { timeout: 100 })
    } else {
      setTimeout(loadChunk, 0)
    }
  }, [loadedRows, totalRows, incrementSize, isLoading])

  // Load all remaining data
  const loadAll = useCallback(() => {
    if (isLoading) return

    setIsLoading(true)
    
    // Load in chunks to prevent blocking
    const chunks = Math.ceil((totalRows - loadedRows) / incrementSize)
    let currentChunk = 0

    const loadNextChunk = () => {
      if (currentChunk >= chunks) {
        setIsLoading(false)
        return
      }

      const start = loadedRows + (currentChunk * incrementSize)
      const end = Math.min(start + incrementSize, totalRows)
      
      setLoadedRows(end)
      currentChunk++
      
      if (currentChunk < chunks) {
        requestAnimationFrame(loadNextChunk)
      } else {
        setIsLoading(false)
      }
    }

    requestAnimationFrame(loadNextChunk)
  }, [loadedRows, totalRows, incrementSize, isLoading])

  // Reset to initial state
  const reset = useCallback(() => {
    setLoadedRows(initialPageSize)
    setIsLoading(false)
  }, [initialPageSize])

  // Calculate progress
  const progress = useMemo(() => {
    return totalRows > 0 ? (loadedRows / totalRows) * 100 : 100
  }, [loadedRows, totalRows])

  // Auto-load when data changes
  useEffect(() => {
    reset()
  }, [data, reset])

  return {
    visibleData,
    loadedRows,
    totalRows,
    hasMore: loadedRows < totalRows,
    isLoading,
    loadMore,
    loadAll,
    reset,
    progress
  }
}

/**
 * Hook for virtualized scrolling of large datasets
 * Only renders visible items based on scroll position
 */
export function useVirtualizedData<T = DataRow>(
  data: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
) {
  const [scrollTop, setScrollTop] = useState(0)

  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(data.length, start + visibleCount + overscan * 2)

    return {
      startIndex: start,
      endIndex: end,
      totalHeight: data.length * itemHeight,
      offsetY: start * itemHeight
    }
  }, [data.length, itemHeight, containerHeight, scrollTop, overscan])

  const visibleData = useMemo(() => 
    data.slice(startIndex, endIndex),
    [data, startIndex, endIndex]
  )

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    visibleData,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  }
}