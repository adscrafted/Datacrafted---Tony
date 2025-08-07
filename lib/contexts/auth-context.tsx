'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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
import { auth, DEBUG_MODE, DEBUG_USER } from '@/lib/config/firebase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>
  isDebugMode: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // In debug mode, automatically sign in
    if (DEBUG_MODE) {
      setUser(DEBUG_USER as any)
      setLoading(false)
      return
    }

    // Normal authentication flow
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setError(null)
      // In debug mode, accept any credentials
      if (DEBUG_MODE) {
        setUser(DEBUG_USER as any)
        router.push('/projects')
        return
      }
      
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/projects')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
      throw err
    }
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setError(null)
      // In debug mode, accept any credentials
      if (DEBUG_MODE) {
        setUser({ ...DEBUG_USER, email, displayName } as any)
        router.push('/projects')
        return
      }

      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName })
      router.push('/projects')
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      throw err
    }
  }

  const signInWithGoogle = async () => {
    try {
      setError(null)
      // In debug mode, skip Google auth
      if (DEBUG_MODE) {
        setUser(DEBUG_USER as any)
        router.push('/projects')
        return
      }

      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      router.push('/projects')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
      throw err
    }
  }

  const logout = async () => {
    try {
      setError(null)
      if (DEBUG_MODE) {
        setUser(null)
        router.push('/')
        return
      }

      await signOut(auth)
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Failed to log out')
      throw err
    }
  }

  const resetPassword = async (email: string) => {
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
  }

  const updateUserProfile = async (displayName: string, photoURL?: string) => {
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
  }

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    logout,
    signInWithGoogle,
    resetPassword,
    updateUserProfile,
    isDebugMode: DEBUG_MODE
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}