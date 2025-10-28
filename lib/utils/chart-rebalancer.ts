/**
 * Chart Rebalancer Utility
 *
 * Enforces exactly 16 charts with layout constraints:
 * - Positions 1-6: Scorecards (sorted by quality)
 * - Positions 7-15: Visualizations (sorted by quality)
 * - Position 16: Table (must be last)
 *
 * Handles edge cases like missing tables, too many/few scorecards, etc.
 */

import type { ChartType } from '@/lib/store'

export interface ChartConfig {
  id?: string
  type: ChartType
  title: string
  description: string
  dataMapping?: Record<string, any>
  dataKey?: string[]
  xAxis?: string | string[]
  yAxis?: string | string[]
  aggregation?: string
  confidence?: number
  reasoning?: string
  qualityScore?: number
  qualityFactors?: any
}

export interface RebalanceOptions {
  targetCount?: number
  minScorecards?: number
  maxScorecards?: number
  preferredScorecards?: number
  minNonScorecards?: number  // NEW: Minimum non-scorecard charts required (visualizations + tables)
  requireTable?: boolean
  fallbackChartType?: ChartType
}

const DEFAULT_OPTIONS: Required<RebalanceOptions> = {
  targetCount: 16,
  minScorecards: 4,
  maxScorecards: 6,
  preferredScorecards: 6,
  minNonScorecards: 8,  // NEW: Default minimum non-scorecard charts
  requireTable: true,
  fallbackChartType: 'table'
}

/**
 * Gets the quality score from a chart config
 */
function getQualityScore(chart: ChartConfig): number {
  return chart.qualityScore ?? chart.confidence ?? 0
}

/**
 * Sorts charts by quality score (descending)
 */
function sortByQuality(charts: ChartConfig[]): ChartConfig[] {
  return [...charts].sort((a, b) => getQualityScore(b) - getQualityScore(a))
}

/**
 * Creates a fallback table chart from available data columns
 */
function createFallbackTable(existingCharts: ChartConfig[]): ChartConfig {
  // Extract all unique columns from existing charts
  const allColumns = new Set<string>()

  existingCharts.forEach(chart => {
    if (chart.dataMapping) {
      Object.values(chart.dataMapping).forEach(value => {
        if (typeof value === 'string') allColumns.add(value)
        else if (Array.isArray(value)) value.forEach(v => typeof v === 'string' && allColumns.add(v))
      })
    }
    if (chart.dataKey) {
      chart.dataKey.forEach(key => allColumns.add(key))
    }
  })

  const columns = Array.from(allColumns).slice(0, 10) // Limit to 10 columns

  return {
    id: `fallback-table-${Date.now()}`,
    type: 'table',
    title: 'Complete Data Overview',
    description: 'Comprehensive view of all data for detailed analysis',
    dataMapping: {
      columns: columns.length > 0 ? columns : undefined,
      limit: 100
    },
    confidence: 70,
    qualityScore: 70,
    reasoning: 'Fallback table generated to ensure complete data visibility'
  }
}

/**
 * Creates a fallback visualization chart from existing data
 */
