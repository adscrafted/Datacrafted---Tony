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

  // For sparkline, if trend field is specified, use it as both x and y
  // Otherwise use first two columns as x and y
  const xField = effectiveDataMapping?.xAxis || safeDataKey[0] || 'x'
  const yField = effectiveDataMapping?.trend || effectiveDataMapping?.yAxis || safeDataKey[1] || 'y'

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
        height={customization?.height || 60}
        color={customization?.color || colors[0] || '#3b82f6'}
        showTooltip={customization?.showTooltip !== false}
        showDots={customization?.showDots || false}
        strokeWidth={customization?.strokeWidth || 2}
        fillArea={customization?.fillArea || false}
      />
    </React.Suspense>
  )
}
