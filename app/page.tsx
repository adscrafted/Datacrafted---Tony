'use client'

import { DynamicFileUpload } from '@/components/upload/dynamic-file-upload'
import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { preloadUploadResources, shouldPrefetch } from '@/lib/utils/preloader'
import { MinimalHeader } from '@/components/ui/minimal-header'
import { useProjectStore } from '@/lib/stores/project-store'
import { useDataStore } from '@/lib/store'
import { useAuth } from '@/lib/contexts/auth-context'
import { UploadStatusBar } from '@/components/ui/upload-status-bar'

export default function Home() {
  const router = useRouter()
  const { user } = useAuth()
  const { createProject, saveProjectData } = useProjectStore()
  const {
    setUploadComplete,
    setUploadProjectId,
    setUploadProgress
  } = useDataStore()

  // Preload critical resources for file upload
  useEffect(() => {
    if (shouldPrefetch()) {
      preloadUploadResources().catch(error => {
        console.warn('Failed to preload upload resources:', error)
      })
    }
  }, [])

  // Handle successful upload - create project and set status for navigation
  const handleUploadComplete = useCallback(async (data: any) => {
    console.log('🔵 [PAGE] Upload complete, creating project')
    setUploadProgress(100)

    try {
      // Get the current store state
      const currentState = useDataStore.getState()
      console.log('🔍 [PAGE] Current store state:', {
        fileName: currentState.fileName,
        hasRawData: !!currentState.rawData,
        rawDataLength: currentState.rawData?.length,
        hasSchema: !!currentState.dataSchema
      })

      // Create a new project with the uploaded file data
      const project = await createProject({
        userId: user?.uid || 'anonymous',
        name: currentState.fileName || 'Untitled Project',
        description: `Data analysis project for ${currentState.fileName}`,
        fileInfo: currentState.dataSchema ? {
          fileName: currentState.fileName || 'unknown',
          fileSize: 0,
          rowCount: currentState.dataSchema.rowCount,
          columnCount: currentState.dataSchema.columnCount
        } : undefined
      })

      console.log('✅ [PAGE] Project created:', project.id)

      // Save the project data if available
      if (currentState.rawData && currentState.rawData.length > 0) {
        await saveProjectData(
          project.id,
          currentState.rawData,
          currentState.analysis || undefined,
          currentState.dataSchema || undefined
        )
        console.log('✅ [PAGE] Project data saved')
      }

      // Set upload complete and project ID - status bar will handle navigation to dashboard
      setUploadProjectId(project.id)
      setUploadComplete(true)

      console.log('✅ [PAGE] Upload complete, status bar will navigate to /dashboard')
    } catch (error) {
      console.error('❌ [PAGE] Failed to create project:', error)
      // Log error but don't navigate away - let user retry
    }
  }, [router, user?.uid, createProject, saveProjectData, setUploadComplete, setUploadProjectId, setUploadProgress])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 text-center px-4">
        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-2xl font-semibold text-gray-700">DataCrafted</h1>
        </div>

        {/* Hero text */}
        <h2 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-20">
          <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Turn data into
          </span>
          <br />
          <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">
            decisions
          </span>
        </h2>

        {/* File upload - glass morphism style */}
        <div className="max-w-xl mx-auto">
          <DynamicFileUpload
            onUploadComplete={handleUploadComplete}
          />
        </div>
      </div>

      {/* Upload Status Bar */}
      <UploadStatusBar />
    </div>
  )
}