/**
 * Recommendation Scoring Utility
 *
 * Calculates quality scores for chart recommendations based on multiple factors:
 * - Data type compatibility (40 points)
 * - Column confidence levels (30 points)
 * - User correction boost (20 points)
 * - Clarity and simplicity (10 points)
 *
 * Total possible score: 100 points
 */

import { ChartSuggestion } from '@/lib/types/chart-suggestion'
import { ColumnSchema, DataSchema, DataRow } from '@/lib/store'

/**
 * Extended chart recommendation with scoring data
 */
export interface ScoredRecommendation extends ChartSuggestion {
  qualityScore: number
  qualityFactors: {
    dataTypeMatch: number
    columnConfidence: number
    userCorrectionBoost: number
    clarityScore: number
  }
}

/**
 * User-corrected column information
 */
export interface CorrectedColumn {
  name: string
  originalType: string
  correctedType: string
  confidence: number
}

/**
 * Data profile containing schema and sample data
 */
export interface DataProfile {
  schema: DataSchema
  sampleData: DataRow[]
  totalRows: number
}

/**
 * Identifies if a column name suggests it's a KPI metric
 *
 * @example
 * isKPIColumn('Total Revenue') // true
 * isKPIColumn('ACOS') // true
 * isKPIColumn('Campaign Name') // false
 */
export function isKPIColumn(columnName: string): boolean {
  const kpiPatterns = [
    // Common metrics
    /^(total|sum|avg|average|count|max|maximum|min|minimum)/i,
    // Revenue/money
    /\b(revenue|sales|profit|cost|spend|budget|price|roas|acos)\b/i,
    // Performance metrics
    /\b(ctr|cvr|conversion|clicks?|impressions?|views?|engagement)\b/i,
    // Percentages
    /\b(rate|percentage|ratio|share)\b/i,
    // KPI keywords
    /\b(kpi|metric|indicator|target|goal)\b/i,
  ]

  return kpiPatterns.some(pattern => pattern.test(columnName))
}

/**
 * Checks if the schema has at least one time-based column
 *
 * @example
 * hasTimeColumn([{ name: 'date', type: 'date', ... }]) // true
 * hasTimeColumn([{ name: 'name', type: 'string', ... }]) // false
 */
export function hasTimeColumn(columns: ColumnSchema[]): boolean {
  return columns.some(col =>
    col.type === 'date' ||
    /\b(date|time|day|month|year|timestamp|created|updated)\b/i.test(col.name)
  )
}

/**
 * Checks if the schema has at least one categorical column
 *
 * @example
 * hasCategoricalColumn([{ name: 'category', type: 'categorical', ... }]) // true
 */
export function hasCategoricalColumn(columns: ColumnSchema[]): boolean {
  return columns.some(col =>
    col.type === 'categorical' ||
    col.type === 'string' && col.uniqueValues < (col.sampleValues.length * 0.5)
  )
}

/**
 * Gets the confidence score for a specific column
 *
 * @returns Confidence value between 0-100, or 75 as default if not specified
 *
 * @example
 * getColumnConfidence('revenue', schema) // 95
 * getColumnConfidence('unknown_col', schema) // 75
 */
export function getColumnConfidence(columnName: string, schema: DataSchema): number {
  const column = schema.columns.find(col => col.name === columnName)
  if (!column) return 75 // Default confidence for missing columns

  // Use explicit confidence if available, otherwise calculate from data quality
  if (column.confidence !== undefined) {
    return column.confidence
  }

  // Calculate confidence based on data completeness
  const completeness = 100 - column.nullPercentage

  // Adjust based on detection clarity
  let confidence = completeness

  if (column.detectionReason?.includes('high confidence')) {
    confidence = Math.min(confidence + 10, 100)
  } else if (column.detectionReason?.includes('low confidence')) {
    confidence = Math.max(confidence - 10, 0)
  }

  return confidence
}

