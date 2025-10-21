import React from 'react'
import type { DataRow } from '@/lib/store'

const SparklineChart = React.lazy(() => import('../../charts/sparkline-chart'))

interface SparklineRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  colors: string[]
}

export const SparklineRenderer: React.FC<SparklineRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping,
  colors
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  // Handle flexible field mapping for sparklines
  // Support: xAxis, yAxis OR trend, metric OR just use first two columns
  const xField = effectiveDataMapping?.xAxis || effectiveDataMapping?.x || safeDataKey[0] || 'x'
  const yField = effectiveDataMapping?.yAxis || effectiveDataMapping?.y || effectiveDataMapping?.trend || effectiveDataMapping?.metric || safeDataKey[1] || 'y'

  // For sparklines with aggregation, we should pre-aggregate the data
  // But if no aggregation is specified, use raw data
  const aggregationType = effectiveDataMapping?.aggregation

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading sparkline...</div>
      </div>
    }>
      <SparklineChart
        data={chartData}
        dataMapping={{
          xAxis: xField,
          yAxis: yField
        }}
        height={customization?.height || 80}
        color={customization?.color || colors[0] || '#3b82f6'}
        showTooltip={customization?.showTooltip !== false}
        showDots={customization?.showDots || false}
        strokeWidth={customization?.strokeWidth || 2}
        fillArea={customization?.fillArea || false}
      />
    </React.Suspense>
  )
}
