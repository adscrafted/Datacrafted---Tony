import { useCallback } from 'react'
import { useDataStore, type AnalysisResult } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
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
  const analysis = useDataStore((state) => state.analysis)
  const rawData = useDataStore((state) => state.rawData)
  const setAnalysis = useDataStore((state) => state.setAnalysis)
  const updateChartCustomization = useChartStore((state) => state.updateChartCustomization)

  const regenerateChartFromSuggestion = useCallback((suggestion: ChartSuggestion) => {
    console.log('🎯 [CHART-REGEN] Starting chart addition with suggestion:', {
      type: suggestion.type,
      title: suggestion.title,
      dataKey: suggestion.dataKey,
      description: suggestion.description
    })

    // Validate that we have analysis data before proceeding
    if (!analysis) {
      console.error('❌ [CHART-REGEN] Cannot add chart - no analysis data available')
      return
    }

    // Get available columns from data
    const availableColumns = rawData && rawData.length > 0 ? Object.keys(rawData[0]) : []
    console.log('📋 [CHART-REGEN] Available columns:', availableColumns)

    // Validate and filter suggested columns against actual data columns
    const validColumns = suggestion.dataKey.filter(col => {
      const isValid = availableColumns.includes(col)
      if (!isValid) {
        console.warn(`⚠️ [CHART-REGEN] Invalid column "${col}" not found in data. Available: ${availableColumns.join(', ')}`)
      }
      return isValid
    })

    // If no valid columns, try case-insensitive matching as fallback
    if (validColumns.length === 0 && suggestion.dataKey.length > 0) {
      console.log('🔄 [CHART-REGEN] Attempting case-insensitive column matching...')
      const fallbackColumns = suggestion.dataKey.map(col => {
        const match = availableColumns.find(
          avail => avail.toLowerCase() === col.toLowerCase() ||
                   avail.toLowerCase().replace(/[_\s]/g, '') === col.toLowerCase().replace(/[_\s]/g, '')
        )
        if (match) {
          console.log(`✅ [CHART-REGEN] Fuzzy matched "${col}" to "${match}"`)
        }
        return match
      }).filter((col): col is string => col !== undefined)

      if (fallbackColumns.length > 0) {
        suggestion = { ...suggestion, dataKey: fallbackColumns }
        console.log('📝 [CHART-REGEN] Using fuzzy-matched columns:', fallbackColumns)
      } else {
        console.error('❌ [CHART-REGEN] Cannot add chart - no valid columns found in suggestion:', suggestion.dataKey)
        return null
      }
    } else if (validColumns.length !== suggestion.dataKey.length) {
      // Some columns were invalid, use only valid ones
      suggestion = { ...suggestion, dataKey: validColumns }
      console.log('📝 [CHART-REGEN] Using filtered valid columns:', validColumns)
    }

    console.log('📊 [CHART-REGEN] Current analysis state:', {
      chartCount: analysis.chartConfig?.length || 0,
      insightsCount: analysis.insights?.length || 0
    })

    // Generate unique chart ID
    const chartId = `chart-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    // Build proper dataMapping from suggestion columns
    const dataMapping = buildDataMapping(suggestion.type, suggestion.dataKey)
    console.log('🗺️ [CHART-REGEN] Built dataMapping:', dataMapping)

    const newChartConfig = {
      id: chartId,
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description,
      dataMapping: dataMapping,
      dataKey: suggestion.dataKey
    }

    // Get default dimensions for this chart type
    const dimensions = getDefaultChartDimensions(suggestion.type)

    // Create chart customization with default position and dimensions
    console.log('📐 [CHART-REGEN] Setting customization with dimensions:', dimensions)
    updateChartCustomization(chartId, {
      id: chartId,
      position: { x: 0, y: 0, w: dimensions.w, h: dimensions.h },
      isVisible: true,
      chartType: suggestion.type,
      customTitle: suggestion.title, // Use customTitle, not title
      dataMapping: dataMapping
    })

    // Update analysis with the new chart
    const updatedAnalysis: AnalysisResult = {
      ...analysis,
      chartConfig: [...analysis.chartConfig, newChartConfig],
      insights: [
        ...analysis.insights,
        `Added ${suggestion.type} chart: ${suggestion.title} - ${suggestion.reason}`
      ]
    }

    console.log('✅ [CHART-REGEN] Calling setAnalysis with new chart count:', updatedAnalysis.chartConfig.length)
    setAnalysis(updatedAnalysis)

    console.log('🎉 [CHART-REGEN] Chart added successfully:', {
      chartId,
      title: suggestion.title,
      newTotalCharts: updatedAnalysis.chartConfig.length
    })

    return newChartConfig
  }, [analysis, rawData, setAnalysis, updateChartCustomization])

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
