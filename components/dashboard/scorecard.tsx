'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface ScorecardProps {
  title: string
  value: string | number
  unit?: string
  subtitle?: string
  description?: string
  trend?: number
  trendLabel?: string
  icon?: React.ReactNode
  className?: string
  aggregationType?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
}

export function Scorecard({
  title,
  value,
  aggregationType,
  className
}: ScorecardProps) {
  const getBorderColor = () => {
    return 'border-gray-200'
  }

  const getAggregationLabel = () => {
    if (!aggregationType) return null

    const labels: Record<string, string> = {
      sum: 'TOTAL',
      avg: 'AVERAGE',
      count: 'COUNT',
      min: 'MIN',
      max: 'MAX',
      distinct: 'UNIQUE'
    }

    return labels[aggregationType] || aggregationType.toUpperCase()
  }

  const getAggregationColor = () => {
    if (!aggregationType) return 'bg-gray-100 text-gray-700'

    const colors: Record<string, string> = {
      sum: 'bg-blue-100 text-blue-700',
      avg: 'bg-purple-100 text-purple-700',
      count: 'bg-green-100 text-green-700',
      min: 'bg-orange-100 text-orange-700',
      max: 'bg-red-100 text-red-700',
      distinct: 'bg-teal-100 text-teal-700'
    }

    return colors[aggregationType] || 'bg-gray-100 text-gray-700'
  }

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // Count aggregation - always show whole numbers
      if (aggregationType === 'count' || aggregationType === 'distinct') {
        return Math.round(val).toLocaleString()
      }

      // Average aggregation - show more precision
      if (aggregationType === 'avg') {
        if (val >= 1000000) {
          return `${(val / 1000000).toFixed(2)}M`
        } else if (val >= 1000) {
          return `${(val / 1000).toFixed(2)}K`
        } else if (Math.abs(val) < 1) {
          return val.toFixed(3)
        }
        return val.toFixed(2)
      }

      // For sum, min, max - standard formatting
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`
      } else if (val >= 10000) {
        return `${(val / 1000).toFixed(1)}K`
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(2)}K`
      }
      // Format decimals
      if (val % 1 !== 0) {
        // Check if it's a very small decimal
        if (Math.abs(val) < 1) {
          return val.toFixed(3)
        }
        return val.toFixed(1)
      }
      return val.toLocaleString()
    }
    return val
  }

  return (
    <div
      className={cn(
        "h-full w-full flex flex-col justify-center items-center bg-white rounded-lg border-l-4 p-6",
        getBorderColor(),
        className
      )}
    >
      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        {title}
      </h3>

      {/* Value */}
      <div className="text-5xl font-bold text-gray-900 tabular-nums">
        {formatValue(value)}
      </div>

      {/* Aggregation badge */}
      {aggregationType && (
        <div className="mt-4">
          <span className={cn(
            "text-xs font-semibold px-2 py-1 rounded-md",
            getAggregationColor()
          )}>
            {getAggregationLabel()}
          </span>
        </div>
      )}
    </div>
  )
}
