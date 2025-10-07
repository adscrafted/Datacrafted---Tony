# DataCrafted Chat Backend Integration - Complete Documentation

## Executive Summary

**Status**: ✅ **FULLY INTEGRATED AND PRODUCTION-READY**

The chat functionality in DataCrafted is **already completely built** and integrated. No additional backend work is needed. This document serves as a comprehensive reference for understanding and maintaining the chat system.

## Architecture Overview

```
┌─────────────────┐
│   Chat UI       │  components/dashboard/chat/chat-interface.tsx
│  (Already Built)│  - Message display with streaming support
└────────┬────────┘  - Chart suggestions rendering
         │           - Example questions
         │
         ▼
┌─────────────────┐
│  Zustand Store  │  lib/store.ts
│  (Chat State)   │  - chatMessages: ChatMessage[]
└────────┬────────┘  - isChatOpen, isChatLoading, chatError
         │           - addChatMessage(), clearChatHistory()
         │
         ▼
┌─────────────────┐
│  Chat Service   │  lib/services/chat-service.ts
│   (API Layer)   │  - sendChatMessage()
└────────┬────────┘  - parseStreamingResponse()
         │           - extractChartSuggestions()
         │
         ▼
┌─────────────────┐
│   API Endpoint  │  app/api/chat/route.ts
│  (Backend)      │  - Streaming SSE support
└────────┬────────┘  - Rate limiting (30 req/hour)
         │           - OpenAI GPT-4 Turbo integration
         │           - Schema-aware context generation
         │
         ▼
┌─────────────────┐
│   OpenAI API    │  GPT-4 Turbo Preview
│                 │  - Temperature: 0.7
└─────────────────┘  - Max Tokens: 1500
```

## File Structure

### 1. API Endpoint (Backend)
**File**: `/app/api/chat/route.ts`

**Purpose**: Handles all chat requests with OpenAI integration

**Key Features**:
- ✅ Streaming Server-Sent Events (SSE) support
- ✅ Non-streaming fallback for compatibility
- ✅ Rate limiting (30 requests/hour per client IP)
- ✅ Schema-aware data context generation
- ✅ Conversation history management (last 10 messages)
- ✅ Selected chart context awareness
- ✅ Preferred chart type handling

**API Contract**:
```typescript
// REQUEST
POST /api/chat
Content-Type: application/json
Accept: text/event-stream (optional, for streaming)

{
  message: string,                    // User's question
  data: DataRow[],                    // Dataset rows
  dataSchema?: DataSchema,            // Enhanced schema with stats
  fileName?: string,                  // Original file name
  conversationHistory?: Array<{       // Chat history (last 10 msgs)
    role: 'user' | 'assistant',
    content: string
  }>,
  selectedChart?: {                   // Currently selected chart
    id: string,
    title: string,
    type: string,
    dataKey: string[],
    description: string
  },
  preferredChartType?: string,        // User's chart type preference
  granularity?: string                // Time granularity (day/week/month)
}

// RESPONSE (Streaming)
Content-Type: text/event-stream

data: {"content":"chunk1","timestamp":"2025-..."}

data: {"content":"chunk2","timestamp":"2025-..."}

data: [DONE]


// RESPONSE (Non-streaming fallback)
Content-Type: application/json

{
  message: string,
  timestamp: string
}
```

**Configuration**:
- Model: `gpt-4-turbo-preview`
- Temperature: `0.7` (balanced creativity)
- Max Tokens: `1500` (reasonable for chat)
- Rate Limit: `30 requests/hour per IP`

### 2. Zustand Store (State Management)
**File**: `/lib/store.ts`

**Chat State**:
```typescript
interface DataStore {
  // Chat state
  chatMessages: ChatMessage[]         // All messages in conversation
  isChatOpen: boolean                // Sidebar visibility (not used in current UI)
  isChatLoading: boolean             // Loading indicator
  chatError: string | null           // Error message display

  // Chat actions
  addChatMessage: (message: ChatMessage) => void
  setChatMessages: (messages: ChatMessage[]) => void
  setIsChatOpen: (isOpen: boolean) => void
  setIsChatLoading: (isLoading: boolean) => void
  setChatError: (error: string | null) => void
  clearChatHistory: () => void
  saveChatMessage: (message: ChatMessage) => Promise<void>  // Persistence
}

interface ChatMessage {
  id: string                          // Unique message ID
  role: 'user' | 'assistant'          // Message sender
  content: string                     // Message text
  timestamp: string                   // ISO timestamp
}
```

