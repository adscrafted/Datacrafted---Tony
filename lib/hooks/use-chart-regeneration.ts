import { useCallback } from 'react'
import { useDataStore, type AnalysisResult } from '@/lib/store'
import type { ChartSuggestion } from '@/lib/services/chat-service'

// Helper function to get default chart dimensions based on type
function getDefaultChartDimensions(chartType: string): { w: number; h: number } {
  switch (chartType) {
    case 'scorecard':
      return { w: 2, h: 1 }
    case 'table':
      return { w: 12, h: 6 }
    case 'pie':
      return { w: 4, h: 4 }
    case 'bar':
    case 'line':
    case 'area':
    case 'scatter':
    case 'combo':
    case 'waterfall':
      return { w: 6, h: 4 }
    default:
      return { w: 6, h: 4 }
  }
}

// Helper function to build dataMapping from suggestion columns
function buildDataMapping(chartType: string, columns: string[]): any {
  const dataMapping: any = {}

  switch (chartType) {
    case 'bar':
      // Bar: category (first column) + values (remaining columns) + aggregation
      dataMapping.category = columns[0]
      dataMapping.values = columns.slice(1)
      dataMapping.aggregation = 'sum'
      break

    case 'line':
    case 'area':
      // Line/Area: xAxis (first column) + yAxis (remaining columns) + aggregation
      dataMapping.xAxis = columns[0]
      dataMapping.yAxis = columns.slice(1)
      dataMapping.aggregation = 'sum'
      break

    case 'pie':
      // Pie: category (first column) + value (second column) + aggregation
      dataMapping.category = columns[0]
      dataMapping.value = columns[1] || columns[0]
      dataMapping.aggregation = 'sum'
      break

    case 'scatter':
      // Scatter: xAxis (first) + yAxis (second) + optional size/color
      dataMapping.xAxis = columns[0]
      dataMapping.yAxis = columns[1] || columns[0]
      if (columns[2]) dataMapping.size = columns[2]
      if (columns[3]) dataMapping.color = columns[3]
      break

    case 'scorecard':
      // Scorecard: metric (first column) + aggregation
      dataMapping.metric = columns[0]
      dataMapping.aggregation = 'sum'
      break

    case 'table':
      // Table: all columns
      dataMapping.columns = columns
      break

    default:
      // Default: use columns as values
      dataMapping.values = columns
      break
  }

  return dataMapping
}

export function useChartRegeneration() {
  const { analysis, setAnalysis, updateChartCustomization } = useDataStore()

  const regenerateChartFromSuggestion = useCallback((suggestion: ChartSuggestion) => {
    if (!analysis) return

    // Generate unique chart ID
    const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Build proper dataMapping from suggestion columns
    const dataMapping = buildDataMapping(suggestion.type, suggestion.dataKey)

    const newChartConfig = {
      id: chartId,
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description,
      dataMapping: dataMapping, // ✅ Add structured dataMapping
      dataKey: suggestion.dataKey // Keep original dataKey for reference
    }

    // Get default dimensions for this chart type
    const dimensions = getDefaultChartDimensions(suggestion.type)

    // Create chart customization with default position and dimensions
    // The FlexibleDashboardLayout will auto-place it using findAvailablePosition
    updateChartCustomization(chartId, {
      id: chartId,
      position: { x: 0, y: 0, w: dimensions.w, h: dimensions.h },
      isVisible: true,
      chartType: suggestion.type
    })

    // Add the new chart to the existing analysis
    const updatedAnalysis: AnalysisResult = {
      ...analysis,
      chartConfig: [...analysis.chartConfig, newChartConfig],
      insights: [
        ...analysis.insights,
        `Added ${suggestion.type} chart: ${suggestion.title} - ${suggestion.reason}`
      ]
    }

    setAnalysis(updatedAnalysis)

    return newChartConfig
  }, [analysis, setAnalysis, updateChartCustomization])

  const replaceChart = useCallback((chartIndex: number, suggestion: ChartSuggestion) => {
    if (!analysis || chartIndex < 0 || chartIndex >= analysis.chartConfig.length) return

    const newChartConfig = {
      type: suggestion.type,
      title: suggestion.title,
      dataKey: suggestion.dataKey,
      description: suggestion.description
    }

    const updatedChartConfig = [...analysis.chartConfig]
    updatedChartConfig[chartIndex] = newChartConfig

    const updatedAnalysis: AnalysisResult = {
      ...analysis,
      chartConfig: updatedChartConfig,
      insights: [
        ...analysis.insights,
        `Updated chart ${chartIndex + 1}: ${suggestion.title} - ${suggestion.reason}`
      ]
    }

    setAnalysis(updatedAnalysis)
    
    return newChartConfig
  }, [analysis, setAnalysis])

  const removeChart = useCallback((chartIndex: number) => {
    if (!analysis || chartIndex < 0 || chartIndex >= analysis.chartConfig.length) return

    const updatedChartConfig = analysis.chartConfig.filter((_, index) => index !== chartIndex)
    
    const updatedAnalysis: AnalysisResult = {
      ...analysis,
      chartConfig: updatedChartConfig,
      insights: [
        ...analysis.insights,
        `Removed chart: ${analysis.chartConfig[chartIndex].title}`
      ]
    }

    setAnalysis(updatedAnalysis)
  }, [analysis, setAnalysis])

  return {
    regenerateChartFromSuggestion,
    replaceChart,
    removeChart
  }
}