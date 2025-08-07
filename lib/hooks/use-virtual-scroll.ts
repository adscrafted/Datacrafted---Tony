import { useState, useCallback, useRef, useEffect } from 'react'

interface VirtualScrollOptions {
  itemHeight: number
  containerHeight: number
  overscan?: number
  getItemHeight?: (index: number) => number
}

interface VirtualScrollResult<T> {
  virtualItems: Array<{
    index: number
    start: number
    size: number
    item: T
  }>
  totalHeight: number
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void
  measureElement: (el: HTMLElement | null, index: number) => void
}

/**
 * Advanced virtual scrolling hook for rendering large lists efficiently
 */
export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
): VirtualScrollResult<T> {
  const {
    itemHeight,
    containerHeight,
    overscan = 3,
    getItemHeight
  } = options

  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLElement | null>(null)
  const measuredHeights = useRef<Map<number, number>>(new Map())

  // Calculate which items should be rendered
  const calculateRange = useCallback(() => {
    const rangeStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const rangeEnd = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    return { rangeStart, rangeEnd }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])

  const { rangeStart, rangeEnd } = calculateRange()

  // Generate virtual items
  const virtualItems = []
  let accumulatedHeight = 0

  for (let i = 0; i < items.length; i++) {
    const height = getItemHeight?.(i) || measuredHeights.current.get(i) || itemHeight
    
    if (i >= rangeStart && i <= rangeEnd) {
      virtualItems.push({
        index: i,
        start: accumulatedHeight,
        size: height,
        item: items[i]
      })
    }
    
    accumulatedHeight += height
  }

  const totalHeight = accumulatedHeight

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    if (!scrollElementRef.current || index < 0 || index >= items.length) return

    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += getItemHeight?.(i) || measuredHeights.current.get(i) || itemHeight
    }

    const itemSize = getItemHeight?.(index) || measuredHeights.current.get(index) || itemHeight

    switch (align) {
      case 'start':
        scrollElementRef.current.scrollTop = offset
        break
      case 'center':
        scrollElementRef.current.scrollTop = offset - containerHeight / 2 + itemSize / 2
        break
      case 'end':
        scrollElementRef.current.scrollTop = offset - containerHeight + itemSize
        break
    }
  }, [items.length, itemHeight, containerHeight, getItemHeight])

  // Measure element heights for dynamic sizing
  const measureElement = useCallback((el: HTMLElement | null, index: number) => {
    if (!el) return
    
    const height = el.getBoundingClientRect().height
    if (height !== measuredHeights.current.get(index)) {
      measuredHeights.current.set(index, height)
      // Force re-render if height changed
      setScrollTop(prev => prev + 0.001)
    }
  }, [])

  // Set up scroll listener
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      setScrollTop(target.scrollTop)
      scrollElementRef.current = target
    }

    // Try to find scrollable parent
    const scrollParent = document.querySelector('[data-virtual-scroll-container]')
    if (scrollParent) {
      scrollParent.addEventListener('scroll', handleScroll)
      scrollElementRef.current = scrollParent as HTMLElement
      return () => scrollParent.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return {
    virtualItems,
    totalHeight,
    scrollToIndex,
    measureElement
  }
}