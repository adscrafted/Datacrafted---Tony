# Gemini Migration - Implementation Checklist

Use this checklist to track your migration progress step by step.

---

## Phase 1: Setup & Dependencies

### Environment Setup
- [ ] Get Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- [ ] Add `GEMINI_API_KEY` to `.env.local`
- [ ] Add `AI_PROVIDER=openai` to `.env.local` (keep OpenAI as default during migration)
- [ ] Keep existing `OPENAI_API_KEY` for testing and fallback

### Dependencies
- [ ] Run: `npm install @google/generative-ai`
- [ ] Verify installation: Check `package.json` has `@google/generative-ai` dependency
- [ ] Run: `npm install` to ensure all dependencies are installed

### Project Structure
- [ ] Create directory: `lib/services/ai/`
- [ ] Create directory: `lib/services/ai/providers/`
- [ ] Verify directories exist

---

## Phase 2: Core Abstraction Layer

### 2.1 Types and Interfaces
- [ ] Create `lib/services/ai/types.ts`
  - [ ] Define `AIProvider` type
  - [ ] Define `AIMessage` interface
  - [ ] Define `AICompletionOptions` interface
  - [ ] Define `AICompletionResponse` interface
  - [ ] Define `AIStreamChunk` interface
  - [ ] Define `AIProviderInterface` interface
  - [ ] Define `AIError` interface

### 2.2 Response Normalizer
- [ ] Create `lib/services/ai/normalizer.ts`
  - [ ] Define `NormalizedAnalysisResponse` interface
  - [ ] Implement `ResponseNormalizer` class
  - [ ] Implement `normalizeAnalysisResponse()` method
    - [ ] Handle `insights` field variations
    - [ ] Handle `chartConfig` field variations
    - [ ] Handle `recommendations` field variations
    - [ ] Handle `summary` field variations
  - [ ] Implement `validateResponse()` method
  - [ ] Test normalizer with sample OpenAI response
  - [ ] Test normalizer with sample Gemini response

### 2.3 OpenAI Provider
- [ ] Create `lib/services/ai/providers/openai-provider.ts`
  - [ ] Import OpenAI SDK
  - [ ] Implement `OpenAIProvider` class
  - [ ] Implement `getClient()` method
  - [ ] Implement `getName()` method
  - [ ] Implement `isAvailable()` method
  - [ ] Implement `complete()` method
    - [ ] Transform messages
    - [ ] Add JSON mode support
    - [ ] Handle errors
  - [ ] Implement `stream()` method
    - [ ] Yield chunks
    - [ ] Handle completion
  - [ ] Implement `normalizeError()` method
    - [ ] Handle rate limit (429)
    - [ ] Handle quota (402)
    - [ ] Handle auth (401)
    - [ ] Handle server errors (5xx)

### 2.4 Gemini Provider
- [ ] Create `lib/services/ai/providers/gemini-provider.ts`
  - [ ] Import Gemini SDK (`@google/generative-ai`)
  - [ ] Implement `GeminiProvider` class
  - [ ] Implement `getClient()` method
  - [ ] Implement `getName()` method
  - [ ] Implement `isAvailable()` method
  - [ ] Implement `getModel()` method
    - [ ] Configure `generationConfig`
    - [ ] Add JSON mode: `responseMimeType: 'application/json'`
  - [ ] Implement `transformMessages()` method
    - [ ] **CRITICAL:** Merge system message into first user message
    - [ ] Transform `assistant` role to `model`
    - [ ] Build `contents` array
  - [ ] Implement `complete()` method
    - [ ] Start chat with history
    - [ ] Send last message
    - [ ] Extract response text
    - [ ] Return with usage metadata
  - [ ] Implement `stream()` method
    - [ ] Use `sendMessageStream()`
    - [ ] Yield chunks
    - [ ] Handle completion
  - [ ] Implement `normalizeError()` method
    - [ ] Handle quota/RESOURCE_EXHAUSTED
    - [ ] Handle rate limit
    - [ ] Handle PERMISSION_DENIED
    - [ ] Handle server errors

### 2.5 Provider Factory
- [ ] Create `lib/services/ai/factory.ts`
  - [ ] Implement `AIProviderFactory` class
  - [ ] Add `providers` Map for caching
  - [ ] Implement `getProvider(type?)` method
    - [ ] Check cache first
    - [ ] Create provider if not cached
    - [ ] Validate provider is available
    - [ ] Return provider instance
  - [ ] Implement `getDefaultProvider()` method
    - [ ] Read `AI_PROVIDER` env var
    - [ ] Default to 'openai'
  - [ ] Implement `isProviderAvailable(type)` method
  - [ ] Implement `getAvailableProviders()` method
  - [ ] Export singleton: `aiProviderFactory`

