import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DateRange } from 'react-day-picker'
import { aggregateDataByGranularity } from '@/lib/utils/data-aggregation'
import { dataStorage } from '@/lib/data-storage'
import type {
  EnhancedAnalysisResult,
  ChartRecommendation,
  CorrectedColumn,
  DataContext,
  isEnhancedAnalysisResult
} from '@/lib/types/recommendation'

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
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo' | 'waterfall' | 'funnel' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap' | 'sankey' | 'sparkline'
  animate?: boolean
  interactive?: boolean
  stacked?: boolean
  percentageStack?: boolean  // For 100% stacked mode
  dataColumns?: string[]
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile'
  // Data mapping for custom column selection
  dataMapping?: {
    xAxis?: string
    yAxis?: string | string[] // For single-axis charts (deprecated in favor of yAxis1)
    yAxis1?: string | string[] // Left Y-axis - for dual-axis charts (bar, line, area, scatter, combo)
    yAxis2?: string | string[] // Right Y-axis - for dual-axis charts (bar, line, area, scatter, combo)
    yAxis1Type?: 'bar' | 'line' | 'area' // For combo charts
    yAxis2Type?: 'bar' | 'line' | 'area' // For combo charts
    yAxis1Label?: string // Left Y-axis label
    yAxis2Label?: string // Right Y-axis label
    category?: string // For pie charts
    value?: string // For pie charts and scorecards
    type?: string // For waterfall charts - type column
    values?: string[] // For multi-value charts
    metric?: string // For scorecards
    size?: string // For scatter charts - bubble sizing
    color?: string // For scatter charts - color grouping
    sortBy?: string // For bar charts - sorting column
    sortOrder?: 'asc' | 'desc' // For bar charts - sorting order
    limit?: number // For bar charts - Top/Bottom X
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile' // Aggregation method
    percentile?: number // For percentile aggregation (0-100)
    columns?: string[] // For table charts - columns to display
    // Calculation options
    groupBy?: string[] // Columns to group by for aggregation
    derivedMetrics?: Array<{
      type: 'ratio' | 'percentage' | 'difference' | 'growth_rate' | 'percent_change' | 'running_total' | 'moving_average' | 'period_over_period' | 'year_over_year'
      alias: string
      column?: string
      numerator?: string
      denominator?: string
      window?: number
      periods?: number
    }>
    // New chart types
    stage?: string // For funnel charts
    xCategory?: string // For heatmap charts
    yCategory?: string // For heatmap charts
    intensity?: string // For heatmap charts
    cohort?: string // For cohort charts
    period?: string // For cohort charts
    actual?: string // For bullet charts
    comparative?: string // For bullet charts
    ranges?: string // For bullet charts
    parent?: string // For treemap charts
    source?: string // For sankey charts
    target_node?: string // For sankey charts
    trend?: string // For sparkline charts
    min?: number // For gauge charts
    max?: number // For gauge charts
    target?: number // For gauge charts
  }
  // Dynamic sizing options
  autoSize?: boolean
  minHeight?: number
  maxHeight?: number
  labelRotation?: 'auto' | 'horizontal' | 'diagonal' | 'vertical'
}

export type ChartType =
  | 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo'
  | 'waterfall' | 'funnel' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap' | 'sankey' | 'sparkline'

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

/**
 * Legacy analysis result for backward compatibility
 * New code should use EnhancedAnalysisResult from recommendation types
 */
