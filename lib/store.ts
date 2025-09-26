import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DateRange } from 'react-day-picker'
import { aggregateDataByGranularity } from '@/lib/utils/data-aggregation'
import { dataStorage } from '@/lib/data-storage'

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

export interface ChartCustomization {
  id: string
  position: { x: number; y: number; w: number; h: number }
  colors?: string[]
  theme?: 'default' | 'light' | 'dark' | 'custom'
  showLegend?: boolean
  showGrid?: boolean
  customTitle?: string
  customDescription?: string
  axisLabels?: { x?: string; y?: string }
  isVisible?: boolean
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table'
  animate?: boolean
  interactive?: boolean
  stacked?: boolean
  dataColumns?: string[]
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
  // Data mapping for custom column selection
  dataMapping?: {
    xAxis?: string
    yAxis?: string | string[]
    category?: string // For pie charts
    value?: string // For pie charts and scorecards
    metric?: string // For scorecards
  }
  // Dynamic sizing options
  autoSize?: boolean
  minHeight?: number
  maxHeight?: number
  labelRotation?: 'auto' | 'horizontal' | 'diagonal' | 'vertical'
}

export interface ChartTemplate {
  id: string
  name: string
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table'
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

export interface AnalysisResult {
  insights: string[]
  chartConfig: Array<{
    id?: string
    type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table'
    title: string
    dataKey: string[]
    description: string
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
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
    // Extended AI analysis fields (optional)
    dataQuality?: string
    keyFindings?: string
    recommendations?: string
    businessContext?: string
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SessionInfo {
  id: string
  name?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface RecentSession {
  id: string
  name?: string
  description?: string
  updatedAt: string
  previewData?: {
    fileName?: string
    chartCount?: number
    messageCount?: number
  }
}

interface DataStore {
  // Session state
  currentSession: SessionInfo | null
  recentSessions: RecentSession[]
  isSaving: boolean
  saveError: string | null

  // Data state
  fileName: string | null
  rawData: DataRow[]
  dataId: string | null // IndexedDB storage ID
  dataSchema: DataSchema | null
  analysis: AnalysisResult | null
  isAnalyzing: boolean
  error: string | null
  analysisProgress: number
  usingAI: boolean
  dateRange: DateRange | undefined
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year'
  selectedChartId: string | null
  showChartSettings: boolean

  // Chat state
  chatMessages: ChatMessage[]
  isChatOpen: boolean
  isChatLoading: boolean
  chatError: string | null

  // Dashboard customization state
  currentTheme: DashboardTheme
  availableThemes: DashboardTheme[]
  chartCustomizations: Record<string, ChartCustomization>
  dashboardFilters: DashboardFilter[]
  currentLayout: DashboardLayout
  availableLayouts: DashboardLayout[]
  isCustomizing: boolean
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
  showFullScreen: string | null // chart ID for full-screen view

  // Enhanced dashboard state
  chartTemplates: ChartTemplate[]
  availableColumns: string[]
  isDragging: boolean
  draggedChartId: string | null
  showChartTemplateGallery: boolean
  contextMenuPosition: { x: number; y: number } | null
  contextMenuChartId: string | null
  gridSnapping: boolean
  showGridLines: boolean
  autoSaveLayouts: boolean
  
  // Session actions
  setCurrentSession: (session: SessionInfo | null) => void
  setRecentSessions: (sessions: RecentSession[]) => void
  addRecentSession: (session: RecentSession) => void
  setIsSaving: (isSaving: boolean) => void
  setSaveError: (error: string | null) => void
  createNewSession: (name?: string, description?: string) => Promise<void>
  loadSession: (sessionId: string) => Promise<void>
  saveCurrentSession: () => Promise<void>
  updateSessionMetadata: (name?: string, description?: string) => Promise<void>
  
  // Data actions
  setFileName: (name: string) => void
  setRawData: (data: DataRow[]) => Promise<void>
  setDataSchema: (schema: DataSchema) => void
  setAnalysis: (analysis: AnalysisResult) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setError: (error: string | null) => void
  setAnalysisProgress: (progress: number) => void
  setUsingAI: (usingAI: boolean) => void
  setDateRange: (range: DateRange | undefined) => void
  setGranularity: (granularity: 'day' | 'week' | 'month' | 'quarter' | 'year') => void
  setSelectedChartId: (chartId: string | null) => void
  setShowChartSettings: (show: boolean) => void
  
  // Chat actions
  addChatMessage: (message: ChatMessage) => void
  setChatMessages: (messages: ChatMessage[]) => void
  setIsChatOpen: (isOpen: boolean) => void
  setIsChatLoading: (isLoading: boolean) => void
  setChatError: (error: string | null) => void
  clearChatHistory: () => void
  saveChatMessage: (message: ChatMessage) => Promise<void>
  
  // Dashboard customization actions
  setCurrentTheme: (theme: DashboardTheme) => void
  addCustomTheme: (theme: DashboardTheme) => void
  updateChartCustomization: (chartId: string, customization: Partial<ChartCustomization>) => void
  removeChartCustomization: (chartId: string) => void
  addDashboardFilter: (filter: DashboardFilter) => void
  updateDashboardFilter: (filterId: string, updates: Partial<DashboardFilter>) => void
  removeDashboardFilter: (filterId: string) => void
  clearAllFilters: () => void
  setCurrentLayout: (layout: DashboardLayout) => void
  addCustomLayout: (layout: DashboardLayout) => void
  setIsCustomizing: (isCustomizing: boolean) => void
  addToHistory: (action: string, data: any) => void
  undoLastAction: () => void
  redoLastAction: () => void
  setFullScreen: (chartId: string | null) => void
  exportChart: (chartId: string, format: 'png' | 'pdf' | 'svg') => Promise<void>
  exportDashboard: (format: 'png' | 'pdf' | 'json') => Promise<void>
  generateShareableLink: () => Promise<string>
  getFilteredData: () => DataRow[]

  // Enhanced dashboard actions
  addChart: (template: ChartTemplate, position?: { x: number; y: number }) => void
  removeChart: (chartId: string) => void
  duplicateChart: (chartId: string) => void
  updateChartType: (chartId: string, type: ChartTemplate['type']) => void
  setAvailableColumns: (columns: string[]) => void
  setIsDragging: (isDragging: boolean) => void
  setDraggedChartId: (chartId: string | null) => void
  setShowChartTemplateGallery: (show: boolean) => void
  setContextMenu: (position: { x: number; y: number } | null, chartId?: string | null) => void
  setGridSnapping: (enabled: boolean) => void
  setShowGridLines: (show: boolean) => void
  setAutoSaveLayouts: (enabled: boolean) => void
  saveLayout: (name: string) => void
  loadLayout: (layoutId: string) => void
  resetToDefaultLayout: () => void
  exportLayoutConfig: () => Promise<void>
  importLayoutConfig: (configFile: File) => Promise<void>

  // Utility actions
  reset: () => void
  exportSession: (format: 'json' | 'csv') => Promise<void>
}

// Default chart templates
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
    id: 'area-filled',
    name: 'Area Chart',
    type: 'area',
    description: 'Visualize cumulative trends',
    category: 'trend',
    icon: 'Activity',
    defaultPosition: { w: 6, h: 4 },
    requiredDataTypes: ['number'],
    minColumns: 2,
    maxColumns: 4,
  },
  {
    id: 'scatter-relationship',
    name: 'Scatter Plot',
    type: 'scatter',
    description: 'Explore relationships between variables',
    category: 'relationship',
    icon: 'Scatter',
    defaultPosition: { w: 6, h: 4 },
    requiredDataTypes: ['number'],
    minColumns: 2,
    maxColumns: 3,
  },
  {
    id: 'scorecard-kpi',
    name: 'Scorecard',
    type: 'scorecard',
    description: 'Display key metrics and KPIs',
    category: 'summary',
    icon: 'Gauge',
    defaultPosition: { w: 3, h: 3 },
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
    maxColumns: undefined,
  },
]

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

// Helper function to get current state for undo operations
const getCurrentStateForAction = (action: string, state: any) => {
  switch (action) {
    case 'theme_change':
      return { theme: state.currentTheme }
    case 'chart_customize':
      return { chartCustomizations: { ...state.chartCustomizations } }
    case 'filter_add':
    case 'filter_update':
    case 'filter_remove':
    case 'filters_clear':
      return { filters: [...state.dashboardFilters] }
    case 'layout_change':
      return { layout: state.currentLayout }
    default:
      return null
  }
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      // Session state
      currentSession: null,
      recentSessions: [],
      isSaving: false,
      saveError: null,
      
      // Data state
      fileName: null,
      rawData: [],
      dataId: null,
      dataSchema: null,
      analysis: null,
      isAnalyzing: false,
      error: null,
      analysisProgress: 0,
      usingAI: false,
      dateRange: undefined,
      granularity: 'day',
      selectedChartId: null,
      showChartSettings: false,
      
      // Chat state
      chatMessages: [],
      isChatOpen: false,
      isChatLoading: false,
      chatError: null,
      
      // Dashboard customization state
      currentTheme: defaultThemes[0],
      availableThemes: defaultThemes,
      chartCustomizations: {},
      dashboardFilters: [],
      currentLayout: defaultLayout,
      availableLayouts: [defaultLayout],
      isCustomizing: false,
      customizationHistory: [],
      redoHistory: [],
      showFullScreen: null,

      // Enhanced dashboard state
      chartTemplates: defaultChartTemplates,
      availableColumns: [],
      isDragging: false,
      draggedChartId: null,
      showChartTemplateGallery: false,
      contextMenuPosition: null,
      contextMenuChartId: null,
      gridSnapping: true,
      showGridLines: false,
      autoSaveLayouts: true,
      
      // Session actions
      setCurrentSession: (session) => set({ currentSession: session }),
      
      setRecentSessions: (sessions) => set({ recentSessions: sessions }),
      
      addRecentSession: (session) => set((state) => ({
        recentSessions: [session, ...state.recentSessions.filter(s => s.id !== session.id)].slice(0, 10)
      })),
      
      setIsSaving: (isSaving) => set({ isSaving }),
      
      setSaveError: (error) => set({ saveError: error }),
      
      createNewSession: async (name, description) => {
        const state = get()
        set({ isSaving: true, saveError: null })
        
        try {
          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
          })
          
          if (!response.ok) {
            throw new Error('Failed to create session')
          }
          
          const { session } = await response.json()
          set({ 
            currentSession: session,
            isSaving: false 
          })
          
          // Add to recent sessions
          get().addRecentSession({
            id: session.id,
            name: session.name,
            description: session.description,
            updatedAt: session.updatedAt,
          })
          
        } catch (error) {
          set({ 
            saveError: error instanceof Error ? error.message : 'Failed to create session',
            isSaving: false 
          })
        }
      },
      
