'use client'

import React from 'react'
import { ErrorBoundary } from './error-boundary'
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GlobalErrorBoundaryProps {
  children: React.ReactNode
}

export function GlobalErrorBoundary({ children }: GlobalErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // Log critical errors
      console.error('Critical application error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      })
    }
  }

  const fallback = (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Oops! Something went wrong
            </h1>

            <p className="text-gray-600 mb-6">
              We encountered an unexpected error. The issue has been logged and our team will investigate.
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => window.location.reload()}
                variant="default"
                className="w-full"
                size="lg"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Refresh Page
              </Button>

              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Home className="h-5 w-5 mr-2" />
                Go to Homepage
              </Button>

              <Button
                onClick={() => window.location.href = 'mailto:support@datacrafted.com?subject=Application Error'}
                variant="ghost"
                className="w-full"
                size="lg"
              >
                <Mail className="h-5 w-5 mr-2" />
                Contact Support
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Error ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
              </p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-gray-400 mt-1">
                  Check console for detailed error information
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={fallback}
      onError={handleError}
      level="page"
    >
      {children}
    </ErrorBoundary>
  )
}