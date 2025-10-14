# Security Fixes - Implementation Code

This document contains ready-to-use code for implementing critical security fixes.

---

## 1. Fix Admin Cleanup Endpoint

### File: `app/api/admin/cleanup/route.ts`

**Replace entire file with:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runFullCleanup, getDatabaseStats } from '@/lib/cleanup'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

// POST - Manual cleanup (admin only)
const postHandler = withAuth(async (request, authUser) => {
  // AUTHORIZATION: Verify admin role
  if (!authUser.customClaims?.role || authUser.customClaims.role !== 'admin') {
    console.warn('[ADMIN-CLEANUP] Unauthorized access attempt by:', authUser.uid)
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    )
  }

  try {
    console.log('[ADMIN-CLEANUP] Manual cleanup triggered by admin:', authUser.uid)
    const stats = await runFullCleanup()

    return NextResponse.json({
      success: true,
      stats,
      message: 'Cleanup completed successfully',
      triggeredBy: authUser.email
    })
  } catch (error) {
    console.error('[ADMIN-CLEANUP] Cleanup failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}, {
  requiredClaims: { role: 'admin' }
})

export const POST = withRateLimit(RATE_LIMITS.GENERAL, postHandler)

// GET - Database stats (authenticated users get limited info, admins get full stats)
const getHandler = withAuth(async (request, authUser) => {
  try {
    const stats = await getDatabaseStats()
    const isAdmin = authUser.customClaims?.role === 'admin'

    if (!isAdmin) {
      // Non-admins only see their own stats
      return NextResponse.json({
        success: true,
        stats: {
          // Return only user-specific information
          message: 'Limited stats for non-admin users'
        }
      })
    }

    // Admins see full stats
    return NextResponse.json({
      success: true,
      stats,
      requestedBy: authUser.email
    })
  } catch (error) {
    console.error('[ADMIN-CLEANUP] Database stats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get database stats'
      },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.GENERAL, getHandler)
```

---

## 2. Protect Debug Endpoints

### Option A: Delete Debug Endpoints (Recommended)

```bash
# Delete all debug endpoints
rm app/api/debug-dashboard/route.ts
rm app/api/debug-state/route.ts
rm app/api/debug-store-state/route.ts
rm app/api/debug-store/route.ts
```

### Option B: Protect Debug Endpoints

**File: `app/api/debug-dashboard/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'

const handler = withAuth(async (request, authUser) => {
  // SECURITY: Only allow in development OR for admin users
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isAdmin = authUser.customClaims?.role === 'admin'

  if (!isDevelopment && !isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Debug endpoints disabled in production' },
      { status: 403 }
    )
  }

  console.log('[DEBUG-API] Debug endpoint accessed by:', authUser.uid)

  return NextResponse.json({
    status: 'Dashboard debug endpoint working',
    timestamp: new Date().toISOString(),
    accessedBy: authUser.email,
    // Only expose environment details in development
    ...(isDevelopment && {
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasOpenAI: !!process.env.OPENAI_API_KEY
      }
    })
  })
})

export const GET = handler
```

---

## 3. Enhanced DEBUG_MODE Safeguards

### File: `lib/config/firebase-admin.ts`

**Replace the DEBUG_MODE section (lines 14-84) with:**

```typescript
/**
 * SECURITY: Triple-layer DEBUG_MODE protection
 *
 * Layer 1: Compile-time constant based on build environment
 * Layer 2: Runtime environment detection
 * Layer 3: Fatal error if misconfigured
 */

// Layer 1: Compile-time constant (set during build)
const BUILD_ENV = process.env.NEXT_PUBLIC_BUILD_ENV || 'production'
const IS_PRODUCTION_BUILD = BUILD_ENV === 'production'

// Layer 2: Production environment detection (multiple signals)
const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT === 'production' ||
  process.env.RENDER !== undefined ||
  process.env.FLY_APP_NAME !== undefined ||
  process.env.AWS_EXECUTION_ENV !== undefined ||
  process.env.KUBERNETES_SERVICE_HOST !== undefined

// Layer 3: Local development detection (must NOT be production)
const isLocalDevelopment =
  process.env.NODE_ENV === 'development' &&
  !isProduction

// Layer 4: DEBUG_MODE only if ALL conditions met
export const DEBUG_MODE = (
  !IS_PRODUCTION_BUILD &&
  isLocalDevelopment &&
  process.env.DEBUG_MODE === 'true'
)

// Layer 5: Fatal error trap
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
    `  - Is Production: ${isProduction}`,
    '',
    'IMMEDIATE ACTION REQUIRED:',
    '  1. Remove DEBUG_MODE from all environment variables',
    '  2. Redeploy application immediately',
    '  3. Review access logs for unauthorized access',
    '  4. Consider rotating credentials if breach suspected',
    '====================================================================',
  ].join('\n')

  console.error(errorMessage)

  // Prevent application startup
  throw new Error('FATAL: DEBUG_MODE enabled in production')
}

