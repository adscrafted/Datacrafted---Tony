'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function SignUpError({
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
      title="Sign Up Error"
      description="We encountered an error while loading the sign up page. Please try again."
    />
  )
}
