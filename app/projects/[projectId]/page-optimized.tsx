'use client'

import React, { useEffect, useState, Suspense, useCallback, lazy } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, BarChart3, Share2, PanelLeft, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'
import { logger } from '@/lib/utils/logger'
import dynamic from 'next/dynamic'

// Lazy load heavy components
const ChartWrapper = lazy(() => import('@/components/dashboard/chart-wrapper').then(m => ({ default: m.ChartWrapper })))
const ResizableChatInterface = lazy(() => import('@/components/dashboard/chat/resizable-chat-interface-with-tabs').then(m => ({ default: m.ResizableChatInterfaceWithTabs })))
const DashboardLayoutOptimized = lazy(() => import('@/components/dashboard/dashboard-layout-optimized').then(m => ({ default: m.DashboardLayoutOptimized })))
const EditableSchemaViewer = lazy(() => import('@/components/dashboard/editable-schema-viewer').then(m => ({ default: m.EditableSchemaViewer })))
const TabSystem = lazy(() => import('@/components/dashboard/tab-system').then(m => ({ default: m.TabSystem })))
const ShareDialog = lazy(() => import('@/components/dashboard/share-dialog').then(m => ({ default: m.ShareDialog })))
const ChartSettingsPanel = lazy(() => import('@/components/dashboard/chart-settings-panel-v3').then(m => ({ default: m.ChartSettingsPanel })))

// Dynamic imports for providers
const ThemeProvider = dynamic(() => import('@/components/dashboard/theme-provider').then(m => ({ default: m.ThemeProvider })), { ssr: false })
const DashboardTabProvider = dynamic(() => import('@/lib/contexts/dashboard-tab-context').then(m => ({ default: m.DashboardTabProvider })), { ssr: false })

// Optimized components
const AutoSaveIndicator = dynamic(() => import('@/components/session/auto-save-indicator').then(m => ({ default: m.AutoSaveIndicator })), { ssr: false })

import { useProjectStore } from '@/lib/stores/project-store'
import { useAuth } from '@/lib/contexts/auth-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { scheduleIdleTask } from '@/lib/utils/request-idle'
import { Tab } from '@/components/dashboard/tab-system'

// Loading skeleton components
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
  <div className="w-96 h-full bg-gray-50 animate-pulse" />
)

// Memoized header component
const DashboardHeader = React.memo(({ 
  fileName, 
  activeTabId, 
  tabs, 
  isCustomizeMode, 
  onCustomizeToggle, 
  onShareClick, 
  onBackClick,
  currentTheme 
}: any) => (
  <header className="border-b sticky top-0 z-40 transition-colors duration-200" style={{ backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.muted + '20' }}>
    <div className="w-full px-6 py-3 flex items-center justify-between">
      <div className="flex flex-col">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">DataCrafted</span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm" style={{ color: currentTheme.colors.muted }}>
            <button
              onClick={onBackClick}
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
                  {tabs.find((t: Tab) => t.id === activeTabId)?.name || 'Tab'}
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3 mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackClick}
            className="h-6 px-2 text-xs flex items-center space-x-1"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Projects</span>
          </Button>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <Suspense fallback={<div className="w-32 h-8 bg-gray-100 rounded animate-pulse" />}>
          <AutoSaveIndicator className="mr-2" />
        </Suspense>
        <Button
          variant={isCustomizeMode ? "default" : "outline"}
          size="sm"
          onClick={onCustomizeToggle}
          className="flex items-center space-x-2"
        >
          <Grid3x3 className="h-4 w-4" />
          <span>{isCustomizeMode ? "Save" : "Customize"}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onShareClick}
          className="flex items-center space-x-2"
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </Button>
      </div>
    </div>
  </header>
))

DashboardHeader.displayName = 'DashboardHeader'

