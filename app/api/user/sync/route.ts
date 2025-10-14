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
  } catch (error) {
    console.error('[API] Error syncing user:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync user to database',
      },
      { status: 500 }
    )
  }
})

// Apply rate limiting to prevent brute force attacks
export const POST = withRateLimit(RATE_LIMITS.AUTH, handler)
