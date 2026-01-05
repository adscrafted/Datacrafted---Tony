/**
 * Stripe Customer Portal API Route
 *
 * Creates a Stripe customer portal session for subscription management.
 * Users can manage their payment methods, view invoices, and cancel subscriptions.
 *
 * POST /api/stripe/portal
 * Returns: { url: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { createPortalSession } from '@/lib/services/subscription-service'
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
    // Create portal session
    const result = await createPortalSession(authUser.uid)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ url: result.url })
  } catch (error) {
    console.error('[STRIPE PORTAL] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
})
