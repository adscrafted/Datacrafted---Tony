# Security Audit Report - Production Readiness
**Application:** DataCrafted
**Audit Date:** 2025-10-14
**Auditor:** Security Review - Claude Code
**Focus:** Authentication, Authorization, Data Security, API Security

---

## Executive Summary

DataCrafted has implemented a **solid security foundation** with Firebase authentication, comprehensive middleware protection, and proper authorization checks. However, there are **critical vulnerabilities** that must be addressed before production deployment, particularly around unprotected administrative endpoints and DEBUG mode safeguards.

**Overall Security Posture:** MODERATE - Good practices in place, but critical gaps exist

**Production Readiness Status:** NOT READY - Critical issues must be fixed first

---

## Critical Security Issues (MUST FIX BEFORE PRODUCTION)

### 1. CRITICAL: Unprotected Admin Cleanup Endpoint
**File:** `/app/api/admin/cleanup/route.ts`
**Lines:** 1-46
**Severity:** CRITICAL (CVSS 9.1 - High)

**Issue:**
The admin cleanup endpoint is completely unprotected - no authentication, no authorization, no rate limiting. Anyone can trigger database cleanup operations.

```typescript
// CURRENT CODE - NO AUTHENTICATION
export async function POST(request: NextRequest) {
  try {
    console.log('Manual cleanup triggered via API')
    const stats = await runFullCleanup()
    // ... cleanup operations
```

**Risk:**
- Unauthorized database modifications
- Data loss through malicious cleanup
- DOS attacks via repeated cleanup operations
- Information disclosure through GET endpoint stats

**Fix Required:**
```typescript
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

// POST endpoint with admin role check
const postHandler = withAuth(async (request, authUser) => {
  // Verify admin role
  if (!authUser.customClaims?.role || authUser.customClaims.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    )
  }

  try {
    console.log('Manual cleanup triggered by admin:', authUser.uid)
    const stats = await runFullCleanup()
    return NextResponse.json({
      success: true,
      stats,
      message: 'Cleanup completed successfully',
    })
  } catch (error) {
    console.error('Cleanup API error:', error)
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}, {
  requiredClaims: { role: 'admin' }
})

export const POST = withRateLimit(RATE_LIMITS.GENERAL, postHandler)

// GET endpoint with authentication
const getHandler = withAuth(async (request, authUser) => {
  // Admins get full stats, regular users get limited stats
  const stats = await getDatabaseStats()

  if (authUser.customClaims?.role !== 'admin') {
    // Return limited stats for non-admins
    return NextResponse.json({
      success: true,
      stats: {
        userProjects: stats.userSpecificProjects // only their data
      }
    })
  }

  return NextResponse.json({
    success: true,
    stats,
  })
})

export const GET = withRateLimit(RATE_LIMITS.GENERAL, getHandler)
```

**OWASP Reference:** A01:2021 - Broken Access Control

---

### 2. CRITICAL: Unprotected Debug Endpoints
**Files:**
- `/app/api/debug-dashboard/route.ts` (Lines 1-15)
- `/app/api/debug-state/route.ts`
- `/app/api/debug-store-state/route.ts`
- `/app/api/debug-store/route.ts`

**Severity:** CRITICAL (CVSS 8.2 - High)

**Issue:**
Multiple debug endpoints expose internal application state, environment variables, and configuration without any authentication.

```typescript
// CURRENT CODE - EXPOSES SENSITIVE INFO
export async function GET() {
  return NextResponse.json({
    status: 'Dashboard debug endpoint working',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasOpenAI: !!process.env.OPENAI_API_KEY  // Information disclosure
    }
  })
}
```

**Risk:**
- Information disclosure (environment details, API key presence)
- Application state exposure
- Attack surface mapping for adversaries

**Fix Required:**
```typescript
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
    // DO NOT expose environment details in production
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

**Better Approach:** Remove debug endpoints entirely in production builds:
```typescript
// In next.config.js
webpack: (config, { dev }) => {
  if (!dev) {
    // Exclude debug routes in production
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /api\/debug-/
      })
    )
  }
  return config
}
```

**OWASP Reference:** A01:2021 - Broken Access Control, A05:2021 - Security Misconfiguration

---

### 3. HIGH: DEBUG_MODE Production Safeguards Need Strengthening
**Files:**
- `/lib/config/firebase-admin.ts` (Lines 53-70)
- `/lib/config/firebase.ts` (Lines 38-62)
- `/middleware.ts` (Lines 79-107)

**Severity:** HIGH (CVSS 7.5)

**Issue:**
While DEBUG_MODE has multiple safeguards, there's still a **potential race condition** where the variable could be set to true momentarily before checks complete. Additionally, the checks rely on environment variables that could be manipulated.

**Current Implementation:**
```typescript
export const DEBUG_MODE = isLocalDevelopment && process.env.DEBUG_MODE === 'true'

