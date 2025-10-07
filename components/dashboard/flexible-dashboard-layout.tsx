'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Responsive, WidthProvider, Layout as GridLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Plus, Grid3x3, Layout, Save, Download, Upload, RotateCcw, Eye, EyeOff, Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EnhancedChartWrapper } from './enhanced-chart-wrapper'
import { ChartTemplateGallery } from './chart-template-gallery'
import { ChartCustomizationPanel } from './chart-customization-panel'
import { DateRangeSelector } from './date-range-selector'
import { useDataStore, AnalysisResult, DataRow } from '@/lib/store'
import { useProjectStore } from '@/lib/stores/project-store'
import { filterValidCharts } from '@/lib/utils/chart-validator'
import { cn } from '@/lib/utils/cn'
import { AverageQualityIndicator } from './quality-indicator'
import type { ChartRecommendation, EnhancedAnalysisResult } from '@/lib/types/recommendation'
import { isEnhancedAnalysisResult } from '@/lib/types/recommendation'
import { format } from 'date-fns'

// Make responsive grid layout
const ResponsiveGridLayout = WidthProvider(Responsive)

interface FlexibleDashboardLayoutProps {
  analysis: AnalysisResult | EnhancedAnalysisResult
  data: DataRow[]
  className?: string
}

export const FlexibleDashboardLayout: React.FC<FlexibleDashboardLayoutProps> = ({
  analysis,
  data,
  className
}) => {
  console.log('🏗️ [FLEXIBLE_DASHBOARD] Component rendering with:', {
    analysisChartConfigLength: analysis.chartConfig?.length || 0,
    dataLength: data.length,
    chartTitles: analysis.chartConfig?.map(c => c.title)
  })

  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [newlyAddedChartId, setNewlyAddedChartId] = useState<string | null>(null) // Track newly added chart by ID
  const [layouts, setLayouts] = useState<{ [key: string]: GridLayout[] }>({})
  const [isLayoutMode, setIsLayoutMode] = useState(false)
  const [saveLayoutName, setSaveLayoutName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [layoutKey, setLayoutKey] = useState(0) // Force re-render key

  const {
    chartCustomizations,
    currentLayout,
    availableLayouts,
    isCustomizing,
    setIsCustomizing,
    updateChartCustomization,
    batchUpdateChartCustomizations,
    showChartTemplateGallery,
    setShowChartTemplateGallery,
    gridSnapping,
    showGridLines,
    setGridSnapping,
    setShowGridLines,
    autoSaveLayouts,
    setAutoSaveLayouts,
    saveLayout,
    loadLayout,
    resetToDefaultLayout,
    exportLayoutConfig,
    importLayoutConfig,
    setAvailableColumns,
    isDragging,
    setIsDragging,
    currentTheme,
    dashboardFilters,
    draftChart,
    dateRange,
    granularity,
    setDateRange,
    selectedDateColumn,
    getFilteredData
  } = useDataStore()

  const { currentProjectId, saveDashboardConfig, loadDashboardConfig } = useProjectStore()

  // Wrap filtered data in useMemo with proper dependencies
  const filteredData = useMemo(() => {
    const result = getFilteredData()
    console.log('🔄 [FlexibleDashboardLayout] Recomputing filtered data:', {
      dateRangeFrom: dateRange?.from?.toISOString() || 'none',
      dateRangeTo: dateRange?.to?.toISOString() || 'none',
      granularity,
      selectedDateColumn,
      filteredDataLength: result.length,
      rawDataLength: data.length
    })
    // IMPORTANT: If store returns empty but we have data prop, use data prop
    // This handles the case where store isn't initialized yet
    if (result.length === 0 && data.length > 0) {
      console.log('⚠️ [FlexibleDashboardLayout] Store returned empty, using data prop instead')
      return data
    }
    return result
  }, [getFilteredData, dateRange, granularity, selectedDateColumn, data.length, data])

  // Update available columns when data changes
  useEffect(() => {
    if (data.length > 0) {
      const columns = Object.keys(data[0])
      setAvailableColumns(columns)
    }
  }, [data, setAvailableColumns])

  // Load saved dashboard config when project changes
  useEffect(() => {
    if (currentProjectId) {
      const savedConfig = loadDashboardConfig(currentProjectId)
      if (savedConfig) {
        Object.entries(savedConfig.chartCustomizations).forEach(([chartId, customization]) => {
          updateChartCustomization(chartId, customization)
        })
      } else {
        Object.keys(chartCustomizations).forEach(chartId => {
          updateChartCustomization(chartId, { position: undefined })
        })
      }
    }
  }, [currentProjectId, loadDashboardConfig, updateChartCustomization])

  // Auto-reset layout on initial load if charts don't have positions
  const hasRunInitialLayout = useRef(false)
  const lastAnalysisId = useRef<string | null>(null)

  useEffect(() => {
    // Reset the flag when analysis changes (new data upload)
    const currentAnalysisId = analysis?.chartConfig?.map(c => c.id || c.title).join(',') || ''
    if (currentAnalysisId !== lastAnalysisId.current) {
      hasRunInitialLayout.current = false
      lastAnalysisId.current = currentAnalysisId
    }

    // Only run once per analysis load
    if (hasRunInitialLayout.current) return
    if (!analysis?.chartConfig || analysis.chartConfig.length === 0) return

    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      // Check if any charts are missing positions
      const chartsNeedPositions = analysis.chartConfig.some(config => {
        const chartId = config.id || `chart-${analysis.chartConfig.indexOf(config)}`
        const customization = chartCustomizations[chartId]
        return !customization?.position
      })

      console.log('🔄 [AUTO_LAYOUT] Checking if layout reset needed:', {
        chartsNeedPositions,
        totalCharts: analysis.chartConfig.length,
        customizationsCount: Object.keys(chartCustomizations).length
      })

      if (chartsNeedPositions) {
        console.log('🔄 [AUTO_LAYOUT] Running initial layout reset for charts without positions')
        hasRunInitialLayout.current = true

      // Helper to get dimensions (inlined to avoid dependency issues)
      const getDimensions = (config: any) => {
        switch (config.type) {
          case 'scorecard':
            return { w: 2, h: 1 }
          case 'table':
            return { w: 12, h: 6 }
          case 'pie':
            return { w: 4, h: 4 }
          case 'bar':
          case 'line':
          case 'area':
          case 'scatter':
          case 'combo':
          case 'waterfall':
          case 'funnel':
            return { w: 6, h: 4 }
          default:
            return { w: 6, h: 4 }
        }
      }

      // Run the same logic as the Reset Layout button
      const scorecards: Array<{ config: any, chartId: string }> = []
      const otherCharts: Array<{ config: any, chartId: string }> = []

      analysis.chartConfig.forEach(config => {
        const originalIndex = analysis.chartConfig.indexOf(config)
        const chartId = config.id || `chart-${originalIndex}`

        if (config.type === 'scorecard') {
          scorecards.push({ config, chartId })
        } else {
          otherCharts.push({ config, chartId })
        }
      })

      let currentX = 0
      let currentY = 0
      const SCORECARD_WIDTH = 2
      const GRID_COLS = 12

      // Place scorecards at top
      scorecards.forEach(({ config, chartId }) => {
        if (currentX + SCORECARD_WIDTH > GRID_COLS) {
          currentX = 0
          currentY += 1
        }

        updateChartCustomization(chartId, {
          position: {
            x: currentX,
            y: currentY,
            w: SCORECARD_WIDTH,
            h: 1
          }
        })

        currentX += SCORECARD_WIDTH
      })

      // Place other charts with 2-per-row layout
      currentX = 0
      currentY = scorecards.length > 0 ? Math.ceil(scorecards.length * SCORECARD_WIDTH / GRID_COLS) : 0

      otherCharts.forEach(({ config, chartId }) => {
        const dims = getDimensions(config)

        if (currentX + dims.w > GRID_COLS) {
          currentX = 0
          currentY += dims.h
        }

        updateChartCustomization(chartId, {
          position: {
            x: currentX,
            y: currentY,
            w: dims.w,
            h: dims.h
          }
        })

        currentX += dims.w
      })

        setLayoutKey(prev => prev + 1)
      }
    }, 100) // Small delay to ensure everything is ready

    return () => clearTimeout(timer)
  }, [analysis?.chartConfig, chartCustomizations, updateChartCustomization])

  // Filter out invalid charts before rendering
  const validCharts = useMemo(() => {
    console.log('🔍 [FLEXIBLE_DASHBOARD] Filtering charts:', {
      totalCharts: analysis.chartConfig?.length || 0,
      dataRows: data.length,
      chartTypes: analysis.chartConfig?.map(c => c.type).join(', ')
    })

    // CRITICAL FIX: If data is empty but we have charts, don't filter them out
    // The charts will display "No data" states individually rather than hiding the entire dashboard
    if (!data || data.length === 0) {
      console.warn('⚠️ [FLEXIBLE_DASHBOARD] Data is empty - showing all charts with empty state')
      return analysis.chartConfig || []
    }

    const filtered = filterValidCharts(analysis.chartConfig, data)

    console.log('🔍 [FLEXIBLE_DASHBOARD] Charts after filtering:', {
      validCharts: filtered.length,
      filteredOut: (analysis.chartConfig?.length || 0) - filtered.length,
      filteredOutTitles: (analysis.chartConfig || [])
        .filter(c => !filtered.includes(c))
        .map(c => c.title)
    })

    return filtered
  }, [analysis.chartConfig, data])

  // Sort charts by quality score (highest first), keeping scorecards separate
  // CRITICAL: Filter out draft chart from rendering - it should NOT appear on dashboard yet
  const sortedCharts = useMemo(() => {
    console.log('📊 [FLEXIBLE_DASHBOARD] Sorting charts by quality score', {
      validChartsCount: validCharts.length,
      validChartTitles: validCharts.map(c => c.title),
      draftChartId: draftChart?.id
    })

    // CRITICAL: Filter out the draft chart - it shouldn't be visible on the dashboard yet
    // Also filter out unconfigured scorecards (missing metric or formula)
    const chartsToDisplay = validCharts.filter(chart => {
      const chartId = chart.id || `chart-${analysis.chartConfig.indexOf(chart)}`
      const isDraft = draftChart?.id === chartId
      if (isDraft) {
        console.log('🚫 [FLEXIBLE_DASHBOARD] Filtering out draft chart:', chart.title)
        return false
      }

      // DEFENSIVE: Filter out unconfigured scorecards
      // CRITICAL FIX: Must check EFFECTIVE chart type (considering customization override)
      // The chart might be configured as 'scorecard' in analysis.chartConfig
      // but have customization.chartType = 'area', which changes how it renders
      const configDM = (chart as any).dataMapping
      const customizationDM = chartCustomizations[chartId]?.dataMapping
      const customizationChartType = chartCustomizations[chartId]?.chartType

      // Determine the EFFECTIVE chart type (same logic as EnhancedChartWrapper line 234)
      const effectiveChartType = customizationChartType || chart.type

      // Merge both sources (same logic as EnhancedChartWrapper's effectiveMapping)
      const effectiveDM = {
        ...configDM,
        ...customizationDM
      }

      // Only apply scorecard filter if the EFFECTIVE type is scorecard
      // This prevents filtering out charts that were changed to other types
      if (effectiveChartType === 'scorecard') {
        const isConfigured = effectiveDM && (effectiveDM.metric || effectiveDM.formula)

        if (!isConfigured) {
          console.log('🚫 [FLEXIBLE_DASHBOARD] Filtering out unconfigured scorecard:', chart.title)
          return false
        }
      }

      // ADDITIONAL VALIDATION: Check for type/dataMapping mismatches
      // If chart type was changed via customization, ensure dataMapping matches the new type
      if (customizationChartType && customizationChartType !== chart.type) {
        console.log('⚠️ [FLEXIBLE_DASHBOARD] Chart type override detected:', chart.title, {
          originalType: chart.type,
          customizedType: customizationChartType,
          hasDataMapping: !!effectiveDM && Object.keys(effectiveDM).length > 0
        })

        // Validate that the chart has appropriate dataMapping for its new type
        const hasValidMapping = (() => {
          if (!effectiveDM || Object.keys(effectiveDM).length === 0) return false

          switch (customizationChartType) {
            case 'line':
            case 'bar':
              return !!(effectiveDM.xAxis || effectiveDM.category)
            case 'area':
              return !!(effectiveDM.xAxis || effectiveDM.category) &&
                     !!(effectiveDM.yAxis || effectiveDM.yAxis1 || effectiveDM.values)
            case 'scatter':
              return !!(effectiveDM.xAxis || effectiveDM.category) &&
                     !!(effectiveDM.yAxis || effectiveDM.yAxis1 || effectiveDM.values)
            case 'pie':
              return !!effectiveDM.category
            case 'scorecard':
              return !!(effectiveDM.metric || effectiveDM.formula)
            case 'table':
              return !!(effectiveDM.columns && effectiveDM.columns.length > 0) || !!effectiveDM.yAxis
            default:
              return true // Unknown types pass through
          }
        })()

        if (!hasValidMapping) {
          console.log('🚫 [FLEXIBLE_DASHBOARD] Filtering out chart with invalid type/dataMapping mismatch:', chart.title, {
            effectiveChartType: customizationChartType,
            effectiveDataMapping: effectiveDM
          })
          return false
        }
      }

      return true
    })

    console.log('📊 [FLEXIBLE_DASHBOARD] Charts after draft filter:', {
      beforeFilter: validCharts.length,
      afterFilter: chartsToDisplay.length,
      filteredOutDraft: validCharts.length > chartsToDisplay.length
    })

    // Separate scorecards from other charts
    const scorecards: typeof chartsToDisplay = []
    const otherCharts: typeof chartsToDisplay = []

    chartsToDisplay.forEach(chart => {
      if (chart.type === 'scorecard') {
        scorecards.push(chart)
      } else {
        otherCharts.push(chart)
      }
    })

    // Sort other charts by quality score (highest first)
    const sortedOthers = otherCharts.sort((a, b) => {
      const scoreA = a.qualityScore ?? 0
      const scoreB = b.qualityScore ?? 0
      return scoreB - scoreA // Descending order
    })

    const result = [...scorecards, ...sortedOthers]

    console.log('📊 [FLEXIBLE_DASHBOARD] Sorted chart order:', {
      scorecards: scorecards.length,
      otherCharts: sortedOthers.length,
      totalSorted: result.length,
      sortedTitles: result.map(c => c.title),
      otherCharts: sortedOthers.map(c => ({
        title: c.title,
        type: c.type,
        quality: c.qualityScore ?? 'N/A'
      }))
    })

    // Return scorecards first, then sorted other charts
    return result
  }, [validCharts, draftChart, analysis.chartConfig])

  // Extract quality scores from enhanced analysis if available
  const qualityScores = useMemo(() => {
    const scores: Record<string, number> = {}

    if (isEnhancedAnalysisResult(analysis)) {
      // Analysis is in enhanced format with recommendations
      analysis.recommendations.forEach((rec: ChartRecommendation) => {
        if (rec.qualityScore !== undefined) {
          scores[rec.id] = rec.qualityScore
        }
      })
    }

    return scores
  }, [analysis])

  // Calculate average quality for display
  const qualityScoreValues = useMemo(() => {
    return Object.values(qualityScores).filter(score => score > 0)
  }, [qualityScores])

  // Enhanced default dimensions for each chart type with proper 320x400px minimum sizing
  // Row height is 200px, so h: 2 = 400px, h: 3 = 600px, h: 4 = 800px
  const getFixedDimensions = useCallback((config: any) => {
    switch (config.type) {
      case 'scorecard':
        // Scorecards: compact size - 2 columns wide, 1 row tall
        return { w: 2, h: 1 }

      case 'table':
        // Tables need full width and more height: 960x1200px
        return { w: 12, h: 6 }

      case 'pie':
        // Pie charts: 400x800px (increased from h: 3 to h: 4 for better spacing)
        return { w: 4, h: 4 }

      case 'bar':
      case 'line':
      case 'area':
      case 'scatter':
        // Standard charts: 480x800px - optimized for 2-per-row layout (6 columns × 2 = 12 total)
        return { w: 6, h: 4 }

      default:
        // Default minimum professional chart size: 480x800px (increased from h: 3 to h: 4)
        return { w: 6, h: 4 }
    }
  }, [])

  /**
   * OPTIMIZED 2-PER-ROW PLACEMENT ALGORITHM
   *
   * Finds optimal initial position for new charts with 2-per-row priority:
   * 1. For 6-column charts: tries x=0 and x=6 positions first (2 per row)
   * 2. For other widths: scans left-to-right, top-to-bottom
   * 3. Uses precise rectangle collision detection for existing items
   * 4. React Grid Layout's vertical compaction will optimize spacing after placement
   */
  const findAvailablePosition = useCallback((width: number, height: number, existingItems: Array<{x: number, y: number, w: number, h: number}>) => {
    const maxWidth = Math.min(width, 12)

    // OPTIMIZATION: For 6-column charts (standard charts), prioritize 2-per-row layout
    // by checking x=0 and x=6 positions first at each Y level
    if (maxWidth === 6) {
      for (let y = 0; y < 100; y++) {
        for (const x of [0, 6]) { // Try left position first, then right position
          const candidate = { x, y, w: maxWidth, h: height }

          const hasOverlap = existingItems.some(item => {
            return !(
              candidate.x >= item.x + item.w ||
              candidate.x + candidate.w <= item.x ||
              candidate.y >= item.y + item.h ||
              candidate.y + candidate.h <= item.y
            )
          })

          if (!hasOverlap) {
            return { x, y }
          }
        }
      }
    } else {
      // For other widths (scorecards, pie charts, tables), use standard scanning
      for (let y = 0; y < 100; y++) {
        for (let x = 0; x <= 12 - maxWidth; x++) {
          const candidate = { x, y, w: maxWidth, h: height }

          const hasOverlap = existingItems.some(item => {
            return !(
              candidate.x >= item.x + item.w ||
              candidate.x + candidate.w <= item.x ||
              candidate.y >= item.y + item.h ||
              candidate.y + candidate.h <= item.y
            )
          })

          if (!hasOverlap) {
            return { x, y }
          }
        }
      }
    }

    const maxY = Math.max(0, ...existingItems.map(item => item.y + item.h))
    return { x: 0, y: maxY }
  }, [])

  /**
   * OPTIMIZED CHART POSITIONING SYSTEM
   *
   * This system provides initial placement for charts, then relies on React Grid Layout's
   * vertical compaction to minimize white space. Benefits:
   * - Smart initial placement prevents initial overlaps
   * - Vertical compaction automatically fills gaps when charts are added/removed/resized
   * - Simpler code that leverages built-in RGL optimization
   */

  // Global position tracker - ONLY maintains positions for VISIBLE charts (sortedCharts)
  // This prevents gaps from filtered-out charts
  const globalPlacedItems = useMemo(() => {
    const allPositions: Array<{x: number, y: number, w: number, h: number, chartId: string}> = []

    // Create a Set of visible chart IDs for fast lookup
    const visibleChartIds = new Set(
      sortedCharts.map(config => {
        const originalIndex = analysis.chartConfig.indexOf(config)
        return config.id || `chart-${originalIndex}`
      })
    )

    // Only add positions for charts that are actually visible
    Object.entries(chartCustomizations).forEach(([chartId, customization]) => {
      if (customization.position && visibleChartIds.has(chartId)) {
        allPositions.push({
          x: customization.position.x,
          y: customization.position.y,
          w: customization.position.w,
          h: customization.position.h,
          chartId
        })
      }
    })

    return allPositions
  }, [chartCustomizations, sortedCharts, analysis.chartConfig])

  // Generate layout items with bulletproof placement and gap elimination
  const layoutItems = useMemo(() => {
    const items: Array<{i: string, x: number, y: number, w: number, h: number, minW: number, minH: number, maxW: number, maxH: number, isResizable?: boolean, static?: boolean}> = []

    // Create working copy of placed items for collision detection
    const workingPlacedItems: Array<{x: number, y: number, w: number, h: number}> =
      globalPlacedItems.map(item => ({ x: item.x, y: item.y, w: item.w, h: item.h }))

    console.log('🔍 [LAYOUT_ITEMS] Starting layout generation:', {
      sortedChartsCount: sortedCharts.length,
      globalPlacedItemsCount: globalPlacedItems.length,
      workingPlacedItemsCount: workingPlacedItems.length
    })

    // Separate scorecards and other charts for gap detection
    const scorecardItems: Array<{chartId: string, config: any, customization: any}> = []
    const otherItems: Array<{chartId: string, config: any, customization: any}> = []

    sortedCharts.forEach((config) => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]

      // Skip invisible charts
      const isVisible = customization?.isVisible !== false
      if (!isVisible && !isLayoutMode) {
        console.log(`🚫 [LAYOUT] Skipping invisible chart from layout: "${config.title}"`)
        return
      }

      if (config.type === 'scorecard') {
        scorecardItems.push({ chartId, config, customization })
      } else {
        otherItems.push({ chartId, config, customization })
      }
    })

    // CRITICAL FIX: Detect and fix gaps in scorecard positions
    // Check if scorecards have saved positions with gaps
    let hasGaps = false
    if (scorecardItems.length > 0) {
      const scorecardPositions = scorecardItems
        .map((item, idx) => ({
          index: idx,
          chartId: item.chartId,
          title: item.config.title,
          position: item.customization?.position
        }))
        .filter(item => item.position !== undefined)
        .sort((a, b) => {
          if (a.position.y !== b.position.y) return a.position.y - b.position.y
          return a.position.x - b.position.x
        })

      if (scorecardPositions.length === scorecardItems.length && scorecardPositions.length > 0) {
        // Check for gaps in scorecard row
        let expectedX = 0
        let currentY = scorecardPositions[0]?.position?.y ?? 0

        for (const item of scorecardPositions) {
          const pos = item.position

          // If we moved to a new row, reset expectedX
          if (pos.y !== currentY) {
            currentY = pos.y
            expectedX = 0
          }

          // If there's a gap (position doesn't match expected)
          if (pos.x !== expectedX) {
            hasGaps = true
            console.log('⚠️ [LAYOUT_ITEMS] Gap detected in scorecard positions:', {
              title: item.title,
              expected: expectedX,
              actual: pos.x,
              gap: pos.x - expectedX,
              y: pos.y
            })
            break
          }

          expectedX += 2 // Scorecards are 2 columns wide
          if (expectedX >= 12) {
            expectedX = 0
            currentY += 1
          }
        }
      } else if (scorecardPositions.length !== scorecardItems.length) {
        // Some scorecards don't have positions - this will be handled by the normal flow
        console.log('ℹ️ [LAYOUT_ITEMS] Some scorecards missing positions:', {
          totalScorecards: scorecardItems.length,
          withPositions: scorecardPositions.length
        })
      }
    }

    // If gaps detected, reposition ALL scorecards tightly
    if (hasGaps) {
      console.log('🔧 [LAYOUT_ITEMS] Fixing scorecard gaps - repositioning all scorecards')
      let currentX = 0
      let currentY = 0

      scorecardItems.forEach(({ chartId, config, customization }) => {
        if (currentX + 2 > 12) {
          currentX = 0
          currentY += 1
        }

        const position = {
          x: currentX,
          y: currentY,
          w: 2,
          h: 1
        }

        console.log(`📍 [LAYOUT_ITEMS] Fixed scorecard position for "${config.title}": (${position.x}, ${position.y})`)

        items.push({
          i: chartId,
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h,
          minW: 2,
          minH: 1,
          maxW: 2,
          maxH: 1,
          isResizable: false,
          static: false
        })

        workingPlacedItems.push({
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h
        })

        currentX += 2
      })

      // Update positions in store (will be done in next effect)
      // For now, just update the layout items
    } else {
      // No gaps - use existing positions
      scorecardItems.forEach(({ chartId, config, customization }) => {
        const isScorecard = config.type === 'scorecard'
        const defaultDimensions = getFixedDimensions(config)

        let position
        if (customization?.position) {
          position = customization.position

          // FORCE UPDATE: If this is a scorecard with old dimensions (3x2), update to new dimensions (2x1)
          if (isScorecard && (position.w !== 2 || position.h !== 1)) {
            console.log(`🔧 [LAYOUT] Auto-correcting scorecard "${config.title}" from ${position.w}×${position.h} to 2×1`)
            position = {
              ...position,
              w: 2,
              h: 1
            }
          }

          console.log(`📍 [LAYOUT_ITEMS] Using saved position for "${config.title}":`, {
            chartId,
            type: config.type,
            position: `(${position.x}, ${position.y}) ${position.w}×${position.h}`
          })
        } else {
          const availablePos = findAvailablePosition(defaultDimensions.w, defaultDimensions.h, workingPlacedItems)
          position = {
            x: availablePos.x,
            y: availablePos.y,
            w: defaultDimensions.w,
            h: defaultDimensions.h
          }

          console.log(`📍 [LAYOUT_ITEMS] Calculated new position for "${config.title}":`, {
            chartId,
            type: config.type,
            position: `(${position.x}, ${position.y}) ${position.w}×${position.h}`,
            workingPlacedItemsCount: workingPlacedItems.length
          })

          workingPlacedItems.push({
            x: position.x,
            y: position.y,
            w: position.w,
            h: position.h
          })
        }

        items.push({
          i: chartId,
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h,
          minW: isScorecard ? 2 : config.type === 'table' ? 8 : 4,
          minH: isScorecard ? 1 : 2,
          maxW: isScorecard ? 2 : config.type === 'table' ? 12 : 12,
          maxH: isScorecard ? 1 : 10,
          isResizable: !isScorecard,
          static: false
        })
      })
    }

    // Process other charts
    otherItems.forEach(({ chartId, config, customization }) => {
      const defaultDimensions = getFixedDimensions(config)

      let position
      if (customization?.position) {
        position = customization.position

        console.log(`📍 [LAYOUT_ITEMS] Using saved position for "${config.title}":`, {
          chartId,
          type: config.type,
          position: `(${position.x}, ${position.y}) ${position.w}×${position.h}`
        })
      } else {
        const availablePos = findAvailablePosition(defaultDimensions.w, defaultDimensions.h, workingPlacedItems)
        position = {
          x: availablePos.x,
          y: availablePos.y,
          w: defaultDimensions.w,
          h: defaultDimensions.h
        }

        console.log(`📍 [LAYOUT_ITEMS] Calculated new position for "${config.title}":`, {
          chartId,
          type: config.type,
          position: `(${position.x}, ${position.y}) ${position.w}×${position.h}`,
          workingPlacedItemsCount: workingPlacedItems.length
        })

        workingPlacedItems.push({
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h
        })
      }

      items.push({
        i: chartId,
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        minW: config.type === 'table' ? 8 : 4,
        minH: 2,
        maxW: config.type === 'table' ? 12 : 12,
        maxH: 10,
        isResizable: true,
        static: false
      })
    })

    console.log('🔍 [LAYOUT_ITEMS] Final layout items:', items.map(item => ({
      id: item.i,
      position: `(${item.x}, ${item.y}) ${item.w}×${item.h}`
    })))

    return items
  }, [sortedCharts, chartCustomizations, getFixedDimensions, analysis.chartConfig, findAvailablePosition, globalPlacedItems, isLayoutMode])

  // Force layout refresh when chart count changes
  useEffect(() => {
    // Force a layout key update to trigger re-render when charts are added/removed
    setLayoutKey(prev => prev + 1)

    // Clear layouts to force recalculation
    setLayouts({})
  }, [sortedCharts.length])

  // Save calculated positions immediately for charts without positions OR when positions were auto-fixed
  useEffect(() => {
    let hasUpdates = false
    const updates: Array<{chartId: string, position: {x: number, y: number, w: number, h: number}}> = []

    sortedCharts.forEach((config, index) => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]
      const layoutItem = layoutItems.find(item => item.i === chartId)

      if (!layoutItem) return

      const newPosition = {
        x: layoutItem.x,
        y: layoutItem.y,
        w: layoutItem.w,
        h: layoutItem.h
      }

      // Save position if:
      // 1. It doesn't exist yet (newly calculated)
      // 2. OR it has changed (auto-fixed for gaps)
      if (!customization?.position) {
        updates.push({ chartId, position: newPosition })
        hasUpdates = true
      } else {
        const existingPos = customization.position
        if (
          existingPos.x !== newPosition.x ||
          existingPos.y !== newPosition.y ||
          existingPos.w !== newPosition.w ||
          existingPos.h !== newPosition.h
        ) {
          console.log(`🔄 [LAYOUT_SAVE] Position changed for "${config.title}":`, {
            old: `(${existingPos.x}, ${existingPos.y}) ${existingPos.w}×${existingPos.h}`,
            new: `(${newPosition.x}, ${newPosition.y}) ${newPosition.w}×${newPosition.h}`
          })
          updates.push({ chartId, position: newPosition })
          hasUpdates = true
        }
      }
    })

    // Batch all position updates to avoid multiple re-renders
    if (hasUpdates) {
      console.log(`💾 [LAYOUT_SAVE] Saving ${updates.length} position updates`)
      updates.forEach(({ chartId, position }) => {
        updateChartCustomization(chartId, { position })
      })
    }
  }, [layoutItems, sortedCharts, analysis.chartConfig, chartCustomizations, updateChartCustomization])

  // Layout validation - ensure bounds are respected
  const validateLayout = useCallback((layout: GridLayout[]) => {
    return layout.map(item => ({
      ...item,
      x: Math.max(0, Math.min(item.x, 12 - item.w)),
      y: Math.max(0, item.y)
    }))
  }, [])

  // PERFORMANCE OPTIMIZATION: Throttled layout change handler to prevent excessive re-renders
  const layoutChangeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleLayoutChange = useCallback((layout: GridLayout[], allLayouts: { [key: string]: GridLayout[] }) => {
    // Validate and fix any overlaps
    const validatedLayout = validateLayout(layout)

    setLayouts(allLayouts)

    // OPTIMIZATION: Throttle position updates during drag/resize
    if (layoutChangeTimerRef.current) {
      clearTimeout(layoutChangeTimerRef.current)
    }

    layoutChangeTimerRef.current = setTimeout(() => {
      // PERFORMANCE FIX: Batch all position updates into a SINGLE store update
      const updates: Record<string, { position: {x: number, y: number, w: number, h: number} }> = {}

      validatedLayout.forEach(item => {
        updates[item.i] = {
          position: { x: item.x, y: item.y, w: item.w, h: item.h }
        }
      })

      // CRITICAL: Use batchUpdate instead of forEach to avoid N re-renders
      batchUpdateChartCustomizations(updates)

      // OPTIMIZATION: Debounced auto-save with cleanup
      if (autoSaveLayouts && currentProjectId && !showSaveDialog) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current)
        }

        autoSaveTimerRef.current = setTimeout(() => {
          const config = {
            chartCustomizations,
            currentLayout,
            filters: dashboardFilters,
            theme: currentTheme
          }
          saveDashboardConfig(currentProjectId, config).catch(console.error)
        }, 2000) // Increased to 2 seconds to reduce save frequency
      }
    }, 150) // 150ms throttle - balance between responsiveness and performance
  }, [batchUpdateChartCustomizations, autoSaveLayouts, showSaveDialog, validateLayout, currentProjectId, chartCustomizations, currentLayout, dashboardFilters, currentTheme, saveDashboardConfig])

  // Auto-clear newly added chart flag after 5 seconds (safety net)
  useEffect(() => {
    if (newlyAddedChartId) {
      const timer = setTimeout(() => {
        setNewlyAddedChartId(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [newlyAddedChartId])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (layoutChangeTimerRef.current) clearTimeout(layoutChangeTimerRef.current)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  // Handle chart selection
  const handleChartSelect = useCallback((chartId: string) => {
    setSelectedChartId(prev => prev === chartId ? null : chartId)
    // Clear the newly added flag only when selecting a different chart AND customization panel is not open
    // This prevents clearing the flag when user clicks settings immediately after adding
    if (newlyAddedChartId && newlyAddedChartId !== chartId && !isCustomizing) {
      setNewlyAddedChartId(null)
    }
  }, [newlyAddedChartId, isCustomizing])

  // Handle drag start/stop
  const handleDragStart = useCallback(() => {
    setIsDragging(true)
  }, [setIsDragging])

  const handleDragStop = useCallback(() => {
    setIsDragging(false)
  }, [setIsDragging])

  // Handle layout save
  const handleSaveLayout = useCallback(() => {
    if (saveLayoutName.trim()) {
      saveLayout(saveLayoutName.trim())
      setSaveLayoutName('')
      setShowSaveDialog(false)
    }
  }, [saveLayoutName, saveLayout])

  // Handle layout import
  const handleLayoutImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      importLayoutConfig(file)
      event.target.value = '' // Reset input
    }
  }, [importLayoutConfig])

  // Breakpoints for responsive design
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
  const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }

  return (
    <div className={cn('relative', className)}>
      {/* Dashboard Toolbar */}
      <div className="flex items-center justify-between mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Dashboard Layout
          </h2>

          {/* Date Range Selector */}
          <DateRangeSelector className="" />

          <div className="flex items-center space-x-2">
            <Switch
              id="layout-mode"
              checked={isLayoutMode}
              onCheckedChange={setIsLayoutMode}
            />
            <Label htmlFor="layout-mode" className="text-sm">
              Layout Mode
            </Label>
          </div>
          {qualityScoreValues.length > 0 && (
            <AverageQualityIndicator scores={qualityScoreValues} />
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Grid Options */}
          <div className="flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-md">
            <Grid3x3 className="h-4 w-4 text-gray-500" />
            <Switch
              id="grid-snap"
              checked={gridSnapping}
              onCheckedChange={setGridSnapping}
              size="sm"
            />
            <Label htmlFor="grid-snap" className="text-xs">
              Snap
            </Label>
            <Switch
              id="grid-lines"
              checked={showGridLines}
              onCheckedChange={setShowGridLines}
              size="sm"
            />
            <Label htmlFor="grid-lines" className="text-xs">
              Grid
            </Label>
          </div>

          {/* Add Chart Button */}
          <Button
            onClick={() => setShowChartTemplateGallery(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Chart
          </Button>

          {/* Reset Layout Button */}
          <Button
            onClick={() => {
              /**
               * OPTIMIZED COMPACT LAYOUT RESET ALGORITHM WITH QUALITY SORTING
               *
               * This algorithm only positions VISIBLE charts (sortedCharts),
               * completely ignoring filtered-out charts to prevent gaps.
               */

              // Use ONLY sortedCharts (which excludes filtered charts)
              const scorecards: Array<{ config: any, chartId: string }> = []
              const otherCharts: Array<{ config: any, chartId: string }> = []

              sortedCharts.forEach(config => {
                const originalIndex = analysis.chartConfig.indexOf(config)
                const chartId = config.id || `chart-${originalIndex}`

                if (config.type === 'scorecard') {
                  scorecards.push({ config, chartId })
                } else {
                  otherCharts.push({ config, chartId })
                }
              })

              let currentX = 0
              let currentY = 0
              const SCORECARD_WIDTH = 2
              const GRID_COLS = 12

              // Place scorecards at top (y=0) in horizontal rows
              scorecards.forEach(({ config, chartId }) => {
                if (currentX + SCORECARD_WIDTH > GRID_COLS) {
                  currentX = 0
                  currentY += 1
                }

                updateChartCustomization(chartId, {
                  position: {
                    x: currentX,
                    y: currentY,
                    w: SCORECARD_WIDTH,
                    h: 1
                  }
                })

                currentX += SCORECARD_WIDTH
              })

              // Reset for other charts - place them with 2-per-row layout
              currentX = 0
              currentY = scorecards.length > 0 ? Math.ceil(scorecards.length * SCORECARD_WIDTH / GRID_COLS) : 0

              otherCharts.forEach(({ config, chartId }) => {
                const dims = getFixedDimensions(config)

                // 2-per-row layout: reset X when full
                if (currentX + dims.w > GRID_COLS) {
                  currentX = 0
                  currentY += dims.h // Move down by chart height
                }

                updateChartCustomization(chartId, {
                  position: {
                    x: currentX,
                    y: currentY,
                    w: dims.w,
                    h: dims.h
                  }
                })

                currentX += dims.w
              })

              // Force re-render
              setLayouts({})
              setLayoutKey(prev => prev + 1)
            }}
            size="sm"
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Layout
          </Button>

          {/* Layout Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Layout className="h-4 w-4 mr-2" />
                Layout
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save Layout
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {availableLayouts.map(layout => (
                <DropdownMenuItem
                  key={layout.id}
                  onClick={() => loadLayout(layout.id)}
                  className={cn(
                    currentLayout.id === layout.id && "bg-blue-50 text-blue-700"
                  )}
                >
                  <Layout className="h-4 w-4 mr-2" />
                  {layout.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetToDefaultLayout}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportLayoutConfig}>
                <Download className="h-4 w-4 mr-2" />
                Export Config
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <label className="flex items-center cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Config
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleLayoutImport}
                    className="hidden"
                  />
                </label>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid Background (when enabled) */}
      {showGridLines && (
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="grid grid-cols-12 h-full">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="border-r border-gray-300" />
            ))}
          </div>
        </div>
      )}

      {/* Active Date Filter Indicator */}
      {dateRange && (dateRange.from || dateRange.to) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              Date Filter Active:
              {dateRange.from && ` ${format(dateRange.from, 'MMM d, yyyy')}`}
              {dateRange.to && dateRange.from !== dateRange.to && ` - ${format(dateRange.to, 'MMM d, yyyy')}`}
            </span>
            <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
              {granularity.charAt(0).toUpperCase() + granularity.slice(1)} view
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDateRange(undefined)}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filter
          </Button>
        </div>
      )}

      {/* Dashboard Content */}
      <div className={cn(
        "dashboard-container draggable-grid-container relative",
        isLayoutMode && "layout-mode"
      )}>
        {(() => {
          // CRITICAL DEBUG: Log actual state at render time
          console.log('🚨 [RENDER_CHECK] Empty state check:', {
            sortedChartsLength: sortedCharts.length,
            validChartsLength: validCharts.length,
            dataLength: data.length,
            analysisChartConfigLength: analysis.chartConfig?.length || 0,
            sortedChartTitles: sortedCharts.map(c => c.title),
            validChartTitles: validCharts.map(c => c.title)
          })

          return sortedCharts.length === 0 ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center space-y-6 max-w-md">
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-3xl flex items-center justify-center">
                  <Layout className="w-10 h-10 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">No charts yet</h3>
                  <p className="text-gray-500 mt-3 text-base leading-relaxed">
                    Add your first chart to get started with your dashboard
                  </p>
                  <Button
                    onClick={() => setShowChartTemplateGallery(true)}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Chart
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ResponsiveGridLayout
            key={layoutKey} // Force re-render when charts are added/removed
            className="layout"
            layouts={Object.keys(layouts).length > 0 ? layouts : { lg: layoutItems }}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={200}
            onLayoutChange={handleLayoutChange}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            isDraggable={true}
            isResizable={true} // Global default, but overridden per-item for scorecards
            compactType="vertical" // OPTIMIZED: Enable vertical compaction to minimize white space
            preventCollision={false} // Allow compaction to move items and fill gaps
            allowOverlap={false} // Never allow overlaps
            useCSSTransforms={true} // PERFORMANCE: Use CSS transforms for smooth animations
            transformScale={1} // PERFORMANCE: Optimize transform calculations
            margin={[24, 24]} // Increased from 16 to 24 for better spacing
            containerPadding={[16, 16]} // Added padding to prevent charts from touching edges
            autoSize={true}
            isDroppable={false} // Disable external dropping to prevent conflicts
            // PERFORMANCE OPTIMIZATIONS:
            measureBeforeMount={false} // Skip initial measurement for faster load
            draggableHandle=".drag-handle" // Limit drag to specific handle (if using customize mode)
          >
            {sortedCharts.map((config, index) => {
              const originalIndex = analysis.chartConfig.indexOf(config)
              const chartId = config.id || `chart-${originalIndex}`
              const isSelected = selectedChartId === chartId
              const customization = chartCustomizations[chartId]
              // CRITICAL FIX: Default to visible=true, not false
              // Previously: isVisible !== false means if customization.isVisible is undefined, it's true
              // But we need to ensure this is working correctly
              const isVisible = customization?.isVisible !== false

              console.log(`🎨 [CHART_RENDER] Chart ${index}:`, {
                chartId,
                title: config.title,
                type: config.type,
                hasCustomization: !!customization,
                customizationIsVisible: customization?.isVisible,
                computedIsVisible: isVisible,
                isLayoutMode,
                willRender: isVisible || isLayoutMode,
                willReturnNull: !isVisible && !isLayoutMode
              })

              if (!isVisible && !isLayoutMode) {
                console.warn(`⚠️ [CHART_RENDER] Skipping chart "${config.title}" - not visible and not in layout mode`)
                return null
              }

              // PERFORMANCE: Memoize props to prevent unnecessary re-renders
              // Stabilize array and object references
              const dataKey = config.dataKey || []
              const configDataMapping = config.dataMapping
              const chartClassName = cn(
                "h-full",
                "cursor-move",
                isLayoutMode && "ring-2 ring-blue-400"
              )
              const chartTitle = config.title || `Chart ${index + 1}`
              const chartDescription = config.description || ''

              return (
                <div
                  key={chartId}
                  className={cn(!isVisible && "opacity-50")}
                  data-chart-type={config.type}
                >
                  <EnhancedChartWrapper
                    id={chartId}
                    type={config.type}
                    title={chartTitle}
                    description={chartDescription}
                    data={filteredData}
                    dataKey={dataKey}
                    configDataMapping={configDataMapping}
                    isDragging={isDragging}
                    isSelected={isSelected}
                    onSelect={handleChartSelect}
                    onEdit={(id) => {
                      setSelectedChartId(id)
                      setIsCustomizing(true)
                    }}
                    qualityScore={qualityScores[chartId]}
                    className={chartClassName}
                    initialTab={newlyAddedChartId === chartId ? 'data' : undefined}
                  />
                </div>
              )
            })}
          </ResponsiveGridLayout>
          )
        })()}
      </div>

      {/* Customization Mode Indicator */}
      {(isLayoutMode || isCustomizing) && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">
              {isLayoutMode ? 'Layout Mode Active' : 'Customizing Dashboard'}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsLayoutMode(false)
                setIsCustomizing(false)
                setSelectedChartId(null)
              }}
              className="ml-2 text-xs"
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Save Layout Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Layout</DialogTitle>
            <DialogDescription>
              Give your layout a name to save it for future use
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="layout-name">Layout Name</Label>
              <Input
                id="layout-name"
                value={saveLayoutName}
                onChange={(e) => setSaveLayoutName(e.target.value)}
                placeholder="e.g., Executive Dashboard"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveLayout} disabled={!saveLayoutName.trim()}>
                Save Layout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chart Template Gallery */}
      <ChartTemplateGallery
        isOpen={showChartTemplateGallery}
        onClose={() => setShowChartTemplateGallery(false)}
        onChartAdded={(chartId) => {
          console.log('🎨 [DASHBOARD] Chart added from gallery:', chartId)

          // CRITICAL: Set selection FIRST, then trigger customization
          // This ensures the chart is selected when autoOpen evaluates
          setSelectedChartId(chartId)
          setNewlyAddedChartId(chartId)

          // Delay customization trigger slightly to ensure state is updated
          // This allows React to process the selection state before opening panel
          setTimeout(() => {
            console.log('🎨 [DASHBOARD] Opening customization panel for new chart')
            setIsCustomizing(true)
          }, 50)
        }}
      />

      {/* Standalone Chart Customization Panel for Draft Charts */}
      {/* CRITICAL FIX: Draft charts are filtered out from rendering, so we need a standalone panel */}
      {draftChart && (() => {
        console.log('🎯 [DASHBOARD] Rendering standalone panel for draft chart:', {
          draftChartId: draftChart.id,
          draftChartType: draftChart.type,
          hasCustomization: !!chartCustomizations[draftChart.id],
          customization: chartCustomizations[draftChart.id]
        })
        return (
          <div className="hidden">
            {/* Hidden div - just hosts the panel which renders via portal */}
            <ChartCustomizationPanel
              chartId={draftChart.id}
              title={draftChart.title}
              description={draftChart.description}
              chartType={draftChart.type as any}
              customization={chartCustomizations[draftChart.id] || {}}
              onCustomizationChange={updateChartCustomization}
              initialTab="data"
              autoOpen={true}
            />
          </div>
        )
      })()}
    </div>
  )
}