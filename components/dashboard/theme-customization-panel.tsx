'use client'

import React, { useState } from 'react'
import { Palette, Sun, Moon, Monitor, Sparkles, Save } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeSelector } from '@/components/ui/theme-selector'
import { ColorPicker } from '@/components/ui/color-picker'
import { useDataStore, type DashboardTheme } from '@/lib/store'

interface ThemeCustomizationPanelProps {
  className?: string
}

export function ThemeCustomizationPanel({ className }: ThemeCustomizationPanelProps) {
  const {
    currentTheme,
    availableThemes,
    setCurrentTheme,
    addCustomTheme
  } = useDataStore()

  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'presets' | 'colors' | 'advanced'>('presets')
  const [customTheme, setCustomTheme] = useState<DashboardTheme>(currentTheme)

  const tabs = [
    { id: 'presets', label: 'Presets', icon: Palette },
    { id: 'colors', label: 'Colors', icon: Sparkles },
    { id: 'advanced', label: 'Advanced', icon: Monitor }
  ] as const

  const handleThemeChange = (theme: DashboardTheme) => {
    setCurrentTheme(theme)
    setCustomTheme(theme)
  }

  const handleCustomThemeUpdate = (updates: Partial<DashboardTheme>) => {
    const updatedTheme = { ...customTheme, ...updates }
    setCustomTheme(updatedTheme)
    setCurrentTheme(updatedTheme)
  }

  const handleColorUpdate = (colorKey: keyof DashboardTheme['colors'], color: string) => {
    handleCustomThemeUpdate({
      colors: {
        ...customTheme.colors,
        [colorKey]: color
      }
    })
  }

  const handleChartColorUpdate = (index: number, color: string) => {
    const newChartColors = [...customTheme.chartColors]
    newChartColors[index] = color
    handleCustomThemeUpdate({
      chartColors: newChartColors
    })
  }

  const saveCustomTheme = () => {
    const themeToSave = {
      ...customTheme,
      name: `Custom Theme ${Date.now()}`,
      id: `theme-${Date.now()}`
    } as DashboardTheme
    
    addCustomTheme(themeToSave)
    setIsOpen(false)
  }

  const quickModeToggle = (mode: 'light' | 'dark') => {
    const quickTheme: DashboardTheme = {
      ...currentTheme,
      mode,
      colors: mode === 'dark' ? {
        primary: '#3b82f6',
        secondary: '#10b981',
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f1f5f9',
        muted: '#94a3b8'
      } : {
        primary: '#0088FE',
        secondary: '#00C49F',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        muted: '#64748b'
      }
    }
    handleThemeChange(quickTheme)
  }

  const presetThemes = [
    {
      name: 'Professional',
      colors: { primary: '#1f2937', secondary: '#6b7280', background: '#ffffff', surface: '#f9fafb', text: '#111827', muted: '#6b7280' },
      chartColors: ['#1f2937', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6']
    },
    {
      name: 'Ocean',
      colors: { primary: '#0ea5e9', secondary: '#06b6d4', background: '#f0f9ff', surface: '#e0f2fe', text: '#0c4a6e', muted: '#0369a1' },
      chartColors: ['#0ea5e9', '#06b6d4', '#67e8f9', '#a5f3fc', '#cffafe', '#ecfeff']
    },
    {
      name: 'Forest',
      colors: { primary: '#059669', secondary: '#10b981', background: '#f0fdf4', surface: '#dcfce7', text: '#064e3b', muted: '#047857' },
      chartColors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']
    },
    {
      name: 'Sunset',
      colors: { primary: '#ea580c', secondary: '#f97316', background: '#fffbeb', surface: '#fef3c7', text: '#9a3412', muted: '#d97706' },
      chartColors: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#fef3c7']
    }
  ]

  return (
    <div className={cn('', className)}>
      {/* Quick theme toggle */}
      <div className="flex items-center space-x-2 mb-4">
        <Button
          variant={currentTheme.mode === 'light' ? 'default' : 'outline'}
          size="sm"
          onClick={() => quickModeToggle('light')}
          className="flex items-center space-x-2"
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
        </Button>
        <Button
          variant={currentTheme.mode === 'dark' ? 'default' : 'outline'}
          size="sm"
          onClick={() => quickModeToggle('dark')}
          className="flex items-center space-x-2"
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
        </Button>
        <div className="flex-1" />
        <ThemeSelector
          themes={availableThemes}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          onAddTheme={addCustomTheme}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2"
        >
          <Palette className="h-4 w-4" />
          <span>Customize</span>
        </Button>
      </div>

      {isOpen && (
        <Card className="shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Theme Customization
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
            <div className="flex space-x-1 mt-2">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-xs rounded transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 hover:bg-gray-200'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {activeTab === 'presets' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">Preset Themes</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {presetThemes.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => handleThemeChange({
                          ...preset,
                          mode: currentTheme.mode
                        } as DashboardTheme)}
                        className="p-3 rounded-lg border text-left hover:border-primary transition-colors"
                      >
                        <div className="font-medium text-sm mb-2">{preset.name}</div>
                        <div className="flex space-x-1 mb-2">
                          {Object.values(preset.colors).slice(0, 4).map((color, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex space-x-1">
                          {preset.chartColors.slice(0, 4).map((color, i) => (
                            <div
                              key={i}
                              className="w-3 h-3 rounded border"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'colors' && (
              <div className="space-y-4">
                {/* Interface Colors */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Interface Colors</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(customTheme.colors).map(([key, color]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <span className="text-xs capitalize w-20">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <ColorPicker
                          value={color}
                          onChange={(newColor) => handleColorUpdate(key as keyof DashboardTheme['colors'], newColor)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Chart Colors */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Chart Colors</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {customTheme.chartColors.map((color, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-xs w-8">#{index + 1}:</span>
                        <ColorPicker
                          value={color}
                          onChange={(newColor) => handleChartColorUpdate(index, newColor)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'advanced' && (
              <div className="space-y-4">
                {/* Theme Mode */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Theme Mode</h4>
                  <div className="flex space-x-2">
                    {(['light', 'dark'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => handleCustomThemeUpdate({ mode })}
                        className={cn(
                          'flex-1 flex items-center justify-center space-x-2 p-2 rounded border transition-colors',
                          customTheme.mode === mode
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {mode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        <span className="capitalize">{mode}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Theme Name */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Theme Name</h4>
                  <input
                    type="text"
                    value={customTheme.name}
                    onChange={(e) => handleCustomThemeUpdate({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="Enter theme name"
                  />
                </div>
                
                {/* Export/Import */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Theme Data</h4>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const themeJson = JSON.stringify(customTheme, null, 2)
                        navigator.clipboard.writeText(themeJson)
                      }}
                      className="flex-1"
                    >
                      Copy JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(customTheme, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${customTheme.name.toLowerCase().replace(/\s+/g, '-')}-theme.json`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      }}
                      className="flex-1"
                    >
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleThemeChange(availableThemes[0])}
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={saveCustomTheme}
                className="flex items-center space-x-2"
              >
                <Save className="h-3 w-3" />
                <span>Save Theme</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}