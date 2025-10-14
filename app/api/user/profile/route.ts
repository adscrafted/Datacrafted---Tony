/**
 * User Profile API Route
 *
 * Example of a protected API route using authentication middleware.
 * This route demonstrates:
 * - Basic authentication with withAuth
 * - Rate limiting for security
 * - Accessing authenticated user data
 * - Proper error handling
 * - TypeScript type safety
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

/**
 * GET /api/user/profile
 *
 * Fetch the current user's profile information.
 * Requires authentication.
 * Rate limit: 10 requests per minute
 */
const getHandler = withAuth(async (request, user) => {
  try {
    // user is guaranteed to be authenticated here
    return Response.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
      },
    })
  } catch (error) {
    console.error('[USER PROFILE] Error fetching profile:', error)
    return Response.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.AUTH, getHandler)

/**
 * PATCH /api/user/profile
 *
 * Update the current user's profile information.
 * Requires authentication.
 * Rate limit: 10 requests per minute
 */
const patchHandler = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const { displayName, photoURL } = body

    // Validate input
    if (!displayName || typeof displayName !== 'string') {
      return Response.json(
        { error: 'Display name is required and must be a string' },
        { status: 400 }
      )
    }

    // TODO: Update user profile in your database
    // For now, just return the updated data
    return Response.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName,
        photoURL: photoURL || user.photoURL,
        emailVerified: user.emailVerified,
      },
    })
  } catch (error) {
    console.error('[USER PROFILE] Error updating profile:', error)
    return Response.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    )
  }
})

export const PATCH = withRateLimit(RATE_LIMITS.AUTH, patchHandler)
