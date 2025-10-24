'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useDataStore } from '@/lib/stores/data-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { useSessionStore } from '@/lib/stores/session-store'
import { CheckCircle, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AutoSaveIndicatorProps {
  className?: string
}

export function AutoSaveIndicator({ className }: AutoSaveIndicatorProps) {
  const {
    analysis,
  } = useDataStore()

  const {
    chartCustomizations,
    currentTheme,
    currentLayout,
    dashboardFilters,
  } = useChartStore()

  const {
    currentSession,
    isSaving,
    saveError,
    createNewSession,
    saveCurrentSession,
  } = useSessionStore()

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'offline'>('saved')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSaveDataRef = useRef<string>('')

  // Create a hash of the data that needs to be saved
  const getSaveDataHash = () => {
    return JSON.stringify({
      analysis,
      chartCustomizations,
      currentTheme: currentTheme.name,
      currentLayout: currentLayout.name,
      dashboardFilters,
    })
  }

  // Auto-save function with debouncing
  const performAutoSave = async () => {
    if (!analysis) return

    setSaveStatus('saving')

    try {
      if (!currentSession) {
        // Create a new session if none exists
        await createNewSession('Auto-saved Dashboard', 'Automatically saved dashboard')
      } else {
        await saveCurrentSession()
      }

      setSaveStatus('saved')
      setLastSaved(new Date())
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
    }
  }

  // Watch for changes and trigger auto-save with debounce
  useEffect(() => {
    const currentDataHash = getSaveDataHash()

    // Only save if data has actually changed
    if (currentDataHash !== lastSaveDataRef.current && analysis) {
      lastSaveDataRef.current = currentDataHash

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Set new timeout for auto-save (3 seconds debounce)
      saveTimeoutRef.current = setTimeout(() => {
        performAutoSave()
      }, 3000)
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [analysis, chartCustomizations, currentTheme, currentLayout, dashboardFilters])

  // Update status based on isSaving state
  useEffect(() => {
    if (isSaving) {
      setSaveStatus('saving')
    }
  }, [isSaving])

  // Check online status
  useEffect(() => {
    const handleOnline = () => setSaveStatus('saved')
    const handleOffline = () => setSaveStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial status
    if (!navigator.onLine) {
      setSaveStatus('offline')
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Format last saved time
  const getLastSavedText = () => {
    if (!lastSaved) return ''

    const now = new Date()
    const diff = now.getTime() - lastSaved.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 10) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    return `${hours}h ago`
  }

  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'saving':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'error':
        return <Cloud className="h-4 w-4 text-red-500" />
      case 'offline':
        return <CloudOff className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saved':
        return lastSaved ? `Saved ${getLastSavedText()}` : 'All changes saved'
      case 'saving':
        return 'Saving...'
      case 'error':
        return saveError || 'Save failed'
      case 'offline':
        return 'Offline - changes will sync when online'
    }
  }

  return (
    <div className={cn(
      "flex items-center space-x-2 text-sm",
      className
    )}>
      {getStatusIcon()}
      <span className={cn(
        "text-muted-foreground",
        saveStatus === 'error' && "text-red-500",
        saveStatus === 'offline' && "text-gray-500"
      )}>
        {getStatusText()}
      </span>
    </div>
  )
}