/**
 * Counts distinct categories in a categorical column (optimized for large datasets)
 *
 * @param columnName - The name of the column to analyze
 * @param data - The dataset (can analyze sample if large)
 * @param maxSampleSize - Maximum rows to sample (default 1000)
 *
 * @returns Number of unique categories found
 */
export function countCategories(
  columnName: string,
  data: DataRow[],
  maxSampleSize: number = 1000
): number {
  const sampleData = data.length > maxSampleSize
    ? data.slice(0, maxSampleSize)
    : data

  const uniqueValues = new Set(
    sampleData
      .map(row => row[columnName])
      .filter(val => val !== null && val !== undefined)
  )

  return uniqueValues.size
}

/**
 * Checks if a recommendation uses any user-corrected columns
 *
 * @example
 * usesUserCorrections(recommendation, [{ name: 'spend', ... }]) // true if recommendation uses 'spend'
 */
export function usesUserCorrections(
  recommendation: ChartSuggestion,
  correctedColumns?: CorrectedColumn[]
): boolean {
  if (!correctedColumns || correctedColumns.length === 0) {
    return false
  }

  const correctedNames = new Set(correctedColumns.map(col => col.name))

  // Check chartConfig for column usage
  const usedColumns: string[] = []

  if (recommendation.chartConfig.x) {
    usedColumns.push(recommendation.chartConfig.x)
  }

  if (recommendation.chartConfig.y) {
    if (Array.isArray(recommendation.chartConfig.y)) {
      usedColumns.push(...recommendation.chartConfig.y)
    } else {
      usedColumns.push(recommendation.chartConfig.y)
    }
  }

  if (recommendation.chartConfig.color) {
    usedColumns.push(recommendation.chartConfig.color)
  }

  if (recommendation.chartConfig.size) {
    usedColumns.push(recommendation.chartConfig.size)
  }

  // Check table columns
  if (recommendation.tableConfig) {
    usedColumns.push(...recommendation.tableConfig.columns.map(col => col.key))
  }

  // Check if any used column is in corrected columns
  return usedColumns.some(col => correctedNames.has(col))
}

/**
 * Calculates the number of corrected columns used in a recommendation
 */
export function countCorrectedColumnsUsed(
  recommendation: ChartSuggestion,
  correctedColumns?: CorrectedColumn[]
): number {
  if (!correctedColumns || correctedColumns.length === 0) {
    return 0
  }

  const correctedNames = new Set(correctedColumns.map(col => col.name))
  const usedColumns: string[] = []

  if (recommendation.chartConfig.x) {
    usedColumns.push(recommendation.chartConfig.x)
  }

  if (recommendation.chartConfig.y) {
    if (Array.isArray(recommendation.chartConfig.y)) {
      usedColumns.push(...recommendation.chartConfig.y)
    } else {
      usedColumns.push(recommendation.chartConfig.y)
    }
  }

  if (recommendation.chartConfig.color) {
    usedColumns.push(recommendation.chartConfig.color)
  }

  if (recommendation.chartConfig.size) {
    usedColumns.push(recommendation.chartConfig.size)
  }

  if (recommendation.tableConfig) {
    usedColumns.push(...recommendation.tableConfig.columns.map(col => col.key))
  }

  return usedColumns.filter(col => correctedNames.has(col)).length
}

/**
 * Calculates data type match score (40 points maximum)
 *
 * Scoring logic:
 * - Scorecard with KPI metric: 40 points
 * - Line chart with time column: 35 points
 * - Scatter with 2+ numeric columns: 35 points
 * - Bar chart with categorical data: 30 points
 * - Pie chart with categorical data (≤7 categories): 30 points
 * - Table with multiple dimensions: 25 points
 * - Default: 20 points
 *
 * @example
 * calculateDataTypeMatchScore('scorecard', dataProfile) // 40 if has KPI column
 */