      loadSession: async (sessionId) => {
        set({ isSaving: true, saveError: null })
        
        try {
          const response = await fetch(`/api/sessions/${sessionId}/data`)
          
          if (!response.ok) {
            throw new Error('Failed to load session')
          }
          
          const { session, file, analysis, chatMessages } = await response.json()
          
          // Try to load customizations
          let customizations = null
          try {
            const customizationResponse = await fetch(`/api/sessions/${sessionId}/customizations`)
            if (customizationResponse.ok) {
              customizations = await customizationResponse.json()
            }
          } catch (err) {
            console.warn('Failed to load customizations:', err)
          }
          
          set({
            currentSession: session,
            fileName: file?.metadata?.originalName || null,
            rawData: file?.parsedData || [],
            analysis: analysis ? {
              insights: analysis.insights,
              chartConfig: analysis.charts.map((chart: any) => ({
                type: chart.type,
                title: chart.title,
                dataKey: chart.dataKeys,
                description: chart.description,
              })),
              summary: analysis.summary,
            } : null,
            chatMessages: chatMessages || [],
            // Load customizations if available
            currentTheme: customizations?.theme || defaultThemes[0],
            currentLayout: customizations?.layout || defaultLayout,
            chartCustomizations: customizations?.chartCustomizations || {},
            dashboardFilters: customizations?.filters || [],
            customizationHistory: customizations?.customizationHistory || [],
            isSaving: false,
          })
          
        } catch (error) {
          set({ 
            saveError: error instanceof Error ? error.message : 'Failed to load session',
            isSaving: false 
          })
        }
      },
      
