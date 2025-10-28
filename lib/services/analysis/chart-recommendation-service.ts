/**
 * Chart Recommendation Service
 * Handles chart type selection, validation, and data mapping
 */

import type { ChartSuggestion } from '@/lib/types/chart-suggestion'
import type { DataRow } from '@/lib/store'
import {
  scoreRecommendation,
  rankRecommendations,
  type ScoredRecommendation
} from '@/lib/utils/recommendation-scorer'
import {
  rebalanceCharts,
  getChartStats,
  validateChartLayout
} from '@/lib/utils/chart-rebalancer'
import { hydrateChartConfigs } from '@/lib/utils/chart-hydrator'
import { createColumnMatcher, findColumn } from '@/lib/utils/column-name-matcher'
import type { DataContext, BusinessDomain } from './schema-service'

const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.log(...args)
  },
  info: console.log,
  warn: console.warn,
  error: console.error
}

// Supported chart types - SINGLE SOURCE OF TRUTH
export const SUPPORTED_CHART_TYPES = [
  'line', 'bar', 'pie', 'area', 'scatter', 'scorecard', 'table', 'combo',
  'waterfall', 'heatmap', 'gauge', 'cohort', 'bullet', 'treemap', 'sparkline'
] as const

export type SupportedChartType = typeof SUPPORTED_CHART_TYPES[number]

export interface ChartRecommendation {
  type: SupportedChartType
  title: string
  description: string
  dataMapping: Record<string, any>
  confidence?: number
  reasoning?: string
}

export class ChartRecommendationService {
  /**
   * Validate chart configurations from AI
   */
  validateChartConfigs(configs: any[]): ChartRecommendation[] {
    return configs
      .filter(config => this.isValidChartType(config.type))
      .map(config => this.normalizeChartConfig(config))
  }

  /**
   * Check if chart type is supported
   */
  private isValidChartType(type: string): boolean {
    const isValid = SUPPORTED_CHART_TYPES.includes(type as SupportedChartType)
    if (!isValid) {
      logger.warn('[ChartService] Unsupported chart type:', type)
    }
    return isValid
  }

  /**
   * Normalize chart configuration
   */
  private normalizeChartConfig(config: any): ChartRecommendation {
    // Migrate legacy format if needed
    const dataMapping = this.migrateLegacyFormat(config)

    return {
      type: config.type as SupportedChartType,
      title: config.title || 'Untitled Chart',
      description: config.description || '',
      dataMapping,
      confidence: config.confidence,
      reasoning: config.reasoning
    }
  }

