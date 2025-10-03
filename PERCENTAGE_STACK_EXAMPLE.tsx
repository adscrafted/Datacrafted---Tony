/**
 * Example: How to Use 100% Stacked Charts
 *
 * This file demonstrates how to enable percentage stacking on bar and area charts.
 */

import { useDataStore } from '@/lib/store'

// Example 1: Enable percentage stacking programmatically
function enablePercentageStack(chartId: string) {
  const { updateChartCustomization } = useDataStore()

  updateChartCustomization(chartId, {
    percentageStack: true
  })
}

// Example 2: Toggle percentage stacking
function togglePercentageStack(chartId: string) {
  const { chartCustomizations, updateChartCustomization } = useDataStore()

  const currentMode = chartCustomizations[chartId]?.percentageStack || false

  updateChartCustomization(chartId, {
    percentageStack: !currentMode
  })
}

// Example 3: Chart Settings Panel Integration
export function ChartPercentageStackToggle({ chartId }: { chartId: string }) {
  const { chartCustomizations, updateChartCustomization } = useDataStore()

  const isPercentageMode = chartCustomizations[chartId]?.percentageStack || false
  const chartType = chartCustomizations[chartId]?.chartType

  // Only show for bar and area charts
  if (chartType !== 'bar' && chartType !== 'area') {
    return null
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <h3 className="font-medium text-sm">100% Stacked Mode</h3>
        <p className="text-xs text-gray-500 mt-1">
          Show data as percentages of the total
        </p>
      </div>
      <button
        onClick={() => updateChartCustomization(chartId, {
          percentageStack: !isPercentageMode
        })}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${isPercentageMode ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${isPercentageMode ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  )
}

// Example 4: Sample Data for Testing
export const sampleDataForPercentageStack = [
  { month: 'Jan', productA: 120, productB: 80, productC: 50 },
  { month: 'Feb', productA: 150, productB: 90, productC: 60 },
  { month: 'Mar', productA: 130, productB: 110, productC: 70 },
  { month: 'Apr', productA: 140, productB: 95, productC: 65 },
  { month: 'May', productA: 160, productB: 100, productC: 80 },
  { month: 'Jun', productA: 180, productB: 120, productC: 90 },
]

/**
 * Example 5: Complete Chart Configuration
 *
 * This shows how to configure a chart with percentage stacking from scratch
 */
export function createPercentageStackedChart() {
  const { updateChartCustomization } = useDataStore()

  const chartId = 'market-share-chart'

  updateChartCustomization(chartId, {
    id: chartId,
    chartType: 'bar', // or 'area'
    percentageStack: true,
    customTitle: 'Market Share Distribution',
    customDescription: 'Product market share over time (percentage)',
    showLegend: true,
    showGrid: true,
    position: { x: 0, y: 0, w: 8, h: 5 }
  })

  return chartId
}

/**
 * Example 6: Visual Comparison
 *
 * Normal Stacked Bar Chart:
 * Y-axis: 0 to 500 (actual values)
 * Bars show actual values stacked on top of each other
 * Tooltip: "Product A: 120"
 *
 * 100% Stacked Bar Chart:
 * Y-axis: 0% to 100%
 * Bars normalized to show percentage of total
 * Tooltip: "Product A: 48.0% (120)"
 *
 * Use Case:
 * - Normal stacking: Compare absolute values and total trends
 * - Percentage stacking: Compare relative proportions and composition changes
 */

/**
 * Example 7: Advanced Usage with Chart Settings Panel
 *
 * Add this to your chart-settings-panel component:
 */
export function PercentageStackSection({ chartId }: { chartId: string }) {
  const { chartCustomizations, updateChartCustomization } = useDataStore()

  const chartType = chartCustomizations[chartId]?.chartType
  const isPercentageMode = chartCustomizations[chartId]?.percentageStack || false

  // Only applicable to bar and area charts
  if (!['bar', 'area'].includes(chartType || '')) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Stacking Options</h3>

      <div className="space-y-2">
        <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={isPercentageMode}
            onChange={(e) => updateChartCustomization(chartId, {
              percentageStack: e.target.checked
            })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              100% Stacked
            </div>
            <div className="text-xs text-gray-500">
              Normalize values to show percentage distribution
            </div>
          </div>
        </label>

        {isPercentageMode && (
          <div className="ml-7 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
            <strong>Tip:</strong> Hover over bars to see both percentage and absolute values
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Example 8: API Usage
 *
 * If you're creating charts programmatically via API:
 */
export async function createChartViaAPI(data: any[]) {
  const response = await fetch('/api/charts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'bar',
      title: 'Revenue by Channel',
      data: data,
      customization: {
        percentageStack: true, // Enable 100% stacking
        showLegend: true,
        showGrid: true
      }
    })
  })

  return response.json()
}
