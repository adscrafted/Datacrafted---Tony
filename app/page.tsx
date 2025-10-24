'use client'

import { DynamicFileUpload } from '@/components/upload/dynamic-file-upload'
import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { preloadUploadResources, shouldPrefetch } from '@/lib/utils/preloader'
import { LandingHeader } from '@/components/ui/landing-header'
import { useProjectStore } from '@/lib/stores/project-store'
import { useDataStore } from '@/lib/stores/data-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useAuth } from '@/lib/contexts/auth-context'
import { UploadStatusBar } from '@/components/ui/upload-status-bar'
import { AuthModal } from '@/components/auth/auth-modal'

export default function Home() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { createProject, saveProjectData } = useProjectStore()

  // Upload state from UI store (modular store migration)
  const setUploadComplete = useUIStore((state) => state.setUploadComplete)
  const setUploadProjectId = useUIStore((state) => state.setUploadProjectId)
  const setUploadProgress = useUIStore((state) => state.setUploadProgress)
  const setUploadStage = useUIStore((state) => state.setUploadStage) ?? (() => {})

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Typing animation state
  const [typedText, setTypedText] = useState('')
  const [isTypingComplete, setIsTypingComplete] = useState(false)
  const fullText = 'Turn data into\ndecisions...'

  // Typing animation effect
  useEffect(() => {
    if (typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1))
      }, 80) // Typing speed in ms
      return () => clearTimeout(timeout)
    } else {
      // Typing complete, trigger glow effect
      setIsTypingComplete(true)
    }
  }, [typedText, fullText])

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

    try {
      // Get the current store state
      const currentState = useDataStore.getState()
      console.log('🔍 [PAGE] Current store state:', {
        fileName: currentState.fileName,
        hasRawData: !!currentState.rawData,
        rawDataLength: currentState.rawData?.length,
        hasSchema: !!currentState.dataSchema
      })

      // Stage 1: Creating project (continue from parser completion at ~70%)
      setUploadStage('creating')
      setUploadProgress(71)

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

      // Stage 2: Saving project data
      setUploadStage('saving')
      setUploadProgress(85)

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

      // Stage 3: Complete
      setUploadProgress(100)

      // Set upload complete and project ID - status bar will handle navigation to dashboard
      setUploadProjectId(project.id)
      setUploadComplete(true)

      console.log('✅ [PAGE] Upload complete, status bar will navigate to /dashboard')
    } catch (error) {
      console.error('❌ [PAGE] Failed to create project:', error)
      // Log error but don't navigate away - let user retry
    }
  }, [router, user?.uid, createProject, saveProjectData, setUploadComplete, setUploadProjectId, setUploadProgress, setUploadStage])

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafd]">
      {/* Landing Header with Auth */}
      <LandingHeader
        user={user}
        onSignInClick={() => setShowAuthModal(true)}
        onLogout={logout}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <div className="flex-1 flex items-center justify-center">
        {/* Subtle blue gradient glow - NotebookLM style */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-[rgb(11,40,212)]/10 rounded-full mix-blend-normal filter blur-3xl animate-blob" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[rgb(11,40,212)]/8 rounded-full mix-blend-normal filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-[rgb(11,40,212)]/5 rounded-full mix-blend-normal filter blur-3xl animate-blob animation-delay-4000" />
        </div>

      <div className="relative z-10 text-center px-4 w-full max-w-6xl mx-auto mt-16">
        {/* Hero text with typing animation */}
        <h2 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 min-h-[240px] flex flex-col items-center justify-center text-center tracking-tight leading-[1.1]" style={{ fontFamily: "'Google Sans Text', Helvetica, Arial, sans-serif" }}>
          {typedText.split('\n').map((line, i) => (
            <span key={i}>
              {i === 0 ? (
                <span className="text-[#1f1f1f]">{line}</span>
              ) : (
                <span
                  style={{
                    background: 'linear-gradient(to right, #71b2ff 0%, #3cf152 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {line}
                </span>
              )}
              {/* Show blinking cursor after "decisions..." when typing completes */}
              {i === 1 && isTypingComplete && (
                <span className="inline-block w-1 h-16 md:h-20 ml-2 bg-[#71b2ff] animate-blink align-middle" />
              )}
            </span>
          ))}
        </h2>

        {/* Subtitle - appears after typing is complete */}
        <p className={`text-sm md:text-base text-[#5f6368] mb-16 max-w-2xl mx-auto transition-opacity duration-1000 ${isTypingComplete ? 'opacity-100' : 'opacity-0'}`} style={{ fontFamily: "Helvetica, Arial, sans-serif", lineHeight: '1.5' }}>
          Data transfer. Data storage. Business intelligence. Zero learning curve.
        </p>

        {/* File upload - fixed width to prevent layout shift */}
        <div className="w-full max-w-xl mx-auto">
          <DynamicFileUpload
            onUploadComplete={handleUploadComplete}
            isTypingComplete={isTypingComplete}
          />
        </div>
      </div>

        {/* Upload Status Bar */}
        <UploadStatusBar />
      </div>
    </div>
  )
}