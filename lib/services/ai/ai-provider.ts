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
import { GoogleGenAI, type Content } from '@google/genai'

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
  responseSchema?: object
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

let geminiClient: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured')
    }
    geminiClient = new GoogleGenAI({ apiKey })
  }
  return geminiClient
}

function getGeminiModelName(): string {
  // Use gemini-2.0-flash or configurable via environment variable
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  console.log('[AI-PROVIDER] Using Gemini model:', modelName)
  return modelName
}

// ============================================================================
// MESSAGE FORMAT CONVERSION
// ============================================================================

/**
 * Convert messages to Gemini format and extract system instruction
 * Returns both the converted messages and the system instruction
 */
function convertToGeminiMessages(messages: AIMessage[]): {
  contents: Content[]
  systemInstruction?: string
} {
  const geminiMessages: Content[] = []
  let systemInstruction = ''

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction += msg.content + '\n\n'
    } else {
      const role = msg.role === 'user' ? 'user' : 'model'
      geminiMessages.push({
        role,
        parts: [{ text: msg.content }]
      })
    }
  }

  return {
    contents: geminiMessages,
    systemInstruction: systemInstruction.trim() || undefined
  }
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
 * Normalize AI response for consistent structure.
 *
 * With Gemini's responseSchema enforcement, field names are now guaranteed.
 * This function provides type safety and handles edge cases.
 *
 * Expected schema fields (enforced by responseSchema for Gemini):
 * - insights: string[]
 * - chartConfig: array of chart objects
 * - summary: { dataQuality, keyFindings }
 * - reasoning: { availableColumns, numericMetrics, etc. } (optional)
 * - businessQuestions: string[] (optional)
 */
export function normalizeAnalysisResponse(response: any): {
  insights: string[]
  chartConfig: any[]
  summary: any
  dataContext?: any
  reasoning?: any
  businessQuestions?: string[]
} {
  // Handle invalid responses
  if (!response || typeof response !== 'object') {
    console.error('[AI-PROVIDER] Invalid response to normalize:', response)
    return {
      insights: [],
      chartConfig: [],
      summary: {}
    }
  }

  // With responseSchema, these fields should be consistent
  // Keep minimal fallbacks for OpenAI compatibility
  const insights = response.insights || response.analysis || []
  const chartConfig = response.chartConfig || response.charts || []
  const summary = response.summary || {}

  // Ensure type safety
  const normalizedInsights = Array.isArray(insights)
    ? insights.map((i: any) => typeof i === 'string' ? i : String(i))
    : []

  const normalizedChartConfig = Array.isArray(chartConfig) ? chartConfig : []
  const normalizedSummary = typeof summary === 'object' && summary !== null ? summary : {}

  // Log for debugging (simplified)
  console.log('[AI-PROVIDER] Response normalized:', {
    insightsCount: normalizedInsights.length,
    chartConfigCount: normalizedChartConfig.length,
    hasReasoning: !!response.reasoning,
    hasSummary: Object.keys(normalizedSummary).length > 0
  })

  return {
    insights: normalizedInsights,
    chartConfig: normalizedChartConfig,
    summary: normalizedSummary,
    dataContext: response.dataContext,
    reasoning: response.reasoning,
    businessQuestions: response.businessQuestions
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
  // Don't set default temperature here - let each provider handle its own defaults
  const { temperature, maxTokens = 4000, jsonMode = false, responseSchema } = options

  console.log(`[AI-PROVIDER] Generating completion with ${provider}:`, {
    messageCount: messages.length,
    temperature,
    maxTokens,
    jsonMode,
    hasResponseSchema: !!responseSchema
  })

  if (provider === 'gemini') {
    return generateGeminiCompletion(messages, { temperature, maxTokens, jsonMode, responseSchema })
  } else {
    // OpenAI doesn't support responseSchema, use default temperature 0.7
    return generateOpenAICompletion(messages, { temperature: temperature ?? 0.7, maxTokens, jsonMode })
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
  // Don't set default temperature here - let each provider handle its own defaults
  const { temperature, maxTokens = 1500 } = options

  console.log(`[AI-PROVIDER] Starting streaming completion with ${provider}`)

  if (provider === 'gemini') {
    yield* generateGeminiStreamingCompletion(messages, { temperature, maxTokens })
  } else {
    yield* generateOpenAIStreamingCompletion(messages, { temperature: temperature ?? 0.7, maxTokens })
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
  const { temperature, maxTokens, jsonMode, responseSchema } = options
  const client = getGeminiClient()
  const modelName = getGeminiModelName()
  const { contents, systemInstruction } = convertToGeminiMessages(messages)

  // Determine temperature based on model version
  // Gemini 3.x models default to 1.0, Gemini 2.x models default to 0.7
  const modelVersion = modelName.includes('gemini-3') ? 3 : 2
  const defaultTemperature = modelVersion === 3 ? 1.0 : 0.7
  const finalTemperature = temperature ?? defaultTemperature

  console.log('[AI-PROVIDER] Calling Gemini:', {
    model: modelName,
    messageCount: contents.length,
    hasSystemInstruction: !!systemInstruction,
    temperature: finalTemperature,
    maxTokens,
    jsonMode,
    hasResponseSchema: !!responseSchema
  })

  const response = await client.models.generateContent({
    model: modelName,
    contents,
    config: {
      systemInstruction,
      temperature: finalTemperature,
      maxOutputTokens: maxTokens,
      responseMimeType: jsonMode ? 'application/json' : undefined,
      responseSchema
    }
  })

  const text = response.text || ''

  console.log('[AI-PROVIDER] Gemini response:', {
    textLength: text.length,
    preview: text.substring(0, 300) || 'EMPTY'
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
  const client = getGeminiClient()
  const modelName = getGeminiModelName()
  const { contents, systemInstruction } = convertToGeminiMessages(messages)

  // Determine temperature based on model version
  const modelVersion = modelName.includes('gemini-3') ? 3 : 2
  const defaultTemperature = modelVersion === 3 ? 1.0 : 0.7
  const finalTemperature = temperature ?? defaultTemperature

  const stream = await client.models.generateContentStream({
    model: modelName,
    contents,
    config: {
      systemInstruction,
      temperature: finalTemperature,
      maxOutputTokens: maxTokens
    }
  })

  for await (const chunk of stream) {
    const content = chunk.text || ''
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

export type { Content as GeminiContent, GoogleGenAI }
