/**
 * AI Provider Abstraction Layer
 *
 * Provides a unified interface for AI services (OpenAI, Gemini)
 * Allows easy switching between providers via environment variable.
 *
 * Key features:
 * - Unified message format
 * - Response normalization for consistent output
 * - Streaming support for both providers
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 */

import OpenAI from 'openai'
import { GoogleGenerativeAI, type GenerativeModel, type Content } from '@google/generative-ai'

// ============================================================================
// TYPES
// ============================================================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionOptions {
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

export interface AIStreamChunk {
  content: string
  done: boolean
}

export type AIProvider = 'openai' | 'gemini'

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase()
  if (provider === 'gemini') return 'gemini'
  return 'openai' // Default to OpenAI
}

// ============================================================================
// OPENAI CLIENT
// ============================================================================

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// ============================================================================
// GEMINI CLIENT
// ============================================================================

let geminiClient: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured')
    }
    geminiClient = new GoogleGenerativeAI(apiKey)
  }
  return geminiClient
}

function getGeminiModel(jsonMode: boolean = false): GenerativeModel {
  const client = getGeminiClient()
  return client.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: jsonMode ? {
      responseMimeType: 'application/json'
    } : undefined
  })
}

// ============================================================================
// MESSAGE FORMAT CONVERSION
// ============================================================================

/**
 * Convert messages to Gemini format
 * Gemini doesn't have a system role, so we prepend system content to first user message
 */
function convertToGeminiMessages(messages: AIMessage[]): Content[] {
  const geminiMessages: Content[] = []
  let systemPrompt = ''

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += msg.content + '\n\n'
    } else {
      const role = msg.role === 'user' ? 'user' : 'model'
      const content = msg.role === 'user' && systemPrompt
        ? systemPrompt + msg.content
        : msg.content

      if (msg.role === 'user') {
        systemPrompt = '' // Clear after first use
      }

      geminiMessages.push({
        role,
        parts: [{ text: content }]
      })
    }
  }

  return geminiMessages
}

function convertToOpenAIMessages(messages: AIMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))
}

// ============================================================================
// RESPONSE NORMALIZATION
// ============================================================================

/**
 * Normalize AI response to handle different field names from various AI providers.
 * Gemini may use different field names than OpenAI (e.g., "analysis" vs "insights").
 *
 * This is CRITICAL for consistent behavior across providers.
 */
export function normalizeAnalysisResponse(response: any): {
  insights: string[]
  chartConfig: any[]
  summary: any
  dataContext?: any
} {
  if (!response || typeof response !== 'object') {
    console.error('[AI-PROVIDER] Invalid response to normalize:', response)
    return {
      insights: [],
      chartConfig: [],
      summary: {}
    }
  }

  // Handle different field names for insights
  const insights = response.insights || response.analysis || response.key_insights ||
                   response.keyInsights || response.findings || []

  // Handle different field names for chart config
  const chartConfig = response.chartConfig || response.charts || response.chart_config ||
                      response.chartConfigs || response.visualizations ||
                      response.recommendations || response.chartRecommendations || []

  // Handle different field names for summary
  const summary = response.summary || response.data_summary || response.dataSummary ||
                  response.overview || {}

  // Ensure insights is an array of strings
  const normalizedInsights = Array.isArray(insights)
    ? insights.map(i => typeof i === 'string' ? i : String(i))
    : typeof insights === 'string' ? [insights] : []

  // Ensure chartConfig is an array
  const normalizedChartConfig = Array.isArray(chartConfig)
    ? chartConfig
    : (typeof chartConfig === 'object' && chartConfig !== null) ? [chartConfig] : []

  // Ensure summary is an object
  const normalizedSummary = typeof summary === 'object' && summary !== null ? summary : {}

  // Log normalization for debugging
  console.log('[AI-PROVIDER] Response normalization:', {
    originalKeys: Object.keys(response),
    insightsSource: response.insights ? 'insights' : response.analysis ? 'analysis' :
                    response.key_insights ? 'key_insights' : response.findings ? 'findings' : 'unknown',
    chartConfigSource: response.chartConfig ? 'chartConfig' : response.charts ? 'charts' :
                       response.chart_config ? 'chart_config' : response.recommendations ? 'recommendations' : 'unknown',
    normalizedInsightsCount: normalizedInsights.length,
    normalizedChartConfigCount: normalizedChartConfig.length
  })

  return {
    insights: normalizedInsights,
    chartConfig: normalizedChartConfig,
    summary: normalizedSummary,
    dataContext: response.dataContext || response.data_context || response.context
  }
}

// ============================================================================
// COMPLETION FUNCTIONS
// ============================================================================

/**
 * Generate a completion using the configured AI provider
 */
