'use client'

import React, { useMemo } from 'react'
import type { DataRow, ChartType } from '@/lib/store'
import { TableChart } from './charts/table-chart'

interface FullscreenDataTableProps {
  chartType: ChartType
  data: DataRow[]
  dataMapping?: any
  dataKey?: string[]
  highlightedRow?: any
  onHighlightComplete?: () => void
}

/**
 * Component that displays ALL columns from the dataset in fullscreen mode.
 * Shows the complete underlying data regardless of which columns are used in the chart.
 */
export function FullscreenDataTable({
  chartType,
  data,
  dataMapping,
  dataKey,
  highlightedRow,
  onHighlightComplete
}: FullscreenDataTableProps) {

  // Extract ALL columns from the dataset
  const { tableData, columns } = useMemo(() => {
    if (!data || data.length === 0) {
      return { tableData: [], columns: [] }
    }

    // Get all columns from the first row of data
    const allColumns = Object.keys(data[0] || {})

    // Return all data with all columns
    return {
      tableData: data,
      columns: allColumns
    }
  }, [data])

  if (!tableData || tableData.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        No data available
      </div>
    )
  }

  return (
    <div className="h-full">
      <TableChart
        data={tableData}
        dataKey={columns}
        maxRows={Infinity}
        highlightedRow={highlightedRow}
        onHighlightComplete={onHighlightComplete}
      />
    </div>
  )
}
