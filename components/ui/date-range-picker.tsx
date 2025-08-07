'use client'

import React, { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from './button'
import { Card, CardContent } from './card'

interface DateRange {
  start: Date | null
  end: Date | null
}

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const quickRanges = [
  { label: 'Today', getValue: () => {
    const today = new Date()
    return { start: today, end: today }
  }},
  { label: 'Yesterday', getValue: () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return { start: yesterday, end: yesterday }
  }},
  { label: 'Last 7 days', getValue: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 6)
    return { start, end }
  }},
  { label: 'Last 30 days', getValue: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 29)
    return { start, end }
  }},
  { label: 'This month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start, end }
  }},
  { label: 'Last month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start, end }
  }}
]

const formatDate = (date: Date | null) => {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

const formatDateRange = (range: DateRange) => {
  if (!range.start && !range.end) return 'Select date range'
  if (range.start && !range.end) return `From ${formatDate(range.start)}`
  if (!range.start && range.end) return `Until ${formatDate(range.end)}`
  if (range.start && range.end) {
    if (range.start.getTime() === range.end.getTime()) {
      return formatDate(range.start)
    }
    return `${formatDate(range.start)} - ${formatDate(range.end)}`
  }
  return 'Select date range'
}

export function DateRangePicker({
  value = { start: null, end: null },
  onChange,
  placeholder = 'Select date range',
  className,
  disabled = false
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingStart, setSelectingStart] = useState(true)

  const handleDateClick = (date: Date) => {
    if (disabled) return

    if (selectingStart || !value.start) {
      onChange?.({ start: date, end: null })
      setSelectingStart(false)
    } else {
      if (date < value.start) {
        onChange?.({ start: date, end: value.start })
      } else {
        onChange?.({ start: value.start, end: date })
      }
      setSelectingStart(true)
      setIsOpen(false)
    }
  }

  const handleQuickRange = (range: DateRange) => {
    onChange?.(range)
    setIsOpen(false)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const isDayInRange = (date: Date) => {
    if (!value.start || !value.end) return false
    return date >= value.start && date <= value.end
  }

  const isDayStart = (date: Date) => {
    return value.start && date.getTime() === value.start.getTime()
  }

  const isDayEnd = (date: Date) => {
    return value.end && date.getTime() === value.end.getTime()
  }

  const navigateMonth = (direction: 1 | -1) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(newMonth.getMonth() + direction)
      return newMonth
    })
  }

  const days = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full justify-start text-left font-normal',
          !value.start && !value.end && 'text-muted-foreground'
        )}
      >
        <Calendar className="mr-2 h-4 w-4" />
        {formatDateRange(value)}
      </Button>
      
      {isOpen && (
        <Card className="absolute top-full left-0 z-50 mt-1 shadow-lg">
          <CardContent className="p-4">
            <div className="flex space-x-4">
              {/* Quick ranges */}
              <div className="w-40 space-y-1">
                <h4 className="text-sm font-medium mb-2">Quick ranges</h4>
                {quickRanges.map((range) => (
                  <Button
                    key={range.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickRange(range.getValue())}
                    className="w-full justify-start h-8 text-xs"
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
              
              {/* Calendar */}
              <div className="w-64">
                {/* Calendar header */}
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth(-1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">{monthName}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth(1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Day labels */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((date, index) => (
                    <button
                      key={index}
                      onClick={() => date && handleDateClick(date)}
                      disabled={!date}
                      className={cn(
                        'h-8 w-8 text-xs rounded transition-colors',
                        !date && 'invisible',
                        date && 'hover:bg-gray-100',
                        date && isDayStart(date) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                        date && isDayEnd(date) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                        date && isDayInRange(date) && !isDayStart(date) && !isDayEnd(date) && 'bg-primary/20',
                        date && date.toDateString() === new Date().toDateString() && 'font-bold'
                      )}
                    >
                      {date?.getDate()}
                    </button>
                  ))}
                </div>
                
                {/* Status text */}
                <div className="mt-4 text-xs text-gray-500 text-center">
                  {selectingStart ? 'Select start date' : 'Select end date'}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onChange?.({ start: null, end: null })
                  setIsOpen(false)
                }}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}