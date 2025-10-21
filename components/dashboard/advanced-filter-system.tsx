'use client'

import React, { useState, useMemo } from 'react'
import { Filter, Plus, X, Calendar, Hash, Type, ToggleLeft, Search, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MultiSelect } from '@/components/ui/multi-select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useDataStore } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { getFilteredData } from '@/lib/stores/filtered-data'
import type { DashboardFilter, DataRow } from '@/lib/store'

interface AdvancedFilterSystemProps {
  className?: string
}

const filterOperators = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' }
  ],
  numeric: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' },
    { value: 'in', label: 'In list' }
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' },
    { value: 'between', label: 'Between dates' }
  ],
  category: [
    { value: 'equals', label: 'Equals' },
    { value: 'in', label: 'In list' },
    { value: 'not_in', label: 'Not in list' }
  ]
}

const getFilterIcon = (type: DashboardFilter['type']) => {
  switch (type) {
    case 'date': return Calendar
    case 'numeric': return Hash
    case 'text': return Type
    case 'category': return ToggleLeft
    default: return Filter
  }
}

const getColumnType = (column: { name: string; type: string }): DashboardFilter['type'] => {
  const type = column.type.toLowerCase()
  if (type.includes('date') || type.includes('time')) return 'date'
  if (type.includes('number') || type.includes('int') || type.includes('float')) return 'numeric'
  if (type.includes('string') || type.includes('text')) return 'text'
  return 'category'
}

