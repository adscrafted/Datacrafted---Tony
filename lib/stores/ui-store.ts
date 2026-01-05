/**
 * UI STORE - Transient UI state management
 *
 * Purpose: Manages temporary UI state that should NOT be persisted
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - NO localStorage persistence (transient state only)
 * - Lightweight state changes don't trigger persistence overhead
 * - Isolated from data/chart stores to prevent cross-store re-renders
 *
 * WHY NO PERSISTENCE:
 * - UI state like "isCustomizing" or "showChartSettings" should reset on page load
 * - Modal/dialog states should start fresh each session
 * - Drag states are ephemeral and never need persistence
 *
 * USAGE EXAMPLES:
 *
 * // ✅ GOOD - Selective subscription
 * const isCustomizing = useUIStore((state) => state.isCustomizing)
 *
 * // ✅ GOOD - Multiple properties with shallow comparison
 * import { useShallow } from 'zustand/react/shallow'
 * const { isDragging, draggedChartId } = useUIStore(
 *   useShallow((state) => ({ isDragging: state.isDragging, draggedChartId: state.draggedChartId }))
 * )
 *
 * // ❌ BAD - Subscribes to entire store
 * const store = useUIStore()
 */

import { create } from 'zustand'

interface UIStore {
  // Dashboard UI state
  isCustomizing: boolean
  showChartSettings: boolean
  selectedChartId: string | null
  showFullScreen: string | null // chart ID for full-screen view

  // Drag and drop state
  isDragging: boolean
  draggedChartId: string | null

  // Gallery and context menu state
  showChartTemplateGallery: boolean
  contextMenuPosition: { x: number; y: number } | null
  contextMenuChartId: string | null

  // Grid settings (UI preferences - transient)
  gridSnapping: boolean
  showGridLines: boolean

  // Date range selector UI state
  selectedDateColumn: string | null

  // Upload status UI (transient progress indicators)
  uploadProgress: number
  uploadStage: string | null
  uploadComplete: boolean
  uploadProjectId: string | null

  // Paywall modal state
  showPaywallModal: boolean
  paywallType: 'analysis' | 'chat' | null
  paywallUsageInfo: { used: number; limit: number; plan: string } | null

  // Actions
  setIsCustomizing: (isCustomizing: boolean) => void
  setShowChartSettings: (show: boolean) => void
  setSelectedChartId: (chartId: string | null) => void
  setFullScreen: (chartId: string | null) => void

  setIsDragging: (isDragging: boolean) => void
  setDraggedChartId: (chartId: string | null) => void

  setShowChartTemplateGallery: (show: boolean) => void
  setContextMenu: (position: { x: number; y: number } | null, chartId?: string | null) => void

  setGridSnapping: (enabled: boolean) => void
  setShowGridLines: (show: boolean) => void

  setSelectedDateColumn: (column: string | null) => void

  setUploadProgress: (progress: number) => void
  setUploadStage: (stage: string | null) => void
  setUploadComplete: (complete: boolean) => void
  setUploadProjectId: (projectId: string | null) => void
  dismissUpload: () => void

  // Paywall modal actions
  openPaywallModal: (type: 'analysis' | 'chat', usageInfo: { used: number; limit: number; plan: string }) => void
  closePaywallModal: () => void

  // Reset all UI state
  resetUI: () => void
}

