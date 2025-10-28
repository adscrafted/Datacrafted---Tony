'use client'

import { useState } from 'react'
import { useDataStore } from '@/lib/stores/data-store'
import { useSessionStore } from '@/lib/stores/session-store'
import { Button } from '@/components/ui/button'
import { Save, CheckCircle } from 'lucide-react'

export function SaveDashboard() {
  const analysis = useDataStore((state) => state.analysis)
  const fileName = useDataStore((state) => state.fileName)
  const rawData = useDataStore((state) => state.rawData)

  const {
    currentSession,
    isSaving,
    saveError,
    createNewSession,
    saveCurrentSession,
  } = useSessionStore()

  const [showSuccess, setShowSuccess] = useState(false)

  const handleSave = async () => {
    if (!currentSession) {
      // Create a new session if none exists
      const dashboardName = fileName ? `Analysis of ${fileName}` : 'New Dashboard'
      await createNewSession(dashboardName, 'Auto-saved dashboard')
      return
    }

    await saveCurrentSession()

    if (!saveError) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    }
  }

  // Don't show the button if there's no data to save
  if (!analysis && !fileName && rawData.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleSave}
        disabled={isSaving}
        variant={currentSession ? "outline" : "default"}
        size="sm"
      >
        {showSuccess ? (
          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        {isSaving ? 'Saving...' : showSuccess ? 'Saved!' : 'Save'}
      </Button>

      {saveError && (
        <span className="text-sm text-red-500">{saveError}</span>
      )}
    </div>
  )
}
