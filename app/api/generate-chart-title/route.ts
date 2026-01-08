import { NextRequest, NextResponse } from 'next/server'
import { parseJSONFromString } from '@/lib/utils/json-extractor'
import { validateRequest, generateChartTitleRequestSchema } from '@/lib/utils/api-validation'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import {
  getAIProvider,
  generateCompletionWithRetry,
  type AIMessage
} from '@/lib/services/ai/ai-provider'

const isDev = process.env.NODE_ENV === 'development'
const log = (...args: unknown[]) => { if (isDev) console.log(...args) }

interface GenerateTitleResponse {
  title: string
  description: string
}

/**
 * POST /api/generate-chart-title
 * Generate AI-powered chart title and description
 *
 * PROTECTED: Requires authentication
 *
 * Rate limit: ANALYSIS rate limit (5 requests per minute)
 *
 * Request headers:
 * - Authorization: Bearer <firebase-token>
 *
 * Request body:
 * - chartType: string (required)
 * - dataMapping: object (optional)
 * - sampleData: array (optional)
 * - dataSchema: array (optional)
 *
 * Response:
 * - 200: { title, description }
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 429: Too Many Requests
 * - 500: Internal server error
 */
const postHandler = withAuth(async (request: NextRequest, firebaseUser) => {
  try {
    log('[API] Generating chart title for user:', firebaseUser.uid)

    // Note: No paywall check for this endpoint - it's a lightweight helper (200 tokens)
    // that's part of normal chart creation workflow. Full analyses are gated elsewhere.

    // Validate request body with Zod
    const validation = await validateRequest(request, generateChartTitleRequestSchema)
    if (!validation.success) {
      return validation.response
    }

    const { chartType, dataMapping, sampleData, dataSchema } = validation.data

    // Check if API key is configured based on provider
    const aiProvider = getAIProvider()
    const hasApiKey = aiProvider === 'gemini'
      ? !!process.env.GOOGLE_GEMINI_API_KEY
      : !!process.env.OPENAI_API_KEY

    if (!hasApiKey) {
      console.error(`❌ [GENERATE-TITLE] ${aiProvider.toUpperCase()} API key not configured`)
      return NextResponse.json(
        { error: `${aiProvider.toUpperCase()} API is not configured. Please check your environment variables.` },
        { status: 500 }
      )
    }

    // Build context for AI
    const context = buildPromptContext(chartType, dataMapping, sampleData, dataSchema)

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are an expert data visualization specialist. Generate concise, clear chart titles and descriptions.

Rules:
- Title: Max 60 characters, clear and descriptive
- Description: 1-2 sentences, max 150 characters, explain key insights or what the chart shows
- Focus on the "why" and "what" rather than technical details
- Be specific about metrics and dimensions
- Use business-friendly language

You MUST respond with valid JSON using EXACTLY this format:
{
  "title": "Brief, clear chart title (max 60 chars)",
  "description": "1-2 sentence description of key insights (max 150 chars)"
}`
      },
      {
        role: 'user',
        content: context
      }
    ]

    const responseText = await generateCompletionWithRetry(messages, {
      temperature: 0.7,
      maxTokens: 200,
      jsonMode: true
    })

    if (!responseText) {
      throw new Error(`No response from ${aiProvider.toUpperCase()}`)
    }

    const result: GenerateTitleResponse = parseJSONFromString<GenerateTitleResponse>(responseText)

    // Validate and truncate if needed
    const title = result.title?.slice(0, 60) || 'Chart Title'
    const description = result.description?.slice(0, 150) || 'Chart description'

    log('[API] Generated chart title:', title)
    return NextResponse.json({ title, description })

  } catch (error) {
    console.error('❌ [GENERATE-TITLE] Error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate title and description' },
      { status: 500 }
    )
  }
})

export const POST = withRateLimit(RATE_LIMITS.ANALYSIS, postHandler)

function buildPromptContext(
  chartType: string,
  dataMapping?: {
    xAxis?: string
    yAxis?: string | string[]
    category?: string
    value?: string
    metric?: string
    values?: string[]
    aggregation?: string
    [key: string]: any
  },
  sampleData?: Array<Record<string, any>>,
  dataSchema?: Array<{ name: string; type: string }>
): string {
  let context = `Generate a title and description for a ${chartType} chart.\n\n`

  // Add data mapping information
  if (dataMapping) {
    context += 'Data Mapping:\n'

    // Handle different chart types
    if (dataMapping.xAxis) {
      context += `- X-Axis: ${dataMapping.xAxis}\n`
    }
    if (dataMapping.yAxis) {
      const yFields = Array.isArray(dataMapping.yAxis)
        ? dataMapping.yAxis.join(', ')
        : dataMapping.yAxis
      context += `- Y-Axis: ${yFields}\n`
    }
    if (dataMapping.category) {
      context += `- Category: ${dataMapping.category}\n`
    }
    if (dataMapping.value) {
      context += `- Value: ${dataMapping.value}\n`
    }
    if (dataMapping.metric) {
      context += `- Metric: ${dataMapping.metric}\n`
    }
    if (dataMapping.values && Array.isArray(dataMapping.values)) {
      context += `- Values: ${dataMapping.values.join(', ')}\n`
    }
    if (dataMapping.aggregation) {
      context += `- Aggregation: ${dataMapping.aggregation}\n`
    }
    context += '\n'
  }

  // Add schema information
  if (dataSchema && dataSchema.length > 0) {
    context += 'Data Schema:\n'
    dataSchema.forEach(col => {
      context += `- ${col.name} (${col.type})\n`
    })
    context += '\n'
  }

  // Add sample data for context
  if (sampleData && sampleData.length > 0) {
    context += 'Sample Data (first 5 rows):\n'
    const sample = sampleData.slice(0, 5)
    context += JSON.stringify(sample, null, 2)
    context += '\n\n'
  }

  context += `Return a JSON object with this exact structure:
{
  "title": "Brief, clear chart title (max 60 chars)",
  "description": "1-2 sentence description of key insights (max 150 chars)"
}`

  return context
}
