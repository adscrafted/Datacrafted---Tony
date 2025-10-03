# Reset Layout Algorithm Documentation

## Overview

The "Reset Layout" button implements a smart layout algorithm that arranges all charts in an organized, professional manner without horizontal scrolling.

## Algorithm Design

### Core Principles

1. **Scorecards First**: All scorecards are placed at the top of the dashboard
2. **Side-by-Side Arrangement**: Charts are arranged horizontally to maximize viewport usage
3. **No Horizontal Scroll**: All charts fit within the 12-column grid width
4. **Vertical Scrolling Allowed**: Charts continue vertically as needed
5. **Production-Ready**: Simple, clean, well-documented code

### Grid System

- **Total Columns**: 12
- **Row Height**: 200px
- **Grid Width**: ~2400px (on typical desktop displays)

### Chart Dimensions

| Chart Type | Width (cols) | Height (rows) | Actual Size |
|------------|--------------|---------------|-------------|
| Scorecard  | 2            | 1             | 400px × 200px |
| Bar/Line/Area | 6         | 4             | 1200px × 800px |
| Pie Chart  | 4            | 4             | 800px × 800px |
| Scatter    | 7            | 4             | 1400px × 800px |
| Table      | 12           | 6             | Full width × 1200px |

## Algorithm Steps

### Step 1: Separate Charts by Type

```typescript
// Separate scorecards from other charts
const scorecards = []
const otherCharts = []

validCharts.forEach(config => {
  if (config.type === 'scorecard') {
    scorecards.push({ config, chartId })
  } else {
    otherCharts.push({ config, chartId })
  }
})
```

### Step 2: Place Scorecards at Top

Scorecards are arranged horizontally at y=0:
- 6 scorecards fit per row (2 cols × 6 = 12 cols)
- When row is full, move to next row

```
Row 0: [SC1][SC2][SC3][SC4][SC5][SC6]
Row 1: [SC7][SC8][SC9]...
```

### Step 3: Place Other Charts Below

Charts are placed left-to-right, top-to-bottom:
- Start at y position after all scorecards
- Place charts side-by-side when they fit
- Track the maximum height in each row
- Move to next row when chart doesn't fit

## Example Layouts

### Example 1: Mixed Dashboard

**Input:**
- 6 Scorecards
- 2 Bar Charts (6 cols each)
- 1 Pie Chart (4 cols)
- 1 Table (12 cols)

**Output:**
```
Row 0-1: [SC1][SC2][SC3][SC4][SC5][SC6]  (Scorecards at top)
Row 1-5: [    Bar Chart 1 (6)    ][    Bar Chart 2 (6)    ]
Row 5-9: [  Pie Chart (4)  ][              Space              ]
Row 9-15: [            Table (12 - full width)                ]
```

### Example 2: Analytics Dashboard

**Input:**
- 4 Scorecards
- 4 Line Charts (6 cols each)

**Output:**
```
Row 0:   [SC1][SC2][SC3][SC4]                   (Scorecards)
Row 1-5: [   Line 1 (6)   ][   Line 2 (6)   ]
Row 5-9: [   Line 3 (6)   ][   Line 4 (6)   ]
```

### Example 3: Data Exploration Dashboard

**Input:**
- 3 Scorecards
- 3 Pie Charts (4 cols each)
- 2 Bar Charts (6 cols each)

**Output:**
```
Row 0:    [SC1][SC2][SC3]                        (Scorecards)
Row 1-5:  [Pie1(4)][Pie2(4)][Pie3(4)]           (3 pies fit)
Row 5-9:  [  Bar 1 (6)   ][  Bar 2 (6)   ]
```

## Key Features

### 1. Intelligent Row Packing

The algorithm tracks `maxHeightInRow` to ensure proper vertical spacing:

```typescript
let maxHeightInRow = 0

otherCharts.forEach(({ config, chartId }) => {
  const dims = getFixedDimensions(config)

  // Check if chart fits
  if (currentX + dims.w > 12) {
    currentY += maxHeightInRow  // Use max height, not fixed height
    maxHeightInRow = 0
    currentX = 0
  }

  // Place chart...
  maxHeightInRow = Math.max(maxHeightInRow, dims.h)
})
```

### 2. No Horizontal Scroll

All charts fit within 12 columns:
- Scorecards: 2 cols (6 per row max)
- Standard charts: 6 cols (2 per row)
- Pie charts: 4 cols (3 per row)
- Tables: 12 cols (1 per row)

### 3. Production-Ready Code

- Clear variable names with UPPER_CASE for constants
- Comprehensive comments explaining each step
- Proper type definitions
- Error-free TypeScript compilation

## Implementation Location

**File**: `/components/dashboard/flexible-dashboard-layout.tsx`

**Lines**: 497-605

**Button Location**: Dashboard toolbar, next to "Add Chart" button

## Testing Scenarios

### Test 1: Empty Dashboard
- **Input**: No charts
- **Expected**: No changes, no errors

### Test 2: Only Scorecards
- **Input**: 10 scorecards
- **Expected**:
  - Row 0: 6 scorecards
  - Row 1: 4 scorecards

### Test 3: Only Standard Charts
- **Input**: 4 bar charts
- **Expected**:
  - Row 0-4: 2 bar charts
  - Row 4-8: 2 bar charts

### Test 4: Mixed with Table
- **Input**: 2 scorecards, 1 bar chart, 1 table
- **Expected**:
  - Row 0: 2 scorecards
  - Row 1-5: 1 bar chart
  - Row 5-11: 1 table (full width)

## Benefits

1. **User Experience**: Clean, organized dashboard layout
2. **Accessibility**: All charts visible without horizontal scrolling
3. **Professional**: Consistent spacing and alignment
4. **Maintainable**: Simple, well-documented code
5. **Performant**: Single-pass algorithm, O(n) complexity

## Future Enhancements

Possible improvements (not currently implemented):
1. Smart packing for mixed-size charts (bin packing algorithm)
2. User preferences for layout style (compact vs. spacious)
3. Responsive breakpoints for mobile devices
4. Save/restore layout preferences
5. Drag-and-drop to override automatic layout

## Related Files

- `components/dashboard/flexible-dashboard-layout.tsx` - Main layout component
- `components/dashboard/simple-auto-placer.tsx` - Alternative placement algorithms
- `lib/store.ts` - Chart customization state management
- `components/dashboard/enhanced-chart-wrapper.tsx` - Individual chart wrapper