const initialState = {
  isCustomizing: false,
  showChartSettings: false,
  selectedChartId: null,
  showFullScreen: null,
  isDragging: false,
  draggedChartId: null,
  showChartTemplateGallery: false,
  contextMenuPosition: null,
  contextMenuChartId: null,
  gridSnapping: true,
  showGridLines: false,
  selectedDateColumn: null,
  uploadProgress: 0,
  uploadStage: null,
  uploadComplete: false,
  uploadProjectId: null,
  showPaywallModal: false,
  paywallType: null,
  paywallUsageInfo: null,
}

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,

  // Dashboard UI actions
  setIsCustomizing: (isCustomizing) => {
    console.log('🎨 [UI_STORE] Setting isCustomizing:', isCustomizing)
    set({ isCustomizing })
  },

  setShowChartSettings: (show) => {
    console.log('⚙️ [UI_STORE] Setting showChartSettings:', show)
    set({ showChartSettings: show })
  },

  setSelectedChartId: (chartId) => {
    console.log('📌 [UI_STORE] Setting selectedChartId:', chartId)
    set({ selectedChartId: chartId })
  },

  setFullScreen: (chartId) => {
    console.log('🖼️ [UI_STORE] Setting fullscreen chart:', chartId)
    set({ showFullScreen: chartId })
  },

  // Drag and drop actions
  setIsDragging: (isDragging) => {
    set({ isDragging })
  },

  setDraggedChartId: (chartId) => {
    set({ draggedChartId: chartId })
  },

  // Gallery and context menu actions
  setShowChartTemplateGallery: (show) => {
    console.log('🎨 [UI_STORE] Setting showChartTemplateGallery:', show)
    set({ showChartTemplateGallery: show })
  },

  setContextMenu: (position, chartId) => {
    set({
      contextMenuPosition: position,
      contextMenuChartId: chartId || null
    })
  },

  // Grid settings actions
  setGridSnapping: (enabled) => {
    console.log('📐 [UI_STORE] Setting gridSnapping:', enabled)
    set({ gridSnapping: enabled })
  },

  setShowGridLines: (show) => {
    console.log('📏 [UI_STORE] Setting showGridLines:', show)
    set({ showGridLines: show })
  },

  // Date range selector action
  setSelectedDateColumn: (column) => {
    console.log('📅 [UI_STORE] Setting selectedDateColumn:', column)
    set({ selectedDateColumn: column })
  },

  // Upload status actions
  setUploadProgress: (progress) => {
    const currentProgress = useUIStore.getState().uploadProgress
    if (progress < currentProgress) {
      console.warn('⚠️ [UI_STORE] Progress going backwards:', currentProgress, '→', progress, '- preventing backwards jump')
      // Prevent backwards progress by using max of current and new
      set({ uploadProgress: Math.max(currentProgress, progress) })
    } else {
      set({ uploadProgress: progress })
    }
  },

  setUploadStage: (stage) => {
    set({ uploadStage: stage })
  },

  setUploadComplete: (complete) => {
    set({ uploadComplete: complete })
  },

  setUploadProjectId: (projectId) => {
    set({ uploadProjectId: projectId })
  },

  dismissUpload: () => {
    console.log('🗑️ [UI_STORE] Dismissing upload status')
    set({
      uploadProgress: 0,
      uploadStage: null,
      uploadComplete: false,
      uploadProjectId: null,
    })
  },

  // Paywall modal actions
  openPaywallModal: (type, usageInfo) => {
    console.log('💰 [UI_STORE] Opening paywall modal:', { type, usageInfo })
    set({
      showPaywallModal: true,
      paywallType: type,
      paywallUsageInfo: usageInfo,
    })
  },

  closePaywallModal: () => {
    console.log('💰 [UI_STORE] Closing paywall modal')
    set({
      showPaywallModal: false,
      paywallType: null,
      paywallUsageInfo: null,
    })
  },

  // Reset all UI state
  resetUI: () => {
    console.log('🔄 [UI_STORE] Resetting all UI state')
    set(initialState)
  },
}))

/**
 * Selector hooks for common UI state patterns
 * These help prevent unnecessary re-renders by selecting only what's needed
 */

// Check if any chart is selected
export const useIsAnyChartSelected = () =>
  useUIStore((state) => state.selectedChartId !== null)

// Check if in customization mode
export const useIsCustomizingMode = () =>
  useUIStore((state) => state.isCustomizing)

// Get drag state (both flags at once)
export const useDragState = () =>
  useUIStore((state) => ({
    isDragging: state.isDragging,
    draggedChartId: state.draggedChartId
  }))
