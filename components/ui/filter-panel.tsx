'use client'

import React, { useState } from 'react'
import { Filter, Plus, X, Calendar, Hash, Type, ToggleLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import type { DashboardFilter, DataRow } from '@/lib/store'

interface FilterPanelProps {
  filters: DashboardFilter[]
  columns: Array<{ name: string; type: string }>
  data: DataRow[]
  onAddFilter: (filter: DashboardFilter) => void
  onUpdateFilter: (filterId: string, updates: Partial<DashboardFilter>) => void
  onRemoveFilter: (filterId: string) => void
  onClearFilters: () => void
  className?: string
}

const filterOperators = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' }
  ],
  numeric: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' }
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' },
    { value: 'between', label: 'Between dates' }
  ],
  category: [
    { value: 'equals', label: 'Equals' },
    { value: 'in', label: 'In list' }
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
  if (column.type.toLowerCase().includes('date') || column.type.toLowerCase().includes('time')) {
    return 'date'
  }
  if (column.type.toLowerCase().includes('number') || column.type.toLowerCase().includes('int')) {
    return 'numeric'
  }
  if (column.type.toLowerCase().includes('string') || column.type.toLowerCase().includes('text')) {
    return 'text'
  }
  return 'category'
}

export function FilterPanel({
  filters,
  columns,
  data,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onClearFilters,
  className
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAddingFilter, setIsAddingFilter] = useState(false)
  const [newFilter, setNewFilter] = useState<Partial<DashboardFilter>>({
    column: '',
    operator: 'equals',
    value: '',
    isActive: true
  })

  const activeFiltersCount = filters.filter(f => f.isActive).length

  const handleAddFilter = () => {
    if (newFilter.column && newFilter.operator) {
      const column = columns.find(c => c.name === newFilter.column)
      const filterType = column ? getColumnType(column) : 'text'
      
      onAddFilter({
        id: Date.now().toString(),
        type: filterType,
        column: newFilter.column,
        operator: newFilter.operator as any,
        value: newFilter.value ?? null,
        isActive: true
      })
      
      setNewFilter({ column: '', operator: 'equals', value: '', isActive: true })
      setIsAddingFilter(false)
    }
  }

  const getUniqueValues = (columnName: string) => {
    const values = data.map(row => row[columnName]).filter(v => v != null)
    return Array.from(new Set(values)).slice(0, 20) // Limit to 20 unique values
  }

  const renderFilterValue = (filter: DashboardFilter, isEditing: boolean = false) => {
    if (!isEditing) {
      if (filter.operator === 'between' && Array.isArray(filter.value)) {
        return `${filter.value[0]} - ${filter.value[1]}`
      }
      if (filter.operator === 'in' && Array.isArray(filter.value)) {
        return filter.value.join(', ')
      }
      return String(filter.value)
    }

    const column = columns.find(c => c.name === filter.column)
    const operators = filterOperators[filter.type] || filterOperators.text

    if (filter.operator === 'between') {
      const [min, max] = Array.isArray(filter.value) ? filter.value : ['', '']
      return (
        <div className="flex items-center space-x-2">
          <input
            type={filter.type === 'numeric' ? 'number' : filter.type === 'date' ? 'date' : 'text'}
            value={min}
            onChange={(e) => onUpdateFilter(filter.id, { value: [e.target.value, max] })}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
            placeholder="Min"
          />
          <span className="text-xs">to</span>
          <input
            type={filter.type === 'numeric' ? 'number' : filter.type === 'date' ? 'date' : 'text'}
            value={max}
            onChange={(e) => onUpdateFilter(filter.id, { value: [min, e.target.value] })}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
            placeholder="Max"
          />
        </div>
      )
    }

    if (filter.operator === 'in' && filter.type === 'category') {
      const uniqueValues = getUniqueValues(filter.column)
      const selectedValues = Array.isArray(filter.value) ? filter.value : []
      
      return (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {uniqueValues.map(value => (
            <label key={String(value)} className="flex items-center space-x-2 text-xs">
              <input
                type="checkbox"
                checked={selectedValues.includes(value as string | number)}
                onChange={(e) => {
                  const newSelected = e.target.checked
                    ? [...selectedValues, value as string | number]
                    : selectedValues.filter(v => v !== value)
                  onUpdateFilter(filter.id, { value: newSelected as (string | number)[] })
                }}
                className="w-3 h-3"
              />
              <span>{String(value)}</span>
            </label>
          ))}
        </div>
      )
    }

    return (
      <input
        type={filter.type === 'numeric' ? 'number' : filter.type === 'date' ? 'date' : 'text'}
        value={Array.isArray(filter.value) ? String(filter.value[0] ?? '') : String(filter.value ?? '')}
        onChange={(e) => onUpdateFilter(filter.id, { value: e.target.value })}
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
        placeholder="Filter value"
      />
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Filters${activeFiltersCount > 0 ? ` (${activeFiltersCount} active)` : ''}`}
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
        <span>Filters</span>
        {activeFiltersCount > 0 && (
          <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-xs rounded-full" aria-hidden="true">
            {activeFiltersCount}
          </span>
        )}
      </Button>
      
      {isOpen && (
        <Card className="absolute top-10 left-0 z-50 w-96 shadow-lg max-h-96 overflow-y-auto" role="dialog" aria-label="Data filters">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Data Filters
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingFilter(true)}
                  className="h-6 w-6 p-0"
                  aria-label="Add new filter"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </Button>
                {filters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearFilters}
                    className="h-6 text-xs px-2"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Existing Filters */}
            {filters.map((filter) => {
              const Icon = getFilterIcon(filter.type)
              return (
                <div
                  key={filter.id}
                  className={cn(
                    'p-3 rounded-lg border',
                    filter.isActive ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-3 w-3" />
                      <span className="text-xs font-medium">{filter.column}</span>
                      <span className="text-xs text-muted-foreground">
                        {filterOperators[filter.type]?.find(op => op.value === filter.operator)?.label}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onUpdateFilter(filter.id, { isActive: !filter.isActive })}
                        className={cn(
                          'w-8 h-4 rounded-full transition-colors relative',
                          filter.isActive ? 'bg-primary' : 'bg-gray-300'
                        )}
                        role="switch"
                        aria-checked={filter.isActive}
                        aria-label={`${filter.isActive ? 'Disable' : 'Enable'} filter for ${filter.column}`}
                        type="button"
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                            filter.isActive ? 'translate-x-4' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveFilter(filter.id)}
                        className="h-4 w-4 p-0"
                        aria-label={`Remove filter for ${filter.column}`}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-xs">
                    {renderFilterValue(filter, true)}
                  </div>
                </div>
              )
            })}
            
            {/* Add New Filter */}
            {isAddingFilter && (
              <div className="p-3 rounded-lg border border-dashed border-gray-300 space-y-3" role="form" aria-label="Add new filter">
                <div>
                  <label htmlFor="filter-column" className="text-xs font-medium mb-1 block">Column</label>
                  <select
                    id="filter-column"
                    value={newFilter.column || ''}
                    onChange={(e) => setNewFilter(prev => ({ ...prev, column: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    aria-label="Select column to filter"
                  >
                    <option value="">Select column...</option>
                    {columns.map(column => (
                      <option key={column.name} value={column.name}>
                        {column.name} ({column.type})
                      </option>
                    ))}
                  </select>
                </div>
                
                {newFilter.column && (
                  <>
                    <div>
                      <label htmlFor="filter-condition" className="text-xs font-medium mb-1 block">Condition</label>
                      <select
                        id="filter-condition"
                        value={newFilter.operator || 'equals'}
                        onChange={(e) => setNewFilter(prev => ({ ...prev, operator: e.target.value as any }))}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        aria-label="Select filter condition"
                      >
                        {(() => {
                          const column = columns.find(c => c.name === newFilter.column)
                          const type = column ? getColumnType(column) : 'text'
                          return filterOperators[type]?.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))
                        })()}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="filter-value" className="text-xs font-medium mb-1 block">Value</label>
                      <input
                        id="filter-value"
                        type="text"
                        value={String(newFilter.value ?? '')}
                        onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        placeholder="Enter filter value"
                        aria-label="Enter filter value"
                      />
                    </div>
                  </>
                )}
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsAddingFilter(false)}
                    className="h-6 text-xs px-2"
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAddFilter}
                    disabled={!newFilter.column || !newFilter.operator}
                    className="h-6 text-xs px-2"
                  >
                    Add Filter
                  </Button>
                </div>
              </div>
            )}
            
            {filters.length === 0 && !isAddingFilter && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No filters applied. Click the + button to add a filter.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}