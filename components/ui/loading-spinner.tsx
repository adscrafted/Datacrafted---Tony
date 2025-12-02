interface LoadingSpinnerProps {
  message?: string
  submessage?: string
}

export function LoadingSpinner({ message, submessage }: LoadingSpinnerProps) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">
          {/* Spinner */}
          <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
        {(message || submessage) && (
          <div className="text-center">
            {message && <p className="text-sm font-medium text-foreground">{message}</p>}
            {submessage && <p className="text-xs text-muted-foreground">{submessage}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
