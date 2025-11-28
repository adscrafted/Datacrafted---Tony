/**
 * Main Analysis Service
 * Orchestrates data analysis using all sub-services
 */

import type { DataRow, AnalysisResult, DataSchema } from '@/lib/store'
import type { ChartSuggestion } from '@/lib/types/chart-suggestion'
import { schemaService } from './schema-service'
import { chartRecommendationService } from './chart-recommendation-service'
import { promptBuilderService } from './prompt-builder-service'
import { openAIService } from './openai-service'
import { createColumnMatcher } from '@/lib/utils/column-name-matcher'
import {
  getCachedAnalysis,
  setCachedAnalysis,
  generateDataHash
} from '@/lib/cache/analysis-cache'

const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.log(...args)
  },
  info: console.log,
  warn: console.warn,
  error: console.error
}

export interface AnalysisRequest {
  data: DataRow[]
  schema?: DataSchema
  correctedSchema?: Array<{
    name: string
    type: string
    description: string
    userCorrected: boolean
  }>
  feedback?: string
  fileName?: string
  useCache?: boolean
  quickAnalysis?: boolean
}

export class AnalysisService {
  /**
   * Main analysis entry point
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now()

    try {
      // Check cache if enabled
      if (request.useCache !== false) {
        const dataHash = generateDataHash(JSON.stringify(request.data))
        const cached = await getCachedAnalysis(dataHash)
        if (cached) {
          logger.info('[AnalysisService] Using cached analysis')
          return cached
        }
      }

      // Step 1: Analyze data structure and schema
      logger.info('[AnalysisService] Step 1: Analyzing data structure')
      const { schema, dataContext, businessDomain } = schemaService.analyzeDataStructure(
        request.data
      )

      // Apply user corrections if provided
      const finalSchema = request.correctedSchema ?
        schemaService.applyUserCorrections(schema, request.correctedSchema) :
        schema

      // Step 2: Build AI prompt
      logger.info('[AnalysisService] Step 2: Building AI prompt')
      const prompt = request.quickAnalysis ?
        promptBuilderService.buildQuickAnalysisPrompt(
          request.data,
          dataContext.columns
        ) :
        promptBuilderService.buildAnalysisPrompt({
          data: request.data,
          schema: finalSchema,
          dataContext,
          businessDomain,
          userFeedback: request.feedback,
          fileName: request.fileName
        })

      // Step 3: Get AI analysis
      logger.info('[AnalysisService] Step 3: Getting AI analysis')
      const aiResponse = request.quickAnalysis ?
        await openAIService.generateQuickAnalysis(
          dataContext.columns,
          request.data.slice(0, 10)
        ) :
        await openAIService.analyzeData(prompt)

      // Step 4: Process and validate chart recommendations
      logger.info('[AnalysisService] Step 4: Processing chart recommendations')
      const validatedCharts = chartRecommendationService.validateChartConfigs(
        aiResponse.chartConfig
      )

      // Step 5: Convert to chart suggestions
      const chartSuggestions = chartRecommendationService.convertToChartSuggestions(
        validatedCharts,
        request.data
      )

      // Step 6: Score and rank recommendations
      const scoredRecommendations = await chartRecommendationService.scoreAndRank(
        validatedCharts,
        request.data,
        dataContext
      )

      // Step 7: Rebalance layout
      const rebalancedCharts = chartRecommendationService.rebalanceLayout(
        chartSuggestions
      )

      // Step 8: Hydrate with data
      const hydratedCharts = chartRecommendationService.hydrateCharts(
        rebalancedCharts,
        request.data
      )

      // Build final result
      const result: AnalysisResult = {
        insights: aiResponse.insights || [],
        chartConfig: hydratedCharts,
        schema: {
          ...finalSchema,
          businessContext: aiResponse.summary?.businessContext
        },
        summary: aiResponse.summary,
        recommendations: scoredRecommendations.slice(0, 5).map(r => ({
          type: r.type,
          title: r.title,
          score: r.totalScore,
          reasoning: r.scores
        }))
      }

      // Cache result if enabled
      if (request.useCache !== false) {
        const dataHash = generateDataHash(JSON.stringify(request.data))
        await setCachedAnalysis(dataHash, result, JSON.stringify(request.data).length)
      }

      const duration = Date.now() - startTime
      logger.info('[AnalysisService] Analysis completed:', {
        duration: `${duration}ms`,
        charts: result.chartConfig.length,
        insights: result.insights.length
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('[AnalysisService] Analysis failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      })
      throw error
    }
  }

  /**
   * Validate analysis request
   */
  validateRequest(request: AnalysisRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!request.data || !Array.isArray(request.data)) {
      errors.push('Data must be a non-empty array')
    } else if (request.data.length === 0) {
      errors.push('Data array cannot be empty')
    } else if (request.data.length > 100000) {
      errors.push('Data exceeds maximum size limit (100,000 rows)')
    }

    if (request.data && request.data[0]) {
      const columns = Object.keys(request.data[0])
      if (columns.length === 0) {
        errors.push('Data must have at least one column')
      } else if (columns.length > 100) {
        errors.push('Data exceeds maximum column limit (100 columns)')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get column matcher for fuzzy column name matching
   */
  getColumnMatcher(data: DataRow[]) {
    if (!data || data.length === 0) {
      return null
    }
    const columns = Object.keys(data[0])
    return createColumnMatcher(columns)
  }
}

// Export singleton instance
export const analysisService = new AnalysisService()