/**
 * Chart Types Examples
 * Quick reference and code examples for implementing each chart type
 */

import type {
  WaterfallDataPoint,
  FunnelDataPoint,
  HeatmapDataPoint,
  GaugeData,
  CohortDataPoint,
  BulletData,
  TreemapNode,
  SankeyData,
  SparklineDataPoint,
  RadarDataPoint,
  WaterfallChartCustomization,
  FunnelChartCustomization,
  HeatmapChartCustomization,
  GaugeChartCustomization,
  CohortChartCustomization,
  BulletChartCustomization,
  TreemapChartCustomization,
  SankeyChartCustomization,
  SparklineChartCustomization,
  RadarChartCustomization
} from './chart-types'

// ============================================================================
// DATA EXAMPLES - Sample data for each chart type
// ============================================================================

/**
 * Example 1: Waterfall Chart - P&L Statement
 */
export const waterfallExample: WaterfallDataPoint[] = [
  { category: 'Starting Revenue', value: 1000000, type: 'total' },
  { category: 'Product Sales', value: 450000, type: 'increase' },
  { category: 'Service Revenue', value: 350000, type: 'increase' },
  { category: 'Cost of Goods', value: -400000, type: 'decrease' },
  { category: 'Operating Expenses', value: -250000, type: 'decrease' },
  { category: 'Gross Profit', value: 1150000, type: 'subtotal' },
  { category: 'Taxes', value: -200000, type: 'decrease' },
  { category: 'Net Profit', value: 950000, type: 'total' }
]

/**
 * Example 2: Funnel Chart - Sales Pipeline
 */
export const funnelExample: FunnelDataPoint[] = [
  { stage: 'Website Visitors', value: 10000, order: 1, conversionRate: 1.0 },
  { stage: 'Signed Up', value: 2500, order: 2, conversionRate: 0.25 },
  { stage: 'Free Trial', value: 1000, order: 3, conversionRate: 0.4 },
  { stage: 'Paid Conversion', value: 400, order: 4, conversionRate: 0.4 },
  { stage: 'Active Users', value: 350, order: 5, conversionRate: 0.875 }
]

/**
 * Example 3: Heatmap - Correlation Matrix
 */
export const heatmapExample: HeatmapDataPoint[] = [
  { x: 'Revenue', y: 'Marketing Spend', value: 0.85, label: '0.85' },
  { x: 'Revenue', y: 'Sales Team Size', value: 0.72, label: '0.72' },
  { x: 'Revenue', y: 'Product Features', value: 0.45, label: '0.45' },
  { x: 'Marketing Spend', y: 'Sales Team Size', value: 0.63, label: '0.63' },
  { x: 'Marketing Spend', y: 'Product Features', value: 0.31, label: '0.31' },
  { x: 'Sales Team Size', y: 'Product Features', value: 0.28, label: '0.28' }
]

/**
 * Example 4: Gauge Chart - KPI Progress
 */
export const gaugeExample: GaugeData = {
  value: 78,
  min: 0,
  max: 100,
  target: 85,
  thresholds: {
    poor: 40,
    fair: 60,
    good: 80,
    excellent: 90
  },
  unit: '%'
}

/**
 * Example 5: Cohort Analysis - User Retention
 */
export const cohortExample: CohortDataPoint[] = [
  // January 2024 cohort
  { cohort: 'Jan 2024', period: 'Week 0', value: 1.0, cohortSize: 1000, retainedCount: 1000 },
  { cohort: 'Jan 2024', period: 'Week 1', value: 0.75, cohortSize: 1000, retainedCount: 750 },
  { cohort: 'Jan 2024', period: 'Week 2', value: 0.62, cohortSize: 1000, retainedCount: 620 },
  { cohort: 'Jan 2024', period: 'Week 3', value: 0.55, cohortSize: 1000, retainedCount: 550 },
  // February 2024 cohort
  { cohort: 'Feb 2024', period: 'Week 0', value: 1.0, cohortSize: 1200, retainedCount: 1200 },
  { cohort: 'Feb 2024', period: 'Week 1', value: 0.78, cohortSize: 1200, retainedCount: 936 },
  { cohort: 'Feb 2024', period: 'Week 2', value: 0.65, cohortSize: 1200, retainedCount: 780 },
  // March 2024 cohort
  { cohort: 'Mar 2024', period: 'Week 0', value: 1.0, cohortSize: 1500, retainedCount: 1500 },
  { cohort: 'Mar 2024', period: 'Week 1', value: 0.82, cohortSize: 1500, retainedCount: 1230 }
]

