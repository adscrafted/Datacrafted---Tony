# Waterfall Chart Component

A production-ready waterfall chart component for financial variance analysis, bridge charts, and variance breakdowns. Built with Recharts and fully integrated with the Datacrafted dashboard system.

## Features

- **Financial Analysis**: Perfect for variance analysis, budget-to-actual comparisons, and bridge charts
- **Visual Clarity**: Color-coded increases (green), decreases (red), and totals (blue)
- **Smart Type Detection**: Automatically infers bar types from data or uses explicit type column
- **Interactive Tooltips**: Rich tooltips showing change amounts and cumulative values
- **Responsive Design**: Works seamlessly across all screen sizes
- **Customizable**: Full control over colors, labels, legends, and connectors
- **TypeScript Support**: Full type safety with comprehensive type definitions
- **Performance Optimized**: Lazy loaded for optimal bundle size
- **Accessible**: Built with accessibility best practices

## Installation

The component is already integrated into the ChartWrapper. No additional installation needed.

## Basic Usage

### Direct Component Usage

```tsx
import WaterfallChart from '@/components/dashboard/charts/waterfall-chart'

function MyDashboard() {
  const data = [
    { category: 'Starting Balance', amount: 100000, type: 'total' },
    { category: 'Q1 Revenue', amount: 50000, type: 'increase' },
    { category: 'Q1 Expenses', amount: -30000, type: 'decrease' },
    { category: 'Ending Balance', amount: 120000, type: 'total' }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'category',
        value: 'amount',
        type: 'type'
      }}
      title="Quarterly Financial Performance"
      description="Revenue and expenses breakdown"
    />
  )
}
```

### Usage with ChartWrapper

```tsx
import { ChartWrapper } from '@/components/dashboard/chart-wrapper'

function MyDashboard() {
  return (
    <ChartWrapper
      type="waterfall"
      title="Financial Variance"
      description="Year over year changes"
      data={waterfallData}
      dataKey={['category', 'amount']}
      dataMapping={{
        category: 'category',
        value: 'amount',
        type: 'type'
      }}
    />
  )
}
```

## Props API

### WaterfallChartProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `any[]` | Yes | Array of data points |
| `dataMapping` | `DataMapping` | Yes | Column mappings for chart data |
| `title` | `string` | No | Chart title |
| `description` | `string` | No | Chart description |
| `customization` | `Customization` | No | Visual customization options |

### DataMapping

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `category` | `string` | Yes | Column name for categories (x-axis) |
| `value` | `string` | Yes | Column name for values (bar heights) |
| `type` | `string` | No | Column name for bar types (increase/decrease/total) |

### Customization

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `increaseColor` | `string` | `#22c55e` | Color for increase bars |
| `decreaseColor` | `string` | `#ef4444` | Color for decrease bars |
| `totalColor` | `string` | `#3b82f6` | Color for total bars |
| `neutralColor` | `string` | `#94a3b8` | Color for neutral bars |
| `showConnectors` | `boolean` | `true` | Show connecting lines between bars |
| `showLabels` | `boolean` | `true` | Show value labels on bars |
| `showLegend` | `boolean` | `true` | Show legend |
| `showGrid` | `boolean` | `true` | Show grid lines |

## Data Format

### With Explicit Type Column

When you have a column explicitly defining the type:

```typescript
const data = [
  { period: 'Start', value: 1000, type: 'total' },
  { period: 'Increase', value: 500, type: 'increase' },
  { period: 'Decrease', value: -200, type: 'decrease' },
  { period: 'End', value: 1300, type: 'total' }
]
```

Supported type values (case-insensitive):
- **Total/Sum**: `'total'`, `'sum'`, `'ending'`, `'final'`, `'net'`
- **Increase**: `'increase'`, `'positive'`, `'gain'`
- **Decrease**: `'decrease'`, `'negative'`, `'loss'`

### Auto Type Detection

Without a type column, types are inferred from values:

```typescript
const data = [
  { stage: 'Beginning', amount: 1000 }, // Inferred as total (first item)
  { stage: 'Gain', amount: 500 },       // Inferred as increase (positive)
  { stage: 'Loss', amount: -200 },      // Inferred as decrease (negative)
  { stage: 'Ending Total', amount: 1300 } // Inferred as total (keyword match)
]
```

Auto detection rules:
1. First item is treated as starting total
2. Positive values → increase
3. Negative values → decrease
4. Items with keywords (total, sum, final, etc.) → total
5. Last item is often treated as ending total

## Use Cases

### 1. Financial Variance Analysis

Compare actual vs budget, period-over-period changes, or forecast vs actual:

```typescript
const variance = [
  { metric: 'Budget', value: 1000000, type: 'total' },
  { metric: 'Sales Increase', value: 150000 },
  { metric: 'Cost Overrun', value: -75000 },
  { metric: 'Efficiency Gain', value: 50000 },
  { metric: 'Actual', value: 1125000, type: 'total' }
]
```

### 2. Revenue Bridge

Show how revenue changed from one period to another:

```typescript
const revenueBridge = [
  { driver: 'Last Year', value: 5000000 },
  { driver: 'Price Increase', value: 400000 },
  { driver: 'Volume Growth', value: 600000 },
  { driver: 'Customer Churn', value: -250000 },
  { driver: 'New Products', value: 350000 },
  { driver: 'This Year', value: 6100000 }
]
```

