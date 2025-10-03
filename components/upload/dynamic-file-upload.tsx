'use client'

import React, { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'

// Lazy load heavy components
const FileUploadCore = lazy(() =>
  import('./file-upload-core').then(module => ({ default: module.FileUploadCore }))
)

const LoadingSpinner = () => (
  <div className="w-full max-w-2xl mx-auto">
    <div className="relative p-16 md:p-20 rounded-3xl bg-white/60 border-2 border-white/20 backdrop-blur-xl shadow-2xl">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-16 w-16 text-gray-400 animate-spin" />
        <p className="text-2xl font-semibold text-gray-800">Loading...</p>
      </div>
    </div>
  </div>
)

interface DynamicFileUploadProps {
  onUploadStart?: () => void
  onUploadComplete?: (data: any) => void
  onUploadError?: (error: string) => void
  isTypingComplete?: boolean
}

export function DynamicFileUpload(props: DynamicFileUploadProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FileUploadCore {...props} />
    </Suspense>
  )
}