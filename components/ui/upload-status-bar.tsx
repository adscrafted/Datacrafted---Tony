'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2, X } from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useDataStore } from '@/lib/stores/data-store'
import { useAuth } from '@/lib/contexts/auth-context'
import { cn } from '@/lib/utils/cn'
import { UploadAuthPrompt } from '@/components/auth/upload-auth-prompt'

interface UploadStage {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete'
}

export function UploadStatusBar() {
  const router = useRouter()
  const { user, isDebugMode } = useAuth()

  // Upload state from UI store (modular store migration)
  const uploadProgress = useUIStore((state) => state.uploadProgress)
  const uploadStage = useUIStore((state) => state.uploadStage)
  const uploadComplete = useUIStore((state) => state.uploadComplete)
  const uploadProjectId = useUIStore((state) => state.uploadProjectId)
  const dismissUpload = useUIStore((state) => state.dismissUpload)

  // isAnalyzing from data store
  const isAnalyzing = useDataStore((state) => state.isAnalyzing)

  const [isVisible, setIsVisible] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [stages, setStages] = useState<UploadStage[]>([
    { id: 'uploading', label: 'Uploading file', status: 'pending' },
    { id: 'parsing', label: 'Parsing data', status: 'pending' },
    { id: 'analyzing', label: 'Analyzing structure', status: 'pending' },
    { id: 'saving', label: 'Saving data', status: 'pending' },
  ])

  // Show status bar when upload starts
  useEffect(() => {
    if (isAnalyzing && !uploadComplete) {
      setIsVisible(true)
    }
  }, [isAnalyzing, uploadComplete])

  // Update stages based on current stage
  useEffect(() => {
    if (!uploadStage) return

    setStages(prev => prev.map(stage => {
      if (stage.id === uploadStage) {
        return { ...stage, status: 'active' }
      }
      // Mark previous stages as complete
      const currentIndex = prev.findIndex(s => s.id === uploadStage)
      const stageIndex = prev.findIndex(s => s.id === stage.id)
      if (stageIndex < currentIndex) {
        return { ...stage, status: 'complete' }
      }
      return stage
    }))
  }, [uploadStage])

  // Auto-navigate when upload completes (or show auth prompt for unauthenticated users)
  useEffect(() => {
    if (uploadComplete && uploadProjectId) {
      // Mark all stages as complete
      setStages(prev => prev.map(s => ({ ...s, status: 'complete' })))

      // Check if user is authenticated
      if (user || isDebugMode) {
        // User is authenticated - navigate to dashboard
        const timer = setTimeout(() => {
          router.push(`/dashboard?id=${uploadProjectId}`)
          setIsVisible(false)
          dismissUpload()
        }, 1500)

        return () => clearTimeout(timer)
      } else {
        // User is NOT authenticated - show auth prompt after brief delay
        const timer = setTimeout(() => {
          setShowAuthPrompt(true)
        }, 1500)

        return () => clearTimeout(timer)
      }
    }
  }, [uploadComplete, uploadProjectId, router, dismissUpload, user, isDebugMode])

  // Handle manual dismiss
  const handleDismiss = () => {
    setIsVisible(false)
    setShowAuthPrompt(false)
    dismissUpload()
  }

  // Handle auth prompt close
  const handleAuthPromptClose = () => {
    setShowAuthPrompt(false)
    setIsVisible(false)
  }

  // Render auth prompt if needed
  if (showAuthPrompt && uploadProjectId) {
    return (
      <UploadAuthPrompt
        projectId={uploadProjectId}
        onClose={handleAuthPromptClose}
      />
    )
  }

  if (!isVisible) return null

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Upload progress"
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50",
        "transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="max-w-4xl mx-auto px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {uploadComplete ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                {uploadComplete ? 'Upload complete!' : 'Uploading your data...'}
              </p>
              <p className="text-xs text-gray-500">
                {stages.find(s => s.status === 'active')?.label || 'Processing'}
              </p>
            </div>
          </div>

          {uploadComplete && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Dismiss upload notification"
              type="button"
            >
              <X className="h-4 w-4 text-gray-500" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div
            className="h-2 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(uploadProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              className={cn(
                "h-full transition-all duration-500 ease-out",
                uploadComplete ? "bg-green-600" : "bg-blue-600"
              )}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right" aria-live="polite">
            {Math.round(uploadProgress)}%
          </p>
        </div>

        {/* Stages */}
        <div className="flex items-center justify-between space-x-2">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center flex-1">
              <div className="flex items-center space-x-2 flex-1">
                {/* Stage Indicator */}
                <div
                  className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors",
                    stage.status === 'complete' && "bg-green-100 text-green-700",
                    stage.status === 'active' && "bg-blue-100 text-blue-700",
                    stage.status === 'pending' && "bg-gray-100 text-gray-400"
                  )}
                >
                  {stage.status === 'complete' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : stage.status === 'active' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Stage Label */}
                <span
                  className={cn(
                    "text-xs transition-colors",
                    stage.status === 'complete' && "text-green-700 font-medium",
                    stage.status === 'active' && "text-blue-700 font-medium",
                    stage.status === 'pending' && "text-gray-400"
                  )}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 mx-2 transition-colors",
                    stage.status === 'complete' ? "bg-green-600" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
