'use client'

import React, { useMemo, Component, ReactNode, useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CohortGridProps {
  data: any[]
  dataMapping: {
    cohort: string    // cohort identifier (e.g., signup month)
    period: string    // time period (week/month number)
    retention: string // retention percentage
  }
  customization?: {
    maxPeriods?: number
    colorIntensity?: boolean
  }
}

// Error Boundary Component
class CohortErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Cohort grid rendering error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground bg-gray-50 rounded border-2 border-dashed border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium">Cohort grid rendering failed</p>
            <p className="text-xs mt-1">Please check your data mapping</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Get color based on retention percentage (0-100%)
const getRetentionColor = (retention: number): string => {
  if (retention >= 90) return 'bg-green-700'
  if (retention >= 80) return 'bg-green-600'
  if (retention >= 70) return 'bg-green-500'
  if (retention >= 60) return 'bg-green-400'
  if (retention >= 50) return 'bg-green-300'
  if (retention >= 40) return 'bg-green-200'
  if (retention >= 30) return 'bg-green-100'
  if (retention >= 20) return 'bg-green-50'
  return 'bg-gray-50'
}

// Get text color for contrast
const getTextColor = (retention: number): string => {
  return retention >= 60 ? 'text-white' : 'text-gray-900'
}

export const CohortGrid = React.memo<CohortGridProps>(function CohortGrid({
  data,
  dataMapping,
  customization = {}
}) {
  const { maxPeriods, colorIntensity = true } = customization
  const [hoveredCell, setHoveredCell] = useState<{ cohort: string; period: string } | null>(null)

  // Transform and organize data into cohort grid structure
  const { cohorts, periods, gridData } = useMemo(() => {
    if (!data || data.length === 0 || !dataMapping) {
      return { cohorts: [], periods: [], gridData: new Map() }
    }

    const { cohort: cohortKey, period: periodKey, retention: retentionKey } = dataMapping

    // Collect unique cohorts and periods
    const cohortSet = new Set<string>()
    const periodSet = new Set<number>()
    const gridMap = new Map<string, number>()

    data.forEach(row => {
      const cohortVal = String(row[cohortKey] || '')
      const periodVal = Number(row[periodKey])
      const retentionVal = Number(row[retentionKey])

      if (cohortVal && !isNaN(periodVal) && !isNaN(retentionVal)) {
        cohortSet.add(cohortVal)
        periodSet.add(periodVal)
        gridMap.set(`${cohortVal}:${periodVal}`, retentionVal)
      }
    })

    // Sort cohorts (chronologically) and periods
    const cohorts = Array.from(cohortSet).sort()
    let periods = Array.from(periodSet).sort((a, b) => a - b)

    // Apply maxPeriods limit if specified
    if (maxPeriods && periods.length > maxPeriods) {
      periods = periods.slice(0, maxPeriods)
    }

    return { cohorts, periods, gridData: gridMap }
  }, [data, dataMapping, maxPeriods])

  // Format retention value for display
  const formatRetention = (value: number): string => {
    if (value >= 1) {
      return Math.round(value) + '%'
    }
    return (value * 100).toFixed(0) + '%'
  }

  if (cohorts.length === 0 || periods.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No cohort data available
      </div>
    )
  }

  return (
    <CohortErrorBoundary>
      <div className="w-full h-full overflow-auto">
        <TooltipProvider>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-900 border-b-2 border-gray-300 bg-gray-50 min-w-[120px]">
                  Cohort
                </th>
                {periods.map((period) => (
                  <th
                    key={period}
                    className="px-3 py-2 text-center font-semibold text-gray-900 border-b-2 border-gray-300 bg-gray-50 min-w-[80px]"
                  >
                    {period === 0 ? 'P0' : `P${period}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort, cohortIndex) => (
                <tr key={cohort} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 bg-gray-50 border-r border-gray-200 sticky left-0 z-[5]">
                    {cohort}
                  </td>
                  {periods.map((period, periodIndex) => {
                    const key = `${cohort}:${period}`
                    const retention = gridData.get(key)
                    const isHovered = hoveredCell?.cohort === cohort && hoveredCell?.period === String(period)

                    // Only show cells where period index >= cohort index (diagonal pattern)
                    if (retention !== undefined) {
                      return (
                        <Tooltip key={period}>
                          <TooltipTrigger asChild>
                            <td
                              className={`px-3 py-2 text-center font-medium transition-all cursor-pointer ${
                                colorIntensity ? getRetentionColor(retention) : 'bg-white'
                              } ${
                                colorIntensity ? getTextColor(retention) : 'text-gray-900'
                              } ${
                                isHovered ? 'ring-2 ring-blue-500 ring-inset' : ''
                              }`}
                              onMouseEnter={() => setHoveredCell({ cohort, period: String(period) })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {formatRetention(retention)}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <p className="font-semibold">{cohort}</p>
                              <p className="text-gray-600">Period: {period}</p>
                              <p className="font-medium">Retention: {formatRetention(retention)}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    } else {
                      // Empty cell for missing data
                      return (
                        <td
                          key={period}
                          className="px-3 py-2 text-center text-gray-300 bg-gray-50"
                        >
                          -
                        </td>
                      )
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TooltipProvider>
      </div>

      {/* Legend and Info */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2 pb-2">
        <div className="text-xs text-gray-600">
          Showing {cohorts.length} cohorts across {periods.length} periods
        </div>

        {colorIntensity && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Retention:</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">0%</span>
              <div className="flex gap-0.5">
                <div className="w-6 h-4 bg-gray-50 border border-gray-200" />
                <div className="w-6 h-4 bg-green-100 border border-gray-200" />
                <div className="w-6 h-4 bg-green-300 border border-gray-200" />
                <div className="w-6 h-4 bg-green-500 border border-gray-200" />
                <div className="w-6 h-4 bg-green-700 border border-gray-200" />
              </div>
              <span className="text-xs text-gray-500">100%</span>
            </div>
          </div>
        )}
      </div>
    </CohortErrorBoundary>
  )
})

CohortGrid.displayName = 'CohortGrid'

export default CohortGrid
