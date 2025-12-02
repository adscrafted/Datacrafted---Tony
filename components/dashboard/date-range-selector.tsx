'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'
import { detectDateColumns, getBestDateColumn } from '@/lib/utils/date-detection'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths, startOfYear, endOfYear, subYears } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useDataStore } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { useUIStore } from '@/lib/stores/ui-store'

type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year'

interface DateRangeSelectorProps {
  className?: string
}

export function DateRangeSelector({ className }: DateRangeSelectorProps) {
  // Modular store migration
  const rawData = useDataStore((state) => state.rawData)
  const dateRange = useChartStore((state) => state.dateRange)
  const setDateRange = useChartStore((state) => state.setDateRange)
  const granularity = useChartStore((state) => state.granularity)
  const setGranularity = useChartStore((state) => state.setGranularity)
  const selectedDateColumn = useUIStore((state) => state.selectedDateColumn)
  const setSelectedDateColumn = useUIStore((state) => state.setSelectedDateColumn)

  const [date, setDate] = useState<DateRange | undefined>(dateRange || undefined)
  const [isOpen, setIsOpen] = useState(false)
  const [isGranularityOpen, setIsGranularityOpen] = useState(false)
  const [isDateColumnOpen, setIsDateColumnOpen] = useState(false)
  const [hasDateColumn, setHasDateColumn] = useState(false)
  const [dateColumns, setDateColumns] = useState<string[]>([])
  const [availableGranularities, setAvailableGranularities] = useState<Granularity[]>(['day', 'week', 'month', 'quarter', 'year'])

  // Sync local date state with store's dateRange
  // CRITICAL: This ensures the UI updates when dateRange is cleared externally (e.g., via "Clear Date Filter" button)
  useEffect(() => {
    setDate(dateRange || undefined)
  }, [dateRange])

  // Detect date columns and set defaults
  useEffect(() => {
    console.log('🔍 [DateRangeSelector] Checking for date columns:', {
      hasRawData: !!rawData,
      rawDataLength: rawData?.length || 0,
      firstRow: rawData?.[0]
    })
    if (rawData && rawData.length > 0) {
      // Use shared utility to detect date columns
      const foundDateColumns = detectDateColumns(rawData)

      console.log('✅ [DateRangeSelector] Found date columns:', foundDateColumns)
      setDateColumns(foundDateColumns)
      setHasDateColumn(foundDateColumns.length > 0)

      // Auto-select the first date column if none is selected
      if (foundDateColumns.length > 0 && !selectedDateColumn) {
        console.log('📌 [DateRangeSelector] Auto-selecting first date column:', foundDateColumns[0])
        setSelectedDateColumn(foundDateColumns[0])
      }

      // Determine available granularities based on date range in data
      if (foundDateColumns.length > 0) {
        const dates = rawData.map(row => {
          const dateCol = foundDateColumns[0]
          const val = row[dateCol]
          // Handle null/undefined values safely
          if (val === null || val === undefined) return null
          return new Date(val as string | number | Date)
        }).filter((d): d is Date => d !== null && !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime())

        if (dates.length > 0) {
          const firstDate = dates[0]
          const lastDate = dates[dates.length - 1]
          const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))

          const granularities: Granularity[] = ['day']
          if (daysDiff >= 7) granularities.push('week')
          if (daysDiff >= 30) granularities.push('month')
          if (daysDiff >= 90) granularities.push('quarter')
          if (daysDiff >= 365) granularities.push('year')

          setAvailableGranularities(granularities)

          // Set default granularity to 'week' if available and not yet set
          if (granularities.includes('week') && granularity === 'day') {
            setGranularity('week')
          }
        }
      }
    }
  }, [rawData, selectedDateColumn, granularity, setGranularity, setSelectedDateColumn])

  if (!hasDateColumn || !rawData || rawData.length === 0) {
    return null
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDate(range)
    setDateRange(range)
    if (range?.from && range?.to) {
      setIsOpen(false)
    }
  }

  const handlePresetClick = (preset: { from: Date; to: Date }) => {
    console.log('🔍 [DateRangeSelector] Setting date range:', {
      from: preset.from,
      to: preset.to,
      fromFormatted: format(preset.from, 'yyyy-MM-dd'),
      toFormatted: format(preset.to, 'yyyy-MM-dd')
    })
    setDate(preset)
    setDateRange(preset)
    setIsOpen(false)
  }


  const handleGranularityChange = (newGranularity: Granularity) => {
    setGranularity(newGranularity)
  }

  return (
    <div className={cn("flex items-center justify-end space-x-2", className)}>
      {/* Date Column Selector (only show if multiple date columns) */}
      {dateColumns.length > 1 && (
        <Popover open={isDateColumnOpen} onOpenChange={setIsDateColumnOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 font-medium"
            >
              <span className="mr-1 text-muted-foreground">Date:</span>
              {selectedDateColumn || 'Select column'}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {dateColumns.map((col) => (
              <button
                key={col}
                onClick={() => {
                  setSelectedDateColumn(col)
                  setIsDateColumnOpen(false)
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs rounded hover:bg-gray-100",
                  selectedDateColumn === col && "bg-gray-100 font-medium"
                )}
              >
                {col}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {/* Granularity Dropdown */}
      <Popover open={isGranularityOpen} onOpenChange={setIsGranularityOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 font-medium"
          >
            <span className="mr-1 text-muted-foreground">View by:</span>
            {granularity.charAt(0).toUpperCase() + granularity.slice(1)}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-1" align="start">
          {availableGranularities.map((g) => (
            <button
              key={g}
              onClick={() => {
                handleGranularityChange(g)
                setIsGranularityOpen(false)
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs rounded hover:bg-gray-100",
                granularity === g && "bg-gray-100 font-medium"
              )}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Date Range Selector */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 font-medium"
          >
            <Calendar className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "MMM d, yyyy")} - {format(date.to, "MMM d, yyyy")}
                </>
              ) : (
                format(date.from, "MMM d, yyyy")
              )
            ) : (
              <span>All time</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 shadow-lg border" align="start" sideOffset={5}>
          <div className="flex">
            {/* Presets */}
            <div className="border-r bg-gray-50 py-3 px-2 space-y-0.5 w-36">
              <button
                onClick={() => handleDateRangeChange(undefined)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors",
                  !date && "bg-gray-100 font-medium"
                )}
              >
                All time
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  handlePresetClick({ from: today, to: today })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const yesterday = subDays(new Date(), 1)
                  handlePresetClick({ from: yesterday, to: yesterday })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Yesterday
              </button>
              <button
                onClick={() => {
                  const to = new Date()
                  const from = subDays(to, 6)
                  handlePresetClick({ from, to })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Last 7 days
              </button>
              <button
                onClick={() => {
                  const to = new Date()
                  const from = subDays(to, 29)
                  handlePresetClick({ from, to })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Last 30 days
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const from = startOfMonth(today)
                  handlePresetClick({ from, to: today })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Month to date
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const from = startOfMonth(subMonths(today, 1))
                  const to = endOfMonth(subMonths(today, 1))
                  handlePresetClick({ from, to })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Last month
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const from = startOfYear(today)
                  handlePresetClick({ from, to: today })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Year to date
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const from = startOfYear(subYears(today, 1))
                  const to = endOfYear(subYears(today, 1))
                  handlePresetClick({ from, to })
                }}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
              >
                Last year
              </button>
            </div>
            {/* Calendar */}
            <div className="p-3">
              {/* Date inputs */}
              <div className="flex items-center gap-3 mb-3 text-sm">
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">Start</div>
                  <div className="font-medium">
                    {date?.from ? format(date.from, "MM / dd / yyyy") : "MM / DD / YYYY"}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">End</div>
                  <div className="font-medium">
                    {date?.to ? format(date.to, "MM / dd / yyyy") : "MM / DD / YYYY"}
                  </div>
                </div>
              </div>
              
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={date?.from || new Date()}
                selected={date}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
                disabled={(day) => day > new Date()}
                className=""
              />
              
              {/* Apply/Clear buttons */}
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    handleDateRangeChange(undefined)
                    setIsOpen(false)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}