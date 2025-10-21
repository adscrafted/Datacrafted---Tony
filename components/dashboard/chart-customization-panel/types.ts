/**
 * TypeScript type definitions for Chart Customization Panel
 */

import type { ChartCustomization } from '@/lib/store'

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo' | 'waterfall' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap' | 'sankey' | 'sparkline'

export type TabType = 'general' | 'data' | 'style' | 'axes' | 'actions'

export interface ChartCustomizationPanelProps {
  chartId: string
  title: string
  description: string
  chartType: ChartType
  customization?: ChartCustomization
  onCustomizationChange: (chartId: string, customization: Partial<ChartCustomization>) => void
  className?: string
  initialTab?: TabType
  configDataMapping?: any
  autoOpen?: boolean
}

export interface ChartTypeOption {
  value: ChartType
  label: string
  icon: string
}

export interface TabOption {
  id: TabType
  label: string
  icon: any
}

export interface ColumnsByType {
  numeric: string[]
  text: string[]
  date: string[]
  all: string[]
}

export interface DataSchema {
  columns: Array<{
    name: string
    type: 'number' | 'string' | 'categorical' | 'date'
  }>
}

export interface DragData {
  fieldName: string
  fieldType: 'number' | 'string' | 'categorical' | 'date'
}

export interface DataMapping {
  // Common fields
  xAxis?: string
  yAxis?: string | string[]
  category?: string
  value?: string
  values?: string[]

  // Dual Y-Axis fields
  yAxis1?: string | string[]
  yAxis2?: string | string[]

  // Aggregation
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median'

  // Bar chart specific
  sortBy?: 'value' | 'label' | ''
  sortOrder?: 'asc' | 'desc'
  limit?: number

  // Scatter chart specific
  size?: string
  color?: string

  // Table specific
  columns?: string[]

  // Waterfall specific
  type?: string

  // Gauge specific
  metric?: string
  max?: number
  min?: number

  // Cohort specific
  cohort?: string
  period?: string

  // Bullet specific
  actual?: string
  comparative?: string

  // Sankey specific
  source?: string
  target_node?: string

  // Sparkline specific
  trend?: string
}

export interface FieldDropZoneProps {
  label: string
  fieldName?: string | string[]
  onDrop: (fieldName: string) => void
  onRemove: () => void
  placeholder?: string
  borderColor?: string
  bgColor?: string
  textColor?: string
  acceptMultiple?: boolean
  acceptedTypes?: ('number' | 'string' | 'categorical' | 'date')[]
}

export interface AvailableFieldsProps {
  columns: string[]
  dataSchema?: DataSchema
  onDragStart: (fieldName: string, fieldType: string) => void
}

export interface ValidationResult {
  isValid: boolean
  missingFields: string
}
