/**
 * Comprehensive type definitions for advanced chart types
 *
 * This file defines strict TypeScript types for 10 advanced chart types:
 * - Waterfall Chart
 * - Funnel Chart
 * - Heatmap Chart
 * - Gauge/Radial Chart
 * - Cohort Retention Grid
 * - Bullet Chart
 * - Treemap Chart
 * - Sankey Diagram
 * - Sparkline Chart
 * - 100% Stacked Charts
 *
 * All types use discriminated unions and avoid 'any' for type safety.
 */

// ============================================================================
// Core Chart Type Union
// ============================================================================

/**
 * Extended chart type union including all new chart types
 */
export type ExtendedChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'scorecard'
  | 'table'
  | 'combo'
  | 'waterfall'
  | 'funnel'
  | 'heatmap'
  | 'gauge'
  | 'cohort'
  | 'bullet'
  | 'treemap'
  | 'sankey'
  | 'sparkline'
  | 'stacked100'

// ============================================================================
// 1. Waterfall Chart Types
// ============================================================================

/**
 * Data point for waterfall charts showing cumulative changes
 */
export interface WaterfallDataPoint {
  /** Category or time period label */
  readonly label: string
  /** Change value (positive or negative) */
  readonly value: number
  /** Type of value in waterfall */
  readonly type: 'increase' | 'decrease' | 'total' | 'subtotal'
  /** Optional running total */
  readonly runningTotal?: number
  /** Optional color override */
  readonly color?: string
  /** Optional tooltip text */
  readonly tooltip?: string
}

/**
 * Configuration for waterfall chart data mapping
 */
export interface WaterfallDataMapping {
  /** Column containing category/label */
  readonly category: string
  /** Column containing values */
  readonly value: string
  /** Optional column defining value type */
  readonly type?: string
  /** Optional column for grouping */
  readonly group?: string
}

/**
 * Configuration options for waterfall charts
 */
export interface WaterfallChartConfig {
  readonly chartType: 'waterfall'
  /** Show connector lines between bars */
  readonly showConnectors?: boolean
  /** Color for positive values */
  readonly increaseColor?: string
  /** Color for negative values */
  readonly decreaseColor?: string
  /** Color for total/subtotal bars */
  readonly totalColor?: string
  /** Show cumulative total line */
  readonly showCumulativeLine?: boolean
  /** Starting value for waterfall */
  readonly startValue?: number
  /** Position of total bar */
  readonly totalPosition?: 'end' | 'custom' | 'none'
  /** Format for value labels */
  readonly valueFormat?: 'number' | 'currency' | 'percentage'
  /** Show value labels on bars */
  readonly showValueLabels?: boolean
}

// ============================================================================
// 2. Funnel Chart Types
// ============================================================================

/**
 * Data point for funnel charts showing conversion stages
 */
export interface FunnelDataPoint {
  /** Stage name */
  readonly stage: string
  /** Number of items at this stage */
  readonly value: number
  /** Conversion rate from previous stage */
  readonly conversionRate?: number
  /** Dropout rate from previous stage */
  readonly dropoutRate?: number
  /** Optional color */
  readonly color?: string
  /** Optional metadata */
  readonly metadata?: Record<string, string | number>
}

/**
 * Configuration for funnel chart data mapping
 */
export interface FunnelDataMapping {
  /** Column containing stage names */
  readonly stage: string
  /** Column containing values */
  readonly value: string
  /** Optional column for custom ordering */
  readonly order?: string
  /** Optional column for grouping (for comparing funnels) */
  readonly group?: string
}

/**
 * Configuration options for funnel charts
 */
export interface FunnelChartConfig {
  readonly chartType: 'funnel'
  /** Funnel orientation */
  readonly orientation?: 'vertical' | 'horizontal'
  /** Funnel shape style */
  readonly shape?: 'trapezoid' | 'pyramid' | 'rectangle'
  /** Show conversion rates between stages */
  readonly showConversionRates?: boolean
  /** Show value labels */
  readonly showValueLabels?: boolean
  /** Label format */
  readonly labelFormat?: 'value' | 'percentage' | 'both'
  /** Align funnel segments */
  readonly align?: 'left' | 'center' | 'right'
  /** Gap between segments */
  readonly segmentGap?: number
  /** Sort order */
  readonly sortOrder?: 'descending' | 'ascending' | 'custom'
}

// ============================================================================
// 3. Heatmap Chart Types
// ============================================================================

