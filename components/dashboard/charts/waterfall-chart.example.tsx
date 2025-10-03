'use client'

/**
 * Waterfall Chart Usage Examples
 *
 * This file demonstrates how to use the WaterfallChart component
 * in various scenarios including financial variance analysis,
 * budget-to-actual comparisons, and bridge charts.
 */

import React from 'react'
import WaterfallChart from './waterfall-chart'

// Example 1: Financial Variance Analysis
export function FinancialVarianceExample() {
  const data = [
    { period: 'Starting Balance', amount: 100000, type: 'total' },
    { period: 'Q1 Revenue', amount: 50000, type: 'increase' },
    { period: 'Q1 Expenses', amount: -30000, type: 'decrease' },
    { period: 'Q2 Revenue', amount: 60000, type: 'increase' },
    { period: 'Q2 Expenses', amount: -35000, type: 'decrease' },
    { period: 'Q3 Revenue', amount: 55000, type: 'increase' },
    { period: 'Q3 Expenses', amount: -32000, type: 'decrease' },
    { period: 'Q4 Revenue', amount: 65000, type: 'increase' },
    { period: 'Q4 Expenses', amount: -38000, type: 'decrease' },
    { period: 'Ending Balance', amount: 195000, type: 'total' }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'period',
        value: 'amount',
        type: 'type'
      }}
      title="Annual Financial Performance"
      description="Revenue and expenses breakdown by quarter"
    />
  )
}

// Example 2: Budget-to-Actual Bridge
export function BudgetToActualExample() {
  const data = [
    { item: 'Budget', value: 500000, type: 'total' },
    { item: 'Revenue Increase', value: 75000 },
    { item: 'Cost Overrun', value: -50000 },
    { item: 'Efficiency Gains', value: 30000 },
    { item: 'One-time Charges', value: -25000 },
    { item: 'FX Impact', value: -10000 },
    { item: 'Actual', value: 520000, type: 'total' }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'item',
        value: 'value'
      }}
      title="Budget to Actual Variance"
      description="Breakdown of differences between budget and actual performance"
      customization={{
        increaseColor: '#10b981',
        decreaseColor: '#f43f5e',
        totalColor: '#6366f1',
        showLabels: true,
        showConnectors: true
      }}
    />
  )
}

// Example 3: Revenue Bridge Analysis
export function RevenueBridgeExample() {
  const data = [
    { metric: 'Previous Year Revenue', value: 1000000 },
    { metric: 'Price Increases', value: 150000 },
    { metric: 'Volume Growth', value: 200000 },
    { metric: 'Customer Churn', value: -80000 },
    { metric: 'New Customers', value: 180000 },
    { metric: 'Product Mix', value: -50000 },
    { metric: 'Current Year Revenue', value: 1400000 }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'metric',
        value: 'value'
      }}
      title="Year-over-Year Revenue Bridge"
      description="Key drivers of revenue change"
      customization={{
        showLabels: true,
        showGrid: true
      }}
    />
  )
}

// Example 4: Profit Bridge
export function ProfitBridgeExample() {
  const data = [
    { category: 'Starting Profit', amount: 250000, variance_type: 'total' },
    { category: 'Revenue Growth', amount: 100000, variance_type: 'positive' },
    { category: 'COGS Increase', amount: -45000, variance_type: 'negative' },
    { category: 'Marketing Spend', amount: -30000, variance_type: 'negative' },
    { category: 'OpEx Reduction', amount: 25000, variance_type: 'positive' },
    { category: 'R&D Investment', amount: -20000, variance_type: 'negative' },
    { category: 'Other Income', amount: 15000, variance_type: 'positive' },
    { category: 'Ending Profit', amount: 295000, variance_type: 'total' }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'category',
        value: 'amount',
        type: 'variance_type'
      }}
      title="Profit Bridge Analysis"
      description="Quarterly profit variance breakdown"
    />
  )
}