function createFallbackVisualization(existingCharts: ChartConfig[], index: number): ChartConfig | null {
  // Try to find suitable columns for a bar chart
  let categoryColumn: string | undefined
  let valueColumn: string | undefined

  for (const chart of existingCharts) {
    // Look for category columns
    if (!categoryColumn && chart.dataMapping?.category) {
      categoryColumn = chart.dataMapping.category
    }
    if (!categoryColumn && chart.dataMapping?.xAxis && typeof chart.dataMapping.xAxis === 'string') {
      categoryColumn = chart.dataMapping.xAxis
    }

    // Look for value columns
    if (!valueColumn && chart.dataMapping?.values?.[0]) {
      valueColumn = chart.dataMapping.values[0]
    }
    if (!valueColumn && chart.dataMapping?.yAxis && typeof chart.dataMapping.yAxis === 'string') {
      valueColumn = chart.dataMapping.yAxis
    }
    if (!valueColumn && Array.isArray(chart.dataMapping?.yAxis) && chart.dataMapping.yAxis.length > 0) {
      valueColumn = chart.dataMapping.yAxis[0]
    }

    if (categoryColumn && valueColumn) break
  }

  // If we still don't have both, return null
  if (!categoryColumn || !valueColumn) {
    console.warn('⚠️ [REBALANCER] Cannot create fallback visualization: missing category or value columns')
    return null
  }

  // Generate descriptive title based on actual columns
  const generateTitle = (cat: string, val: string, chartType: ChartType): string => {
    // Remove common suffixes and clean up column names
    const cleanCategory = cat.replace(/\s+(name|id|code|key)$/i, '').trim()
    const cleanValue = val.replace(/\s+(total|sum|count|amount|value)$/i, '').trim()

    switch (chartType) {
      case 'line':
        return `${cleanValue} Trend by ${cleanCategory}`
      case 'area':
        return `${cleanValue} Growth by ${cleanCategory}`
      case 'pie':
        return `${cleanValue} Distribution by ${cleanCategory}`
      case 'bar':
      default:
        return `${cleanValue} by ${cleanCategory}`
    }
  }

  // Generate descriptive description
  const generateDescription = (cat: string, val: string, chartType: ChartType): string => {
    switch (chartType) {
      case 'line':
        return `Shows how ${val} changes across different ${cat} over time`
      case 'area':
        return `Visualizes the cumulative ${val} growth across ${cat}`
      case 'pie':
        return `Displays the proportion of ${val} for each ${cat}`
      case 'bar':
      default:
        return `Compares ${val} across different ${cat}`
    }
  }

  const chartTypes: ChartType[] = ['bar', 'line', 'area', 'pie']
  const selectedType = chartTypes[index % chartTypes.length]

  return {
    id: `fallback-viz-${index}-${Date.now()}`,
    type: selectedType,
    title: generateTitle(categoryColumn, valueColumn, selectedType),
    description: generateDescription(categoryColumn, valueColumn, selectedType),
    dataMapping: {
      category: categoryColumn,
      values: [valueColumn],
      aggregation: 'sum'
    },
    confidence: 60,
    qualityScore: 60,
    reasoning: 'Additional visualization generated to meet minimum chart requirement'
  }
}

/**
 * Creates a fallback scorecard from existing visualizations
 */
function createFallbackScorecard(existingCharts: ChartConfig[], index: number): ChartConfig | null {
  // Try to find a numeric column from existing charts
  let metricColumn: string | undefined

  for (const chart of existingCharts) {
    if (chart.dataMapping?.values?.[0]) {
      metricColumn = chart.dataMapping.values[0]
      break
    }
    if (chart.dataMapping?.yAxis && typeof chart.dataMapping.yAxis === 'string') {
      metricColumn = chart.dataMapping.yAxis
      break
    }
    if (Array.isArray(chart.dataMapping?.yAxis) && chart.dataMapping.yAxis.length > 0) {
      metricColumn = chart.dataMapping.yAxis[0]
      break
    }
    if (chart.dataMapping?.metric) {
      metricColumn = chart.dataMapping.metric
      break
    }
  }

  // If we still don't have a metric, return null - we can't create a valid scorecard
  if (!metricColumn) {
    console.warn('⚠️ [REBALANCER] Cannot create fallback scorecard: no valid metric column found')
    return null
  }

  const metrics = ['Total Revenue', 'Total Sales', 'Average Value', 'Total Count', 'Performance Score', 'Growth Rate']

  return {
    id: `fallback-scorecard-${index}-${Date.now()}`,
    type: 'scorecard',
    title: metrics[index % metrics.length],
    description: `Key performance indicator ${index + 1}`,
    dataMapping: {
      metric: metricColumn,
      aggregation: 'sum'
    },
    confidence: 65,
    qualityScore: 65,
    reasoning: 'Fallback scorecard generated to meet minimum scorecard requirement'
  }
}

/**
 * Selects top N charts from an array, sorted by quality
 */
export function selectTopCharts(
  charts: ChartConfig[],
  count: number,
  constraints?: { minScore?: number; allowedTypes?: ChartType[] }
): ChartConfig[] {
  let filtered = charts

  // Apply type filter if specified
  if (constraints?.allowedTypes) {
    filtered = filtered.filter(chart => constraints.allowedTypes!.includes(chart.type))
  }

  // Apply minimum score filter if specified
  if (constraints?.minScore !== undefined) {
    filtered = filtered.filter(chart => getQualityScore(chart) >= constraints.minScore!)
  }

  // Sort by quality and take top N
  const sorted = sortByQuality(filtered)
  return sorted.slice(0, count)
}