/**
 * Data point for heatmap charts showing 2D intensity data
 */
export interface HeatmapDataPoint {
  /** X-axis category */
  readonly x: string | number
  /** Y-axis category */
  readonly y: string | number
  /** Intensity value */
  readonly value: number
  /** Optional label override */
  readonly label?: string
  /** Optional metadata */
  readonly metadata?: Record<string, string | number>
}

/**
 * Configuration for heatmap chart data mapping
 */
export interface HeatmapDataMapping {
  /** Column for X-axis categories */
  readonly xAxis: string
  /** Column for Y-axis categories */
  readonly yAxis: string
  /** Column containing intensity values */
  readonly value: string
  /** Optional aggregation method when multiple values exist */
  readonly aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max'
}

/**
 * Color scale configuration for heatmap
 */
export interface HeatmapColorScale {
  /** Minimum value color */
  readonly minColor: string
  /** Maximum value color */
  readonly maxColor: string
  /** Optional middle color for diverging scales */
  readonly midColor?: string
  /** Optional custom color stops */
  readonly colorStops?: ReadonlyArray<{ value: number; color: string }>
}

/**
 * Configuration options for heatmap charts
 */
export interface HeatmapChartConfig {
  readonly chartType: 'heatmap'
  /** Color scale configuration */
  readonly colorScale?: HeatmapColorScale
  /** Show cell borders */
  readonly showCellBorders?: boolean
  /** Cell border color */
  readonly cellBorderColor?: string
  /** Show value labels in cells */
  readonly showValueLabels?: boolean
  /** Value label color mode */
  readonly labelColorMode?: 'auto' | 'light' | 'dark'
  /** Cell size mode */
  readonly cellSize?: 'fixed' | 'adaptive'
  /** Optional cell width */
  readonly cellWidth?: number
  /** Optional cell height */
  readonly cellHeight?: number
  /** Show color legend */
  readonly showColorLegend?: boolean
}

// ============================================================================
// 4. Gauge/Radial Chart Types
// ============================================================================

/**
 * Data point for gauge charts showing single metric against target
 */
export interface GaugeDataPoint {
  /** Current value */
  readonly value: number
  /** Target or maximum value */
  readonly target: number
  /** Minimum value */
  readonly min?: number
  /** Label for the metric */
  readonly label: string
  /** Optional threshold ranges */
  readonly thresholds?: ReadonlyArray<{
    min: number
    max: number
    color: string
    label?: string
  }>
}

/**
 * Configuration for gauge chart data mapping
 */
export interface GaugeDataMapping {
  /** Column containing metric values to aggregate */
  readonly value: string
  /** Aggregation method to apply to values (default: sum) */
  readonly aggregation?: 'sum' | 'average' | 'median' | 'min' | 'max' | 'count'
  /** Column containing minimum value */
  readonly min?: string
  /** Column containing metric label */
  readonly label?: string
}

/**
 * Configuration options for gauge charts
 */
export interface GaugeChartConfig {
  readonly chartType: 'gauge'
  /** Gauge type */
  readonly gaugeType?: 'circular' | 'semicircular' | 'arc' | 'bullet'
  /** Start angle (degrees) */
  readonly startAngle?: number
  /** End angle (degrees) */
  readonly endAngle?: number
  /** Show needle/pointer */
  readonly showNeedle?: boolean
  /** Needle color */
  readonly needleColor?: string
  /** Show value label */
  readonly showValueLabel?: boolean
  /** Value label position */
  readonly valueLabelPosition?: 'center' | 'bottom' | 'top'
  /** Show min/max labels */
  readonly showMinMaxLabels?: boolean
  /** Color ranges for different value zones */
  readonly colorRanges?: ReadonlyArray<{
    from: number
    to: number
    color: string
  }>
  /** Default gauge color */
  readonly gaugeColor?: string
  /** Background arc color */
  readonly backgroundColor?: string
}

// ============================================================================
// 5. Cohort Retention Grid Types
// ============================================================================

/**
 * Data point for cohort retention analysis
 */
export interface CohortDataPoint {
  /** Cohort identifier (e.g., signup date) */
  readonly cohort: string
  /** Period number (0 = initial, 1 = first period, etc.) */
  readonly period: number
  /** Number of users retained */
  readonly retained: number
  /** Total cohort size */
  readonly cohortSize: number
  /** Retention rate (0-1) */
  readonly retentionRate: number
  /** Optional metadata */
  readonly metadata?: Record<string, string | number>
}

