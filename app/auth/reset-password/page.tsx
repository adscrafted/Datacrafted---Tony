'use client'

import type { Metadata } from 'next'
import React, { useState } from 'react'

// Note: Metadata export only works in Server Components
// For this Client Component, SEO is handled via document head manipulation
import { useRouter } from 'next/navigation'
import { BarChart3, Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/contexts/auth-context'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { resetPassword, error, isDebugMode } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await resetPassword(email)
      setIsSuccess(true)
    } catch (err) {
      // Error is handled in auth context
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToSignIn = () => {
    router.push('/auth/signin')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <BarChart3 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Reset your password</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we&apos;ll send you a link to reset your password
          </CardDescription>
          {isDebugMode && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
              <p className="text-sm text-yellow-800 text-center">
                Debug Mode: Password reset email will be simulated
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!isSuccess ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !email}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  href="/auth/signin" 
                  className="text-sm text-muted-foreground hover:text-primary inline-flex items-center"
                >
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Back to sign in
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  We&apos;ve sent a password reset link to:
                </p>
                <p className="text-sm font-medium">{email}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  Please check your email and follow the instructions to reset your password.
                  The link will expire in 1 hour.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleBackToSignIn}
                >
                  Back to Sign In
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Didn&apos;t receive the email? Check your spam folder or{' '}
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="text-primary hover:underline"
                  >
                    try again
                  </button>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}