**Integration Points**:
- Messages are automatically persisted to Zustand's persist middleware
- Messages can be saved to server via `saveChatMessage()` (requires session)
- No additional state management needed - it's all there!

### 3. Chat Service Layer
**File**: `/lib/services/chat-service.ts`

**Purpose**: Abstracts API communication logic

**Key Functions**:

#### `sendChatMessage()`
```typescript
async function sendChatMessage(
  message: string,
  data: DataRow[],
  fileName: string | null,
  conversationHistory: ChatMessage[],
  useStreaming: boolean = true
): Promise<ChatResponse | ReadableStream>
```

Sends message to chat API with automatic streaming detection.

#### `parseStreamingResponse()`
```typescript
function parseStreamingResponse(
  stream: ReadableStream,
  onChunk: (content: string) => void,
  onComplete: (fullMessage: string) => void,
  onError: (error: Error) => void
): void
```

Handles SSE stream parsing with callbacks.

#### `extractChartSuggestions()`
```typescript
function extractChartSuggestions(message: string): ChartSuggestion[]
```

Parses AI response to extract structured chart recommendations:
```
**CHART_SUGGESTION**
Type: bar
Title: Top 10 Products by Revenue
Columns: Product Name, Revenue
Description: Compare revenue across products
**END_SUGGESTION**
```

### 4. Chat UI Components
**File**: `/components/dashboard/chat/chat-interface.tsx`

**Purpose**: Main chat interface with full streaming support

**Features**:
- ✅ Real-time streaming message display
- ✅ Auto-scrolling to bottom on new messages
- ✅ Chart type selector dropdown (11 types)
- ✅ Selected chart context indicator
- ✅ Export chat history to .txt
- ✅ Clear conversation button
- ✅ Loading states and error handling
- ✅ Example questions (when chat is empty)
- ✅ Chart suggestions rendering

**Related Components**:
- `chat-messages.tsx` - Message list renderer
- `example-questions.tsx` - Starter questions based on data
- `chart-suggestions.tsx` - Actionable chart recommendations

## Data Flow

