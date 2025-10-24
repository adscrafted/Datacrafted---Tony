'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Filter, X, Check, Search, ChevronDown, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { ChartFilter } from '@/lib/stores/chart-store'
import { getUniqueValues } from '@/lib/utils/chart-filters'
import type { DataRow } from '@/lib/stores/data-store'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface InlineFilterProps {
  column: string
  columnType: 'string' | 'number' | 'date'
  data: DataRow[]
  filters: ChartFilter[] | undefined
  onFiltersChange: (filters: ChartFilter[]) => void
  className?: string
}

export function InlineFilter({
  column,
  columnType,
  data,
  filters = [],
  onFiltersChange,
  className
}: InlineFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGranularity, setSelectedGranularity] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month')

  // Find existing filter for this column
  const existingFilter = filters.find(f => f.column === column)
  const hasActiveFilter = existingFilter && existingFilter.isActive && (
    (existingFilter.type === 'categorical' && existingFilter.selectedValues && existingFilter.selectedValues.length > 0) ||
    (existingFilter.type === 'date_aggregation' && existingFilter.dateGranularity)
  )

  // Get unique values for categorical columns
  const uniqueValues = React.useMemo(() => {
    if (columnType !== 'string') return []
    return getUniqueValues(data, column).slice(0, 100) // Limit to 100 for performance
  }, [data, column, columnType])

  const filteredValues = uniqueValues.filter(value =>
    value.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle categorical filter
  const handleCategoricalFilter = (values: string[]) => {
    const newFilters = filters.filter(f => f.column !== column)

    if (values.length > 0) {
      newFilters.push({
        id: `filter_${column}_${Date.now()}`,
        type: 'categorical',
        column,
        isActive: true,
        selectedValues: values
      })
    }

    onFiltersChange(newFilters)
  }

  // Handle date aggregation
  const handleDateAggregation = (granularity: 'day' | 'week' | 'month' | 'quarter' | 'year' | null) => {
    const newFilters = filters.filter(f => f.column !== column)

    if (granularity) {
      newFilters.push({
        id: `filter_${column}_${Date.now()}`,
        type: 'date_aggregation',
        column,
        isActive: true,
        dateGranularity: granularity
      })
    }

    onFiltersChange(newFilters)
  }

  // Clear filter for this column
  const clearFilter = () => {
    onFiltersChange(filters.filter(f => f.column !== column))
    setIsOpen(false)
  }

  // For string/categorical columns
  if (columnType === 'string') {
    const selectedValues = existingFilter?.type === 'categorical' ? existingFilter.selectedValues || [] : []

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveFilter ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-6 px-2 text-xs",
              hasActiveFilter && "bg-blue-500 hover:bg-blue-600 text-white",
              className
            )}
          >
            <Filter className="h-3 w-3 mr-1" />
            {hasActiveFilter ? `${selectedValues.length}` : "Filter"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filter: {column}</span>
              {hasActiveFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilter}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-xs border rounded"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCategoricalFilter(filteredValues)}
                className="h-6 text-xs px-2 flex-1"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCategoricalFilter([])}
                className="h-6 text-xs px-2 flex-1"
              >
                Clear All
              </Button>
            </div>

            {/* Value List */}
            <div className="max-h-48 overflow-y-auto border rounded">
              {filteredValues.length === 0 ? (
                <div className="p-2 text-xs text-center text-gray-500">
                  No values found
                </div>
              ) : (
                <div className="p-1">
                  {filteredValues.map(value => {
                    const isSelected = selectedValues.includes(value)
                    return (
                      <div
                        key={value}
                        onClick={() => {
                          const newValues = isSelected
                            ? selectedValues.filter(v => v !== value)
                            : [...selectedValues, value]
                          handleCategoricalFilter(newValues)
                        }}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 text-xs",
                          isSelected && "bg-blue-50"
                        )}
                      >
                        <div
                          className={cn(
                            "h-3 w-3 border rounded flex items-center justify-center",
                            isSelected
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300"
                          )}
                        >
                          {isSelected && (
                            <Check className="h-2 w-2 text-white" />
                          )}
                        </div>
                        <span className="flex-1 truncate">{value}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {uniqueValues.length > 100 && (
              <div className="text-xs text-gray-500">
                Showing first 100 values
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // For date columns
  if (columnType === 'date') {
    const currentGranularity = existingFilter?.type === 'date_aggregation' ? existingFilter.dateGranularity : null

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveFilter ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-6 px-2 text-xs",
              hasActiveFilter && "bg-blue-500 hover:bg-blue-600 text-white",
              className
            )}
          >
            <Calendar className="h-3 w-3 mr-1" />
            {currentGranularity || "Group"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Group by</span>
              {hasActiveFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilter}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            {['day', 'week', 'month', 'quarter', 'year'].map((granularity) => (
              <Button
                key={granularity}
                variant={currentGranularity === granularity ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateAggregation(granularity as any)}
                className="w-full h-7 text-xs justify-start"
              >
                {granularity.charAt(0).toUpperCase() + granularity.slice(1)}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // For numeric columns (future enhancement)
  return null
}