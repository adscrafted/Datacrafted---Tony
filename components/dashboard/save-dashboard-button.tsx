'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/lib/stores/project-store'
import { useDataStore } from '@/lib/store'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'

export function SaveDashboardButton() {
  const [isSaving, setIsSaving] = useState(false)
  const {
    isDirty,
    markAsDirty,
    markAsClean,
    saveDashboardConfig,
    currentProjectId
  } = useProjectStore()

  const {
    chartCustomizations,
    currentLayout,
    dashboardFilters,
    currentTheme,
    dateRange,
    granularity,
    analysis,
    rawData,
    dataSchema,
    chatMessages
  } = useDataStore()

  // Track previous state to detect changes
  const prevStateRef = useRef({
    chartCustomizations,
    currentLayout,
    dashboardFilters,
    currentTheme,
    dateRange,
    granularity,
    analysisChartCount: analysis?.chartConfig?.length || 0,
    chatMessageCount: chatMessages.length
  })

  // Monitor for changes and mark as dirty
  useEffect(() => {
    const prev = prevStateRef.current
    const currentAnalysisChartCount = analysis?.chartConfig?.length || 0
    const currentChatMessageCount = chatMessages.length

    const hasChanges =
      JSON.stringify(chartCustomizations) !== JSON.stringify(prev.chartCustomizations) ||
      JSON.stringify(currentLayout) !== JSON.stringify(prev.currentLayout) ||
      JSON.stringify(dashboardFilters) !== JSON.stringify(prev.dashboardFilters) ||
      JSON.stringify(currentTheme) !== JSON.stringify(prev.currentTheme) ||
      JSON.stringify(dateRange) !== JSON.stringify(prev.dateRange) ||
      granularity !== prev.granularity ||
      currentAnalysisChartCount !== prev.analysisChartCount || // Detect when charts are added/removed
      currentChatMessageCount !== prev.chatMessageCount // Detect when chat messages are added

    if (hasChanges && !isDirty) {
      console.log('🟠 [SAVE_DASHBOARD] Changes detected, marking as dirty:', {
        chartCustomizationsChanged: JSON.stringify(chartCustomizations) !== JSON.stringify(prev.chartCustomizations),
        layoutChanged: JSON.stringify(currentLayout) !== JSON.stringify(prev.currentLayout),
        filtersChanged: JSON.stringify(dashboardFilters) !== JSON.stringify(prev.dashboardFilters),
        themeChanged: JSON.stringify(currentTheme) !== JSON.stringify(prev.currentTheme),
        dateRangeChanged: JSON.stringify(dateRange) !== JSON.stringify(prev.dateRange),
        granularityChanged: granularity !== prev.granularity,
        chartCountChanged: currentAnalysisChartCount !== prev.analysisChartCount,
        chatMessageCountChanged: currentChatMessageCount !== prev.chatMessageCount,
        prevChartCount: prev.analysisChartCount,
        currentChartCount: currentAnalysisChartCount,
        prevChatMessageCount: prev.chatMessageCount,
        currentChatMessageCount: currentChatMessageCount
      })
      markAsDirty()
    }

    prevStateRef.current = {
      chartCustomizations,
      currentLayout,
      dashboardFilters,
      currentTheme,
      dateRange,
      granularity,
      analysisChartCount: currentAnalysisChartCount,
      chatMessageCount: currentChatMessageCount
    }
  }, [chartCustomizations, currentLayout, dashboardFilters, currentTheme, dateRange, granularity, analysis?.chartConfig?.length, chatMessages.length, isDirty, markAsDirty])

  // Keyboard shortcut handler (Cmd/Ctrl + S)
  const handleSaveRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (handleSaveRef.current) {
          handleSaveRef.current()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSave = useCallback(async () => {
    if (!currentProjectId) {
      toast.error('No project selected. Please load or create a project first.')
      return
    }

    if (!isDirty) {
      toast.info('No changes to save')
      return
    }

    if (isSaving) {
      return // Prevent duplicate saves
    }

    setIsSaving(true)

    try {
      // Get current state values - avoids dependency array issues
      const {
        chartCustomizations: currentChartCustomizations,
        currentLayout: currentLayoutValue,
        dashboardFilters: currentFilters,
        currentTheme: currentThemeValue,
        dateRange: currentDateRange,
        granularity: currentGranularity,
        chatMessages: currentChatMessages,
        analysis: currentAnalysis,
        rawData: currentRawData,
        dataSchema: currentDataSchema
      } = useDataStore.getState()

      // Save dashboard configuration
      await saveDashboardConfig(currentProjectId, {
        chartCustomizations: currentChartCustomizations,
        currentLayout: currentLayoutValue,
        filters: currentFilters,
        theme: currentThemeValue,
        dateRange: currentDateRange,
        granularity: currentGranularity,
        chatMessages: currentChatMessages
      })

      // Step 2: Save the updated analysis (includes added/removed charts)
      if (currentAnalysis && currentRawData && currentRawData.length > 0) {
        const { saveProjectData } = useProjectStore.getState()

        await saveProjectData(
          currentProjectId,
          currentRawData,
          currentAnalysis,
          currentDataSchema || undefined
        )
      }

      markAsClean()

      // Update prevStateRef after successful save
      prevStateRef.current = {
        chartCustomizations: currentChartCustomizations,
        currentLayout: currentLayoutValue,
        dashboardFilters: currentFilters,
        currentTheme: currentThemeValue,
        dateRange: currentDateRange,
        granularity: currentGranularity,
        analysisChartCount: currentAnalysis?.chartConfig?.length || 0,
        chatMessageCount: currentChatMessages.length
      }

      toast.success('Dashboard saved successfully', {
        duration: 3000
      })

      console.log('✅ [SAVE_DASHBOARD] Dashboard saved successfully:', {
        projectId: currentProjectId,
        chartCount: Object.keys(currentChartCustomizations).length,
        filterCount: currentFilters.length,
        theme: currentThemeValue.name
      })
    } catch (error) {
      console.error('❌ [SAVE_DASHBOARD] Failed to save dashboard:', error)
      toast.error('Failed to save dashboard. Please try again.', {
        duration: 5000
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    currentProjectId,
    isDirty,
    isSaving,
    saveDashboardConfig,
    markAsClean
  ])

  // Store handleSave in ref for keyboard shortcut
  handleSaveRef.current = handleSave

  // Don't show button if no project is loaded
  if (!currentProjectId || !analysis) {
    return null
  }

  return (
    <Button
      onClick={handleSave}
      disabled={!isDirty || isSaving}
      variant={isDirty ? "default" : "ghost"}
      size="sm"
      className={cn(
        "relative transition-all duration-200",
        isDirty && "shadow-sm",
        isSaving && "opacity-75"
      )}
      title={`Save Dashboard (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+S)`}
    >
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          Save Dashboard
          {/* Dirty state indicator - orange dot */}
          {isDirty && (
            <span
              className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full animate-pulse"
              aria-label="Unsaved changes"
            />
          )}
        </>
      )}
    </Button>
  )
}
