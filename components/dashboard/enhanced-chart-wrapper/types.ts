import { ChartType, DataRow } from '@/lib/store'

export interface EnhancedChartWrapperProps {
  id: string
  type: ChartType
  title: string
  description: string
  data: DataRow[]
  dataKey: string[]
  configDataMapping?: any  // dataMapping from original chart config
  customization?: any  // Chart customization settings
  isDragging?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  onEdit?: (id: string) => void
  className?: string
  qualityScore?: number
  initialTab?: 'general' | 'data' | 'style' | 'axes' | 'actions' // Tab to open in customization panel
  onDataPointClick?: (dataPoint: any) => void // Callback when a data point is clicked
}

// Feature flags based on container width
export interface ResponsiveFeatures {
  showLegend: boolean
  showGrid: boolean
  showSecondaryLabels: boolean
  showPrimaryLabels: boolean
  useFallbackView: boolean
}

// Custom dot component props for Line charts
export interface CustomDotProps {
  cx?: number
  cy?: number
  fill?: string
  r?: number
  payload?: any
  onClick?: (payload: any) => void
}

// Custom shape component props for Scatter charts
export interface CustomScatterShapeProps {
  cx?: number
  cy?: number
  fill?: string
  payload?: any
  onClick?: (payload: any) => void
}

// Dual axis configuration
export interface DualAxisConfig {
  leftMetrics: string[]
  rightMetrics: string[]
  leftLabel: string
  rightLabel: string
}

// Container sizing information
export interface ContainerSizing {
  width: number
  height: number
  meetsMinimums: boolean
  isConstrained: boolean
}

// Smart axis scaling configuration
export interface SmartAxisScaling {
  rotation: number
  bottomMargin: number
  leftMargin: number
  rightMargin: number
  topMargin: number
  xAxisInterval: number | 'preserveStartEnd'
}

// Enhanced axis labels
export interface EnhancedAxisLabels {
  x: string
  y: string
  xTruncated: boolean
  yTruncated: boolean
  xOriginal?: string
  yOriginal?: string
}

// Scatter data structure
export interface ScatterGroup {
  name: string
  color: string
  data: DataRow[]
}

export interface ScatterData {
  numericData: DataRow[]
  groups: ScatterGroup[]
}

// Chart renderer props (common props passed to all renderers)
export interface ChartRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
  customization: any
  configDataMapping: any
  effectiveChartType: ChartType
  containerSizing: ContainerSizing
  responsiveFeatures: ResponsiveFeatures
  smartAxisScaling: SmartAxisScaling
  enhancedAxisLabels: EnhancedAxisLabels
  dualAxisConfig: DualAxisConfig | null
  colors: string[]
  truncateLabel: (label: string, maxWidth: number) => { text: string; isTruncated: boolean }
  onDataPointClick?: (dataPoint: any) => void
}
