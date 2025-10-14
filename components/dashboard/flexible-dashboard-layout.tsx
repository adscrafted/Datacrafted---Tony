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

  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [newlyAddedChartId, setNewlyAddedChartId] = useState<string | null>(null) // Track newly added chart by ID
  const [isLayoutMode, setIsLayoutMode] = useState(false)
  const [saveLayoutName, setSaveLayoutName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [layoutKey, setLayoutKey] = useState(0) // Force re-render key

  // Refs
  const layoutChangeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

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
    // IMPORTANT: If store returns empty but we have data prop, use data prop
    // This handles the case where store isn't initialized yet
    if (result.length === 0 && data.length > 0) {
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
  // CRITICAL FIX: Removed chartCustomizations from dependencies to prevent infinite loop
  // When API returns 403, savedConfig is null and the else block modifies chartCustomizations
  // which would trigger this useEffect again, causing infinite retries
  useEffect(() => {
    if (currentProjectId) {
      loadDashboardConfig(currentProjectId).then(savedConfig => {
        if (savedConfig) {
          Object.entries(savedConfig.chartCustomizations).forEach(([chartId, customization]) => {
            updateChartCustomization(chartId, customization)
          })
        }
        // REMOVED: else block that was modifying chartCustomizations on null config
        // This was causing infinite loop when API returned errors
      }).catch(error => {
        console.error('Failed to load dashboard config:', error)
        // Error is logged but doesn't trigger retry - dashboard will use default positions
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId])

  // Filter out invalid charts before rendering
  const validCharts = useMemo(() => {
    // CRITICAL FIX: If data is empty but we have charts, don't filter them out
    // The charts will display "No data" states individually rather than hiding the entire dashboard
    if (!data || data.length === 0) {
      return analysis.chartConfig || []
    }

    return filterValidCharts(analysis.chartConfig, data)
  }, [analysis.chartConfig, data])

  // Sort charts by quality score (highest first), keeping scorecards separate
  // CRITICAL: Filter out draft chart from rendering - it should NOT appear on dashboard yet
  const sortedCharts = useMemo(() => {
    // CRITICAL: Filter out the draft chart - it shouldn't be visible on the dashboard yet
    // Also filter out unconfigured scorecards (missing metric or formula)
    const chartsToDisplay = validCharts.filter(chart => {
      const chartId = chart.id || `chart-${analysis.chartConfig.indexOf(chart)}`
      const isDraft = draftChart?.id === chartId
      if (isDraft) {
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
          return false
        }
      }

      // ADDITIONAL VALIDATION: Check for type/dataMapping mismatches
      // If chart type was changed via customization, ensure dataMapping matches the new type
      if (customizationChartType && customizationChartType !== chart.type) {
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
          return false
        }
      }

      return true
    })

    // Separate scorecards from other charts
    // CRITICAL FIX: Use EFFECTIVE chart type (considering customization overrides)
    const scorecards: typeof chartsToDisplay = []
    const otherCharts: typeof chartsToDisplay = []

    chartsToDisplay.forEach(chart => {
      const chartId = chart.id || `chart-${analysis.chartConfig.indexOf(chart)}`
      const customization = chartCustomizations[chartId]
      const effectiveType = customization?.chartType || chart.type

      if (effectiveType === 'scorecard') {
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

    // Return scorecards first, then sorted other charts
    return [...scorecards, ...sortedOthers]
  }, [validCharts, draftChart, analysis.chartConfig, chartCustomizations])

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
  const getFixedDimensions = useCallback((config: any, chartId?: string) => {
    // CRITICAL FIX: Use effective chart type (considering customization overrides)
    const customization = chartId ? chartCustomizations[chartId] : undefined
    const effectiveType = customization?.chartType || config.type

    switch (effectiveType) {
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
  }, [chartCustomizations])

  // Calculate default positions for all charts
  // This is the SINGLE SOURCE OF TRUTH for chart positions
  const calculateDefaultPositions = useCallback((charts: typeof sortedCharts) => {
    const positions: Record<string, { x: number, y: number, w: number, h: number }> = {}
    const scorecards: Array<{ config: any, chartId: string }> = []
    const otherCharts: Array<{ config: any, chartId: string }> = []

    // Separate scorecards from other charts
    // CRITICAL FIX: Use EFFECTIVE chart type (considering customization overrides)
    charts.forEach(config => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`

      // Get effective chart type (customization can override original type)
      const customization = chartCustomizations[chartId]
      const effectiveType = customization?.chartType || config.type

      if (effectiveType === 'scorecard') {
        scorecards.push({ config, chartId })
      } else {
        otherCharts.push({ config, chartId })
      }
    })

    let currentX = 0
    let currentY = 0
    const SCORECARD_WIDTH = 2
    const SCORECARD_HEIGHT = 1
    const GRID_COLS = 12

    // Position scorecards in 2-column grid at top
    let maxScorecardY = 0 // Track the bottom-most scorecard Y position
    scorecards.forEach(({ config, chartId }) => {
      if (currentX + SCORECARD_WIDTH > GRID_COLS) {
        currentX = 0
        currentY += SCORECARD_HEIGHT
      }

      positions[chartId] = {
        x: currentX,
        y: currentY,
        w: SCORECARD_WIDTH,
        h: SCORECARD_HEIGHT
      }

      // Track the maximum Y value (bottom-most position)
      maxScorecardY = Math.max(maxScorecardY, currentY)

      currentX += SCORECARD_WIDTH
    })

    // CRITICAL FIX: Start other charts AFTER the last scorecard row
    // If we have scorecards, start at maxScorecardY + 1 (the row after the last scorecard)
    // If we have no scorecards, start at 0
    currentX = 0
    currentY = scorecards.length > 0 ? maxScorecardY + SCORECARD_HEIGHT : 0

    otherCharts.forEach(({ config, chartId }) => {
      const dims = getFixedDimensions(config, chartId)

      // If current chart doesn't fit in the current row, move to next row
      if (currentX + dims.w > GRID_COLS) {
        currentX = 0
        currentY += dims.h
      }

      positions[chartId] = {
        x: currentX,
        y: currentY,
        w: dims.w,
        h: dims.h
      }

      currentX += dims.w
    })

    return positions
  }, [analysis.chartConfig, getFixedDimensions, chartCustomizations])

  // Reset layout to default positions
  const performLayoutReset = useCallback(() => {
    // CRITICAL FIX: Filter out invisible charts before calculating positions
    // This prevents gaps where hidden charts would be positioned
    const visibleCharts = sortedCharts.filter(config => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]
      return customization?.isVisible !== false
    })

    // Calculate default positions for only visible charts
    const defaultPositions = calculateDefaultPositions(visibleCharts)

    // CRITICAL FIX: Build batch updates that include REMOVING positions from invisible charts
    // This prevents React Grid Layout from reserving space for them
    const batchUpdates: Record<string, { position?: { x: number, y: number, w: number, h: number } }> = {}

    // Set positions for visible charts
    Object.entries(defaultPositions).forEach(([chartId, position]) => {
      batchUpdates[chartId] = { position }
    })

    // CRITICAL: REMOVE positions from invisible charts to eliminate ghost spots
    sortedCharts.forEach(config => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]
      const isVisible = customization?.isVisible !== false

      // If chart is invisible and not in the visible positions, clear its position
      if (!isVisible && !defaultPositions[chartId]) {
        batchUpdates[chartId] = { position: undefined }
      }
    })

    batchUpdateChartCustomizations(batchUpdates)

    // Force layout refresh
    setLayoutKey(prev => prev + 1)
  }, [sortedCharts, calculateDefaultPositions, batchUpdateChartCustomizations, analysis.chartConfig, chartCustomizations])

  // Initialize positions on first load - SIMPLE AND CLEAN
  const hasInitialized = useRef(false)
  useEffect(() => {
    // Only run once per mount
    if (hasInitialized.current) return

    // Wait for charts to be available
    if (!sortedCharts || sortedCharts.length === 0) return

    // Check if any visible charts are missing positions
    const needsLayout = sortedCharts.some(config => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]
      const isVisible = customization?.isVisible !== false
      return isVisible && !customization?.position
    })

    if (needsLayout) {
      hasInitialized.current = true
      // Use same logic as Reset Layout button - no delays, no complexity
      performLayoutReset()
    }
  }, [sortedCharts, chartCustomizations, performLayoutReset, analysis.chartConfig])


  // Generate layout items from chart positions
  // This is PURELY a transformation - no logic, just converts store data to RGL format
  const layoutItems = useMemo(() => {
    const items: Array<{
      i: string
      x: number
      y: number
      w: number
      h: number
      minW: number
      minH: number
      maxW: number
      maxH: number
      isResizable: boolean
      static: boolean
    }> = []

    sortedCharts.forEach((config) => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]

      // Skip invisible charts unless in layout mode
      const isVisible = customization?.isVisible !== false
      if (!isVisible && !isLayoutMode) {
        return
      }

      // CRITICAL FIX: Only create layout items for charts with positions
      // This prevents React Grid Layout from trying to position charts with undefined positions
      // which could cause layout issues and ghost spots
      if (!customization?.position) {
        return
      }

      const position = customization.position

      // CRITICAL FIX: Use EFFECTIVE type (considering customization overrides)
      // This fixes the sizing issue where scorecards were sized as regular charts
      const effectiveType = customization?.chartType || config.type
      const isScorecard = effectiveType === 'scorecard'
      const isTable = effectiveType === 'table'

      items.push({
        i: chartId,
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        minW: isScorecard ? 2 : isTable ? 8 : 4,
        minH: isScorecard ? 1 : 2,
        maxW: isScorecard ? 2 : isTable ? 12 : 12,
        maxH: isScorecard ? 1 : 10,
        isResizable: !isScorecard,
        static: false
      })
    })

    return items
  }, [sortedCharts, chartCustomizations, analysis.chartConfig, isLayoutMode])

  // Force layout refresh when chart count changes
  useEffect(() => {
    // Force a layout key update to trigger re-render when charts are added/removed
    setLayoutKey(prev => prev + 1)
  }, [sortedCharts.length])

  // REMOVED: The auto-save effect that was causing race conditions
  // Position updates now happen ONLY in two places:
  // 1. performLayoutReset() - called on initial load and manual reset
  // 2. handleLayoutChange() - called when user drags/resizes charts
  // This eliminates the race condition between multiple effects trying to update positions

  // Layout validation - ensure bounds are respected
  const validateLayout = useCallback((layout: GridLayout[]) => {
    return layout.map(item => ({
      ...item,
      x: Math.max(0, Math.min(item.x, 12 - item.w)),
      y: Math.max(0, item.y)
    }))
  }, [])

  // PERFORMANCE OPTIMIZATION: Throttled layout change handler to prevent excessive re-renders
  const handleLayoutChange = useCallback((layout: GridLayout[]) => {
    // Validate and fix any overlaps
    const validatedLayout = validateLayout(layout)

    // OPTIMIZATION: Throttle position updates during drag/resize
    if (layoutChangeTimerRef.current) {
      clearTimeout(layoutChangeTimerRef.current)
    }

    layoutChangeTimerRef.current = setTimeout(() => {
      // PERFORMANCE FIX: Batch all position updates into a SINGLE store update
      const updates: Record<string, { position?: {x: number, y: number, w: number, h: number} }> = {}

      // Update positions for items in the layout
      validatedLayout.forEach(item => {
        updates[item.i] = {
          position: { x: item.x, y: item.y, w: item.w, h: item.h }
        }
      })

      // CRITICAL FIX: Clear positions for charts that are not in the layout
      // This prevents ghost spots from invisible/filtered charts
      const layoutItemIds = new Set(validatedLayout.map(item => item.i))
      sortedCharts.forEach(config => {
        const originalIndex = analysis.chartConfig.indexOf(config)
        const chartId = config.id || `chart-${originalIndex}`
        const customization = chartCustomizations[chartId]
        const isVisible = customization?.isVisible !== false

        // If chart is not visible and not in layout, ensure position is cleared
        if (!isVisible && !layoutItemIds.has(chartId) && customization?.position) {
          updates[chartId] = { position: undefined }
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
  }, [batchUpdateChartCustomizations, autoSaveLayouts, showSaveDialog, validateLayout, currentProjectId, chartCustomizations, currentLayout, dashboardFilters, currentTheme, saveDashboardConfig, sortedCharts, analysis.chartConfig])

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
            onClick={performLayoutReset}
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
        {sortedCharts.length === 0 ? (
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
            key={layoutKey}
            className="layout"
            layouts={{
              lg: layoutItems,
              md: layoutItems,
              sm: layoutItems,
              xs: layoutItems,
              xxs: layoutItems
            }}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={200}
            onLayoutChange={handleLayoutChange}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            isDraggable={true}
            isResizable={true}
            compactType="vertical"
            preventCollision={false}
            allowOverlap={false}
            useCSSTransforms={true}
            margin={[24, 24]}
            containerPadding={[16, 16]}
            autoSize={true}
            isDroppable={false}
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

              if (!isVisible && !isLayoutMode) {
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
        )}
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
          // CRITICAL: Set selection FIRST, then trigger customization
          // This ensures the chart is selected when autoOpen evaluates
          setSelectedChartId(chartId)
          setNewlyAddedChartId(chartId)

          // Delay customization trigger slightly to ensure state is updated
          // This allows React to process the selection state before opening panel
          setTimeout(() => {
            setIsCustomizing(true)
          }, 50)
        }}
      />

      {/* Standalone Chart Customization Panel for Draft Charts */}
      {/* CRITICAL FIX: Draft charts are filtered out from rendering, so we need a standalone panel */}
      {draftChart && (
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
      )}
    </div>
  )
}