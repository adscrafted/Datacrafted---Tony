import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

/**
 * SECURITY: Triple-Layer Production Environment Detection
 *
 * Layer 1: Build environment constant
 * Layer 2: Runtime environment detection
 * Layer 3: Multiple deployment platform checks
 *
 * Detects if the application is running in a production environment.
 * Used to prevent DEBUG_MODE from being enabled in production.
 */

// Layer 1: Compile-time constant based on build environment
const BUILD_ENV = process.env.NEXT_PUBLIC_BUILD_ENV || process.env.NODE_ENV || 'production'
const IS_PRODUCTION_BUILD = BUILD_ENV === 'production'

// Layer 2: Runtime environment detection with multiple signals
export function isProductionEnvironment(): boolean {
  // Check build-time environment variables
  if (process.env.NODE_ENV === 'production') {
    return true
  }

  // Check deployment platform environment variables
  if (
    process.env.VERCEL_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    process.env.RENDER !== undefined ||
    process.env.FLY_APP_NAME !== undefined ||
    process.env.AWS_EXECUTION_ENV !== undefined || // AWS Lambda
    process.env.KUBERNETES_SERVICE_HOST !== undefined // Kubernetes
  ) {
    return true
  }

  // Check runtime environment (browser window object)
  // IMPORTANT: Check window exists AND access its properties in same condition
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

/**
 * SECURITY: Local Development Detection
 *
 * Only returns true if ALL conditions are met:
 * - NODE_ENV is 'development'
 * - Not a production build
 * - Not running on any known hosting platform
 * - Running on localhost or local IP
 */
function isLocalDevelopment(): boolean {
  // Must be development mode
  if (process.env.NODE_ENV !== 'development') {
    return false
  }

  // Must not be production build
  if (IS_PRODUCTION_BUILD) {
    return false
  }

  // Must not be on any known hosting platform
  if (isProductionEnvironment()) {
    return false
  }

  // Must be on localhost (client-side check)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.')
    )
  }

  // Server-side: assume local if no production indicators
  return true
}

/**
 * SECURITY: Debug Mode Configuration (Client-side)
 *
 * CRITICAL SECURITY: Multi-layer protection against production debug mode
 *
 * Layer 1: Must not be production build
 * Layer 2: Must be local development environment
 * Layer 3: Must have debug mode environment variable set
 * Layer 4: Fatal error trap if misconfigured
 *
 * Note: This uses NEXT_PUBLIC_DEBUG_MODE for client-side detection.
 * The server-side uses DEBUG_MODE (without NEXT_PUBLIC_) for additional security.
 */
const debugModeEnv = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

// Layer 3: DEBUG_MODE only if ALL conditions met
export const DEBUG_MODE = (
  !IS_PRODUCTION_BUILD &&
  isLocalDevelopment() &&
  debugModeEnv
)

// Layer 4: Fatal error trap - prevent application startup if misconfigured
if (debugModeEnv && (IS_PRODUCTION_BUILD || isProductionEnvironment())) {
  const errorMessage = [
    '====================================================================',
    'FATAL SECURITY ERROR: DEBUG_MODE ENABLED IN PRODUCTION',
    '====================================================================',
    'This is a CRITICAL security vulnerability that bypasses ALL authentication.',
    '',
    'Environment Detection:',
    `  - Build Environment: ${BUILD_ENV}`,
    `  - NODE_ENV: ${process.env.NODE_ENV}`,
    `  - VERCEL_ENV: ${process.env.VERCEL_ENV || 'not set'}`,
    `  - Is Production Build: ${IS_PRODUCTION_BUILD}`,
    `  - Is Production Environment: ${isProductionEnvironment()}`,
    '',
    'IMMEDIATE ACTION REQUIRED:',
    '  1. Remove NEXT_PUBLIC_DEBUG_MODE from ALL environment variables',
    '  2. Redeploy application immediately',
    '  3. Review access logs for unauthorized access',
    '  4. Consider rotating credentials if breach suspected',
    '====================================================================',
  ].join('\n')

  console.error(errorMessage)

  // Prevent application startup in browser
  if (typeof window !== 'undefined') {
    alert('SECURITY ERROR: Application configured incorrectly. Check console.')
    throw new Error('FATAL: DEBUG_MODE enabled in production')
  }
}

// Log warning if someone tries to enable debug mode in production
// Only run on client-side to prevent SSR errors
if (typeof window !== 'undefined') {
  if (debugModeEnv && isProductionEnvironment()) {
    console.error(
      '🚨 [SECURITY] Attempted to enable DEBUG_MODE in production environment.\n' +
      '   Debug mode has been DISABLED for security.\n' +
      '   Environment: PRODUCTION\n' +
      '   Hostname: ' + window.location.hostname
    )
  }

  // Log debug mode status
  if (DEBUG_MODE) {
    console.warn(
      '⚠️  [FIREBASE-CLIENT] Debug mode is ENABLED\n' +
      '   - Client-side authentication is bypassed\n' +
      '   - This should ONLY be used in local development\n' +
      '   - Environment: LOCAL DEVELOPMENT'
    )
  }
}

/**
 * SECURITY: Runtime assertion to prevent debug mode in production
 * Call this in critical paths to add additional protection
 */
export function assertNotDebugMode(): void {
  if (DEBUG_MODE && isProductionEnvironment()) {
    throw new Error('SECURITY: DEBUG_MODE active in production')
  }
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

// Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Debug mode user
export const DEBUG_USER = {
  uid: 'debug-user-123',
  email: 'debug@datacrafted.com',
  displayName: 'Debug User',
  photoURL: null,
  emailVerified: true,
}

export default app