export function calculateDataTypeMatchScore(
  recommendation: ChartSuggestion,
  dataProfile: DataProfile
): number {
  const { schema, sampleData } = dataProfile
  const chartType = recommendation.type

  // Get columns used in this recommendation
  const usedColumnNames = new Set<string>()

  if (recommendation.chartConfig.x) {
    usedColumnNames.add(recommendation.chartConfig.x)
  }

  if (recommendation.chartConfig.y) {
    if (Array.isArray(recommendation.chartConfig.y)) {
      recommendation.chartConfig.y.forEach(col => usedColumnNames.add(col))
    } else {
      usedColumnNames.add(recommendation.chartConfig.y)
    }
  }

  const usedColumns = schema.columns.filter(col => usedColumnNames.has(col.name))

  switch (chartType) {
    case 'scorecard': {
      // Check if using a KPI metric column
      const hasKPI = Array.from(usedColumnNames).some(name => isKPIColumn(name))
      const hasNumeric = usedColumns.some(col => col.type === 'number')

      let score = 20
      if (hasNumeric) score = 30
      if (hasKPI && hasNumeric) score = 40

      // Bonus points for diverse aggregations (not just sum)
      // This encourages generation of avg, min, max, count scorecards
      const aggregation = recommendation.dataTransform?.aggregations?.[0]?.function
      if (aggregation && ['avg', 'min', 'max', 'count'].includes(aggregation)) {
        score += 5
      }

      return Math.min(score, 40) // Cap at 40 to maintain scoring balance
    }

    case 'line': {
      // Check for time series data
      const hasTime = hasTimeColumn(usedColumns)
      const hasNumeric = usedColumns.some(col => col.type === 'number')

      if (hasTime && hasNumeric) return 35
      if (hasNumeric) return 25
      return 20
    }

    case 'scatter': {
      // Check for 2+ numeric columns
      const numericCount = usedColumns.filter(col => col.type === 'number').length

      if (numericCount >= 2) return 35
      if (numericCount >= 1) return 25
      return 15
    }

    case 'bar': {
      // Check for categorical + numeric
      const hasCategorical = hasCategoricalColumn(usedColumns)
      const hasNumeric = usedColumns.some(col => col.type === 'number')

      let score = 20
      if (hasCategorical && hasNumeric) score = 30
      else if (hasNumeric) score = 25

      // Bonus for Top/Bottom X charts
      const hasTopBottomX = recommendation.dataTransform?.aggregations?.some((agg: any) =>
        agg.sortBy && agg.limit
      )
      if (hasTopBottomX) {
        score += 5
      }

      return Math.min(score, 40)
    }

    case 'pie': {
      // Check for categorical with reasonable number of categories
      const categoricalCol = usedColumns.find(col =>
        col.type === 'categorical' || col.type === 'string'
      )

      if (categoricalCol) {
        const categoryCount = countCategories(categoricalCol.name, sampleData)

        if (categoryCount <= 7) return 30
        if (categoryCount <= 12) return 20
        return 10 // Too many categories for pie chart
      }

      return 15
    }

    case 'area': {
      // Similar to line chart
      const hasTime = hasTimeColumn(usedColumns)
      const hasNumeric = usedColumns.some(col => col.type === 'number')

      if (hasTime && hasNumeric) return 33
      if (hasNumeric) return 24
      return 18
    }

    case 'table': {
      // Tables are flexible, score based on column diversity
      const columnCount = usedColumns.length
      const hasMultipleTypes = new Set(usedColumns.map(col => col.type)).size > 1

      if (columnCount >= 3 && hasMultipleTypes) return 25
      if (columnCount >= 2) return 20
      return 15
    }

    default:
      return 20 // Default score for unknown chart types
  }
}

/**
 * Calculates column confidence score (30 points maximum)
 *
 * Scoring logic:
 * - Average confidence of all used columns (0-30 points)
 * - Bonus +5 points if all columns have >80% confidence
 *
 * @example
 * calculateColumnConfidenceScore(recommendation, schema) // 28 if avg 82% + all >80%
 */