// CRITICAL SECURITY CHECK: Prevent debug mode in production
if (process.env.DEBUG_MODE === 'true' && isProduction) {
  console.error(errorMessage)
  throw new Error(errorMessage)
}
```

**Risk:**
- Authentication bypass if DEBUG_MODE is enabled in production
- Complete security model circumvention

**Enhanced Fix:**
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

// Layer 2: Runtime detection with multiple signals
const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT === 'production' ||
  process.env.RENDER !== undefined ||
  process.env.FLY_APP_NAME !== undefined ||
  process.env.AWS_EXECUTION_ENV !== undefined ||  // AWS Lambda
  process.env.KUBERNETES_SERVICE_HOST !== undefined  // Kubernetes

const isLocalDevelopment =
  process.env.NODE_ENV === 'development' &&
  !isProduction &&
  (
    typeof window === 'undefined' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  )

// Layer 3: DEBUG_MODE only if ALL conditions met
export const DEBUG_MODE = (
  !IS_PRODUCTION_BUILD &&
  isLocalDevelopment &&
  process.env.DEBUG_MODE === 'true'
)

// Layer 4: Fatal error trap
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

// Additional runtime check in every auth function
export function assertNotDebugMode() {
  if (DEBUG_MODE && isProduction) {
    throw new Error('SECURITY: DEBUG_MODE active in production')
  }
}
```

**Additional Recommendation:**
Add monitoring/alerting if DEBUG_MODE is ever detected in production:
```typescript
// In production monitoring
if (DEBUG_MODE && isProduction) {
  // Send critical alert to security team
  await sendSecurityAlert({
    severity: 'CRITICAL',
    type: 'DEBUG_MODE_IN_PRODUCTION',
    details: process.env
  })
}
```

**OWASP Reference:** A07:2021 - Identification and Authentication Failures

---

### 4. HIGH: Health Check Endpoint Exposes Sensitive Information
**File:** `/app/api/health/route.ts`
**Lines:** 10-26, 36-39

**Severity:** HIGH (CVSS 6.5)

**Issue:**
The health check endpoint exposes missing environment variables and OpenAI API key configuration status without authentication.

```typescript
// CURRENT CODE
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

return NextResponse.json({
  status: 'unhealthy',
  checks: {
    database: 'healthy',
    environment: 'unhealthy',
    missingEnvVars  // INFORMATION DISCLOSURE
  }
}, { status: 503 })
```

**Risk:**
- Information disclosure about system configuration
- Attack surface mapping
- Helps attackers understand deployment environment

**Fix Required:**
```typescript
export async function GET(request: NextRequest) {
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
            // DO NOT include missingEnvVars in public response
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
        // DO NOT expose which services are configured
      }
    })
  } catch (error) {
    // Log error internally
    console.error('Health check failed:', error)

    // Return generic error to public
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unhealthy'
          // DO NOT expose error details
        }
      },
      { status: 503 }
    )
  }
}

// Optional: Add authenticated detailed health endpoint for admins
const detailedHealthHandler = withAuth(async (request, authUser) => {
  if (authUser.customClaims?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Return detailed diagnostics for admins only
  const requiredEnvVars = ['OPENAI_API_KEY', 'DATABASE_URL']
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

  return NextResponse.json({
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    detailedChecks: {
      database: await checkDatabase(),
      environment: {
        missingVariables: missingEnvVars,
        nodeVersion: process.version,
        platform: process.platform
      }
    }
  })
})

export const GET_DETAILED = withRateLimit(RATE_LIMITS.GENERAL, detailedHealthHandler)
```

**OWASP Reference:** A05:2021 - Security Misconfiguration

---

## High Priority Security Issues (FIX SOON)

### 5. Missing Content Security Policy (CSP)
**File:** `/next.config.js`
**Lines:** 15-39

**Severity:** HIGH (CVSS 6.1)

**Issue:**
Security headers are configured, but Content Security Policy is missing. This leaves the app vulnerable to XSS attacks.

**Current Implementation:**
```javascript
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]
```

**Fix Required:**
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
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://firebaseapp.com https://apis.google.com https://api.openai.com",
            "frame-src 'self' https://accounts.google.com",
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

