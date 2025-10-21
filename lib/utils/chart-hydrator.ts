/**
 * Chart Hydrator - Fills in missing fields with smart defaults
 *
 * This utility automatically hydrates chart configurations with sensible defaults:
 * - Adds default aggregations (sum for numeric charts)
 * - Sets default chart types for combo charts
 * - Applies default limits and sort orders for top/bottom queries
 * - Infers missing data mappings from schema
 * - Migrates legacy formats to current dataMapping structure
 */

import type { DataSchema, ColumnSchema } from '@/lib/store'

/**
 * Supported chart types
 */
type ChartType =
  | 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo'
  | 'waterfall' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap'
  | 'sankey' | 'sparkline'

/**
 * Data mapping interface (subset from store.ts)
 */
interface DataMapping {
  // Core fields
  xAxis?: string
  yAxis?: string | string[]
  yAxis1?: string | string[]
  yAxis2?: string | string[]
  category?: string
  value?: string
  values?: string[]
  metric?: string

  // Formula-based calculations
  formula?: string // Custom calculation formula (e.g., "SUM(Revenue) / SUM(Ad_Spend)")
  formulaAlias?: string // Name for calculated column
  formulaOptions?: {
    aggregateFirst?: boolean // Calculate aggregations before applying formula
    round?: number // Decimal places to round result
  }

  // Chart type specific
  size?: string
  color?: string
  stage?: string
  cohort?: string
  period?: string
  retention?: string
  actual?: string
  target?: string | number
  parent?: string
  source?: string
  target_node?: string
  flow?: string
  columns?: string[]

  // Aggregation and sorting
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile'
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number

  // Combo chart specific
  yAxis1Type?: 'bar' | 'line' | 'area'
  yAxis2Type?: 'bar' | 'line' | 'area'
  yAxis1Label?: string
  yAxis2Label?: string
}

/**
 * Chart configuration with dataMapping
 */
interface HydratableChartConfig {
  id?: string
  type: ChartType
  title: string
  description: string
  dataMapping?: DataMapping
  confidence?: number
  reasoning?: string

  // Legacy fields (will be migrated)
  dataKey?: string[]
  xAxis?: string | string[]
  yAxis?: string | string[]
  aggregation?: string
}

/**
 * Hydrates a chart configuration with smart defaults
 *
 * @param config - Chart configuration (potentially incomplete)
 * @param schema - Data schema for inference
 * @returns Fully hydrated chart configuration
 */
export function hydrateChartConfig(
  config: HydratableChartConfig,
  schema: DataSchema
): HydratableChartConfig {
  // Deep clone to avoid mutations
  const hydrated = JSON.parse(JSON.stringify(config))

  // Step 1: Migrate legacy format if needed
  if (!hydrated.dataMapping || Object.keys(hydrated.dataMapping).length === 0) {
    hydrated.dataMapping = migrateLegacyFormat(hydrated)
  }

  // Step 2: Apply smart defaults based on chart type
  applyChartTypeDefaults(hydrated, schema)

  // Step 3: Set default confidence if missing
  if (typeof hydrated.confidence !== 'number') {
    hydrated.confidence = 0.5
  }

  return hydrated
}

/**
 * Applies chart-type-specific defaults
 */
