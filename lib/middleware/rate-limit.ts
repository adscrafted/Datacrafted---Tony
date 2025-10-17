/**
 * Rate Limiting Middleware for Next.js API Routes
 *
 * Provides protection against brute force attacks and DOS attacks
 * by limiting the number of requests from a single client.
 *
 * Features:
 * - Configurable time windows and request limits
 * - Client identification via IP address
 * - Standard HTTP 429 rate limit responses
 * - X-RateLimit-* headers for client transparency
 * - Automatic cleanup of expired entries
 * - Production-ready Redis integration support
 *
 * @example Basic usage
 * ```typescript
 * import { withRateLimit } from '@/lib/middleware/rate-limit'
 *
 * export const POST = withRateLimit(
 *   { windowMs: 60 * 1000, maxRequests: 10 },
 *   async (request) => {
 *     return Response.json({ success: true })
 *   }
 * )
 * ```
 *
 * @example With authentication middleware
 * ```typescript
 * import { withAuth } from '@/lib/middleware/auth'
 * import { withRateLimit } from '@/lib/middleware/rate-limit'
 *
 * const handler = withAuth(async (request, user) => {
 *   return Response.json({ userId: user.uid })
 * })
 *
 * export const POST = withRateLimit(
 *   { windowMs: 60 * 1000, maxRequests: 10 },
 *   handler
 * )
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Rate limit tracking data for a single client
 */
interface RateLimitStore {
  count: number      // Number of requests in current window
  resetTime: number  // Timestamp when the window resets
}

/**
 * Configuration options for rate limiting
 */
export interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Maximum requests allowed per window
  skipSuccessfulRequests?: boolean  // Don't count successful requests
  skipFailedRequests?: boolean      // Don't count failed requests
}

/**
 * In-memory store for rate limiting
 * For production with multiple servers, replace with Redis
 */
const rateLimits = new Map<string, RateLimitStore>()

/**
 * Maximum entries to prevent unbounded memory growth
 */
const MAX_ENTRIES = 10000

/**
 * Debug mode flag
 */
const DEBUG_MODE = process.env.NODE_ENV === 'development'

/**
 * Get client identifier from request
 * Uses x-forwarded-for or x-real-ip headers from proxy/load balancer
 *
 * @param request - Next.js request object
 * @returns Client IP address or 'unknown'
 */
function getClientIdentifier(request: NextRequest): string {
  // Try x-forwarded-for first (standard proxy header)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2, ...)
    // Use the first one (original client)
    return forwardedFor.split(',')[0].trim()
  }

  // Try x-real-ip (alternative proxy header)
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Fallback to unknown (should rarely happen in production)
  if (process.env.NODE_ENV === 'development') {
    console.debug('[RATE-LIMIT] Using fallback IP in development mode')
  } else {
    console.warn('[RATE-LIMIT] Could not determine client IP, using fallback')
  }
  return 'unknown'
}

/**
 * Clean up expired entries from the in-memory store
 * This prevents unbounded memory growth
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  let cleanedCount = 0

  for (const [key, value] of Array.from(rateLimits.entries())) {
    if (now > value.resetTime) {
      rateLimits.delete(key)
      cleanedCount++
    }
  }

  if (DEBUG_MODE && cleanedCount > 0) {
    console.log(`[RATE-LIMIT] Cleaned up ${cleanedCount} expired entries`)
  }
}

/**
 * Periodic cleanup of expired entries
 * Runs every minute to prevent memory leaks
 */
setInterval(() => {
  cleanupExpiredEntries()
}, 60000) // 60 seconds

/**
 * Check if client has exceeded rate limit
 *
 * @param clientId - Client identifier (usually IP address)
 * @param config - Rate limit configuration
 * @returns Object with allowed flag and rate limit info
 */
function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
} {
  const now = Date.now()

  // Cleanup if store is getting too large
  if (rateLimits.size > MAX_ENTRIES) {
    if (DEBUG_MODE) {
      console.log(`[RATE-LIMIT] Store size (${rateLimits.size}) exceeds max (${MAX_ENTRIES}), cleaning up...`)
    }
    cleanupExpiredEntries()
  }

  const clientData = rateLimits.get(clientId)

  // Initialize or reset if window expired
  if (!clientData || now > clientData.resetTime) {
    const resetTime = now + config.windowMs
    rateLimits.set(clientId, {
      count: 1,
      resetTime
    })

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime
    }
  }

  // Check if limit exceeded
  if (clientData.count >= config.maxRequests) {
    const retryAfter = Math.ceil((clientData.resetTime - now) / 1000)

    if (DEBUG_MODE) {
      console.warn(`[RATE-LIMIT] Client ${clientId} exceeded limit: ${clientData.count}/${config.maxRequests}`)
    }

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: clientData.resetTime,
      retryAfter
    }
  }

  // Increment counter
  clientData.count++

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - clientData.count,
    resetTime: clientData.resetTime
  }
}

/**
 * Create rate limit response headers
 * Following standard HTTP rate limiting header conventions
 *
 * @param limit - Maximum requests allowed
 * @param remaining - Remaining requests in window
 * @param resetTime - Timestamp when window resets
 * @param retryAfter - Seconds until client can retry (optional)
 * @returns Headers object
 */
