import { PrismaClient } from './generated/prisma'
import type { Prisma } from './generated/prisma'

// Extend globalThis type to track initialization
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaInitialized: boolean | undefined
}

// Configure Prisma Client with connection pooling and query logging
const createPrismaClient = () => {
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Log configuration for development
  const logConfig: Prisma.LogLevel[] = isDevelopment
    ? ['query', 'error', 'warn']
    : ['error']

  return new PrismaClient({
    log: logConfig.map((level) => ({
      emit: 'event',
      level,
    })),
    // Connection pool configuration is set via DATABASE_URL parameters
    // See .env.example for recommended connection pooling settings
  })
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

  // Enhanced error handling for connection issues
  db.$connect()
    .then(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Prisma] Database connection established successfully')
      }
    })
    .catch((error: Error) => {
      console.error('[Prisma] Failed to connect to database:', error.message)

      // Provide actionable error messages
      if (error.message.includes('Can\'t reach database server')) {
        console.error('[Prisma] Check if your database server is running and accessible')
        console.error('[Prisma] Verify DATABASE_URL in your .env.local file')
      } else if (error.message.includes('Authentication failed')) {
        console.error('[Prisma] Database authentication failed - check credentials in DATABASE_URL')
      } else if (error.message.includes('Connection pool timeout')) {
        console.error('[Prisma] Connection pool exhausted - consider increasing connection_limit')
        console.error('[Prisma] Current connections may not be properly released')
      }

      // ALWAYS throw database connection errors - app cannot function without DB
      // Railway health checks will catch this and prevent serving bad deployments
      throw error
    })

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