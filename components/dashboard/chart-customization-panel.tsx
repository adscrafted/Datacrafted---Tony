'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Settings, Eye, EyeOff, Palette, Type, BarChart3, Move, Maximize2 as Resize, Copy, RotateCcw, Download, Save } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { ChartCustomization, useDataStore } from '@/lib/store'

interface ChartCustomizationPanelProps {
  chartId: string
  title: string
  description: string
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard'
  customization?: ChartCustomization
  onCustomizationChange: (chartId: string, customization: Partial<ChartCustomization>) => void
  className?: string
}

const chartTypeOptions = [
  { value: 'bar', label: 'Bar Chart', icon: '📊' },
  { value: 'line', label: 'Line Chart', icon: '📈' },
  { value: 'pie', label: 'Pie Chart', icon: '🥧' },
  { value: 'area', label: 'Area Chart', icon: '📈' },
  { value: 'scatter', label: 'Scatter Plot', icon: '📍' },
  { value: 'scorecard', label: 'Scorecard', icon: '🎯' }
] as const

export function ChartCustomizationPanel({
  chartId,
  title,
  description,
  chartType,
  customization,
  onCustomizationChange,
  className
}: ChartCustomizationPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'style' | 'axes' | 'actions'>('general')
  const [mounted, setMounted] = useState(false)
  const { exportChart, addToHistory } = useDataStore()
  
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleUpdate = (updates: Partial<ChartCustomization>) => {
    const newCustomization = {
      ...customization,
      ...updates,
      id: chartId
    }
    onCustomizationChange(chartId, newCustomization)
    addToHistory('chart_customize', { chartId, updates })
  }

  const handleDuplicateChart = () => {
    const duplicateId = `${chartId}-copy-${Date.now()}`
    const duplicateCustomization = {
      ...customization,
      id: duplicateId,
      customTitle: `${customization?.customTitle || title} (Copy)`
    }
    onCustomizationChange(duplicateId, duplicateCustomization)
    addToHistory('chart_duplicate', { originalId: chartId, duplicateId })
  }


  const handleExportChart = async (format: 'png' | 'pdf' | 'svg') => {
    try {
      await exportChart(chartId, format)
      addToHistory('chart_export', { chartId, format })
    } catch (error) {
      console.error('Failed to export chart:', error)
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'style', label: 'Style', icon: Palette },
    { id: 'axes', label: 'Axes', icon: BarChart3 },
    { id: 'actions', label: 'Actions', icon: Copy }
  ] as const

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-8 w-8 p-0 opacity-70 hover:opacity-100',
          isOpen && 'bg-primary/10 text-primary'
        )}
        title="Customize chart"
      >
        <Settings className="h-4 w-4" />
      </Button>
      
      {isOpen && mounted && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/20" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Settings Panel */}
          <Card 
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] max-h-[80vh] overflow-hidden shadow-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Chart Settings
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardTitle>
            
            {/* Tabs */}
            <div className="flex gap-1 mt-3">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 overflow-y-auto max-h-[calc(80vh-10rem)]">
            {activeTab === 'general' && (
              <div className="space-y-4">
                {/* Chart Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Chart Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {chartTypeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => handleUpdate({ chartType: option.value })}
                        className={cn(
                          'flex items-center space-x-2 p-2 rounded border text-left text-sm transition-colors',
                          (customization?.chartType || chartType) === option.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Title */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Custom Title</label>
                  <input
                    type="text"
                    value={customization?.customTitle || ''}
                    onChange={(e) => handleUpdate({ customTitle: e.target.value })}
                    placeholder={title}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Custom Description</label>
                  <textarea
                    value={customization?.customDescription || ''}
                    onChange={(e) => handleUpdate({ customDescription: e.target.value })}
                    placeholder={description}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                  />
                </div>
                
              </div>
            )}
            
            {activeTab === 'style' && (
              <div className="space-y-4">
                {/* Theme */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['default', 'light', 'dark'] as const).map(theme => (
                      <button
                        key={theme}
                        onClick={() => handleUpdate({ theme })}
                        className={cn(
                          'px-3 py-2 rounded border text-sm capitalize transition-colors',
                          (customization?.theme || 'default') === theme
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Colors */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Chart Colors</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(customization?.colors || ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']).map((color, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-xs w-6">{index + 1}:</span>
                        <ColorPicker
                          value={color}
                          onChange={(newColor) => {
                            const newColors = [...(customization?.colors || ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'])]
                            newColors[index] = newColor
                            handleUpdate({ colors: newColors })
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Show Legend</span>
                  <button
                    onClick={() => handleUpdate({ showLegend: !(customization?.showLegend ?? true) })}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative',
                      (customization?.showLegend ?? true) ? 'bg-primary' : 'bg-gray-300'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                        (customization?.showLegend ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
                
                {/* Grid */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Show Grid</span>
                  <button
                    onClick={() => handleUpdate({ showGrid: !(customization?.showGrid ?? true) })}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative',
                      (customization?.showGrid ?? true) ? 'bg-primary' : 'bg-gray-300'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                        (customization?.showGrid ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'axes' && (
              <div className="space-y-4">
                {/* X-Axis Label */}
                <div>
                  <label className="text-sm font-medium mb-1 block">X-Axis Label</label>
                  <input
                    type="text"
                    value={customization?.axisLabels?.x || ''}
                    onChange={(e) => handleUpdate({ 
                      axisLabels: { 
                        ...customization?.axisLabels, 
                        x: e.target.value 
                      } 
                    })}
                    placeholder="X-axis label"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                
                {/* Y-Axis Label */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Y-Axis Label</label>
                  <input
                    type="text"
                    value={customization?.axisLabels?.y || ''}
                    onChange={(e) => handleUpdate({ 
                      axisLabels: { 
                        ...customization?.axisLabels, 
                        y: e.target.value 
                      } 
                    })}
                    placeholder="Y-axis label"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            )}
            
            {activeTab === 'actions' && (
              <div className="space-y-4">
                {/* Export Options */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Export Chart</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportChart('png')}
                      className="text-xs flex items-center justify-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      PNG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportChart('pdf')}
                      className="text-xs flex items-center justify-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportChart('svg')}
                      className="text-xs flex items-center justify-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      SVG
                    </Button>
                  </div>
                </div>
                
                {/* Chart Actions */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Chart Actions</label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDuplicateChart}
                      className="w-full justify-start text-xs"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Duplicate Chart
                    </Button>
                  </div>
                </div>
                
                {/* Advanced Options */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Advanced</label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Animation</span>
                      <button
                        onClick={() => handleUpdate({ animate: !(customization as any)?.animate })}
                        className={cn(
                          'w-8 h-4 rounded-full transition-colors relative',
                          (customization as any)?.animate ? 'bg-primary' : 'bg-gray-300'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                            (customization as any)?.animate ? 'translate-x-4' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Interactive</span>
                      <button
                        onClick={() => handleUpdate({ interactive: !(customization as any)?.interactive })}
                        className={cn(
                          'w-8 h-4 rounded-full transition-colors relative',
                          (customization as any)?.interactive !== false ? 'bg-primary' : 'bg-gray-300'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                            (customization as any)?.interactive !== false ? 'translate-x-4' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
          </CardContent>
        </Card>
        </>,
        document.body
      )}
    </div>
  )
}