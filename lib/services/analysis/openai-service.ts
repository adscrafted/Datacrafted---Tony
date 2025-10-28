/**
 * OpenAI Service
 * Handles all interactions with OpenAI API
 */

import OpenAI from 'openai'
import { withTimeout, isTimeoutError } from '@/lib/utils/timeout'
import { parseJSONFromString } from '@/lib/utils/json-extractor'

const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.log(...args)
  },
  info: console.log,
  warn: console.warn,
  error: console.error
}

export interface AIAnalysisResponse {
  insights: string[]
  chartConfig: any[]
  summary?: {
    dataQuality?: any
    keyFindings?: any
    recommendations?: any
    businessContext?: any
  }
  dataContext?: any
}

export class OpenAIService {
  private client: OpenAI | null = null

  /**
   * Get or create OpenAI client
   */
  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured')
      }
      this.client = new OpenAI({ apiKey })
    }
    return this.client
  }

  /**
   * Analyze data using OpenAI
   */
  async analyzeData(prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now()
    const client = this.getClient()

    try {
      logger.info('[OpenAI] Starting analysis with prompt length:', prompt.length)

      // Call OpenAI with timeout
      const completion = await withTimeout(
        client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert data analyst. Analyze data and provide visualization recommendations in valid JSON format. Be concise and focus on actionable insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        }),
        60000 // 60 second timeout
      )

      const duration = Date.now() - startTime
      logger.info('[OpenAI] Analysis completed in', duration, 'ms')

      // Extract and parse response
      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from OpenAI')
      }

      // Parse JSON response
      const parsed = this.parseAIResponse(response)

      return parsed
    } catch (error) {
      const duration = Date.now() - startTime

      // Handle specific error types
      if (isTimeoutError(error)) {
        logger.error('[OpenAI] Request timed out after', duration, 'ms')
        throw error
      }

      if (this.isRateLimitError(error)) {
        logger.error('[OpenAI] Rate limit exceeded')
        throw new Error('Rate limit exceeded. Please wait a moment and try again.')
      }

      if (this.isQuotaError(error)) {
        logger.error('[OpenAI] Quota exceeded')
        throw new Error('OpenAI quota exceeded. Please check your billing.')
      }

      logger.error('[OpenAI] Analysis failed:', error)
      throw error
    }
  }

  /**
   * Parse AI response to ensure valid structure
   */
  private parseAIResponse(response: string): AIAnalysisResponse {
    try {
      // Try to parse as JSON
      const parsed = parseJSONFromString(response) as any

      // Validate required fields
      if (!parsed.chartConfig || !Array.isArray(parsed.chartConfig)) {
        throw new Error('Invalid response: missing chartConfig array')
      }

      // Ensure insights is an array
      if (!parsed.insights) {
        parsed.insights = []
      } else if (!Array.isArray(parsed.insights)) {
        parsed.insights = [parsed.insights]
      }

      return parsed as AIAnalysisResponse
    } catch (error) {
      logger.error('[OpenAI] Failed to parse response:', error)
      logger.debug('[OpenAI] Raw response:', response.substring(0, 500))
      throw new Error('Failed to parse AI response')
    }
  }

  /**
   * Check if error is rate limit error
   */
  private isRateLimitError(error: any): boolean {
    return error?.status === 429 || error?.code === 'rate_limit_exceeded'
  }

  /**
   * Check if error is quota error
   */
  private isQuotaError(error: any): boolean {
    return error?.code === 'insufficient_quota' || error?.status === 402
  }

  /**
   * Generate a simple analysis for testing
   */
  async generateQuickAnalysis(
    columns: string[],
    sampleData: any[]
  ): Promise<AIAnalysisResponse> {
    const numericalColumns = columns.filter(col =>
      sampleData.some(row => typeof row[col] === 'number')
    )

    const categoricalColumns = columns.filter(col =>
      !numericalColumns.includes(col)
    )

    // Generate basic recommendations without AI
    const chartConfig = []

    // Add a scorecard for first numerical column
    if (numericalColumns.length > 0) {
      chartConfig.push({
        type: 'scorecard',
        title: `Total ${numericalColumns[0]}`,
        description: 'Key metric overview',
        dataMapping: {
          metric: numericalColumns[0],
          aggregation: 'sum'
        },
        confidence: 90
      })
    }

    // Add a bar chart if we have categories and values
    if (categoricalColumns.length > 0 && numericalColumns.length > 0) {
      chartConfig.push({
        type: 'bar',
        title: `${numericalColumns[0]} by ${categoricalColumns[0]}`,
        description: 'Comparison across categories',
        dataMapping: {
          category: categoricalColumns[0],
          values: [numericalColumns[0]]
        },
        confidence: 85
      })
    }

    // Add a table to show raw data
    chartConfig.push({
      type: 'table',
      title: 'Data Overview',
      description: 'Detailed data table',
      dataMapping: {
        columns: columns.slice(0, 8) // Limit to 8 columns
      },
      confidence: 95
    })

    return {
      insights: [
        `Dataset contains ${columns.length} columns`,
        `Found ${numericalColumns.length} numerical and ${categoricalColumns.length} categorical columns`,
        'Basic visualizations generated for quick overview'
      ],
      chartConfig,
      summary: {
        dataQuality: {
          score: 85,
          issues: []
        },
        keyFindings: ['Data structure analyzed'],
        recommendations: ['Review generated visualizations']
      }
    }
  }
}

// Export singleton instance
export const openAIService = new OpenAIService()