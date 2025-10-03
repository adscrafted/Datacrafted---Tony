'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChatInterface } from './chat-interface'

interface ResizableChatInterfaceProps {
  minWidth?: number
  maxWidth?: number
  defaultWidth?: number
  onWidthChange?: (width: number) => void
}

export function ResizableChatInterface({
  minWidth = 360,
  maxWidth = 800,
  defaultWidth = 400,
  onWidthChange
}: ResizableChatInterfaceProps) {
  // Load saved width from localStorage or use default
  const [width, setWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat-sidebar-width')
      return saved ? Math.max(minWidth, Math.min(maxWidth, parseInt(saved))) : defaultWidth
    }
    return defaultWidth
  })
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const deltaX = e.clientX - startXRef.current
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX))
      
      setWidth(newWidth)
      onWidthChange?.(newWidth)
    }

    const handleMouseUp = () => {
      if (!isResizing) return
      
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      
      // Save the width to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('chat-sidebar-width', width.toString())
      }
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth, onWidthChange, width])

  return (
    <div 
      ref={containerRef}
      className="relative h-full flex"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-4 cursor-col-resize group ${
          isResizing ? 'bg-blue-500/10' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`absolute right-0 top-0 bottom-0 w-1 transition-all ${
          isResizing ? 'bg-blue-500' : 'bg-gray-200 group-hover:bg-blue-500'
        }`} />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-8 bg-gray-400 rounded-full" />
        </div>
      </div>
      
      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  )
}