# Production Readiness - Critical Fixes Quick Reference

**Priority**: MUST FIX BEFORE PRODUCTION
**Estimated Time**: 1 week

---

## 1. Remove Debug Endpoints (30 minutes)

Delete these files:
```bash
rm app/api/debug-store/route.ts
rm app/api/debug-store-state/route.ts
rm app/api/debug-state/route.ts
rm app/api/debug-dashboard/route.ts
rm app/api/test/route.ts
rm app/api/test-openai/route.ts
```

---

## 2. Fix Rate Limiting (2 hours)

**Install Redis**:
```bash
npm install @upstash/redis
```

**Update `/lib/middleware/rate-limit.ts`**:
```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
})

async function checkRateLimit(clientId: string, config: RateLimitConfig) {
  const key = `ratelimit:${clientId}`
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, Math.ceil(config.windowMs / 1000))
  }

  const allowed = count <= config.maxRequests
  const remaining = Math.max(0, config.maxRequests - count)
  const ttl = await redis.ttl(key)

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetTime: Date.now() + (ttl * 1000),
    retryAfter: allowed ? undefined : ttl
  }
}
```

**Add to `.env`**:
```bash
UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token
```

---

## 3. Remove Duplicate Rate Limiting in Chat (5 minutes)

**In `/app/api/chat/route.ts`**:

Delete lines 17-37 (the custom rate limiting code)

Change line 142:
```typescript
// OLD
export const POST = withAuth(async (request, authUser) => {

// NEW
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const handler = withAuth(async (request, authUser) => {
  // existing logic
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, handler)
```

---

## 4. Add Environment Validation (30 minutes)

**Create `/lib/config/env-validation.ts`**:
```typescript
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
] as const

export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join('\n')}\n\n` +
      'Please check your .env file or deployment configuration.'
    )
  }

  console.log('✓ All required environment variables are set')
}
```

**Call in `app/layout.tsx` (server-side only)**:
```typescript
import { validateEnvironment } from '@/lib/config/env-validation'

