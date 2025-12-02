/**
 * Nonce Helper for React Components
 *
 * This module provides utilities for accessing and using CSP nonces
 * in Next.js App Router components and layouts.
 *
 * USAGE IN COMPONENTS:
 * ```typescript
 * import { getNonce } from '@/lib/security/nonce'
 * import { headers } from 'next/headers'
 *
 * export default function Page() {
 *   const nonce = getNonce(headers())
 *   return <script nonce={nonce}>...</script>
 * }
 * ```
 *
 * SECURITY NOTE:
 * The nonce is generated in middleware.ts and passed via the x-nonce header.
 * This ensures each request has a unique, cryptographically secure nonce.
 */

import { headers as nextHeaders } from 'next/headers'

/**
 * Get nonce from Next.js headers
 *
 * The nonce is set by middleware.ts in the x-nonce header.
 * This function extracts it for use in React components.
 *
 * IMPORTANT: This function can only be called in Server Components
 * because it uses Next.js headers() which is a server-only API.
 *
 * @param headersList - Optional headers list (for testing)
 * @returns Nonce string or undefined if not found
 */
export async function getNonce(headersList?: Awaited<ReturnType<typeof nextHeaders>>): Promise<string | undefined> {
  try {
    const headers = headersList || await nextHeaders()
    return headers.get('x-nonce') || undefined
  } catch (error) {
    // headers() throws an error if called outside of a Server Component
    console.warn('[NONCE] Failed to get nonce from headers:', error)
    return undefined
  }
}

/**
 * Get nonce for use in script/style tags
 *
 * Returns an object with nonce attribute for easy spreading:
 * <script {...getNonceProps()} />
 *
 * @param headersList - Optional headers list
 * @returns Object with nonce property or empty object
 */
export async function getNonceProps(headersList?: Awaited<ReturnType<typeof nextHeaders>>): Promise<{ nonce?: string }> {
  const nonce = await getNonce(headersList)
  return nonce ? { nonce } : {}
}

/**
 * Check if nonce is available
 *
 * Useful for conditional logic based on CSP enforcement.
 *
 * @param headersList - Optional headers list
 * @returns true if nonce is available, false otherwise
 */
export async function hasNonce(headersList?: Awaited<ReturnType<typeof nextHeaders>>): Promise<boolean> {
  return (await getNonce(headersList)) !== undefined
}

/**
 * Development-only: Log nonce for debugging
 *
 * Helps verify that nonces are being generated and passed correctly.
 * Only logs in development mode to avoid production noise.
 *
 * @param headersList - Optional headers list
 */
export async function debugNonce(headersList?: Awaited<ReturnType<typeof nextHeaders>>): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    const nonce = await getNonce(headersList)
    if (nonce) {
      console.log('[NONCE DEBUG] Nonce available:', nonce.substring(0, 8) + '...')
    } else {
      console.warn('[NONCE DEBUG] No nonce available')
    }
  }
}