export function calculateColumnConfidenceScore(
  recommendation: ChartSuggestion,
  schema: DataSchema
): number {
  // Get all columns used in the recommendation
  const usedColumnNames = new Set<string>()

  if (recommendation.chartConfig.x) {
    usedColumnNames.add(recommendation.chartConfig.x)
  }

  if (recommendation.chartConfig.y) {
    if (Array.isArray(recommendation.chartConfig.y)) {
      recommendation.chartConfig.y.forEach(col => usedColumnNames.add(col))
    } else {
      usedColumnNames.add(recommendation.chartConfig.y)
    }
  }

  if (recommendation.chartConfig.color) {
    usedColumnNames.add(recommendation.chartConfig.color)
  }

  if (recommendation.chartConfig.size) {
    usedColumnNames.add(recommendation.chartConfig.size)
  }

  if (recommendation.tableConfig) {
    recommendation.tableConfig.columns.forEach(col => usedColumnNames.add(col.key))
  }

  if (usedColumnNames.size === 0) {
    return 15 // Default score if no columns specified
  }

  // Calculate average confidence
  const confidences = Array.from(usedColumnNames).map(name =>
    getColumnConfidence(name, schema)
  )

  const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length

  // Base score (0-30 based on average)
  let score = (avgConfidence / 100) * 30

  // Bonus for all columns having high confidence
  const allHighConfidence = confidences.every(conf => conf > 80)
  if (allHighConfidence) {
    score += 5
  }

  return Math.min(score, 30) // Cap at 30
}

/**
 * Calculates user correction boost score (20 points maximum)
 *
 * Scoring logic:
 * - +20 points if uses any corrected column
 * - +5 bonus if uses multiple (2+) corrected columns
 *
 * This heavily prioritizes charts that incorporate user feedback
 *
 * @example
 * calculateUserCorrectionBoost(recommendation, correctedColumns) // 25 if uses 2+ corrected
 */
export function calculateUserCorrectionBoost(
  recommendation: ChartSuggestion,
  correctedColumns?: CorrectedColumn[]
): number {
  if (!correctedColumns || correctedColumns.length === 0) {
    return 0
  }

  const correctedCount = countCorrectedColumnsUsed(recommendation, correctedColumns)

  if (correctedCount === 0) {
    return 0
  }

  let score = 20 // Base score for using any corrected column

  if (correctedCount >= 2) {
    score += 5 // Bonus for using multiple corrected columns
  }

  return score
}

/**
 * Calculates clarity score based on complexity (10 points maximum)
 *
 * Scoring logic:
 * - Simple chart (1-2 columns): 10 points
 * - Moderate complexity (3-4 columns): 7 points
 * - Complex (5+ columns): 3 points
 *
 * Simpler visualizations are generally easier to understand
 *
 * @example
 * calculateClarityScore(recommendation) // 10 for simple 2-column bar chart
 */
export function calculateClarityScore(recommendation: ChartSuggestion): number {
  // Count columns used in the chart
  let columnCount = 0

  if (recommendation.chartConfig.x) columnCount++

  if (recommendation.chartConfig.y) {
    if (Array.isArray(recommendation.chartConfig.y)) {
      columnCount += recommendation.chartConfig.y.length
    } else {
      columnCount++
    }
  }

  if (recommendation.chartConfig.color) columnCount++
  if (recommendation.chartConfig.size) columnCount++

  // For tables, count visible columns
  if (recommendation.tableConfig) {
    columnCount = recommendation.tableConfig.columns.length
  }

  // Score based on complexity
  if (columnCount <= 2) {
    return 10 // Simple, clear visualization
  } else if (columnCount <= 4) {
    return 7 // Moderate complexity
  } else {
    return 3 // Complex, potentially harder to understand
  }
}

