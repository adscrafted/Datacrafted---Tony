'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react'

export default function CheckoutCancelPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-gray-100 rounded-full w-fit">
            <XCircle className="h-8 w-8 text-gray-500" />
          </div>
          <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
          <CardDescription>
            Your upgrade was cancelled. No charges were made.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Reassurance message */}
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Changed your mind? No problem! You can continue using the free plan or upgrade anytime from your billing page.
            </p>
          </div>

          {/* Free plan reminder */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Your current free plan includes:</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• 3 AI analyses (lifetime)</li>
              <li>• 50 chat messages per month</li>
              <li>• Up to 10,000 rows per dataset</li>
              <li>• Basic chart types</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => router.push('/account/billing')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/dashboard')}
            >
              Continue to Dashboard
            </Button>
          </div>

          {/* Help link */}
          <div className="text-center">
            <button
              onClick={() => window.location.href = 'mailto:support@datacrafted.com?subject=Billing%20Question'}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              Have questions? Contact support
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
