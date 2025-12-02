import { PrismaClient } from './generated/prisma'
import type { Prisma } from './generated/prisma'

// Extend globalThis type to track initialization
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaInitialized: boolean | undefined
  connectionHealthy: boolean | undefined
}

// Configure Prisma Client with connection pooling and query logging
const createPrismaClient = () => {
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Log configuration for development
  const logConfig: Prisma.LogLevel[] = isDevelopment
    ? ['query', 'error', 'warn']
    : ['error']

  // Only include datasources config if DATABASE_URL is defined
  // This allows build to succeed without DATABASE_URL (Prisma uses schema default)
  const config: any = {
    log: logConfig.map((level) => ({
      emit: 'event',
      level,
    })),
  }

  // Only override datasources at runtime when DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    config.datasources = {
      db: {
        url: process.env.DATABASE_URL,
      },
    }
  }

  return new PrismaClient(config)
}

// Use singleton pattern - only create client once
export const db = globalForPrisma.prisma ?? createPrismaClient()

// Only set up listeners once (prevents MaxListenersExceeded warning on hot reload)
if (!globalForPrisma.prismaInitialized) {
  globalForPrisma.prisma = db
  globalForPrisma.prismaInitialized = true

  // Set up query logging for slow queries in development
  if (process.env.NODE_ENV !== 'production') {
    // Log slow queries (>1000ms) in development
    db.$on('query' as never, (e: Prisma.QueryEvent) => {
      const duration = Number(e.duration)
      if (duration > 1000) {
        console.warn(`[Slow Query] ${duration}ms - ${e.query}`)
        console.warn(`[Query Params] ${e.params}`)
      }
    })

    // Log all errors
    db.$on('error' as never, (e: Prisma.LogEvent) => {
      console.error('[Prisma Error]', e)
    })

    // Log warnings
    db.$on('warn' as never, (e: Prisma.LogEvent) => {
      console.warn('[Prisma Warning]', e)
    })
  }

  // Enhanced error handling for connection issues with retry logic
  const connectWithRetry = async (retries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await db.$connect()
        globalForPrisma.connectionHealthy = true

        if (process.env.NODE_ENV !== 'production') {
          console.log('[Prisma] Database connection established successfully')
        }
        return
      } catch (error: any) {
        globalForPrisma.connectionHealthy = false

        console.error(`[Prisma] Connection attempt ${attempt}/${retries} failed:`, error.message)

        // Provide actionable error messages
        if (error.message.includes('Can\'t reach database server')) {
          console.error('[Prisma] Check if your database server is running and accessible')
          console.error('[Prisma] Verify DATABASE_URL in your environment variables')
        } else if (error.message.includes('Authentication failed')) {
          console.error('[Prisma] Database authentication failed - check credentials in DATABASE_URL')
        } else if (error.message.includes('Connection pool timeout')) {
          console.error('[Prisma] Connection pool exhausted - consider increasing connection_limit')
          console.error('[Prisma] Current connections may not be properly released')
        } else if (error.message.includes('prepared statement')) {
          console.error('[Prisma] PgBouncer transaction mode detected - ensure DIRECT_DATABASE_URL is set')
          console.error('[Prisma] For Supabase: Use port 6543 for DATABASE_URL and port 5432 for DIRECT_DATABASE_URL')
        }

        if (attempt < retries) {
          console.log(`[Prisma] Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          // Log the error but DON'T crash the app
          // The app will start, allowing health checks to return 503
          // Individual database operations will fail with appropriate errors
          console.error('[Prisma] ⚠️ App started WITHOUT database connection after all retry attempts')
          console.error('[Prisma] Database features will be unavailable until connection is restored')
        }
      }
    }
  }

  connectWithRetry()

  // Graceful shutdown handling (server-side only)
  if (typeof window === 'undefined') {
    const cleanup = async () => {
      await db.$disconnect()
      console.log('[Prisma] Database connection closed')
    }

    process.on('beforeExit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  }
}

/**
 * Check if the database connection is healthy
 * @returns Promise<boolean>
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // Simple query to check connection
    await db.$queryRaw`SELECT 1`
    globalForPrisma.connectionHealthy = true
    return true
  } catch (error) {
    globalForPrisma.connectionHealthy = false
    console.error('[Prisma] Health check failed:', error)
    return false
  }
}

/**
 * Get database connection status
 * @returns boolean indicating if connection is believed to be healthy
 */
export function isDatabaseHealthy(): boolean {
  return globalForPrisma.connectionHealthy ?? false
}

/**
 * Execute a database operation with automatic retry and timeout
 * Useful for handling transient connection issues
 *
 * @param operation - Database operation to execute
 * @param options - Configuration options
 * @returns Result of the operation
 * @throws Error if operation fails after all retries
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number
    timeout?: number
    retryDelay?: number
    operationName?: string
  } = {}
): Promise<T> {
  const {
    retries = 2,
    timeout = 10000,
    retryDelay = 500,
    operationName = 'database operation'
  } = options

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      // Wrap operation with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timed out after ${timeout}ms`)), timeout)
      )

      const result = await Promise.race([operation(), timeoutPromise])

      // Mark connection as healthy on success
      globalForPrisma.connectionHealthy = true

      return result
    } catch (error: any) {
      const isLastAttempt = attempt > retries

      console.error(`[Prisma] ${operationName} attempt ${attempt}/${retries + 1} failed:`, error.message)

      // Check for specific error types that should not be retried
      const shouldNotRetry =
        error.message?.includes('Unique constraint') ||
        error.message?.includes('Foreign key constraint') ||
        error.message?.includes('Record not found') ||
        error.code === 'P2002' || // Unique constraint
        error.code === 'P2003' || // Foreign key constraint
        error.code === 'P2025'    // Record not found

      if (shouldNotRetry || isLastAttempt) {
        globalForPrisma.connectionHealthy = false
        throw error
      }

      // Wait before retrying
      console.log(`[Prisma] Retrying ${operationName} in ${retryDelay}ms...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  throw new Error(`${operationName} failed after ${retries + 1} attempts`)
}