/**
 * Firebase Admin SDK Configuration
 *
 * Server-side Firebase Admin SDK initialization for token verification
 * and other backend operations. This file should only be imported in
 * server-side code (API routes, server actions, etc.)
 *
 * IMPORTANT: Never import this file in client-side code.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'

/**
 * SECURITY: Triple-Layer Production Environment Detection (Server-side)
 *
 * Layer 1: Build environment constant
 * Layer 2: Multiple deployment platform detection
 * Layer 3: Runtime environment checks
 *
 * Detects if the application is running in a production environment.
 * This prevents DEBUG_MODE from being enabled in production environments.
 */

// Layer 1: Compile-time constant based on build environment
const BUILD_ENV = process.env.NEXT_PUBLIC_BUILD_ENV || process.env.NODE_ENV || 'production'
const IS_PRODUCTION_BUILD = BUILD_ENV === 'production'

// Layer 2: Multiple platform detection
const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT === 'production' ||
  process.env.RENDER !== undefined ||
  process.env.FLY_APP_NAME !== undefined ||
  process.env.AWS_EXECUTION_ENV !== undefined || // AWS Lambda
  process.env.KUBERNETES_SERVICE_HOST !== undefined || // Kubernetes
  process.env.HEROKU_APP_NAME !== undefined || // Heroku
  process.env.CF_PAGES !== undefined // Cloudflare Pages

/**
 * SECURITY: Local Development Detection
 *
 * Only returns true if ALL conditions are met:
 * - NODE_ENV is 'development'
 * - Not a production build
 * - Not running on any known hosting platform
 *
 * This ensures debug mode cannot be enabled on any hosted environment.
 */
const isLocalDevelopment =
  process.env.NODE_ENV === 'development' &&
  !IS_PRODUCTION_BUILD &&
  !process.env.VERCEL_ENV &&
  !process.env.RAILWAY_ENVIRONMENT &&
  !process.env.RENDER &&
  !process.env.FLY_APP_NAME &&
  !process.env.AWS_EXECUTION_ENV &&
  !process.env.KUBERNETES_SERVICE_HOST &&
  !process.env.HEROKU_APP_NAME &&
  !process.env.CF_PAGES

/**
 * SECURITY: Debug Mode Configuration (Server-side)
 *
 * DEBUG_MODE provides a way to bypass authentication during local development.
 *
 * CRITICAL SECURITY: Multi-layer protection
 *
 * Layer 1: Must not be production build
 * Layer 2: Must be local development environment
 * Layer 3: Must have DEBUG_MODE environment variable set (not NEXT_PUBLIC_)
 * Layer 4: Fatal error trap if misconfigured
 *
 * SECURITY REQUIREMENTS:
 * - DEBUG_MODE can ONLY be enabled in local development
 * - DEBUG_MODE is ALWAYS false in production environments
 * - Attempting to enable DEBUG_MODE in production throws a fatal error
 * - Uses DEBUG_MODE (not NEXT_PUBLIC_DEBUG_MODE) to prevent client-side access
 *
 * @throws {Error} Fatal error if DEBUG_MODE is attempted in production
 */
export const DEBUG_MODE = (
  !IS_PRODUCTION_BUILD &&
  isLocalDevelopment &&
  process.env.DEBUG_MODE === 'true'
)

// Layer 4: Fatal error trap - prevent application startup if misconfigured
if (process.env.DEBUG_MODE === 'true' && (IS_PRODUCTION_BUILD || isProduction)) {
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
    `  - RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'not set'}`,
    `  - Is Production Build: ${IS_PRODUCTION_BUILD}`,
    `  - Is Production: ${isProduction}`,
    `  - Is Local Development: ${isLocalDevelopment}`,
    '',
    'Platform Detection:',
    `  - Render: ${process.env.RENDER ? 'detected' : 'not detected'}`,
    `  - Fly.io: ${process.env.FLY_APP_NAME ? 'detected' : 'not detected'}`,
    `  - AWS Lambda: ${process.env.AWS_EXECUTION_ENV ? 'detected' : 'not detected'}`,
    `  - Kubernetes: ${process.env.KUBERNETES_SERVICE_HOST ? 'detected' : 'not detected'}`,
    '',
    'IMMEDIATE ACTION REQUIRED:',
    '  1. Remove DEBUG_MODE from ALL environment variables',
    '  2. Redeploy application immediately',
    '  3. Review access logs for unauthorized access',
    '  4. Consider rotating credentials if breach suspected',
    '  5. Audit all recent authentication events',
    '====================================================================',
  ].join('\n')

  console.error(errorMessage)
  throw new Error('FATAL: DEBUG_MODE enabled in production')
}

/**
 * SECURITY: Runtime assertion to prevent debug mode in production
 * Call this in critical paths to add additional protection
 */
export function assertNotDebugMode(): void {
  if (DEBUG_MODE && isProduction) {
    throw new Error('SECURITY: DEBUG_MODE active in production')
  }
}

// Log debug mode status on initialization
if (DEBUG_MODE) {
  console.warn(
    '\n' +
    '⚠️  WARNING: DEBUG_MODE is ENABLED\n' +
    '   - Authentication is BYPASSED\n' +
    '   - All API routes accept debug user\n' +
    '   - This should ONLY be used in local development\n' +
    '   - Environment: LOCAL DEVELOPMENT\n'
  )
} else if (isProduction) {
  console.log('✅ [SECURITY] Production mode - DEBUG_MODE is disabled')
}

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
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      )
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

/**
 * Debug user for testing
 */
export const DEBUG_USER = {
  uid: 'debug-user-123',
  email: 'debug@datacrafted.com',
  displayName: 'Debug User',
  photoURL: null,
  emailVerified: true,
  phoneNumber: null,
}
