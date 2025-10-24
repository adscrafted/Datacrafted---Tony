# Filtering Implementation - Quick Start Guide

## What's the Problem?

You have two filtering systems that are partially broken:

1. **Dashboard Filters** - Component built but not shown to users
2. **Chart Filters** - UI works but doesn't affect rendering

The **date range selector works fine** - it's the only filter UI users can currently access.

---

## Quick Status Table

| Feature | Status | Where | Issue |
|---------|--------|-------|-------|
| Date Range Selector | ✓ Working | Dashboard header | None - fully functional |
| Dashboard Categorical Filters | ✗ Hidden | AdvancedFilterSystem component | Component not rendered anywhere |
| Dashboard Numeric Filters | ✗ Hidden | AdvancedFilterSystem component | Component not rendered anywhere |
| Chart-level Date Aggregation | ⚠️ Broken | FiltersTab in customization | Stored but not applied to rendering |
| Chart-level Categorical Filters | ⚠️ Broken | FiltersTab in customization | Stored but not applied to rendering |
| Filter Persistence | ✗ No | All filters | Reset on page reload |

---

## The Three Main Issues

### Issue 1: Dashboard Filters Are Hidden
**File**: `components/dashboard/advanced-filter-system.tsx`
**Status**: Fully implemented but NEVER RENDERED

```
AdvancedFilterSystem component exists
  ↓
Has full UI for adding filters (line 64-392)
  ↓
Actions exist in useChartStore
  ↓
BUT: It's never imported or rendered anywhere
  ↓
Result: Users can't create dashboard filters
```

### Issue 2: Chart Filters Don't Work
**File**: `components/dashboard/chart-customization-panel/FiltersTab.tsx`
**Status**: UI works, but changes are ignored

```
User adds chart filter in FiltersTab
  ↓
Filter stored in chartCustomizations[chartId].filters ✓
  ↓
EnhancedChartWrapper receives the data ✓
  ↓
BUT: applyChartFilters() is NEVER CALLED
  ↓
Result: Charts render with unfiltered data
```

### Issue 3: Date Detection Duplicated
**Files**: 3 different implementations
- `components/dashboard/date-range-selector.tsx` (lines 55-108)
- `lib/stores/filtered-data.ts` (lines 83-112)
- `lib/utils/data-aggregation.ts` (lines 24-39)

**Status**: Same logic in 3 places with slight variations

```
Result: Hard to maintain, inconsistent behavior
```

---

## How Filtering Actually Works Right Now

```
┌─ Raw Data
│
├─ DateRangeSelector (WORKING)
│  └─ Sets useChartStore.dateRange
│
├─ AdvancedFilterSystem (BUILT BUT NOT RENDERED)
│  └─ Would set useChartStore.dashboardFilters
│
└─ FiltersTab in each chart (BROKEN)
   └─ Sets chartCustomizations[id].filters (stored but ignored)

                  ↓

getFilteredData() function (WORKING)
  - Reads dateRange from useChartStore ✓
  - Reads dashboardFilters from useChartStore ✓ (empty because UI hidden)
  - Applies date range filter ✓
  - Applies dashboard filters ✓ (none exist)
  - Applies granularity aggregation ✓
  
                  ↓

FlexibleDashboardLayout (WORKING)
  - Gets filtered data
  - Distributes to all charts
  
                  ↓

Each EnhancedChartWrapper (PARTIALLY BROKEN)
  - Receives filtered data ✓
  - Ignores stored chart filters ✗
  - Renders chart with dashboard-filtered data only
```

---

## Absolute Minimum to Fix (Pick One)

### Option A: Enable Dashboard Filters (15 minutes)
Make the AdvancedFilterSystem component visible and working.

**Steps**:
1. Open `components/dashboard/flexible-dashboard-layout.tsx`
2. Import AdvancedFilterSystem:
   ```typescript
   import { AdvancedFilterSystem } from './advanced-filter-system'
   ```
3. Add to render (above chart grid):
   ```tsx
   <AdvancedFilterSystem className="mb-4" />
   ```
4. Test: Can you see the Filters button? Can you create a filter?

---

### Option B: Apply Chart Filters (30 minutes)
Make chart-level filters actually affect the charts.

**Steps**:
1. Open `components/dashboard/enhanced-chart-wrapper/hooks/useChartData.ts`
2. Import:
   ```typescript
   import { applyChartFilters } from '@/lib/utils/chart-filters'
   ```
3. In the hook, after getting data, add:
   ```typescript
   // Apply per-chart filters
   if (customization?.filters && customization.filters.length > 0) {
     return applyChartFilters(data, customization.filters, schema)
   }
   ```
4. Test: Add a categorical filter to a chart - does it work now?

---

### Option C: Consolidate Date Detection (20 minutes)
Fix the duplicate code problem.

**Steps**:
1. Create `lib/utils/date-detection.ts`:
   ```typescript
   export function detectDateColumns(firstRow: any): string[] {
     // Copy logic from DateRangeSelector (lines 55-108)
   }
   ```
2. Update three files to use it:
   - `date-range-selector.tsx`: Replace lines 55-108
   - `filtered-data.ts`: Replace lines 83-112
   - `data-aggregation.ts`: Replace lines 24-39
3. Test: Verify date detection still works

---

## Full Picture: What to Do Next

### Step 1: Quick Wins (Do These First)
- [ ] Enable AdvancedFilterSystem (Option A above)
- [ ] Apply chart filters (Option B above)
- [ ] Run tests to confirm working

### Step 2: Code Quality
- [ ] Consolidate date detection (Option C above)
- [ ] Add comments explaining filter flow
- [ ] Update this documentation

