import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/**
 * Client-side Firebase Configuration
 *
 * This file contains the client-side Firebase initialization.
 * For server-side operations, use firebase-admin.ts instead.
 *
 * SECURITY NOTE: This file no longer exports DEBUG_MODE.
 * Debug mode for authentication bypass is server-side only.
 * For client-side debug logging, use lib/debug.ts instead.
 *
 * OPTIMIZATION NOTE: Only auth is imported here. Firestore and Storage
 * were removed as the app uses Prisma for database operations.
 * Add them back only if needed to reduce bundle size (~50-100KB each).
 */

/**
 * Check if the application is running in production
 * This is a simplified check for client-side use only
 */
export function isProductionEnvironment(): boolean {
  // Check build-time environment variables
  if (process.env.NODE_ENV === 'production') {
    return true
  }

  // Check runtime environment (browser window object)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    // Consider it production if not localhost or 127.0.0.1
    if (
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      !hostname.startsWith('192.168.') && // Local network
      !hostname.startsWith('10.') // Local network
    ) {
      return true
    }
  }

  return false
}

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
}

// Initialize Firebase only on client side
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()

// Firebase services - Only auth is exported (Prisma handles database)
export const auth = getAuth(app)

export default app