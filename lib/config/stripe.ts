/**
 * Stripe Configuration
 *
 * Centralized configuration for Stripe integration including:
 * - Stripe client initialization
 * - Plan limits and pricing
 * - Environment variable validation
 */

import Stripe from 'stripe'

// Validate required environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

if (!STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.error('[STRIPE] STRIPE_SECRET_KEY is not configured in production')
}

// Initialize Stripe client (only if key is available)
export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  : null

// Feature flag for paywall
export const PAYWALL_ENABLED = process.env.PAYWALL_ENABLED === 'true'

// Plan definitions with limits
export const PLAN_LIMITS = {
  free: {
    maxAnalyses: 3, // Lifetime limit
    maxChatMessages: 50, // Per month
    maxProjects: 3,
    maxRowsPerFile: 10000,
    maxFileSizeMB: 10,
  },
  pro: {
    maxAnalyses: Infinity,
    maxChatMessages: Infinity,
    maxProjects: Infinity,
    maxRowsPerFile: 1000000,
    maxFileSizeMB: 100,
  },
  enterprise: {
    maxAnalyses: Infinity,
    maxChatMessages: Infinity,
    maxProjects: Infinity,
    maxRowsPerFile: Infinity,
    maxFileSizeMB: Infinity,
  },
} as const

export type PlanTier = keyof typeof PLAN_LIMITS

// Stripe Price IDs (configured in Stripe Dashboard)
export const STRIPE_PRICES = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
  PRO_YEARLY: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
} as const

// Stripe Webhook Secret
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

// Public key for frontend
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

// Helper to check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY && !!stripe
}

// Helper to get plan limits
export function getPlanLimits(tier: PlanTier) {
  return PLAN_LIMITS[tier] || PLAN_LIMITS.free
}

// Development mode check
export const isDevelopment = process.env.NODE_ENV === 'development'

// Log configuration status in development
if (isDevelopment) {
  console.log('[STRIPE] Configuration status:', {
    stripeConfigured: isStripeConfigured(),
    paywallEnabled: PAYWALL_ENABLED,
    hasProMonthlyPrice: !!STRIPE_PRICES.PRO_MONTHLY,
    hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
  })
}
