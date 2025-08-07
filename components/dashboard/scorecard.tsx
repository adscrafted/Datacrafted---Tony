'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ScorecardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  trendLabel?: string
  icon?: React.ReactNode
  className?: string
}

export function Scorecard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendLabel, 
  icon,
  className 
}: ScorecardProps) {
  const getTrendIcon = () => {
    if (!trend) return null
    if (trend > 0) return <TrendingUp className="h-4 w-4" />
    if (trend < 0) return <TrendingDown className="h-4 w-4" />
    return <Minus className="h-4 w-4" />
  }

  const getTrendColor = () => {
    if (!trend) return ''
    if (trend > 0) return 'text-green-600'
    if (trend < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // Format large numbers
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
    <div className={cn("p-3 bg-white rounded-lg border h-full flex flex-col relative", className)}>
      <div className="flex flex-col h-full">
        {/* Title - no truncation, allow wrapping */}
        <p className="text-xs font-medium text-gray-600 leading-tight mb-1">{title}</p>
        
        {/* Value - prominent display */}
        <p className="text-xl font-bold mb-2">{formatValue(value)}</p>
        
        {/* Subtitle/Trend section - allow text to wrap */}
        {(subtitle || trend !== undefined) && (
          <div className="mt-auto">
            {trend !== undefined && (
              <div className={cn("flex items-center space-x-1 mb-1", getTrendColor())}>
                {getTrendIcon()}
                <span className="text-xs font-medium">
                  {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                </span>
                {trendLabel && (
                  <span className="text-xs text-gray-500">{trendLabel}</span>
                )}
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 leading-tight">{subtitle}</p>
            )}
          </div>
        )}
        
        {/* Icon - optional, positioned absolutely if needed */}
        {icon && (
          <div className="absolute top-3 right-3 p-1.5 bg-gray-100 rounded">
            <div className="w-3 h-3 text-gray-600">{icon}</div>
          </div>
        )}
      </div>
    </div>
  )
}