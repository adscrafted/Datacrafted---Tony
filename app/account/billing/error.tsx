'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function BillingError({
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
      title="Billing Error"
      description="We encountered an error while loading your billing information. Please try again."
    />
  )
}
