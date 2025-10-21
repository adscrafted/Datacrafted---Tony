'use client'

import { useEffect, useState } from 'react'
import type { AuthModalProps, AuthView } from './types'
import { SignInForm } from './sign-in-form'
import { SignUpForm } from './sign-up-form'

export function AuthModal({ isOpen, onClose, defaultView = 'signin' }: AuthModalProps) {
  const [currentView, setCurrentView] = useState<AuthView>(defaultView)

  // Reset view when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentView(defaultView)
    }
  }, [isOpen, defaultView])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSuccess = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close modal"
        >
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

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
      </div>
    </div>
  )
}
