'use client'

import React, { useRef, useEffect, useState, memo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import type { DataRow } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { logger } from '@/lib/utils/logger'

interface LazyChartWrapperProps {
  id?: string
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard'
  title: string
  description: string
  data: DataRow[]
  dataKey: string[]
  dataMapping?: {
    xAxis?: string
    yAxis?: string
    size?: string
    color?: string
    xAxisLabel?: string
    yAxisLabel?: string
  }
  threshold?: number
  rootMargin?: string
}

/**
 * Lazy-loading chart wrapper that only renders when visible
 * Uses Intersection Observer for viewport detection
 */
export const LazyChartWrapper = memo<LazyChartWrapperProps>(function LazyChartWrapper({
  id,
  type,
  title,
  description,
  data,
  dataKey,
  dataMapping,
  threshold = 0.1,
  rootMargin = '50px'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (!hasBeenVisible) {
            setHasBeenVisible(true)
            logger.debug(`[LazyChart] Chart ${id || title} became visible`)
          }
        } else {
          // Keep chart rendered once it's been visible
          // This prevents re-rendering when scrolling
          if (!hasBeenVisible) {
            setIsVisible(false)
          }
        }
      },
      {
        threshold,
        rootMargin
      }
    )

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [hasBeenVisible, id, title, threshold, rootMargin])

  return (
    <div ref={containerRef} className="h-full w-full">
      {(isVisible || hasBeenVisible) ? (
        <ChartWrapper
          id={id}
          type={type}
          title={title}
          description={description}
          data={data}
          dataKey={dataKey}
          dataMapping={dataMapping}
        />
      ) : (
        <Card className="h-full flex items-center justify-center">
          <CardContent>
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Loading chart...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.id === nextProps.id &&
    prevProps.type === nextProps.type &&
    prevProps.title === nextProps.title &&
    prevProps.description === nextProps.description &&
    prevProps.data === nextProps.data &&
    JSON.stringify(prevProps.dataKey) === JSON.stringify(nextProps.dataKey) &&
    JSON.stringify(prevProps.dataMapping) === JSON.stringify(nextProps.dataMapping)
  )
})