### 2.6 Unified AI Service
- [ ] Create `lib/services/ai/service.ts`
  - [ ] Import factory and normalizer
  - [ ] Implement `AIService` class
  - [ ] Implement `analyzeData(prompt, provider?)` method
    - [ ] Get provider from factory
    - [ ] Build messages with system prompt
    - [ ] Call provider with JSON mode
    - [ ] Parse response
    - [ ] Normalize response
    - [ ] Validate response
    - [ ] Return normalized result
  - [ ] Implement `chat(messages, provider?)` method
    - [ ] Get provider
    - [ ] Call complete
    - [ ] Return content
  - [ ] Implement `streamChat(messages, provider?)` method
    - [ ] Get provider
    - [ ] Stream chunks
    - [ ] Yield content
  - [ ] Implement `generateChartTitle(...)` method
    - [ ] Build prompt
    - [ ] Call provider with JSON mode
    - [ ] Parse and return title/description
  - [ ] Implement `buildChartTitlePrompt()` helper
  - [ ] Export singleton: `aiService`

---

## Phase 3: Update API Routes

### 3.1 Update `/app/api/analyze/route.ts`
- [ ] Review current OpenAI usage
- [ ] Import `aiService` from `@/lib/services/ai/service`
- [ ] Replace OpenAI client initialization
- [ ] Replace completion call with `aiService.analyzeData(prompt)`
- [ ] Remove manual JSON parsing (normalizer handles it)
- [ ] Test endpoint with OpenAI
- [ ] Test endpoint with Gemini

### 3.2 Update `/app/api/analyze-simple/route.ts`
- [ ] Review current OpenAI usage
- [ ] Import `aiService`
- [ ] Replace OpenAI calls
- [ ] Use `aiService.analyzeData(prompt)`
- [ ] Test with both providers

### 3.3 Update `/app/api/chat/route.ts`
- [ ] Review streaming implementation
- [ ] Import `aiService`
- [ ] For streaming:
  - [ ] Use `aiService.streamChat(messages)`
  - [ ] Replace stream encoding logic
  - [ ] Test SSE streaming
- [ ] For non-streaming:
  - [ ] Use `aiService.chat(messages)`
- [ ] Test with both providers
- [ ] Verify streaming works correctly

### 3.4 Update `/app/api/generate-chart-title/route.ts`
- [ ] Review current implementation
- [ ] Import `aiService`
- [ ] Replace OpenAI calls
- [ ] Use `aiService.generateChartTitle(...)`
- [ ] Test with both providers

### 3.5 Update `/app/api/recommendations/refresh/route.ts`
- [ ] Review current implementation (complex prompt building)
- [ ] Import `aiService`
- [ ] Keep existing prompt building logic
- [ ] Replace OpenAI call with `aiService.analyzeData(prompt)`
- [ ] Ensure normalization handles response
- [ ] Test with both providers

### 3.6 Update `lib/services/analysis/openai-service.ts` (Optional)
- [ ] Decide: Deprecate or refactor?
- [ ] If refactoring:
  - [ ] Use `aiService` internally
  - [ ] Keep existing API for backward compatibility
- [ ] If deprecating:
  - [ ] Update imports in any files using it
  - [ ] Mark as deprecated
  - [ ] Plan removal

---

## Phase 4: Testing

### 4.1 Unit Tests

#### Provider Tests
- [ ] Create `__tests__/lib/services/ai/providers/openai-provider.test.ts`
  - [ ] Test `complete()` method
  - [ ] Test `stream()` method
  - [ ] Test error normalization
  - [ ] Test JSON mode
  - [ ] Mock OpenAI API responses

- [ ] Create `__tests__/lib/services/ai/providers/gemini-provider.test.ts`
  - [ ] Test `complete()` method
  - [ ] Test `stream()` method
  - [ ] Test message transformation (system role)
  - [ ] Test error normalization
  - [ ] Test JSON mode
  - [ ] Mock Gemini API responses

#### Normalizer Tests
- [ ] Create `__tests__/lib/services/ai/normalizer.test.ts`
  - [ ] Test OpenAI response normalization
  - [ ] Test Gemini response normalization (different field names)
  - [ ] Test field variations: `insights` vs `analysis`
  - [ ] Test field variations: `chartConfig` vs `charts`
  - [ ] Test missing fields (should use defaults)
  - [ ] Test response validation
  - [ ] Test invalid responses throw errors

