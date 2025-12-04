'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Lock, X } from 'lucide-react'
import { SignInForm } from './sign-in-form'
import { SignUpForm } from './sign-up-form'
import { useAuth } from '@/lib/contexts/auth-context'
import { useUIStore } from '@/lib/stores/ui-store'
import type { AuthView } from './types'

interface UploadAuthPromptProps {
  projectId: string
  onClose: () => void
}

/**
 * Upload Auth Prompt
 *
 * Displays after file upload completes for unauthenticated users.
 * Prompts them to sign in to see their AI-powered analysis results.
 *
 * Features:
 * - Explains the value of signing in (AI analysis, saving projects)
 * - Tab-based UI for sign in / sign up
 * - Option to dismiss (shows blocked message)
 * - Auto-navigates to dashboard after successful auth
 */
export function UploadAuthPrompt({ projectId, onClose }: UploadAuthPromptProps) {
  const [currentView, setCurrentView] = useState<AuthView>('signin')
  const [showBlockedMessage, setShowBlockedMessage] = useState(false)
  const { user, isDebugMode } = useAuth()
  const router = useRouter()
  const dismissUpload = useUIStore((state) => state.dismissUpload)

  // Handle successful authentication
  const handleSuccess = () => {
    console.log('[UPLOAD_AUTH] Authentication successful, navigating to dashboard')
    router.push(`/dashboard?id=${projectId}`)
    dismissUpload()
    onClose()
  }

  // Handle dismiss without signing in
  const handleDismiss = () => {
    setShowBlockedMessage(true)
  }

  // Handle going back home
  const handleGoHome = () => {
    dismissUpload()
    onClose()
  }

  // If user is authenticated (might have logged in while modal was open)
  if (user || isDebugMode) {
    router.push(`/dashboard?id=${projectId}`)
    dismissUpload()
    onClose()
    return null
  }

  // Show blocked message if user dismissed without signing in
  if (showBlockedMessage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          {/* Lock Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Analysis Locked
            </h2>
            <p className="text-gray-600">
              Your data has been uploaded, but you need to sign in to unlock your AI-powered insights and analysis.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => setShowBlockedMessage(false)}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              Sign in to unlock
            </button>
            <button
              onClick={handleGoHome}
              className="w-full py-3 px-4 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Return to home
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-center text-gray-500">
              Your uploaded data will be saved and ready for analysis once you sign in.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[#71b2ff] to-[#3cf152] mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Your data is ready!
          </h2>
          <p className="text-gray-600">
            Sign in to unlock AI-powered analysis and save your dashboard.
          </p>
        </div>

        {/* Benefits */}
        <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-4 mb-6">
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              AI-generated charts and insights
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Save and access your dashboards anytime
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Chat with your data using AI
            </li>
          </ul>
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

        {/* Auth Forms */}
        {currentView === 'signin' && (
          <SignInForm
            onSuccess={handleSuccess}
            onSwitchView={setCurrentView}
            skipRedirect={true}
          />
        )}
        {currentView === 'signup' && (
          <SignUpForm
            onSuccess={handleSuccess}
            onSwitchView={setCurrentView}
            skipRedirect={true}
          />
        )}
        {currentView === 'reset' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Password Reset
            </h2>
            <p className="text-sm text-gray-600 mb-4">
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
          <button
            onClick={handleDismiss}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
