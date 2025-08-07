'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from './button'

interface MultiSelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value?: (string | number)[]
  onChange?: (value: (string | number)[]) => void
  placeholder?: string
  maxDisplay?: number
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = 'Select options...',
  maxDisplay = 3,
  className,
  disabled = false
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedOptions = options.filter(option => value.includes(option.value))

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleOption = (optionValue: string | number) => {
    if (disabled) return
    
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue]
    
    onChange?.(newValue)
  }

  const handleRemoveOption = (optionValue: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    
    const newValue = value.filter(v => v !== optionValue)
    onChange?.(newValue)
  }

  const handleSelectAll = () => {
    if (disabled) return
    
    const allValues = filteredOptions
      .filter(option => !option.disabled)
      .map(option => option.value)
    
    onChange?.(allValues)
  }

  const handleClearAll = () => {
    if (disabled) return
    onChange?.([])
  }

  const displayText = () => {
    if (selectedOptions.length === 0) {
      return placeholder
    }
    
    if (selectedOptions.length <= maxDisplay) {
      return selectedOptions.map(option => option.label).join(', ')
    }
    
    return `${selectedOptions.slice(0, maxDisplay).map(option => option.label).join(', ')} +${selectedOptions.length - maxDisplay} more`
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        variant="outline"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full justify-between text-left font-normal',
          !value.length && 'text-muted-foreground',
          isOpen && 'ring-2 ring-ring ring-offset-2'
        )}
      >
        <span className="truncate">{displayText()}</span>
        <ChevronDown className={cn('ml-2 h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-between p-2 border-b bg-gray-50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 text-xs px-2"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 text-xs px-2"
            >
              Clear All
            </Button>
          </div>
          
          {/* Options list */}
          <div className="max-h-40 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-sm text-gray-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleToggleOption(option.value)}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                    value.includes(option.value) && 'bg-primary/10'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 border rounded flex items-center justify-center',
                    value.includes(option.value) ? 'bg-primary border-primary' : 'border-gray-300'
                  )}>
                    {value.includes(option.value) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="flex-1">{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Selected items display */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedOptions.slice(0, maxDisplay).map((option) => (
            <div
              key={option.value}
              className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
            >
              <span>{option.label}</span>
              <button
                onClick={(e) => handleRemoveOption(option.value, e)}
                className="hover:bg-primary/20 rounded-full p-0.5"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {selectedOptions.length > maxDisplay && (
            <div className="inline-flex items-center bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
              +{selectedOptions.length - maxDisplay} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}