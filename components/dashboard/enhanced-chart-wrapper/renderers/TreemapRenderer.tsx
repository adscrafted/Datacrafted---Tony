import React from 'react'
import { DataRow } from '@/lib/store'

const TreemapChart = React.lazy(() => import('../../charts/treemap-chart'))

interface TreemapRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  colors: string[]
}

export const TreemapRenderer: React.FC<TreemapRendererProps> = ({
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
        <div className="text-sm text-gray-400">Loading treemap...</div>
      </div>
    }>
      <TreemapChart
        data={chartData}
        dataMapping={{
          category: effectiveDataMapping?.category || safeDataKey[0] || 'category',
          value: effectiveDataMapping?.value || safeDataKey[1] || 'value',
          parentCategory: effectiveDataMapping?.parentCategory
        }}
        customization={{
          colors: colors,
          showLabels: customization?.showLabels !== false
        }}
      />
    </React.Suspense>
  )
}
