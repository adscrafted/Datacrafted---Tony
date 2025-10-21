import React from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import type { DataRow } from '@/lib/store'
import type { ScatterData } from '../types'
import { CustomScatterShape } from '../components/CustomScatterShape'
import { renderCollapsibleLegend } from '../../collapsible-legend'

interface ScatterRendererProps {
  scatterData: ScatterData
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  responsiveFeatures: any
  smartAxisScaling: any
  enhancedAxisLabels: any
  truncateLabel: (label: string, maxWidth: number) => { text: string; isTruncated: boolean }
  colors: string[]
  onDataPointClick?: (dataPoint: any) => void
}

// MEMOIZATION: Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (prevProps: ScatterRendererProps, nextProps: ScatterRendererProps): boolean => {
  if (prevProps.scatterData !== nextProps.scatterData) return false
  if (prevProps.safeDataKey.length !== nextProps.safeDataKey.length) return false
  if (prevProps.safeDataKey.some((key, i) => key !== nextProps.safeDataKey[i])) return false
  if (prevProps.customization?.animate !== nextProps.customization?.animate) return false
  if (prevProps.customization?.showGrid !== nextProps.customization?.showGrid) return false
  if (JSON.stringify(prevProps.customization?.dataMapping) !== JSON.stringify(nextProps.customization?.dataMapping)) return false
  if (JSON.stringify(prevProps.configDataMapping) !== JSON.stringify(nextProps.configDataMapping)) return false
  return true
}

const ScatterRendererComponent: React.FC<ScatterRendererProps> = ({
  scatterData,
  safeDataKey,
  customization,
  configDataMapping,
  responsiveFeatures,
  smartAxisScaling,
  enhancedAxisLabels,
  truncateLabel,
  colors,
  onDataPointClick
}) => {
  // Extract size and color dimensions from dataMapping
  const effectiveDataMapping = customization?.dataMapping || configDataMapping
  const sizeKey = effectiveDataMapping?.size
  const colorKey = effectiveDataMapping?.color

  // Use pre-computed scatter data from component-level hook
  const numericScatterData = scatterData.numericData
  const scatterGroups = scatterData.groups

  const commonProps = {
    margin: {
      top: smartAxisScaling.topMargin,
      right: smartAxisScaling.rightMargin,
      left: smartAxisScaling.leftMargin,
      bottom: smartAxisScaling.bottomMargin
    }
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart {...commonProps}>
        {responsiveFeatures.showGrid && customization?.showGrid !== false && (
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        )}
        {responsiveFeatures.showPrimaryLabels && (
          <XAxis
            type="number"
            dataKey={safeDataKey[0]}
            name={enhancedAxisLabels.x || safeDataKey[0]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
            domain={[
              (dataMin: number) => Math.floor(dataMin * 0.9),
              (dataMax: number) => Math.ceil(dataMax * 1.1)
            ]}
            tickFormatter={(value) => {
              if (typeof value === 'number') {
                return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
              }
              return String(value).length > 25 ? String(value).substring(0, 22) + '...' : String(value)
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
            type="number"
            dataKey={safeDataKey[1]}
            name={enhancedAxisLabels.y || safeDataKey[1]}
            orientation="left"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
            width={smartAxisScaling.leftMargin}
            domain={[
              (dataMin: number) => Math.floor(dataMin * 0.9),
              (dataMax: number) => Math.ceil(dataMax * 1.1)
            ]}
            tickFormatter={(value) => {
              if (typeof value === 'number') {
                return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
              }
              return String(value)
            }}
            label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.y ? {
              value: enhancedAxisLabels.y,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
            } : undefined}
          />
        )}
        {sizeKey && (
          <ZAxis
            type="number"
            dataKey={sizeKey}
            range={[60, 400]}
            name={sizeKey}
          />
        )}
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px'
          }}
          content={(props) => {
            if (!props.active || !props.payload || props.payload.length === 0) return null

            const payload = props.payload[0].payload

            // Get all keys from the payload, excluding internal Recharts properties
            const allKeys = Object.keys(payload).filter(key =>
              !key.startsWith('_') &&
              key !== 'cx' &&
              key !== 'cy' &&
              key !== 'size' &&
              key !== 'node' &&
              key !== 'tooltipPayload' &&
              key !== 'tooltipPosition'
            )

            // Prioritize displaying the main dimensions first
            const prioritizedKeys = [
              ...(colorKey && allKeys.includes(colorKey) ? [colorKey] : []),
              ...(safeDataKey[0] && allKeys.includes(safeDataKey[0]) ? [safeDataKey[0]] : []),
              ...(safeDataKey[1] && allKeys.includes(safeDataKey[1]) ? [safeDataKey[1]] : []),
              ...(sizeKey && allKeys.includes(sizeKey) ? [sizeKey] : []),
              ...allKeys.filter(k => k !== colorKey && k !== safeDataKey[0] && k !== safeDataKey[1] && k !== sizeKey)
            ]

            return (
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                maxWidth: '300px'
              }}>
                <div style={{ marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  {props.payload[0].name || 'Data Point'}
                </div>
                {prioritizedKeys.map((key, index) => {
                  const value = payload[key]
                  if (value === undefined || value === null) return null

                  // Format the value
                  const displayValue = typeof value === 'number'
                    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : String(value)

                  // Get label for this key
                  let label = key
                  if (key === safeDataKey[0] && enhancedAxisLabels.x) {
                    label = enhancedAxisLabels.x
                  } else if (key === safeDataKey[1] && enhancedAxisLabels.y) {
                    label = enhancedAxisLabels.y
                  }

                  return (
                    <div key={key} style={{ marginBottom: index < prioritizedKeys.length - 1 ? '4px' : '0', color: '#64748b' }}>
                      <span style={{ fontWeight: '500' }}>{label}:</span>{' '}
                      <span style={{ color: '#111827' }}>{displayValue}</span>
                    </div>
                  )
                })}
              </div>
            )
          }}
        />
        {responsiveFeatures.showLegend && colorKey && scatterGroups.length > 1 && (
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
        <Scatter
          name="Data Points"
          data={numericScatterData}
          fillOpacity={0.6}
          animationDuration={customization?.animate !== false ? 1500 : 0}
          shape={(props: any) => {
            // Determine color based on the colorKey value
            let pointColor = colors[0]
            if (colorKey && props.payload) {
              const colorValue = String(props.payload[colorKey] || 'Unknown')
              // Find the group index for this color value
              const groupIndex = scatterGroups.findIndex(g => g.name === colorValue)
              if (groupIndex !== -1) {
                pointColor = scatterGroups[groupIndex].color
              }
            }

            return (
              <CustomScatterShape
                {...props}
                fill={pointColor}
                onClick={onDataPointClick}
              />
            )
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// MEMOIZATION: Export memoized component to prevent unnecessary re-renders
export const ScatterRenderer = React.memo(ScatterRendererComponent, arePropsEqual)
