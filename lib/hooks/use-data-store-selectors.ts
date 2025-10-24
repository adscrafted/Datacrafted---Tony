import { useDataStore } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useShallow } from 'zustand/react/shallow'

/**
 * OPTIMIZED SELECTORS FOR MODULAR STORES
 *
 * Purpose: Provides pre-built selectors to prevent unnecessary re-renders
 * These hooks use shallow comparison to only re-render when specific slices change
 *
 * MIGRATION NOTES:
 * - Previously, these selectors accessed a centralized store
 * - Now they access the appropriate modular store (data, chart, or ui)
 * - All selectors use shallow comparison for optimal performance
 */

// ============================================================================
// DATA STORE SELECTORS
// ============================================================================

/**
 * Get core data for chart rendering
 * Use this in chart components that need raw data and analysis
 */
export const useChartData = () => useDataStore(
  useShallow(state => ({
    rawData: state.rawData,
    analysis: state.analysis,
    dataSchema: state.dataSchema,
    availableColumns: state.availableColumns,
  }))
)

/**
 * Get data loading state
 * Use this in components that show loading indicators
 */
export const useDataLoadingState = () => useDataStore(
  useShallow(state => ({
    isAnalyzing: state.isAnalyzing,
    error: state.error,
    analysisProgress: state.analysisProgress,
    usingAI: state.usingAI,
  }))
)

/**
 * Get session state
 * Use this for file name, current session info
 */
export const useSessionState = () => useDataStore(
  useShallow(state => ({
    fileName: state.fileName,
    dataId: state.dataId,
  }))
)

/**
 * Get enhanced analysis features
 * Use this for AI-powered recommendations and context
 */
export const useEnhancedAnalysis = () => useDataStore(
  useShallow(state => ({
    analysis: state.analysis,
    correctedSchema: state.correctedSchema,
    dataContext: state.dataContext,
  }))
)

// ============================================================================
// CHART STORE SELECTORS
// ============================================================================

/**
 * Get specific chart customization
 * Use this in individual chart components
 */
export const useChartCustomizations = (chartId: string) => useChartStore(
  useShallow(state => ({
    customization: state.chartCustomizations[chartId],
    updateChartCustomization: state.updateChartCustomization,
    removeChartCustomization: state.removeChartCustomization,
  }))
)

/**
 * Get dashboard layout state
 * Use this in layout components
 */
export const useDashboardLayout = () => useChartStore(
  useShallow(state => ({
    currentLayout: state.currentLayout,
    availableLayouts: state.availableLayouts,
    chartCustomizations: state.chartCustomizations,
    setCurrentLayout: state.setCurrentLayout,
    saveLayout: state.saveLayout,
    loadLayout: state.loadLayout,
    resetToDefaultLayout: state.resetToDefaultLayout,
  }))
)

/**
 * Get theme state
 * Use this in components that need theme information
 */
export const useThemeState = () => useChartStore(
  useShallow(state => ({
    currentTheme: state.currentTheme,
    availableThemes: state.availableThemes,
    setCurrentTheme: state.setCurrentTheme,
    addCustomTheme: state.addCustomTheme,
  }))
)

/**
 * Get dashboard filters
 * Use this in filter components and charts that respect filters
 */
export const useDashboardFilters = () => useChartStore(
  useShallow(state => ({
    dashboardFilters: state.dashboardFilters,
    dateRange: state.dateRange,
    granularity: state.granularity,
    addDashboardFilter: state.addDashboardFilter,
    updateDashboardFilter: state.updateDashboardFilter,
    removeDashboardFilter: state.removeDashboardFilter,
    clearAllFilters: state.clearAllFilters,
    setDateRange: state.setDateRange,
    setGranularity: state.setGranularity,
  }))
)

/**
 * Get chart templates
 * Use this in chart gallery/template selector
 */
export const useChartTemplates = () => useChartStore(
  useShallow(state => ({
    chartTemplates: state.chartTemplates,
    addChart: state.addChart,
    removeChart: state.removeChart,
    duplicateChart: state.duplicateChart,
    updateChartType: state.updateChartType,
  }))
)

/**
 * Get draft chart state
 * Use this in chart creation/editing flows
 */
export const useDraftChart = () => useChartStore(
  useShallow(state => ({
    draftChart: state.draftChart,
    setDraftChart: state.setDraftChart,
    commitDraftChart: state.commitDraftChart,
  }))
)

/**
 * Get history state for undo/redo
 * Use this in toolbar/header components
 */
