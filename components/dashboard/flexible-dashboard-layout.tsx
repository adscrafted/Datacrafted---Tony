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
        // Apply saved customizations to the store
        Object.entries(savedConfig.chartCustomizations).forEach(([chartId, customization]) => {
          updateChartCustomization(chartId, customization)
        })
        // Note: theme and layout would be applied through their respective setters if needed
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

  // Optimized collision detection function
  const detectCollision = useCallback((newItem: GridLayout, existingItems: GridLayout[]) => {
    return existingItems.some(item => {
      return !(
        newItem.x >= item.x + item.w || // newItem is to the right of item
        newItem.x + newItem.w <= item.x || // newItem is to the left of item
        newItem.y >= item.y + item.h || // newItem is below item
        newItem.y + newItem.h <= item.y    // newItem is above item
      )
    })
  }, [])

  // Smart placement algorithm that finds the optimal position for new charts
  const findOptimalPosition = useCallback((dimensions: { w: number; h: number }, existingItems: GridLayout[]) => {
    const { w, h } = dimensions

    // Strategy 1: Try to place in first available row, scanning left to right
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x <= 12 - w; x++) {
        const testItem: GridLayout = {
          i: 'test',
          x,
          y,
          w,
          h
        }

        if (!detectCollision(testItem, existingItems)) {
          return { x, y }
        }
      }
    }

    // Strategy 2: Fallback - place below all existing items
    const maxY = existingItems.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    return { x: 0, y: maxY }
  }, [detectCollision])

  // Generate layout items from chart configurations with smart placement
  const layoutItems = useMemo(() => {
    const items: GridLayout[] = []

    validCharts.forEach((config, index) => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]

      // Get dimensions for this chart type
      const defaultDimensions = getFixedDimensions(config)

      // Use saved position or calculate optimal positioning
      let position = customization?.position

      if (!position) {
        // Tables always get full width and start on new row
        if (config.type === 'table') {
          const maxY = items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
          position = { x: 0, y: maxY, ...defaultDimensions }
        } else {
          // Use smart placement for other chart types
          const optimalPos = findOptimalPosition(defaultDimensions, items)
          position = { ...optimalPos, ...defaultDimensions }
        }
      }

      const layoutItem: GridLayout = {
        i: chartId,
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        // Minimum dimensions to ensure charts remain readable (320x400px minimum)
        minW: config.type === 'scorecard' ? 2 : config.type === 'table' ? 8 : 4,
        minH: config.type === 'scorecard' ? 1 : 2,
        maxW: config.type === 'table' ? 12 : 12,
        maxH: 10,
        isDraggable: true,
        isResizable: true,
      }

      items.push(layoutItem)
    })

    return items
  }, [validCharts, chartCustomizations, getFixedDimensions, findOptimalPosition])

  // Simple layout validation - only used as safety net
  const validateLayout = useCallback((layout: GridLayout[]) => {
    // Since we're using smart placement, validation should be minimal
    // Just ensure items are within bounds
    return layout.map(item => ({
      ...item,
      x: Math.max(0, Math.min(item.x, 12 - item.w)),
      y: Math.max(0, item.y)
    }))
  }, [])

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

          {/* Reset Charts Button */}
          <Button
            onClick={() => {
              // Clear all chart customizations to reset to default sizes
              validCharts.forEach(config => {
                const originalIndex = analysis.chartConfig.indexOf(config)
                const chartId = config.id || `chart-${originalIndex}`
                updateChartCustomization(chartId, { position: undefined })
              })
            }}
            size="sm"
            variant="outline"
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Sizes
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
            layouts={layouts}
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