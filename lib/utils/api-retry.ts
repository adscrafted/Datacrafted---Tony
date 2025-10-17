/**
 * API Retry Utility with Exponential Backoff and Circuit Breaker
 *
 * Prevents cascading failures and application crashes due to repeated failed API calls.
 * Implements:
 * - Exponential backoff for retries
 * - Circuit breaker pattern to prevent overload
 * - Rate limit handling with Retry-After header
 * - Configurable retry strategies
 */

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  shouldRetry?: (error: any, attempt: number) => boolean
  onRetry?: (attempt: number, error: any) => void
}

interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'closed' | 'open' | 'half-open'
}

// Global circuit breaker registry
const circuitBreakers = new Map<string, CircuitBreakerState>()

const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_TIMEOUT = 60000 // 1 minute

/**
 * Get or initialize circuit breaker for endpoint
 */
function getCircuitBreaker(endpoint: string): CircuitBreakerState {
  if (!circuitBreakers.has(endpoint)) {
    circuitBreakers.set(endpoint, {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed'
    })
  }
  return circuitBreakers.get(endpoint)!
}

/**
 * Check if circuit breaker allows request
 */
function canAttemptRequest(endpoint: string): boolean {
  const breaker = getCircuitBreaker(endpoint)
  const now = Date.now()

  if (breaker.state === 'open') {
    // Check if timeout has elapsed
    if (now - breaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
      // Move to half-open state (allow one test request)
      breaker.state = 'half-open'
      console.log(`[CIRCUIT BREAKER] ${endpoint} moving to half-open state`)
      return true
    }
    return false
  }

  return true
}

/**
 * Record success for circuit breaker
 */
function recordSuccess(endpoint: string): void {
  const breaker = getCircuitBreaker(endpoint)
  if (breaker.failures > 0) {
    console.log(`[CIRCUIT BREAKER] ${endpoint} recovered after ${breaker.failures} failures`)
  }
  breaker.failures = 0
  breaker.state = 'closed'
}

/**
 * Record failure for circuit breaker
 */
function recordFailure(endpoint: string): void {
  const breaker = getCircuitBreaker(endpoint)
  breaker.failures++
  breaker.lastFailureTime = Date.now()

  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.state = 'open'
    console.error(
      `[CIRCUIT BREAKER] Opened for ${endpoint} after ${breaker.failures} failures. ` +
      `Will retry in ${CIRCUIT_BREAKER_TIMEOUT / 1000}s`
    )
  }
}

/**
 * Extract endpoint pattern from URL for circuit breaker grouping
 */
function getEndpointPattern(url: string): string {
  try {
    const urlObj = new URL(url, window.location.origin)
    // Replace IDs with placeholders for grouping
    return urlObj.pathname.replace(/\/[a-z0-9-]{20,}/gi, '/:id')
  } catch {
    return url
  }
}

/**
 * Default retry strategy - don't retry client errors except 429
 */
const defaultShouldRetry = (error: any, attempt: number, maxRetries: number): boolean => {
  // Don't retry if max retries exceeded
  if (attempt >= maxRetries) {
    return false
  }

  // Always retry network errors
  if (!error.status) {
    return true
  }

  // Retry rate limiting (429)
  if (error.status === 429) {
    return true
  }

  // Retry server errors (5xx)
  if (error.status >= 500) {
    return true
  }

  // Don't retry client errors (4xx)
  if (error.status >= 400 && error.status < 500) {
    return false
  }

  // Retry other errors
  return true
}

