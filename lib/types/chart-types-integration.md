# Chart Types Integration Guide

This document provides step-by-step instructions for integrating the new advanced chart types into your existing Zustand store and TypeScript codebase.

## Overview

The new chart types system extends your existing dashboard with 10 advanced visualization types:
- **Waterfall**: Sequential variance analysis
- **Funnel**: Conversion tracking
- **Heatmap**: 2D density visualization
- **Gauge**: KPI monitoring
- **Cohort**: Retention analysis
- **Bullet**: Performance comparison
- **Treemap**: Hierarchical data
- **Sankey**: Flow diagrams
- **Sparkline**: Compact trends
- **Radar**: Multi-dimensional comparison

## Integration Steps

### 1. Update Store Types

**File**: `/lib/store.ts`

#### 1.1 Import the New Types

Add at the top of `store.ts`:

```typescript
import type {
  ExtendedChartType,
  ExtendedChartCustomization,
  ExtendedChartTemplate,
  NEW_CHART_TEMPLATES,
  ChartDataMapping,
  ExtendedChartConfig,
  // Import specific types as needed
  WaterfallDataMapping,
  FunnelDataMapping,
  HeatmapDataMapping,
  // ... etc
} from '@/lib/types/chart-types'
```

#### 1.2 Update ChartCustomization Interface

Replace the existing `ChartCustomization` interface (lines 52-96):

```typescript
// Legacy support - keep old interface for backward compatibility
export interface LegacyChartCustomization {
  id: string
  position: { x: number; y: number; w: number; h: number }
  colors?: string[]
  theme?: 'default' | 'light' | 'dark' | 'custom'
  showLegend?: boolean
  showGrid?: boolean
  customTitle?: string
  customDescription?: string
  axisLabels?: { x?: string; y?: string }
  isVisible?: boolean
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo'
  animate?: boolean
  interactive?: boolean
  stacked?: boolean
  dataColumns?: string[]
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
  dataMapping?: {
    xAxis?: string
    yAxis?: string | string[]
    yAxis1?: string | string[]
    yAxis2?: string | string[]
    yAxis1Type?: 'bar' | 'line' | 'area'
    yAxis2Type?: 'bar' | 'line' | 'area'
    yAxis1Label?: string
    yAxis2Label?: string
    category?: string
    value?: string
    values?: string[]
    metric?: string
    size?: string
    color?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    limit?: number
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'
    columns?: string[]
  }
  autoSize?: boolean
  minHeight?: number
  maxHeight?: number
  labelRotation?: 'auto' | 'horizontal' | 'diagonal' | 'vertical'
}

// New union type supporting both legacy and new chart types
export type ChartCustomization = LegacyChartCustomization | ExtendedChartCustomization
```

#### 1.3 Update ChartTemplate Interface

Replace the existing `ChartTemplate` interface (lines 98-110):

```typescript
// For backward compatibility, keep legacy and create union
export type ChartTemplate = ExtendedChartTemplate
```

#### 1.4 Update Chart Templates Array

Merge the new templates with existing ones (around line 409):

```typescript
// Import at top
import { NEW_CHART_TEMPLATES } from '@/lib/types/chart-types'

// Merge with existing templates
const defaultChartTemplates: ChartTemplate[] = [
  // ... existing templates (line, bar, pie, area, scatter, scorecard, table)
  {
    id: 'line-trend',
    name: 'Line Chart',
    type: 'line',
    // ... existing config
  },
  // ... other existing templates

  // Add new templates
  ...NEW_CHART_TEMPLATES
]
```

#### 1.5 Update AnalysisResult Interface

Update the chartConfig type in `AnalysisResult` (line 151) to support new types:

```typescript
export interface AnalysisResult {
  insights: string[]
  chartConfig: Array<{
    id?: string
    type: ExtendedChartType // Changed from specific union
    title: string
    description: string
    dataMapping?: {
      // Keep all existing mappings
      // ... existing fields
    } | ChartDataMapping // Add union with new mappings
    // ... rest of existing fields
  }>
  summary: {
    // ... existing fields
  }
}
```

### 2. Add Type Guards to Store

