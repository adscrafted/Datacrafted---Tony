# Data Calculation System - Examples & Usage Guide

## Overview

The Data Calculation System provides production-ready utilities for comprehensive data manipulations in the Datacrafted dashboard. It supports:

- **Basic Aggregations**: sum, average, count, min, max, median, mode
- **Statistical Functions**: standard deviation, percentiles, variance
- **Derived Metrics**: ratios, percentages, differences, growth rates
- **Time-Based Calculations**: period-over-period, year-over-year, running totals, moving averages
- **Group Operations**: group by with multiple aggregations, pivot tables

## Table of Contents

1. [Basic Aggregations](#basic-aggregations)
2. [Statistical Calculations](#statistical-calculations)
3. [Derived Metrics](#derived-metrics)
4. [Time-Based Calculations](#time-based-calculations)
5. [Group Operations](#group-operations)
6. [Chart Integration](#chart-integration)
7. [AI Recommendation Examples](#ai-recommendation-examples)

## Basic Aggregations

### Sum

```typescript
import { DataCalculator } from '@/lib/utils/data-calculations'

const data = [
  { revenue: 1000 },
  { revenue: 1500 },
  { revenue: 2000 }
]

const total = DataCalculator.aggregate(data, {
  column: 'revenue',
  type: 'sum'
})
// Result: 4500
```

### Average

```typescript
const average = DataCalculator.aggregate(data, {
  column: 'revenue',
  type: 'avg'
})
// Result: 1500
```

### Count, Min, Max

```typescript
const count = DataCalculator.aggregate(data, { column: 'revenue', type: 'count' })
// Result: 3

const min = DataCalculator.aggregate(data, { column: 'revenue', type: 'min' })
// Result: 1000

const max = DataCalculator.aggregate(data, { column: 'revenue', type: 'max' })
// Result: 2000
```

### Distinct Count

```typescript
const data = [
  { category: 'A' },
  { category: 'B' },
  { category: 'A' },
  { category: 'C' }
]

const distinct = DataCalculator.aggregate(data, {
  column: 'category',
  type: 'distinct'
})
// Result: 3 (A, B, C)
```

## Statistical Calculations

### Median

```typescript
const data = [
  { score: 85 },
  { score: 90 },
  { score: 78 },
  { score: 92 },
  { score: 88 }
]

const median = DataCalculator.aggregate(data, {
  column: 'score',
  type: 'median'
})
// Result: 88
```

### Mode (Most Frequent Value)

```typescript
const data = [
  { rating: 4 },
  { rating: 5 },
  { rating: 4 },
  { rating: 3 },
  { rating: 4 }
]

const mode = DataCalculator.aggregate(data, {
  column: 'rating',
  type: 'mode'
})
// Result: 4
```

### Standard Deviation

```typescript
const std = DataCalculator.aggregate(data, {
  column: 'score',
  type: 'std'
})
// Result: Standard deviation of scores
```

### Variance

```typescript
const variance = DataCalculator.aggregate(data, {
  column: 'score',
  type: 'variance'
})
// Result: Variance of scores
```

### Percentile

```typescript
const p95 = DataCalculator.aggregate(data, {
  column: 'score',
  type: 'percentile',
  percentile: 95
})
// Result: 95th percentile value
```

## Derived Metrics

### Ratio

Calculate the ratio between two columns:

```typescript
const data = [
  { clicks: 100, impressions: 1000 },
  { clicks: 150, impressions: 1200 }
]

const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'ratio',
  alias: 'ctr',
  numerator: 'clicks',
  denominator: 'impressions'
})

// Result data includes 'ctr' column: [0.1, 0.125]
```

### Percentage

```typescript
const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'percentage',
  alias: 'conversion_rate',
  numerator: 'conversions',
  denominator: 'visitors'
})

// Result: percentage values (e.g., 5.2%)
```

### Difference

```typescript
const data = [
  { actual: 1000, target: 900 },
  { actual: 1200, target: 1100 }
]

const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'difference',
  alias: 'variance',
  numerator: 'actual',
  denominator: 'target'
})

// Result: [100, 100]
```

### Growth Rate

```typescript
const data = [
  { month: 'Jan', revenue: 1000 },
  { month: 'Feb', revenue: 1100 },
  { month: 'Mar', revenue: 1250 }
]

const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'growth_rate',
  alias: 'revenue_growth',
  column: 'revenue'
})

// Result: [null, 10%, 13.6%]
```

## Time-Based Calculations

### Running Total

```typescript
const data = [
  { day: 1, sales: 100 },
  { day: 2, sales: 150 },
  { day: 3, sales: 200 }
]

const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'running_total',
  alias: 'cumulative_sales',
  column: 'sales'
})

// Result: [100, 250, 450]
```

### Moving Average

```typescript
const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'moving_average',
  alias: 'ma_7',
  column: 'sales',
  window: 7  // 7-day moving average
})
```

### Period-over-Period

```typescript
const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'period_over_period',
  alias: 'mom_change',
  column: 'revenue',
  periods: 1  // Compare to previous period
})

// Result: % change from previous period
```

### Year-over-Year

```typescript
const result = DataCalculator.calculateDerivedMetric(data, {
  type: 'year_over_year',
  alias: 'yoy_change',
  column: 'revenue',
  periods: 12  // Monthly data, compare to same month last year
})

// Result: % change from same period last year
```

## Group Operations

### Group By with Aggregation

```typescript
const data = [
  { region: 'East', revenue: 1000 },
  { region: 'West', revenue: 1500 },
  { region: 'East', revenue: 1200 },
  { region: 'West', revenue: 1800 }
]

const result = DataCalculator.groupBy(data, {
  columns: ['region'],
  aggregations: [
    { column: 'revenue', type: 'sum', alias: 'total_revenue' },
    { column: 'revenue', type: 'avg', alias: 'avg_revenue' }
  ]
})

/* Result:
[
  { region: 'East', total_revenue: 2200, avg_revenue: 1100 },
  { region: 'West', total_revenue: 3300, avg_revenue: 1650 }
]
*/
```

### Multiple Group By Columns

```typescript
const result = DataCalculator.groupBy(data, {
  columns: ['region', 'category'],
  aggregations: [
    { column: 'revenue', type: 'sum' }
  ]
})

// Groups by both region AND category
```

### Pivot Table

```typescript
const data = [
  { month: 'Jan', product: 'A', sales: 100 },
  { month: 'Jan', product: 'B', sales: 150 },
  { month: 'Feb', product: 'A', sales: 120 },
  { month: 'Feb', product: 'B', sales: 180 }
]

const result = DataCalculator.pivot(data, {
  index: ['month'],
  columns: ['product'],
  values: 'sales',
  aggFunc: 'sum'
})

/* Result:
[
  { month: 'Jan', A: 100, B: 150 },
  { month: 'Feb', A: 120, B: 180 }
]
*/
```

## Chart Integration

### Scorecard with Aggregation

```typescript
import { processChartData } from '@/lib/utils/chart-data-processor'

const chartData = processChartData(data, 'scorecard', {
  metric: 'revenue',
  aggregation: 'sum'
})

// Use in chart customization:
updateChartCustomization(chartId, {
  dataMapping: {
    metric: 'revenue',
    aggregation: 'median'  // Can be: sum, avg, median, std, etc.
  }
})
```

### Bar Chart with Grouping

```typescript
const chartData = processChartData(data, 'bar', {
  xAxis: 'region',
  yAxis: ['revenue', 'profit'],
  aggregation: 'sum',
  groupBy: ['region']
})

// Chart will automatically group and aggregate data
```

### Line Chart with Moving Average

```typescript
updateChartCustomization(chartId, {
  dataMapping: {
    xAxis: 'date',
    yAxis: 'sales',
    derivedMetrics: [
      {
        type: 'moving_average',
        alias: 'sales_ma7',
        column: 'sales',
        window: 7
      }
    ]
  }
})

// Chart will show both sales and 7-day moving average
```

### Scatter Plot with Calculated Metrics

```typescript
updateChartCustomization(chartId, {
  dataMapping: {
    xAxis: 'spend',
    yAxis: 'revenue',
    derivedMetrics: [
      {
        type: 'ratio',
        alias: 'roas',
        numerator: 'revenue',
        denominator: 'spend'
      }
    ],
    groupBy: ['campaign_type'],
    aggregation: 'avg'
  }
})

// Shows average ROAS by campaign type
```

## AI Recommendation Examples

### Example 1: Average Revenue by Region

AI recommends:
```json
{
  "type": "bar",
  "title": "Average Revenue by Region",
  "dataMapping": {
    "xAxis": "region",
    "yAxis": "revenue",
    "aggregation": "avg",
    "groupBy": ["region"]
  }
}
```

The system will:
1. Group data by region
2. Calculate average revenue for each region
3. Display as a bar chart

### Example 2: Revenue Growth Trend

```json
{
  "type": "line",
  "title": "Revenue Growth Rate",
  "dataMapping": {
    "xAxis": "month",
    "yAxis": "revenue",
    "derivedMetrics": [
      {
        "type": "growth_rate",
        "alias": "growth",
        "column": "revenue"
      }
    ]
  }
}
```

### Example 3: Statistical Summary

```json
{
  "type": "scorecard",
  "title": "Revenue Median (50th Percentile)",
  "dataMapping": {
    "metric": "revenue",
    "aggregation": "percentile",
    "percentile": 50
  }
}
```

### Example 4: Period-over-Period Comparison

```json
{
  "type": "line",
  "title": "Month-over-Month Change",
  "dataMapping": {
    "xAxis": "month",
    "yAxis": "sales",
    "derivedMetrics": [
      {
        "type": "period_over_period",
        "alias": "mom_change",
        "column": "sales",
        "periods": 1
      }
    ]
  }
}
```

## Calculation Pipeline

For complex scenarios, chain multiple calculations:

```typescript
const result = DataCalculator.calculatePipeline(data, [
  {
    type: 'derivedMetric',
    config: {
      type: 'ratio',
      alias: 'conversion_rate',
      numerator: 'conversions',
      denominator: 'clicks'
    }
  },
  {
    type: 'groupBy',
    config: {
      columns: ['campaign'],
      aggregations: [
        { column: 'conversion_rate', type: 'avg', alias: 'avg_cvr' }
      ]
    }
  }
])

// 1. Calculate conversion rate for each row
// 2. Group by campaign and average the rates
```

## Best Practices

1. **Handle Null Values**: The system automatically filters out null values before calculations
2. **Division by Zero**: Ratio and percentage calculations return null for zero denominators
3. **Data Types**: Use parseNumericValue() for currency-formatted strings
4. **Performance**: For large datasets, use aggregation before applying derived metrics
5. **Validation**: Use validateChartDataMapping() to check column existence before processing

## Error Handling

```typescript
import { validateChartDataMapping } from '@/lib/utils/chart-data-processor'

const validation = validateChartDataMapping(data, {
  xAxis: 'invalid_column',
  yAxis: 'revenue'
})

if (!validation.valid) {
  console.error('Validation errors:', validation.errors)
  // Handle errors appropriately
}
```

## Migration from Legacy System

Old approach:
```typescript
// Manual aggregation
const total = data.reduce((sum, row) => sum + row.revenue, 0)
```

New approach:
```typescript
// Use DataCalculator
const total = DataCalculator.aggregate(data, {
  column: 'revenue',
  type: 'sum'
})
```

## Support for All Chart Types

The calculation system integrates seamlessly with:
- ✅ Scorecards (all aggregation types)
- ✅ Bar/Column charts (grouped aggregation)
- ✅ Line charts (trends, moving averages)
- ✅ Area charts (cumulative, stacked)
- ✅ Scatter plots (derived dimensions)
- ✅ Pie charts (grouped aggregation)
- ✅ Combo charts (multiple calculated series)
- ✅ Tables (all calculations available)

For more examples, see the test suite and component documentation.
