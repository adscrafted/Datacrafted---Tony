/**
 * User Usage API Route
 *
 * Returns the current user's usage statistics and subscription status.
 *
 * GET /api/user/usage
 * Returns: {
 *   plan: string,
 *   subscriptionStatus: string | null,
 *   subscriptionEndDate: string | null,
 *   analyses: { used: number, limit: number, remaining: number },
 *   chat: { used: number, limit: number, remaining: number, resetsAt: string | null }
 * }
 *
 * Rate limited: 30 requests per minute (allows polling but prevents abuse)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { getUserUsage } from '@/lib/services/subscription-service'

const getHandler = withAuth(async (request: NextRequest, authUser) => {
  try {
    const usage = await getUserUsage(authUser.uid)

    if (!usage) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Convert Infinity to -1 for JSON serialization (frontend interprets -1 as unlimited)
    const response = {
      plan: usage.plan,
      subscriptionStatus: usage.subscriptionStatus,
      subscriptionEndDate: usage.subscriptionEndDate?.toISOString() || null,
      analyses: {
        used: usage.analyses.used,
        limit: usage.analyses.limit === Infinity ? -1 : usage.analyses.limit,
        remaining: usage.analyses.remaining === Infinity ? -1 : usage.analyses.remaining,
      },
      chat: {
        used: usage.chat.used,
        limit: usage.chat.limit === Infinity ? -1 : usage.chat.limit,
        remaining: usage.chat.remaining === Infinity ? -1 : usage.chat.remaining,
        resetsAt: usage.chat.resetsAt?.toISOString() || null,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[USER USAGE] Error fetching usage:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)
