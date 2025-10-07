/**
 * Chart Fallback Generation Utility
 *
 * Generates deterministic fallback charts when LLM output is insufficient.
 * Prioritizes scorecards, bar charts, and tables while avoiding duplicates.
 */

import type { ChartType, ColumnSchema, DataRow, DataSchema } from '@/lib/store'
import type { ChartRecommendation } from '@/lib/types/recommendation'

/**
 * Chart configuration interface for fallback generation
 */
export interface ChartConfig {
  id: string
  type: ChartType
  title: string
  description: string
  dataMapping?: {
    category?: string
    value?: string
    values?: string[]
    xAxis?: string
    yAxis?: string | string[]
    metric?: string
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
    columns?: string[]
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    limit?: number
  }
  confidence?: number
  reasoning?: string
}

/**
 * Column usage tracking
 */
interface ColumnUsage {
  column: string
  chartTypes: Set<ChartType>
  usageCount: number
}

/**
 * Fallback generation options
 */
interface FallbackOptions {
  maxScorecards?: number
  includeTable?: boolean
  preferUnusedColumns?: boolean
}

/**
 * Check if a chart uses a specific column
 */
export function usesColumn(chart: ChartConfig | ChartRecommendation, columnName: string): boolean {
  if (!chart.dataMapping) return false

  const mapping = chart.dataMapping

  // Check all possible mapping fields
  const fieldsToCheck = [
    mapping.category,
    mapping.value,
    mapping.xAxis,
    mapping.metric,
    mapping.sortBy,
    ...(Array.isArray(mapping.values) ? mapping.values : []),
    ...(Array.isArray(mapping.yAxis) ? mapping.yAxis : [mapping.yAxis]),
    ...(Array.isArray(mapping.columns) ? mapping.columns : []),
  ]

  return fieldsToCheck.some((field) => field === columnName)
}

/**
 * Track column usage across charts
 */
function analyzeColumnUsage(existingCharts: ChartConfig[]): Map<string, ColumnUsage> {
  const usageMap = new Map<string, ColumnUsage>()

  existingCharts.forEach((chart) => {
    const columns = extractColumnsFromChart(chart)
    columns.forEach((column) => {
      if (!usageMap.has(column)) {
        usageMap.set(column, {
          column,
          chartTypes: new Set(),
          usageCount: 0,
        })
      }

      const usage = usageMap.get(column)!
      usage.chartTypes.add(chart.type)
      usage.usageCount++
    })
  })

  return usageMap
}

/**
 * Extract all columns used in a chart
 */
function extractColumnsFromChart(chart: ChartConfig): string[] {
  const columns: string[] = []
  const mapping = chart.dataMapping

  if (!mapping) return columns

  // Add all column references
  if (mapping.category) columns.push(mapping.category)
  if (mapping.value) columns.push(mapping.value)
  if (mapping.xAxis) columns.push(mapping.xAxis)
  if (mapping.metric) columns.push(mapping.metric)
  if (mapping.sortBy) columns.push(mapping.sortBy)

  if (Array.isArray(mapping.values)) {
    columns.push(...mapping.values)
  }

  if (Array.isArray(mapping.yAxis)) {
    columns.push(...mapping.yAxis)
  } else if (mapping.yAxis) {
    columns.push(mapping.yAxis)
  }

  if (Array.isArray(mapping.columns)) {
    columns.push(...mapping.columns)
  }

  return [...new Set(columns)] // Remove duplicates
}

/**
 * Check if a chart combination already exists
 */
function isDuplicateChart(
  newChart: ChartConfig,
  existingCharts: ChartConfig[]
): boolean {
  return existingCharts.some((existing) => {
    // Same chart type
    if (existing.type !== newChart.type) return false

    // Compare column usage
    const existingColumns = new Set(extractColumnsFromChart(existing))
    const newColumns = new Set(extractColumnsFromChart(newChart))

    // If all columns are the same, it's a duplicate
    if (existingColumns.size === newColumns.size) {
      const allMatch = [...newColumns].every((col) => existingColumns.has(col))
      if (allMatch) return true
    }

    return false
  })
}

/**
 * Get numeric columns suitable for scorecards
 */
function getNumericColumns(schema: DataSchema): ColumnSchema[] {
  return schema.columns.filter(
    (col) =>
      col.type === 'number' &&
      col.nullPercentage < 50 && // Less than 50% null
      (col.stats?.avg ?? 0) !== 0 // Has meaningful values
  )
}

/**
 * Get categorical columns suitable for grouping
 */
function getCategoricalColumns(schema: DataSchema): ColumnSchema[] {
  return schema.columns.filter(
    (col) =>
      (col.type === 'string' || col.type === 'categorical') &&
      col.uniqueValues > 1 &&
      col.uniqueValues < schema.rowCount * 0.5 && // Less than 50% unique
      col.nullPercentage < 30 // Less than 30% null
  )
}

