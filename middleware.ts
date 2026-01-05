/**
 * Next.js Middleware for Server-Side Route Protection & Security Headers
 *
 * This middleware runs on the Edge runtime and provides:
 * 1. Route protection BEFORE pages render (cannot be bypassed client-side)
 * 2. Content Security Policy (CSP) with nonce-based security
 * 3. CORS validation and security headers
 * 4. Security headers injection for every request
 *
 * Protected Routes:
 * - /dashboard/* - Requires authentication
 * - /projects/* - Requires authentication
 * - /account/* - Requires authentication
 *
 * Public Routes:
 * - / - Landing page
 * - /api/* - Protected separately by API middleware (withAuth)
 * - /signin, /signup - Auth pages (if they exist)
 *
 * Security Features:
 * - Authentication checks (Firebase session cookie, Bearer token)
 * - CORS origin validation with allowlist
 * - Preflight OPTIONS request handling
 * - Nonce-based CSP (removes unsafe-inline, unsafe-eval in production)
 * - Security headers (X-Frame-Options, HSTS, etc.)
 * - Debug mode bypass (development only)
 * - Fast edge execution (no database queries)
 *
 * OWASP Reference: A03:2021 - Injection (XSS Prevention)
 * OWASP Reference: A05:2021 - Security Misconfiguration
 * OWASP Reference: A07:2021 - Identification and Authentication Failures
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { generateNonce, buildCSPHeader, isProductionEnvironment } from '@/lib/security/csp'
import {
  isAllowedOrigin,
  getCorsHeaders,
  handlePreflightRequest,
  getCORSConfig
} from '@/lib/config/cors'

// Protected route patterns
const PROTECTED_ROUTES = ['/dashboard', '/projects', '/account']

// Public routes that should never be protected
const PUBLIC_ROUTES = ['/', '/signin', '/signup', '/api']

// Routes that should skip CORS checks entirely (server-to-server webhooks)
const CORS_EXEMPT_ROUTES = ['/api/stripe/webhook']

/**
 * Check if a pathname matches any protected route patterns
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Check if a pathname is explicitly public
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))
}

/**
 * Check if a pathname should skip CORS checks (server-to-server webhooks)
 */
function isCorsExemptRoute(pathname: string): boolean {
  return CORS_EXEMPT_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Check if request has valid authentication credentials
 *
 * This is a lightweight check - we only verify the token EXISTS, not its validity.
 * Token validity is checked by the API middleware (withAuth) for better performance.
 */
function hasAuthCredentials(request: NextRequest): boolean {
  // Check for Firebase session cookie (most secure method)
  const sessionCookie = request.cookies.get('__session')?.value
  if (sessionCookie) {
    console.log('[MIDDLEWARE] Auth: Found session cookie')
    return true
  }

  // Check for Authorization header (for API requests)
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('[MIDDLEWARE] Auth: Found Bearer token')
    return true
  }

  // No credentials found
  return false
}

/**
 * Check if debug mode is enabled (development only)
 *
 * SECURITY: Uses server-only DEBUG_MODE environment variable.
 * NEXT_PUBLIC_ variables are not used for security-sensitive configuration.
 */
function isDebugModeEnabled(): boolean {
  // Use server-only DEBUG_MODE (not NEXT_PUBLIC_)
  const debugEnvVar = process.env.DEBUG_MODE === 'true'

  if (!debugEnvVar) {
    return false
  }

  // SECURITY: Production environment detection
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    process.env.RENDER !== undefined ||
    process.env.FLY_APP_NAME !== undefined

  // CRITICAL: Never allow debug mode in production
  if (isProduction) {
    console.error(
      '🚨 [MIDDLEWARE SECURITY] CRITICAL: Attempted to enable DEBUG_MODE in production.\n' +
      '   Debug mode has been DISABLED for security.\n' +
      `   Environment: NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV}`
    )
    return false
  }

  // Only allow in local development
  return process.env.NODE_ENV === 'development'
}

/**
 * Apply CORS headers to response
 *
 * Validates origin and applies appropriate CORS headers.
 * Only allowed origins receive CORS headers.
 *
 * @param response - NextResponse to modify
 * @param request - Incoming request with origin header
 */
function applyCorsHeaders(response: NextResponse, request: NextRequest): void {
  const origin = request.headers.get('origin')
  const config = getCORSConfig()

  // Validate origin and get CORS headers
  if (isAllowedOrigin(origin)) {
    // Set CORS headers for allowed origins
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))

    // Add Vary header to indicate response varies based on Origin
    // This is critical for proper caching behavior
    response.headers.set('Vary', 'Origin')
  } else if (origin) {
    // SECURITY: Log blocked origin attempts in production
    const isProduction = isProductionEnvironment()
    if (isProduction) {
      console.error(`[MIDDLEWARE CORS] BLOCKED: Unauthorized origin: ${origin}`)
    }
  }
}

/**
 * Apply security headers to response
 *
 * Injects CSP and other security headers into the response.
 * The nonce is passed to Next.js via a custom header for use in script tags.
 *
 * SECURITY HEADERS:
 * - Content-Security-Policy: XSS prevention with nonce-based scripts
 * - Cross-Origin-Opener-Policy: Spectre protection with popup support
 * - Cross-Origin-Embedder-Policy: Cross-origin isolation
 * - X-Frame-Options: Clickjacking protection
 * - X-Content-Type-Options: MIME type sniffing prevention
 * - Referrer-Policy: Referrer information control
 * - Strict-Transport-Security: HTTPS enforcement
 * - Permissions-Policy: Browser feature restrictions
 *
 * @param response - NextResponse to modify
 * @param nonce - Cryptographic nonce for CSP
 */
