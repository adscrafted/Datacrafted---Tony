import { useEffect, useRef } from 'react'
import { useDataStore } from '@/lib/store'
import { useProjectStore } from '@/lib/stores/project-store'

/**
 * Auto-save hook that monitors Zustand store changes and automatically
 * saves dashboard state to projects with debouncing.
 *
 * Tracks changes to:
 * - analysis (AI-generated charts)
 * - correctedSchema (schema corrections)
 * - chartCustomizations (user modifications)
 * - currentLayout (dashboard layout)
 * - dashboardFilters (filters)
 * - currentTheme (theme)
 *
 * @param projectId - The project ID to save to (null to disable auto-save)
 * @param debounceMs - Debounce delay in milliseconds (default: 2000)
 */
export function useAutoSave(projectId: string | null, debounceMs = 2000): void {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastStateHashRef = useRef<string>('')
  const isSavingRef = useRef(false)

  const { saveProjectData, saveDashboardConfig } = useProjectStore()

  useEffect(() => {
    if (!projectId) {
      console.log('⏸️ [AUTO_SAVE] Auto-save disabled (no projectId)')
      return
    }

    console.log('🔄 [AUTO_SAVE] Setting up auto-save subscription for project:', projectId)

    // Subscribe to Zustand store changes
    const unsubscribe = useDataStore.subscribe((state, prevState) => {
      // Skip if already saving
      if (isSavingRef.current) {
        return
      }

      // Extract relevant state for comparison
      const relevantState = {
        analysis: state.analysis,
        correctedSchema: state.correctedSchema,
        chartCustomizations: state.chartCustomizations,
        currentLayout: state.currentLayout,
        dashboardFilters: state.dashboardFilters,
        currentTheme: state.currentTheme,
      }

      // Create hash of current state
      const currentHash = JSON.stringify(relevantState)

      // Skip if state hasn't changed
      if (currentHash === lastStateHashRef.current) {
        return
      }

      // Update hash
      lastStateHashRef.current = currentHash

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce save operation
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          isSavingRef.current = true
          console.log('💾 [AUTO_SAVE] Starting auto-save...')

          // Save analysis and raw data if available
          if (state.rawData && state.rawData.length > 0) {
            console.log('💾 [AUTO_SAVE] Saving project data (rawData, analysis, schema)...')
            await saveProjectData(
              projectId,
              state.rawData,
              state.analysis || undefined,
              state.dataSchema || undefined
            )
            console.log('✅ [AUTO_SAVE] Project data saved successfully')
          }

          // Save dashboard configuration (layout, customizations, filters, theme)
          console.log('💾 [AUTO_SAVE] Saving dashboard config (layout, customizations, filters, theme)...')
          await saveDashboardConfig(projectId, {
            chartCustomizations: state.chartCustomizations,
            currentLayout: state.currentLayout,
            filters: state.dashboardFilters,
            theme: state.currentTheme,
          })
          console.log('✅ [AUTO_SAVE] Dashboard config saved successfully')

          console.log('✅ [AUTO_SAVE] All changes saved')
        } catch (error) {
          console.error('❌ [AUTO_SAVE] Failed to save:', error)
          // Don't throw - just log the error to avoid crashing the app
        } finally {
          isSavingRef.current = false
        }
      }, debounceMs)
    })

    // Cleanup function
    return () => {
      console.log('🛑 [AUTO_SAVE] Cleaning up auto-save subscription')
      unsubscribe()

      // Clear pending timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [projectId, debounceMs, saveProjectData, saveDashboardConfig])
}
