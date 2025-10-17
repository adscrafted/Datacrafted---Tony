import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { ChartType, DataRow } from '@/lib/store'
import { CHART_MINIMUMS, RESPONSIVE_BREAKPOINTS } from '../constants'
import {
  ResponsiveFeatures,
  ContainerSizing,
  SmartAxisScaling,
  EnhancedAxisLabels,
  DualAxisConfig
} from '../types'

// Debounced resize hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface UseResponsiveDesignOptions {
  type: ChartType
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  dualAxisConfig: DualAxisConfig | null
}

interface UseResponsiveDesignReturn {
  chartContainerRef: React.RefObject<HTMLDivElement>
  containerSizing: ContainerSizing
  responsiveFeatures: ResponsiveFeatures
  smartAxisScaling: SmartAxisScaling
  enhancedAxisLabels: EnhancedAxisLabels
  truncateLabel: (label: string, maxWidth: number) => { text: string; isTruncated: boolean }
  measureText: (text: string, fontSize?: number, fontFamily?: string) => number
}

/**
 * Hook to handle responsive design features for charts
 * Handles:
 * - Container dimension tracking with debouncing
 * - Text measurement for smart label truncation
 * - Smart axis scaling (rotation, margins)
 * - Responsive feature flags (show legend, grid, etc.)
 * - Enhanced axis labels with intelligent truncation
 */
