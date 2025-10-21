import React from 'react'
import type { DataRow } from '@/lib/store'

const HeatmapChart = React.lazy(() => import('../../charts/heatmap-chart'))

interface HeatmapRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
}

export const HeatmapRenderer: React.FC<HeatmapRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading heatmap...</div>
      </div>
    }>
      <HeatmapChart
        data={chartData}
        dataMapping={{
          xAxis: effectiveDataMapping?.xAxis || safeDataKey[0] || 'x',
          yAxis: effectiveDataMapping?.yAxis || safeDataKey[1] || 'y',
          value: effectiveDataMapping?.value || safeDataKey[2] || 'value'
        }}
        customization={{
          colorScheme: customization?.colorScheme || 'blue',
          showValues: customization?.showValues !== false
        } as any}
      />
    </React.Suspense>
  )
}
