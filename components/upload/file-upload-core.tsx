'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, Loader2, X, CheckCircle, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'
import { analyzeDataSchema } from '@/lib/utils/schema-analyzer'
import { parseFileOptimized, cleanupFileParser, type ParseProgress } from '@/lib/utils/file-parser-optimized'
import { EnhancedProgress, useProgressStages } from '@/components/ui/enhanced-progress'
import { startTiming, endTiming, recordMetric, measureAsyncFunction } from '@/lib/utils/performance-monitor'
import { transitions, prefersReducedMotion } from '@/lib/utils/animations'
import { prefetchDashboardResources, shouldPrefetch } from '@/lib/utils/preloader'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface FileUploadCoreProps {
  onUploadStart?: () => void
  onUploadComplete?: (data: any) => void
  onUploadError?: (error: string) => void
  disabled?: boolean
}

export function FileUploadCore({ 
  onUploadStart, 
  onUploadComplete, 
  onUploadError,
  disabled = false
}: FileUploadCoreProps) {
  const router = useRouter()
  const { setFileName, setRawData, setDataSchema, setError, isAnalyzing, setIsAnalyzing, setAnalysis } = useDataStore()
  
  // Enhanced progress tracking
  const {
    stages,
    currentStage,
    overallProgress,
    initializeStages,
    updateStage,
    completeStage,
    errorStage
  } = useProgressStages()
  
  // Legacy progress tracking for compatibility
  const [uploadProgress, setUploadProgress] = useState(0)
  const [progressStage, setProgressStage] = useState<string>('')
  const [parseDetails, setParseDetails] = useState<{
    rowsProcessed?: number
    estimatedTime?: number
    currentChunk?: number
    totalChunks?: number
  }>({})
  
  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    fileSize?: number
    parseTime?: number
    throughput?: number
  }>({})
  
  // Error handling
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  
  // File selection state (new two-step process)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      cleanupFileParser()
    }
  }, [])

  const handleProgress = useCallback((progress: ParseProgress) => {
    // Update legacy progress for compatibility
    setUploadProgress(progress.percentage)
    setProgressStage(progress.stage)
    
    // Update detailed progress info
    setParseDetails({
      rowsProcessed: progress.rowsProcessed,
      estimatedTime: progress.estimatedTimeRemaining,
      currentChunk: progress.currentChunk,
      totalChunks: progress.totalChunks
    })

    // Update enhanced progress stages
    const stageId = progress.stage
    const stageDetails = progress.rowsProcessed 
      ? `${progress.rowsProcessed.toLocaleString()} rows processed`
      : undefined

    updateStage(stageId, {
      status: 'active',
      progress: progress.percentage,
      details: stageDetails,
      estimatedTime: progress.estimatedTimeRemaining
    })

    // Calculate throughput for large files
    if (progress.rowsProcessed && startTimeRef.current) {
      const elapsed = (performance.now() - startTimeRef.current) / 1000
      const throughput = progress.rowsProcessed / elapsed
      setPerformanceMetrics(prev => ({ ...prev, throughput }))
    }
  }, [updateStage])

  const validateFile = useCallback((file: File): string[] => {
    const errors: string[] = []

    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the 50MB limit`)
    }

    // Type validation
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      errors.push('Unsupported file type. Please upload a CSV or Excel file.')
    }

    return errors
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    console.log('🔵 [FILE-UPLOAD] onDrop triggered with files:', { 
      fileCount: acceptedFiles.length, 
      fileName: file?.name, 
      fileSize: file?.size, 
      fileType: file?.type,
      timestamp: new Date().toISOString()
    })
    
    if (!file) {
      console.log('❌ [FILE-UPLOAD] No file selected in onDrop')
      return
    }

    // Reset state
    console.log('🔵 [FILE-UPLOAD] Resetting upload state')
    setUploadErrors([])
    setUploadProgress(0)
    setProgressStage('')
    setParseDetails({})
    setPerformanceMetrics({ fileSize: file.size })
    // Clear previous analysis to ensure new analysis is triggered
    setAnalysis(null)

    // Validate file
    console.log('🔵 [FILE-UPLOAD] Starting file validation')
    const validationErrors = validateFile(file)
    if (validationErrors.length > 0) {
      console.log('❌ [FILE-UPLOAD] File validation failed:', validationErrors)
      setUploadErrors(validationErrors)
      setError(validationErrors[0])
      onUploadError?.(validationErrors[0])
      return
    }
    console.log('✅ [FILE-UPLOAD] File validation passed')

    // Only set the selected file - don't start processing yet
    setSelectedFile(file)
  }, [validateFile, setError, onUploadError, setAnalysis])

  // New function to handle the actual upload processing
  const handleUploadFile = useCallback(async () => {
    if (!selectedFile) {
      console.log('❌ [FILE-UPLOAD] No file selected for upload')
      return
    }

    console.log('🔵 [FILE-UPLOAD] Starting upload process for:', selectedFile.name)
    
    // Initialize progress stages
    initializeStages([
      { id: 'reading', label: 'Reading file' },
      { id: 'parsing', label: 'Parsing data' },
      { id: 'analyzing', label: 'Analyzing structure' },
      { id: 'complete', label: 'Processing complete' }
    ])

    // Start upload process
    setIsAnalyzing(true)
    startTimeRef.current = performance.now()
    abortControllerRef.current = new AbortController()
    console.log('🔵 [FILE-UPLOAD] Upload state initialized, isAnalyzing set to true')
    
    // Start performance monitoring
    startTiming('file_upload_total', {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type
    }, ['upload', 'performance'])
    
    recordMetric('upload_started', {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      timestamp: Date.now()
    }, ['upload'])
    
    onUploadStart?.()

    try {
      // Initialize progress stages
      initializeStages([
        { id: 'parsing', label: 'Parsing file', status: 'pending' },
        { id: 'analyzing', label: 'Analyzing data', status: 'pending' },
        { id: 'complete', label: 'Complete', status: 'pending' }
      ])
      
      // Store file info
      console.log('🔵 [FILE-UPLOAD] Storing file name:', selectedFile.name)
      setFileName(selectedFile.name)
      
      // Parse file stage
      console.log('🔵 [FILE-UPLOAD] Starting file parsing stage')
      updateStage('parsing', { status: 'active', progress: 0 })
      setProgressStage('Parsing file...')
      
      console.log('🔵 [FILE-UPLOAD] Calling parseFileOptimized')
      const result = await parseFileOptimized(selectedFile, {
        onProgress: handleProgress,
        signal: abortControllerRef.current.signal
      })
      
      console.log('🔵 [FILE-UPLOAD] File parsing completed:', { 
        rowCount: result.data.length, 
        columns: result.data[0] ? Object.keys(result.data[0]) : [],
        sampleData: result.data.slice(0, 2)
      })
      
      if (result.data.length === 0) {
        console.log('❌ [FILE-UPLOAD] No data found in parsed file')
        throw new Error('No data found in file')
      }
      
      console.log('✅ [FILE-UPLOAD] File parsing stage completed successfully')
      completeStage('parsing')

      // Store the data
      console.log('🔵 [FILE-UPLOAD] Storing raw data in store:', {
        dataLength: result.data.length,
        firstRowKeys: result.data[0] ? Object.keys(result.data[0]) : [],
        sampleData: result.data.slice(0, 2),
        timestamp: new Date().toISOString()
      })
      await setRawData(result.data)
      console.log('✅ [FILE-UPLOAD] Raw data stored successfully, verifying store state...')
      
      // Verify data was stored correctly
      const storeState = useDataStore.getState()
      console.log('🔍 [FILE-UPLOAD] Store state after setRawData:', {
        hasRawData: !!storeState.rawData,
        rawDataLength: storeState.rawData?.length,
        fileName: storeState.fileName,
        isAnalyzing: storeState.isAnalyzing,
        hasAnalysis: !!storeState.analysis
      })

      // Analyze schema stage
      console.log('🔵 [FILE-UPLOAD] Starting schema analysis')
      updateStage('analyzing', { 
        status: 'active', 
        progress: 0,
        details: 'Analyzing data structure...' 
      })
      setProgressStage('Analyzing data structure...')
      
      const schema = await analyzeDataSchema(result.data, selectedFile.name, selectedFile)
      console.log('🔵 [FILE-UPLOAD] Schema analysis completed:', {
        fileName: schema.fileName,
        rowCount: schema.rowCount,
        columnCount: schema.columnCount,
        columns: schema.columns.map(c => ({ name: c.name, type: c.type, description: c.description }))
      })
      console.log('🔍 [FILE-UPLOAD] Sample column details:', schema.columns.slice(0, 3))
      setDataSchema(schema)
      console.log('✅ [FILE-UPLOAD] Schema stored successfully')
      
      // Verify schema in store
      const schemaStoreState = useDataStore.getState()
      console.log('🔍 [FILE-UPLOAD] Store schema after setting:', schemaStoreState.dataSchema?.columns?.slice(0, 3))
      
      completeStage('analyzing')
      
      // Complete stage
      console.log('🔵 [FILE-UPLOAD] Completing upload process')
      completeStage('complete')
      setUploadProgress(100)
      setProgressStage('Complete')
      
      // Record completion metrics
      const totalTime = performance.now() - startTimeRef.current
      console.log('🔵 [FILE-UPLOAD] Upload completed in:', totalTime + 'ms')
      recordMetric('upload_completed', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        rowCount: result.data.length,
        totalTime,
        success: true
      }, ['upload', 'success'])
      
      console.log('🔵 [FILE-UPLOAD] Upload processing complete, will call onUploadComplete after data validation')
      
      // Prefetch dashboard resources
      if (shouldPrefetch()) {
        console.log('🔵 [FILE-UPLOAD] Prefetching dashboard resources')
        prefetchDashboardResources()
      }
      
      // Reset analyzing state since upload is complete
      setIsAnalyzing(false)

      // Small delay to show completion before navigation
      console.log('🔵 [FILE-UPLOAD] Preparing navigation to dashboard in 500ms')
      console.log('🔍 [FILE-UPLOAD] Final store state before navigation:', {
        fileName: useDataStore.getState().fileName,
        rawDataLength: useDataStore.getState().rawData?.length,
        hasDataSchema: !!useDataStore.getState().dataSchema,
        isAnalyzing: useDataStore.getState().isAnalyzing,
        timestamp: new Date().toISOString()
      })
      
      setTimeout(() => {
        console.log('🚀 [FILE-UPLOAD] Executing navigation to /dashboard')
        const finalState = useDataStore.getState()
        console.log('🔍 [FILE-UPLOAD] Store state at navigation time:', {
          fileName: finalState.fileName,
          rawDataLength: finalState.rawData?.length,
          hasDataSchema: !!finalState.dataSchema,
          isAnalyzing: finalState.isAnalyzing,
          hasAnalysis: !!finalState.analysis
        })
        
        // Verify we have the minimum required data before navigating
        if (!finalState.rawData || finalState.rawData.length === 0) {
          console.error('❌ [FILE-UPLOAD] Cannot navigate - no raw data in store')
          setError('Upload failed - no data available')
          return
        }
        
        if (!finalState.fileName) {
          console.error('❌ [FILE-UPLOAD] Cannot navigate - no filename in store')
          setError('Upload failed - filename not set')
          return
        }
        
        console.log('✅ [FILE-UPLOAD] All data checks passed, calling onUploadComplete...')
        // Reset analyzing state before navigation
        setIsAnalyzing(false)
        // Let the parent component handle navigation
        if (onUploadComplete) {
          onUploadComplete(finalState.rawData)
        } else {
          // Default behavior: navigate to projects page
          console.log('🚀 [FILE-UPLOAD] No onUploadComplete provided, navigating to projects page')
          router.push('/projects')
        }
      }, 500)

    } catch (error) {
      console.error('❌ [FILE-UPLOAD] Error processing file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file'
      console.log('❌ [FILE-UPLOAD] Error details:', {
        errorMessage,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        currentStage: currentStage || 'unknown',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      
      // Record error metrics
      endTiming('file_upload_total', {
        success: false,
        error: errorMessage
      })
      
      recordMetric('upload_failed', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        error: errorMessage,
        stage: currentStage || 'unknown'
      }, ['upload', 'error'])
      
      // Mark current stage as error
      if (currentStage) {
        console.log('❌ [FILE-UPLOAD] Marking stage as error:', currentStage)
        errorStage(currentStage, errorMessage)
      }
      
      console.log('❌ [FILE-UPLOAD] Setting error state and cleaning up')
      setError(errorMessage)
      setUploadErrors([errorMessage])
      setIsAnalyzing(false)
      setUploadProgress(0)
      setProgressStage('')
      onUploadError?.(errorMessage)
    }
  }, [selectedFile, setFileName, setRawData, setDataSchema, setError, setIsAnalyzing, router, handleProgress, onUploadStart, onUploadComplete, onUploadError, initializeStages, updateStage, completeStage, errorStage, currentStage])

  // Function to remove selected file
  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
    setUploadErrors([])
    setUploadProgress(0)
    setProgressStage('')
    setParseDetails({})
  }, [])

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsAnalyzing(false)
    setUploadProgress(0)
    setProgressStage('')
    setParseDetails({})
  }, [setIsAnalyzing])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: isAnalyzing || disabled,
    onDropRejected: (fileRejections) => {
      const errors: string[] = []
      fileRejections.forEach((rejection) => {
        if (rejection.errors) {
          rejection.errors.forEach((error) => {
            if (error.code === 'file-too-large') {
              errors.push(`File "${rejection.file.name}" is too large (${Math.round(rejection.file.size / 1024 / 1024)}MB). Maximum size is 50MB.`)
            } else if (error.code === 'file-invalid-type') {
              errors.push(`File "${rejection.file.name}" has an invalid type. Please upload CSV or Excel files only.`)
            } else {
              errors.push(error.message)
            }
          })
        }
      })
      setUploadErrors(errors)
      if (errors.length > 0) {
        onUploadError?.(errors[0])
      }
    }
  })

  // Format time helper
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-white/60 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-8">
        {/* Show upload progress */}
        {isAnalyzing ? (
          <div className="border-2 border-dashed rounded-xl p-12 text-center border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              
              <p className="text-lg font-medium">
                Uploading data...
              </p>
            </div>
          </div>
        ) : selectedFile ? (
          /* Show file preview with upload button */
          <div className="space-y-6">
            <div className="border-2 border-green-200 rounded-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || 'Unknown type'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center space-x-3">
              <Button
                variant="outline"
                onClick={handleRemoveFile}
                className="px-6"
              >
                Choose Different File
              </Button>
              <Button
                onClick={handleUploadFile}
                className="px-8 bg-primary hover:bg-primary/90"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </Button>
            </div>
          </div>
        ) : (
          /* Show file selection area */
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer",
              !prefersReducedMotion() && "transition-all duration-200 ease-in-out",
              isDragActive ? "border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50" : "border-gray-200 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-indigo-50/50",
              isDragActive && !prefersReducedMotion() && "scale-105 shadow-lg",
              !isDragActive && !prefersReducedMotion() && "hover:shadow-md"
            )}
            style={{
              transform: isDragActive && !prefersReducedMotion() ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isDragActive && !prefersReducedMotion() 
                ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
                : undefined
            }}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full shadow-sm">
                {isDragActive ? (
                  <Upload className="h-8 w-8 text-blue-600" />
                ) : (
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                )}
              </div>
              
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? "Drop your file here" : "Drag & drop your data file"}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse • CSV, XLSX, XLS
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Maximum file size: 50MB
                </p>
              </div>
              
              <Button variant="outline" size="sm" className="mt-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300">
                Select File
              </Button>
            </div>
          </div>
        )}
        
        {/* Errors */}
        {uploadErrors.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadErrors.map((error, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}