/**
 * Enforces layout constraints on charts:
 * - Positions 1-6: Scorecards
 * - Positions 7-15: Visualizations
 * - Position 16: Table
 */
export function enforceLayoutConstraints(
  charts: ChartConfig[],
  options: RebalanceOptions = {}
): ChartConfig[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Separate charts by type
  const scorecards = charts.filter(c => c.type === 'scorecard')
  const tables = charts.filter(c => c.type === 'table')
  const visualizations = charts.filter(c => c.type !== 'scorecard' && c.type !== 'table')

  // Sort each category by quality
  const sortedScorecards = sortByQuality(scorecards)
  const sortedTables = sortByQuality(tables)
  const sortedVisualizations = sortByQuality(visualizations)

  // Select top scorecards (prefer 6, but respect min/max)
  let selectedScorecards = sortedScorecards.slice(0, opts.maxScorecards)

  // Ensure we have enough scorecards (pad if needed)
  while (selectedScorecards.length < opts.minScorecards) {
    const fallback = createFallbackScorecard(charts, selectedScorecards.length)
    if (fallback) {
      selectedScorecards.push(fallback)
    } else {
      // Can't create more scorecards, stop padding
      console.warn('⚠️ [REBALANCER] Cannot pad scorecards: no valid metrics available')
      break
    }
  }

  // Select table for position 16
  let selectedTable: ChartConfig
  if (sortedTables.length > 0) {
    selectedTable = sortedTables[0] // Use best table
  } else if (opts.requireTable) {
    selectedTable = createFallbackTable(charts)
  } else {
    // Use best remaining visualization as "table"
    selectedTable = sortedVisualizations[0] || createFallbackTable(charts)
  }

  // Calculate how many visualizations we need (positions 7-15)
  const visualizationSlots = opts.targetCount - selectedScorecards.length - 1 // -1 for table

  // Select top visualizations for remaining slots
  let selectedVisualizations = sortedVisualizations.slice(0, visualizationSlots)

  // NEW: Ensure we have enough non-scorecard charts (visualizations + table)
  // The table counts as 1 non-scorecard, so we need (minNonScorecards - 1) visualizations
  const minVisualizationsNeeded = opts.minNonScorecards - 1 // -1 because table counts as 1 non-scorecard

  if (selectedVisualizations.length < minVisualizationsNeeded) {
    const neededCount = minVisualizationsNeeded - selectedVisualizations.length
    console.log(`📊 [REBALANCER] Need ${neededCount} more visualizations to meet minNonScorecards=${opts.minNonScorecards}`)

    // Try to add more fallback visualizations
    for (let i = 0; i < neededCount; i++) {
      const fallbackViz = createFallbackVisualization([...charts, ...selectedScorecards, ...selectedVisualizations], i)
      if (fallbackViz) {
        selectedVisualizations.push(fallbackViz)
        console.log(`✅ [REBALANCER] Added fallback visualization: ${fallbackViz.title}`)
      } else {
        console.warn('⚠️ [REBALANCER] Cannot create more fallback visualizations')
        break
      }
    }
  }

  // Combine in correct order: scorecards → visualizations → table
  return [
    ...selectedScorecards,
    ...selectedVisualizations,
    selectedTable
  ]
}

/**
 * Validates that a chart configuration is complete and valid
 */