/**
 * Generate a scorecard chart
 */
function generateScorecard(
  numericCol: ColumnSchema,
  schema: DataSchema,
  index: number
): ChartConfig {
  const metricName = formatColumnName(numericCol.name)

  return {
    id: `fallback-scorecard-${index}-${Date.now()}`,
    type: 'scorecard',
    title: `Total ${metricName}`,
    description: `Sum of all ${metricName.toLowerCase()} values`,
    dataMapping: {
      metric: numericCol.name,
      aggregation: 'sum',
    },
    confidence: 0.7,
    reasoning: 'Fallback: Numeric column suitable for KPI tracking',
  }
}

/**
 * Generate a bar chart
 */
function generateBarChart(
  categoryCol: ColumnSchema,
  numericCol: ColumnSchema,
  schema: DataSchema,
  index: number
): ChartConfig {
  const categoryName = formatColumnName(categoryCol.name)
  const metricName = formatColumnName(numericCol.name)

  return {
    id: `fallback-bar-${index}-${Date.now()}`,
    type: 'bar',
    title: `${metricName} by ${categoryName}`,
    description: `Top 10 ${categoryName.toLowerCase()} by ${metricName.toLowerCase()}`,
    dataMapping: {
      category: categoryCol.name,
      values: [numericCol.name],
      aggregation: 'sum',
      sortBy: numericCol.name,
      sortOrder: 'desc',
      limit: 10,
    },
    confidence: 0.7,
    reasoning: 'Fallback: Category vs numeric comparison',
  }
}

/**
 * Generate a comprehensive table chart
 */
function generateTable(schema: DataSchema, index: number): ChartConfig {
  // Include up to 10 most relevant columns
  const relevantColumns = schema.columns
    .filter((col) => col.nullPercentage < 50)
    .slice(0, 10)
    .map((col) => col.name)

  return {
    id: `fallback-table-${index}-${Date.now()}`,
    type: 'table',
    title: 'Data Overview',
    description: 'Comprehensive view of all data',
    dataMapping: {
      columns: relevantColumns,
    },
    confidence: 0.9,
    reasoning: 'Fallback: Comprehensive data table',
  }
}

/**
 * Format column name for display
 */
function formatColumnName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Infer missing chart types needed to reach target count
 */
export function inferMissingTypes(
  existingCharts: ChartConfig[],
  targetCount: number
): ChartType[] {
  const currentTypes = new Map<ChartType, number>()

  // Count existing types
  existingCharts.forEach((chart) => {
    currentTypes.set(chart.type, (currentTypes.get(chart.type) || 0) + 1)
  })

  const missing: ChartType[] = []
  const remaining = targetCount - existingCharts.length

  if (remaining <= 0) return missing

  // Priority order for fallbacks
  const priorities: Array<{ type: ChartType; maxCount: number }> = [
    { type: 'scorecard', maxCount: 6 },
    { type: 'bar', maxCount: 3 },
    { type: 'table', maxCount: 1 },
    { type: 'line', maxCount: 2 },
    { type: 'pie', maxCount: 2 },
  ]

  for (const { type, maxCount } of priorities) {
    const currentCount = currentTypes.get(type) || 0
    const canAdd = Math.min(maxCount - currentCount, remaining - missing.length)

    for (let i = 0; i < canAdd; i++) {
      missing.push(type)
    }

    if (missing.length >= remaining) break
  }

  return missing
}

/**
 * Generate deterministic fallback charts
 *
 * Priority 1: Scorecards for numeric columns (sum aggregation)
 * Priority 2: Bar charts (category vs numeric, top 10)
 * Priority 3: Table chart (comprehensive data view)
 */
