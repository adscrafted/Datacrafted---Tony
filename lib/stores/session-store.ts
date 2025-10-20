/**
 * SESSION STORE - User session management
 *
 * Purpose: Manages user sessions, recent sessions, and session persistence
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Persists only currentSession and recentSessions metadata
 * - Session data loaded on-demand from API
 * - Recent sessions list limited to 10 items
 *
 * USAGE EXAMPLES:
 *
 * // ✅ GOOD - Selective subscription
 * const currentSession = useSessionStore((state) => state.currentSession)
 *
 * // ✅ GOOD - Multiple properties with shallow comparison
 * import { useShallow } from 'zustand/react/shallow'
 * const { isSaving, saveError } = useSessionStore(
 *   useShallow((state) => ({ isSaving: state.isSaving, saveError: state.saveError }))
 * )
 *
 * // ❌ BAD - Subscribes to entire store
 * const store = useSessionStore()
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SessionInfo {
  id: string
  name?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface RecentSession {
  id: string
  name?: string
  description?: string
  updatedAt: string
  previewData?: {
    fileName?: string
    chartCount?: number
    messageCount?: number
  }
}

interface SessionStore {
  // Session state
  currentSession: SessionInfo | null
  recentSessions: RecentSession[]
  isSaving: boolean
  saveError: string | null

  // Session actions
  setCurrentSession: (session: SessionInfo | null) => void
  setRecentSessions: (sessions: RecentSession[]) => void
  addRecentSession: (session: RecentSession) => void
  setIsSaving: (isSaving: boolean) => void
  setSaveError: (error: string | null) => void

  createNewSession: (name?: string, description?: string) => Promise<void>
  loadSession: (sessionId: string) => Promise<void>
  saveCurrentSession: () => Promise<void>
  updateSessionMetadata: (name?: string, description?: string) => Promise<void>
  exportSession: (format: 'json' | 'csv') => Promise<void>

  // Clear session
  clearSession: () => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      recentSessions: [],
      isSaving: false,
      saveError: null,

      // Actions
      setCurrentSession: (session) => {
        console.log('📁 [SESSION_STORE] Setting current session:', session?.id)
        set({ currentSession: session })
      },

      setRecentSessions: (sessions) => {
        console.log('📋 [SESSION_STORE] Setting recent sessions:', sessions.length)
        set({ recentSessions: sessions })
      },

      addRecentSession: (session) => {
        console.log('➕ [SESSION_STORE] Adding recent session:', session.id)
        set((state) => ({
          recentSessions: [
            session,
            ...state.recentSessions.filter(s => s.id !== session.id)
          ].slice(0, 10) // Keep only last 10
        }))
      },

      setIsSaving: (isSaving) => set({ isSaving }),

      setSaveError: (error) => {
        if (error) {
          console.error('❌ [SESSION_STORE] Save error:', error)
        }
        set({ saveError: error })
      },

      createNewSession: async (name, description) => {
        console.log('🆕 [SESSION_STORE] Creating new session:', { name, description })
        set({ isSaving: true, saveError: null })

        try {
          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
          })

          if (!response.ok) {
            throw new Error('Failed to create session')
          }

          const { session } = await response.json()
          console.log('✅ [SESSION_STORE] Session created:', session.id)

          set({
            currentSession: session,
            isSaving: false
          })

          // Add to recent sessions
          get().addRecentSession({
            id: session.id,
            name: session.name,
            description: session.description,
            updatedAt: session.updatedAt,
          })

        } catch (error) {
          console.error('❌ [SESSION_STORE] Failed to create session:', error)
          set({
            saveError: error instanceof Error ? error.message : 'Failed to create session',
            isSaving: false
          })
        }
      },

      loadSession: async (sessionId) => {
        console.log('📥 [SESSION_STORE] Loading session:', sessionId)
        set({ isSaving: true, saveError: null })

        try {
          const response = await fetch(`/api/sessions/${sessionId}/data`)

          if (!response.ok) {
            throw new Error('Failed to load session')
          }

          const { session } = await response.json()
          console.log('✅ [SESSION_STORE] Session loaded:', session.id)

          set({
            currentSession: session,
            isSaving: false,
          })

        } catch (error) {
          console.error('❌ [SESSION_STORE] Failed to load session:', error)
          set({
            saveError: error instanceof Error ? error.message : 'Failed to load session',
            isSaving: false
          })
        }
      },

      saveCurrentSession: async () => {
        const state = get()
        if (!state.currentSession) {
          console.warn('⚠️ [SESSION_STORE] No current session to save')
          return
        }

        console.log('💾 [SESSION_STORE] Saving current session:', state.currentSession.id)
        set({ isSaving: true, saveError: null })

        try {
          // Note: This is a placeholder - actual implementation would need
          // to coordinate with data-store and chart-store to gather all data
          const response = await fetch(`/api/sessions/${state.currentSession.id}/data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'session_update',
              data: {
                sessionId: state.currentSession.id,
              },
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to save session')
          }

          console.log('✅ [SESSION_STORE] Session saved successfully')
          set({ isSaving: false })

        } catch (error) {
          console.error('❌ [SESSION_STORE] Failed to save session:', error)
          set({
            saveError: error instanceof Error ? error.message : 'Failed to save session',
            isSaving: false
          })
        }
      },

      updateSessionMetadata: async (name, description) => {
        const state = get()
        if (!state.currentSession) {
          console.warn('⚠️ [SESSION_STORE] No current session to update')
          return
        }

        console.log('📝 [SESSION_STORE] Updating session metadata:', { name, description })
        set({ isSaving: true, saveError: null })

        try {
          const response = await fetch(`/api/sessions/${state.currentSession.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
          })

          if (!response.ok) {
            throw new Error('Failed to update session')
          }

          const { session } = await response.json()
          console.log('✅ [SESSION_STORE] Session metadata updated')

          set({
            currentSession: session,
            isSaving: false
          })

        } catch (error) {
          console.error('❌ [SESSION_STORE] Failed to update session:', error)
          set({
            saveError: error instanceof Error ? error.message : 'Failed to update session',
            isSaving: false
          })
        }
      },

      exportSession: async (format) => {
        const state = get()
        if (!state.currentSession) {
          console.warn('⚠️ [SESSION_STORE] No current session to export')
          return
        }

        console.log('📤 [SESSION_STORE] Exporting session:', { format, sessionId: state.currentSession.id })

        try {
          const response = await fetch(`/api/sessions/${state.currentSession.id}/export?format=${format}`)

          if (!response.ok) {
            throw new Error('Failed to export session')
          }

          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `session-${state.currentSession.id}.${format}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)

          console.log('✅ [SESSION_STORE] Session exported successfully')

        } catch (error) {
          console.error('❌ [SESSION_STORE] Failed to export session:', error)
        }
      },

      clearSession: () => {
        console.log('🗑️ [SESSION_STORE] Clearing current session')
        set({
          currentSession: null,
          isSaving: false,
          saveError: null,
        })
      },
    }),
    {
      name: 'datacrafted-session-store',
      // Only persist session metadata
      partialize: (state) => ({
        currentSession: state.currentSession,
        recentSessions: state.recentSessions,
      }),
    }
  )
)

/**
 * Selector hooks for common session patterns
 */

// Check if session is being saved
export const useIsSavingSession = () =>
  useSessionStore((state) => state.isSaving)

// Get current session ID
export const useCurrentSessionId = () =>
  useSessionStore((state) => state.currentSession?.id || null)

// Check if there's an active session
export const useHasActiveSession = () =>
  useSessionStore((state) => state.currentSession !== null)