#### Factory Tests
- [ ] Create `__tests__/lib/services/ai/factory.test.ts`
  - [ ] Test provider selection by type
  - [ ] Test default provider selection
  - [ ] Test provider caching
  - [ ] Test unavailable provider throws error
  - [ ] Test `getAvailableProviders()`

#### Service Tests
- [ ] Create `__tests__/lib/services/ai/service.test.ts`
  - [ ] Test `analyzeData()` with OpenAI
  - [ ] Test `analyzeData()` with Gemini
  - [ ] Test `chat()` method
  - [ ] Test `streamChat()` method
  - [ ] Test `generateChartTitle()` method
  - [ ] Test provider switching

### 4.2 Integration Tests

- [ ] Test full flow: Client → API → Service → Provider → External API
- [ ] Test with OpenAI (baseline)
  - [ ] `/api/analyze` with sample data
  - [ ] `/api/chat` with conversation
  - [ ] `/api/generate-chart-title` with chart config
  - [ ] `/api/recommendations/refresh` with data
- [ ] Test with Gemini
  - [ ] `/api/analyze` with sample data
  - [ ] `/api/chat` with conversation
  - [ ] `/api/generate-chart-title` with chart config
  - [ ] `/api/recommendations/refresh` with data
- [ ] Compare responses (should be structurally similar after normalization)

### 4.3 Manual Testing

- [ ] Start dev server: `npm run dev`
- [ ] Test with OpenAI:
  - [ ] Set `AI_PROVIDER=openai` in `.env.local`
  - [ ] Restart server
  - [ ] Upload CSV file
  - [ ] Verify charts generated
  - [ ] Test chat interface
  - [ ] Test chart title generation
  - [ ] Test refresh recommendations
- [ ] Test with Gemini:
  - [ ] Set `AI_PROVIDER=gemini` in `.env.local`
  - [ ] Restart server
  - [ ] Upload same CSV file
  - [ ] Verify charts generated
  - [ ] Compare with OpenAI results
  - [ ] Test chat interface
  - [ ] Test chart title generation
  - [ ] Test refresh recommendations
- [ ] Test error scenarios:
  - [ ] Invalid API key
  - [ ] Rate limiting (make many requests quickly)
  - [ ] Network errors (disconnect internet)
- [ ] Test streaming:
  - [ ] Chat should stream responses
  - [ ] Verify SSE events are sent correctly
  - [ ] No broken streams

### 4.4 Performance Testing

- [ ] Measure response times:
  - [ ] OpenAI average response time
  - [ ] Gemini average response time
  - [ ] Compare performance
- [ ] Measure token usage:
  - [ ] Log token counts for both providers
  - [ ] Compare costs
- [ ] Load testing:
  - [ ] Test with large CSV files (10K+ rows)
  - [ ] Test concurrent requests
  - [ ] Verify no memory leaks

---

## Phase 5: Documentation

### Code Documentation
- [ ] Add JSDoc comments to all public methods
- [ ] Document provider interfaces
- [ ] Document error types
- [ ] Add usage examples in comments

### User Documentation
- [ ] Update README with:
  - [ ] New AI provider configuration
  - [ ] Environment variable documentation
  - [ ] Provider switching instructions
- [ ] Update `.env.example` with new variables
- [ ] Create migration guide (already done: `GEMINI_MIGRATION_PLAN.md`)

### Developer Documentation
- [ ] Architecture overview (already done: `ARCHITECTURE.md`)
- [ ] Quick start guide (already done: `GEMINI_QUICK_START.md`)
- [ ] Implementation checklist (this document)
- [ ] Troubleshooting guide

---

## Phase 6: Deployment

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Performance benchmarks acceptable

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Set `AI_PROVIDER=openai` (baseline test)
- [ ] Run smoke tests:
  - [ ] Upload data
  - [ ] Generate charts
  - [ ] Test chat
  - [ ] Test all endpoints
- [ ] Verify no regressions
- [ ] Switch to `AI_PROVIDER=gemini`
- [ ] Run smoke tests again
- [ ] Monitor logs for errors
- [ ] Check response quality
- [ ] Compare costs

### Production Deployment
- [ ] Deploy code to production
- [ ] Keep `AI_PROVIDER=openai` initially (safe rollout)
- [ ] Monitor for 24 hours:
  - [ ] Error rates
  - [ ] Response times
  - [ ] User feedback