/**
 * Main scoring function that calculates the total quality score for a recommendation
 *
 * @param recommendation - The chart recommendation to score
 * @param dataProfile - The data schema and sample data
 * @param correctedColumns - Optional array of user-corrected columns
 *
 * @returns Enhanced recommendation with quality score (0-100) and factor breakdown
 *
 * @example
 * const scored = scoreRecommendation(recommendation, dataProfile, corrections)
 * console.log(scored.qualityScore) // 87
 * console.log(scored.qualityFactors) // { dataTypeMatch: 35, columnConfidence: 28, ... }
 */
export function scoreRecommendation(
  recommendation: ChartSuggestion,
  dataProfile: DataProfile,
  correctedColumns?: CorrectedColumn[]
): ScoredRecommendation {
  // Calculate individual factor scores
  const dataTypeMatch = calculateDataTypeMatchScore(recommendation, dataProfile)
  const columnConfidence = calculateColumnConfidenceScore(recommendation, dataProfile.schema)
  const userCorrectionBoost = calculateUserCorrectionBoost(recommendation, correctedColumns)
  const clarityScore = calculateClarityScore(recommendation)

  // Calculate total quality score (max 100)
  const qualityScore = dataTypeMatch + columnConfidence + userCorrectionBoost + clarityScore

  return {
    ...recommendation,
    qualityScore: Math.min(qualityScore, 100), // Cap at 100
    qualityFactors: {
      dataTypeMatch,
      columnConfidence,
      userCorrectionBoost,
      clarityScore
    }
  }
}

/**
 * Ranks recommendations by quality score in descending order
 *
 * @param recommendations - Array of chart recommendations to rank
 * @param dataProfile - The data schema and sample data
 * @param correctedColumns - Optional array of user-corrected columns
 *
 * @returns Array of scored recommendations sorted by quality (highest first)
 *
 * @example
 * const ranked = rankRecommendations(recommendations, dataProfile, corrections)
 * console.log(ranked[0].qualityScore) // Highest scoring recommendation
 */
export function rankRecommendations(
  recommendations: ChartSuggestion[],
  dataProfile: DataProfile,
  correctedColumns?: CorrectedColumn[]
): ScoredRecommendation[] {
  // Score all recommendations
  const scored = recommendations.map(rec =>
    scoreRecommendation(rec, dataProfile, correctedColumns)
  )

  // Sort by quality score (descending)
  scored.sort((a, b) => {
    // Primary sort: quality score
    if (b.qualityScore !== a.qualityScore) {
      return b.qualityScore - a.qualityScore
    }

    // Secondary sort: priority (high > medium > low)
    const priorityWeight = { high: 3, medium: 2, low: 1 }
    const aPriority = priorityWeight[a.priority] || 0
    const bPriority = priorityWeight[b.priority] || 0

    if (bPriority !== aPriority) {
      return bPriority - aPriority
    }

    // Tertiary sort: confidence
    return b.confidence - a.confidence
  })

  return scored
}

/**
 * Filters recommendations by minimum quality score threshold
 *
 * @param scoredRecommendations - Array of scored recommendations
 * @param minScore - Minimum quality score threshold (0-100)
 *
 * @returns Filtered array of recommendations meeting the threshold
 *
 * @example
 * const highQuality = filterByQualityThreshold(scored, 70) // Only scores >= 70
 */
export function filterByQualityThreshold(
  scoredRecommendations: ScoredRecommendation[],
  minScore: number
): ScoredRecommendation[] {
  return scoredRecommendations.filter(rec => rec.qualityScore >= minScore)
}

/**
 * Gets the top N recommendations by quality score
 *
 * @param scoredRecommendations - Array of scored recommendations (should be pre-sorted)
 * @param count - Number of top recommendations to return
 *
 * @returns Array of top N recommendations
 *
 * @example
 * const top5 = getTopRecommendations(ranked, 5)
 */
export function getTopRecommendations(
  scoredRecommendations: ScoredRecommendation[],
  count: number
): ScoredRecommendation[] {
  return scoredRecommendations.slice(0, count)
}