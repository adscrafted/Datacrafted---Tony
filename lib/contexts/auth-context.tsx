'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { auth, DEBUG_MODE, DEBUG_USER, isProductionEnvironment } from '@/lib/config/firebase'
import { useRouter } from 'next/navigation'
import { useProjectStore } from '@/lib/stores/project-store'
import { syncUserToDatabase } from '@/lib/utils/api-client'
import { syncLocalProjectsToDatabase } from '@/lib/utils/project-sync'

interface AuthContextType {
  user: User | null
  loading: boolean
  isSyncing: boolean
  error: string | null
  syncError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>
  isDebugMode: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Create session cookie by calling the session API
 */
async function createSessionCookie(user: User) {
  try {
    const idToken = await user.getIdToken()
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })

    if (!response.ok) {
      throw new Error('Failed to create session cookie')
    }

    console.log('✅ [AUTH] Session cookie created')
    return true
  } catch (error) {
    console.error('❌ [AUTH] Failed to create session cookie:', error)
    return false
  }
}

/**
 * Sync Firebase user with database and migrate anonymous projects
 * Called automatically when user logs in or signs up
 */
async function syncUserAndMigrateProjects(user: User, setSyncing: (syncing: boolean) => void, setSyncError: (error: string | null) => void) {
  try {
    setSyncing(true)
    setSyncError(null)
    console.log('🔄 [AUTH] Syncing user to database:', user.uid)

    // Step 0: Create session cookie for middleware
    await createSessionCookie(user)

    // Step 1: Sync Firebase user to Postgres database
    const syncResult = await syncUserToDatabase(user)

    if (!syncResult.success) {
      console.error('❌ [AUTH] Failed to sync user to database:', syncResult.error)
      // Continue with project migration even if sync fails
    } else {
      console.log('✅ [AUTH] User synced to database:', syncResult.user?.id)
    }

    // Step 2: Migrate anonymous projects to authenticated user
    console.log('🔄 [AUTH] Starting anonymous project migration for user:', user.uid)

    const { projects, updateProject } = useProjectStore.getState()

    // Find all anonymous projects
    const anonymousProjects = projects.filter(p => p.userId === 'anonymous' && p.status === 'active')

    if (anonymousProjects.length === 0) {
      console.log('✅ [AUTH] No anonymous projects to migrate')
      return
    }

    console.log(`🔄 [AUTH] Found ${anonymousProjects.length} anonymous project(s) to migrate`)

    // Migrate each anonymous project to the authenticated user
    for (const project of anonymousProjects) {
      try {
        await updateProject(project.id, {
          userId: user.uid,
          name: `${project.name} (migrated)`,
          updatedAt: new Date().toISOString()
        })
        console.log(`✅ [AUTH] Migrated project: ${project.id}`)
      } catch (error) {
        console.error(`❌ [AUTH] Failed to migrate project ${project.id}:`, error)
        // Continue with other projects even if one fails
      }
    }

    console.log('✅ [AUTH] User sync and project migration completed successfully')

    // Step 3: Sync local projects to database
    console.log('🔄 [AUTH] Starting local project sync to database...')
    try {
      const syncResult = await syncLocalProjectsToDatabase()
      console.log('✅ [AUTH] Project sync completed:', {
        synced: syncResult.projectsSynced,
        failed: syncResult.projectsFailed,
        errors: syncResult.errors.length
      })

      if (syncResult.projectsFailed > 0) {
        console.warn('⚠️ [AUTH] Some projects failed to sync:', syncResult.errors)
      }
    } catch (syncError) {
      console.error('❌ [AUTH] Project sync failed:', syncError)
      // Don't throw - we don't want to block authentication
    }
  } catch (error) {
    // Log error but don't throw - we don't want to block authentication
    console.error('❌ [AUTH] Error during user sync and project migration:', error)

    const errorMessage = error instanceof Error
      ? error.message
      : 'Failed to sync user account'

    setSyncError(errorMessage)

    // Show toast notification
    if (typeof window !== 'undefined') {
      import('@/components/ui/toast').then(({ toast }) => {
        toast.warning('Account setup incomplete. Some features may not work correctly.', {
          duration: 7000
        })
      }).catch(err => console.error('Failed to show toast:', err))
    }
  } finally {
    setSyncing(false)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // SECURITY: Client-side production guard for debug mode
    if (DEBUG_MODE) {
      // Additional safety check - never allow debug mode in production
      if (isProductionEnvironment()) {
        console.error(
          '🚨 [SECURITY] CRITICAL: DEBUG_MODE is enabled but production environment detected.\n' +
          'Authentication will fail. Please check your environment configuration.'
        )
        setUser(null)
        setLoading(false)
        setError('Configuration error. Please contact support.')
        return
      }

      console.warn(
        '⚠️  [AUTH-CLIENT] Debug mode active - auto-authenticating debug user\n' +
        '   This should ONLY happen in local development\n' +
        '   Debug user will NOT be synced to database (not a real user)'
      )
      setUser(DEBUG_USER as any)
      setLoading(false)
      // DON'T sync debug user to database - it's not a real Firebase user
      // and lacks authentication methods like getIdToken()
      return
    }

    // Normal authentication flow
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      // Automatically sync user to database and migrate anonymous projects
      if (user) {
        await syncUserAndMigrateProjects(user, setIsSyncing, setSyncError)
      }

      setLoading(false)
    })

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // MEMOIZATION: Wrap signIn with useCallback to prevent unnecessary re-renders
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setError(null)
      // In debug mode, accept any credentials
      if (DEBUG_MODE) {
        setUser(DEBUG_USER as any)
        router.push('/projects')
        return
      }

      setIsSyncing(true)
      const result = await signInWithEmailAndPassword(auth, email, password)

      // Create session cookie
      await createSessionCookie(result.user)

      // Wait for user sync to complete before navigating
      // The sync will be triggered by onAuthStateChanged
      // We'll navigate after a brief delay to ensure sync starts
      setTimeout(() => {
        router.push('/projects')
      }, 500)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
      setIsSyncing(false)
      throw err
    }
  }, [router])

  // MEMOIZATION: Wrap signUp with useCallback to prevent unnecessary re-renders
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      setError(null)
      // In debug mode, accept any credentials
      if (DEBUG_MODE) {
        setUser({ ...DEBUG_USER, email, displayName } as any)
        router.push('/projects')
        return
      }

      setIsSyncing(true)
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName })

      // Create session cookie
      await createSessionCookie(user)

      // Wait for user sync to complete before navigating
      setTimeout(() => {
        router.push('/projects')
      }, 500)
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      setIsSyncing(false)
      throw err
    }
  }, [router])

  // MEMOIZATION: Wrap signInWithGoogle with useCallback to prevent unnecessary re-renders
  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null)
      // In debug mode, skip Google auth
      if (DEBUG_MODE) {
        setUser(DEBUG_USER as any)
        router.push('/projects')
        return
      }

      setIsSyncing(true)
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)

      // Create session cookie
      await createSessionCookie(result.user)

      // Wait for user sync to complete before navigating
      setTimeout(() => {
        router.push('/projects')
      }, 500)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
      setIsSyncing(false)
      throw err
    }
  }, [router])

  // MEMOIZATION: Wrap logout with useCallback to prevent unnecessary re-renders
  const logout = useCallback(async () => {
    try {
      setError(null)
      if (DEBUG_MODE) {
        setUser(null)
        router.push('/')
        return
      }

      // Clear session cookie
      await fetch('/api/auth/session', { method: 'DELETE' })

      await signOut(auth)
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Failed to log out')
      throw err
    }
  }, [router])

  // MEMOIZATION: Wrap resetPassword with useCallback to prevent unnecessary re-renders
  const resetPassword = useCallback(async (email: string) => {
    try {
      setError(null)
      if (DEBUG_MODE) {
        console.log('Debug mode: Password reset email would be sent to', email)
        return
      }

      await sendPasswordResetEmail(auth, email)
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email')
      throw err
    }
  }, [])

  // MEMOIZATION: Wrap updateUserProfile with useCallback to prevent unnecessary re-renders
  const updateUserProfile = useCallback(async (displayName: string, photoURL?: string) => {
    try {
      setError(null)
      if (DEBUG_MODE) {
        setUser({ ...user, displayName, photoURL } as any)
        return
      }

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName, photoURL })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
      throw err
    }
  }, [user])

  // MEMOIZATION: Wrap context value with useMemo to prevent unnecessary re-renders of consumers
  // Only recreate when primitive values or memoized callbacks change
  const value = useMemo(() => ({
    user,
    loading,
    isSyncing,
    error,
    syncError,
    signIn,
    signUp,
    logout,
    signInWithGoogle,
    resetPassword,
    updateUserProfile,
    isDebugMode: DEBUG_MODE
  }), [user, loading, isSyncing, error, syncError, signIn, signUp, logout, signInWithGoogle, resetPassword, updateUserProfile])

  return (
    <AuthContext.Provider value={value}>
      {syncError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-50 border-l-4 border-yellow-400 p-4 max-w-md shadow-lg rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{syncError}</p>
            </div>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}