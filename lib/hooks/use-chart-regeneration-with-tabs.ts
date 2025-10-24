import { useCallback } from 'react'
import { useDataStore, type AnalysisResult } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
import type { ChartSuggestion } from '@/lib/services/chat-service'

// Helper function to build proper dataMapping based on chart type
function buildDataMapping(chartType: string, columns: string[]): any {
  const dataMapping: any = {}

  switch (chartType) {
    case 'bar':
      dataMapping.category = columns[0]
      dataMapping.values = columns.slice(1)
      dataMapping.aggregation = 'sum'
      break

    case 'line':
    case 'area':
      dataMapping.xAxis = columns[0]
      dataMapping.yAxis = columns.slice(1)
      dataMapping.aggregation = 'sum'
      break

    case 'pie':
      dataMapping.category = columns[0]
      dataMapping.value = columns[1] || columns[0]
      dataMapping.aggregation = 'sum'
      break

    case 'scorecard':
      dataMapping.metric = columns[0]
      dataMapping.comparison = columns[1]
      dataMapping.aggregation = 'sum'
      break

    case 'scatter':
      dataMapping.xAxis = columns[0]
      dataMapping.yAxis = columns[1]
      dataMapping.size = columns[2]
      dataMapping.aggregation = 'none'
      break

    case 'table':
      dataMapping.columns = columns
      dataMapping.sortBy = columns[0]
      dataMapping.sortOrder = 'desc'
      break

    default:
      dataMapping.xAxis = columns[0]
      dataMapping.yAxis = columns.slice(1)
      dataMapping.aggregation = 'sum'
      break
  }

  return dataMapping
}

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
  const analysis = useDataStore((state) => state.analysis)
  const setAnalysis = useDataStore((state) => state.setAnalysis)
  const updateChartCustomization = useChartStore((state) => state.updateChartCustomization)

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

    const chartId = `chart-${Date.now()}`

    const newChartConfig = {
      id: chartId,
      type: suggestion.type,
      title: suggestion.title,
      dataKey: suggestion.dataKey,
      description: suggestion.description
    }

    // Create the chart customization to actually add it to the dashboard
    const chartCustomization = {
      id: chartId,
      position: { x: 0, y: 0, w: 6, h: 4 }, // Default size
      isVisible: true,
      chartType: suggestion.type as any,
      title: suggestion.title,
      dataMapping: buildDataMapping(suggestion.type as any, suggestion.dataKey)
    }

    // Add the chart to the dashboard using the chart store
    updateChartCustomization(chartId, chartCustomization)
    console.log('✅ [CHART-REGEN] Added chart to dashboard:', chartId, suggestion.title)

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
  }, [activeTabId, tabAnalyses, setTabAnalyses, analysis, setAnalysis, updateChartCustomization])

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
