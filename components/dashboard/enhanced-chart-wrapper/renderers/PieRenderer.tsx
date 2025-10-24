import React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import type { DataRow } from '@/lib/stores/data-store'
import type { ChartRendererProps } from '../types'
import { renderCollapsibleLegend } from '../../collapsible-legend'

interface PieRendererProps extends Pick<ChartRendererProps, 'chartData' | 'safeDataKey' | 'customization' | 'responsiveFeatures' | 'truncateLabel' | 'colors' | 'onDataPointClick'> {}

// MEMOIZATION: Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (prevProps: PieRendererProps, nextProps: PieRendererProps): boolean => {
  if (prevProps.chartData !== nextProps.chartData) return false
  if (prevProps.safeDataKey.length !== nextProps.safeDataKey.length) return false
  if (prevProps.safeDataKey.some((key, i) => key !== nextProps.safeDataKey[i])) return false
  if (prevProps.customization?.animate !== nextProps.customization?.animate) return false
  if (prevProps.customization?.showLegend !== nextProps.customization?.showLegend) return false
  if (JSON.stringify(prevProps.customization?.dataMapping) !== JSON.stringify(nextProps.customization?.dataMapping)) return false
  return true
}

const PieRendererComponent: React.FC<PieRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  responsiveFeatures,
  truncateLabel,
  colors,
  onDataPointClick
}) => {
  // Process pie chart data
  const pieData = React.useMemo(() => {
    if (safeDataKey.length === 0 || chartData.length === 0) {
      return []
    }

    const categoryKey = customization?.dataMapping?.category || safeDataKey[0]
    const valueKey = customization?.dataMapping?.value || safeDataKey[1] || 'count'

    const counts: Record<string, number> = {}
    chartData.forEach(row => {
      if (!row || typeof row !== 'object') return

      const category = String(row[categoryKey] || 'Unknown')
      if (valueKey === 'count' || !customization?.dataMapping?.value) {
        counts[category] = (counts[category] || 0) + 1
      } else {
        const value = Number(row[valueKey] || 0)
        if (!isNaN(value)) {
          counts[category] = (counts[category] || 0) + value
        }
      }
    })

    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [chartData, safeDataKey, customization?.dataMapping])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy={responsiveFeatures.showLegend ? "42%" : "50%"}
          outerRadius={responsiveFeatures.showLegend ? "55%" : "70%"}
          fill="#8884d8"
          dataKey="value"
          label={responsiveFeatures.showSecondaryLabels && customization?.showLegend !== false ?
            ({ name, percent }: any) => {
              if (!responsiveFeatures.showGrid) {
                return `${(percent * 100).toFixed(0)}%`
              }
              const truncated = truncateLabel(name, 50)
              return `${truncated.text} ${(percent * 100).toFixed(0)}%`
            } : false}
          animationDuration={customization?.animate !== false ? 1500 : 0}
          onClick={(data) => {
            // For pie charts, find the first matching row in the original data
            if (onDataPointClick && data && data.name) {
              const categoryKey = customization?.dataMapping?.category || safeDataKey[0]
              const matchingRow = chartData.find(row => String(row[categoryKey]) === String(data.name))
              if (matchingRow) {
                onDataPointClick(matchingRow)
              }
            }
          }}
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => {
            const total = pieData.reduce((sum, item) => sum + item.value, 0)
            const percent = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : '0'
            return [`${value} (${percent}%)`, name]
          }}
        />
        {responsiveFeatures.showLegend && (
          <Legend
            content={renderCollapsibleLegend({
              maxVisibleItems: 5,
              wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '10px' },
              formatter: (value) => {
                const result = truncateLabel(String(value), 80)
                return result.text
              }
            })}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  )
}

// MEMOIZATION: Export memoized component to prevent unnecessary re-renders
export const PieRenderer = React.memo(PieRendererComponent, arePropsEqual)
