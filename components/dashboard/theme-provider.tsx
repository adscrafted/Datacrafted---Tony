'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useDataStore, DashboardTheme } from '@/lib/store'

// Utility functions for theme operations
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0'
}

function getDarkModeColors(lightColors: DashboardTheme['colors']): DashboardTheme['colors'] {
  return {
    primary: lightColors.primary, // Keep primary color the same
    secondary: lightColors.secondary, // Keep secondary color the same
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f1f5f9',
    muted: '#94a3b8'
  }
}

function getLightModeColors(darkColors: DashboardTheme['colors']): DashboardTheme['colors'] {
  return {
    primary: darkColors.primary, // Keep primary color the same
    secondary: darkColors.secondary, // Keep secondary color the same
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b'
  }
}

function getUniqueThemeName(baseName: string, existingThemes: DashboardTheme[]): string {
  let counter = 1
  let uniqueName = baseName
  
  while (existingThemes.some(theme => theme.name === uniqueName)) {
    uniqueName = `${baseName} (${counter})`
    counter++
  }
  
  return uniqueName
}

interface ThemeContextType {
  theme: DashboardTheme
  setTheme: (theme: DashboardTheme) => void
  addTheme: (theme: DashboardTheme) => void
  availableThemes: DashboardTheme[]
  isDarkMode: boolean
  toggleDarkMode: () => void
  applySystemTheme: () => void
  customizeTheme: (updates: Partial<DashboardTheme>) => void
  resetTheme: () => void
  exportTheme: () => string
  importTheme: (themeData: string) => boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const {
    currentTheme,
    availableThemes,
    setCurrentTheme,
    addCustomTheme
  } = useDataStore()

  const [systemPrefersDark, setSystemPrefersDark] = useState(false)

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemPrefersDark(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement
    const theme = currentTheme

    // Set CSS custom properties for colors
    root.style.setProperty('--color-primary', theme.colors.primary)
    root.style.setProperty('--color-secondary', theme.colors.secondary)
    root.style.setProperty('--color-background', theme.colors.background)
    root.style.setProperty('--color-surface', theme.colors.surface)
    root.style.setProperty('--color-text', theme.colors.text)
    root.style.setProperty('--color-muted', theme.colors.muted)

    // Set chart colors as CSS variables
    theme.chartColors.forEach((color, index) => {
      root.style.setProperty(`--chart-color-${index + 1}`, color)
    })

    // Set additional CSS variables for enhanced theming
    root.style.setProperty('--color-primary-rgb', hexToRgb(theme.colors.primary))
    root.style.setProperty('--color-secondary-rgb', hexToRgb(theme.colors.secondary))
    root.style.setProperty('--color-background-rgb', hexToRgb(theme.colors.background))
    root.style.setProperty('--color-surface-rgb', hexToRgb(theme.colors.surface))
    root.style.setProperty('--color-text-rgb', hexToRgb(theme.colors.text))
    root.style.setProperty('--color-muted-rgb', hexToRgb(theme.colors.muted))

    // Set theme mode attributes
    root.setAttribute('data-theme', theme.mode)
    root.className = root.className.replace(/theme-\w+/g, '') + ` theme-${theme.name.toLowerCase().replace(/\s+/g, '-')}`
    
    // Apply background and text colors to body
    document.body.style.backgroundColor = theme.colors.background
    document.body.style.color = theme.colors.text
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease'

  }, [currentTheme])

  const toggleDarkMode = () => {
    const currentMode = currentTheme.mode
    const targetMode = currentMode === 'dark' ? 'light' : 'dark'
    
    // Find existing theme with target mode or create one
    const existingTheme = availableThemes.find(t => t.mode === targetMode && t.name !== currentTheme.name)
    
    if (existingTheme) {
      setCurrentTheme(existingTheme)
    } else {
      // Create a new theme based on current theme but with opposite mode
      const newTheme: DashboardTheme = {
        ...currentTheme,
        mode: targetMode,
        name: `${currentTheme.name} (${targetMode === 'dark' ? 'Dark' : 'Light'})`,
        colors: targetMode === 'dark' ? getDarkModeColors(currentTheme.colors) : getLightModeColors(currentTheme.colors)
      }
      
      addCustomTheme(newTheme)
    }
  }

  const applySystemTheme = () => {
    const systemMode = systemPrefersDark ? 'dark' : 'light'
    const systemTheme = availableThemes.find(t => t.mode === systemMode && (t.name.toLowerCase().includes('default') || t.name.toLowerCase().includes('system')))
    
    if (systemTheme) {
      setCurrentTheme(systemTheme)
    } else {
      toggleDarkMode()
    }
  }

  const customizeTheme = (updates: Partial<DashboardTheme>) => {
    const customizedTheme: DashboardTheme = {
      ...currentTheme,
      ...updates,
      name: updates.name || `${currentTheme.name} (Custom)`
    }
    
    addCustomTheme(customizedTheme)
  }

  const resetTheme = () => {
    const defaultTheme = availableThemes.find(t => t.name === 'Default')
    if (defaultTheme) {
      setCurrentTheme(defaultTheme)
    }
  }

  const exportTheme = (): string => {
    return JSON.stringify(currentTheme, null, 2)
  }

  const importTheme = (themeData: string): boolean => {
    try {
      const parsedTheme = JSON.parse(themeData) as DashboardTheme
      
      // Validate theme structure
      if (!parsedTheme.name || !parsedTheme.colors || !parsedTheme.chartColors || !parsedTheme.mode) {
        return false
      }
      
      // Ensure unique name
      const uniqueName = getUniqueThemeName(parsedTheme.name, availableThemes)
      const importedTheme = { ...parsedTheme, name: uniqueName }
      
      addCustomTheme(importedTheme)
      return true
    } catch {
      return false
    }
  }

  const contextValue: ThemeContextType = {
    theme: currentTheme,
    setTheme: setCurrentTheme,
    addTheme: addCustomTheme,
    availableThemes,
    isDarkMode: currentTheme.mode === 'dark',
    toggleDarkMode,
    applySystemTheme,
    customizeTheme,
    resetTheme,
    exportTheme,
    importTheme
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}