'use client'

import React, { useEffect, useState, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Maximize2, X, BarChart3, Layout, Share2, PanelLeftClose, PanelLeft, Grid3x3, LogOut, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { analyzeData } from '@/lib/services/ai-analysis'
import { cn } from '@/lib/utils/cn'
import dynamic from 'next/dynamic'

// Use regular imports for now - the benefits of the optimizations are already implemented
import { MinimalChartWrapper } from '@/components/dashboard/minimal-chart-wrapper'
import { EnhancedChartWrapper } from '@/components/dashboard/enhanced-chart-wrapper'
import { ResizableChatInterface } from '@/components/dashboard/chat/resizable-chat-interface'
import { AutoSaveIndicator } from '@/components/session/auto-save-indicator'
import { FlexibleDashboardLayout } from '@/components/dashboard/flexible-dashboard-layout'
import { ThemeProvider } from '@/components/dashboard/theme-provider'
import { EditableSchemaViewer } from '@/components/dashboard/editable-schema-viewer'
import { ShareDialog } from '@/components/dashboard/share-dialog'
import { SaveDashboardButton } from '@/components/dashboard/save-dashboard-button'
import { useProjectStore } from '@/lib/stores/project-store'
import { useAuth } from '@/lib/contexts/auth-context'
import { filterValidCharts } from '@/lib/utils/chart-validator'
import { FullscreenDataTable } from '@/components/dashboard/fullscreen-data-table'
import { ScorecardCalculationDetails } from '@/components/dashboard/scorecard-calculation-details'
import { DataCalculator, AggregationType } from '@/lib/utils/data-calculations'
import { DateRangeSelector } from '@/components/dashboard/date-range-selector'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const projectId = searchParams.get('project')
  const directId = searchParams.get('id') // New parameter for direct uploads from home page

  // Handle different routing scenarios
  useEffect(() => {
    // If coming from old project-based routing
    if (projectId) {
      router.replace(`/projects/${projectId}`)
      return
    }

    // If no session ID, no project ID, and no direct ID, check if we have data in store
    if (!sessionId && !projectId && !directId) {
      const storeData = useDataStore.getState()
      if (!storeData.rawData || storeData.rawData.length === 0) {
        router.replace('/')
        return
      }
    }
  }, [projectId, sessionId, directId, router])
  const [showFullScreenChart, setShowFullScreenChart] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [highlightedRow, setHighlightedRow] = useState<any>(null)

  // Toggle sidebar function
  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  // Chart settings now managed by store
  
  // View state - simplified to dashboard and schema toggle
  const [currentView, setCurrentView] = useState<'dashboard' | 'schema'>('dashboard')
  
  const { setIsCustomizing, selectedChartId, setSelectedChartId, showChartSettings, setShowChartSettings, updateChartCustomization } = useDataStore()
  
  // Track if analysis has been initiated to prevent multiple calls
  const analysisInitiatedRef = React.useRef(false)

  // Track which project has been loaded to prevent duplicate API calls
  const loadedProjectIdRef = React.useRef<string | null>(null)

  // Track if we're currently loading data from API
  const [isLoadingFromAPI, setIsLoadingFromAPI] = useState(false)

  // Track if we're waiting for IndexedDB to load data
  const [isWaitingForIndexedDB, setIsWaitingForIndexedDB] = useState(false)

  // Track if we're currently loading saved dashboard config
  // This prevents race condition where AI analysis triggers before config is loaded
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  
  const {
    fileName,
    rawData,
    dataId,
    analysis,
    setAnalysis,
    isAnalyzing,
    setIsAnalyzing,
    analysisProgress,
    setAnalysisProgress,
    usingAI,
    setUsingAI,
    error,
    setError,
    reset,
    currentSession,
    loadSession,
    exportSession,
    showFullScreen,
    setFullScreen,
    currentTheme,
    getFilteredData,
    setFileName,
    setRawData,
    setDataSchema,
    setShowChartTemplateGallery,
    batchUpdateChartCustomizations,
    chartCustomizations
  } = useDataStore()


  const { user, logout } = useAuth()
  const { getProjectData, loadProjectDataAsync, loadProject, setCurrentProject, saveProjectData } = useProjectStore()

  const performAnalysis = React.useCallback(async (skipDuplicateCheck = false) => {
    if (!rawData || rawData.length === 0) {
      return
    }

    // Prevent multiple simultaneous analysis calls (unless we're in recovery mode)
    if (isAnalyzing && !skipDuplicateCheck) {
      return
    }

    // Get setters from store directly to avoid dependency issues
    const { setIsAnalyzing, setError, setAnalysisProgress, setUsingAI, setAnalysis, dataSchema } = useDataStore.getState()

    setIsAnalyzing(true)
    setError(null)
    setAnalysisProgress(0)

    try {
      // CRITICAL FIX: analyzeData returns { promise, cancel }, not a Promise directly
      const { promise, cancel } = analyzeData(rawData, (progress, usingAI) => {
        setAnalysisProgress(progress)
        setUsingAI(usingAI)
      })

      // Await the promise to get the actual AnalysisResult
      const result = await promise

      setAnalysis(result)

      // Auto-save the INITIAL AI-generated analysis to database
      // This only happens for new analysis, not for user customizations
      const currentProjectId = directId || projectId
      if (currentProjectId) {
        console.log('💾 [DASHBOARD] Auto-saving initial AI analysis to database:', {
          projectId: currentProjectId,
          chartCount: result.chartConfig?.length || 0
        })

        try {
          await saveProjectData(
            currentProjectId,
            rawData,
            result,
            dataSchema || undefined
          )
          console.log('✅ [DASHBOARD] Initial analysis saved to database')
        } catch (error) {
          console.error('❌ [DASHBOARD] Failed to save initial analysis:', error)
          // Don't throw - this shouldn't block the UI
        }
      }

      // Reset the analysis initiated flag for future uploads
      analysisInitiatedRef.current = false

    } catch (error) {
      console.error('❌ [DASHBOARD] Analysis error:', error)
      // Clear any stale analysis state on error
      setAnalysis(null)
      setError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [rawData, isAnalyzing, analysis, directId, projectId, saveProjectData])

  // Single consolidated effect for loading and analysis
  useEffect(() => {
    // SIMPLIFIED: Check if we already have data in store (from upload)
    // If we have data, skip the API call and just trigger analysis
    // This restores the original pre-auth behavior

    const storeState = useDataStore.getState()
    // CRITICAL FIX: Check for both rawData AND dataId (IndexedDB reference)
    // rawData may not be immediately available after navigation because it's loaded async from IndexedDB
    // BUT: Only consider it "has data" if analysis has ACTUAL CHARTS (not empty analysis)
    const hasValidAnalysis = storeState.analysis &&
                             storeState.analysis.chartConfig &&
                             storeState.analysis.chartConfig.length > 0

    const hasDataInStore = (storeState.rawData && storeState.rawData.length > 0) ||
                           (!!storeState.dataId && hasValidAnalysis)

    console.log('🔍 [DASHBOARD] Effect running:', {
      directId,
      hasDataInStore,
      hasRawData: !!(storeState.rawData && storeState.rawData.length > 0),
      hasDataId: !!storeState.dataId,
      hasAnalysis: !!analysis,
      isAnalyzing
    })

    // If we have a directId but NO data in store, load from API
    // This handles the case where user refreshes the page or comes from a saved project
    if (directId && !hasDataInStore && loadedProjectIdRef.current !== directId) {
      console.log('🔵 [DASHBOARD] No data in store, loading from API:', directId)
      console.log('🔵 [DASHBOARD] Setting current project:', directId)
      setCurrentProject(directId)
      loadedProjectIdRef.current = directId
      setIsLoadingFromAPI(true)

      // CRITICAL: Set loading state SYNCHRONOUSLY before async operations
      // This prevents race condition where AI analysis triggers before config is loaded
      setIsLoadingConfig(true)

      const loadFromAPI = async () => {
        try {
          const { auth } = await import('@/lib/config/firebase')
          const token = await auth.currentUser?.getIdToken()

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }

          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }

          const response = await fetch(`/api/projects/${directId}/data`, {
            headers
          })

          if (!response.ok) {
            throw new Error('Failed to load project data from API')
          }

          const projectData = await response.json()
          console.log('✅ [DASHBOARD] Project data loaded from API')

          if (projectData.data && projectData.data.length > 0) {
            const { setFileName, setRawData, setAnalysis, setDataSchema } = useDataStore.getState()

            setFileName(projectData.metadata?.name || 'Project Data')

            // CRITICAL: Check for saved dashboard config BEFORE setting rawData
            // This prevents the analysis effect from triggering prematurely
            console.log('🔍 [DASHBOARD] Checking for saved dashboard config...')
            const { loadDashboardConfig } = useProjectStore.getState()
            const savedConfig = await loadDashboardConfig(directId)

            // Set this flag early to prevent AI analysis from triggering
            if (savedConfig && savedConfig.chartCustomizations && Object.keys(savedConfig.chartCustomizations).length > 0) {
              analysisInitiatedRef.current = true
              console.log('✅ [DASHBOARD] Found saved config, marking to skip AI analysis')
            }

            // Now safe to set rawData
            await setRawData(projectData.data)

            if (projectData.schema) {
              setDataSchema(projectData.schema)
            }

            if (savedConfig && savedConfig.chartCustomizations && Object.keys(savedConfig.chartCustomizations).length > 0) {
              console.log('✅ [DASHBOARD] Found saved dashboard config, applying customizations')

              // Apply saved config to the analysis
              if (projectData.analysis) {
                const updatedAnalysis = {
                  ...projectData.analysis,
                  chartConfig: projectData.analysis.chartConfig.map((chart: any) => {
                    const chartId = chart.id || `chart-${projectData.analysis.chartConfig.indexOf(chart)}`
                    const customization = savedConfig.chartCustomizations[chartId]

                    if (customization) {
                      return {
                        ...chart,
                        customization
                      }
                    }
                    return chart
                  })
                }

                setAnalysis(updatedAnalysis)

                // Mark that we don't need to run AI analysis again
                analysisInitiatedRef.current = true
                console.log('✅ [DASHBOARD] Loaded saved dashboard, skipping AI analysis')
              }

              // Restore chat messages if they exist in saved config
              if (savedConfig.chatMessages && savedConfig.chatMessages.length > 0) {
                const { setChatMessages } = useDataStore.getState()
                setChatMessages(savedConfig.chatMessages)
                console.log('✅ [DASHBOARD] Restored', savedConfig.chatMessages.length, 'chat messages from database')
              }
            } else {
              console.log('ℹ️ [DASHBOARD] No saved config found, will use default analysis')

              // Use default analysis from project data
              if (projectData.analysis) {
                setAnalysis(projectData.analysis)
                analysisInitiatedRef.current = true
              } else {
                analysisInitiatedRef.current = false
              }
            }

            // Config loading complete - clear loading state
            setIsLoadingConfig(false)
          }
        } catch (error) {
          console.error('❌ [DASHBOARD] Failed to load from API:', error)
          const { setError } = useDataStore.getState()
          setError('Failed to load project data')
          setIsLoadingConfig(false)
        } finally {
          setIsLoadingFromAPI(false)
        }
      }

      loadFromAPI()
      return // Don't continue to other loading logic
    }

    // If we have data in store (from fresh upload), mark that we've handled this directId
    if (directId && hasDataInStore && loadedProjectIdRef.current !== directId) {
      console.log('✅ [DASHBOARD] Data already in store from upload, skipping API call')
      console.log('🔵 [DASHBOARD] Setting current project:', directId)
      setCurrentProject(directId)
      loadedProjectIdRef.current = directId

      // CRITICAL: If we have dataId but no rawData, we're waiting for IndexedDB load
      if (storeState.dataId && (!storeState.rawData || storeState.rawData.length === 0)) {
        console.log('⏳ [DASHBOARD] Waiting for IndexedDB to load data...')
        setIsWaitingForIndexedDB(true)

        // Set a timeout to clear the loading state if IndexedDB doesn't respond
        setTimeout(() => {
          const currentState = useDataStore.getState()
          if (currentState.dataId && (!currentState.rawData || currentState.rawData.length === 0)) {
            console.error('❌ [DASHBOARD] IndexedDB load timed out')
            setIsWaitingForIndexedDB(false)
          }
        }, 5000)
      } else {
        setIsWaitingForIndexedDB(false)
      }
    }

    // If we have a project ID, load project data
    else if (projectId) {
      console.log('🔵 [DASHBOARD] Setting current project:', projectId)
      setCurrentProject(projectId)

      // CRITICAL: Set loading state SYNCHRONOUSLY before async operations
      // This prevents race condition where AI analysis triggers before config is loaded
      setIsLoadingConfig(true)

      const loadProjectData = async () => {
        try {
          // Try synchronous first (for small datasets in localStorage)
          let projectData = getProjectData(projectId)

          // If not found, try async (for large datasets in IndexedDB)
          if (!projectData) {
            projectData = await loadProjectDataAsync(projectId)
          }

          if (projectData && projectData.rawData && projectData.rawData.length > 0) {
            const { setFileName, setRawData, setAnalysis, setDataSchema } = useDataStore.getState()
            setFileName(projectData.dataSchema?.fileName || 'Project Data')

            console.log('🔍 [DASHBOARD] Loading project data:', {
              hasAnalysis: !!projectData.analysis,
              chartCount: projectData.analysis?.chartConfig?.length || 0,
              projectId
            })

            // CRITICAL: Check for saved dashboard config BEFORE setting rawData
            console.log('🔍 [DASHBOARD] Checking for saved dashboard config...')
            const { loadDashboardConfig } = useProjectStore.getState()
            const savedConfig = await loadDashboardConfig(projectId)

            // Set this flag early to prevent AI analysis from triggering
            if (savedConfig && savedConfig.chartCustomizations && Object.keys(savedConfig.chartCustomizations).length > 0) {
              analysisInitiatedRef.current = true
              console.log('✅ [DASHBOARD] Found saved config, marking to skip AI analysis')
            }

            // Now safe to set rawData
            await setRawData(projectData.rawData)

            if (savedConfig && savedConfig.chartCustomizations && Object.keys(savedConfig.chartCustomizations).length > 0) {
              console.log('✅ [DASHBOARD] Found saved dashboard config, applying customizations')

              // Apply saved config to the analysis
              if (projectData.analysis) {
                const updatedAnalysis = {
                  ...projectData.analysis,
                  chartConfig: projectData.analysis.chartConfig.map((chart: any) => {
                    const chartId = chart.id || `chart-${projectData.analysis.chartConfig.indexOf(chart)}`
                    const customization = savedConfig.chartCustomizations[chartId]

                    if (customization) {
                      return {
                        ...chart,
                        customization
                      }
                    }
                    return chart
                  })
                }

                setAnalysis(updatedAnalysis)
                analysisInitiatedRef.current = true
                console.log('✅ [DASHBOARD] Loaded saved dashboard, skipping AI analysis')
              }

              // Restore chat messages if they exist in saved config
              if (savedConfig.chatMessages && savedConfig.chatMessages.length > 0) {
                const { setChatMessages } = useDataStore.getState()
                setChatMessages(savedConfig.chatMessages)
                console.log('✅ [DASHBOARD] Restored', savedConfig.chatMessages.length, 'chat messages from database')
              }
            } else {
              console.log('ℹ️ [DASHBOARD] No saved config found, will use default analysis')

              // Use default analysis from project data
              if (projectData.analysis) {
                setAnalysis(projectData.analysis)
                analysisInitiatedRef.current = true
              } else {
                analysisInitiatedRef.current = false
              }
            }

            if (projectData.dataSchema) {
              setDataSchema(projectData.dataSchema)
            }

            // Config loading complete - clear loading state
            setIsLoadingConfig(false)
          }
        } catch (error) {
          console.error('Failed to load project data:', error)
          const { setError } = useDataStore.getState()
          setError('Failed to load project data')
          setIsLoadingConfig(false)
        }
      }

      loadProjectData()
      return
    }

    // If we have a session ID, load the session
    if (sessionId && !currentSession) {
      loadSession(sessionId)
      return
    }

    // Perform analysis if we have data but no analysis (only once)
    // CRITICAL: Don't trigger if we're loading config - prevents race condition
    if (rawData && rawData.length > 0 && !analysis && !isAnalyzing && !analysisInitiatedRef.current && !isLoadingConfig) {
      analysisInitiatedRef.current = true
      // Run analysis - it will use fallback charts if no API key
      performAnalysis()
    }

    // Only log analysis once when it first loads (not on every render)
    // Removed excessive logging to reduce console noise
  }, [rawData, analysis, isAnalyzing, sessionId, currentSession, projectId, directId, isLoadingConfig])

  // Auto-open chat interface when on dashboard
  useEffect(() => {
    const store = useDataStore.getState()
    if (!store.isChatOpen) {
      store.setIsChatOpen(true)
    }
  }, [])
  
  // Make toggle function available globally for the chat interface
  useEffect(() => {
    // Store the toggle function on the window object for the chat to access
    (window as any).__toggleDashboardSidebar = toggleSidebar
    
    // Also set up event listener for custom events
    const handleToggleSidebar = () => {
      toggleSidebar()
    }
    
    window.addEventListener('toggle-dashboard-sidebar', handleToggleSidebar)
    
    return () => {
      window.removeEventListener('toggle-dashboard-sidebar', handleToggleSidebar)
      delete (window as any).__toggleDashboardSidebar
    }
  }, [toggleSidebar])
  
  // Note: Chart settings now only open when gear icon is clicked, not on chart selection

  const handleNewUpload = () => {
    reset()
    router.push('/projects')
  }

  // Handle reset layout - trigger via custom event that FlexibleDashboardLayout listens to
  const handleResetLayout = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('reset-dashboard-layout'))
  }, [])
  


  // Consolidated loading logic - single loading screen for all states
  // Rotating loading messages (Claude-style)
  const loadingMessages = useMemo(() => [
    'Jimmying the lock on your data patterns...',
    'Convincing the charts to play nicely...',
    'Teaching the AI about your business logic...',
    'Bribing the algorithms with coffee...',
    'Negotiating with stubborn data points...',
    'Polishing the crystal ball...',
    'Consulting the data spirits...',
    'Calibrating the insight-o-meter...',
    'Herding the data cats...',
    'Untangling spaghetti code from yesterday...',
    'Asking the data nicely to make sense...',
    'Reverse-engineering your spreadsheet chaos...',
    'Translating Excel-speak to human...',
    'Summoning the chart wizards...',
    'Decoding the hidden patterns...',
    'Convincing the scatter plot to scatter...',
    'Waking up the sleeping algorithms...',
    'Finding needles in your data haystack...',
    'Teaching charts to read between the lines...',
    'Optimizing for maximum insight density...',
    'Compiling the dashboard magic...',
    'Reticulating data splines...',
    'Applying machine learning duct tape...',
    'Debugging the universe, one chart at a time...',
  ], [])

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [lastProgressTrigger, setLastProgressTrigger] = useState(0)

  // Get filtered data for fullscreen display (must be before any conditional returns)
  const filteredData = useMemo(() => {
    const data = getFilteredData()
    console.log('📊 [Dashboard] Filtered data for fullscreen:', {
      dataLength: data?.length || 0,
      hasData: !!data && data.length > 0,
      sampleRow: data?.[0]
    })
    return data
  }, [getFilteredData])

  // Update message only when progress increases by 10% or more
  useEffect(() => {
    if (usingAI && isAnalyzing) {
      const progressTrigger = Math.floor(analysisProgress / 10) * 10
      if (progressTrigger > lastProgressTrigger && progressTrigger >= 10) {
        setLastProgressTrigger(progressTrigger)
        setCurrentMessageIndex(prev => (prev + 1) % loadingMessages.length)
      }
    } else {
      // Reset when not analyzing
      setLastProgressTrigger(0)
    }
  }, [analysisProgress, usingAI, isAnalyzing, loadingMessages.length, lastProgressTrigger])

  // Clear IndexedDB waiting state when rawData loads
  useEffect(() => {
    if (rawData && rawData.length > 0 && isWaitingForIndexedDB) {
      console.log('✅ [DASHBOARD] IndexedDB data loaded, clearing wait state')
      setIsWaitingForIndexedDB(false)
    }
  }, [rawData, isWaitingForIndexedDB])

  // Debug loading conditions
  const shouldShowLoading = isLoadingFromAPI ||
                            isWaitingForIndexedDB ||
                            isLoadingConfig ||
                            isAnalyzing ||
                            (rawData && rawData.length > 0 && !analysis) ||
                            (fileName && !rawData) ||
                            (dataId && (!rawData || rawData.length === 0))

  // Removed excessive loading state logging to reduce console noise

  if (shouldShowLoading) {
    // Determine loading message based on state
    let loadingTitle = 'Processing...'
    let loadingSubtitle = 'Please wait'

    if (isLoadingFromAPI) {
      loadingTitle = 'Loading your project...'
      loadingSubtitle = 'Retrieving data from database'
    } else if (isLoadingConfig) {
      loadingTitle = 'Loading saved dashboard...'
      loadingSubtitle = 'Retrieving your customizations'
    } else if (isWaitingForIndexedDB) {
      loadingTitle = 'Loading your data...'
      loadingSubtitle = 'Retrieving from browser storage'
    } else if (dataId && (!rawData || rawData.length === 0)) {
      loadingTitle = 'Loading your data...'
      loadingSubtitle = 'Retrieving from secure storage'
    } else if (!rawData) {
      loadingTitle = 'Uploading data...'
      loadingSubtitle = 'Reading and validating file format'
    } else if (usingAI) {
      loadingTitle = 'AI-powered analysis in progress...'
      loadingSubtitle = loadingMessages[currentMessageIndex]
    } else {
      loadingTitle = 'Analyzing your data...'
      loadingSubtitle = 'Calculating statistics and trends'
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Card className="w-full max-w-md bg-gray-800/50 border-gray-700">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <Loader2 className="h-12 w-12 text-white animate-spin mx-auto" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-white">{loadingTitle}</p>
                <p className="text-sm text-gray-400">{loadingSubtitle}</p>
              </div>

              {/* Progress bar - only show for analysis */}
              {(isAnalyzing || (rawData && rawData.length > 0 && !analysis)) && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-300"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {analysisProgress}% complete
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-md">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If we reach here and still don't have data or analysis, show empty state
  if ((!rawData || rawData.length === 0) && !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <p className="text-lg font-medium">No Data Available</p>
              <p className="text-sm text-muted-foreground">
                Please upload a file to view your dashboard.
              </p>
              <Button onClick={handleNewUpload} className="mt-4">
                Upload Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Full-screen chart modal
  const fullScreenChart = showFullScreen && analysis?.chartConfig?.find((c: any) =>
    (c.id || `chart-${analysis.chartConfig?.indexOf(c) ?? -1}`) === showFullScreen
  )

  return (
    <ThemeProvider>
      {/* Full-screen Chart Modal */}
      {showFullScreen && fullScreenChart && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-white w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header - Fixed height */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{fullScreenChart.title}</h1>
                {fullScreenChart.description && (
                  <p className="text-gray-500 mt-1">{fullScreenChart.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullScreen(null)}
                className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content Area - Flexible layout with proper scrolling */}
            <div className="flex-1 flex flex-col p-8 gap-4 min-h-0 overflow-auto">
              {/* Chart Section - 65% height for regular charts, hidden for scorecards */}
              {fullScreenChart.type !== 'scorecard' && (
                <div className="flex-shrink-0 overflow-hidden" style={{ height: '65%' }}>
                  <EnhancedChartWrapper
                    id={showFullScreen}
                    type={fullScreenChart.type}
                    title={fullScreenChart.title}
                    description={fullScreenChart.description}
                    data={filteredData}
                    dataKey={fullScreenChart.dataKey || []}
                    configDataMapping={fullScreenChart.dataMapping}
                    customization={(fullScreenChart as any).customization}
                    isDragging={false}
                    isSelected={false}
                    onDataPointClick={(dataPoint) => {
                      console.log('🔵 [DASHBOARD] Data point clicked:', dataPoint)
                      console.log('🔵 [DASHBOARD] Chart type:', fullScreenChart.type)

                      // For aggregated charts, we need to pass the category/x-axis key
                      // so the table can scroll to the first matching row
                      const effectiveMapping = {
                        ...fullScreenChart.dataMapping,
                        ...(fullScreenChart as any).customization?.dataMapping
                      }
                      const xKey = effectiveMapping?.xAxis || effectiveMapping?.category

                      console.log('🔵 [DASHBOARD] Category key:', xKey)
                      console.log('🔵 [DASHBOARD] Setting highlightedRow:', { ...dataPoint, __categoryKey: xKey })

                      setHighlightedRow({ ...dataPoint, __categoryKey: xKey })
                    }}
                  />
                </div>
              )}

              {/* Scorecard Calculation Details - Only shown for scorecards, compact design */}
              {fullScreenChart.type === 'scorecard' && (() => {
                // Calculate the values used in the scorecard
                const customization = (fullScreenChart as any).customization
                const dataMapping = fullScreenChart.dataMapping

                // Get effective data mapping (merge config and customization)
                const effectiveMapping = {
                  ...dataMapping,
                  ...customization?.dataMapping
                }

                const aggregationType = (customization?.aggregation || effectiveMapping?.aggregation || 'sum') as AggregationType

                // Process formula-based scorecards using the chart data processor (same as dashboard view)
                let processedData = filteredData
                if (effectiveMapping.formula && effectiveMapping.formulaAlias) {
                  try {
                    const { processChartData } = require('@/lib/utils/chart-data-processor')
                    const processed = processChartData(filteredData, 'scorecard', effectiveMapping)
                    processedData = processed.data
                    console.log(`📊 [FULLSCREEN_FORMULA_DEBUG] ${fullScreenChart.title}:`, {
                      formula: effectiveMapping.formula,
                      formulaAlias: effectiveMapping.formulaAlias,
                      result: processedData[0],
                      metadata: processed.metadata
                    })
                  } catch (error) {
                    console.error(`❌ [FULLSCREEN_FORMULA_ERROR] ${fullScreenChart.title}:`, error)
                  }
                }

                const metric = effectiveMapping?.formulaAlias || effectiveMapping?.metric || fullScreenChart.dataKey?.[0] || 'value'

                // Calculate the result - check if formula-based scorecard is already aggregated
                let result = 0
                let values: number[] = []

                // Check if this is formula-based scorecard that's already been processed
                // Formula processing returns a single row with the calculated value
                if (effectiveMapping.formula && effectiveMapping.formulaAlias && processedData.length === 1 && (processedData[0] as any)._calculationType === 'formula') {
                  // Data is already aggregated - use the value directly
                  const val = processedData[0][metric]
                  result = typeof val === 'number' ? val : 0
                  values = [result] // For display purposes
                } else {
                  // For non-formula scorecards, use the shared calculation function
                  // This ensures consistency with the card view
                  const { calculateScorecardValue } = require('@/lib/utils/data-calculations')
                  result = calculateScorecardValue(processedData, metric, aggregationType) || 0

                  // DEBUG: Log calculation details to compare with card calculation
                  console.log(`🔍 [FULLSCREEN_CALC_DEBUG] ${fullScreenChart.title}:`, {
                    processedDataLength: processedData.length,
                    metric,
                    aggregationType,
                    result,
                    sampleValues: processedData.slice(0, 5).map(row => ({ [metric]: row[metric] }))
                  })

                  // Extract values for display in calculation details
                  const parseNumericValue = (val: any): number => {
                    if (typeof val === 'number') return val
                    if (typeof val !== 'string') return 0
                    const cleaned = String(val).replace(/[€$£¥,\s%]/g, '')
                    const num = parseFloat(cleaned)
                    return isNaN(num) ? 0 : num
                  }

                  values = processedData
                    .map(row => parseNumericValue(row[metric]))
                    .filter(v => !isNaN(v) && v !== null && v !== undefined)
                }

                return (
                  <div className="flex-shrink-0 mb-2">
                    <ScorecardCalculationDetails
                      aggregationType={aggregationType}
                      metric={metric}
                      values={values}
                      result={result}
                    />
                  </div>
                )
              })()}

              {/* Data Table Section - Takes remaining space with scrolling */}
              <div className={cn(
                "flex flex-col min-h-0 flex-1",
                fullScreenChart.type !== 'scorecard' && "border-t pt-4"
              )}>
                <div className="mb-3 flex-shrink-0">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {fullScreenChart.type === 'scorecard' ? 'Underlying Data' : 'Underlying Data'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {fullScreenChart.type === 'scorecard'
                      ? 'Complete dataset used to calculate this metric'
                      : 'Data used to generate this chart'}
                  </p>
                </div>
                <div className="border rounded-lg overflow-hidden bg-white flex-1 min-h-0">
                  <FullscreenDataTable
                    chartType={fullScreenChart.type}
                    data={filteredData}
                    dataMapping={fullScreenChart.dataMapping}
                    dataKey={fullScreenChart.dataKey}
                    highlightedRow={highlightedRow}
                    onHighlightComplete={() => setHighlightedRow(null)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-screen flex flex-col transition-colors duration-200 overflow-hidden" style={{ backgroundColor: currentTheme.colors.background, color: currentTheme.colors.text }}>

        {/* Simplified Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="w-full px-8 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="text-base font-semibold text-gray-900">{fileName}</span>
              </div>

              {/* Minimal navigation */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    currentView === 'dashboard'
                      ? "text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('schema')}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    currentView === 'schema'
                      ? "text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Data
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Date Range Selector - only shows if date columns detected */}
              <DateRangeSelector />

              {/* Add Chart Button */}
              <Button
                onClick={() => setShowChartTemplateGallery(true)}
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Chart
              </Button>

              {/* Reset Layout Button */}
              <Button
                onClick={handleResetLayout}
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Layout
              </Button>

              {/* Save Dashboard Button */}
              <SaveDashboardButton />

              {/* User Management */}
              {user && (
                <div className="hidden sm:flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-50 mr-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-sm font-medium">
                    {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewUpload}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareDialog(true)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Share2 className="h-4 w-4" />
              </Button>

              {/* Logout Button */}
              {user && (
                <Button
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Layout */}
        <div className="flex flex-1 overflow-hidden h-full" data-dashboard-container>
          {/* Minimal Collapsible Sidebar */}
          {isSidebarCollapsed ? (
            <div className="border-r border-gray-200/60 flex flex-col h-full bg-white/50 w-14 transition-all duration-300">
              <div className="p-4 border-b border-gray-200/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="Expand insights"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-r border-gray-200/60 flex flex-col h-full bg-white/50">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200/60">
                <span className="text-sm font-medium text-gray-700">Insights</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="Collapse insights"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>

              {/* Sidebar Content - Resizable */}
              <div className="flex-1 overflow-hidden">
                <ResizableChatInterface />
              </div>
            </div>
          )}

          {/* Right Content - Clean Dashboard */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/30">
            <main className="flex-1 overflow-y-auto h-full">
              {currentView === 'schema' ? (
                <div className="p-8">
                  <EditableSchemaViewer />
                </div>
              ) : (
                <div className="p-8 pb-24">
                  {/* Enhanced Flexible Dashboard Layout */}
                  {(() => {
                    if (!analysis) {
                      console.warn('⚠️ [DASHBOARD_PAGE] Analysis is falsy - showing empty state instead of dashboard')
                      return (
                        <div className="flex items-center justify-center py-32">
                          <div className="text-center space-y-4">
                            <h3 className="text-xl font-semibold text-gray-900">No analysis available</h3>
                            <p className="text-gray-500">Waiting for analysis to complete...</p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <FlexibleDashboardLayout
                        analysis={analysis}
                        data={rawData}
                        className=""
                      />
                    )
                  })()}
                </div>
              )}
            </main>
          </div>
        </div>
        
        
        {/* Share Dialog */}
        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
        />
      </div>
    </ThemeProvider>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}