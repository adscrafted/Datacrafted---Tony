'use client'

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Activity,
  Gauge,
  Table,
  Search,
  Plus,
  Filter,
  X
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDataStore } from '@/lib/stores/data-store'
import { useChartStore, type ChartTemplate } from '@/lib/stores/chart-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils/cn'
import { QualityIndicator } from './quality-indicator'

// Icon mapping for chart templates
const iconMap = {
  'BarChart3': BarChart3,
  'TrendingUp': TrendingUp,
  'PieChart': PieChart,
  'Activity': Activity,
  'Gauge': Gauge,
  'Table': Table,
  'Scatter': Activity, // Using Activity as fallback for scatter
} as const

interface ChartTemplateGalleryProps {
  isOpen: boolean
  onClose: () => void
  onChartAdded?: (chartId: string) => void
}

export const ChartTemplateGallery: React.FC<ChartTemplateGalleryProps> = ({
  isOpen,
  onClose,
  onChartAdded
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Get data from modular stores
  const rawData = useDataStore((state) => state.rawData)
  const availableColumns = useDataStore((state) => state.availableColumns)
  const dataSchema = useDataStore((state) => state.dataSchema)
  const chartTemplates = useChartStore((state) => state.chartTemplates)
  const addChart = useChartStore((state) => state.addChart)
  const setShowChartTemplateGallery = useUIStore((state) => state.setShowChartTemplateGallery)

  // Analyze available data types using schema (more accurate than raw data inspection)
  const dataTypeAnalysis = useMemo(() => {
    // If we have a schema, use it (most accurate)
    if (dataSchema?.columns) {
      const numberColumns = dataSchema.columns.filter(col => col.type === 'number')
      const stringColumns = dataSchema.columns.filter(col => col.type === 'string' || col.type === 'categorical')
      const dateColumns = dataSchema.columns.filter(col => col.type === 'date')

      return {
        hasNumbers: numberColumns.length > 0,
        hasStrings: stringColumns.length > 0,
        hasDates: dateColumns.length > 0,
        columnCount: dataSchema.columns.length,
        numberColumns: numberColumns.length,
        stringColumns: stringColumns.length,
        dateColumns: dateColumns.length
      }
    }

    // Fallback to raw data inspection if schema not available
    if (!rawData.length || !availableColumns.length) {
      return { hasNumbers: false, hasStrings: false, hasDates: false, columnCount: 0 }
    }

    const sampleRow = rawData[0]
    const numberColumns = availableColumns.filter(col => {
      const value = sampleRow[col]
      return typeof value === 'number' || !isNaN(Number(value))
    })
    const stringColumns = availableColumns.filter(col => {
      const value = sampleRow[col]
      return typeof value === 'string' && isNaN(Number(value))
    })
    const dateColumns = availableColumns.filter(col => {
      const value = sampleRow[col]
      if (!value) return false
      const datePattern = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}/
      if (typeof value === 'string' && datePattern.test(value)) return true
      if (value instanceof Date) return true
      if (!isNaN(Date.parse(String(value)))) return true
      return false
    })

    return {
      hasNumbers: numberColumns.length > 0,
      hasStrings: stringColumns.length > 0,
      hasDates: dateColumns.length > 0,
      columnCount: availableColumns.length,
      numberColumns: numberColumns.length,
      stringColumns: stringColumns.length,
      dateColumns: dateColumns.length
    }
  }, [dataSchema, rawData, availableColumns])

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    return chartTemplates.filter(template => {
      // Category filter
      if (selectedCategory !== 'all' && template.category !== selectedCategory) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = template.name.toLowerCase().includes(query)
        const matchesDescription = template.description.toLowerCase().includes(query)
        const matchesCategory = template.category.toLowerCase().includes(query)
        if (!matchesName && !matchesDescription && !matchesCategory) {
          return false
        }
      }

      return true
    })
  }, [chartTemplates, searchQuery, selectedCategory])

  // Calculate quality score for a template based on data compatibility
  const calculateTemplateQuality = (template: ChartTemplate): {
    score: number
    factors: {
      dataTypeMatch: number
      columnConfidence: number
      userCorrectionBoost: number
      clarityScore: number
    }
  } => {
    let dataTypeMatch = 0
    let columnConfidence = 25 // Default confidence
    const userCorrectionBoost = 0 // Not applicable for templates
    let clarityScore = 10 // Templates are generally clear

    // Data Type Match (0-40)
    switch (template.type) {
      case 'scorecard':
        if (dataTypeAnalysis.hasNumbers) {
          dataTypeMatch = 40
        } else {
          dataTypeMatch = 10
        }
        break

      case 'line':
      case 'area':
        if (dataTypeAnalysis.hasDates && dataTypeAnalysis.hasNumbers) {
          dataTypeMatch = 35
        } else if (dataTypeAnalysis.hasNumbers) {
          dataTypeMatch = 25
        } else {
          dataTypeMatch = 10
        }
        break

      case 'scatter':
        if ((dataTypeAnalysis.numberColumns ?? 0) >= 2) {
          dataTypeMatch = 35
        } else if ((dataTypeAnalysis.numberColumns ?? 0) >= 1) {
          dataTypeMatch = 20
        } else {
          dataTypeMatch = 10
        }
        break

      case 'bar':
        if (dataTypeAnalysis.hasStrings && dataTypeAnalysis.hasNumbers) {
          dataTypeMatch = 30
        } else if (dataTypeAnalysis.hasNumbers) {
          dataTypeMatch = 20
        } else {
          dataTypeMatch = 10
        }
        break

      case 'pie':
        if (dataTypeAnalysis.hasStrings && dataTypeAnalysis.hasNumbers) {
          const categoryCount = dataTypeAnalysis.stringColumns ?? 0
          if (categoryCount <= 7) {
            dataTypeMatch = 30
          } else if (categoryCount <= 12) {
            dataTypeMatch = 20
          } else {
            dataTypeMatch = 10
          }
        } else {
          dataTypeMatch = 10
        }
        break

      case 'table':
        dataTypeMatch = 25
        break

      default:
        dataTypeMatch = 20
    }

    // Column Confidence (0-30) - based on data quality
    if (dataTypeAnalysis.columnCount >= template.minColumns) {
      columnConfidence = 30
    } else {
      columnConfidence = Math.floor((dataTypeAnalysis.columnCount / template.minColumns) * 30)
    }

    // Clarity Score (0-10) - simpler charts score higher
    if (template.minColumns <= 2) {
      clarityScore = 10
    } else if (template.minColumns <= 4) {
      clarityScore = 7
    } else {
      clarityScore = 4
    }

    const score = Math.min(dataTypeMatch + columnConfidence + userCorrectionBoost + clarityScore, 100)

    return {
      score,
      factors: {
        dataTypeMatch,
        columnConfidence,
        userCorrectionBoost,
        clarityScore
      }
    }
  }

  // Check if template is compatible with current data
  const isTemplateCompatible = (template: ChartTemplate): boolean => {
    if (!dataTypeAnalysis.hasNumbers && template.requiredDataTypes.includes('number')) {
      return false
    }
    if (!dataTypeAnalysis.hasStrings && template.requiredDataTypes.includes('string')) {
      return false
    }
    if (dataTypeAnalysis.columnCount < template.minColumns) {
      return false
    }
    if (template.maxColumns && dataTypeAnalysis.columnCount > template.maxColumns * 2) {
      // Allow some flexibility for max columns
    }
    return true
  }

  // Get compatibility message
  const getCompatibilityMessage = (template: ChartTemplate): string | null => {
    if (dataTypeAnalysis.columnCount === 0) {
      return 'No data available'
    }

    if (template.requiredDataTypes.includes('number') && !dataTypeAnalysis.hasNumbers) {
      return 'Requires numeric columns'
    }

    if (template.requiredDataTypes.includes('string') && !dataTypeAnalysis.hasStrings) {
      return 'Requires text columns'
    }

    if (dataTypeAnalysis.columnCount < template.minColumns) {
      return `Requires at least ${template.minColumns} columns`
    }

    return null
  }

  const handleAddChart = (template: ChartTemplate) => {
    console.log('📊 [CHART_GALLERY] User selected chart template:', template.name)

    // Add the chart and get the returned chartId
    const chartId = addChart(template)
    console.log('📊 [CHART_GALLERY] Chart created with ID:', chartId)

    // SMOOTH UX: Delay gallery close slightly to show selection feedback
    // This creates a more natural transition: click → visual feedback → close → panel opens
    setTimeout(() => {
      onClose()
      console.log('📊 [CHART_GALLERY] Gallery closed')
    }, 100)

    // Call the callback to select and customize the new chart
    // This happens immediately - the panel will open while gallery is closing
    onChartAdded?.(chartId)
    console.log('📊 [CHART_GALLERY] Triggered onChartAdded callback')
  }

  const categories = [
    { value: 'all', label: 'All Charts' },
    { value: 'comparison', label: 'Comparison' },
    { value: 'distribution', label: 'Distribution' },
    { value: 'trend', label: 'Trends' },
    { value: 'relationship', label: 'Relationships' },
    { value: 'summary', label: 'Summary' }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Add New Chart</DialogTitle>
          <DialogDescription>
            Choose from our chart templates to visualize your data
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 py-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search charts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || selectedCategory !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Data Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Your Data Summary</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {dataTypeAnalysis.columnCount} columns
            </Badge>
            {(dataTypeAnalysis.numberColumns ?? 0) > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {dataTypeAnalysis.numberColumns} numeric
              </Badge>
            )}
            {(dataTypeAnalysis.stringColumns ?? 0) > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                {dataTypeAnalysis.stringColumns} text
              </Badge>
            )}
            {(dataTypeAnalysis.dateColumns ?? 0) > 0 && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                {dataTypeAnalysis.dateColumns} date
              </Badge>
            )}
          </div>
        </div>

        {/* Chart Templates Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
            {filteredTemplates.map(template => {
              const isCompatible = isTemplateCompatible(template)
              const compatibilityMessage = getCompatibilityMessage(template)
              const quality = calculateTemplateQuality(template)
              const IconComponent = iconMap[template.icon as keyof typeof iconMap] || BarChart3

              return (
                <div
                  key={template.id}
                  className={cn(
                    "relative border rounded-lg p-4 transition-all duration-200 hover:shadow-md h-[280px] flex flex-col",
                    isCompatible
                      ? "border-gray-200 hover:border-gray-300 cursor-pointer"
                      : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                  )}
                  onClick={isCompatible ? () => handleAddChart(template) : undefined}
                >
                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center",
                      isCompatible ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"
                    )}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          template.category === 'comparison' && "bg-blue-50 text-blue-700",
                          template.category === 'distribution' && "bg-green-50 text-green-700",
                          template.category === 'trend' && "bg-purple-50 text-purple-700",
                          template.category === 'relationship' && "bg-orange-50 text-orange-700",
                          template.category === 'summary' && "bg-gray-50 text-gray-700"
                        )}
                      >
                        {template.category}
                      </Badge>
                      {isCompatible && (
                        <QualityIndicator
                          score={quality.score}
                          factors={quality.factors}
                          size="sm"
                          showDetails={true}
                        />
                      )}
                    </div>
                  </div>

                  {/* Template Content */}
                  <div className="flex-1 flex flex-col space-y-2">
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                      {template.description}
                    </p>

                    {/* Requirements */}
                    <div className="flex flex-wrap gap-1">
                      {template.requiredDataTypes.map(type => (
                        <Badge
                          key={type}
                          variant="outline"
                          className={cn(
                            "text-xs",
                            type === 'number' && dataTypeAnalysis.hasNumbers && "bg-blue-50 text-blue-600",
                            type === 'string' && dataTypeAnalysis.hasStrings && "bg-green-50 text-green-600",
                            type === 'date' && dataTypeAnalysis.hasDates && "bg-purple-50 text-purple-600"
                          )}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>

                    {/* Compatibility Status */}
                    {compatibilityMessage && (
                      <p className="text-xs text-red-500">
                        {compatibilityMessage}
                      </p>
                    )}

                    {/* Spacer to push button to bottom */}
                    <div className="flex-1"></div>
                  </div>

                  {/* Add Button */}
                  {isCompatible && (
                    <Button
                      size="sm"
                      className="w-full mt-auto"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddChart(template)
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Chart
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <BarChart3 className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No charts found</h3>
              <p className="text-gray-600">
                Try adjusting your search or category filter
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-gray-500">
            {filteredTemplates.length} chart{filteredTemplates.length !== 1 ? 's' : ''} available
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}