      saveCurrentSession: async () => {
        const state = get()
        if (!state.currentSession) return
        
        set({ isSaving: true, saveError: null })
        
        try {
          // Save analysis if available
          if (state.analysis && state.fileName && state.rawData.length > 0) {
            await fetch(`/api/sessions/${state.currentSession.id}/data`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'analysis',
                data: {
                  analysis: state.analysis,
                  fileId: 'temp-file-id', // This should be the actual file ID
                },
              }),
            })
          }
          
          // Save customization data
          await fetch(`/api/sessions/${state.currentSession.id}/customizations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              theme: state.currentTheme,
              layout: state.currentLayout,
              chartCustomizations: state.chartCustomizations,
              filters: state.dashboardFilters,
              customizationHistory: state.customizationHistory
            }),
          })
          
          set({ isSaving: false })
          
        } catch (error) {
          set({ 
            saveError: error instanceof Error ? error.message : 'Failed to save session',
            isSaving: false 
          })
        }
      },
      
      updateSessionMetadata: async (name, description) => {
        const state = get()
        if (!state.currentSession) return
        
        set({ isSaving: true, saveError: null })
        
        try {
          const response = await fetch(`/api/sessions/${state.currentSession.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
          })
          
          if (!response.ok) {
            throw new Error('Failed to update session')
          }
          
          const { session } = await response.json()
          set({ 
            currentSession: session,
            isSaving: false 
          })
          
        } catch (error) {
          set({ 
            saveError: error instanceof Error ? error.message : 'Failed to update session',
            isSaving: false 
          })
        }
      },
      
      // Data actions
      setFileName: (name) => set({ fileName: name }),
      setRawData: async (data) => {
        console.log('🔵 [STORE] setRawData called:', {
          hasData: !!data,
          dataLength: data?.length,
          dataType: typeof data,
          isArray: Array.isArray(data),
          firstRowKeys: data?.[0] ? Object.keys(data[0]) : null,
          timestamp: new Date().toISOString()
        })
        
        try {
          // For large datasets, store in IndexedDB
          if (data && data.length > 1000) {
            console.log('🔵 [STORE] Large dataset detected, storing in IndexedDB...')
            const fileName = get().fileName || 'untitled'
            const dataId = await dataStorage.saveData(fileName, data)
            console.log('✅ [STORE] Data stored in IndexedDB with dataId:', dataId)
            set({ rawData: data, dataId })
          } else {
            // For small datasets, just store in memory
            console.log('🔵 [STORE] Small dataset, storing in memory...')
            set({ rawData: data, dataId: null })
          }
          
          console.log('✅ [STORE] setRawData completed successfully, current state:', {
            rawDataLength: get().rawData?.length,
            dataId: get().dataId,
            fileName: get().fileName
          })
        } catch (error) {
          console.error('❌ [STORE] Failed to store data:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            dataLength: data?.length,
            timestamp: new Date().toISOString()
          })
          // Fallback to memory storage
          console.log('🔄 [STORE] Falling back to memory storage...')
          set({ rawData: data, dataId: null })
          console.log('✅ [STORE] Fallback to memory storage completed')
        }
      },
      setDataSchema: (schema) => set({ dataSchema: schema }),
      setAnalysis: (analysis) => set({ analysis }),
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      setError: (error) => set({ error }),
      setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
      setUsingAI: (usingAI) => set({ usingAI }),
      setDateRange: (range) => set({ dateRange: range }),
      setGranularity: (granularity) => set({ granularity }),
      setSelectedChartId: (chartId) => set({ selectedChartId: chartId }),
      setShowChartSettings: (show) => set({ showChartSettings: show }),
      
      // Chat actions
      addChatMessage: (message) => set((state) => ({
        chatMessages: [...state.chatMessages, message]
      })),
      
      setChatMessages: (messages) => set({ chatMessages: messages }),
      setIsChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
      setIsChatLoading: (isLoading) => set({ isChatLoading: isLoading }),
      setChatError: (error) => set({ chatError: error }),
      clearChatHistory: () => set({ chatMessages: [] }),
      
      saveChatMessage: async (message) => {
        const state = get()
        if (!state.currentSession) return
        
        try {
          await fetch(`/api/sessions/${state.currentSession.id}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: message.role,
              content: message.content,
            }),
          })
        } catch (error) {
          console.error('Failed to save chat message:', error)
        }
      },
      
      // Dashboard customization actions
      setCurrentTheme: (theme) => {
        set({ currentTheme: theme })
        get().addToHistory('theme_change', { theme: theme.name })
      },
      
      addCustomTheme: (theme) => {
        set(state => ({
          availableThemes: [...state.availableThemes, theme],
          currentTheme: theme
        }))
        get().addToHistory('theme_add', { theme })
      },
      
      updateChartCustomization: (chartId, customization) => {
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
      
      removeChartCustomization: (chartId) => {
        set(state => {
          const { [chartId]: removed, ...rest } = state.chartCustomizations
          return { chartCustomizations: rest }
        })
        get().addToHistory('chart_customize_remove', { chartId })
      },
      
      addDashboardFilter: (filter) => {
        set(state => ({
          dashboardFilters: [...state.dashboardFilters, filter]
        }))
        get().addToHistory('filter_add', { filter })
      },
      
      updateDashboardFilter: (filterId, updates) => {
        set(state => ({
          dashboardFilters: state.dashboardFilters.map(filter =>
            filter.id === filterId ? { ...filter, ...updates } : filter
          )
        }))
        get().addToHistory('filter_update', { filterId, updates })
      },
      
      removeDashboardFilter: (filterId) => {
        set(state => ({
          dashboardFilters: state.dashboardFilters.filter(filter => filter.id !== filterId)
        }))
        get().addToHistory('filter_remove', { filterId })
      },
      
      clearAllFilters: () => {
        const currentFilters = get().dashboardFilters
        set({ dashboardFilters: [] })
        get().addToHistory('filters_clear', { previousFilters: currentFilters })
      },
      
      setCurrentLayout: (layout) => {
        set({ currentLayout: layout })
        get().addToHistory('layout_change', { layout: layout.name })
      },
      
      addCustomLayout: (layout) => {
        set(state => ({
          availableLayouts: [...state.availableLayouts, layout],
          currentLayout: layout
        }))
        get().addToHistory('layout_add', { layout })
      },
      
      setIsCustomizing: (isCustomizing) => set({ isCustomizing }),
      
      addToHistory: (action, data) => {
        set(state => {
          // Capture previous state based on action type
          let previousState: any = null
          switch (action) {
            case 'theme_change':
              previousState = { theme: state.currentTheme }
              break
            case 'chart_customize':
              previousState = { 
                chartCustomizations: { ...state.chartCustomizations },
                chartId: data.chartId
              }
              break
            case 'filter_add':
            case 'filter_update':
            case 'filter_remove':
            case 'filters_clear':
              previousState = { filters: [...state.dashboardFilters] }
              break
            case 'layout_change':
              previousState = { layout: state.currentLayout }
              break
          }
          
          return {
            customizationHistory: [
              ...state.customizationHistory,
              {
                id: Date.now().toString(),
                action,
                timestamp: new Date().toISOString(),
                data,
                previousState
              }
            ].slice(-50), // Keep only last 50 actions
            redoHistory: [] // Clear redo history when new action is performed
          }
        })
      },
      
      undoLastAction: () => {
        const state = get()
        const lastAction = state.customizationHistory[state.customizationHistory.length - 1]
        if (!lastAction || !lastAction.previousState) return
        
        // Move action to redo history
        const redoAction = {
          ...lastAction,
          previousState: getCurrentStateForAction(lastAction.action, state)
        }
        
        // Apply undo based on action type
        switch (lastAction.action) {
          case 'theme_change':
            set(state => ({
              currentTheme: lastAction.previousState.theme,
              customizationHistory: state.customizationHistory.slice(0, -1),
              redoHistory: [...state.redoHistory, redoAction]
            }))
            break
            
          case 'chart_customize':
            set(state => ({
              chartCustomizations: lastAction.previousState.chartCustomizations,
              customizationHistory: state.customizationHistory.slice(0, -1),
              redoHistory: [...state.redoHistory, redoAction]
            }))
            break
            
          case 'filter_add':
          case 'filter_update':
          case 'filter_remove':
          case 'filters_clear':
            set(state => ({
              dashboardFilters: lastAction.previousState.filters,
              customizationHistory: state.customizationHistory.slice(0, -1),
              redoHistory: [...state.redoHistory, redoAction]
            }))
            break
            
          case 'layout_change':
            set(state => ({
              currentLayout: lastAction.previousState.layout,
              customizationHistory: state.customizationHistory.slice(0, -1),
              redoHistory: [...state.redoHistory, redoAction]
            }))
            break
        }
      },
      
      redoLastAction: () => {
        const state = get()
        const lastRedoAction = state.redoHistory[state.redoHistory.length - 1]
        if (!lastRedoAction) return
        
        // Move action back to history
        const historyAction = {
          ...lastRedoAction,
          previousState: lastRedoAction.previousState
        }
        
        // Apply redo based on action type
        switch (lastRedoAction.action) {
          case 'theme_change':
            set(state => ({
              currentTheme: lastRedoAction.data.theme || lastRedoAction.previousState.theme,
              customizationHistory: [...state.customizationHistory, historyAction],
              redoHistory: state.redoHistory.slice(0, -1)
            }))
            break
            
          case 'chart_customize':
            const { chartId, customization } = lastRedoAction.data
            set(state => ({
              chartCustomizations: {
                ...state.chartCustomizations,
                [chartId]: { ...state.chartCustomizations[chartId], ...customization, id: chartId }
              },
              customizationHistory: [...state.customizationHistory, historyAction],
              redoHistory: state.redoHistory.slice(0, -1)
            }))
            break
            
          case 'filter_add':
            set(state => ({
              dashboardFilters: [...state.dashboardFilters, lastRedoAction.data.filter],
              customizationHistory: [...state.customizationHistory, historyAction],
              redoHistory: state.redoHistory.slice(0, -1)
            }))
            break
            
          case 'layout_change':
            set(state => ({
              currentLayout: lastRedoAction.data.layout,
              customizationHistory: [...state.customizationHistory, historyAction],
              redoHistory: state.redoHistory.slice(0, -1)
            }))
            break
        }
      },
      
      setFullScreen: (chartId) => set({ showFullScreen: chartId }),
      
      exportChart: async (chartId, format) => {
        // Client-side chart export implementation
        try {
          if (format === 'png') {
            // Dynamic import to avoid SSR issues
            const html2canvas = (await import('html2canvas')).default
            
            // Find the chart element
            const chartElement = document.querySelector(`[data-chart-id="${chartId}"]`)
            if (!chartElement) {
              throw new Error('Chart element not found')
            }
            
            // Get the chart title
            const titleElement = chartElement.querySelector('.text-base') as HTMLElement
            const chartTitle = titleElement?.innerText || 'chart'
            
            // Create canvas from the chart element
            const canvas = await html2canvas(chartElement as HTMLElement, {
              backgroundColor: '#ffffff',
              scale: 2, // Higher quality
              logging: false,
              useCORS: true,
              allowTaint: true
            })
            
            // Convert to blob and download
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${chartTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }
            }, 'image/png')
          } else {
            // For other formats, we could implement SVG or PDF export
            console.warn(`Export format ${format} not yet implemented`)
          }
        } catch (error) {
          console.error('Failed to export chart:', error)
        }
      },
      
      exportDashboard: async (format) => {
        try {
          const state = get()
          
          if (format === 'png') {
            // Client-side PNG export using html2canvas
            const html2canvas = (await import('html2canvas')).default
            
            // Find the dashboard charts container (only the charts grid, not headers/sidebar)
            const dashboardElement = document.querySelector('.dashboard-container')
            if (!dashboardElement) {
              throw new Error('Dashboard charts not found')
            }
            
            // Create canvas from the dashboard
            const canvas = await html2canvas(dashboardElement as HTMLElement, {
              backgroundColor: state.currentTheme.colors.background,
              scale: 2,
              logging: false,
              useCORS: true,
              allowTaint: true,
              windowWidth: dashboardElement.scrollWidth,
              windowHeight: dashboardElement.scrollHeight
            })
            
            // Convert to blob and download
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `dashboard-${state.currentSession?.name || 'export'}-${new Date().toISOString().split('T')[0]}.png`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }
            }, 'image/png')
          } else if (format === 'json') {
            // Export dashboard configuration and data as JSON
            const exportData = {
              metadata: {
                exportDate: new Date().toISOString(),
                fileName: state.fileName,
                sessionName: state.currentSession?.name,
                version: '1.0'
              },
              data: state.rawData,
              analysis: state.analysis,
              configuration: {
                theme: state.currentTheme,
                layout: state.currentLayout,
                chartCustomizations: state.chartCustomizations,
                filters: state.dashboardFilters
              }
            }
            
            const jsonStr = JSON.stringify(exportData, null, 2)
            const blob = new Blob([jsonStr], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `dashboard-${state.currentSession?.name || 'export'}-${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          } else if (format === 'pdf') {
            // PDF export using jsPDF and html2canvas
            const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
              import('jspdf'),
              import('html2canvas')
            ])
            
            // Create new PDF document
            const pdf = new jsPDF({
              orientation: 'landscape',
              unit: 'mm',
              format: 'a4'
            })
            
            // PDF dimensions
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = pdf.internal.pageSize.getHeight()
            const margin = 10
            
            // Add title and metadata
            pdf.setFontSize(20)
            pdf.text(state.currentSession?.name || 'Dashboard Export', margin, margin + 10)
            
            pdf.setFontSize(12)
            pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, margin + 20)
            pdf.text(`Data source: ${state.fileName || 'Unknown'}`, margin, margin + 26)
            
            // Add summary statistics
            if (state.analysis) {
              pdf.setFontSize(14)
              pdf.text('Summary Statistics', margin, margin + 40)
              
              pdf.setFontSize(10)
              let yPos = margin + 48
              pdf.text(`Total Rows: ${state.analysis.summary.totalRows.toLocaleString()}`, margin, yPos)
              pdf.text(`Total Columns: ${state.analysis.summary.columns.length}`, margin + 60, yPos)
              
              yPos += 8
              pdf.text('Key Insights:', margin, yPos)
              
              // Add top 3 insights
              state.analysis.insights.slice(0, 3).forEach((insight, index) => {
                yPos += 6
                const lines = pdf.splitTextToSize(`${index + 1}. ${insight}`, pdfWidth - 2 * margin)
                pdf.text(lines, margin, yPos)
                yPos += lines.length * 4
              })
            }
            
            // Start new page for charts
            pdf.addPage()
            
            // Find all chart elements
            const chartElements = document.querySelectorAll('[data-chart-id]')
            let currentPage = 1
            let chartsPerPage = 2
            let chartCount = 0
            
            // Add charts to PDF
            for (let i = 0; i < chartElements.length; i++) {
              const chartElement = chartElements[i] as HTMLElement
              
              try {
                // Capture chart as canvas
                const canvas = await html2canvas(chartElement, {
                  backgroundColor: '#ffffff',
                  scale: 2,
                  logging: false,
                  useCORS: true,
                  allowTaint: true
                })
                
                // Calculate position
                const chartIndex = chartCount % chartsPerPage
                const xPos = margin
                const yPos = margin + (chartIndex * (pdfHeight - 2 * margin) / chartsPerPage)
                const maxWidth = pdfWidth - 2 * margin
                const maxHeight = (pdfHeight - 2 * margin) / chartsPerPage - 5
                
                // Calculate aspect ratio
                const aspectRatio = canvas.width / canvas.height
                let imgWidth = maxWidth
                let imgHeight = imgWidth / aspectRatio
                
                // Adjust if height is too large
                if (imgHeight > maxHeight) {
                  imgHeight = maxHeight
                  imgWidth = imgHeight * aspectRatio
                }
                
                // Convert canvas to image and add to PDF
                const imgData = canvas.toDataURL('image/png')
                pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight)
                
                chartCount++
                
                // Add new page if needed
                if (chartCount % chartsPerPage === 0 && i < chartElements.length - 1) {
                  pdf.addPage()
                  currentPage++
                }
              } catch (error) {
                console.error('Failed to capture chart:', error)
              }
            }
            
            // Add data table page if space permits
            if (state.rawData && state.rawData.length > 0) {
              pdf.addPage()
              pdf.setFontSize(14)
              pdf.text('Data Sample (First 10 rows)', margin, margin + 10)
              
              // Create simple table
              pdf.setFontSize(8)
              const columns = Object.keys(state.rawData[0])
              const columnWidth = (pdfWidth - 2 * margin) / Math.min(columns.length, 8)
              let yPos = margin + 20
              
              // Header
              columns.slice(0, 8).forEach((col, index) => {
                pdf.text(col, margin + index * columnWidth, yPos)
              })
              
              // Draw line under header
              pdf.line(margin, yPos + 2, pdfWidth - margin, yPos + 2)
              yPos += 6
              
              // Data rows
              state.rawData.slice(0, 10).forEach((row) => {
                columns.slice(0, 8).forEach((col, index) => {
                  const value = String(row[col] || '')
                  const truncated = value.length > 15 ? value.substring(0, 12) + '...' : value
                  pdf.text(truncated, margin + index * columnWidth, yPos)
                })
                yPos += 5
                
                if (yPos > pdfHeight - margin - 10) {
                  return // Stop if we're at the bottom of the page
                }
              })
            }
            
            // Save the PDF
            pdf.save(`dashboard-${state.currentSession?.name || 'export'}-${new Date().toISOString().split('T')[0]}.pdf`)
          }
        } catch (error) {
          console.error('Failed to export dashboard:', error)
        }
      },
      
      generateShareableLink: async () => {
        try {
          const state = get()
          
          // Check if we have a session to share
          if (!state.currentSession && !state.rawData) {
            throw new Error('No data to share. Please save your session first.')
          }
          
          // Try to call the API endpoint
          try {
            const response = await fetch('/api/share/dashboard', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: state.currentSession?.id,
                customizations: {
                  theme: state.currentTheme,
                  layout: state.currentLayout,
                  chartCustomizations: state.chartCustomizations,
                  filters: state.dashboardFilters
                }
              })
            })
            
            if (response.ok) {
              const { shareUrl } = await response.json()
              return shareUrl
            }
          } catch (apiError) {
            // API doesn't exist yet, generate a client-side share link
            console.warn('Share API not available, using client-side generation')
          }
          
          // Fallback: Generate a client-side share link
          const shareData = {
            sessionId: state.currentSession?.id,
            fileName: state.fileName,
            timestamp: Date.now()
          }
          
          // Simple base64 encoding for the share ID
          const shareId = btoa(JSON.stringify(shareData))
            .replace(/[/+=]/g, '')
            .substring(0, 12)
          
          return shareId
        } catch (error) {
          console.error('Failed to generate shareable link:', error)
          throw error
        }
      },
      
      getFilteredData: () => {
        const state = get()
        const { rawData, dashboardFilters, dateRange, granularity } = state

        if (!rawData.length) return rawData

        let filteredData = rawData

        // Apply date range filter if set
        if (dateRange?.from || dateRange?.to) {
          // Find date columns
          const dateColumns = rawData.length > 0 ? Object.keys(rawData[0]).filter(key => {
            const value = rawData[0][key]
            if (!value) return false
            const datePattern = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}/
            if (typeof value === 'string' && datePattern.test(value)) return true
            if (value instanceof Date) return true
            if (!isNaN(Date.parse(String(value)))) return true
            return false
          }) : []

          if (dateColumns.length > 0) {
            filteredData = filteredData.filter(row => {
              const dateCol = row[dateColumns[0]]
              if (dateCol === null || dateCol === undefined) return true
              const dateValue = new Date(dateCol as string | number | Date)
              if (isNaN(dateValue.getTime())) return true

              if (dateRange.from && dateValue < dateRange.from) return false
              if (dateRange.to && dateValue > dateRange.to) return false
              return true
            })
          }
        }

        // Apply dashboard filters
        if (dashboardFilters.length) {
          filteredData = filteredData.filter(row => {
            return dashboardFilters.every(filter => {
              if (!filter.isActive) return true

              const columnValue = row[filter.column]

              switch (filter.operator) {
                case 'equals':
                  return columnValue === filter.value
                case 'contains':
                  return String(columnValue).toLowerCase().includes(String(filter.value).toLowerCase())
                case 'greater_than':
                  return Number(columnValue) > Number(filter.value)
                case 'less_than':
                  return Number(columnValue) < Number(filter.value)
                case 'between':
                  const [min, max] = filter.value
                  return Number(columnValue) >= Number(min) && Number(columnValue) <= Number(max)
                case 'in':
                  return Array.isArray(filter.value) && filter.value.includes(columnValue)
                default:
                  return true
              }
            })
          })
        }

        // Apply granularity aggregation if there are date columns
        const dateColumns = filteredData.length > 0 ? Object.keys(filteredData[0]).filter(key => {
          const value = filteredData[0][key]
          if (!value) return false
          const datePattern = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}/
          if (typeof value === 'string' && datePattern.test(value)) return true
          if (value instanceof Date) return true
          if (!isNaN(Date.parse(String(value)))) return true
          return false
        }) : []

        if (dateColumns.length > 0) {
          filteredData = aggregateDataByGranularity(filteredData, granularity, dateColumns[0])
        }

        return filteredData
      },

      // Enhanced dashboard actions
      addChart: (template, position) => {
        const state = get()
        const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // Generate data keys based on available columns and template requirements
        const availableNumberColumns = state.availableColumns.filter(col => {
          const sampleValue = state.rawData[0]?.[col]
          return typeof sampleValue === 'number' || !isNaN(Number(sampleValue))
        })
        const availableStringColumns = state.availableColumns.filter(col => {
          const sampleValue = state.rawData[0]?.[col]
          return typeof sampleValue === 'string' && isNaN(Number(sampleValue))
        })

        let dataKeys: string[] = []
        if (template.type === 'pie') {
          dataKeys = [availableStringColumns[0], availableNumberColumns[0]].filter(Boolean)
        } else if (template.type === 'scorecard') {
          dataKeys = [availableNumberColumns[0]].filter(Boolean)
        } else if (template.type === 'table') {
          dataKeys = state.availableColumns.slice(0, 8) // Limit table columns
        } else {
          // For line, bar, area, scatter charts
          const xKey = availableStringColumns[0] || availableNumberColumns[0]
          const yKeys = availableNumberColumns.slice(0, template.maxColumns ? template.maxColumns - 1 : 3)
          dataKeys = [xKey, ...yKeys].filter(Boolean)
        }

        // Create chart config
        const newChart = {
          id: chartId,
          type: template.type,
          title: template.name,
          description: template.description,
          dataKey: dataKeys,
        }

        // Update analysis with new chart
        set(state => ({
          analysis: state.analysis ? {
            ...state.analysis,
            chartConfig: [...state.analysis.chartConfig, newChart]
          } : null
        }))

        // Create customization entry - let the layout component handle positioning
        // by NOT setting a position here, the flexible layout will use findOptimalPosition
        const customization: ChartCustomization = {
          id: chartId,
          // Don't set position here - let flexible-dashboard-layout handle it
          position: position ?
            { x: position.x, y: position.y, ...template.defaultPosition } :
            undefined, // This will trigger findOptimalPosition in the layout
          isVisible: true,
          chartType: template.type,
        }

        get().updateChartCustomization(chartId, customization)
        get().addToHistory('chart_add', { chartId, template })
      },

      removeChart: (chartId) => {
        const state = get()

        // Remove from analysis
        set(state => ({
          analysis: state.analysis ? {
            ...state.analysis,
            chartConfig: state.analysis.chartConfig.filter(chart =>
              (chart.id || `chart-${state.analysis!.chartConfig.indexOf(chart)}`) !== chartId
            )
          } : null
        }))

        // Remove customization
        get().removeChartCustomization(chartId)
        get().addToHistory('chart_remove', { chartId })
      },

      duplicateChart: (chartId) => {
        const state = get()
        if (!state.analysis) return

        // Find the original chart
        const originalChart = state.analysis.chartConfig.find(chart =>
          (chart.id || `chart-${state.analysis!.chartConfig.indexOf(chart)}`) === chartId
        )
        if (!originalChart) return

        // Create new chart with unique ID
        const newChartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const duplicatedChart = {
          ...originalChart,
          id: newChartId,
          title: `${originalChart.title} (Copy)`,
        }

        // Add to analysis
        set(state => ({
          analysis: state.analysis ? {
            ...state.analysis,
            chartConfig: [...state.analysis.chartConfig, duplicatedChart]
          } : null
        }))

        // Duplicate customization with offset position
        const originalCustomization = state.chartCustomizations[chartId]
        if (originalCustomization) {
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
        }

        get().addToHistory('chart_duplicate', { originalChartId: chartId, newChartId })
      },

      updateChartType: (chartId, type) => {
        const state = get()
        if (!state.analysis) return

        // Update analysis
        set(state => ({
          analysis: state.analysis ? {
            ...state.analysis,
            chartConfig: state.analysis.chartConfig.map(chart => {
              const id = chart.id || `chart-${state.analysis!.chartConfig.indexOf(chart)}`
              return id === chartId ? { ...chart, type } : chart
            })
          } : null
        }))

        // Update customization
        get().updateChartCustomization(chartId, { chartType: type })
        get().addToHistory('chart_type_change', { chartId, newType: type })
      },

      setAvailableColumns: (columns) => set({ availableColumns: columns }),
      setIsDragging: (isDragging) => set({ isDragging }),
      setDraggedChartId: (chartId) => set({ draggedChartId: chartId }),
      setShowChartTemplateGallery: (show) => set({ showChartTemplateGallery: show }),
      setContextMenu: (position, chartId) => set({
        contextMenuPosition: position,
        contextMenuChartId: chartId || null
      }),
      setGridSnapping: (enabled) => set({ gridSnapping: enabled }),
      setShowGridLines: (show) => set({ showGridLines: show }),
      setAutoSaveLayouts: (enabled) => set({ autoSaveLayouts: enabled }),

      saveLayout: (name) => {
        const state = get()
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
          get().setCurrentLayout(layout)
        }
      },

      resetToDefaultLayout: () => {
        get().setCurrentLayout(defaultLayout)
        set({ chartCustomizations: {} })
        get().addToHistory('layout_reset', { layout: 'default' })
      },

      exportLayoutConfig: async () => {
        const state = get()
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
          console.error('Failed to import layout config:', error)
        }
      },
      
      // Utility actions
      reset: () => set({
        currentSession: null,
        fileName: null,
        rawData: [],
        dataId: null,
        dataSchema: null,
        analysis: null,
        isAnalyzing: false,
        error: null,
        analysisProgress: 0,
        usingAI: false,
        chatMessages: [],
        isChatOpen: false,
        isChatLoading: false,
        chatError: null,
        isSaving: false,
        saveError: null,
        // Reset customization state but keep themes and layouts
        chartCustomizations: {},
        dashboardFilters: [],
        currentLayout: defaultLayout,
        isCustomizing: false,
        customizationHistory: [],
        redoHistory: [],
        showFullScreen: null,
      }),
      
      exportSession: async (format) => {
        const state = get()
        if (!state.currentSession) return
        
        try {
          const response = await fetch(`/api/sessions/${state.currentSession.id}/export?format=${format}`)
          
          if (!response.ok) {
            throw new Error('Failed to export session')
          }
          
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `dashboard-${state.currentSession.id}.${format}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          
        } catch (error) {
          console.error('Failed to export session:', error)
        }
      },
    }),
    {
      name: 'datacrafted-store',
      partialize: (state) => ({
        recentSessions: state.recentSessions,
        currentTheme: state.currentTheme,
        availableThemes: state.availableThemes,
        availableLayouts: state.availableLayouts,
        // Store only essential metadata, not the full data
        fileName: state.fileName,
        dataId: state.dataId, // Store reference to IndexedDB data
        dataSchema: state.dataSchema,
        analysis: state.analysis,
        currentSession: state.currentSession,
        // Store a flag indicating data exists
        hasData: state.rawData && state.rawData.length > 0,
      }),
      onRehydrateStorage: (state) => {
        console.log('Store rehydrating...')
        return (rehydratedState, error) => {
          if (error) {
            console.error('Failed to rehydrate store:', error)
            return
          }
          
          // Load data from IndexedDB after store hydration
          if (rehydratedState && rehydratedState.dataId && !rehydratedState.rawData?.length) {
            console.log('Loading data from IndexedDB with ID:', rehydratedState.dataId)
            dataStorage.loadData(rehydratedState.dataId).then(data => {
              if (data) {
                console.log('Data loaded from IndexedDB, rows:', data.length)
                useDataStore.setState({ rawData: data })
              }
            }).catch(error => {
              console.error('Failed to load data from IndexedDB:', error)
            })
          }
        }
      },
    }
  )
)