'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function CleanupError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Cleanup Tools Error"
      description="We encountered an error while loading the cleanup tools. Please try again."
    />
  )
}
