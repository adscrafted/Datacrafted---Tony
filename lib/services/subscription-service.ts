/**
 * Subscription Service
 *
 * Handles all subscription and usage-related business logic:
 * - Analysis limit checking (3 lifetime for free users)
 * - Chat message limit checking (50/month for free users)
 * - Stripe customer and subscription management
 * - Usage tracking and incrementing
 */

import { db } from '@/lib/db'
import {
  stripe,
  PLAN_LIMITS,
  PAYWALL_ENABLED,
  STRIPE_PRICES,
  isStripeConfigured,
  type PlanTier,
} from '@/lib/config/stripe'

// Types
export interface UsageCheckResult {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  plan: PlanTier
  message?: string
}

export interface UserUsage {
  plan: PlanTier
  subscriptionStatus: string | null
  subscriptionEndDate: Date | null
  analyses: {
    used: number
    limit: number
    remaining: number
  }
  chat: {
    used: number
    limit: number
    remaining: number
    resetsAt: Date | null
  }
}

/**
 * Get database user by Firebase UID
 */
async function getDbUser(firebaseUid: string) {
  return db.user.findUnique({
    where: { firebaseUid },
  })
}

/**
 * Check if user can perform an analysis
 * Free users: 3 lifetime analyses
 * Pro/Enterprise: Unlimited
 */
export async function canPerformAnalysis(firebaseUid: string): Promise<UsageCheckResult> {
  // If paywall is disabled, always allow
  if (!PAYWALL_ENABLED) {
    return {
      allowed: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      plan: 'free',
    }
  }

  const user = await getDbUser(firebaseUid)

  if (!user) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      plan: 'free',
      message: 'User not found. Please sign in.',
    }
  }

  const plan = (user.subscriptionTier as PlanTier) || 'free'
  const limits = PLAN_LIMITS[plan]
  const used = user.analysisCount

  // Pro and Enterprise have unlimited analyses
  if (plan !== 'free') {
    return {
      allowed: true,
      used,
      limit: Infinity,
      remaining: Infinity,
      plan,
    }
  }

  // Free users: check lifetime limit
  const allowed = used < limits.maxAnalyses
  const remaining = Math.max(0, limits.maxAnalyses - used)

  return {
    allowed,
    used,
    limit: limits.maxAnalyses,
    remaining,
    plan,
    message: allowed
      ? undefined
      : `You've used all ${limits.maxAnalyses} free analyses. Upgrade to Pro for unlimited analyses.`,
  }
}

/**
 * Increment analysis count after successful analysis
 */
export async function incrementAnalysisCount(firebaseUid: string): Promise<number> {
  const user = await db.user.update({
    where: { firebaseUid },
    data: { analysisCount: { increment: 1 } },
  })
  return user.analysisCount
}

/**
 * Reset chat count if a new month has started
 */
export async function resetChatCountIfNeeded(firebaseUid: string): Promise<void> {
  const user = await getDbUser(firebaseUid)
  if (!user) return

  const now = new Date()
  const resetDate = user.chatCountResetDate

  // If no reset date set, or if we're in a new month, reset the count
  if (!resetDate || isNewMonth(resetDate, now)) {
    await db.user.update({
      where: { firebaseUid },
      data: {
        chatMessageCount: 0,
        chatCountResetDate: now,
      },
    })
  }
}

/**
 * Check if two dates are in different months
 */
function isNewMonth(oldDate: Date, newDate: Date): boolean {
  return (
    oldDate.getMonth() !== newDate.getMonth() ||
    oldDate.getFullYear() !== newDate.getFullYear()
  )
}

/**
 * Check if user can send a chat message
 * Free users: 50 messages per month
 * Pro/Enterprise: Unlimited
 */
export async function canSendChatMessage(firebaseUid: string): Promise<UsageCheckResult> {
  // If paywall is disabled, always allow
  if (!PAYWALL_ENABLED) {
    return {
      allowed: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      plan: 'free',
    }
  }

  // First reset count if needed
  await resetChatCountIfNeeded(firebaseUid)

  const user = await getDbUser(firebaseUid)

  if (!user) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      plan: 'free',
      message: 'User not found. Please sign in.',
    }
  }

  const plan = (user.subscriptionTier as PlanTier) || 'free'
  const limits = PLAN_LIMITS[plan]
  const used = user.chatMessageCount

  // Pro and Enterprise have unlimited chat
  if (plan !== 'free') {
    return {
      allowed: true,
      used,
      limit: Infinity,
      remaining: Infinity,
      plan,
    }
  }

  // Free users: check monthly limit
  const allowed = used < limits.maxChatMessages
  const remaining = Math.max(0, limits.maxChatMessages - used)

  return {
    allowed,
    used,
    limit: limits.maxChatMessages,
    remaining,
    plan,
    message: allowed
      ? undefined
      : `You've used all ${limits.maxChatMessages} free chat messages this month. Upgrade to Pro for unlimited chat.`,
  }
}

/**
 * Increment chat message count
 */
export async function incrementChatCount(firebaseUid: string): Promise<number> {
  const user = await db.user.update({
    where: { firebaseUid },
    data: { chatMessageCount: { increment: 1 } },
  })
  return user.chatMessageCount
}

