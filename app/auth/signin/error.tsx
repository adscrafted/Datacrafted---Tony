'use client'

import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function SignInError({
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
      title="Sign In Error"
      description="We encountered an error while loading the sign in page. Please try again."
    />
  )
}
