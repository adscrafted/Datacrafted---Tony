/**
 * Stripe Webhook API Route
 *
 * Handles incoming webhook events from Stripe.
 * IMPORTANT: This route does NOT use auth middleware - it verifies
 * the webhook signature from Stripe instead.
 *
 * POST /api/stripe/webhook
 * Headers: stripe-signature (required)
 *
 * Handled events:
 * - checkout.session.completed: Activate subscription
 * - customer.subscription.updated: Update subscription status
 * - customer.subscription.deleted: Downgrade to free
 * - invoice.payment_failed: Mark as past_due
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_WEBHOOK_SECRET, isStripeConfigured } from '@/lib/config/stripe'
import { updateSubscriptionStatus } from '@/lib/services/subscription-service'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured() || !stripe) {
    console.error('[STRIPE WEBHOOK] Stripe is not configured')
    return NextResponse.json(
      { error: 'Webhook handler not configured' },
      { status: 503 }
    )
  }

  // Get the raw body
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('[STRIPE WEBHOOK] Missing stripe-signature header')
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[STRIPE WEBHOOK] Webhook secret not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 503 }
    )
  }

  // Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const error = err as Error
    console.error('[STRIPE WEBHOOK] Signature verification failed:', error.message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    )
  }

  console.log(`[STRIPE WEBHOOK] Received event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error processing event:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Safely convert a Unix timestamp to a Date object
 * Returns undefined if the timestamp is invalid
 */
function safeUnixToDate(timestamp: number | undefined | null): Date | undefined {
  if (timestamp === undefined || timestamp === null || isNaN(timestamp)) {
    return undefined
  }
  const date = new Date(timestamp * 1000)
  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return undefined
  }
  return date
}

/**
 * Handle checkout.session.completed
 * Activates the subscription after successful payment
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[STRIPE WEBHOOK] Processing checkout.session.completed')

  if (!session.customer || !session.subscription) {
    console.error('[STRIPE WEBHOOK] Missing customer or subscription in session')
    return
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer.id

  // Get subscription details
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id

  const subscription = await stripe!.subscriptions.retrieve(subscriptionId)

  // Access current_period_end with type assertion since Stripe types can be inconsistent
  const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end
  const periodEndDate = safeUnixToDate(periodEnd)

  await updateSubscriptionStatus(
    customerId,
    subscription.status,
    subscription.id,
    periodEndDate
  )

  console.log(`[STRIPE WEBHOOK] Subscription activated for customer ${customerId}`)
}

/**
 * Handle customer.subscription.updated
 * Updates subscription status (active, past_due, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[STRIPE WEBHOOK] Processing customer.subscription.updated')

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  // Access current_period_end with type assertion since Stripe types can be inconsistent
  const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end
  const periodEndDate = safeUnixToDate(periodEnd)

  await updateSubscriptionStatus(
    customerId,
    subscription.status,
    subscription.id,
    periodEndDate
  )

  console.log(
    `[STRIPE WEBHOOK] Subscription updated for customer ${customerId}: ${subscription.status}`
  )
}

/**
 * Handle customer.subscription.deleted
 * Downgrades user to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[STRIPE WEBHOOK] Processing customer.subscription.deleted')

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  await updateSubscriptionStatus(customerId, 'canceled', undefined, undefined)

  console.log(`[STRIPE WEBHOOK] Subscription canceled for customer ${customerId}`)
}

/**
 * Handle invoice.payment_failed
 * Marks subscription as past_due
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[STRIPE WEBHOOK] Processing invoice.payment_failed')

  // Access subscription with type assertion since it may be string | Subscription | null
  const invoiceSubscription = (invoice as unknown as { subscription: string | null }).subscription

  if (!invoice.customer || !invoiceSubscription) {
    console.log('[STRIPE WEBHOOK] Invoice has no subscription, skipping')
    return
  }

  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id

  await updateSubscriptionStatus(customerId, 'past_due')

  console.log(`[STRIPE WEBHOOK] Marked subscription as past_due for customer ${customerId}`)
}

/**
 * Handle invoice.payment_succeeded
 * Ensures subscription is active after successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[STRIPE WEBHOOK] Processing invoice.payment_succeeded')

  // Access subscription with type assertion since it may be string | Subscription | null
  const invoiceSubscription = (invoice as unknown as { subscription: string | { id: string } | null }).subscription

  if (!invoice.customer || !invoiceSubscription) {
    console.log('[STRIPE WEBHOOK] Invoice has no subscription, skipping')
    return
  }

  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id

  // Get subscription to get the period end date
  const subscriptionId = typeof invoiceSubscription === 'string'
    ? invoiceSubscription
    : invoiceSubscription.id

  const subscription = await stripe!.subscriptions.retrieve(subscriptionId)

  // Access current_period_end with type assertion
  const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end
  const periodEndDate = safeUnixToDate(periodEnd)

  await updateSubscriptionStatus(
    customerId,
    'active',
    subscription.id,
    periodEndDate
  )

  console.log(`[STRIPE WEBHOOK] Payment succeeded for customer ${customerId}`)
}