  /**
   * Migrate legacy xAxis/yAxis format to new dataMapping format
   */
  private migrateLegacyFormat(config: any): Record<string, any> {
    if (config.dataMapping) {
      return config.dataMapping
    }

    const dataMapping: any = {}
    const xAxis = config.xAxis
    const yAxis = config.yAxis
    const dataKey = config.dataKey ?
      (Array.isArray(config.dataKey) ? config.dataKey : [config.dataKey]) : []

    switch (config.type) {
      case 'bar':
        if (xAxis) {
          dataMapping.category = xAxis
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
        if (xAxis) {
          dataMapping.xAxis = xAxis
        } else if (dataKey.length > 0) {
          dataMapping.xAxis = dataKey[0]
        }
        if (yAxis) {
          dataMapping.yAxis = yAxis
        } else if (dataKey.length > 1) {
          dataMapping.yAxis = dataKey.slice(1)
        }
        break

      case 'pie':
        if (xAxis) {
          dataMapping.category = xAxis
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
        if (yAxis) {
          dataMapping.metric = Array.isArray(yAxis) ? yAxis[0] : yAxis
        } else if (dataKey.length > 0) {
          dataMapping.metric = dataKey[0]
        }
        break

      case 'scatter':
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
        break

      case 'table':
        if (yAxis) {
          dataMapping.columns = Array.isArray(yAxis) ? yAxis : [yAxis]
        } else if (dataKey.length > 0) {
          dataMapping.columns = dataKey
        }
        break
    }

    if (config.aggregation) {
      dataMapping.aggregation = config.aggregation
    }

    return dataMapping
  }

  /**
   * Convert recommendations to chart suggestions
   */
  convertToChartSuggestions(
    recommendations: ChartRecommendation[],
    data: DataRow[]
  ): ChartSuggestion[] {
    return recommendations.map((rec, index) =>
      this.convertToChartSuggestion(rec, index, data)
    )
  }

  /**
   * Convert a single recommendation to chart suggestion
   */
  private convertToChartSuggestion(
    config: ChartRecommendation,
    index: number,
    data: DataRow[]
  ): ChartSuggestion {
    const id = `chart-${index + 1}-${config.type}`
    const dataMapping = config.dataMapping

    // Build dataKey array based on chart type and dataMapping
    let dataKey: string[] = []

    switch (config.type) {
      case 'bar':
        if (dataMapping.category) dataKey.push(dataMapping.category)
        if (dataMapping.values) dataKey = dataKey.concat(dataMapping.values)
        break
      case 'line':
      case 'area':
        if (dataMapping.xAxis) dataKey.push(dataMapping.xAxis)
        if (dataMapping.yAxis) {
          dataKey = dataKey.concat(Array.isArray(dataMapping.yAxis) ?
            dataMapping.yAxis : [dataMapping.yAxis])
        }
        break
      case 'pie':
        if (dataMapping.category) dataKey.push(dataMapping.category)
        if (dataMapping.value) dataKey.push(dataMapping.value)
        break
      case 'scatter':
        if (dataMapping.xAxis) dataKey.push(dataMapping.xAxis)
        if (dataMapping.yAxis) dataKey.push(dataMapping.yAxis)
        if (dataMapping.size) dataKey.push(dataMapping.size)
        if (dataMapping.color) dataKey.push(dataMapping.color)
        break
      case 'scorecard':
        if (dataMapping.metric) dataKey.push(dataMapping.metric)
        if (dataMapping.comparison) dataKey.push(dataMapping.comparison)
        break
      case 'table':
        if (dataMapping.columns) dataKey = dataMapping.columns
        break
    }

    // Remove duplicates
    dataKey = [...new Set(dataKey)]

    return {
      id,
      type: config.type,
      title: config.title,
      description: config.description,
      dataMapping,
      dataKey: dataKey.length > 0 ? dataKey : undefined,
      position: { x: 0, y: 0 },
      size: this.getDefaultSize(config.type),
      confidence: config.confidence || 80
    }
  }

  /**
   * Get default size for chart type
   */
  private getDefaultSize(type: SupportedChartType): { width: number; height: number } {
    const sizeMap = {
      scorecard: { width: 2, height: 2 },
      sparkline: { width: 2, height: 2 },
      gauge: { width: 3, height: 3 },
      pie: { width: 3, height: 3 },
      bar: { width: 4, height: 3 },
      line: { width: 4, height: 3 },
      area: { width: 4, height: 3 },
      scatter: { width: 4, height: 3 },
      combo: { width: 5, height: 3 },
      waterfall: { width: 5, height: 3 },
      heatmap: { width: 4, height: 4 },
      table: { width: 6, height: 4 },
      cohort: { width: 6, height: 4 },
      bullet: { width: 4, height: 2 },
      treemap: { width: 4, height: 4 }
    }
    return sizeMap[type] || { width: 4, height: 3 }
  }

  /**
   * Score and rank chart recommendations
   */
  async scoreAndRank(
    recommendations: ChartRecommendation[],
    data: DataRow[],
    dataContext: DataContext
  ): Promise<ScoredRecommendation[]> {
    const dataProfile = {
      rowCount: dataContext.rowCount,
      uniqueValues: {},
      dataTypes: {},
      nullCounts: {},
      dateColumns: dataContext.temporalColumns,
      numericColumns: dataContext.numericalColumns,
      categoricalColumns: dataContext.categoricalColumns
    }

    // Score each recommendation
    const scoredRecommendations = recommendations.map(rec => {
      const score = scoreRecommendation(
        rec as any,
        dataProfile,
        data[0] ? Object.keys(data[0]) : []
      )
      return { ...rec, ...score } as ScoredRecommendation
    })

    // Rank by score
    return rankRecommendations(scoredRecommendations)
  }

  /**
   * Rebalance chart layout for optimal display
   */
  rebalanceLayout(charts: ChartSuggestion[]): ChartSuggestion[] {
    const rebalanced = rebalanceCharts(charts)
    const stats = getChartStats(rebalanced)
    const validation = validateChartLayout(rebalanced)

    logger.debug('[ChartService] Layout rebalanced:', {
      ...stats,
      isValid: validation.isValid
    })

    return rebalanced
  }

  /**
   * Hydrate chart configurations with actual data
   */
  hydrateCharts(charts: ChartSuggestion[], data: DataRow[]): ChartSuggestion[] {
    return hydrateChartConfigs(charts, data)
  }
}

// Export singleton instance
export const chartRecommendationService = new ChartRecommendationService()