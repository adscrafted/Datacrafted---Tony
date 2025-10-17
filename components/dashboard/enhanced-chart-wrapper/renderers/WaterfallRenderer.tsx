import React from 'react'
import { DataRow } from '@/lib/store'

const WaterfallChart = React.lazy(() => import('../../charts/waterfall-chart'))

interface WaterfallRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
}

export const WaterfallRenderer: React.FC<WaterfallRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading waterfall chart...</div>
      </div>
    }>
      <WaterfallChart
        data={chartData}
        dataMapping={{
          category: effectiveDataMapping?.category || safeDataKey[0] || 'category',
          value: effectiveDataMapping?.value || safeDataKey[1] || 'value',
          type: effectiveDataMapping?.type
        }}
        customization={{
          showLegend: customization?.showLegend,
          showGrid: customization?.showGrid,
          showLabels: customization?.showLabels,
          showConnectors: customization?.showConnectors,
          increaseColor: '#10b981',
          decreaseColor: '#ef4444',
          totalColor: '#3b82f6'
        }}
      />
    </React.Suspense>
  )
}
