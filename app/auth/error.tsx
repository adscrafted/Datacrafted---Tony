'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function AuthError({
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
      title="Authentication Error"
      description="We encountered an error while loading the authentication page. Please try again."
    />
  )
}
