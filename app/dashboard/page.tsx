'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Maximize2, X, BarChart3, Layout, Share2, PanelLeftClose, PanelLeft, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { analyzeData } from '@/lib/services/ai-analysis'
import { cn } from '@/lib/utils/cn'
import dynamic from 'next/dynamic'

// Use regular imports for now - the benefits of the optimizations are already implemented
import { ChartWrapper } from '@/components/dashboard/chart-wrapper'
import { ResizableChatInterface } from '@/components/dashboard/chat/resizable-chat-interface'
import { AutoSaveIndicator } from '@/components/session/auto-save-indicator'
import { DashboardLayoutComponent } from '@/components/dashboard/dashboard-layout'
import { ThemeProvider } from '@/components/dashboard/theme-provider'
import { TabSystem, Tab } from '@/components/dashboard/tab-system'
import { EditableSchemaViewer } from '@/components/dashboard/editable-schema-viewer'
import { ChartSettingsPanel } from '@/components/dashboard/chart-settings-panel-v3'
import { ShareDialog } from '@/components/dashboard/share-dialog'
import { useProjectStore } from '@/lib/stores/project-store'
import { useAuth } from '@/lib/contexts/auth-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { filterValidCharts } from '@/lib/utils/chart-validator'

function DashboardContent() {
  console.log('🔵 [DASHBOARD] DashboardContent component mounting/rendering')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const projectId = searchParams.get('project')
  
  console.log('🔍 [DASHBOARD] URL parameters:', {
    sessionId,
    projectId,
    timestamp: new Date().toISOString()
  })

  // Redirect to new project-based routing if project ID is provided
  // or redirect to projects page if no session/project ID
  useEffect(() => {
    if (projectId) {
      console.log('🔄 [DASHBOARD] Redirecting to new project URL:', `/projects/${projectId}`)
      router.replace(`/projects/${projectId}`)
      return
    }
    
    // If no session ID and no project ID, redirect to projects page
    if (!sessionId && !projectId) {
      console.log('🔄 [DASHBOARD] No session or project ID, redirecting to /projects')
      router.replace('/projects')
      return
    }
  }, [projectId, sessionId, router])
  const [showFullScreenChart, setShowFullScreenChart] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  
  // Toggle sidebar function
  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  // Chart settings now managed by store
  
  // Tab system state
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'dashboard-1', name: 'Dashboard', type: 'dashboard' },
    { id: 'schema', name: 'Schema', type: 'schema' }
  ])
  const [activeTabId, setActiveTabId] = useState('dashboard-1')
  
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
  
  // Log store state on every render
  console.log('🔍 [DASHBOARD] Current store state:', {
    hasFileName: !!fileName,
    fileName,
    hasRawData: !!rawData,
    rawDataLength: rawData?.length,
    hasDataId: !!dataId,
    dataId,
    hasAnalysis: !!analysis,
    isAnalyzing,
    analysisProgress,
    hasError: !!error,
    error,
    timestamp: new Date().toISOString()
  })
  
  const { user } = useAuth()
  const { getProjectData, loadProjectDataAsync, loadProject } = useProjectStore()

  const performAnalysis = React.useCallback(async (skipDuplicateCheck = false) => {
    console.log('🔵 [DASHBOARD] performAnalysis called:', {
      rawDataLength: rawData?.length,
      hasRawData: !!rawData,
      isAnalyzing,
      skipDuplicateCheck,
      timestamp: new Date().toISOString()
    })
    
    if (!rawData || rawData.length === 0) {
      console.error('❌ [DASHBOARD] Cannot perform analysis - no data available')
      return
    }
    
    // Prevent multiple simultaneous analysis calls (unless we're in recovery mode)
    if (isAnalyzing && !skipDuplicateCheck) {
      console.log('⚠️ [DASHBOARD] Analysis already in progress, skipping duplicate call')
      return
    }
    
    console.log('🚀 [DASHBOARD] Starting analysis process...')
    setIsAnalyzing(true)
    setError(null)
    setAnalysisProgress(0)
    
    try {
      console.log('🔵 [DASHBOARD] Calling analyzeData service with data:', {
        dataLength: rawData.length,
        firstRowKeys: rawData[0] ? Object.keys(rawData[0]) : [],
        sampleData: rawData.slice(0, 2)
      })
      
      const result = await analyzeData(rawData, (progress, usingAI) => {
        console.log('🔄 [DASHBOARD] Analysis progress update:', {
          progress: progress + '%',
          usingAI,
          timestamp: new Date().toISOString()
        })
        setAnalysisProgress(progress)
        setUsingAI(usingAI)
      })
      
      console.log('✅ [DASHBOARD] Analysis completed successfully:', {
        hasInsights: !!result.insights,
        insightsCount: result.insights?.length,
        hasChartConfig: !!result.chartConfig,
        chartCount: result.chartConfig?.length,
        hasSummary: !!result.summary,
        timestamp: new Date().toISOString()
      })
      
      console.log('🔄 [DASHBOARD] About to set analysis result in state...')
      setAnalysis(result)
      console.log('✅ [DASHBOARD] Analysis result stored in state')
      
      // Reset the analysis initiated flag for future uploads
      analysisInitiatedRef.current = false
      
      // Force a small delay to ensure state update completes
      setTimeout(() => {
        console.log('🔍 [DASHBOARD] Post-analysis state check:', {
          hasAnalysis: !!analysis,
          isAnalyzing: isAnalyzing,
          shouldStillShowLoading: shouldShowLoading
        })
      }, 100)
      
    } catch (error) {
      console.error('❌ [DASHBOARD] Analysis error:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      setError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      console.log('🏁 [DASHBOARD] Analysis process finished, setting isAnalyzing to false')
      setIsAnalyzing(false)
    }
  }, [rawData, setIsAnalyzing, setAnalysis, setError, setAnalysisProgress, setUsingAI])

  useEffect(() => {
    console.log('🔵 [DASHBOARD] useEffect - Initial load check:', {
      hasProjectId: !!projectId,
      hasUser: !!user,
      hasSessionId: !!sessionId,
      hasRawData: !!rawData,
      rawDataLength: rawData?.length,
      hasAnalysis: !!analysis,
      isAnalyzing,
      timestamp: new Date().toISOString()
    })
    
    // If we have a project ID, load project data
    if (projectId && user) {
      console.log('🔵 [DASHBOARD] Loading project data for projectId:', projectId)
      const loadProjectData = async () => {
        try {
          console.log('🔍 [DASHBOARD] Attempting to load project data synchronously...')
          // Try synchronous first (for small datasets in localStorage)
          let projectData = getProjectData(projectId)
          
          // If not found, try async (for large datasets in IndexedDB)
          if (!projectData) {
            console.log('🔍 [DASHBOARD] No sync data found, trying async load...')
            projectData = await loadProjectDataAsync(projectId)
          }
          
          if (projectData) {
            console.log('✅ [DASHBOARD] Project data loaded successfully:', {
              hasRawData: !!projectData.rawData,
              rawDataLength: projectData.rawData?.length,
              hasAnalysis: !!projectData.analysis,
              hasDataSchema: !!projectData.dataSchema,
              fileName: projectData.dataSchema?.fileName
            })
            setFileName(projectData.dataSchema?.fileName || 'Project Data')
            await setRawData(projectData.rawData)
            setAnalysis(projectData.analysis)
            setDataSchema(projectData.dataSchema)
          } else {
            console.log('⚠️ [DASHBOARD] No project data found for projectId:', projectId)
          }
        } catch (error) {
          console.error('❌ [DASHBOARD] Failed to load project data:', error)
          setError('Failed to load project data')
        }
      }
      
      loadProjectData()
      return
    }
    
    // If we have a session ID, load the session
    if (sessionId && !currentSession) {
      console.log('🔵 [DASHBOARD] Loading session:', sessionId)
      loadSession(sessionId)
      return
    }

    // Perform analysis if we have data but no analysis
    console.log('🔍 [DASHBOARD] Analysis trigger check:', {
      hasRawData: rawData && rawData.length > 0,
      rawDataLength: rawData?.length,
      hasAnalysis: !!analysis,
      isAnalyzing,
      shouldTriggerAnalysis: rawData && rawData.length > 0 && !analysis && !isAnalyzing,
      timestamp: new Date().toISOString()
    })
    
    if (rawData && rawData.length > 0 && !analysis && !analysisInitiatedRef.current) {
      console.log('🔄 [DASHBOARD] Marking analysis as initiated to prevent duplicates')
      analysisInitiatedRef.current = true
      
      if (isAnalyzing) {
        console.log('🔧 [DASHBOARD] Analysis flag stuck as true, resetting and starting analysis...')
        setIsAnalyzing(false)
        // Use a separate useEffect to trigger analysis after state update
        console.log('🔄 [DASHBOARD] Flag reset initiated, analysis will start in next render cycle')
      } else {
        console.log('🚀 [DASHBOARD] Triggering analysis...')
        performAnalysis()
      }
    } else if (!rawData || rawData.length === 0) {
      console.log('⚠️ [DASHBOARD] No data available for analysis')
    } else if (analysis) {
      console.log('✅ [DASHBOARD] Analysis already exists, skipping')
      // Reset isAnalyzing flag if analysis exists
      if (isAnalyzing) {
        console.log('🔧 [DASHBOARD] Analysis exists but isAnalyzing is true, resetting flag...')
        setIsAnalyzing(false)
      }
    } else if (analysisInitiatedRef.current) {
      console.log('🔄 [DASHBOARD] Analysis already initiated, skipping duplicate')
    }
  }, [rawData, analysis, router, performAnalysis, sessionId, currentSession, loadSession, isAnalyzing, projectId, user, getProjectData, loadProjectDataAsync, setFileName, setRawData, setAnalysis, setDataSchema, setError])

  // Separate effect to handle analysis after flag reset
  useEffect(() => {
    if (rawData && rawData.length > 0 && !analysis && !isAnalyzing && analysisInitiatedRef.current) {
      console.log('🚀 [DASHBOARD] Analysis flag reset complete, starting analysis...')
      performAnalysis(true) // Skip duplicate check since we're in recovery mode
    }
  }, [isAnalyzing, rawData, analysis, performAnalysis])

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
  
  // Tab management functions
  const handleTabCreate = () => {
    const newTab: Tab = {
      id: `dashboard-${Date.now()}`,
      name: `Dashboard ${tabs.filter(t => t.type === 'dashboard').length + 1}`,
      type: 'dashboard'
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
  }
  
  const handleTabDelete = (tabId: string) => {
    // Count how many dashboard tabs we have
    const dashboardTabs = tabs.filter(t => t.type === 'dashboard')
    const tabToDelete = tabs.find(t => t.id === tabId)
    
    // Prevent deleting the last dashboard
    if (tabToDelete?.type === 'dashboard' && dashboardTabs.length <= 1) {
      // Don't delete the last dashboard
      return
    }
    
    const remainingTabs = tabs.filter(t => t.id !== tabId)
    setTabs(remainingTabs)
    if (activeTabId === tabId) {
      setActiveTabId(remainingTabs[0]?.id || 'schema')
    }
  }
  
  const handleTabRename = (tabId: string, newName: string) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId ? { ...tab, name: newName } : tab
    ))
  }

  // Debug logging for the loading conditions
  console.log('🔍 [DASHBOARD] Render state check:', {
    isAnalyzing,
    hasRawData: rawData && rawData.length > 0,
    rawDataLength: rawData?.length,
    hasAnalysis: !!analysis,
    hasFileName: !!fileName,
    analysisProgress,
    usingAI,
    error,
    dataId,
    shouldShowLoading: isAnalyzing || (rawData && rawData.length > 0 && !analysis) || (fileName && !rawData),
    timestamp: new Date().toISOString()
  })

  // Consolidated loading logic - single loading screen for all states
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
      loadingSubtitle = 'Creating charts and identifying patterns'
    } else {
      loadingTitle = 'Analyzing your data...'
      loadingSubtitle = 'Calculating statistics and trends'
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <div className="space-y-2">
                <p className="text-lg font-medium">{loadingTitle}</p>
                <p className="text-sm text-muted-foreground">{loadingSubtitle}</p>
              </div>
              
              {/* Progress bar - only show for analysis */}
              {(isAnalyzing || (rawData && rawData.length > 0 && !analysis)) && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analysisProgress}% complete
                  </p>
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
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
  const fullScreenChart = showFullScreen && analysis?.chartConfig.find(c => 
    (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === showFullScreen
  )

  return (
    <ThemeProvider>
      {/* Full-screen Chart Modal */}
      {showFullScreen && fullScreenChart && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-white w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-white">
              <h2 className="text-xl font-semibold">{fullScreenChart.title}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullScreen(null)}
                className="h-10 w-10 p-0 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 p-8 bg-gray-50">
              <div className="h-full bg-white rounded-lg shadow-sm p-6">
                <ChartWrapper
                  id={showFullScreen}
                  type={fullScreenChart.type}
                  title={fullScreenChart.title}
                  description={fullScreenChart.description}
                  data={rawData}
                  dataKey={fullScreenChart.dataKey}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-screen flex flex-col transition-colors duration-200 overflow-hidden" style={{ backgroundColor: currentTheme.colors.background, color: currentTheme.colors.text }}>

        {/* Header */}
        <header className="border-b sticky top-0 z-40 transition-colors duration-200" style={{ backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.muted + '20' }}>
          <div className="w-full px-6 py-3 flex items-center justify-between">
            <div className="flex flex-col">
              {/* Logo and Breadcrumb */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <span className="text-lg font-bold">DataCrafted</span>
                </div>
                
                {/* Breadcrumb */}
                <div className="flex items-center space-x-2 text-sm" style={{ color: currentTheme.colors.muted }}>
                  <button
                    onClick={() => router.push('/projects')}
                    className="hover:text-primary transition-colors cursor-pointer"
                  >
                    Project
                  </button>
                  <span>›</span>
                  <span>{fileName}</span>
                  {currentSession && (
                    <>
                      <span>›</span>
                      <span className="font-medium" style={{ color: currentTheme.colors.text }}>
                        {currentSession.name || 'Dashboard'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              {/* New Project button below logo */}
              <div className="flex items-center space-x-3 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewUpload}
                  className="h-6 px-2 text-xs flex items-center space-x-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>New Project</span>
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <AutoSaveIndicator className="mr-2" />
              <Button
                variant={isCustomizeMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsCustomizeMode(!isCustomizeMode)
                  setIsCustomizing(!isCustomizeMode)
                }}
                className="flex items-center space-x-2"
              >
                <Grid3x3 className="h-4 w-4" />
                <span>{isCustomizeMode ? "Save" : "Customize"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareDialog(true)}
                className="flex items-center space-x-2"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content with Side-by-Side Layout */}
        <div className="flex flex-1 overflow-hidden h-full" data-dashboard-container>
          {/* Left Sidebar - Chat Interface */}
          <div 
            className={cn(
              "border-r border-gray-200 flex flex-col transition-all duration-300 h-full",
              isSidebarCollapsed ? "w-0 overflow-hidden" : ""
            )}
          >
            {!isSidebarCollapsed && <ResizableChatInterface />}
          </div>
          
          {/* Collapsed Sidebar Button */}
          {isSidebarCollapsed && (
            <div className="p-2 border-r border-gray-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0"
                title="Expand sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Right Content - Dashboard Widgets with Tabs */}
          <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ minWidth: 0 }}>
            {/* Tab System */}
            <TabSystem
              tabs={tabs}
              activeTabId={activeTabId}
              onTabChange={setActiveTabId}
              onTabCreate={handleTabCreate}
              onTabDelete={handleTabDelete}
              onTabRename={handleTabRename}
            />
            
            {/* Tab Content */}
            <main className="flex-1 overflow-y-auto h-full">
              {activeTabId === 'schema' ? (
                <EditableSchemaViewer />
              ) : (
                <div className="p-6 pb-24">
                  {/* Charts with Layout System */}
                  {analysis && (
                    <DashboardLayoutComponent 
                      analysis={analysis}
                      data={rawData}
                      className="mb-8"
                    />
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
        
        {/* Customize Mode Floating Controls */}
        {isCustomizeMode && (
          <div className="fixed bottom-6 right-6 bg-white shadow-lg rounded-lg p-3 flex items-center space-x-3 z-50 border border-gray-200">
            <div className="flex items-center space-x-2">
              <Grid3x3 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Customize Mode</span>
            </div>
            <div className="w-px h-5 bg-gray-300" />
            <p className="text-xs text-gray-600">Drag to move • Resize handles on corners</p>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setIsCustomizeMode(false)
                setIsCustomizing(false)
              }}
              className="h-7 px-3"
            >
              Save
            </Button>
          </div>
        )}
        
        {/* Global Chart Settings Panel */}
        {selectedChartId && analysis && (
          <ChartSettingsPanel
            chartId={selectedChartId}
            isOpen={showChartSettings}
            onClose={() => {
              setShowChartSettings(false)
              setSelectedChartId(null)
            }}
            chartConfig={(() => {
              const chart = analysis.chartConfig.find(c => 
                (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === selectedChartId
              )
              if (!chart) return null
              return {
                type: chart.type,
                title: chart.title,
                description: chart.description,
                dimensions: chart.type === 'pie' ? [chart.dataKey[0]] : [chart.dataKey[0]],
                metrics: chart.dataKey.slice(1),
                options: {
                  showLegend: true,
                  showGrid: true,
                  stacked: false
                }
              }
            })()}
            onConfigUpdate={(newConfig) => {
              // Update analysis with new configuration
              if (analysis) {
                const chartIndex = analysis.chartConfig.findIndex(c => 
                  (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === selectedChartId
                )
                if (chartIndex !== -1) {
                  const updatedConfig = [...analysis.chartConfig]
                  updatedConfig[chartIndex] = {
                    ...updatedConfig[chartIndex],
                    type: newConfig.type,
                    title: newConfig.title,
                    description: newConfig.description,
                    dataKey: [...newConfig.dimensions, ...newConfig.metrics]
                  }
                  setAnalysis({
                    ...analysis,
                    chartConfig: updatedConfig
                  })
                }
              }
            }}
          />
        )}
        
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