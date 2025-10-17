import React from 'react'
import { DataRow } from '@/lib/store'

const SankeyChart = React.lazy(() => import('../../charts/sankey-chart'))

interface SankeyRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  colors: string[]
}

export const SankeyRenderer: React.FC<SankeyRendererProps> = ({
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
        <div className="text-sm text-gray-400">Loading sankey diagram...</div>
      </div>
    }>
      <SankeyChart
        data={chartData}
        dataMapping={{
          source: effectiveDataMapping?.source || safeDataKey[0] || 'source',
          target: effectiveDataMapping?.target_node || safeDataKey[1] || 'target',
          value: effectiveDataMapping?.value || safeDataKey[2] || 'value'
        }}
        customization={{
          nodeWidth: customization?.nodeWidth || 12,
          nodePadding: customization?.nodePadding || 24,
          colors: colors
        }}
      />
    </React.Suspense>
  )
}