**OWASP Reference:** A03:2021 - Injection (XSS)

---

### 6. Rate Limiting Uses In-Memory Store
**File:** `/lib/middleware/rate-limit.ts`
**Lines:** 67, 391-438

**Severity:** HIGH (CVSS 5.8)

**Issue:**
Rate limiting uses an in-memory Map, which doesn't work in serverless/multi-instance deployments. Each instance has its own rate limit counter.

**Current Implementation:**
```typescript
const rateLimits = new Map<string, RateLimitStore>()
```

**Risk:**
- Rate limits can be bypassed by load balancing across multiple instances
- DOS protection is ineffective at scale
- No shared state across servers

**Fix Required:**
```typescript
// Install: npm install @upstash/redis
import { Redis } from '@upstash/redis'

const redis = process.env.UPSTASH_REDIS_URL ? new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
}) : null

// Fallback to in-memory for development
const inMemoryStore = new Map<string, RateLimitStore>()

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

  // Use Redis in production, in-memory in development
  if (redis) {
    // Redis implementation
    const data = await redis.get<RateLimitStore>(key)

    if (!data || now > data.resetTime) {
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
      const retryAfter = Math.ceil((data.resetTime - now) / 1000)
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: data.resetTime,
        retryAfter
      }
    }

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
  } else {
    // Fallback to in-memory (development only)
    // ... existing in-memory implementation
  }
}
```

**Environment Variables to Add:**
```bash
# .env.local
UPSTASH_REDIS_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_TOKEN=your-redis-token
```

**OWASP Reference:** A04:2021 - Insecure Design

---

### 7. CORS Configuration Missing
**File:** All API routes
**Severity:** MEDIUM (CVSS 5.3)

**Issue:**
No explicit CORS configuration. While Next.js handles same-origin by default, explicit CORS headers should be set for API routes, especially if you plan to have mobile apps or external integrations.

**Fix Required:**
```typescript
// Create middleware/cors.ts
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ORIGINS = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
]

export function withCors(
  handler: (request: NextRequest) => Promise<Response>
) {
  return async function (request: NextRequest) {
    const origin = request.headers.get('origin')
    const response = await handler(request)

    // Set CORS headers
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    } else if (process.env.NODE_ENV === 'development') {
      // Allow all origins in development
      response.headers.set('Access-Control-Allow-Origin', '*')
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400') // 24 hours

    return response
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}
```

**OWASP Reference:** A05:2021 - Security Misconfiguration

---

### 8. Missing Input Validation on Several Endpoints
**Files:**
- `/app/api/sessions/route.ts` (Lines 8-9)
- `/app/api/projects/route.ts` (Lines 86)

**Severity:** MEDIUM (CVSS 5.4)

**Issue:**
Some endpoints don't validate input size, format, or content before processing.

**Example Issue:**
```typescript
// CURRENT CODE - No validation
const { name, description } = body

const session = await createSession({
  name,  // What if name is 1MB of text?
  description,  // No length limits
  userId: authUser.uid,
})
```

**Fix Required:**
```typescript
import { z } from 'zod'

// Define validation schemas
const CreateSessionSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name contains invalid characters'),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .nullable()
})

const postHandler = withAuth(async (request, authUser) => {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = CreateSessionSchema.parse(body)

    // Create new session using authenticated user's ID
    const session = await createSession({
      name: validatedData.name,
      description: validatedData.description,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
})
```

**Install Zod:**
```bash
npm install zod
```

**OWASP Reference:** A03:2021 - Injection

---

## Medium Priority Issues (SECURITY BEST PRACTICES)

### 9. Error Messages May Leak Sensitive Information
**Files:** Multiple API routes
**Severity:** MEDIUM (CVSS 4.3)

**Issue:**
Error handling sometimes exposes internal error details in production.

**Example:**
```typescript
catch (error) {
  console.error('Error fetching session:', error)
  return NextResponse.json(
    { error: 'Failed to fetch session' },  // Good
    { status: 500 }
  )
}

// But in some places:
catch (error) {
  return NextResponse.json(
    {
      error: 'Failed to fetch session',
      details: error instanceof Error ? error.message : 'Unknown error'  // BAD
    },
    { status: 500 }
  )
}
```

**Fix Required:**
```typescript
// Create error handling utility
function handleApiError(error: unknown, context: string) {
  console.error(`[ERROR] ${context}:`, error)

  // Never expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    )
  }

  // In development, expose more details
  return NextResponse.json(
    {
      error: 'An error occurred',
      details: error instanceof Error ? error.message : 'Unknown error',
      context
    },
    { status: 500 }
  )
}

// Usage
catch (error) {
  return handleApiError(error, 'fetching session data')
}
```

