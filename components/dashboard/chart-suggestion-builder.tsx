'use client'

import React, { useState, useEffect } from 'react'
import { ChartSuggestion } from '@/lib/types/chart-suggestion'
import { chartSuggestionEngine } from '@/lib/services/chart-suggestion-engine'
import { useDataStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartWrapper } from '../chart-wrapper'
import { Lightbulb, Plus, TrendingUp, BarChart3, PieChart, LineChart, Table as TableIcon } from 'lucide-react'
import { logger } from '@/lib/utils/logger'

interface ChartSuggestionBuilderProps {
  suggestions: ChartSuggestion[]
  onCreateChart?: (suggestion: ChartSuggestion) => void
}

export function ChartSuggestionBuilder({ suggestions, onCreateChart }: ChartSuggestionBuilderProps) {
  const { rawData, analysis, setAnalysis } = useDataStore()
  const [processingSuggestion, setProcessingSuggestion] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, any[]>>({})

  // Generate preview data for suggestions
  useEffect(() => {
    suggestions.forEach(async (suggestion) => {
      if (!previewData[suggestion.id] && rawData) {
        try {
          const transformedData = await chartSuggestionEngine.transformData(rawData, suggestion.dataTransform)
          setPreviewData(prev => ({
            ...prev,
            [suggestion.id]: transformedData
          }))
        } catch (error) {
          logger.error('[ChartSuggestion] Failed to generate preview:', error)
        }
      }
    })
  }, [suggestions, rawData, previewData])

  const handleCreateChart = async (suggestion: ChartSuggestion) => {
    if (!rawData || !analysis) return

    setProcessingSuggestion(suggestion.id)

    try {
      // Transform the data
      const transformedData = await chartSuggestionEngine.transformData(rawData, suggestion.dataTransform)
      
      // Create chart configuration
      const chartConfig = {
        id: suggestion.id,
        type: suggestion.type === 'table' ? 'bar' : suggestion.type, // Tables become bar charts in analysis
        title: suggestion.title,
        description: suggestion.description,
        dataKey: suggestion.type === 'table' 
          ? suggestion.tableConfig?.columns.map(col => col.key) || []
          : [suggestion.chartConfig.x, ...(suggestion.chartConfig.y || [])].filter(Boolean)
      }

      // Add to analysis
      const updatedAnalysis = {
        ...analysis,
        chartConfig: [...analysis.chartConfig, chartConfig]
      }

      setAnalysis(updatedAnalysis)
      onCreateChart?.(suggestion)

      logger.log('[ChartSuggestion] Chart created successfully:', suggestion.title)
    } catch (error) {
      logger.error('[ChartSuggestion] Failed to create chart:', error)
    } finally {
      setProcessingSuggestion(null)
    }
  }

  const getChartIcon = (type: string) => {
    switch (type) {
      case 'table': return <TableIcon className="h-4 w-4" />
      case 'bar': return <BarChart3 className="h-4 w-4" />
      case 'line': return <LineChart className="h-4 w-4" />
      case 'pie': return <PieChart className="h-4 w-4" />
      default: return <TrendingUp className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold">AI Chart Suggestions</h3>
        <Badge variant="outline">{suggestions.length} suggestions</Badge>
      </div>

      <div className="grid gap-4">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">
                    {getChartIcon(suggestion.type)}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{suggestion.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {suggestion.description}
                    </CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge className={getPriorityColor(suggestion.priority)}>
                    {suggestion.priority}
                  </Badge>
                  <Badge variant="outline">
                    {Math.round(suggestion.confidence * 100)}% confidence
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Preview data if available */}
              {previewData[suggestion.id] && suggestion.type === 'table' && (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {suggestion.tableConfig?.columns.slice(0, 4).map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData[suggestion.id].slice(0, 3).map((row, index) => (
                        <TableRow key={index}>
                          {suggestion.tableConfig?.columns.slice(0, 4).map((col) => (
                            <TableCell key={col.key}>
                              {col.type === 'currency' 
                                ? `$${Number(row[col.key]).toLocaleString()}`
                                : col.type === 'percentage'
                                ? `${(Number(row[col.key]) * 100).toFixed(1)}%`
                                : String(row[col.key])
                              }
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {previewData[suggestion.id].length > 3 && (
                    <div className="p-2 text-center text-sm text-gray-500 bg-gray-50">
                      +{previewData[suggestion.id].length - 3} more rows
                    </div>
                  )}
                </div>
              )}

              {/* Chart preview for non-table types */}
              {previewData[suggestion.id] && suggestion.type !== 'table' && (
                <div className="h-48 border rounded-md p-4">
                  <ChartWrapper
                    id={`preview-${suggestion.id}`}
                    type={suggestion.type as any}
                    title={suggestion.title}
                    description=""
                    data={previewData[suggestion.id]}
                    dataKey={[suggestion.chartConfig.x, ...(suggestion.chartConfig.y || [])].filter(Boolean)}
                  />
                </div>
              )}

              {/* Tags */}
              {suggestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {suggestion.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Reasoning */}
              <div className="text-sm text-gray-600 italic">
                {suggestion.reasoning}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateChart(suggestion)}
                  disabled={processingSuggestion === suggestion.id}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {processingSuggestion === suggestion.id ? 'Creating...' : 'Add to Dashboard'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}