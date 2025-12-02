import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { parseJSONFromString } from '@/lib/utils/json-extractor'
import { validateRequest, analyzeSimpleRequestSchema } from '@/lib/utils/api-validation'
import { serverError, externalServiceError } from '@/lib/utils/api-errors'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return serverError('OpenAI API key not configured')
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, analyzeSimpleRequestSchema)
    if (!validation.success) {
      return validation.response
    }

    const { data } = validation.data

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    console.log('Making simple OpenAI call for analysis...')
    const startTime = Date.now()

    // Very simple prompt
    const prompt = `Analyze this data and create charts:
Data: ${data.length} rows
Columns: ${Object.keys(data[0]).join(', ')}
Sample: ${JSON.stringify(data.slice(0, 2))}

Respond with JSON:
{
  "insights": ["insight1", "insight2"],
  "chartConfig": [
    {"type": "bar", "title": "Chart Title", "dataKey": ["column1", "column2"], "description": "Description"}
  ],
  "summary": {"rowCount": ${data.length}, "columnCount": ${Object.keys(data[0]).length}, "columns": []}
}`

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini", // Fastest model
        messages: [
          { role: "system", content: "You are a data analyst. Respond only with valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 15s')), 15000)
      )
    ]) as any

    const endTime = Date.now()
    console.log(`Simple OpenAI call completed in ${endTime - startTime}ms`)

    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    const result = parseJSONFromString(response)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Simple analyze error:', error)
    if (error instanceof Error && error.message.includes('OpenAI')) {
      return externalServiceError('OpenAI', error)
    }
    return serverError('Analysis failed', error as Error)
  }
}