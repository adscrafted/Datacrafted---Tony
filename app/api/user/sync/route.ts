import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { syncUser } from '@/lib/api/user-service'

/**
 * POST /api/user/sync
 * Synchronize Firebase user with Postgres database
 *
 * This endpoint is called automatically after Firebase authentication
 * to create or update the user record in the database
 *
 * Rate limit: 10 requests per minute (prevents brute force attacks)
 *
 * Request headers:
 * - Authorization: Bearer <firebase-token>
 *
 * Response:
 * - 200: User synced successfully
 * - 401: Unauthorized (no valid Firebase token)
 * - 429: Too Many Requests (rate limit exceeded)
 * - 500: Internal server error
 */
const handler = withAuth(async (request: NextRequest, firebaseUser) => {
  try {
    console.log('[API] Syncing user:', firebaseUser.uid)

    // Sync Firebase user to database
    const user = await syncUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
    })

    console.log('[API] User synced successfully:', user.id)

    return NextResponse.json({
      success: true,
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
  } catch (error: any) {
    console.error('[API] Error syncing user:', error)

    // Determine appropriate error message and status code
    let statusCode = 500
    let errorMessage = 'Failed to sync user to database'
    let errorDetails: string | undefined

    if (error.message?.includes('timed out')) {
      statusCode = 504 // Gateway Timeout
      errorMessage = 'Database operation timed out'
      errorDetails = 'The database took too long to respond. Please try again.'
    } else if (error.message?.includes('connection') || error.message?.includes('connect')) {
      statusCode = 503 // Service Unavailable
      errorMessage = 'Database temporarily unavailable'
      errorDetails = 'Unable to connect to the database. Please try again in a moment.'
    } else if (error.code === 'P2002') {
      statusCode = 409 // Conflict
      errorMessage = 'User data conflict'
      errorDetails = 'A user with this data already exists.'
    } else if (error.code?.startsWith('P')) {
      // Prisma error codes
      errorMessage = 'Database operation failed'
      errorDetails = 'A database constraint or validation error occurred.'
    }

    // Log detailed error for debugging (server-side only)
    if (process.env.NODE_ENV !== 'production') {
      console.error('[API] Detailed error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(errorDetails && { details: errorDetails }),
        // Include error code in development for debugging
        ...(process.env.NODE_ENV !== 'production' && {
          errorCode: error.code,
          errorType: error.constructor.name
        }),
      },
      { status: statusCode }
    )
  }
})

// Apply rate limiting to prevent brute force attacks
export const POST = withRateLimit(RATE_LIMITS.AUTH, handler)
