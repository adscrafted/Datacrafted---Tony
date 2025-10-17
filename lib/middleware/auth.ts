/**
 * Authentication Middleware for Next.js API Routes
 *
 * This module provides middleware functions and Higher-Order Functions (HOF)
 * to protect API routes with Firebase authentication.
 *
 * @example Basic usage with withAuth
 * ```typescript
 * import { withAuth } from '@/lib/middleware/auth'
 *
 * export const GET = withAuth(async (request, user) => {
 *   // user is guaranteed to be authenticated
 *   return Response.json({ userId: user.uid })
 * })
 * ```
 *
 * @example With custom error handling
 * ```typescript
 * import { withAuth } from '@/lib/middleware/auth'
 *
 * export const POST = withAuth(
 *   async (request, user) => {
 *     const data = await request.json()
 *     // Process authenticated request
 *     return Response.json({ success: true })
 *   },
 *   {
 *     onError: (error) => {
 *       // Custom error handling
 *       return Response.json({ error: error.message }, { status: error.statusCode })
 *     }
 *   }
 * )
 * ```
 *
 * @example With required claims (role-based access)
 * ```typescript
 * import { withAuth } from '@/lib/middleware/auth'
 *
 * export const DELETE = withAuth(
 *   async (request, user) => {
 *     // Only admins can access this route
 *     return Response.json({ success: true })
 *   },
 *   {
 *     requiredClaims: { role: 'admin' }
 *   }
 * )
 * ```
 */

import { NextRequest } from 'next/server'
import {
  requireAuth,
  verifyCustomClaims,
  createAuthErrorResponse,
  createUnauthorizedResponse,
} from '@/lib/auth/server'
import {
  AuthUser,
  AuthError,
  AuthMiddlewareConfig,
  AuthenticatedRouteHandler,
} from '@/lib/types/auth'
import { DEBUG_MODE } from '@/lib/config/firebase-admin'

/**
 * Higher-Order Function that wraps an API route handler with authentication
 *
 * This is the primary way to protect API routes. It:
 * 1. Extracts and verifies the Firebase ID token from the Authorization header
 * 2. Passes the authenticated user to your route handler
 * 3. Handles errors gracefully with appropriate HTTP status codes
 * 4. Supports debug mode for development
 *
 * @param handler - The authenticated route handler function
 * @param config - Optional configuration for the middleware
 * @returns A Next.js route handler with authentication
 *
 * @example
 * ```typescript
 * // In app/api/users/route.ts
 * import { withAuth } from '@/lib/middleware/auth'
 *
 * export const GET = withAuth(async (request, user) => {
 *   return Response.json({ userId: user.uid, email: user.email })
 * })
 * ```
 */
