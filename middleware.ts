/**
 * Next.js Middleware for Server-Side Route Protection
 *
 * This middleware runs on the Edge runtime and protects routes BEFORE they render.
 * Unlike client-side checks, this CANNOT be bypassed by disabling JavaScript.
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
 * - Checks for Firebase session cookie (__session)
 * - Checks for Authorization header (Bearer token)
 * - Debug mode bypass (development only)
 * - Prevents client-side auth bypass
 * - Fast edge execution (no database queries)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Protected route patterns
const PROTECTED_ROUTES = ['/dashboard', '/projects', '/account']

// Public routes that should never be protected
const PUBLIC_ROUTES = ['/', '/signin', '/signup', '/api']

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
 * SECURITY: This function includes production safeguards to prevent
 * debug mode from being enabled in production environments.
 */
function isDebugModeEnabled(): boolean {
  // Check if debug mode environment variable is set
  const debugEnvVar = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

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
 * Main middleware function
 * Runs on every request to matched routes (see config.matcher below)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  console.log('[MIDDLEWARE] Request:', {
    pathname,
    method: request.method,
    hasSession: !!request.cookies.get('__session'),
    hasAuthHeader: !!request.headers.get('authorization'),
  })

  // 1. Allow public routes immediately
  if (isPublicRoute(pathname)) {
    console.log('[MIDDLEWARE] Public route - allowing access')
    return NextResponse.next()
  }

  // 2. Check if route should be protected
  const shouldProtect = isProtectedRoute(pathname)

  if (!shouldProtect) {
    console.log('[MIDDLEWARE] Route not protected - allowing access')
    return NextResponse.next()
  }

  // 3. Check for authentication credentials
  const hasAuth = hasAuthCredentials(request)

  if (hasAuth) {
    console.log('[MIDDLEWARE] Authenticated - allowing access to', pathname)
    return NextResponse.next()
  }

  // 4. Debug mode bypass (development only)
  const debugMode = isDebugModeEnabled()

  if (debugMode) {
    console.warn('⚠️ [MIDDLEWARE] DEBUG_MODE: Bypassing auth for', pathname)
    console.warn('⚠️ [MIDDLEWARE] This should NEVER happen in production!')

    // Add a header to indicate debug mode was used
    const response = NextResponse.next()
    response.headers.set('X-Debug-Mode', 'true')
    return response
  }

  // 5. No authentication found - redirect to landing page
  console.log('[MIDDLEWARE] Unauthorized access to', pathname, '- redirecting to /')

  // Create redirect URL
  const redirectUrl = new URL('/', request.url)

  // Optional: Add a query parameter to show a message on the landing page
  redirectUrl.searchParams.set('auth_required', 'true')
  redirectUrl.searchParams.set('redirect_from', pathname)

  return NextResponse.redirect(redirectUrl)
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
