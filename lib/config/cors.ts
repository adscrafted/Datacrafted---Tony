/**
 * CORS Configuration for Production
 *
 * SECURITY OVERVIEW:
 * This module implements a strict, defense-in-depth CORS policy that:
 * 1. Uses an explicit allowlist instead of wildcard origins
 * 2. Validates Origin header against environment-specific allowed domains
 * 3. Implements proper preflight (OPTIONS) request handling
 * 4. Uses specific origins instead of "*" to allow credentials
 * 5. Applies appropriate security headers for cross-origin requests
 *
 * OWASP Reference: A05:2021 - Security Misconfiguration
 * OWASP Reference: A07:2021 - Identification and Authentication Failures
 * https://owasp.org/Top10/A05_2021-Security_Misconfiguration/
 *
 * WHY CORS MATTERS:
 * - Prevents unauthorized domains from accessing your API
 * - Protects user data from cross-origin attacks
 * - Enables secure credential-based authentication
 * - Complies with Same-Origin Policy (SOP) browser security
 *
 * IMPLEMENTATION STRATEGY:
 * - Development: Allow localhost origins for local testing
 * - Production: Use explicit allowlist from environment variables
 * - Deny by default: Unknown origins are rejected
 * - Credentials: Enable for trusted origins only
 * - Preflight caching: Reduce OPTIONS requests with max-age
 */

/**
 * CORS Configuration Interface
 */
export interface CORSConfig {
  allowedOrigins: string[]
  allowedMethods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  credentials: boolean
  maxAge: number // Preflight cache duration in seconds
}

/**
 * Environment-based allowed origins
 *
 * SECURITY: Multi-tier origin validation
 * - Tier 1: Hardcoded safe origins for known environments
 * - Tier 2: Environment variable for additional production domains
 * - Tier 3: Localhost origins ONLY in development
 *
 * Production domains should be set via ALLOWED_ORIGINS environment variable:
 * ALLOWED_ORIGINS=https://datacrafted.com,https://www.datacrafted.com,https://app.datacrafted.com
 */
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001', // Alternative port for testing
  'http://127.0.0.1:3001',
]

/**
 * Parse production origins from environment variable
 *
 * SECURITY: Validates and sanitizes origins from environment
 * - Ensures HTTPS protocol (except localhost)
 * - Removes trailing slashes
 * - Validates URL format
 * - Deduplicates origins
 *
 * @returns Array of validated production origins
 */
function getProductionOrigins(): string[] {
  let envOrigins = process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || ''

  if (!envOrigins) {
    console.warn(
      '[CORS] WARNING: No ALLOWED_ORIGINS configured for production.\n' +
      '      Set ALLOWED_ORIGINS environment variable with comma-separated domains.\n' +
      '      Example: ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com'
    )
    return []
  }

  // Defensive: Strip any accidental "KEY=" prefix from the value
  // This can happen if env vars are misconfigured
  if (envOrigins.startsWith('ALLOWED_ORIGINS=')) {
    console.warn('[CORS] WARNING: ALLOWED_ORIGINS value contains "ALLOWED_ORIGINS=" prefix. Stripping it.')
    envOrigins = envOrigins.replace('ALLOWED_ORIGINS=', '')
  }
  if (envOrigins.startsWith('NEXT_PUBLIC_APP_URL=')) {
    console.warn('[CORS] WARNING: NEXT_PUBLIC_APP_URL value contains prefix. Stripping it.')
    envOrigins = envOrigins.replace('NEXT_PUBLIC_APP_URL=', '')
  }

  // Parse and validate origins
  const origins = envOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
    .map(origin => {
      // Remove trailing slash for consistency
      origin = origin.replace(/\/$/, '')

      // Validate URL format
      try {
        const url = new URL(origin)

        // SECURITY: Enforce HTTPS in production (except localhost)
        if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
          if (url.protocol !== 'https:') {
            console.warn(`[CORS] WARNING: Non-HTTPS origin detected: ${origin}`)
            console.warn('       Converting to HTTPS for security')
            url.protocol = 'https:'
            return url.origin
          }
        }

        return url.origin
      } catch (error) {
        console.error(`[CORS] ERROR: Invalid origin URL: ${origin}`)
        return null
      }
    })
    .filter((origin): origin is string => origin !== null)

  // Remove duplicates
  const uniqueOrigins = Array.from(new Set(origins))

  if (uniqueOrigins.length === 0) {
    console.error(
      '[CORS] ERROR: No valid production origins configured.\n' +
      '       CORS will block all cross-origin requests.\n' +
      '       Set ALLOWED_ORIGINS with valid HTTPS URLs.'
    )
  }

  return uniqueOrigins
}

