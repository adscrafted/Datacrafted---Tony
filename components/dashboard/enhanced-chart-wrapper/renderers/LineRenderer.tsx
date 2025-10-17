import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import { ChartRendererProps } from '../types'
import { CustomActiveDot } from '../components/CustomDot'
import { renderCollapsibleLegend } from '../../collapsible-legend'

type LineRendererProps = Pick<ChartRendererProps,
  'chartData' | 'safeDataKey' | 'customization' | 'responsiveFeatures' |
  'smartAxisScaling' | 'enhancedAxisLabels' | 'dualAxisConfig' |
  'colors' | 'truncateLabel' | 'onDataPointClick'>

export const LineRenderer: React.FC<LineRendererProps> = ({
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
  const commonProps = {
    data: chartData,
    margin: {
      top: smartAxisScaling.topMargin,
      right: smartAxisScaling.rightMargin,
      left: smartAxisScaling.leftMargin,
      bottom: smartAxisScaling.bottomMargin
    }
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart {...commonProps}>
        {responsiveFeatures.showGrid && customization?.showGrid !== false && (
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        )}
        {responsiveFeatures.showPrimaryLabels && (
          <XAxis
            dataKey={safeDataKey[0]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
            angle={smartAxisScaling.rotation}
            textAnchor={smartAxisScaling.rotation < 0 ? 'end' : 'middle'}
            height={smartAxisScaling.bottomMargin}
            interval={smartAxisScaling.xAxisInterval}
            tickFormatter={(value) => {
              const str = String(value)
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
              wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '5px' },
              formatter: (value) => {
                const result = truncateLabel(String(value), 100)
                return result.text
              }
            })}
          />
        )}
        {safeDataKey.slice(1).map((key: string, index: number) => {
          // Determine which Y-axis this line should use
          const yAxisId = dualAxisConfig
            ? (dualAxisConfig.leftMetrics.includes(key) ? "left" : "right")
            : undefined

          const lineColor = colors[index % colors.length]

          return (
            <Line
              key={key}
              yAxisId={yAxisId}
              type="monotone"
              dataKey={key}
              stroke={lineColor}
              strokeWidth={responsiveFeatures.showGrid ? 2 : 3}
              dot={({ key, ...props }) => (
                <CustomActiveDot
                  key={key}
                  {...props}
                  fill={lineColor}
                  r={4}
                  onClick={onDataPointClick}
                />
              )}
              activeDot={({ key, ...props }) => (
                <CustomActiveDot
                  key={key}
                  {...props}
                  fill={lineColor}
                  r={6}
                  onClick={onDataPointClick}
                />
              )}
              animationDuration={customization?.animate !== false ? 1500 : 0}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}
