import React from 'react'
import type { DataRow } from '@/lib/store'

const FunnelChart = React.lazy(() => import('../../charts/funnel-chart'))

interface FunnelRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  colors: string[]
}

export const FunnelRenderer: React.FC<FunnelRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping,
  colors
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading funnel chart...</div>
      </div>
    }>
      <FunnelChart
        data={chartData}
        dataMapping={{
          stage: effectiveDataMapping?.stage || safeDataKey[0] || 'stage',
          value: effectiveDataMapping?.value || safeDataKey[1] || 'value'
        }}
        customization={{
          showLabels: customization?.showLabels !== false,
          showValues: customization?.showValues !== false,
          colors: colors
        } as any}
      />
    </React.Suspense>
  )
}
