'use client'

import React, { memo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

interface TabContentWrapperProps {
  tabId: string
  activeTabId: string
  children: React.ReactNode
  className?: string
  keepMounted?: boolean
}

/**
 * Wrapper component that keeps tab content mounted but hidden
 * This prevents re-renders when switching tabs
 */
export const TabContentWrapper = memo<TabContentWrapperProps>(function TabContentWrapper({
  tabId,
  activeTabId,
  children,
  className,
  keepMounted = true
}) {
  const [hasBeenActive, setHasBeenActive] = useState(false)
  const isActive = tabId === activeTabId

  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true)
    }
  }, [isActive, hasBeenActive])

  // If keepMounted is false, use the old behavior
  if (!keepMounted) {
    return isActive ? <>{children}</> : null
  }

  // If tab has never been active, don't render it yet (lazy loading)
  if (!hasBeenActive && !isActive) {
    return null
  }

  return (
    <div
      className={cn(
        'h-full w-full',
        isActive ? 'block' : 'hidden',
        className
      )}
    >
      {children}
    </div>
  )
})