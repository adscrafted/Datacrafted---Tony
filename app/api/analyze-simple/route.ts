/**
 * Simple Analysis API Route
 *
 * A lightweight analysis endpoint with authentication and paywall protection.
 * Uses the same limits as the main analyze endpoint.
 *
 * POST /api/analyze-simple
 * Body: { data: DataRow[] }
 * Returns: Analysis result with insights and chart configs
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseJSONFromString } from '@/lib/utils/json-extractor'
import { validateRequest, analyzeSimpleRequestSchema } from '@/lib/utils/api-validation'
import { serverError, externalServiceError } from '@/lib/utils/api-errors'
import {
  getAIProvider,
  generateCompletionWithRetry,
  normalizeAnalysisResponse,
  type AIMessage
} from '@/lib/services/ai/ai-provider'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const handler = withAuth(async (request: NextRequest, authUser) => {
  const requestId = crypto.randomUUID()

  try {
    // Paywall check - verify user has analysis credits remaining
    const { canPerformAnalysis, incrementAnalysisCount } = await import('@/lib/services/subscription-service')
    const usageCheck = await canPerformAnalysis(authUser.uid)

    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Analysis limit reached',
          code: 'PAYWALL_REQUIRED',
          type: 'paywall',
          message: usageCheck.message,
          usage: {
            used: usageCheck.used,
            limit: usageCheck.limit,
            remaining: usageCheck.remaining,
            plan: usageCheck.plan
          },
          upgradeUrl: '/account/billing',
          requestId
        },
        { status: 402 }
      )
    }

    const aiProvider = getAIProvider()
    const hasApiKey = aiProvider === 'gemini'
      ? !!process.env.GOOGLE_GEMINI_API_KEY
      : !!process.env.OPENAI_API_KEY

    if (!hasApiKey) {
      return serverError(`${aiProvider.toUpperCase()} API key not configured`)
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, analyzeSimpleRequestSchema)
    if (!validation.success) {
      return validation.response
    }

    const { data } = validation.data

    const startTime = Date.now()

    // Very simple prompt
    const prompt = `Analyze this data and create charts:
Data: ${data.length} rows
Columns: ${Object.keys(data[0]).join(', ')}
Sample: ${JSON.stringify(data.slice(0, 2))}

Respond with JSON using EXACTLY these field names:
{
  "insights": ["insight1", "insight2"],
  "chartConfig": [
    {"type": "bar", "title": "Chart Title", "dataKey": ["column1", "column2"], "description": "Description"}
  ],
  "summary": {"rowCount": ${data.length}, "columnCount": ${Object.keys(data[0]).length}, "columns": []}
}

CRITICAL: Use EXACTLY "insights" (not "analysis"), "chartConfig" (not "charts"), "summary" (not "data_summary").`

    const messages: AIMessage[] = [
      { role: "system", content: "You are a data analyst. Respond only with valid JSON." },
      { role: "user", content: prompt }
    ]

    const response = await Promise.race([
      generateCompletionWithRetry(messages, {
        temperature: 0.3,
        maxTokens: 1000,
        jsonMode: true
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 15s')), 15000)
      )
    ])

    if (!response) {
      throw new Error(`No response from ${aiProvider.toUpperCase()}`)
    }

    const rawResult = parseJSONFromString(response)
    const result = normalizeAnalysisResponse(rawResult)

    // Increment analysis count after successful analysis
    await incrementAnalysisCount(authUser.uid)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[API-ANALYZE-SIMPLE] Error:', error)
    const aiProvider = getAIProvider()
    if (error instanceof Error && (error.message.includes('OpenAI') || error.message.includes('Gemini'))) {
      return externalServiceError(aiProvider.toUpperCase(), error)
    }
    return serverError('Analysis failed', error as Error)
  }
})

// Apply rate limiting to the authenticated handler
export const POST = withRateLimit(RATE_LIMITS.ANALYSIS, handler)