- [ ] If stable, prepare Gemini switch:
  - [ ] Schedule maintenance window (optional)
  - [ ] Notify team
  - [ ] Switch `AI_PROVIDER=gemini`
  - [ ] Monitor closely for first hour
  - [ ] Check error rates
  - [ ] Verify response quality
  - [ ] Monitor costs

### Post-Deployment
- [ ] Monitor for 1 week:
  - [ ] Daily error rate checks
  - [ ] Response quality spot checks
  - [ ] User feedback
  - [ ] Cost tracking
- [ ] Document any issues encountered
- [ ] Optimize as needed

---

## Phase 7: Monitoring & Optimization

### Monitoring Setup
- [ ] Add logging to track:
  - [ ] Provider used per request
  - [ ] Response times
  - [ ] Token usage
  - [ ] Costs
  - [ ] Error rates
- [ ] Set up alerts for:
  - [ ] High error rates (> 5%)
  - [ ] Slow responses (> 10s)
  - [ ] API quota exhaustion
  - [ ] Rate limit hits

### Cost Tracking
- [ ] Track daily token usage
- [ ] Calculate daily costs
- [ ] Compare OpenAI vs Gemini costs
- [ ] Document savings

### Performance Optimization
- [ ] Identify slow endpoints
- [ ] Optimize prompts for speed
- [ ] Reduce token usage where possible
- [ ] Consider caching frequent requests

---

## Rollback Plan

### If Issues Detected
- [ ] Immediate: Switch `AI_PROVIDER=openai`
- [ ] Restart application
- [ ] Verify stability restored
- [ ] Investigate issue
- [ ] Fix and redeploy
- [ ] Test thoroughly before switching back

### Known Rollback Triggers
- [ ] Error rate > 10%
- [ ] Response quality significantly worse
- [ ] Response times > 2x slower
- [ ] API quota issues
- [ ] User complaints

---

## Success Criteria

### Functional
- [x] All API routes work with both providers
- [x] Response normalization handles field differences
- [x] Streaming works correctly
- [x] Error handling is consistent
- [x] Provider switching works seamlessly

### Performance
- [x] Response times comparable or better
- [x] Error rates < 1%
- [x] No significant quality degradation

### Business
- [x] Cost reduction of ~50%
- [x] Easy maintenance and updates
- [x] Future-proof architecture
- [x] No downtime during migration

---

## Additional Considerations

### Security
- [ ] API keys stored in environment variables (not in code)
- [ ] API keys not logged
- [ ] Error messages don't expose sensitive info
- [ ] Rate limiting in place

### Scalability
- [ ] Provider factory uses singleton pattern
- [ ] Providers are cached
- [ ] No performance degradation with multiple instances

### Maintainability
- [ ] Code is well-documented
- [ ] Architecture is clear
- [ ] Easy to add new providers
- [ ] Tests provide good coverage

---

## Troubleshooting Common Issues

### Issue: "GEMINI_API_KEY not configured"
**Solution:**
- [ ] Check `.env.local` has `GEMINI_API_KEY=...`
- [ ] Verify key is valid
- [ ] Restart server after adding key

### Issue: "Invalid analysis response format"
**Solution:**
- [ ] Check if `ResponseNormalizer.normalizeAnalysisResponse()` is being called
- [ ] Log raw response to see what fields Gemini is returning
- [ ] Add field mappings to normalizer if needed

### Issue: System message not working with Gemini
**Solution:**
- [ ] This is expected - Gemini doesn't support system role
- [ ] Check `GeminiProvider.transformMessages()` is merging system message correctly
- [ ] Verify first user message contains system instructions

### Issue: JSON mode not working
**Solution:**
- [ ] OpenAI: Check `response_format: { type: 'json_object' }` is set
- [ ] Gemini: Check `responseMimeType: 'application/json'` is set in generationConfig
- [ ] Ensure prompt asks for JSON output

### Issue: Streaming not working
**Solution:**
- [ ] Check async generator is being consumed correctly
- [ ] Verify SSE headers are set correctly
- [ ] Check client is handling SSE events

---

## Final Checklist

- [ ] All code implemented
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Deployed to staging
- [ ] Tested thoroughly
- [ ] Deployed to production
- [ ] Monitoring in place
- [ ] Team trained on new system
- [ ] Rollback plan documented
- [ ] Success metrics tracked

---

## Notes & Observations

Use this section to track any issues, insights, or improvements discovered during implementation:

```
Date:
Issue:
Solution:
```

```
Date:
Performance Note:
```

```
Date:
Cost Savings:
```

---

**Ready to start? Begin with Phase 1 and check off items as you complete them!**