Add helper functions for type checking (at end of store.ts):

```typescript
import {
  isAdvancedChartType,
  isWaterfallData,
  isFunnelData,
  isHeatmapData,
  isGaugeData,
  isCohortData,
  isBulletData,
  isTreemapData,
  isSankeyData,
  isSparklineData,
  isRadarData
} from '@/lib/types/chart-types'

// Re-export for convenience
export {
  isAdvancedChartType,
  isWaterfallData,
  isFunnelData,
  isHeatmapData,
  isGaugeData,
  isCohortData,
  isBulletData,
  isTreemapData,
  isSankeyData,
  isSparklineData,
  isRadarData
}
```

### 3. Update AI Analysis Service

**File**: `/lib/services/ai-analysis.ts`

#### 3.1 Import New Types

```typescript
import type {
  ExtendedChartType,
  ExtendedChartRecommendation,
  ChartDataMapping
} from '@/lib/types/chart-types'
```

#### 3.2 Update Chart Type Detection

Add logic to detect when new chart types are appropriate:

```typescript
/**
 * Determines if data is suitable for waterfall chart
 */
function canUseWaterfall(schema: DataSchema): boolean {
  // Check for sequential change data with increases/decreases
  const hasCategory = schema.columns.some(col => col.type === 'string')
  const hasNumeric = schema.columns.some(col => col.type === 'number')
  const hasType = schema.columns.some(col =>
    col.name.toLowerCase().includes('type') ||
    col.name.toLowerCase().includes('category')
  )
  return hasCategory && hasNumeric && hasType
}

/**
 * Determines if data is suitable for funnel chart
 */
function canUseFunnel(schema: DataSchema): boolean {
  // Check for sequential stages with conversion data
  const hasStages = schema.columns.some(col =>
    col.name.toLowerCase().includes('stage') ||
    col.name.toLowerCase().includes('step') ||
    col.name.toLowerCase().includes('phase')
  )
  const hasValue = schema.columns.some(col => col.type === 'number')
  const hasOrder = schema.columns.some(col =>
    col.name.toLowerCase().includes('order') ||
    col.name.toLowerCase().includes('sequence')
  )
  return hasStages && hasValue && (hasOrder || schema.rowCount <= 10)
}

/**
 * Determines if data is suitable for heatmap
 */
function canUseHeatmap(schema: DataSchema): boolean {
  // Check for 2D categorical data with numeric values
  const categoricalCols = schema.columns.filter(col => col.type === 'string' || col.type === 'categorical')
  const numericCols = schema.columns.filter(col => col.type === 'number')
  return categoricalCols.length >= 2 && numericCols.length >= 1
}

/**
 * Determines if data is suitable for cohort analysis
 */
function canUseCohort(schema: DataSchema): boolean {
  // Check for time-based cohort data
  const hasDate = schema.columns.some(col => col.type === 'date')
  const hasNumeric = schema.columns.some(col => col.type === 'number')
  const hasCohortIdentifier = schema.columns.some(col =>
    col.name.toLowerCase().includes('cohort') ||
    col.name.toLowerCase().includes('signup') ||
    col.name.toLowerCase().includes('registration')
  )
  return hasDate && hasNumeric && hasCohortIdentifier
}

/**
 * Determines if data is suitable for treemap
 */
function canUseTreemap(schema: DataSchema): boolean {
  // Check for hierarchical or categorical proportions
  const hasCategorical = schema.columns.some(col => col.type === 'string' || col.type === 'categorical')
  const hasNumeric = schema.columns.some(col => col.type === 'number')
  const hasHierarchy = schema.columns.some(col =>
    col.name.toLowerCase().includes('parent') ||
    col.name.toLowerCase().includes('category') ||
    col.name.toLowerCase().includes('group')
  )
  return hasCategorical && hasNumeric
}

/**
 * Determines if data is suitable for Sankey diagram
 */
function canUseSankey(schema: DataSchema): boolean {
  // Check for flow/relationship data
  const hasSource = schema.columns.some(col =>
    col.name.toLowerCase().includes('source') ||
    col.name.toLowerCase().includes('from')
  )
  const hasTarget = schema.columns.some(col =>
    col.name.toLowerCase().includes('target') ||
    col.name.toLowerCase().includes('to') ||
    col.name.toLowerCase().includes('destination')
  )
  const hasValue = schema.columns.some(col => col.type === 'number')
  return hasSource && hasTarget && hasValue
}
```

