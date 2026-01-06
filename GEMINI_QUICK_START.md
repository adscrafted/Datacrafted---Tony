# Gemini Migration - Quick Start Guide

## TL;DR

Switch from OpenAI to Gemini in 3 steps:

1. **Install dependency:** `npm install @google/generative-ai`
2. **Add API key:** `GEMINI_API_KEY=your_key_here`
3. **Set provider:** `AI_PROVIDER=gemini`

All existing code continues to work - no code changes needed after implementing the abstraction layer!

---

## Quick Implementation Steps

### Step 1: Create the AI Service Layer

```bash
mkdir -p lib/services/ai/providers
```

Create these files in order (full code in `GEMINI_MIGRATION_PLAN.md`):

1. `lib/services/ai/types.ts` - Base interfaces
2. `lib/services/ai/normalizer.ts` - Response normalization
3. `lib/services/ai/providers/openai-provider.ts` - OpenAI wrapper
4. `lib/services/ai/providers/gemini-provider.ts` - Gemini wrapper
5. `lib/services/ai/factory.ts` - Provider factory
6. `lib/services/ai/service.ts` - Unified service

### Step 2: Update API Routes

Replace OpenAI calls with the new service:

**Before:**
```typescript
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const completion = await openai.chat.completions.create({...})
```

**After:**
```typescript
import { aiService } from '@/lib/services/ai/service'
const result = await aiService.analyzeData(prompt)
```

### Step 3: Update Environment

```bash
# .env.local
AI_PROVIDER=gemini  # or 'openai'
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here  # Keep as fallback
```

---

## Key Architecture Concepts

### 1. Provider Abstraction

```
API Routes → AI Service → Provider Factory → OpenAI/Gemini Provider
```

All routes use `aiService` which automatically selects the right provider.

### 2. Response Normalization

Gemini might return:
```json
{"analysis": [...], "charts": [...]}
```

OpenAI returns:
```json
{"insights": [...], "chartConfig": [...]}
```

**The normalizer automatically converts both to:**
```json
{"insights": [...], "chartConfig": [...]}
```

### 3. System Message Handling

OpenAI supports:
```typescript
{ role: 'system', content: 'You are helpful' }
```

Gemini doesn't support system role, so we automatically merge it:
```typescript
// Gemini receives:
{ role: 'user', content: 'You are helpful\n\nUser question here' }
```

---

## API Routes to Update

1. `/app/api/analyze/route.ts`
2. `/app/api/analyze-simple/route.ts`
3. `/app/api/chat/route.ts`
4. `/app/api/generate-chart-title/route.ts`
5. `/app/api/recommendations/refresh/route.ts`

---

## Testing Checklist

```bash
# Test with OpenAI (baseline)
AI_PROVIDER=openai npm run dev

# Test with Gemini
AI_PROVIDER=gemini npm run dev

# Test provider switching
# Change AI_PROVIDER and restart - should work seamlessly
```

### Test Each Endpoint:

- [ ] Upload CSV file → Should generate charts
- [ ] Chat with data → Should respond correctly
- [ ] Refresh recommendations → Should generate new charts
- [ ] Generate chart titles → Should create titles
- [ ] Simple analysis → Should work

---

## Common Issues & Solutions

### Issue 1: "Invalid analysis response format"

**Cause:** Gemini returned different field names

**Solution:** The ResponseNormalizer handles this automatically. If you see this error, check:
1. Is `ResponseNormalizer.normalizeAnalysisResponse()` being called?
2. Add new field mappings to the normalizer if needed

### Issue 2: System message not working

**Cause:** Gemini doesn't support system role

**Solution:** Already handled in `GeminiProvider.transformMessages()`. System message is automatically merged into first user message.

### Issue 3: JSON mode not working

**Cause:** Different configuration between providers

**Solution:**
- OpenAI: `response_format: { type: 'json_object' }`
- Gemini: `responseMimeType: 'application/json'`

Already handled in provider implementations.

