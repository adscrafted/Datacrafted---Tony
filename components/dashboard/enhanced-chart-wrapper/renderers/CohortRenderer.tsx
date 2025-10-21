import React from 'react'
import type { DataRow } from '@/lib/store'

const CohortGrid = React.lazy(() => import('../../charts/cohort-grid'))

interface CohortRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
}

export const CohortRenderer: React.FC<CohortRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading cohort grid...</div>
      </div>
    }>
      <CohortGrid
        data={chartData}
        dataMapping={{
          cohort: effectiveDataMapping?.cohort || safeDataKey[0] || 'cohort',
          period: effectiveDataMapping?.period || safeDataKey[1] || 'period',
          retention: effectiveDataMapping?.value || safeDataKey[2] || 'retention'
        }}
        customization={{
          colorScheme: customization?.colorScheme || 'blue',
          showPercentages: customization?.showPercentages !== false
        } as any}
      />
    </React.Suspense>
  )
}
