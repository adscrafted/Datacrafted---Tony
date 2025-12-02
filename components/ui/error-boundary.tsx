'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  description?: string
}

export function ErrorBoundary({
  error,
  reset,
  title = 'Something went wrong',
  description = 'We encountered an error. Please try again.'
}: ErrorBoundaryProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Error boundary caught:', error)
  }, [error])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        {/* Error Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
          {error.message && (
            <p className="mt-2 rounded-lg bg-muted/50 p-3 text-xs font-mono text-muted-foreground">
              {error.message}
            </p>
          )}
        </div>

        {/* Action Button */}
        <Button onClick={reset} size="lg" className="min-w-[150px]">
          Try again
        </Button>
      </div>
    </div>
  )
}
