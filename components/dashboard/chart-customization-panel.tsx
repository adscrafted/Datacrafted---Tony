'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Settings, Eye, EyeOff, Palette, Type, BarChart3, Move, Maximize2 as Resize, Copy, RotateCcw, Download, Save, Database, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { ChartCustomization, useDataStore } from '@/lib/store'

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
    console.log('🔍 [CUSTOMIZATION_PANEL] Auto-open useEffect triggered:', {
      chartId,
      autoOpen,
      prevAutoOpen: prevAutoOpenRef.current,
      isOpen,
      willOpen: autoOpen && !prevAutoOpenRef.current && !isOpen
    })

    // Only open if autoOpen is true AND it wasn't true before (edge trigger, not level trigger)
    if (autoOpen && !prevAutoOpenRef.current && !isOpen) {
      console.log('📂 [CUSTOMIZATION_PANEL] Auto-opening panel for chart:', chartId)
      setIsOpen(true)
    }
    prevAutoOpenRef.current = autoOpen
  }, [autoOpen, isOpen, chartId])

  // Allow external control of active tab via initialTab prop
  // IMPORTANT: Set tab when panel opens OR when initialTab changes
  React.useEffect(() => {
    if (initialTab && isOpen) {
      console.log('📂 [CUSTOMIZATION_PANEL] Setting active tab to:', initialTab)
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
      console.log('🗑️ [CUSTOMIZATION_PANEL] Canceling draft chart - clearing draft')
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

  const handleUpdate = (updates: Partial<ChartCustomization>) => {
    const newCustomization = {
      ...customization,
      ...updates,
      // Properly merge nested dataMapping object to preserve other fields
      dataMapping: updates.dataMapping ? {
        ...customization?.dataMapping,
        ...updates.dataMapping
      } : customization?.dataMapping,
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
          chartType: customization?.chartType || chartType,
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

      console.log('Generated title and description:', { title, description })
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
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] max-h-[80vh] overflow-hidden shadow-xl bg-white"
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
                        onClick={() => handleUpdate({ chartType: option.value })}
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
                    {(chartType === 'line' || chartType === 'bar' || chartType === 'area' || chartType === 'scatter' || chartType === 'combo') && (
                      <div className="space-y-6">
                        {/* Available Fields */}
                        <div>
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
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
                            Tip: Drag fields to X-axis and Y-axis zones below
                          </p>
                        </div>

                        {/* Drop Zones */}
                        <div className="grid grid-cols-1 gap-4">
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
                                <span className="block text-lg mb-1">⬇️</span>
                                Drop a field here for X-axis
                              </div>
                            )}
                          </div>

                          {/* Dual Y-Axis Drop Zones - for combo, bar, line, area, and scatter charts */}
                          {(chartType === 'combo' || chartType === 'bar' || chartType === 'line' || chartType === 'area' || chartType === 'scatter') ? (
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
                                      const currentYAxis1 = customization?.dataMapping?.yAxis1
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
                                          ...customization?.dataMapping,
                                          yAxis1: newYAxis1
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
                                {effectiveDataMapping?.yAxis1 && (Array.isArray(effectiveDataMapping.yAxis1) ? effectiveDataMapping.yAxis1.length > 0 : true) ? (
                                  <div className="space-y-2">
                                    {(Array.isArray(effectiveDataMapping.yAxis1) ? effectiveDataMapping.yAxis1 : [effectiveDataMapping.yAxis1]).map((field: string) => (
                                      <div key={field} className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                        <span className="text-sm text-green-800">{field}</span>
                                        <button
                                          onClick={() => {
                                            const currentYAxis1 = customization?.dataMapping?.yAxis1 || effectiveDataMapping?.yAxis1
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
                                                ...customization?.dataMapping,
                                                yAxis1: newYAxis1
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
                                    Drop numeric fields for left axis
                                  </div>
                                )}
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
                                      const currentYAxis2 = customization?.dataMapping?.yAxis2
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
                                    Drop numeric fields for right axis
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
                                  if (data.fieldType === 'number' || chartType === 'scatter') {
                                    const currentYAxis = customization?.dataMapping?.yAxis
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
                                // Support both yAxis and values formats (AI uses 'values', manual uses 'yAxis')
                                const yAxisData = effectiveDataMapping?.yAxis || effectiveDataMapping?.values
                                const hasData = yAxisData && (Array.isArray(yAxisData) ? yAxisData.length > 0 : true)

                                return hasData ? (
                                  <div className="space-y-2">
                                    {(Array.isArray(yAxisData) ? yAxisData : [yAxisData]).map((field: string, index: number) => (
                                      <div key={field} className="flex items-center justify-between p-2 bg-green-100 border border-green-300 rounded">
                                        <span className="text-sm text-green-800">{field}</span>
                                        <button
                                          onClick={() => {
                                            const currentYAxis = customization?.dataMapping?.yAxis || customization?.dataMapping?.values || effectiveDataMapping?.yAxis || effectiveDataMapping?.values
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
                                    <span className="block text-lg mb-1">⬇️</span>
                                    Drop numeric fields here for Y-axis
                                  </div>
                                )
                              })()}
                            </div>
                          )}

                          {/* Aggregation Method Selector - for bar/line/area/combo charts */}
                          {(chartType === 'bar' || chartType === 'line' || chartType === 'area' || chartType === 'combo') && (
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
                          {chartType === 'bar' && (
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
                        {chartType === 'scatter' && (
                          <div className="grid grid-cols-1 gap-4 mt-4">
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
                    {chartType === 'pie' && (
                      <div className="space-y-6">
                        {/* Available Fields for Pie Chart */}
                        <div>
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
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
                        </div>

                        {/* Pie Chart Drop Zones */}
                        <div className="grid grid-cols-1 gap-4">
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
                                Drop a field here for categories
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
                                Drop numeric field here (optional - counts occurrences if empty)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scorecard Data Mapping */}
                    {chartType === 'scorecard' && (
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
                    {chartType === 'table' && (
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
                    {chartType === 'waterfall' && (
                      <div className="space-y-6">
                        {/* Available Fields for Waterfall Chart */}
                        <div>
                          <label className="text-sm font-medium mb-3 block">Available Fields</label>
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
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
                            Tip: Drag fields to the zones below to configure your waterfall chart
                          </p>
                        </div>

                        {/* Waterfall Chart Drop Zones */}
                        <div className="grid grid-cols-1 gap-4">
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
                                <span className="block text-lg mb-1">⬇️</span>
                                Drop a field here for categories (X-axis)
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
                                <span className="block text-lg mb-1">⬇️</span>
                                Drop a numeric field here for values
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
                                <span className="block text-lg mb-1">⬇️</span>
                                Drop a field to indicate increase/decrease/total (optional)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Waterfall Chart Info */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-800 font-medium mb-1">About Waterfall Charts</p>
                          <p className="text-xs text-blue-700">
                            Waterfall charts show how an initial value is affected by a series of positive and negative values.
                            The type field can specify if each value is an "increase", "decrease", or "total".
                          </p>
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

                          switch (chartType) {
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
                            console.error('❌ [CUSTOMIZATION_PANEL] Validation failed:', missingFields)

                            // You could replace this with a toast notification in a real app
                            const errorMessage = missingFields || 'Please configure required data fields before generating the chart'
                            alert(errorMessage)
                            return
                          }

                          // CRITICAL: If this is a draft chart, commit it to the dashboard
                          if (isDraftChart) {
                            console.log('✅ [CUSTOMIZATION_PANEL] Committing draft chart to dashboard')
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