// Example 5: Cash Flow Waterfall
export function CashFlowExample() {
  const data = [
    { item: 'Beginning Cash', value: 500000, type: 'total' },
    { item: 'Operating Cash Flow', value: 250000 },
    { item: 'CapEx', value: -150000 },
    { item: 'Asset Sales', value: 50000 },
    { item: 'Debt Repayment', value: -100000 },
    { item: 'Dividends', value: -75000 },
    { item: 'New Financing', value: 200000 },
    { item: 'FX Adjustments', value: -25000 },
    { item: 'Ending Cash', value: 650000, type: 'total' }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'item',
        value: 'value',
        type: 'type'
      }}
      title="Cash Flow Statement (Waterfall)"
      description="Movement in cash position over the period"
      customization={{
        showLabels: true,
        showLegend: true
      }}
    />
  )
}

// Example 6: Product Performance
export function ProductPerformanceExample() {
  const data = [
    { product: 'Baseline Sales', revenue: 2000000, category: 'total' },
    { product: 'Product A Growth', revenue: 350000, category: 'increase' },
    { product: 'Product B Decline', revenue: -150000, category: 'decrease' },
    { product: 'Product C Launch', revenue: 400000, category: 'increase' },
    { product: 'Product D Sunset', revenue: -100000, category: 'decrease' },
    { product: 'Pricing Optimization', revenue: 200000, category: 'increase' },
    { product: 'Current Sales', revenue: 2700000, category: 'total' }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'product',
        value: 'revenue',
        type: 'category'
      }}
      title="Product Portfolio Performance"
      description="Revenue impact by product line"
    />
  )
}

// Example 7: Simple Usage (Auto Type Detection)
export function SimpleExample() {
  // Without explicit type column - types are inferred from positive/negative values
  const data = [
    { stage: 'Initial', value: 1000 },
    { stage: 'Gain 1', value: 300 },
    { stage: 'Loss 1', value: -150 },
    { stage: 'Gain 2', value: 450 },
    { stage: 'Loss 2', value: -200 },
    { stage: 'Final Total', value: 1400 }
  ]

  return (
    <WaterfallChart
      data={data}
      dataMapping={{
        category: 'stage',
        value: 'value'
      }}
      title="Simple Waterfall Example"
      description="Automatic type detection based on values"
    />
  )
}

// Example 8: Usage in Chart Wrapper
export function ChartWrapperUsageExample() {
  // This shows how the waterfall chart integrates with the existing ChartWrapper
  const exampleCode = `
import { ChartWrapper } from '@/components/dashboard/chart-wrapper'

function MyDashboard() {
  const waterfallData = [
    { category: 'Start', amount: 100, type: 'total' },
    { category: 'Increase', amount: 50, type: 'increase' },
    { category: 'Decrease', amount: -30, type: 'decrease' },
    { category: 'End', amount: 120, type: 'total' }
  ]

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
  `

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Integration with ChartWrapper</h3>
      <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
        <code>{exampleCode}</code>
      </pre>
    </div>
  )
}

// Example Data for Testing
export const SAMPLE_DATA = {
  financial: [
    { period: 'Q1 Start', amount: 100000, type: 'total' },
    { period: 'Revenue', amount: 50000, type: 'increase' },
    { period: 'Expenses', amount: -30000, type: 'decrease' },
    { period: 'Q1 End', amount: 120000, type: 'total' }
  ],
  simple: [
    { stage: 'Beginning', value: 1000 },
    { stage: 'Add', value: 500 },
    { stage: 'Subtract', value: -200 },
    { stage: 'Ending', value: 1300 }
  ]
}

// Export all examples
export default {
  FinancialVarianceExample,
  BudgetToActualExample,
  RevenueBridgeExample,
  ProfitBridgeExample,
  CashFlowExample,
  ProductPerformanceExample,
  SimpleExample,
  ChartWrapperUsageExample
}
