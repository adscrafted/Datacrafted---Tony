import { useDataStore } from '@/lib/store'

/**
 * Optimized selectors for the data store to prevent unnecessary re-renders
 */

// Chart-specific selectors
export const useChartData = () => useDataStore(
  state => ({
    rawData: state.rawData,
    analysis: state.analysis,
    getFilteredData: state.getFilteredData
  })
)

export const useChartCustomizations = (chartId: string) => useDataStore(
  state => ({
    customization: state.chartCustomizations[chartId],
    updateChartCustomization: state.updateChartCustomization,
    currentTheme: state.currentTheme
  })
)

// Dashboard layout selectors
export const useDashboardLayout = () => useDataStore(
  state => ({
    currentLayout: state.currentLayout,
    isCustomizing: state.isCustomizing,
    chartCustomizations: state.chartCustomizations,
    setCurrentLayout: state.setCurrentLayout,
    updateChartCustomization: state.updateChartCustomization
  })
)

// Chat interface selectors
export const useChatState = () => useDataStore(
  state => ({
    chatMessages: state.chatMessages,
    isChatLoading: state.isChatLoading,
    chatError: state.chatError,
    addChatMessage: state.addChatMessage,
    setIsChatLoading: state.setIsChatLoading,
    setChatError: state.setChatError
  })
)

// Session selectors
export const useSessionState = () => useDataStore(
  state => ({
    currentSession: state.currentSession,
    fileName: state.fileName,
    isSaving: state.isSaving,
    saveError: state.saveError
  })
)

// Theme and UI selectors
export const useThemeState = () => useDataStore(
  state => ({
    currentTheme: state.currentTheme,
    setCurrentTheme: state.setCurrentTheme,
    availableThemes: state.availableThemes
  })
)