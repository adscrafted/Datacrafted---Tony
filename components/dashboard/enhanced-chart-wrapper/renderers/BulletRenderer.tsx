import React from 'react'
import { DataRow } from '@/lib/store'

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

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading bullet chart...</div>
      </div>
    }>
      <BulletChart
        data={chartData}
        dataMapping={{
          category: effectiveDataMapping?.category || safeDataKey[0] || 'category',
          actual: effectiveDataMapping?.actual || safeDataKey[1] || 'actual',
          target: effectiveDataMapping?.comparative || effectiveDataMapping?.target || safeDataKey[2] || 'target',
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
