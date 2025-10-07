'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import { AggregationType } from '@/lib/utils/data-calculations'

interface ScorecardCalculationDetailsProps {
  aggregationType?: AggregationType
  metric: string
  values: number[]
  result: number
  className?: string
}

export function ScorecardCalculationDetails({
  aggregationType = 'sum',
  metric,
  values,
  result,
  className
}: ScorecardCalculationDetailsProps) {

  // Get human-readable aggregation label
  const getAggregationLabel = () => {
    const labels: Record<string, string> = {
      sum: 'SUM',
      avg: 'AVERAGE',
      count: 'COUNT',
      min: 'MINIMUM',
      max: 'MAXIMUM',
      distinct: 'UNIQUE COUNT',
      median: 'MEDIAN',
      mode: 'MODE',
      std: 'STANDARD DEVIATION',
      variance: 'VARIANCE',
      percentile: 'PERCENTILE'
    }
    return labels[aggregationType] || aggregationType.toUpperCase()
  }

  // Get formula representation
  const getFormulaRepresentation = () => {
    const formulas: Record<string, string> = {
      sum: `SUM(${metric})`,
      avg: `AVG(${metric})`,
      count: `COUNT(${metric})`,
      min: `MIN(${metric})`,
      max: `MAX(${metric})`,
      distinct: `COUNT(DISTINCT ${metric})`,
      median: `MEDIAN(${metric})`,
      mode: `MODE(${metric})`,
      std: `STDEV(${metric})`,
      variance: `VAR(${metric})`,
      percentile: `PERCENTILE(${metric})`
    }
    return formulas[aggregationType] || `${aggregationType.toUpperCase()}(${metric})`
  }

  // Calculate detailed statistics
  const getCalculationDetails = () => {
    const count = values.length
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = count > 0 ? sum / count : 0
    const min = count > 0 ? Math.min(...values) : 0
    const max = count > 0 ? Math.max(...values) : 0

    const details: Record<string, { primary: string; secondary?: string[] }> = {
      sum: {
        primary: `Sum of ${count.toLocaleString()} values = ${result.toLocaleString()}`,
        secondary: [
          `Data points: ${count.toLocaleString()}`,
          `Range: ${min.toLocaleString()} to ${max.toLocaleString()}`
        ]
      },
      avg: {
        primary: `Sum: ${sum.toLocaleString()} ÷ Count: ${count.toLocaleString()} = ${result.toFixed(2)}`,
        secondary: [
          `Total: ${sum.toLocaleString()}`,
          `Data points: ${count.toLocaleString()}`,
          `Average: ${result.toFixed(2)}`
        ]
      },
      count: {
        primary: `Total data points = ${result.toLocaleString()}`,
        secondary: [
          `Non-null values counted: ${count.toLocaleString()}`
        ]
      },
      min: {
        primary: `Minimum value = ${result.toLocaleString()}`,
        secondary: [
          `Found from ${count.toLocaleString()} values`,
          `Maximum: ${max.toLocaleString()}`
        ]
      },
      max: {
        primary: `Maximum value = ${result.toLocaleString()}`,
        secondary: [
          `Found from ${count.toLocaleString()} values`,
          `Minimum: ${min.toLocaleString()}`
        ]
      },
      distinct: {
        primary: `Unique values = ${result.toLocaleString()}`,
        secondary: [
          `Total values: ${count.toLocaleString()}`,
          `Unique: ${result.toLocaleString()}`
        ]
      },
      median: {
        primary: `Median value = ${result.toLocaleString()}`,
        secondary: [
          `Data points: ${count.toLocaleString()}`,
          `Average: ${avg.toFixed(2)}`
        ]
      },
      mode: {
        primary: `Most frequent value = ${result.toLocaleString()}`,
        secondary: [
          `Data points: ${count.toLocaleString()}`
        ]
      },
      std: {
        primary: `Standard deviation = ${result.toFixed(4)}`,
        secondary: [
          `Data points: ${count.toLocaleString()}`,
          `Mean: ${avg.toFixed(2)}`
        ]
      },
      variance: {
        primary: `Variance = ${result.toFixed(4)}`,
        secondary: [
          `Data points: ${count.toLocaleString()}`,
          `Mean: ${avg.toFixed(2)}`
        ]
      },
      percentile: {
        primary: `Percentile value = ${result.toLocaleString()}`,
        secondary: [
          `Data points: ${count.toLocaleString()}`
        ]
      }
    }

    return details[aggregationType] || {
      primary: `Result = ${result.toLocaleString()}`,
      secondary: [`Data points: ${count.toLocaleString()}`]
    }
  }

  const details = getCalculationDetails()

  // Color scheme based on aggregation type
  const getColorScheme = () => {
    const colors: Record<string, { bg: string; border: string; badge: string }> = {
      sum: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
      avg: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
      count: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
      min: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
      max: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
      distinct: { bg: 'bg-teal-50', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700' },
      median: { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
      mode: { bg: 'bg-pink-50', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-700' },
      std: { bg: 'bg-cyan-50', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700' },
      variance: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
      percentile: { bg: 'bg-lime-50', border: 'border-lime-200', badge: 'bg-lime-100 text-lime-700' }
    }
    return colors[aggregationType] || { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' }
  }

  const colorScheme = getColorScheme()

  return (
    <div className={cn(
      'rounded-lg border-2 p-4',
      colorScheme.bg,
      colorScheme.border,
      className
    )}>
      {/* Compact single-row layout */}
      <div className="flex items-center justify-between gap-4">
        {/* Left section - Formula and calculation */}
        <div className="flex-1 flex items-center gap-4">
          <span className={cn(
            'text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap',
            colorScheme.badge
          )}>
            {getAggregationLabel()}
          </span>

          <div className="flex items-center gap-3">
            <code className="text-sm font-mono text-gray-900 font-semibold whitespace-nowrap">
              {getFormulaRepresentation()}
            </code>
            <span className="text-gray-400">→</span>
            <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
              {details.primary}
            </div>
          </div>
        </div>

        {/* Right section - Sample values */}
        {values.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Sample:</span>
            <div className="flex gap-1.5">
              {values.slice(0, 3).map((value, index) => (
                <span
                  key={index}
                  className="text-xs font-mono bg-white px-2 py-1 rounded border border-gray-200 text-gray-700"
                >
                  {value.toLocaleString()}
                </span>
              ))}
              {values.length > 3 && (
                <span className="text-xs text-gray-500 px-1 py-1">
                  +{(values.length - 3).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
