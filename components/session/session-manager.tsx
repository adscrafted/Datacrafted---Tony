'use client'

import { useState, useEffect } from 'react'
import { useSessionStore } from '@/lib/stores/session-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Save, FolderOpen, Download, Plus, Edit2, Trash2 } from 'lucide-react'

interface SessionManagerProps {
  onNewSession?: () => void
  onLoadSession?: (sessionId: string) => void
}

export function SessionManager({ onNewSession, onLoadSession }: SessionManagerProps) {
  const {
    currentSession,
    recentSessions,
    isSaving,
    saveError,
    createNewSession,
    loadSession,
    saveCurrentSession,
    updateSessionMetadata,
    exportSession,
    setRecentSessions,
  } = useSessionStore()

  const [showNameDialog, setShowNameDialog] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [editingSession, setEditingSession] = useState<string | null>(null)

  // Load recent sessions on mount
  useEffect(() => {
    const loadRecentSessions = async () => {
      try {
        const response = await fetch('/api/sessions')
        if (response.ok) {
          const { sessions } = await response.json()
          setRecentSessions(sessions)
        }
      } catch (error) {
        console.error('Failed to load recent sessions:', error)
      }
    }

    loadRecentSessions()
  }, [setRecentSessions])

  const handleCreateSession = async () => {
    await createNewSession(sessionName || undefined, sessionDescription || undefined)
    setShowNameDialog(false)
    setSessionName('')
    setSessionDescription('')
    onNewSession?.()
  }

  const handleLoadSession = async (sessionId: string) => {
    await loadSession(sessionId)
    onLoadSession?.(sessionId)
  }

  const handleUpdateSession = async () => {
    if (editingSession) {
      await updateSessionMetadata(sessionName, sessionDescription)
      setEditingSession(null)
      setSessionName('')
      setSessionDescription('')
    }
  }

  const startEditing = (session: any) => {
    setEditingSession(session.id)
    setSessionName(session.name || '')
    setSessionDescription(session.description || '')
    setShowNameDialog(true)
  }

  return (
    <div className="space-y-4">
      {/* Current Session Info */}
      {currentSession && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">
                {currentSession.name || 'Untitled Dashboard'}
              </h3>
              {currentSession.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {currentSession.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Created: {new Date(currentSession.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => startEditing(currentSession)}
                disabled={isSaving}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={saveCurrentSession}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportSession('json')}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {saveError && (
            <p className="text-sm text-red-500 mt-2">{saveError}</p>
          )}
        </Card>
      )}

      {/* Session Actions */}
      <div className="flex gap-2">
        <Button
          onClick={() => setShowNameDialog(true)}
          disabled={isSaving}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Dashboard
        </Button>
        {!currentSession && (
          <Button
            variant="outline"
            onClick={() => {
              const sessionId = prompt('Enter session ID to load:')
              if (sessionId) {
                handleLoadSession(sessionId)
              }
            }}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Load Session
          </Button>
        )}
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Dashboards</h4>
          <div className="grid gap-2">
            {recentSessions.map((session) => (
              <Card
                key={session.id}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleLoadSession(session.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium truncate">
                      {session.name || 'Untitled Dashboard'}
                    </h5>
                    {session.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {session.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated: {new Date(session.updatedAt).toLocaleString()}
                    </p>
                    {session.previewData && (
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        {session.previewData.fileName && (
                          <span>File: {session.previewData.fileName}</span>
                        )}
                        {session.previewData.chartCount && (
                          <span>Charts: {session.previewData.chartCount}</span>
                        )}
                        {session.previewData.messageCount && (
                          <span>Messages: {session.previewData.messageCount}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditing(session)
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Session Name Dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold mb-4">
              {editingSession ? 'Edit Dashboard' : 'Create New Dashboard'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name (optional)</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="My Dashboard"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <textarea
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md h-20 resize-none"
                  placeholder="Dashboard description..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNameDialog(false)
                    setEditingSession(null)
                    setSessionName('')
                    setSessionDescription('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingSession ? handleUpdateSession : handleCreateSession}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : editingSession ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
