'use client'

import React, { useState, useRef } from 'react'
import { Settings, X, BarChart3, LineChart, PieChart, AreaChart, ScatterChart, Database, Calendar, Hash, Type, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useDataStore } from '@/lib/store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'

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
}

function DraggableField({ field, type, onDragStart }: DraggableFieldProps) {
  const getIcon = () => {
    switch (type) {
      case 'date':
        return <Calendar className="h-3 w-3" />
      case 'number':
        return <Hash className="h-3 w-3" />
      default:
        return <Type className="h-3 w-3" />
    }
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, field, type)}
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded cursor-move border border-gray-200 transition-colors"
    >
      {getIcon()}
      <span className="text-sm font-medium">{field}</span>
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
}

function DropZone({ title, fields, onDrop, onRemove, allowMultiple = false, placeholder = "Drag fields here" }: DropZoneProps) {
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
      <Label className="text-sm font-medium">{title}</Label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "min-h-[100px] p-3 border-2 border-dashed rounded-lg transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-gray-300",
          fields.length === 0 ? "flex items-center justify-center" : "space-y-2"
        )}
      >
        {fields.length === 0 ? (
          <span className="text-sm text-gray-500">{placeholder}</span>
        ) : (
          fields.map((field) => (
            <div
              key={field}
              className="flex items-center justify-between px-3 py-2 bg-white border rounded group"
            >
              <span className="text-sm">{field}</span>
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
        className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
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
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Tabs defaultValue="setup" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="setup">Setup</TabsTrigger>
                  <TabsTrigger value="style">Style</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                </TabsList>

                <TabsContent value="setup" className="space-y-6 mt-6">
                  {/* Chart Type */}
                  <div className="space-y-2">
                    <Label>Chart Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {chartTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => handleChartTypeChange(type.value)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors",
                            config.type === type.value 
                              ? "border-primary bg-primary/5" 
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <type.icon className="h-6 w-6" />
                          <span className="text-xs">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Available Fields */}
                  <div className="space-y-2">
                    <Label>Available Fields</Label>
                    <div className="space-y-3">
                      {dateFields.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Date Fields</p>
                          <div className="space-y-1">
                            {dateFields.map((field) => (
                              <DraggableField
                                key={field.name}
                                field={field.name}
                                type="date"
                                onDragStart={handleDragStart}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {numericFields.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Numeric Fields</p>
                          <div className="space-y-1">
                            {numericFields.map((field) => (
                              <DraggableField
                                key={field.name}
                                field={field.name}
                                type="number"
                                onDragStart={handleDragStart}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {textFields.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Text Fields</p>
                          <div className="space-y-1">
                            {textFields.map((field) => (
                              <DraggableField
                                key={field.name}
                                field={field.name}
                                type="string"
                                onDragStart={handleDragStart}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Drop Zones */}
                  <div className="space-y-4">
                    <DropZone
                      title="Dimensions"
                      fields={config.dimensions}
                      onDrop={handleDimensionDrop}
                      onRemove={handleDimensionRemove}
                      allowMultiple={true}
                      placeholder="Drag dimension fields here"
                    />
                    
                    <DropZone
                      title="Metrics"
                      fields={config.metrics}
                      onDrop={handleMetricDrop}
                      onRemove={handleMetricRemove}
                      allowMultiple={true}
                      placeholder="Drag metric fields here"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="style" className="space-y-6 mt-6">
                  {/* Chart Options */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-legend">Show Legend</Label>
                      <Switch
                        id="show-legend"
                        checked={config.options.showLegend}
                        onCheckedChange={(checked) => handleOptionChange('showLegend', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-grid">Show Grid Lines</Label>
                      <Switch
                        id="show-grid"
                        checked={config.options.showGrid}
                        onCheckedChange={(checked) => handleOptionChange('showGrid', checked)}
                      />
                    </div>
                    
                    {(config.type === 'bar' || config.type === 'area') && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="stacked">Stacked</Label>
                        <Switch
                          id="stacked"
                          checked={config.options.stacked}
                          onCheckedChange={(checked) => handleOptionChange('stacked', checked)}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="data" className="space-y-6 mt-6">
                  {/* Data Schema */}
                  <div className="space-y-2">
                    <Label>Data Schema</Label>
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {schemaFields.map((field) => (
                            <div key={field.name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Database className="h-3 w-3 text-gray-500" />
                                <span className="font-medium">{field.name}</span>
                              </div>
                              <span className="text-xs text-gray-500">{field.type}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t">
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