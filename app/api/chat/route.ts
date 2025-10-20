import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { DataRow, DataSchema } from '@/lib/store'
import { withAuth } from '@/lib/middleware/auth'

// Initialize OpenAI client
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// Rate limiting (simple in-memory store for demo)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 30 // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const clientData = requestCounts.get(clientId)

  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (clientData.count >= RATE_LIMIT) {
    return false
  }

  clientData.count++
  return true
}

function generateDataContext(data: DataRow[], schema: DataSchema | null, fileName: string | null) {
  if (!data || data.length === 0) {
    return "No data is currently loaded."
  }

  // If we have a rich schema, use it for better context
  if (schema && schema.columns) {
    const columnInfo = schema.columns.map(col => {
      let info = `${col.name} (${col.type}): ${col.description || 'No description'}`

      // Add statistics for numeric columns
      if (col.stats && col.stats.min !== undefined && col.stats.max !== undefined && col.stats.avg !== undefined) {
        info += ` | Range: [${col.stats.min.toFixed(2)}, ${col.stats.max.toFixed(2)}], Avg: ${col.stats.avg.toFixed(2)}`
      }

      // Add unique values and null info
      info += ` | ${col.uniqueValues} unique values`
      if (col.nullPercentage > 0) {
        info += `, ${col.nullPercentage.toFixed(1)}% missing`
      }

      // Add suggested usage if available
      if (col.suggestedUsage) {
        info += ` | Suggested use: ${col.suggestedUsage}`
      }

      return info
    })

    // Get a larger sample of the data for better analysis (first 10 rows)
    const sampleData = data.slice(0, Math.min(10, data.length))

    let context = `Dataset Context:
File: ${fileName || schema.fileName || 'Uploaded data'}
Rows: ${schema.rowCount ? schema.rowCount.toLocaleString() : data.length.toLocaleString()}
Columns: ${schema.columnCount || 'Unknown'}
`

    // Add business context if available
    if (schema.businessContext) {
      context += `\nBusiness Context: ${schema.businessContext}\n`
    }

    // Add relationships if detected
    if (schema.relationships && schema.relationships.length > 0) {
      context += `\nDetected Relationships:\n${schema.relationships.join('\n')}\n`
    }

    context += `\nColumn Details:\n${columnInfo.join('\n')}\n\nActual Data Sample (first ${sampleData.length} rows - USE THIS TO CALCULATE REAL ANSWERS):\n${JSON.stringify(sampleData, null, 2)}\n\nIMPORTANT: You have ${data.length} total rows of data. Use the sample above to understand patterns and calculate answers based on the actual values.`

    return context
  }

  // Fallback to basic analysis if no schema
  const columns = Object.keys(data[0] || {})
  const columnInfo = columns.map(col => {
    const values = data.map(row => row[col])
    const nonNullValues = values.filter(v => v !== null && v !== undefined)
    const uniqueValues = new Set(nonNullValues)
    const nullCount = values.length - nonNullValues.length

    // Determine column type
    let type = 'text'
    if (nonNullValues.length > 0) {
      if (nonNullValues.every(v => typeof v === 'number' && !isNaN(v))) {
        type = 'numeric'
      } else if (nonNullValues.every(v => v instanceof Date || (!isNaN(Date.parse(String(v))) && String(v).match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)))) {
        type = 'date'
      } else if (uniqueValues.size < Math.max(10, nonNullValues.length * 0.1)) {
        type = 'categorical'
      }
    }

    // Calculate basic statistics for numeric columns
    let stats = ''
    if (type === 'numeric') {
      const numericValues = nonNullValues.map(v => Number(v)).filter(v => !isNaN(v))
      if (numericValues.length > 0) {
        const min = Math.min(...numericValues)
        const max = Math.max(...numericValues)
        const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        stats = ` (range: ${min.toFixed(2)}-${max.toFixed(2)}, avg: ${avg.toFixed(2)})`
      }
    }

    return `${col} (${type}): ${uniqueValues.size} unique values${stats}${nullCount > 0 ? `, ${nullCount} missing` : ''}`
  })

  // Get a larger sample of the data for better analysis
  const sampleData = data.slice(0, Math.min(10, data.length))

  return `Dataset Context:
File: ${fileName || 'Uploaded data'}
Rows: ${data.length.toLocaleString()}
Columns: ${columns.length}

Column Details:
${columnInfo.join('\n')}

Actual Data Sample (first ${sampleData.length} rows - USE THIS TO CALCULATE REAL ANSWERS):
${JSON.stringify(sampleData, null, 2)}`
}

