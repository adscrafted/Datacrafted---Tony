/**
 * Firebase Admin SDK Configuration
 *
 * Server-side Firebase Admin SDK initialization for token verification
 * and other backend operations. This file should only be imported in
 * server-side code (API routes, server actions, etc.)
 *
 * IMPORTANT: Never import this file in client-side code.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { DEBUG_MODE, DEBUG_USER, assertNotDebugMode } from './server-config'

// Re-export for backward compatibility
export { DEBUG_MODE, DEBUG_USER, assertNotDebugMode }

let adminApp: App | null = null
let adminAuth: Auth | null = null

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment variables
 */
function initializeFirebaseAdmin(): App {
  // Return existing app if already initialized
  if (adminApp) {
    return adminApp
  }

  // Check if already initialized
  const existingApps = getApps()
  if (existingApps.length > 0) {
    adminApp = existingApps[0]
    return adminApp
  }

  // In debug mode, we don't need real credentials
  if (DEBUG_MODE) {
    console.warn(
      '⚠️ [FIREBASE-ADMIN] Running in DEBUG MODE - authentication will be bypassed'
    )
    // Initialize with minimal config for debug mode
    try {
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'debug-project',
      })
      return adminApp
    } catch (error) {
      console.error('[FIREBASE-ADMIN] Failed to initialize in debug mode:', error)
      throw error
    }
  }

  try {
    // Method 1: Using service account key file (recommended for development)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

      console.log('[FIREBASE-ADMIN] Key length:', serviceAccountJson.length)
      console.log('[FIREBASE-ADMIN] Key starts with:', serviceAccountJson.substring(0, 20))
      console.log('[FIREBASE-ADMIN] Key ends with:', serviceAccountJson.substring(serviceAccountJson.length - 20))

      // Check if it's base64 encoded (doesn't start with '{')
      if (!serviceAccountJson.trim().startsWith('{')) {
        console.log('[FIREBASE-ADMIN] Detected base64 encoded key, decoding...')
        try {
          // Strip all whitespace (including newlines) from base64 before decoding
          // This handles cases where Railway or copy/paste introduces line breaks
          const cleanedBase64 = serviceAccountJson.replace(/\s/g, '')
          console.log('[FIREBASE-ADMIN] Cleaned base64 length:', cleanedBase64.length)
          serviceAccountJson = Buffer.from(cleanedBase64, 'base64').toString('utf-8')
          console.log('[FIREBASE-ADMIN] Decoded JSON length:', serviceAccountJson.length)
          console.log('[FIREBASE-ADMIN] Decoded JSON starts with:', serviceAccountJson.substring(0, 50))
        } catch (decodeError) {
          console.error('❌ [FIREBASE-ADMIN] Failed to decode base64:', decodeError)
          throw decodeError
        }
      }

      // Parse the JSON
      let serviceAccount
      try {
        serviceAccount = JSON.parse(serviceAccountJson)
        console.log('[FIREBASE-ADMIN] JSON parsed successfully')
        console.log('[FIREBASE-ADMIN] Project ID from key:', serviceAccount.project_id)
        console.log('[FIREBASE-ADMIN] Client email:', serviceAccount.client_email)
        console.log('[FIREBASE-ADMIN] Has private_key:', !!serviceAccount.private_key)
        console.log('[FIREBASE-ADMIN] Private key starts with:', serviceAccount.private_key?.substring(0, 30))
      } catch (parseError) {
        console.error('❌ [FIREBASE-ADMIN] JSON parse failed:', parseError)
        console.error('[FIREBASE-ADMIN] JSON string (first 200 chars):', serviceAccountJson.substring(0, 200))
        throw parseError
      }

      // Ensure private_key has actual newlines (not escaped \n)
      if (serviceAccount.private_key) {
        // If private_key contains literal \n (as two characters), convert to actual newlines
        if (serviceAccount.private_key.includes('\\n')) {
          console.log('[FIREBASE-ADMIN] Converting escaped newlines in private_key')
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
        }
        // Verify private key format
        if (!serviceAccount.private_key.includes('-----BEGIN')) {
          console.error('❌ [FIREBASE-ADMIN] Private key does not appear to be in PEM format')
          console.error('[FIREBASE-ADMIN] Private key preview:', serviceAccount.private_key.substring(0, 100))
        }
      }

      console.log('[FIREBASE-ADMIN] Initializing Firebase Admin with credentials...')
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      })
      console.log('✅ [FIREBASE-ADMIN] Initialized with service account key')
      return adminApp
    }

    // Method 2: Using individual credentials (alternative method)
    if (
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      })
      console.log('✅ [FIREBASE-ADMIN] Initialized with individual credentials')
      return adminApp
    }

    // Method 3: Default credentials (works in Cloud Functions, Cloud Run, etc.)
    adminApp = initializeApp()
    console.log('✅ [FIREBASE-ADMIN] Initialized with default credentials')
    return adminApp
  } catch (error) {
    console.error('❌ [FIREBASE-ADMIN] Initialization failed:', error)
    throw new Error(
      'Firebase Admin SDK initialization failed. Please check your environment variables.'
    )
  }
}

/**
 * Get Firebase Admin Auth instance
 * Lazy initialization on first access
 */
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = initializeFirebaseAdmin()
    adminAuth = getAuth(app)
  }
  return adminAuth
}

/**
 * Get Firebase Admin App instance
 */
export function getAdminApp(): App {
  if (!adminApp) {
    adminApp = initializeFirebaseAdmin()
  }
  return adminApp
}
