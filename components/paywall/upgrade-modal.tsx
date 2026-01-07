'use client'

import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/contexts/auth-context'
import { useUIStore } from '@/lib/stores/ui-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Check, Sparkles, Zap, MessageSquare, BarChart3 } from 'lucide-react'

// Key for storing return URL in localStorage across page redirects
const PENDING_RETURN_URL_KEY = 'datacrafted_pending_return_url'

const PRO_FEATURES = [
  'Unlimited AI analyses',
  'Unlimited chat messages',
  'Up to 1M rows per file',
  'Priority support',
  'Advanced chart types',
  'Export without watermarks',
]

export function UpgradeModal() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const showPaywallModal = useUIStore((state) => state.showPaywallModal)
  const paywallType = useUIStore((state) => state.paywallType)
  const paywallUsageInfo = useUIStore((state) => state.paywallUsageInfo)
  const closePaywallModal = useUIStore((state) => state.closePaywallModal)

  const handleUpgrade = async () => {
    if (!user) {
      setError('Please sign in to upgrade')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Store the current URL so we can return after payment
      // Include query params to preserve any project/session context
      const currentUrl = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname

      // Save to localStorage (persists across redirects)
      localStorage.setItem(PENDING_RETURN_URL_KEY, currentUrl)
      console.log('[PAYWALL] Saved return URL:', currentUrl)

      const token = await user.getIdToken()
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnTo: currentUrl, // Also pass to backend for success URL
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start checkout')
      }

      // Redirect to Stripe checkout
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
    } finally {
      setLoading(false)
    }
  }

  // Calculate usage percentage
  const usagePercentage = paywallUsageInfo
    ? Math.min(100, (paywallUsageInfo.used / paywallUsageInfo.limit) * 100)
    : 100

  // Get icon and text based on paywall type
  const getTypeInfo = () => {
    if (paywallType === 'chat') {
      return {
        icon: MessageSquare,
        title: 'Chat Message Limit Reached',
        description: 'You\'ve used all your free chat messages this month.',
        usageLabel: 'Chat messages used',
      }
    }
    return {
      icon: BarChart3,
      title: 'Analysis Limit Reached',
      description: 'You\'ve used all your free AI analyses.',
      usageLabel: 'Analyses used',
    }
  }

  const typeInfo = getTypeInfo()
  const TypeIcon = typeInfo.icon

  return (
    <Dialog open={showPaywallModal} onOpenChange={(open) => !open && closePaywallModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            Unlock unlimited access to all features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Usage alert */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <TypeIcon className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-orange-900">{typeInfo.title}</h4>
                <p className="text-sm text-orange-700 mt-1">
                  {typeInfo.description}
                </p>
              </div>
            </div>

            {/* Usage bar */}
            {paywallUsageInfo && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-orange-700">{typeInfo.usageLabel}</span>
                  <span className="font-medium text-orange-900">
                    {paywallUsageInfo.used} / {paywallUsageInfo.limit}
                  </span>
                </div>
                <Progress value={usagePercentage} className="h-2 bg-orange-100" />
              </div>
            )}
          </div>

          {/* Pro features */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Pro includes:</h4>
            <div className="grid gap-2">
              {PRO_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Pricing and CTA */}
          <div className="pt-4 border-t">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-gray-900">$29</span>
              <span className="text-gray-600">/month</span>
              <Badge variant="secondary" className="ml-2">
                Save 20% yearly
              </Badge>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleUpgrade}
                disabled={loading}
                className="flex-1"
                size="lg"
              >
                {loading ? (
                  'Loading...'
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={closePaywallModal}
                disabled={loading}
              >
                Maybe Later
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">
              Cancel anytime. 7-day money-back guarantee.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
