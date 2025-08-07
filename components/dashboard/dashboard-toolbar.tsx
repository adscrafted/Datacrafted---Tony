'use client'

import React from 'react'
import { Settings, Layout, Undo2, Redo2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ThemeCustomizationPanel } from './theme-customization-panel'
import { ExportSharePanel } from './export-share-panel'
import { SchemaViewer } from './schema-viewer'
import { useDataStore } from '@/lib/store'

interface DashboardToolbarProps {
  onToggleCustomization?: () => void
  showLayoutToggle?: boolean
  className?: string
}

export function DashboardToolbar({ 
  onToggleCustomization,
  showLayoutToggle = true,
  className 
}: DashboardToolbarProps) {
  const {
    isCustomizing,
    setIsCustomizing,
    customizationHistory,
    undoLastAction,
    redoLastAction,
    dashboardFilters
  } = useDataStore()

  const activeFiltersCount = dashboardFilters.filter(f => f.isActive).length
  const canUndo = customizationHistory.length > 0
  const hasCustomizations = activeFiltersCount > 0 || Object.keys(useDataStore.getState().chartCustomizations).length > 0

  return (
    <Card className={cn('p-3', className)}>
      <div className="flex items-center justify-between">
        {/* Left: Customization Controls */}
        <div className="flex items-center space-x-2">
          {showLayoutToggle && (
            <Button
              variant={isCustomizing ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setIsCustomizing(!isCustomizing)
                onToggleCustomization?.()
              }}
              className="flex items-center space-x-2"
            >
              <Layout className="h-4 w-4" />
              <span>{isCustomizing ? 'Exit Layout Mode' : 'Customize Layout'}</span>
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCustomizing(!isCustomizing)}
            className="flex items-center space-x-2"
            title="Toggle customization mode"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Customize</span>
          </Button>
          
          {/* Undo/Redo */}
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={undoLastAction}
              disabled={!canUndo}
              className="h-8 w-8 p-0 rounded-r-none border-r border-gray-200"
              title="Undo last action"
            >
              <Undo2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redoLastAction}
              disabled={true} // TODO: Implement redo
              className="h-8 w-8 p-0 rounded-l-none"
              title="Redo last action"
            >
              <Redo2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Center: Status Indicators */}
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          {activeFiltersCount > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>{activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active</span>
            </div>
          )}
          
          {hasCustomizations && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Dashboard customized</span>
            </div>
          )}
          
          {isCustomizing && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              <span>Customization mode</span>
            </div>
          )}
        </div>

        {/* Right: Schema, Theme and Export */}
        <div className="flex items-center space-x-2">
          <SchemaViewer />
          <ThemeCustomizationPanel />
          <ExportSharePanel />
        </div>
      </div>
      
      {/* Customization Tips */}
      {isCustomizing && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-primary/20 border border-primary rounded" />
                <span>Drag to move charts</span>
              </div>
              <div className="flex items-center space-x-1">
                <Settings className="h-3 w-3" />
                <span>Click settings to customize charts</span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>Toggle chart visibility</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCustomizing(false)}
              className="h-6 text-xs px-2"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}