// Log debug mode status
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
```

---

## 4. Sanitize Health Check Endpoint

### File: `app/api/health/route.ts`

**Replace entire file with:**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`

    // Check environment variables (don't expose which ones are missing)
    const requiredEnvVars = ['OPENAI_API_KEY', 'DATABASE_URL']
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    const allEnvVarsPresent = missingEnvVars.length === 0

    // PUBLIC RESPONSE (no sensitive details)
    if (!allEnvVarsPresent) {
      // Log internally but don't expose details
      console.error('[HEALTH] Missing environment variables:', missingEnvVars)

      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: {
            database: 'healthy',
            environment: 'unhealthy'
          }
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      checks: {
        database: 'healthy',
        environment: 'healthy'
      }
    })
  } catch (error) {
    // Log error internally
    console.error('[HEALTH] Health check failed:', error)

    // Return generic error to public
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unhealthy'
        }
      },
      { status: 503 }
    )
  }
}
```

---

## 5. Add Content Security Policy

### File: `next.config.js`

**Replace the `headers` function (lines 15-39) with:**

```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://api.openai.com wss://*.firebaseio.com",
            "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests"
          ].join('; ')
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ],
    },
  ]
}
```

---

## 6. Upgrade Rate Limiting to Redis

### Step 1: Install Dependencies

```bash
npm install @upstash/redis
```

### Step 2: Add Environment Variables

```bash
# .env.local (development)
UPSTASH_REDIS_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_TOKEN=your-redis-token

# For development without Redis, these can be empty
# The code will fall back to in-memory storage
```

### Step 3: Update Rate Limit Middleware

**File: `lib/middleware/rate-limit.ts`**

**Add these imports at the top:**

```typescript
import { Redis } from '@upstash/redis'
```

**Add this after the imports:**

```typescript
// Redis client (production) or fallback to in-memory (development)
const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN
    })
  : null

// Log which storage backend is being used
if (redis) {
  console.log('✅ [RATE-LIMIT] Using Redis for distributed rate limiting')
} else {
  console.warn('⚠️  [RATE-LIMIT] Using in-memory storage (development only)')
}
```

**Replace the `checkRateLimit` function (around line 145) with:**

```typescript
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
  const now = Date.now()
  const key = `ratelimit:${clientId}`

  // Use Redis if available (production)
  if (redis) {
    try {
      const data = await redis.get<RateLimitStore>(key)

      if (!data || now > data.resetTime) {
        // Initialize or reset window
        const resetTime = now + config.windowMs
        await redis.set(key, { count: 1, resetTime }, {
          ex: Math.ceil(config.windowMs / 1000)
        })
        return {
          allowed: true,
          limit: config.maxRequests,
          remaining: config.maxRequests - 1,
          resetTime
        }
      }

      if (data.count >= config.maxRequests) {
        // Limit exceeded
        const retryAfter = Math.ceil((data.resetTime - now) / 1000)
        return {
          allowed: false,
          limit: config.maxRequests,
          remaining: 0,
          resetTime: data.resetTime,
          retryAfter
        }
      }

      // Increment counter
      data.count++
      await redis.set(key, data, {
        ex: Math.ceil(config.windowMs / 1000)
      })

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - data.count,
        resetTime: data.resetTime
      }
    } catch (error) {
      console.error('[RATE-LIMIT] Redis error, falling back to allow:', error)
      // Fail open to avoid blocking legitimate traffic
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs
      }
    }
  }

  // Fallback to in-memory (development only)
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
```

---

## 7. Add Input Validation

### Step 1: Install Zod

```bash
npm install zod
```

### Step 2: Create Validation Schemas

**Create new file: `lib/validation/schemas.ts`**

```typescript
import { z } from 'zod'

// Session validation
export const CreateSessionSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name contains invalid characters'),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .nullable()
})

export const UpdateSessionSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name contains invalid characters')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .nullable()
})

// Project validation
export const CreateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name contains invalid characters'),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .nullable(),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .optional()
    .nullable(),
  icon: z.string()
    .max(50, 'Icon identifier too long')
    .optional()
    .nullable(),
  settings: z.record(z.any()).optional().nullable()
})

export const UpdateProjectSchema = CreateProjectSchema.partial()

