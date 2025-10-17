import React from 'react'
import { DataRow } from '@/lib/store'

const TableChartLazy = React.lazy(() => import('../../charts/table-chart').then(m => ({ default: m.TableChart })))

interface TableRendererProps {
  chartData: DataRow[]
  safeDataKey: string[]
}

export const TableRenderer: React.FC<TableRendererProps> = ({ chartData, safeDataKey }) => {
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
