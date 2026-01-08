import { NextRequest, NextResponse } from 'next/server'
import type { DataRow, DataSchema } from '@/lib/store'
import { withAuth } from '@/lib/middleware/auth'
import { validateRequest, chatRequestSchema } from '@/lib/utils/api-validation'
import {
  getAIProvider,
  generateCompletion,
  generateStreamingCompletion,
  type AIMessage
} from '@/lib/services/ai/ai-provider'

const isDev = process.env.NODE_ENV === 'development'
const log = (...args: unknown[]) => { if (isDev) console.log(...args) }

// Note: Rate limiting is now handled by withRateLimit middleware (see bottom of file)

function generateDataContext(data: DataRow[], schema: DataSchema | null, fileName: string | null) {
  if (!data || data.length === 0) {
    return "No data is currently loaded."
  }

  // Get column names from data - this is the authoritative list
  const availableColumns = Object.keys(data[0] || {})

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

⚠️ AVAILABLE COLUMNS (USE ONLY THESE EXACT NAMES):
${availableColumns.map(col => `• ${col}`).join('\n')}
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
  const columns = availableColumns
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

⚠️ AVAILABLE COLUMNS (USE ONLY THESE EXACT NAMES):
${availableColumns.map(col => `• ${col}`).join('\n')}

Column Details:
${columnInfo.join('\n')}

Actual Data Sample (first ${sampleData.length} rows - USE THIS TO CALCULATE REAL ANSWERS):
${JSON.stringify(sampleData, null, 2)}`
}

export const POST = withAuth(async (request, authUser) => {
  try {
    // Check API key based on provider
    const aiProvider = getAIProvider()
    const hasApiKey = aiProvider === 'gemini'
      ? !!process.env.GOOGLE_GEMINI_API_KEY
      : !!process.env.OPENAI_API_KEY

    if (!hasApiKey) {
      return NextResponse.json(
        { error: `${aiProvider.toUpperCase()} API key not configured` },
        { status: 500 }
      )
    }

    // Note: Rate limiting is handled by withRateLimit middleware

    // Check chat message limit (paywall)
    const { canSendChatMessage, incrementChatCount, resetChatCountIfNeeded } = await import('@/lib/services/subscription-service')

    // Reset count if new month
    await resetChatCountIfNeeded(authUser.uid)

    const chatCheck = await canSendChatMessage(authUser.uid)
    if (!chatCheck.allowed) {
      log('[CHAT API] Chat limit reached:', {
        userId: authUser.uid,
        used: chatCheck.used,
        limit: chatCheck.limit
      })

      return NextResponse.json(
        {
          error: 'Chat message limit reached',
          code: 'CHAT_LIMIT_REACHED',
          type: 'paywall',
          message: chatCheck.message,
          usage: {
            used: chatCheck.used,
            limit: chatCheck.limit,
            remaining: chatCheck.remaining,
            plan: chatCheck.plan
          },
          upgradeUrl: '/account/billing'
        },
        { status: 402 }
      )
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, chatRequestSchema)
    if (!validation.success) {
      return validation.response
    }

    const { message, data, dataSchema, fileName, conversationHistory, preferredChartType, selectedChart, granularity, dashboardFilters } = validation.data

    // Generate data context with schema if available
    const dataContext = generateDataContext((data || []) as DataRow[], (dataSchema ?? null) as DataSchema | null, fileName ?? null)

    // Prepare conversation messages
    const messages: AIMessage[] = [
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

${dashboardFilters && dashboardFilters.length > 0 ? `
ACTIVE DASHBOARD FILTERS:
The following filters are currently applied to the dashboard:
${dashboardFilters.map((f) => `- ${f.column} ${f.operator} ${JSON.stringify(f.value ?? '')}`).join('\n')}

IMPORTANT FILTERING CONTEXT:
- The data you're analyzing may be filtered. Consider the filtered context in your analysis.
- The dashboard supports inline filtering on ALL chart fields:
  * Text/Categorical fields: Multi-select specific items (like Excel filtering)
  * Date fields: Aggregate by week, month, or year
  * Numeric fields: Filter by value ranges
- Users can apply filters directly within each chart's data mapping fields
- When suggesting new charts, you can recommend filters to focus the analysis
` : `
FILTERING CAPABILITIES:
The dashboard supports inline filtering on ALL chart fields:
- Text/Categorical fields: Multi-select specific items (like Excel filtering)
- Date fields: Aggregate by week, month, or year
- Numeric fields: Filter by value ranges
- Users can apply filters directly within each chart's data mapping fields
- You can suggest filters when recommending charts to focus the analysis
`}

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

⚠️ CRITICAL - COLUMN NAMES RULE:
- The "Columns:" field MUST contain ONLY exact column names from the "AVAILABLE COLUMNS" list above
- DO NOT invent, rename, or modify column names (e.g., don't use "Total Income" if column is named "Income")
- DO NOT use spaces or change capitalization
- Copy column names EXACTLY as they appear in the available columns list
- If you're unsure about a column name, refer back to the AVAILABLE COLUMNS list

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

    log(`[CHAT API] Using ${aiProvider} provider, streaming: ${wantsStreaming}`)

    if (wantsStreaming) {
      // Increment chat count for streaming response (count at start since we can't await after streaming)
      await incrementChatCount(authUser.uid)

      // Streaming response using AI provider abstraction
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const stream = generateStreamingCompletion(messages, {
              temperature: 0.7,
              maxTokens: 1500
            })

            for await (const chunk of stream) {
              if (chunk.content) {
                const data = `data: ${JSON.stringify({ content: chunk.content, timestamp: new Date().toISOString() })}\n\n`
                controller.enqueue(encoder.encode(data))
              }
              if (chunk.done) {
                break
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
      // Non-streaming response using AI provider abstraction
      const response = await generateCompletion(messages, {
        temperature: 0.7,
        maxTokens: 1500
      })

      if (!response) {
        throw new Error(`No response from ${aiProvider.toUpperCase()}`)
      }

      // Increment chat count after successful non-streaming response
      await incrementChatCount(authUser.uid)

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
        { error: 'AI API is not configured properly' },
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