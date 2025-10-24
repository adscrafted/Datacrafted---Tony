import React from 'react'
import type { DataRow } from '@/lib/stores/data-store'
import { logger } from '@/lib/utils/logger'
import { shallowArrayEqual } from '@/lib/utils/react-helpers'

const HeatmapChart = React.lazy(() => import('../../charts/heatmap-chart'))

interface HeatmapRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
}

const HeatmapRendererComponent: React.FC<HeatmapRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  logger.log('🗺️ [HeatmapRenderer] Rendering with:', {
    chartDataLength: chartData?.length,
    safeDataKey,
    effectiveDataMapping,
    configDataMapping,
    customization: customization?.dataMapping,
    sampleRow: chartData?.[0]
  })

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

HeatmapRendererComponent.displayName = 'HeatmapRendererComponent'

export const HeatmapRenderer = React.memo(HeatmapRendererComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if data or config actually changed
  const shouldSkipRender = (
    prevProps.chartData === nextProps.chartData &&
    prevProps.customization === nextProps.customization &&
    prevProps.configDataMapping === nextProps.configDataMapping &&
    shallowArrayEqual(prevProps.safeDataKey, nextProps.safeDataKey)
  )

  if (!shouldSkipRender) {
    logger.log('🗺️ [HeatmapRenderer] Re-rendering due to prop changes:', {
      chartDataChanged: prevProps.chartData !== nextProps.chartData,
      customizationChanged: prevProps.customization !== nextProps.customization,
      configDataMappingChanged: prevProps.configDataMapping !== nextProps.configDataMapping,
      safeDataKeyChanged: !shallowArrayEqual(prevProps.safeDataKey, nextProps.safeDataKey)
    })
  }

  return shouldSkipRender
})