### 3. Profit Waterfall

Track profit changes through various factors:

```typescript
const profitWaterfall = [
  { item: 'Gross Profit', value: 2000000, type: 'total' },
  { item: 'Marketing', value: -400000 },
  { item: 'R&D', value: -300000 },
  { item: 'Admin', value: -250000 },
  { item: 'Other Income', value: 150000 },
  { item: 'EBIT', value: 1200000, type: 'total' }
]
```

### 4. Cash Flow Statement

Visualize cash movements:

```typescript
const cashFlow = [
  { activity: 'Beginning Cash', value: 500000, type: 'total' },
  { activity: 'Operations', value: 300000 },
  { activity: 'Investing', value: -200000 },
  { activity: 'Financing', value: 100000 },
  { activity: 'Ending Cash', value: 700000, type: 'total' }
]
```

## Customization Examples

### Custom Colors

```tsx
<WaterfallChart
  data={data}
  dataMapping={mapping}
  customization={{
    increaseColor: '#10b981', // Emerald
    decreaseColor: '#f43f5e', // Rose
    totalColor: '#6366f1',    // Indigo
  }}
/>
```

### Minimal Style

```tsx
<WaterfallChart
  data={data}
  dataMapping={mapping}
  customization={{
    showLabels: false,
    showGrid: false,
    showLegend: false,
  }}
/>
```

### Full Featured

```tsx
<WaterfallChart
  data={data}
  dataMapping={mapping}
  title="Comprehensive Financial Analysis"
  description="Detailed breakdown with all visual elements"
  customization={{
    showLabels: true,
    showGrid: true,
    showLegend: true,
    showConnectors: true,
    increaseColor: '#059669',
    decreaseColor: '#dc2626',
    totalColor: '#2563eb',
  }}
/>
```

## Best Practices

### Data Preparation

1. **Include Start and End Totals**: Always start with a baseline and end with a final total
2. **Use Clear Categories**: Label categories clearly (e.g., "Q1 Revenue" not just "Q1")
3. **Consistent Units**: Ensure all values use the same units and scale
4. **Logical Order**: Arrange items in a logical sequence that tells a story

### Visual Design

1. **Limit Items**: Keep to 5-10 items for optimal readability
2. **Use Labels Wisely**: Enable labels for key insights, disable for cluttered charts
3. **Color Consistency**: Stick to standard colors (green=good, red=bad) unless context demands otherwise
4. **Grid Lines**: Use grid for precise value reading, hide for cleaner aesthetic

### Performance

1. **Data Volume**: Works best with up to 20 data points
2. **Lazy Loading**: Component is lazy loaded by default when used via ChartWrapper
3. **Memoization**: All calculations are memoized for optimal performance

## Error Handling

The component handles common edge cases:

- **Empty Data**: Shows helpful placeholder message
- **Missing Columns**: Falls back to default column names
- **Invalid Values**: Treats non-numeric values as 0
- **Type Mismatches**: Auto-converts string numbers to numerics

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Color-blind friendly default palette
- High contrast tooltips

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- `recharts`: ^3.1.0
- `react`: ^19.1.1
- `lucide-react`: ^0.534.0

## TypeScript

Full TypeScript support with exported types:

```typescript
import WaterfallChart, {
  WaterfallChartProps,
  WaterfallDataPoint
} from '@/components/dashboard/charts/waterfall-chart'
```

## Examples

See `waterfall-chart.example.tsx` for comprehensive examples including:
- Financial variance analysis
- Budget-to-actual bridge
- Revenue bridge
- Profit bridge
- Cash flow waterfall
- Product performance
- Simple usage patterns

## FAQ

**Q: How do I handle very large or very small numbers?**
A: The Y-axis automatically formats numbers with K/M suffixes for readability.

**Q: Can I show multiple series?**
A: No, waterfall charts are designed for single-series variance analysis. Use a stacked bar chart for multi-series data.

**Q: How do I customize the tooltip?**
A: The tooltip is optimized for financial data. For custom tooltips, you'll need to modify the CustomTooltip component.

**Q: What if my data has currency symbols?**
A: The component automatically strips currency symbols ($, €, £, ¥) and commas from string values.

**Q: Can I animate the chart?**
A: The bars render with Recharts' default animations. The invisible positioning bars are not animated for performance.

## Troubleshooting

### Bars Not Showing
- Check that value column contains numeric values
- Ensure data array is not empty
- Verify column names match dataMapping

### Incorrect Cumulative Values
- Verify the 'type' column values are correct
- Check that total bars represent actual cumulative sums
- Ensure no duplicate processing of totals

### Labels Overlapping
- Reduce number of data points
- Disable labels with `showLabels: false`
- Increase chart height

## Support

For issues or questions:
1. Check the examples in `waterfall-chart.example.tsx`
2. Review this documentation
3. Check the component source code for inline comments
4. File an issue in the project repository

---

**Component Location**: `/components/dashboard/charts/waterfall-chart.tsx`
**Version**: 1.0.0
**Last Updated**: 2025-10-03
