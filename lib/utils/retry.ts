/**
 * Retry utility with exponential backoff
 * Used for API calls that may fail temporarily
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  onRetry?: (attempt: number, error: Error) => void
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws RetryError if all retries are exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If this is the last attempt, throw
      if (attempt === maxRetries - 1) {
        throw new RetryError(
          `Failed after ${maxRetries} attempts: ${lastError.message}`,
          maxRetries,
          lastError
        )
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      )

      // Call the retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError)
      }

      console.log(
        `🔄 [RETRY] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms:`,
        lastError.message
      )

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new RetryError(
    `Failed after ${maxRetries} attempts`,
    maxRetries,
    lastError!
  )
}

/**
 * Check if an error is retryable (network errors, 5xx, rate limits, etc.)
 * @param error - The error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  // Network errors
  if (
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('timeout')
  ) {
    return true
  }

  // Check for Response objects
  if ('status' in error) {
    const status = (error as any).status
    // Retry on 5xx server errors and 429 rate limit
    return status >= 500 || status === 429
  }

  return false
}

/**
 * Retry only if the error is retryable
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function
 */
export async function retryIfRetryable<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await retryWithBackoff(fn, {
      ...options,
      maxRetries: 1 // Start with 1 attempt
    })
  } catch (error) {
    if (isRetryableError(error)) {
      console.log('⚠️ [RETRY] Retryable error detected, attempting retry...')
      return await retryWithBackoff(fn, options)
    }
    throw error
  }
}