#### 3.3 Add to Chart Recommendation Logic

Update the chart suggestion prompt to include new chart types:

```typescript
const systemPrompt = `You are a data visualization expert. Analyze the provided data schema and recommend the BEST chart types.

Available chart types:
- bar: Compare categories
- line: Show trends over time
- area: Cumulative trends
- pie: Proportional distribution
- scatter: Relationships between variables
- scorecard: Single KPI display
- table: Detailed data view
- combo: Multiple metrics with different scales
- waterfall: Sequential variance (increase/decrease analysis)
- funnel: Conversion through stages
- heatmap: 2D density/correlation
- gauge: Single metric vs. target
- cohort: Retention analysis over time
- bullet: Performance vs. targets and ranges
- treemap: Hierarchical proportions
- sankey: Flow between entities
- sparkline: Compact inline trends
- radar: Multi-dimensional comparison

Return 3-5 chart recommendations with proper dataMapping for each type.`
```

### 4. Update Chart Rendering Components

**File**: `/components/dashboard/chart-wrapper.tsx` (or your main chart component)

#### 4.1 Add Chart Type Checks

```typescript
import { isAdvancedChartType } from '@/lib/store'
import type { ExtendedChartType } from '@/lib/types/chart-types'

function ChartWrapper({ chart, data, customization }: ChartWrapperProps) {
  const chartType = customization?.chartType || chart.type

  // Legacy chart rendering
  if (!isAdvancedChartType(chartType)) {
    return renderLegacyChart(chart, data, customization)
  }

  // New advanced chart rendering
  return renderAdvancedChart(chartType, chart, data, customization)
}
```

#### 4.2 Create Advanced Chart Renderer

```typescript
function renderAdvancedChart(
  type: ExtendedChartType,
  chart: ChartConfig,
  data: DataRow[],
  customization?: ChartCustomization
) {
  switch (type) {
    case 'waterfall':
      return <WaterfallChart data={data} config={chart} customization={customization} />
    case 'funnel':
      return <FunnelChart data={data} config={chart} customization={customization} />
    case 'heatmap':
      return <HeatmapChart data={data} config={chart} customization={customization} />
    case 'gauge':
      return <GaugeChart data={data} config={chart} customization={customization} />
    case 'cohort':
      return <CohortChart data={data} config={chart} customization={customization} />
    case 'bullet':
      return <BulletChart data={data} config={chart} customization={customization} />
    case 'treemap':
      return <TreemapChart data={data} config={chart} customization={customization} />
    case 'sankey':
      return <SankeyChart data={data} config={chart} customization={customization} />
    case 'sparkline':
      return <SparklineChart data={data} config={chart} customization={customization} />
    case 'radar':
      return <RadarChart data={data} config={chart} customization={customization} />
    default:
      return <div>Unknown chart type: {type}</div>
  }
}
```

### 5. Create Individual Chart Components

Create new files in `/components/dashboard/charts/`:

```
/components/dashboard/charts/
├── waterfall-chart.tsx
├── funnel-chart.tsx
├── heatmap-chart.tsx
├── gauge-chart.tsx
├── cohort-chart.tsx
├── bullet-chart.tsx
├── treemap-chart.tsx
├── sankey-chart.tsx
├── sparkline-chart.tsx
└── radar-chart.tsx
```

**Example**: `waterfall-chart.tsx`

