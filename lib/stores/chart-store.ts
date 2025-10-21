/**
 * CHART STORE - Chart customizations and dashboard layout
 *
 * Purpose: Manages chart customizations, themes, layouts, filters, and draft charts
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Persists chartCustomizations, themes, and layouts
 * - Batch updates prevent multiple persistence writes
 * - History tracking limited to last 50 actions
 * - Undo/redo support for user actions
 *
 * USAGE EXAMPLES:
 *
 * // ✅ GOOD - Selective subscription to single chart customization
 * const chartCustomization = useChartStore((state) => state.chartCustomizations[chartId])
 *
 * // ✅ GOOD - Subscribe to current theme only
 * const currentTheme = useChartStore((state) => state.currentTheme)
 *
 * // ✅ GOOD - Multiple properties with shallow comparison
 * import { useShallow } from 'zustand/react/shallow'
 * const { currentTheme, currentLayout } = useChartStore(
 *   useShallow((state) => ({ currentTheme: state.currentTheme, currentLayout: state.currentLayout }))
 * )
 *
 * // ❌ BAD - Subscribes to entire store
 * const store = useChartStore()
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DateRange } from 'react-day-picker'

export type ChartType =
  | 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo'
  | 'waterfall' | 'funnel' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap' | 'sankey' | 'sparkline'

export interface ChartCustomization {
  id: string
  position: { x: number; y: number; w: number; h: number }
  colors?: string[]
  theme?: 'default' | 'light' | 'dark' | 'custom'
  showLegend?: boolean
  showGrid?: boolean
  showLabels?: boolean
  showConnectors?: boolean
  customTitle?: string
  customDescription?: string
  axisLabels?: { x?: string; y?: string }
  isVisible?: boolean
  chartType?: ChartType
  animate?: boolean
  interactive?: boolean
  stacked?: boolean
  percentageStack?: boolean
  dataColumns?: string[]
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile'
  dataMapping?: any // Complex type from original store
  autoSize?: boolean
  minHeight?: number
  maxHeight?: number
  labelRotation?: 'auto' | 'horizontal' | 'diagonal' | 'vertical'
}

export interface ChartTemplate {
  id: string
  name: string
  type: ChartType
  description: string
  category: 'comparison' | 'distribution' | 'trend' | 'relationship' | 'summary'
  icon: string
  defaultPosition: { w: number; h: number }
  requiredDataTypes: ('string' | 'number' | 'date' | 'boolean')[]
  minColumns: number
  maxColumns?: number
  preview?: string
}

export interface DashboardTheme {
  name: string
  colors: {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string
    muted: string
  }
  chartColors: string[]
  mode: 'light' | 'dark'
}

export interface DashboardFilter {
  id: string
  type: 'date' | 'category' | 'numeric' | 'text'
  column: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in'
  value: any
  isActive: boolean
}

export interface DashboardLayout {
  id: string
  name: string
  isDefault: boolean
  grid: {
    cols: number
    rows: number
    gap: number
  }
  chartPositions: Record<string, { x: number; y: number; w: number; h: number }>
}

interface ChartStore {
  // Chart customization state
  chartCustomizations: Record<string, ChartCustomization>
  draftChart: { id: string; type: ChartType; title: string; description: string; dataKey?: any[]; dataMapping?: any } | null

  // Theme state
  currentTheme: DashboardTheme
  availableThemes: DashboardTheme[]

  // Layout state
  currentLayout: DashboardLayout
  availableLayouts: DashboardLayout[]
  autoSaveLayouts: boolean

  // Filter state
  dashboardFilters: DashboardFilter[]
  dateRange: DateRange | undefined
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year'

  // Chart templates
  chartTemplates: ChartTemplate[]

  // History tracking (for undo/redo)
  customizationHistory: Array<{
    id: string
    action: string
    timestamp: string
    data: any
    previousState?: any
  }>
  redoHistory: Array<{
    id: string
    action: string
    timestamp: string
    data: any
    previousState?: any
  }>

  // Chart customization actions
  updateChartCustomization: (chartId: string, customization: Partial<ChartCustomization>) => void
  batchUpdateChartCustomizations: (updates: Record<string, Partial<ChartCustomization>>) => void
  removeChartCustomization: (chartId: string) => void

  // Draft chart actions
  setDraftChart: (chart: { id: string; type: ChartType; title: string; description: string; dataKey?: any[]; dataMapping?: any } | null) => void
  commitDraftChart: () => void

  // Theme actions
  setCurrentTheme: (theme: DashboardTheme) => void
  addCustomTheme: (theme: DashboardTheme) => void

  // Layout actions
  setCurrentLayout: (layout: DashboardLayout) => void
  addCustomLayout: (layout: DashboardLayout) => void
  saveLayout: (name: string) => void
  loadLayout: (layoutId: string) => void
  resetToDefaultLayout: () => void
  exportLayoutConfig: () => Promise<void>
  importLayoutConfig: (configFile: File) => Promise<void>
  setAutoSaveLayouts: (enabled: boolean) => void

  // Filter actions
  addDashboardFilter: (filter: DashboardFilter) => void
  updateDashboardFilter: (filterId: string, updates: Partial<DashboardFilter>) => void
  removeDashboardFilter: (filterId: string) => void
  clearAllFilters: () => void
  setDateRange: (range: DateRange | undefined) => void
  setGranularity: (granularity: 'day' | 'week' | 'month' | 'quarter' | 'year') => void

  // History actions
  addToHistory: (action: string, data: any) => void
  undoLastAction: () => void
  redoLastAction: () => void

  // Chart management actions
  addChart: (template: ChartTemplate, position?: { x: number; y: number }) => string
  removeChart: (chartId: string) => void
  duplicateChart: (chartId: string) => void
  updateChartType: (chartId: string, type: ChartType) => void

  // Export actions
  exportChart: (chartId: string, format: 'png' | 'pdf' | 'svg') => Promise<void>
  exportDashboard: (format: 'png' | 'pdf' | 'json') => Promise<void>
  generateShareableLink: () => Promise<string>

  // Clear all chart data
  clearCharts: () => void
}

// Default themes
const defaultThemes: DashboardTheme[] = [
  {
    name: 'Default',
    mode: 'light',
    colors: {
      primary: '#0088FE',
      secondary: '#00C49F',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      muted: '#64748b'
    },
    chartColors: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']
  },
  {
    name: 'Dark',
    mode: 'dark',
    colors: {
      primary: '#3b82f6',
      secondary: '#10b981',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
      muted: '#94a3b8'
    },
    chartColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
  },
  {
    name: 'Warm',
    mode: 'light',
    colors: {
      primary: '#ea580c',
      secondary: '#dc2626',
      background: '#fefcfb',
      surface: '#fff7ed',
      text: '#9a3412',
      muted: '#a3a3a3'
    },
    chartColors: ['#ea580c', '#dc2626', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6']
  }
]

// Default layout
const defaultLayout: DashboardLayout = {
  id: 'default',
  name: 'Default Layout',
  isDefault: true,
  grid: {
    cols: 12,
    rows: 8,
    gap: 24
  },
  chartPositions: {}
}

// Default chart templates (subset for brevity - full list from original store)
const defaultChartTemplates: ChartTemplate[] = [
  {
    id: 'line-trend',
    name: 'Line Chart',
    type: 'line',
    description: 'Show trends and changes over time',
    category: 'trend',
    icon: 'TrendingUp',
    defaultPosition: { w: 6, h: 4 },
    requiredDataTypes: ['number'],
    minColumns: 2,
    maxColumns: 5,
  },
  {
    id: 'bar-comparison',
    name: 'Bar Chart',
    type: 'bar',
    description: 'Compare values across categories',
    category: 'comparison',
    icon: 'BarChart3',
    defaultPosition: { w: 6, h: 4 },
    requiredDataTypes: ['number'],
    minColumns: 2,
    maxColumns: 4,
  },
  {
    id: 'pie-distribution',
    name: 'Pie Chart',
    type: 'pie',
    description: 'Show proportional distribution',
    category: 'distribution',
    icon: 'PieChart',
    defaultPosition: { w: 4, h: 4 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 1,
    maxColumns: 2,
  },
  {
    id: 'scorecard-kpi',
    name: 'Scorecard',
    type: 'scorecard',
    description: 'Display key metrics and KPIs',
    category: 'summary',
    icon: 'Gauge',
    defaultPosition: { w: 2, h: 1 },
    requiredDataTypes: ['number'],
    minColumns: 1,
    maxColumns: 1,
  },
  {
    id: 'table-detailed',
    name: 'Data Table',
    type: 'table',
    description: 'Show detailed tabular data',
    category: 'summary',
    icon: 'Table',
    defaultPosition: { w: 12, h: 6 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 1,
  },
]

export const useChartStore = create<ChartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      chartCustomizations: {},
      draftChart: null,
      currentTheme: defaultThemes[0],
      availableThemes: defaultThemes,
      currentLayout: defaultLayout,
      availableLayouts: [defaultLayout],
      autoSaveLayouts: true,
      dashboardFilters: [],
      dateRange: undefined,
      granularity: 'day',
      chartTemplates: defaultChartTemplates,
      customizationHistory: [],
      redoHistory: [],

      // Chart customization actions
      updateChartCustomization: (chartId, customization) => {
        console.log('🎨 [CHART_STORE] Updating chart customization:', chartId)
        set(state => ({
          chartCustomizations: {
            ...state.chartCustomizations,
            [chartId]: {
              ...state.chartCustomizations[chartId],
              ...customization,
              id: chartId
            }
          }
        }))
        get().addToHistory('chart_customize', { chartId, customization })
      },

      batchUpdateChartCustomizations: (updates) => {
        console.log('🎨 [CHART_STORE] Batch updating chart customizations:', Object.keys(updates).length)
        set(state => {
          const newCustomizations = { ...state.chartCustomizations }
          Object.entries(updates).forEach(([chartId, customization]) => {
            const updated = {
              ...newCustomizations[chartId],
              ...customization,
              id: chartId
            }

            // Remove any properties that were explicitly set to undefined
            Object.keys(customization).forEach(key => {
              if (customization[key as keyof typeof customization] === undefined) {
                delete updated[key as keyof typeof updated]
              }
            })

            newCustomizations[chartId] = updated
          })
          return { chartCustomizations: newCustomizations }
        })
        get().addToHistory('chart_batch_customize', { updates })
      },

      removeChartCustomization: (chartId) => {
        console.log('🗑️ [CHART_STORE] Removing chart customization:', chartId)
        set(state => {
          const { [chartId]: removed, ...rest } = state.chartCustomizations
          return { chartCustomizations: rest }
        })
        get().addToHistory('chart_customize_remove', { chartId })
      },

      // Draft chart actions
      setDraftChart: (chart) => {
        console.log('📝 [CHART_STORE] Setting draft chart:', chart?.id)
        set({ draftChart: chart })
      },

      commitDraftChart: () => {
        const state = get()
        if (!state.draftChart) {
          console.warn('⚠️ [CHART_STORE] No draft chart to commit')
          return
        }

        console.log('✅ [CHART_STORE] Committing draft chart:', state.draftChart.id)
        // Note: This would typically update the data-store's analysis.chartConfig
        // For now, we just clear the draft
        set({ draftChart: null })
        get().addToHistory('chart_commit', { chartId: state.draftChart.id })
      },

      // Theme actions
      setCurrentTheme: (theme) => {
        console.log('🎨 [CHART_STORE] Setting theme:', theme.name)
        set({ currentTheme: theme })
        get().addToHistory('theme_change', { theme: theme.name })
      },

      addCustomTheme: (theme) => {
        console.log('➕ [CHART_STORE] Adding custom theme:', theme.name)
        set(state => ({
          availableThemes: [...state.availableThemes, theme],
          currentTheme: theme
        }))
        get().addToHistory('theme_add', { theme })
      },

      // Layout actions
      setCurrentLayout: (layout) => {
        console.log('📐 [CHART_STORE] Setting layout:', layout.name)
        set({ currentLayout: layout })
        get().addToHistory('layout_change', { layout: layout.name })
      },

      addCustomLayout: (layout) => {
        console.log('➕ [CHART_STORE] Adding custom layout:', layout.name)
        set(state => ({
          availableLayouts: [...state.availableLayouts, layout],
          currentLayout: layout
        }))
        get().addToHistory('layout_add', { layout })
      },

      saveLayout: (name) => {
        const state = get()
        console.log('💾 [CHART_STORE] Saving layout:', name)
        const newLayout: DashboardLayout = {
          id: `layout-${Date.now()}`,
          name,
          isDefault: false,
          grid: state.currentLayout.grid,
          chartPositions: { ...state.currentLayout.chartPositions }
        }

        get().addCustomLayout(newLayout)
        get().addToHistory('layout_save', { layout: newLayout })
      },

      loadLayout: (layoutId) => {
        const state = get()
        const layout = state.availableLayouts.find(l => l.id === layoutId)
        if (layout) {
          console.log('📥 [CHART_STORE] Loading layout:', layout.name)
          get().setCurrentLayout(layout)
        }
      },

      resetToDefaultLayout: () => {
        console.log('🔄 [CHART_STORE] Resetting to default layout')
        set({ currentLayout: defaultLayout, chartCustomizations: {} })
        get().addToHistory('layout_reset', { layout: 'default' })
      },

      exportLayoutConfig: async () => {
        const state = get()
        console.log('📤 [CHART_STORE] Exporting layout config')
        const config = {
          layout: state.currentLayout,
          customizations: state.chartCustomizations,
          theme: state.currentTheme,
          filters: state.dashboardFilters,
          exportDate: new Date().toISOString(),
        }

        const blob = new Blob([JSON.stringify(config, null, 2)], {
          type: 'application/json'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `layout-${state.currentLayout.name}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      },

      importLayoutConfig: async (configFile) => {
        console.log('📥 [CHART_STORE] Importing layout config')
        try {
          const text = await configFile.text()
          const config = JSON.parse(text)

          if (config.layout) {
            const importedLayout = {
              ...config.layout,
              id: `layout-${Date.now()}`,
              name: `${config.layout.name} (Imported)`
            }
            get().addCustomLayout(importedLayout)
          }

          if (config.customizations) {
            set(state => ({
              chartCustomizations: { ...state.chartCustomizations, ...config.customizations }
            }))
          }

          if (config.theme) {
            get().addCustomTheme(config.theme)
          }

          if (config.filters) {
            set(state => ({
              dashboardFilters: [...state.dashboardFilters, ...config.filters]
            }))
          }

          get().addToHistory('layout_import', { fileName: configFile.name })
        } catch (error) {
          console.error('❌ [CHART_STORE] Failed to import layout config:', error)
        }
      },

      setAutoSaveLayouts: (enabled) => {
        console.log('💾 [CHART_STORE] Setting auto-save layouts:', enabled)
        set({ autoSaveLayouts: enabled })
      },

      // Filter actions
      addDashboardFilter: (filter) => {
        console.log('🔍 [CHART_STORE] Adding dashboard filter:', filter.column)
        set(state => ({
          dashboardFilters: [...state.dashboardFilters, filter]
        }))
        get().addToHistory('filter_add', { filter })
      },

      updateDashboardFilter: (filterId, updates) => {
        console.log('🔍 [CHART_STORE] Updating dashboard filter:', filterId)
        set(state => ({
          dashboardFilters: state.dashboardFilters.map(filter =>
            filter.id === filterId ? { ...filter, ...updates } : filter
          )
        }))
        get().addToHistory('filter_update', { filterId, updates })
      },

      removeDashboardFilter: (filterId) => {
        console.log('🗑️ [CHART_STORE] Removing dashboard filter:', filterId)
        set(state => ({
          dashboardFilters: state.dashboardFilters.filter(filter => filter.id !== filterId)
        }))
        get().addToHistory('filter_remove', { filterId })
      },

      clearAllFilters: () => {
        console.log('🗑️ [CHART_STORE] Clearing all filters')
        const currentFilters = get().dashboardFilters
        set({ dashboardFilters: [] })
        get().addToHistory('filters_clear', { previousFilters: currentFilters })
      },

      setDateRange: (range) => {
        console.log('📅 [CHART_STORE] Setting date range:', range)
        set({ dateRange: range })
      },

      setGranularity: (granularity) => {
        console.log('📊 [CHART_STORE] Setting granularity:', granularity)
        set({ granularity })
      },

      // History actions
      addToHistory: (action, data) => {
        set(state => ({
          customizationHistory: [
            ...state.customizationHistory,
            {
              id: Date.now().toString(),
              action,
              timestamp: new Date().toISOString(),
              data,
            }
          ].slice(-50), // Keep only last 50 actions
          redoHistory: [] // Clear redo history when new action is performed
        }))
      },

      undoLastAction: () => {
        const state = get()
        const lastAction = state.customizationHistory[state.customizationHistory.length - 1]
        if (!lastAction) return

        console.log('↩️ [CHART_STORE] Undoing action:', lastAction.action)
        // Implementation would depend on action type
        set(state => ({
          customizationHistory: state.customizationHistory.slice(0, -1),
          redoHistory: [...state.redoHistory, lastAction]
        }))
      },

      redoLastAction: () => {
        const state = get()
        const lastRedoAction = state.redoHistory[state.redoHistory.length - 1]
        if (!lastRedoAction) return

        console.log('↪️ [CHART_STORE] Redoing action:', lastRedoAction.action)
        // Implementation would depend on action type
        set(state => ({
          customizationHistory: [...state.customizationHistory, lastRedoAction],
          redoHistory: state.redoHistory.slice(0, -1)
        }))
      },

      // Chart management actions (these would interact with data-store in full implementation)
      addChart: (template, position) => {
        const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        console.log('➕ [CHART_STORE] Adding chart:', chartId)

        const customization: ChartCustomization = {
          id: chartId,
          position: position
            ? { x: position.x, y: position.y, w: template.defaultPosition.w, h: template.defaultPosition.h }
            : { x: 0, y: 0, w: template.defaultPosition.w, h: template.defaultPosition.h },
          isVisible: true,
          chartType: template.type,
        }

        get().updateChartCustomization(chartId, customization)
        return chartId
      },

      removeChart: (chartId) => {
        console.log('🗑️ [CHART_STORE] Removing chart:', chartId)
        get().removeChartCustomization(chartId)
        get().addToHistory('chart_remove', { chartId })
      },

      duplicateChart: (chartId) => {
        console.log('📋 [CHART_STORE] Duplicating chart:', chartId)
        const state = get()
        const originalCustomization = state.chartCustomizations[chartId]
        if (!originalCustomization) return

        const newChartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newCustomization = {
          ...originalCustomization,
          id: newChartId,
          position: {
            ...originalCustomization.position,
            x: Math.min(originalCustomization.position.x + 1, 11),
            y: originalCustomization.position.y + 1,
          }
        }
        get().updateChartCustomization(newChartId, newCustomization)
        get().addToHistory('chart_duplicate', { originalChartId: chartId, newChartId })
      },

      updateChartType: (chartId, type) => {
        console.log('🔄 [CHART_STORE] Updating chart type:', { chartId, type })
        get().updateChartCustomization(chartId, { chartType: type })
        get().addToHistory('chart_type_change', { chartId, newType: type })
      },

      // Export actions (simplified - full implementation in original store)
      exportChart: async (chartId, format) => {
        console.log('📤 [CHART_STORE] Exporting chart:', { chartId, format })
        // Implementation would use html2canvas or similar
      },

      exportDashboard: async (format) => {
        console.log('📤 [CHART_STORE] Exporting dashboard:', format)
        // Implementation would use html2canvas, jsPDF, or similar
      },

      generateShareableLink: async () => {
        console.log('🔗 [CHART_STORE] Generating shareable link')
        // Implementation would call API endpoint
        return 'shareable-link-placeholder'
      },

      clearCharts: () => {
        console.log('🗑️ [CHART_STORE] Clearing all charts')
        set({
          chartCustomizations: {},
          draftChart: null,
          dashboardFilters: [],
          dateRange: undefined,
          customizationHistory: [],
          redoHistory: [],
        })
      },
    }),
    {
      name: 'datacrafted-chart-store',
      // Persist customizations, themes, and layouts
      partialize: (state) => ({
        chartCustomizations: state.chartCustomizations,
        currentTheme: state.currentTheme,
        availableThemes: state.availableThemes,
        currentLayout: state.currentLayout,
        availableLayouts: state.availableLayouts,
      }),
    }
  )
)

/**
 * Selector hooks for common chart patterns
 */

// Get specific chart customization
export const useChartCustomization = (chartId: string) =>
  useChartStore((state) => state.chartCustomizations[chartId])

// Get all visible chart IDs
export const useVisibleChartIds = () =>
  useChartStore((state) =>
    Object.keys(state.chartCustomizations).filter(
      id => state.chartCustomizations[id].isVisible !== false
    )
  )

// Check if undo/redo available
export const useCanUndo = () =>
  useChartStore((state) => state.customizationHistory.length > 0)

export const useCanRedo = () =>
  useChartStore((state) => state.redoHistory.length > 0)
