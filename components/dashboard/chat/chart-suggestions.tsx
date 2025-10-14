'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, PieChart, Activity, GitBranch } from 'lucide-react'
import { ChartSuggestion } from '@/lib/services/chat-service'

interface ChartSuggestionsProps {
  suggestions: ChartSuggestion[]
  onApplySuggestion: (suggestion: ChartSuggestion) => void
}

export function ChartSuggestions({ suggestions, onApplySuggestion }: ChartSuggestionsProps) {
  if (suggestions.length === 0) return null
  
  // Debug: log suggestions to see what's being passed
  console.log('Chart suggestions:', suggestions)

  const getChartIcon = (type: string) => {
    switch (type) {
      case 'line':
        return TrendingUp
      case 'bar':
        return BarChart3
      case 'pie':
        return PieChart
      case 'area':
        return Activity
      case 'scatter':
        return GitBranch
      default:
        return BarChart3
    }
  }

  return (
    <div className="border-t bg-blue-50 p-3 space-y-2">
      <div className="flex items-center space-x-2 mb-2">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">Suggested Charts</span>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const IconComponent = getChartIcon(suggestion.type)
          return (
            <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  <IconComponent className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 break-words">
                      {suggestion.title || 'Untitled Chart'}
                    </p>
                    {suggestion.description && (
                      <p className="text-xs text-gray-600 mt-1 break-words">
                        {suggestion.description}
                      </p>
                    )}
                    {suggestion.reason && (
                      <p className="text-xs text-blue-600 mt-1 italic break-words">
                        {suggestion.reason}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApplySuggestion(suggestion)}
                  className="text-xs h-7 px-2 border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0 w-full sm:w-auto"
                >
                  Apply
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}