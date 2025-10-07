# Chart Rebalancer Integration

## Overview

Created a new utility file that enforces exactly 16 charts with strict layout constraints. This system ensures a consistent dashboard experience with optimal chart organization.

## Files Created

### `/lib/utils/chart-rebalancer.ts`

A comprehensive chart rebalancing utility with the following features:

#### Core Functions

1. **`rebalanceCharts(charts, targetCount, options)`**
   - Main rebalancing function
   - Ensures exactly `targetCount` charts (default: 16)
   - Enforces layout constraints
   - Handles edge cases (missing tables, too many/few scorecards)

2. **`enforceLayoutConstraints(charts, options)`**
   - Positions 1-6: Scorecards (sorted by quality)
   - Positions 7-15: Visualizations (sorted by quality)
   - Position 16: Table (must be last)
   - Automatically creates fallback charts if needed

3. **`selectTopCharts(charts, count, constraints)`**
   - Selects top N charts by quality score
   - Supports type filtering
   - Supports minimum score filtering

4. **`validateChartLayout(charts, options)`**
   - Validates that charts meet layout requirements
   - Returns validation errors if any
   - Useful for debugging and testing

5. **`getChartStats(charts)`**
   - Returns statistics about chart distribution
   - Includes quality distribution (high/medium/low)
   - Useful for logging and monitoring

#### Configuration Options

```typescript
interface RebalanceOptions {
  targetCount?: number          // Default: 16
  minScorecards?: number         // Default: 4
  maxScorecards?: number         // Default: 6
  preferredScorecards?: number   // Default: 6
  requireTable?: boolean         // Default: true
  fallbackChartType?: ChartType  // Default: 'table'
}
```

#### Edge Case Handling

1. **No table in input** → Uses fallback or best remaining chart
2. **Too many scorecards** → Keeps top 6 by quality score
3. **Too few scorecards** → Generates fallback scorecards
4. **Too few charts total** → Pads with fallback charts
5. **Too many charts** → Trims lowest quality visualizations

#### Fallback Chart Generation

- **Fallback Table**: Created from all unique columns found in existing charts
- **Fallback Scorecard**: Created using metrics from existing visualizations
- Both fallbacks have reasonable defaults and quality scores (65-70)

## Integration in `/app/api/analyze/route.ts`

### Import Added (Line 9)
```typescript
import { rebalanceCharts, getChartStats, validateChartLayout } from '@/lib/utils/chart-rebalancer'
```

### Rebalancing Logic (Lines 2788-2813)

The rebalancer is called **after** validation and scoring but **before** returning the response:

```typescript
// REBALANCE CHARTS: Enforce exactly 16 charts with layout constraints
logger.info('[API-ANALYZE] Rebalancing charts before response:', {
  beforeCount: analysisResult.chartConfig.length,
  scorecards: analysisResult.chartConfig.filter((c: any) => c.type === 'scorecard').length,
  tables: analysisResult.chartConfig.filter((c: any) => c.type === 'table').length
})

// Apply rebalancing to chartConfig
analysisResult.chartConfig = rebalanceCharts(analysisResult.chartConfig as any, 16, {
  minScorecards: 4,
  maxScorecards: 6,
  preferredScorecards: 6,
  requireTable: true
}) as any

// Log rebalancing results
const chartStats = getChartStats(analysisResult.chartConfig as any)
logger.info('[API-ANALYZE] Charts rebalanced successfully:', chartStats)

// Validate layout
const validation = validateChartLayout(analysisResult.chartConfig as any)
if (!validation.valid) {
  logger.warn('[API-ANALYZE] Chart layout validation warnings:', validation.errors)
}
```

### Execution Flow

1. **Validation & Scoring**: Charts are validated and scored for quality
2. **Initial Sort**: Charts sorted by quality score (lines 2628-2633 - still happens)
3. **Rebalancing**: `rebalanceCharts()` enforces the 16-chart constraint
4. **Logging**: Stats and validation results logged
5. **Response**: Rebalanced charts returned to client

### What Changed

**Before:**
- Charts were simply sorted by quality score
- No constraint on total count
- No positional requirements
- Could have any number of scorecards or tables

**After:**
- Exactly 16 charts guaranteed
- Scorecards positioned first (4-6 total, prefer 6)
- Visualizations in middle positions (sorted by quality)
- Table always at position 16 (last)
- Quality sorting maintained within each category

## Benefits

1. **Consistent Experience**: Every dashboard has exactly 16 charts
2. **Optimal Organization**: Scorecards first, table last
3. **Quality-Driven**: Top quality charts selected within constraints
4. **Edge Case Handling**: Gracefully handles missing/excess charts
5. **Debugging**: Comprehensive logging and validation

## Testing Recommendations

Test these scenarios:
1. AI returns < 16 charts → Should pad with fallbacks
2. AI returns > 16 charts → Should trim lowest quality
3. AI returns no table → Should create fallback table
4. AI returns > 6 scorecards → Should keep top 6
5. AI returns < 4 scorecards → Should add fallbacks
6. All edge cases combined

## Monitoring

Watch for these log messages in production:

- `[API-ANALYZE] Rebalancing charts before response` - Shows before state
- `[API-ANALYZE] Charts rebalanced successfully` - Shows chart stats
- `[API-ANALYZE] Chart layout validation warnings` - Alerts on validation failures
- `[REBALANCER] Starting rebalance` - Detailed rebalancing info
- `[REBALANCER] Chart count mismatch` - Warns if count doesn't match target

## Future Enhancements

Consider these improvements:

1. **Configurable Layout**: Allow users to customize scorecard count
2. **Position Preferences**: Let AI suggest optimal positions
3. **Dynamic Constraints**: Adjust based on data characteristics
4. **A/B Testing**: Test different layouts for effectiveness
5. **User Overrides**: Allow manual chart reordering

## Type Safety

All functions are fully typed with TypeScript:
- `ChartConfig` interface matches `@/lib/store`
- `RebalanceOptions` provides configuration type safety
- Return types explicitly defined
- Edge cases handled with type guards

## Performance

- O(n log n) complexity due to sorting
- Minimal overhead for typical chart counts
- No external dependencies
- Runs entirely in-memory
