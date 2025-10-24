import React from 'react'
import type { DataRow } from '@/lib/stores/data-store'

const BulletChart = React.lazy(() => import('../../charts/bullet-chart'))

interface BulletRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
}

export const BulletRenderer: React.FC<BulletRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  // Handle flexible field mapping for bullet charts
  // Support: category, actual, target OR metric, aggregation, target
  const categoryField = effectiveDataMapping?.category || safeDataKey[0] || 'category'
  const actualField = effectiveDataMapping?.actual || effectiveDataMapping?.metric || safeDataKey[1] || 'actual'
  const targetField = effectiveDataMapping?.target || effectiveDataMapping?.comparative || safeDataKey[2]

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading bullet chart...</div>
      </div>
    }>
      <BulletChart
        data={chartData}
        dataMapping={{
          category: categoryField,
          actual: actualField,
          target: targetField,
          ranges: effectiveDataMapping?.ranges
        }}
        customization={{
          showLabels: customization?.showLabels !== false,
          showGrid: customization?.showGrid
        }}
      />
    </React.Suspense>
  )
}