/**
 * Retry a fetch request with exponential backoff and circuit breaker
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry configuration
 * @returns Response object
 * @throws Error if all retries exhausted or circuit breaker open
 *
 * @example
 * ```typescript
 * const response = await retryFetch('/api/data', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' }
 * }, {
 *   maxRetries: 3,
 *   initialDelayMs: 500,
 *   onRetry: (attempt, error) => console.log(`Retry ${attempt}`, error)
 * })
 * ```
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry
  } = retryOptions

  const endpointPattern = getEndpointPattern(url)

  // Check circuit breaker
  if (!canAttemptRequest(endpointPattern)) {
    const error = new Error(
      `Circuit breaker open for ${endpointPattern}. Too many recent failures. ` +
      `Please wait ${CIRCUIT_BREAKER_TIMEOUT / 1000}s before retrying.`
    )
    ;(error as any).circuitBreakerOpen = true
    throw error
  }

  let lastError: any
  let delay = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Handle rate limiting with Retry-After header
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        const retryDelay = retryAfter
          ? parseInt(retryAfter) * 1000
          : delay

        if (attempt < maxRetries) {
          console.warn(
            `[RETRY] Rate limited on ${endpointPattern}. ` +
            `Waiting ${retryDelay}ms before retry ${attempt + 1}/${maxRetries}`
          )

          if (onRetry) {
            onRetry(attempt + 1, { status: 429, message: 'Rate limited' })
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay))
          delay = Math.min(delay * backoffMultiplier, maxDelayMs)
          continue
        }
      }

      // Success - record and return
      if (response.ok) {
        recordSuccess(endpointPattern)
        return response
      }

      // Build error object
      lastError = {
        status: response.status,
        statusText: response.statusText,
        url
      }

      // Check if we should retry this error
      if (!shouldRetry(lastError, attempt, maxRetries)) {
        // Don't count auth errors as failures for circuit breaker
        if (response.status !== 401 && response.status !== 403) {
          recordFailure(endpointPattern)
        }
        return response // Return the error response, let caller handle it
      }

      // Retry with backoff
      if (attempt < maxRetries) {
        console.warn(
          `[RETRY] Attempt ${attempt + 1}/${maxRetries} failed for ${endpointPattern}. ` +
          `Status: ${response.status}. Waiting ${delay}ms`
        )

        if (onRetry) {
          onRetry(attempt + 1, lastError)
        }

        await new Promise(resolve => setTimeout(resolve, delay))
        delay = Math.min(delay * backoffMultiplier, maxDelayMs)
      }

    } catch (error) {
      lastError = error

      // Network errors are retryable
      if (attempt < maxRetries) {
        console.warn(
          `[RETRY] Network error on attempt ${attempt + 1}/${maxRetries} for ${endpointPattern}. ` +
          `Waiting ${delay}ms. Error: ${error instanceof Error ? error.message : 'Unknown'}`
        )

        if (onRetry) {
          onRetry(attempt + 1, error)
        }

        await new Promise(resolve => setTimeout(resolve, delay))
        delay = Math.min(delay * backoffMultiplier, maxDelayMs)
      } else {
        recordFailure(endpointPattern)
        throw error
      }
    }
  }

  // All retries exhausted
  recordFailure(endpointPattern)

  if (lastError instanceof Error) {
    throw lastError
  } else {
    throw new Error(
      `Request failed after ${maxRetries} retries. ` +
      `Status: ${lastError?.status || 'unknown'}, URL: ${url}`
    )
  }
}

/**
 * Reset circuit breaker for endpoint (useful for manual recovery)
 *
 * @param endpoint - Endpoint pattern to reset
 */
export function resetCircuitBreaker(endpoint: string): void {
  const pattern = getEndpointPattern(endpoint)
  circuitBreakers.delete(pattern)
  console.log(`[CIRCUIT BREAKER] Reset for ${pattern}`)
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  const count = circuitBreakers.size
  circuitBreakers.clear()
  console.log(`[CIRCUIT BREAKER] Reset all (${count} endpoints)`)
}

/**
 * Get circuit breaker status for monitoring
 *
 * @returns Map of endpoint patterns to their circuit breaker states
 */
export function getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
  return Object.fromEntries(Array.from(circuitBreakers.entries()))
}

/**
 * Check if any circuit breakers are open
 */
export function hasOpenCircuitBreakers(): boolean {
  for (const breaker of Array.from(circuitBreakers.values())) {
    if (breaker.state === 'open') {
      return true
    }
  }
  return false
}

/**
 * Get count of open circuit breakers
 */
export function getOpenCircuitBreakerCount(): number {
  let count = 0
  for (const breaker of Array.from(circuitBreakers.values())) {
    if (breaker.state === 'open') {
      count++
    }
  }
  return count
}

/**
 * Convenience wrapper for GET requests with retry
 */
export async function retryGet(
  url: string,
  token?: string,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryFetch(
    url,
    {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      }
    },
    retryOptions
  )
}

/**
 * Convenience wrapper for POST requests with retry
 */
export async function retryPost(
  url: string,
  body: any,
  token?: string,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    retryOptions
  )
}

/**
 * Convenience wrapper for PUT requests with retry
 */
export async function retryPut(
  url: string,
  body: any,
  token?: string,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryFetch(
    url,
    {
      method: 'PUT',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    retryOptions
  )
}