// Validation helper
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}
```

### Step 3: Update Sessions Route

**File: `app/api/sessions/route.ts`**

**Add import:**

```typescript
import { CreateSessionSchema, validateInput } from '@/lib/validation/schemas'
```

**Update POST handler (line 6-37):**

```typescript
const postHandler = withAuth(async (request, authUser) => {
  try {
    const body = await request.json()

    // Validate input
    const validation = validateInput(CreateSessionSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    const { name, description } = validation.data

    // Create new session using authenticated user's ID
    const session = await createSession({
      name,
      description,
      userId: authUser.uid,
    })

    await setSessionCookie(session.id)

    return NextResponse.json({
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
})
```

---

## 8. Add CORS Middleware

### Create new file: `lib/middleware/cors.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || '',
  ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
].filter(Boolean)

const isDevelopment = process.env.NODE_ENV === 'development'

export function withCors(
  handler: (request: NextRequest) => Promise<Response>
) {
  return async function (request: NextRequest) {
    const origin = request.headers.get('origin')
    const response = await handler(request)

    // Set CORS headers
    if (origin) {
      if (isDevelopment || ALLOWED_ORIGINS.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Credentials', 'true')
      }
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400') // 24 hours

    return response
  }
}

// Handle preflight OPTIONS requests
export async function handleOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': isDevelopment ? '*' : ALLOWED_ORIGINS[0] || '',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}
```

### Usage Example

**In any API route:**

```typescript
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { withCors, handleOptions } from '@/lib/middleware/cors'

// Handle OPTIONS preflight
export { handleOptions as OPTIONS }

// Wrap handler with CORS
const handler = withAuth(async (request, authUser) => {
  // Your route logic
  return NextResponse.json({ success: true })
})

export const GET = withCors(withRateLimit(RATE_LIMITS.SESSION, handler))
```

---

## 9. Environment Variables Setup

### Development: `.env.local`

```bash
# Node Environment
NODE_ENV=development
NEXT_PUBLIC_BUILD_ENV=development

# Database
DATABASE_URL="file:./prisma/dev.db"

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin (Server-side only)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'

# OpenAI
OPENAI_API_KEY=sk-...

# Redis (optional in development)
# UPSTASH_REDIS_URL=
# UPSTASH_REDIS_TOKEN=

# Debug Mode (ONLY in development)
DEBUG_MODE=true
NEXT_PUBLIC_DEBUG_MODE=true

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

### Production: Environment Variables on Hosting Platform

```bash
# Node Environment
NODE_ENV=production
NEXT_PUBLIC_BUILD_ENV=production

# Database (PostgreSQL recommended)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/dbname"

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-production-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin (Server-side only)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# OpenAI (production key)
OPENAI_API_KEY=sk-proj-...

# Redis (REQUIRED in production)
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# Debug Mode (MUST be false or unset)
# DEBUG_MODE=false
# NEXT_PUBLIC_DEBUG_MODE=false

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Cookie Domain
COOKIE_DOMAIN=.yourdomain.com
```

---

## 10. Testing Your Security Fixes

### Create: `__tests__/security/critical-fixes.test.ts`

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals'

describe('Critical Security Fixes', () => {
  let authToken: string

  beforeAll(async () => {
    // Get test auth token
    authToken = await getTestAuthToken()
  })

  describe('Admin Cleanup Endpoint', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await fetch('http://localhost:3000/api/admin/cleanup', {
        method: 'POST'
      })
      expect(response.status).toBe(401)
    })

    it('should reject non-admin users', async () => {
      const response = await fetch('http://localhost:3000/api/admin/cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Admin')
    })
  })

  describe('Debug Endpoints', () => {
    it('should not be accessible in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const response = await fetch('http://localhost:3000/api/debug-dashboard')
      expect([403, 404]).toContain(response.status)

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Health Check', () => {
    it('should not expose sensitive information', async () => {
      const response = await fetch('http://localhost:3000/api/health')
      const data = await response.json()

      expect(data).not.toHaveProperty('missingEnvVars')
      expect(data.checks).not.toHaveProperty('openai')
    })
  })

  describe('CSP Headers', () => {
    it('should include Content-Security-Policy header', async () => {
      const response = await fetch('http://localhost:3000')
      const csp = response.headers.get('Content-Security-Policy')

      expect(csp).toBeTruthy()
      expect(csp).toContain("default-src 'self'")
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid session names', async () => {
      const response = await fetch('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'x'.repeat(300), // Too long
          description: 'test'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Validation failed')
    })
  })
})
```

---

## Deployment Checklist

- [ ] All code changes committed to git
- [ ] Tests passing locally
- [ ] Environment variables configured on hosting platform
- [ ] DEBUG_MODE disabled in production
- [ ] Redis/Upstash configured
- [ ] Database migrations run
- [ ] Security tests passed
- [ ] Smoke tests prepared

## Testing Commands

```bash
# Run security tests
npm test -- __tests__/security

# Test production build locally
NODE_ENV=production npm run build
npm run start

# Check for vulnerabilities
npm audit

# Update dependencies
npm audit fix
npm update

# Test rate limiting (requires Redis)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/sessions

# Test CSP headers
curl -I http://localhost:3000 | grep -i "content-security"
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