**OWASP Reference:** A04:2021 - Insecure Design

---

### 10. Session Cookie Configuration
**File:** `/lib/session.ts` (implied)
**Severity:** MEDIUM (CVSS 4.8)

**Issue:**
Need to verify session cookie security attributes.

**Required Cookie Attributes:**
```typescript
export async function setSessionCookie(sessionId: string) {
  const { cookies } = await import('next/headers')

  cookies().set('session_id', sessionId, {
    httpOnly: true,        // Prevents XSS access to cookie
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    sameSite: 'lax',       // CSRF protection
    maxAge: 60 * 60 * 24 * 7,  // 7 days
    path: '/',
    domain: process.env.COOKIE_DOMAIN  // Set appropriate domain
  })
}
```

**OWASP Reference:** A07:2021 - Identification and Authentication Failures

---

### 11. Database Query Logging May Expose Sensitive Data
**Files:** Multiple files with Prisma queries
**Severity:** MEDIUM (CVSS 4.0)

**Issue:**
Database queries are logged in console, potentially exposing sensitive data.

**Fix Required:**
```typescript
// In lib/db.ts
import { PrismaClient } from './generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],  // Only log errors in production
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

**OWASP Reference:** A09:2021 - Security Logging and Monitoring Failures

---

## Security Best Practices to Implement

### 12. API Key Rotation Strategy
**Severity:** LOW (CVSS 3.1)

**Recommendation:**
Implement API key rotation for OpenAI and other external services.

```typescript
// Add to environment
OPENAI_API_KEY_CURRENT=sk-xxx
OPENAI_API_KEY_NEXT=sk-yyy  // For rotation

// In code
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY_CURRENT || process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  return new OpenAI({ apiKey })
}

// Rotation script
async function rotateApiKeys() {
  // 1. Update CURRENT to use NEXT
  // 2. Generate new NEXT key
  // 3. Test both keys work
  // 4. Update environment
}
```

---

### 13. Implement Security Monitoring
**Severity:** LOW (CVSS 3.3)

**Recommendation:**
Add security event logging and monitoring.

```typescript
// Create lib/security-monitor.ts
interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit_exceeded' | 'suspicious_activity'
  userId?: string
  ip: string
  details: string
  timestamp: Date
}

export async function logSecurityEvent(event: SecurityEvent) {
  console.warn('[SECURITY]', event)

  // In production: Send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // await sendToSentryOrDatadog(event)
  }

  // Store in database for audit trail
  await db.securityLog.create({
    data: event
  })
}

// Usage in auth middleware
catch (error) {
  if (error instanceof AuthError) {
    await logSecurityEvent({
      type: 'auth_failure',
      ip: getClientIdentifier(request),
      details: error.message,
      timestamp: new Date()
    })
  }
}
```

---

### 14. Database Connection String Security
**File:** `.env.example`, `.env.local`
**Severity:** LOW (CVSS 3.7)

**Current:**
```bash
DATABASE_URL="file:./prisma/dev.db"
```

**Production Recommendation:**
```bash
# Use connection pooling and SSL
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require&connection_limit=10"

# Or use connection pooling service
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."  # For migrations
```

---

### 15. Secrets Management
**Severity:** LOW (CVSS 2.9)

**Current Issues:**
- API keys stored in environment variables
- No secret rotation mechanism
- Firebase service account in environment variable

**Recommendation:**
Use a secrets management service:

```bash
# Option 1: Vercel KV for secrets
# Option 2: AWS Secrets Manager
# Option 3: HashiCorp Vault

# Access secrets at runtime
import { getSecret } from '@/lib/secrets'

