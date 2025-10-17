/**
 * Reusable Available Fields Component
 * Displays draggable field list for chart configuration
 */

import React from 'react'
import { FIELD_TYPE_ICONS } from '../constants'
import { DataSchema } from '../types'

interface AvailableFieldsProps {
  columns: string[]
  dataSchema?: DataSchema
  filterType?: 'all' | 'numeric' | 'text' | 'date'
}

export function AvailableFields({
  columns,
  dataSchema,
  filterType = 'all'
}: AvailableFieldsProps) {
  // Filter columns based on type if specified
  const filteredColumns = React.useMemo(() => {
    if (filterType === 'all' || !dataSchema) {
      return columns
    }

    return dataSchema.columns
      .filter(col => {
        if (filterType === 'numeric') return col.type === 'number'
        if (filterType === 'text') return col.type === 'string' || col.type === 'categorical'
        if (filterType === 'date') return col.type === 'date'
        return true
      })
      .map(col => col.name)
  }, [columns, dataSchema, filterType])

  if (filteredColumns.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No {filterType !== 'all' ? filterType : ''} fields available
      </div>
    )
  }

  return (
    <div className="w-1/3 flex-shrink-0">
      <label className="text-sm font-medium mb-3 block">Available Fields</label>
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[380px] overflow-y-auto">
        <div className="grid grid-cols-1 gap-2">
          {filteredColumns.map((col) => {
            const columnType = dataSchema?.columns.find(c => c.name === col)?.type || 'string'
            const icon = FIELD_TYPE_ICONS[columnType] || FIELD_TYPE_ICONS.string

            return (
              <div
                key={col}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    fieldName: col,
                    fieldType: columnType
                  }))
                }}
                className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-all"
              >
                <span className="text-xs">{icon}</span>
                <span className="text-sm font-medium text-gray-700">{col}</span>
                <span className="text-xs text-gray-500 ml-auto">{columnType}</span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-blue-600 mt-2 font-medium flex items-center">
        <span className="mr-1">💡</span>
        Tip: Drag fields to the right →
      </p>
    </div>
  )
}
