'use client'

import React, { useState } from 'react'
import { Settings, X, BarChart3, LineChart, PieChart, AreaChart, ScatterChart, Database, Calendar, Hash, Type, Layers, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useDataStore } from '@/lib/store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface ChartSettingsPanelProps {
  chartId: string
  isOpen: boolean
  onClose: () => void
  chartConfig: any
  onConfigUpdate: (config: any) => void
}

const chartTypes = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: LineChart },
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
  { value: 'area', label: 'Area Chart', icon: AreaChart },
  { value: 'scatter', label: 'Scatter Plot', icon: ScatterChart },
  { value: 'scorecard', label: 'Scorecard', icon: Hash },
]

interface DraggableFieldProps {
  field: string
  type: 'string' | 'number' | 'date'
  onDragStart: (e: React.DragEvent, field: string, type: string) => void
  description?: string
}

function DraggableField({ field, type, onDragStart, description }: DraggableFieldProps) {
  const getIcon = () => {
    switch (type) {
      case 'date':
        return <Calendar className="h-3 w-3 text-blue-500" />
      case 'number':
        return <Hash className="h-3 w-3 text-green-500" />
      default:
        return <Type className="h-3 w-3 text-orange-500" />
    }
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, field, type)}
      className="group flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 rounded-lg cursor-move border border-gray-200 hover:border-gray-300 transition-all hover:shadow-sm"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">{field}</span>
          {description && (
            <span className="text-xs text-gray-500 block truncate">{description}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

interface DropZoneProps {
  title: string
  fields: string[]
  onDrop: (field: string) => void
  onRemove: (field: string) => void
  allowMultiple?: boolean
  placeholder?: string
  description?: string
}

function DropZone({ title, fields, onDrop, onRemove, allowMultiple = false, placeholder = "Drag fields here", description }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const field = e.dataTransfer.getData('field')
    if (field && (allowMultiple || fields.length === 0)) {
      onDrop(field)
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-semibold">{title}</Label>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "min-h-[120px] p-3 border-2 border-dashed rounded-lg transition-all",
          isDragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-gray-300 bg-gray-50",
          fields.length === 0 ? "flex items-center justify-center" : "space-y-2"
        )}
      >
        {fields.length === 0 ? (
          <span className="text-sm text-gray-500">{placeholder}</span>
        ) : (
          fields.map((field) => (
            <div
              key={field}
              className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-md group hover:border-gray-300 transition-colors"
            >
              <span className="text-sm font-medium">{field}</span>
              <button
                onClick={() => onRemove(field)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-gray-500 hover:text-red-500" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ChartSettingsPanel({ chartId, isOpen, onClose, chartConfig, onConfigUpdate }: ChartSettingsPanelProps) {
  const { rawData, dataSchema } = useDataStore()
  const [config, setConfig] = useState({
    type: chartConfig.type || 'bar',
    title: chartConfig.title || '',
    description: chartConfig.description || '',
    dimensions: chartConfig.dimensions || [],
    metrics: chartConfig.metrics || [],
    dateRange: chartConfig.dateRange || null,
    filters: chartConfig.filters || [],
    options: chartConfig.options || {
      showLegend: true,
      showGrid: true,
      stacked: false,
    }
  })

  const handleDragStart = (e: React.DragEvent, field: string, type: string) => {
    e.dataTransfer.setData('field', field)
    e.dataTransfer.setData('fieldType', type)
  }

  const handleDimensionDrop = (field: string) => {
    if (!config.dimensions.includes(field)) {
      const newConfig = { ...config, dimensions: [...config.dimensions, field] }
      setConfig(newConfig)
      onConfigUpdate(newConfig)
    }
  }

  const handleDimensionRemove = (field: string) => {
    const newConfig = { ...config, dimensions: config.dimensions.filter((d: string) => d !== field) }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleMetricDrop = (field: string) => {
    if (!config.metrics.includes(field)) {
      const newConfig = { ...config, metrics: [...config.metrics, field] }
      setConfig(newConfig)
      onConfigUpdate(newConfig)
    }
  }

  const handleMetricRemove = (field: string) => {
    const newConfig = { ...config, metrics: config.metrics.filter((m: string) => m !== field) }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleChartTypeChange = (type: string) => {
    const newConfig = { ...config, type }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleOptionChange = (option: string, value: boolean) => {
    const newConfig = { 
      ...config, 
      options: { ...config.options, [option]: value } 
    }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  // Get schema fields
  const schemaFields = dataSchema?.columns || []
  const dateFields = schemaFields.filter(col => col.type === 'date')
  const numericFields = schemaFields.filter(col => col.type === 'number')
  const textFields = schemaFields.filter(col => col.type === 'string' || col.type === 'categorical')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="fixed right-0 top-0 h-full w-[800px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Chart Settings</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="data" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mx-4 mt-4" style={{ width: 'calc(100% - 2rem)' }}>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="chart">Chart Type</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
              </TabsList>

              <TabsContent value="data" className="flex-1 overflow-hidden mt-0">
                <div className="h-full flex">
                  {/* Left Column - Drop Zones */}
                  <div className="w-1/2 border-r">
                    <ScrollArea className="h-full">
                      <div className="p-6 space-y-6">
                        <div>
                          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            Chart Configuration
                          </h3>
                          
                          {/* Title and Description */}
                          <div className="space-y-4 mb-6">
                            <div>
                              <Label htmlFor="chart-title">Chart Title</Label>
                              <Input
                                id="chart-title"
                                value={config.title}
                                onChange={(e) => {
                                  const newConfig = { ...config, title: e.target.value }
                                  setConfig(newConfig)
                                  onConfigUpdate(newConfig)
                                }}
                                placeholder="Enter chart title"
                                className="mt-1"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="chart-description">Description</Label>
                              <Textarea
                                id="chart-description"
                                value={config.description}
                                onChange={(e) => {
                                  const newConfig = { ...config, description: e.target.value }
                                  setConfig(newConfig)
                                  onConfigUpdate(newConfig)
                                }}
                                placeholder="Enter chart description"
                                className="mt-1"
                                rows={2}
                              />
                            </div>
                          </div>
                          
                          {/* Drop Zones */}
                          <div className="space-y-6">
                            <DropZone
                              title="Dimensions"
                              description="Categories or groups for your data"
                              fields={config.dimensions}
                              onDrop={handleDimensionDrop}
                              onRemove={handleDimensionRemove}
                              allowMultiple={true}
                              placeholder="Drag dimension fields here"
                            />
                            
                            <DropZone
                              title="Metrics"
                              description="Numeric values to measure"
                              fields={config.metrics}
                              onDrop={handleMetricDrop}
                              onRemove={handleMetricRemove}
                              allowMultiple={true}
                              placeholder="Drag metric fields here"
                            />
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Right Column - Available Fields */}
                  <div className="w-1/2">
                    <ScrollArea className="h-full">
                      <div className="p-6">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Available Fields
                        </h3>
                        
                        <div className="space-y-6">
                          {dateFields.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Date Fields</p>
                              <div className="space-y-2">
                                {dateFields.map((field) => (
                                  <DraggableField
                                    key={field.name}
                                    field={field.name}
                                    type="date"
                                    onDragStart={handleDragStart}
                                    description={field.description}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {numericFields.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Numeric Fields</p>
                              <div className="space-y-2">
                                {numericFields.map((field) => (
                                  <DraggableField
                                    key={field.name}
                                    field={field.name}
                                    type="number"
                                    onDragStart={handleDragStart}
                                    description={field.description}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {textFields.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">Text Fields</p>
                              <div className="space-y-2">
                                {textFields.map((field) => (
                                  <DraggableField
                                    key={field.name}
                                    field={field.name}
                                    type="string"
                                    onDragStart={handleDragStart}
                                    description={field.description}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="chart" className="flex-1 p-6">
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold">Select Chart Type</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {chartTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => handleChartTypeChange(type.value)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 border-2 rounded-lg transition-all",
                          config.type === type.value 
                            ? "border-primary bg-primary/5 shadow-md" 
                            : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                        )}
                      >
                        <type.icon className="h-8 w-8" />
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="style" className="flex-1 p-6">
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold">Chart Options</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="show-legend">Show Legend</Label>
                        <p className="text-xs text-gray-500 mt-1">Display legend for data series</p>
                      </div>
                      <Switch
                        id="show-legend"
                        checked={config.options.showLegend}
                        onCheckedChange={(checked) => handleOptionChange('showLegend', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="show-grid">Show Grid Lines</Label>
                        <p className="text-xs text-gray-500 mt-1">Display grid lines on the chart</p>
                      </div>
                      <Switch
                        id="show-grid"
                        checked={config.options.showGrid}
                        onCheckedChange={(checked) => handleOptionChange('showGrid', checked)}
                      />
                    </div>
                    
                    {(config.type === 'bar' || config.type === 'area') && (
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="stacked">Stacked</Label>
                          <p className="text-xs text-gray-500 mt-1">Stack data series on top of each other</p>
                        </div>
                        <Switch
                          id="stacked"
                          checked={config.options.stacked}
                          onCheckedChange={(checked) => handleOptionChange('stacked', checked)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => {
                onConfigUpdate(config)
                onClose()
              }}>
                Apply Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}