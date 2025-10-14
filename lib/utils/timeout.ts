/**
 * Timeout Utility
 *
 * Wraps promises with timeout functionality to prevent indefinite hangs.
 * Essential for external API calls (OpenAI, databases, etc.)
 *
 * Performance Impact:
 * - Prevents infinite waits on API failures
 * - Improves user experience with predictable timeouts
 * - Allows graceful error handling
 *
 * @example
 * ```typescript
 * import { withTimeout } from '@/lib/utils/timeout'
 *
 * // Wrap any promise with a timeout
 * const result = await withTimeout(
 *   openai.chat.completions.create({...}),
 *   30000, // 30 second timeout
 *   'OpenAI API request timed out'
 * )
 * ```
 */

/**
 * Wraps a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @returns Promise that rejects if timeout is reached
 *
 * @throws TimeoutError if the timeout is reached before promise resolves
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  // Create a timeout promise that rejects after timeoutMs
  const timeoutPromise = new Promise<T>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage, timeoutMs))
    }, timeoutMs)

    // Cleanup timeout if main promise resolves first
    promise
      .then(() => clearTimeout(timeoutId))
      .catch(() => clearTimeout(timeoutId))
  })

  // Race between the actual promise and the timeout
  return Promise.race([promise, timeoutPromise])
}

/**
 * Custom error class for timeout errors
 * Helps distinguish timeout errors from other errors
 */
export class TimeoutError extends Error {
  public readonly timeoutMs: number
  public readonly isTimeout: true = true

  constructor(message: string, timeoutMs: number) {
    super(message)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs

    // Maintain proper stack trace (only available in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError)
    }
  }
}

/**
 * Type guard to check if an error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError || (error as any)?.isTimeout === true
}

/**
 * Wraps a function with retry logic and timeout
 *
 * @param fn - Function to execute
 * @param options - Configuration options
 * @returns Promise that resolves with function result or rejects with error
 *
 * @example
 * ```typescript
 * const result = await withRetryAndTimeout(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     maxRetries: 3,
 *     timeoutMs: 5000,
 *     retryDelay: 1000,
 *     shouldRetry: (error) => error.status >= 500
 *   }
 * )
 * ```
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    timeoutMs?: number
    retryDelay?: number
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeoutMs = 30000,
    retryDelay = 1000,
    shouldRetry = () => true
  } = options

  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wrap the function call with timeout
      const result = await withTimeout(
        fn(),
        timeoutMs,
        `Operation timed out after ${timeoutMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`
      )

      // Success - return result
      return result

    } catch (error) {
      lastError = error

      // Check if we should retry
      const isLastAttempt = attempt === maxRetries
      const shouldRetryError = shouldRetry(error)

      // If timeout error or last attempt, throw immediately
      if (isTimeoutError(error) || isLastAttempt || !shouldRetryError) {
        throw error
      }

      // Wait before retrying (exponential backoff)
      const delayMs = retryDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delayMs))

      console.log(`[TIMEOUT] Retrying after ${delayMs}ms (attempt ${attempt + 2}/${maxRetries + 1})`)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError
}

/**
 * Creates a timeout promise that can be used with Promise.race
 *
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message
 * @returns Promise that rejects after timeout
 *
 * @example
 * ```typescript
 * const result = await Promise.race([
 *   fetchData(),
 *   createTimeoutPromise(5000, 'Fetch timed out')
 * ])
 * ```
 */
export function createTimeoutPromise<T = never>(
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(errorMessage, timeoutMs))
    }, timeoutMs)
  })
}

/**
 * Measures execution time of an async function
 *
 * @param fn - Function to measure
 * @param label - Optional label for logging
 * @returns Tuple of [result, durationMs]
 */
export async function measureTime<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<[T, number]> {
  const start = Date.now()

  try {
    const result = await fn()
    const duration = Date.now() - start

    if (label) {
      console.log(`[TIMING] ${label}: ${duration}ms`)
    }

    return [result, duration]
  } catch (error) {
    const duration = Date.now() - start

    if (label) {
      console.error(`[TIMING] ${label} failed after ${duration}ms:`, error)
    }

    throw error
  }
}
