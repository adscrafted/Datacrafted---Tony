# Chart Type Mismatch Fix - Complete Documentation

## Problem Summary

**Issue**: "Peak Single-Campaign Sales" appeared as a **scorecard** on the dashboard with the "Configure this chart" placeholder, but when clicking the settings gear icon, it showed as an **area chart** in the customization panel.

**Root Cause**: Type mismatch between `analysis.chartConfig` and `chartCustomizations` store.

## Technical Analysis

### The Type Determination Flow

1. **Dashboard Rendering** (`flexible-dashboard-layout.tsx` line 186-271):
   - Iterates through `analysis.chartConfig` charts
   - Checks `chart.type` to determine if it's a scorecard
   - Applies scorecard-specific filters

2. **Chart Rendering** (`enhanced-chart-wrapper.tsx` line 234):
   - Determines `effectiveChartType = customization?.chartType || type`
   - Uses `customization.chartType` if available, overriding the original `type`

3. **The Mismatch**:
   - `analysis.chartConfig[5].type` = `'scorecard'`
   - `chartCustomizations['chart-5'].chartType` = `'area'`
   - Dashboard filter checked original type ('scorecard')
   - Chart wrapper rendered with customized type ('area')

### Why Defensive Filters Failed

The original filter logic (line 196-214 before fix):

```typescript
if (chart.type === 'scorecard') {
  const isConfigured = effectiveDM && (effectiveDM.metric || effectiveDM.formula)
  if (!isConfigured) {
    return false  // Filter out unconfigured scorecards
  }
}
```

**Problem**: This checked `chart.type` from `analysis.chartConfig`, but the chart was rendering as an area chart due to `customization.chartType = 'area'`.

**Result**:
- Filter expected scorecard configuration (metric/formula)
- Chart rendered as area chart (needs xAxis/yAxis)
- Chart had area chart dataMapping but was filtered as if it were a scorecard
- Placeholder appeared because area chart logic expected different data structure

## The Fix

### Changes Made to `flexible-dashboard-layout.tsx`

**Location**: Lines 186-271

**Key Improvements**:

1. **Effective Chart Type Detection**:
   ```typescript
   const customizationChartType = chartCustomizations[chartId]?.chartType
   const effectiveChartType = customizationChartType || chart.type
   ```

2. **Type-Aware Filtering**:
   - Only apply scorecard filter if `effectiveChartType === 'scorecard'`
   - This prevents filtering charts that were converted to other types

3. **Type/DataMapping Mismatch Detection**:
   - When `customizationChartType` differs from `chart.type`
   - Validate that `effectiveDataMapping` matches requirements for the new type
   - Filter out charts with invalid type/mapping combinations

4. **Comprehensive Validation**:
   ```typescript
   switch (customizationChartType) {
     case 'area':
       return !!(effectiveDM.xAxis || effectiveDM.category) &&
              !!(effectiveDM.yAxis || effectiveDM.yAxis1 || effectiveDM.values)
     case 'scorecard':
       return !!(effectiveDM.metric || effectiveDM.formula)
     // ... other cases
   }
   ```

### What This Fix Accomplishes

1. **Prevents False Positives**: Charts that were converted from scorecard to area chart will no longer be filtered as unconfigured scorecards

2. **Catches Type Mismatches**: Charts with `customization.chartType` but invalid `dataMapping` for that type will be filtered out

3. **Consistent Behavior**: Dashboard filter logic now matches chart rendering logic in `EnhancedChartWrapper`

4. **Better Logging**: Enhanced console logs show:
   - Original type vs. effective type
   - Type override detection
   - Detailed dataMapping validation results

## Expected Behavior After Fix

### For "Peak Single-Campaign Sales"

**Scenario 1**: Chart has `type='scorecard'`, `customization.chartType='area'`, valid area dataMapping
- ✅ **Result**: Chart renders as area chart with proper data
- ✅ **Why**: Filter recognizes effective type is 'area', validates area dataMapping, allows chart through

