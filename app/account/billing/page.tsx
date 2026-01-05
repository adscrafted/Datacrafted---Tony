'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Check, CreditCard, Zap, Building, Crown, Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface UsageData {
  analyses: { used: number; limit: number; remaining: number }
  chatMessages: { used: number; limit: number; remaining: number }
  subscription: {
    tier: string
    status: string | null
    endDate: string | null
    stripeCustomerId: string | null
  }
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out DataCrafted',
    price: '$0',
    priceMonthly: 0,
    features: [
      '3 AI analyses (lifetime)',
      '50 chat messages/month',
      '3 projects',
      '10MB per file',
      '10,000 rows per dataset',
      'Basic chart types',
    ],
    limitations: [
      'Limited AI analyses',
      'Limited chat messages',
    ],
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals and power users',
    price: '$29',
    priceMonthly: 29,
    features: [
      'Unlimited AI analyses',
      'Unlimited chat messages',
      'Unlimited projects',
      '100MB per file',
      '1M rows per dataset',
      'Advanced analytics & AI',
      'Priority support',
      'Export without watermarks',
    ],
    limitations: [],
    icon: Crown,
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large teams and organizations',
    price: 'Custom',
    priceMonthly: null,
    features: [
      'Everything in Pro',
      'Unlimited file size',
      'Unlimited rows',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'On-premise option',
      'Custom branding'
    ],
    limitations: [],
    icon: Building
  }
]

