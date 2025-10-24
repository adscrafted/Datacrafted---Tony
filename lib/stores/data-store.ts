/**
 * DATA STORE - Core data operations
 *
 * Purpose: Manages raw data, schema, analysis results, and data transformations
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Only persists metadata (fileName, dataId, dataSchema) - NOT full rawData
 * - Large datasets (>1000 rows) stored in IndexedDB
 * - Small datasets kept in memory only
 * - Selective subscriptions prevent unnecessary re-renders
 *
 * USAGE EXAMPLES:
 *
 * // ✅ GOOD - Selective subscription (only re-renders when fileName changes)
 * const fileName = useDataStore((state) => state.fileName)
 *
 * // ✅ GOOD - Multiple properties with shallow comparison
 * import { useShallow } from 'zustand/react/shallow'
 * const { rawData, fileName } = useDataStore(
 *   useShallow((state) => ({ rawData: state.rawData, fileName: state.fileName }))
 * )
 *
 * // ❌ BAD - Subscribes to entire store (re-renders on ANY change)
 * const store = useDataStore()
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dataStorage } from '@/lib/data-storage'
import type {
  EnhancedAnalysisResult,
  CorrectedColumn,
  DataContext,
} from '@/lib/types/recommendation'
import { invalidateFilteredDataCache } from './filtered-data'
import { logger } from '@/lib/utils/logger'

export interface DataRow {
  [key: string]: string | number | boolean | Date | null
}

export interface ColumnSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'categorical'
  uniqueValues: number
  nullCount: number
  nullPercentage: number
  sampleValues: any[]
  stats?: {
    min?: number
    max?: number
    avg?: number
    median?: number
    std?: number
  }
  description?: string
  suggestedUsage?: string[]
  confidence?: number
  detectionReason?: string
}

export interface DataSchema {
  fileName: string
  rowCount: number
  columnCount: number
  columns: ColumnSchema[]
  relationships?: Array<{
    from: string
    to: string
    type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  }>
  businessContext?: string
  uploadedAt: string
}

/**
 * Legacy analysis result for backward compatibility
 * New code should use EnhancedAnalysisResult from recommendation types
 */
export interface AnalysisResult {
  insights: string[]
  chartConfig: Array<{
    id?: string
    type: string
    title: string
    description: string
    dataMapping?: any
    dataKey?: string[]
    xAxis?: string | string[]
    yAxis?: string | string[]
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile'
    customization?: any
    confidence?: number
    reasoning?: string
    qualityScore?: number
    qualityFactors?: any
  }>
  summary: {
    rowCount: number
    columnCount: number
    columns: Array<{
      name: string
      type: string
      uniqueValues: number
      nullCount: number
    }>
    dataQuality?: string
    keyFindings?: string
    recommendations?: string
    businessContext?: string
  }
}

interface DataStore {
  // Core data state
  fileName: string | null
  rawData: DataRow[]
  dataId: string | null // IndexedDB storage ID
  dataSchema: DataSchema | null

  /** Analysis result - can be either legacy or enhanced format */
  analysis: AnalysisResult | EnhancedAnalysisResult | null

  /** User corrections from data tab for improved recommendations */
  correctedSchema: CorrectedColumn[] | null

  /** Data context extracted from AI analysis */
  dataContext: DataContext | null

  // Analysis state
  isAnalyzing: boolean
  error: string | null
  analysisProgress: number
  usingAI: boolean

  // Available columns for chart configuration
  availableColumns: string[]

  // Data actions
  setFileName: (name: string) => void
  setRawData: (data: DataRow[]) => Promise<void>
  setDataSchema: (schema: DataSchema) => void

  /** Set analysis result - supports both legacy and enhanced formats */
  setAnalysis: (analysis: AnalysisResult | EnhancedAnalysisResult | null) => void

  /** Update corrected schema from user feedback */
  setCorrectedSchema: (schema: CorrectedColumn[]) => void

  /** Set data context from AI analysis */
  setDataContext: (context: DataContext) => void

  setIsAnalyzing: (isAnalyzing: boolean) => void
  setError: (error: string | null) => void
  setAnalysisProgress: (progress: number) => void
  setUsingAI: (usingAI: boolean) => void
  setAvailableColumns: (columns: string[]) => void

  // Load full data from IndexedDB when needed
  loadFullData: () => Promise<DataRow[]>

  // Clear all data
  clearData: () => void
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      // Initial state
      fileName: null,
      rawData: [],
      dataId: null,
      dataSchema: null,
      analysis: null,
      correctedSchema: null,
      dataContext: null,
      isAnalyzing: false,
      error: null,
      analysisProgress: 0,
      usingAI: false,
      availableColumns: [],

      // Actions
      setFileName: (name) => set({ fileName: name }),

