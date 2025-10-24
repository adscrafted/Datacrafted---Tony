# Chart Filtering - Complete Code Reference

Quick reference guide showing every file and exact line number for the filtering system.

## 1. Filter UI Component

### FiltersTab.tsx - Filter Interface
**File**: `components/dashboard/chart-customization-panel/FiltersTab.tsx`

**Key Line Numbers**:
- Line 1-20: Imports and TypeScript interfaces
- Line 21-27: Component props interface
- Line 29-35: Component function declaration
- Line 38-45: Column detection (dateColumns, categoricalColumns, numericColumns)
- Line 47-60: Add Date Aggregation Filter function
- Line 62-75: Add Categorical Filter function
- Line 77-82: Remove filter function
- Line 84-88: Update filter function
- Line 90-95: Toggle filter active status
- Line 97-100: Clear all filters
- Line 102-159: Filter UI rendering
  - Line 104-121: Header with "Clear All" button
  - Line 125-148: "Add Filter" buttons
  - Line 151-159: No filters empty state
- Line 162-290: Filter list rendering
  - Line 172-197: Filter header (toggle, type label, remove button)
  - Line 200-251: Date aggregation configuration
  - Line 254-287: Categorical filter configuration
- Line 293-299: Help text
- Line 305-420: CategoricalFilterSelector component
  - Line 316-318: Unique values extraction
  - Line 320-324: Search filter logic
  - Line 326-332: Toggle individual value selection
  - Line 334-340: Select All / Clear All logic
  - Line 343-418: UI rendering (search, checkboxes)

---

## 2. Filter Storage & State Management

### Chart Store - Filter Interfaces
**File**: `lib/stores/chart-store.ts`

**ChartFilter Interface**:
- Line 39-51: ChartFilter interface definition
  - Line 40: id (unique identifier)
  - Line 41: type ('date_aggregation' | 'categorical' | 'numeric_range')
  - Line 42: column (which data column to filter)
  - Line 43: isActive (filter enabled/disabled toggle)
  - Line 45: dateGranularity (for date_aggregation)
  - Line 47: selectedValues (for categorical)
  - Line 49-50: min/max (for numeric_range)

**ChartCustomization Interface**:
- Line 53-80: Full customization interface
  - Line 79: filters?: ChartFilter[] ← **Storage location**

**Chart Store Actions**:
- Line 170: updateChartCustomization action
  - Lines 463-475: Implementation
  - Line 470: Spreads existing customization
  - Line 471: Updates with new filters
- Line 172: batchUpdateChartCustomizations action
  - Lines 478-501: Implementation
- Line 173: removeChartCustomization action
  - Lines 503-510: Implementation

**Persistence Configuration**:
- Lines 861-871: Persist middleware configuration
  - Line 865: chartCustomizations included in persist
  - Line 869: localStorage key: 'datacrafted-chart-store'

---

## 3. Filter Application Logic

### Chart Filters Utility
**File**: `lib/utils/chart-filters.ts`

**Main Function - applyChartFilters()**:
- Line 15-44: Main filter application function
  - Line 20-21: Early return if no filters
  - Line 24: Initialize processedData
  - Line 27-41: Loop through filters and apply each
  - Line 43: Return filtered data

**Date Aggregation Filter**:
- Line 49-172: applyDateAggregation() function
  - Line 54-55: Extract column and granularity
  - Line 59: Create grouping Map
  - Line 61-103: Loop through data and group by date
    - Line 68-75: Parse date value (handle string/number/Date)
    - Line 77-98: Apply granularity (day/week/month/quarter/year)
    - Line 105-109: Add to grouped map
  - Line 112-164: Aggregate grouped data
    - Line 124-134: Sum numeric columns
    - Line 137-161: Take most common value for strings
  - Line 167-171: Sort by date

**Categorical Filter**:
- Line 177-186: applyCategoricalFilter() function
  - Line 178: Extract column and selectedValues
  - Line 180: Return all data if selectedValues empty
  - Line 182-185: Filter rows where value in selectedValues

**Numeric Range Filter**:
- Line 191-203: applyNumericRangeFilter() function
  - Line 195-202: Filter rows within min/max range