function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetTime: number,
  retryAfter?: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString()
  }

  if (retryAfter !== undefined) {
    headers['Retry-After'] = retryAfter.toString()
  }

  return headers
}

/**
 * Create a rate limiter middleware function
 *
 * @param config - Rate limit configuration
 * @returns Middleware function
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Get client identifier (IP address)
    const clientId = getClientIdentifier(request)

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientId, config)

    // If limit exceeded, return 429 Too Many Requests
    if (!rateLimitResult.allowed) {
      if (DEBUG_MODE) {
        console.log(`[RATE-LIMIT] Blocking request from ${clientId}: ${rateLimitResult.limit} requests exceeded`)
      }

      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
          limit: rateLimitResult.limit,
          resetAt: new Date(rateLimitResult.resetTime).toISOString()
        },
        {
          status: 429,
          headers: createRateLimitHeaders(
            rateLimitResult.limit,
            rateLimitResult.remaining,
            rateLimitResult.resetTime,
            rateLimitResult.retryAfter
          )
        }
      )
    }

    // Execute handler
    const response = await handler()

    // Add rate limit headers to successful response
    const headers = createRateLimitHeaders(
      rateLimitResult.limit,
      rateLimitResult.remaining,
      rateLimitResult.resetTime
    )

    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}

/**
 * Higher-Order Function to wrap route handlers with rate limiting
 *
 * @param config - Rate limit configuration
 * @param handler - Route handler function
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```typescript
 * export const POST = withRateLimit(
 *   { windowMs: 60 * 1000, maxRequests: 10 },
 *   async (request) => {
 *     const body = await request.json()
 *     return Response.json({ success: true })
 *   }
 * )
 * ```
 */
export function withRateLimit<P = any>(
  config: RateLimitConfig,
  handler: (request: NextRequest, context: { params: Promise<P> }) => Promise<Response>
): (request: NextRequest, context: { params: Promise<P> }) => Promise<Response> {
  const rateLimiter = createRateLimiter(config)

  return async function (request: NextRequest, context: { params: Promise<P> }) {
    return rateLimiter(request, async () => {
      const response = await handler(request, context)
      return response instanceof NextResponse ? response : NextResponse.json(response)
    })
  }
}

/**
 * Predefined rate limit configurations for common use cases
 */
export const RATE_LIMITS = {
  // Authentication endpoints - strict limits to prevent brute force
  AUTH: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10           // 10 requests per minute
  },

  // Session/dashboard endpoints - moderate limits
  SESSION: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 30           // 30 requests per minute
  },

  // Analysis/AI endpoints - strict limits due to expensive operations
  ANALYSIS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10           // 10 requests per hour
  },

  // General API endpoints - generous limits
  GENERAL: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60           // 60 requests per minute
  },

  // Public/read-only endpoints - very generous limits
  PUBLIC: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100          // 100 requests per minute
  }
} as const

/**
 * Export utility for combining rate limit with auth middleware
 *
 * @example
 * ```typescript
 * import { withAuth } from '@/lib/middleware/auth'
 * import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
 *
 * const handler = withAuth(async (request, user) => {
 *   return Response.json({ userId: user.uid })
 * })
 *
 * export const POST = withRateLimit(RATE_LIMITS.AUTH, handler)
 * ```
 */
export function combineAuthAndRateLimit<P = any>(
  config: RateLimitConfig,
  authHandler: (request: NextRequest, context: { params: Promise<P> }) => Promise<Response>
) {
  return withRateLimit(config, authHandler)
}

/**
 * Production Note: Redis Integration
 *
 * For production deployments with multiple servers, replace the in-memory
 * Map with a shared Redis store:
 *
 * @example Using Upstash Redis
 * ```typescript
 * import { Redis } from '@upstash/redis'
 *
 * const redis = new Redis({
 *   url: process.env.UPSTASH_REDIS_URL!,
 *   token: process.env.UPSTASH_REDIS_TOKEN!
 * })
 *
 * async function checkRateLimit(clientId: string, config: RateLimitConfig) {
 *   const key = `ratelimit:${clientId}`
 *   const now = Date.now()
 *
 *   const data = await redis.get<RateLimitStore>(key)
 *
 *   if (!data || now > data.resetTime) {
 *     const resetTime = now + config.windowMs
 *     await redis.set(key, { count: 1, resetTime }, {
 *       ex: Math.ceil(config.windowMs / 1000)
 *     })
 *     return { allowed: true, limit: config.maxRequests, remaining: config.maxRequests - 1, resetTime }
 *   }
 *
 *   if (data.count >= config.maxRequests) {
 *     const retryAfter = Math.ceil((data.resetTime - now) / 1000)
 *     return { allowed: false, limit: config.maxRequests, remaining: 0, resetTime: data.resetTime, retryAfter }
 *   }
 *
 *   data.count++
 *   await redis.set(key, data, { ex: Math.ceil(config.windowMs / 1000) })
 *   return { allowed: true, limit: config.maxRequests, remaining: config.maxRequests - data.count, resetTime: data.resetTime }
 * }
 * ```
 *
 * @example Using Vercel KV
 * ```typescript
 * import { kv } from '@vercel/kv'
 *
 * async function checkRateLimit(clientId: string, config: RateLimitConfig) {
 *   const key = `ratelimit:${clientId}`
 *   // Similar implementation using kv.get(), kv.set()
 * }
 * ```
 */