/**
 * Configuration for cohort chart data mapping
 */
export interface CohortDataMapping {
  /** Column containing cohort identifier */
  readonly cohort: string
  /** Column containing period/time offset */
  readonly period: string
  /** Column containing retention count or rate */
  readonly value: string
  /** Column containing cohort size */
  readonly cohortSize?: string
  /** Value type */
  readonly valueType?: 'count' | 'rate' | 'percentage'
}

/**
 * Configuration options for cohort retention charts
 */
export interface CohortChartConfig {
  readonly chartType: 'cohort'
  /** Display mode */
  readonly displayMode?: 'percentage' | 'absolute' | 'both'
  /** Color scale for retention rates */
  readonly colorScale?: HeatmapColorScale
  /** Highlight diagonal (day 0) */
  readonly highlightDiagonal?: boolean
  /** Show grid lines */
  readonly showGridLines?: boolean
  /** Period labels (e.g., 'Day', 'Week', 'Month') */
  readonly periodLabel?: string
  /** Maximum periods to display */
  readonly maxPeriods?: number
  /** Show cohort size column */
  readonly showCohortSize?: boolean
  /** Show trend lines */
  readonly showTrendLines?: boolean
}

// ============================================================================
// 6. Bullet Chart Types
// ============================================================================

/**
 * Data point for bullet charts showing performance against targets
 */
export interface BulletDataPoint {
  /** Metric name */
  readonly metric: string
  /** Current value */
  readonly value: number
  /** Target value */
  readonly target: number
  /** Optional comparative measure (e.g., previous period) */
  readonly comparative?: number
  /** Optional qualitative ranges */
  readonly ranges?: ReadonlyArray<{
    min: number
    max: number
    label?: string
  }>
}

/**
 * Configuration for bullet chart data mapping
 */
export interface BulletDataMapping {
  /** Column containing metric names */
  readonly metric: string
  /** Column containing current values */
  readonly value: string
  /** Column containing target values */
  readonly target: string
  /** Optional column for comparative measure */
  readonly comparative?: string
  /** Optional columns for qualitative ranges */
  readonly ranges?: {
    poor: string
    satisfactory: string
    good: string
  }
}

/**
 * Configuration options for bullet charts
 */
export interface BulletChartConfig {
  readonly chartType: 'bullet'
  /** Chart orientation */
  readonly orientation?: 'horizontal' | 'vertical'
  /** Show target marker */
  readonly showTarget?: boolean
  /** Target marker style */
  readonly targetStyle?: 'line' | 'marker' | 'bar'
  /** Show comparative measure */
  readonly showComparative?: boolean
  /** Comparative measure style */
  readonly comparativeStyle?: 'line' | 'bar'
  /** Show qualitative ranges */
  readonly showRanges?: boolean
  /** Range colors */
  readonly rangeColors?: {
    poor: string
    satisfactory: string
    good: string
  }
  /** Value bar color */
  readonly valueColor?: string
  /** Show value labels */
  readonly showValueLabels?: boolean
}

// ============================================================================
// 7. Treemap Chart Types
// ============================================================================

/**
 * Data point for treemap charts showing hierarchical data
 */
export interface TreemapDataPoint {
  /** Node name */
  readonly name: string
  /** Node value (size) */
  readonly value: number
  /** Parent node name (empty for root) */
  readonly parent?: string
  /** Optional color value (for color scale) */
  readonly colorValue?: number
  /** Optional category for color grouping */
  readonly category?: string
  /** Optional metadata */
  readonly metadata?: Record<string, string | number>
  /** Optional children nodes */
  readonly children?: ReadonlyArray<TreemapDataPoint>
}

/**
 * Configuration for treemap chart data mapping
 */
export interface TreemapDataMapping {
  /** Column containing node names */
  readonly name: string
  /** Column containing values (for size) */
  readonly value: string
  /** Column containing parent references */
  readonly parent?: string
  /** Optional column for color values */
  readonly colorValue?: string
  /** Optional column for categories */
  readonly category?: string
}

/**
 * Configuration options for treemap charts
 */