function isValidChart(chart: ChartConfig): boolean {
  // Check required fields
  if (!chart.type || !chart.title) {
    console.warn('⚠️ [REBALANCER] Chart missing required fields:', {
      type: chart.type,
      title: chart.title,
      hasType: !!chart.type,
      hasTitle: !!chart.title
    })
    return false
  }

  // Check if dataMapping exists and is not empty
  const hasDataMapping = !!(chart.dataMapping && Object.keys(chart.dataMapping).length > 0)

  // Check type-specific requirements
  switch (chart.type) {
    case 'scorecard':
      // Scorecard MUST have either a metric field OR a formula field in dataMapping
      const hasMetric = !!(hasDataMapping && chart.dataMapping?.metric)
      const hasFormula = !!(hasDataMapping && chart.dataMapping?.formula && chart.dataMapping?.formulaAlias)
      const isValidScorecard = hasMetric || hasFormula

      if (!isValidScorecard) {
        console.warn('⚠️ [REBALANCER] Scorecard missing metric or formula:', {
          title: chart.title,
          dataMapping: chart.dataMapping,
          hasDataMapping,
          metric: chart.dataMapping?.metric,
          formula: chart.dataMapping?.formula,
          formulaAlias: chart.dataMapping?.formulaAlias
        })
      }
      return isValidScorecard
    case 'table':
      const hasTableColumns = !!(hasDataMapping && (chart.dataMapping?.columns?.length || chart.dataMapping?.yAxis))
      if (!hasTableColumns) {
        console.warn('⚠️ [REBALANCER] Table missing columns:', {
          title: chart.title,
          dataMapping: chart.dataMapping
        })
      }
      return hasTableColumns
    case 'line':
    case 'bar':
    case 'area':
      const hasAxis = !!(hasDataMapping && (chart.dataMapping?.xAxis || chart.dataMapping?.category))
      if (!hasAxis) {
        console.warn('⚠️ [REBALANCER] Chart missing xAxis/category:', {
          title: chart.title,
          type: chart.type,
          dataMapping: chart.dataMapping
        })
      }
      return hasAxis
    case 'scatter':
      const hasScatterAxes = !!(hasDataMapping && chart.dataMapping?.xAxis && (chart.dataMapping?.yAxis || chart.dataMapping?.values))
      if (!hasScatterAxes) {
        console.warn('⚠️ [REBALANCER] Scatter missing axes:', {
          title: chart.title,
          dataMapping: chart.dataMapping
        })
      }
      return hasScatterAxes
    case 'pie':
      const hasPieCategory = !!(hasDataMapping && chart.dataMapping?.category)
      if (!hasPieCategory) {
        console.warn('⚠️ [REBALANCER] Pie chart missing category:', {
          title: chart.title,
          dataMapping: chart.dataMapping
        })
      }
      return hasPieCategory
    case 'combo':
      const hasComboAxes = !!(hasDataMapping && chart.dataMapping?.xAxis && (chart.dataMapping?.yAxis || chart.dataMapping?.yAxis1))
      if (!hasComboAxes) {
        console.warn('⚠️ [REBALANCER] Combo chart missing axes:', {
          title: chart.title,
          dataMapping: chart.dataMapping
        })
      }
      return hasComboAxes
    default:
      // For unknown types, require at least some dataMapping
      return hasDataMapping
  }
}

/**
 * Main rebalancing function - ensures exactly targetCount charts with constraints
 */
export function rebalanceCharts(
  charts: ChartConfig[],
  targetCount: number = 16,
  options: RebalanceOptions = {}
): ChartConfig[] {
  const opts = { ...DEFAULT_OPTIONS, targetCount, ...options }

  // Log input charts before validation
  console.log('📊 [REBALANCER] Input charts before validation:', {
    totalCharts: charts.length,
    scorecards: charts.filter(c => c.type === 'scorecard').length,
    scorecardTitles: charts.filter(c => c.type === 'scorecard').map(c => c.title),
    scorecardMappings: charts.filter(c => c.type === 'scorecard').map(c => ({
      title: c.title,
      hasDataMapping: !!c.dataMapping,
      dataMappingKeys: c.dataMapping ? Object.keys(c.dataMapping) : [],
      metric: c.dataMapping?.metric
    }))
  })

  // Filter out invalid charts before rebalancing
  const validCharts = charts.filter(chart => {
    const valid = isValidChart(chart)
    if (!valid) {
      console.warn('⚠️ [REBALANCER] Filtering out invalid chart:', {
        type: chart.type,
        title: chart.title,
        dataMapping: chart.dataMapping
      })
    }
    return valid
  })

  console.log('📊 [REBALANCER] Starting rebalance:', {
    inputCount: validCharts.length,
    filteredOut: charts.length - validCharts.length,
    targetCount: opts.targetCount,
    scorecards: validCharts.filter(c => c.type === 'scorecard').length,
    tables: validCharts.filter(c => c.type === 'table').length,
    visualizations: validCharts.filter(c => c.type !== 'scorecard' && c.type !== 'table').length
  })

  // Apply layout constraints
  const rebalanced = enforceLayoutConstraints(validCharts, opts)

  // Verify we have exactly the target count
  const finalCount = rebalanced.length
  if (finalCount !== opts.targetCount) {
    console.warn('⚠️ [REBALANCER] Chart count mismatch:', {
      expected: opts.targetCount,
      actual: finalCount,
      difference: finalCount - opts.targetCount
    })

    // Trim excess or pad shortfall
    if (finalCount > opts.targetCount) {
      // Remove lowest quality visualizations (keep scorecards and table)
      const scorecards = rebalanced.filter(c => c.type === 'scorecard')
      const table = rebalanced[rebalanced.length - 1] // Last item should be table
      const visualizations = rebalanced.filter(c => c.type !== 'scorecard' && c !== table)

      const visualizationsToKeep = opts.targetCount - scorecards.length - 1
      const trimmedVisualizations = sortByQuality(visualizations).slice(0, visualizationsToKeep)

      return [...scorecards, ...trimmedVisualizations, table]
    } else {
      // Pad with fallback scorecards
      const padding: ChartConfig[] = []
      for (let i = finalCount; i < opts.targetCount; i++) {
        const fallback = createFallbackScorecard(rebalanced, i)
        if (fallback) {
          padding.push(fallback)
        } else {
          console.warn('⚠️ [REBALANCER] Padding stopped: could not create fallback scorecard')
          break
        }
      }
      // Only add padding if we got some valid fallbacks
      if (padding.length > 0) {
        return [...rebalanced.slice(0, -1), ...padding, rebalanced[rebalanced.length - 1]]
      }
      // If we couldn't create any fallbacks, return as-is (will be short of target)
      return rebalanced
    }
  }

  console.log('✅ [REBALANCER] Rebalance complete:', {
    finalCount: rebalanced.length,
    scorecards: rebalanced.filter(c => c.type === 'scorecard').length,
    visualizations: rebalanced.filter(c => c.type !== 'scorecard' && c.type !== 'table').length,
    tables: rebalanced.filter(c => c.type === 'table').length,
    positions: {
      scorecardsEnd: rebalanced.findIndex(c => c.type !== 'scorecard'),
      tablePosition: rebalanced.findIndex((c, i) => c.type === 'table' && i === rebalanced.length - 1) + 1
    }
  })

  return rebalanced
}

