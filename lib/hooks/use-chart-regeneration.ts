import { useCallback } from 'react'
import { useDataStore, AnalysisResult } from '@/lib/store'
import { ChartSuggestion } from '@/lib/services/chat-service'

export function useChartRegeneration() {
  const { analysis, setAnalysis } = useDataStore()

  const regenerateChartFromSuggestion = useCallback((suggestion: ChartSuggestion) => {
    if (!analysis) return

    const newChartConfig = {
      type: suggestion.type,
      title: suggestion.title,
      dataKey: suggestion.dataKey,
      description: suggestion.description
    }

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
  }, [analysis, setAnalysis])

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