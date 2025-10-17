import React from 'react'
import { DataRow } from '@/lib/store'

const GaugeChart = React.lazy(() => import('../../charts/gauge-chart'))

interface GaugeRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
}

export const GaugeRenderer: React.FC<GaugeRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading gauge...</div>
      </div>
    }>
      <GaugeChart
        data={chartData}
        dataMapping={{
          metric: effectiveDataMapping?.metric || safeDataKey[0] || 'value',
          aggregation: (effectiveDataMapping as any)?.aggregation || 'sum'
        }}
        customization={{
          min: customization?.min || 0,
          max: customization?.max || 100
        }}
      />
    </React.Suspense>
  )
}
