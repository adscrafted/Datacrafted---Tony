import React from 'react'
import type { DataRow } from '@/lib/stores/data-store'
import { logger } from '@/lib/utils/logger'

const GaugeChart = React.lazy(() => import('../../charts/gauge-chart'))

interface GaugeRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
}

const GaugeRendererComponent: React.FC<GaugeRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  // Ensure aggregation is always defined (default to 'sum')
  const aggregation = effectiveDataMapping?.aggregation || 'sum'
  const metric = effectiveDataMapping?.metric || safeDataKey[0] || 'value'
  const min = effectiveDataMapping?.min ?? 0
  const max = effectiveDataMapping?.max ?? 100

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading gauge...</div>
      </div>
    }>
      <GaugeChart
        data={chartData}
        dataMapping={{
          metric: metric,
          aggregation: aggregation as 'sum' | 'average' | 'avg' | 'median' | 'min' | 'max' | 'count'
        }}
        customization={{
          min: min,
          max: max
        }}
      />
    </React.Suspense>
  )
}

export const GaugeRenderer = React.memo(GaugeRendererComponent, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if changed (re-render)
  return (
    prevProps.chartData === nextProps.chartData &&
    prevProps.customization === nextProps.customization &&
    prevProps.configDataMapping === nextProps.configDataMapping &&
    (prevProps.safeDataKey === nextProps.safeDataKey ||
      prevProps.safeDataKey?.[0] === nextProps.safeDataKey?.[0])
  )
})
