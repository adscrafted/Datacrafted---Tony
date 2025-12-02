'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function ResetPasswordError({
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
      title="Reset Password Error"
      description="We encountered an error while loading the reset password page. Please try again."
    />
  )
}
