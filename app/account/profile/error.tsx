'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function ProfileError({
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
      title="Profile Error"
      description="We encountered an error while loading your profile. Please try again."
    />
  )
}
