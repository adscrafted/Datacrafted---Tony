'use client'

import React, { useState, Suspense, lazy } from 'react'
import {
  Settings,
  Palette,
  Filter,
  Layout,
  Share2,
  Undo,
  Redo,
  RotateCcw,
  Save,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeSelector } from '@/components/ui/theme-selector'
import { FilterPanel } from '@/components/ui/filter-panel'
import { useDataStore } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { useSessionStore } from '@/lib/stores/session-store'
import { useTheme } from './theme-provider'

// PERFORMANCE OPTIMIZATION: Lazy load export/share panel
const ExportSharePanel = lazy(() =>
  import('./export-share-panel').then(mod => ({ default: mod.ExportSharePanel }))
)

interface CustomizationPanelProps {
  className?: string
}

type PanelTab = 'themes' | 'filters' | 'layout' | 'export' | 'history'

const tabs = [
  { id: 'themes', label: 'Themes', icon: Palette, description: 'Customize colors and appearance' },
  { id: 'filters', label: 'Filters', icon: Filter, description: 'Filter and search your data' },
  { id: 'layout', label: 'Layout', icon: Layout, description: 'Arrange and organize charts' },
  { id: 'export', label: 'Export', icon: Share2, description: 'Share and export dashboard' },
  { id: 'history', label: 'History', icon: Undo, description: 'Undo and redo changes' }
] as const

