# AI Chat System - Implementation Guide

## Quick Start Implementation

This guide provides step-by-step instructions for implementing the chat system described in `CHAT_BACKEND_ARCHITECTURE.md`.

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

#### 1.1 Update Database Schema

Add new fields to the Prisma schema:

```bash
# prisma/schema.prisma
```

```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  role      String   // 'user' | 'assistant' | 'system'
  content   String
  metadata  String?  // JSON metadata

  // NEW FIELDS
  tokenCount     Int?      // Tokens in this message
  suggestions    String?   // JSON array of ChartSuggestion[]
  appliedCharts  String?   // JSON array of chart IDs

  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@map("chat_messages")
}

model ChatContextSnapshot {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  dataDigest        String
  conversationPhase String
  keyTopics         String
  contextSummary    String

  @@index([sessionId])
  @@map("chat_context_snapshots")
}
```

Run migrations:

```bash
npx prisma migrate dev --name add_chat_enhancements
npx prisma generate
```

---

#### 1.2 Create Type Definitions

Create `lib/types/chat.ts`:

```typescript
// lib/types/chat.ts

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    suggestions?: ChartSuggestion[]
    appliedCharts?: string[]
    confidence?: number
  }
}

export interface ChartSuggestion {
  id: string
  type: ChartType
  title: string
  description: string
  confidence: number
  reasoning: string
  dataTransform?: DataTransform
  chartConfig: ChartConfig
  tableConfig?: TableConfig
  priority: 'high' | 'medium' | 'low'
  tags: string[]
}

export interface DataTransform {
  filter?: FilterCondition[]
  orderBy?: OrderByCondition[]
  limit?: number
  columns?: ColumnTransform[]
  groupBy?: string[]
  aggregations?: AggregationCondition[]
}

export interface FilterCondition {
  column: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'is_null'
  value: any
}

export interface OrderByCondition {
  column: string
  direction: 'asc' | 'desc'
}

export interface ColumnTransform {
  name: string
  expression: string
  alias: string
}

export interface AggregationCondition {
  column: string
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct' | 'median' | 'std'
  alias?: string
  percentile?: number
}

export interface ChartConfig {
  xAxis?: string
  yAxis?: string | string[]
  category?: string
  value?: string
}

export interface TableConfig {
  columns: Array<{
    key: string
    label: string
    type: 'text' | 'number' | 'currency' | 'percentage'
    sortable?: boolean
    format?: string
  }>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  pagination?: boolean
  pageSize?: number
}

export type ChartType =
  | 'line' | 'bar' | 'pie' | 'area' | 'scatter'
  | 'scorecard' | 'table' | 'waterfall' | 'funnel'
  | 'heatmap' | 'gauge' | 'combo'

export interface ConversationContext {
  messages: ChatMessage[]
  totalTokens: number
  snapshot?: {
    conversationPhase: string
    keyTopics: string[]
    contextSummary: string
  }
}

export interface OptimizedContext {
  systemPrompt: string
  messages: ChatMessage[]
  dataContext: string
  totalTokens: number
}

export interface DataContext {
  fileName: string
  rowCount: number
  columnCount: number
  columns: ColumnSchema[]
  businessDomain?: string
  businessContext?: string
  keyEntities?: Array<{ name: string, description: string }>
  timeGranularity: 'none' | 'day' | 'week' | 'month' | 'quarter' | 'year'
}

export interface ColumnSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'categorical'
  uniqueValues: number
  nullCount: number
  nullPercentage: number
  description?: string
  suggestedUsage?: string[]
  stats?: {
    min?: number
    max?: number
    avg?: number
    median?: number
    std?: number
  }
}

export interface ChatAnalysisResponse {
  content: string
  suggestions: ChartSuggestion[]
  insights: string[]
  followUpQuestions: string[]
  requiresAction: boolean
}
```

---

#### 1.3 Create LLM Service Wrapper

Create `lib/services/llm-service.ts`:

```typescript
// lib/services/llm-service.ts

interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface LLMResponse {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class LLMService {
  private apiKey: string
  private baseURL: string

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.baseURL = 'https://api.openai.com/v1'

    if (!this.apiKey) {
      console.warn('OPENAI_API_KEY not set - LLM features will be unavailable')
    }
  }

  async chat(
    messages: LLMMessage[],
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4000,
        stream: options.stream ?? false,
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()

    return {
      content: data.choices[0].message.content,
      usage: data.usage
    }
  }

  async *chatStream(
    messages: LLMMessage[],
    options: LLMOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 4000,
        stream: true,
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices[0]?.delta?.content
              if (content) {
                yield content
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }
}

export const llmService = new LLMService()
```

---