/**
 * Example 6: Bullet Chart - Performance Dashboard
 */
export const bulletExample: BulletData = {
  metric: 'Quarterly Revenue',
  actual: 875000,
  target: 1000000,
  comparison: 750000, // Previous quarter
  ranges: {
    poor: [0, 600000],
    satisfactory: [600000, 800000],
    good: [800000, 1000000]
  },
  unit: '$'
}

/**
 * Example 7: Treemap - Product Category Sales
 */
export const treemapExample: TreemapNode = {
  name: 'Total Sales',
  value: 0, // Calculated from children
  children: [
    {
      name: 'Electronics',
      value: 450000,
      children: [
        { name: 'Phones', value: 280000 },
        { name: 'Laptops', value: 120000 },
        { name: 'Accessories', value: 50000 }
      ]
    },
    {
      name: 'Clothing',
      value: 320000,
      children: [
        { name: 'Men', value: 180000 },
        { name: 'Women', value: 110000 },
        { name: 'Kids', value: 30000 }
      ]
    },
    {
      name: 'Home & Garden',
      value: 230000,
      children: [
        { name: 'Furniture', value: 150000 },
        { name: 'Decor', value: 50000 },
        { name: 'Garden', value: 30000 }
      ]
    }
  ]
}

/**
 * Example 8: Sankey Diagram - Traffic Flow
 */
export const sankeyExample: SankeyData = {
  nodes: [
    { id: 'organic', name: 'Organic Search' },
    { id: 'paid', name: 'Paid Ads' },
    { id: 'social', name: 'Social Media' },
    { id: 'direct', name: 'Direct Traffic' },
    { id: 'homepage', name: 'Homepage' },
    { id: 'products', name: 'Products' },
    { id: 'blog', name: 'Blog' },
    { id: 'checkout', name: 'Checkout' },
    { id: 'conversion', name: 'Conversion' }
  ],
  links: [
    { source: 'organic', target: 'homepage', value: 2500 },
    { source: 'organic', target: 'blog', value: 1500 },
    { source: 'paid', target: 'products', value: 3000 },
    { source: 'social', target: 'homepage', value: 1200 },
    { source: 'social', target: 'blog', value: 800 },
    { source: 'direct', target: 'homepage', value: 1000 },
    { source: 'homepage', target: 'products', value: 3200 },
    { source: 'products', target: 'checkout', value: 2800 },
    { source: 'blog', target: 'products', value: 1000 },
    { source: 'checkout', target: 'conversion', value: 1400 }
  ]
}

/**
 * Example 9: Sparkline - Weekly Trend
 */
export const sparklineExample: SparklineDataPoint[] = [
  { x: 'Mon', y: 45 },
  { x: 'Tue', y: 52 },
  { x: 'Wed', y: 48 },
  { x: 'Thu', y: 65 },
  { x: 'Fri', y: 78 },
  { x: 'Sat', y: 92 },
  { x: 'Sun', y: 88 }
]

/**
 * Example 10: Radar Chart - Skills Assessment
 */
export const radarExample: RadarDataPoint[] = [
  { axis: 'Problem Solving', value: 85, max: 100 },
  { axis: 'Communication', value: 78, max: 100 },
  { axis: 'Technical Skills', value: 92, max: 100 },
  { axis: 'Leadership', value: 70, max: 100 },
  { axis: 'Creativity', value: 88, max: 100 },
  { axis: 'Time Management', value: 75, max: 100 }
]

// ============================================================================
// CUSTOMIZATION EXAMPLES - Chart configuration objects
// ============================================================================

/**
 * Example: Waterfall Chart Customization
 */
export const waterfallCustomizationExample: WaterfallChartCustomization = {
  id: 'waterfall-pl-2024',
  chartType: 'waterfall',
  position: { x: 0, y: 0, w: 8, h: 5 },
  customTitle: 'Q4 2024 P&L Breakdown',
  customDescription: 'Sequential analysis of profit and loss',
  isVisible: true,
  showLegend: true,
  dataMapping: {
    category: 'line_item',
    value: 'amount',
    type: 'change_type',
    aggregation: 'sum'
  },
  chartConfig: {
    showConnectors: true,
    increaseColor: '#10b981',
    decreaseColor: '#ef4444',
    totalColor: '#3b82f6',
    showLabels: true,
    orientation: 'vertical',
    animate: true
  }
}

