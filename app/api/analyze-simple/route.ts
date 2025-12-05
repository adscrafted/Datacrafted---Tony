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

export async function POST(request: NextRequest) {
  try {
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

    console.log(`Making simple ${aiProvider} call for analysis...`)
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

    const endTime = Date.now()
    console.log(`Simple ${aiProvider} call completed in ${endTime - startTime}ms`)

    if (!response) {
      throw new Error(`No response from ${aiProvider.toUpperCase()}`)
    }

    const rawResult = parseJSONFromString(response)
    const result = normalizeAnalysisResponse(rawResult)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Simple analyze error:', error)
    const aiProvider = getAIProvider()
    if (error instanceof Error && (error.message.includes('OpenAI') || error.message.includes('Gemini'))) {
      return externalServiceError(aiProvider.toUpperCase(), error)
    }
    return serverError('Analysis failed', error as Error)
  }
}