### Phase 2: Core Chat Service (Week 2)

#### 2.1 Create Chat Analysis Service

Create `lib/services/chat-analysis-service.ts`:

```typescript
// lib/services/chat-analysis-service.ts

import { llmService } from './llm-service'
import { ChatMessage, ChatAnalysisResponse, ChartSuggestion, DataContext } from '@/lib/types/chat'
import { DataRow } from '@/lib/store'

const SYSTEM_PROMPT = `You are an expert data analyst assistant helping users understand their data through natural language.

CAPABILITIES:
- Analyze data patterns, trends, and anomalies
- Recommend appropriate visualizations
- Answer questions about specific metrics and dimensions
- Provide actionable business insights

RESPONSE FORMAT:
1. Directly answer the user's question (2-3 sentences)
2. Provide 2-3 specific insights from the data
3. Recommend 1-2 visualizations using the CHART_SUGGESTION format
4. Suggest 1-2 follow-up questions

CHART_SUGGESTION FORMAT (use JSON code blocks):
\`\`\`json
{
  "id": "unique_id",
  "type": "line|bar|pie|scatter|table|scorecard|area",
  "title": "Clear, specific title",
  "description": "What this chart shows",
  "confidence": 0.85,
  "reasoning": "Why this visualization is appropriate",
  "chartConfig": {
    "xAxis": "column_name",
    "yAxis": ["metric1", "metric2"]
  },
  "priority": "high|medium|low",
  "tags": ["category1", "category2"]
}
\`\`\`

GUIDELINES:
- Be concise and specific
- Use actual column names from the data
- Highlight unexpected patterns or outliers
- Provide business context when possible
- Always validate that referenced columns exist
`

export class ChatAnalysisService {

  async analyzeQuery(
    query: string,
    data: DataRow[],
    dataContext: DataContext,
    conversationHistory: ChatMessage[]
  ): Promise<ChatAnalysisResponse> {

    // Build system prompt with data context
    const systemPrompt = this.buildSystemPrompt(dataContext)

    // Build conversation history
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user' as const, content: query }
    ]

    // Call LLM
    const response = await llmService.chat(messages, {
      temperature: 0.3,
      max_tokens: 2000
    })

    // Parse response
    const suggestions = this.extractSuggestions(response.content)
    const insights = this.extractInsights(response.content)
    const followUpQuestions = this.extractFollowUpQuestions(response.content)

    return {
      content: this.cleanResponse(response.content),
      suggestions,
      insights,
      followUpQuestions,
      requiresAction: this.detectActionableRequest(query)
    }
  }

  async *analyzeQueryStream(
    query: string,
    data: DataRow[],
    dataContext: DataContext,
    conversationHistory: ChatMessage[],
    callbacks: {
      onChunk: (chunk: string) => void
      onSuggestion: (suggestion: ChartSuggestion) => void
      onComplete: () => void
    }
  ): AsyncGenerator<string, void, unknown> {

    const systemPrompt = this.buildSystemPrompt(dataContext)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user' as const, content: query }
    ]

    let fullContent = ''

    try {
      for await (const chunk of llmService.chatStream(messages)) {
        fullContent += chunk
        callbacks.onChunk(chunk)
        yield chunk

        // Try to extract suggestions as they come in
        const suggestions = this.extractSuggestions(fullContent)
        suggestions.forEach(s => callbacks.onSuggestion(s))
      }

      callbacks.onComplete()
    } catch (error) {
      console.error('Streaming error:', error)
      throw error
    }
  }

  private buildSystemPrompt(dataContext: DataContext): string {
    let prompt = SYSTEM_PROMPT

    prompt += `\n\nCURRENT DATA CONTEXT:\n`
    prompt += `Dataset: ${dataContext.fileName}\n`
    prompt += `Domain: ${dataContext.businessDomain || 'General'}\n`
    prompt += `Rows: ${dataContext.rowCount.toLocaleString()}\n`
    prompt += `Columns (${dataContext.columnCount}):\n`

    dataContext.columns.forEach(col => {
      prompt += `  - ${col.name} (${col.type})`
      if (col.description) prompt += ` - ${col.description}`
      if (col.stats) {
        prompt += ` [range: ${col.stats.min} to ${col.stats.max}]`
      }
      prompt += `\n`
    })

    if (dataContext.businessContext) {
      prompt += `\nBUSINESS CONTEXT:\n${dataContext.businessContext}\n`
    }

    return prompt
  }

  private extractSuggestions(content: string): ChartSuggestion[] {
    const suggestions: ChartSuggestion[] = []

    // Extract JSON blocks
    const jsonMatches = content.match(/```json\n([\s\S]*?)\n```/g)

    if (jsonMatches) {
      jsonMatches.forEach((match, index) => {
        const jsonContent = match.replace(/```json\n/, '').replace(/\n```/, '')
        try {
          const suggestion = JSON.parse(jsonContent)
          if (suggestion.type && suggestion.title) {
            suggestions.push({
              ...suggestion,
              id: suggestion.id || `suggestion_${Date.now()}_${index}`
            })
          }
        } catch (e) {
          console.warn('Failed to parse suggestion JSON:', e)
        }
      })
    }

    return suggestions
  }

  private extractInsights(content: string): string[] {
    // Look for numbered lists or bullet points
    const insights: string[] = []

    const lines = content.split('\n')
    for (const line of lines) {
      // Match lines starting with numbers or bullets
      if (/^\d+\.|^[-*•]/.test(line.trim())) {
        const insight = line.replace(/^\d+\.|^[-*•]/, '').trim()
        if (insight.length > 10) {
          insights.push(insight)
        }
      }
    }

    return insights.slice(0, 5)
  }

  private extractFollowUpQuestions(content: string): string[] {
    // Simple heuristic: look for lines ending with '?'
    const questions: string[] = []

    const lines = content.split('\n')
    for (const line of lines) {
      if (line.trim().endsWith('?')) {
        questions.push(line.trim())
      }
    }

    return questions.slice(0, 3)
  }

  private cleanResponse(content: string): string {
    // Remove JSON blocks from the main response
    return content.replace(/```json[\s\S]*?```/g, '').trim()
  }

  private detectActionableRequest(query: string): boolean {
    const actionWords = ['create', 'add', 'show', 'generate', 'make', 'build', 'display']
    return actionWords.some(word => query.toLowerCase().includes(word))
  }
}