/**
 * Get complete usage stats for a user
 */
export async function getUserUsage(firebaseUid: string): Promise<UserUsage | null> {
  const user = await getDbUser(firebaseUid)

  if (!user) return null

  const plan = (user.subscriptionTier as PlanTier) || 'free'
  const limits = PLAN_LIMITS[plan]

  // Calculate next reset date (first day of next month)
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    plan,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionEndDate: user.subscriptionEndDate,
    analyses: {
      used: user.analysisCount,
      limit: limits.maxAnalyses,
      remaining:
        limits.maxAnalyses === Infinity
          ? Infinity
          : Math.max(0, limits.maxAnalyses - user.analysisCount),
    },
    chat: {
      used: user.chatMessageCount,
      limit: limits.maxChatMessages,
      remaining:
        limits.maxChatMessages === Infinity
          ? Infinity
          : Math.max(0, limits.maxChatMessages - user.chatMessageCount),
      resetsAt: plan === 'free' ? nextMonth : null,
    },
  }
}

/**
 * Create or get Stripe customer for user
 */
export async function getOrCreateStripeCustomer(firebaseUid: string): Promise<string | null> {
  if (!isStripeConfigured() || !stripe) {
    console.error('[SUBSCRIPTION] Stripe is not configured')
    return null
  }

  const user = await getDbUser(firebaseUid)
  if (!user) return null

  // Return existing customer ID if available
  if (user.stripeCustomerId) {
    return user.stripeCustomerId
  }

  // Create new Stripe customer
  try {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.name || undefined,
      metadata: {
        firebaseUid,
        userId: user.id,
      },
    })

    // Save customer ID to database
    await db.user.update({
      where: { firebaseUid },
      data: { stripeCustomerId: customer.id },
    })

    return customer.id
  } catch (error) {
    console.error('[SUBSCRIPTION] Failed to create Stripe customer:', error)
    return null
  }
}

/**
 * Create Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  firebaseUid: string,
  priceId?: string
): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured() || !stripe) {
    return { error: 'Payment system is not configured' }
  }

  const customerId = await getOrCreateStripeCustomer(firebaseUid)
  if (!customerId) {
    return { error: 'Failed to create customer' }
  }

  const user = await getDbUser(firebaseUid)
  if (!user) {
    return { error: 'User not found' }
  }

  // Use provided price ID or default to monthly
  const selectedPriceId = priceId || STRIPE_PRICES.PRO_MONTHLY
  if (!selectedPriceId) {
    return { error: 'Price ID is not configured' }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account/billing?canceled=true`,
      metadata: {
        firebaseUid,
        userId: user.id,
      },
      subscription_data: {
        metadata: {
          firebaseUid,
          userId: user.id,
        },
      },
    })

    return { url: session.url! }
  } catch (error) {
    console.error('[SUBSCRIPTION] Failed to create checkout session:', error)
    return { error: 'Failed to create checkout session' }
  }
}

/**
 * Create Stripe customer portal session
 */
export async function createPortalSession(
  firebaseUid: string
): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured() || !stripe) {
    return { error: 'Payment system is not configured' }
  }

  const user = await getDbUser(firebaseUid)
  if (!user?.stripeCustomerId) {
    return { error: 'No subscription found' }
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account/billing`,
    })

    return { url: session.url }
  } catch (error) {
    console.error('[SUBSCRIPTION] Failed to create portal session:', error)
    return { error: 'Failed to create portal session' }
  }
}

/**
 * Update subscription status from Stripe webhook
 */
export async function updateSubscriptionStatus(
  stripeCustomerId: string,
  status: string,
  subscriptionId?: string,
  currentPeriodEnd?: Date
): Promise<void> {
  // Map Stripe status to our status
  const mappedStatus = mapStripeStatus(status)

  // Determine plan tier based on status
  const planTier = mappedStatus === 'active' ? 'pro' : 'free'

  await db.user.update({
    where: { stripeCustomerId },
    data: {
      subscriptionStatus: mappedStatus,
      subscriptionTier: planTier,
      subscriptionId: subscriptionId || undefined,
      subscriptionEndDate: currentPeriodEnd || undefined,
    },
  })
}

/**
 * Map Stripe subscription status to our status
 */
function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return stripeStatus
  }
}

/**
 * Cancel subscription and downgrade to free
 */
export async function cancelSubscription(firebaseUid: string): Promise<{ success: boolean; error?: string }> {
  if (!isStripeConfigured() || !stripe) {
    return { success: false, error: 'Payment system is not configured' }
  }

  const user = await getDbUser(firebaseUid)
  if (!user?.subscriptionId) {
    return { success: false, error: 'No active subscription found' }
  }

  try {
    // Cancel at period end (user keeps access until then)
    await stripe.subscriptions.update(user.subscriptionId, {
      cancel_at_period_end: true,
    })

    return { success: true }
  } catch (error) {
    console.error('[SUBSCRIPTION] Failed to cancel subscription:', error)
    return { success: false, error: 'Failed to cancel subscription' }
  }
}
