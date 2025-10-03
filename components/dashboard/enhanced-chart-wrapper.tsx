'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts'
import {
  Maximize2,
  Download,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit3,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Database
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { Scorecard } from './scorecard'
import { ChartCustomizationPanel } from './chart-customization-panel'
import { DataRow, useDataStore, ChartTemplate, ChartType } from '@/lib/store'
import { cn } from '@/lib/utils/cn'
import { QualityBadge } from './quality-indicator'
import { renderCollapsibleLegend } from './collapsible-legend'
import { aggregateChartData } from '@/lib/utils/data-aggregation'

const TableChartLazy = React.lazy(() => import('./charts/table-chart').then(m => ({ default: m.TableChart })))
const WaterfallChart = React.lazy(() => import('./charts/waterfall-chart'))

interface EnhancedChartWrapperProps {
  id: string
  type: ChartType
  title: string
  description: string
  data: DataRow[]
  dataKey: string[]
  configDataMapping?: any  // dataMapping from original chart config
  isDragging?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  onEdit?: (id: string) => void
  className?: string
  qualityScore?: number
  initialTab?: 'general' | 'data' | 'style' | 'axes' | 'actions' // Tab to open in customization panel
}

// Enhanced chart minimum dimensions and aspect ratios for better content visibility
const CHART_MINIMUMS = {
  bar: { width: 300, height: 250, aspectRatio: 4/3 },
  line: { width: 350, height: 250, aspectRatio: 5/3 },
  pie: { width: 280, height: 280, aspectRatio: 1 },
  area: { width: 350, height: 250, aspectRatio: 5/3 },
  scatter: { width: 350, height: 250, aspectRatio: 5/3 },
  scorecard: { width: 200, height: 120, aspectRatio: 3/2 },
  table: { width: 400, height: 300, aspectRatio: 3/2 },
  combo: { width: 400, height: 300, aspectRatio: 4/3 }
} as const

// Enhanced responsive breakpoints for better legend and label visibility
const RESPONSIVE_BREAKPOINTS = {
  large: 500,   // Reduced threshold for showing all features
  medium: 350,  // Reduced threshold for showing core features
  small: 250    // Minimum for basic functionality
} as const

// Feature flags based on container width
interface ResponsiveFeatures {
  showLegend: boolean
  showGrid: boolean
  showSecondaryLabels: boolean
  showPrimaryLabels: boolean
  useFallbackView: boolean
}

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

const COLORS = ['#2563eb', '#dc2626', '#ca8a04', '#16a34a', '#9333ea', '#c2410c']

export const EnhancedChartWrapper = React.memo<EnhancedChartWrapperProps>(function EnhancedChartWrapper({
  id,
  type,
  title,
  description,
  data,
  dataKey,
  configDataMapping,
  isDragging = false,
  isSelected = false,
  onSelect,
  onEdit,
  className,
  qualityScore,
  initialTab
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [showEditTitle, setShowEditTitle] = useState(false)
  const [editableTitle, setEditableTitle] = useState(title)
  const [editableDescription, setEditableDescription] = useState(description)

  const {
    setFullScreen,
    exportChart,
    chartCustomizations,
    removeChart,
    duplicateChart,
    updateChartType,
    updateChartCustomization,
    chartTemplates,
    setContextMenu,
    contextMenuPosition,
    contextMenuChartId,
    draftChart
  } = useDataStore()

  // Get chart customization
  const customization = chartCustomizations[id]
  const isVisible = customization?.isVisible !== false

  // Check if this is a draft chart (newly added, not yet configured)
  const isDraftChart = React.useMemo(() => {
    return draftChart?.id === id
  }, [draftChart, id])

  // Check if chart has been configured with data
  const isChartConfigured = React.useMemo(() => {
    // Merge original config with customizations
    const effectiveMapping = {
      ...configDataMapping,
      ...customization?.dataMapping
    }

    // If both are empty, chart is not configured
    if (!effectiveMapping || Object.keys(effectiveMapping).length === 0) {
      return false
    }

    // Check if required fields are configured based on chart type
    switch (type) {
      case 'line':
      case 'bar':
        return !!(effectiveMapping.xAxis || effectiveMapping.category)
      case 'area':
        // Area charts need both X-axis AND Y-axis configured
        // Check for Y-axis in multiple formats: yAxis, yAxis1, or values
        const hasXAxis = !!(effectiveMapping.xAxis || effectiveMapping.category)
        const hasYAxis = !!(effectiveMapping.yAxis || effectiveMapping.yAxis1 || effectiveMapping.values)
        return hasXAxis && hasYAxis
      case 'scatter':
        // Scatter charts need both X-axis AND Y-axis configured
        // Check for Y-axis in multiple formats: yAxis, yAxis1, or values
        const hasXAxisScatter = !!(effectiveMapping.xAxis || effectiveMapping.category)
        const hasYAxisScatter = !!(effectiveMapping.yAxis || effectiveMapping.yAxis1 || effectiveMapping.values)
        return hasXAxisScatter && hasYAxisScatter
      case 'pie':
        return !!effectiveMapping.category
      case 'scorecard':
        return !!effectiveMapping.metric
      case 'table':
        return !!(effectiveMapping.columns && effectiveMapping.columns.length > 0) || !!effectiveMapping.yAxis
      case 'combo':
        return !!(effectiveMapping.xAxis && (effectiveMapping.yAxis || effectiveMapping.yAxis1))
      case 'waterfall':
        return !!(effectiveMapping.category && effectiveMapping.value)
      case 'funnel':
        return !!(effectiveMapping.stage && effectiveMapping.value)
      case 'heatmap':
        return !!(effectiveMapping.xAxis && effectiveMapping.yAxis && effectiveMapping.value)
      case 'gauge':
        return !!effectiveMapping.value
      case 'cohort':
        return !!(effectiveMapping.cohort && effectiveMapping.period && effectiveMapping.value)
      case 'bullet':
        return !!(effectiveMapping.actual && effectiveMapping.comparative)
      case 'treemap':
        return !!(effectiveMapping.category && effectiveMapping.value)
      case 'sankey':
        return !!(effectiveMapping.source && effectiveMapping.target_node && effectiveMapping.value)
      case 'sparkline':
        return !!effectiveMapping.trend
      default:
        return true // Unknown chart types are considered configured
    }
  }, [customization?.dataMapping, configDataMapping, type])

  // Use data prop (filtered data is passed from parent)
  // Apply Top/Bottom X filtering if specified
  // IMPORTANT: This hook MUST be called before any early returns
  const chartData = React.useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return []
    }

    let processedData = data.slice(0, 1000) // Limit for performance

    // Get effective data mapping
    const effectiveMapping = {
      ...configDataMapping,
      ...customization?.dataMapping
    }

    // Sort by X-axis for all charts that use X-axis (especially important for dates)
    // Apply before other processing like Top/Bottom filtering
    const xKey = effectiveMapping?.xAxis || effectiveMapping?.category
    if (xKey && processedData.length > 0) {
      // Check if X-axis appears to contain dates
      const sampleValue = processedData[0]?.[xKey]
      const isDateColumn = sampleValue && !isNaN(Date.parse(String(sampleValue)))

      if (isDateColumn) {
        // Sort chronologically by date for all chart types
        processedData = [...processedData].sort((a, b) => {
          const dateA = new Date(String(a[xKey]))
          const dateB = new Date(String(b[xKey]))
          return dateA.getTime() - dateB.getTime()
        })
      }
    }

    // Apply aggregation for line/bar/area/combo charts if aggregation method is set
    const aggregationMethod = effectiveMapping?.aggregation
    if (aggregationMethod && xKey && (type === 'line' || type === 'bar' || type === 'area' || type === 'combo')) {
      // Extract Y-axis keys from dataMapping
      const yAxisKeys: string[] = []

      // Handle different Y-axis configurations
      if (effectiveMapping.yAxis) {
        const yValues = Array.isArray(effectiveMapping.yAxis) ? effectiveMapping.yAxis : [effectiveMapping.yAxis]
        yAxisKeys.push(...yValues)
      }
      if (effectiveMapping.yAxis1) {
        const y1Values = Array.isArray(effectiveMapping.yAxis1) ? effectiveMapping.yAxis1 : [effectiveMapping.yAxis1]
        yAxisKeys.push(...y1Values)
      }
      if (effectiveMapping.yAxis2) {
        const y2Values = Array.isArray(effectiveMapping.yAxis2) ? effectiveMapping.yAxis2 : [effectiveMapping.yAxis2]
        yAxisKeys.push(...y2Values)
      }
      if (effectiveMapping.values) {
        const values = Array.isArray(effectiveMapping.values) ? effectiveMapping.values : [effectiveMapping.values]
        yAxisKeys.push(...values)
      }

      // Only aggregate if we have Y-axis keys
      if (yAxisKeys.length > 0) {
        console.log(`📊 [AGGREGATION_DEBUG] ${title}:`, {
          aggregationMethod,
          xKey,
          yAxisKeys,
          beforeAggregation: processedData.length
        })

        processedData = aggregateChartData(processedData, xKey, yAxisKeys, aggregationMethod)

        console.log(`📊 [AGGREGATION_DEBUG] ${title} - After aggregation:`, {
          afterAggregation: processedData.length,
          sampleRow: processedData[0]
        })
      }
    }

    // Apply Top/Bottom X filtering for bar charts
    if (type === 'bar') {
      const { sortBy, sortOrder, limit } = effectiveMapping

      console.log(`📊 [BAR_CHART_DEBUG] ${title}:`, {
        configDataMapping,
        customizationDataMapping: customization?.dataMapping,
        effectiveMapping,
        sortBy,
        sortOrder,
        limit,
        dataLength: processedData.length,
        firstRow: processedData[0]
      })

      // Apply sorting if sortBy is configured
      if (sortBy) {
        // Helper to parse currency values
        const parseVal = (val: any): number => {
          if (typeof val === 'number') return val
          if (typeof val !== 'string') return 0
          const cleaned = String(val).replace(/[€$£¥,\s%]/g, '')
          const num = parseFloat(cleaned)
          return isNaN(num) ? 0 : num
        }

        // Sort data with currency parsing (always sort descending for proper slicing)
        processedData = [...processedData].sort((a, b) => {
          const aVal = parseVal(a[sortBy])
          const bVal = parseVal(b[sortBy])
          return bVal - aVal // Always sort high to low first
        })

        // Apply limit if configured
        if (limit) {
          // If ascending (bottom X), take from the end; if descending (top X), take from the start
          if (sortOrder === 'asc') {
            processedData = processedData.slice(-limit) // Take last N items (smallest values)
          } else {
            processedData = processedData.slice(0, limit) // Take first N items (largest values)
          }
        }

        // Now apply the final sort order for display
        if (sortOrder === 'asc') {
          processedData = processedData.reverse() // Reverse to show ascending order
        }
      }
    }

    return processedData
  }, [data, type, customization?.dataMapping, configDataMapping])

  // Safe dataKey handling - MUST be defined first
  const safeDataKey = React.useMemo(() => {
    // If custom dataMapping is available, use it
    if (customization?.dataMapping) {
      const mapping = customization.dataMapping

      switch (type) {
        case 'line':
        case 'bar':
          // Check for category + values format first (new AI format)
          if (mapping.category && mapping.values) {
            const values = Array.isArray(mapping.values) ? mapping.values : [mapping.values]
            return [mapping.category, ...values]
          }
          // Check for dual-axis format (yAxis1 + yAxis2)
          if (mapping.xAxis && (mapping.yAxis1 || mapping.yAxis2)) {
            const allYAxes = []
            if (mapping.yAxis1) {
              const yAxis1Values = Array.isArray(mapping.yAxis1) ? mapping.yAxis1 : [mapping.yAxis1]
              allYAxes.push(...yAxis1Values)
            }
            if (mapping.yAxis2) {
              const yAxis2Values = Array.isArray(mapping.yAxis2) ? mapping.yAxis2 : [mapping.yAxis2]
              allYAxes.push(...yAxis2Values)
            }
            return [mapping.xAxis, ...allYAxes]
          }
          // Fallback to xAxis + yAxis format
          if (mapping.xAxis && mapping.yAxis) {
            if (Array.isArray(mapping.yAxis)) {
              return [mapping.xAxis, ...mapping.yAxis]
            } else {
              return [mapping.xAxis, mapping.yAxis]
            }
          }
          break

        case 'area':
        case 'scatter':
          // Check for dual-axis format (yAxis1 + yAxis2)
          if (mapping.xAxis && (mapping.yAxis1 || mapping.yAxis2)) {
            const allYAxes = []
            if (mapping.yAxis1) {
              const yAxis1Values = Array.isArray(mapping.yAxis1) ? mapping.yAxis1 : [mapping.yAxis1]
              allYAxes.push(...yAxis1Values)
            }
            if (mapping.yAxis2) {
              const yAxis2Values = Array.isArray(mapping.yAxis2) ? mapping.yAxis2 : [mapping.yAxis2]
              allYAxes.push(...yAxis2Values)
            }
            return [mapping.xAxis, ...allYAxes]
          }
          if (mapping.xAxis && mapping.yAxis) {
            if (Array.isArray(mapping.yAxis)) {
              return [mapping.xAxis, ...mapping.yAxis]
            } else {
              return [mapping.xAxis, mapping.yAxis]
            }
          }
          break

        case 'pie':
          if (mapping.category) {
            return mapping.value ? [mapping.category, mapping.value] : [mapping.category]
          }
          break

        case 'scorecard':
          if (mapping.metric) {
            return [mapping.metric]
          }
          break

        case 'table':
          if (mapping.yAxis) {
            return Array.isArray(mapping.yAxis) ? mapping.yAxis : [mapping.yAxis]
          }
          break
      }
    }

    // Fallback to original dataKey
    if (!dataKey || !Array.isArray(dataKey) || dataKey.length === 0) {
      return ['index']
    }
    return dataKey
  }, [dataKey, customization?.dataMapping, type])

  // Detect if dual Y-axis is needed for bar/line/area/scatter charts with multiple metrics
  const dualAxisConfig = React.useMemo(() => {
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
    const ranges = valueKeys.map(key => {
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

  // Enhanced container dimension tracking with debouncing
  const [rawDimensions, setRawDimensions] = React.useState({ width: 0, height: 0 })
  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  // Debounce dimensions to prevent excessive re-renders
  const chartDimensions = useDebounce(rawDimensions, 250)

  // Create canvas for text measurement
  React.useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
  }, [])

  React.useEffect(() => {
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

  // Container-aware sizing with minimum dimensions
  const containerSizing = useMemo(() => {
    const minDims = CHART_MINIMUMS[type] || CHART_MINIMUMS.bar
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

  // Text measurement utility
  const measureText = useCallback((text: string, fontSize = 11, fontFamily = 'system-ui'): number => {
    if (!canvasRef.current) return text.length * 6 // Fallback approximation

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return text.length * 6

    ctx.font = `${fontSize}px ${fontFamily}`
    return ctx.measureText(text).width
  }, [])

  // Smart margin calculation based on actual label content
  const smartAxisScaling = useMemo(() => {
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
  }, [chartData, safeDataKey, customization?.labelRotation, containerSizing, responsiveFeatures.showPrimaryLabels, measureText])

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
  const enhancedAxisLabels = useMemo(() => {
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

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY }, id)
  }, [id, setContextMenu])

  // Handle chart actions
  const handleDuplicate = useCallback(() => {
    duplicateChart(id)
    setContextMenu(null)
  }, [id, duplicateChart, setContextMenu])

  const handleDelete = useCallback(() => {
    removeChart(id)
    setContextMenu(null)
  }, [id, removeChart, setContextMenu])

  const handleChangeType = useCallback((newType: ChartTemplate['type']) => {
    updateChartType(id, newType)
    setContextMenu(null)
  }, [id, updateChartType, setContextMenu])

  const handleToggleVisibility = useCallback(() => {
    updateChartCustomization(id, { isVisible: !isVisible })
  }, [id, updateChartCustomization, isVisible])

  const handleTitleEdit = useCallback(() => {
    updateChartCustomization(id, {
      customTitle: editableTitle,
      customDescription: editableDescription
    })
    setShowEditTitle(false)
  }, [id, editableTitle, editableDescription, updateChartCustomization])

  // Handle click selection
  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(id)
    }
  }, [id, onSelect])

  // Pie chart data processing
  const pieData = React.useMemo(() => {
    if (type !== 'pie' || safeDataKey.length === 0 || chartData.length === 0) {
      return []
    }

    const categoryKey = customization?.dataMapping?.category || safeDataKey[0]
    const valueKey = customization?.dataMapping?.value || safeDataKey[1] || 'count'

    const counts: Record<string, number> = {}
    chartData.forEach(row => {
      if (!row || typeof row !== 'object') return

      const category = String(row[categoryKey] || 'Unknown')
      if (valueKey === 'count' || !customization?.dataMapping?.value) {
        counts[category] = (counts[category] || 0) + 1
      } else {
        const value = Number(row[valueKey] || 0)
        if (!isNaN(value)) {
          counts[category] = (counts[category] || 0) + value
        }
      }
    })

    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [type, safeDataKey, chartData, customization?.dataMapping])

  // Define colors early so scatter/combo data hooks can use it
  const colors = customization?.colors || COLORS

  // Scatter chart data processing - MUST be at component level to comply with React hooks rules
  const scatterData = React.useMemo(() => {
    if (type !== 'scatter' || safeDataKey.length < 2 || chartData.length === 0) {
      return { numericData: [], groups: [] }
    }

    const effectiveDataMapping = customization?.dataMapping || configDataMapping
    const sizeKey = effectiveDataMapping?.size
    const colorKey = effectiveDataMapping?.color

    // Helper to parse currency and formatted numbers
    const parseNumericValue = (val: any): number => {
      if (typeof val === 'number') return val
      if (typeof val !== 'string') return 0
      const cleaned = val.replace(/[€$£¥,\s%]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    // Transform data to have numeric X/Y values for Recharts
    const numericData = chartData.map(row => ({
      ...row,
      [safeDataKey[0]]: parseNumericValue(row[safeDataKey[0]]),
      [safeDataKey[1]]: parseNumericValue(row[safeDataKey[1]]),
      ...(sizeKey ? { [sizeKey]: parseNumericValue(row[sizeKey]) } : {})
    }))

    // Group data by color dimension if it exists
    interface ScatterGroup {
      name: string
      color: string
      data: DataRow[]
    }

    const groups: ScatterGroup[] = (() => {
      if (!colorKey) {
        return [{
          name: 'Data',
          color: colors[0],
          data: numericData
        }]
      }

      // Group by color dimension
      const groupMap: Record<string, DataRow[]> = {}
      numericData.forEach(row => {
        const colorValue = String(row[colorKey] || 'Unknown')
        if (!groupMap[colorValue]) {
          groupMap[colorValue] = []
        }
        groupMap[colorValue].push(row)
      })

      // Convert to array and assign colors
      return Object.entries(groupMap).map(([name, data], index) => ({
        name,
        color: colors[index % colors.length],
        data
      }))
    })()

    return { numericData, groups }
  }, [type, safeDataKey, chartData, customization?.dataMapping, configDataMapping])

  // Combo chart data processing - MUST be at component level to comply with React hooks rules
  const comboData = React.useMemo(() => {
    if (type !== 'combo' || chartData.length === 0) {
      return []
    }

    const effectiveDataMapping = customization?.dataMapping || configDataMapping

    // Get metrics for each axis
    const yAxis1Metrics = effectiveDataMapping?.yAxis1
      ? (Array.isArray(effectiveDataMapping.yAxis1) ? effectiveDataMapping.yAxis1 : [effectiveDataMapping.yAxis1])
      : []
    const yAxis2Metrics = effectiveDataMapping?.yAxis2
      ? (Array.isArray(effectiveDataMapping.yAxis2) ? effectiveDataMapping.yAxis2 : [effectiveDataMapping.yAxis2])
      : []

    // Helper to parse currency and formatted numbers
    const parseNumericValue = (val: any): number => {
      if (typeof val === 'number') return val
      if (typeof val !== 'string') return 0
      const cleaned = val.replace(/[€$£¥,\s%]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    // Transform data to have numeric values for Recharts
    return chartData.map(row => {
      const transformed = { ...row }
      // Transform all metric columns
      ;[...yAxis1Metrics, ...yAxis2Metrics].forEach(key => {
        if (row[key] !== undefined) {
          transformed[key] = parseNumericValue(row[key])
        }
      })
      return transformed
    })
  }, [type, chartData, customization?.dataMapping, configDataMapping])

  // Render chart based on type
  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <div className="text-sm">No data available</div>
          </div>
        </div>
      )
    }

    // Fallback view for very small containers (EXCEPT scorecards which are designed to be small)
    if (responsiveFeatures.useFallbackView && type !== 'scorecard') {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center space-y-2">
            <div className="text-sm font-medium">Chart too small</div>
            <div className="text-xs">Resize to view details</div>
          </div>
        </div>
      )
    }

    // If not configured, show placeholder instead of chart
    // IMPORTANT: This check happens AFTER all hooks are called to comply with React rules
    if (!isChartConfigured) {
      return (
        <div
          className={cn(
            "h-full flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 transition-all",
            isSelected && "ring-2 ring-blue-500 border-blue-500",
            className
          )}
          onClick={() => onSelect?.(id)}
        >
          <Database className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-4 text-center max-w-xs">
            Configure this chart's data mapping in the Data tab to visualize your data
          </p>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.(id)
            }}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure Data
          </Button>
        </div>
      )
    }

    const commonProps = {
      data: chartData,
      margin: {
        top: smartAxisScaling.topMargin,
        right: smartAxisScaling.rightMargin,
        left: smartAxisScaling.leftMargin,
        bottom: smartAxisScaling.bottomMargin
      }
    }

    // colors is already defined at component level (line 850)

    switch (type) {
      case 'scorecard':
        if (safeDataKey.length > 0 && chartData.length > 0) {
          const key = customization?.dataMapping?.metric || safeDataKey[0]

          // Helper to parse currency and formatted numbers
          const parseNumericValue = (val: any): number => {
            if (typeof val === 'number') return val
            if (typeof val !== 'string') return 0
            // Remove currency symbols (€, $, £, ¥), commas, spaces, percentages
            const cleaned = val.replace(/[€$£¥,\s%]/g, '')
            const num = parseFloat(cleaned)
            return isNaN(num) ? 0 : num
          }

          const values = chartData.map(row => {
            const val = row[key]
            return parseNumericValue(val)
          }).filter(v => !isNaN(v) && v !== null)

          const metricValue = values.length > 0
            ? customization?.aggregation === 'avg'
              ? values.reduce((a, b) => a + b, 0) / values.length
              : values.reduce((a, b) => a + b, 0)
            : 0

          return (
            <Scorecard
              title={customization?.customTitle || title}
              value={metricValue}
              unit=""
              aggregationType={customization?.aggregation}
            />
          )
        }
        return <div className="flex items-center justify-center h-64 text-gray-400">Invalid data</div>

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...commonProps}>
              {responsiveFeatures.showGrid && customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <XAxis
                  dataKey={safeDataKey[0]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  angle={smartAxisScaling.rotation}
                  textAnchor={smartAxisScaling.rotation < 0 ? 'end' : 'middle'}
                  height={smartAxisScaling.bottomMargin}
                  interval={smartAxisScaling.xAxisInterval}
                  tickFormatter={(value) => {
                    const str = String(value)
                    return str.length > 25 ? str.substring(0, 22) + '...' : str
                  }}
                  label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.x ? {
                    value: enhancedAxisLabels.x,
                    position: 'insideBottom',
                    offset: -10,
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId={dualAxisConfig ? "left" : undefined}
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.leftMargin}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && (dualAxisConfig?.leftLabel || enhancedAxisLabels.y) ? {
                    value: dualAxisConfig?.leftLabel || enhancedAxisLabels.y,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {dualAxisConfig && responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.rightMargin + 20}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && dualAxisConfig.rightLabel ? {
                    value: dualAxisConfig.rightLabel,
                    angle: 90,
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value, name) => {
                  if (enhancedAxisLabels.xTruncated || enhancedAxisLabels.yTruncated) {
                    const originalName = name === enhancedAxisLabels.x ? enhancedAxisLabels.xOriginal :
                                       name === enhancedAxisLabels.y ? enhancedAxisLabels.yOriginal : name
                    return [value, originalName]
                  }
                  return [value, name]
                }}
              />
              {responsiveFeatures.showLegend && safeDataKey.length > 1 && (
                <Legend
                  content={renderCollapsibleLegend({
                    maxVisibleItems: 5,
                    wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '5px' },
                    formatter: (value) => {
                      const result = truncateLabel(String(value), 100)
                      return result.text
                    }
                  })}
                />
              )}
              {safeDataKey.slice(1).map((key, index) => {
                // Determine which Y-axis this line should use
                const yAxisId = dualAxisConfig
                  ? (dualAxisConfig.leftMetrics.includes(key) ? "left" : "right")
                  : undefined

                return (
                  <Line
                    key={key}
                    yAxisId={yAxisId}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    strokeWidth={responsiveFeatures.showGrid ? 2 : 3}
                    dot={responsiveFeatures.showGrid ? { r: 3 } : false}
                    activeDot={{ r: responsiveFeatures.showGrid ? 4 : 5 }}
                    animationDuration={customization?.animate !== false ? 1500 : 0}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'bar': {
        console.log(`📊 [BAR_RENDER] ${title}:`, {
          chartDataLength: chartData.length,
          chartDataSample: chartData.slice(0, 3),
          safeDataKey,
          dataKeys: safeDataKey.slice(1)
        })

        // Transform bar data to have numeric values for Recharts
        const parseNumericValueBar = (val: any): number => {
          if (typeof val === 'number') return val
          if (typeof val !== 'string') return 0
          const cleaned = val.replace(/[€$£¥,\s%]/g, '')
          const num = parseFloat(cleaned)
          return isNaN(num) ? 0 : num
        }

        // Transform data inline without useMemo
        const numericBarData = chartData.map(row => {
          const transformed = { ...row }
          // Transform value columns (everything except first column which is category)
          safeDataKey.slice(1).forEach(key => {
            transformed[key] = parseNumericValueBar(row[key])
          })
          return transformed
        })

        console.log(`📊 [BAR_RENDER_TRANSFORMED] ${title}:`, {
          numericBarDataLength: numericBarData.length,
          numericBarDataSample: numericBarData.slice(0, 3),
          dataKeys: safeDataKey.slice(1),
          salesValues: numericBarData.map(row => ({
            campaign: row[safeDataKey[0]],
            sales: row['Sales'],
            salesType: typeof row['Sales']
          }))
        })

        // Calculate Y-axis domain to ensure bars are visible
        const allYValues = numericBarData.flatMap(row =>
          safeDataKey.slice(1).map(key => row[key]).filter(v => typeof v === 'number' && !isNaN(v))
        )
        const maxYValue = Math.max(...allYValues, 0)
        const minYValue = Math.min(...allYValues, 0)

        console.log(`📊 [BAR_Y_AXIS] ${title}:`, {
          allYValues: allYValues.slice(0, 10),
          maxYValue,
          minYValue,
          domain: [0, maxYValue * 1.1]
        })

        console.log(`📊 [BAR_FINAL_RENDER] ${title}:`, {
          numericBarDataLength: numericBarData.length,
          commonProps,
          firstBar: numericBarData[0],
          chartDataFromCommonProps: commonProps.data.length
        })

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...commonProps} data={numericBarData}>
              {responsiveFeatures.showGrid && customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <XAxis
                  dataKey={safeDataKey[0]}
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  angle={smartAxisScaling.rotation}
                  textAnchor={smartAxisScaling.rotation < 0 ? 'end' : 'middle'}
                  height={smartAxisScaling.bottomMargin}
                  interval={0}
                  tickFormatter={(value) => {
                    const str = String(value)
                    // More aggressive truncation for rotated labels to prevent overlap
                    if (smartAxisScaling.rotation !== 0) {
                      return str.length > 20 ? str.substring(0, 17) + '...' : str
                    }
                    return str.length > 25 ? str.substring(0, 22) + '...' : str
                  }}
                  label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.x ? {
                    value: enhancedAxisLabels.x,
                    position: 'insideBottom',
                    offset: -10,
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId={dualAxisConfig ? "left" : undefined}
                  orientation="left"
                  domain={[0, maxYValue > 0 ? maxYValue * 1.1 : 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.leftMargin}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && (dualAxisConfig?.leftLabel || enhancedAxisLabels.y) ? {
                    value: dualAxisConfig?.leftLabel || enhancedAxisLabels.y,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {dualAxisConfig && responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.rightMargin + 20}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && dualAxisConfig.rightLabel ? {
                    value: dualAxisConfig.rightLabel,
                    angle: 90,
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value, name) => {
                  if (enhancedAxisLabels.xTruncated || enhancedAxisLabels.yTruncated) {
                    const originalName = name === enhancedAxisLabels.x ? enhancedAxisLabels.xOriginal :
                                       name === enhancedAxisLabels.y ? enhancedAxisLabels.yOriginal : name
                    return [value, originalName]
                  }
                  return [value, name]
                }}
              />
              {responsiveFeatures.showLegend && safeDataKey.length > 1 && (
                <Legend
                  content={renderCollapsibleLegend({
                    maxVisibleItems: 5,
                    wrapperStyle: { fontSize: '11px', paddingTop: '12px', paddingBottom: '5px' },
                    formatter: (value) => {
                      const result = truncateLabel(String(value), 100)
                      return result.text
                    }
                  })}
                  verticalAlign="bottom"
                  height={36}
                />
              )}
              {safeDataKey.slice(1).map((key, index) => {
                // Determine which Y-axis this bar should use
                const yAxisId = dualAxisConfig
                  ? (dualAxisConfig.leftMetrics.includes(key) ? "left" : "right")
                  : undefined

                // Enable stacked bars when customization.stacked is true
                const stackId = customization?.stacked ? "stack1" : undefined

                return (
                  <Bar
                    key={key}
                    yAxisId={yAxisId}
                    stackId={stackId}
                    dataKey={key}
                    fill={colors[index % colors.length]}
                    radius={responsiveFeatures.showGrid ? [2, 2, 0, 0] : [1, 1, 0, 0]}
                    animationDuration={customization?.animate !== false ? 1500 : 0}
                  />
                )
              })}
            </BarChart>
          </ResponsiveContainer>
        )
      }

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy={responsiveFeatures.showLegend ? "42%" : "50%"}
                outerRadius={responsiveFeatures.showLegend ? "55%" : "70%"}
                fill="#8884d8"
                dataKey="value"
                label={responsiveFeatures.showSecondaryLabels && customization?.showLegend !== false ?
                  ({ name, percent }) => {
                    if (!responsiveFeatures.showGrid) {
                      return `${(percent * 100).toFixed(0)}%`
                    }
                    const truncated = truncateLabel(name, 50)
                    return `${truncated.text} ${(percent * 100).toFixed(0)}%`
                  } : false}
                animationDuration={customization?.animate !== false ? 1500 : 0}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const total = pieData.reduce((sum, item) => sum + item.value, 0)
                  const percent = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : '0'
                  return [`${value} (${percent}%)`, name]
                }}
              />
              {responsiveFeatures.showLegend && (
                <Legend
                  content={renderCollapsibleLegend({
                    maxVisibleItems: 5,
                    wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '10px' },
                    formatter: (value) => {
                      const result = truncateLabel(String(value), 80)
                      return result.text
                    }
                  })}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...commonProps}>
              {responsiveFeatures.showGrid && customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <XAxis
                  dataKey={safeDataKey[0]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  angle={smartAxisScaling.rotation}
                  textAnchor={smartAxisScaling.rotation < 0 ? 'end' : 'middle'}
                  height={smartAxisScaling.bottomMargin}
                  interval={smartAxisScaling.xAxisInterval}
                  tickFormatter={(value) => {
                    const str = String(value)
                    return str.length > 25 ? str.substring(0, 22) + '...' : str
                  }}
                  label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.x ? {
                    value: enhancedAxisLabels.x,
                    position: 'insideBottom',
                    offset: -10,
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId={dualAxisConfig ? "left" : undefined}
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.leftMargin}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && (dualAxisConfig?.leftLabel || enhancedAxisLabels.y) ? {
                    value: dualAxisConfig?.leftLabel || enhancedAxisLabels.y,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {dualAxisConfig && responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.rightMargin + 20}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && dualAxisConfig.rightLabel ? {
                    value: dualAxisConfig.rightLabel,
                    angle: 90,
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value, name) => {
                  if (enhancedAxisLabels.xTruncated || enhancedAxisLabels.yTruncated) {
                    const originalName = name === enhancedAxisLabels.x ? enhancedAxisLabels.xOriginal :
                                       name === enhancedAxisLabels.y ? enhancedAxisLabels.yOriginal : name
                    return [value, originalName]
                  }
                  return [value, name]
                }}
              />
              {responsiveFeatures.showLegend && safeDataKey.length > 1 && (
                <Legend
                  content={renderCollapsibleLegend({
                    maxVisibleItems: 5,
                    wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '5px' },
                    formatter: (value) => {
                      const result = truncateLabel(String(value), 100)
                      return result.text
                    }
                  })}
                />
              )}
              {safeDataKey.slice(1).map((key, index) => {
                // Determine which Y-axis this area should use
                const yAxisId = dualAxisConfig
                  ? (dualAxisConfig.leftMetrics.includes(key) ? "left" : "right")
                  : undefined

                // Enable stacked areas when customization.stacked is true
                const stackId = customization?.stacked ? "stack1" : undefined

                return (
                  <Area
                    key={key}
                    yAxisId={yAxisId}
                    stackId={stackId}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    fill={colors[index % colors.length]}
                    fillOpacity={responsiveFeatures.showGrid ? 0.3 : 0.5}
                    strokeWidth={responsiveFeatures.showGrid ? 2 : 3}
                    animationDuration={customization?.animate !== false ? 1500 : 0}
                  />
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'scatter': {
        // Extract size and color dimensions from dataMapping
        // Use configDataMapping (from original chart config) as fallback if customization doesn't have it
        const effectiveDataMapping = customization?.dataMapping || configDataMapping
        const sizeKey = effectiveDataMapping?.size
        const colorKey = effectiveDataMapping?.color

        // Use pre-computed scatter data from component-level hook
        const numericScatterData = scatterData.numericData
        const scatterGroups = scatterData.groups

        // Helper to parse currency and formatted numbers (for bubble size calculation)
        const parseNumericValue = (val: any): number => {
          if (typeof val === 'number') return val
          if (typeof val !== 'string') return 0
          const cleaned = val.replace(/[€$£¥,\s%]/g, '')
          const num = parseFloat(cleaned)
          return isNaN(num) ? 0 : num
        }

        // Helper function to calculate bubble size based on size dimension
        let bubbleSizeLogCount = 0
        const calculateBubbleSize = (entry: DataRow, allData: DataRow[]): number => {
          if (!sizeKey) {
            return 60 // Default size when no size dimension
          }

          const value = parseNumericValue(entry[sizeKey])
          if (isNaN(value) || value === 0) {
            if (bubbleSizeLogCount < 3) {
              console.log('⚠️ [SCATTER DEBUG] Invalid size value:', value, 'for sizeKey:', sizeKey)
              bubbleSizeLogCount++
            }
            return 60
          }

          // Get min and max values for normalization
          const sizeValues = allData
            .map(row => parseNumericValue(row[sizeKey]))
            .filter(v => !isNaN(v) && v > 0)

          if (sizeValues.length === 0) return 60

          const minSize = Math.min(...sizeValues)
          const maxSize = Math.max(...sizeValues)
          const range = maxSize - minSize

          // Normalize to 30-200 pixel range
          if (range === 0) return 115 // Middle size if all values are the same
          const normalized = (value - minSize) / range
          const calculatedSize = 30 + normalized * 170

          // Log first few calculations for debugging
          if (bubbleSizeLogCount < 3) {
            console.log('🔍 [SCATTER DEBUG] Bubble size calculation:', {
              sizeKey,
              rawValue: entry[sizeKey],
              parsedValue: value,
              minSize,
              maxSize,
              range,
              normalized,
              calculatedSize
            })
            bubbleSizeLogCount++
          }

          return calculatedSize
        }

        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart {...commonProps}>
              {responsiveFeatures.showGrid && customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <XAxis
                  type="number"
                  dataKey={safeDataKey[0]}
                  name={enhancedAxisLabels.x || safeDataKey[0]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.9),
                    (dataMax: number) => Math.ceil(dataMax * 1.1)
                  ]}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value).length > 25 ? String(value).substring(0, 22) + '...' : String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.x ? {
                    value: enhancedAxisLabels.x,
                    position: 'insideBottom',
                    offset: -10,
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  type="number"
                  dataKey={safeDataKey[1]}
                  name={enhancedAxisLabels.y || safeDataKey[1]}
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.leftMargin}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.9),
                    (dataMax: number) => Math.ceil(dataMax * 1.1)
                  ]}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.y ? {
                    value: enhancedAxisLabels.y,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}
              {sizeKey && (
                <ZAxis
                  type="number"
                  dataKey={sizeKey}
                  range={[60, 400]}
                  name={sizeKey}
                />
              )}
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                content={(props) => {
                  if (!props.active || !props.payload || props.payload.length === 0) return null

                  const payload = props.payload[0].payload

                  return (
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px'
                    }}>
                      <div style={{ marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                        {props.payload[0].name || 'Data Point'}
                      </div>
                      {safeDataKey[0] && (
                        <div style={{ marginBottom: '4px', color: '#64748b' }}>
                          <span style={{ fontWeight: '500' }}>{enhancedAxisLabels.x || safeDataKey[0]}:</span>{' '}
                          <span style={{ color: '#111827' }}>{payload[safeDataKey[0]]}</span>
                        </div>
                      )}
                      {safeDataKey[1] && (
                        <div style={{ marginBottom: '4px', color: '#64748b' }}>
                          <span style={{ fontWeight: '500' }}>{enhancedAxisLabels.y || safeDataKey[1]}:</span>{' '}
                          <span style={{ color: '#111827' }}>{payload[safeDataKey[1]]}</span>
                        </div>
                      )}
                      {sizeKey && payload[sizeKey] !== undefined && (
                        <div style={{ marginBottom: '4px', color: '#64748b' }}>
                          <span style={{ fontWeight: '500' }}>{sizeKey}:</span>{' '}
                          <span style={{ color: '#111827' }}>{payload[sizeKey]}</span>
                        </div>
                      )}
                      {colorKey && payload[colorKey] !== undefined && (
                        <div style={{ color: '#64748b' }}>
                          <span style={{ fontWeight: '500' }}>{colorKey}:</span>{' '}
                          <span style={{ color: '#111827' }}>{payload[colorKey]}</span>
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              {responsiveFeatures.showLegend && colorKey && scatterGroups.length > 1 && (
                <Legend
                  content={renderCollapsibleLegend({
                    maxVisibleItems: 5,
                    wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '5px' },
                    formatter: (value) => {
                      const result = truncateLabel(String(value), 100)
                      return result.text
                    }
                  })}
                />
              )}
              {scatterGroups.map((group, idx) => {
                // console.log(`🔍 [SCATTER DEBUG] Rendering group ${idx}:`, group.name, 'with', group.data.length, 'points, color:', group.color)
                return (
                  <Scatter
                    key={group.name}
                    name={group.name}
                    data={group.data}
                    fill={group.color}
                    fillOpacity={0.6}
                    animationDuration={customization?.animate !== false ? 1500 : 0}
                  />
                )
              })}
            </ScatterChart>
          </ResponsiveContainer>
        )
      }

      case 'table':
        return (
          <React.Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-gray-400">Loading table...</div>
            </div>
          }>
            <TableChartLazy data={chartData} dataKey={safeDataKey} />
          </React.Suspense>
        )

      case 'combo': {
        // Extract dataMapping configuration with fallback to configDataMapping (from original chart config)
        const effectiveDataMapping = customization?.dataMapping || configDataMapping

        // DEBUG: Uncomment to debug combo chart rendering
        // console.log('🔄 [COMBO DEBUG] ===== COMBO CHART RENDERING =====')
        // console.log('🔄 [COMBO DEBUG] Chart ID:', id)
        // console.log('🔄 [COMBO DEBUG] Chart title:', title)

        // Extract yAxis configurations from effective data mapping
        // Left Y-axis (yAxis or yAxis1)
        const yAxis1Metrics = effectiveDataMapping?.yAxis
          ? (Array.isArray(effectiveDataMapping.yAxis) ? effectiveDataMapping.yAxis : [effectiveDataMapping.yAxis])
          : (effectiveDataMapping?.yAxis1
            ? (Array.isArray(effectiveDataMapping.yAxis1) ? effectiveDataMapping.yAxis1 : [effectiveDataMapping.yAxis1])
            : safeDataKey.slice(1, 2))

        // Right Y-axis (yAxis2)
        const yAxis2Metrics = effectiveDataMapping?.yAxis2
          ? (Array.isArray(effectiveDataMapping.yAxis2) ? effectiveDataMapping.yAxis2 : [effectiveDataMapping.yAxis2])
          : safeDataKey.length > 2 ? safeDataKey.slice(2, 3) : []

        // Chart types for each axis (bar, line, or area)
        const yAxis1Type = effectiveDataMapping?.yAxis1Type || 'bar'
        const yAxis2Type = effectiveDataMapping?.yAxis2Type || 'line'

        // Axis labels with intelligent defaults
        const yAxis1Label = effectiveDataMapping?.yAxis1Label || yAxis1Metrics.join(', ')
        const yAxis2Label = effectiveDataMapping?.yAxis2Label || (yAxis2Metrics.length > 0 ? yAxis2Metrics.join(', ') : '')

        // Use pre-computed combo data from component-level hook
        const numericComboData = comboData

        // Determine color palette with distinct, visually appealing colors
        // Use blue shades for left axis (bars/volume) and distinct colors for right axis (lines)
        const getMetricColor = (metricIndex: number, isRightAxis: boolean): string => {
          if (isRightAxis) {
            // Right axis - use distinct colors for maximum differentiation
            const rightAxisColors = [
              '#10b981', // Green for first metric
              '#f97316', // Orange for second metric
              '#a855f7', // Purple for third metric
              '#ec4899'  // Pink for fourth metric
            ]
            return rightAxisColors[metricIndex % rightAxisColors.length]
          } else {
            // Left axis - use blue shades for volume metrics
            const leftAxisColors = ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af']
            return leftAxisColors[metricIndex % leftAxisColors.length]
          }
        }

        // Calculate adjusted right margin for dual-axis layout
        const adjustedRightMargin = yAxis2Metrics.length > 0
          ? Math.max(smartAxisScaling.rightMargin + 30, 60)
          : smartAxisScaling.rightMargin

        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={numericComboData}
              margin={{
                top: smartAxisScaling.topMargin,
                right: adjustedRightMargin,
                left: smartAxisScaling.leftMargin,
                bottom: smartAxisScaling.bottomMargin
              }}
            >
              {/* Grid */}
              {responsiveFeatures.showGrid && customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}

              {/* X-Axis */}
              {responsiveFeatures.showPrimaryLabels && (
                <XAxis
                  dataKey={safeDataKey[0]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  angle={smartAxisScaling.rotation}
                  textAnchor={smartAxisScaling.rotation < 0 ? 'end' : 'middle'}
                  height={smartAxisScaling.bottomMargin}
                  interval={smartAxisScaling.xAxisInterval}
                  tickFormatter={(value) => {
                    const str = String(value)
                    return str.length > 25 ? str.substring(0, 22) + '...' : str
                  }}
                  label={responsiveFeatures.showSecondaryLabels && enhancedAxisLabels.x ? {
                    value: enhancedAxisLabels.x,
                    position: 'insideBottom',
                    offset: -10,
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                  } : undefined}
                />
              )}

              {/* Left Y-Axis */}
              {responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={smartAxisScaling.leftMargin}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && yAxis1Label ? {
                    value: yAxis1Label,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#2563eb' }
                  } : undefined}
                />
              )}

              {/* Right Y-Axis - only render if we have right axis metrics */}
              {yAxis2Metrics.length > 0 && responsiveFeatures.showPrimaryLabels && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  width={adjustedRightMargin}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      return value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toLocaleString()
                    }
                    return String(value)
                  }}
                  label={responsiveFeatures.showSecondaryLabels && yAxis2Label ? {
                    value: yAxis2Label,
                    angle: 90,
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#10b981' }
                  } : undefined}
                />
              )}

              {/* Enhanced Tooltip - shows all metrics with proper formatting */}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                content={(props) => {
                  if (!props.active || !props.payload || props.payload.length === 0) return null

                  const dataPoint = props.payload[0].payload

                  return (
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      {/* Category label */}
                      <div style={{ marginBottom: '8px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px' }}>
                        {String(dataPoint[safeDataKey[0]] || '')}
                      </div>

                      {/* Left axis metrics */}
                      {yAxis1Metrics.length > 0 && (
                        <div style={{ marginBottom: yAxis2Metrics.length > 0 ? '8px' : '0' }}>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: '#2563eb', marginBottom: '4px', textTransform: 'uppercase' }}>
                            {yAxis1Label} (Left)
                          </div>
                          {yAxis1Metrics.map((metric, idx) => (
                            <div key={metric} style={{ marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '2px',
                                backgroundColor: getMetricColor(idx, false)
                              }} />
                              <span style={{ fontWeight: '500', color: '#64748b', flex: 1 }}>{metric}:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>
                                {dataPoint[metric] !== undefined ? Number(dataPoint[metric]).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Right axis metrics */}
                      {yAxis2Metrics.length > 0 && (
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: '#10b981', marginBottom: '4px', textTransform: 'uppercase' }}>
                            {yAxis2Label} (Right)
                          </div>
                          {yAxis2Metrics.map((metric, idx) => (
                            <div key={metric} style={{ marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: getMetricColor(idx, true)
                              }} />
                              <span style={{ fontWeight: '500', color: '#64748b', flex: 1 }}>{metric}:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>
                                {dataPoint[metric] !== undefined ? Number(dataPoint[metric]).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }}
              />

              {/* Legend with axis indicators */}
              {responsiveFeatures.showLegend && (yAxis1Metrics.length > 0 || yAxis2Metrics.length > 0) && (
                <Legend
                  content={renderCollapsibleLegend({
                    maxVisibleItems: 5,
                    wrapperStyle: { fontSize: '11px', paddingTop: '30px', paddingBottom: '5px' },
                    iconType: (value: any) => {
                      const isRightAxis = yAxis2Metrics.includes(value)
                      const chartType = isRightAxis ? yAxis2Type : yAxis1Type
                      // Use line icon for line charts, rect for bars/areas
                      return chartType === 'line' ? 'line' : 'rect'
                    },
                    formatter: (value, entry: any) => {
                      // Determine if this metric is on left or right axis
                      const isRightAxis = yAxis2Metrics.includes(value)
                      const axisLabel = isRightAxis ? ' (Right)' : ' (Left)'

                      // Truncate if needed
                      const result = truncateLabel(String(value) + axisLabel, 100)
                      return result.text
                    }
                  })}
                />
              )}

              {/* Render Left Y-Axis (yAxis1) metrics */}
              {yAxis1Metrics.map((metric, idx) => {
                const color = getMetricColor(idx, false)
                const stackId = customization?.stacked ? "stack1" : undefined

                // console.log(`🔄 [COMBO DEBUG] Rendering left axis metric: ${metric} (${yAxis1Type}) with color ${color}`)

                // Render based on chart type
                if (yAxis1Type === 'bar') {
                  return (
                    <Bar
                      key={metric}
                      yAxisId="left"
                      stackId={stackId}
                      dataKey={metric}
                      fill={color}
                      fillOpacity={0.6}
                      radius={[4, 4, 0, 0]}
                      animationDuration={customization?.animate !== false ? 1500 : 0}
                    />
                  )
                } else if (yAxis1Type === 'area') {
                  return (
                    <Area
                      key={metric}
                      yAxisId="left"
                      stackId={stackId}
                      type="monotone"
                      dataKey={metric}
                      stroke={color}
                      fill={color}
                      fillOpacity={responsiveFeatures.showGrid ? 0.3 : 0.5}
                      strokeWidth={responsiveFeatures.showGrid ? 2 : 3}
                      animationDuration={customization?.animate !== false ? 1500 : 0}
                    />
                  )
                } else {
                  // Default to line
                  return (
                    <Line
                      key={metric}
                      yAxisId="left"
                      type="monotoneX"
                      dataKey={metric}
                      stroke={color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={customization?.animate !== false ? 1500 : 0}
                    />
                  )
                }
              })}

              {/* Render Right Y-Axis (yAxis2) metrics - only if they exist */}
              {yAxis2Metrics.length > 0 && yAxis2Metrics.map((metric, idx) => {
                const color = getMetricColor(idx, true)
                const stackId = customization?.stacked ? "stack2" : undefined

                // console.log(`🔄 [COMBO DEBUG] Rendering right axis metric: ${metric} (${yAxis2Type}) with color ${color}`)

                // Render based on chart type
                if (yAxis2Type === 'bar') {
                  return (
                    <Bar
                      key={metric}
                      yAxisId="right"
                      stackId={stackId}
                      dataKey={metric}
                      fill={color}
                      fillOpacity={0.6}
                      radius={[4, 4, 0, 0]}
                      animationDuration={customization?.animate !== false ? 1500 : 0}
                    />
                  )
                } else if (yAxis2Type === 'area') {
                  return (
                    <Area
                      key={metric}
                      yAxisId="right"
                      stackId={stackId}
                      type="monotone"
                      dataKey={metric}
                      stroke={color}
                      fill={color}
                      fillOpacity={responsiveFeatures.showGrid ? 0.3 : 0.5}
                      strokeWidth={responsiveFeatures.showGrid ? 2 : 3}
                      animationDuration={customization?.animate !== false ? 1500 : 0}
                    />
                  )
                } else {
                  // Default to line
                  return (
                    <Line
                      key={metric}
                      yAxisId="right"
                      type="monotoneX"
                      dataKey={metric}
                      stroke={color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={customization?.animate !== false ? 1500 : 0}
                    />
                  )
                }
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )
      }

      case 'waterfall': {
        const effectiveDataMapping = customization?.dataMapping || configDataMapping

        return (
          <React.Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-gray-400">Loading waterfall chart...</div>
            </div>
          }>
            <WaterfallChart
              data={chartData}
              dataMapping={{
                category: effectiveDataMapping?.category || safeDataKey[0] || 'category',
                value: effectiveDataMapping?.value || safeDataKey[1] || 'value',
                type: effectiveDataMapping?.type
              }}
              customization={{
                showLegend: customization?.showLegend,
                showGrid: customization?.showGrid,
                showLabels: customization?.showLabels,
                showConnectors: customization?.showConnectors,
                increaseColor: '#10b981',
                decreaseColor: '#ef4444',
                totalColor: '#3b82f6'
              }}
            />
          </React.Suspense>
        )
      }

      default:
        return <div className="flex items-center justify-center h-64 text-gray-400">Unsupported chart type</div>
    }
  }

  // For scorecards, render with minimal wrapper - scorecard handles its own styling
  if (type === 'scorecard') {
    // Handle invisible charts without early return (to comply with React hooks rules)
    if (!isVisible) {
      return null
    }
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={(node) => {
              chartRef.current = node
              chartContainerRef.current = node
            }}
            data-chart-id={id}
            data-chart-type={type}
            className={cn(
              "group relative h-full w-full transition-all duration-200 cursor-pointer select-none",
              isSelected && "ring-2 ring-blue-500 ring-opacity-50 rounded-lg",
              isDragging && "opacity-50 rotate-2 scale-105",
              className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
          >
            {/* Controls overlay - shown on hover */}
            {(isHovered || isSelected) && (
              <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                <ChartCustomizationPanel
                  chartId={id}
                  title={title}
                  description={description}
                  chartType={type}
                  customization={customization}
                  onCustomizationChange={updateChartCustomization}
                  initialTab={initialTab}
                  configDataMapping={configDataMapping}
                  autoOpen={(isSelected && initialTab === 'data') || isDraftChart}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="More options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicate()
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Duplicate</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        exportChart(id, 'png')
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export as PNG</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete()
                      }}
                      className="flex items-center space-x-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Scorecard fills the entire container */}
            {renderChart()}
          </div>
        </ContextMenuTrigger>

        {/* Context Menu */}
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowEditTitle(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Title
          </ContextMenuItem>
          <ContextMenuItem onClick={() => exportChart(id, 'png')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </ContextMenuItem>
          <ContextMenuSeparator />
          {chartTemplates.map((template) => (
            <ContextMenuItem
              key={template.id}
              onClick={() => handleChangeType(template.type)}
              disabled={template.type === type}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Change to {template.name}
            </ContextMenuItem>
          ))}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleToggleVisibility}>
            {isVisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {isVisible ? 'Hide' : 'Show'}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDelete} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  // For all other chart types, render with full header/chrome
  // Handle invisible charts without early return (to comply with React hooks rules)
  if (!isVisible) {
    return null
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={(node) => {
            chartRef.current = node
            chartContainerRef.current = node
          }}
          data-chart-id={id}
          data-chart-type={type}
          className={cn(
            "group relative bg-white rounded-xl border-2 transition-all duration-200 cursor-pointer select-none h-full flex flex-col",
            isSelected
              ? "border-blue-500 shadow-lg ring-2 ring-blue-500 ring-opacity-20"
              : "border-gray-200/60 hover:border-gray-300/80 hover:shadow-sm",
            isDragging && "opacity-50 rotate-2 scale-105",
            className
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200/60">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {showEditTitle ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editableTitle}
                      onChange={(e) => setEditableTitle(e.target.value)}
                      className="text-lg font-semibold text-gray-900 leading-tight bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
                      onBlur={handleTitleEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleEdit()
                        if (e.key === 'Escape') {
                          setEditableTitle(title)
                          setShowEditTitle(false)
                        }
                      }}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editableDescription}
                      onChange={(e) => setEditableDescription(e.target.value)}
                      className="text-sm text-gray-600 leading-relaxed bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
                      placeholder="Description"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                        {customization?.customTitle || title}
                        {type === 'bar' && customization?.dataMapping?.sortBy && customization?.dataMapping?.limit && (
                          <span className="ml-2 text-sm font-normal text-blue-600">
                            ({customization.dataMapping.sortOrder === 'desc' ? 'Top' : 'Bottom'} {customization.dataMapping.limit})
                          </span>
                        )}
                      </h3>
                      {qualityScore !== undefined && qualityScore > 0 && (
                        <QualityBadge score={qualityScore} />
                      )}
                    </div>
                    {type !== 'scorecard' && (customization?.customDescription || description) && (
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        {customization?.customDescription || description}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Controls - shown on hover or selection */}
              <div className={cn(
                "flex items-center space-x-1 transition-opacity duration-200",
                (isHovered || isSelected) ? "opacity-100" : "opacity-0"
              )}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEditTitle(true)
                  }}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="Edit title"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleVisibility()
                  }}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title={isVisible ? "Hide chart" : "Show chart"}
                >
                  {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>

                <ChartCustomizationPanel
                  chartId={id}
                  title={title}
                  description={description}
                  chartType={type}
                  customization={customization}
                  onCustomizationChange={updateChartCustomization}
                  initialTab={initialTab}
                  configDataMapping={configDataMapping}
                  autoOpen={(isSelected && initialTab === 'data') || isDraftChart}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFullScreen(id)
                  }}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="View fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="More options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicate()
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Duplicate</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        exportChart(id, 'png')
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export as PNG</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete()
                      }}
                      className="flex items-center space-x-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Chart Content */}
          <div className="px-6 py-6 flex-1 min-h-0">
            <div className="h-full w-full" style={{ minHeight: 360 }}>
              {renderChart()}
            </div>
          </div>

          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-2 ring-blue-500 ring-opacity-50" />
          )}
        </div>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setShowEditTitle(true)}>
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Title
        </ContextMenuItem>
        <ContextMenuItem onClick={() => exportChart(id, 'png')}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </ContextMenuItem>
        <ContextMenuSeparator />
        {chartTemplates.map((template) => (
          <ContextMenuItem
            key={template.id}
            onClick={() => handleChangeType(template.type)}
            disabled={template.type === type}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Change to {template.name}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleToggleVisibility}>
          {isVisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          {isVisible ? 'Hide' : 'Show'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDelete} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}, (prevProps, nextProps) => {
  // PERFORMANCE OPTIMIZATION: Skip re-render during drag operations
  // Only re-render if meaningful props change (not isDragging, isSelected)

  // Deep comparison for arrays and objects
  const deepEqual = (a: any, b: any): boolean => {
    if (a === b) return true
    if (a == null || b == null) return false
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((item, index) => deepEqual(item, b[index]))
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      if (keysA.length !== keysB.length) return false
      return keysA.every(key => deepEqual(a[key], b[key]))
    }
    return false
  }

  const isEqual = (
    prevProps.id === nextProps.id &&
    prevProps.type === nextProps.type &&
    prevProps.title === nextProps.title &&
    prevProps.description === nextProps.description &&
    deepEqual(prevProps.data, nextProps.data) &&
    deepEqual(prevProps.dataKey, nextProps.dataKey) &&
    deepEqual(prevProps.configDataMapping, nextProps.configDataMapping) &&
    prevProps.qualityScore === nextProps.qualityScore &&
    prevProps.className === nextProps.className
    // Intentionally ignore: isDragging, isSelected - these change during drag but don't affect chart content
  )

  // Diagnostic logging (comment out after debugging)
  if (!isEqual) {
    console.log(`🔍 [MEMO DEBUG] Chart ${prevProps.id} (${prevProps.type}) re-rendering due to prop changes:`, {
      id: prevProps.id !== nextProps.id,
      type: prevProps.type !== nextProps.type,
      title: prevProps.title !== nextProps.title,
      description: prevProps.description !== nextProps.description,
      data: !deepEqual(prevProps.data, nextProps.data),
      dataKey: !deepEqual(prevProps.dataKey, nextProps.dataKey),
      configDataMapping: !deepEqual(prevProps.configDataMapping, nextProps.configDataMapping),
      qualityScore: prevProps.qualityScore !== nextProps.qualityScore,
      className: prevProps.className !== nextProps.className
    })
  }

  return isEqual
})