/**
 * Example: Funnel Chart Customization
 */
export const funnelCustomizationExample: FunnelChartCustomization = {
  id: 'funnel-sales-pipeline',
  chartType: 'funnel',
  position: { x: 8, y: 0, w: 6, h: 5 },
  customTitle: 'Sales Pipeline Conversion',
  isVisible: true,
  showLegend: false,
  dataMapping: {
    stage: 'pipeline_stage',
    value: 'lead_count',
    conversionRate: 'conversion_pct',
    order: 'stage_order'
  },
  chartConfig: {
    showConversionRates: true,
    showValues: true,
    segmentGap: 0.05,
    orientation: 'vertical',
    shape: 'trapezoid',
    colorGradient: 'sequential',
    animate: true
  }
}

/**
 * Example: Heatmap Chart Customization
 */
export const heatmapCustomizationExample: HeatmapChartCustomization = {
  id: 'heatmap-correlation',
  chartType: 'heatmap',
  position: { x: 0, y: 5, w: 8, h: 6 },
  customTitle: 'Feature Correlation Matrix',
  isVisible: true,
  showLegend: true,
  dataMapping: {
    xAxis: 'feature_x',
    yAxis: 'feature_y',
    value: 'correlation_value',
    label: 'correlation_label'
  },
  chartConfig: {
    colorScale: 'linear',
    colorScheme: 'viridis',
    showValues: true,
    cellBorderWidth: 1,
    cellBorderColor: '#ffffff',
    cellPadding: 2,
    minCellSize: 40,
    animate: false
  }
}

/**
 * Example: Gauge Chart Customization
 */
export const gaugeCustomizationExample: GaugeChartCustomization = {
  id: 'gauge-revenue-goal',
  chartType: 'gauge',
  position: { x: 0, y: 0, w: 4, h: 4 },
  customTitle: 'Revenue Goal Progress',
  isVisible: true,
  showLegend: false,
  dataMapping: {
    value: 'current_revenue',
    min: 0,
    max: 'revenue_target',
    target: 'monthly_goal',
    unit: '$M'
  },
  chartConfig: {
    style: 'semicircular',
    showNeedle: true,
    showValue: true,
    showTarget: true,
    thresholdColors: {
      poor: '#ef4444',
      fair: '#f59e0b',
      good: '#10b981',
      excellent: '#3b82f6'
    },
    startAngle: -90,
    endAngle: 90,
    innerRadius: 0.7,
    animate: true
  }
}

/**
 * Example: Cohort Chart Customization
 */
export const cohortCustomizationExample: CohortChartCustomization = {
  id: 'cohort-user-retention',
  chartType: 'cohort',
  position: { x: 0, y: 6, w: 10, h: 6 },
  customTitle: 'User Retention by Cohort',
  isVisible: true,
  showLegend: true,
  dataMapping: {
    cohort: 'signup_month',
    period: 'weeks_since_signup',
    value: 'retention_rate',
    cohortSize: 'initial_users'
  },
  chartConfig: {
    colorScale: 'sequential',
    displayFormat: 'percentage',
    showCohortSize: true,
    highlightDiagonal: true,
    cellSize: 50,
    textColor: '#000000',
    animate: false
  }
}

/**
 * Example: Bullet Chart Customization
 */
export const bulletCustomizationExample: BulletChartCustomization = {
  id: 'bullet-kpi-dashboard',
  chartType: 'bullet',
  position: { x: 4, y: 0, w: 6, h: 4 },
  customTitle: 'KPI Performance Dashboard',
  isVisible: true,
  showLegend: true,
  dataMapping: {
    metric: 'kpi_name',
    actual: 'current_value',
    target: 'target_value',
    ranges: {
      poor: 'poor_range',
      satisfactory: 'satisfactory_range',
      good: 'good_range'
    },
    comparison: 'previous_period',
    unit: 'unit_label'
  },
  chartConfig: {
    orientation: 'horizontal',
    showTarget: true,
    showComparison: true,
    barThickness: 20,
    rangeOpacity: 0.3,
    rangeColors: {
      poor: '#fee2e2',
      satisfactory: '#fef3c7',
      good: '#d1fae5'
    },
    animate: true
  }
}

/**
 * Example: Treemap Chart Customization
 */