export const useChartHistory = () => useChartStore(
  useShallow(state => ({
    customizationHistory: state.customizationHistory,
    redoHistory: state.redoHistory,
    undoLastAction: state.undoLastAction,
    redoLastAction: state.redoLastAction,
  }))
)

// ============================================================================
// UI STORE SELECTORS
// ============================================================================

/**
 * Get dashboard customization UI state
 * Use this in dashboard chrome/header components
 */
export const useCustomizationUI = () => useUIStore(
  useShallow(state => ({
    isCustomizing: state.isCustomizing,
    showChartSettings: state.showChartSettings,
    selectedChartId: state.selectedChartId,
    setIsCustomizing: state.setIsCustomizing,
    setShowChartSettings: state.setShowChartSettings,
    setSelectedChartId: state.setSelectedChartId,
  }))
)

/**
 * Get drag and drop UI state
 * Use this in draggable chart components
 */
export const useDragState = () => useUIStore(
  useShallow(state => ({
    isDragging: state.isDragging,
    draggedChartId: state.draggedChartId,
    setIsDragging: state.setIsDragging,
    setDraggedChartId: state.setDraggedChartId,
  }))
)

/**
 * Get chart gallery UI state
 * Use this in chart template gallery component
 */
export const useChartGalleryUI = () => useUIStore(
  useShallow(state => ({
    showChartTemplateGallery: state.showChartTemplateGallery,
    setShowChartTemplateGallery: state.setShowChartTemplateGallery,
  }))
)

/**
 * Get context menu UI state
 * Use this in context menu components
 */
export const useContextMenuUI = () => useUIStore(
  useShallow(state => ({
    contextMenuPosition: state.contextMenuPosition,
    contextMenuChartId: state.contextMenuChartId,
    setContextMenu: state.setContextMenu,
  }))
)

/**
 * Get grid settings UI state
 * Use this in dashboard layout components
 */
export const useGridSettingsUI = () => useUIStore(
  useShallow(state => ({
    gridSnapping: state.gridSnapping,
    showGridLines: state.showGridLines,
    setGridSnapping: state.setGridSnapping,
    setShowGridLines: state.setShowGridLines,
  }))
)

/**
 * Get date range selector UI state
 * Use this in date range selector component
 */
export const useDateRangeSelectorUI = () => useUIStore(
  useShallow(state => ({
    selectedDateColumn: state.selectedDateColumn,
    setSelectedDateColumn: state.setSelectedDateColumn,
  }))
)

/**
 * Get upload progress UI state
 * Use this in upload status bar component
 */
export const useUploadProgressUI = () => useUIStore(
  useShallow(state => ({
    uploadProgress: state.uploadProgress,
    uploadStage: state.uploadStage,
    uploadComplete: state.uploadComplete,
    uploadProjectId: state.uploadProjectId,
    setUploadProgress: state.setUploadProgress,
    setUploadStage: state.setUploadStage,
    setUploadComplete: state.setUploadComplete,
    setUploadProjectId: state.setUploadProjectId,
    dismissUpload: state.dismissUpload,
  }))
)

/**
 * Get fullscreen UI state
 * Use this in chart components that support fullscreen mode
 */
export const useFullscreenUI = () => useUIStore(
  useShallow(state => ({
    showFullScreen: state.showFullScreen,
    setFullScreen: state.setFullScreen,
  }))
)

// ============================================================================
// CROSS-STORE COMPOSITE SELECTORS
// ============================================================================

/**
 * Get all state needed for chart rendering
 * Combines data from multiple stores for convenience
 * Use this when you need data, customization, and theme together
 */
export const useChartRenderState = (chartId: string) => {
  const { rawData, analysis } = useChartData()
  const { customization } = useChartCustomizations(chartId)
  const { currentTheme } = useThemeState()
  const { dateRange, granularity } = useDashboardFilters()

  return {
    rawData,
    analysis,
    customization,
    currentTheme,
    dateRange,
    granularity,
  }
}

/**
 * Get all state needed for dashboard layout
 * Combines layout, customization mode, and drag state
 * Use this in dashboard container components
 */
export const useDashboardState = () => {
  const layoutState = useDashboardLayout()
  const { isCustomizing } = useCustomizationUI()
  const dragState = useDragState()

  return {
    ...layoutState,
    isCustomizing,
    ...dragState,
  }
}

/**
 * Get all state needed for filter controls
 * Combines filters from chart store and UI state
 * Use this in filter panel/control components
 */
export const useFilterControlState = () => {
  const filterState = useDashboardFilters()
  const { selectedDateColumn, setSelectedDateColumn } = useDateRangeSelectorUI()

  return {
    ...filterState,
    selectedDateColumn,
    setSelectedDateColumn,
  }
}
