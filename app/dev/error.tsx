'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function DevError({
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
      title="Dev Tools Error"
      description="We encountered an error while loading the developer tools. Please try again."
    />
  )
}
