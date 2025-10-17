import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import { ChartRendererProps } from '../types'
import { renderCollapsibleLegend } from '../../collapsible-legend'

type BarRendererProps = Pick<ChartRendererProps,
  'chartData' | 'safeDataKey' | 'customization' | 'responsiveFeatures' |
  'smartAxisScaling' | 'enhancedAxisLabels' | 'dualAxisConfig' |
  'colors' | 'truncateLabel' | 'onDataPointClick'>

export const BarRenderer: React.FC<BarRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  responsiveFeatures,
  smartAxisScaling,
  enhancedAxisLabels,
  dualAxisConfig,
  colors,
  truncateLabel,
  onDataPointClick
}) => {
  // Transform bar data to have numeric values for Recharts
  const parseNumericValueBar = (val: any): number => {
    if (typeof val === 'number') return val
    if (typeof val !== 'string') return 0
    const cleaned = val.replace(/[€$£¥,\s%]/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  // Transform data inline without useMemo
  const numericBarData = chartData.map(row => {
    const transformed = { ...row }
    // Transform value columns (everything except first column which is category)
    safeDataKey.slice(1).forEach((key: string) => {
      (transformed as any)[key] = parseNumericValueBar((row as any)[key])
    })
    return transformed
  })

  // Calculate Y-axis domain to ensure bars are visible
  const allYValues = numericBarData.flatMap(row =>
    safeDataKey.slice(1).map((key: string) => (row as any)[key]).filter((v: any) => typeof v === 'number' && !isNaN(v))
  )
  const maxYValue = Math.max(...allYValues, 0)

  const commonProps = {
    data: numericBarData,
    margin: {
      top: smartAxisScaling.topMargin,
      right: smartAxisScaling.rightMargin,
      left: smartAxisScaling.leftMargin,
      bottom: smartAxisScaling.bottomMargin
    }
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart {...commonProps}>
        {responsiveFeatures.showGrid && customization?.showGrid !== false && (
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        )}
        {responsiveFeatures.showPrimaryLabels && (
          <XAxis
            dataKey={safeDataKey[0]}
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
            angle={smartAxisScaling.rotation}
            textAnchor={smartAxisScaling.rotation < 0 ? 'end' : 'middle'}
            height={smartAxisScaling.bottomMargin}
            interval={0}
            tickFormatter={(value) => {
              const str = String(value)
              // More aggressive truncation for rotated labels to prevent overlap
              if (smartAxisScaling.rotation !== 0) {
                return str.length > 20 ? str.substring(0, 17) + '...' : str
              }
              return str.length > 25 ? str.substring(0, 22) + '...' : str
            }}
            label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.x ? {
              value: enhancedAxisLabels.x,
              position: 'insideBottom',
              offset: -10,
              style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
            } : undefined}
          />
        )}
        {responsiveFeatures.showPrimaryLabels && (
          <YAxis
            yAxisId={dualAxisConfig ? "left" : undefined}
            orientation="left"
            domain={[0, maxYValue > 0 ? maxYValue * 1.1 : 100]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
            width={smartAxisScaling.leftMargin}
            tickFormatter={(value) => {
              if (typeof value === 'number') {
                return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
              }
              return String(value)
            }}
            label={responsiveFeatures.showSecondaryLabels && (dualAxisConfig?.leftLabel || enhancedAxisLabels.y) ? {
              value: dualAxisConfig?.leftLabel || enhancedAxisLabels.y,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
            } : undefined}
          />
        )}
        {dualAxisConfig && responsiveFeatures.showPrimaryLabels && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
            width={smartAxisScaling.rightMargin + 20}
            tickFormatter={(value) => {
              if (typeof value === 'number') {
                return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
              }
              return String(value)
            }}
            label={responsiveFeatures.showSecondaryLabels && dualAxisConfig.rightLabel ? {
              value: dualAxisConfig.rightLabel,
              angle: 90,
              position: 'insideRight',
              style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
            } : undefined}
          />
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px'
          }}
          formatter={(value, name) => {
            if (enhancedAxisLabels.xTruncated || enhancedAxisLabels.yTruncated) {
              const originalName = name === enhancedAxisLabels.x ? enhancedAxisLabels.xOriginal :
                                 name === enhancedAxisLabels.y ? enhancedAxisLabels.yOriginal : name
              return [value, originalName]
            }
            return [value, name]
          }}
        />
        {responsiveFeatures.showLegend && safeDataKey.length > 1 && (
          <Legend
            content={renderCollapsibleLegend({
              maxVisibleItems: 5,
              wrapperStyle: { fontSize: '11px', paddingTop: '12px', paddingBottom: '5px' },
              formatter: (value) => {
                const result = truncateLabel(String(value), 100)
                return result.text
              }
            })}
            verticalAlign="bottom"
            height={36}
          />
        )}
        {safeDataKey.slice(1).map((key: string, index: number) => {
          // Determine which Y-axis this bar should use
          const yAxisId = dualAxisConfig
            ? (dualAxisConfig.leftMetrics.includes(key) ? "left" : "right")
            : undefined

          // Enable stacked bars when customization.stacked is true
          const stackId = customization?.stacked ? "stack1" : undefined

          return (
            <Bar
              key={`${key}-${index}`}
              yAxisId={yAxisId}
              stackId={stackId}
              dataKey={key}
              fill={colors[index % colors.length]}
              radius={responsiveFeatures.showGrid ? [2, 2, 0, 0] : [1, 1, 0, 0]}
              animationDuration={customization?.animate !== false ? 1500 : 0}
              onClick={(data) => onDataPointClick?.(data.payload)}
            />
          )
        })}
      </BarChart>
    </ResponsiveContainer>
  )
}