export function useResponsiveDesign({
  type,
  chartData,
  safeDataKey,
  customization,
  dualAxisConfig
}: UseResponsiveDesignOptions): UseResponsiveDesignReturn {
  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  // Enhanced container dimension tracking with debouncing
  const [rawDimensions, setRawDimensions] = useState({ width: 0, height: 0 })

  // Debounce dimensions to prevent excessive re-renders
  const chartDimensions = useDebounce(rawDimensions, 250)

  // Create canvas for text measurement
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
  }, [])

  useEffect(() => {
    if (!chartContainerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setRawDimensions({ width, height })
      }
    })

    resizeObserver.observe(chartContainerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Text measurement utility
  const measureText = useCallback((text: string, fontSize = 11, fontFamily = 'system-ui'): number => {
    if (!canvasRef.current) return text.length * 6 // Fallback approximation

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return text.length * 6

    ctx.font = `${fontSize}px ${fontFamily}`
    return ctx.measureText(text).width
  }, [])

  // Container-aware sizing with minimum dimensions
  const containerSizing = useMemo<ContainerSizing>(() => {
    const minDims = (CHART_MINIMUMS as any)[type] || CHART_MINIMUMS.bar
    const { width, height } = chartDimensions

    // Ensure container meets minimum requirements
    const meetsMinWidth = width >= minDims.width
    const meetsMinHeight = height >= minDims.height

    // Calculate effective dimensions
    const effectiveWidth = Math.max(width, minDims.width)
    const effectiveHeight = Math.max(height, minDims.height)

    // Preserve aspect ratio if needed
    let finalWidth = effectiveWidth
    let finalHeight = effectiveHeight

    if (type === 'pie' && meetsMinWidth && meetsMinHeight) {
      // For pie charts, maintain square aspect ratio
      const size = Math.min(effectiveWidth, effectiveHeight)
      finalWidth = size
      finalHeight = size
    }

    return {
      width: finalWidth,
      height: finalHeight,
      meetsMinimums: meetsMinWidth && meetsMinHeight,
      isConstrained: width < minDims.width || height < minDims.height
    }
  }, [chartDimensions, type])

  // Enhanced responsive feature calculation for better content visibility
  const responsiveFeatures = useMemo<ResponsiveFeatures>(() => {
    const { width } = containerSizing

    return {
      showLegend: width >= RESPONSIVE_BREAKPOINTS.medium,
      showGrid: width >= RESPONSIVE_BREAKPOINTS.medium,
      showSecondaryLabels: width >= RESPONSIVE_BREAKPOINTS.large,
      showPrimaryLabels: width >= RESPONSIVE_BREAKPOINTS.small,
      useFallbackView: width < RESPONSIVE_BREAKPOINTS.small
    }
  }, [containerSizing])

  // Smart margin calculation based on actual label content
  const smartAxisScaling = useMemo<SmartAxisScaling>(() => {
    if (!chartData.length || !safeDataKey.length || !responsiveFeatures.showPrimaryLabels) {
      return {
        rotation: 0,
        bottomMargin: 40,
        leftMargin: 40,
        rightMargin: 20,
        topMargin: 20,
        xAxisInterval: 'preserveStartEnd' as const
      }
    }

    const sampleLabels = chartData.slice(0, Math.min(15, chartData.length))
      .map(row => String(row[safeDataKey[0]] || ''))

    // Measure actual text widths
    const labelWidths = sampleLabels.map(label => measureText(label, 11))
    const maxLabelWidth = Math.max(...labelWidths, 0)
    const avgLabelWidth = labelWidths.length > 0 ? labelWidths.reduce((a, b) => a + b, 0) / labelWidths.length : 0
    const maxLabelLength = sampleLabels.reduce((max, label) => Math.max(max, label.length), 0)

    let rotation = 0
    let bottomMargin = 50
    let leftMargin = 50
    let rightMargin = 20
    let topMargin = 20

    // Smart rotation based on container width and label content
    const { width: containerWidth } = containerSizing
    const availableWidth = containerWidth - leftMargin - rightMargin

    if (customization?.labelRotation === 'horizontal') {
      rotation = 0
      bottomMargin = 50
    } else if (customization?.labelRotation === 'diagonal') {
      rotation = -45
      bottomMargin = Math.min(Math.max(60, maxLabelWidth * 0.7), 100) // Cap at 100px
    } else if (customization?.labelRotation === 'vertical') {
      rotation = -90
      bottomMargin = Math.min(Math.max(70, maxLabelWidth + 10), 120) // Cap at 120px
    } else {
      // Auto mode - intelligent rotation based on space constraints
      const estimatedLabelSpace = avgLabelWidth + 8 // Add padding
      const maxPossibleLabels = Math.floor(availableWidth / estimatedLabelSpace)

      if (chartData.length > maxPossibleLabels || maxLabelWidth > availableWidth / chartData.length) {
        if (maxLabelLength > 12) {
          rotation = -45
          bottomMargin = Math.min(Math.max(70, maxLabelWidth * 0.7), 100) // Cap at 100px
        } else {
          rotation = -30
          bottomMargin = Math.min(Math.max(60, maxLabelWidth * 0.5), 80) // Cap at 80px
        }
      }
    }

    // Calculate Y-axis margin based on value labels
    if (chartData.length > 0 && safeDataKey.length > 1) {
      const yValues = chartData.map(row => {
        const val = row[safeDataKey[1]]
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0
      }).filter(v => !isNaN(v))

      if (yValues.length > 0) {
        const maxValue = Math.max(...yValues)
        const minValue = Math.min(...yValues)
        const maxValueWidth = measureText(maxValue.toLocaleString(), 11)
        const minValueWidth = measureText(minValue.toLocaleString(), 11)
        leftMargin = Math.max(leftMargin, Math.max(maxValueWidth, minValueWidth) + 15)
      }
    }

    // Enhanced label interval calculation
    let xAxisInterval: number | 'preserveStartEnd' = 0
    if (chartData.length > 0 && availableWidth > 0) {
      const labelSpaceNeeded = rotation === 0 ? avgLabelWidth + 8 : 45
      const maxLabels = Math.floor(availableWidth / labelSpaceNeeded)

      if (chartData.length > maxLabels && maxLabels > 2) {
        const interval = Math.ceil(chartData.length / maxLabels)
        xAxisInterval = Math.max(1, interval - 1)
      } else if (chartData.length > maxLabels) {
        xAxisInterval = 'preserveStartEnd'
      }
    }

    return {
      rotation,
      bottomMargin: Math.min(bottomMargin, Math.max(containerSizing.height * 0.25, 80)), // 25% or minimum 80px (reduced from 40%/150px)
      leftMargin: Math.min(leftMargin, containerWidth * 0.2), // Cap at 20% of container width
      rightMargin,
      topMargin: responsiveFeatures.showLegend ? Math.max(topMargin, 40) : topMargin,
      xAxisInterval
    }
  }, [chartData, safeDataKey, customization?.labelRotation, containerSizing, responsiveFeatures.showPrimaryLabels, responsiveFeatures.showLegend, measureText])

  // Enhanced label truncation utility
  const truncateLabel = useCallback((label: string, maxWidth: number): { text: string; isTruncated: boolean } => {
    const fullWidth = measureText(label, 11)
    if (fullWidth <= maxWidth) {
      return { text: label, isTruncated: false }
    }

    // Binary search for optimal length
    let left = 0
    let right = label.length
    let bestLength = 0

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const truncated = label.substring(0, mid) + '...'
      const width = measureText(truncated, 11)

      if (width <= maxWidth) {
        bestLength = mid
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    const finalText = bestLength > 0 ? label.substring(0, bestLength) + '...' : '...'
    return { text: finalText, isTruncated: true }
  }, [measureText])

  // Generate default axis labels with intelligent truncation
  const enhancedAxisLabels = useMemo<EnhancedAxisLabels>(() => {
    if (!safeDataKey.length || !responsiveFeatures.showPrimaryLabels) {
      return { x: '', y: '', xTruncated: false, yTruncated: false }
    }

    // Get base labels
    let xLabel = customization?.axisLabels?.x
    let yLabel = customization?.axisLabels?.y

    if (!xLabel && customization?.dataMapping?.xAxis) {
      xLabel = customization.dataMapping.xAxis
    }

    if (!yLabel && customization?.dataMapping?.yAxis) {
      if (Array.isArray(customization.dataMapping.yAxis)) {
        yLabel = customization.dataMapping.yAxis.join(', ')
      } else {
        yLabel = customization.dataMapping.yAxis
      }
    }

    const baseXLabel = xLabel || safeDataKey[0] || ''
    const baseYLabel = yLabel || (safeDataKey[1] || 'Value')

    // Truncate based on available space
    const maxLabelWidth = Math.max(100, containerSizing.width * 0.3)
    const xResult = truncateLabel(baseXLabel, maxLabelWidth)
    const yResult = truncateLabel(baseYLabel, maxLabelWidth)

    return {
      x: xResult.text,
      y: yResult.text,
      xTruncated: xResult.isTruncated,
      yTruncated: yResult.isTruncated,
      xOriginal: baseXLabel,
      yOriginal: baseYLabel
    }
  }, [safeDataKey, customization?.axisLabels, customization?.dataMapping, responsiveFeatures.showPrimaryLabels, containerSizing.width, truncateLabel])

  return {
    chartContainerRef,
    containerSizing,
    responsiveFeatures,
    smartAxisScaling,
    enhancedAxisLabels,
    truncateLabel,
    measureText
  }
}
