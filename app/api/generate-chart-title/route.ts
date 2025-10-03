import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

interface GenerateTitleRequest {
  chartType: string
  dataMapping?: {
    xAxis?: string
    yAxis?: string | string[]
    category?: string
    value?: string
    metric?: string
    values?: string[]
    aggregation?: string
    [key: string]: any
  }
  sampleData?: Array<Record<string, any>>
  dataSchema?: Array<{
    name: string
    type: string
  }>
}

interface GenerateTitleResponse {
  title: string
  description: string
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateTitleRequest = await request.json()
    const { chartType, dataMapping, sampleData, dataSchema } = body

    // Validate required fields
    if (!chartType) {
      return NextResponse.json(
        { error: 'Chart type is required' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('❌ [GENERATE-TITLE] OpenAI API key not configured')
      return NextResponse.json(
        { error: 'OpenAI API is not configured. Please check your environment variables.' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({ apiKey })

    // Build context for AI
    const context = buildPromptContext(chartType, dataMapping, sampleData, dataSchema)

    console.log('🎯 [GENERATE-TITLE] Generating title and description for:', {
      chartType,
      dataMapping,
      sampleDataRows: sampleData?.length || 0
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert data visualization specialist. Generate concise, clear chart titles and descriptions.

Rules:
- Title: Max 60 characters, clear and descriptive
- Description: 1-2 sentences, max 150 characters, explain key insights or what the chart shows
- Focus on the "why" and "what" rather than technical details
- Be specific about metrics and dimensions
- Use business-friendly language`
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    const result: GenerateTitleResponse = JSON.parse(responseText)

    // Validate and truncate if needed
    const title = result.title?.slice(0, 60) || 'Chart Title'
    const description = result.description?.slice(0, 150) || 'Chart description'

    console.log('✅ [GENERATE-TITLE] Generated:', { title, description })

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
}

function buildPromptContext(
  chartType: string,
  dataMapping?: GenerateTitleRequest['dataMapping'],
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