export function withAuth<P = any>(
  handler: AuthenticatedRouteHandler<P>,
  config: AuthMiddlewareConfig = {}
): (request: NextRequest, context: { params: Promise<P> }) => Promise<Response> {
  return async (request: NextRequest, context: { params: Promise<P> }) => {
    try {
      // Authenticate the request
      const user = await requireAuth(request)

      // Verify custom claims if required
      if (config.requiredClaims) {
        verifyCustomClaims(user, config.requiredClaims)
      }

      // Log authentication in debug mode
      if (DEBUG_MODE) {
        // SECURITY: Additional production check in middleware
        const isProduction =
          process.env.NODE_ENV === 'production' ||
          process.env.VERCEL_ENV === 'production' ||
          process.env.RAILWAY_ENVIRONMENT === 'production'

        if (isProduction) {
          console.error(
            '🚨 [SECURITY] CRITICAL: DEBUG_MODE active in production - this should never happen'
          )
        }

        console.log('✅ [AUTH MIDDLEWARE] Authenticated user (debug mode):', {
          uid: user.uid,
          email: user.email,
        })
      }

      // Call the wrapped handler with authenticated user
      return await handler(request, user, context)
    } catch (error) {
      // Handle authentication errors
      if (error instanceof AuthError) {
        // Use custom error handler if provided
        if (config.onError) {
          return config.onError(error)
        }

        // Default error handling
        console.error('❌ [AUTH MIDDLEWARE] Authentication failed:', {
          code: error.code,
          message: error.message,
        })
        return createAuthErrorResponse(error)
      }

      // Handle unexpected errors
      console.error('❌ [AUTH MIDDLEWARE] Unexpected error:', error)
      return Response.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware function that can be used in route handlers
 * This is an alternative to withAuth for more manual control
 *
 * @param request - Next.js request object
 * @param config - Optional configuration
 * @returns AuthUser object if authentication succeeds
 * @throws AuthError if authentication fails
 *
 * @example
 * ```typescript
 * import { authenticate } from '@/lib/middleware/auth'
 *
 * export async function POST(request: NextRequest) {
 *   const user = await authenticate(request)
 *   const body = await request.json()
 *   // Process request with authenticated user
 *   return Response.json({ success: true })
 * }
 * ```
 */
export async function authenticate(
  request: NextRequest,
  config: AuthMiddlewareConfig = {}
): Promise<AuthUser> {
  const user = await requireAuth(request)

  // Verify custom claims if required
  if (config.requiredClaims) {
    verifyCustomClaims(user, config.requiredClaims)
  }

  return user
}

/**
 * Create an authenticated API route with TypeScript inference for params
 * Useful for dynamic routes with params
 *
 * @example
 * ```typescript
 * // In app/api/projects/[id]/route.ts
 * import { createAuthRoute } from '@/lib/middleware/auth'
 *
 * interface Params {
 *   id: string
 * }
 *
 * export const GET = createAuthRoute<Params>(async (request, user, context) => {
 *   const { id } = await context.params
 *   return Response.json({ projectId: id, userId: user.uid })
 * })
 * ```
 */
export function createAuthRoute<P = {}>(
  handler: AuthenticatedRouteHandler<P>,
  config: AuthMiddlewareConfig = {}
) {
  return withAuth<P>(handler, config)
}

/**
 * Utility to check if a request is authenticated without throwing
 * Returns user if authenticated, null otherwise
 *
 * @param request - Next.js request object
 * @returns AuthUser or null
 *
 * @example
 * ```typescript
 * import { isAuthenticated } from '@/lib/middleware/auth'
 *
 * export async function GET(request: NextRequest) {
 *   const user = await isAuthenticated(request)
 *   if (user) {
 *     // Return personalized content
 *     return Response.json({ message: `Hello ${user.displayName}` })
 *   } else {
 *     // Return public content
 *     return Response.json({ message: 'Hello Guest' })
 *   }
 * }
 * ```
 */
export async function isAuthenticated(
  request: NextRequest
): Promise<AuthUser | null> {
  try {
    return await requireAuth(request)
  } catch (error) {
    return null
  }
}

/**
 * Middleware to require specific role or permission
 *
 * @param role - Required role or permission
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { withAuth, requireRole } from '@/lib/middleware/auth'
 *
 * export const DELETE = withAuth(
 *   async (request, user) => {
 *     // Only admins can delete
 *     return Response.json({ success: true })
 *   },
 *   {
 *     requiredClaims: { role: 'admin' }
 *   }
 * )
 * ```
 */
export function requireRole(role: string) {
  return (config: AuthMiddlewareConfig = {}): AuthMiddlewareConfig => ({
    ...config,
    requiredClaims: {
      ...config.requiredClaims,
      role,
    },
  })
}

/**
 * Combine multiple middleware configurations
 *
 * @param configs - Array of middleware configurations
 * @returns Combined configuration
 */
export function combineMiddleware(
  ...configs: AuthMiddlewareConfig[]
): AuthMiddlewareConfig {
  return configs.reduce(
    (acc, config) => ({
      ...acc,
      ...config,
      requiredClaims: {
        ...acc.requiredClaims,
        ...config.requiredClaims,
      },
    }),
    {} as AuthMiddlewareConfig
  )
}

/**
 * Export auth utilities for convenience
 */
export {
  createAuthErrorResponse,
  createUnauthorizedResponse,
} from '@/lib/auth/server'
export { AuthError, AuthErrorCode } from '@/lib/types/auth'
export type { AuthUser, AuthMiddlewareConfig } from '@/lib/types/auth'
