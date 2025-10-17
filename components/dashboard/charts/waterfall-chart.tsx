'use client'

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Type definitions
interface WaterfallChartProps {
  data: any[]
  dataMapping: {
    category: string
    value: string
    type?: string // 'increase' | 'decrease' | 'total'
  }
  title?: string
  description?: string
  customization?: {
    increaseColor?: string
    decreaseColor?: string
    totalColor?: string
    neutralColor?: string
    showConnectors?: boolean
    showLabels?: boolean
    showLegend?: boolean
    showGrid?: boolean
  }
}

interface WaterfallDataPoint {
  category: string
  value: number
  start: number
  end: number
  type: 'increase' | 'decrease' | 'total' | 'neutral'
  displayValue: number
  cumulative: number
}

// Default colors
const DEFAULT_COLORS = {
  increase: '#22c55e', // green-500
  decrease: '#ef4444', // red-500
  total: '#3b82f6', // blue-500
  neutral: '#94a3b8' // slate-400
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload as WaterfallDataPoint

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-600">Change:</span>
          <span className={`font-semibold ${
            data.type === 'increase' ? 'text-green-600' :
            data.type === 'decrease' ? 'text-red-600' :
            'text-blue-600'
          }`}>
            {data.type === 'increase' && '+'}
            {data.displayValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-600">Cumulative:</span>
          <span className="font-semibold text-gray-900">
            {data.cumulative.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1 mt-1 border-t border-gray-100">
          {data.type === 'increase' && (
            <>
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-600">Increase</span>
            </>
          )}
          {data.type === 'decrease' && (
            <>
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-600">Decrease</span>
            </>
          )}
          {data.type === 'total' && (
            <>
              <Minus className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-600">Total</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Custom legend component
const CustomLegend = () => {
  return (
    <div className="flex items-center justify-center gap-6 py-2 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: DEFAULT_COLORS.increase }} />
        <span className="text-gray-700">Increase</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: DEFAULT_COLORS.decrease }} />
        <span className="text-gray-700">Decrease</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: DEFAULT_COLORS.total }} />
        <span className="text-gray-700">Total</span>
      </div>
    </div>
  )
}

/**
 * WaterfallChart Component
 *
 * A production-ready waterfall chart for financial variance/bridge analysis.
 * Shows increases (green), decreases (red), and totals (blue) with connecting flows.
 */
export default function WaterfallChart({
  data,
  dataMapping,
  title,
  description,
  customization = {}
}: WaterfallChartProps) {
  // Merge default colors with custom colors
  const colors = {
    increase: customization.increaseColor || DEFAULT_COLORS.increase,
    decrease: customization.decreaseColor || DEFAULT_COLORS.decrease,
    total: customization.totalColor || DEFAULT_COLORS.total,
    neutral: customization.neutralColor || DEFAULT_COLORS.neutral
  }

  const {
    showConnectors = true,
    showLabels = true,
    showLegend = true,
    showGrid = true
  } = customization

  // Transform data to waterfall format
  const waterfallData = useMemo<WaterfallDataPoint[]>(() => {
    if (!data || data.length === 0) return []

    const { category, value: valueKey, type: typeKey } = dataMapping
    let cumulative = 0
    const result: WaterfallDataPoint[] = []

    data.forEach((row, index) => {
      const categoryValue = String(row[category] || `Item ${index + 1}`)
      let rawValue = row[valueKey]

      // Parse value if it's a string (handle currency symbols, etc.)
      if (typeof rawValue === 'string') {
        rawValue = parseFloat(rawValue.replace(/[^0-9.-]/g, ''))
      }

      const numericValue = typeof rawValue === 'number' ? rawValue : 0

      // Determine type: use explicit type column if available, otherwise infer from value
      let itemType: 'increase' | 'decrease' | 'total' | 'neutral' = 'neutral'

      if (typeKey && row[typeKey]) {
        const typeValue = String(row[typeKey]).toLowerCase()
        if (typeValue.includes('total') || typeValue.includes('sum')) {
          itemType = 'total'
        } else if (typeValue.includes('increase') || typeValue.includes('positive') || typeValue.includes('gain')) {
          itemType = 'increase'
        } else if (typeValue.includes('decrease') || typeValue.includes('negative') || typeValue.includes('loss')) {
          itemType = 'decrease'
        }
      } else {
        // Infer type from value
        // Keywords in category that suggest a total
        const categoryLower = categoryValue.toLowerCase()
        const isTotalKeyword = categoryLower.includes('total') ||
                               categoryLower.includes('sum') ||
                               categoryLower.includes('final') ||
                               categoryLower.includes('ending') ||
                               categoryLower.includes('net')

        if (isTotalKeyword || index === data.length - 1) {
          itemType = 'total'
        } else if (numericValue > 0) {
          itemType = 'increase'
        } else if (numericValue < 0) {
          itemType = 'decrease'
        }
      }

      // Calculate start and end positions for the bar
      let start: number
      let end: number

      if (itemType === 'total') {
        // For totals, calculate the cumulative sum up to this point
        // This ensures the total bar shows the actual cumulative value
        const cumulativeBeforeTotal = cumulative
        cumulative = numericValue // Reset cumulative to the total value
        start = 0
        end = cumulative
      } else {
        start = cumulative
        cumulative += numericValue
        end = cumulative
      }

      result.push({
        category: categoryValue,
        value: Math.abs(end - start), // Bar height (always positive for rendering)
        start,
        end,
        type: itemType,
        displayValue: numericValue,
        cumulative
      })
    })

    return result
  }, [data, dataMapping])

  // Calculate margins based on label lengths
  const margins = useMemo(() => {
    if (!waterfallData || waterfallData.length === 0) {
      return { top: 20, right: 30, left: 80, bottom: 100 }
    }

    const maxLength = Math.max(
      ...waterfallData.map(d => d.category.length),
      0
    )

    let bottomMargin = 80
    if (maxLength > 10) bottomMargin = 120
    if (maxLength > 20) bottomMargin = 150
    if (maxLength > 30) bottomMargin = 180

    // Calculate left margin based on value size
    const maxValue = Math.max(
      ...waterfallData.map(d => Math.abs(d.cumulative)),
      0
    )
    const leftMargin = maxValue > 1000000 ? 100 : 80

    return { top: 20, right: 30, left: leftMargin, bottom: bottomMargin }
  }, [waterfallData])

  // Format Y-axis values
  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toFixed(0)
  }

  // Handle empty data
  if (!waterfallData || waterfallData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-gray-500 bg-gray-50 rounded border-2 border-dashed border-gray-200">
        <div className="text-center">
          <p className="text-sm font-medium">No data available</p>
          <p className="text-xs mt-1">Please provide data with category and value columns</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      {/* Header */}
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height="100%" minHeight={400}>
        <BarChart
          data={waterfallData}
          margin={margins}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}

          <XAxis
            dataKey="category"
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={margins.bottom}
            tickFormatter={(value) => {
              const str = String(value)
              return str.length > 25 ? str.substring(0, 22) + '...' : str
            }}
          />

          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={formatYAxis}
            domain={['auto', 'auto']}
          />

          <Tooltip content={<CustomTooltip />} />

          {showLegend && <Legend content={<CustomLegend />} />}

          {/* Reference line at zero */}
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />

          {/* Invisible bar for positioning (start position) */}
          <Bar
            dataKey="start"
            stackId="waterfall"
            fill="transparent"
            isAnimationActive={false}
          />

          {/* Visible bar showing the change */}
          <Bar
            dataKey="value"
            stackId="waterfall"
            radius={[4, 4, 0, 0]}
            label={showLabels ? {
              position: 'top',
              fontSize: 11,
              fill: '#374151'
            } : undefined}
          >
            {waterfallData.map((entry, index) => {
              const color = colors[entry.type]
              return <Cell key={`cell-${index}`} fill={color} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Data quality indicator */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        Showing {waterfallData.length} {waterfallData.length === 1 ? 'item' : 'items'}
      </div>
    </div>
  )
}

// Export type definitions for use in other components
export type { WaterfallChartProps, WaterfallDataPoint }
