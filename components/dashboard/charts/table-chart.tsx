'use client'

import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface TableChartProps {
  data: any[]
  dataKey: string[]
}

export function TableChart({ data, dataKey }: TableChartProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc' | null
  }>({ key: null, direction: null })

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

  // Show more rows for tables
  const visibleRows = sortedData.slice(0, 50)

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200 shadow-sm">
            <tr>
              {dataKey.map((key) => (
                <th 
                  key={key} 
                  className="px-3 py-2 text-left font-medium text-gray-900 cursor-pointer hover:bg-gray-50 select-none"
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
            {visibleRows.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                {dataKey.map((key) => (
                  <td key={key} className="px-3 py-2 text-gray-700">
                    <div className="truncate max-w-xs" title={String(row[key] || '')}>
                      {typeof row[key] === 'number' 
                        ? row[key].toLocaleString() 
                        : row[key]?.toString() || '-'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 50 && (
        <div className="flex-shrink-0 text-center py-2 text-xs text-gray-500 border-t bg-gray-50">
          Showing 50 of {data.length.toLocaleString()} rows
        </div>
      )}
    </div>
  )
}