/**
 * Validates that chart array meets layout requirements
 */
export function validateChartLayout(
  charts: ChartConfig[],
  options: RebalanceOptions = {}
): { valid: boolean; errors: string[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const errors: string[] = []

  // Check total count
  if (charts.length !== opts.targetCount) {
    errors.push(`Expected ${opts.targetCount} charts, got ${charts.length}`)
  }

  // Check scorecard count
  const scorecardCount = charts.filter(c => c.type === 'scorecard').length
  if (scorecardCount < opts.minScorecards) {
    errors.push(`Too few scorecards: ${scorecardCount} (min: ${opts.minScorecards})`)
  }
  if (scorecardCount > opts.maxScorecards) {
    errors.push(`Too many scorecards: ${scorecardCount} (max: ${opts.maxScorecards})`)
  }

  // Check table requirement
  const tableCount = charts.filter(c => c.type === 'table').length
  if (opts.requireTable && tableCount === 0) {
    errors.push('Missing required table chart')
  }

  // Check table position (should be last)
  if (charts.length > 0) {
    const lastChart = charts[charts.length - 1]
    if (opts.requireTable && lastChart.type !== 'table') {
      errors.push(`Last chart should be table, got ${lastChart.type}`)
    }
  }

  // Check scorecard positions (should be first)
  const firstNonScorecard = charts.findIndex(c => c.type !== 'scorecard')
  if (firstNonScorecard !== -1 && firstNonScorecard < scorecardCount) {
    errors.push('Scorecards should be positioned first')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Quick helper to get chart statistics
 */
export function getChartStats(charts: ChartConfig[]): {
  total: number
  scorecards: number
  visualizations: number
  tables: number
  averageQuality: number
  qualityDistribution: { high: number; medium: number; low: number }
} {
  const scorecards = charts.filter(c => c.type === 'scorecard')
  const tables = charts.filter(c => c.type === 'table')
  const visualizations = charts.filter(c => c.type !== 'scorecard' && c.type !== 'table')

  const scores = charts.map(getQualityScore)
  const avgQuality = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  return {
    total: charts.length,
    scorecards: scorecards.length,
    visualizations: visualizations.length,
    tables: tables.length,
    averageQuality: Math.round(avgQuality),
    qualityDistribution: {
      high: charts.filter(c => getQualityScore(c) > 75).length,
      medium: charts.filter(c => getQualityScore(c) >= 60 && getQualityScore(c) <= 75).length,
      low: charts.filter(c => getQualityScore(c) < 60).length
    }
  }
}
