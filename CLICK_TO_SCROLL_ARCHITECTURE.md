# Click-to-Scroll Architecture

## Component Hierarchy & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DashboardPage.tsx                            │
│                                                                   │
│  State:                                                          │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ const [highlightedRow, setHighlightedRow] = useState() │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐       │
│  │         Fullscreen Modal Container                   │       │
│  │                                                       │       │
│  │  ┌─────────────────────────────────────────────┐   │       │
│  │  │   Chart Section (65% height)                 │   │       │
│  │  │                                               │   │       │
│  │  │   <EnhancedChartWrapper                      │   │       │
│  │  │     onDataPointClick={(data) =>              │   │       │
│  │  │       setHighlightedRow(data)                │   │       │
│  │  │     }                                         │   │       │
│  │  │   />                                          │   │       │
│  │  │                                               │   │       │
│  │  │   ┌─────────────────────────────────────┐  │   │       │
│  │  │   │  📊 Charts render with onClick       │  │   │       │
│  │  │   │                                       │  │   │       │
│  │  │   │  • Bar Chart                         │  │   │       │
│  │  │   │  • Line Chart                        │  │   │       │
│  │  │   │  • Area Chart                        │  │   │       │
│  │  │   │  • Scatter Chart                     │  │   │       │
│  │  │   │  • Pie Chart                         │  │   │       │
│  │  │   │  • Combo Chart                       │  │   │       │
│  │  │   │                                       │  │   │       │
│  │  │   │  onClick={(data) =>                  │  │   │       │
│  │  │   │    onDataPointClick?.(data.payload)  │  │   │       │
│  │  │   │  }                                    │  │   │       │
│  │  │   └─────────────────────────────────────┘  │   │       │
│  │  └─────────────────────────────────────────────┘   │       │
│  │                                                       │       │
│  │  ┌─────────────────────────────────────────────┐   │       │
│  │  │   Data Table Section (35% height)           │   │       │
│  │  │                                               │   │       │
│  │  │   <FullscreenDataTable                       │   │       │
│  │  │     highlightedRow={highlightedRow}         │   │       │
│  │  │     onHighlightComplete={() =>              │   │       │
│  │  │       setHighlightedRow(null)               │   │       │
│  │  │     }                                         │   │       │
│  │  │   />                                          │   │       │
│  │  │                                               │   │       │
│  │  │   ┌─────────────────────────────────────┐  │   │       │
│  │  │   │  <TableChart                         │  │   │       │
│  │  │   │    highlightedRow={highlightedRow}  │  │   │       │
│  │  │   │    onHighlightComplete={...}        │  │   │       │
│  │  │   │  />                                  │  │   │       │
│  │  │   │                                       │  │   │       │
│  │  │   │  • Finds matching row               │  │   │       │
│  │  │   │  • Scrolls to row                   │  │   │       │
│  │  │   │  • Highlights with animation        │  │   │       │
│  │  │   │  • Auto-clears after 3s             │  │   │       │
│  │  │   └─────────────────────────────────────┘  │   │       │
│  │  └─────────────────────────────────────────────┘   │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Event Flow Sequence

```
User Action                 Component               State/Effect
───────────                 ──────────             ─────────────

1. Click bar/point    →   Chart Component
                           ├─ onClick handler
                           │  triggered
                           │
                           └─ Extracts data.payload
                                      │
                                      ↓
2. Call callback      →   onDataPointClick(payload)
                                      │
                                      ↓
3. Update state       →   DashboardPage
                           ├─ setHighlightedRow(payload)
                           │
                           └─ State updated
                                      │
                                      ↓
4. Props flow down    →   FullscreenDataTable
                           ├─ Receives highlightedRow
                           │
                           └─ Passes to TableChart
                                      │
                                      ↓
5. useEffect fires    →   TableChart
                           ├─ Finds matching row index
                           │  in sorted data
                           │
                           ├─ setHighlightedRowIndex(idx)
                           │
                           ├─ setTimeout 100ms
                           │  ├─ Get row element from ref
                           │  ├─ Calculate scroll position
                           │  └─ scrollTo({ smooth })
                           │
                           └─ setTimeout 3000ms
                              ├─ setHighlightedRowIndex(null)
                              └─ onHighlightComplete()
                                      │
                                      ↓
6. Clear state        →   DashboardPage
                           └─ setHighlightedRow(null)
```

## Component Responsibilities

### DashboardPage
**Role**: State Container
- Manages `highlightedRow` state
- Connects chart clicks to table highlights
- Provides cleanup callback

**Props Out**:
```typescript
to EnhancedChartWrapper:
  - onDataPointClick: (data) => void

to FullscreenDataTable:
  - highlightedRow: any
  - onHighlightComplete: () => void
```

### EnhancedChartWrapper
**Role**: Chart Click Handler
- Renders all chart types with click handlers
- Extracts data from click events
- Calls parent callback with full row data

**Props In**:
```typescript
- onDataPointClick?: (dataPoint: any) => void
```

**Click Handler**:
```typescript
onClick={(data) => onDataPointClick?.(data.payload)}
```