export interface TreemapChartConfig {
  readonly chartType: 'treemap'
  /** Tiling algorithm */
  readonly tilingAlgorithm?: 'squarify' | 'binary' | 'slice' | 'dice' | 'slicedice'
  /** Show labels */
  readonly showLabels?: boolean
  /** Label style */
  readonly labelStyle?: 'name' | 'value' | 'both' | 'percentage'
  /** Minimum size to show label */
  readonly minLabelSize?: number
  /** Show borders */
  readonly showBorders?: boolean
  /** Border color */
  readonly borderColor?: string
  /** Border width */
  readonly borderWidth?: number
  /** Color mode */
  readonly colorMode?: 'category' | 'value' | 'gradient'
  /** Color scale (when using value mode) */
  readonly colorScale?: HeatmapColorScale
  /** Allow drilling down into hierarchy */
  readonly enableDrilldown?: boolean
  /** Show breadcrumbs for navigation */
  readonly showBreadcrumbs?: boolean
}

// ============================================================================
// 8. Sankey Diagram Types
// ============================================================================

/**
 * Node in a Sankey diagram
 */
export interface SankeyNode {
  /** Unique node identifier */
  readonly id: string
  /** Display name */
  readonly name: string
  /** Optional category */
  readonly category?: string
  /** Optional color */
  readonly color?: string
}

/**
 * Link in a Sankey diagram
 */
export interface SankeyLink {
  /** Source node ID */
  readonly source: string
  /** Target node ID */
  readonly target: string
  /** Flow value */
  readonly value: number
  /** Optional color */
  readonly color?: string
  /** Optional label */
  readonly label?: string
}

/**
 * Complete Sankey diagram data
 */
export interface SankeyData {
  /** All nodes in the diagram */
  readonly nodes: ReadonlyArray<SankeyNode>
  /** All links between nodes */
  readonly links: ReadonlyArray<SankeyLink>
}

/**
 * Configuration for Sankey diagram data mapping
 */
export interface SankeyDataMapping {
  /** Column containing source nodes */
  readonly source: string
  /** Column containing target nodes */
  readonly target: string
  /** Column containing flow values */
  readonly value: string
  /** Optional column for link categories */
  readonly category?: string
}

/**
 * Configuration options for Sankey diagrams
 */
export interface SankeyChartConfig {
  readonly chartType: 'sankey'
  /** Node alignment */
  readonly nodeAlignment?: 'left' | 'right' | 'center' | 'justify'
  /** Node width */
  readonly nodeWidth?: number
  /** Padding between nodes */
  readonly nodePadding?: number
  /** Show node labels */
  readonly showNodeLabels?: boolean
  /** Node label position */
  readonly nodeLabelPosition?: 'inside' | 'outside'
  /** Show link values */
  readonly showLinkValues?: boolean
  /** Link opacity */
  readonly linkOpacity?: number
  /** Link color mode */
  readonly linkColorMode?: 'source' | 'target' | 'gradient' | 'custom'
  /** Allow node dragging */
  readonly enableNodeDragging?: boolean
  /** Number of iterations for layout algorithm */
  readonly iterations?: number
}

// ============================================================================
// 9. Sparkline Chart Types
// ============================================================================

/**
 * Data point for sparkline charts (minimal trend visualization)
 */
export interface SparklineDataPoint {
  /** X value (usually time or index) */
  readonly x: number | string
  /** Y value */
  readonly y: number
  /** Optional highlight flag */
  readonly highlight?: boolean
}

/**
 * Configuration for sparkline chart data mapping
 */
export interface SparklineDataMapping {
  /** Column for X values */
  readonly xAxis?: string
  /** Column for Y values */
  readonly yAxis: string
  /** Optional column for highlighting points */
  readonly highlight?: string
}

/**
 * Configuration options for sparkline charts
 */
export interface SparklineChartConfig {
  readonly chartType: 'sparkline'
  /** Sparkline type */
  readonly sparklineType?: 'line' | 'area' | 'bar' | 'discrete'
  /** Line color */
  readonly lineColor?: string
  /** Fill color (for area type) */
  readonly fillColor?: string
  /** Show first/last values */
  readonly showEndPoints?: boolean
  /** Show min/max points */
  readonly showExtremes?: boolean
  /** Extreme point markers */
  readonly extremeMarkerSize?: number
  /** Extreme point colors */
  readonly extremeColors?: {
    min: string
    max: string
  }
  /** Show current value */
  readonly showCurrentValue?: boolean
  /** Normal range band */
  readonly normalRangeBand?: {
    min: number
    max: number
    color?: string
  }
  /** Smooth line */
  readonly smoothLine?: boolean
  /** Chart height (sparklines are typically compact) */
  readonly height?: number
}

// ============================================================================
// 10. 100% Stacked Charts Types
// ============================================================================

/**
 * Data point for 100% stacked charts (normalized stacking)
 */