export const chatAnalysisService = new ChatAnalysisService()
```

---

#### 2.2 Create API Route

Create `app/api/sessions/[id]/chat/analyze/route.ts`:

```typescript
// app/api/sessions/[id]/chat/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { chatAnalysisService } from '@/lib/services/chat-analysis-service'
import { db } from '@/lib/db'
import { ChatMessage, ChartSuggestion } from '@/lib/types/chat'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const body = await request.json()
    const { message, options = {} } = body

    // Validate message
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      )
    }

    // Get session and data
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        uploadedFiles: true,
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get data
    const file = session.uploadedFiles[0]
    if (!file) {
      return NextResponse.json(
        { error: 'No data uploaded for this session' },
        { status: 400 }
      )
    }

    const data = JSON.parse(file.parsedData)
    const dataSchema = JSON.parse(file.dataSchema || '{}')

    // Get conversation history
    const conversationHistory: ChatMessage[] = session.chatMessages
      .reverse()
      .map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.createdAt.toISOString()
      }))

    // Build data context
    const dataContext = {
      fileName: file.originalName,
      rowCount: dataSchema.rowCount || data.length,
      columnCount: dataSchema.columnCount || Object.keys(data[0] || {}).length,
      columns: dataSchema.columns || [],
      businessDomain: dataSchema.businessContext,
      timeGranularity: 'day' as const
    }

    const streaming = options.streaming ?? true

    if (streaming) {
      // Streaming response
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullContent = ''
            const suggestions: ChartSuggestion[] = []

            for await (const chunk of chatAnalysisService.analyzeQueryStream(
              message,
              data.slice(0, 1000), // Limit data for performance
              dataContext,
              conversationHistory,
              {
                onChunk: (chunk) => {
                  fullContent += chunk
                  controller.enqueue(
                    encoder.encode(`event: message_chunk\ndata: ${JSON.stringify({ content: chunk })}\n\n`)
                  )
                },
                onSuggestion: (suggestion) => {
                  if (!suggestions.find(s => s.id === suggestion.id)) {
                    suggestions.push(suggestion)
                    controller.enqueue(
                      encoder.encode(`event: suggestion_complete\ndata: ${JSON.stringify({ suggestion })}\n\n`)
                    )
                  }
                },
                onComplete: async () => {
                  // Save messages
                  await db.chatMessage.create({
                    data: {
                      sessionId,
                      role: 'user',
                      content: message,
                      tokenCount: Math.ceil(message.length / 4)
                    }
                  })

                  await db.chatMessage.create({
                    data: {
                      sessionId,
                      role: 'assistant',
                      content: fullContent,
                      tokenCount: Math.ceil(fullContent.length / 4),
                      suggestions: JSON.stringify(suggestions)
                    }
                  })

                  controller.enqueue(
                    encoder.encode(`event: message_complete\ndata: ${JSON.stringify({
                      totalSuggestions: suggestions.length
                    })}\n\n`)
                  )

                  controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`))
                  controller.close()
                }
              }
            )) {
              // Chunks are handled in callbacks
            }
          } catch (error) {
            console.error('Stream error:', error)
            controller.error(error)
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })

    } else {
      // Non-streaming response
      const response = await chatAnalysisService.analyzeQuery(
        message,
        data.slice(0, 1000),
        dataContext,
        conversationHistory
      )

      // Save messages
      await db.chatMessage.create({
        data: {
          sessionId,
          role: 'user',
          content: message,
        }
      })

      await db.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: response.content,
          suggestions: JSON.stringify(response.suggestions)
        }
      })

      return NextResponse.json({
        content: response.content,
        suggestions: response.suggestions,
        insights: response.insights,
        followUpQuestions: response.followUpQuestions
      })
    }

  } catch (error) {
    console.error('Chat analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze message' },
      { status: 500 }
    )
  }
}
```

---

### Phase 3: Frontend Integration (Week 3)

#### 3.1 Create Chat Hook

Create `lib/hooks/use-chat-analysis.ts`:

```typescript
// lib/hooks/use-chat-analysis.ts

import { useState, useCallback } from 'react'
import { ChatMessage, ChartSuggestion } from '@/lib/types/chat'

export function useChatAnalysis(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [suggestions, setSuggestions] = useState<ChartSuggestion[]>([])

  const sendMessage = useCallback(async (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setCurrentResponse('')

    try {
      const response = await fetch(`/api/sessions/${sessionId}/chat/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          options: { streaming: true }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullContent = ''
      const receivedSuggestions: ChartSuggestion[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.slice(7)
            const nextLine = lines[lines.indexOf(line) + 1]

            if (nextLine?.startsWith('data: ')) {
              const data = JSON.parse(nextLine.slice(6))

              if (event === 'message_chunk') {
                fullContent += data.content
                setCurrentResponse(fullContent)
              } else if (event === 'suggestion_complete') {
                receivedSuggestions.push(data.suggestion)
                setSuggestions([...receivedSuggestions])
              } else if (event === 'done') {
                const assistantMessage: ChatMessage = {
                  id: `msg_${Date.now()}_assistant`,
                  role: 'assistant',
                  content: fullContent,
                  timestamp: new Date().toISOString(),
                  metadata: { suggestions: receivedSuggestions }
                }
                setMessages(prev => [...prev, assistantMessage])
                setCurrentResponse('')
                setIsLoading(false)
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Error sending message:', error)
      setIsLoading(false)
    }
  }, [sessionId])

  return {
    messages,
    isLoading,
    currentResponse,
    suggestions,
    sendMessage
  }
}
```

---

## Testing

### Unit Tests

```typescript
// __tests__/lib/services/chat-analysis-service.test.ts

import { describe, it, expect } from '@jest/globals'
import { ChatAnalysisService } from '@/lib/services/chat-analysis-service'

describe('ChatAnalysisService', () => {
  const service = new ChatAnalysisService()

  it('should extract suggestions from response', () => {
    const response = `Here's the analysis:

\`\`\`json
{
  "id": "test_1",
  "type": "line",
  "title": "Sales Over Time",
  "description": "Shows sales trend",
  "confidence": 0.9,
  "reasoning": "Time series data detected",
  "chartConfig": { "xAxis": "date", "yAxis": ["sales"] },
  "priority": "high",
  "tags": ["trends"]
}
\`\`\`
`

    const suggestions = service['extractSuggestions'](response)

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('line')
    expect(suggestions[0].title).toBe('Sales Over Time')
  })
})
```

---

## Deployment Checklist

- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Run database migrations
- [ ] Test streaming endpoints
- [ ] Monitor API rate limits
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure CORS if needed
- [ ] Test with production data volumes
- [ ] Set up monitoring dashboards

---

## Common Issues & Solutions

### Issue: Streaming not working
**Solution:** Check that your hosting platform supports Server-Sent Events (SSE). Vercel, Netlify, and most modern platforms support this.

### Issue: Context too large
**Solution:** Implement the context optimization strategies from the architecture doc. Start by reducing sample data size.

### Issue: Rate limits hit
**Solution:** Implement caching for common queries and add rate limiting per user/session.

### Issue: Slow responses
**Solution:** Use `gpt-4o-mini` for faster responses where accuracy isn't critical. Cache data summaries.

---

## Next Steps

After implementing the basic chat functionality:

1. Add contextual prompt generation
2. Implement suggestion application to dashboard
3. Add conversation compression for long sessions
4. Implement semantic search for history
5. Add analytics tracking

For questions, refer to `CHAT_BACKEND_ARCHITECTURE.md` for detailed technical specifications.
