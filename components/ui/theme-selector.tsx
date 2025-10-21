'use client'

import React, { useState } from 'react'
import { Check, Palette, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { ColorPicker } from './color-picker'
import type { DashboardTheme } from '@/lib/store'

interface ThemeSelectorProps {
  themes: DashboardTheme[]
  currentTheme: DashboardTheme
  onThemeChange: (theme: DashboardTheme) => void
  onAddTheme?: (theme: DashboardTheme) => void
  className?: string
}

export function ThemeSelector({ 
  themes, 
  currentTheme, 
  onThemeChange, 
  onAddTheme,
  className 
}: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newTheme, setNewTheme] = useState<Partial<DashboardTheme>>({
    name: '',
    mode: 'light',
    colors: {
      primary: '#0088FE',
      secondary: '#00C49F',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      muted: '#64748b'
    },
    chartColors: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']
  })

  const handleCreateTheme = () => {
    if (newTheme.name && onAddTheme) {
      onAddTheme(newTheme as DashboardTheme)
      setIsCreating(false)
      setIsOpen(false)
      setNewTheme({
        name: '',
        mode: 'light',
        colors: {
          primary: '#0088FE',
          secondary: '#00C49F',
          background: '#ffffff',
          surface: '#f8fafc',
          text: '#0f172a',
          muted: '#64748b'
        },
        chartColors: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']
      })
    }
  }

  const updateNewThemeColor = (colorKey: keyof DashboardTheme['colors'], color: string) => {
    setNewTheme(prev => ({
      ...prev,
      colors: {
        ...prev.colors!,
        [colorKey]: color
      }
    }))
  }

  const updateChartColor = (index: number, color: string) => {
    setNewTheme(prev => ({
      ...prev,
      chartColors: prev.chartColors?.map((c, i) => i === index ? color : c) || []
    }))
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
      >
        <Palette className="h-4 w-4" />
        <span>{currentTheme.name}</span>
      </Button>
      
      {isOpen && (
        <Card className="absolute top-10 left-0 z-50 w-80 shadow-lg max-h-96 overflow-y-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Select Theme
              {onAddTheme && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  className="h-6 w-6 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {!isCreating ? (
              <>
                {/* Existing Themes */}
                {themes.map((theme) => (
                  <div
                    key={theme.name}
                    onClick={() => {
                      onThemeChange(theme)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors',
                      currentTheme.name === theme.name ? 'border-primary bg-primary/5' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{theme.name}</span>
                      {currentTheme.name === theme.name && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    
                    {/* Theme Preview */}
                    <div className="flex items-center space-x-1 mb-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: theme.colors.secondary }}
                      />
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: theme.colors.background }}
                      />
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: theme.colors.surface }}
                      />
                    </div>
                    
                    {/* Chart Colors Preview */}
                    <div className="flex items-center space-x-1">
                      {theme.chartColors.slice(0, 4).map((color, index) => (
                        <div
                          key={index}
                          className="w-3 h-3 rounded border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      {theme.chartColors.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{theme.chartColors.length - 4}</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* Create New Theme */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Theme Name</label>
                  <input
                    type="text"
                    value={newTheme.name || ''}
                    onChange={(e) => setNewTheme(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="My Custom Theme"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Mode</label>
                  <select
                    value={newTheme.mode || 'light'}
                    onChange={(e) => setNewTheme(prev => ({ ...prev, mode: e.target.value as 'light' | 'dark' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Colors</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(newTheme.colors || {}).map(([key, color]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <span className="text-xs capitalize w-16">{key}:</span>
                        <ColorPicker
                          value={color}
                          onChange={(newColor) => updateNewThemeColor(key as keyof DashboardTheme['colors'], newColor)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Chart Colors</label>
                  <div className="grid grid-cols-3 gap-2">
                    {newTheme.chartColors?.map((color, index) => (
                      <ColorPicker
                        key={index}
                        value={color}
                        onChange={(newColor) => updateChartColor(index, newColor)}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleCreateTheme}
                    disabled={!newTheme.name}
                  >
                    Create Theme
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}