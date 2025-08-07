'use client'

import React, { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

// Lazy load heavy components
const FileUploadCore = lazy(() => 
  import('./file-upload-core').then(module => ({ default: module.FileUploadCore }))
)

const LoadingSpinner = () => (
  <Card className="w-full max-w-2xl mx-auto">
    <CardContent className="p-8">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-lg font-medium">Loading file upload...</p>
        </div>
      </div>
    </CardContent>
  </Card>
)

interface DynamicFileUploadProps {
  onUploadStart?: () => void
  onUploadComplete?: (data: any) => void
  onUploadError?: (error: string) => void
}

export function DynamicFileUpload(props: DynamicFileUploadProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FileUploadCore {...props} />
    </Suspense>
  )
}