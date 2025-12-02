'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function TeamError({
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
      title="Team Error"
      description="We encountered an error while loading your team information. Please try again."
    />
  )
}