### Step 3: Features (Later)
- [ ] Persist filters to localStorage
- [ ] Add filter templates/presets
- [ ] Support filter combinations (AND/OR logic)
- [ ] Add filter history/undo

### Step 4: Performance (Measure First)
- [ ] Test with large datasets (1000+ rows)
- [ ] Optimize filter detection if slow
- [ ] Consider caching filter results

---

## Key Files to Know

**When debugging filters, check these files in order**:

1. **FlexibleDashboardLayout** - Entry point for filtering
   - `components/dashboard/flexible-dashboard-layout.tsx` (line 86)
   - Calls `getFilteredData()`
   - Should render `<AdvancedFilterSystem />`

2. **getFilteredData()** - Core filtering logic
   - `lib/stores/filtered-data.ts` (lines 42-281)
   - Applies: date range + dashboard filters + aggregation
   - Returns filtered data to FlexibleDashboardLayout

3. **Chart Rendering** - Where filters should be applied per-chart
   - `components/dashboard/enhanced-chart-wrapper/index.tsx` (line 139)
   - Uses `useChartData()` hook
   - Should call `applyChartFilters()` before rendering

4. **State Management** - Where filters are stored
   - `lib/stores/chart-store.ts` (lines 145-148, 661-702)
   - `dashboardFilters[]`
   - `chartCustomizations[id].filters[]`
   - Actions: `addDashboardFilter()`, `updateDashboardFilter()`, etc.

---

## Filter Data Structures

### When you see dashboardFilters:
```typescript
{
  id: "1234567890",
  type: "category",           // or "date", "numeric", "text"
  column: "Region",
  operator: "in",             // or "equals", "contains", "greater_than", "less_than", "between"
  value: ["North", "South"],
  isActive: true
}
```

### When you see chartCustomizations filters:
```typescript
{
  id: "filter_1234567890",
  type: "categorical",        // or "date_aggregation", "numeric_range"
  column: "Product",
  isActive: true,
  selectedValues: ["A", "B"]  // for categorical
  // OR dateGranularity: "month" for date_aggregation
}
```

---

## Common Questions

### Q: Where do I add AdvancedFilterSystem?
**A**: In `flexible-dashboard-layout.tsx`, right before the chart grid.

### Q: Why don't chart filters work?
**A**: Because `applyChartFilters()` is never called. The function exists but isn't used in rendering.

### Q: Why are there 3 date detection implementations?
**A**: Code was developed independently in different places. Should be consolidated.

### Q: Do filters persist?
**A**: No. They reset on page reload. Add to persistence layer if needed.

### Q: Can I combine dashboard + chart filters?
**A**: Yes. Dashboard filters apply to all data, then chart filters apply on top.

### Q: What's the performance impact?
**A**: Minimal. Filtering is O(n) per filter, cached to prevent recalculation.

---

## Testing Filters Work

**After making changes, test these**:

```typescript
// 1. Date Range Filter (should already work)
- Open DateRangeSelector
- Pick a date range
- Verify charts update

// 2. Dashboard Filters (after enabling AdvancedFilterSystem)
- Click Filters button
- Select a column
- Choose a value/range
- Verify charts update

// 3. Chart Filters (after calling applyChartFilters)
- Open chart customization
- Go to Filters tab
- Add a categorical filter
- Verify only that chart filters, others don't

// 4. Combined Filters
- Set date range
- Add dashboard filter
- Add chart filter
- Verify all three apply correctly
```

---

## Debug Logging

The code has extensive logging. Check browser console:

```
🔍 [FILTERED_DATA] Starting with: { ... }
✅ [FILTERED_DATA] Cache HIT - returning cached result
📊 [FILTERED_DATA] Applying granularity aggregation: { ... }
✅ [FILTERED_DATA] Returning filtered data: { ... }

🔍 [CHART_STORE] Adding dashboard filter: columnName
📅 [CHART_STORE] Setting date range: { ... }
📊 [CHART_STORE] Setting granularity: week
```

Use these logs to trace filtering through the system.

---

## Quick Reference: Function Signatures

```typescript
// Main filtering function
getFilteredData(): DataRow[]

// Dashboard-level aggregation
aggregateDataByGranularity(
  data: DataRow[],
  granularity: 'day'|'week'|'month'|'quarter'|'year',
  dateColumn?: string
): DataRow[]

// Chart-level filtering (NEED TO CALL THIS)
applyChartFilters(
  data: DataRow[],
  filters: ChartFilter[] | undefined,
  schema?: Array<{ name: string; type: string }>
): DataRow[]

// Store actions
useChartStore.addDashboardFilter(filter: DashboardFilter)
useChartStore.setDateRange(range: DateRange | undefined)
useChartStore.setGranularity(g: 'day'|'week'|'month'|'quarter'|'year')
useChartStore.updateChartCustomization(chartId: string, customization: Partial<ChartCustomization>)
```

---

## Related Files (Don't Modify Yet)

- `lib/hooks/use-data-store-optimized.ts` - Data loading
- `app/dashboard/page.tsx` - Dashboard page container
- `components/dashboard/enhanced-chart-wrapper/hooks/useChartData.ts` - Chart data processing (WHERE YOU SHOULD ADD FILTER CALL)

---

## Next Steps

1. **Read** `FILTERING_SUMMARY.md` for overview
2. **Read** `FILTERING_IMPLEMENTATION_ANALYSIS.md` for details
3. **Choose** one of the three Options above to fix
4. **Test** using the checklist
5. **Document** what you changed

Good luck!
