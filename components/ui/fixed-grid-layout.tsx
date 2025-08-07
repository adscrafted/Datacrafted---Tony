'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import { cn } from '@/lib/utils/cn'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

interface FixedGridLayoutProps {
  children: React.ReactElement[]
  layout: Layout[]
  onLayoutChange?: (layout: Layout[]) => void
  className?: string
  isDraggable?: boolean
  isResizable?: boolean
  margin?: [number, number]
  containerPadding?: [number, number]
  rowHeight?: number
  cols?: number
}

export function FixedGridLayout({
  children,
  layout,
  onLayoutChange,
  className,
  isDraggable = true,
  isResizable = true,
  margin = [16, 16],
  containerPadding = [0, 0],
  rowHeight = 80,
  cols = 12
}: FixedGridLayoutProps) {
  const [mounted, setMounted] = useState(false)
  const [width, setWidth] = useState(1200)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        // Get the full width of the container minus any padding
        const containerWidth = containerRef.current.offsetWidth
        setWidth(Math.max(containerWidth - 32, 800)) // Ensure minimum width
      }
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(() => {
      updateWidth()
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    onLayoutChange?.(newLayout)
  }, [onLayoutChange])

  // Don't render until mounted to avoid SSR issues
  if (!mounted) {
    return (
      <div ref={containerRef} className={cn('grid gap-4', className)}>
        {children}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative fixed-grid-container', className)}>
      <GridLayout
        className="layout"
        layout={layout}
        onLayoutChange={handleLayoutChange}
        cols={cols}
        rowHeight={rowHeight}
        width={width}
        margin={margin}
        containerPadding={containerPadding}
        isDraggable={isDraggable}
        isResizable={isResizable}
        draggableHandle={isDraggable ? ".drag-handle" : undefined}
        resizeHandles={['se', 'sw', 'ne', 'nw', 'n', 's', 'e', 'w']}
        compactType={null}
        preventCollision={true}
        useCSSTransforms={true}
        transformScale={1}
        autoSize={false}
        verticalCompact={false}
        allowOverlap={false}
      >
        {children}
      </GridLayout>
      
      <style jsx global>{`
        .fixed-grid-container {
          width: 100%;
        }
        
        .fixed-grid-container .react-grid-layout {
          position: relative;
          transition: none !important;
          min-height: 200px;
        }
        
        .fixed-grid-container .react-grid-item {
          box-sizing: border-box;
          transition: width 200ms ease, height 200ms ease;
          border-radius: 8px;
        }
        
        ${isDraggable ? `
        .fixed-grid-container .react-grid-item {
          cursor: move;
          border: 2px dashed rgba(59, 130, 246, 0.3);
          user-select: none;
        }
        ` : `
        .fixed-grid-container .react-grid-item {
          cursor: default;
          border: none;
        }
        `}
        
        
        .fixed-grid-container .react-grid-item.cssTransforms {
          transition: transform 200ms ease, width 200ms ease, height 200ms ease;
        }
        
        .fixed-grid-container .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        /* Base styles for all resize handles */
        .fixed-grid-container .react-grid-item > .react-resizable-handle {
          position: absolute;
          opacity: 0;
          transition: opacity 200ms ease;
          z-index: 10;
        }
        
        .fixed-grid-container .react-grid-item:hover > .react-resizable-handle {
          opacity: 1;
        }
        
        /* Corner handles */
        .fixed-grid-container .react-grid-item > .react-resizable-handle-se,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-sw,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-ne,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-nw {
          width: 20px;
          height: 20px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-se {
          bottom: 0;
          right: 0;
          cursor: se-resize;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-sw {
          bottom: 0;
          left: 0;
          cursor: sw-resize;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-ne {
          top: 0;
          right: 0;
          cursor: ne-resize;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-nw {
          top: 0;
          left: 0;
          cursor: nw-resize;
        }
        
        /* Edge handles */
        .fixed-grid-container .react-grid-item > .react-resizable-handle-n,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-s {
          left: 0;
          right: 0;
          height: 10px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-n {
          top: 0;
          cursor: n-resize;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-s {
          bottom: 0;
          cursor: s-resize;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-e,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-w {
          top: 0;
          bottom: 0;
          width: 10px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-e {
          right: 0;
          cursor: e-resize;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-w {
          left: 0;
          cursor: w-resize;
        }
        
        /* Visual indicators for all handles */
        .fixed-grid-container .react-grid-item > .react-resizable-handle::after {
          content: '';
          position: absolute;
          background: rgba(59, 130, 246, 0.5);
          transition: all 200ms ease;
        }
        
        /* Corner handle indicators */
        .fixed-grid-container .react-grid-item > .react-resizable-handle-se::after,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-sw::after,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-ne::after,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-nw::after {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-se::after {
          bottom: 3px;
          right: 3px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-sw::after {
          bottom: 3px;
          left: 3px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-ne::after {
          top: 3px;
          right: 3px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-nw::after {
          top: 3px;
          left: 3px;
        }
        
        /* Edge handle indicators */
        .fixed-grid-container .react-grid-item > .react-resizable-handle-n::after,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-s::after {
          width: 40px;
          height: 4px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 2px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-n::after {
          top: 2px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-s::after {
          bottom: 2px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-e::after,
        .fixed-grid-container .react-grid-item > .react-resizable-handle-w::after {
          width: 4px;
          height: 40px;
          top: 50%;
          transform: translateY(-50%);
          border-radius: 2px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-e::after {
          right: 2px;
        }
        
        .fixed-grid-container .react-grid-item > .react-resizable-handle-w::after {
          left: 2px;
        }
        
        /* Show handles on hover */
        .fixed-grid-container .react-grid-item:hover > .react-resizable-handle {
          opacity: 1;
        }
        
        /* Make handles more visible on hover */
        .fixed-grid-container .react-grid-item:hover > .react-resizable-handle::after {
          background: rgba(59, 130, 246, 0.8);
        }
        
        /* Special styling for corner handles on hover */
        .fixed-grid-container .react-grid-item:hover > .react-resizable-handle-se::after,
        .fixed-grid-container .react-grid-item:hover > .react-resizable-handle-sw::after,
        .fixed-grid-container .react-grid-item:hover > .react-resizable-handle-ne::after,
        .fixed-grid-container .react-grid-item:hover > .react-resizable-handle-nw::after {
          width: 10px;
          height: 10px;
          background: #3b82f6;
        }
        
        /* Keep handles visible while resizing */
        .fixed-grid-container .react-grid-item.resizing > .react-resizable-handle {
          opacity: 1;
        }
        
        .fixed-grid-container .react-grid-item.resizing > .react-resizable-handle::after {
          background: #2563eb;
        }
        
        .fixed-grid-container .react-grid-item.react-grid-placeholder {
          background: rgba(59, 130, 246, 0.15);
          border: 2px dashed rgba(59, 130, 246, 0.4);
          border-radius: 8px;
          opacity: 0.6;
          transition-duration: 100ms;
          z-index: 2;
          user-select: none;
        }
      `}</style>
    </div>
  )
}