// At top of root layout (server component)
if (typeof window === 'undefined') {
  validateEnvironment()
}
```

---

## 5. Fix Authorization Bug (10 minutes)

**In `/app/api/projects/[id]/config/route.ts`**:

Replace lines 14-38 (getHandler):
```typescript
const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // Get database user
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify project exists and user has access
    const project = await db.projects.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // FIXED: Compare database user IDs
    if (project.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get dashboard config
    const config = await db.dashboard_configs.findFirst({
      where: {
        projectId,
        userId: dbUser.id,  // Use database ID, not Firebase UID
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // ... rest of handler
  }
})
```

Do the same fix for `putHandler` (lines 93-121).

---

## 6. Add Database Connection Pooling (15 minutes)

**Update `prisma/schema.prisma`**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Update `DATABASE_URL` in `.env`**:
```bash
# Add connection pooling params
DATABASE_URL="postgresql://user:password@host:5432/database?connection_limit=20&pool_timeout=10"
```

**Update `/lib/db.ts`**:
```typescript
import { PrismaClient } from './generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

---

## 7. Standardize Error Responses (1 hour)

**Create `/lib/api/error-response.ts`**:
```typescript
import { NextResponse } from 'next/server'

export interface APIError {
  error: {
    code: string
    message: string
    details?: string
    timestamp: string
  }
}

export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: string
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    },
    { status }
  )
}

// Common error responses
export const ErrorResponses = {
  NotFound: (resource: string) =>
    createErrorResponse('NOT_FOUND', `${resource} not found`, 404),

  Forbidden: () =>
    createErrorResponse('FORBIDDEN', 'You do not have access to this resource', 403),

  Unauthorized: () =>
    createErrorResponse('UNAUTHORIZED', 'Authentication required', 401),

  BadRequest: (details: string) =>
    createErrorResponse('BAD_REQUEST', 'Invalid request', 400, details),

  InternalError: (details?: string) =>
    createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500, details),

  RateLimitExceeded: (retryAfter: number) =>
    createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      429
    )
}
```

**Usage Example**:
```typescript
import { ErrorResponses } from '@/lib/api/error-response'

// Instead of:
return NextResponse.json({ error: 'Not found' }, { status: 404 })

// Use:
return ErrorResponses.NotFound('Project')
```

---

## 8. Fix OpenAI Timeout (5 minutes)

**In `/app/api/analyze/route.ts`** (line 1046):

Change:
```typescript
// OLD - 180 seconds
setTimeout(() => {
  reject(new Error('OpenAI API call timed out after 180 seconds'))
}, 180000)

// NEW - 30 seconds (configurable)
const OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT_MS || '30000')

setTimeout(() => {
  reject(new Error(`OpenAI API call timed out after ${OPENAI_TIMEOUT/1000}s`))
}, OPENAI_TIMEOUT)
```

**Add to `.env`**:
```bash
OPENAI_TIMEOUT_MS=30000
```

---

## 9. Add Session Index Fix (5 minutes)

**Run Prisma migration**:

```bash
# Create migration
npx prisma migrate dev --name add_session_composite_index
```

**Update `prisma/schema.prisma`**:
```prisma
model Session {
  // ... existing fields ...

  @@index([userId])
  @@index([userId, isActive])  // ADD THIS
  @@index([projectId])
  @@map("sessions")
}
```

---

## 10. Add Input Validation (2 hours)

**Install Zod**:
```bash
npm install zod
```

**Create `/lib/api/validation-schemas.ts`**:
```typescript
import { z } from 'zod'

export const ProjectCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  icon: z.string().max(50).optional(),
  settings: z.record(z.any()).optional()
})

export const ProjectUpdateSchema = ProjectCreateSchema.partial()

export const SessionCreateSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(500).optional()
})

// Validation helper
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(body)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}
```

**Usage in API route**:
```typescript
import { ProjectCreateSchema, validateRequestBody } from '@/lib/api/validation-schemas'
import { ErrorResponses } from '@/lib/api/error-response'

const postHandler = withAuth(async (request, authUser) => {
  const body = await request.json()
  const validation = validateRequestBody(ProjectCreateSchema, body)

  if (!validation.success) {
    return ErrorResponses.BadRequest(
      validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    )
  }

  const { name, description, color, icon, settings } = validation.data

  // Use validated data...
})
```

---

## Quick Test Script

Create `scripts/test-critical-fixes.sh`:

```bash
#!/bin/bash

echo "Testing critical fixes..."

# 1. Check debug endpoints are removed
if [ -f "app/api/debug-store/route.ts" ]; then
  echo "❌ FAIL: Debug endpoints still exist"
  exit 1
fi
echo "✓ Debug endpoints removed"

# 2. Check Redis env vars
if [ -z "$UPSTASH_REDIS_URL" ]; then
  echo "❌ FAIL: UPSTASH_REDIS_URL not set"
  exit 1
fi
echo "✓ Redis configured"

# 3. Check required env vars
required_vars=("DATABASE_URL" "OPENAI_API_KEY" "FIREBASE_SERVICE_ACCOUNT_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ FAIL: $var not set"
    exit 1
  fi
done
echo "✓ All required env vars set"

# 4. Test database connection
npx prisma db pull --force > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Database connection working"
else
  echo "❌ FAIL: Cannot connect to database"
  exit 1
fi

echo ""
echo "✅ All critical fixes verified!"
```

Run with:
```bash
chmod +x scripts/test-critical-fixes.sh
./scripts/test-critical-fixes.sh
```

---

## Deployment Checklist

Before deploying:

```markdown
- [ ] All debug endpoints removed
- [ ] Redis configured (Upstash or similar)
- [ ] Environment variables validated
- [ ] Authorization bugs fixed
- [ ] Database connection pooling configured
- [ ] Error responses standardized
- [ ] Input validation added to critical routes
- [ ] OpenAI timeout reduced to 30s
- [ ] Session indexes added
- [ ] Rate limiting tested under load
```

---

## Environment Variables Summary

Complete `.env` file for production:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_TIMEOUT_MS=30000

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (Server)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Redis Rate Limiting
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Feature Flags
NEXT_PUBLIC_ENABLE_AI_ANALYSIS=true
NEXT_PUBLIC_MAX_FILE_SIZE_MB=50

# Debug Mode (NEVER true in production)
DEBUG_MODE=false
NEXT_PUBLIC_DEBUG_MODE=false
```

---

## Quick Commands

```bash
# Install dependencies
npm install @upstash/redis zod

# Remove debug endpoints
rm app/api/debug-*/route.ts app/api/test*/route.ts

# Run database migration
npx prisma migrate dev --name production_ready_fixes

# Test locally
npm run dev

# Deploy
vercel --prod
# or
git push origin main  # if auto-deploy enabled
```

---

**Estimated Total Time**: 6-8 hours

**Recommended Order**:
1. Remove debug endpoints (quick win)
2. Add environment validation (prevents runtime errors)
3. Fix authorization bug (security critical)
4. Add Redis rate limiting (scalability critical)
5. Fix timeouts (prevents Lambda/Vercel issues)
6. Add error standardization (developer experience)
7. Add input validation (data integrity)
8. Database optimizations (performance)

---

For full details, see: `BACKEND_PRODUCTION_READINESS_AUDIT.md`
