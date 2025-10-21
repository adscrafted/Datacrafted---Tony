import React from 'react'
import type { DataRow } from '@/lib/store'

const TableChartLazy = React.lazy(() => import('../../charts/table-chart').then(m => ({ default: m.TableChart })))

interface TableRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
}

// MEMOIZATION: Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (prevProps: TableRendererProps, nextProps: TableRendererProps): boolean => {
  if (prevProps.chartData !== nextProps.chartData) return false
  if (prevProps.safeDataKey.length !== nextProps.safeDataKey.length) return false
  if (prevProps.safeDataKey.some((key, i) => key !== nextProps.safeDataKey[i])) return false
  return true
}

const TableRendererComponent: React.FC<TableRendererProps> = ({ chartData, safeDataKey }) => {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading table...</div>
      </div>
    }>
      <TableChartLazy data={chartData} dataKey={safeDataKey} />
    </React.Suspense>
  )
}

// MEMOIZATION: Export memoized component to prevent unnecessary re-renders
export const TableRenderer = React.memo(TableRendererComponent, arePropsEqual)