export interface Stacked100DataPoint {
  /** Category or X-axis value */
  readonly category: string | number
  /** Series values (will be normalized to 100%) */
  readonly values: Record<string, number>
  /** Optional total (calculated if not provided) */
  readonly total?: number
}

/**
 * Configuration for 100% stacked chart data mapping
 */
export interface Stacked100DataMapping {
  /** Column for categories/X-axis */
  readonly category: string
  /** Columns to stack (will be normalized) */
  readonly series: ReadonlyArray<string>
  /** Optional grouping column */
  readonly group?: string
}

/**
 * Configuration options for 100% stacked charts
 */
export interface Stacked100ChartConfig {
  readonly chartType: 'stacked100'
  /** Base chart type to stack */
  readonly baseType: 'bar' | 'area' | 'line'
  /** Chart orientation (for bar type) */
  readonly orientation?: 'vertical' | 'horizontal'
  /** Show percentage labels */
  readonly showPercentageLabels?: boolean
  /** Label format */
  readonly labelFormat?: 'percentage' | 'decimal'
  /** Show value tooltips */
  readonly showValueTooltips?: boolean
  /** Tooltip value format */
  readonly tooltipFormat?: 'percentage' | 'absolute' | 'both'
  /** Stack order */
  readonly stackOrder?: 'default' | 'ascending' | 'descending' | 'reverse'
  /** Color palette for series */
  readonly seriesColors?: Record<string, string>
  /** Show series legend */
  readonly showLegend?: boolean
  /** Legend position */
  readonly legendPosition?: 'top' | 'bottom' | 'left' | 'right'
}

// ============================================================================
// Unified Chart Configuration Type
// ============================================================================

/**
 * Discriminated union of all chart configurations
 * Enables type-safe chart configuration based on chartType
 */
export type ChartConfig =
  | WaterfallChartConfig
  | FunnelChartConfig
  | HeatmapChartConfig
  | GaugeChartConfig
  | CohortChartConfig
  | BulletChartConfig
  | TreemapChartConfig
  | SankeyChartConfig
  | SparklineChartConfig
  | Stacked100ChartConfig

/**
 * Discriminated union of all data mapping configurations
 */
export type ChartDataMapping =
  | WaterfallDataMapping
  | FunnelDataMapping
  | HeatmapDataMapping
  | GaugeDataMapping
  | CohortDataMapping
  | BulletDataMapping
  | TreemapDataMapping
  | SankeyDataMapping
  | SparklineDataMapping
  | Stacked100DataMapping

/**
 * Union of all data point types
 */
export type ChartDataPoint =
  | WaterfallDataPoint
  | FunnelDataPoint
  | HeatmapDataPoint
  | GaugeDataPoint
  | CohortDataPoint
  | BulletDataPoint
  | TreemapDataPoint
  | SankeyLink
  | SparklineDataPoint
  | Stacked100DataPoint

// ============================================================================
// Chart Template Extensions
// ============================================================================

/**
 * Extended chart template with new chart types
 */
export interface ExtendedChartTemplate {
  readonly id: string
  readonly name: string
  readonly type: ExtendedChartType
  readonly description: string
  readonly category: 'comparison' | 'distribution' | 'trend' | 'relationship' | 'composition' | 'performance' | 'flow'
  readonly icon: string
  readonly defaultPosition: { w: number; h: number }
  readonly requiredDataTypes: ReadonlyArray<'string' | 'number' | 'date' | 'boolean'>
  readonly minColumns: number
  readonly maxColumns?: number
  readonly preview?: string
  /** Specific data requirements */
  readonly dataRequirements?: {
    /** Requires hierarchical data */
    hierarchical?: boolean
    /** Requires temporal data */
    temporal?: boolean
    /** Requires paired source-target data */
    flowData?: boolean
    /** Minimum number of data points */
    minDataPoints?: number
  }
}

// ============================================================================
// Chart Customization Extensions
// ============================================================================

/**
 * Extended chart customization with new chart types
 */