function applyChartTypeDefaults(config: HydratableChartConfig, schema: DataSchema): void {
  const dm = config.dataMapping!
  const numericColumns = schema.columns.filter(c => c.type === 'number')
  const dateColumns = schema.columns.filter(c => c.type === 'date')
  const categoricalColumns = schema.columns.filter(c =>
    c.type === 'string' || c.type === 'categorical'
  )

  switch (config.type) {
    case 'bar':
    case 'line':
    case 'area':
      // Default aggregation to 'sum' for numeric charts
      if (!dm.aggregation && (dm.yAxis || dm.values)) {
        dm.aggregation = 'sum'
      }

      // Bar charts with sortBy should default limit to 10 and sortOrder to desc
      if (config.type === 'bar' && dm.sortBy) {
        if (typeof dm.limit !== 'number') {
          dm.limit = 10
        }
        if (!dm.sortOrder) {
          dm.sortOrder = 'desc'
        }
      }
      break

    case 'combo':
      // Default yAxis1Type to 'bar' and yAxis2Type to 'line'
      if (!dm.yAxis1Type) {
        dm.yAxis1Type = 'bar'
      }
      if (!dm.yAxis2Type) {
        dm.yAxis2Type = 'line'
      }

      // Default aggregation to 'sum'
      if (!dm.aggregation) {
        dm.aggregation = 'sum'
      }
      break

    case 'scatter':
      // Scatter charts don't need aggregation by default
      // Size and color are optional, no defaults needed
      break

    case 'pie':
      // Default aggregation to 'sum' for value field
      if (!dm.aggregation && dm.value) {
        dm.aggregation = 'sum'
      }
      break

    case 'scorecard':
      // Default aggregation to 'sum'
      if (!dm.aggregation && dm.metric) {
        dm.aggregation = 'sum'
      }
      break

    case 'waterfall':
      // Default aggregation to 'sum'
      if (!dm.aggregation && dm.value) {
        dm.aggregation = 'sum'
      }
      break

    case 'heatmap':
      // Default aggregation to 'avg' for intensity
      if (!dm.aggregation && dm.value) {
        dm.aggregation = 'avg'
      }
      break

    case 'gauge':
      // Default aggregation to 'sum' for metric
      if (!dm.aggregation && dm.metric) {
        dm.aggregation = 'sum'
      }
      break

    case 'cohort':
      // Default aggregation to 'avg' for retention
      if (!dm.aggregation && dm.retention) {
        dm.aggregation = 'avg'
      }
      break

    case 'bullet':
      // Default aggregation to 'sum'
      if (!dm.aggregation && dm.actual) {
        dm.aggregation = 'sum'
      }
      break

    case 'treemap':
      // Default aggregation to 'sum'
      if (!dm.aggregation && dm.value) {
        dm.aggregation = 'sum'
      }
      break

    case 'sankey':
      // Default aggregation to 'sum' for flow
      if (!dm.aggregation && dm.flow) {
        dm.aggregation = 'sum'
      }
      break

    case 'sparkline':
      // Default aggregation to 'sum'
      if (!dm.aggregation && dm.yAxis) {
        dm.aggregation = 'sum'
      }
      break

    case 'table':
      // Tables don't need defaults
      break
  }

  // Infer missing data mappings if possible
  if (Object.keys(dm).length <= 1) { // Only aggregation or empty
    const inferred = inferDataMapping(config.type, schema)
    // Merge inferred mappings (don't override existing)
    Object.keys(inferred).forEach(key => {
      if (!(key in dm)) {
        (dm as any)[key] = (inferred as any)[key]
      }
    })
  }
}

/**
 * Infers data mapping based on chart type and schema
 *
 * @param chartType - Type of chart
 * @param schema - Data schema
 * @returns Inferred data mapping
 */
