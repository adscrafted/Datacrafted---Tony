import React from 'react'
import { Scorecard } from '../../scorecard'
import { DataRow } from '@/lib/store'

interface ScorecardRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  title: string
}

export const ScorecardRenderer: React.FC<ScorecardRendererProps> = ({
  chartData,
  safeDataKey,
  customization,
  configDataMapping,
  title
}) => {
  if (safeDataKey.length === 0 || chartData.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Invalid data</div>
  }

  // For formula-based scorecards, use formulaAlias; otherwise use metric
  const key = customization?.dataMapping?.formulaAlias || customization?.dataMapping?.metric || safeDataKey[0]

  // Get effective data mapping
  const effectiveMapping = {
    ...configDataMapping,
    ...customization?.dataMapping
  }

  // Get aggregation type - check customization first, then dataMapping, default to 'sum'
  const aggregationType = customization?.aggregation || effectiveMapping?.aggregation || 'sum'

  console.log(`🔍 [SCORECARD_RENDERER] ${title} - Calculating:`, {
    key,
    aggregationType,
    chartDataLength: chartData.length,
    effectiveMapping,
    safeDataKey,
    firstRow: chartData[0],
    chartDataKeys: chartData[0] ? Object.keys(chartData[0]) : []
  })

  let metricValue = 0

  // Check if this is formula-based scorecard that's already been processed
  // Formula processing returns a single row with the calculated value
  if (effectiveMapping.formula && effectiveMapping.formulaAlias && chartData.length === 1 && chartData[0]._calculationType === 'formula') {
    // Data is already aggregated - use the value directly
    const val = chartData[0][key]
    metricValue = typeof val === 'number' ? val : 0
  } else {
    // For non-formula scorecards, use the shared calculation function
    // This ensures consistency with the fullscreen calculation details
    // CRITICAL: chartData now uses ALL data for scorecards (no 1000-row limit)
    // This matches the fullscreen view which also uses ALL filteredData
    const { calculateScorecardValue } = require('@/lib/utils/data-calculations')
    const result = calculateScorecardValue(chartData, key, aggregationType as any)
    metricValue = result || 0
  }

  return (
    <Scorecard
      title={customization?.customTitle || title}
      value={metricValue}
      unit=""
      aggregationType={aggregationType as any}
    />
  )
}
