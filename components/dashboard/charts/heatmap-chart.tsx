'use client'

import React, { useMemo, Component, ReactNode } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Rectangle
} from 'recharts'

interface HeatmapChartProps {
  data: any[]
  dataMapping: {
    xAxis: string
    yAxis: string
    value: string  // intensity
  }
  customization?: {
    colorScale?: 'blue' | 'green' | 'red' | 'viridis'
    showValues?: boolean
  }
}

// Color scale definitions
const COLOR_SCALES = {
  blue: ['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
  green: ['#f0fdf4', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'],
  red: ['#fef2f2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c'],
  viridis: ['#440154', '#31688e', '#35b779', '#fde724']
}

// Error Boundary Component
class HeatmapErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Heatmap rendering error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground bg-gray-50 rounded border-2 border-dashed border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium">Heatmap rendering failed</p>
            <p className="text-xs mt-1">Please check your data mapping</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Custom Cell Component for Heatmap
const HeatmapCell = (props: any) => {
  const { x, y, width, height, payload, fill, showValue } = props

  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#fff"
        strokeWidth={1}
      />
      {showValue && payload?.displayValue && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#000"
          fontSize={10}
          fontWeight="500"
        >
          {payload.displayValue}
        </text>
      )}
    </g>
  )
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-gray-900 mb-1">{data.xLabel}</p>
        <p className="text-gray-700 mb-1">{data.yLabel}</p>
        <p className="text-gray-900 font-semibold">
          Value: {typeof data.originalValue === 'number'
            ? data.originalValue.toLocaleString()
            : data.originalValue}
        </p>
      </div>
    )
  }
  return null
}

export const HeatmapChart = React.memo<HeatmapChartProps>(function HeatmapChart({
  data,
  dataMapping,
  customization = {}
}) {
  const { colorScale = 'blue', showValues = false } = customization

  // Transform data for heatmap visualization
  const { chartData, xCategories, yCategories, minValue, maxValue } = useMemo(() => {
    if (!data || data.length === 0 || !dataMapping) {
      return { chartData: [], xCategories: [], yCategories: [], minValue: 0, maxValue: 0 }
    }

    const { xAxis, yAxis, value } = dataMapping

    // Extract unique x and y categories
    const xSet = new Set<string>()
    const ySet = new Set<string>()
    const values: number[] = []

    data.forEach(row => {
      const xVal = String(row[xAxis] || '')
      const yVal = String(row[yAxis] || '')
      const valueVal = Number(row[value])

      if (xVal && yVal && !isNaN(valueVal)) {
        xSet.add(xVal)
        ySet.add(yVal)
        values.push(valueVal)
      }
    })

    const xCategories = Array.from(xSet)
    const yCategories = Array.from(ySet)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)

    // Create chart data with positions
    const chartData = data
      .map(row => {
        const xVal = String(row[xAxis] || '')
        const yVal = String(row[yAxis] || '')
        const valueVal = Number(row[value])

        if (!xVal || !yVal || isNaN(valueVal)) {
          return null
        }

        const xIndex = xCategories.indexOf(xVal)
        const yIndex = yCategories.indexOf(yVal)

        // Normalize value to 0-1 range for color mapping
        const normalizedValue = maxValue === minValue
          ? 0.5
          : (valueVal - minValue) / (maxValue - minValue)

        return {
          x: xIndex,
          y: yIndex,
          z: valueVal,
          xLabel: xVal,
          yLabel: yVal,
          normalizedValue,
          originalValue: valueVal,
          displayValue: showValues ? (
            typeof valueVal === 'number' && valueVal >= 1000
              ? (valueVal / 1000).toFixed(1) + 'k'
              : valueVal.toFixed(0)
          ) : null
        }
      })
      .filter(Boolean) as any[]

    return { chartData, xCategories, yCategories, minValue, maxValue }
  }, [data, dataMapping, showValues])

  // Get color based on normalized value
  const getColor = (normalizedValue: number): string => {
    const colors = COLOR_SCALES[colorScale]
    const index = Math.min(
      Math.floor(normalizedValue * colors.length),
      colors.length - 1
    )
    return colors[index]
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available for heatmap
      </div>
    )
  }

  // Calculate cell size based on number of categories
  const cellWidth = Math.max(30, Math.min(100, 600 / xCategories.length))
  const cellHeight = Math.max(30, Math.min(60, 400 / yCategories.length))

  return (
    <HeatmapErrorBoundary>
      <ResponsiveContainer width="100%" height="100%" minHeight={400}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 60, left: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            dataKey="x"
            name={dataMapping.xAxis}
            domain={[-0.5, xCategories.length - 0.5]}
            tickCount={xCategories.length}
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
            tickFormatter={(value) => {
              const index = Math.round(value)
              return xCategories[index] || ''
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={dataMapping.yAxis}
            domain={[-0.5, yCategories.length - 0.5]}
            tickCount={yCategories.length}
            tick={{ fontSize: 11 }}
            width={80}
            tickFormatter={(value) => {
              const index = Math.round(value)
              const label = yCategories[index] || ''
              return label.length > 15 ? label.substring(0, 12) + '...' : label
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Scatter
            data={chartData}
            shape={(props: any) => (
              <HeatmapCell
                {...props}
                width={cellWidth}
                height={cellHeight}
                fill={getColor(props.payload.normalizedValue)}
                showValue={showValues}
              />
            )}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry.normalizedValue)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Color Legend */}
      <div className="flex items-center justify-center mt-4 gap-2">
        <span className="text-xs text-gray-600">{minValue.toLocaleString()}</span>
        <div className="flex gap-1">
          {COLOR_SCALES[colorScale].map((color, index) => (
            <div
              key={index}
              className="w-8 h-4 border border-gray-200"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="text-xs text-gray-600">{maxValue.toLocaleString()}</span>
      </div>
    </HeatmapErrorBoundary>
  )
})

HeatmapChart.displayName = 'HeatmapChart'

export default HeatmapChart