### Complete Request-Response Cycle

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION                                              │
│    - User types message in ChatInterface                         │
│    - Optionally selects chart type from dropdown                 │
│    - Optionally has a chart selected in dashboard                │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. STATE PREPARATION (ChatInterface.handleSendMessage)           │
│    - Create ChatMessage object with user message                 │
│    - Add to store: addChatMessage(userMessage)                   │
│    - Set loading: setIsChatLoading(true)                         │
│    - Clear errors: setChatError(null)                            │
│    - Prepare context from store:                                 │
│      * rawData (full dataset)                                    │
│      * dataSchema (enhanced schema with stats)                   │
│      * fileName (original upload name)                           │
│      * conversationHistory (last messages)                       │
│      * selectedChartId (if chart is selected)                    │
│      * preferredChartType (from dropdown)                        │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. API REQUEST (fetch /api/chat)                                 │
│    - Method: POST                                                │
│    - Headers:                                                    │
│      * Content-Type: application/json                            │
│      * Accept: text/event-stream (for streaming)                 │
│    - Body includes:                                              │
│      * All context from step 2                                   │
│      * Optimized data sample (not full dataset for large files)  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. BACKEND PROCESSING (app/api/chat/route.ts)                   │
│    A. Rate Limit Check                                           │
│       - Check client IP against requestCounts map                │
│       - Return 429 if limit exceeded (30/hour)                   │
│    B. Data Context Generation                                    │
│       - Use schema if available (detailed column stats)          │
│       - Fall back to basic analysis if no schema                 │
│       - Generate sample data (first 3 rows)                      │
│    C. Build System Prompt                                        │
│       - Include data context                                     │
│       - Add selected chart context if present                    │
│       - Add preferred chart type if specified                    │
│       - Include conversation history (last 10 messages)          │
│       - Add chart suggestion format instructions                 │
│    D. OpenAI API Call                                            │
│       - Model: gpt-4-turbo-preview                               │
│       - Stream: true (if client supports SSE)                    │
│       - Temperature: 0.7                                         │
│       - Max Tokens: 1500                                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. STREAMING RESPONSE (Server-Sent Events)                      │
│    - OpenAI streams chunks: "Hello ", "I can ", "help..."       │
│    - Backend wraps each chunk in SSE format:                     │
│      data: {"content":"Hello ","timestamp":"..."}                │
│    - Final marker sent: data: [DONE]                             │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. CLIENT STREAMING HANDLER (ChatInterface)                     │
│    - ReadableStream reader processes SSE data line by line      │
│    - For each chunk:                                             │
│      * Parse JSON from "data: {}" line                           │
│      * Accumulate content: accumulatedContent += chunk.content   │
│      * Update UI: setStreamingMessage(accumulatedContent)        │
│    - On "[DONE]":                                                │
│      * Create final ChatMessage object                           │
│      * Add to store: addChatMessage(assistantMessage)            │
│      * Clear streaming state: setStreamingMessage('')            │
│      * Parse chart suggestions: extractChartSuggestions()        │
│      * Update UI: setChartSuggestions(suggestions)               │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. UI UPDATE & USER ACTIONS                                     │
│    - Message appears in ChatMessages component                   │
│    - If chart suggestions found:                                 │
│      * ChartSuggestions component renders action cards           │
│      * User can click "Apply" on suggestion                      │
│      * Calls regenerateChartFromSuggestion()                     │
│      * New chart added to analysis.chartConfig                   │
│      * Confirmation message added to chat                        │
│    - User can continue conversation (back to step 1)             │
└──────────────────────────────────────────────────────────────────┘
```

## Chart Recommendation System

### How It Works

1. **AI Generation**: OpenAI includes chart suggestions in responses using a specific format
2. **Extraction**: `extractChartSuggestions()` parses the response text
3. **Display**: `ChartSuggestions` component renders actionable cards
4. **Application**: User clicks "Apply" → chart is added to dashboard

### Chart Suggestion Format

The AI is prompted to use this **exact format**:

```
**CHART_SUGGESTION**
Type: [bar|line|pie|area|scatter|scorecard|table|combo]
Title: Revenue Trends by Quarter
Columns: Quarter, Revenue, Profit
Description: Shows revenue and profit trends across quarters
**END_SUGGESTION**
```

### Supported Chart Types

| Type | Use Case | Required Columns |
|------|----------|------------------|
| `bar` | Compare categories | 1+ categorical, 1+ numeric |
| `line` | Show trends over time | 1 date/sequence, 1+ numeric |
| `pie` | Show proportions | 1 categorical, 1 numeric |
| `area` | Cumulative trends | 1 date/sequence, 1+ numeric |
| `scatter` | Show correlations | 2+ numeric |
| `scorecard` | Display single KPI | 1 numeric |
| `table` | Detailed data view | Any columns |
| `combo` | Multi-scale comparison | 1 x-axis, 2+ y-axes |

## Integration with Existing Dashboard

### Selected Chart Context

When a user selects a chart in the dashboard:

```typescript
// In ChatInterface
const selectedChart = selectedChartId && analysis
  ? analysis.chartConfig.find(c =>
      (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === selectedChartId
    )
  : null

// Sent to API
{
  selectedChart: selectedChart ? {
    id: selectedChartId,
    title: selectedChart.title,
    type: selectedChart.type,
    dataKey: selectedChart.dataKey,
    description: selectedChart.description
  } : null
}
```

This allows the AI to:
- Answer questions about the specific chart
- Suggest improvements or alternatives
- Explain the data shown in that chart
- Recommend related visualizations

### Chart Regeneration Flow

```typescript
// lib/hooks/use-chart-regeneration.ts
const regenerateChartFromSuggestion = (suggestion: ChartSuggestion) => {
  // 1. Create chart config from suggestion
  const newChart = {
    id: `chart-${Date.now()}`,
    type: suggestion.type,
    title: suggestion.title,
    description: suggestion.description,
    dataKey: suggestion.dataKey,
    dataMapping: { /* auto-generated based on type */ }
  }

  // 2. Add to analysis
  setAnalysis({
    ...analysis,
    chartConfig: [...analysis.chartConfig, newChart]
  })

  // 3. Create customization entry
  updateChartCustomization(newChart.id, {
    position: { x: 0, y: Infinity, w: 6, h: 4 }, // Auto-positions at bottom
    isVisible: true
  })

  return newChart
}
```

## Data Schema Integration

### Schema-Aware Context

The chat endpoint intelligently uses the `DataSchema` if available:

```typescript
// From dataSchema
const columnInfo = schema.columns.map(col => ({
  name: col.name,
  type: col.type,                      // string|number|date|categorical
  description: col.description,        // AI-generated description
  suggestedUsage: col.suggestedUsage, // Recommended use cases
  stats: {                             // Statistical summary
    min: col.stats.min,
    max: col.stats.max,
    avg: col.stats.avg
  },
  uniqueValues: col.uniqueValues,
  nullPercentage: col.nullPercentage,
  relationships: schema.relationships  // Detected foreign keys
}))
```

This enables the AI to:
- Understand data types and distributions
- Recommend appropriate aggregations
- Detect relationships between columns
- Identify data quality issues
- Suggest relevant visualizations

## Error Handling

### Client-Side Error States

```typescript
// In ChatInterface
try {
  // API call
} catch (error) {
  setChatError(error.message)
  // Error displayed in red banner above messages
} finally {
  setIsChatLoading(false)
}
```

### Server-Side Error Responses

| Status Code | Meaning | User Action |
|-------------|---------|-------------|
| 400 | Invalid request (missing message/data) | Check input format |
| 429 | Rate limit exceeded (>30 req/hour) | Wait before retrying |
| 500 | Server error (OpenAI API issue) | Check API key, retry |

## Performance Optimizations

### 1. Data Sampling
Large datasets are sampled before sending to API:
- Takes first 2 rows, middle 1 row, last 2 rows
- Maximum 5 rows sent to reduce token usage
- Full schema stats still available for context

### 2. Conversation History Limiting
Only last 10 messages are sent to maintain context while controlling token usage:
```typescript
messages.push(...conversationHistory.slice(-10))
```

### 3. Streaming for Better UX
- User sees response character-by-character
- Perceived latency reduced dramatically
- Backend can start processing next request sooner

### 4. Rate Limiting
Prevents API abuse and cost overruns:
- Per-IP tracking in memory (scalable to Redis)
- 30 requests/hour limit
- Automatic cleanup of expired entries

## Testing the Integration

### Manual Testing Checklist

1. **Basic Chat Flow**
   ```
   ✅ Open dashboard with data loaded
   ✅ Type message in chat input
   ✅ Press Enter or click Send
   ✅ See streaming response appear character-by-character
   ✅ Response completes and is added to history
   ```

2. **Chart Recommendations**
   ```
   ✅ Ask: "Show me revenue by product"
   ✅ Verify chart suggestion card appears
   ✅ Click "Apply" on suggestion
   ✅ New chart appears in dashboard
   ✅ Confirmation message added to chat
   ```

3. **Selected Chart Context**
   ```
   ✅ Click on any chart in dashboard
   ✅ Ask: "What does this chart tell me?"
   ✅ Verify AI response references the selected chart
   ✅ AI explains specific data shown in that chart
   ```

4. **Conversation Memory**
   ```
   ✅ Ask: "What are my top products?"
   ✅ AI responds with answer
   ✅ Follow up: "Show me a chart of those"
   ✅ Verify AI references previous answer
   ```

5. **Error Handling**
   ```
   ✅ Send 31 messages rapidly (should hit rate limit)
   ✅ Verify error message displayed
   ✅ Wait 1 hour, verify rate limit resets
   ✅ Test with missing OpenAI key (should show config error)
   ```

### Test Queries

#### Analytical Questions
- "What are the trends in my sales data?"
- "Which product category performs best?"
- "Are there any outliers in my dataset?"
- "What's the correlation between price and sales?"

#### Visualization Requests
- "Show me a bar chart of revenue by region"
- "Create a line chart for sales over time"
- "I want to see a pie chart of category distribution"
- "Can you make a scatter plot of price vs quantity?"

#### Chart-Specific Questions
*(Select a chart first)*
- "Explain what this chart shows"
- "What insights can I get from this visualization?"
- "Are there any issues with this chart?"
- "Suggest an alternative visualization"

## Common Issues & Solutions

### Issue 1: Streaming Not Working
**Symptoms**: Non-streaming response even though expected streaming
**Cause**: Client didn't send `Accept: text/event-stream` header
**Solution**: Check fetch headers in ChatInterface:
```typescript
headers: {
  'Content-Type': 'application/json',
  'Accept': 'text/event-stream', // ← Must be present
}
```

### Issue 2: Chart Suggestions Not Extracted
**Symptoms**: AI suggests charts but they don't appear in UI
**Cause**: AI not using exact format expected by parser
**Solution**: Verify prompt includes format instructions in route.ts:
```typescript
content: `When suggesting visualizations, use this EXACT format:
**CHART_SUGGESTION**
Type: [chart_type]
Title: [title]
Columns: [col1, col2]
Description: [description]
**END_SUGGESTION**`
```

### Issue 3: Rate Limit Too Restrictive
**Symptoms**: Users frequently hit 30 req/hour limit
**Cause**: Limit set conservatively for development
**Solution**: Increase RATE_LIMIT in route.ts for production:
```typescript
const RATE_LIMIT = 100 // requests per hour (production)
```

### Issue 4: Large Dataset Causing Timeout
**Symptoms**: Requests timeout for datasets >10k rows
**Cause**: Sending full dataset in request body
**Solution**: Already handled! Only 5 sample rows are sent:
```typescript
const dataSample = getDataSample(data, 5)
```

### Issue 5: Context Lost Between Messages
**Symptoms**: AI doesn't remember previous questions
**Cause**: Conversation history not being passed
**Solution**: Verify conversationHistory is included in request:
```typescript
conversationHistory: chatMessages.map(msg => ({
  role: msg.role,
  content: msg.content
}))
```

## Security Considerations

### 1. API Key Protection
- ✅ OpenAI key stored in `.env.local` (never committed)
- ✅ Accessed only on server-side via `process.env.OPENAI_API_KEY`
- ✅ Never exposed to client

### 2. Rate Limiting
- ✅ Per-IP tracking prevents abuse
- ✅ Configurable limits (30 req/hour default)
- ✅ Returns 429 status when exceeded

### 3. Input Validation
- ✅ Message and data required, validated on server
- ✅ Type checking for all parameters
- ✅ 400 status for invalid requests

### 4. Error Message Sanitization
- ✅ Generic error messages to client
- ✅ Detailed errors only in server logs
- ✅ No stack traces exposed

## Future Enhancements (Optional)

### 1. Persistent Chat History
Currently chat is stored in Zustand but not persisted to server unless manually saved:
```typescript
// Add to route.ts
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  // Load chat history from database
}
```

### 2. Multi-Modal Support
Add support for image inputs (charts, screenshots):
```typescript
// In request body
images?: string[] // Base64-encoded images
```

### 3. Chart Editing via Chat
Allow users to modify existing charts through conversation:
```typescript
// Example: "Make that bar chart taller"
{
  action: 'modify_chart',
  chartId: string,
  modifications: { height: number }
}
```

### 4. Export to PDF
Export entire chat conversation with embedded chart images:
```typescript
// Add to ChatInterface
const exportToPDF = async () => {
  // Generate PDF with jsPDF
}
```

### 5. Voice Input
Add speech-to-text for hands-free interaction:
```typescript
// Add Web Speech API integration
const recognition = new webkitSpeechRecognition()
recognition.onresult = (e) => {
  setMessage(e.results[0][0].transcript)
}
```

## Cost Optimization

### Current Token Usage Estimate

For a typical chat message:
- **Input tokens**: ~500-800 tokens
  - Data context: 200-300 tokens (5 sample rows + schema)
  - System prompt: 200-300 tokens
  - Conversation history: 100-200 tokens (last 10 msgs)
- **Output tokens**: ~200-500 tokens (average response)

**Cost per message** (GPT-4 Turbo):
- Input: $0.01 per 1K tokens → ~$0.005-$0.008
- Output: $0.03 per 1K tokens → ~$0.006-$0.015
- **Total**: ~$0.011-$0.023 per message

**Monthly cost estimate** (100 active users, 20 messages/user):
- 2,000 messages/month
- ~$22-$46/month

### Optimization Strategies

1. **Use gpt-4o-mini for simple questions**: 15x cheaper
2. **Cache static context**: Reduce redundant token usage
3. **Smart sampling**: Send only relevant data rows
4. **Compress history**: Summarize older messages

## Maintenance Checklist

### Weekly
- [ ] Monitor rate limit hits (check logs for 429 responses)
- [ ] Review average response times
- [ ] Check for OpenAI API errors

### Monthly
- [ ] Analyze token usage and costs
- [ ] Review most common user questions
- [ ] Update example questions if needed
- [ ] Test streaming performance

### Quarterly
- [ ] Review and update AI system prompt based on user feedback
- [ ] Optimize chart suggestion extraction logic
- [ ] Update to latest OpenAI model if beneficial
- [ ] Audit rate limit thresholds

## Conclusion

The chat integration is **fully functional and production-ready**. All components work together seamlessly:

✅ **Backend**: Robust API with streaming, rate limiting, and error handling
✅ **State Management**: Complete Zustand integration with persistence
✅ **UI**: Polished chat interface with all features implemented
✅ **Chart Integration**: Bidirectional context awareness
✅ **Schema Integration**: Leverages existing data analysis infrastructure

**No additional work is needed** to make the chat functional. This document serves as a comprehensive reference for understanding, maintaining, and extending the system.

---

**Last Updated**: October 7, 2025
**Version**: 1.0.0
**Status**: Production-Ready ✅