### Issue 4: Rate limits hit

**Solution:**
```typescript
// Error will be normalized to:
{
  type: 'rate_limit',
  retryable: true
}
```

Implement exponential backoff in calling code if needed.

---

## Cost Savings

| Provider | Input Cost | Output Cost | Savings |
|----------|-----------|-------------|---------|
| OpenAI (gpt-4o-mini) | $0.15/1M | $0.60/1M | Baseline |
| Gemini (gemini-1.5-flash) | $0.075/1M | $0.30/1M | **50% cheaper** |

**Example:** 1M input tokens + 1M output tokens
- OpenAI: $0.75
- Gemini: $0.375
- **Savings: $0.375 (50%)**

---

## Monitoring

Add this to your API routes:

```typescript
const startTime = Date.now()
const provider = aiProviderFactory.getProvider()

try {
  const result = await aiService.analyzeData(prompt)

  console.log('[AI Metrics]', {
    provider: provider.getName(),
    duration: Date.now() - startTime,
    success: true
  })

  return result
} catch (error) {
  console.error('[AI Error]', {
    provider: provider.getName(),
    duration: Date.now() - startTime,
    error: error.message
  })

  throw error
}
```

---

## Rollback Plan

If Gemini causes issues:

1. **Immediate:** Set `AI_PROVIDER=openai` in environment
2. **Restart:** Application automatically uses OpenAI
3. **No code changes needed!**

---

## Performance Comparison

| Metric | OpenAI | Gemini |
|--------|--------|--------|
| Avg Response Time | 1-3s | 0.5-2s |
| Context Window | 128K | 1M tokens |
| Output Tokens | 16K | 8K |
| Rate Limit (Free) | Tier-based | 15/min |
| Rate Limit (Paid) | Varies | 1000+/min |

---

## Migration Timeline

- **Day 1:** Implement abstraction layer (types, normalizer, providers)
- **Day 2:** Implement factory and service, update API routes
- **Day 3:** Testing with both providers
- **Day 4:** Staging deployment
- **Day 5:** Production deployment with monitoring

---

## Next Steps

1. Review the full plan: `GEMINI_MIGRATION_PLAN.md`
2. Create the AI service files
3. Update the API routes
4. Test thoroughly
5. Deploy to staging
6. Monitor and rollback if needed
7. Deploy to production

---

## Example Usage

### Simple Analysis
```typescript
import { aiService } from '@/lib/services/ai/service'

const result = await aiService.analyzeData(`
  Analyze this data:
  ${JSON.stringify(data)}

  Return JSON with insights and chartConfig.
`)

// result is automatically normalized!
console.log(result.insights)
console.log(result.chartConfig)
```

### Chat
```typescript
const response = await aiService.chat([
  { role: 'system', content: 'You are helpful' },
  { role: 'user', content: 'Hello!' }
])
```

### Streaming Chat
```typescript
for await (const chunk of aiService.streamChat(messages)) {
  console.log(chunk) // Stream to client
}
```

### Generate Chart Title
```typescript
const { title, description } = await aiService.generateChartTitle(
  'bar',
  { xAxis: 'month', yAxis: ['sales'] },
  sampleData
)
```

---

## Support

If you encounter issues:

1. Check the logs - provider name is included
2. Verify API key is set correctly
3. Test with OpenAI first (known working baseline)
4. Check response normalization is happening
5. Review error type and retry if retryable

---

## Architecture Benefits

✅ **Easy Provider Switching** - Change env var, restart
✅ **Response Normalization** - Automatic field mapping
✅ **Error Handling** - Unified error format
✅ **Future-Proof** - Easy to add Claude, Llama, etc.
✅ **Cost Savings** - 50% cheaper with Gemini
✅ **Performance** - Faster response times
✅ **No Breaking Changes** - Existing APIs work unchanged

---

**Ready to migrate? Start with `GEMINI_MIGRATION_PLAN.md` for full implementation details!**
