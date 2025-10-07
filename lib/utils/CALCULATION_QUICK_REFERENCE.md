# Data Calculations Quick Reference

## Import

```typescript
import { DataCalculator } from '@/lib/utils/data-calculations'
import { processChartData } from '@/lib/utils/chart-data-processor'
```

## Aggregation Types

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `sum` | Total of all values | Total revenue |
| `avg` | Average/mean | Average order value |
| `count` | Number of records | Total orders |
| `min` | Minimum value | Lowest price |
| `max` | Maximum value | Highest score |
| `median` | Middle value | Median income |
| `mode` | Most frequent | Most common rating |
| `std` | Standard deviation | Price volatility |
| `variance` | Variance | Data spread |
| `percentile` | Any percentile (0-100) | 95th percentile response time |
| `distinct` | Unique count | Unique customers |
| `first` | First value | Opening price |
| `last` | Last value | Closing price |

## Derived Metric Types

| Type | Description | Formula | Example |
|------|-------------|---------|---------|
| `ratio` | Division | A / B | CTR = clicks / impressions |
| `percentage` | Percentage | (A / B) × 100 | Conversion % |
| `difference` | Subtraction | A - B | Variance = actual - target |
| `growth_rate` | Growth % | ((current - previous) / previous) × 100 | Monthly growth |
| `percent_change` | Change % | Same as growth_rate | Price change |
| `running_total` | Cumulative sum | Sum up to current row | YTD revenue |
| `moving_average` | Rolling avg | Avg of last N values | 7-day MA |
| `period_over_period` | Period comparison | Compare to N periods ago | MoM change |
| `year_over_year` | Annual comparison | Compare to same period last year | YoY growth |

## Quick Examples

### 1. Simple Aggregation

```typescript
const total = DataCalculator.aggregate(data, {
  column: 'revenue',
  type: 'sum'
})
```

### 2. Group By

```typescript
const result = DataCalculator.groupBy(data, {
  columns: ['region'],
  aggregations: [
    { column: 'revenue', type: 'sum', alias: 'total' },
    { column: 'revenue', type: 'avg', alias: 'average' }
  ]
})
```

### 3. Derived Metric

```typescript
const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'ratio',
  alias: 'roas',
  numerator: 'revenue',
  denominator: 'spend'
})
```

### 4. Moving Average

```typescript
const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'moving_average',
  alias: 'ma7',
  column: 'sales',
  window: 7
})
```

### 5. Pivot Table

```typescript
const result = DataCalculator.pivot(data, {
  index: ['month'],
  columns: ['product'],
  values: 'sales',
  aggFunc: 'sum'
})
```

## Chart Integration

### Scorecard

```typescript
dataMapping: {
  metric: 'revenue',
  aggregation: 'median'  // or sum, avg, std, etc.
}
```

### Bar Chart with Grouping

```typescript
dataMapping: {
  xAxis: 'region',
  yAxis: ['revenue', 'profit'],
  aggregation: 'sum',
  groupBy: ['region']
}
```

### Line Chart with Moving Average

```typescript
dataMapping: {
  xAxis: 'date',
  yAxis: 'sales',
  derivedMetrics: [{
    type: 'moving_average',
    alias: 'sales_ma7',
    column: 'sales',
    window: 7
  }]
}
```

### Scatter with Calculated Dimension

```typescript
dataMapping: {
  xAxis: 'spend',
  yAxis: 'revenue',
  derivedMetrics: [{
    type: 'ratio',
    alias: 'roas',
    numerator: 'revenue',
    denominator: 'spend'
  }]
}
```

## Common Patterns

### Top N by Value

```typescript
const result = DataCalculator.groupBy(data, {
  columns: ['product'],
  aggregations: [{ column: 'revenue', type: 'sum' }]
})

// Then in dataMapping:
sortBy: 'revenue',
sortOrder: 'desc',
limit: 10
```

### Statistical Summary

```typescript
const stats = {
  mean: DataCalculator.aggregate(data, { column: 'value', type: 'avg' }),
  median: DataCalculator.aggregate(data, { column: 'value', type: 'median' }),
  std: DataCalculator.aggregate(data, { column: 'value', type: 'std' }),
  p95: DataCalculator.aggregate(data, { column: 'value', type: 'percentile', percentile: 95 })
}
```

### Period-over-Period

```typescript
derivedMetrics: [{
  type: 'period_over_period',
  alias: 'mom_change',
  column: 'revenue',
  periods: 1  // 1 = previous period, 12 = same month last year
}]
```

### Conversion Funnel

```typescript
derivedMetrics: [
  {
    type: 'ratio',
    alias: 'click_rate',
    numerator: 'clicks',
    denominator: 'impressions'
  },
  {
    type: 'ratio',
    alias: 'conversion_rate',
    numerator: 'conversions',
    denominator: 'clicks'
  }
]
```

## Performance Tips

1. **Filter First**: Apply filters before aggregations
2. **Group Before Metrics**: Group data before calculating derived metrics
3. **Limit Early**: Use `limit` in dataMapping for large datasets
4. **Cache Results**: Memoize expensive calculations

## Error Handling

```typescript
import { validateChartDataMapping } from '@/lib/utils/chart-data-processor'

const validation = validateChartDataMapping(data, mapping)
if (!validation.valid) {
  console.error(validation.errors)
}
```

## Common Gotchas

1. **Null Values**: Automatically filtered (won't affect results)
2. **Division by Zero**: Returns `null` (safe)
3. **Currency Strings**: Use parseNumericValue() or let system handle it
4. **Date Columns**: Ensure proper date format
5. **Column Names**: Case-sensitive

## Scorecard Badge Colors

| Aggregation | Badge Color |
|-------------|-------------|
| sum | Blue |
| avg | Purple |
| count | Green |
| min | Orange |
| max | Red |
| distinct | Teal |
| median | Indigo |
| mode | Pink |
| std | Cyan |
| variance | Amber |
| percentile | Lime |

## TypeScript Types

```typescript
import type {
  AggregationType,
  DerivedMetricType,
  AggregationConfig,
  DerivedMetricConfig,
  GroupByConfig,
  PivotConfig
} from '@/lib/utils/data-calculations'
```

## See Also

- Full Documentation: `/lib/utils/data-calculations.examples.md`
- Implementation Summary: `/CALCULATION_SYSTEM_SUMMARY.md`
- Type Definitions: `/lib/utils/data-calculations.ts`
