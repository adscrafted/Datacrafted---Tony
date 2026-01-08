'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, ArrowRight, Sparkles, BarChart3 } from 'lucide-react'

// Key for storing return URL in localStorage across page redirects
const PENDING_RETURN_URL_KEY = 'datacrafted_pending_return_url'

// Whitelist of allowed redirect path patterns (security: prevents open redirect attacks)
// Note: Query params are validated separately to only allow safe characters
const ALLOWED_REDIRECT_PATTERNS = [
  /^\/dashboard$/,
  /^\/projects$/,
  /^\/projects\/[a-zA-Z0-9_-]+$/,
  /^\/analyze$/,
  /^\/account\/billing$/,
  /^\/account\/team$/,
]

// Safe query string pattern - only allows alphanumeric, common URL-safe chars
const SAFE_QUERY_PATTERN = /^[a-zA-Z0-9_=&%.-]*$/

/**
 * Validates return URL to prevent open redirect vulnerabilities
 * Only allows relative paths matching the whitelist
 *
 * Security measures:
 * - URL decoding to catch encoded bypasses
 * - Backslash normalization (browsers convert \ to /)
 * - Protocol and external URL blocking
 * - Path traversal blocking
 * - Control character blocking
 * - Whitelist-based path validation
 * - Query parameter sanitization
 */
function isValidReturnUrl(url: string | null): boolean {
  if (!url) return false

  // Decode URL to catch encoded bypass attempts (e.g., %2F%2F for //)
  let decodedUrl: string
  try {
    // Double decode to catch double-encoding attacks
    decodedUrl = decodeURIComponent(decodeURIComponent(url))
  } catch {
    // Invalid encoding - reject
    console.warn('[BILLING SUCCESS] Invalid URL encoding:', url)
    return false
  }

  // Normalize backslashes to forward slashes (browsers may convert them)
  const normalizedUrl = decodedUrl.replace(/\\/g, '/')

  // Block protocol schemes (check decoded version)
  if (normalizedUrl.includes('://')) {
    console.warn('[BILLING SUCCESS] Blocked external redirect URL:', url)
    return false
  }

  // Block protocol-relative URLs
  if (normalizedUrl.startsWith('//')) {
    console.warn('[BILLING SUCCESS] Blocked protocol-relative URL:', url)
    return false
  }

  // Must start with exactly one forward slash
  if (!normalizedUrl.startsWith('/')) {
    console.warn('[BILLING SUCCESS] Blocked non-absolute path:', url)
    return false
  }

  // Block any URL with @ (credential injection)
  if (normalizedUrl.includes('@')) {
    console.warn('[BILLING SUCCESS] Blocked URL with @ character:', url)
    return false
  }

  // Block path traversal attempts
  if (normalizedUrl.includes('..') || normalizedUrl.includes('./')) {
    console.warn('[BILLING SUCCESS] Blocked path traversal attempt:', url)
    return false
  }

  // Block null bytes and other control characters
  if (/[\x00-\x1f\x7f]/.test(normalizedUrl)) {
    console.warn('[BILLING SUCCESS] Blocked control characters:', url)
    return false
  }

  // Split path and query string
  const [path, queryString] = normalizedUrl.split('?')

  // Validate query string if present (only allow safe characters)
  if (queryString && !SAFE_QUERY_PATTERN.test(queryString)) {
    console.warn('[BILLING SUCCESS] Blocked unsafe query string:', url)
    return false
  }

  // Check path against whitelist (case-sensitive for security)
  const isAllowed = ALLOWED_REDIRECT_PATTERNS.some(pattern => pattern.test(path))

  if (!isAllowed) {
    console.warn('[BILLING SUCCESS] URL path not in whitelist:', url)
  }

  return isAllowed
}

function CheckoutSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnToParam = searchParams.get('returnTo')

  const [isVerifying, setIsVerifying] = useState(true)
  const [verified, setVerified] = useState(false)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState(5)

  useEffect(() => {
    // Check for return URL from query param first, then localStorage
    const pendingReturnUrl = returnToParam || localStorage.getItem(PENDING_RETURN_URL_KEY)

    // Always clean up localStorage
    localStorage.removeItem(PENDING_RETURN_URL_KEY)

    // Validate the return URL before using it (security: prevent open redirect)
    if (pendingReturnUrl && isValidReturnUrl(pendingReturnUrl)) {
      console.log('[BILLING SUCCESS] Valid return URL:', pendingReturnUrl)
      setReturnUrl(pendingReturnUrl)
    } else if (pendingReturnUrl) {
      // URL was provided but failed validation - log and ignore
      console.warn('[BILLING SUCCESS] Invalid return URL rejected, using default')
    }

    // Simple verification delay to allow webhook to process
    const timer = setTimeout(() => {
      setIsVerifying(false)
      setVerified(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [returnToParam])

  // Auto-redirect countdown when there's a return URL
  useEffect(() => {
    if (!verified || !returnUrl) return

    const countdownInterval = setInterval(() => {
      setAutoRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          router.push(returnUrl)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [verified, returnUrl, router])

  const handleContinue = () => {
    if (returnUrl) {
      router.push(returnUrl)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {isVerifying ? (
            <>
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Processing your upgrade...</CardTitle>
              <CardDescription>
                Please wait while we activate your Pro subscription.
              </CardDescription>
            </>
          ) : verified ? (
            <>
              <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Welcome to Pro!</CardTitle>
              <CardDescription>
                Your upgrade was successful. Enjoy unlimited access to all features.
              </CardDescription>
            </>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-6">
          {verified && (
            <>
              {/* Pro benefits */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Your Pro Benefits</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    Unlimited AI analyses*
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    Unlimited chat messages
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    Up to 1M rows per dataset
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    Priority support
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  *Subject to fair use rate limits (10/hr)
                </p>
              </div>

              {/* Return to analysis notification */}
              {returnUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-900">Ready to continue!</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Your analysis is waiting. Redirecting in {autoRedirectCountdown}s...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleContinue}
                >
                  {returnUrl ? (
                    <>
                      Continue to Your Analysis
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Go to Dashboard
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/account/billing')}
                >
                  View Subscription Details
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                A confirmation email has been sent to your registered email address.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}