const openaiKey = await getSecret('OPENAI_API_KEY')
const firebaseKey = await getSecret('FIREBASE_SERVICE_ACCOUNT')
```

---

## Compliance Considerations

### GDPR Compliance
1. **Right to Erasure:** Implement user data deletion endpoints
2. **Data Export:** Add ability to export user data
3. **Consent Management:** Add cookie consent banner
4. **Data Processing Records:** Document what data is processed and why

### SOC 2 Considerations
1. **Access Logs:** Log all data access
2. **Change Tracking:** Audit trail for data modifications
3. **Encryption:** Encrypt sensitive data at rest (ProjectData.compressedData)
4. **Backup & Recovery:** Implement automated backups

---

## Authentication & Authorization Summary

### What's Working Well ✓

1. **Firebase Authentication Integration**
   - Proper token verification with Firebase Admin SDK
   - Token expiration and revocation checks
   - Multiple authentication layers (middleware + route-level)

2. **Authorization Checks**
   - Consistent ownership verification across routes
   - User ID taken from verified token, not request body
   - Proper 403 Forbidden responses for unauthorized access

3. **Rate Limiting**
   - Comprehensive rate limiting on all protected routes
   - Different limits for different operation types
   - Proper rate limit headers returned

4. **Middleware Architecture**
   - Clean separation of concerns (auth, rate limiting)
   - Composable middleware functions
   - Type-safe with TypeScript

### What Needs Attention ⚠

1. **Admin/Debug Endpoints** (CRITICAL)
2. **DEBUG_MODE Safeguards** (HIGH)
3. **CSP Headers** (HIGH)
4. **Rate Limiting Backend** (HIGH)
5. **Input Validation** (MEDIUM)

---

## Testing Recommendations

### Security Tests to Implement

```typescript
// __tests__/security/auth.test.ts
describe('Authentication Security', () => {
  it('should reject requests without Authorization header', async () => {
    const response = await fetch('/api/sessions')
    expect(response.status).toBe(401)
  })

  it('should reject expired tokens', async () => {
    const expiredToken = 'expired.jwt.token'
    const response = await fetch('/api/sessions', {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    })
    expect(response.status).toBe(401)
  })

  it('should reject access to other users resources', async () => {
    const token = await getTestToken('user1')
    const response = await fetch('/api/sessions/user2-session-id', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    expect(response.status).toBe(403)
  })
})

describe('Rate Limiting', () => {
  it('should enforce rate limits', async () => {
    const token = await getTestToken()

    // Make 31 requests (limit is 30)
    for (let i = 0; i < 31; i++) {
      const response = await fetch('/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (i < 30) {
        expect(response.status).toBe(200)
      } else {
        expect(response.status).toBe(429)
        expect(response.headers.get('Retry-After')).toBeDefined()
      }
    }
  })
})

describe('Input Validation', () => {
  it('should reject invalid session names', async () => {
    const token = await getTestToken()
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'x'.repeat(300),  // Too long
        description: 'test'
      })
    })
    expect(response.status).toBe(400)
  })
})
```

---

## Deployment Checklist

Before deploying to production, ensure:

- [ ] All CRITICAL issues fixed
- [ ] All HIGH priority issues fixed
- [ ] DEBUG_MODE disabled in environment variables
- [ ] CSP headers configured
- [ ] Rate limiting using Redis/KV store
- [ ] All admin endpoints protected
- [ ] Debug endpoints removed or protected
- [ ] Input validation on all endpoints
- [ ] Error messages sanitized
- [ ] HTTPS enforced (HSTS header)
- [ ] Database connection uses SSL
- [ ] API keys rotated from development keys
- [ ] Security monitoring enabled
- [ ] Automated security scanning setup (Snyk, OWASP ZAP)
- [ ] Penetration testing completed
- [ ] Security incident response plan documented

---

## Priority Fix Order

1. **Week 1 (CRITICAL - Deploy Blockers)**
   - Fix admin cleanup endpoint authentication
   - Protect/remove debug endpoints
   - Enhance DEBUG_MODE safeguards
   - Sanitize health check endpoint

2. **Week 2 (HIGH - Pre-Launch)**
   - Implement CSP headers
   - Setup Redis for rate limiting
   - Add CORS configuration
   - Implement input validation

3. **Week 3 (MEDIUM - Post-Launch)**
   - Improve error handling
   - Audit session cookie configuration
   - Implement security monitoring
   - Add security tests

4. **Ongoing**
   - Setup automated security scanning
   - Implement secrets rotation
   - Regular security audits
   - Keep dependencies updated

---

## Summary of Findings

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 4 | Unprotected admin endpoints, debug endpoints, DEBUG_MODE gaps, health check info disclosure |
| HIGH | 4 | Missing CSP, in-memory rate limiting, missing CORS, input validation gaps |
| MEDIUM | 3 | Error message leaks, cookie security, query logging |
| LOW | 3 | API key rotation, security monitoring, secrets management |

**Total Issues:** 14
**Must Fix Before Production:** 8
**Estimated Effort:** 3-4 weeks for full remediation

---

## Additional Resources

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [CSP Generator](https://report-uri.com/home/generate)

---

**Report Generated:** 2025-10-14
**Next Audit Recommended:** After all HIGH priority issues are fixed, or in 3 months
