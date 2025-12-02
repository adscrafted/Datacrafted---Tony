/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at application startup
 * to prevent runtime errors due to missing or invalid configuration.
 *
 * This validation runs server-side only and will prevent the application
 * from starting if critical environment variables are missing or invalid.
 */

import { z } from 'zod'

/**
 * Environment variable schema
 * Defines all required and optional environment variables with validation rules
 */
const envSchema = z.object({
  // ===== Firebase Client Configuration =====
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API key is required'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase auth domain is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase project ID is required'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase storage bucket is required'),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'Firebase messaging sender ID is required'),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Firebase app ID is required'),

  // ===== Firebase Admin Configuration =====
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1, 'Firebase Admin project ID is required'),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email('Firebase Admin client email must be valid'),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1, 'Firebase Admin private key is required'),

  // ===== Database Configuration =====
  DATABASE_URL: z.string().url('Database URL must be a valid URL'),

  // ===== OpenAI Configuration =====
  OPENAI_API_KEY: z.string()
    .startsWith('sk-', 'OpenAI API key must start with "sk-"')
    .min(20, 'OpenAI API key appears to be invalid'),

  // ===== Application Configuration =====
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DEBUG_MODE: z.enum(['true', 'false']).optional(),

  // ===== Optional: Redis/Cache Configuration =====
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // ===== Optional: Vercel Configuration =====
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL: z.string().optional(),

  // ===== Optional: Railway Configuration =====
  RAILWAY_ENVIRONMENT: z.string().optional(),

  // ===== Optional: Render Configuration =====
  RENDER: z.string().optional(),

  // ===== Optional: Fly.io Configuration =====
  FLY_APP_NAME: z.string().optional()
})

/**
 * Type inference from schema
 * Provides type-safe access to validated environment variables
 */
export type ValidatedEnv = z.infer<typeof envSchema>

/**
 * Validate environment variables
 *
 * Call this function at application startup (in layout.tsx or a top-level component)
 * to ensure all required environment variables are present and valid.
 *
 * @throws {Error} If validation fails, the process will exit with code 1
 *
 * @example
 * ```typescript
 * // In app/layout.tsx (server-side only)
 * if (typeof window === 'undefined') {
 *   validateEnvironment()
 * }
 * ```
 */
export function validateEnvironment(): ValidatedEnv {
  try {
    const validated = envSchema.parse(process.env)

    console.log('✅ Environment variables validated successfully')

    // SECURITY: Additional checks for production environment
    if (process.env.NODE_ENV === 'production') {
      // CRITICAL: Check for forbidden debug mode variables in production
      const forbiddenVars = [
        'DEBUG_MODE',
        'NEXT_PUBLIC_DEBUG_MODE',
        'SKIP_AUTH',
        'DISABLE_AUTH',
      ]

      const foundForbidden = forbiddenVars.filter(varName => process.env[varName] === 'true')

      if (foundForbidden.length > 0) {
        console.error('====================================================================')
        console.error('CRITICAL SECURITY ERROR: FORBIDDEN VARIABLES IN PRODUCTION')
        console.error('====================================================================')
        console.error('The following security-bypassing variables are set to true:')
        foundForbidden.forEach(varName => {
          console.error(`  - ${varName}`)
        })
        console.error('')
        console.error('IMMEDIATE ACTION REQUIRED:')
        console.error('  1. Remove these variables from production environment')
        console.error('  2. Redeploy application immediately')
        console.error('  3. Review access logs for unauthorized access')
        console.error('  4. Consider rotating credentials if breach suspected')
        console.error('====================================================================')

        // Prevent application startup
        throw new Error(
          `SECURITY: Forbidden variables in production: ${foundForbidden.join(', ')}`
        )
      }

      // Warn if deprecated NEXT_PUBLIC_DEBUG_MODE exists
      if (process.env.NEXT_PUBLIC_DEBUG_MODE !== undefined) {
        console.warn(
          '⚠️ WARNING: NEXT_PUBLIC_DEBUG_MODE is deprecated and should be removed\n' +
          '   This environment variable exposes debug configuration to the client bundle\n' +
          '   Use DEBUG_MODE (without NEXT_PUBLIC_) for server-only debug configuration\n' +
          '   Remove NEXT_PUBLIC_DEBUG_MODE from ALL environment files'
        )
      }

      // Recommend Redis for production
      if (!process.env.UPSTASH_REDIS_URL) {
        console.warn(
          '⚠️ WARNING: No Redis configuration found for production\n' +
          '   Rate limiting and caching will use in-memory store (not suitable for multi-instance deployments)\n' +
          '   Consider adding UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN for production use'
        )
      }
    }

    return validated
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:\n')

      // Group errors by category
      const errors = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }))

      // Categorize errors
      const firebaseErrors = errors.filter(e => e.path.includes('FIREBASE'))
      const databaseErrors = errors.filter(e => e.path.includes('DATABASE'))
      const openaiErrors = errors.filter(e => e.path.includes('OPENAI'))
      const otherErrors = errors.filter(e =>
        !e.path.includes('FIREBASE') &&
        !e.path.includes('DATABASE') &&
        !e.path.includes('OPENAI')
      )

      if (firebaseErrors.length > 0) {
        console.error('\n🔥 Firebase Configuration:')
        firebaseErrors.forEach(err => {
          console.error(`   - ${err.path}: ${err.message}`)
        })
      }

      if (databaseErrors.length > 0) {
        console.error('\n🗄️  Database Configuration:')
        databaseErrors.forEach(err => {
          console.error(`   - ${err.path}: ${err.message}`)
        })
      }

      if (openaiErrors.length > 0) {
        console.error('\n🤖 OpenAI Configuration:')
        openaiErrors.forEach(err => {
          console.error(`   - ${err.path}: ${err.message}`)
        })
      }

      if (otherErrors.length > 0) {
        console.error('\n⚙️  Other Configuration:')
        otherErrors.forEach(err => {
          console.error(`   - ${err.path}: ${err.message}`)
        })
      }

      console.error(
        '\n💡 Tip: Copy .env.example to .env.local and fill in the required values\n' +
        '   See documentation for instructions on obtaining these credentials\n'
      )

      // Exit process in production/test, throw error in development for better DX
      if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
        process.exit(1)
      } else {
        throw new Error('Environment validation failed. Check console for details.')
      }
    }

    throw error
  }
}

/**
 * Get validated environment variables
 *
 * Returns type-safe access to environment variables after validation.
 * Should only be called after validateEnvironment() has been run.
 *
 * @returns Validated environment variables with proper types
 */
export function getEnv(): ValidatedEnv {
  // In production, we trust that validation was done at startup
  // In development, we can re-validate on each call for safety
  if (process.env.NODE_ENV === 'development') {
    return validateEnvironment()
  }

  return process.env as unknown as ValidatedEnv
}

/**
 * Check if the application is running in production
 */
export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    !!process.env.RENDER ||
    !!process.env.FLY_APP_NAME
  )
}

/**
 * Check if debug mode is enabled (server-side only)
 *
 * SECURITY: Debug mode is automatically disabled in production
 * regardless of environment variable setting.
 *
 * NOTE: This function uses server-only DEBUG_MODE environment variable.
 * NEXT_PUBLIC_DEBUG_MODE is deprecated and should not be used.
 */
export function isDebugMode(): boolean {
  if (isProduction()) {
    return false
  }

  return process.env.DEBUG_MODE === 'true'
}
