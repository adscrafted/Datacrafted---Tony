/**
 * Server-Side Authentication Utilities
 *
 * This module provides server-side authentication utilities for verifying
 * Firebase ID tokens and extracting user information. Use these functions
 * in API routes and server components.
 *
 * IMPORTANT: Only import this file in server-side code.
 */

import { NextRequest } from 'next/server'
import { getAdminAuth, DEBUG_MODE, DEBUG_USER } from '@/lib/config/firebase-admin'
import { AuthError, AuthErrorCode, type AuthUser, type TokenPayload } from '@/lib/types/auth'

/**
 * Extract Bearer token from Authorization header
 *
 * @param request - Next.js request object
 * @returns Token string or null if not found
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return null
  }

  // Check for Bearer token format
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  return parts[1]
}

/**
 * Verify Firebase ID token and return the decoded token
 *
 * @param token - Firebase ID token from client
 * @returns Decoded token payload
 * @throws AuthError if token is invalid or expired
 */
export async function verifyIdToken(token: string): Promise<TokenPayload> {
  try {
    // SECURITY: Secondary production check for debug mode
    // This provides defense-in-depth in case the primary check is bypassed
    if (DEBUG_MODE) {
      const isProduction =
        process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production' ||
        process.env.RAILWAY_ENVIRONMENT === 'production'

      if (isProduction) {
        console.error(
          '🚨 [SECURITY] CRITICAL: DEBUG_MODE detected in production environment during token verification'
        )
        throw new AuthError(
          AuthErrorCode.INVALID_TOKEN,
          'Authentication configuration error. Please contact support.',
          500
        )
      }

      console.warn(
        '⚠️  [AUTH] Debug mode active - bypassing token verification\n' +
        '   This should ONLY happen in local development'
      )
      return {
        uid: DEBUG_USER.uid,
        email: DEBUG_USER.email,
        email_verified: DEBUG_USER.emailVerified,
        name: DEBUG_USER.displayName ?? undefined,
        picture: DEBUG_USER.photoURL ?? undefined,
        phone_number: DEBUG_USER.phoneNumber ?? undefined,
      }
    }

    // Verify the token using Firebase Admin SDK
    const auth = getAdminAuth()
    const decodedToken = await auth.verifyIdToken(token, true) // checkRevoked = true

    return decodedToken as TokenPayload
  } catch (error: any) {
    console.error('❌ [AUTH] Token verification failed:', error)

    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      throw new AuthError(
        AuthErrorCode.EXPIRED_TOKEN,
        'Authentication token has expired. Please sign in again.',
        401
      )
    }

    if (error.code === 'auth/id-token-revoked') {
      throw new AuthError(
        AuthErrorCode.INVALID_TOKEN,
        'Authentication token has been revoked. Please sign in again.',
        401
      )
    }

    if (error.code === 'auth/argument-error') {
      throw new AuthError(
        AuthErrorCode.INVALID_TOKEN,
        'Invalid authentication token format.',
        401
      )
    }

    // Generic invalid token error
    throw new AuthError(
      AuthErrorCode.INVALID_TOKEN,
      'Invalid authentication token.',
      401
    )
  }
}

/**
 * Extract user information from verified token
 *
 * @param token - Firebase ID token from client
 * @returns AuthUser object with user information
 * @throws AuthError if token is invalid
 */
export async function getUserFromToken(token: string): Promise<AuthUser> {
  const decodedToken = await verifyIdToken(token)

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || null,
    displayName: decodedToken.name || null,
    photoURL: decodedToken.picture || null,
    emailVerified: decodedToken.email_verified || false,
    phoneNumber: decodedToken.phone_number || null,
    customClaims: decodedToken,
  }
}

/**
 * Require authentication for a request
 * Extracts token from Authorization header and verifies it
 *
 * @param request - Next.js request object
 * @returns AuthUser object with authenticated user information
 * @throws AuthError if authentication fails
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const user = await requireAuth(request)
 *   // user is now authenticated
 *   return Response.json({ userId: user.uid })
 * }
 * ```
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  // Extract token from Authorization header
  const token = extractToken(request)

  if (!token) {
    throw new AuthError(
      AuthErrorCode.NO_TOKEN,
      'Authentication required. Please provide a valid token in the Authorization header.',
      401
    )
  }

  // Verify token and get user information
  const user = await getUserFromToken(token)

  return user
}

/**
 * Verify user has required custom claims
 *
 * @param user - Authenticated user
 * @param requiredClaims - Map of claim names to expected values
 * @throws AuthError if user doesn't have required claims
 *
 * @example
 * ```typescript
 * const user = await requireAuth(request)
 * verifyCustomClaims(user, { role: 'admin' })
 * ```
 */
export function verifyCustomClaims(
  user: AuthUser,
  requiredClaims: Record<string, any>
): void {
  if (!user.customClaims) {
    throw new AuthError(
      AuthErrorCode.UNAUTHORIZED,
      'User does not have required permissions.',
      403
    )
  }

  for (const [key, value] of Object.entries(requiredClaims)) {
    if (user.customClaims[key] !== value) {
      throw new AuthError(
        AuthErrorCode.UNAUTHORIZED,
        `User does not have required permission: ${key}`,
        403
      )
    }
  }
}

/**
 * Get optional authentication from request
 * Returns user if authenticated, null otherwise
 * Does not throw errors
 *
 * @param request - Next.js request object
 * @returns AuthUser object or null
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const user = await getOptionalAuth(request)
 *   if (user) {
 *     // User is authenticated
 *   } else {
 *     // User is not authenticated
 *   }
 * }
 * ```
 */
export async function getOptionalAuth(
  request: NextRequest
): Promise<AuthUser | null> {
  try {
    return await requireAuth(request)
  } catch (error) {
    // Return null if authentication fails
    return null
  }
}

/**
 * Create an error response from AuthError
 *
 * @param error - AuthError object
 * @returns Response object with error details
 */
export function createAuthErrorResponse(error: AuthError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status: error.statusCode }
  )
}

/**
 * Create a generic unauthorized response
 *
 * @param message - Optional custom message
 * @returns Response object with 401 status
 */
export function createUnauthorizedResponse(
  message: string = 'Unauthorized'
): Response {
  return Response.json(
    {
      error: {
        code: AuthErrorCode.UNAUTHORIZED,
        message,
      },
    },
    { status: 401 }
  )
}