```typescript
'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type {
  WaterfallDataPoint,
  WaterfallChartConfig,
  WaterfallChartCustomization
} from '@/lib/types/chart-types'
import type { DataRow } from '@/lib/store'

interface WaterfallChartProps {
  data: DataRow[]
  config: {
    title: string
    description: string
    dataMapping?: {
      category: string
      value: string
      type: string
    }
  }
  customization?: WaterfallChartCustomization
}

export function WaterfallChart({ data, config, customization }: WaterfallChartProps) {
  const chartData = useMemo(() => {
    const mapping = customization?.dataMapping || config.dataMapping
    if (!mapping) return []

    return data.map((row) => ({
      category: row[mapping.category],
      value: Number(row[mapping.value]),
      type: row[mapping.type] as 'increase' | 'decrease' | 'total',
    })) as WaterfallDataPoint[]
  }, [data, config, customization])

  const chartConfig = customization?.chartConfig

  const getBarColor = (type: string) => {
    if (type === 'increase') return chartConfig?.increaseColor || '#10b981'
    if (type === 'decrease') return chartConfig?.decreaseColor || '#ef4444'
    if (type === 'total') return chartConfig?.totalColor || '#3b82f6'
    return '#6b7280'
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value">
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

### 6. Update Chart Template Gallery

**File**: `/components/dashboard/chart-template-gallery.tsx`

Add filtering and display for new chart types:

```typescript
import { NEW_CHART_TEMPLATES } from '@/lib/types/chart-types'

function ChartTemplateGallery() {
  const categories = ['all', 'comparison', 'distribution', 'trend', 'relationship', 'summary', 'flow', 'hierarchy', 'retention']

  return (
    <div className="chart-gallery">
      {/* Category filters */}
      <div className="category-filters">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="template-grid">
        {NEW_CHART_TEMPLATES
          .filter(t => category === 'all' || t.category === category)
          .map(template => (
            <TemplateCard key={template.id} template={template} />
          ))
        }
      </div>
    </div>
  )
}
```

### 7. Type-Safe Data Transformation

Create a data transformation utility:

**File**: `/lib/utils/chart-data-transformer.ts`

```typescript
import type { DataRow } from '@/lib/store'
import type {
  ExtendedChartType,
  WaterfallDataPoint,
  FunnelDataPoint,
  HeatmapDataPoint,
  // ... other types
  ChartDataMapping
} from '@/lib/types/chart-types'

/**
 * Transform raw data rows into chart-specific format
 */
export function transformDataForChart(
  data: DataRow[],
  chartType: ExtendedChartType,
  mapping: ChartDataMapping
): unknown {
  switch (chartType) {
    case 'waterfall':
      return transformToWaterfall(data, mapping as WaterfallDataMapping)
    case 'funnel':
      return transformToFunnel(data, mapping as FunnelDataMapping)
    case 'heatmap':
      return transformToHeatmap(data, mapping as HeatmapDataMapping)
    // ... other cases
    default:
      return data
  }
}

function transformToWaterfall(
  data: DataRow[],
  mapping: WaterfallDataMapping
): WaterfallDataPoint[] {
  return data.map(row => ({
    category: String(row[mapping.category]),
    value: Number(row[mapping.value]),
    type: row[mapping.type] as 'increase' | 'decrease' | 'total',
    label: mapping.label ? String(row[mapping.label]) : undefined
  }))
}

// ... implement other transformers
```

### 8. Testing

Create unit tests for type guards and transformers:

**File**: `/lib/types/__tests__/chart-types.test.ts`

```typescript
import {
  isWaterfallData,
  isFunnelData,
  validateWaterfallData,
  validateFunnelData
} from '@/lib/types/chart-types'

describe('Chart Type Guards', () => {
  describe('isWaterfallData', () => {
    it('returns true for valid waterfall data', () => {
      const data = [
        { category: 'Start', value: 100, type: 'total' },
        { category: 'Increase', value: 50, type: 'increase' },
        { category: 'Decrease', value: -20, type: 'decrease' },
      ]
      expect(isWaterfallData(data)).toBe(true)
    })

    it('returns false for invalid data', () => {
      const data = [{ category: 'Test' }] // missing value and type
      expect(isWaterfallData(data)).toBe(false)
    })
  })

  // ... more tests
})
```

## Usage Examples

### Example 1: Creating a Waterfall Chart

```typescript
import { useDataStore } from '@/lib/store'
import type { WaterfallChartCustomization } from '@/lib/types/chart-types'