export interface AnalysisResult {
  insights: string[]
  chartConfig: Array<{
    id?: string
    type: ChartType
    title: string
    description: string
    // Chart-type-specific data mappings (primary)
    dataMapping?: {
      // Bar/Column charts
      category?: string
      values?: string[]
      // Line/Area charts
      xAxis?: string
      yAxis?: string | string[]
      // Pie charts
      value?: string
      // Scorecard
      metric?: string
      comparison?: string
      // Scatter
      size?: string
      color?: string
      // Table
      columns?: string[]
      // Common
      aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
    }
    // Legacy fields for backward compatibility
    dataKey?: string[]
    xAxis?: string | string[]
    yAxis?: string | string[]
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
    // Customization settings
    customization?: any
    // Quality metrics
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

  /** Analysis result - can be either legacy or enhanced format */
  analysis: AnalysisResult | EnhancedAnalysisResult | null

  /** User corrections from data tab for improved recommendations */
  correctedSchema: CorrectedColumn[] | null

  /** Data context extracted from AI analysis */
  dataContext: DataContext | null

  isAnalyzing: boolean
  error: string | null
  analysisProgress: number
  usingAI: boolean
  dateRange: DateRange | undefined
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year'
  selectedDateColumn: string | null // Which date column to filter by
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
  draftChart: { id: string; type: string; title: string; description: string } | null // Chart being configured before adding to dashboard

  // Upload status state
  uploadProgress: number
  uploadStage: string | null
  uploadComplete: boolean
  uploadProjectId: string | null

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
  setDateRange: (range: DateRange | undefined) => void
  setGranularity: (granularity: 'day' | 'week' | 'month' | 'quarter' | 'year') => void
  setSelectedDateColumn: (column: string | null) => void
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

  // Project-based chat persistence actions
  loadProjectChat: (projectId: string, authToken: string) => Promise<void>
  saveProjectChatMessage: (projectId: string, message: ChatMessage, authToken: string) => Promise<ChatMessage | null>
  clearProjectChat: (projectId: string, authToken: string) => Promise<void>
  replaceChatMessage: (tempId: string, realMessage: ChatMessage) => void

  // Dashboard customization actions
  setCurrentTheme: (theme: DashboardTheme) => void
  addCustomTheme: (theme: DashboardTheme) => void
  updateChartCustomization: (chartId: string, customization: Partial<ChartCustomization>) => void
  batchUpdateChartCustomizations: (updates: Record<string, Partial<ChartCustomization>>) => void
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
  addChart: (template: ChartTemplate, position?: { x: number; y: number }) => string
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
  setDraftChart: (chart: { id: string; type: string; title: string; description: string } | null) => void
  commitDraftChart: () => void

  // Upload status actions
  setUploadProgress: (progress: number) => void
  setUploadStage: (stage: string | null) => void
  setUploadComplete: (complete: boolean) => void
  setUploadProjectId: (projectId: string | null) => void
  dismissUpload: () => void

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
    maxColumns: undefined,
  },
  {
    id: 'waterfall-variance',
    name: 'Waterfall Chart',
    type: 'waterfall',
    description: 'Show sequential positive and negative changes',
    category: 'comparison',
    icon: 'TrendingDown',
    defaultPosition: { w: 8, h: 5 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 2,
  },
  {
    id: 'funnel-conversion',
    name: 'Funnel Chart',
    type: 'funnel',
    description: 'Visualize conversion through stages',
    category: 'trend',
    icon: 'Filter',
    defaultPosition: { w: 6, h: 5 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 2,
    maxColumns: 10,
  },
  {
    id: 'heatmap-correlation',
    name: 'Heatmap',
    type: 'heatmap',
    description: 'Show data density and correlations',
    category: 'relationship',
    icon: 'Grid3x3',
    defaultPosition: { w: 8, h: 6 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 3,
  },
  {
    id: 'gauge-kpi',
    name: 'Gauge Chart',
    type: 'gauge',
    description: 'Display progress toward a goal',
    category: 'summary',
    icon: 'Gauge',
    defaultPosition: { w: 4, h: 4 },
    requiredDataTypes: ['number'],
    minColumns: 1,
    maxColumns: 1,
  },
  {
    id: 'cohort-retention',
    name: 'Cohort Analysis',
    type: 'cohort',
    description: 'Track user retention over time',
    category: 'trend',
    icon: 'Users',
    defaultPosition: { w: 10, h: 6 },
    requiredDataTypes: ['date', 'string', 'number'],
    minColumns: 3,
  },
  {
    id: 'bullet-performance',
    name: 'Bullet Chart',
    type: 'bullet',
    description: 'Compare performance against targets',
    category: 'comparison',
    icon: 'Target',
    defaultPosition: { w: 6, h: 3 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 2,
    maxColumns: 4,
  },
  {
    id: 'treemap-hierarchy',
    name: 'Treemap',
    type: 'treemap',
    description: 'Visualize hierarchical data structures',
    category: 'distribution',
    icon: 'LayoutGrid',
    defaultPosition: { w: 8, h: 6 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 2,
  },
  {
    id: 'sankey-flow',
    name: 'Sankey Diagram',
    type: 'sankey',
    description: 'Show flow and connections between entities',
    category: 'relationship',
    icon: 'GitBranch',
    defaultPosition: { w: 10, h: 6 },
    requiredDataTypes: ['string', 'number'],
    minColumns: 3,
  },
  {
    id: 'sparkline-trend',
    name: 'Sparkline',
    type: 'sparkline',
    description: 'Compact line chart for trends',
    category: 'trend',
    icon: 'TrendingUp',
    defaultPosition: { w: 3, h: 2 },
    requiredDataTypes: ['number'],
    minColumns: 1,
    maxColumns: 1,
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
      correctedSchema: null,
      dataContext: null,
      isAnalyzing: false,
      error: null,
      analysisProgress: 0,
      usingAI: false,
      dateRange: undefined,
      granularity: 'day',
      selectedDateColumn: null,
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
      draftChart: null,

      // Upload status state
      uploadProgress: 0,
      uploadStage: null,
      uploadComplete: false,
      uploadProjectId: null,

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
        try {
          // For large datasets, store in IndexedDB
          if (data && data.length > 1000) {
            const fileName = get().fileName || 'untitled'
            const dataId = await dataStorage.saveData(fileName, data)
            set({ rawData: data, dataId })
          } else {
            // For small datasets, just store in memory
            set({ rawData: data, dataId: null })
          }
        } catch (error) {
          console.error('❌ [STORE] Failed to store data:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            dataLength: data?.length,
            timestamp: new Date().toISOString()
          })
          // Fallback to memory storage
          set({ rawData: data, dataId: null })
        }
      },
      setDataSchema: (schema) => set({ dataSchema: schema }),

      setAnalysis: (analysis) => {
        // CRITICAL: Handle null explicitly to clear analysis
        if (analysis === null) {
          console.log('📦 [STORE] ===== CLEARING ANALYSIS =====')
          set({ analysis: null, dataContext: null })
          return
        }

        // CRITICAL LOGGING: Track what's being stored
        console.log('📦 [STORE] ===== STORING ANALYSIS =====')
        console.log('📦 [STORE] analysis.chartConfig.length:', analysis?.chartConfig?.length || 0)
        console.log('📦 [STORE] Chart titles stored:', analysis?.chartConfig?.map(c => c.title).join(', '))
        console.log('📦 [STORE] Chart types stored:', analysis?.chartConfig?.map(c => c.type).join(', '))

        // DEBUG: Log scatter chart configurations
        const scatterCharts = analysis?.chartConfig?.filter(c => c.type === 'scatter') || []
        console.log('📦 [STORE] Scatter charts found:', scatterCharts.length)
        scatterCharts.forEach((chart, idx) => {
          console.log(`📦 [STORE] Scatter ${idx}:`, chart.title)
          console.log(`📦 [STORE] Scatter ${idx} dataMapping:`, chart.dataMapping)
          console.log(`📦 [STORE] Scatter ${idx} dataMapping.size:`, chart.dataMapping?.size)
          console.log(`📦 [STORE] Scatter ${idx} dataMapping.color:`, chart.dataMapping?.color)
        })
        console.log('📦 [STORE] ===== END STORING =====')

        // Preserve chartCustomizations - don't clear user positions/settings
        set({
          analysis
        })
        // Extract data context if available from enhanced analysis
        if (analysis && typeof analysis === 'object' && 'dataContext' in analysis && analysis.dataContext) {
          set({ dataContext: analysis.dataContext })
        }
      },

      setCorrectedSchema: (schema) => set({ correctedSchema: schema }),

      setDataContext: (context) => set({ dataContext: context }),

      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      setError: (error) => set({ error }),
      setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
      setUsingAI: (usingAI) => set({ usingAI }),
      setDateRange: (range) => {
        console.log('📅 [Store.setDateRange] Setting date range:', {
          from: range?.from,
          to: range?.to,
          fromTime: range?.from?.getTime(),
          toTime: range?.to?.getTime(),
          timestamp: new Date().toISOString()
        })
        set({ dateRange: range })
        console.log('✅ [Store.setDateRange] Date range updated in store')
      },
      setGranularity: (granularity) => {
        console.log('📊 [Store.setGranularity] Setting granularity:', granularity)
        set({ granularity })
      },
      setSelectedDateColumn: (column) => {
        console.log('📌 [Store.setSelectedDateColumn] Setting selected date column:', column)
        set({ selectedDateColumn: column })
      },
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

      // Project-based chat persistence actions
      loadProjectChat: async (projectId, authToken) => {
        set({ isChatLoading: true, chatError: null })

        try {
          const response = await fetch(`/api/projects/${projectId}/chat`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          })

          if (!response.ok) {
            throw new Error('Failed to load chat messages')
          }

          const { messages } = await response.json()
          set({
            chatMessages: messages || [],
            isChatLoading: false
          })
        } catch (error) {
          console.error('[STORE] Failed to load project chat:', error)
          set({
            chatError: error instanceof Error ? error.message : 'Failed to load chat messages',
            isChatLoading: false
          })
        }
      },

      saveProjectChatMessage: async (projectId, message, authToken) => {
        try {
          const response = await fetch(`/api/projects/${projectId}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              role: message.role,
              content: message.content,
              metadata: message.metadata
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to save chat message')
          }

          const { message: savedMessage } = await response.json()
          return savedMessage
        } catch (error) {
          console.error('[STORE] Failed to save project chat message:', error)
          set({
            chatError: error instanceof Error ? error.message : 'Failed to save chat message'
          })
          return null
        }
      },

      clearProjectChat: async (projectId, authToken) => {
        set({ isChatLoading: true, chatError: null })

        try {
          const response = await fetch(`/api/projects/${projectId}/chat`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          })

          if (!response.ok) {
            throw new Error('Failed to clear chat history')
          }

          set({
            chatMessages: [],
            isChatLoading: false
          })
        } catch (error) {
          console.error('[STORE] Failed to clear project chat:', error)
          set({
            chatError: error instanceof Error ? error.message : 'Failed to clear chat history',
            isChatLoading: false
          })
        }
      },

      replaceChatMessage: (tempId, realMessage) => {
        set((state) => ({
          chatMessages: state.chatMessages.map(msg =>
            msg.id === tempId ? realMessage : msg
          )
        }))
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

      // PERFORMANCE: Batch update multiple chart customizations at once
      batchUpdateChartCustomizations: (updates: Record<string, Partial<ChartCustomization>>) => {
        set(state => {
          const newCustomizations = { ...state.chartCustomizations }
          Object.entries(updates).forEach(([chartId, customization]) => {
            // CRITICAL FIX: Handle undefined values by deleting properties instead of setting them to undefined
            // This ensures that setting position: undefined actually REMOVES the position
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
      
      // PERFORMANCE OPTIMIZATION: Memoized filtered data getter
      getFilteredData: () => {
        const state = get()
        const { rawData, dashboardFilters, dateRange, granularity, selectedDateColumn } = state

        console.log('🔍 [Store.getFilteredData] Starting with:', {
          rawDataLength: rawData?.length || 0,
          hasDateRange: !!(dateRange?.from || dateRange?.to),
          granularity,
          selectedDateColumn
        })

        // Quick return for empty data
        if (!rawData || rawData.length === 0) return []

        let filteredData = rawData

        // Apply date range filter if set
        if (dateRange?.from || dateRange?.to) {
          // Find date columns using STRICT detection (same logic as date-range-selector)
          const dateColumns = rawData.length > 0 ? Object.keys(rawData[0]).filter(key => {
            const value = rawData[0][key]
            if (!value) return false

            // Check if it's a Date object first (most reliable)
            if (value instanceof Date) return true

            // For strings, use strict date pattern matching
            if (typeof value === 'string') {
              // Strict patterns for common date formats
              const strictDatePattern = /^\d{4}-\d{2}-\d{2}(T|\s|$)|^\d{2}\/\d{2}\/\d{4}$|^\d{4}\/\d{2}\/\d{2}$/
              if (strictDatePattern.test(value.trim())) return true

              // Also check if Date.parse works AND the parsed date is reasonable (year 1900-2100)
              const parsed = Date.parse(value)
              if (!isNaN(parsed)) {
                const date = new Date(parsed)
                const year = date.getFullYear()
                // Only accept dates between 1900-2100 to filter out numeric IDs
                if (year >= 1900 && year <= 2100) {
                  // Additional check: must contain date separators (-, /) or time indicators
                  if (/[-\/T:]/.test(value)) {
                    return true
                  }
                }
              }
            }

            return false
          }) : []

          // Determine which date column to use for filtering
          let dateColumnToUse = selectedDateColumn

          // If no column is selected, try to auto-select the first one
          if (!dateColumnToUse && dateColumns.length > 0) {
            dateColumnToUse = dateColumns[0]
            // Auto-select this column for future use
            set({ selectedDateColumn: dateColumnToUse })
          }

          console.log('🔍 [Store.getFilteredData] Date filtering:', {
            dateRange,
            allDateColumns: dateColumns,
            selectedDateColumn: dateColumnToUse,
            rawDataCount: rawData.length
          })

          if (dateColumnToUse && dateColumns.includes(dateColumnToUse)) {
            const beforeFilterCount = filteredData.length
            filteredData = filteredData.filter(row => {
              const dateCol = row[dateColumnToUse]
              // CRITICAL FIX: When a date filter is active, exclude rows with null/undefined dates
              // Only include rows that have valid dates within the specified range
              if (dateCol === null || dateCol === undefined) return false
              const dateValue = new Date(dateCol as string | number | Date)
              if (isNaN(dateValue.getTime())) return false

              // CRITICAL FIX: Use <= and >= to include boundary dates (from and to are inclusive)
              // Reset time to start/end of day for fair comparison
              const dateOnly = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate())

              if (dateRange.from) {
                const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate())
                if (dateOnly < fromDate) return false
              }

              if (dateRange.to) {
                const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate())
                if (dateOnly > toDate) return false
              }

              return true
            })
            console.log('🔍 [Store.getFilteredData] After date filter:', {
              beforeCount: beforeFilterCount,
              afterCount: filteredData.length,
              filteredOut: beforeFilterCount - filteredData.length
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

        // CRITICAL FIX: Only apply granularity aggregation when a date range filter is active
        // Rationale:
        // 1. Granularity aggregation groups data by time periods (day/week/month/etc)
        // 2. This reduces row count, which breaks scorecard calculations that need ALL data
        // 3. When no date filter is active, users expect to see calculations on ALL raw data
        // 4. Aggregation is only meaningful when viewing a specific time window
        // 5. Example: 46 raw rows aggregated by month becomes 36 rows, causing scorecard miscalculations
        const shouldApplyGranularityAggregation = dateRange?.from || dateRange?.to

        const dateColumns = filteredData.length > 0 ? Object.keys(filteredData[0]).filter(key => {
          const value = filteredData[0][key]
          if (!value) return false

          // Check if it's a Date object first (most reliable)
          if (value instanceof Date) return true

          // For strings, use strict date pattern matching
          if (typeof value === 'string') {
            // Strict patterns for common date formats
            const strictDatePattern = /^\d{4}-\d{2}-\d{2}(T|\s|$)|^\d{2}\/\d{2}\/\d{4}$|^\d{4}\/\d{2}\/\d{2}$/
            if (strictDatePattern.test(value.trim())) return true

            // Also check if Date.parse works AND the parsed date is reasonable (year 1900-2100)
            const parsed = Date.parse(value)
            if (!isNaN(parsed)) {
              const date = new Date(parsed)
              const year = date.getFullYear()
              // Only accept dates between 1900-2100 to filter out numeric IDs
              if (year >= 1900 && year <= 2100) {
                // Additional check: must contain date separators (-, /) or time indicators
                if (/[-\/T:]/.test(value)) {
                  return true
                }
              }
            }
          }

          return false
        }) : []

        if (dateColumns.length > 0 && shouldApplyGranularityAggregation) {
          console.log('📊 [Store.getFilteredData] Applying granularity aggregation:', {
            granularity,
            dateColumn: dateColumns[0],
            beforeAggregation: filteredData.length
          })

          filteredData = aggregateDataByGranularity(filteredData, granularity, dateColumns[0])

          console.log('📊 [Store.getFilteredData] After granularity aggregation:', {
            afterAggregation: filteredData.length,
            rowsReduced: filteredData.length
          })

          // Ensure data is always sorted chronologically by date (critical for time-series charts)
          filteredData = filteredData.sort((a, b) => {
            const dateA = new Date(a[dateColumns[0]] as string | number | Date)
            const dateB = new Date(b[dateColumns[0]] as string | number | Date)

            // Handle invalid dates gracefully
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0

            return dateA.getTime() - dateB.getTime()
          })
        } else if (dateColumns.length > 0 && !shouldApplyGranularityAggregation) {
          console.log('📊 [Store.getFilteredData] Skipping granularity aggregation (no date filter active):', {
            dataLength: filteredData.length,
            message: 'Using all raw data for accurate calculations'
          })
        }

        console.log('✅ [Store.getFilteredData] Returning filtered data:', {
          finalLength: filteredData.length,
          aggregationWasApplied: shouldApplyGranularityAggregation
        })

        return filteredData
      },

      // Enhanced dashboard actions
      addChart: (template, position) => {
        const state = get()
        const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        console.log('🎨 [ADDCHART] Adding new chart:', {
          chartId,
          templateType: template.type,
          templateName: template.name,
          availableColumnsCount: state.availableColumns.length,
          currentChartsCount: state.analysis?.chartConfig?.length || 0
        })

        // Guard: Ensure we have columns before proceeding
        if (state.availableColumns.length === 0) {
          console.error('❌ [ADDCHART] Cannot add chart: no data columns available')
          return chartId
        }

        // Create chart config with EMPTY dataMapping - user must configure manually
        const newChart = {
          id: chartId,
          type: template.type,
          title: template.name,
          description: template.description,
          dataKey: [], // Empty - user must configure
          dataMapping: {}, // Empty - user must configure in Data tab
        }

        console.log('✅ [ADDCHART] Created draft chart object:', newChart)

        // CRITICAL CHANGE: Store in draftChart instead of adding to analysis.chartConfig
        set({ draftChart: newChart })

        // Create customization entry for the draft chart so Data tab can work with it
        // PERFORMANCE FIX: Always provide a default position based on template
        const customization: ChartCustomization = {
          id: chartId,
          position: position
            ? { x: position.x, y: position.y, w: template.defaultPosition.w, h: template.defaultPosition.h }
            : { x: 0, y: 0, w: template.defaultPosition.w, h: template.defaultPosition.h },
          isVisible: true,
          chartType: template.type,
        }

        get().updateChartCustomization(chartId, customization)

        // Return the chartId so the caller can select/customize it
        return chartId
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

      setDraftChart: (chart) => set({ draftChart: chart }),

      commitDraftChart: () => {
        const state = get()
        if (!state.draftChart) {
          console.warn('⚠️ [COMMIT_DRAFT] No draft chart to commit')
          return
        }

        console.log('✅ [COMMIT_DRAFT] Committing draft chart to dashboard:', state.draftChart)

        // CRITICAL FIX: Merge the customization data (including dataMapping) into the chart
        const chartId = state.draftChart.id
        const customization = state.chartCustomizations[chartId]

        // Create the final chart config with customization data
        const finalChart = {
          ...state.draftChart,
          // Merge in the dataMapping from customization
          dataMapping: customization?.dataMapping || state.draftChart.dataMapping || {},
          // Also preserve the full customization for later use
          customization: customization
        }

        console.log('✅ [COMMIT_DRAFT] Final chart with customization:', finalChart)

        // Add the draft chart to analysis.chartConfig
        set(state => ({
          analysis: state.analysis ? {
            ...state.analysis,
            chartConfig: [...state.analysis.chartConfig, finalChart]
          } : null,
          draftChart: null // Clear the draft
        }))

        get().addToHistory('chart_add', { chartId: finalChart.id, template: finalChart })
      },

      // Upload status actions
      setUploadProgress: (progress) => set({ uploadProgress: progress }),
      setUploadStage: (stage) => set({ uploadStage: stage }),
      setUploadComplete: (complete) => set({ uploadComplete: complete }),
      setUploadProjectId: (projectId) => set({ uploadProjectId: projectId }),
      dismissUpload: () => set({
        uploadProgress: 0,
        uploadStage: null,
        uploadComplete: false,
        uploadProjectId: null,
      }),

      // Utility actions
      reset: () => set({
        currentSession: null,
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
        chartCustomizations: state.chartCustomizations, // Persist chart customizations
        chatMessages: state.chatMessages, // Persist chat history to localStorage
        // Store only essential metadata, not the full data
        fileName: state.fileName,
        dataId: state.dataId, // Store reference to IndexedDB data
        dataSchema: state.dataSchema,
        // CRITICAL FIX: Only persist analysis if it has actual charts
        // Empty analysis objects (chartConfig.length === 0) should not be persisted
        // This prevents stale empty analysis from blocking new AI analysis on page load
        analysis: state.analysis && state.analysis.chartConfig && state.analysis.chartConfig.length > 0
          ? state.analysis
          : undefined,
        correctedSchema: state.correctedSchema,
        dataContext: state.dataContext,
        currentSession: state.currentSession,
        // Store a flag indicating data exists
        hasData: state.rawData && state.rawData.length > 0,
      }),
      onRehydrateStorage: (state) => {
        return (rehydratedState, error) => {
          if (error) {
            console.error('Failed to rehydrate store:', error)
            return
          }

          if (rehydratedState) {
            // Load data from IndexedDB after store hydration
            if (rehydratedState.dataId && !rehydratedState.rawData?.length) {
              dataStorage.loadData(rehydratedState.dataId).then(data => {
                if (data) {
                  useDataStore.setState({ rawData: data })
                }
              }).catch(error => {
                console.error('Failed to load data from IndexedDB:', error)
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

/**
 * Helper function to convert legacy analysis to enhanced format
 * Used for backward compatibility
 */
export function convertLegacyToEnhancedAnalysis(
  legacy: AnalysisResult
): EnhancedAnalysisResult {
  return {
    insights: legacy.insights,
    recommendations: legacy.chartConfig.map((chart, index) => ({
      id: chart.id || `chart-${index}`,
      priority: index + 1,
      confidence: 0.8, // Default confidence
      type: chart.type,
      title: chart.title,
      description: chart.description,
      reasoning: chart.description,
      businessValue: 'Provides insights from your data',
      dataMapping: {
        yAxis: chart.dataKey,
        xAxis: chart.dataKey[0],
      },
      chartConfig: {
        aggregation: chart.aggregation,
      },
    })),
    dataContext: {
      domain: 'general',
      description: legacy.summary.businessContext || 'General data analysis',
      keyEntities: [],
      timeGranularity: 'none',
      suggestedQuestions: [],
    },
    summary: {
      rowCount: legacy.summary.rowCount,
      columnCount: legacy.summary.columnCount,
      columns: legacy.summary.columns,
      dataQuality: legacy.summary.dataQuality || 'Good',
      keyFindings: legacy.summary.keyFindings || '',
      recommendations: legacy.summary.recommendations || '',
    },
  }
}

/**
 * Helper function to convert enhanced analysis to legacy format
 * Used for components that still expect legacy format
 */
export function convertEnhancedToLegacyAnalysis(
  enhanced: EnhancedAnalysisResult
): AnalysisResult {
  return {
    insights: enhanced.insights,
    chartConfig: enhanced.recommendations.map((rec) => ({
      id: rec.id,
      type: rec.type,
      title: rec.title,
      dataKey: rec.dataMapping.yAxis,
      description: rec.description,
      aggregation: rec.chartConfig.aggregation,
    })),
    summary: {
      rowCount: enhanced.summary.rowCount,
      columnCount: enhanced.summary.columnCount,
      columns: enhanced.summary.columns,
      dataQuality: enhanced.summary.dataQuality,
      keyFindings: enhanced.summary.keyFindings,
      recommendations: enhanced.summary.recommendations,
      businessContext: enhanced.dataContext.description,
    },
  }
}