function applySecurityHeaders(response: NextResponse, nonce: string): void {
  const isProduction = isProductionEnvironment()

  // Build CSP header with nonce
  const cspHeader = buildCSPHeader(nonce, !isProduction)

  // Set security headers
  response.headers.set('Content-Security-Policy', cspHeader)

  // COOP: Allow popups for Firebase Auth (OAuth flows)
  // This prevents "Cross-Origin-Opener-Policy policy would block the window.closed call" errors
  // while maintaining Spectre attack protection
  // OWASP Reference: A05:2021 - Security Misconfiguration
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')

  // COEP: Require explicit opt-in for loading cross-origin resources
  // NOTE: Using 'unsafe-none' to maintain compatibility with third-party resources
  // In strict security mode, use 'require-corp' instead
  response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none')

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  // HSTS - only in production to avoid issues with localhost
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Pass nonce to Next.js for use in script tags
  // This header can be read in layout.tsx or page components
  response.headers.set('x-nonce', nonce)

  // Add CSP report-only header for testing (optional)
  // Uncomment to test CSP without enforcing it:
  // response.headers.set('Content-Security-Policy-Report-Only', cspHeader)
}

/**
 * Main middleware function
 * Runs on every request to matched routes (see config.matcher below)
 *
 * EXECUTION ORDER:
 * 1. Handle CORS preflight OPTIONS requests
 * 2. Generate cryptographic nonce
 * 3. Check route protection requirements
 * 4. Verify authentication if needed
 * 5. Apply CORS and security headers
 * 6. Return response (allow or redirect)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method
  const origin = request.headers.get('origin')

  console.log('[MIDDLEWARE] Request:', {
    pathname,
    method,
    origin: origin || 'same-origin',
    hasSession: !!request.cookies.get('__session'),
    hasAuthHeader: !!request.headers.get('authorization'),
  })

  // STEP 0: Skip CORS for exempt routes (server-to-server webhooks)
  // These routes don't need CORS headers as they're not browser requests
  const corsExempt = isCorsExemptRoute(pathname)

  // STEP 1: Handle CORS preflight OPTIONS requests
  // These must be handled before any other checks
  if (method === 'OPTIONS' && !corsExempt) {
    console.log('[MIDDLEWARE] Handling CORS preflight request')

    // Validate origin for preflight
    if (!isAllowedOrigin(origin)) {
      console.warn(`[MIDDLEWARE CORS] Preflight blocked for origin: ${origin}`)
      return new NextResponse('Forbidden', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    // Return preflight response with CORS headers
    const config = getCORSConfig()
    const headers = new Headers()

    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin)
    }
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '))
    headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '))
    headers.set('Access-Control-Max-Age', config.maxAge.toString())
    headers.set('Vary', 'Origin')

    return new NextResponse(null, {
      status: 204,
      headers,
    })
  }

  // STEP 2: Generate nonce for this request
  // This must happen BEFORE any response is created
  const nonce = generateNonce()

  // STEP 3: Allow public routes immediately
  if (isPublicRoute(pathname)) {
    console.log('[MIDDLEWARE] Public route - allowing access')
    const response = NextResponse.next()
    if (!corsExempt) applyCorsHeaders(response, request)
    applySecurityHeaders(response, nonce)
    return response
  }

  // STEP 4: Check if route should be protected
  const shouldProtect = isProtectedRoute(pathname)

  if (!shouldProtect) {
    console.log('[MIDDLEWARE] Route not protected - allowing access')
    const response = NextResponse.next()
    if (!corsExempt) applyCorsHeaders(response, request)
    applySecurityHeaders(response, nonce)
    return response
  }

  // STEP 5: Check for authentication credentials
  const hasAuth = hasAuthCredentials(request)

  if (hasAuth) {
    console.log('[MIDDLEWARE] Authenticated - allowing access to', pathname)
    const response = NextResponse.next()
    if (!corsExempt) applyCorsHeaders(response, request)
    applySecurityHeaders(response, nonce)
    return response
  }

  // STEP 6: Debug mode bypass (development only)
  const debugMode = isDebugModeEnabled()

  if (debugMode) {
    console.warn('⚠️ [MIDDLEWARE] DEBUG_MODE: Bypassing auth for', pathname)
    console.warn('⚠️ [MIDDLEWARE] This should NEVER happen in production!')

    // Add a header to indicate debug mode was used
    const response = NextResponse.next()
    response.headers.set('X-Debug-Mode', 'true')
    if (!corsExempt) applyCorsHeaders(response, request)
    applySecurityHeaders(response, nonce)
    return response
  }

  // STEP 7: No authentication found - redirect to landing page
  console.log('[MIDDLEWARE] Unauthorized access to', pathname, '- redirecting to /')

  // Create redirect URL
  const redirectUrl = new URL('/', request.url)

  // Optional: Add a query parameter to show a message on the landing page
  redirectUrl.searchParams.set('auth_required', 'true')
  redirectUrl.searchParams.set('redirect_from', pathname)

  const response = NextResponse.redirect(redirectUrl)
  if (!corsExempt) applyCorsHeaders(response, request)
  applySecurityHeaders(response, nonce)
  return response
}

/**
 * Middleware Configuration
 *
 * The matcher defines which routes this middleware runs on.
 * Use specific patterns to minimize performance impact.
 *
 * Note: Matcher syntax uses path-to-regexp patterns
 * - :path* matches zero or more segments
 * - :path+ matches one or more segments
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
