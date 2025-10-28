# API Route Refactoring Documentation

## Overview
The massive 2,266-line `/api/analyze/route.ts` has been refactored into a clean service layer architecture. This improves maintainability, testability, and separation of concerns.

## Architecture Changes

### Before (Monolithic)
```
/api/analyze/route.ts (2,266 lines)
  - Schema analysis
  - Chart recommendations
  - AI prompt building
  - OpenAI interactions
  - Data validation
  - Error handling
  - Caching
  - All business logic mixed together
```

### After (Service Layer)
```
/api/analyze/route-refactored.ts (120 lines) - Clean API endpoint
  ↓
/lib/services/analysis/
  ├── index.ts                         - Service exports
  ├── analysis-service.ts               - Main orchestrator
  ├── schema-service.ts                 - Data schema analysis
  ├── chart-recommendation-service.ts   - Chart validation & scoring
  ├── prompt-builder-service.ts         - AI prompt construction
  └── openai-service.ts                 - OpenAI API interactions
```

## Benefits

### 1. Separation of Concerns
Each service has a single, well-defined responsibility:
- **SchemaService**: Analyzes data structure and types
- **ChartRecommendationService**: Validates and scores chart recommendations
- **PromptBuilderService**: Constructs optimized AI prompts
- **OpenAIService**: Handles all AI API interactions
- **AnalysisService**: Orchestrates the workflow

### 2. Improved Testability
- Each service can be unit tested independently
- Mock dependencies easily for testing
- Clear interfaces and contracts

### 3. Better Maintainability
- Find and fix issues quickly
- Add features without touching unrelated code
- Clear code organization

### 4. Reusability
- Services can be used by other API routes
- Share logic across the application
- No code duplication

## Migration Strategy

### Phase 1: Create Service Layer ✅
- Created all service classes
- Extracted logic from monolithic route
- Maintained backward compatibility

### Phase 2: Testing (Next Step)
1. Test the refactored route alongside the original
2. Compare outputs for identical inputs
3. Verify performance is maintained

### Phase 3: Gradual Rollout
1. Deploy refactored route at `/api/analyze-v2` initially
2. A/B test with original route
3. Monitor for errors and performance
4. Switch over once confidence is high

### Phase 4: Cleanup
1. Remove original monolithic route
2. Rename refactored route to `/api/analyze`
3. Archive old code

## Service Details

### AnalysisService
Main orchestrator that coordinates the analysis workflow:
```typescript
class AnalysisService {
  analyze(request: AnalysisRequest): Promise<AnalysisResult>
  validateRequest(request: AnalysisRequest): ValidationResult
  getColumnMatcher(data: DataRow[]): ColumnMatcher
}
```

### SchemaService
Handles data structure analysis:
```typescript
class SchemaService {
  analyzeDataStructure(data: DataRow[]): SchemaAnalysisResult
  detectBusinessDomain(columns: string[]): BusinessDomain
  applyUserCorrections(schema: DataSchema, corrections: Correction[]): DataSchema
}
```

### ChartRecommendationService
Manages chart recommendations:
```typescript
class ChartRecommendationService {
  validateChartConfigs(configs: any[]): ChartRecommendation[]
  convertToChartSuggestions(recommendations: ChartRecommendation[], data: DataRow[]): ChartSuggestion[]
  scoreAndRank(recommendations: ChartRecommendation[], data: DataRow[], context: DataContext): ScoredRecommendation[]
  rebalanceLayout(charts: ChartSuggestion[]): ChartSuggestion[]
  hydrateCharts(charts: ChartSuggestion[], data: DataRow[]): ChartSuggestion[]
}
```

### PromptBuilderService
Constructs AI prompts:
```typescript
class PromptBuilderService {
  buildAnalysisPrompt(config: PromptConfig): string
  buildQuickAnalysisPrompt(data: DataRow[], columns: string[]): string
}
```

### OpenAIService
Handles AI interactions:
```typescript
class OpenAIService {
  analyzeData(prompt: string): Promise<AIAnalysisResponse>
  generateQuickAnalysis(columns: string[], sampleData: any[]): Promise<AIAnalysisResponse>
}
```

## Performance Considerations

1. **Caching**: Maintained in AnalysisService
2. **Timeout Handling**: Preserved with same limits
3. **Rate Limiting**: Applied at route level
4. **Memory Usage**: Reduced by better data flow

## Testing the Refactored Route

To test the new route:

1. Update the API endpoint temporarily:
```typescript
// In the file that calls the API
const response = await fetch('/api/analyze-v2', {
  method: 'POST',
  // ... rest of the request
})
```

2. Or rename the files:
```bash
# Backup original
mv app/api/analyze/route.ts app/api/analyze/route-original.ts
# Use refactored version
mv app/api/analyze/route-refactored.ts app/api/analyze/route.ts
```

## Next Steps

1. Add comprehensive unit tests for each service
2. Add integration tests for the full workflow
3. Add performance benchmarks
4. Document service APIs with JSDoc
5. Consider adding dependency injection for better testability

## Files Changed

### New Files Created
- `/lib/services/analysis/index.ts`
- `/lib/services/analysis/analysis-service.ts`
- `/lib/services/analysis/schema-service.ts`
- `/lib/services/analysis/chart-recommendation-service.ts`
- `/lib/services/analysis/prompt-builder-service.ts`
- `/lib/services/analysis/openai-service.ts`
- `/app/api/analyze/route-refactored.ts`

### Original File (To Be Removed Later)
- `/app/api/analyze/route.ts` (2,266 lines)

## Rollback Plan

If issues are found:
1. Simply revert to using original `/api/analyze/route.ts`
2. Service layer remains available for future use
3. No data migration needed