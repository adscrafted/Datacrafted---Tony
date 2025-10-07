# Click-to-Scroll Feature Implementation

## Overview
This feature allows users to click on a data point in a fullscreen chart and automatically scroll to the corresponding row in the data table below, with visual highlighting.

## Implementation Summary

### 1. Dashboard Page (`app/dashboard/page.tsx`)
**Lines Modified: 54, 426, 453-454**

Added state management for tracking the highlighted row:
```typescript
const [highlightedRow, setHighlightedRow] = useState<any>(null)
```

Passed callback to EnhancedChartWrapper:
```typescript
onDataPointClick={(dataPoint) => setHighlightedRow(dataPoint)}
```

Passed highlighted row to FullscreenDataTable:
```typescript
highlightedRow={highlightedRow}
onHighlightComplete={() => setHighlightedRow(null)}
```

### 2. EnhancedChartWrapper (`components/dashboard/enhanced-chart-wrapper.tsx`)
**Lines Modified: 80, 145, 1183, 1375, 1404-1413, 1564, 1784, 2089, 2105, 2121, 2146, 2162, 2178**

Added `onDataPointClick` callback prop to component interface and function parameters.

Implemented click handlers for all chart types:
- **Line Chart** (line 1183): `onClick={(data) => onDataPointClick?.(data.payload)}`
- **Bar Chart** (line 1375): `onClick={(data) => onDataPointClick?.(data.payload)}`
- **Area Chart** (line 1564): `onClick={(data) => onDataPointClick?.(data.payload)}`
- **Scatter Chart** (line 1784): `onClick={(data) => onDataPointClick?.(data.payload)}`
- **Pie Chart** (lines 1404-1413): Special handling to find matching row from aggregated data
- **Combo Chart** (lines 2089, 2105, 2121, 2146, 2162, 2178): All Bar, Area, and Line components in combo charts

### 3. FullscreenDataTable (`components/dashboard/fullscreen-data-table.tsx`)
**Lines Modified: 12-13, 25-26, 59-60**

Added props to receive and forward highlighted row information:
```typescript
highlightedRow?: any
onHighlightComplete?: () => void
```

Passed these props to TableChart component.

### 4. TableChart (`components/dashboard/charts/table-chart.tsx`)
**Lines Modified: 3, 10-11, 14, 19-21, 67-118, 138, 157-186**

#### Key Changes:

**Added imports:**
```typescript
import { useState, useMemo, useEffect, useRef } from 'react'
```

**Added state and refs:**
```typescript
const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null)
const tableContainerRef = useRef<HTMLDivElement>(null)
const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
```

**Implemented highlight and scroll logic (lines 67-118):**
- Finds matching row by comparing all data properties
- Scrolls to row with smooth animation, centering it in view
- Highlights row for 3 seconds
- Calls `onHighlightComplete` callback when animation finishes

**Updated table rendering:**
- Added ref to scrollable container
- Added refs to individual rows using callback refs
- Applied conditional CSS classes for highlighting:
  ```typescript
  className={`transition-all duration-300 ${
    isHighlighted
      ? 'bg-blue-100 shadow-md scale-[1.01] highlighted-row'
      : 'hover:bg-gray-50'
  }`}
  ```

### 5. Global Styles (`app/globals.css`)
**Lines Added: 398-416**

Added CSS animation for highlighted rows:
```css
@keyframes highlight-flash {
  0% {
    background-color: rgb(219, 234, 254); /* blue-100 */
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
  }
  50% {
    background-color: rgb(191, 219, 254); /* blue-200 */
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
  }
  100% {
    background-color: rgb(219, 234, 254); /* blue-100 */
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
  }
}

.highlighted-row {
  animation: highlight-flash 1s ease-in-out;
}
```

## How It Works

1. **User clicks a chart data point** → Chart component's onClick handler is triggered
2. **Data point passed to callback** → `onDataPointClick(data.payload)` sends the full row data
3. **State updated in dashboard** → `setHighlightedRow(dataPoint)` stores the clicked data
4. **Props flow down** → Dashboard → FullscreenDataTable → TableChart
5. **TableChart finds matching row** → Uses `findIndex` to locate row in sorted data
6. **Scroll animation** → Smoothly scrolls to center the row in the table viewport
7. **Visual highlight** → Row gets blue background with pulsing shadow animation
8. **Auto-clear** → After 3 seconds, highlight is removed and callback is triggered

## Special Handling by Chart Type

### Bar, Line, Area, Scatter
Direct click on data point passes the complete row data through `data.payload`.

### Pie Chart
Since pie chart data is aggregated, the click handler:
1. Gets the category name from the clicked slice
2. Finds the first matching row in the original dataset
3. Passes that row to the callback

### Combo Chart
All components (Bar, Line, Area) on both left and right axes have click handlers.

## User Experience

- **Visual Feedback**: Blue highlight with subtle pulsing animation
- **Smooth Scrolling**: Row is centered in the viewport with smooth animation
- **Auto-Dismiss**: Highlight automatically fades after 3 seconds
- **No Interference**: Doesn't interfere with table sorting or other interactions

## Technical Notes

- Uses React refs to access DOM elements for scrolling
- Implements proper cleanup of timers in useEffect
- Handles edge cases like sorting (finds row in sorted data)
- Type-safe with TypeScript throughout
- Responsive to different data types (numbers, strings, dates)
- Works with unlimited rows (maxRows={Infinity} in fullscreen mode)

## Files Modified

1. `/app/dashboard/page.tsx` - State management and prop passing
2. `/components/dashboard/enhanced-chart-wrapper.tsx` - Click handlers for all chart types
3. `/components/dashboard/fullscreen-data-table.tsx` - Prop forwarding
4. `/components/dashboard/charts/table-chart.tsx` - Scroll and highlight logic
5. `/app/globals.css` - Animation styles

## Testing Recommendations

1. Test with all chart types (bar, line, area, scatter, pie, combo)
2. Test with different data sizes (small and large datasets)
3. Test with sorted vs unsorted tables
4. Test rapid clicking (should handle debouncing naturally)
5. Test with different screen sizes
6. Verify accessibility (keyboard navigation, screen readers)