export async function generateCompletion(
  messages: AIMessage[],
  options: AICompletionOptions = {}
): Promise<string> {
  const provider = getAIProvider()
  const { temperature = 0.7, maxTokens = 4000, jsonMode = false } = options

  console.log(`[AI-PROVIDER] Generating completion with ${provider}:`, {
    messageCount: messages.length,
    temperature,
    maxTokens,
    jsonMode
  })

  if (provider === 'gemini') {
    return generateGeminiCompletion(messages, { temperature, maxTokens, jsonMode })
  } else {
    return generateOpenAICompletion(messages, { temperature, maxTokens, jsonMode })
  }
}

/**
 * Generate a streaming completion using the configured AI provider
 */
export async function* generateStreamingCompletion(
  messages: AIMessage[],
  options: AICompletionOptions = {}
): AsyncGenerator<AIStreamChunk> {
  const provider = getAIProvider()
  const { temperature = 0.7, maxTokens = 1500 } = options

  console.log(`[AI-PROVIDER] Starting streaming completion with ${provider}`)

  if (provider === 'gemini') {
    yield* generateGeminiStreamingCompletion(messages, { temperature, maxTokens })
  } else {
    yield* generateOpenAIStreamingCompletion(messages, { temperature, maxTokens })
  }
}

// ============================================================================
// OPENAI IMPLEMENTATION
// ============================================================================

async function generateOpenAICompletion(
  messages: AIMessage[],
  options: AICompletionOptions
): Promise<string> {
  const client = getOpenAIClient()
  const { temperature, maxTokens, jsonMode } = options

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: convertToOpenAIMessages(messages),
    temperature,
    max_tokens: maxTokens,
    response_format: jsonMode ? { type: 'json_object' } : undefined
  })

  const content = completion.choices[0]?.message?.content || ''

  console.log('[AI-PROVIDER] OpenAI response:', {
    contentLength: content.length,
    finishReason: completion.choices[0]?.finish_reason
  })

  return content
}

async function* generateOpenAIStreamingCompletion(
  messages: AIMessage[],
  options: AICompletionOptions
): AsyncGenerator<AIStreamChunk> {
  const client = getOpenAIClient()
  const { temperature, maxTokens } = options

  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: convertToOpenAIMessages(messages),
    temperature,
    max_completion_tokens: maxTokens,
    stream: true
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ''
    const done = chunk.choices[0]?.finish_reason === 'stop'
    yield { content, done }
  }
}

// ============================================================================
// GEMINI IMPLEMENTATION
// ============================================================================

async function generateGeminiCompletion(
  messages: AIMessage[],
  options: AICompletionOptions
): Promise<string> {
  const { temperature, maxTokens, jsonMode } = options
  const model = getGeminiModel(jsonMode)
  const geminiMessages = convertToGeminiMessages(messages)

  console.log('[AI-PROVIDER] Calling Gemini:', {
    messageCount: geminiMessages.length,
    temperature,
    maxTokens,
    jsonMode
  })

  const result = await model.generateContent({
    contents: geminiMessages,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: jsonMode ? 'application/json' : undefined
    }
  })

  const response = result.response
  const text = response.text()

  console.log('[AI-PROVIDER] Gemini response:', {
    textLength: text?.length || 0,
    preview: text?.substring(0, 300) || 'EMPTY',
    finishReason: response.candidates?.[0]?.finishReason
  })

  // Debug: Log parsed keys for JSON mode
  if (jsonMode && text) {
    try {
      const parsed = JSON.parse(text)
      console.log('[AI-PROVIDER] Gemini JSON keys:', Object.keys(parsed))
    } catch (e) {
      console.error('[AI-PROVIDER] Failed to parse Gemini response as JSON')
    }
  }

  return text
}

async function* generateGeminiStreamingCompletion(
  messages: AIMessage[],
  options: AICompletionOptions
): AsyncGenerator<AIStreamChunk> {
  const { temperature, maxTokens } = options
  const model = getGeminiModel(false) // No JSON mode for streaming
  const geminiMessages = convertToGeminiMessages(messages)

  const result = await model.generateContentStream({
    contents: geminiMessages,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens
    }
  })

  for await (const chunk of result.stream) {
    const content = chunk.text() || ''
    yield { content, done: false }
  }

  yield { content: '', done: true }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Generate completion with automatic retry on transient errors
 */
export async function generateCompletionWithRetry(
  messages: AIMessage[],
  options: AICompletionOptions = {},
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null
  const provider = getAIProvider()

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateCompletion(messages, options)
    } catch (error: any) {
      lastError = error
      console.error(`[AI-PROVIDER] ${provider} attempt ${attempt} failed:`, error.message)

      // Don't retry on auth errors
      if (error.status === 401 || error.status === 403) {
        throw error
      }

      // Don't retry on quota errors
      if (error.status === 402 || error.code === 'insufficient_quota') {
        throw error
      }

      // Retry with exponential backoff for other errors
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        console.log(`[AI-PROVIDER] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error(`AI generation failed after ${maxRetries} retries`)
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { Content as GeminiContent }
