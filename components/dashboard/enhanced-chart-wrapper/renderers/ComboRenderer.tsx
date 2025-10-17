import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import { DataRow } from '@/lib/store'
import { CustomActiveDot } from '../components/CustomDot'
import { renderCollapsibleLegend } from '../../collapsible-legend'
import { COMBO_COLORS } from '../constants'

interface ComboRendererProps {
  comboData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  responsiveFeatures: any
  smartAxisScaling: any
  enhancedAxisLabels: any
  truncateLabel: (label: string, maxWidth: number) => { text: string; isTruncated: boolean }
  onDataPointClick?: (dataPoint: any) => void
}

export const ComboRenderer: React.FC<ComboRendererProps> = ({
  comboData,
  safeDataKey,
  customization,
  configDataMapping,
  responsiveFeatures,
  smartAxisScaling,
  enhancedAxisLabels,
  truncateLabel,
  onDataPointClick
}) => {
  // Extract dataMapping configuration with fallback to configDataMapping
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  // Extract yAxis configurations from effective data mapping
  // Left Y-axis (yAxis or yAxis1)
  const yAxis1Metrics = effectiveDataMapping?.yAxis
    ? (Array.isArray(effectiveDataMapping.yAxis) ? effectiveDataMapping.yAxis : [effectiveDataMapping.yAxis])
    : (effectiveDataMapping?.yAxis1
      ? (Array.isArray(effectiveDataMapping.yAxis1) ? effectiveDataMapping.yAxis1 : [effectiveDataMapping.yAxis1])
      : safeDataKey.slice(1, 2))

  // Right Y-axis (yAxis2)
  const yAxis2Metrics = effectiveDataMapping?.yAxis2
    ? (Array.isArray(effectiveDataMapping.yAxis2) ? effectiveDataMapping.yAxis2 : [effectiveDataMapping.yAxis2])
    : safeDataKey.length > 2 ? safeDataKey.slice(2, 3) : []

  // Chart types for each axis (bar, line, or area)
  const yAxis1Type = effectiveDataMapping?.yAxis1Type || 'bar'
  const yAxis2Type = effectiveDataMapping?.yAxis2Type || 'line'

  // Axis labels with intelligent defaults
  const yAxis1Label = effectiveDataMapping?.yAxis1Label || yAxis1Metrics.join(', ')
  const yAxis2Label = effectiveDataMapping?.yAxis2Label || (yAxis2Metrics.length > 0 ? yAxis2Metrics.join(', ') : '')

  // Use pre-computed combo data from component-level hook
  const numericComboData = comboData

  // Determine color palette with distinct, visually appealing colors
  const getMetricColor = (metricIndex: number, isRightAxis: boolean): string => {
    if (isRightAxis) {
      return COMBO_COLORS.right[metricIndex % COMBO_COLORS.right.length]
    } else {
      return COMBO_COLORS.left[metricIndex % COMBO_COLORS.left.length]
    }
  }

  // Calculate adjusted right margin for dual-axis layout
  const adjustedRightMargin = yAxis2Metrics.length > 0
    ? Math.max(smartAxisScaling.rightMargin + 30, 60)
    : smartAxisScaling.rightMargin

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={numericComboData}
        margin={{
          top: smartAxisScaling.topMargin,
          right: adjustedRightMargin,
          left: smartAxisScaling.leftMargin,
          bottom: smartAxisScaling.bottomMargin
        }}
      >
        {/* Grid */}
        {responsiveFeatures.showGrid && customization?.showGrid !== false && (
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        )}

        {/* X-Axis */}
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

        {/* Left Y-Axis */}
        {responsiveFeatures.showPrimaryLabels && (
          <YAxis
            yAxisId="left"
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
            label={responsiveFeatures.showSecondaryLabels && yAxis1Label ? {
              value: yAxis1Label,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#2563eb' }
            } : undefined}
          />
        )}

        {/* Right Y-Axis - only render if we have right axis metrics */}
        {yAxis2Metrics.length > 0 && responsiveFeatures.showPrimaryLabels && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
            width={adjustedRightMargin}
            tickFormatter={(value) => {
              if (typeof value === 'number') {
                return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
              }
              return String(value)
            }}
            label={responsiveFeatures.showSecondaryLabels && yAxis2Label ? {
              value: yAxis2Label,
              angle: 90,
              position: 'insideRight',
              style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#10b981' }
            } : undefined}
          />
        )}

        {/* Enhanced Tooltip - shows all metrics with proper formatting */}
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          content={(props) => {
            if (!props.active || !props.payload || props.payload.length === 0) return null

            const dataPoint = props.payload[0].payload

            return (
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                {/* Category label */}
                <div style={{ marginBottom: '8px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px' }}>
                  {String(dataPoint[safeDataKey[0]] || '')}
                </div>

                {/* Left axis metrics */}
                {yAxis1Metrics.length > 0 && (
                  <div style={{ marginBottom: yAxis2Metrics.length > 0 ? '8px' : '0' }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#2563eb', marginBottom: '4px', textTransform: 'uppercase' }}>
                      {yAxis1Label} (Left)
                    </div>
                    {yAxis1Metrics.map((metric: string, idx: number) => (
                      <div key={metric} style={{ marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '2px',
                          backgroundColor: getMetricColor(idx, false)
                        }} />
                        <span style={{ fontWeight: '500', color: '#64748b', flex: 1 }}>{metric}:</span>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {dataPoint[metric] !== undefined ? Number(dataPoint[metric]).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Right axis metrics */}
                {yAxis2Metrics.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#10b981', marginBottom: '4px', textTransform: 'uppercase' }}>
                      {yAxis2Label} (Right)
                    </div>
                    {yAxis2Metrics.map((metric: string, idx: number) => (
                      <div key={metric} style={{ marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getMetricColor(idx, true)
                        }} />
                        <span style={{ fontWeight: '500', color: '#64748b', flex: 1 }}>{metric}:</span>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {dataPoint[metric] !== undefined ? Number(dataPoint[metric]).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          }}
        />

        {/* Legend with axis indicators */}
        {responsiveFeatures.showLegend && (yAxis1Metrics.length > 0 || yAxis2Metrics.length > 0) && (
          <Legend
            content={renderCollapsibleLegend({
              maxVisibleItems: 5,
              wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '5px' },
              iconType: (value: any) => {
                // Find which axis this metric belongs to
                const isRightAxis = yAxis2Metrics.includes(value)
                const chartType = isRightAxis ? yAxis2Type : yAxis1Type
                const metricIdx = isRightAxis
                  ? yAxis2Metrics.indexOf(value)
                  : yAxis1Metrics.indexOf(value)
                const color = getMetricColor(metricIdx, isRightAxis)

                // Return a React element with the appropriate icon and color
                if (chartType === 'line') {
                  return (
                    <svg width={14} height={14} viewBox="0 0 14 14" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                      <line x1="0" y1="7" x2="14" y2="7" stroke={color} strokeWidth="2" />
                    </svg>
                  )
                } else {
                  // rect for bars/areas
                  return (
                    <svg width={14} height={14} viewBox="0 0 14 14" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                      <rect x="0" y="0" width="14" height="14" fill={color} />
                    </svg>
                  )
                }
              },
              formatter: (value, entry: any) => {
                // Determine if this metric is on left or right axis
                const isRightAxis = yAxis2Metrics.includes(value)
                const axisLabel = isRightAxis ? ' (Right)' : ' (Left)'

                // Truncate if needed
                const result = truncateLabel(String(value) + axisLabel, 100)
                return result.text
              }
            })}
          />
        )}

        {/* Render Left Y-Axis (yAxis1) metrics */}
        {yAxis1Metrics.map((metric: string, idx: number) => {
          const color = getMetricColor(idx, false)
          const stackId = customization?.stacked ? "stack1" : undefined

          // Render based on chart type
          if (yAxis1Type === 'bar') {
            return (
              <Bar
                key={metric}
                yAxisId="left"
                stackId={stackId}
                dataKey={metric}
                fill={color}
                fillOpacity={0.6}
                radius={[4, 4, 0, 0]}
                animationDuration={customization?.animate !== false ? 1500 : 0}
                onClick={(data) => onDataPointClick?.(data.payload)}
              />
            )
          } else if (yAxis1Type === 'area') {
            return (
              <Area
                key={metric}
                yAxisId="left"
                stackId={stackId}
                type="monotone"
                dataKey={metric}
                stroke={color}
                fill={color}
                fillOpacity={responsiveFeatures.showGrid ? 0.3 : 0.5}
                strokeWidth={responsiveFeatures.showGrid ? 2 : 3}
                dot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={3}
                    onClick={onDataPointClick}
                  />
                )}
                activeDot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={5}
                    onClick={onDataPointClick}
                  />
                )}
                animationDuration={customization?.animate !== false ? 1500 : 0}
              />
            )
          } else {
            // Default to line
            return (
              <Line
                key={metric}
                yAxisId="left"
                type="monotoneX"
                dataKey={metric}
                stroke={color}
                strokeWidth={2.5}
                dot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={4}
                    onClick={onDataPointClick}
                  />
                )}
                activeDot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={6}
                    onClick={onDataPointClick}
                  />
                )}
                animationDuration={customization?.animate !== false ? 1500 : 0}
              />
            )
          }
        })}

        {/* Render Right Y-Axis (yAxis2) metrics - only if they exist */}
        {yAxis2Metrics.length > 0 && yAxis2Metrics.map((metric: string, idx: number) => {
          const color = getMetricColor(idx, true)
          const stackId = customization?.stacked ? "stack2" : undefined

          // Render based on chart type
          if (yAxis2Type === 'bar') {
            return (
              <Bar
                key={metric}
                yAxisId="right"
                stackId={stackId}
                dataKey={metric}
                fill={color}
                fillOpacity={0.6}
                radius={[4, 4, 0, 0]}
                animationDuration={customization?.animate !== false ? 1500 : 0}
                onClick={(data) => onDataPointClick?.(data.payload)}
              />
            )
          } else if (yAxis2Type === 'area') {
            return (
              <Area
                key={metric}
                yAxisId="right"
                stackId={stackId}
                type="monotone"
                dataKey={metric}
                stroke={color}
                fill={color}
                fillOpacity={responsiveFeatures.showGrid ? 0.3 : 0.5}
                strokeWidth={responsiveFeatures.showGrid ? 2 : 3}
                dot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={3}
                    onClick={onDataPointClick}
                  />
                )}
                activeDot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={5}
                    onClick={onDataPointClick}
                  />
                )}
                animationDuration={customization?.animate !== false ? 1500 : 0}
              />
            )
          } else {
            // Default to line
            return (
              <Line
                key={metric}
                yAxisId="right"
                type="monotoneX"
                dataKey={metric}
                stroke={color}
                strokeWidth={2.5}
                dot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={4}
                    onClick={onDataPointClick}
                  />
                )}
                activeDot={({ key, ...props }) => (
                  <CustomActiveDot
                    key={key}
                    {...props}
                    fill={color}
                    r={6}
                    onClick={onDataPointClick}
                  />
                )}
                animationDuration={customization?.animate !== false ? 1500 : 0}
              />
            )
          }
        })}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
