/**
 * Constants for Chart Customization Panel
 */

export const chartTypeOptions = [
  { value: 'bar', label: 'Bar Chart', icon: '📊' },
  { value: 'line', label: 'Line Chart', icon: '📈' },
  { value: 'pie', label: 'Pie Chart', icon: '🥧' },
  { value: 'area', label: 'Area Chart', icon: '📈' },
  { value: 'scatter', label: 'Scatter Plot', icon: '📍' },
  { value: 'scorecard', label: 'Scorecard', icon: '🎯' },
  { value: 'table', label: 'Data Table', icon: '📋' },
  { value: 'combo', label: 'Combo Chart', icon: '📊📈' },
  { value: 'waterfall', label: 'Waterfall Chart', icon: '💧' },
  { value: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { value: 'gauge', label: 'Gauge Chart', icon: '🎯' },
  { value: 'cohort', label: 'Cohort Analysis', icon: '👥' },
  { value: 'bullet', label: 'Bullet Chart', icon: '🎯' },
  { value: 'treemap', label: 'Treemap', icon: '🗺️' },
  { value: 'sparkline', label: 'Sparkline', icon: '✨' }
] as const

export const DEFAULT_CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export const THEME_OPTIONS = ['default', 'light', 'dark'] as const

export const LABEL_ROTATION_OPTIONS = ['auto', 'horizontal', 'diagonal', 'vertical'] as const

export const AGGREGATION_OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'distinct', label: 'Distinct Count' },
  { value: 'median', label: 'Median' }
] as const

export const SORT_BY_OPTIONS = [
  { value: '', label: 'No sorting' },
  { value: 'value', label: 'Value' },
  { value: 'label', label: 'Label' }
] as const

export const SORT_ORDER_OPTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' }
] as const

export const EXPORT_FORMATS = ['png', 'pdf', 'svg'] as const

export const FIELD_TYPE_ICONS = {
  number: '🔢',
  string: '📝',
  categorical: '📝',
  date: '📅'
} as const

export type TabId = 'general' | 'data' | 'style' | 'axes' | 'actions'
export type ChartTypeOption = typeof chartTypeOptions[number]
