'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface LoadingIndicatorProps {
  message?: string
  subMessage?: string
  progress?: number
  steps?: {
    label: string
    completed: boolean
  }[]
}

export function LoadingIndicator({
  message = 'Processing...',
  subMessage,
  progress,
  steps
}: LoadingIndicatorProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      {/* Animated spinner */}
      <div className="mb-8">
        <motion.div
          className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      </div>

      {/* Loading message */}
      <h3 className="text-xl font-medium text-gray-900 mb-2">
        {message}
      </h3>

      {subMessage && (
        <p className="text-sm text-gray-600 mb-4">
          {subMessage}
        </p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-full max-w-xs mb-6">
          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-blue-500 h-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Steps indicator */}
      {steps && steps.length > 0 && (
        <div className="w-full max-w-sm">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center mb-2"
            >
              <div
                className={`w-5 h-5 rounded-full mr-3 flex items-center justify-center ${
                  step.completed
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              >
                {step.completed && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm ${
                  step.completed ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function FullScreenLoader({
  message,
  subMessage,
  progress,
  steps
}: LoadingIndicatorProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <LoadingIndicator
        message={message}
        subMessage={subMessage}
        progress={progress}
        steps={steps}
      />
    </div>
  )
}