**Helper Functions**:
- Line 208-219: getUniqueValues() - Extract unique values from column
- Line 224-227: getActiveFilterCount() - Count active filters
- Line 232-253: getFilterSummary() - Human-readable filter description

---

## 4. Filter Integration in Chart Rendering

### useChartData Hook - Apply Filters
**File**: `components/dashboard/enhanced-chart-wrapper/hooks/useChartData.ts`

**Hook Declaration & Data Mapping**:
- Line 29-36: Hook function signature
  - Line 31: data: DataRow[]
  - Line 32: type: ChartType
  - Line 34: customization (includes filters)
- Line 42-45: effectiveMapping calculation
  - Merges configDataMapping and customization.dataMapping

**Filter Application**:
- Line 47-455: useMemo hook for data processing
  - Line 52-65: **CRITICAL - Apply chart-level filters**
    - Line 54: **applyChartFilters(data, customization?.filters, schema)**
    - Line 56-65: Logging of filter application
  - Line 67-74: Data slicing for performance
  - Line 76-88: Scorecard-specific debugging
  - Line 90-101: Gauge-specific debugging
  - Line 104-117: Formula processing
  - Line 119-135: Date-based sorting
  - Line 138-177: Aggregation for line/bar/area/combo
  - Line 179-402: Heatmap aggregation with smart limits
  - Line 405-451: Top/Bottom X filtering for bar charts
  - **Line 455: Dependency array including customization?.filters**

---

## 5. Integration in Customization Panel

### Chart Customization Panel - Pass Data to FiltersTab
**File**: `components/dashboard/chart-customization-panel.tsx`

**Data Retrieval**:
- Line 66: Get dataSchema
  ```typescript
  const dataSchema = useDataStore((state) => state.dataSchema)
  ```
- Line 67: Get rawData
  ```typescript
  const rawData = useDataStore((state) => state.rawData)
  ```

**FiltersTab Rendering**:
- Line 3278-3288: Filters tab conditional rendering
  ```typescript
  {activeTab === 'filters' && (
    <FiltersTab
      chartId={chartId}
      filters={customization?.filters}
      schema={dataSchema?.columns || []}
      data={rawData}
      onFiltersChange={(filters) => {
        onCustomizationChange(chartId, { filters })
      }}
    />
  )}
  ```

**Key Points**:
- Line 3281: Gets stored filters from customization
- Line 3282: Passes schema columns for field detection
- Line 3283: **Passes rawData for value selection**
- Line 3284-3286: onFiltersChange callback
  - Calls onCustomizationChange with new filters
  - Triggers chart store update

---

## 6. Data Store Interfaces

### Data Store - Column Schema
**File**: `lib/stores/data-store.ts`

**ColumnSchema Interface**:
- Line 42-60: Column metadata
  - Line 43: name: string
  - Line 44: type: 'string' | 'number' | 'boolean' | 'date' | 'categorical'
  - Line 45: uniqueValues: number
  - Line 46-47: null counts
  - Line 48: sampleValues: any[]
  - Line 49-55: stats (min, max, avg, median, std)

**DataSchema Interface**:
- Line 62-74: Schema metadata
  - Line 63: fileName
  - Line 64-65: row/column counts
  - Line 66: columns: ColumnSchema[]
  - Line 67-72: Relationships (optional)
  - Line 73: businessContext (optional)

**DataRow Interface**:
- Line 38-40: Simple key-value pair
  ```typescript
  [key: string]: string | number | boolean | Date | null
  ```

---

## 7. Related Components (For Context)

### Flexible Dashboard Layout - Entry Point
**File**: `components/dashboard/flexible-dashboard-layout.tsx`

**Uses filtering**:
- Calls getFilteredData() for dashboard-wide filtering
- Distributes rawData to EnhancedChartWrapper components
- EnhancedChartWrapper then applies chart-level filters

### Enhanced Chart Wrapper - Main Integration Point
**File**: `components/dashboard/enhanced-chart-wrapper/index.tsx`

**Uses filters**:
- Receives customization with filters
- Passes to useChartData hook
- useChartData applies filters and returns processedData

---

## 8. Quick Debug Commands

Run these in browser console to debug filters:

