'use client'

import React, { useEffect, useState, Suspense, useCallback, lazy, useMemo } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, BarChart3, Share2, PanelLeft, Grid3x3, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'
import { logger } from '@/lib/utils/logger'
import dynamic from 'next/dynamic'

// Lazy load heavy components for better initial load performance
const ChartWrapper = lazy(() => import('@/components/dashboard/chart-wrapper').then(m => ({ default: m.ChartWrapper })))
const ResizableChatInterfaceWithTabs = lazy(() => import('@/components/dashboard/chat/resizable-chat-interface-with-tabs').then(m => ({ default: m.ResizableChatInterfaceWithTabs })))
const DashboardLayoutComponent = lazy(() => import('@/components/dashboard/dashboard-layout').then(m => ({ default: m.DashboardLayoutComponent })))
const EditableSchemaViewer = lazy(() => import('@/components/dashboard/editable-schema-viewer').then(m => ({ default: m.EditableSchemaViewer })))
const TabSystem = lazy(() => import('@/components/dashboard/tab-system').then(m => ({ default: m.TabSystem })))
const ShareDialog = lazy(() => import('@/components/dashboard/share-dialog').then(m => ({ default: m.ShareDialog })))
const ChartSettingsPanel = lazy(() => import('@/components/dashboard/chart-settings-panel-v3').then(m => ({ default: m.ChartSettingsPanel })))

// Dynamic imports for providers - no SSR
const DashboardTabProvider = dynamic(() => import('@/lib/contexts/dashboard-tab-context').then(m => ({ default: m.DashboardTabProvider })), { ssr: false })
const ThemeProvider = dynamic(() => import('@/components/dashboard/theme-provider').then(m => ({ default: m.ThemeProvider })), { ssr: false })
const AutoSaveIndicator = dynamic(() => import('@/components/session/auto-save-indicator').then(m => ({ default: m.AutoSaveIndicator })), { ssr: false })

import { Tab } from '@/components/dashboard/tab-system'
import { useProjectStore } from '@/lib/stores/project-store'
import { useAuth } from '@/lib/contexts/auth-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { scheduleIdleTask } from '@/lib/utils/request-idle'
import { ProjectCache } from '@/lib/utils/project-cache'

// Loading skeleton components for better perceived performance
const DashboardSkeleton = () => (
  <div className="p-6 space-y-4">
    <div className="grid grid-cols-2 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  </div>
)

const ChatSkeleton = () => (
  <div className="w-full h-full bg-gray-50 animate-pulse" />
)

function ProjectDashboardContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  
  const projectId = params.projectId as string
  const tabParam = searchParams.get('tab') || 'dashboard-1'
  
  logger.log('🔍 [PROJECT_DASHBOARD] URL parameters:', {
    projectId,
    tab: tabParam
  })

  const [showFullScreenChart, setShowFullScreenChart] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  
  // Toggle sidebar function
  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])
  
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  // Chart settings now managed by store
  
  // Tab system state - initialize with URL parameter
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'dashboard-1', name: 'Dashboard', type: 'dashboard', data: { hasAnalysis: true } },
    { id: 'schema', name: 'Schema', type: 'schema' }
  ])
  const [activeTabId, setActiveTabId] = useState(tabParam)
  
  // Move useDataStore call before tabAnalyses to access analysis
  // Use stable selectors to prevent infinite loops
  const fileName = useDataStore(state => state.fileName)
  const rawData = useDataStore(state => state.rawData)
  const dataId = useDataStore(state => state.dataId)
  const analysis = useDataStore(state => state.analysis)
  const isAnalyzing = useDataStore(state => state.isAnalyzing)
  const analysisProgress = useDataStore(state => state.analysisProgress)
  const usingAI = useDataStore(state => state.usingAI)
  const error = useDataStore(state => state.error)
  const currentTheme = useDataStore(state => state.currentTheme)
  const showFullScreen = useDataStore(state => state.showFullScreen)
  const selectedChartId = useDataStore(state => state.selectedChartId)
  const showChartSettings = useDataStore(state => state.showChartSettings)
  
  // Store actions (these are stable references)
  const setAnalysis = useDataStore(state => state.setAnalysis)
  const setIsAnalyzing = useDataStore(state => state.setIsAnalyzing)
  const setAnalysisProgress = useDataStore(state => state.setAnalysisProgress)
  const setUsingAI = useDataStore(state => state.setUsingAI)
  const setError = useDataStore(state => state.setError)
  const reset = useDataStore(state => state.reset)
  const setFullScreen = useDataStore(state => state.setFullScreen)
  const setFileName = useDataStore(state => state.setFileName)
  const setRawData = useDataStore(state => state.setRawData)
  const setDataSchema = useDataStore(state => state.setDataSchema)
  const setIsCustomizing = useDataStore(state => state.setIsCustomizing)
  const setSelectedChartId = useDataStore(state => state.setSelectedChartId)
  const setShowChartSettings = useDataStore(state => state.setShowChartSettings)
  const updateChartCustomization = useDataStore(state => state.updateChartCustomization)
  const saveCurrentSession = useDataStore(state => state.saveCurrentSession)
  
  // Use ref for tab analyses to avoid re-renders
  const tabAnalysesRef = React.useRef<Record<string, any>>({
    'dashboard-1': analysis
  })
  
  // Track if analysis has been initiated to prevent multiple calls
  const analysisInitiatedRef = React.useRef(false)
  
  // Use IndexedDB for caching instead of sessionStorage
  
  const { user } = useAuth()
  const { getProjectData, loadProjectDataAsync, loadProject } = useProjectStore()

  // Update URL when tab changes - optimized to prevent re-renders
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    // Use replaceState instead of router.push to avoid re-renders
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tabId)
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [])

  const performAnalysis = React.useCallback(async (skipDuplicateCheck = false) => {
    if (!rawData || rawData.length === 0 || (isAnalyzing && !skipDuplicateCheck)) {
      return
    }
    
    setIsAnalyzing(true)
    setError(null)
    setAnalysisProgress(0)
    
    try {
      // Dynamically import analyzeData to reduce initial bundle
      const { analyzeData } = await import('@/lib/services/ai-analysis')
      
      const result = await analyzeData(rawData, (progress, usingAI) => {
        setAnalysisProgress(progress)
        setUsingAI(usingAI)
      })
      
      setAnalysis(result)
      tabAnalysesRef.current['dashboard-1'] = result
      analysisInitiatedRef.current = false
      
    } catch (error) {
      logger.error('Analysis error:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [rawData, isAnalyzing, setIsAnalyzing, setError, setAnalysisProgress, setUsingAI, setAnalysis])

  useEffect(() => {
    if (!projectId || !user) return
    
    let cancelled = false
    
    const loadProjectData = async () => {
      try {
        // Check IndexedDB cache first (metadata only)
        const cached = await ProjectCache.get(projectId)
        if (cached) {
          logger.log('Using cached metadata')
          setFileName(cached.fileName)
          setAnalysis(cached.analysis)
          setDataSchema(cached.dataSchema)
          if (cached.analysis) {
            tabAnalysesRef.current['dashboard-1'] = cached.analysis
          }
          // Note: We still need to load raw data from storage
        }
        
        // Load from storage
        const projectData = await loadProjectDataAsync(projectId)
        if (cancelled) return
        
        if (projectData) {
          const project = await loadProject(projectId)
          if (cancelled) return
          
          const projectName = project?.name || 'Project Data'
          
          // Update state
          setFileName(projectName)
          await setRawData(projectData.rawData)
          setAnalysis(projectData.analysis)
          setDataSchema(projectData.dataSchema)
          
          // Cache metadata in IndexedDB
          await ProjectCache.set(projectId, {
            fileName: projectName,
            analysis: projectData.analysis,
            dataSchema: projectData.dataSchema,
            rowCount: projectData.rawData?.length || 0
          })
          
          if (projectData.analysis) {
            tabAnalysesRef.current['dashboard-1'] = projectData.analysis
          }
        } else {
          router.push('/projects')
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Failed to load project:', error)
          setError('Failed to load project data')
        }
      }
    }
    
    // Schedule for idle time
    scheduleIdleTask('load-project-data', loadProjectData, 'high')
    
    return () => {
      cancelled = true
    }
  }, [projectId, user, loadProjectDataAsync, loadProject, router, setFileName, setRawData, setAnalysis, setDataSchema, setError])

  // Perform analysis if we have data but no analysis - schedule for idle time
  useEffect(() => {
    logger.log('🔍 [PROJECT_DASHBOARD] Analysis trigger check:', {
      hasRawData: rawData && rawData.length > 0,
      rawDataLength: rawData?.length,
      hasAnalysis: !!analysis,
      isAnalyzing,
      analysisInitiated: analysisInitiatedRef.current,
      shouldTriggerAnalysis: rawData && rawData.length > 0 && !analysis && !analysisInitiatedRef.current,
      timestamp: new Date().toISOString()
    })
    
    if (rawData && rawData.length > 0 && !analysis && !analysisInitiatedRef.current) {
      logger.log('🔄 [PROJECT_DASHBOARD] Marking analysis as initiated to prevent duplicates')
      analysisInitiatedRef.current = true
      
      if (isAnalyzing) {
        logger.log('🔧 [PROJECT_DASHBOARD] Analysis flag stuck as true, resetting and starting analysis...')
        setIsAnalyzing(false)
        // Use a timeout to trigger analysis after state update
        setTimeout(() => {
          logger.log('🚀 [PROJECT_DASHBOARD] Triggering analysis after flag reset...')
          performAnalysis(true)
        }, 100)
      } else {
        // Schedule analysis for idle time
        scheduleIdleTask('perform-analysis', () => performAnalysis(), 'high')
      }
    } else if (!rawData || rawData.length === 0) {
      logger.log('⚠️ [PROJECT_DASHBOARD] No data available for analysis')
    } else if (analysis) {
      logger.log('✅ [PROJECT_DASHBOARD] Analysis already exists, skipping')
    } else if (analysisInitiatedRef.current) {
      logger.log('🔄 [PROJECT_DASHBOARD] Analysis already initiated, skipping duplicate')
    }
  }, [rawData, analysis, isAnalyzing, performAnalysis, setIsAnalyzing])

  // Auto-open chat interface when on dashboard
  useEffect(() => {
    const store = useDataStore.getState()
    if (!store.isChatOpen) {
      store.setIsChatOpen(true)
    }
  }, [])
  
  // Make toggle function available globally for the chat interface
  useEffect(() => {
    (window as any).__toggleDashboardSidebar = toggleSidebar
    
    const handleToggleSidebar = () => {
      toggleSidebar()
    }
    
    window.addEventListener('toggle-dashboard-sidebar', handleToggleSidebar)
    
    return () => {
      window.removeEventListener('toggle-dashboard-sidebar', handleToggleSidebar)
      delete (window as any).__toggleDashboardSidebar
    }
  }, [toggleSidebar])
  
  // Chart settings now only open when gear icon is clicked, not on chart selection

  const handleNewUpload = useCallback(() => {
    reset()
    router.push('/projects')
  }, [reset, router])
  
  const handleProjectsClick = useCallback(() => {
    router.push('/projects')
  }, [router])
  
  // Tab management functions
  const handleTabCreate = useCallback(() => {
    // Check if we've reached the maximum of 5 tabs
    if (tabs.length >= 5) {
      return
    }
    
    const newTab: Tab = {
      id: `dashboard-${Date.now()}`,
      name: `Dashboard ${tabs.filter(t => t.type === 'dashboard').length + 1}`,
      type: 'dashboard',
      data: { hasAnalysis: false } // Mark as empty dashboard
    }
    
    // Create an empty analysis for the new tab
    tabAnalysesRef.current[newTab.id] = null
    
    setTabs([...tabs, newTab])
    handleTabChange(newTab.id)
  }, [tabs, handleTabChange])
  
  const handleTabDelete = useCallback((tabId: string) => {
    // Count how many dashboard tabs we have
    const dashboardTabs = tabs.filter(t => t.type === 'dashboard')
    const tabToDelete = tabs.find(t => t.id === tabId)
    
    // Prevent deleting the last dashboard
    if (tabToDelete?.type === 'dashboard' && dashboardTabs.length <= 1) {
      return
    }
    
    const remainingTabs = tabs.filter(t => t.id !== tabId)
    setTabs(remainingTabs)
    
    // Remove the analysis for the deleted tab
    delete tabAnalysesRef.current[tabId]
    
    if (activeTabId === tabId) {
      const newActiveTab = remainingTabs[0]?.id || 'schema'
      handleTabChange(newActiveTab)
    }
  }, [tabs, activeTabId, handleTabChange])
  
  const handleTabRename = useCallback((tabId: string, newName: string) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId ? { ...tab, name: newName } : tab
    ))
  }, [tabs])
  
  const handleTabReorder = useCallback((newTabs: Tab[]) => {
    setTabs(newTabs)
  }, [])

  // Manual trigger for stuck analysis
  const handleManualAnalysis = useCallback(() => {
    logger.log('🔧 [PROJECT_DASHBOARD] Manual analysis trigger')
    analysisInitiatedRef.current = false
    setIsAnalyzing(false)
    performAnalysis(true)
  }, [setIsAnalyzing, performAnalysis])
  
  const handleCustomizeToggle = useCallback(() => {
    const newMode = !isCustomizeMode
    setIsCustomizeMode(newMode)
    setIsCustomizing(newMode)
  }, [isCustomizeMode, setIsCustomizing])
  
  const handleCustomizeSave = useCallback(async () => {
    // Save the current session with customizations
    await saveCurrentSession()
    setIsCustomizeMode(false)
    setIsCustomizing(false)
  }, [setIsCustomizing, saveCurrentSession])
  
  const handleCreateNewChart = useCallback(() => {
    if (!analysis || !rawData || rawData.length === 0) return
    
    // Create a new chart config
    const newChartId = `chart-custom-${Date.now()}`
    const newChart = {
      id: newChartId,
      type: 'bar' as const, // Default to bar chart
      title: 'New Chart',
      description: 'Click settings to customize this chart',
      dataKey: Object.keys(rawData[0]).slice(0, 2), // Use first two columns as default
    }
    
    // Add the new chart to the analysis
    const updatedAnalysis = {
      ...analysis,
      chartConfig: [...analysis.chartConfig, newChart]
    }
    setAnalysis(updatedAnalysis)
    
    // Open chart settings for the new chart
    setSelectedChartId(newChartId)
    setShowChartSettings(true)
  }, [analysis, rawData, setAnalysis, setSelectedChartId, setShowChartSettings])

  // Memoized loading state
  const shouldShowLoading = useMemo(() => 
    isAnalyzing || 
    (rawData && rawData.length > 0 && !analysis) || 
    (fileName && !rawData) || 
    (projectId && (!rawData || rawData.length === 0)),
    [isAnalyzing, rawData, analysis, fileName, projectId]
  )
  
  // Full-screen chart modal - memoized (must be before conditional returns)
  const fullScreenChart = useMemo(() => 
    showFullScreen && analysis?.chartConfig.find(c => 
      (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === showFullScreen
    ),
    [showFullScreen, analysis]
  )

  if (shouldShowLoading) {
    let loadingTitle = 'Processing...'
    let loadingSubtitle = 'Please wait'
    
    if (projectId && (!rawData || rawData.length === 0)) {
      loadingTitle = 'Loading your project...'
      loadingSubtitle = 'Retrieving project data'
    } else if (!rawData) {
      loadingTitle = 'Loading data...'
      loadingSubtitle = 'Reading project files'
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
              
              {/* Manual trigger for stuck analysis */}
              {rawData && rawData.length > 0 && !analysis && analysisProgress === 0 && (
                <div className="mt-4">
                  <Button 
                    onClick={handleManualAnalysis}
                    variant="outline"
                    size="sm"
                  >
                    Retry Analysis
                  </Button>
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
                This project doesn&apos;t have any data.
              </p>
              <Button onClick={handleNewUpload} className="mt-4">
                Back to Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <DashboardTabProvider 
        activeTabId={activeTabId}
        tabAnalyses={tabAnalysesRef.current}
        setTabAnalyses={(fn) => {
          if (typeof fn === 'function') {
            tabAnalysesRef.current = fn(tabAnalysesRef.current)
          } else {
            tabAnalysesRef.current = fn
          }
        }}
      >
        <ThemeProvider>
        {/* Full-screen Chart Modal */}
      {showFullScreen && fullScreenChart && (
        <Suspense fallback={null}>
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
                  <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin mx-auto" />}>
                    <ChartWrapper
                      id={showFullScreen}
                      type={fullScreenChart.type}
                      title={fullScreenChart.title}
                      description={fullScreenChart.description}
                      data={rawData}
                      dataKey={fullScreenChart.dataKey}
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </Suspense>
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
                    onClick={handleProjectsClick}
                    className="hover:text-primary transition-colors cursor-pointer"
                  >
                    Projects
                  </button>
                  <span>›</span>
                  <span className="font-medium">{fileName}</span>
                  {activeTabId !== 'dashboard-1' && (
                    <>
                      <span>›</span>
                      <span className="font-medium" style={{ color: currentTheme.colors.text }}>
                        {tabs.find(t => t.id === activeTabId)?.name || 'Tab'}
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
                  <span>Back to Projects</span>
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Suspense fallback={<div className="w-32 h-8" />}>
          <AutoSaveIndicator className="mr-2" />
        </Suspense>
              <Button
                variant={isCustomizeMode ? "default" : "outline"}
                size="sm"
                onClick={handleCustomizeToggle}
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
            {!isSidebarCollapsed && (
              <Suspense fallback={<ChatSkeleton />}>
                <ResizableChatInterfaceWithTabs />
              </Suspense>
            )}
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
            <Suspense fallback={<div className="h-12 bg-gray-100 animate-pulse" />}>
              <TabSystem
                tabs={tabs}
                activeTabId={activeTabId}
                onTabChange={handleTabChange}
                onTabCreate={handleTabCreate}
                onTabDelete={handleTabDelete}
                onTabRename={handleTabRename}
                onTabReorder={handleTabReorder}
              />
            </Suspense>
            
            {/* Tab Content */}
            <main className="flex-1 overflow-y-auto h-full">
              <div style={{ display: activeTabId === 'schema' ? 'block' : 'none' }}>
                <Suspense fallback={<DashboardSkeleton />}>
                  <EditableSchemaViewer />
                </Suspense>
              </div>
              <div style={{ display: activeTabId !== 'schema' ? 'block' : 'none' }}>
                <div className="p-6 pb-24">
                  {/* Charts with Layout System - Use tab-specific analysis */}
                  {activeTabId !== 'schema' && tabAnalysesRef.current[activeTabId] && (
                    <Suspense fallback={<DashboardSkeleton />}>
                      <DashboardLayoutComponent 
                        analysis={tabAnalysesRef.current[activeTabId]}
                        data={rawData}
                        className="mb-8"
                      />
                    </Suspense>
                  )}
                  {/* Show empty state for new dashboards */}
                  {activeTabId !== 'schema' && !tabAnalysesRef.current[activeTabId] && (
                    <div className="flex items-center justify-center h-96">
                      <Card className="w-full max-w-md">
                        <CardContent className="p-8">
                          <div className="text-center space-y-4">
                            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto" />
                            <p className="text-lg font-medium">Empty Dashboard</p>
                            <p className="text-sm text-muted-foreground">
                              This dashboard doesn't have any charts yet.
                            </p>
                            <Button 
                              onClick={() => {
                                // You could add a button to generate charts here
                                // For now, just inform the user
                              }}
                              variant="outline"
                              className="mt-4"
                            >
                              Add Charts Manually
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
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
            <div className="w-px h-5 bg-gray-300" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateNewChart}
              className="h-7 px-3 flex items-center space-x-1"
            >
              <Plus className="h-3 w-3" />
              <span>New Chart</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCustomizeSave}
              className="h-7 px-3"
            >
              Save
            </Button>
          </div>
        )}
        
        {/* Global Chart Settings Panel */}
        {selectedChartId && analysis && (
          <Suspense fallback={null}>
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
          </Suspense>
        )}
        
        {/* Share Dialog */}
        {showShareDialog && (
          <Suspense fallback={null}>
            <ShareDialog 
              isOpen={showShareDialog} 
              onClose={() => setShowShareDialog(false)} 
            />
          </Suspense>
        )}
        
        {/* Performance Monitor removed for production */}
      </div>
        </ThemeProvider>
      </DashboardTabProvider>
    </Suspense>
  )
}

export default function ProjectDashboard() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }>
        <ProjectDashboardContent />
      </Suspense>
    </ProtectedRoute>
  )
}