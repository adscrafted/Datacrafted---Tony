'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Projects error:', error)
  }, [error])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        {/* Error Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            We encountered an error while loading your projects. Please try again.
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
