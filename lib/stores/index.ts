/**
 * STORE BARREL EXPORTS - Centralized store access
 *
 * This file exports all domain-specific stores and their helper functions.
 *
 * MIGRATION FROM MONOLITHIC STORE:
 * - useDataStore: Core data operations (rawData, analysis, schema)
 * - useUIStore: Transient UI state (modals, drag state, selections)
 * - useSessionStore: User sessions and persistence
 * - useChartStore: Chart customizations, themes, layouts
 * - useChatStore: Chat messages and chat interface
 *
 * PERFORMANCE BENEFITS:
 * - Each store isolated - prevents cross-domain re-renders
 * - Selective subscriptions easier with focused stores
 * - Smaller persistence payloads per store
 * - Better code organization and maintainability
 */

// Core stores
export { useDataStore } from './data-store'
export { useUIStore, useIsAnyChartSelected, useIsCustomizingMode, useDragState } from './ui-store'
export { useSessionStore, useIsSavingSession, useCurrentSessionId, useHasActiveSession } from './session-store'
export { useChartStore, useChartCustomization, useVisibleChartIds, useCanUndo, useCanRedo } from './chart-store'
export { useChatStore, useRecentMessages, useMessageCount, useHasChatMessages, useLastMessage } from './chat-store'

// Type exports
export type { DataRow, ColumnSchema, DataSchema, AnalysisResult } from './data-store'
export type { SessionInfo, RecentSession } from './session-store'
export type { ChartCustomization, ChartTemplate, DashboardTheme, DashboardFilter, DashboardLayout, ChartType } from './chart-store'
export type { ChatMessage } from './chat-store'

// Helper functions
export { isEnhancedAnalysis } from './data-store'

/**
 * BACKWARD COMPATIBILITY LAYER
 *
 * For components still using the old monolithic store,
 * this provides a compatibility wrapper that combines all stores.
 *
 * IMPORTANT: This is temporary - migrate to individual stores for best performance!
 */
import { useDataStore } from './data-store'
import { useUIStore } from './ui-store'
import { useSessionStore } from './session-store'
import { useChartStore } from './chart-store'
import { useChatStore } from './chat-store'
import { useShallow } from 'zustand/react/shallow'

/**
 * @deprecated Use individual stores (useDataStore, useUIStore, etc.) for better performance
 */
export function useLegacyDataStore() {
  console.warn('⚠️ useLegacyDataStore is deprecated. Please migrate to individual stores.')

  // Combine all stores - WARNING: This subscribes to ALL changes!
  const dataState = useDataStore()
  const uiState = useUIStore()
  const sessionState = useSessionStore()
  const chartState = useChartStore()
  const chatState = useChatStore()

  return {
    ...dataState,
    ...uiState,
    ...sessionState,
    ...chartState,
    ...chatState,
  }
}
