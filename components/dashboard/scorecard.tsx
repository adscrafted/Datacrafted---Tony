'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils/cn'
import { SEMANTIC_PALETTES } from '@/lib/utils/semantic-colors'

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

/**
 * Get semantic color based on scorecard title/metric name
 */
function getSemanticBorderColor(title: string): string {
  const lowerTitle = title.toLowerCase()

  // Positive/Revenue metrics - Green
  if (/revenue|income|profit|gain|growth|sales|earnings|return|roi|roas|retention|conversion|success|win/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.positive.primary
  }

  // Negative/Cost metrics - Red
  if (/cost|expense|loss|spend|churn|decline|decrease|refund|discount|debt|liability|bounce|fail|error|cpc|cpa|cpm/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.negative.primary
  }

  // Monetary/Budget - Emerald
  if (/price|amount|budget|fee|salary|money|dollar|euro|pound|value|payment|balance/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.monetary.primary
  }

  // Time/Date - Blue
  if (/date|time|month|year|day|week|quarter|period|duration|start|end/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.temporal.primary
  }

  // Counts/Quantities - Amber
  if (/count|qty|quantity|num|number|units|orders|items|visits|clicks|views|sessions|users|impressions|total|sum/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.quantity.primary
  }

  // Percentages/Rates - Cyan
  if (/percent|pct|rate|ratio|share|portion|ctr|cvr/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.percentage.primary
  }

  // Scores/Ratings - Pink
  if (/score|rating|rank|grade|level|points|quality/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.score.primary
  }

  // Averages - Purple (distinct from totals)
  if (/average|avg|mean|median/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.categorical.primary
  }

  // Min/Max - special treatment
  if (/minimum|min\b|maximum|max\b/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.score.primary
  }

  // Distinct/Unique - Teal
  if (/distinct|unique|different/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.percentage.primary
  }

  // Campaigns/Categories - Purple
  if (/campaign|category|type|status|region|country|city|segment|group/i.test(lowerTitle)) {
    return SEMANTIC_PALETTES.categorical.primary
  }

  // Default - use a nice neutral accent
  return SEMANTIC_PALETTES.quantity.primary
}

export function Scorecard({
  title,
  value,
  aggregationType,
  className
}: ScorecardProps) {
  const borderColor = useMemo(() => getSemanticBorderColor(title), [title])

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

  const isTimestamp = (val: number): boolean => {
    const MIN_TIMESTAMP = 0 // 1970
    const MAX_TIMESTAMP = 4102444800000 // 2100
    return val >= MIN_TIMESTAMP && val <= MAX_TIMESTAMP && val > 1000000000000
  }

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // Check if it's a timestamp (milliseconds since epoch)
      if (isTimestamp(val)) {
        // It's likely a timestamp in milliseconds
        try {
          const date = new Date(val)
          // Check if it's a valid date
          if (!isNaN(date.getTime())) {
            return {
              isDate: true,
              month: date.toLocaleDateString('en-US', { month: 'short' }),
              day: date.toLocaleDateString('en-US', { day: 'numeric' }),
              year: date.toLocaleDateString('en-US', { year: 'numeric' })
            }
          }
        } catch (e) {
          // If date parsing fails, fall through to number formatting
        }
      }

      // Regular number formatting
      // Use absolute value to check magnitude, but preserve sign in output
      const absVal = Math.abs(val)
      const sign = val < 0 ? '-' : ''

      // All values show 1 decimal place
      if (absVal >= 1000000) {
        return { isDate: false, value: `${sign}${(absVal / 1000000).toFixed(1)}M` }
      } else if (absVal >= 1000) {
        return { isDate: false, value: `${sign}${(absVal / 1000).toFixed(1)}K` }
      }
      // Always show 1 decimal place for values under 1000
      return { isDate: false, value: val.toFixed(1) }
    }
    return { isDate: false, value: val }
  }

  const formattedValue = formatValue(value)

  return (
    <div
      className={cn(
        "h-full w-full flex flex-col justify-center items-center bg-white rounded-lg border-l-4 p-6",
        className
      )}
      style={{ borderLeftColor: borderColor }}
    >
      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        {title}
      </h3>

      {/* Value */}
      {typeof formattedValue === 'object' && formattedValue.isDate ? (
        <div className="flex flex-col items-center leading-tight">
          <div className="text-4xl font-bold text-gray-900">{formattedValue.month}</div>
          <div className="text-4xl font-bold text-gray-900">{formattedValue.day},</div>
          <div className="text-4xl font-bold text-gray-900">{formattedValue.year}</div>
        </div>
      ) : (
        <div className="text-5xl font-bold text-gray-900 tabular-nums">
          {typeof formattedValue === 'object' ? formattedValue.value : formattedValue}
        </div>
      )}
    </div>
  )
}
