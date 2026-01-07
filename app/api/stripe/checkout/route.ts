/**
 * Stripe Checkout API Route
 *
 * Creates a Stripe checkout session for subscription upgrades.
 *
 * POST /api/stripe/checkout
 * Body: { priceId?: string } (optional, defaults to Pro monthly)
 * Returns: { url: string } | { error: string }
 *
 * Rate limited: 10 requests per minute to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { createCheckoutSession } from '@/lib/services/subscription-service'
import { isStripeConfigured } from '@/lib/config/stripe'

const postHandler = withAuth(async (request: NextRequest, authUser) => {
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Payment system is not configured' },
      { status: 503 }
    )
  }

  try {
    // Parse request body
    let priceId: string | undefined
    let returnTo: string | undefined
    try {
      const body = await request.json()
      priceId = body.priceId
      returnTo = body.returnTo
    } catch {
      // No body or invalid JSON, use default price
    }

    // Create checkout session with optional return URL
    const result = await createCheckoutSession(authUser.uid, priceId, returnTo)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ url: result.url })
  } catch (error) {
    console.error('[STRIPE CHECKOUT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
})

export const POST = withRateLimit(RATE_LIMITS.AUTH, postHandler)
