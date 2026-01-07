import type { DataRow, AnalysisResult } from '@/lib/store'
import type { ChartConfig } from '@/lib/types/chart-types'
import { auth } from '@/lib/config/firebase'

/**
 * Analyzes data using OpenAI GPT-4 for intelligent insights and visualization recommendations
 * Returns an object with the promise and a cancel function for proper cleanup
 */
export function analyzeData(
  data: DataRow[],
  onProgress?: (progress: number, usingAI: boolean) => void
): {
  promise: Promise<AnalysisResult>
  cancel: () => void
} {
  if (!data || data.length === 0) {
    console.error('❌ [AI-ANALYSIS] No data provided for analysis')
    throw new Error('No data provided for analysis')
  }

  // Create controller for this request
  const controller = new AbortController()

  // Internal async function that performs the analysis
  const performAnalysis = async (): Promise<AnalysisResult> => {
    let currentProgress = 10
    onProgress?.(currentProgress, true)

    // Get Firebase auth token for API authentication
    let authToken: string | undefined
    try {
      const currentUser = auth.currentUser
      if (currentUser) {
        authToken = await currentUser.getIdToken()
        console.log('✅ [AI-ANALYSIS] Got Firebase auth token for API request')
      } else {
        console.warn('⚠️ [AI-ANALYSIS] No authenticated user - using unauthenticated upload')
        // Continue without auth token (server will handle anonymous users)
      }
    } catch (authError) {
      console.warn('⚠️ [AI-ANALYSIS] Failed to get auth token:', authError)
      // Continue without token - let API decide if auth is required
    }

    // Simulate incremental progress during the request
    const progressInterval = setInterval(() => {
      // Gradually increase progress from 10% to 70% over time
      if (currentProgress < 70) {
        currentProgress = Math.min(70, currentProgress + 5)
        onProgress?.(currentProgress, true)
      }
    }, 2000) // Update every 2 seconds

    // Dynamic timeout based on dataset size
    const dataSize = data.length
    const timeoutMs = dataSize > 10000 ? 180000 : dataSize > 5000 ? 150000 : 120000

    console.log(`[AI-ANALYSIS] Using ${timeoutMs / 1000}s timeout for ${dataSize} rows`)

    const timeoutId = setTimeout(() => {
      console.warn(`⚠️ [AI-ANALYSIS] Request timeout after ${timeoutMs / 1000} seconds`)
      controller.abort()
    }, timeoutMs)

    // Build headers with optional auth token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ data }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      clearInterval(progressInterval)
      onProgress?.(80, true)

      if (!response.ok) {
        const errorData = await response.json().catch((e) => {
          console.error('❌ [AI-ANALYSIS] Failed to parse error response:', e)
          return {}
        })

        console.error('❌ [AI-ANALYSIS] API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })

        // Handle authentication errors (401 Unauthorized)
        if (response.status === 401) {
          console.error('❌ [AI-ANALYSIS] Authentication failed - user not logged in or token invalid')
          throw new Error('Authentication required. Please sign in to analyze your data.')
        }

        // Handle paywall (402) - show upgrade modal
        if (response.status === 402 && errorData.type === 'paywall') {
          console.log('💰 [AI-ANALYSIS] Paywall triggered:', errorData)
          // Import UI store and show paywall modal (dynamic import to avoid circular deps)
          const { useUIStore } = await import('@/lib/stores/ui-store')
          useUIStore.getState().openPaywallModal('analysis', {
            used: errorData.usage?.used ?? 0,
            limit: errorData.usage?.limit ?? 3,
            plan: errorData.usage?.plan ?? 'free'
          })
          // Throw a special error that callers can detect
          const paywallError = new Error('Analysis limit reached. Please upgrade to continue.')
          ;(paywallError as any).isPaywall = true
          throw paywallError
        }

        // Handle rate limiting (429)
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a few minutes.')
        }

        // Handle OpenAI API key missing (500)
        if (response.status === 500 && errorData.error?.includes('API key')) {
          throw new Error('OpenAI API is not configured. Please check your environment variables.')
        }

        // Extract error message from response
        const errorMessage = errorData.error?.message || errorData.error || errorData.details || `Analysis failed with status ${response.status}`
        throw new Error(errorMessage)
      }

      const result: AnalysisResult = await response.json()
      onProgress?.(90, true)

      // CRITICAL LOGGING: Check what frontend receives from API
      console.log('🔍 [AI-ANALYSIS] ===== RECEIVED FROM API =====')
      console.log('🔍 [AI-ANALYSIS] result.chartConfig.length:', result?.chartConfig?.length || 0)
      console.log('🔍 [AI-ANALYSIS] Chart titles received:', result?.chartConfig?.map(c => c.title).join(', '))
      console.log('🔍 [AI-ANALYSIS] Chart types received:', result?.chartConfig?.map(c => c.type).join(', '))
      console.log('🔍 [AI-ANALYSIS] ===== END RECEIVED =====')

      // Validate the response structure
      if (!result.insights || !Array.isArray(result.insights)) {
        console.error('❌ [AI-ANALYSIS] Invalid insights format:', result.insights)
        throw new Error('Invalid analysis response format')
      }

      if (!result.chartConfig || !Array.isArray(result.chartConfig)) {
        console.error('❌ [AI-ANALYSIS] Invalid chartConfig format:', result.chartConfig)
        throw new Error('Invalid chart configuration in response')
      }

      if (!result.summary || typeof result.summary !== 'object') {
        console.error('❌ [AI-ANALYSIS] Invalid summary format:', result.summary)
        throw new Error('Invalid summary in response')
      }

      onProgress?.(100, true)

      // CRITICAL LOGGING: Check what we're returning to the app
      console.log('✅ [AI-ANALYSIS] ===== RETURNING TO APP =====')
      console.log('✅ [AI-ANALYSIS] result.chartConfig.length:', result?.chartConfig?.length || 0)
      console.log('✅ [AI-ANALYSIS] Chart titles returning:', result?.chartConfig?.map(c => c.title).join(', '))
      console.log('✅ [AI-ANALYSIS] ===== END RETURNING =====')

      return result
    } catch (error) {
      // Cleanup on error
      clearTimeout(timeoutId)
      clearInterval(progressInterval)

      // Handle abort errors gracefully - they're expected when we cancel
      // CRITICAL FIX: Don't return empty analysis - throw so caller can handle properly
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('ℹ️ [AI-ANALYSIS] Request was cancelled')
        throw new Error('Analysis was cancelled by user')
      }

      console.error('❌ [AI-ANALYSIS] Error in analyzeData:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  // Return the promise and cancel function
  return {
    promise: performAnalysis(),
    cancel: () => {
      console.log('🔵 [AI-ANALYSIS] Cancelling analysis')
      controller.abort()
    }
  }
}