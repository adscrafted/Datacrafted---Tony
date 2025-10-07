# Click-to-Scroll Feature - Usage Guide

## What This Feature Does

When viewing a chart in fullscreen mode, you can now click on any data point in the chart, and the data table below will automatically:
1. Scroll to the corresponding row
2. Highlight that row with a blue animation
3. Keep the highlight visible for 3 seconds

## How to Use

### Step 1: Open a Chart in Fullscreen
Click the fullscreen icon on any chart in your dashboard.

### Step 2: Click a Data Point
Click on any of the following:
- **Bar in a bar chart** - Click on the bar
- **Point/line in a line chart** - Click on the line or data point
- **Area in an area chart** - Click on the filled area
- **Point in a scatter plot** - Click on any scatter point
- **Slice in a pie chart** - Click on any pie slice
- **Any element in a combo chart** - Click on bars, lines, or areas

### Step 3: Watch the Magic
The table below will:
1. **Smoothly scroll** to center the matching row
2. **Highlight the row** with a blue background
3. **Pulse animation** to draw your attention
4. **Auto-fade** after 3 seconds

## Visual Example

```
┌─────────────────────────────────────────┐
│  Sales by Month - Fullscreen            │
├─────────────────────────────────────────┤
│                                          │
│     Chart Area (65% height)             │
│     ┌────────────────────┐              │
│     │    📊 Bar Chart    │              │
│     │    [Click here!]   │ ← Click bar  │
│     │    ┌─┐  ┌─┐  ┌─┐  │              │
│     │    │█│  │█│  │█│  │              │
│     │    └─┘  └─┘  └─┘  │              │
│     └────────────────────┘              │
│                                          │
├─────────────────────────────────────────┤
│  Underlying Data (35% height)           │
│  ┌─────────────────────────────────┐   │
│  │ Month     │ Sales    │ ...       │   │
│  ├───────────┼──────────┼──────────┤   │
│  │ January   │ 1000     │ ...       │   │
│  │ February  │ 1500     │ ...       │   │
│  │ March     │ 2000     │ ...       │ ← Scrolls here!
│  │ ╔═══════════════════════════════╗   │
│  │ ║ April    │ 2500    │ ...      ║   │ ← Highlighted!
│  │ ╚═══════════════════════════════╝   │
│  │ May       │ 3000     │ ...       │   │
│  │ June      │ 3500     │ ...       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Supported Chart Types

### ✅ Bar Chart
- Click any bar
- Scrolls to the row for that X-axis category

### ✅ Line Chart
- Click any point on the line
- Scrolls to the row for that X-axis value

### ✅ Area Chart
- Click anywhere on the filled area
- Scrolls to the row for that X-axis value

### ✅ Scatter Plot
- Click any scatter point
- Scrolls to the exact row for that data point

### ✅ Pie Chart
- Click any pie slice
- Scrolls to the first row matching that category

### ✅ Combo Chart
- Click bars, lines, or areas
- Works on both left and right axis metrics

## Behavior Details

### Scrolling
- **Smooth animation** - The table scrolls smoothly, not instantly
- **Centered view** - The row appears in the middle of the visible area
- **Smart positioning** - Won't scroll if the row is already visible

### Highlighting
- **Duration**: 3 seconds
- **Color**: Light blue (blue-100) with darker pulse (blue-200)
- **Animation**: Subtle pulsing shadow effect
- **No interference**: You can still sort, scroll, or interact with the table while highlighted

### Edge Cases Handled
- **Sorted tables**: Finds the row even after sorting
- **Multiple matches**: Highlights the first matching row
- **Large datasets**: Works with unlimited rows
- **Rapid clicking**: Each click resets the highlight timer

## Tips

1. **Use with filtering** - If you've applied date range filters, clicking will only scroll to visible rows
2. **Table sorting** - The feature works even if you've sorted the table
3. **Multiple metrics** - In combo charts, clicking different metrics still works
4. **Pie chart aggregation** - Pie slices show aggregated data, so it scrolls to the first matching category

## Technical Benefits

- **Fast**: No lag even with thousands of rows
- **Accurate**: Uses exact data matching, not just position
- **Accessible**: Works with keyboard navigation
- **Responsive**: Adapts to different screen sizes

## Troubleshooting

**Q: I clicked but nothing happened**
- Make sure you're in fullscreen mode (not the dashboard grid view)
- Ensure the data table is visible below the chart

**Q: The wrong row is highlighted**
- This can happen if there are duplicate values. The feature highlights the first match

**Q: The highlight disappeared too quickly**
- The highlight lasts 3 seconds by default. You can click again to reset it

**Q: It doesn't work with my custom chart**
- Currently supported chart types: bar, line, area, scatter, pie, combo
- Scorecard and table charts don't have this feature (they're not applicable)

## Future Enhancements (Potential)

- [ ] Configurable highlight duration
- [ ] Different highlight colors based on chart type
- [ ] Keyboard shortcuts to navigate between data points
- [ ] Multi-row highlighting for aggregated categories
- [ ] Sound effects or haptic feedback
- [ ] Highlight all matching rows instead of just the first one
