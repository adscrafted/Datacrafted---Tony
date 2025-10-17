'use client'

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from 'react-window'
import { DataRow } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

interface VirtualTableProps {
  data: DataRow[]
  columns: string[]
  height?: number
  rowHeight?: number
  className?: string
  onRowClick?: (row: DataRow, index: number) => void
  sortable?: boolean
  filterable?: boolean
  searchTerm?: string
  maxDisplayRows?: number
  enableInfiniteScroll?: boolean
  onLoadMore?: () => void
  isLoading?: boolean
}

interface TableRowProps extends ListChildComponentProps {
  data: {
    items: DataRow[]
    columns: string[]
    onRowClick?: (row: DataRow, index: number) => void
    searchTerm?: string
  }
}

// Memoized table row component for performance
const TableRow = React.memo<TableRowProps>(({ index, style, data }) => {
  const { items, columns, onRowClick, searchTerm } = data
  const row = items[index]
  
  // Highlight search terms
  const highlightText = useCallback((text: string, search?: string) => {
    if (!search || !text) return text
    const regex = new RegExp(`(${search})`, 'gi')
    return text.toString().replace(regex, '<mark>$1</mark>')
  }, [])

  const handleRowClick = useCallback(() => {
    onRowClick?.(row, index)
  }, [onRowClick, row, index])

  return (
    <div
      style={style}
      className={cn(
        "flex border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150",
        onRowClick && "cursor-pointer"
      )}
      onClick={handleRowClick}
    >
      {columns.map((column, colIndex) => {
        const value = row[column]
        const displayValue = value === null || value === undefined ? '' : String(value)
        
        return (
          <div
            key={colIndex}
            className="flex-1 px-4 py-2 text-sm truncate border-r border-gray-100 last:border-r-0"
            title={displayValue}
          >
            <span
              dangerouslySetInnerHTML={{
                __html: highlightText(displayValue, searchTerm)
              }}
            />
          </div>
        )
      })}
    </div>
  )
})

TableRow.displayName = 'TableRow'