export const treemapCustomizationExample: TreemapChartCustomization = {
  id: 'treemap-product-mix',
  chartType: 'treemap',
  position: { x: 0, y: 0, w: 8, h: 6 },
  customTitle: 'Product Portfolio Mix',
  isVisible: true,
  showLegend: true,
  dataMapping: {
    name: 'product_name',
    value: 'revenue',
    parent: 'category',
    color: 'profit_margin'
  },
  chartConfig: {
    tilingAlgorithm: 'squarify',
    showLabels: true,
    labelFontSize: 12,
    minLabelArea: 2,
    borderWidth: 2,
    borderColor: '#ffffff',
    levelPadding: 8,
    animate: true
  }
}

/**
 * Example: Sankey Chart Customization
 */
export const sankeyCustomizationExample: SankeyChartCustomization = {
  id: 'sankey-traffic-flow',
  chartType: 'sankey',
  position: { x: 0, y: 6, w: 10, h: 6 },
  customTitle: 'Website Traffic Flow',
  isVisible: true,
  showLegend: false,
  dataMapping: {
    source: 'traffic_source',
    target: 'destination_page',
    value: 'visitor_count',
    nodeName: 'page_name'
  },
  chartConfig: {
    nodeWidth: 20,
    nodePadding: 10,
    linkOpacity: 0.5,
    highlightOnHover: true,
    nodeAlignment: 'justify',
    showNodeLabels: true,
    showLinkValues: false,
    animate: true
  }
}

/**
 * Example: Sparkline Chart Customization
 */
export const sparklineCustomizationExample: SparklineChartCustomization = {
  id: 'sparkline-weekly-sales',
  chartType: 'sparkline',
  position: { x: 10, y: 0, w: 3, h: 2 },
  customTitle: 'Weekly Sales Trend',
  isVisible: true,
  showLegend: false,
  dataMapping: {
    xAxis: 'day',
    yAxis: 'sales_amount'
  },
  chartConfig: {
    lineWidth: 2,
    lineColor: '#3b82f6',
    fillArea: true,
    fillColor: 'rgba(59, 130, 246, 0.1)',
    showPoints: false,
    pointSize: 3,
    highlightMinMax: true,
    showCurrentValue: true,
    height: 60,
    animate: true
  }
}

/**
 * Example: Radar Chart Customization
 */
export const radarCustomizationExample: RadarChartCustomization = {
  id: 'radar-skills-comparison',
  chartType: 'radar',
  position: { x: 4, y: 5, w: 6, h: 6 },
  customTitle: 'Skills Assessment Comparison',
  isVisible: true,
  showLegend: true,
  dataMapping: {
    axis: 'skill_category',
    value: 'score',
    group: 'employee_name',
    max: 'max_score'
  },
  chartConfig: {
    fillArea: true,
    areaOpacity: 0.25,
    showGrid: true,
    gridLevels: 5,
    showAxisLabels: true,
    pointSize: 4,
    lineWidth: 2,
    startAngle: 90,
    animate: true
  }
}

// ============================================================================
// USAGE IN COMPONENTS - React component examples
// ============================================================================

/**
 * Example: Using chart customization in a React component
 */
export const componentUsageExample = `
import { useDataStore } from '@/lib/store'
import type { WaterfallChartCustomization } from '@/lib/types/chart-types'

function DashboardComponent() {
  const { updateChartCustomization, rawData } = useDataStore()

  const addWaterfallChart = () => {
    const customization: WaterfallChartCustomization = {
      id: 'waterfall-1',
      chartType: 'waterfall',
      position: { x: 0, y: 0, w: 8, h: 5 },
      dataMapping: {
        category: 'Line_Item',
        value: 'Amount',
        type: 'Change_Type'
      },
      chartConfig: {
        showConnectors: true,
        increaseColor: '#10b981',
        decreaseColor: '#ef4444',
        totalColor: '#3b82f6'
      }
    }

    updateChartCustomization('waterfall-1', customization)
  }

  return (
    <button onClick={addWaterfallChart}>
      Add Waterfall Chart
    </button>
  )
}
`

/**
 * Example: Type-safe data transformation
 */
