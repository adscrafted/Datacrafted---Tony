/**
 * API Client utilities for authenticated requests
 */

import type { User } from 'firebase/auth'

/**
 * Get Firebase ID token from authenticated user
 * This token is verified server-side using Firebase Admin SDK
 *
 * @param user - Firebase user object
 * @param forceRefresh - Force token refresh (useful when token is expired)
 * @returns Firebase ID token or null
 */
export async function getAuthToken(
  user: User | null,
  forceRefresh: boolean = false
): Promise<string | null> {
  if (!user) {
    return null
  }

  try {
    // Get Firebase ID token (will refresh automatically if expired)
    const token = await user.getIdToken(forceRefresh)
    return token
  } catch (error) {
    console.error('[API-CLIENT] Error getting auth token:', error)
    return null
  }
}

/**
 * Create authorization header for Firebase authenticated requests
 *
 * @param user - Firebase user object
 * @param forceRefresh - Force token refresh
 * @returns Authorization header value or null
 */
export async function createAuthHeader(
  user: User | null,
  forceRefresh: boolean = false
): Promise<string | null> {
  const token = await getAuthToken(user, forceRefresh)

  if (!token) {
    return null
  }

  return `Bearer ${token}`
}

/**
 * Make an authenticated API request
 *
 * @param url - API endpoint URL
 * @param user - Firebase user object
 * @param options - Fetch options
 * @returns Fetch response
 * @throws Error if user is not authenticated
 */
export async function authenticatedFetch(
  url: string,
  user: User | null,
  options: RequestInit = {}
): Promise<Response> {
  if (!user) {
    throw new Error('No authenticated user available')
  }

  const authHeader = await createAuthHeader(user)

  if (!authHeader) {
    throw new Error('Failed to get authentication token')
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  })

  // If we get a 401, try refreshing the token once
  if (response.status === 401 && !(options.headers as Record<string, string>)?.['X-Token-Refreshed']) {
    console.log('[API-CLIENT] Token expired, refreshing...')
    const refreshedAuthHeader = await createAuthHeader(user, true)

    if (refreshedAuthHeader) {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: refreshedAuthHeader,
          'Content-Type': 'application/json',
          'X-Token-Refreshed': 'true', // Prevent infinite retry
        },
      })
    }
  }

  return response
}

/**
 * Sync Firebase user to database
 */
export async function syncUserToDatabase(user: User): Promise<{
  success: boolean
  user?: any
  error?: string
}> {
  try {
    console.log('[API-CLIENT] Syncing user to database:', user.uid)

    const response = await authenticatedFetch('/api/user/sync', user, {
      method: 'POST',
    })

    if (!response.ok) {
      // Don't throw errors for database connection issues
      // The app can still work without database sync
      const errorText = await response.text()
      let errorMessage = 'Failed to sync user'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }

      // Log as warning, not error, for database connection issues
      if (errorMessage.includes('database') || errorMessage.includes('Prisma')) {
        console.warn('[API-CLIENT] Database sync unavailable, continuing without persistence')
        return {
          success: false,
          error: 'Database temporarily unavailable'
        }
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    console.log('[API-CLIENT] User synced successfully:', data.user?.id)

    return data
  } catch (error) {
    console.error('[API-CLIENT] Error syncing user:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
