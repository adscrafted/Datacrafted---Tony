# Testing AI Chart Generation Fixes

## Quick Test Checklist

### 1. Test Scorecard Count
**Expected**: AI generates 6-10 scorecards (minimum 6)
**Previous Issue**: AI was generating only 4 scorecards

**How to Test**:
1. Upload any dataset
2. Wait for AI analysis to complete
3. Count scorecards in the generated dashboard
4. ✅ Pass: 6+ scorecards generated
5. ❌ Fail: Less than 6 scorecards

**What to Check**:
- Look for scorecards with titles like:
  - "Total Revenue" (sum)
  - "Average Order Value" (avg)
  - "Total Orders" (count)
  - "Peak Daily Sales" (max)
  - "Lowest Inventory" (min)
  - "Unique Categories" (distinct)

### 2. Test Top/Bottom Rankings
**Expected**: Exactly 2 ranking charts (1 Top 10 + 1 Bottom 10)
**Previous Issue**: AI was not generating both Top and Bottom charts

**How to Test**:
1. Upload a dataset with rankable entities (e.g., campaigns, products, regions)
2. Wait for AI analysis
3. Look for ranking charts
4. ✅ Pass: Both Top 10 AND Bottom 10 charts present
5. ❌ Fail: Missing one or both ranking charts

**What to Check**:
- Top 10 chart should have: `sortOrder: "desc", limit: 10`
- Bottom 10 chart should have: `sortOrder: "asc", limit: 10`
- Both should use the same metric for comparison

### 3. Test Aggregation Values
**Expected**: Charts use "avg" (not "average")
**Previous Issue**: AI was using "avg" but validation was rejecting it

**How to Test**:
1. Upload any dataset
2. Open browser DevTools > Console
3. Look for validation errors about aggregation
4. ✅ Pass: No aggregation validation errors
5. ❌ Fail: Errors like "Invalid aggregation: avg"

**What to Check**:
- Scorecards with "Average" in title should use `aggregation: "avg"`
- No validation errors in console about aggregation types

### 4. Test Sankey Chart Removal
**Expected**: No Sankey charts generated
**Previous Issue**: AI was trying to create Sankey charts (removed from codebase)

**How to Test**:
1. Upload any dataset
2. Wait for AI analysis
3. Check all generated charts
4. ✅ Pass: No Sankey charts present
5. ❌ Fail: Sankey chart appears in recommendations

**What to Check**:
- Browse through all chart types
- Verify no chart has `type: "sankey"`
- Check browser console for Sankey-related errors

### 5. Test Total Chart Count
**Expected**: 12-16 charts total with proper distribution
**Previous Issue**: AI was generating too few charts

**How to Test**:
1. Upload any dataset
2. Wait for AI analysis
3. Count all generated charts
4. ✅ Pass: 12-16 charts total
5. ❌ Fail: Less than 12 or more than 16 charts

**Expected Distribution**:
- 6-10 scorecards
- 2 ranking charts (Top 10 + Bottom 10)
- 3-7 analytical charts (line, scatter, combo, heatmap, etc.)
- 1 table chart

## Test Datasets

### Good Test Dataset: E-commerce Data
```csv
Date,Campaign,Product,Region,Orders,Revenue,Spend,Impressions,Clicks
2024-01-01,Search,Widget A,North,150,15000,5000,10000,800
2024-01-01,Display,Widget B,South,120,12000,4000,8000,600
...
```

**Why This Works**:
- Has rankable dimensions (Campaign, Product, Region)
- Has numeric metrics for aggregation (Orders, Revenue, Spend)
- Has date column for trends
- Will trigger Top/Bottom rankings
- Will generate diverse scorecards

### Test with Amazon Ads Data
If you have Amazon Ads data, it should generate:
- 8-10 scorecards (Total Spend, Avg CPC, Total Clicks, Total Impressions, Avg CTR, etc.)
- Top 10 Campaigns by Sales
- Bottom 10 Campaigns by ROAS
- Scatter plot: Spend vs Sales
- Line chart: Daily spend trends
- Table: Campaign details

## Common Issues After Fix

### Issue: Still Getting Only 4 Scorecards
**Check**:
1. Look in browser DevTools console for errors
2. Verify the prompt is being used (check API logs)
3. Check if OpenAI is truncating the response

**Solution**: Increase `max_completion_tokens` in analyze route

### Issue: Missing Top or Bottom Chart
**Check**:
1. Does the dataset have rankable entities?
2. Check console for validation errors
3. Verify chart isn't being filtered out

**Solution**: Dataset may not have suitable ranking dimensions

### Issue: "Invalid aggregation: avg" Error
**Check**:
1. Verify the normalization code is in place (lines 1395-1398, 1525-1528)
2. Check if validation is running before normalization

**Solution**: Ensure normalization runs before validation check

## API Logs to Monitor

When testing, check these logs:

```
[API-ANALYZE] OpenAI API call completed: duration: XXXms
[VALIDATION] Chart filtering: original: XX, filtered: XX
[HYDRATION] Chart configurations hydrated: chartCount: XX
[VALIDATION] ✅ All charts validated successfully
```

**Red Flags**:
- "Invalid aggregation type: avg"
- "Filtering out unsupported chart type: sankey"
- "Chart X missing required fields"
- Filtered count significantly less than original

## Success Criteria

✅ All tests pass
✅ 6-10 scorecards generated
✅ Exactly 2 ranking charts (Top 10 + Bottom 10)
✅ No Sankey chart attempts
✅ No aggregation validation errors
✅ 12-16 total charts with proper distribution
✅ Clean console (no validation errors)

## If Tests Fail

1. Check `/app/api/analyze/route.ts` for the fixes
2. Verify normalization code is present
3. Check if Sankey is removed from SUPPORTED_CHART_TYPES
4. Review prompt sections for strengthened requirements
5. Check OpenAI response in API logs
6. Verify no build errors in Next.js

## Files to Review

- `/app/api/analyze/route.ts` - Main analyze API
- `/AI_CHART_GENERATION_FIXES.md` - Implementation details
- Browser DevTools Console - Validation errors
- Network tab - API request/response
