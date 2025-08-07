'use client'

import React, { useState } from 'react'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, CreditCard, Zap, Building, Crown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out DataCrafted',
    price: '$0',
    priceMonthly: 0,
    features: [
      '3 projects',
      '10MB per file',
      '1,000 rows per dataset',
      'Basic analytics',
      'Community support'
    ],
    limitations: [
      'No team collaboration',
      'No API access',
      'No custom branding'
    ],
    icon: Zap,
    current: true
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals and small teams',
    price: '$29',
    priceMonthly: 29,
    features: [
      'Unlimited projects',
      '100MB per file',
      '1M rows per dataset',
      'Advanced analytics & AI',
      'Priority support',
      'API access',
      'Export to BigQuery'
    ],
    limitations: [
      'Up to 5 team members'
    ],
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

  const handleUpgrade = async (planId: string) => {
    if (isDebugMode) {
      alert(`Debug Mode: Would upgrade to ${planId} plan`)
      return
    }

    setIsLoading(true)
    try {
      // TODO: Integrate with Stripe
      console.log('Upgrading to plan:', planId)
    } catch (error) {
      console.error('Failed to upgrade:', error)
    } finally {
      setIsLoading(false)
    }
  }

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

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>You are currently on the Free plan</CardDescription>
              </div>
              <Badge variant="secondary">Free</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Projects used</span>
                <span className="font-medium">1 of 3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Storage used</span>
                <span className="font-medium">5.2MB of 30MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rows processed</span>
                <span className="font-medium">523 of 1,000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <div>
          <h3 className="text-lg font-medium mb-4">Available Plans</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon
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
                      {plan.current && <Badge variant="outline">Current</Badge>}
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

                    {!plan.current && (
                      <Button 
                        className="w-full" 
                        variant={plan.id === 'enterprise' ? 'outline' : 'default'}
                        disabled={isLoading}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpgrade(plan.id)
                        }}
                      >
                        {plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Method</CardTitle>
            <CardDescription>
              Add a payment method to upgrade your plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              <CreditCard className="mr-2 h-4 w-4" />
              Add Payment Method
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Secure payment processing by Stripe
            </p>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Billing History</CardTitle>
            <CardDescription>
              View your past invoices and receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              No billing history available
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </div>
  )
}