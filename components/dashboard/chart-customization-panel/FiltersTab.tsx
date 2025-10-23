'use client'

import React, { useState } from 'react'
import { Filter, Plus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { ChartFilter } from '@/lib/stores/chart-store'
import { getUniqueValues } from '@/lib/utils/chart-filters'
import type { DataRow } from '@/lib/stores/data-store'
import { cn } from '@/lib/utils/cn'

interface FiltersTabProps {
  chartId: string
  filters: ChartFilter[] | undefined
  schema: Array<{ name: string; type: string }>
  data: DataRow[]
  onFiltersChange: (filters: ChartFilter[]) => void
}

export function FiltersTab({
  chartId,
  filters = [],
  schema,
  data,
  onFiltersChange
}: FiltersTabProps) {
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null)

  // Get date columns for aggregation
  const dateColumns = schema.filter(col => col.type === 'date')

  // Get categorical columns (string/text) for filtering
  const categoricalColumns = schema.filter(col => col.type === 'string' || col.type === 'text')

  // Get numeric columns for range filtering (future)
  const numericColumns = schema.filter(col => col.type === 'number')

  const addDateAggregationFilter = () => {
    if (dateColumns.length === 0) return

    const newFilter: ChartFilter = {
      id: `filter_${Date.now()}`,
      type: 'date_aggregation',
      column: dateColumns[0].name,
      isActive: true,
      dateGranularity: 'month'
    }

    onFiltersChange([...filters, newFilter])
    setExpandedFilter(newFilter.id)
  }

  const addCategoricalFilter = () => {
    if (categoricalColumns.length === 0) return

    const newFilter: ChartFilter = {
      id: `filter_${Date.now()}`,
      type: 'categorical',
      column: categoricalColumns[0].name,
      isActive: true,
      selectedValues: []
    }

    onFiltersChange([...filters, newFilter])
    setExpandedFilter(newFilter.id)
  }

  const removeFilter = (filterId: string) => {
    onFiltersChange(filters.filter(f => f.id !== filterId))
    if (expandedFilter === filterId) {
      setExpandedFilter(null)
    }
  }

  const updateFilter = (filterId: string, updates: Partial<ChartFilter>) => {
    onFiltersChange(
      filters.map(f => (f.id === filterId ? { ...f, ...updates } : f))
    )
  }

  const toggleFilterActive = (filterId: string) => {
    const filter = filters.find(f => f.id === filterId)
    if (filter) {
      updateFilter(filterId, { isActive: !filter.isActive })
    }
  }

  const clearAllFilters = () => {
    onFiltersChange([])
    setExpandedFilter(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Chart Filters</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Filter and aggregate data for this chart only
          </p>
        </div>
        {filters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Add Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {dateColumns.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={addDateAggregationFilter}
            className="h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            Date Aggregation
          </Button>
        )}
        {categoricalColumns.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={addCategoricalFilter}
            className="h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            Category Filter
          </Button>
        )}
      </div>

      {/* No Filters State */}
      {filters.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No filters applied</p>
          <p className="text-xs mt-1">
            Add filters to customize this chart's data
          </p>
        </div>
      )}

      {/* Filter List */}
      <div className="space-y-3">
        {filters.map(filter => (
          <div
            key={filter.id}
            className={cn(
              "border rounded-lg p-3 space-y-3 transition-colors",
              filter.isActive ? "bg-background" : "bg-muted/50"
            )}
          >
            {/* Filter Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={filter.isActive}
                  onCheckedChange={() => toggleFilterActive(filter.id)}
                />
                <div>
                  <div className="text-sm font-medium">
                    {filter.type === 'date_aggregation' && 'Date Aggregation'}
                    {filter.type === 'categorical' && 'Category Filter'}
                    {filter.type === 'numeric_range' && 'Numeric Range'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {filter.column}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter(filter.id)}
                className="h-7 w-7 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Filter Configuration */}
            {filter.isActive && (
              <div className="space-y-3 pl-10">
                {/* Date Aggregation Configuration */}
                {filter.type === 'date_aggregation' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Date Column</Label>
                      <Select
                        value={filter.column}
                        onValueChange={(value) =>
                          updateFilter(filter.id, { column: value })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dateColumns.map(col => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Group By</Label>
                      <Select
                        value={filter.dateGranularity}
                        onValueChange={(value: any) =>
                          updateFilter(filter.id, { dateGranularity: value })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Day</SelectItem>
                          <SelectItem value="week">Week</SelectItem>
                          <SelectItem value="month">Month</SelectItem>
                          <SelectItem value="quarter">Quarter</SelectItem>
                          <SelectItem value="year">Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      📊 Numeric columns will be summed within each time period
                    </div>
                  </>
                )}

                {/* Categorical Filter Configuration */}
                {filter.type === 'categorical' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Column</Label>
                      <Select
                        value={filter.column}
                        onValueChange={(value) =>
                          updateFilter(filter.id, { column: value, selectedValues: [] })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoricalColumns.map(col => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <CategoricalFilterSelector
                      column={filter.column}
                      data={data}
                      selectedValues={filter.selectedValues || []}
                      onSelectedValuesChange={(values) =>
                        updateFilter(filter.id, { selectedValues: values })
                      }
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help Text */}
      {filters.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
          💡 <strong>Tip:</strong> Filters apply to this chart only. For dashboard-wide filtering,
          use the date range selector or dashboard filters.
        </div>
      )}
    </div>
  )
}

// Categorical Filter Selector Component
function CategoricalFilterSelector({
  column,
  data,
  selectedValues,
  onSelectedValuesChange
}: {
  column: string
  data: DataRow[]
  selectedValues: string[]
  onSelectedValuesChange: (values: string[]) => void
}) {
  const uniqueValues = React.useMemo(() => {
    return getUniqueValues(data, column).slice(0, 50) // Limit to 50 for performance
  }, [data, column])

  const [searchTerm, setSearchTerm] = useState('')

  const filteredValues = uniqueValues.filter(value =>
    value.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectedValuesChange(selectedValues.filter(v => v !== value))
    } else {
      onSelectedValuesChange([...selectedValues, value])
    }
  }

  const selectAll = () => {
    onSelectedValuesChange(filteredValues)
  }

  const clearAll = () => {
    onSelectedValuesChange([])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          Select Values ({selectedValues.length} selected)
        </Label>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="h-6 text-xs px-2"
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 text-xs px-2"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search values..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full h-8 px-3 text-sm border rounded-md"
      />

      {/* Value List */}
      <div className="max-h-48 overflow-y-auto border rounded-md">
        {filteredValues.length === 0 ? (
          <div className="p-3 text-xs text-center text-muted-foreground">
            No values found
          </div>
        ) : (
          <div className="p-1">
            {filteredValues.map(value => (
              <div
                key={value}
                onClick={() => toggleValue(value)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm",
                  selectedValues.includes(value) && "bg-muted"
                )}
              >
                <div
                  className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    selectedValues.includes(value)
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  )}
                >
                  {selectedValues.includes(value) && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <span className="flex-1 truncate">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {uniqueValues.length > 50 && (
        <div className="text-xs text-muted-foreground">
          Showing first 50 values. Use search to find others.
        </div>
      )}
    </div>
  )
}