export function generateFallbackCharts(
  schema: DataSchema,
  data: DataRow[],
  count: number,
  existingCharts: ChartConfig[] = [],
  options: FallbackOptions = {}
): ChartConfig[] {
  const {
    maxScorecards = 6,
    includeTable = true,
    preferUnusedColumns = true,
  } = options

  const fallbacks: ChartConfig[] = []
  const usageMap = analyzeColumnUsage(existingCharts)

  // Get available columns
  const numericCols = getNumericColumns(schema)
  const categoricalCols = getCategoricalColumns(schema)

  // Sort columns by usage (prefer unused)
  if (preferUnusedColumns) {
    numericCols.sort((a, b) => {
      const aUsage = usageMap.get(a.name)?.usageCount || 0
      const bUsage = usageMap.get(b.name)?.usageCount || 0
      return aUsage - bUsage
    })

    categoricalCols.sort((a, b) => {
      const aUsage = usageMap.get(a.name)?.usageCount || 0
      const bUsage = usageMap.get(b.name)?.usageCount || 0
      return aUsage - bUsage
    })
  }

  // Track how many of each type we've generated
  const scorecardCount = existingCharts.filter((c) => c.type === 'scorecard').length
  const tableCount = existingCharts.filter((c) => c.type === 'table').length

  let generatedCount = 0

  // Priority 1: Generate scorecards (up to limit)
  for (const numericCol of numericCols) {
    if (generatedCount >= count) break
    if (scorecardCount + fallbacks.filter((c) => c.type === 'scorecard').length >= maxScorecards) {
      break
    }

    const scorecard = generateScorecard(numericCol, schema, fallbacks.length)

    if (!isDuplicateChart(scorecard, [...existingCharts, ...fallbacks])) {
      fallbacks.push(scorecard)
      generatedCount++
    }
  }

  // Priority 2: Generate bar charts
  for (const categoryCol of categoricalCols) {
    if (generatedCount >= count) break

    for (const numericCol of numericCols) {
      if (generatedCount >= count) break

      const barChart = generateBarChart(
        categoryCol,
        numericCol,
        schema,
        fallbacks.length
      )

      if (!isDuplicateChart(barChart, [...existingCharts, ...fallbacks])) {
        fallbacks.push(barChart)
        generatedCount++
        break // Only one bar chart per category
      }
    }
  }

  // Priority 3: Add table chart if requested and needed
  if (includeTable && generatedCount < count && tableCount === 0) {
    const table = generateTable(schema, fallbacks.length)

    if (!isDuplicateChart(table, [...existingCharts, ...fallbacks])) {
      fallbacks.push(table)
      generatedCount++
    }
  }

  // If still not enough, generate additional scorecards or bar charts
  while (generatedCount < count) {
    const numericIndex = generatedCount % numericCols.length
    const categoryIndex = generatedCount % categoricalCols.length

    if (numericCols.length > 0 && categoricalCols.length > 0) {
      // Alternate between scorecards and bar charts
      if (generatedCount % 2 === 0 && scorecardCount + fallbacks.filter((c) => c.type === 'scorecard').length < maxScorecards) {
        const scorecard = generateScorecard(
          numericCols[numericIndex],
          schema,
          fallbacks.length
        )
        if (!isDuplicateChart(scorecard, [...existingCharts, ...fallbacks])) {
          fallbacks.push(scorecard)
          generatedCount++
        } else {
          break // Avoid infinite loop
        }
      } else {
        const barChart = generateBarChart(
          categoricalCols[categoryIndex],
          numericCols[numericIndex],
          schema,
          fallbacks.length
        )
        if (!isDuplicateChart(barChart, [...existingCharts, ...fallbacks])) {
          fallbacks.push(barChart)
          generatedCount++
        } else {
          break // Avoid infinite loop
        }
      }
    } else {
      // Can't generate more charts
      break
    }
  }

  return fallbacks
}

/**
 * Validate and enrich existing charts with fallback logic
 */
export function enrichChartsWithFallbacks(
  existingCharts: ChartConfig[],
  schema: DataSchema,
  data: DataRow[],
  minCount: number = 5
): ChartConfig[] {
  if (existingCharts.length >= minCount) {
    return existingCharts
  }

  const needed = minCount - existingCharts.length
  const fallbacks = generateFallbackCharts(schema, data, needed, existingCharts)

  return [...existingCharts, ...fallbacks]
}

/**
 * Get column statistics for smart fallback generation
 */
export function getColumnStatistics(
  data: DataRow[],
  columnName: string
): {
  type: 'numeric' | 'categorical' | 'date' | 'unknown'
  uniqueCount: number
  nullCount: number
  sampleValues: any[]
  stats?: {
    min?: number
    max?: number
    avg?: number
    sum?: number
  }
} {
  if (data.length === 0) {
    return {
      type: 'unknown',
      uniqueCount: 0,
      nullCount: 0,
      sampleValues: [],
    }
  }

  const values = data.map((row) => row[columnName])
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '')
  const uniqueValues = new Set(nonNullValues)

  // Determine type
  let type: 'numeric' | 'categorical' | 'date' | 'unknown' = 'unknown'
  const numericValues = nonNullValues
    .map((v) => Number(v))
    .filter((v) => !isNaN(v))

  if (numericValues.length > nonNullValues.length * 0.8) {
    type = 'numeric'
  } else if (nonNullValues.some((v) => v instanceof Date || !isNaN(Date.parse(String(v))))) {
    type = 'date'
  } else {
    type = 'categorical'
  }

  const stats =
    type === 'numeric' && numericValues.length > 0
      ? {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          sum: numericValues.reduce((a, b) => a + b, 0),
        }
      : undefined

  return {
    type,
    uniqueCount: uniqueValues.size,
    nullCount: values.length - nonNullValues.length,
    sampleValues: Array.from(uniqueValues).slice(0, 10),
    stats,
  }
}
