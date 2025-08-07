import { useEffect, useRef } from 'react'
import { useDataStore } from '@/lib/store'
import { shallow } from 'zustand/shallow'

// Optimized hook that only subscribes to specific store slices
export function useDataStoreOptimized<T>(
  selector: (state: any) => T,
  deps: string[] = []
) {
  const store = useDataStore(selector, shallow)
  
  // Track dependencies to prevent unnecessary subscriptions
  const depsRef = useRef(deps)
  
  useEffect(() => {
    depsRef.current = deps
  }, deps)
  
  return store
}

// Batch update hook
export function useBatchUpdate() {
  return useDataStore(state => state.batchUpdate || ((updates: Record<string, any>) => {
    // Default implementation if batchUpdate doesn't exist
    const storeState = useDataStore.getState()
    Object.entries(updates).forEach(([key, value]) => {
      const setter = `set${key.charAt(0).toUpperCase() + key.slice(1)}`
      if (typeof (storeState as any)[setter] === 'function') {
        (storeState as any)[setter](value)
      }
    })
  }))
}

// Performance monitoring hook
export function useStorePerformance() {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(Date.now())
  
  useEffect(() => {
    renderCount.current++
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTime.current
    
    if (process.env.NODE_ENV === 'development' && timeSinceLastRender < 16) {
      console.warn('Rapid re-renders detected:', {
        count: renderCount.current,
        timeSinceLastRender
      })
    }
    
    lastRenderTime.current = now
  })
  
  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current
  }
}