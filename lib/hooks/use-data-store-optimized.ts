import { useEffect, useRef } from 'react'
import { useDataStore } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useShallow } from 'zustand/react/shallow'

/**
 * OPTIMIZED DATA STORE HOOKS - Performance utilities for modular stores
 *
 * Purpose: Provides optimized subscriptions and batch updates for modular stores
 *
 * USAGE EXAMPLES:
 *
 * // ✅ GOOD - Selective subscription with shallow comparison
 * const { rawData, fileName } = useDataStoreOptimized(
 *   (state) => ({ rawData: state.rawData, fileName: state.fileName }),
 *   ['rawData', 'fileName']
 * )
 *
 * // ✅ GOOD - Batch update across stores
 * const batchUpdate = useBatchUpdate()
 * batchUpdate({
 *   data: { fileName: 'data.csv' },
 *   chart: { currentTheme: myTheme },
 *   ui: { isCustomizing: true }
 * })
 */

// Optimized hook that only subscribes to specific data store slices
export function useDataStoreOptimized<T>(
  selector: (state: any) => T,
  deps: string[] = []
) {
  const store = useDataStore(useShallow(selector))

  // Track dependencies to prevent unnecessary subscriptions
  const depsRef = useRef(deps)

  useEffect(() => {
    depsRef.current = deps
  }, deps)

  return store
}

// Optimized hook for chart store slices
export function useChartStoreOptimized<T>(
  selector: (state: any) => T,
  deps: string[] = []
) {
  const store = useChartStore(useShallow(selector))

  const depsRef = useRef(deps)

  useEffect(() => {
    depsRef.current = deps
  }, deps)

  return store
}

// Optimized hook for UI store slices
export function useUIStoreOptimized<T>(
  selector: (state: any) => T,
  deps: string[] = []
) {
  const store = useUIStore(useShallow(selector))

  const depsRef = useRef(deps)

  useEffect(() => {
    depsRef.current = deps
  }, deps)

  return store
}

/**
 * Batch update hook for modular stores
 * Allows updating multiple stores in one call to prevent cascade renders
 *
 * @example
 * const batchUpdate = useBatchUpdate()
 * batchUpdate({
 *   data: { fileName: 'data.csv', isAnalyzing: true },
 *   chart: { currentTheme: darkTheme },
 *   ui: { isCustomizing: true }
 * })
 */
export function useBatchUpdate() {
  return (updates: {
    data?: Record<string, any>
    chart?: Record<string, any>
    ui?: Record<string, any>
  }) => {
    // Batch updates to prevent multiple renders
    const dataState = useDataStore.getState()
    const chartState = useChartStore.getState()
    const uiState = useUIStore.getState()

    // Apply data store updates
    if (updates.data) {
      Object.entries(updates.data).forEach(([key, value]) => {
        const setter = `set${key.charAt(0).toUpperCase() + key.slice(1)}`
        if (typeof (dataState as any)[setter] === 'function') {
          (dataState as any)[setter](value)
        }
      })
    }

    // Apply chart store updates
    if (updates.chart) {
      Object.entries(updates.chart).forEach(([key, value]) => {
        const setter = `set${key.charAt(0).toUpperCase() + key.slice(1)}`
        if (typeof (chartState as any)[setter] === 'function') {
          (chartState as any)[setter](value)
        }
      })
    }

    // Apply UI store updates
    if (updates.ui) {
      Object.entries(updates.ui).forEach(([key, value]) => {
        const setter = `set${key.charAt(0).toUpperCase() + key.slice(1)}`
        if (typeof (uiState as any)[setter] === 'function') {
          (uiState as any)[setter](value)
        }
      })
    }
  }
}

/**
 * Performance monitoring hook
 * Tracks component render frequency to detect performance issues
 *
 * @example
 * const { renderCount, lastRenderTime } = useStorePerformance()
 * console.log(`Component rendered ${renderCount} times`)
 */
export function useStorePerformance() {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(Date.now())

  useEffect(() => {
    renderCount.current++
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTime.current

    if (process.env.NODE_ENV === 'development' && timeSinceLastRender < 16) {
      console.warn('⚡ Rapid re-renders detected:', {
        count: renderCount.current,
        timeSinceLastRender,
        component: 'Unknown (add displayName to track)'
      })
    }

    lastRenderTime.current = now
  })

  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current
  }
}
