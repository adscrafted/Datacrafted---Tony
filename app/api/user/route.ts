import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { getUserByFirebaseUid, updateUser, deleteUser } from '@/lib/api/user-service'
import { validateRequest, updateUserSchema } from '@/lib/utils/api-validation'
import { userNotFound, databaseError } from '@/lib/utils/api-errors'
import { getAdminAuth } from '@/lib/config/firebase-admin'
import { stripe, isStripeConfigured } from '@/lib/config/stripe'
import { db } from '@/lib/db'

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
      return userNotFound()
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
    return databaseError('get user profile', error)
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
      return userNotFound()
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, updateUserSchema)
    if (!validation.success) {
      return validation.response
    }

    const { name, email, photoURL } = validation.data

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
    return databaseError('update user profile', error)
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

    // Get user from database with full data for cleanup
    const user = await db.user.findUnique({
      where: { firebaseUid: firebaseUser.uid },
      select: {
        id: true,
        stripeCustomerId: true,
        subscriptionId: true,
        sessions: {
          select: {
            uploadedFiles: {
              select: {
                filePath: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      console.log('[API] User not found in database:', firebaseUser.uid)
      return userNotFound()
    }

    // Step 1: Cancel Stripe subscription and delete customer if exists
    if (isStripeConfigured() && stripe) {
      // Cancel subscription first (before deleting customer)
      if (user.subscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.subscriptionId)
          console.log('[API] Stripe subscription canceled:', user.subscriptionId)
        } catch (stripeError: any) {
          // Log but don't fail - subscription may already be canceled
          console.error('[API] Warning: Failed to cancel Stripe subscription:', stripeError.message)
        }
      }

      // Then delete the customer
      if (user.stripeCustomerId) {
        try {
          await stripe.customers.del(user.stripeCustomerId)
          console.log('[API] Stripe customer deleted:', user.stripeCustomerId)
        } catch (stripeError: any) {
          // Log but don't fail - continue with deletion
          console.error('[API] Warning: Failed to delete Stripe customer:', stripeError.message)
        }
      }
    }

    // Step 2: Delete physical files from disk (before database cascade)
    const filePaths = user.sessions.flatMap(s => s.uploadedFiles.map(f => f.filePath))
    let filesDeleted = 0
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath)
        filesDeleted++
      } catch (err: any) {
        // File might not exist or already deleted, continue
        if (err.code !== 'ENOENT') {
          console.error('[API] Warning: Failed to delete file:', filePath, err.message)
        }
      }
    }
    if (filesDeleted > 0) {
      console.log('[API] Physical files deleted:', filesDeleted)
    }

    // Step 3: Delete user from database (cascades to sessions, projects, etc.)
    const success = await deleteUser(user.id)

    if (!success) {
      throw new Error('Failed to delete user from database')
    }

    console.log('[API] User database record deleted:', user.id)

    // Step 4: Delete Firebase Auth account
    try {
      const adminAuth = getAdminAuth()
      await adminAuth.deleteUser(firebaseUser.uid)
      console.log('[API] Firebase Auth account deleted:', firebaseUser.uid)
    } catch (firebaseError: any) {
      // Log but don't fail - database deletion already succeeded
      // User can manually delete Firebase account or it will be orphaned
      console.error('[API] Warning: Failed to delete Firebase Auth account:', firebaseError.message)
    }

    return NextResponse.json({
      success: true,
      message: 'User account deleted successfully',
    })
  } catch (error) {
    console.error('[API] Error deleting user account:', error)
    return databaseError('delete user account', error)
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.AUTH, deleteHandler)
