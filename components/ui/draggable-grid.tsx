'use client'

import React, { useState, useCallback } from 'react'
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout'
import { cn } from '@/lib/utils/cn'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface DraggableGridProps {
  children: React.ReactElement[]
  layouts?: Layouts
  onLayoutChange?: (layout: Layout[], layouts: Layouts) => void
  className?: string
  isDraggable?: boolean
  isResizable?: boolean
  margin?: [number, number]
  containerPadding?: [number, number]
  rowHeight?: number
  cols?: { [key: string]: number }
  breakpoints?: { [key: string]: number }
  compactType?: 'vertical' | 'horizontal' | null
  preventCollision?: boolean
}

const defaultCols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }
const defaultBreakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }

export function DraggableGrid({
  children,
  layouts,
  onLayoutChange,
  className,
  isDraggable = true,
  isResizable = true,
  margin = [16, 16],
  containerPadding = [16, 16],
  rowHeight = 60,
  cols = defaultCols,
  breakpoints = defaultBreakpoints,
  compactType = 'vertical',
  preventCollision = false
}: DraggableGridProps) {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg')
  const [mounted, setMounted] = useState(false)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Track container width to determine if we should maintain positions
  React.useEffect(() => {
    if (!containerRef.current) return
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    
    resizeObserver.observe(containerRef.current)
    
    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const handleLayoutChange = useCallback((layout: Layout[], layouts: Layouts) => {
    onLayoutChange?.(layout, layouts)
  }, [onLayoutChange])

  const handleBreakpointChange = useCallback((breakpoint: string) => {
    setCurrentBreakpoint(breakpoint)
  }, [])

  // Don't render until mounted to avoid SSR issues
  if (!mounted) {
    return (
      <div className={cn('grid gap-4', className)}>
        {children}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative draggable-grid-container', className)}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        onBreakpointChange={handleBreakpointChange}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={rowHeight}
        margin={margin}
        containerPadding={containerPadding}
        isDraggable={isDraggable}
        isResizable={isResizable}
        compactType={null}
        preventCollision={true}
        useCSSTransforms={true}
        measureBeforeMount={false}
        transformScale={1}
        autoSize={false}
        verticalCompact={false}
      >
        {children.map((child, index) => (
          <div
            key={child.key || `grid-item-${index}`}
            className={cn(
              'relative overflow-hidden',
              isDraggable && 'cursor-move'
            )}
          >
            {child}
          </div>
        ))}
      </ResponsiveGridLayout>
      
      <style jsx global>{`
        .react-grid-layout {
          position: relative;
          transition: none !important;
        }
        
        .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top, width, height;
        }
        
        .react-grid-item.cssTransforms {
          transition-property: transform, width, height;
        }
        
        /* Prevent layout shift during sidebar resize */
        .draggable-grid-container {
          contain: layout;
        }
        
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
          bottom: 0;
          right: 0;
          background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNiIgaGVpZ2h0PSI2IiB2aWV3Qm94PSIwIDAgNiA2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZG90cyBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiM5OTk5OTkiLz4KPGN5cmNsZSBjeD0iMSIgY3k9IjUiIHI9IjEiIGZpbGw9IiM5OTk5OTkiLz4KPGN5cmNsZSBjeD0iNSIgY3k9IjEiIHI9IjEiIGZpbGw9IiM5OTk5OTkiLz4KPGN5cmNsZSBjeD0iNSIgY3k9IjUiIHI9IjEiIGZpbGw9IiM5OTk5OTkiLz4KPC9zdmc+Cg==') no-repeat bottom right;
          padding: 0 3px 3px 0;
          background-repeat: no-repeat;
          background-origin: content-box;
          box-sizing: border-box;
          cursor: se-resize;
          opacity: 0;
          transition: opacity 200ms ease;
        }
        
        .react-grid-item:hover > .react-resizable-handle {
          opacity: 1;
        }
        
        .react-grid-item.react-grid-placeholder {
          background: rgba(59, 130, 246, 0.15);
          border: 2px dashed rgba(59, 130, 246, 0.4);
          border-radius: 8px;
          opacity: 0.6;
          transition-duration: 100ms;
          z-index: 2;
          user-select: none;
        }
        
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        .react-grid-item.resizing {
          opacity: 0.9;
          z-index: 3;
        }
      `}</style>
    </div>
  )
}

// Helper function to generate default layouts
export function generateDefaultLayout(itemCount: number, cols = 12): Layout[] {
  const itemsPerRow = Math.floor(cols / 3) // Default to 3-column layout
  
  return Array.from({ length: itemCount }, (_, i) => ({
    i: `grid-item-${i}`,
    x: (i % itemsPerRow) * 3,
    y: Math.floor(i / itemsPerRow) * 2,
    w: 3,
    h: 2,
    minW: 2,
    minH: 2
  }))
}

// Helper function to create responsive layouts
export function generateResponsiveLayouts(layout: Layout[]): Layouts {
  return {
    lg: layout,
    md: layout.map(item => ({ ...item, w: Math.min(item.w, 8) })),
    sm: layout.map(item => ({ ...item, w: Math.min(item.w, 6), x: (item.x) % 6 })),
    xs: layout.map(item => ({ ...item, w: 4, x: 0 })),
    xxs: layout.map(item => ({ ...item, w: 2, x: 0 }))
  }
}