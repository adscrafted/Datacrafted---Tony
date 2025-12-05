'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useDataStore } from '@/lib/stores/data-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { cn } from '@/lib/utils/cn'
import { analyzeDataSchema } from '@/lib/utils/schema-analyzer'
import { schemaCache } from '@/lib/utils/cache-manager'
import { parseFileOptimized, cleanupFileParser, type ParseProgress } from '@/lib/utils/file-parser-optimized'
import { startTiming, endTiming, recordMetric, measureAsyncFunction } from '@/lib/utils/performance-monitor'
import { transitions, prefersReducedMotion } from '@/lib/utils/animations'
import { prefetchDashboardResources, shouldPrefetch } from '@/lib/utils/preloader'
import { logger } from '@/lib/utils/logger'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface FileUploadCoreProps {
  onUploadStart?: () => void
  onUploadComplete?: (data: any) => void
  onUploadError?: (error: string) => void
  onUploadPreparing?: () => void  // Called when upload is done but before navigation
  disabled?: boolean
  isTypingComplete?: boolean
  showLoading?: boolean  // External control to keep loading state visible
}

export function FileUploadCore({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  onUploadPreparing,
  disabled = false,
  isTypingComplete = false,
  showLoading = false
}: FileUploadCoreProps) {
  const router = useRouter()
  // Data Store selectors
  const setFileName = useDataStore(state => state.setFileName)
  const setRawData = useDataStore(state => state.setRawData)
  const setDataSchema = useDataStore(state => state.setDataSchema)
  const setError = useDataStore(state => state.setError)
  const isAnalyzing = useDataStore(state => state.isAnalyzing)
  const setIsAnalyzing = useDataStore(state => state.setIsAnalyzing)
  const setAnalysis = useDataStore(state => state.setAnalysis)
  const clearData = useDataStore(state => state.clearData)

  // UI Store selectors
  const setUploadProgress = useUIStore(state => state.setUploadProgress)
  const setUploadStage = useUIStore(state => state.setUploadStage)

  // Local progress tracking state
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
  const [autoProcessing, setAutoProcessing] = useState(false)

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
    // Update store upload progress
    setUploadProgress(progress.percentage)

    // Map progress stage to upload stage
    if (progress.stage === 'reading') {
      setUploadStage('uploading')
    } else if (progress.stage === 'parsing') {
      setUploadStage('parsing')
    }

    // Update legacy progress for compatibility
    setProgressStage(progress.stage)

    // Update detailed progress info
    setParseDetails({
      rowsProcessed: progress.rowsProcessed,
      estimatedTime: progress.estimatedTimeRemaining,
      currentChunk: progress.currentChunk,
      totalChunks: progress.totalChunks
    })

    // Calculate throughput for large files
    if (progress.rowsProcessed && startTimeRef.current) {
      const elapsed = (performance.now() - startTimeRef.current) / 1000
      const throughput = progress.rowsProcessed / elapsed
      setPerformanceMetrics(prev => ({ ...prev, throughput }))
    }
  }, [setUploadProgress, setUploadStage])

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

  // Function to handle the actual file processing
  const handleFileProcessing = useCallback(async (file: File) => {
    logger.info('[FILE-UPLOAD] Starting upload process', { fileName: file.name })

    // CRITICAL: Clear all previous data before uploading new file
    // This prevents old schema descriptions from persisting
    logger.debug('[FILE-UPLOAD] Clearing previous data from store and localStorage')
    clearData()

    // Start upload process
    setIsAnalyzing(true)
    startTimeRef.current = performance.now()
    abortControllerRef.current = new AbortController()
    logger.debug('[FILE-UPLOAD] Upload state initialized, isAnalyzing set to true')

    // Start performance monitoring
    startTiming('file_upload_total', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    }, ['upload', 'performance'])

    recordMetric('upload_started', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: Date.now()
    }, ['upload'])

    onUploadStart?.()

    try {
      // Set upload stage to uploading (stages already initialized above)
      setUploadStage('uploading')

      // Store file info
      logger.debug('[FILE-UPLOAD] Storing file name', { fileName: file.name })
      setFileName(file.name)

      // Parse file stage
      logger.info('[FILE-UPLOAD] Starting file parsing stage')
      setProgressStage('Parsing file...')

      logger.debug('[FILE-UPLOAD] Calling parseFileOptimized')
      const result = await parseFileOptimized(file, {
        onProgress: handleProgress,
        signal: abortControllerRef.current.signal
      })

      logger.info('[FILE-UPLOAD] File parsing completed', {
        rowCount: result.data.length,
        columns: result.data[0] ? Object.keys(result.data[0]) : [],
        sampleData: result.data.slice(0, 2)
      })

      if (result.data.length === 0) {
        logger.warn('[FILE-UPLOAD] No data found in parsed file')
        throw new Error('No data found in file')
      }

      logger.info('[FILE-UPLOAD] File parsing stage completed successfully')

      // CRITICAL FIX: Clear chart customizations for new uploads
      // This prevents old positions from previous projects interfering with new data
      const { clearCharts } = useChartStore.getState()
      clearCharts()
      logger.debug('[FILE-UPLOAD] Cleared previous chart customizations for fresh start')

      // Store the data
      logger.debug('[FILE-UPLOAD] Storing raw data in store', {
        dataLength: result.data.length,
        firstRowKeys: result.data[0] ? Object.keys(result.data[0]) : [],
        sampleData: result.data.slice(0, 2),
        timestamp: new Date().toISOString()
      })
      await setRawData(result.data)
      logger.info('[FILE-UPLOAD] Raw data stored successfully, verifying store state')

      // Verify data was stored correctly
      const storeState = useDataStore.getState()
      logger.debug('[FILE-UPLOAD] Store state after setRawData', {
        hasRawData: !!storeState.rawData,
        rawDataLength: storeState.rawData?.length,
        fileName: storeState.fileName,
        isAnalyzing: storeState.isAnalyzing,
        hasAnalysis: !!storeState.analysis
      })

      // Analyze schema stage
      logger.info('[FILE-UPLOAD] Starting schema analysis')
      setUploadStage('analyzing')
      setProgressStage('Analyzing data structure...')

      const schema = await analyzeDataSchema(result.data, file.name, file)
      logger.info('[FILE-UPLOAD] Schema analysis completed', {
        fileName: schema.fileName,
        rowCount: schema.rowCount,
        columnCount: schema.columnCount,
        columns: schema.columns.map(c => ({ name: c.name, type: c.type, description: c.description }))
      })
      logger.debug('[FILE-UPLOAD] Sample column details', { sampleColumns: schema.columns.slice(0, 3) })
      setDataSchema(schema)
      logger.info('[FILE-UPLOAD] Schema stored successfully')

      // Verify schema in store
      const schemaStoreState = useDataStore.getState()
      logger.debug('[FILE-UPLOAD] Store schema after setting', { sampleColumns: schemaStoreState.dataSchema?.columns?.slice(0, 3) })

      // Complete stage
      logger.info('[FILE-UPLOAD] Completing upload process')
      setUploadStage('saving')
      setProgressStage('Complete')

      // Record completion metrics
      const totalTime = performance.now() - startTimeRef.current
      logger.info('[FILE-UPLOAD] Upload completed', { totalTimeMs: totalTime })
      recordMetric('upload_completed', {
        fileName: file.name,
        fileSize: file.size,
        rowCount: result.data.length,
        totalTime,
        success: true
      }, ['upload', 'success'])

      logger.debug('[FILE-UPLOAD] Upload processing complete, will call onUploadComplete after data validation')

      // Prefetch dashboard resources
      if (shouldPrefetch()) {
        logger.debug('[FILE-UPLOAD] Prefetching dashboard resources')
        prefetchDashboardResources()
      }

      // Reset analyzing state since upload is complete
      setIsAnalyzing(false)

      // Notify parent that upload is preparing to complete
      // This allows parent to show its own loading state immediately
      onUploadPreparing?.()

      // Small delay to show completion before navigation
      logger.debug('[FILE-UPLOAD] Preparing navigation to dashboard in 500ms')
      logger.debug('[FILE-UPLOAD] Final store state before navigation', {
        fileName: useDataStore.getState().fileName,
        rawDataLength: useDataStore.getState().rawData?.length,
        hasDataSchema: !!useDataStore.getState().dataSchema,
        isAnalyzing: useDataStore.getState().isAnalyzing,
        timestamp: new Date().toISOString()
      })

      setTimeout(() => {
        const finalState = useDataStore.getState()
        logger.debug('[FILE-UPLOAD] Store state at completion time', {
          fileName: finalState.fileName,
          rawDataLength: finalState.rawData?.length,
          hasDataSchema: !!finalState.dataSchema,
          isAnalyzing: finalState.isAnalyzing,
          hasAnalysis: !!finalState.analysis
        })

        // Verify we have the minimum required data before navigating
        if (!finalState.rawData || finalState.rawData.length === 0) {
          logger.error('[FILE-UPLOAD] Cannot complete - no raw data in store')
          setError('Upload failed - no data available')
          return
        }

        if (!finalState.fileName) {
          logger.error('[FILE-UPLOAD] Cannot complete - no filename in store')
          setError('Upload failed - filename not set')
          return
        }

        logger.info('[FILE-UPLOAD] All data checks passed, calling onUploadComplete')
        // Reset analyzing state before navigation
        setIsAnalyzing(false)
        // Let the parent component handle navigation - don't navigate here
        if (onUploadComplete) {
          logger.debug('[FILE-UPLOAD] Calling onUploadComplete callback')
          onUploadComplete(finalState.rawData)
          // Do NOT navigate here - let the parent component handle it
        } else {
          // No callback provided - just log completion
          logger.info('[FILE-UPLOAD] Upload complete, no callback provided')
        }
      }, 500)

    } catch (error) {
      logger.error('[FILE-UPLOAD] Error processing file', error, {
        fileName: file.name,
        fileSize: file.size
      })
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file'

      // Record error metrics
      endTiming('file_upload_total', {
        success: false,
        error: errorMessage
      })

      recordMetric('upload_failed', {
        fileName: file.name,
        fileSize: file.size,
        error: errorMessage
      }, ['upload', 'error'])

      logger.debug('[FILE-UPLOAD] Setting error state and cleaning up')
      setError(errorMessage)
      setUploadErrors([errorMessage])
      setIsAnalyzing(false)
      setUploadProgress(0)
      setProgressStage('')
      onUploadError?.(errorMessage)
    } finally {
      setAutoProcessing(false)
    }
  }, [clearData, setFileName, setRawData, setDataSchema, setError, setIsAnalyzing, handleProgress, onUploadStart, onUploadComplete, onUploadError, onUploadPreparing, setUploadStage, setUploadProgress])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    logger.debug('[FILE-UPLOAD] onDrop triggered', {
      fileCount: acceptedFiles.length,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      timestamp: new Date().toISOString()
    })

    if (!file) {
      logger.warn('[FILE-UPLOAD] No file selected in onDrop')
      return
    }

    // Reset state
    logger.debug('[FILE-UPLOAD] Resetting upload state')
    setUploadErrors([])
    setUploadProgress(0)
    setProgressStage('')
    setParseDetails({})
    setPerformanceMetrics({ fileSize: file.size })
    // Clear previous analysis to ensure new analysis is triggered
    setAnalysis(null)
    // CRITICAL: Clear schema cache to prevent stale data
    schemaCache.clear()

    // Validate file
    logger.debug('[FILE-UPLOAD] Starting file validation')
    const validationErrors = validateFile(file)
    if (validationErrors.length > 0) {
      logger.warn('[FILE-UPLOAD] File validation failed', { validationErrors })
      setUploadErrors(validationErrors)
      setError(validationErrors[0])
      onUploadError?.(validationErrors[0])
      return
    }
    logger.info('[FILE-UPLOAD] File validation passed')

    // Set the selected file for UI display
    setSelectedFile(file)
    setAutoProcessing(true)

    // Immediately start processing
    logger.debug('[FILE-UPLOAD] Auto-processing file after validation')
    await handleFileProcessing(file)
  }, [validateFile, setError, onUploadError, setAnalysis, handleFileProcessing, setUploadProgress])

  // New handleUploadFile function that uses the selectedFile state
  const handleUploadFile = useCallback(async () => {
    if (!selectedFile) {
      logger.warn('[FILE-UPLOAD] No file selected for upload')
      return
    }
    await handleFileProcessing(selectedFile)
  }, [selectedFile, handleFileProcessing])

  // Function to remove selected file
  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
    setUploadErrors([])
    setUploadProgress(0)
    setProgressStage('')
    setParseDetails({})
  }, [setUploadProgress])

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsAnalyzing(false)
    setUploadProgress(0)
    setProgressStage('')
    setParseDetails({})
  }, [setIsAnalyzing, setUploadProgress])

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
    <div className="w-full max-w-2xl mx-auto">
      <div className="p-8">
        {/* Show upload progress */}
        {(isAnalyzing || autoProcessing || showLoading) ? (
          <div className="relative p-16 md:p-20 rounded-[2rem] bg-white/60 border-2 border-white/20 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
              </div>
              <p className="text-2xl font-semibold text-gray-800">
                Processing your file...
              </p>
            </div>
          </div>
        ) : (
          /* Show file selection area */
          <div
            {...getRootProps()}
            className={cn(
              "relative p-16 md:p-20 rounded-[2rem] cursor-pointer transition-all duration-300 transform hover:scale-[1.02]",
              isDragActive
                ? "bg-blue-50/80 border-2 border-blue-300 scale-[1.02]"
                : "bg-white/60 border-2 border-white/20 hover:bg-white/70",
              "backdrop-blur-xl shadow-2xl hover:shadow-3xl",
              isTypingComplete && "animate-glow-pulse"
            )}
          >
            <input {...getInputProps()} />
            <Upload className={cn(
              "w-16 h-16 mx-auto mb-6 transition-all duration-300",
              isDragActive ? "text-blue-500 scale-110" : "text-gray-400"
            )} />

            <p className="text-2xl font-semibold text-gray-800 mb-2">
              Drop your file here
            </p>

            <p className="text-lg text-gray-500">
              or click to browse
            </p>

            {selectedFile && !uploadErrors.length && (
              <p className="mt-4 text-sm text-gray-600">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
        )}

        {/* Error messages */}
        {uploadErrors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
            <p className="text-sm">{uploadErrors[0]}</p>
          </div>
        )}

        {/* File types and size info */}
        {!isAnalyzing && !autoProcessing && (
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400 tracking-wide">
              CSV • Excel • Google Sheets
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Maximum file size: 50MB
            </p>
          </div>
        )}
      </div>
    </div>
  )
}