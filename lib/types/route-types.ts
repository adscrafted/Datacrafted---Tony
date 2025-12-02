/**
 * Type definitions specific to route.ts
 * Centralized type definitions for the analyze route
 */

/**
 * Supported chart types - single source of truth
 */
export const SUPPORTED_CHART_TYPES = [
  'line',
  'bar',
  'pie',
  'area',
  'scatter',
  'scorecard',
  'table',
  'combo',
  'waterfall',
  'heatmap',
  'gauge',
  'cohort',
  'bullet',
  'treemap',
  'sparkline',
  'sankey',
] as const

export type SupportedChartType = typeof SUPPORTED_CHART_TYPES[number]

/**
 * Type guard for supported chart types
 */
export function isSupportedChartType(type: string): type is SupportedChartType {
  return SUPPORTED_CHART_TYPES.includes(type as SupportedChartType)
}