function MyDashboard() {
  const { updateChartCustomization } = useDataStore()

  const createWaterfallChart = () => {
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
        totalColor: '#3b82f6',
        showLabels: true
      }
    }

    updateChartCustomization('waterfall-1', customization)
  }

  return <button onClick={createWaterfallChart}>Add Waterfall Chart</button>
}
```

### Example 2: Type-Safe Chart Customization

```typescript
function ChartSettings<T extends ExtendedChartCustomization>({
  customization
}: {
  customization: T
}) {
  // TypeScript knows the exact type based on chartType
  if (customization.chartType === 'waterfall') {
    // customization.chartConfig is WaterfallChartConfig
    const { increaseColor, decreaseColor } = customization.chartConfig || {}
    return (
      <div>
        <ColorPicker
          label="Increase Color"
          value={increaseColor}
        />
        <ColorPicker
          label="Decrease Color"
          value={decreaseColor}
        />
      </div>
    )
  }

  if (customization.chartType === 'funnel') {
    // customization.chartConfig is FunnelChartConfig
    const { showConversionRates, orientation } = customization.chartConfig || {}
    return (
      <div>
        <Checkbox
          label="Show Conversion Rates"
          checked={showConversionRates}
        />
        <Select
          label="Orientation"
          value={orientation}
          options={['vertical', 'horizontal']}
        />
      </div>
    )
  }

  return null
}
```

### Example 3: AI Recommendation Integration

```typescript
import type { ExtendedChartRecommendation } from '@/lib/types/chart-types'

async function getEnhancedRecommendations(
  data: DataRow[],
  schema: DataSchema
): Promise<ExtendedChartRecommendation[]> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ data, schema })
  })

  const result = await response.json()

  // Filter and prioritize recommendations
  return result.recommendations
    .filter((rec: ExtendedChartRecommendation) => rec.confidence > 0.7)
    .sort((a: ExtendedChartRecommendation, b: ExtendedChartRecommendation) =>
      a.priority - b.priority
    )
}
```

## Migration Checklist

- [ ] Import new types into `store.ts`
- [ ] Update `ChartCustomization` type to union
- [ ] Merge `NEW_CHART_TEMPLATES` with existing templates
- [ ] Add type guards to store exports
- [ ] Update AI analysis service with new chart detection logic
- [ ] Create individual chart component files
- [ ] Update main chart wrapper with advanced chart rendering
- [ ] Create data transformation utilities
- [ ] Update chart template gallery
- [ ] Add unit tests for type guards
- [ ] Update TypeScript config if needed
- [ ] Test backward compatibility with existing charts
- [ ] Update documentation

## TypeScript Configuration

Ensure your `tsconfig.json` has strict settings enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

## Backward Compatibility

The integration maintains full backward compatibility:

1. **Legacy charts continue working**: All existing line, bar, pie, area, scatter, scorecard, table, and combo charts work unchanged.

2. **Gradual migration**: You can add new chart types incrementally without breaking existing functionality.

3. **Type safety**: The union types ensure type safety for both legacy and new charts.

4. **Store compatibility**: The store interface remains compatible with existing code.

## Performance Considerations

1. **Lazy loading**: Consider lazy-loading chart components:
   ```typescript
   const WaterfallChart = lazy(() => import('./charts/waterfall-chart'))
   ```

2. **Data memoization**: Use `useMemo` for data transformations to avoid unnecessary recalculations.

3. **Virtual scrolling**: For large datasets in heatmaps or cohort charts, implement virtual scrolling.

## Next Steps

1. **Install visualization libraries**: Depending on chart types, you may need:
   - `recharts` (already installed)
   - `d3-sankey` for Sankey diagrams
   - `d3-hierarchy` for treemaps
   - `react-gauge-chart` for gauge charts

2. **Create demo data**: Add sample datasets for each chart type for testing.

3. **Update API endpoints**: Ensure `/api/analyze` returns the new chart types in recommendations.

4. **User documentation**: Create user guides for each new chart type.

## Support

For issues or questions:
- Check type definitions in `/lib/types/chart-types.ts`
- Review integration examples above
- Test with the provided type guards
- Ensure strict TypeScript mode is enabled