      setRawData: async (data) => {
        try {
          // OPTIMIZATION: For large datasets (>1000 rows), store in IndexedDB
          if (data && data.length > 1000) {
            const fileName = get().fileName || 'untitled'
            const dataId = await dataStorage.saveData(fileName, data)
            logger.log('📦 [DATA_STORE] Stored large dataset in IndexedDB:', {
              rows: data.length,
              dataId,
              timestamp: new Date().toISOString()
            })
            set({ rawData: data, dataId })
          } else {
            // For small datasets, just store in memory
            logger.log('📦 [DATA_STORE] Stored small dataset in memory:', {
              rows: data.length,
              timestamp: new Date().toISOString()
            })
            set({ rawData: data, dataId: null })
          }

          // Extract available columns
          if (data && data.length > 0) {
            const columns = Object.keys(data[0])
            set({ availableColumns: columns })
          }

          // Invalidate filtered data cache when rawData changes
          invalidateFilteredDataCache()
        } catch (error) {
          logger.error('❌ [DATA_STORE] Failed to store data:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            dataLength: data?.length,
            timestamp: new Date().toISOString()
          })
          // Fallback to memory storage
          set({ rawData: data, dataId: null })
          // Still invalidate cache even on error
          invalidateFilteredDataCache()
        }
      },

      setDataSchema: (schema) => {
        logger.log('📊 [DATA_STORE] Setting data schema:', {
          fileName: schema.fileName,
          rowCount: schema.rowCount,
          columnCount: schema.columnCount,
          timestamp: new Date().toISOString()
        })
        set({ dataSchema: schema })
      },

      setAnalysis: (analysis) => {
        // Handle null explicitly to clear analysis
        if (analysis === null) {
          logger.log('📦 [DATA_STORE] Clearing analysis')
          set({ analysis: null, dataContext: null })
          return
        }

        logger.log('📦 [DATA_STORE] Setting analysis:', {
          chartCount: analysis?.chartConfig?.length || 0,
          hasDataContext: 'dataContext' in analysis && !!analysis.dataContext,
          timestamp: new Date().toISOString()
        })

        set({ analysis })

        // Extract data context if available from enhanced analysis
        if (analysis && typeof analysis === 'object' && 'dataContext' in analysis && analysis.dataContext) {
          set({ dataContext: analysis.dataContext })
        }
      },

      setCorrectedSchema: (schema) => {
        logger.log('📝 [DATA_STORE] Setting corrected schema:', {
          corrections: schema.length,
          timestamp: new Date().toISOString()
        })
        set({ correctedSchema: schema })
      },

      setDataContext: (context) => {
        logger.log('🎯 [DATA_STORE] Setting data context:', {
          domain: context.domain,
          timestamp: new Date().toISOString()
        })
        set({ dataContext: context })
      },

      setIsAnalyzing: (isAnalyzing) => {
        logger.log('🔄 [DATA_STORE] setIsAnalyzing called:', {
          isAnalyzing,
          timestamp: new Date().toISOString(),
          stackTrace: new Error().stack?.split('\n').slice(2, 5).join('\n')
        })
        set({ isAnalyzing })
      },
      setError: (error) => set({ error }),
      setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
      setUsingAI: (usingAI) => set({ usingAI }),
      setAvailableColumns: (columns) => set({ availableColumns: columns }),

      loadFullData: async () => {
        const state = get()

        // If data is already in memory, return it
        if (state.rawData && state.rawData.length > 0) {
          return state.rawData
        }

        // Otherwise, load from IndexedDB
        if (state.dataId) {
          try {
            logger.log('📥 [DATA_STORE] Loading data from IndexedDB:', state.dataId)
            const data = await dataStorage.loadData(state.dataId)
            if (data) {
              set({ rawData: data })
              // Invalidate cache when loading new data
              invalidateFilteredDataCache()
              return data
            }
          } catch (error) {
            logger.error('❌ [DATA_STORE] Failed to load data from IndexedDB:', error)
          }
        }

        return []
      },

      clearData: () => {
        logger.log('🗑️ [DATA_STORE] Clearing all data')
        set({
          fileName: null,
          rawData: [],
          dataId: null,
          dataSchema: null,
          analysis: null,
          correctedSchema: null,
          dataContext: null,
          isAnalyzing: false,
          error: null,
          analysisProgress: 0,
          availableColumns: [],
        })
        // Invalidate cache when clearing data
        invalidateFilteredDataCache()
      },
    }),
    {
      name: 'datacrafted-data-store',
      // CRITICAL: Only persist metadata, NOT full rawData
      partialize: (state) => ({
        fileName: state.fileName,
        dataId: state.dataId, // Reference to IndexedDB data
        dataSchema: state.dataSchema,
        // Only persist analysis if it has actual charts
        analysis: state.analysis && state.analysis.chartConfig && state.analysis.chartConfig.length > 0
          ? state.analysis
          : undefined,
        correctedSchema: state.correctedSchema,
        dataContext: state.dataContext,
        // Store flag indicating data exists
        hasData: state.rawData && state.rawData.length > 0,
      }),
      onRehydrateStorage: (state) => {
        return (rehydratedState, error) => {
          if (error) {
            logger.error('❌ [DATA_STORE] Failed to rehydrate:', error)
            return
          }

          if (rehydratedState) {
            // Load data from IndexedDB after store hydration
            if (rehydratedState.dataId && !rehydratedState.rawData?.length) {
              logger.log('📥 [DATA_STORE] Rehydrating data from IndexedDB:', rehydratedState.dataId)
              dataStorage.loadData(rehydratedState.dataId).then(data => {
                if (data) {
                  useDataStore.setState({ rawData: data })

                  // Extract available columns
                  if (data.length > 0) {
                    const columns = Object.keys(data[0])
                    useDataStore.setState({ availableColumns: columns })
                  }

                  // Invalidate cache when rehydrating data
                  invalidateFilteredDataCache()
                }
              }).catch(error => {
                logger.error('❌ [DATA_STORE] Failed to load data from IndexedDB:', error)
              })
            }
          }
        }
      },
    }
  )
)

/**
 * Helper function to check if analysis result is in enhanced format
 */
export function isEnhancedAnalysis(
  analysis: AnalysisResult | EnhancedAnalysisResult | null
): analysis is EnhancedAnalysisResult {
  if (!analysis) return false
  return 'recommendations' in analysis && 'dataContext' in analysis
}