export function inferDataMapping(chartType: ChartType, schema: DataSchema): DataMapping {
  const dataMapping: DataMapping = {}

  // Get column types
  const numericColumns = schema.columns.filter(c => c.type === 'number').map(c => c.name)
  const dateColumns = schema.columns.filter(c => c.type === 'date').map(c => c.name)
  const categoricalColumns = schema.columns.filter(c =>
    c.type === 'string' || c.type === 'categorical'
  ).map(c => c.name)

  switch (chartType) {
    case 'bar':
      // Bar: category + values
      if (categoricalColumns.length > 0) {
        dataMapping.category = categoricalColumns[0]
      }
      if (numericColumns.length > 0) {
        dataMapping.values = [numericColumns[0]]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'line':
    case 'area':
      // Line/Area: xAxis (date or category) + yAxis (numeric)
      if (dateColumns.length > 0) {
        dataMapping.xAxis = dateColumns[0]
      } else if (categoricalColumns.length > 0) {
        dataMapping.xAxis = categoricalColumns[0]
      }
      if (numericColumns.length > 0) {
        dataMapping.yAxis = [numericColumns[0]]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'combo':
      // Combo: xAxis + yAxis1 + yAxis2
      if (dateColumns.length > 0) {
        dataMapping.xAxis = dateColumns[0]
      } else if (categoricalColumns.length > 0) {
        dataMapping.xAxis = categoricalColumns[0]
      }
      if (numericColumns.length >= 2) {
        dataMapping.yAxis1 = [numericColumns[0]]
        dataMapping.yAxis2 = [numericColumns[1]]
      } else if (numericColumns.length === 1) {
        dataMapping.yAxis1 = [numericColumns[0]]
      }
      dataMapping.yAxis1Type = 'bar'
      dataMapping.yAxis2Type = 'line'
      dataMapping.aggregation = 'sum'
      break

    case 'pie':
      // Pie: category + value
      if (categoricalColumns.length > 0) {
        dataMapping.category = categoricalColumns[0]
      }
      if (numericColumns.length > 0) {
        dataMapping.value = numericColumns[0]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'scatter':
      // Scatter: xAxis (numeric) + yAxis (numeric)
      if (numericColumns.length >= 2) {
        dataMapping.xAxis = numericColumns[0]
        dataMapping.yAxis = numericColumns[1]
      }
      // Size and color are optional
      if (numericColumns.length >= 3) {
        dataMapping.size = numericColumns[2]
      }
      if (categoricalColumns.length > 0) {
        dataMapping.color = categoricalColumns[0]
      }
      break

    case 'scorecard':
      // Scorecard: metric
      if (numericColumns.length > 0) {
        dataMapping.metric = numericColumns[0]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'table':
      // Table: all columns (limit to first 10)
      dataMapping.columns = [...categoricalColumns, ...numericColumns, ...dateColumns].slice(0, 10)
      break

    case 'waterfall':
      // Waterfall: category + value
      if (categoricalColumns.length > 0) {
        dataMapping.category = categoricalColumns[0]
      }
      if (numericColumns.length > 0) {
        dataMapping.value = numericColumns[0]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'heatmap':
      // Heatmap: xAxis + yAxis + value
      if (categoricalColumns.length >= 2) {
        dataMapping.xAxis = categoricalColumns[0]
        dataMapping.yAxis = categoricalColumns[1]
      }
      if (numericColumns.length > 0) {
        dataMapping.value = numericColumns[0]
      }
      dataMapping.aggregation = 'avg'
      break

    case 'gauge':
      // Gauge: metric
      if (numericColumns.length > 0) {
        dataMapping.metric = numericColumns[0]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'cohort':
      // Cohort: cohort + period + retention
      if (dateColumns.length > 0) {
        dataMapping.cohort = dateColumns[0]
      }
      if (categoricalColumns.length > 0) {
        dataMapping.period = categoricalColumns[0]
      }
      if (numericColumns.length > 0) {
        dataMapping.retention = numericColumns[0]
      }
      dataMapping.aggregation = 'avg'
      break

    case 'bullet':
      // Bullet: actual (+ optional target)
      if (numericColumns.length > 0) {
        dataMapping.actual = numericColumns[0]
      }
      if (numericColumns.length > 1) {
        dataMapping.target = numericColumns[1]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'treemap':
      // Treemap: category + value
      if (categoricalColumns.length > 0) {
        dataMapping.category = categoricalColumns[0]
      }
      if (numericColumns.length > 0) {
        dataMapping.value = numericColumns[0]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'sankey':
      // Sankey: source + target + flow
      if (categoricalColumns.length >= 2) {
        dataMapping.source = categoricalColumns[0]
        dataMapping.target_node = categoricalColumns[1]
      }
      if (numericColumns.length > 0) {
        dataMapping.flow = numericColumns[0]
      }
      dataMapping.aggregation = 'sum'
      break

    case 'sparkline':
      // Sparkline: xAxis + yAxis
      if (dateColumns.length > 0) {
        dataMapping.xAxis = dateColumns[0]
      } else if (categoricalColumns.length > 0) {
        dataMapping.xAxis = categoricalColumns[0]
      }
      if (numericColumns.length > 0) {
        dataMapping.yAxis = numericColumns[0]
      }
      dataMapping.aggregation = 'sum'
      break
  }

  return dataMapping
}

/**
 * Migrates legacy xAxis/yAxis/dataKey format to new dataMapping format
 *
 * @param config - Chart configuration with legacy format
 * @returns DataMapping object
 */
export function migrateLegacyFormat(config: HydratableChartConfig): DataMapping {
  const dataMapping: DataMapping = {}

  // Get data from legacy fields
  const xAxis = config.xAxis
  const yAxis = config.yAxis
  const dataKey = config.dataKey ? (Array.isArray(config.dataKey) ? config.dataKey : [config.dataKey]) : []

  // Migrate based on chart type
  switch (config.type) {
    case 'bar':
      // Bar: category + values
      if (xAxis) {
        dataMapping.category = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.category = dataKey[0]
      }

      if (yAxis) {
        dataMapping.values = Array.isArray(yAxis) ? yAxis : [yAxis]
      } else if (dataKey.length > 1) {
        dataMapping.values = dataKey.slice(1)
      }
      break

    case 'line':
    case 'area':
      // Line/Area: xAxis + yAxis
      if (xAxis) {
        dataMapping.xAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.xAxis = dataKey[0]
      }

      if (yAxis) {
        dataMapping.yAxis = yAxis
      } else if (dataKey.length > 1) {
        dataMapping.yAxis = dataKey.slice(1)
      } else if (dataKey.length === 1) {
        dataMapping.yAxis = dataKey[0]
      }
      break

    case 'combo':
      // Combo: xAxis + yAxis1 + yAxis2
      if (xAxis) {
        dataMapping.xAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.xAxis = dataKey[0]
      }

      if (yAxis) {
        const yAxisArray = Array.isArray(yAxis) ? yAxis : [yAxis]
        dataMapping.yAxis1 = yAxisArray.length > 0 ? [yAxisArray[0]] : []
        dataMapping.yAxis2 = yAxisArray.length > 1 ? [yAxisArray[1]] : []
      } else if (dataKey.length > 1) {
        dataMapping.yAxis1 = [dataKey[1]]
        if (dataKey.length > 2) {
          dataMapping.yAxis2 = [dataKey[2]]
        }
      }
      break

    case 'pie':
      // Pie: category + value
      if (xAxis) {
        dataMapping.category = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.category = dataKey[0]
      }

      if (yAxis) {
        dataMapping.value = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 1) {
        dataMapping.value = dataKey[1]
      }
      break

    case 'scorecard':
      // Scorecard: metric
      if (yAxis) {
        dataMapping.metric = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 0) {
        dataMapping.metric = dataKey[0]
      }
      break

    case 'scatter':
      // Scatter: xAxis + yAxis + optional size/color
      if (xAxis) {
        dataMapping.xAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.xAxis = dataKey[0]
      }

      if (yAxis) {
        dataMapping.yAxis = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 1) {
        dataMapping.yAxis = dataKey[1]
      }

      // Check for size/color in dataKey
      if (dataKey.length > 2) {
        dataMapping.size = dataKey[2]
      }
      if (dataKey.length > 3) {
        dataMapping.color = dataKey[3]
      }
      break

    case 'table':
      // Table: columns
      if (yAxis) {
        dataMapping.columns = Array.isArray(yAxis) ? yAxis : [yAxis]
      } else if (dataKey.length > 0) {
        dataMapping.columns = dataKey
      }
      break

    case 'waterfall':
    case 'treemap':
      // Similar to bar: category + value
      if (xAxis) {
        dataMapping.category = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.category = dataKey[0]
      }

      if (yAxis) {
        dataMapping.value = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 1) {
        dataMapping.value = dataKey[1]
      }
      break

    case 'heatmap':
      // Heatmap: xAxis + yAxis + value
      if (xAxis) {
        dataMapping.xAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis
      } else if (dataKey.length > 0) {
        dataMapping.xAxis = dataKey[0]
      }

      if (yAxis) {
        const yAxisArray = Array.isArray(yAxis) ? yAxis : [yAxis]
        dataMapping.yAxis = yAxisArray.length > 0 ? yAxisArray[0] : undefined
        if (yAxisArray.length > 1) {
          dataMapping.value = yAxisArray[1]
        }
      } else if (dataKey.length > 1) {
        dataMapping.yAxis = dataKey[1]
        if (dataKey.length > 2) {
          dataMapping.value = dataKey[2]
        }
      }
      break

    case 'gauge':
    case 'bullet':
      // Gauge/Bullet: metric/actual
      if (yAxis) {
        const field = config.type === 'gauge' ? 'metric' : 'actual'
        dataMapping[field] = Array.isArray(yAxis) ? yAxis[0] : yAxis
      } else if (dataKey.length > 0) {
        const field = config.type === 'gauge' ? 'metric' : 'actual'
        dataMapping[field] = dataKey[0]
      }
      break

    default:
      // For unknown types, just copy what we have
      if (xAxis) {
        dataMapping.xAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis
      }
      if (yAxis) {
        dataMapping.yAxis = yAxis
      }
      break
  }

  // Copy aggregation if present
  if (config.aggregation) {
    dataMapping.aggregation = config.aggregation as any
  }

  return dataMapping
}

/**
 * Batch hydrates multiple chart configurations
 *
 * @param configs - Array of chart configurations
 * @param schema - Data schema
 * @returns Array of hydrated chart configurations
 */
export function hydrateChartConfigs(
  configs: HydratableChartConfig[],
  schema: DataSchema
): HydratableChartConfig[] {
  return configs.map(config => hydrateChartConfig(config, schema))
}