export function AdvancedFilterSystem({ className }: AdvancedFilterSystemProps) {
  // Modular store migration - selective subscriptions
  const rawData = useDataStore((state) => state.rawData)
  const analysis = useDataStore((state) => state.analysis)

  const dashboardFilters = useChartStore((state) => state.dashboardFilters)
  const addDashboardFilter = useChartStore((state) => state.addDashboardFilter)
  const updateDashboardFilter = useChartStore((state) => state.updateDashboardFilter)
  const removeDashboardFilter = useChartStore((state) => state.removeDashboardFilter)
  const clearAllFilters = useChartStore((state) => state.clearAllFilters)

  const [isExpanded, setIsExpanded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilterType, setSelectedFilterType] = useState<DashboardFilter['type'] | 'all'>('all')

  const columns = useMemo(() => analysis?.summary.columns || [], [analysis?.summary.columns])
  const filteredData = getFilteredData()
  const activeFiltersCount = dashboardFilters.filter(f => f.isActive).length

  // Get unique values for a column
  const getUniqueValues = (columnName: string) => {
    const values = rawData.map(row => row[columnName]).filter(v => v != null && v !== '')
    const uniqueValues = Array.from(new Set(values))
    return uniqueValues.slice(0, 100).map(value => ({
      value: value as string | number,
      label: String(value)
    }))
  }

  // Get statistics for numeric columns
  const getNumericStats = (columnName: string) => {
    const values = rawData
      .map(row => Number(row[columnName]))
      .filter(v => !isNaN(v))
    
    if (values.length === 0) return null
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    }
  }

  // Filter columns based on search and type
  const filteredColumns = useMemo(() => {
    return columns.filter(column => {
      const matchesSearch = column.name.toLowerCase().includes(searchTerm.toLowerCase())
      const columnType = getColumnType(column)
      const matchesType = selectedFilterType === 'all' || columnType === selectedFilterType
      return matchesSearch && matchesType
    })
  }, [columns, searchTerm, selectedFilterType])

  const addQuickFilter = (column: { name: string; type: string }, operator: string, value: any) => {
    const columnType = getColumnType(column)
    const filter: DashboardFilter = {
      id: Date.now().toString(),
      type: columnType,
      column: column.name,
      operator: operator as any,
      value,
      isActive: true
    }
    addDashboardFilter(filter)
  }

  const renderFilterValue = (filter: DashboardFilter) => {
    if (filter.operator === 'between' && Array.isArray(filter.value)) {
      return `${filter.value[0]} - ${filter.value[1]}`
    }
    if (filter.operator === 'in' && Array.isArray(filter.value)) {
      return filter.value.length > 3 
        ? `${filter.value.slice(0, 3).join(', ')} +${filter.value.length - 3} more`
        : filter.value.join(', ')
    }
    return String(filter.value)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter Summary Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-xs rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          
          {activeFiltersCount > 0 && (
            <span className="text-sm text-muted-foreground">
              Showing {filteredData.length} of {rawData.length} rows
            </span>
          )}
        </div>
        
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-destructive hover:text-destructive"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {dashboardFilters
            .filter(f => f.isActive)
            .map((filter) => {
              const Icon = getFilterIcon(filter.type)
              return (
                <div
                  key={filter.id}
                  className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                >
                  <Icon className="h-3 w-3" />
                  <span className="font-medium">{filter.column}</span>
                  <span className="text-primary/70">
                    {filterOperators[filter.type]?.find(op => op.value === filter.operator)?.label}
                  </span>
                  <span className="font-medium">{renderFilterValue(filter)}</span>
                  <button
                    onClick={() => removeDashboardFilter(filter.id)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
        </div>
      )}

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Filter Data
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </CardTitle>
            
            {/* Search and Type Filter */}
            <div className="flex space-x-2 mt-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <select
                value={selectedFilterType}
                onChange={(e) => setSelectedFilterType(e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Types</option>
                <option value="text">Text</option>
                <option value="numeric">Numeric</option>
                <option value="date">Date</option>
                <option value="category">Category</option>
              </select>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 max-h-96 overflow-y-auto">
            {filteredColumns.map((column) => {
              const columnType = getColumnType(column)
              const uniqueValues = getUniqueValues(column.name)
              const numericStats = columnType === 'numeric' ? getNumericStats(column.name) : null
              const Icon = getFilterIcon(columnType)
              
              return (
                <div key={column.name} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{column.name}</span>
                      <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded">
                        {column.type}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {column.uniqueValues} unique values
                    </span>
                  </div>
                  
                  {/* Column Statistics */}
                  {numericStats && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Min: {numericStats.min.toFixed(2)} • Max: {numericStats.max.toFixed(2)} • Avg: {numericStats.avg.toFixed(2)}
                    </div>
                  )}
                  
                  {/* Quick Filter Options */}
                  <div className="flex flex-wrap gap-2">
                    {columnType === 'category' && uniqueValues.length <= 10 && (
                      <>
                        {uniqueValues.slice(0, 5).map(({ value, label }) => (
                          <Button
                            key={String(value)}
                            variant="outline"
                            size="sm"
                            onClick={() => addQuickFilter(column, 'equals', value)}
                            className="h-6 text-xs px-2"
                          >
                            = {label}
                          </Button>
                        ))}
                        {uniqueValues.length > 5 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addQuickFilter(column, 'in', uniqueValues.map(v => v.value))}
                            className="h-6 text-xs px-2"
                          >
                            Select Multiple
                          </Button>
                        )}
                      </>
                    )}
                    
                    {columnType === 'numeric' && numericStats && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addQuickFilter(column, 'greater_than', numericStats.avg)}
                          className="h-6 text-xs px-2"
                        >
                          &gt; Avg ({numericStats.avg.toFixed(1)})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addQuickFilter(column, 'between', [numericStats.min, numericStats.avg])}
                          className="h-6 text-xs px-2"
                        >
                          Below Avg
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addQuickFilter(column, 'between', [numericStats.avg, numericStats.max])}
                          className="h-6 text-xs px-2"
                        >
                          Above Avg
                        </Button>
                      </>
                    )}
                    
                    {columnType === 'text' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const searchValue = prompt(`Enter text to search in ${column.name}:`)
                          if (searchValue) {
                            addQuickFilter(column, 'contains', searchValue)
                          }
                        }}
                        className="h-6 text-xs px-2"
                      >
                        Contains...
                      </Button>
                    )}
                    
                    {columnType === 'date' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addQuickFilter(column, 'greater_than', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))}
                          className="h-6 text-xs px-2"
                        >
                          Last 30 days
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addQuickFilter(column, 'greater_than', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))}
                          className="h-6 text-xs px-2"
                        >
                          Last 7 days
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            
            {filteredColumns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No columns found matching your search.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}