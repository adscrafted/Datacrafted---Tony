import React from 'react'
import type { DataRow } from '@/lib/stores/data-store'
import { logger } from '@/lib/utils/logger'
import { shallowArrayEqual } from '@/lib/utils/react-helpers'

const TreemapChart = React.lazy(() => import('../../charts/treemap-chart'))

// Preload the treemap chart to prevent Suspense flashing on first render
if (typeof window !== 'undefined') {
  import('../../charts/treemap-chart')
}

interface TreemapRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  colors: string[]
}

const TreemapRendererComponent: React.FC<TreemapRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping,
  colors
}) => {
  const effectiveDataMapping = customization?.dataMapping || configDataMapping

  logger.log('🌳 [TreemapRenderer] Rendering with:', {
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

TreemapRendererComponent.displayName = 'TreemapRendererComponent'

export const TreemapRenderer = React.memo(TreemapRendererComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if data or config actually changed
  const shouldSkipRender = (
    prevProps.chartData === nextProps.chartData &&
    prevProps.customization === nextProps.customization &&
    prevProps.configDataMapping === nextProps.configDataMapping &&
    shallowArrayEqual(prevProps.safeDataKey, nextProps.safeDataKey) &&
    shallowArrayEqual(prevProps.colors, nextProps.colors)
  )

  if (!shouldSkipRender) {
    logger.log('🌳 [TreemapRenderer] Re-rendering due to prop changes:', {
      chartDataChanged: prevProps.chartData !== nextProps.chartData,
      customizationChanged: prevProps.customization !== nextProps.customization,
      configDataMappingChanged: prevProps.configDataMapping !== nextProps.configDataMapping,
      safeDataKeyChanged: !shallowArrayEqual(prevProps.safeDataKey, nextProps.safeDataKey),
      colorsChanged: !shallowArrayEqual(prevProps.colors, nextProps.colors)
    })
  }

  return shouldSkipRender
})