export const POST = withAuth(async (request, authUser) => {
  try {
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // SECURITY: Use authenticated user ID for rate limiting
    const clientId = authUser.uid

    // Check rate limit per authenticated user
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse request body
    const { message, data, dataSchema, fileName, conversationHistory, preferredChartType, selectedChart, granularity } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Generate data context with schema if available
    const dataContext = generateDataContext(data, dataSchema, fileName)

    // Prepare conversation messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are an expert data scientist assistant helping users analyze their uploaded data. You have access to the following dataset:

${dataContext}

${selectedChart ? `\nThe user has selected a specific chart to discuss:
- Chart Title: ${selectedChart.title}
- Chart Type: ${selectedChart.type}
- Data Keys: ${selectedChart.dataKey.join(', ')}
- Description: ${selectedChart.description}

When answering questions, focus on this specific chart unless the user asks about something else.` : ''}

${preferredChartType && preferredChartType !== 'auto' ? `\nThe user wants to create a ${preferredChartType} chart. Help them identify the best columns and configuration for this chart type.` : ''}

Your role is to:
1. ANALYZE THE ACTUAL DATA and provide specific answers with real numbers from the dataset
2. DO NOT explain formulas or how to calculate - just give the answer
3. ALWAYS suggest appropriate visualizations that could help answer the user's question
4. Provide actionable business recommendations based on the actual data
5. If you cannot answer due to missing data, ask clarifying questions
6. Be concise and direct - users want answers, not tutorials

CRITICAL: You have access to the actual data. Analyze it and provide specific answers.

Examples of GOOD vs BAD responses:

BAD: "To calculate ROI, use the formula: (Sales - Spent) / Spent × 100"
GOOD: "Your overall ROI is 156%. Top campaigns: Google Search (245%), Facebook (189%), Instagram (134%)"

BAD: "You can find trends by looking at your data over time"
GOOD: "Sales are trending up 23% month-over-month. Peak performance was in March with $45K revenue"

BAD: "Create a bar chart to compare campaigns"
GOOD: "Your top 3 campaigns by revenue: Google Ads ($12.5K), Facebook ($8.3K), Email ($5.1K). [CHART_SUGGESTION with these values]"

Always give SPECIFIC NUMBERS and NAMES from the actual data.

CRITICAL INSTRUCTION: You MUST generate chart suggestions for ANY request that involves:
- Creating graphs, charts, or visualizations
- Analyzing data patterns or trends  
- Comparing values across categories
- Showing relationships between variables
- Displaying metrics or KPIs
- Day parting analysis (hours vs days)
- Time-based analysis
- Performance comparisons

When suggesting new visualizations, use this EXACT format (each field on ONE line, no extra blank lines):
**CHART_SUGGESTION**
Type: bar
Title: Campaign Profitability - ROI
Columns: Campaign, Sales, Spent
Description: This bar chart shows the ROI percentage for each campaign.
**END_SUGGESTION**

IMPORTANT:
- Put each field (Type, Title, Columns, Description) on a SINGLE line
- Do NOT add blank lines between fields
- Keep the format compact

Available chart types: line, bar, pie, area, scatter, scorecard

SPECIFIC RULES:
- For "day parting" or "best days vs hours" questions: Create a heatmap visualization using a scatter chart with day on one axis and hour on the other, or suggest multiple charts (one for days, one for hours)
- For time-based performance: Use line charts for trends over time
- For categorical comparisons: Use bar charts
- For proportions: Use pie charts
- For correlations: Use scatter plots
- For single metrics: Use scorecards

Guidelines:
- Be conversational and helpful
- Provide specific, actionable insights
- Reference actual column names and data values from the dataset
- ALWAYS include at least one CHART_SUGGESTION when the user asks for any visualization
- If the data doesn't have the exact columns requested, suggest the closest available alternatives
- Keep responses concise but comprehensive
- If you cannot answer based on the available data, explain what additional information would be needed

Current conversation context: The user is asking about their uploaded dataset.`
      }
    ]

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory.slice(-10)) // Keep last 10 messages for context
    }

    // Add current user message
    messages.push({
      role: "user",
      content: message
    })

    // Check if client wants streaming response
    const wantsStreaming = request.headers.get('accept')?.includes('text/event-stream')

    // Get OpenAI client and call API
    const openai = getOpenAIClient()
    
    if (wantsStreaming) {
      // Streaming response
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_completion_tokens: 1500,
        stream: true
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                const data = `data: ${JSON.stringify({ content, timestamp: new Date().toISOString() })}\n\n`
                controller.enqueue(encoder.encode(data))
              }
            }
            // Send final event
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        }
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    } else {
      // Non-streaming response (fallback)
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_completion_tokens: 1500,
        stream: false
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from OpenAI')
      }

      return NextResponse.json({
        message: response,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    // Enhanced error logging
    console.error('❌ [CHAT API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
      fullError: error
    })

    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API is not configured properly' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Chat request failed',
        details: 'Please try again or rephrase your question'
      },
      { status: 500 }
    )
  }
})

// For streaming support (optional enhancement)
export const GET = withAuth(async (request, authUser) => {
  return NextResponse.json(
    { error: 'Use POST method for chat messages' },
    { status: 405 }
  )
})