/**
 * Server-Only Configuration
 *
 * SECURITY: This module contains server-side only configuration.
 * NEVER import this file in client-side code.
 *
 * Purpose: Centralize all server-side environment variables and debug mode logic
 * to prevent accidental client-side exposure.
 */

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
 * SECURITY: Debug Mode Configuration (Server-side ONLY)
 *
 * DEBUG_MODE provides a way to bypass authentication during local development.
 *
 * CRITICAL SECURITY: Multi-layer protection
 *
 * Layer 1: Must not be production build
 * Layer 2: Must be local development environment
 * Layer 3: Must have DEBUG_MODE environment variable set (NOT NEXT_PUBLIC_)
 * Layer 4: Fatal error trap if misconfigured
 *
 * SECURITY REQUIREMENTS:
 * - DEBUG_MODE can ONLY be enabled in local development
 * - DEBUG_MODE is ALWAYS false in production environments
 * - Attempting to enable DEBUG_MODE in production throws a fatal error
 * - Uses DEBUG_MODE (NOT NEXT_PUBLIC_DEBUG_MODE) to prevent client-side access
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

// Warn if NEXT_PUBLIC_DEBUG_MODE is detected (deprecated)
if (process.env.NEXT_PUBLIC_DEBUG_MODE !== undefined) {
  console.warn(
    '\n' +
    '⚠️  SECURITY WARNING: NEXT_PUBLIC_DEBUG_MODE detected\n' +
    '   This environment variable is deprecated and should be removed.\n' +
    '   Use DEBUG_MODE (without NEXT_PUBLIC_) instead.\n' +
    '   NEXT_PUBLIC_ variables are exposed to the client and should never\n' +
    '   be used for security-sensitive configuration.\n'
  )
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

/**
 * Check if the application is running in production
 */
export function isProductionEnvironment(): boolean {
  return isProduction
}

/**
 * Debug user for testing (server-side only)
 */
export const DEBUG_USER = {
  uid: 'debug-user-123',
  email: 'debug@datacrafted.com',
  displayName: 'Debug User',
  photoURL: null,
  emailVerified: true,
  phoneNumber: null,
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
