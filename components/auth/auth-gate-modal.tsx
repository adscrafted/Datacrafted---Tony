'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthView } from './types'
import { SignInForm } from './sign-in-form'
import { SignUpForm } from './sign-up-form'
import { useAuth } from '@/lib/contexts/auth-context'

interface AuthGateModalProps {
  redirectPath?: string
  message?: string
}

/**
 * Auth Gate Modal
 *
 * Displays when unauthenticated users try to access protected routes.
 * Automatically redirects to the intended page after successful authentication.
 *
 * Features:
 * - Tab-based UI for sign in / sign up
 * - Custom message support
 * - Auto-redirect after auth
 * - Debug mode support (always passes)
 */
export function AuthGateModal({
  redirectPath = '/projects',
  message = 'Please sign in to continue'
}: AuthGateModalProps) {
  const [currentView, setCurrentView] = useState<AuthView>('signin')
  const { user, isDebugMode } = useAuth()
  const router = useRouter()

  // If user authenticates or is in debug mode, redirect
  useEffect(() => {
    if (user || isDebugMode) {
      router.push(redirectPath)
    }
  }, [user, isDebugMode, redirectPath, router])

  // If already authenticated or in debug mode, don't show the modal
  if (user || isDebugMode) {
    return null
  }

  const handleSuccess = () => {
    // Auth context will handle the redirect via the useEffect above
    console.log('✅ [AUTH_GATE] Authentication successful, redirecting to:', redirectPath)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Auth Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[#71b2ff] to-[#3cf152] mb-4">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[#1f1f1f] mb-2">
            Authentication Required
          </h2>
          <p className="text-sm text-[#5f6368]">
            {message}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 border-b border-gray-200">
          <button
            onClick={() => setCurrentView('signin')}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              currentView === 'signin'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setCurrentView('signup')}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              currentView === 'signup'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Content */}
        {currentView === 'signin' && (
          <SignInForm onSuccess={handleSuccess} onSwitchView={setCurrentView} />
        )}
        {currentView === 'signup' && (
          <SignUpForm onSuccess={handleSuccess} onSwitchView={setCurrentView} />
        )}
        {currentView === 'reset' && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[#1f1f1f] mb-4">
              Password Reset
            </h2>
            <p className="text-sm text-[#5f6368] mb-4">
              Password reset functionality coming soon. For now, please contact support.
            </p>
            <button
              onClick={() => setCurrentView('signin')}
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Back to sign in
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-center text-[#5f6368]">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
