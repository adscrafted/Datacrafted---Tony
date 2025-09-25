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
    setIsDragging
  } = useDataStore()

  // Update available columns when data changes
  useEffect(() => {
    if (data.length > 0) {
      const columns = Object.keys(data[0])
      setAvailableColumns(columns)
    }
  }, [data, setAvailableColumns])

  // Filter out invalid charts before rendering
  const validCharts = useMemo(() =>
    filterValidCharts(analysis.chartConfig, data),
    [analysis.chartConfig, data]
  )

  // Helper function to calculate dynamic chart dimensions based on data
  const calculateDynamicDimensions = useCallback((config: any, data: DataRow[]) => {
    const dataPoints = data.length
    const hasLabels = config.dataKey && config.dataKey.length > 0

    // Get sample labels to estimate length
    const sampleLabels = hasLabels && data.length > 0
      ? data.slice(0, Math.min(10, data.length)).map(row => String(row[config.dataKey[0]] || ''))
      : []

    const maxLabelLength = sampleLabels.reduce((max, label) => Math.max(max, label.length), 0)
    const needsRotation = maxLabelLength > 8

    // Base dimensions
    let dimensions = { w: 6, h: 3 }

    switch (config.type) {
      case 'scorecard':
        dimensions = { w: 3, h: 2 }
        break

      case 'table':
        // Table height based on data volume
        const tableHeight = Math.min(Math.max(4, Math.ceil(dataPoints / 20)), 8)
        dimensions = { w: 12, h: tableHeight }
        break

      case 'pie':
        // Pie charts need square aspect ratio
        dimensions = { w: 5, h: 4 }
        break

      case 'bar':
      case 'line':
      case 'area':
        // Calculate width based on data points
        const minWidth = 4
        const maxWidth = 12
        const calculatedWidth = Math.min(maxWidth, Math.max(minWidth, Math.ceil(dataPoints / 10) + 2))

        // Calculate height based on label rotation and chart content
        let calculatedHeight = 3 // Base height
        if (needsRotation) {
          calculatedHeight += 1 // Extra space for rotated labels
        }
        if (maxLabelLength > 15) {
          calculatedHeight += 1 // Even more space for very long labels
        }

        dimensions = { w: calculatedWidth, h: Math.min(6, calculatedHeight) }
        break

      case 'scatter':
        // Scatter plots benefit from larger size for better readability
        const scatterWidth = Math.min(10, Math.max(6, Math.ceil(dataPoints / 20) + 4))
        dimensions = { w: scatterWidth, h: 5 }
        break

      default:
        dimensions = { w: 6, h: 4 }
    }

    return dimensions
  }, [])

  // Generate layout items from chart configurations
  const layoutItems = useMemo(() => {
    // Track occupied positions for smart layout
    const occupiedPositions = new Set<string>()

    return validCharts.map((config, index) => {
      const originalIndex = analysis.chartConfig.indexOf(config)
      const chartId = config.id || `chart-${originalIndex}`
      const customization = chartCustomizations[chartId]

      // Calculate dynamic dimensions based on data
      const defaultDimensions = calculateDynamicDimensions(config, data)

      // Use saved position or calculate automatic positioning with collision detection
      const position = customization?.position || (() => {
        // For tables (full width), always start on new row
        if (config.type === 'table') {
          let y = 0
          // Find the lowest available row
          while (occupiedPositions.has(`0,${y}`)) {
            y++
          }
          // Mark full row as occupied
          for (let x = 0; x < 12; x++) {
            for (let dy = 0; dy < defaultDimensions.h; dy++) {
              occupiedPositions.add(`${x},${y + dy}`)
            }
          }
          return { x: 0, y, ...defaultDimensions }
        }

        // For other charts, find next available position
        let x = 0
        let y = 0

        while (y < 50) { // Safety limit
          // Try to place at current position
          let canPlace = true

          // Check if position fits and doesn't overlap
          for (let dx = 0; dx < defaultDimensions.w && canPlace; dx++) {
            for (let dy = 0; dy < defaultDimensions.h && canPlace; dy++) {
              if (x + dx >= 12 || occupiedPositions.has(`${x + dx},${y + dy}`)) {
                canPlace = false
              }
            }
          }

          if (canPlace) {
            // Mark positions as occupied
            for (let dx = 0; dx < defaultDimensions.w; dx++) {
              for (let dy = 0; dy < defaultDimensions.h; dy++) {
                occupiedPositions.add(`${x + dx},${y + dy}`)
              }
            }
            return { x, y, ...defaultDimensions }
          }

          // Move to next position
          x += defaultDimensions.w
          if (x + defaultDimensions.w > 12) {
            x = 0
            y += defaultDimensions.h
          }
        }

        // Fallback position
        return { x: 0, y: 0, ...defaultDimensions }
      })()

      return {
        i: chartId,
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        // Enhanced minimum dimensions to prevent charts from becoming too small
        minW: config.type === 'scorecard' ? 2 : config.type === 'table' ? 8 : 3,
        minH: config.type === 'scorecard' ? 1 : config.type === 'table' ? 3 : 2,
        maxW: config.type === 'table' ? 12 : 12,
        maxH: config.type === 'table' ? 12 : 8,
        isDraggable: true,  // Always allow dragging
        isResizable: true,  // Always allow resizing
      }
    })
  }, [validCharts, analysis.chartConfig, chartCustomizations, isLayoutMode, isCustomizing])

  // Handle layout changes
  const handleLayoutChange = useCallback((layout: GridLayout[], allLayouts: { [key: string]: GridLayout[] }) => {
    setLayouts(allLayouts)

    // Update chart positions in store
    layout.forEach(item => {
      updateChartCustomization(item.i, {
        position: { x: item.x, y: item.y, w: item.w, h: item.h }
      })
    })

    // Auto-save if enabled
    if (autoSaveLayouts && !showSaveDialog) {
      // Debounced auto-save could be implemented here
    }
  }, [updateChartCustomization, autoSaveLayouts, showSaveDialog])

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
            rowHeight={160}
            onLayoutChange={handleLayoutChange}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            isDraggable={true}
            isResizable={true}
            compactType="vertical"
            preventCollision={false}
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