/**
 * Detect if running in production environment
 *
 * SECURITY CRITICAL: Determines which origin allowlist to use
 * Multiple platform detection ensures correct environment identification
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    process.env.RENDER !== undefined ||
    process.env.FLY_APP_NAME !== undefined ||
    process.env.AWS_EXECUTION_ENV !== undefined ||
    process.env.KUBERNETES_SERVICE_HOST !== undefined ||
    process.env.HEROKU_APP_NAME !== undefined ||
    process.env.CF_PAGES !== undefined
  )
}

/**
 * Get allowed origins based on environment
 *
 * SECURITY: Environment-specific allowlists
 * - Development: localhost origins only
 * - Production: Explicit domain allowlist from environment
 * - Never allows wildcard "*" to support credentials
 *
 * @returns Array of allowed origins for current environment
 */
export function getAllowedOrigins(): string[] {
  const isProduction = isProductionEnvironment()

  if (isProduction) {
    const productionOrigins = getProductionOrigins()
    console.log(`[CORS] Production mode - ${productionOrigins.length} allowed origins configured`)
    return productionOrigins
  }

  console.log(`[CORS] Development mode - allowing localhost origins`)
  return DEVELOPMENT_ORIGINS
}

/**
 * Validate if an origin is allowed
 *
 * SECURITY: Strict origin validation with multiple checks
 * - Null origin: Blocked (privacy-sensitive/sandboxed contexts)
 * - Undefined origin: Allowed (same-origin requests)
 * - Cross-origin: Validated against allowlist
 *
 * @param origin - Origin header from request (null, undefined, or string)
 * @returns true if origin is allowed, false otherwise
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  // SECURITY: Same-origin requests don't send Origin header
  // These are implicitly trusted
  if (origin === undefined) {
    return true
  }

  // SECURITY: Null origin indicates privacy-sensitive or sandboxed context
  // Block these by default (can be relaxed for specific use cases)
  if (origin === null) {
    console.warn('[CORS] Blocked request with null Origin header')
    return false
  }

  // Normalize origin (remove trailing slash)
  const normalizedOrigin = origin.replace(/\/$/, '')

  // Check against allowlist
  const allowedOrigins = getAllowedOrigins()
  const isAllowed = allowedOrigins.includes(normalizedOrigin)

  if (!isAllowed) {
    const isProduction = isProductionEnvironment()
    if (isProduction) {
      console.error(
        `[CORS] BLOCKED: Unauthorized origin attempt: ${normalizedOrigin}\n` +
        `       Allowed origins: ${allowedOrigins.join(', ')}`
      )
    } else {
      console.warn(
        `[CORS] Origin not in allowlist: ${normalizedOrigin}\n` +
        `       Allowed origins: ${allowedOrigins.join(', ')}\n` +
        `       Add to ALLOWED_ORIGINS if this is expected`
      )
    }
  }

  return isAllowed
}

/**
 * Get CORS headers for a given origin
 *
 * SECURITY: Dynamic header generation based on origin validation
 * - Returns restrictive headers for allowed origins
 * - Returns empty headers for disallowed origins
 * - Never uses wildcard "*" to enable credentials
 *
 * @param origin - Origin header from request
 * @returns Headers object with CORS headers
 */
export function getCorsHeaders(origin: string | null | undefined): Headers {
  const headers = new Headers()

  // Validate origin
  if (!isAllowedOrigin(origin)) {
    // SECURITY: Don't set CORS headers for disallowed origins
    // This causes browser to block the response
    return headers
  }

  // Set specific origin (required for credentials)
  // SECURITY: Never use "*" when credentials are enabled
  if (origin !== undefined && origin !== null) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  // Enable credentials (cookies, authorization headers)
  headers.set('Access-Control-Allow-Credentials', 'true')

  return headers
}