**Scenario 2**: Chart has `type='scorecard'`, `customization.chartType='area'`, missing area dataMapping
- ✅ **Result**: Chart is filtered out
- ✅ **Why**: Type mismatch validation detects area chart without xAxis/yAxis

**Scenario 3**: Chart has `type='scorecard'`, no customization override, missing metric/formula
- ✅ **Result**: Chart is filtered out (existing behavior preserved)
- ✅ **Why**: Effective type is 'scorecard', scorecard validation applies

## Testing Guide

### Test Case 1: Type Override with Valid Mapping
1. Create a scorecard chart
2. Change type to 'area' via customization panel
3. Configure valid area chart dataMapping (xAxis + yAxis)
4. **Expected**: Chart displays as area chart, no placeholder

### Test Case 2: Type Override with Invalid Mapping
1. Create a scorecard chart
2. Change type to 'area' via customization panel
3. Don't configure area chart dataMapping
4. **Expected**: Chart is filtered out, doesn't show on dashboard

### Test Case 3: Scorecard Without Customization
1. Create a scorecard chart
2. Don't configure metric or formula
3. **Expected**: Chart is filtered out (existing behavior)

### Test Case 4: The Original Bug
1. Chart configured as scorecard in analysis.chartConfig
2. customization.chartType = 'area'
3. Has valid area dataMapping (xAxis, yAxis)
4. **Expected**: Chart renders as area chart (was showing placeholder before)

## Browser Console Output

### Before Fix
```
🎨 [CHART_RENDER] Chart 5: {chartId: 'chart-5', title: 'Peak Single-Campaign Sales', type: 'scorecard'...
// Chart renders but shows placeholder
```

### After Fix
```
⚠️ [FLEXIBLE_DASHBOARD] Chart type override detected: Peak Single-Campaign Sales
  originalType: 'scorecard'
  customizedType: 'area'
  hasDataMapping: true

// Chart validates area dataMapping, passes filter, renders correctly
```

## Code Locations

### Files Modified
1. `/components/dashboard/flexible-dashboard-layout.tsx` (lines 186-271)

### Related Files (Context)
1. `/components/dashboard/enhanced-chart-wrapper.tsx` (line 234 - effectiveChartType logic)
2. `/lib/store.ts` (line 65 - ChartCustomization.chartType definition)
3. `/components/dashboard/chart-customization-panel.tsx` (chart type selection UI)

## Prevention of Future Issues

### Design Principle
**Single Source of Truth for Chart Type**

The effective chart type should always be:
```typescript
const effectiveChartType = customization?.chartType || chart.type
```

This logic must be consistent across:
- Dashboard filtering (`flexible-dashboard-layout.tsx`)
- Chart rendering (`enhanced-chart-wrapper.tsx`)
- Chart validation (any validation logic)

### Validation Rules
When implementing chart type changes:
1. Always validate dataMapping matches the new chart type
2. Ensure both rendering and filtering use the same effective type logic
3. Log type mismatches for debugging

### Code Review Checklist
- [ ] Does filtering logic use `effectiveChartType` not just `chart.type`?
- [ ] Does rendering logic use `effectiveChartType` not just `chart.type`?
- [ ] Is dataMapping validated against the effective type?
- [ ] Are console logs detailed enough for debugging?

## Summary

This fix resolves the critical chart type mismatch issue by ensuring the dashboard filter logic respects chart type customizations, matching the behavior of the chart rendering logic. It adds comprehensive validation to prevent type/dataMapping mismatches and provides detailed logging for debugging.

**Files Changed**: 1
**Lines Changed**: 85 lines (186-271 in flexible-dashboard-layout.tsx)
**Backward Compatible**: Yes - existing charts without customization.chartType are unaffected
**Testing Required**: Manual testing of type override scenarios
