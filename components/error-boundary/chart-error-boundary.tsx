'use client'

import React from 'react'
import { ErrorBoundary } from './error-boundary'
import { AlertCircle, BarChart2 } from 'lucide-react'

interface ChartErrorBoundaryProps {
  children: React.ReactNode
  chartId?: string
  chartType?: string
  onError?: (error: Error, chartInfo: { id?: string; type?: string }) => void
}

export function ChartErrorBoundary({
  children,
  chartId,
  chartType,
  onError
}: ChartErrorBoundaryProps) {

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log chart-specific error information
    console.error(`Chart Error [${chartType || 'unknown'}]:`, {
      chartId,
      chartType,
      error: error.message,
      stack: error.stack
    })

    // Call custom error handler if provided
    if (onError) {
      onError(error, { id: chartId, type: chartType })
    }

    // Track chart errors for analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'chart_error', {
        chart_type: chartType,
        chart_id: chartId,
        error_message: error.message
      })
    }
  }

  const fallback = (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-center">
        <div className="mb-3 relative">
          <BarChart2 className="h-12 w-12 text-gray-300 mx-auto" />
          <AlertCircle className="h-6 w-6 text-red-500 absolute -bottom-1 -right-1" />
        </div>

        <h3 className="text-sm font-medium text-gray-900 mb-1">
          Chart Failed to Load
        </h3>

        <p className="text-xs text-gray-500 mb-3 max-w-xs">
          {chartType ? `The ${chartType} chart` : 'This chart'} encountered an error.
          Try refreshing the page or contact support if the issue persists.
        </p>

        {process.env.NODE_ENV === 'development' && chartId && (
          <div className="text-xs text-gray-400 font-mono">
            ID: {chartId}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={fallback}
      onError={handleError}
      resetKeys={[chartId || '', chartType || '']}
      resetOnPropsChange
      isolate
      level="component"
    >
      {children}
    </ErrorBoundary>
  )
}