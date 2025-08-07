import { DataRow, AnalysisResult, ChatMessage } from '@/lib/store'

export interface ChatResponse {
  message: string
  timestamp: string
  chartSuggestions?: ChartSuggestion[]
  actionableInsights?: string[]
}

export interface ChartSuggestion {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard'
  title: string
  dataKey: string[]
  description: string
  reason: string
}

export async function sendChatMessage(
  message: string,
  data: DataRow[],
  fileName: string | null,
  conversationHistory: ChatMessage[],
  useStreaming: boolean = true
): Promise<ChatResponse | ReadableStream> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(useStreaming && { 'Accept': 'text/event-stream' }),
    },
    body: JSON.stringify({
      message,
      data,
      fileName,
      conversationHistory: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    })
  })

  if (!response.ok) {
    throw new Error(response.status === 429 
      ? 'Too many requests. Please wait a moment before trying again.'
      : 'Failed to get response from AI assistant'
    )
  }

  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('text/event-stream')) {
    return response.body as ReadableStream
  } else {
    const data = await response.json()
    return {
      message: data.message,
      timestamp: data.timestamp,
      chartSuggestions: data.chartSuggestions,
      actionableInsights: data.actionableInsights
    }
  }
}

export function parseStreamingResponse(
  stream: ReadableStream,
  onChunk: (content: string) => void,
  onComplete: (fullMessage: string) => void,
  onError: (error: Error) => void
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let accumulatedContent = ''

  const readChunk = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              onComplete(accumulatedContent)
              return
            } else {
              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  accumulatedContent += parsed.content
                  onChunk(accumulatedContent)
                }
              } catch (e) {
                // Ignore parsing errors for individual chunks
              }
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Streaming error'))
    } finally {
      reader.releaseLock()
    }
  }

  readChunk()
}

// Utility function to detect if a message contains chart suggestions
export function extractChartSuggestions(message: string): ChartSuggestion[] {
  const suggestions: ChartSuggestion[] = []
  
  // Debug logging
  console.log('Extracting chart suggestions from message:', message)
  
  // First, look for the new structured format
  const structuredRegex = /\*\*CHART_SUGGESTION\*\*[\s\S]*?Type:\s*(\w+)[\s\S]*?Title:\s*(.+?)[\s\S]*?Columns:\s*(.+?)[\s\S]*?Description:\s*(.+?)[\s\S]*?\*\*END_SUGGESTION\*\*/g
  
  let match
  while ((match = structuredRegex.exec(message)) !== null) {
    const [_, type, title, columns, description] = match
    const columnList = columns.split(',').map(c => c.trim()).filter(c => c.length > 0)
    
    // Validate the extracted data
    if (type && title && title.trim().length > 1 && columnList.length > 0) {
      suggestions.push({
        type: type.toLowerCase() as any,
        title: title.trim(),
        dataKey: columnList,
        description: description?.trim() || `${type} chart visualization`,
        reason: 'AI suggested this visualization based on your request'
      })
    }
  }
  
  // If no structured suggestions found, fall back to pattern matching
  if (suggestions.length === 0) {
    // Look for patterns that suggest chart recommendations
    const chartPatterns = [
      {
        regex: /create.*(?:line chart|line graph|trend chart).*for\s+(\w+)/gi,
        type: 'line' as const
      },
      {
        regex: /create.*(?:bar chart|bar graph|column chart).*for\s+(\w+)/gi,
        type: 'bar' as const
      },
      {
        regex: /create.*(?:pie chart|pie graph|donut chart).*for\s+(\w+)/gi,
        type: 'pie' as const
      },
      {
        regex: /create.*(?:scatter plot|scatter chart).*(?:for|between)\s+(\w+)/gi,
        type: 'scatter' as const
      },
      {
        regex: /create.*(?:area chart|area graph).*for\s+(\w+)/gi,
        type: 'area' as const
      },
      {
        regex: /create.*(?:scorecard|kpi card|metric card).*for\s+(\w+)/gi,
        type: 'scorecard' as const
      }
    ]

    for (const pattern of chartPatterns) {
      const matches = Array.from(message.matchAll(pattern.regex))
      for (const match of matches) {
        if (match[1] && match[1].length > 1) {
          suggestions.push({
            type: pattern.type,
            title: `${pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)} Chart for ${match[1]}`,
            dataKey: [match[1]],
            description: `Recommended ${pattern.type} chart based on conversation context`,
            reason: 'AI suggested this visualization based on your question'
          })
        }
      }
    }
  }

  // Filter out any invalid suggestions
  const validSuggestions = suggestions.filter(s => 
    s.title && 
    s.title.length > 2 && 
    s.dataKey && 
    s.dataKey.length > 0 &&
    s.dataKey.every(key => key && key.length > 0)
  )
  
  console.log('Valid suggestions found:', validSuggestions)
  
  return validSuggestions
}

// Utility function to generate contextual follow-up questions
export function generateFollowUpQuestions(
  message: string,
  analysis: AnalysisResult | null
): string[] {
  const followUps: string[] = []
  
  if (!analysis) return followUps
  
  const numericColumns = analysis.summary.columns.filter(col => col.type === 'number')
  const categoricalColumns = analysis.summary.columns.filter(col => 
    col.type === 'string' && col.uniqueValues < 20
  )
  
  // Generate contextual follow-ups based on the current message
  if (message.toLowerCase().includes('trend')) {
    if (numericColumns.length > 1) {
      followUps.push(`How do ${numericColumns[0].name} and ${numericColumns[1].name} correlate?`)
    }
    followUps.push('What factors might be driving these trends?')
  }
  
  if (message.toLowerCase().includes('performance') || message.toLowerCase().includes('best')) {
    followUps.push('What actionable insights can we derive from this performance data?')
    if (categoricalColumns.length > 0) {
      followUps.push(`Are there any underperforming ${categoricalColumns[0].name} categories we should focus on?`)
    }
  }
  
  if (message.toLowerCase().includes('forecast') || message.toLowerCase().includes('predict')) {
    followUps.push('What assumptions should we consider for this forecast?')
    followUps.push('How confident are we in these predictions?')
  }
  
  return followUps.slice(0, 3) // Limit to 3 follow-ups
}