/**
 * Get CORS configuration based on environment
 *
 * @returns CORS configuration object
 */
export function getCORSConfig(): CORSConfig {
  return {
    allowedOrigins: getAllowedOrigins(),

    // HTTP methods allowed for CORS requests
    allowedMethods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    // Headers that client is allowed to send
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token', // For CSRF protection
      'X-Client-Version', // For version tracking
    ],

    // Headers that client can access in response
    exposedHeaders: [
      'Content-Length',
      'Content-Type',
      'X-Request-ID', // For request tracing
      'X-RateLimit-Limit', // Rate limit information
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],

    // Enable credentials (cookies, auth headers)
    credentials: true,

    // Preflight cache duration (24 hours)
    // SECURITY: Reduces OPTIONS requests but can be lowered if CORS config changes frequently
    maxAge: 86400,
  }
}

/**
 * Handle preflight OPTIONS request
 *
 * SECURITY: Proper preflight handling prevents unauthorized cross-origin requests
 * - Validates origin before responding
 * - Returns appropriate CORS headers
 * - Caches preflight response to reduce overhead
 *
 * @param request - Incoming request
 * @returns Response with CORS headers or 403 Forbidden
 */
export function handlePreflightRequest(request: Request): Response {
  const origin = request.headers.get('origin')

  // Validate origin
  if (!isAllowedOrigin(origin)) {
    console.warn(`[CORS] Preflight blocked for origin: ${origin}`)
    return new Response('Forbidden', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  }

  const config = getCORSConfig()
  const headers = new Headers()

  // Set CORS headers for preflight
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
  }
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '))
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '))
  headers.set('Access-Control-Max-Age', config.maxAge.toString())

  // Return 204 No Content for OPTIONS
  return new Response(null, {
    status: 204,
    headers,
  })
}

/**
 * Apply CORS headers to a response
 *
 * Convenience function to add CORS headers to existing responses
 *
 * @param response - Response to add CORS headers to
 * @param origin - Origin header from request
 * @returns Response with CORS headers added
 */
export function applyCorsHeaders(
  response: Response,
  origin: string | null | undefined
): Response {
  // Validate origin
  if (!isAllowedOrigin(origin)) {
    // Return response without CORS headers
    // Browser will block cross-origin access
    return response
  }

  const config = getCORSConfig()
  const newHeaders = new Headers(response.headers)

  // Add CORS headers
  if (origin) {
    newHeaders.set('Access-Control-Allow-Origin', origin)
  }
  newHeaders.set('Access-Control-Allow-Credentials', 'true')
  newHeaders.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))

  // Create new response with updated headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

/**
 * SECURITY CHECKLIST FOR PRODUCTION CORS
 *
 * ✅ DO:
 * 1. Use explicit origin allowlist (never "*" with credentials)
 * 2. Validate Origin header on every request
 * 3. Use HTTPS URLs in production origins
 * 4. Enable credentials only for trusted origins
 * 5. Set appropriate preflight cache duration
 * 6. Log blocked CORS attempts for monitoring
 * 7. Use environment variables for production domains
 * 8. Test CORS with actual frontend domains before production
 *
 * ❌ DON'T:
 * 1. Use wildcard "*" when credentials are enabled (won't work)
 * 2. Trust Origin header without validation
 * 3. Allow HTTP origins in production
 * 4. Expose sensitive headers unnecessarily
 * 5. Set overly long preflight cache (makes updates harder)
 * 6. Allow null origins in production (privacy/security risk)
 * 7. Disable CORS in production (defeats security purpose)
 * 8. Use regex for origin matching (can be bypassed)
 *
 * TESTING CHECKLIST:
 * □ Test with actual frontend domain in production
 * □ Verify OPTIONS preflight requests succeed
 * □ Confirm credentials (cookies/auth) are sent
 * □ Test with unauthorized origin (should fail)
 * □ Verify CORS headers in production responses
 * □ Check browser console for CORS errors
 * □ Test all HTTP methods (GET, POST, PUT, DELETE)
 * □ Verify exposed headers are accessible to client
 */
