'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Settings, Eye, EyeOff, Palette, Type, BarChart3, Move, Maximize2 as Resize, Copy, RotateCcw, Download, Save, Database, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { ChartCustomization, useDataStore } from '@/lib/store'
import { debug } from '@/lib/debug'

interface ChartCustomizationPanelProps {
  chartId: string
  title: string
  description: string
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo' | 'waterfall' | 'funnel' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap' | 'sankey' | 'sparkline'
  customization?: ChartCustomization
  onCustomizationChange: (chartId: string, customization: Partial<ChartCustomization>) => void
  className?: string
  initialTab?: 'general' | 'data' | 'style' | 'axes' | 'actions' // New prop to control initial tab
  configDataMapping?: any // Original chart config dataMapping for fallback display
  autoOpen?: boolean // Auto-open the panel
}

const chartTypeOptions = [
  { value: 'bar', label: 'Bar Chart', icon: '📊' },
  { value: 'line', label: 'Line Chart', icon: '📈' },
  { value: 'pie', label: 'Pie Chart', icon: '🥧' },
  { value: 'area', label: 'Area Chart', icon: '📈' },
  { value: 'scatter', label: 'Scatter Plot', icon: '📍' },
  { value: 'scorecard', label: 'Scorecard', icon: '🎯' },
  { value: 'table', label: 'Data Table', icon: '📋' },
  { value: 'combo', label: 'Combo Chart', icon: '📊📈' },
  { value: 'waterfall', label: 'Waterfall Chart', icon: '💧' },
  { value: 'funnel', label: 'Funnel Chart', icon: '🔽' },
  { value: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { value: 'gauge', label: 'Gauge Chart', icon: '🎯' },
  { value: 'cohort', label: 'Cohort Analysis', icon: '👥' },
  { value: 'bullet', label: 'Bullet Chart', icon: '🎯' },
  { value: 'treemap', label: 'Treemap', icon: '🗺️' },
  { value: 'sankey', label: 'Sankey Diagram', icon: '🌊' },
  { value: 'sparkline', label: 'Sparkline', icon: '✨' }
] as const

export function ChartCustomizationPanel({
  chartId,
  title,
  description,
  chartType,
  customization,
  onCustomizationChange,
  className,
  initialTab,
  configDataMapping,
  autoOpen
}: ChartCustomizationPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'style' | 'axes' | 'actions'>(initialTab || 'general')
  const [mounted, setMounted] = useState(false)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { exportChart, addToHistory, dataSchema, rawData, draftChart, commitDraftChart, setDraftChart } = useDataStore()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-open panel if requested (for new charts)
  // Only trigger once when autoOpen changes from false to true
  const prevAutoOpenRef = React.useRef<boolean | undefined>(undefined)
  React.useEffect(() => {
    // Only open if autoOpen is true AND it wasn't true before (edge trigger, not level trigger)
    // IMPORTANT: Don't include isOpen in deps to avoid infinite loops
    if (autoOpen && !prevAutoOpenRef.current) {
      setIsOpen(true)
    }
    prevAutoOpenRef.current = autoOpen
  }, [autoOpen, chartId])

  // Allow external control of active tab via initialTab prop
  // IMPORTANT: Set tab when panel opens OR when initialTab changes
  React.useEffect(() => {
    if (initialTab && isOpen) {
      debug.panel('📂 [CUSTOMIZATION_PANEL] Setting active tab to:', initialTab)
      setActiveTab(initialTab)
    }
  }, [initialTab, isOpen])

  // Check if this is a draft chart being configured
  const isDraftChart = React.useMemo(() => {
    return draftChart?.id === chartId
  }, [draftChart, chartId])

  // Clean up draft chart if panel is closed without committing
  const handleClose = React.useCallback(() => {
    if (isDraftChart) {
      debug.panel('🗑️ [CUSTOMIZATION_PANEL] Canceling draft chart - clearing draft')
      setDraftChart(null)
    }
    setIsOpen(false)
  }, [isDraftChart, setDraftChart])

  // Keyboard navigation: ESC to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose])

  // Merged dataMapping: prefer customization, fallback to original config
  const effectiveDataMapping = React.useMemo(() => {
    return customization?.dataMapping || configDataMapping || {}
  }, [customization?.dataMapping, configDataMapping])

  // Get available columns from data schema or raw data
  const availableColumns = React.useMemo(() => {
    if (dataSchema?.columns) {
      return dataSchema.columns.map(col => col.name)
    }
    if (rawData && rawData.length > 0) {
      return Object.keys(rawData[0])
    }
    return []
  }, [dataSchema, rawData])

  // Separate columns by data type for better UX
  const columnsByType = React.useMemo(() => {
    if (!dataSchema?.columns) {
      return {
        numeric: availableColumns,
        text: availableColumns,
        date: availableColumns,
        all: availableColumns
      }
    }

    const numeric = dataSchema.columns
      .filter(col => col.type === 'number')
      .map(col => col.name)

    const text = dataSchema.columns
      .filter(col => col.type === 'string' || col.type === 'categorical')
      .map(col => col.name)

    const date = dataSchema.columns
      .filter(col => col.type === 'date')
      .map(col => col.name)

    return {
      numeric,
      text,
      date,
      all: availableColumns
    }
  }, [dataSchema, availableColumns])

  // Get the effective/current chart type (customization overrides prop)
  const effectiveChartType = customization?.chartType || chartType

  const handleUpdate = (updates: Partial<ChartCustomization>) => {
    const newCustomization = {
      ...customization,
      ...updates,
      // Properly merge nested dataMapping object to preserve other fields
      // Special case: if dataMapping is explicitly null, clear it completely
      dataMapping: updates.dataMapping === null ? {} :
        (updates.dataMapping ? {
          ...customization?.dataMapping,
          ...updates.dataMapping
        } : customization?.dataMapping),
      id: chartId
    }
    onCustomizationChange(chartId, newCustomization)
    addToHistory('chart_customize', { chartId, updates })
  }

  const handleDuplicateChart = () => {
    const duplicateId = `${chartId}-copy-${Date.now()}`
    const duplicateCustomization = {
      ...customization,
      id: duplicateId,
      customTitle: `${customization?.customTitle || title} (Copy)`
    }
    onCustomizationChange(duplicateId, duplicateCustomization)
    addToHistory('chart_duplicate', { originalId: chartId, duplicateId })
  }


  const handleExportChart = async (format: 'png' | 'pdf' | 'svg') => {
    try {
      await exportChart(chartId, format)
      addToHistory('chart_export', { chartId, format })
    } catch (error) {
      console.error('Failed to export chart:', error)
    }
  }

  const handleGenerateTitleAndDescription = async () => {
    setIsGeneratingTitle(true)
    setGenerationError(null)

    try {
      // Check if we have data mapping and data
      if (!effectiveDataMapping || Object.keys(effectiveDataMapping).length === 0) {
        throw new Error('Please configure chart data fields first')
      }

      if (!rawData || rawData.length === 0) {
        throw new Error('No data available')
      }

      // Prepare sample data (first 5-10 rows)
      const sampleData = rawData.slice(0, 10)

      // Prepare data schema
      const schema = dataSchema?.columns.map(col => ({
        name: col.name,
        type: col.type
      }))

      // Call the API
      const response = await fetch('/api/generate-chart-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chartType: effectiveChartType,
          dataMapping: effectiveDataMapping,
          sampleData,
          dataSchema: schema
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate title and description')
      }

      const { title, description } = await response.json()

      // Update the customization with generated title and description
      handleUpdate({
        customTitle: title,
        customDescription: description
      })

      debug.panel('Generated title and description:', { title, description })
    } catch (error) {
      console.error('Error generating title/description:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate title and description'
      setGenerationError(errorMessage)
      setTimeout(() => setGenerationError(null), 5000) // Clear error after 5 seconds
    } finally {
      setIsGeneratingTitle(false)
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'style', label: 'Style', icon: Palette },
    { id: 'axes', label: 'Axes', icon: BarChart3 },
    { id: 'actions', label: 'Actions', icon: Copy }
  ] as const

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-8 w-8 p-0 opacity-70 hover:opacity-100',
          isOpen && 'bg-primary/10 text-primary'
        )}
        title="Customize chart"
        aria-label={isOpen ? "Close chart settings" : "Open chart settings"}
        aria-expanded={isOpen}
      >
        <Settings className="h-4 w-4" />
      </Button>
      
      {isOpen && mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={handleClose}
          />
          
          {/* Settings Panel */}
          <Card
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[950px] max-h-[85vh] overflow-hidden shadow-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Chart Settings
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardTitle>
            
            {/* Tabs */}
            <div className="flex gap-1 mt-3">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 overflow-y-auto max-h-[calc(80vh-10rem)]">
            {activeTab === 'general' && (
              <div className="space-y-4">
                {/* Chart Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Chart Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {chartTypeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          const currentType = effectiveChartType
                          // If chart type is changing, intelligently map existing fields to new chart type
                          if (currentType !== option.value) {
                            const currentMapping = effectiveDataMapping || {}
                            let newMapping: any = {}

                            // Intelligent field mapping based on new chart type
                            switch (option.value) {
                              case 'funnel':
                                // Map xAxis/category → stage, yAxis/value → value
                                newMapping = {
                                  stage: currentMapping.xAxis || currentMapping.category || currentMapping.stage,
                                  value: currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
                                }
                                break

                              case 'waterfall':
                                // Map xAxis/category → category, yAxis/value → value
                                newMapping = {
                                  category: currentMapping.xAxis || currentMapping.category,
                                  value: currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
                                }
                                break

                              case 'gauge':
                                // Map metric/yAxis/value → value
                                newMapping = {
                                  value: currentMapping.metric || currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
                                }
                                break

                              case 'heatmap':
                                // Map xAxis → xAxis, yAxis → yAxis, value → value
                                newMapping = {
                                  xAxis: currentMapping.xAxis || currentMapping.category,
                                  yAxis: currentMapping.yAxis || currentMapping.metric,
                                  value: currentMapping.value || currentMapping.values?.[0]
                                }
                                break

                              case 'treemap':
                                // Map xAxis/category → category, yAxis/value → value
                                newMapping = {
                                  category: currentMapping.xAxis || currentMapping.category,
                                  value: currentMapping.yAxis || currentMapping.value || currentMapping.values?.[0]
                                }
                                break

                              case 'sankey':
                                // Try to preserve source/target if they exist
                                newMapping = {
                                  source: currentMapping.source || currentMapping.xAxis,
                                  target_node: currentMapping.target_node || currentMapping.yAxis,
                                  value: currentMapping.value || currentMapping.values?.[0]
                                }
                                break

                              case 'bullet':
                                // Map metrics to actual/comparative
                                newMapping = {
                                  actual: currentMapping.actual || currentMapping.metric || currentMapping.yAxis,
                                  comparative: currentMapping.comparative || currentMapping.target
                                }
                                break

                              case 'cohort':
                                // Try to preserve cohort fields
                                newMapping = {
                                  cohort: currentMapping.cohort || currentMapping.xAxis,
                                  period: currentMapping.period || currentMapping.category,
                                  value: currentMapping.value || currentMapping.yAxis
                                }
                                break

                              case 'sparkline':
                                // Map xAxis/trend → trend
                                newMapping = {
                                  trend: currentMapping.trend || currentMapping.xAxis || currentMapping.metric
                                }
                                break

                              default:
                                // For standard charts (bar, line, pie, etc.), preserve existing mapping
                                newMapping = currentMapping
                                break
                            }

                            // Only include fields that have values
                            const cleanedMapping = Object.entries(newMapping)
                              .filter(([_, value]) => value !== undefined && value !== null)
                              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

                            console.log('🔄 [CHART_TYPE_CHANGE] Mapping fields:', {
                              from: currentType,
                              to: option.value,
                              oldMapping: currentMapping,
                              newMapping: cleanedMapping
                            })

                            handleUpdate({
                              chartType: option.value,
                              dataMapping: Object.keys(cleanedMapping).length > 0 ? cleanedMapping : null
                            })
                          } else {
                            handleUpdate({ chartType: option.value })
                          }
                        }}
                        className={cn(
                          'flex items-center space-x-2 p-2 rounded border text-left text-sm transition-colors',
                          (customization?.chartType || chartType) === option.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* AI Generation Section */}
                <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">AI-Powered Generation</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateTitleAndDescription}
                      disabled={isGeneratingTitle || !effectiveDataMapping || Object.keys(effectiveDataMapping).length === 0 || !rawData || rawData.length === 0}
                      className="h-7 text-xs bg-white hover:bg-purple-50 border-purple-300 text-purple-700"
                    >
                      {isGeneratingTitle ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-purple-700">
                    {!effectiveDataMapping || Object.keys(effectiveDataMapping).length === 0
                      ? 'Configure chart data fields first to enable AI generation'
                      : 'Generate intelligent title and description based on your chart data'}
                  </p>
                  {generationError && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      {generationError}
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Custom Title</label>
                  <input
                    type="text"
                    value={customization?.customTitle || ''}
                    onChange={(e) => handleUpdate({ customTitle: e.target.value })}
                    placeholder={title}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Custom Description</label>
                  <textarea
                    value={customization?.customDescription || ''}
                    onChange={(e) => handleUpdate({ customDescription: e.target.value })}
                    placeholder={description}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                  />
                </div>

              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-4">
                {availableColumns.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">No data available</p>
                    <p className="text-xs mt-1 text-gray-400">Upload data to configure chart axes</p>
                    <p className="text-xs mt-3 max-w-xs mx-auto text-gray-400">
                      Go to the upload page to import a CSV or Excel file with your data.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Standard Charts: Line, Bar, Area, Scatter, Combo */}
                    {(effectiveChartType === 'line' || effectiveChartType === 'bar' || effectiveChartType === 'area' || effectiveChartType === 'scatter' || effectiveChartType === 'combo') && (
                      <div className="flex gap-6">
                        {/* Available Fields */}
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col, index) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'

                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        {/* Drop Zones */}
                        <div className="flex-1 space-y-4">
                          {/* X-Axis Drop Zone */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                    ...customization?.dataMapping,
                                    xAxis: data.fieldName,
                                    category: data.fieldName  // Also set category for consistency with AI format
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">X-Axis</div>
                            {(effectiveDataMapping?.xAxis || effectiveDataMapping?.category) ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.xAxis || effectiveDataMapping.category}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                      ...customization?.dataMapping,
                                      xAxis: undefined,
                                      category: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left
                              </div>
                            )}
                          </div>

                          {/* Dual Y-Axis Drop Zones - for combo, bar, line, area, and scatter charts */}
                          {(effectiveChartType === 'combo' || effectiveChartType === 'bar' || effectiveChartType === 'line' || effectiveChartType === 'area' || effectiveChartType === 'scatter') ? (
                            <>
                              {/* Left Y-Axis (Primary) */}
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault()
                                  e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                                }}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                                  try {
                                    const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                    if (data.fieldType === 'number') {
                                      // Support both yAxis1 and yAxis (check both sources)
                                      const currentYAxis1 = customization?.dataMapping?.yAxis1 || customization?.dataMapping?.yAxis || effectiveDataMapping?.yAxis1 || effectiveDataMapping?.yAxis
                                      let newYAxis1: string | string[]

                                      if (Array.isArray(currentYAxis1)) {
                                        if (!currentYAxis1.includes(data.fieldName)) {
                                          newYAxis1 = [...currentYAxis1, data.fieldName]
                                        } else {
                                          newYAxis1 = currentYAxis1
                                        }
                                      } else if (currentYAxis1) {
                                        if (currentYAxis1 !== data.fieldName) {
                                          newYAxis1 = [currentYAxis1, data.fieldName]
                                        } else {
                                          newYAxis1 = currentYAxis1
                                        }
                                      } else {
                                        newYAxis1 = [data.fieldName]
                                      }

                                      handleUpdate({
                                        dataMapping: {
                                          ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                          ...customization?.dataMapping,
                                          yAxis1: newYAxis1,
                                          yAxis: newYAxis1 // Update both for compatibility
                                        }
                                      })
                                    }
                                  } catch (error) {
                                    console.error('Failed to parse drop data:', error)
                                  }
                                }}
                                className="min-h-20 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                              >
                                <div className="text-sm font-medium text-green-600 mb-2">Left Y-Axis (Primary)</div>
                                {(() => {
                                  // Support both yAxis1 and yAxis (AI may use either)
                                  const leftAxisData = effectiveDataMapping?.yAxis1 || effectiveDataMapping?.yAxis
                                  const hasData = leftAxisData && (Array.isArray(leftAxisData) ? leftAxisData.length > 0 : true)

                                  return hasData ? (
                                    <div className="space-y-2">
                                      {(Array.isArray(leftAxisData) ? leftAxisData : [leftAxisData]).map((field: string) => (
                                        <div key={field} className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                          <span className="text-sm text-green-800">{field}</span>
                                          <button
                                            onClick={() => {
                                              // Get current value from either source
                                              const currentYAxis1 = customization?.dataMapping?.yAxis1 || customization?.dataMapping?.yAxis || effectiveDataMapping?.yAxis1 || effectiveDataMapping?.yAxis
                                              let newYAxis1: string | string[] | undefined

                                              if (Array.isArray(currentYAxis1)) {
                                                const filtered = currentYAxis1.filter(f => f !== field)
                                                if (filtered.length === 1) {
                                                  newYAxis1 = filtered[0]
                                                } else if (filtered.length === 0) {
                                                  newYAxis1 = undefined
                                                } else {
                                                  newYAxis1 = filtered
                                                }
                                              } else {
                                                newYAxis1 = undefined
                                              }

                                              handleUpdate({
                                                dataMapping: {
                                                  ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                                  ...customization?.dataMapping,
                                                  yAxis1: newYAxis1,
                                                  yAxis: newYAxis1 // Update both for compatibility
                                                }
                                              })
                                            }}
                                            className="text-green-600 hover:text-green-800 text-xs"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                      <span className="block text-lg mb-1">👈</span>
                                      Drag numeric fields from the left
                                    </div>
                                  )
                                })()}
                              </div>

                              {/* Right Y-Axis (Secondary) */}
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault()
                                  e.currentTarget.classList.add('border-purple-400', 'bg-purple-50')
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                                }}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                                  try {
                                    const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                    if (data.fieldType === 'number') {
                                      const currentYAxis2 = customization?.dataMapping?.yAxis2 || effectiveDataMapping?.yAxis2
                                      let newYAxis2: string | string[]

                                      if (Array.isArray(currentYAxis2)) {
                                        if (!currentYAxis2.includes(data.fieldName)) {
                                          newYAxis2 = [...currentYAxis2, data.fieldName]
                                        } else {
                                          newYAxis2 = currentYAxis2
                                        }
                                      } else if (currentYAxis2) {
                                        if (currentYAxis2 !== data.fieldName) {
                                          newYAxis2 = [currentYAxis2, data.fieldName]
                                        } else {
                                          newYAxis2 = currentYAxis2
                                        }
                                      } else {
                                        newYAxis2 = [data.fieldName]
                                      }

                                      handleUpdate({
                                        dataMapping: {
                                          ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                          ...customization?.dataMapping,
                                          yAxis2: newYAxis2
                                        }
                                      })
                                    }
                                  } catch (error) {
                                    console.error('Failed to parse drop data:', error)
                                  }
                                }}
                                className="min-h-20 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                              >
                                <div className="text-sm font-medium text-purple-600 mb-2">Right Y-Axis (Secondary)</div>
                                {effectiveDataMapping?.yAxis2 && (Array.isArray(effectiveDataMapping.yAxis2) ? effectiveDataMapping.yAxis2.length > 0 : true) ? (
                                  <div className="space-y-2">
                                    {(Array.isArray(effectiveDataMapping.yAxis2) ? effectiveDataMapping.yAxis2 : [effectiveDataMapping.yAxis2]).map((field: string) => (
                                      <div key={field} className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                        <span className="text-sm text-purple-800">{field}</span>
                                        <button
                                          onClick={() => {
                                            const currentYAxis2 = customization?.dataMapping?.yAxis2 || effectiveDataMapping?.yAxis2
                                            let newYAxis2: string | string[] | undefined

                                            if (Array.isArray(currentYAxis2)) {
                                              const filtered = currentYAxis2.filter(f => f !== field)
                                              if (filtered.length === 1) {
                                                newYAxis2 = filtered[0]
                                              } else if (filtered.length === 0) {
                                                newYAxis2 = undefined
                                              } else {
                                                newYAxis2 = filtered
                                              }
                                            } else {
                                              newYAxis2 = undefined
                                            }

                                            handleUpdate({
                                              dataMapping: {
                                                ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                                ...customization?.dataMapping,
                                                yAxis2: newYAxis2
                                              }
                                            })
                                          }}
                                          className="text-purple-600 hover:text-purple-800 text-xs"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    <span className="block text-lg mb-1">👈</span>
                                    Drag numeric fields from the left
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            /* Standard Y-Axis Drop Zone for non-combo charts */
                            <div
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                                try {
                                  const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                  // Only allow numeric fields in Y-axis for most chart types
                                  if (data.fieldType === 'number' || effectiveChartType === 'scatter') {
                                    // Check all possible sources: yAxis, values, or yAxis1
                                    const currentYAxis = customization?.dataMapping?.yAxis || customization?.dataMapping?.values || customization?.dataMapping?.yAxis1 || effectiveDataMapping?.yAxis || effectiveDataMapping?.values || effectiveDataMapping?.yAxis1
                                    let newYAxis: string | string[]

                                    // Add to existing Y-axis fields
                                    if (Array.isArray(currentYAxis)) {
                                      if (!currentYAxis.includes(data.fieldName)) {
                                        newYAxis = [...currentYAxis, data.fieldName]
                                      } else {
                                        newYAxis = currentYAxis
                                      }
                                    } else if (currentYAxis) {
                                      if (currentYAxis !== data.fieldName) {
                                        newYAxis = [currentYAxis, data.fieldName]
                                      } else {
                                        newYAxis = currentYAxis
                                      }
                                    } else {
                                      newYAxis = [data.fieldName]
                                    }

                                    handleUpdate({
                                      dataMapping: {
                                        ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                        ...customization?.dataMapping,
                                        yAxis: newYAxis,
                                        values: Array.isArray(newYAxis) ? newYAxis : [newYAxis]  // Ensure values is always an array
                                      }
                                    })
                                  }
                                } catch (error) {
                                  console.error('Failed to parse drop data:', error)
                                }
                              }}
                              className="min-h-20 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                            >
                              <div className="text-sm font-medium text-gray-600 mb-2">Y-Axis (Numeric Fields Only)</div>
                              {(() => {
                                // Support all Y-axis field name variants (AI may use different names)
                                const yAxisData = effectiveDataMapping?.yAxis || effectiveDataMapping?.values || effectiveDataMapping?.yAxis1
                                const hasData = yAxisData && (Array.isArray(yAxisData) ? yAxisData.length > 0 : true)

                                return hasData ? (
                                  <div className="space-y-2">
                                    {(Array.isArray(yAxisData) ? yAxisData : [yAxisData]).map((field: string, index: number) => (
                                      <div key={field} className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                        <span className="text-sm text-green-800">{field}</span>
                                        <button
                                          onClick={() => {
                                            // Check all possible sources: yAxis, values, or yAxis1
                                            const currentYAxis = customization?.dataMapping?.yAxis || customization?.dataMapping?.values || customization?.dataMapping?.yAxis1 || effectiveDataMapping?.yAxis || effectiveDataMapping?.values || effectiveDataMapping?.yAxis1
                                            let newYAxis: string | string[] | undefined

                                            if (Array.isArray(currentYAxis)) {
                                              const filtered = currentYAxis.filter(f => f !== field)
                                              if (filtered.length === 1) {
                                                newYAxis = filtered[0]
                                              } else if (filtered.length === 0) {
                                                newYAxis = undefined
                                              } else {
                                                newYAxis = filtered
                                              }
                                            } else {
                                              newYAxis = undefined
                                            }

                                            handleUpdate({
                                              dataMapping: {
                                                ...effectiveDataMapping, // CRITICAL: Spread effectiveDataMapping first to preserve all fields
                                                ...customization?.dataMapping,
                                                yAxis: newYAxis,
                                                values: Array.isArray(newYAxis) ? newYAxis : (newYAxis ? [newYAxis] : undefined)
                                              }
                                            })
                                          }}
                                          className="text-green-600 hover:text-green-800 text-xs"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    <span className="block text-lg mb-1">👈</span>
                                    Drag numeric fields from the left
                                  </div>
                                )
                              })()}
                            </div>
                          )}

                          {/* Aggregation Method Selector - for bar/line/area/combo charts */}
                          {(effectiveChartType === 'bar' || effectiveChartType === 'line' || effectiveChartType === 'area' || effectiveChartType === 'combo') && (
                            <div className="mt-4">
                              <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Aggregation Method
                              </label>
                              <select
                                value={customization?.dataMapping?.aggregation || 'sum'}
                                onChange={(e) => {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      aggregation: e.target.value as any
                                    }
                                  })
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="sum">Sum</option>
                                <option value="avg">Average</option>
                                <option value="count">Count</option>
                                <option value="min">Minimum</option>
                                <option value="max">Maximum</option>
                                <option value="distinct">Distinct Count</option>
                              </select>
                              <p className="text-xs text-gray-500 mt-1">
                                How to aggregate data when grouping by X-axis
                              </p>
                            </div>
                          )}

                          {/* Bar Chart Sorting Controls */}
                          {effectiveChartType === 'bar' && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="text-sm font-medium text-gray-700 mb-3">Bar Chart Options</div>

                              <div className="space-y-3">
                                {/* Sort By */}
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Sort By</label>
                                  <select
                                    value={customization?.dataMapping?.sortBy || ''}
                                    onChange={(e) => {
                                      handleUpdate({
                                        dataMapping: {
                                          ...customization?.dataMapping,
                                          sortBy: e.target.value || undefined
                                        }
                                      })
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="">No sorting</option>
                                    <option value="value">Value</option>
                                    <option value="label">Label</option>
                                  </select>
                                </div>

                                {/* Sort Order */}
                                {customization?.dataMapping?.sortBy && (
                                  <div>
                                    <label className="text-xs text-gray-600 mb-1 block">Sort Order</label>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          handleUpdate({
                                            dataMapping: {
                                              ...customization?.dataMapping,
                                              sortOrder: 'asc'
                                            }
                                          })
                                        }}
                                        className={`flex-1 px-2 py-1.5 text-xs rounded border ${
                                          (customization?.dataMapping?.sortOrder || 'asc') === 'asc'
                                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                                            : 'bg-white border-gray-300 text-gray-600'
                                        }`}
                                      >
                                        Ascending
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleUpdate({
                                            dataMapping: {
                                              ...customization?.dataMapping,
                                              sortOrder: 'desc'
                                            }
                                          })
                                        }}
                                        className={`flex-1 px-2 py-1.5 text-xs rounded border ${
                                          customization?.dataMapping?.sortOrder === 'desc'
                                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                                            : 'bg-white border-gray-300 text-gray-600'
                                        }`}
                                      >
                                        Descending
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Limit Results */}
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Limit Results (Top N)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="All items"
                                    value={customization?.dataMapping?.limit || ''}
                                    onChange={(e) => {
                                      const value = e.target.value ? parseInt(e.target.value) : undefined
                                      handleUpdate({
                                        dataMapping: {
                                          ...customization?.dataMapping,
                                          limit: value
                                        }
                                      })
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Scatter Chart Advanced Fields (Size & Color) */}
                        {effectiveChartType === 'scatter' && (
                          <div className="space-y-4">
                            {/* Bubble Size Drop Zone */}
                            <div>
                              <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  try {
                                    const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                    if (data.fieldType === 'number') {
                                      handleUpdate({
                                        dataMapping: {
                                          ...customization?.dataMapping,
                                          size: data.fieldName
                                        }
                                      })
                                    }
                                  } catch (error) {
                                    console.error('Failed to parse drop data:', error)
                                  }
                                }}
                                className="min-h-16 border-2 border-dashed border-purple-300 rounded-lg p-3 transition-all"
                              >
                                <div className="text-sm font-medium text-purple-600 mb-2 flex items-center">
                                  Bubble Size (Optional)
                                  <span className="ml-1 text-xs text-gray-500">- Numeric only</span>
                                </div>
                                {effectiveDataMapping?.size ? (
                                  <div className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                    <span className="text-sm text-purple-800">{effectiveDataMapping.size}</span>
                                    <button
                                      onClick={() => {
                                        handleUpdate({
                                          dataMapping: {
                                            ...customization?.dataMapping,
                                            size: undefined
                                          }
                                        })
                                      }}
                                      className="text-purple-600 hover:text-purple-800 text-xs"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-center py-2 text-gray-500 text-sm">
                                    Drop a numeric field to create bubble chart
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Color Grouping Drop Zone */}
                            <div>
                              <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  try {
                                    const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                    handleUpdate({
                                      dataMapping: {
                                        ...customization?.dataMapping,
                                        color: data.fieldName
                                      }
                                    })
                                  } catch (error) {
                                    console.error('Failed to parse drop data:', error)
                                  }
                                }}
                                className="min-h-16 border-2 border-dashed border-orange-300 rounded-lg p-3 transition-all"
                              >
                                <div className="text-sm font-medium text-orange-600 mb-2 flex items-center">
                                  Color Grouping (Optional)
                                  <span className="ml-1 text-xs text-gray-500">- Any field</span>
                                </div>
                                {effectiveDataMapping?.color ? (
                                  <div className="flex items-center justify-between p-2 bg-orange-100 border border-orange-300 rounded">
                                    <span className="text-sm text-orange-800">{effectiveDataMapping.color}</span>
                                    <button
                                      onClick={() => {
                                        handleUpdate({
                                          dataMapping: {
                                            ...customization?.dataMapping,
                                            color: undefined
                                          }
                                        })
                                      }}
                                      className="text-orange-600 hover:text-orange-800 text-xs"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-center py-2 text-gray-500 text-sm">
                                    Drop a field to group by color
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pie Chart Data Mapping */}
                    {effectiveChartType === 'pie' && (
                      <div className="flex gap-6">
                        {/* Available Fields for Pie Chart */}
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col, index) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'

                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        {/* Pie Chart Drop Zones */}
                        <div className="flex-1 space-y-4">
                          {/* Category Drop Zone */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-purple-400', 'bg-purple-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    category: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Category Field</div>
                            {effectiveDataMapping?.category ? (
                              <div className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                <span className="text-sm text-purple-800">{effectiveDataMapping.category}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      category: undefined
                                    }
                                  })}
                                  className="text-purple-600 hover:text-purple-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left
                              </div>
                            )}
                          </div>

                          {/* Value Drop Zone */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-orange-400', 'bg-orange-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-orange-400', 'bg-orange-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-orange-400', 'bg-orange-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                // Prefer numeric fields for values
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Value Field (Optional)</div>
                            {effectiveDataMapping?.value ? (
                              <div className="flex items-center justify-between p-2 bg-orange-100 border border-orange-300 rounded">
                                <span className="text-sm text-orange-800">{effectiveDataMapping.value}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: undefined
                                    }
                                  })}
                                  className="text-orange-600 hover:text-orange-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left (optional - counts occurrences if empty)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scorecard Data Mapping */}
                    {effectiveChartType === 'scorecard' && (
                      <div className="space-y-6">
                        {/* Available Fields for Scorecard */}
                        <div>
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.numeric.map((col, index) => {
                                const columnType = 'number'
                                const icon = '🔢'

                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Metric Drop Zone */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50')
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50')
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50')
                            try {
                              const data = JSON.parse(e.dataTransfer.getData('application/json'))
                              if (data.fieldType === 'number') {
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    metric: data.fieldName
                                  }
                                })
                              }
                            } catch (error) {
                              console.error('Failed to parse drop data:', error)
                            }
                          }}
                          className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                        >
                          <div className="text-sm font-medium text-gray-600 mb-2">Metric Field</div>
                          {effectiveDataMapping?.metric ? (
                            <div className="flex items-center justify-between p-2 bg-indigo-100 border border-indigo-300 rounded">
                              <span className="text-sm text-indigo-800">{effectiveDataMapping.metric}</span>
                              <button
                                onClick={() => handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    metric: undefined
                                  }
                                })}
                                className="text-indigo-600 hover:text-indigo-800 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-3 text-gray-500 text-sm">
                              Drop a numeric field here for the metric
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Table Data Mapping */}
                    {effectiveChartType === 'table' && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Columns to Display</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {availableColumns.map(col => {
                            // Use effectiveDataMapping.columns for existing table data, default to all columns
                            const currentColumns = effectiveDataMapping?.columns || availableColumns
                            const isSelected = currentColumns.includes(col)

                            return (
                              <label key={col} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let newColumns: string[]
                                    if (e.target.checked) {
                                      newColumns = [...currentColumns, col]
                                    } else {
                                      newColumns = currentColumns.filter((c: string) => c !== col)
                                    }

                                    handleUpdate({
                                      dataMapping: {
                                        ...customization?.dataMapping,
                                        columns: newColumns.length === availableColumns.length ? undefined : newColumns
                                      }
                                    })
                                  }}
                                  className="rounded border-gray-300 text-primary focus:ring-primary focus:border-primary"
                                />
                                <span className="text-sm">{col}</span>
                              </label>
                            )
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Select which columns to display in the table
                        </p>
                      </div>
                    )}

                    {/* Waterfall Chart Data Mapping */}
                    {effectiveChartType === 'waterfall' && (
                      <div className="flex gap-6">
                        {/* Available Fields for Waterfall Chart */}
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col, index) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'

                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        {/* Waterfall Chart Drop Zones */}
                        <div className="flex-1 space-y-4">
                          {/* Category Drop Zone */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    category: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Category Field (Required)</div>
                            {effectiveDataMapping?.category ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.category}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      category: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for categories (X-axis)
                              </div>
                            )}
                          </div>

                          {/* Value Drop Zone */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                // Prefer numeric fields for values
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Value Field (Required - Numeric Only)</div>
                            {effectiveDataMapping?.value ? (
                              <div className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                <span className="text-sm text-green-800">{effectiveDataMapping.value}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: undefined
                                    }
                                  })}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a numeric field from the left for values
                              </div>
                            )}
                          </div>

                          {/* Type Drop Zone (Optional) */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-purple-400', 'bg-purple-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    type: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-purple-600 mb-2">Type Field (Optional)</div>
                            {effectiveDataMapping?.type ? (
                              <div className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                <span className="text-sm text-purple-800">{effectiveDataMapping.type}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      type: undefined
                                    }
                                  })}
                                  className="text-purple-600 hover:text-purple-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left to indicate increase/decrease/total (optional)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Funnel Chart Data Mapping */}
                    {effectiveChartType === 'funnel' && (
                      <div className="flex gap-6">
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'
                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    stage: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Stage Field (Required)</div>
                            {effectiveDataMapping?.stage ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.stage}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      stage: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for funnel stages
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Value Field (Required - Numeric)</div>
                            {effectiveDataMapping?.value ? (
                              <div className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                <span className="text-sm text-green-800">{effectiveDataMapping.value}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: undefined
                                    }
                                  })}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a numeric field from the left for values
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Heatmap Chart Data Mapping */}
                    {effectiveChartType === 'heatmap' && (
                      <div className="flex gap-6">
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'
                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    xAxis: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">X-Axis Field (Required)</div>
                            {effectiveDataMapping?.xAxis ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.xAxis}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      xAxis: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for X-axis
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    yAxis: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Y-Axis Field (Required)</div>
                            {effectiveDataMapping?.yAxis ? (
                              <div className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                <span className="text-sm text-green-800">{effectiveDataMapping.yAxis}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      yAxis: undefined
                                    }
                                  })}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for Y-axis
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-purple-400', 'bg-purple-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Value Field (Required - Numeric)</div>
                            {effectiveDataMapping?.value ? (
                              <div className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                <span className="text-sm text-purple-800">{effectiveDataMapping.value}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: undefined
                                    }
                                  })}
                                  className="text-purple-600 hover:text-purple-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a numeric field from the left for intensity values
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Gauge Chart Data Mapping */}
                    {effectiveChartType === 'gauge' && (
                      <div className="space-y-6">
                        {/* Metric Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Metric Field (Required)
                          </label>
                          <div
                            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 min-h-[60px] bg-gray-50 dark:bg-gray-800"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fieldName = e.dataTransfer.getData('text/plain')
                              if (fieldName) {
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    metric: fieldName
                                  }
                                })
                              }
                            }}
                          >
                            {effectiveDataMapping?.metric ? (
                              <div className="flex items-center justify-between bg-white dark:bg-gray-700 px-3 py-2 rounded">
                                <span className="text-sm font-medium">{effectiveDataMapping.metric}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      metric: undefined
                                    }
                                  })}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                Drag a numeric field here
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Aggregation Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Aggregation (Required)
                          </label>
                          <select
                            value={effectiveDataMapping?.aggregation || 'sum'}
                            onChange={(e) => handleUpdate({
                              dataMapping: {
                                ...customization?.dataMapping,
                                aggregation: e.target.value as 'sum' | 'average' | 'median' | 'min' | 'max' | 'count'
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="sum">Sum</option>
                            <option value="average">Average</option>
                            <option value="median">Median</option>
                            <option value="min">Minimum</option>
                            <option value="max">Maximum</option>
                            <option value="count">Count</option>
                          </select>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            How to aggregate the metric across all rows
                          </p>
                        </div>

                        {/* Max Value Input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Maximum Value (Required)
                          </label>
                          <input
                            type="number"
                            value={(customization as any)?.max || ''}
                            onChange={(e) => handleUpdate({
                              max: e.target.value ? Number(e.target.value) : undefined
                            })}
                            placeholder="e.g., 100000"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            The maximum value for the gauge (100% mark)
                          </p>
                        </div>

                        {/* Min Value Input (Optional) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Minimum Value (Optional)
                          </label>
                          <input
                            type="number"
                            value={(customization as any)?.min !== undefined ? (customization as any)?.min : 0}
                            onChange={(e) => handleUpdate({
                              min: e.target.value ? Number(e.target.value) : 0
                            })}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            The minimum value for the gauge (0% mark). Default: 0
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Cohort Chart Data Mapping */}
                    {effectiveChartType === 'cohort' && (
                      <div className="flex gap-6">
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'
                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    cohort: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Cohort Field (Required)</div>
                            {effectiveDataMapping?.cohort ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.cohort}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      cohort: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for cohort identifier
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    period: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Period Field (Required)</div>
                            {effectiveDataMapping?.period ? (
                              <div className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                <span className="text-sm text-green-800">{effectiveDataMapping.period}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      period: undefined
                                    }
                                  })}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for time period
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-purple-400', 'bg-purple-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Value Field (Required - Numeric)</div>
                            {effectiveDataMapping?.value ? (
                              <div className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                <span className="text-sm text-purple-800">{effectiveDataMapping.value}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: undefined
                                    }
                                  })}
                                  className="text-purple-600 hover:text-purple-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a numeric field from the left for retention percentage
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bullet Chart Data Mapping */}
                    {effectiveChartType === 'bullet' && (
                      <div className="space-y-6">
                        <div>
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'
                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-purple-400', 'bg-purple-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    category: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Category Field (Optional)</div>
                            {effectiveDataMapping?.category ? (
                              <div className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                <span className="text-sm text-purple-800">{effectiveDataMapping.category}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      category: undefined
                                    }
                                  })}
                                  className="text-purple-600 hover:text-purple-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                Drop a field for categories (optional)
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      actual: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Actual Field (Required - Numeric)</div>
                            {effectiveDataMapping?.actual ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.actual}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      actual: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                Drop a numeric field for actual value
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      comparative: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Comparative/Target Field (Required - Numeric)</div>
                            {effectiveDataMapping?.comparative ? (
                              <div className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                <span className="text-sm text-green-800">{effectiveDataMapping.comparative}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      comparative: undefined
                                    }
                                  })}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                Drop a numeric field for comparative/target value
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Treemap Chart Data Mapping */}
                    {effectiveChartType === 'treemap' && (
                      <div className="flex gap-6">
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'
                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    category: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Category Field (Required)</div>
                            {effectiveDataMapping?.category ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.category}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      category: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for categories
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Value Field (Required - Numeric)</div>
                            {effectiveDataMapping?.value ? (
                              <div className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                <span className="text-sm text-green-800">{effectiveDataMapping.value}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: undefined
                                    }
                                  })}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a numeric field from the left for size values
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sankey Chart Data Mapping */}
                    {effectiveChartType === 'sankey' && (
                      <div className="flex gap-6">
                        <div className="w-1/3 flex-shrink-0">
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'
                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
                            <span className="mr-1">💡</span>
                            Tip: Drag fields to the right →
                          </p>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    source: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Source Field (Required)</div>
                            {effectiveDataMapping?.source ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.source}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      source: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for source nodes
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-green-400', 'bg-green-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-green-400', 'bg-green-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                handleUpdate({
                                  dataMapping: {
                                    ...customization?.dataMapping,
                                    target_node: data.fieldName
                                  }
                                })
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Target Field (Required)</div>
                            {effectiveDataMapping?.target_node ? (
                              <div className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                <span className="text-sm text-green-800">{effectiveDataMapping.target_node}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      target_node: undefined
                                    }
                                  })}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a field from the left for target nodes
                              </div>
                            )}
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-purple-400', 'bg-purple-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Value Field (Required - Numeric)</div>
                            {effectiveDataMapping?.value ? (
                              <div className="flex items-center justify-between p-2 bg-purple-100 border border-purple-300 rounded">
                                <span className="text-sm text-purple-800">{effectiveDataMapping.value}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      value: undefined
                                    }
                                  })}
                                  className="text-purple-600 hover:text-purple-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                <span className="block text-lg mb-1">👈</span>
                                Drag a numeric field from the left for flow values
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sparkline Chart Data Mapping */}
                    {effectiveChartType === 'sparkline' && (
                      <div className="space-y-6">
                        <div>
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-1 gap-2">
                              {columnsByType.all.map((col) => {
                                const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
                                const icon = columnType === 'number' ? '🔢' : columnType === 'date' ? '📅' : '📝'
                                return (
                                  <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        fieldName: col,
                                        fieldType: columnType
                                      }))
                                    }}
                                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
                                  >
                                    <span className="text-xs">{icon}</span>
                                    <span className="text-sm font-medium text-gray-700">{col}</span>
                                    <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                if (data.fieldType === 'number') {
                                  handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      trend: data.fieldName
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Failed to parse drop data:', error)
                              }
                            }}
                            className="min-h-16 border-2 border-dashed border-gray-300 rounded-lg p-3 transition-all"
                          >
                            <div className="text-sm font-medium text-gray-600 mb-2">Trend Field (Required - Numeric)</div>
                            {effectiveDataMapping?.trend ? (
                              <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded">
                                <span className="text-sm text-blue-800">{effectiveDataMapping.trend}</span>
                                <button
                                  onClick={() => handleUpdate({
                                    dataMapping: {
                                      ...customization?.dataMapping,
                                      trend: undefined
                                    }
                                  })}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-gray-500 text-sm">
                                Drop a numeric field for sparkline trend
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Data Preview */}
                    <div className="pt-2 border-t border-gray-200">
                      <label className="text-sm font-medium mb-2 block">Data Preview</label>
                      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-medium">Total Columns:</span> {availableColumns.length}
                          </div>
                          <div>
                            <span className="font-medium">Numeric:</span> {columnsByType.numeric.length}
                          </div>
                          <div>
                            <span className="font-medium">Text/Category:</span> {columnsByType.text.length}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span> {columnsByType.date.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Generate Chart Button */}
                    <div className="pt-4 border-t border-gray-200 bg-white sticky bottom-0">
                      <Button
                        onClick={() => {
                          // Validate required fields first
                          const mapping = customization?.dataMapping || {}
                          let isValid = false
                          let missingFields = ''

                          // Use effectiveChartType to account for customization changes
                          const validationChartType = customization?.chartType || chartType

                          console.log('🔍 [VALIDATION] Validating chart:', {
                            validationChartType,
                            mapping,
                            hasMapping: Object.keys(mapping).length > 0
                          })

                          switch (validationChartType) {
                            case 'line':
                            case 'bar':
                              isValid = !!(mapping.xAxis || mapping.category)
                              if (!isValid) missingFields = 'Please select an X-axis field'
                              break
                            case 'area':
                              // Area charts need both X-axis AND Y-axis
                              const hasXAxisArea = !!(mapping.xAxis || mapping.category)
                              const hasYAxisArea = !!(mapping.yAxis || mapping.yAxis1 || mapping.values)
                              isValid = hasXAxisArea && hasYAxisArea
                              if (!hasXAxisArea) missingFields = 'Please select an X-axis field'
                              else if (!hasYAxisArea) missingFields = 'Please select a Y-axis field'
                              break
                            case 'scatter':
                              // Scatter charts need both X-axis AND Y-axis
                              const hasXAxisScatter = !!(mapping.xAxis || mapping.category)
                              const hasYAxisScatter = !!(mapping.yAxis || mapping.yAxis1 || mapping.values)
                              isValid = hasXAxisScatter && hasYAxisScatter
                              if (!hasXAxisScatter) missingFields = 'Please select an X-axis field'
                              else if (!hasYAxisScatter) missingFields = 'Please select a Y-axis field'
                              break
                            case 'pie':
                              isValid = !!mapping.category
                              if (!isValid) missingFields = 'Please select a category field'
                              break
                            case 'scorecard':
                              isValid = !!mapping.metric
                              if (!isValid) missingFields = 'Please select a metric field'
                              break
                            case 'table':
                              isValid = !!(mapping.columns && mapping.columns.length > 0) || !!mapping.yAxis
                              if (!isValid) missingFields = 'Please select at least one column'
                              break
                            case 'combo':
                              isValid = !!(mapping.xAxis && (mapping.yAxis || mapping.yAxis1))
                              if (!mapping.xAxis) missingFields = 'Please select an X-axis field'
                              else if (!mapping.yAxis && !mapping.yAxis1) missingFields = 'Please select at least one Y-axis field'
                              break
                            case 'waterfall':
                              isValid = !!(mapping.category && mapping.value)
                              if (!mapping.category) missingFields = 'Please select a category field'
                              else if (!mapping.value) missingFields = 'Please select a value field'
                              break
                            case 'funnel':
                              isValid = !!(mapping.stage && mapping.value)
                              if (!mapping.stage) missingFields = 'Please select a stage field'
                              else if (!mapping.value) missingFields = 'Please select a value field'
                              break
                            case 'heatmap':
                              isValid = !!(mapping.xAxis && mapping.yAxis && mapping.value)
                              if (!mapping.xAxis) missingFields = 'Please select an X-axis field'
                              else if (!mapping.yAxis) missingFields = 'Please select a Y-axis field'
                              else if (!mapping.value) missingFields = 'Please select a value field'
                              break
                            case 'gauge':
                              isValid = !!mapping.value
                              if (!isValid) missingFields = 'Please select a value field'
                              break
                            case 'cohort':
                              isValid = !!(mapping.cohort && mapping.period && mapping.value)
                              if (!mapping.cohort) missingFields = 'Please select a cohort field'
                              else if (!mapping.period) missingFields = 'Please select a period field'
                              else if (!mapping.value) missingFields = 'Please select a value field'
                              break
                            case 'bullet':
                              isValid = !!(mapping.actual && mapping.comparative)
                              if (!mapping.actual) missingFields = 'Please select an actual field'
                              else if (!mapping.comparative) missingFields = 'Please select a comparative field'
                              break
                            case 'treemap':
                              isValid = !!(mapping.category && mapping.value)
                              if (!mapping.category) missingFields = 'Please select a category field'
                              else if (!mapping.value) missingFields = 'Please select a value field'
                              break
                            case 'sankey':
                              isValid = !!(mapping.source && mapping.target_node && mapping.value)
                              if (!mapping.source) missingFields = 'Please select a source field'
                              else if (!mapping.target_node) missingFields = 'Please select a target field'
                              else if (!mapping.value) missingFields = 'Please select a value field'
                              break
                            case 'sparkline':
                              isValid = !!mapping.trend
                              if (!isValid) missingFields = 'Please select a trend field'
                              break
                            default:
                              isValid = true
                          }

                          if (!isValid) {
                            // Show a more user-friendly error message
                            console.warn('⚠️ [CUSTOMIZATION_PANEL] Validation failed:', missingFields)

                            // You could replace this with a toast notification in a real app
                            const errorMessage = missingFields || 'Please configure required data fields before generating the chart'
                            alert(errorMessage)
                            return
                          }

                          // CRITICAL: If this is a draft chart, commit it to the dashboard
                          if (isDraftChart) {
                            debug.panel('✅ [CUSTOMIZATION_PANEL] Committing draft chart to dashboard')
                            commitDraftChart()
                          }

                          // Close the panel to show the updated/new chart
                          setIsOpen(false)
                          // Log the action
                          addToHistory(isDraftChart ? 'chart_created' : 'chart_data_updated', { chartId, dataMapping: customization?.dataMapping })
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        size="lg"
                        disabled={!customization?.dataMapping || Object.keys(customization.dataMapping).length === 0}
                      >
                        <Database className="h-4 w-4 mr-2" />
                        {isDraftChart ? 'Generate Chart' : 'Update Chart'}
                      </Button>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {customization?.dataMapping && Object.keys(customization.dataMapping).length > 0
                          ? isDraftChart
                            ? 'Click to add this chart to your dashboard'
                            : 'Click to apply your data selections and update the chart'
                          : 'Configure required fields above before generating'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'style' && (
              <div className="space-y-4">
                {/* Theme */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['default', 'light', 'dark'] as const).map(theme => (
                      <button
                        key={theme}
                        onClick={() => handleUpdate({ theme })}
                        className={cn(
                          'px-3 py-2 rounded border text-sm capitalize transition-colors',
                          (customization?.theme || 'default') === theme
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Colors */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Chart Colors</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(customization?.colors || ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']).map((color, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-xs w-6">{index + 1}:</span>
                        <ColorPicker
                          value={color}
                          onChange={(newColor) => {
                            const newColors = [...(customization?.colors || ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'])]
                            newColors[index] = newColor
                            handleUpdate({ colors: newColors })
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Show Legend</span>
                  <button
                    onClick={() => handleUpdate({ showLegend: !(customization?.showLegend ?? true) })}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative',
                      (customization?.showLegend ?? true) ? 'bg-primary' : 'bg-gray-300'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                        (customization?.showLegend ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
                
                {/* Grid */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Show Grid</span>
                  <button
                    onClick={() => handleUpdate({ showGrid: !(customization?.showGrid ?? true) })}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative',
                      (customization?.showGrid ?? true) ? 'bg-primary' : 'bg-gray-300'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                        (customization?.showGrid ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'axes' && (
              <div className="space-y-4">
                {/* X-Axis Label */}
                <div>
                  <label className="text-sm font-medium mb-1 block">X-Axis Label</label>
                  <input
                    type="text"
                    value={customization?.axisLabels?.x || ''}
                    onChange={(e) => handleUpdate({
                      axisLabels: {
                        ...customization?.axisLabels,
                        x: e.target.value
                      }
                    })}
                    placeholder="X-axis label"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>

                {/* Y-Axis Label */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Y-Axis Label</label>
                  <input
                    type="text"
                    value={customization?.axisLabels?.y || ''}
                    onChange={(e) => handleUpdate({
                      axisLabels: {
                        ...customization?.axisLabels,
                        y: e.target.value
                      }
                    })}
                    placeholder="Y-axis label"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>

                {/* Label Rotation */}
                <div>
                  <label className="text-sm font-medium mb-2 block">X-Axis Label Rotation</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['auto', 'horizontal', 'diagonal', 'vertical'] as const).map(rotation => (
                      <button
                        key={rotation}
                        onClick={() => handleUpdate({ labelRotation: rotation })}
                        className={cn(
                          'px-3 py-2 rounded border text-sm capitalize transition-colors',
                          (customization?.labelRotation || 'auto') === rotation
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {rotation}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Auto rotation adjusts based on label length automatically
                  </p>
                </div>

                {/* Auto Sizing */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Auto Sizing</span>
                    <p className="text-xs text-gray-500">Automatically adjust chart size based on data</p>
                  </div>
                  <button
                    onClick={() => handleUpdate({ autoSize: !(customization?.autoSize ?? true) })}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative',
                      (customization?.autoSize ?? true) ? 'bg-primary' : 'bg-gray-300'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                        (customization?.autoSize ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'actions' && (
              <div className="space-y-4">
                {/* Export Options */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Export Chart</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportChart('png')}
                      className="text-xs flex items-center justify-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      PNG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportChart('pdf')}
                      className="text-xs flex items-center justify-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportChart('svg')}
                      className="text-xs flex items-center justify-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      SVG
                    </Button>
                  </div>
                </div>
                
                {/* Chart Actions */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Chart Actions</label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDuplicateChart}
                      className="w-full justify-start text-xs"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Duplicate Chart
                    </Button>
                  </div>
                </div>
                
                {/* Advanced Options */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Advanced</label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Animation</span>
                      <button
                        onClick={() => handleUpdate({ animate: !(customization as any)?.animate })}
                        className={cn(
                          'w-8 h-4 rounded-full transition-colors relative',
                          (customization as any)?.animate ? 'bg-primary' : 'bg-gray-300'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                            (customization as any)?.animate ? 'translate-x-4' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Interactive</span>
                      <button
                        onClick={() => handleUpdate({ interactive: !(customization as any)?.interactive })}
                        className={cn(
                          'w-8 h-4 rounded-full transition-colors relative',
                          (customization as any)?.interactive !== false ? 'bg-primary' : 'bg-gray-300'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                            (customization as any)?.interactive !== false ? 'translate-x-4' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
          </CardContent>
        </Card>
        </>,
        document.body
      )}
    </div>
  )
}