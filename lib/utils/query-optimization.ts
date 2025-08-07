import { QueryClient } from '@tanstack/react-query'
import { logger } from './logger'

/**
 * Optimized React Query configuration for maximum performance
 */

// Create optimized query client
export const optimizedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Cache time: how long to keep data in cache after component unmounts
      gcTime: 10 * 60 * 1000, // 10 minutes
      
      // Refetch on window focus (disabled for performance)
      refetchOnWindowFocus: false,
      
      // Refetch on reconnect
      refetchOnReconnect: 'always',
      
      // Retry configuration
      retry: (failureCount, error: any) => {
        if (error?.status === 404) return false
        return failureCount < 3
      },
      
      // Retry delay
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Network mode
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry configuration for mutations
      retry: 1,
      
      // Network mode
      networkMode: 'offlineFirst',
    },
  },
})

/**
 * Prefetch data for better performance
 */
export async function prefetchData<T>(
  key: string[],
  fetcher: () => Promise<T>,
  options?: {
    staleTime?: number
    gcTime?: number
  }
) {
  return optimizedQueryClient.prefetchQuery({
    queryKey: key,
    queryFn: fetcher,
    staleTime: options?.staleTime || 5 * 60 * 1000,
    gcTime: options?.gcTime || 10 * 60 * 1000,
  })
}

/**
 * Optimistic update helper
 */
export function optimisticUpdate<T>(
  queryKey: string[],
  updater: (old: T) => T
) {
  const previousData = optimizedQueryClient.getQueryData<T>(queryKey)
  
  if (previousData) {
    optimizedQueryClient.setQueryData<T>(queryKey, updater(previousData))
  }
  
  return previousData
}

/**
 * Batch query invalidation
 */
export function batchInvalidate(queryKeys: string[][]) {
  // Use React Query's batch functionality
  optimizedQueryClient.invalidateQueries({
    predicate: (query) => {
      return queryKeys.some(key => 
        JSON.stringify(query.queryKey) === JSON.stringify(key)
      )
    }
  })
}

/**
 * Smart cache warming
 */
export function warmCache<T>(
  key: string[],
  data: T,
  options?: {
    staleTime?: number
  }
) {
  optimizedQueryClient.setQueryData(key, data, {
    updatedAt: Date.now(),
    staleTime: options?.staleTime || 5 * 60 * 1000,
  })
}

/**
 * Query performance monitor
 */
export function monitorQueryPerformance() {
  optimizedQueryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') {
      const query = event.query
      const fetchTime = query.state.dataUpdatedAt - (query.state.fetchStatus === 'fetching' ? Date.now() : 0)
      
      if (fetchTime > 1000) {
        logger.warn(`[Query] Slow query detected: ${JSON.stringify(query.queryKey)} took ${fetchTime}ms`)
      }
    }
  })
}

/**
 * Infinite query optimization
 */
export function optimizeInfiniteQuery<T>(
  data: T[],
  pageSize: number = 20
) {
  return {
    pages: Math.ceil(data.length / pageSize),
    pageParams: Array.from({ length: Math.ceil(data.length / pageSize) }, (_, i) => i),
    getNextPageParam: (lastPage: any, pages: any[]) => {
      return pages.length < Math.ceil(data.length / pageSize) ? pages.length : undefined
    }
  }
}

/**
 * Suspense-ready query wrapper
 */
export function suspenseQuery<T>(
  key: string[],
  fetcher: () => Promise<T>
) {
  return {
    queryKey: key,
    queryFn: fetcher,
    suspense: true,
    useErrorBoundary: true,
  }
}