export default function BillingPage() {
  const { user, isDebugMode } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState('pro')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch usage data
  useEffect(() => {
    const fetchUsage = async () => {
      if (!user) return

      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/user/usage', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch usage data')
        }

        const data = await response.json()
        setUsage(data)
      } catch (err) {
        console.error('Failed to fetch usage:', err)
        setError('Failed to load usage data')
      } finally {
        setIsLoadingUsage(false)
      }
    }

    fetchUsage()
  }, [user])

  const handleUpgrade = async (planId: string) => {
    if (!user) {
      setError('Please sign in to upgrade')
      return
    }

    if (isDebugMode) {
      alert(`Debug Mode: Would upgrade to ${planId} plan`)
      return
    }

    if (planId === 'enterprise') {
      // Open email for enterprise inquiries
      window.location.href = 'mailto:sales@datacrafted.com?subject=Enterprise%20Plan%20Inquiry'
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start checkout')
      }

      // Redirect to Stripe checkout
      window.location.href = data.url
    } catch (err) {
      console.error('Failed to upgrade:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!user) return

    setIsLoadingPortal(true)
    setError(null)

    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal')
      }

      // Redirect to Stripe portal
      window.location.href = data.url
    } catch (err) {
      console.error('Failed to open portal:', err)
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setIsLoadingPortal(false)
    }
  }

  const currentTier = usage?.subscription?.tier || 'free'
  const isSubscribed = currentTier === 'pro' || currentTier === 'enterprise'
  const subscriptionStatus = usage?.subscription?.status

  // Calculate usage percentages
  const analysisPercentage = usage
    ? Math.min(100, (usage.analyses.used / usage.analyses.limit) * 100)
    : 0
  const chatPercentage = usage
    ? Math.min(100, (usage.chatMessages.used / usage.chatMessages.limit) * 100)
    : 0

  return (
    <div>
      <CardHeader>
        <CardTitle>Billing & Subscription</CardTitle>
        <CardDescription>
          Manage your subscription and billing information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Debug Mode Notice */}
        {isDebugMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              Debug Mode Active - Stripe integration disabled
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Current Plan & Usage */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>
                  You are currently on the {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} plan
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isSubscribed ? 'default' : 'secondary'}>
                  {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                </Badge>
                {subscriptionStatus && subscriptionStatus !== 'active' && (
                  <Badge variant="destructive">{subscriptionStatus}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingUsage ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : usage ? (
              <div className="space-y-4">
                {/* AI Analyses */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">AI Analyses {!isSubscribed && '(Lifetime)'}</span>
                    <span className="font-medium">
                      {usage.analyses.used} / {usage.analyses.limit === Infinity ? '∞' : usage.analyses.limit}
                    </span>
                  </div>
                  {!isSubscribed && (
                    <Progress
                      value={analysisPercentage}
                      className={cn(
                        "h-2",
                        analysisPercentage >= 100 ? "bg-red-100" : "bg-gray-100"
                      )}
                    />
                  )}
                  {analysisPercentage >= 100 && !isSubscribed && (
                    <p className="text-xs text-red-600 mt-1">
                      You&apos;ve used all your free analyses. Upgrade to continue.
                    </p>
                  )}
                </div>

                {/* Chat Messages */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Chat Messages {!isSubscribed && '(This Month)'}</span>
                    <span className="font-medium">
                      {usage.chatMessages.used} / {usage.chatMessages.limit === Infinity ? '∞' : usage.chatMessages.limit}
                    </span>
                  </div>
                  {!isSubscribed && (
                    <Progress
                      value={chatPercentage}
                      className={cn(
                        "h-2",
                        chatPercentage >= 100 ? "bg-red-100" : "bg-gray-100"
                      )}
                    />
                  )}
                  {chatPercentage >= 100 && !isSubscribed && (
                    <p className="text-xs text-red-600 mt-1">
                      You&apos;ve used all your chat messages this month. Upgrade for unlimited.
                    </p>
                  )}
                </div>

                {/* Subscription End Date */}
                {isSubscribed && usage.subscription.endDate && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600">Next billing date</span>
                    <span className="font-medium">
                      {new Date(usage.subscription.endDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Manage Subscription Button */}
                {isSubscribed && usage.subscription.stripeCustomerId && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      onClick={handleManageSubscription}
                      disabled={isLoadingPortal}
                      className="w-full"
                    >
                      {isLoadingPortal ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Manage Subscription
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">Unable to load usage data</p>
            )}
          </CardContent>
        </Card>

        {/* Plans */}
        <div>
          <h3 className="text-lg font-medium mb-4">Available Plans</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon
              const isCurrent = plan.id === currentTier
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative cursor-pointer transition-all",
                    plan.popular && "ring-2 ring-primary",
                    selectedPlan === plan.id && "border-primary"
                  )}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-white">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-6 w-6 text-primary" />
                      {isCurrent && <Badge variant="outline">Current</Badge>}
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      {plan.priceMonthly !== null && <span className="text-gray-600">/month</span>}
                    </div>

                    <div className="space-y-2 mb-4">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {!isCurrent && plan.id !== 'free' && (
                      <Button
                        className="w-full"
                        variant={plan.id === 'enterprise' ? 'outline' : 'default'}
                        disabled={isLoading}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpgrade(plan.id)
                        }}
                      >
                        {isLoading && selectedPlan === plan.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : plan.id === 'enterprise' ? (
                          'Contact Sales'
                        ) : (
                          'Upgrade'
                        )}
                      </Button>
                    )}

                    {isCurrent && plan.id === 'free' && (
                      <Button
                        className="w-full"
                        disabled
                        variant="outline"
                      >
                        Current Plan
                      </Button>
                    )}

                    {isCurrent && plan.id !== 'free' && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleManageSubscription()
                        }}
                        disabled={isLoadingPortal}
                      >
                        {isLoadingPortal ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Manage Plan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Payment Method - Only show for subscribers */}
        {isSubscribed && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
              <CardDescription>
                Manage your payment methods through the billing portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isLoadingPortal}
              >
                {isLoadingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Manage Payment Methods
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Secure payment processing by Stripe
              </p>
            </CardContent>
          </Card>
        )}

        {/* Billing History - Only show for subscribers */}
        {isSubscribed && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Billing History</CardTitle>
              <CardDescription>
                View your past invoices and receipts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isLoadingPortal}
              >
                {isLoadingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                View Invoices
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Access your complete billing history in the Stripe portal
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </div>
  )
}