function ProjectDashboardContent() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  
  // Essential state only
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  const [activeTabId, setActiveTabId] = useState('dashboard-1')
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'dashboard-1', name: 'Dashboard', type: 'dashboard', data: { hasAnalysis: true } },
    { id: 'schema', name: 'Schema', type: 'schema' }
  ])
  
  // Use refs for non-UI state
  const analysisInitiatedRef = React.useRef(false)
  const tabAnalysesRef = React.useRef<Record<string, any>>({})
  
  // Batch state updates
  const { 
    fileName, 
    rawData, 
    analysis, 
    isAnalyzing,
    error,
    currentTheme,
    // Use batch update functions
    batchUpdate
  } = useDataStore(state => ({
    fileName: state.fileName,
    rawData: state.rawData,
    analysis: state.analysis,
    isAnalyzing: state.isAnalyzing,
    error: state.error,
    currentTheme: state.currentTheme,
    batchUpdate: (updates: any) => {
      Object.entries(updates).forEach(([key, value]) => {
        (state as any)[`set${key.charAt(0).toUpperCase() + key.slice(1)}`](value)
      })
    }
  }))
  
  const { user } = useAuth()
  const { getProjectData, loadProjectDataAsync, loadProject } = useProjectStore()

  // Optimized callbacks
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    // Use replaceState for performance
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tabId)
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [])

  const handleBackClick = useCallback(() => {
    router.push('/projects')
  }, [router])

  const handleCustomizeToggle = useCallback(() => {
    const newMode = !isCustomizeMode
    setIsCustomizeMode(newMode)
    useDataStore.getState().setIsCustomizing(newMode)
  }, [isCustomizeMode])

  // Load project data with optimized strategy
  useEffect(() => {
    if (!projectId || !user) return

    let cancelled = false

    const loadData = async () => {
      try {
        // Try cache first
        const cachedData = sessionStorage.getItem(`project-${projectId}`)
        if (cachedData) {
          const parsed = JSON.parse(cachedData)
          if (Date.now() - parsed.timestamp < 5 * 60 * 1000) { // 5 min cache
            logger.log('Using cached project data')
            useDataStore.setState({
              fileName: parsed.fileName,
              rawData: parsed.rawData,
              analysis: parsed.analysis,
              dataSchema: parsed.dataSchema
            })
            return
          }
        }

        // Load from storage
        const projectData = await loadProjectDataAsync(projectId)
        if (cancelled) return

        if (projectData) {
          const project = await loadProject(projectId)
          if (cancelled) return

          // Batch update state
          useDataStore.setState({
            fileName: project?.name || 'Project Data',
            rawData: projectData.rawData,
            analysis: projectData.analysis,
            dataSchema: projectData.dataSchema
          })

          // Cache for future
          sessionStorage.setItem(`project-${projectId}`, JSON.stringify({
            timestamp: Date.now(),
            fileName: project?.name,
            rawData: projectData.rawData,
            analysis: projectData.analysis,
            dataSchema: projectData.dataSchema
          }))

          if (projectData.analysis) {
            tabAnalysesRef.current['dashboard-1'] = projectData.analysis
          }
        } else {
          router.push('/projects')
        }
      } catch (error) {
        logger.error('Failed to load project:', error)
        if (!cancelled) {
          useDataStore.getState().setError('Failed to load project data')
        }
      }
    }

    // Schedule for idle time
    scheduleIdleTask('load-project-data', loadData, 'high')

    return () => {
      cancelled = true
    }
  }, [projectId, user, loadProjectDataAsync, loadProject, router])

  // Perform analysis if needed
  useEffect(() => {
    if (!rawData || rawData.length === 0 || analysis || analysisInitiatedRef.current) {
      return
    }

    analysisInitiatedRef.current = true

    scheduleIdleTask('perform-analysis', async () => {
      const { analyzeData } = await import('@/lib/services/ai-analysis')
      
      useDataStore.getState().setIsAnalyzing(true)
      try {
        const result = await analyzeData(rawData, (progress, usingAI) => {
          useDataStore.setState({
            analysisProgress: progress,
            usingAI
          })
        })
        
        useDataStore.setState({
          analysis: result,
          isAnalyzing: false
        })
        
        tabAnalysesRef.current['dashboard-1'] = result
        analysisInitiatedRef.current = false
      } catch (error) {
        logger.error('Analysis failed:', error)
        useDataStore.setState({
          error: error instanceof Error ? error.message : 'Analysis failed',
          isAnalyzing: false
        })
      }
    }, 'normal')
  }, [rawData, analysis])

  // Loading states
  const isLoading = isAnalyzing || 
    (rawData && rawData.length > 0 && !analysis) || 
    (projectId && (!rawData || rawData.length === 0))

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {!rawData ? 'Loading project...' : 'Analyzing data...'}
                </p>
                <p className="text-sm text-muted-foreground">Please wait</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if ((!rawData || rawData.length === 0) && !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium">No Data Available</p>
            <Button onClick={handleBackClick} className="mt-4">
              Back to Projects
            </Button>
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
        setTabAnalyses={(fn: any) => {
          tabAnalysesRef.current = typeof fn === 'function' ? fn(tabAnalysesRef.current) : fn
        }}
      >
        <ThemeProvider>
          <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: currentTheme.colors.background }}>
            
            <DashboardHeader
              fileName={fileName}
              activeTabId={activeTabId}
              tabs={tabs}
              isCustomizeMode={isCustomizeMode}
              onCustomizeToggle={handleCustomizeToggle}
              onShareClick={() => setShowShareDialog(true)}
              onBackClick={handleBackClick}
              currentTheme={currentTheme}
            />

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className={cn(
                "border-r border-gray-200 transition-all duration-300",
                isSidebarCollapsed ? "w-0 overflow-hidden" : "w-96"
              )}>
                {!isSidebarCollapsed && (
                  <Suspense fallback={<ChatSkeleton />}>
                    <ResizableChatInterface />
                  </Suspense>
                )}
              </div>
              
              {isSidebarCollapsed && (
                <div className="p-2 border-r border-gray-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSidebar}
                    className="h-8 w-8 p-0"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Main Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <Suspense fallback={<div className="p-4"><div className="h-10 bg-gray-100 rounded animate-pulse" /></div>}>
                  <TabSystem
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabChange={handleTabChange}
                    onTabCreate={() => {/* Add implementation */}}
                    onTabDelete={() => {/* Add implementation */}}
                    onTabRename={() => {/* Add implementation */}}
                  />
                </Suspense>
                
                <main className="flex-1 overflow-y-auto">
                  {activeTabId === 'schema' ? (
                    <Suspense fallback={<DashboardSkeleton />}>
                      <EditableSchemaViewer />
                    </Suspense>
                  ) : (
                    <div className="p-6">
                      {analysis && (
                        <Suspense fallback={<DashboardSkeleton />}>
                          <DashboardLayoutOptimized 
                            analysis={analysis}
                            data={rawData}
                            className="mb-8"
                          />
                        </Suspense>
                      )}
                    </div>
                  )}
                </main>
              </div>
            </div>

            {/* Modals */}
            {showShareDialog && (
              <Suspense>
                <ShareDialog 
                  isOpen={showShareDialog} 
                  onClose={() => setShowShareDialog(false)} 
                />
              </Suspense>
            )}
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