/**
 * Stripe Checkout API Route
 *
 * Creates a Stripe checkout session for subscription upgrades.
 *
 * POST /api/stripe/checkout
 * Body: { priceId?: string } (optional, defaults to Pro monthly)
 * Returns: { url: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { createCheckoutSession } from '@/lib/services/subscription-service'
import { isStripeConfigured } from '@/lib/config/stripe'

export const POST = withAuth(async (request: NextRequest, authUser) => {
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
    try {
      const body = await request.json()
      priceId = body.priceId
    } catch {
      // No body or invalid JSON, use default price
    }

    // Create checkout session
    const result = await createCheckoutSession(authUser.uid, priceId)

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
