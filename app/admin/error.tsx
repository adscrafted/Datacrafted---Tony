'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function AdminError({
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
      title="Admin Panel Error"
      description="We encountered an error while loading the admin panel. Please try again."
    />
  )
}
