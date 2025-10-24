'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2, X } from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useDataStore } from '@/lib/stores/data-store'
import { cn } from '@/lib/utils/cn'

interface UploadStage {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete'
}

export function UploadStatusBar() {
  const router = useRouter()

  // Upload state from UI store (modular store migration)
  const uploadProgress = useUIStore((state) => state.uploadProgress)
  const uploadStage = useUIStore((state) => state.uploadStage)
  const uploadComplete = useUIStore((state) => state.uploadComplete)
  const uploadProjectId = useUIStore((state) => state.uploadProjectId)
  const dismissUpload = useUIStore((state) => state.dismissUpload)

  // isAnalyzing from data store
  const isAnalyzing = useDataStore((state) => state.isAnalyzing)

  const [isVisible, setIsVisible] = useState(false)
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

  // Auto-navigate when upload completes
  useEffect(() => {
    if (uploadComplete && uploadProjectId) {
      // Mark all stages as complete
      setStages(prev => prev.map(s => ({ ...s, status: 'complete' })))

      // Wait a moment to show completion, then navigate
      const timer = setTimeout(() => {
        router.push(`/dashboard?id=${uploadProjectId}`)
        setIsVisible(false)
        dismissUpload()
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [uploadComplete, uploadProjectId, router, dismissUpload])

  // Handle manual dismiss
  const handleDismiss = () => {
    setIsVisible(false)
    dismissUpload()
  }

  if (!isVisible) return null

  return (
    <div
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
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 ease-out",
                uploadComplete ? "bg-green-600" : "bg-blue-600"
              )}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
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