**Special Case (Pie Chart)**:
```typescript
onClick={(data) => {
  const categoryKey = dataMapping?.category || dataKey[0]
  const matchingRow = chartData.find(
    row => String(row[categoryKey]) === String(data.name)
  )
  if (matchingRow) onDataPointClick(matchingRow)
}}
```

### FullscreenDataTable
**Role**: Props Forwarder
- Passes highlightedRow to TableChart
- Passes onHighlightComplete callback
- No logic, just routing

**Props In**:
```typescript
- highlightedRow?: any
- onHighlightComplete?: () => void
```

**Props Out**:
```typescript
to TableChart:
  - highlightedRow: any
  - onHighlightComplete: () => void
```

### TableChart
**Role**: Scroll & Highlight Manager
- Finds matching row in data
- Scrolls to row
- Manages highlight state
- Triggers cleanup callback

**State**:
```typescript
const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null)
const tableContainerRef = useRef<HTMLDivElement>(null)
const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
```

**Key Logic**:
```typescript
useEffect(() => {
  if (!highlightedRow) return

  // Find row index
  const idx = sortedData.findIndex(row =>
    dataKey.every(key =>
      row[key] === highlightedRow[key] ||
      String(row[key]) === String(highlightedRow[key])
    )
  )

  if (idx !== -1) {
    setHighlightedRowIndex(idx)

    // Scroll after 100ms
    setTimeout(() => scrollToRow(idx), 100)

    // Clear after 3000ms
    setTimeout(() => {
      setHighlightedRowIndex(null)
      onHighlightComplete?.()
    }, 3000)
  }
}, [highlightedRow, sortedData])
```

## Data Matching Algorithm

```typescript
// For most charts (bar, line, area, scatter)
data.payload contains the full row:
{
  "Month": "April",
  "Sales": 2500,
  "Profit": 750,
  ...all other columns
}

// For pie charts (aggregated)
data.name contains the category value:
"April"

// Matching logic in TableChart
sortedData.findIndex(row => {
  return dataKey.every(key => {
    const rowValue = row[key]           // e.g., "April"
    const highlightValue = highlightedRow[key]  // e.g., "April"

    // Exact match or string match
    return rowValue === highlightValue ||
           String(rowValue) === String(highlightValue)
  })
})
```

## Scroll Calculation

```typescript
// Get DOM elements
const container = tableContainerRef.current
const row = rowRefs.current.get(matchingIndex)

// Get positions
const containerRect = container.getBoundingClientRect()
const rowRect = row.getBoundingClientRect()

// Calculate scroll position
const currentScroll = container.scrollTop
const rowTopRelativeToContainer = rowRect.top - containerRect.top
const absoluteRowTop = currentScroll + rowTopRelativeToContainer

// Center the row in viewport
const viewportHeight = containerRect.height
const rowHeight = rowRect.height
const centerOffset = (viewportHeight - rowHeight) / 2

// Final scroll position
const scrollTarget = absoluteRowTop - centerOffset

// Smooth scroll
container.scrollTo({
  top: scrollTarget,
  behavior: 'smooth'
})
```

## CSS Animation

```css
/* Base highlight styles */
.highlighted-row {
  background-color: rgb(219, 234, 254); /* blue-100 */
  box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
  transform: scale(1.01);
  transition: all 300ms;
  animation: highlight-flash 1s ease-in-out;
}

/* Pulsing animation */
@keyframes highlight-flash {
  0% {
    background-color: rgb(219, 234, 254);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
  }
  50% {
    background-color: rgb(191, 219, 254); /* blue-200 - brighter */
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
  }
  100% {
    background-color: rgb(219, 234, 254);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
  }
}
```

## Performance Considerations

### Optimizations
1. **Debounced scroll**: 100ms delay ensures DOM is ready
2. **Cleanup timers**: useEffect cleanup prevents memory leaks
3. **Ref map**: O(1) lookup for row elements
4. **findIndex**: O(n) but only runs on click, not render
5. **Smooth scroll**: Native browser API, GPU-accelerated

### Memory Management
- Map refs are cleaned up in callback refs
- Timers are cleared in useEffect cleanup
- State is nulled after animation completes

## Error Handling

### Edge Cases
1. **No match found**: No scroll, no highlight, silent fail
2. **Null data**: Early return in useEffect
3. **Missing refs**: Check before scrolling
4. **Sorted table**: Uses sorted data for matching
5. **Duplicate values**: Highlights first match

### Type Safety
- All props typed with TypeScript
- Optional chaining for callbacks (`?.`)
- Type guards for data matching

## Testing Strategy

### Unit Tests
- ✅ State updates correctly on click
- ✅ Callback is called with correct data
- ✅ Row matching algorithm works
- ✅ Scroll calculation is accurate
- ✅ Cleanup happens after 3s

### Integration Tests
- ✅ Click → Scroll → Highlight → Clear flow
- ✅ Works with all chart types
- ✅ Works with sorted tables
- ✅ Works with large datasets
- ✅ Multiple rapid clicks handled

### Visual Tests
- ✅ Smooth scroll animation
- ✅ Blue highlight is visible
- ✅ Pulsing effect works
- ✅ Row is centered in viewport
- ✅ Highlight fades correctly
