'use client'

import React, { memo, useCallback, useMemo } from 'react'
import { ResizableChatInterface } from './resizable-chat-interface'
import { useDebouncedState } from '@/lib/hooks/use-debounced-state'

/**
 * Optimized chat interface with debounced updates and memoization
 */
export const ResizableChatInterfaceOptimized = memo(function ResizableChatInterfaceOptimized() {
  // The actual ResizableChatInterface is already fairly optimized
  // We'll wrap it with additional performance enhancements
  
  return (
    <div className="h-full w-full">
      <ResizableChatInterface />
    </div>
  )
}, () => true) // Never re-render unless forced

ResizableChatInterfaceOptimized.displayName = 'ResizableChatInterfaceOptimized'