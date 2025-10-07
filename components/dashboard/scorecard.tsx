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
  aggregationType?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile'
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
      distinct: 'UNIQUE',
      median: 'MEDIAN',
      mode: 'MODE',
      std: 'STD DEV',
      variance: 'VARIANCE',
      percentile: 'PERCENTILE'
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
      distinct: 'bg-teal-100 text-teal-700',
      median: 'bg-indigo-100 text-indigo-700',
      mode: 'bg-pink-100 text-pink-700',
      std: 'bg-cyan-100 text-cyan-700',
      variance: 'bg-amber-100 text-amber-700',
      percentile: 'bg-lime-100 text-lime-700'
    }

    return colors[aggregationType] || 'bg-gray-100 text-gray-700'
  }

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // All values show 1 decimal place
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`
      }
      // Always show 1 decimal place for values under 1000
      return val.toFixed(1)
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
    </div>
  )
}
