'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/contexts/auth-context'

interface UsageData {
  analyses: {
    used: number
    limit: number
    remaining: number
  }
  chatMessages: {
    used: number
    limit: number
    remaining: number
  }
  subscription: {
    tier: string
    status: string | null
    endDate: string | null
    stripeCustomerId: string | null
  }
}

interface UseUsageReturn {
  usage: UsageData | null
  isLoading: boolean
  error: string | null
  canAnalyze: boolean
  canChat: boolean
  isPro: boolean
  refresh: () => Promise<void>
}

/**
 * Hook for fetching and caching user usage data
 *
 * Usage:
 * ```tsx
 * const { usage, canAnalyze, canChat, isPro, isLoading, refresh } = useUsage()
 *
 * if (!canAnalyze) {
 *   // Show paywall
 * }
 * ```
 */
export function useUsage(): UseUsageReturn {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setUsage(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const token = await user.getIdToken()
      const response = await fetch('/api/user/usage', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch usage data')
      }

      const data = await response.json()
      setUsage(data)
    } catch (err) {
      console.error('[useUsage] Failed to fetch:', err)
      setError(err instanceof Error ? err.message : 'Failed to load usage')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Initial fetch
  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchUsage()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchUsage])

  // Derived values
  const isPro = usage?.subscription?.tier === 'pro' || usage?.subscription?.tier === 'enterprise'
  const canAnalyze = isPro || (usage?.analyses?.remaining ?? 0) > 0
  const canChat = isPro || (usage?.chatMessages?.remaining ?? 0) > 0

  return {
    usage,
    isLoading,
    error,
    canAnalyze,
    canChat,
    isPro,
    refresh: fetchUsage,
  }
}

/**
 * Selector hook for just checking if user can analyze
 * Lighter weight than full useUsage
 */
export function useCanAnalyze(): boolean {
  const { canAnalyze } = useUsage()
  return canAnalyze
}

/**
 * Selector hook for just checking if user can chat
 */
export function useCanChat(): boolean {
  const { canChat } = useUsage()
  return canChat
}

/**
 * Selector hook for checking Pro status
 */
export function useIsPro(): boolean {
  const { isPro } = useUsage()
  return isPro
}
