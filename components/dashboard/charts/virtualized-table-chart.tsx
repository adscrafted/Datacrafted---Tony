'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { VariableSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

interface VirtualizedTableChartProps {
  data: any[]
  dataKey: string[]
  maxRows?: number
  highlightedRow?: any
  onHighlightComplete?: () => void
}

const ROW_HEIGHT = 44 // Height of each row in pixels
const HEADER_HEIGHT = 48 // Height of header

export function VirtualizedTableChart({
  data,
  dataKey,
  maxRows = Infinity,
  highlightedRow,
  onHighlightComplete
}: VirtualizedTableChartProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc' | null
  }>({ key: null, direction: null })
  const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null)
  const listRef = useRef<List>(null)
  const columnWidths = useRef<Map<string, number>>(new Map())

  // Calculate column widths based on content
  useEffect(() => {
    const widths = new Map<string, number>()
    dataKey.forEach(key => {
      // Start with header width
      let maxWidth = key.length * 8 + 40 // Rough estimation

      // Sample first 100 rows for width calculation
      const sampleSize = Math.min(100, data.length)
      for (let i = 0; i < sampleSize; i++) {
        const value = data[i][key]
        const stringValue = typeof value === 'number'
          ? value.toLocaleString()
          : value?.toString() || '-'
        const width = stringValue.length * 7 + 32 // Rough estimation
        maxWidth = Math.max(maxWidth, width)
      }

      // Cap maximum width
      widths.set(key, Math.min(maxWidth, 300))
    })
    columnWidths.current = widths
  }, [data, dataKey])

  const handleSort = useCallback((key: string) => {
    setSortConfig(current => {
      if (current.key === key) {
        if (current.direction === 'asc') {
          return { key, direction: 'desc' }
        } else if (current.direction === 'desc') {
          return { key: null, direction: null }
        }
      }
      return { key, direction: 'asc' }
    })
  }, [])

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data.slice(0, maxRows)
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!]
      const bValue = b[sortConfig.key!]

      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()

      if (sortConfig.direction === 'asc') {
        return aString < bString ? -1 : aString > bString ? 1 : 0
      } else {
        return aString > bString ? -1 : aString < bString ? 1 : 0
      }
    })

    return sorted.slice(0, maxRows)
  }, [data, sortConfig, maxRows])

  // Handle highlighted row
  useEffect(() => {
    if (!highlightedRow) {
      setHighlightedRowIndex(null)
      return
    }

    const categoryKey = (highlightedRow as any).__categoryKey
    let matchingIndex = -1

    if (categoryKey && categoryKey in highlightedRow) {
      const categoryValue = highlightedRow[categoryKey]
      matchingIndex = sortedData.findIndex(row => {
        const rowValue = row[categoryKey]
        if (rowValue === categoryValue) return true
        if (String(rowValue) === String(categoryValue)) return true
        return false
      })
    } else {
      matchingIndex = sortedData.findIndex(row => {
        return dataKey.every(key => {
          const rowValue = row[key]
          const highlightValue = highlightedRow[key]
          if (rowValue === highlightValue) return true
          if (String(rowValue) === String(highlightValue)) return true
          return false
        })
      })
    }

    if (matchingIndex !== -1) {
      setHighlightedRowIndex(matchingIndex)

      // Scroll to highlighted row
      if (listRef.current) {
        listRef.current.scrollToItem(matchingIndex, 'center')
      }

      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedRowIndex(null)
        onHighlightComplete?.()
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [highlightedRow, sortedData, dataKey, onHighlightComplete])

  const getSortIcon = useCallback((key: string) => {
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
  }, [sortConfig])

  // Memoized row renderer
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = sortedData[index]
    const isHighlighted = index === highlightedRowIndex

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          transition: 'all 0.3s',
          backgroundColor: isHighlighted ? '#dbeafe' : index % 2 === 0 ? '#ffffff' : '#f9fafb',
          transform: isHighlighted ? 'scale(1.01)' : 'scale(1)',
          boxShadow: isHighlighted ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none'
        }}
      >
        {dataKey.map((key) => {
          const width = columnWidths.current.get(key) || 150
          return (
            <div
              key={key}
              style={{
                width,
                minWidth: width,
                padding: '12px 16px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '14px',
                color: '#374151'
              }}
              title={String(row[key] || '')}
            >
              {typeof row[key] === 'number'
                ? row[key].toLocaleString()
                : row[key]?.toString() || '-'}
            </div>
          )
        })}
      </div>
    )
  }, [sortedData, highlightedRowIndex, dataKey])

  // Calculate total width for horizontal scrolling
  const totalWidth = useMemo(() => {
    return Array.from(columnWidths.current.values()).reduce((sum, width) => sum + width, 0)
  }, []) // columnWidths is a ref, doesn't need dependencies

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        No data available
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Fixed Header */}
      <div
        className="flex-shrink-0 overflow-x-auto border-b border-gray-200 bg-white shadow-sm"
        style={{ height: HEADER_HEIGHT }}
      >
        <div style={{ display: 'flex', minWidth: totalWidth }}>
          {dataKey.map((key) => {
            const width = columnWidths.current.get(key) || 150
            return (
              <div
                key={key}
                style={{
                  width,
                  minWidth: width,
                  padding: '12px 16px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#111827',
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => handleSort(key)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                }}
              >
                <span className="truncate">{key}</span>
                {getSortIcon(key)}
              </div>
            )
          })}
        </div>
      </div>

      {/* Virtualized Body */}
      <div className="flex-1 overflow-hidden">
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              itemCount={sortedData.length}
              itemSize={() => ROW_HEIGHT}
              width={width}
              overscanCount={5}
              style={{
                overflow: 'auto'
              }}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>

      {/* Footer with row count */}
      {data.length > maxRows && (
        <div className="flex-shrink-0 text-center py-3 text-sm text-gray-600 border-t bg-gray-50 font-medium">
          Showing {Math.min(maxRows, sortedData.length).toLocaleString()} of {data.length.toLocaleString()} rows
        </div>
      )}
    </div>
  )
}