import { useCallback } from 'react'
import { useDataStore, AnalysisResult } from '@/lib/store'
import { ChartSuggestion } from '@/lib/services/chat-service'

interface UseChartRegenerationWithTabsProps {
  activeTabId: string
  tabAnalyses: Record<string, any>
  setTabAnalyses: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export function useChartRegenerationWithTabs({
  activeTabId,
  tabAnalyses,
  setTabAnalyses
}: UseChartRegenerationWithTabsProps) {
  const { analysis, setAnalysis } = useDataStore()

  const regenerateChartFromSuggestion = useCallback((suggestion: ChartSuggestion) => {
    // Check if we're on a dashboard tab
    if (!activeTabId.startsWith('dashboard-')) {
      console.warn('Cannot add charts to non-dashboard tabs')
      return null
    }

    // Get the current tab's analysis or create a new one
    const currentTabAnalysis = tabAnalyses[activeTabId] || {
      summary: analysis?.summary || { rows: 0, columns: [] },
      insights: [],
      chartConfig: [],
      recommendations: []
    }

    const newChartConfig = {
      id: `chart-${Date.now()}`,
      type: suggestion.type,
      title: suggestion.title,
      dataKey: suggestion.dataKey,
      description: suggestion.description
    }

    // Create updated analysis for this tab
    const updatedTabAnalysis: AnalysisResult = {
      ...currentTabAnalysis,
      chartConfig: [...(currentTabAnalysis.chartConfig || []), newChartConfig],
      insights: [
        ...(currentTabAnalysis.insights || []),
        `Added ${suggestion.type} chart: ${suggestion.title} - ${suggestion.reason}`
      ]
    }

    // Update tab analyses
    setTabAnalyses(prev => ({
      ...prev,
      [activeTabId]: updatedTabAnalysis
    }))

    // If this is the main dashboard, also update the global analysis
    if (activeTabId === 'dashboard-1') {
      setAnalysis(updatedTabAnalysis)
    }
    
    return newChartConfig
  }, [activeTabId, tabAnalyses, setTabAnalyses, analysis, setAnalysis])

  const replaceChart = useCallback((chartIndex: number, suggestion: ChartSuggestion) => {
    if (!activeTabId.startsWith('dashboard-')) {
      console.warn('Cannot modify charts in non-dashboard tabs')
      return null
    }

    const currentTabAnalysis = tabAnalyses[activeTabId]
    if (!currentTabAnalysis || chartIndex < 0 || chartIndex >= currentTabAnalysis.chartConfig.length) {
      return null
    }

    const newChartConfig = {
      id: currentTabAnalysis.chartConfig[chartIndex].id || `chart-${Date.now()}`,
      type: suggestion.type,
      title: suggestion.title,
      dataKey: suggestion.dataKey,
      description: suggestion.description
    }

    const updatedChartConfig = [...currentTabAnalysis.chartConfig]
    updatedChartConfig[chartIndex] = newChartConfig

    const updatedTabAnalysis: AnalysisResult = {
      ...currentTabAnalysis,
      chartConfig: updatedChartConfig,
      insights: [
        ...(currentTabAnalysis.insights || []),
        `Updated chart ${chartIndex + 1}: ${suggestion.title} - ${suggestion.reason}`
      ]
    }

    setTabAnalyses(prev => ({
      ...prev,
      [activeTabId]: updatedTabAnalysis
    }))

    if (activeTabId === 'dashboard-1') {
      setAnalysis(updatedTabAnalysis)
    }
    
    return newChartConfig
  }, [activeTabId, tabAnalyses, setTabAnalyses, setAnalysis])

  const removeChart = useCallback((chartId: string) => {
    if (!activeTabId.startsWith('dashboard-')) {
      console.warn('Cannot remove charts from non-dashboard tabs')
      return
    }

    const currentTabAnalysis = tabAnalyses[activeTabId]
    if (!currentTabAnalysis) return

    const chartToRemove = currentTabAnalysis.chartConfig.find((c: any) => 
      (c.id || `chart-${currentTabAnalysis.chartConfig.indexOf(c)}`) === chartId
    )
    
    if (!chartToRemove) return

    const updatedChartConfig = currentTabAnalysis.chartConfig.filter((c: any) => 
      (c.id || `chart-${currentTabAnalysis.chartConfig.indexOf(c)}`) !== chartId
    )
    
    const updatedTabAnalysis: AnalysisResult = {
      ...currentTabAnalysis,
      chartConfig: updatedChartConfig,
      insights: [
        ...(currentTabAnalysis.insights || []),
        `Removed chart: ${chartToRemove.title}`
      ]
    }

    setTabAnalyses(prev => ({
      ...prev,
      [activeTabId]: updatedTabAnalysis
    }))

    if (activeTabId === 'dashboard-1') {
      setAnalysis(updatedTabAnalysis)
    }
  }, [activeTabId, tabAnalyses, setTabAnalyses, setAnalysis])

  return {
    regenerateChartFromSuggestion,
    replaceChart,
    removeChart
  }
}