export const transformationExample = `
import type { DataRow } from '@/lib/store'
import type { WaterfallDataPoint } from '@/lib/types/chart-types'
import { validateWaterfallData } from '@/lib/types/chart-types'

function transformToWaterfall(
  data: DataRow[],
  mapping: { category: string; value: string; type: string }
): WaterfallDataPoint[] {
  const transformed = data.map(row => ({
    category: String(row[mapping.category]),
    value: Number(row[mapping.value]),
    type: row[mapping.type] as 'increase' | 'decrease' | 'total'
  }))

  const validation = validateWaterfallData(transformed)
  if (!validation.valid) {
    console.error('Invalid waterfall data:', validation.errors)
    return []
  }

  return transformed
}
`

/**
 * Example: Using type guards
 */
export const typeGuardExample = `
import { isWaterfallData, isFunnelData } from '@/lib/types/chart-types'

function renderChart(data: unknown, type: string) {
  if (type === 'waterfall' && isWaterfallData(data)) {
    // TypeScript knows data is WaterfallDataPoint[]
    return <WaterfallChart data={data} />
  }

  if (type === 'funnel' && isFunnelData(data)) {
    // TypeScript knows data is FunnelDataPoint[]
    return <FunnelChart data={data} />
  }

  return <div>Unknown chart type</div>
}
`

// ============================================================================
// CSV DATA EXAMPLES - Sample CSV data for each chart type
// ============================================================================

/**
 * CSV example for Waterfall chart
 */
export const waterfallCSV = `
line_item,amount,change_type
Starting Revenue,1000000,total
Product Sales,450000,increase
Service Revenue,350000,increase
Cost of Goods,-400000,decrease
Operating Expenses,-250000,decrease
Gross Profit,1150000,subtotal
Taxes,-200000,decrease
Net Profit,950000,total
`.trim()

/**
 * CSV example for Funnel chart
 */
export const funnelCSV = `
pipeline_stage,lead_count,conversion_pct,stage_order
Website Visitors,10000,1.0,1
Signed Up,2500,0.25,2
Free Trial,1000,0.4,3
Paid Conversion,400,0.4,4
Active Users,350,0.875,5
`.trim()

/**
 * CSV example for Heatmap chart
 */
export const heatmapCSV = `
feature_x,feature_y,correlation_value,correlation_label
Revenue,Marketing Spend,0.85,0.85
Revenue,Sales Team Size,0.72,0.72
Revenue,Product Features,0.45,0.45
Marketing Spend,Sales Team Size,0.63,0.63
Marketing Spend,Product Features,0.31,0.31
Sales Team Size,Product Features,0.28,0.28
`.trim()

/**
 * CSV example for Cohort analysis
 */
export const cohortCSV = `
signup_month,weeks_since_signup,retention_rate,initial_users
Jan 2024,Week 0,1.0,1000
Jan 2024,Week 1,0.75,1000
Jan 2024,Week 2,0.62,1000
Jan 2024,Week 3,0.55,1000
Feb 2024,Week 0,1.0,1200
Feb 2024,Week 1,0.78,1200
Feb 2024,Week 2,0.65,1200
Mar 2024,Week 0,1.0,1500
Mar 2024,Week 1,0.82,1500
`.trim()

/**
 * CSV example for Sankey diagram
 */
export const sankeyCSV = `
traffic_source,destination_page,visitor_count
Organic Search,Homepage,2500
Organic Search,Blog,1500
Paid Ads,Products,3000
Social Media,Homepage,1200
Social Media,Blog,800
Direct Traffic,Homepage,1000
Homepage,Products,3200
Products,Checkout,2800
Blog,Products,1000
Checkout,Conversion,1400
`.trim()

// Export all examples as a collection
export const allExamples = {
  data: {
    waterfall: waterfallExample,
    funnel: funnelExample,
    heatmap: heatmapExample,
    gauge: gaugeExample,
    cohort: cohortExample,
    bullet: bulletExample,
    treemap: treemapExample,
    sankey: sankeyExample,
    sparkline: sparklineExample,
    radar: radarExample
  },
  customizations: {
    waterfall: waterfallCustomizationExample,
    funnel: funnelCustomizationExample,
    heatmap: heatmapCustomizationExample,
    gauge: gaugeCustomizationExample,
    cohort: cohortCustomizationExample,
    bullet: bulletCustomizationExample,
    treemap: treemapCustomizationExample,
    sankey: sankeyCustomizationExample,
    sparkline: sparklineCustomizationExample,
    radar: radarCustomizationExample
  },
  csv: {
    waterfall: waterfallCSV,
    funnel: funnelCSV,
    heatmap: heatmapCSV,
    cohort: cohortCSV,
    sankey: sankeyCSV
  }
}
