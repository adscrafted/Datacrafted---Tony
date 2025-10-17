'use client'

import React, { useState } from 'react'
import { Settings, X, BarChart3, LineChart, PieChart, AreaChart, ScatterChart, Database, Calendar, Hash, Type, Layers, ChevronRight, Filter, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useDataStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'

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
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">{title}</h4>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "min-h-[80px] rounded-lg border-2 border-dashed p-3 transition-all",
          isDragOver ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50",
          fields.length === 0 && "flex items-center justify-center"
        )}
      >
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">{placeholder}</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => (
              <div
                key={field}
                className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 border border-gray-200"
              >
                <span className="text-sm">{field}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(field)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface FilterItemProps {
  filter: {
    field: string
    operator: string
    value: string
  }
  fields: Array<{ name: string; type: string }>
  onUpdate: (filter: any) => void
  onRemove: () => void
  hideFieldSelection?: boolean
}

function FilterItem({ filter, fields, onUpdate, onRemove, hideFieldSelection = false }: FilterItemProps) {
  const operators = {
    string: ['equals', 'contains', 'starts with', 'ends with', 'is empty', 'is not empty'],
    number: ['equals', 'not equals', 'greater than', 'less than', 'greater or equal', 'less or equal', 'between'],
    date: ['equals', 'before', 'after', 'between', 'last N days', 'next N days']
  }

  const selectedField = fields.find(f => f.name === filter.field)
  const fieldType = selectedField?.type || 'string'
  const availableOperators = operators[fieldType as keyof typeof operators] || operators.string

  // Get field type icon
  const getFieldIcon = (type: string) => {
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
    <div className="space-y-3">
      {/* Header with field info and remove button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {hideFieldSelection ? `Filter: ${filter.field}` : 'Filter Rule'}
          </span>
          {selectedField && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              {getFieldIcon(fieldType)}
              <span>{fieldType}</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
          title="Remove filter"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Filter controls in vertical layout for better space utilization */}
      <div className="grid grid-cols-1 gap-3">
        {/* Field selection - only show if not hidden */}
        {!hideFieldSelection && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Field</label>
            <Select value={filter.field} onValueChange={(value) => onUpdate({ ...filter, field: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a field to filter" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[100]">
                {fields.map((field) => (
                  <SelectItem key={field.name} value={field.name}>
                    <div className="flex items-center space-x-2">
                      {getFieldIcon(field.type)}
                      <span>{field.name}</span>
                      <span className="text-xs text-gray-500">({field.type})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Operator selection */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Condition</label>
          <Select value={filter.operator} onValueChange={(value) => onUpdate({ ...filter, operator: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose condition" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[100]">
              {availableOperators.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Value input */}
        {!['is empty', 'is not empty'].includes(filter.operator) && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Value</label>
            <Input
              value={filter.value}
              onChange={(e) => onUpdate({ ...filter, value: e.target.value })}
              placeholder={`Enter ${fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'} value`}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function ChartSettingsPanel({ chartId, isOpen, onClose, chartConfig, onConfigUpdate }: ChartSettingsPanelProps) {
  const { rawData, dataSchema } = useDataStore()
  const [config, setConfig] = useState({
    type: chartConfig?.type || 'bar',
    title: chartConfig?.title || '',
    description: chartConfig?.description || '',
    dimensions: chartConfig?.dimensions || [],
    metrics: chartConfig?.metrics || [],
    filters: chartConfig?.filters || [],
    sort: chartConfig?.sort || {
      field: '',
      direction: 'asc' // 'asc' or 'desc'
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
    const newConfig = { 
      ...config, 
      dimensions: config.dimensions.filter((d: string) => d !== field) 
    }
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
    const newConfig = { 
      ...config, 
      metrics: config.metrics.filter((m: string) => m !== field) 
    }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleAddFilter = () => {
    const newFilter = {
      field: '',
      operator: 'equals',
      value: ''
    }
    const newConfig = { ...config, filters: [...config.filters, newFilter] }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleFilterFieldDrop = (field: string) => {
    // Create a new filter with the dropped field
    const fieldData = allFields.find(f => f.name === field)
    const newFilter = {
      field: field,
      operator: fieldData?.type === 'number' ? 'equals' : fieldData?.type === 'date' ? 'equals' : 'contains',
      value: ''
    }
    const newConfig = { ...config, filters: [...config.filters, newFilter] }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleFilterFieldRemove = (field: string) => {
    const newFilters = config.filters.filter((f: any) => f.field !== field)
    const newConfig = { ...config, filters: newFilters }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleUpdateFilter = (index: number, updatedFilter: any) => {
    const newFilters = [...config.filters]
    newFilters[index] = updatedFilter
    const newConfig = { ...config, filters: newFilters }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleRemoveFilter = (index: number) => {
    const newFilters = config.filters.filter((_: any, i: number) => i !== index)
    const newConfig = { ...config, filters: newFilters }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleChartTypeChange = (type: string) => {
    const newConfig = { ...config, type }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleSortFieldChange = (field: string) => {
    const actualField = field === "none" ? "" : field
    const newConfig = { 
      ...config, 
      sort: { ...config.sort, field: actualField } 
    }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }

  const handleSortDirectionChange = (direction: 'asc' | 'desc') => {
    const newConfig = { 
      ...config, 
      sort: { ...config.sort, direction } 
    }
    setConfig(newConfig)
    onConfigUpdate(newConfig)
  }


  // Get schema fields
  const schemaFields = dataSchema?.columns || []
  const allFields = schemaFields.map(col => ({ name: col.name, type: col.type }))
  const dateFields = schemaFields.filter(col => col.type === 'date')
  const numericFields = schemaFields.filter(col => col.type === 'number')
  const textFields = schemaFields.filter(col => col.type === 'string' || col.type === 'categorical')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-[900px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
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
            <div className="h-full flex">
              {/* Left Column - Configuration (made wider for filters) */}
              <div className="w-3/5 border-r">
                <ScrollArea className="h-full">
                  <div className="p-6 space-y-6">
                        {/* Chart Type Dropdown */}
                        <div>
                          <Label htmlFor="chart-type">Chart Type</Label>
                          <Select value={config.type} onValueChange={handleChartTypeChange}>
                            <SelectTrigger id="chart-type" className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {chartTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    <type.icon className="h-4 w-4" />
                                    <span>{type.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Separator />

                        {/* Title and Description */}
                        <div className="space-y-4">
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

                        <Separator />
                        
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

                        <Separator />

                        {/* Filters with Drag & Drop */}
                        <div className="space-y-4">
                          <DropZone
                            title="Filters"
                            description="Drag fields here to filter your data"
                            fields={config.filters.map((f: any) => f.field).filter((f: string) => f)}
                            onDrop={handleFilterFieldDrop}
                            onRemove={handleFilterFieldRemove}
                            allowMultiple={true}
                            placeholder="Drag filter fields here"
                          />
                          
                          {/* Filter Configuration */}
                          {config.filters.length > 0 && (
                            <div className="space-y-3">
                              <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                Filter Configuration
                              </h5>
                              {config.filters.map((filter: any, index: number) => (
                                filter.field && (
                                  <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <FilterItem
                                      filter={filter}
                                      fields={allFields}
                                      onUpdate={(updatedFilter) => handleUpdateFilter(index, updatedFilter)}
                                      onRemove={() => handleRemoveFilter(index)}
                                      hideFieldSelection={true}
                                    />
                                  </div>
                                )
                              ))}
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Sort Section */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <ArrowUpDown className="h-4 w-4" />
                              Sort
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">Order your data</p>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3">
                            {/* Sort Field Selection */}
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-gray-600">Sort by</Label>
                              <Select value={config.sort.field || "none"} onValueChange={handleSortFieldChange}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select field to sort by" />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-[100]">
                                  <SelectItem value="none">No sorting</SelectItem>
                                  {/* Dimension fields */}
                                  {config.dimensions.length > 0 && (
                                    <>
                                      <SelectItem disabled value="dimensions-header" className="font-medium text-xs text-gray-500 uppercase tracking-wider">
                                        Dimensions
                                      </SelectItem>
                                      {config.dimensions.map((dim: string) => (
                                        <SelectItem key={`dim-${dim}`} value={dim}>
                                          <div className="flex items-center space-x-2">
                                            <Type className="h-3 w-3 text-orange-500" />
                                            <span>{dim}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </>
                                  )}
                                  {/* Metric fields */}
                                  {config.metrics.length > 0 && (
                                    <>
                                      <SelectItem disabled value="metrics-header" className="font-medium text-xs text-gray-500 uppercase tracking-wider">
                                        Metrics
                                      </SelectItem>
                                      {config.metrics.map((metric: string) => (
                                        <SelectItem key={`metric-${metric}`} value={metric}>
                                          <div className="flex items-center space-x-2">
                                            <Hash className="h-3 w-3 text-green-500" />
                                            <span>{metric}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Sort Direction */}
                            {config.sort.field && (
                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-gray-600">Sort order</Label>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant={config.sort.direction === 'asc' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleSortDirectionChange('asc')}
                                    className="flex-1 h-8"
                                  >
                                    <ArrowUp className="h-3 w-3 mr-1" />
                                    Ascending
                                  </Button>
                                  <Button
                                    variant={config.sort.direction === 'desc' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleSortDirectionChange('desc')}
                                    className="flex-1 h-8"
                                  >
                                    <ArrowDown className="h-3 w-3 mr-1" />
                                    Descending
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Sort Preview */}
                            {config.sort.field && (
                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <div className="flex items-center space-x-2 text-sm">
                                  <ArrowUpDown className="h-4 w-4 text-blue-600" />
                                  <span className="text-blue-800 font-medium">
                                    Sorting by: {config.sort.field}
                                  </span>
                                  <span className="text-blue-600">
                                    ({config.sort.direction === 'asc' ? 'Ascending' : 'Descending'})
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Right Column - Available Fields */}
                  <div className="w-2/5">
                    <ScrollArea className="h-full">
                      <div className="p-6">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Available Fields
                        </h3>
                        
                        <div className="space-y-6">
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
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
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
  )
}