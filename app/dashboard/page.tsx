'use client'

import React, { useEffect, useState, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Maximize2, X, BarChart3, Layout, Share2, PanelLeftClose, PanelLeft, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { analyzeData } from '@/lib/services/ai-analysis'
import { cn } from '@/lib/utils/cn'
import dynamic from 'next/dynamic'

// Use regular imports for now - the benefits of the optimizations are already implemented
import { MinimalChartWrapper } from '@/components/dashboard/minimal-chart-wrapper'
import { ResizableChatInterface } from '@/components/dashboard/chat/resizable-chat-interface'
import { AutoSaveIndicator } from '@/components/session/auto-save-indicator'
import { FlexibleDashboardLayout } from '@/components/dashboard/flexible-dashboard-layout'
import { ThemeProvider } from '@/components/dashboard/theme-provider'
import { EditableSchemaViewer } from '@/components/dashboard/editable-schema-viewer'
import { ShareDialog } from '@/components/dashboard/share-dialog'
import { useProjectStore } from '@/lib/stores/project-store'
// Removed auth imports - no longer needed for simplified flow
import { filterValidCharts } from '@/lib/utils/chart-validator'

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
    setDataSchema
  } = useDataStore()
  
  
  // const { user } = useAuth() // Removed - no longer needed
  const { getProjectData, loadProjectDataAsync, loadProject } = useProjectStore()

  const performAnalysis = React.useCallback(async (skipDuplicateCheck = false) => {
    if (!rawData || rawData.length === 0) {
      return
    }

    // Prevent multiple simultaneous analysis calls (unless we're in recovery mode)
    if (isAnalyzing && !skipDuplicateCheck) {
      return
    }

    // Get setters from store directly to avoid dependency issues
    const { setIsAnalyzing, setError, setAnalysisProgress, setUsingAI, setAnalysis } = useDataStore.getState()

    setIsAnalyzing(true)
    setError(null)
    setAnalysisProgress(0)

    try {
      const result = await analyzeData(rawData, (progress, usingAI) => {
        setAnalysisProgress(progress)
        setUsingAI(usingAI)
      })

      setAnalysis(result)

      // Reset the analysis initiated flag for future uploads
      analysisInitiatedRef.current = false

    } catch (error) {
      console.error('Analysis error:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [rawData, isAnalyzing, analysis])

  // Single consolidated effect for loading and analysis
  useEffect(() => {
    // If we have a project ID, load project data
    if (projectId) {
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
            await setRawData(projectData.rawData)

            console.log('🔍 [DASHBOARD] Loading project data:', {
              hasAnalysis: !!projectData.analysis,
              chartCount: projectData.analysis?.chartConfig?.length || 0,
              projectId
            })

            if (projectData.analysis) {
              setAnalysis(projectData.analysis)
            }
            if (projectData.dataSchema) {
              setDataSchema(projectData.dataSchema)
            }
            // Reset the analysis initiated flag when loading a project
            analysisInitiatedRef.current = false
          }
        } catch (error) {
          console.error('Failed to load project data:', error)
          const { setError } = useDataStore.getState()
          setError('Failed to load project data')
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
    if (rawData && rawData.length > 0 && !analysis && !isAnalyzing && !analysisInitiatedRef.current) {
      analysisInitiatedRef.current = true
      // Run analysis - it will use fallback charts if no API key
      performAnalysis()
    }

    // CRITICAL LOGGING: Check what the dashboard sees in analysis
    if (analysis) {
      console.log('🎨 [DASHBOARD] ===== ANALYSIS IN DASHBOARD =====')
      console.log('🎨 [DASHBOARD] analysis.chartConfig.length:', analysis?.chartConfig?.length || 0)
      console.log('🎨 [DASHBOARD] Chart titles in dashboard:', analysis?.chartConfig?.map(c => c.title).join(', '))
      console.log('🎨 [DASHBOARD] Chart types in dashboard:', analysis?.chartConfig?.map(c => c.type).join(', '))
      console.log('🎨 [DASHBOARD] ===== END ANALYSIS =====')
    }
  }, [rawData, analysis, isAnalyzing, sessionId, currentSession, projectId])

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

  const shouldShowLoading = isAnalyzing ||
                            (rawData && rawData.length > 0 && !analysis) ||
                            (fileName && !rawData) ||
                            (dataId && (!rawData || rawData.length === 0))

  if (shouldShowLoading) {
    // Determine loading message based on state
    let loadingTitle = 'Processing...'
    let loadingSubtitle = 'Please wait'

    if (dataId && (!rawData || rawData.length === 0)) {
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
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
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
            <div className="flex-1 p-8 min-h-0">
              <div className="h-full">
                <MinimalChartWrapper
                  id={showFullScreen}
                  type={fullScreenChart.type}
                  title={fullScreenChart.title}
                  description={fullScreenChart.description}
                  data={rawData}
                  dataKey={fullScreenChart.dataKey || []}
                  dataMapping={fullScreenChart.dataMapping}
                />
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
                    console.log('🔥 [DASHBOARD_PAGE] Render check:', {
                      hasAnalysis: !!analysis,
                      analysisIsNull: analysis === null,
                      analysisIsUndefined: analysis === undefined,
                      chartConfigLength: analysis?.chartConfig?.length || 0,
                      chartTitles: analysis?.chartConfig?.map(c => c.title),
                      dataLength: rawData.length,
                      willRenderDashboard: !!analysis
                    })

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