'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: string[]
  resetOnPropsChange?: boolean
  isolate?: boolean
  level?: 'page' | 'section' | 'component'
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorCount: number
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null
  private previousResetKeys: string[] = []

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorCount: 0
    }
    this.previousResetKeys = props.resetKeys || []
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    const { errorCount } = this.state

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error)
      console.error('Error Info:', errorInfo)
      console.error('Component Stack:', errorInfo.componentStack)
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo)
    }

    // Update state with error details
    this.setState({
      errorInfo,
      errorCount: errorCount + 1
    })

    // Auto-reset after 3 errors to prevent infinite loops
    if (errorCount >= 2) {
      this.scheduleReset(5000)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    if (hasError) {
      // Reset on prop changes if enabled
      if (resetOnPropsChange && prevProps.children !== this.props.children) {
        this.resetErrorBoundary()
      }

      // Reset if resetKeys changed
      if (resetKeys && this.previousResetKeys) {
        const hasResetKeyChanged = resetKeys.some(
          (key, idx) => key !== this.previousResetKeys[idx]
        )
        if (hasResetKeyChanged) {
          this.resetErrorBoundary()
          this.previousResetKeys = resetKeys
        }
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In production, log to error tracking service
    // Example: Sentry, LogRocket, etc.
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    }

    // Log to console as fallback
    console.error('Production Error:', errorData)

    // TODO: Send to actual error tracking service
    // fetch('/api/errors', {
    //   method: 'POST',
    //   body: JSON.stringify(errorData)
    // })
  }

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary()
    }, delay)
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorCount: 0
    })
  }

  render() {
    const { hasError, error, errorCount } = this.state
    const { children, fallback, isolate, level = 'component' } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>
      }

      // Default error UI based on level
      return (
        <div className={`
          ${level === 'page' ? 'min-h-screen' : ''}
          ${level === 'section' ? 'min-h-[400px]' : 'min-h-[200px]'}
          ${isolate ? 'border border-red-200 rounded-lg' : ''}
          flex items-center justify-center p-4 bg-gray-50
        `}>
          <div className="text-center max-w-md">
            <div className="mb-4">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            </div>

            <h2 className="text-xl font-semibold mb-2">
              {level === 'page' ? 'Page Error' : 'Something went wrong'}
            </h2>

            <p className="text-gray-600 mb-4">
              {error.message || 'An unexpected error occurred'}
            </p>

            {process.env.NODE_ENV === 'development' && (
              <details className="text-left mb-4">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                  {error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 justify-center">
              <Button
                onClick={this.resetErrorBoundary}
                variant="default"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              {level === 'page' && (
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                  size="sm"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              )}
            </div>

            {errorCount > 1 && (
              <p className="text-xs text-gray-500 mt-2">
                Error occurred {errorCount} times. Auto-reset in 5 seconds...
              </p>
            )}
          </div>
        </div>
      )
    }

    return children
  }
}