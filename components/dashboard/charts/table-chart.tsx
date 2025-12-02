'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { VirtualizedTableChart } from './virtualized-table-chart'

interface TableChartProps {
  data: any[]
  dataKey: string[]
  maxRows?: number // Optional max rows to display
  highlightedRow?: any // Row to highlight
  onHighlightComplete?: () => void // Callback when highlight animation completes
}

const VIRTUALIZATION_THRESHOLD = 500 // Use virtualization if more than 500 rows

export function TableChart({ data, dataKey, maxRows = 100, highlightedRow, onHighlightComplete }: TableChartProps) {
  // All hooks must be called before any early returns (React Rules of Hooks)
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc' | null
  }>({ key: null, direction: null })
  const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current.key === key) {
        // Cycle through: null -> asc -> desc -> null
        if (current.direction === 'asc') {
          return { key, direction: 'desc' }
        } else if (current.direction === 'desc') {
          return { key: null, direction: null }
        }
      }
      return { key, direction: 'asc' }
    })
  }

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!]
      const bValue = b[sortConfig.key!]

      // Handle null/undefined values
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1

      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // String comparison
      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()
      
      if (sortConfig.direction === 'asc') {
        return aString < bString ? -1 : aString > bString ? 1 : 0
      } else {
        return aString > bString ? -1 : aString < bString ? 1 : 0
      }
    })
  }, [data, sortConfig])

  // Handle highlighted row - find matching row and scroll to it
  useEffect(() => {
    if (!highlightedRow) {
      setHighlightedRowIndex(null)
      return
    }

    // Check if this is a category-based highlight (for aggregated charts)
    const categoryKey = (highlightedRow as any).__categoryKey

    let matchingIndex = -1

    if (categoryKey && categoryKey in highlightedRow) {
      // Category-based matching (for aggregated data)
      // Find the first row that matches the category value
      const categoryValue = highlightedRow[categoryKey]
      matchingIndex = sortedData.findIndex(row => {
        const rowValue = row[categoryKey]
        // Handle different types
        if (rowValue === categoryValue) return true
        if (String(rowValue) === String(categoryValue)) return true
        return false
      })
    } else {
      // Exact row matching (for non-aggregated data)
      // Compare all properties to find exact match
      matchingIndex = sortedData.findIndex(row => {
        return dataKey.every(key => {
          const rowValue = row[key]
          const highlightValue = highlightedRow[key]

          // Handle different types
          if (rowValue === highlightValue) return true
          if (String(rowValue) === String(highlightValue)) return true

          return false
        })
      })
    }

    if (matchingIndex !== -1) {
      setHighlightedRowIndex(matchingIndex)

      // Scroll to the row after a short delay to ensure it's rendered
      setTimeout(() => {
        const rowElement = rowRefs.current.get(matchingIndex)
        if (rowElement && tableContainerRef.current) {
          // Calculate the position to scroll to (center the row in view)
          const containerRect = tableContainerRef.current.getBoundingClientRect()
          const rowRect = rowElement.getBoundingClientRect()
          const scrollTop = tableContainerRef.current.scrollTop
          const offsetTop = rowRect.top - containerRect.top + scrollTop
          const centerOffset = containerRect.height / 2 - rowRect.height / 2

          tableContainerRef.current.scrollTo({
            top: offsetTop - centerOffset,
            behavior: 'smooth'
          })
        }
      }, 100)

      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedRowIndex(null)
        onHighlightComplete?.()
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [highlightedRow, sortedData, dataKey, onHighlightComplete])

  // Early return for large datasets - use virtualized table
  // This must come after all hooks
  if (data.length > VIRTUALIZATION_THRESHOLD) {
    return (
      <VirtualizedTableChart
        data={data}
        dataKey={dataKey}
        maxRows={maxRows}
        highlightedRow={highlightedRow}
        onHighlightComplete={onHighlightComplete}
      />
    )
  }

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="h-3 w-3 text-gray-400" />
    }
    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="h-3 w-3 text-blue-600" />
    }
    if (sortConfig.direction === 'desc') {
      return <ChevronDown className="h-3 w-3 text-blue-600" />
    }
    return <ChevronsUpDown className="h-3 w-3 text-gray-400" />
  }

  // Use maxRows prop for limiting rows
  const visibleRows = sortedData.slice(0, maxRows)

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto" ref={tableContainerRef}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-10">
            <tr>
              {dataKey.map((key) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 select-none transition-colors"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{key}</span>
                    {getSortIcon(key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.map((row, index) => {
              const isHighlighted = index === highlightedRowIndex
              return (
                <tr
                  key={index}
                  ref={(el) => {
                    if (el) {
                      rowRefs.current.set(index, el)
                    } else {
                      rowRefs.current.delete(index)
                    }
                  }}
                  className={`transition-all duration-300 ${
                    isHighlighted
                      ? 'bg-blue-100 shadow-md scale-[1.01] highlighted-row'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {dataKey.map((key) => (
                    <td key={key} className="px-4 py-3 text-gray-700">
                      <div className="truncate max-w-xs" title={String(row[key] || '')}>
                        {typeof row[key] === 'number'
                          ? row[key].toLocaleString()
                          : row[key]?.toString() || '-'}
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <div className="flex-shrink-0 text-center py-3 text-sm text-gray-600 border-t bg-gray-50 font-medium">
          Showing {maxRows.toLocaleString()} of {data.length.toLocaleString()} rows
        </div>
      )}
    </div>
  )
}