// Header component
const TableHeader = React.memo<{
  columns: string[]
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (column: string) => void
  sortable?: boolean
}>(({ columns, sortColumn, sortDirection, onSort, sortable }) => {
  return (
    <div className="flex bg-gray-50 border-b-2 border-gray-200 font-medium text-sm sticky top-0 z-10">
      {columns.map((column, index) => (
        <div
          key={index}
          className={cn(
            "flex-1 px-4 py-3 text-left truncate border-r border-gray-200 last:border-r-0",
            sortable && "cursor-pointer hover:bg-gray-100 transition-colors"
          )}
          onClick={() => sortable && onSort?.(column)}
          title={column}
        >
          <div className="flex items-center justify-between">
            <span>{column}</span>
            {sortable && sortColumn === column && (
              <span className="ml-1">
                {sortDirection === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
})

TableHeader.displayName = 'TableHeader'

export function VirtualTable({
  data,
  columns,
  height = 400,
  rowHeight = 40,
  className,
  onRowClick,
  sortable = false,
  filterable = false,
  searchTerm,
  maxDisplayRows = 10000, // Limit for performance
  enableInfiniteScroll = false,
  onLoadMore,
  isLoading = false
}: VirtualTableProps) {
  const [sortColumn, setSortColumn] = useState<string>()
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [localSearchTerm, setLocalSearchTerm] = useState('')
  const listRef = useRef<List>(null)

  // Use search term from props or local state
  const activeSearchTerm = searchTerm || localSearchTerm

  // Process data: filter, sort, and limit
  const processedData = useMemo(() => {
    let result = [...data]

    // Apply search filter
    if (activeSearchTerm) {
      const searchLower = activeSearchTerm.toLowerCase()
      result = result.filter(row =>
        columns.some(column => {
          const value = row[column]
          return value && String(value).toLowerCase().includes(searchLower)
        })
      )
    }

    // Apply sorting
    if (sortColumn && sortable) {
      result.sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1
        
        // Type-aware comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // Date comparison
        if (aVal instanceof Date && bVal instanceof Date) {
          return sortDirection === 'asc' 
            ? aVal.getTime() - bVal.getTime()
            : bVal.getTime() - aVal.getTime()
        }
        
        // String comparison
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        
        if (sortDirection === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0
        }
      })
    }

    // Limit rows for performance
    return result.slice(0, maxDisplayRows)
  }, [data, columns, activeSearchTerm, sortColumn, sortDirection, sortable, maxDisplayRows])

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }, [sortColumn])

  // Scroll to top when data changes
  useEffect(() => {
    listRef.current?.scrollToItem(0)
  }, [processedData])

  // Handle infinite scroll
  const handleItemsRendered = useCallback(({ visibleStopIndex }: { visibleStopIndex: number }) => {
    if (enableInfiniteScroll && onLoadMore && !isLoading) {
      const threshold = Math.max(50, Math.floor(processedData.length * 0.8))
      if (visibleStopIndex >= threshold) {
        onLoadMore()
      }
    }
  }, [enableInfiniteScroll, onLoadMore, isLoading, processedData.length])

  // Calculate actual height
  const containerHeight = Math.min(height, (processedData.length + 1) * rowHeight + 50)

  if (processedData.length === 0) {
    return (
      <div className={cn("border border-gray-200 rounded-lg", className)}>
        <TableHeader
          columns={columns}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          sortable={sortable}
        />
        <div className="p-8 text-center text-gray-500">
          {data.length === 0 ? 'No data available' : 'No matching results'}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("border border-gray-200 rounded-lg overflow-hidden", className)}>
      {/* Search bar */}
      {filterable && !searchTerm && (
        <div className="p-3 border-b border-gray-200 bg-white">
          <input
            type="text"
            placeholder="Search data..."
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      )}

      {/* Table header */}
      <TableHeader
        columns={columns}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        sortable={sortable}
      />

      {/* Virtual list */}
      <div style={{ height: containerHeight - 50 }}>
        <List
          ref={listRef}
          height={containerHeight - 50}
          width="100%"
          itemCount={processedData.length}
          itemSize={rowHeight}
          itemData={{
            items: processedData,
            columns,
            onRowClick,
            searchTerm: activeSearchTerm
          }}
          onItemsRendered={handleItemsRendered}
          overscanCount={5} // Render 5 extra items for smooth scrolling
        >
          {TableRow}
        </List>
      </div>

      {/* Loading indicator for infinite scroll */}
      {isLoading && (
        <div className="p-4 text-center text-sm text-gray-500 border-t border-gray-200">
          Loading more data...
        </div>
      )}

      {/* Data info */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
        <span>
          Showing {processedData.length.toLocaleString()} of {data.length.toLocaleString()} rows
        </span>
        {data.length > maxDisplayRows && (
          <span>
            Display limited to {maxDisplayRows.toLocaleString()} rows for performance
          </span>
        )}
      </div>
    </div>
  )
}

// Utility hook for managing large datasets
export function useVirtualTableData<T>(
  data: T[],
  pageSize: number = 1000
) {
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const visibleData = useMemo(() => {
    return data.slice(0, (currentPage + 1) * pageSize)
  }, [data, currentPage, pageSize])

  const loadMore = useCallback(() => {
    if (isLoading || visibleData.length >= data.length) return
    
    setIsLoading(true)
    // Simulate async loading
    setTimeout(() => {
      setCurrentPage(prev => prev + 1)
      setIsLoading(false)
    }, 100)
  }, [isLoading, visibleData.length, data.length])

  const reset = useCallback(() => {
    setCurrentPage(0)
    setIsLoading(false)
  }, [])

  return {
    visibleData,
    isLoading,
    hasMore: visibleData.length < data.length,
    loadMore,
    reset
  }
}