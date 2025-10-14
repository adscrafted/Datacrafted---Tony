import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { getUserByFirebaseUid, updateUser, deleteUser } from '@/lib/api/user-service'

/**
 * GET /api/user
 * Get the authenticated user's profile from the database
 *
 * Rate limit: 10 requests per minute
 *
 * Request headers:
 * - Authorization: Bearer <firebase-token>
 *
 * Response:
 * - 200: User profile data
 * - 401: Unauthorized
 * - 404: User not found in database
 * - 429: Too Many Requests (rate limit exceeded)
 * - 500: Internal server error
 */
const getHandler = withAuth(async (request: NextRequest, firebaseUser) => {
  try {
    console.log('[API] Getting user profile:', firebaseUser.uid)

    const user = await getUserByFirebaseUid(firebaseUser.uid)

    if (!user) {
      console.log('[API] User not found in database:', firebaseUser.uid)
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    console.log('[API] User profile retrieved:', user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    })
  } catch (error) {
    console.error('[API] Error getting user profile:', error)
    return NextResponse.json(
      { error: 'Failed to get user profile' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.AUTH, getHandler)

/**
 * PATCH /api/user
 * Update the authenticated user's profile
 *
 * Rate limit: 10 requests per minute (prevents abuse)
 *
 * Request headers:
 * - Authorization: Bearer <firebase-token>
 *
 * Request body:
 * {
 *   "name"?: string,
 *   "email"?: string,
 *   "photoURL"?: string
 * }
 *
 * Response:
 * - 200: Updated user profile
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 404: User not found
 * - 429: Too Many Requests (rate limit exceeded)
 * - 500: Internal server error
 */
const patchHandler = withAuth(async (request: NextRequest, firebaseUser) => {
  try {
    console.log('[API] Updating user profile:', firebaseUser.uid)

    // Get user from database
    const existingUser = await getUserByFirebaseUid(firebaseUser.uid)

    if (!existingUser) {
      console.log('[API] User not found in database:', firebaseUser.uid)
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, email, photoURL } = body

    // Validate input
    if (!name && !email && !photoURL) {
      return NextResponse.json(
        { error: 'At least one field must be provided: name, email, or photoURL' },
        { status: 400 }
      )
    }

    // Update user
    const updatedUser = await updateUser(existingUser.id, {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(photoURL !== undefined && { photoURL }),
    })

    console.log('[API] User profile updated:', updatedUser.id)

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        firebaseUid: updatedUser.firebaseUid,
        email: updatedUser.email,
        name: updatedUser.name,
        photoURL: updatedUser.photoURL,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    })
  } catch (error) {
    console.error('[API] Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    )
  }
})

export const PATCH = withRateLimit(RATE_LIMITS.AUTH, patchHandler)

/**
 * DELETE /api/user
 * Delete the authenticated user's account and all associated data
 *
 * This is a destructive operation that:
 * - Deletes the user record from the database
 * - Cascades to delete all sessions, projects, etc.
 * - Does NOT delete the Firebase account (user must do this separately)
 *
 * Rate limit: 10 requests per minute (prevents abuse)
 *
 * Request headers:
 * - Authorization: Bearer <firebase-token>
 *
 * Response:
 * - 200: User deleted successfully
 * - 401: Unauthorized
 * - 404: User not found
 * - 429: Too Many Requests (rate limit exceeded)
 * - 500: Internal server error
 */
const deleteHandler = withAuth(async (request: NextRequest, firebaseUser) => {
  try {
    console.log('[API] Deleting user account:', firebaseUser.uid)

    // Get user from database
    const user = await getUserByFirebaseUid(firebaseUser.uid)

    if (!user) {
      console.log('[API] User not found in database:', firebaseUser.uid)
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Delete user (cascades to sessions, etc.)
    const success = await deleteUser(user.id)

    if (!success) {
      throw new Error('Failed to delete user')
    }

    console.log('[API] User account deleted:', user.id)

    return NextResponse.json({
      success: true,
      message: 'User account deleted successfully',
    })
  } catch (error) {
    console.error('[API] Error deleting user account:', error)
    return NextResponse.json(
      { error: 'Failed to delete user account' },
      { status: 500 }
    )
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.AUTH, deleteHandler)
