import React from 'react'
import { ChartType, DataRow } from '@/lib/store'
import { DualAxisConfig } from '../types'

interface UseDualAxisOptions {
  type: ChartType
  safeDataKey: string[]
  chartData: DataRow[]
  customization: any
  configDataMapping: any
}

/**
 * Hook to detect if dual Y-axis is needed for bar/line/area/scatter charts with multiple metrics
 * Returns configuration for left and right Y-axes with their respective metrics
 */
export function useDualAxis({
  type,
  safeDataKey,
  chartData,
  customization,
  configDataMapping
}: UseDualAxisOptions): DualAxisConfig | null {
  return React.useMemo(() => {
    // Check if explicit yAxis1/yAxis2 configuration exists
    const effectiveMapping = {
      ...configDataMapping,
      ...customization?.dataMapping
    }

    const hasExplicitDualAxis = !!(effectiveMapping?.yAxis1 && effectiveMapping?.yAxis2)

    if (hasExplicitDualAxis) {
      // Use explicit configuration
      const leftMetrics = Array.isArray(effectiveMapping.yAxis1)
        ? effectiveMapping.yAxis1
        : [effectiveMapping.yAxis1]
      const rightMetrics = Array.isArray(effectiveMapping.yAxis2)
        ? effectiveMapping.yAxis2
        : [effectiveMapping.yAxis2]

      return {
        leftMetrics,
        rightMetrics,
        leftLabel: effectiveMapping.yAxis1Label || leftMetrics.join(', '),
        rightLabel: effectiveMapping.yAxis2Label || rightMetrics.join(', ')
      }
    }

    // Only auto-detect for bar/line/area charts with 2+ value columns
    if ((type !== 'bar' && type !== 'line' && type !== 'area') || safeDataKey.length < 3) {
      return null
    }

    const valueKeys = safeDataKey.slice(1) // Skip the x-axis key
    if (valueKeys.length < 2) return null

    // Calculate min/max ranges for each metric
    const ranges = valueKeys.map((key: string) => {
      const values = chartData
        .map(row => Number(row[key]))
        .filter(v => !isNaN(v) && v !== 0)

      if (values.length === 0) return { key, min: 0, max: 0, range: 0 }

      const min = Math.min(...values)
      const max = Math.max(...values)
      const range = max - min

      return { key, min, max, range }
    })

    // Check if any two metrics have significantly different scales (10x or more)
    let needsDualAxis = false
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const ratio = ranges[i].max / (ranges[j].max || 1)
        if (ratio >= 10 || ratio <= 0.1) {
          needsDualAxis = true
          break
        }
      }
      if (needsDualAxis) break
    }

    if (!needsDualAxis) return null

    // Split metrics: first half on left axis, second half on right axis
    const midpoint = Math.ceil(valueKeys.length / 2)
    const leftMetrics = valueKeys.slice(0, midpoint)
    const rightMetrics = valueKeys.slice(midpoint)

    return {
      leftMetrics,
      rightMetrics,
      leftLabel: leftMetrics.join(', '),
      rightLabel: rightMetrics.join(', ')
    }
  }, [type, safeDataKey, chartData, customization?.dataMapping, configDataMapping])
}