```javascript
// Check if rawData is loaded
useDataStore.getState().rawData

// Check if schema exists
useDataStore.getState().dataSchema

// Check all chart customizations (including filters)
useChartStore.getState().chartCustomizations

// Check filters for specific chart
useChartStore.getState().chartCustomizations['chart-id'].filters

// Check if filters are active
const chart = useChartStore.getState().chartCustomizations['chart-id']
chart.filters?.filter(f => f.isActive)

// Apply filters manually to see result
const { applyChartFilters } = await import('@/lib/utils/chart-filters')
const filtered = applyChartFilters(
  useDataStore.getState().rawData,
  useChartStore.getState().chartCustomizations['chart-id'].filters,
  useDataStore.getState().dataSchema?.columns
)
```

---

## 9. File Structure Overview

```
Project Root
├── components/dashboard/
│   ├── chart-customization-panel.tsx ← RENDERS FILTERS
│   │   └── chart-customization-panel/
│   │       └── FiltersTab.tsx ← FILTER UI
│   └── enhanced-chart-wrapper/
│       ├── index.tsx
│       └── hooks/
│           └── useChartData.ts ← APPLIES FILTERS
├── lib/
│   ├── stores/
│   │   ├── chart-store.ts ← STORES FILTERS
│   │   ├── data-store.ts ← PROVIDES DATA
│   │   └── filtered-data.ts ← DASHBOARD-LEVEL FILTERING
│   └── utils/
│       └── chart-filters.ts ← FILTER LOGIC
└── app/
    └── dashboard/
        └── page.tsx ← MAIN DASHBOARD
```

---

## 10. Data Flow with Line Numbers

```
USER INTERACTION
├─ Opens customization panel
├─ Clicks "Filters" tab
│   └─ chart-customization-panel.tsx:3278 renders FiltersTab
│
├─ Clicks "Add Category Filter"
│   └─ FiltersTab.tsx:137-146 creates new filter
│   └─ FiltersTab.tsx:281 calls onFiltersChange
│
├─ Selects values
│   └─ FiltersTab.tsx:281-282 calls updateFilter
│   └─ FiltersTab.tsx:281 calls onFiltersChange
│
└─ onFiltersChange callback executed
   └─ chart-customization-panel.tsx:3284-3286
   └─ Calls onCustomizationChange(chartId, { filters })
   └─ chart-store.tsx:463-475 updateChartCustomization
   └─ Filters stored in chartCustomizations[chartId].filters
   └─ Persisted to localStorage via persist middleware (line 861-871)

RENDERING
├─ EnhancedChartWrapper detects customization change
├─ useChartData hook runs (line 47-455)
├─ Line 54: applyChartFilters called
├─ Line 177-186: Categorical filter applied
├─ Returns processedData (filtered)
└─ Chart renders with filtered data
```

---

## 11. Common Issues & Solutions

### Issue: Can't See Filter Values
**Problem**: CategoricalFilterSelector shows "No values found"
**Cause**: rawData is empty (line 67 in chart-customization-panel.tsx)
**Solution**: Check if `useDataStore.getState().rawData` is populated

### Issue: Filter Stored But Not Applied
**Problem**: Filter appears in console but chart doesn't update
**Cause**: Chart rendering might not be calling applyChartFilters
**Solution**: Check that useChartData hook includes filters in dependency array (line 455)

### Issue: Date Aggregation Breaks Chart
**Problem**: Chart displays wrong data after date filter applied
**Cause**: Date format changed by aggregation (line 117)
**Solution**: Ensure chart can handle aggregated date formats

### Issue: No Visual Indication of Active Filters
**Problem**: User can't see which filters are applied
**Cause**: No badge/indicator in UI (missing feature)
**Solution**: Add visual badge to chart showing active filter count

---

## 12. Testing Matrix

| Test Case | File to Check | Expected Result |
|-----------|---------------|-----------------|
| Add filter button visible | FiltersTab.tsx:127-146 | Buttons show if columns exist |
| Filter values load | FiltersTab.tsx:316-318 + chart-customization-panel.tsx:67 | Values shown if rawData populated |
| Filter stored | chart-store.ts:463-475 | Filter in localStorage |
| Filter applied | useChartData.ts:54 | Data reduced in console |
| Chart updates | enhanced-chart-wrapper/index.tsx | Chart re-renders |
| Filter persists | chart-store.ts:861-871 | Filter survives page reload |

