'use client'

import React from 'react'
import { AlertCircle, X, RefreshCw, FileWarning } from 'lucide-react'
import { Button } from './button'

interface ErrorMessageProps {
  title?: string
  message: string
  details?: string
  type?: 'error' | 'warning' | 'info'
  onDismiss?: () => void
  onRetry?: () => void
  suggestions?: string[]
}

export function ErrorMessage({
  title = 'Error',
  message,
  details,
  type = 'error',
  onDismiss,
  onRetry,
  suggestions
}: ErrorMessageProps) {
  const getStyles = () => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-900',
          icon: 'text-yellow-500'
        }
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          icon: 'text-blue-500'
        }
      default:
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-900',
          icon: 'text-red-500'
        }
    }
  }

  const styles = getStyles()

  return (
    <div className={`rounded-lg border ${styles.border} ${styles.bg} p-4`}>
      <div className="flex items-start">
        <AlertCircle className={`h-5 w-5 ${styles.icon} mt-0.5`} />
        <div className="ml-3 flex-1">
          <h3 className={`font-semibold ${styles.text}`}>{title}</h3>
          <p className={`mt-1 text-sm ${styles.text}`}>{message}</p>

          {details && (
            <details className="mt-2">
              <summary className={`cursor-pointer text-sm ${styles.text} opacity-75 hover:opacity-100`}>
                View technical details
              </summary>
              <pre className="mt-2 text-xs bg-white rounded p-2 overflow-x-auto">
                {details}
              </pre>
            </details>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="mt-3">
              <p className={`text-sm font-medium ${styles.text}`}>Suggestions:</p>
              <ul className="mt-1 list-disc list-inside">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className={`text-sm ${styles.text} opacity-90`}>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(onRetry || onDismiss) && (
            <div className="mt-4 flex gap-2">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`ml-3 ${styles.text} opacity-50 hover:opacity-100 transition-opacity`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function FileUploadError({
  error,
  fileName,
  onRetry,
  onDismiss
}: {
  error: string
  fileName?: string
  onRetry?: () => void
  onDismiss?: () => void
}) {
  const getSuggestions = (error: string): string[] => {
    const suggestions: string[] = []

    if (error.toLowerCase().includes('size')) {
      suggestions.push('Try compressing your file or splitting it into smaller chunks')
      suggestions.push('Remove unnecessary columns or rows from your dataset')
    }

    if (error.toLowerCase().includes('format') || error.toLowerCase().includes('type')) {
      suggestions.push('Ensure your file is in CSV, XLS, XLSX, or JSON format')
      suggestions.push('Check that the file is not corrupted')
    }

    if (error.toLowerCase().includes('network') || error.toLowerCase().includes('timeout')) {
      suggestions.push('Check your internet connection')
      suggestions.push('Try uploading the file again')
    }

    if (error.toLowerCase().includes('permission') || error.toLowerCase().includes('access')) {
      suggestions.push('Ensure you have permission to access this file')
      suggestions.push('Try saving the file to a different location first')
    }

    if (suggestions.length === 0) {
      suggestions.push('Try refreshing the page and uploading again')
      suggestions.push('Contact support if the issue persists')
    }

    return suggestions
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-center mb-4">
        <FileWarning className="h-6 w-6 text-red-500" />
        <h3 className="ml-2 text-lg font-semibold text-red-900">
          File Upload Failed
        </h3>
      </div>

      {fileName && (
        <p className="text-sm text-red-800 mb-2">
          File: <span className="font-mono font-medium">{fileName}</span>
        </p>
      )}

      <p className="text-sm text-red-900 mb-4">{error}</p>

      <div className="mb-4">
        <p className="text-sm font-medium text-red-900 mb-1">What you can try:</p>
        <ul className="list-disc list-inside space-y-1">
          {getSuggestions(error).map((suggestion, index) => (
            <li key={index} className="text-sm text-red-800">
              {suggestion}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Try Again
          </Button>
        )}
        {onDismiss && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDismiss}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Cancel Upload
          </Button>
        )}
      </div>
    </div>
  )
}