export function CustomizationPanel({ className }: CustomizationPanelProps) {
  // Modular store migration - split across multiple stores

  // data-store: analysis and raw data
  const analysis = useDataStore((state) => state.analysis)
  const rawData = useDataStore((state) => state.rawData)

  // chart-store: filters, customizations, undo/redo
  const dashboardFilters = useChartStore((state) => state.dashboardFilters)
  const chartCustomizations = useChartStore((state) => state.chartCustomizations)
  const customizationHistory = useChartStore((state) => state.customizationHistory)
  const redoHistory = useChartStore((state) => state.redoHistory)
  const addDashboardFilter = useChartStore((state) => state.addDashboardFilter)
  const updateDashboardFilter = useChartStore((state) => state.updateDashboardFilter)
  const removeDashboardFilter = useChartStore((state) => state.removeDashboardFilter)
  const clearAllFilters = useChartStore((state) => state.clearAllFilters)
  const undoLastAction = useChartStore((state) => state.undoLastAction)
  const redoLastAction = useChartStore((state) => state.redoLastAction)

  // session-store: session management
  const currentSession = useSessionStore((state) => state.currentSession)
  const saveCurrentSession = useSessionStore((state) => state.saveCurrentSession)
  const isSaving = useSessionStore((state) => state.isSaving)

  // ui-store or monolithic store: customization UI state
  // TODO: migrate isCustomizing to ui-store when it's created
  const isCustomizing = false // Placeholder - this field may not exist in modular stores yet
  const setIsCustomizing = (_value: boolean) => {} // Placeholder

  const { 
    theme,
    availableThemes,
    setTheme,
    addTheme,
    toggleDarkMode,
    resetTheme,
    exportTheme,
    importTheme
  } = useTheme()

  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<PanelTab>('themes')
  const [isMinimized, setIsMinimized] = useState(false)

  const canUndo = customizationHistory.length > 0
  const canRedo = redoHistory.length > 0
  const hasCustomizations = Object.keys(chartCustomizations).length > 0 || 
                           dashboardFilters.length > 0 || 
                           theme.name !== 'Default'

  const handleThemeImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          if (importTheme(content)) {
            alert('Theme imported successfully!')
          } else {
            alert('Failed to import theme. Please check the file format.')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleThemeExport = () => {
    const themeData = exportTheme()
    const blob = new Blob([themeData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}-theme.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'themes':
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Theme Selection</h3>
              <ThemeSelector
                themes={availableThemes}
                currentTheme={theme}
                onThemeChange={setTheme}
                onAddTheme={addTheme}
              />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleDarkMode}
                  className="text-xs"
                >
                  {theme.mode === 'dark' ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {theme.mode === 'dark' ? 'Light' : 'Dark'} Mode
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetTheme}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Import/Export</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleThemeImport}
                  className="text-xs"
                >
                  Import Theme
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleThemeExport}
                  className="text-xs"
                >
                  Export Theme
                </Button>
              </div>
            </div>
          </div>
        )

      case 'filters':
        return analysis?.summary.columns ? (
          <FilterPanel
            filters={dashboardFilters}
            columns={analysis.summary.columns}
            data={rawData}
            onAddFilter={addDashboardFilter}
            onUpdateFilter={updateDashboardFilter}
            onRemoveFilter={removeDashboardFilter}
            onClearFilters={clearAllFilters}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No data available for filtering</p>
          </div>
        )

      case 'layout':
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Layout Controls</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={isCustomizing ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsCustomizing(!isCustomizing)}
                  className="text-xs"
                >
                  {isCustomizing ? <Minimize2 className="h-3 w-3 mr-1" /> : <Maximize2 className="h-3 w-3 mr-1" />}
                  {isCustomizing ? 'Exit Edit' : 'Edit Layout'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {/* Reset layout logic */}}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
            </div>
            
            {isCustomizing && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                <p className="font-medium mb-1">Layout Edit Mode Active</p>
                <p className="text-xs">Drag charts to move them around, resize by dragging corners.</p>
              </div>
            )}
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Chart Overview</h3>
              <div className="space-y-2">
                {analysis?.chartConfig.map((config, index) => {
                  const chartId = config.id || `chart-${index}`
                  const customization = chartCustomizations[chartId]
                  const isVisible = customization?.isVisible ?? true
                  
                  return (
                    <div
                      key={chartId}
                      className="flex items-center justify-between p-2 border rounded text-sm"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{customization?.customTitle || config.title}</div>
                        <div className="text-xs text-muted-foreground">{config.type} chart</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Toggle chart visibility
                          // This would need to be implemented in the store
                        }}
                        className="h-6 w-6 p-0"
                      >
                        {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )

      case 'export':
        return (
          <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading export options...</div>}>
            <ExportSharePanel />
          </Suspense>
        )

      case 'history':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Action History</h3>
              <div className="flex space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={undoLastAction}
                  disabled={!canUndo}
                  className="h-6 w-6 p-0"
                  title="Undo last action"
                >
                  <Undo className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={redoLastAction}
                  disabled={!canRedo}
                  className="h-6 w-6 p-0"
                  title="Redo last action"
                >
                  <Redo className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customizationHistory.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No customization history yet
                </div>
              ) : (
                customizationHistory.slice().reverse().map((action, index) => (
                  <div
                    key={action.id}
                    className="p-2 border rounded text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">
                        {action.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {action.data && (
                      <div className="text-xs text-muted-foreground">
                        {typeof action.data === 'object' 
                          ? JSON.stringify(action.data).slice(0, 50) + '...'
                          : String(action.data).slice(0, 50)
                        }
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed right-4 top-1/2 -translate-y-1/2 z-40 flex items-center space-x-2 shadow-lg',
          hasCustomizations && 'border-primary bg-primary/5',
          className
        )}
      >
        <Settings className="h-4 w-4" />
        <span>Customize</span>
        {hasCustomizations && (
          <div className="w-2 h-2 bg-primary rounded-full" />
        )}
      </Button>
    )
  }

  return (
    <div className={cn('fixed right-4 top-4 bottom-4 z-40 flex flex-col', className)}>
      <Card className={cn('w-80 flex flex-col shadow-lg', isMinimized && 'h-auto')}>
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Dashboard Customization</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-6 w-6 p-0"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
                title="Close"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
          
          {!isMinimized && (
            <>
              {/* Tab Navigation */}
              <div className="flex space-x-1 mt-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex-1 flex items-center justify-center p-2 text-xs rounded transition-colors',
                        activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-gray-100'
                      )}
                      title={tab.description}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  )
                })}
              </div>
              
              {/* Quick Actions */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={undoLastAction}
                    disabled={!canUndo}
                    className="h-6 px-2 text-xs"
                    title="Undo last action"
                  >
                    <Undo className="h-3 w-3 mr-1" />
                    Undo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={redoLastAction}
                    disabled={!canRedo}
                    className="h-6 px-2 text-xs"
                    title="Redo last action"
                  >
                    <Redo className="h-3 w-3 mr-1" />
                    Redo
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveCurrentSession}
                  disabled={isSaving || !currentSession || !hasCustomizations}
                  className="h-6 px-2 text-xs"
                  title="Save current customizations"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </>
          )}
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="flex-1 overflow-y-auto">
            <div className="mb-2">
              <h3 className="text-sm font-medium mb-1">
                {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                {tabs.find(t => t.id === activeTab)?.description}
              </p>
            </div>
            
            {renderTabContent()}
          </CardContent>
        )}
      </Card>
    </div>
  )
}