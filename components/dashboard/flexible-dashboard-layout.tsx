'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Responsive, WidthProvider, Layout as GridLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Plus, Grid3x3, Layout, Save, Download, Upload, RotateCcw, Eye, EyeOff } from 'lucide-react'
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
import { useDataStore, AnalysisResult, DataRow } from '@/lib/store'
import { useProjectStore } from '@/lib/stores/project-store'
import { filterValidCharts } from '@/lib/utils/chart-validator'
import { cn } from '@/lib/utils/cn'

// Make responsive grid layout
const ResponsiveGridLayout = WidthProvider(Responsive)

interface FlexibleDashboardLayoutProps {
  analysis: AnalysisResult
  data: DataRow[]
  className?: string
}

export const FlexibleDashboardLayout: React.FC<FlexibleDashboardLayoutProps> = ({
  analysis,
  data,
  className
}) => {
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [layouts, setLayouts] = useState<{ [key: string]: GridLayout[] }>({})
  const [isLayoutMode, setIsLayoutMode] = useState(false)
  const [saveLayoutName, setSaveLayoutName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const {
    chartCustomizations,
    currentLayout,
    availableLayouts,
    isCustomizing,
    setIsCustomizing,
    updateChartCustomization,
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
    dashboardFilters
  } = useDataStore()

  const { currentProjectId, saveDashboardConfig, loadDashboardConfig } = useProjectStore()

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
        console.log('📋 Loading saved dashboard config for project:', currentProjectId)
        // Apply saved customizations to the store
        Object.entries(savedConfig.chartCustomizations).forEach(([chartId, customization]) => {
          updateChartCustomization(chartId, customization)
        })
        // Note: theme and layout would be applied through their respective setters if needed
      } else {
        console.log('🔄 No saved config found for project, will use fresh layout')
        // Clear any existing customizations for fresh projects
        Object.keys(chartCustomizations).forEach(chartId => {
          updateChartCustomization(chartId, { position: undefined })
        })
      }
    }
  }, [currentProjectId, loadDashboardConfig, updateChartCustomization])

  // Filter out invalid charts before rendering
  const validCharts = useMemo(() =>
    filterValidCharts(analysis.chartConfig, data),
    [analysis.chartConfig, data]
  )

  // Enhanced default dimensions for each chart type with proper 320x400px minimum sizing
  // Row height is 200px, so h: 2 = 400px, h: 3 = 600px
  const getFixedDimensions = useCallback((config: any) => {
    switch (config.type) {
      case 'scorecard':
        // Scorecards can be smaller: 240x240px (1.2 grid units each)
        return { w: 3, h: 2 }

      case 'table':
        // Tables need full width and more height: 960x600px
        return { w: 12, h: 6 }

      case 'pie':
        // Pie charts: 400x400px (minimum for legend readability)
        return { w: 4, h: 3 }

      case 'bar':
      case 'line':
      case 'area':
        // Standard charts: 480x400px (minimum professional size)
        return { w: 6, h: 3 }

      case 'scatter':
        // Scatter plots need more width for axis labels: 560x400px
        return { w: 7, h: 3 }

      default:
        // Default minimum professional chart size: 480x400px
        return { w: 6, h: 3 }
    }
  }, [])

  // Enhanced collision detection function with debug logging
  const detectCollision = useCallback((newItem: GridLayout, existingItems: GridLayout[]) => {
    if (existingItems.length === 0) {
      return false
    }

    return existingItems.some(item => {
      // Check if the new item overlaps with this existing item
      const hasCollision = !(
        newItem.x >= item.x + item.w || // newItem is to the right of item
        newItem.x + newItem.w <= item.x || // newItem is to the left of item
        newItem.y >= item.y + item.h || // newItem is below item
        newItem.y + newItem.h <= item.y    // newItem is above item
      )

      if (hasCollision) {
        console.warn('🔶 Chart collision detected:', {
          newItem: { id: newItem.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h },
          existingItem: { id: item.i, x: item.x, y: item.y, w: item.w, h: item.h },
          overlap: {
            xOverlap: !(newItem.x >= item.x + item.w || newItem.x + newItem.w <= item.x),
            yOverlap: !(newItem.y >= item.y + item.h || newItem.y + newItem.h <= item.y)
          }
        })
      }

      return hasCollision
    })
  }, [])

  // Function to fix all overlapping layouts - converted to regular function to avoid dependency issues
  // This will be wrapped in useCallback after layoutItems is defined
  const createFixOverlappingLayouts = (currentLayoutItems: GridLayout[]) => {
    return () => {
      const hasOverlaps = currentLayoutItems.some((item, index) => {
        const otherItems = currentLayoutItems.filter((_, i) => i !== index)
        return detectCollision(item, otherItems)
      })

      if (hasOverlaps) {
        console.warn('🚨 Overlapping layouts detected! Fixing automatically...')

        // Clear all chart customizations to force fresh positioning
        validCharts.forEach(config => {
          const originalIndex = analysis.chartConfig.indexOf(config)
          const chartId = config.id || `chart-${originalIndex}`
          updateChartCustomization(chartId, { position: undefined })
        })

        return true
      }

      return false
    }
  }

  // Enhanced smart placement algorithm with better collision avoidance
  const findOptimalPosition = useCallback((dimensions: { w: number; h: number }, existingItems: GridLayout[], chartType?: string) => {
    const { w, h } = dimensions
    console.log('🔍 Finding optimal position for:', { w, h, chartType, existingCount: existingItems.length })
    console.log('🔍 Existing items:', existingItems.map(item => ({ id: item.i, x: item.x, y: item.y, w: item.w, h: item.h })))

    // Strategy 1: For tables, always start on a new row at x=0
    if (chartType === 'table') {
      const maxY = existingItems.reduce((max, item) => Math.max(max, item.y + item.h), 0)
      console.log('📊 Table placement: x=0, y=' + maxY)
      return { x: 0, y: maxY }
    }

    // Strategy 2: Try to place in available spaces, scanning row by row, left to right
    // Start from top-left and scan systematically
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x <= 12 - w; x++) {
        const testItem: GridLayout = {
          i: 'test-position',
          x,
          y,
          w,
          h
        }

        const hasCollision = detectCollision(testItem, existingItems)

        if (!hasCollision) {
          console.log('✅ Found optimal position:', { x, y, w, h })
          console.log('✅ No collision detected with existing items')
          return { x, y }
        } else {
          console.log('❌ Position occupied:', { x, y, w, h })
        }
      }
    }

    // Strategy 3: Fallback - place below all existing items
    const maxY = existingItems.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    console.log('🔄 Fallback placement below all items: x=0, y=' + maxY)
    return { x: 0, y: maxY }
  }, [detectCollision])

  // Generate layout items from chart configurations with enhanced smart placement
  const layoutItems = useMemo(() => {
    const items: GridLayout[] = []
    console.log('🔍 Generating layout items for', validCharts.length, 'charts')

    validCharts.forEach((config, index) => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]

      console.log('📊 Processing chart:', { chartId, type: config.type, index, hasCustomization: !!customization })

      // Get dimensions for this chart type
      const defaultDimensions = getFixedDimensions(config)

      // Use saved position or calculate optimal positioning
      let position = customization?.position

      if (!position) {
        console.log('🔍 No saved position, calculating optimal placement...')
        console.log('🔍 Current items count before placement:', items.length)
        // Use smart placement algorithm with chart type awareness
        // Pass current items array to ensure no collisions with already processed charts
        const optimalPos = findOptimalPosition(defaultDimensions, items, config.type)
        position = { ...optimalPos, ...defaultDimensions }
        console.log('✅ Calculated position:', position)

        // Save the calculated position to prevent recalculation on re-renders
        updateChartCustomization(chartId, { position })
      } else {
        console.log('📌 Using saved position:', position)
        // Even with saved position, check for collisions with newly added charts
        const testItem: GridLayout = {
          i: 'test-saved-position',
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h
        }

        if (detectCollision(testItem, items)) {
          console.warn('⚠️ Saved position collides with existing items, recalculating...')
          const optimalPos = findOptimalPosition(defaultDimensions, items, config.type)
          position = { ...optimalPos, ...defaultDimensions }
          console.log('🔄 Recalculated position:', position)

          // Update the stored position with the new collision-free location
          updateChartCustomization(chartId, { position })
        }
      }

      // Ensure position is within bounds
      const boundedPosition = {
        x: Math.max(0, Math.min(position.x, 12 - position.w)),
        y: Math.max(0, position.y),
        w: position.w,
        h: position.h
      }

      const layoutItem: GridLayout = {
        i: chartId,
        x: boundedPosition.x,
        y: boundedPosition.y,
        w: boundedPosition.w,
        h: boundedPosition.h,
        // Minimum dimensions to ensure charts remain readable
        minW: config.type === 'scorecard' ? 2 : config.type === 'table' ? 8 : 4,
        minH: config.type === 'scorecard' ? 1 : 2,
        maxW: config.type === 'table' ? 12 : 12,
        maxH: 10,
        isDraggable: true,
        isResizable: true,
        static: false // Ensure charts can be moved
      }

      console.log('🎯 Final layout item:', layoutItem)

      // Final collision check before adding
      if (detectCollision(layoutItem, items)) {
        console.error('❌ CRITICAL: Layout item still collides after placement!', layoutItem)
        // Force a safe position below all existing items
        const maxY = items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
        layoutItem.x = 0
        layoutItem.y = maxY
        console.log('🔄 Forced safe position:', { x: layoutItem.x, y: layoutItem.y })

        // Update the stored position with the forced safe position
        const safePosition = { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h }
        updateChartCustomization(chartId, { position: safePosition })
      }

      // Add to items array for next iteration
      items.push(layoutItem)
      console.log('➕ Added item to layout, total items:', items.length)
    })

    console.log('✅ Layout items generated:', items.length, 'items')
    console.log('📋 Final layout:', items.map(item => ({ id: item.i, x: item.x, y: item.y, w: item.w, h: item.h })))

    return items
  }, [validCharts, chartCustomizations, getFixedDimensions, findOptimalPosition, detectCollision, analysis.chartConfig])

  // Create the actual fixOverlappingLayouts callback now that layoutItems is defined
  const fixOverlappingLayouts = useCallback(
    createFixOverlappingLayouts(layoutItems),
    [layoutItems, detectCollision, validCharts, analysis.chartConfig, updateChartCustomization]
  )

  // Enhanced layout validation with collision resolution
  const validateLayout = useCallback((layout: GridLayout[]) => {
    console.log('🔍 Validating layout with', layout.length, 'items')

    const validatedLayout: GridLayout[] = []

    layout.forEach((item, index) => {
      // Ensure item is within bounds
      let validatedItem = {
        ...item,
        x: Math.max(0, Math.min(item.x, 12 - item.w)),
        y: Math.max(0, item.y)
      }

      // Check for collisions with previously validated items
      let attempts = 0
      while (detectCollision(validatedItem, validatedLayout) && attempts < 50) {
        console.warn('🔶 Collision detected during validation, finding new position...')

        // Try to find a new position
        const optimalPos = findOptimalPosition(
          { w: validatedItem.w, h: validatedItem.h },
          validatedLayout,
          validatedItem.i.includes('scorecard') ? 'scorecard' :
          validatedItem.i.includes('table') ? 'table' : 'chart'
        )

        validatedItem = {
          ...validatedItem,
          x: optimalPos.x,
          y: optimalPos.y
        }

        attempts++
      }

      if (attempts >= 50) {
        console.error('❌ Could not resolve collision for item:', validatedItem.i)
        // Force it below all existing items as last resort
        const maxY = validatedLayout.reduce((max, existing) => Math.max(max, existing.y + existing.h), 0)
        validatedItem.x = 0
        validatedItem.y = maxY
      }

      validatedLayout.push(validatedItem)
    })

    console.log('✅ Layout validation complete')
    return validatedLayout
  }, [detectCollision, findOptimalPosition])

  // Handle layout changes
  const handleLayoutChange = useCallback((layout: GridLayout[], allLayouts: { [key: string]: GridLayout[] }) => {
    // Validate and fix any overlaps
    const validatedLayout = validateLayout(layout)

    setLayouts(allLayouts)

    // Update chart positions in store using validated layout
    validatedLayout.forEach(item => {
      updateChartCustomization(item.i, {
        position: { x: item.x, y: item.y, w: item.w, h: item.h }
      })
    })

    // Auto-save dashboard config to project if enabled and we have a current project
    if (autoSaveLayouts && currentProjectId && !showSaveDialog) {
      // Debounced auto-save to prevent excessive saves
      const timeoutId = setTimeout(() => {
        const config = {
          chartCustomizations,
          currentLayout,
          filters: dashboardFilters,
          theme: currentTheme
        }
        saveDashboardConfig(currentProjectId, config).catch(console.error)
      }, 1000) // 1 second debounce

      return () => clearTimeout(timeoutId)
    }
  }, [updateChartCustomization, autoSaveLayouts, showSaveDialog, validateLayout, currentProjectId, chartCustomizations, currentLayout, dashboardFilters, currentTheme, saveDashboardConfig])

  // Handle chart selection
  const handleChartSelect = useCallback((chartId: string) => {
    setSelectedChartId(prev => prev === chartId ? null : chartId)
  }, [])

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

          {/* Fix Overlaps Button */}
          <Button
            onClick={() => {
              const wasFixed = fixOverlappingLayouts()
              if (!wasFixed) {
                // If no overlaps detected, still reset positions as requested
                validCharts.forEach(config => {
                  const originalIndex = analysis.chartConfig.indexOf(config)
                  const chartId = config.id || `chart-${originalIndex}`
                  updateChartCustomization(chartId, { position: undefined })
                })
              }
            }}
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Fix Overlaps
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

      {/* Dashboard Content */}
      <div className={cn(
        "dashboard-container draggable-grid-container relative",
        isLayoutMode && "layout-mode"
      )}>
        {validCharts.length === 0 ? (
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
            className="layout"
            layouts={Object.keys(layouts).length > 0 ? layouts : { lg: layoutItems }}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={200}
            onLayoutChange={handleLayoutChange}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            isDraggable={true}
            isResizable={true}
            compactType={null}
            preventCollision={true}
            allowOverlap={false}
            useCSSTransforms={true}
            transformScale={1}
            margin={[24, 24]}
            containerPadding={[0, 0]}
            draggableHandle={undefined}
            autoSize={true}
            verticalCompact={false}
            isBounded={true}
          >
            {validCharts.map((config, index) => {
              const originalIndex = analysis.chartConfig.indexOf(config)
              const chartId = config.id || `chart-${originalIndex}`
              const isSelected = selectedChartId === chartId
              const customization = chartCustomizations[chartId]
              const isVisible = customization?.isVisible !== false

              if (!isVisible && !isLayoutMode) return null

              return (
                <div
                  key={chartId}
                  className={cn(!isVisible && "opacity-50")}
                  data-chart-type={config.type}
                >
                  <EnhancedChartWrapper
                    id={chartId}
                    type={config.type}
                    title={config.title || `Chart ${index + 1}`}
                    description={config.description || ''}
                    data={data}
                    dataKey={config.dataKey || []}
                    isDragging={isDragging}
                    isSelected={isSelected}
                    onSelect={handleChartSelect}
                    onEdit={(id) => {
                      setSelectedChartId(id)
                      setIsCustomizing(true)
                    }}
                    className={cn(
                      "h-full",
                      "cursor-move",
                      isLayoutMode && "ring-2 ring-blue-400"
                    )}
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
      />
    </div>
  )
}