export interface ExtendedChartCustomization {
  readonly id: string
  readonly position: { x: number; y: number; w: number; h: number }
  readonly colors?: ReadonlyArray<string>
  readonly theme?: 'default' | 'light' | 'dark' | 'custom'
  readonly showLegend?: boolean
  readonly showGrid?: boolean
  readonly customTitle?: string
  readonly customDescription?: string
  readonly axisLabels?: { x?: string; y?: string }
  readonly isVisible?: boolean
  readonly chartType?: ExtendedChartType
  readonly animate?: boolean
  readonly interactive?: boolean
  /** Chart-specific configuration */
  readonly chartConfig?: ChartConfig
  /** Data mapping configuration */
  readonly dataMapping?: ChartDataMapping
  /** Dynamic sizing options */
  readonly autoSize?: boolean
  readonly minHeight?: number
  readonly maxHeight?: number
  readonly labelRotation?: 'auto' | 'horizontal' | 'diagonal' | 'vertical'
}

// ============================================================================
// Helper Type Guards
// ============================================================================

/**
 * Type guard for waterfall chart config
 */
export function isWaterfallConfig(config: ChartConfig): config is WaterfallChartConfig {
  return config.chartType === 'waterfall'
}

/**
 * Type guard for funnel chart config
 */
export function isFunnelConfig(config: ChartConfig): config is FunnelChartConfig {
  return config.chartType === 'funnel'
}

/**
 * Type guard for heatmap chart config
 */
export function isHeatmapConfig(config: ChartConfig): config is HeatmapChartConfig {
  return config.chartType === 'heatmap'
}

/**
 * Type guard for gauge chart config
 */
export function isGaugeConfig(config: ChartConfig): config is GaugeChartConfig {
  return config.chartType === 'gauge'
}

/**
 * Type guard for cohort chart config
 */
export function isCohortConfig(config: ChartConfig): config is CohortChartConfig {
  return config.chartType === 'cohort'
}

/**
 * Type guard for bullet chart config
 */
export function isBulletConfig(config: ChartConfig): config is BulletChartConfig {
  return config.chartType === 'bullet'
}

/**
 * Type guard for treemap chart config
 */
export function isTreemapConfig(config: ChartConfig): config is TreemapChartConfig {
  return config.chartType === 'treemap'
}

/**
 * Type guard for sankey chart config
 */
export function isSankeyConfig(config: ChartConfig): config is SankeyChartConfig {
  return config.chartType === 'sankey'
}

/**
 * Type guard for sparkline chart config
 */
export function isSparklineConfig(config: ChartConfig): config is SparklineChartConfig {
  return config.chartType === 'sparkline'
}

/**
 * Type guard for 100% stacked chart config
 */
export function isStacked100Config(config: ChartConfig): config is Stacked100ChartConfig {
  return config.chartType === 'stacked100'
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract chart config type from chart type
 */
export type ChartConfigForType<T extends ExtendedChartType> =
  T extends 'waterfall' ? WaterfallChartConfig :
  T extends 'funnel' ? FunnelChartConfig :
  T extends 'heatmap' ? HeatmapChartConfig :
  T extends 'gauge' ? GaugeChartConfig :
  T extends 'cohort' ? CohortChartConfig :
  T extends 'bullet' ? BulletChartConfig :
  T extends 'treemap' ? TreemapChartConfig :
  T extends 'sankey' ? SankeyChartConfig :
  T extends 'sparkline' ? SparklineChartConfig :
  T extends 'stacked100' ? Stacked100ChartConfig :
  never

/**
 * Extract data mapping type from chart type
 */
export type DataMappingForType<T extends ExtendedChartType> =
  T extends 'waterfall' ? WaterfallDataMapping :
  T extends 'funnel' ? FunnelDataMapping :
  T extends 'heatmap' ? HeatmapDataMapping :
  T extends 'gauge' ? GaugeDataMapping :
  T extends 'cohort' ? CohortDataMapping :
  T extends 'bullet' ? BulletDataMapping :
  T extends 'treemap' ? TreemapDataMapping :
  T extends 'sankey' ? SankeyDataMapping :
  T extends 'sparkline' ? SparklineDataMapping :
  T extends 'stacked100' ? Stacked100DataMapping :
  never

/**
 * Extract data point type from chart type
 */
export type DataPointForType<T extends ExtendedChartType> =
  T extends 'waterfall' ? WaterfallDataPoint :
  T extends 'funnel' ? FunnelDataPoint :
  T extends 'heatmap' ? HeatmapDataPoint :
  T extends 'gauge' ? GaugeDataPoint :
  T extends 'cohort' ? CohortDataPoint :
  T extends 'bullet' ? BulletDataPoint :
  T extends 'treemap' ? TreemapDataPoint :
  T extends 'sankey' ? SankeyLink :
  T extends 'sparkline' ? SparklineDataPoint :
  T extends 'stacked100' ? Stacked100DataPoint :
  never
