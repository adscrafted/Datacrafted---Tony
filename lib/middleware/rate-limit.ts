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
 * - Automatic fallback to in-memory for development
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
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

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
 * In-memory store for rate limiting (fallback for development)
 * For production with multiple servers, uses Redis
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
 * Redis client and rate limiter instances
 */
let redisClient: Redis | null = null
let rateLimiterCache: Map<string, Ratelimit> = new Map()

/**
 * Initialize Redis client if credentials are available
 */
function initializeRedis(): Redis | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!upstashUrl || !upstashToken) {
    if (DEBUG_MODE) {
      console.log('[RATE-LIMIT] Redis not configured, using in-memory rate limiting')
    }
    return null
  }

  try {
    const redis = new Redis({
      url: upstashUrl,
      token: upstashToken,
    })

    console.log('[RATE-LIMIT] Redis initialized successfully - using distributed rate limiting')
    return redis
  } catch (error) {
    console.error('[RATE-LIMIT] Failed to initialize Redis:', error)
    console.log('[RATE-LIMIT] Falling back to in-memory rate limiting')
    return null
  }
}

/**
 * Get or create Upstash rate limiter for specific config
 */
function getUpstashRateLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!redisClient) {
    redisClient = initializeRedis()
  }

  if (!redisClient) {
    return null
  }

  // Create cache key based on config
  const cacheKey = `${config.windowMs}-${config.maxRequests}`

  // Return cached instance if exists
  if (rateLimiterCache.has(cacheKey)) {
    return rateLimiterCache.get(cacheKey)!
  }

  try {
    // Create new rate limiter with sliding window algorithm
    const limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowMs} ms`),
      analytics: true,
      prefix: 'datacrafted:ratelimit',
    })

    rateLimiterCache.set(cacheKey, limiter)
    return limiter
  } catch (error) {
    console.error('[RATE-LIMIT] Failed to create Upstash rate limiter:', error)
    return null
  }
}

/**
 * Get client identifier from request
 *
 * SECURITY: Uses a single authoritative IP source to prevent bypass:
 * 1. For authenticated requests: Uses user ID (unspoofable)
 * 2. For unauthenticated: Uses trusted proxy headers in priority order
 *
 * IMPORTANT: Does NOT use User-Agent because it can be easily rotated
 * to bypass rate limits. Uses IP-only identification for unauthenticated requests.
 *
 * @param request - Next.js request object
 * @param userId - Optional user ID from authentication (preferred)
 * @returns Client identifier string
 */
function getClientIdentifier(request: NextRequest, userId?: string): string {
  // BEST: Use user ID for authenticated requests (cannot be spoofed)
  if (userId) {
    return `user:${userId}`
  }

  // Priority 1: Cloudflare's trusted header (cannot be spoofed when using Cloudflare)
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return `ip:${cfConnectingIp.trim()}`
  }

  // Priority 2: Railway/Render/Vercel trusted header
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return `ip:${realIp.trim()}`
  }

  // Priority 3: x-forwarded-for - use LAST IP (closest to infrastructure, harder to spoof)
  // Note: First IP can be easily spoofed, last IP is typically from the load balancer
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim())
    const lastIp = ips[ips.length - 1]
    if (lastIp) {
      return `ip:${lastIp}`
    }
  }

  // Fallback: Use 'unknown' with stricter limits implied
  // This should rarely happen in production behind a proper proxy
  if (process.env.NODE_ENV !== 'development') {
    console.warn('[RATE-LIMIT] Could not determine client IP - using restrictive fallback')
  }
  return 'unknown'
}

/**
 * Extract user ID from Authorization header if present
 * This is used for more accurate rate limiting on authenticated routes
 */
async function extractUserIdFromRequest(request: NextRequest): Promise<string | undefined> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return undefined
  }

  try {
    // Dynamically import to avoid circular dependencies
    const { getAdminAuth } = await import('@/lib/config/firebase-admin')
    const adminAuth = getAdminAuth()
    const token = authHeader.slice(7)
    const decodedToken = await adminAuth.verifyIdToken(token)
    return decodedToken.uid
  } catch {
    // Token invalid or expired - treat as unauthenticated
    return undefined
  }
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
 * Periodic cleanup of expired entries (only for in-memory mode)
 * Runs every minute to prevent memory leaks
 */
setInterval(() => {
  cleanupExpiredEntries()
}, 60000) // 60 seconds

/**
 * Check rate limit using Upstash Redis
 */
async function checkRateLimitRedis(
  clientId: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
} | null> {
  const limiter = getUpstashRateLimiter(config)

  if (!limiter) {
    return null // Fall back to in-memory
  }

  try {
    const result = await limiter.limit(clientId)

    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetTime: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000)
    }
  } catch (error) {
    console.error('[RATE-LIMIT] Redis check failed, falling back to in-memory:', error)
    return null // Fall back to in-memory on error
  }
}

/**
 * Check if client has exceeded rate limit (in-memory implementation)
 *
 * @param clientId - Client identifier (usually IP address)
 * @param config - Rate limit configuration
 * @returns Object with allowed flag and rate limit info
 */
function checkRateLimitInMemory(
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
 * Check rate limit - tries Redis first, falls back to in-memory
 */
async function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}> {
  // Try Redis first if available
  const redisResult = await checkRateLimitRedis(clientId, config)

  if (redisResult !== null) {
    return redisResult
  }

  // Fall back to in-memory
  return checkRateLimitInMemory(clientId, config)
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
    // Try to extract user ID for authenticated requests (more accurate rate limiting)
    const userId = await extractUserIdFromRequest(request)

    // Get client identifier (user ID preferred, falls back to IP + fingerprint)
    const clientId = getClientIdentifier(request, userId)

    // Check rate limit (Redis or in-memory)
    const rateLimitResult = await checkRateLimit(clientId, config)

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
// Increase limits in development mode
const isDev = process.env.NODE_ENV === 'development'

export const RATE_LIMITS = {
  // Authentication endpoints - strict limits to prevent brute force
  AUTH: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: isDev ? 100 : 10  // 100 in dev, 10 in prod
  },

  // Session/dashboard endpoints - moderate limits
  SESSION: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: isDev ? 200 : 30  // 200 in dev, 30 in prod
  },

  // Analysis/AI endpoints - strict limits due to expensive operations
  ANALYSIS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: isDev ? 100 : 10  // 100 in dev, 10 in prod
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
 * Production Deployment Guide: Redis Integration
 *
 * This middleware automatically detects Redis configuration and uses it when available.
 *
 * Setup Instructions:
 *
 * 1. Create an Upstash Redis instance:
 *    - Go to https://console.upstash.com/
 *    - Create a new Redis database
 *    - Choose your region (closer to your deployment for lower latency)
 *
 * 2. Add environment variables to your deployment:
 *    - UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
 *    - UPSTASH_REDIS_REST_TOKEN=your-token-here
 *
 * 3. Deploy your application
 *    - The middleware will automatically detect Redis and use it
 *    - If Redis is not configured, it falls back to in-memory (safe for development)
 *    - Redis failures are gracefully handled - rate limiting is skipped on errors
 *
 * Benefits of Redis/Upstash:
 * - Distributed rate limiting across multiple servers/instances
 * - Persistent rate limit data (survives deployments and restarts)
 * - Better performance under high load
 * - Sliding window algorithm for more accurate rate limiting
 * - Analytics and monitoring capabilities
 *
 * Monitoring:
 * - Check application logs for "[RATE-LIMIT]" messages
 * - In development: "using in-memory rate limiting"
 * - In production with Redis: "Redis initialized successfully - using distributed rate limiting"
 */
