# Rate Limiting Implementation

## Overview

This application now implements comprehensive rate limiting to protect against brute force attacks, DOS attacks, and API abuse. Rate limiting is applied to all authentication and session endpoints using a centralized middleware approach.

## Implementation Summary

### 1. Middleware Created

**File:** `/lib/middleware/rate-limit.ts`

A production-ready rate limiting middleware that provides:
- Configurable time windows and request limits
- Client identification via IP address (x-forwarded-for, x-real-ip headers)
- Standard HTTP 429 responses with proper headers
- X-RateLimit-* headers for transparency
- Automatic cleanup of expired entries
- Support for Redis in production environments

### 2. Rate Limits Applied

| Endpoint Pattern | Limit | Window | Purpose |
|-----------------|-------|---------|---------|
| `/api/user/*` | 10 req | 1 minute | Authentication, prevents brute force |
| `/api/sessions/*` | 30 req | 1 minute | Dashboard operations, moderate usage |
| `/api/analyze` | 10 req | 1 hour | AI analysis, expensive operations |

### 3. Protected Endpoints

#### Authentication Endpoints (10 req/min)
- `POST /api/user/sync` - User synchronization
- `GET /api/user` - Get user profile
- `PATCH /api/user` - Update user profile
- `DELETE /api/user` - Delete user account
- `GET /api/user/profile` - Get profile
- `PATCH /api/user/profile` - Update profile

#### Session Endpoints (30 req/min)
- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions
- `GET /api/sessions/[id]` - Get session
- `PATCH /api/sessions/[id]` - Update session
- `DELETE /api/sessions/[id]` - Delete session
- `GET /api/sessions/[id]/data` - Get session data
- `POST /api/sessions/[id]/data` - Save session data
- `GET /api/sessions/[id]/chat` - Get chat messages
- `POST /api/sessions/[id]/chat` - Send chat message
- `DELETE /api/sessions/[id]/chat` - Clear chat history

#### Analysis Endpoints (10 req/hour)
- `POST /api/analyze` - AI-powered data analysis

## Usage

### Basic Usage

```typescript
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

export const POST = withRateLimit(
  RATE_LIMITS.AUTH,
  async (request) => {
    // Your handler logic here
    return Response.json({ success: true })
  }
)
```

### With Authentication Middleware

```typescript
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const handler = withAuth(async (request, user) => {
  return Response.json({ userId: user.uid })
})

export const POST = withRateLimit(RATE_LIMITS.AUTH, handler)
```

### Custom Rate Limits

```typescript
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const POST = withRateLimit(
  {
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 50            // 50 requests
  },
  async (request) => {
    return Response.json({ success: true })
  }
)
```

## Predefined Rate Limits

The middleware includes predefined configurations:

```typescript
export const RATE_LIMITS = {
  // Authentication - strict limits
  AUTH: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10           // 10 requests
  },

  // Session operations - moderate limits
  SESSION: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 30           // 30 requests
  },

  // AI/Analysis - very strict limits
  ANALYSIS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10           // 10 requests
  },

  // General API - generous limits
  GENERAL: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60           // 60 requests
  },

  // Public endpoints - very generous limits
  PUBLIC: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100          // 100 requests
  }
}
```

## Response Format

### Successful Request

Headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1699564800000
```

### Rate Limited Request (429)

Headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699564800000
Retry-After: 45
```

Response Body:
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "limit": 10,
  "resetAt": "2024-11-09T12:00:00.000Z"
}
```

## Client Identification

The middleware identifies clients using IP addresses from:
1. `x-forwarded-for` header (first IP in chain)
2. `x-real-ip` header
3. Fallback to "unknown" (rare in production)

This works correctly behind proxies, load balancers, and CDNs.

## Production Deployment

### Current Implementation (Development)

The current implementation uses an in-memory Map for storing rate limit data. This works well for:
- Single-server deployments
- Development/testing environments
- Small-scale production (single instance)

**Limitations:**
- Rate limits are NOT shared across multiple server instances
- Rate limit data is lost on server restart
- Memory usage grows with unique clients (mitigated by automatic cleanup)

### Production with Multiple Servers (Redis Required)

For production deployments with multiple servers, you MUST use a shared Redis store:

#### Option 1: Upstash Redis (Recommended for Serverless)

1. **Install Upstash Redis:**
```bash
npm install @upstash/redis
```

2. **Set Environment Variables:**
```bash
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token
```

3. **Update rate-limit.ts:**

Replace the in-memory implementation with:

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
})

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
  const key = `ratelimit:${clientId}`
  const now = Date.now()

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
}
```

#### Option 2: Vercel KV (If deploying to Vercel)

1. **Install Vercel KV:**
```bash
npm install @vercel/kv
```

2. **Add KV Storage to Vercel Project:**
   - Go to Vercel Dashboard > Your Project > Storage
   - Create a new KV store
   - Environment variables are automatically set

3. **Update rate-limit.ts:**

```typescript
import { kv } from '@vercel/kv'

async function checkRateLimit(clientId: string, config: RateLimitConfig) {
  const key = `ratelimit:${clientId}`
  const now = Date.now()

  const data = await kv.get<RateLimitStore>(key)

  if (!data || now > data.resetTime) {
    const resetTime = now + config.windowMs
    await kv.set(key, { count: 1, resetTime }, {
      ex: Math.ceil(config.windowMs / 1000)
    })
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime
    }
  }

  // ... rest of the logic (same as Upstash example)
}
```

#### Option 3: Traditional Redis

For self-hosted or cloud Redis (AWS ElastiCache, Google Cloud Memorystore):

1. **Install Redis client:**
```bash
npm install ioredis
```

2. **Set Environment Variable:**
```bash
REDIS_URL=redis://your-redis-host:6379
```

3. **Update rate-limit.ts:**

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

async function checkRateLimit(clientId: string, config: RateLimitConfig) {
  const key = `ratelimit:${clientId}`
  const now = Date.now()

  const dataStr = await redis.get(key)
  const data = dataStr ? JSON.parse(dataStr) : null

  if (!data || now > data.resetTime) {
    const resetTime = now + config.windowMs
    const newData = { count: 1, resetTime }
    await redis.set(
      key,
      JSON.stringify(newData),
      'EX',
      Math.ceil(config.windowMs / 1000)
    )
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime
    }
  }

  // ... rest of the logic
}
```

## Security Considerations

### What This Protects Against

1. **Brute Force Attacks** - Limits login/authentication attempts
2. **DOS Attacks** - Prevents overwhelming the server with requests
3. **API Abuse** - Limits expensive operations (AI analysis)
4. **Credential Stuffing** - Slows down automated credential testing
5. **Resource Exhaustion** - Prevents single clients from consuming all resources

### What This Does NOT Protect Against

1. **Distributed DOS (DDOS)** - Rate limiting is per-IP; distributed attacks need WAF/CDN
2. **Application-Level Attacks** - SQL injection, XSS, etc. need separate protections
3. **Authentication Bypass** - Still need strong authentication (already implemented)
4. **Data Validation** - Still need input validation on all endpoints

### Additional Recommendations

1. **Use a CDN/WAF** - Cloudflare, AWS WAF, or similar for DDOS protection
2. **Monitor Rate Limit Hits** - Log and alert on frequent 429 responses
3. **Adjust Limits** - Monitor usage patterns and adjust limits accordingly
4. **IP Whitelisting** - Consider whitelisting trusted IPs if needed
5. **User-Based Limits** - Consider per-user limits in addition to IP limits

## Testing

### Manual Testing

```bash
# Test rate limit by making multiple requests
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/user/sync \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json"
  echo "Request $i"
done
```

After 10 requests, you should see 429 responses.

### Automated Testing

```typescript
// Example test using Jest
describe('Rate Limiting', () => {
  it('should return 429 after exceeding limit', async () => {
    const token = 'valid-token'

    // Make 10 successful requests
    for (let i = 0; i < 10; i++) {
      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      expect(res.status).toBe(200)
    }

    // 11th request should be rate limited
    const res = await fetch('/api/user/sync', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    expect(res.status).toBe(429)
  })
})
```

## Monitoring

### Key Metrics to Track

1. **429 Response Rate** - High rate may indicate:
   - Legitimate traffic spike (need higher limits)
   - Attack in progress (good - protection working)
   - Bug in client code (making too many requests)

2. **Rate Limit Headers** - Monitor X-RateLimit-Remaining
   - Helps identify clients approaching limits
   - Can trigger proactive alerts

3. **Memory Usage** - Monitor Map size (in-memory implementation)
   - Should stay bounded due to cleanup
   - Spike indicates many unique IPs

### Logging

The middleware includes debug logging:

```typescript
// Development mode - detailed logs
if (DEBUG_MODE) {
  console.log('[RATE-LIMIT] Client ${clientId} exceeded limit')
}

// Production - important events only
console.warn('[RATE-LIMIT] Rate limit exceeded for ${clientId}')
```

## Troubleshooting

### Issue: Legitimate users getting rate limited

**Cause:** Limits too strict for normal usage

**Solution:** Increase `maxRequests` for the affected endpoints

```typescript
SESSION: {
  windowMs: 60 * 1000,
  maxRequests: 50  // Increased from 30
}
```

### Issue: Rate limits not working across servers

**Cause:** Using in-memory store with multiple server instances

**Solution:** Implement Redis as described in Production Deployment section

### Issue: Rate limits reset on server restart

**Cause:** Using in-memory store (expected behavior)

**Solution:**
- For development: This is acceptable
- For production: Implement Redis for persistence

### Issue: All requests show same IP

**Cause:** Proxy/load balancer not forwarding client IP

**Solution:** Configure proxy to set x-forwarded-for header:

```nginx
# Nginx example
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

## Future Enhancements

1. **User-Based Rate Limiting** - Track limits per authenticated user ID
2. **Dynamic Rate Limits** - Adjust limits based on user tier/subscription
3. **Rate Limit Bypass** - Allow trusted IPs to bypass limits
4. **Distributed Rate Limiting** - Support for edge computing/CDN
5. **Advanced Analytics** - Track and visualize rate limit patterns

## Compliance

This rate limiting implementation helps with:

- **OWASP Top 10** - Protects against automated threats
- **PCI DSS** - Rate limiting on authentication endpoints
- **GDPR** - Prevents automated data scraping
- **SOC 2** - Demonstrates security controls

## References

- [OWASP Rate Limiting Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [HTTP 429 Status Code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)

## Support

For issues or questions:
1. Check this documentation
2. Review middleware code at `/lib/middleware/rate-limit.ts`
3. Check logs for rate limit events
4. Consult security team for production deployment

---

**Implementation Date:** 2025-10-10
**Status:** Implemented
**Tested:** Development environment
**Production Ready:** Yes (with Redis for multi-server deployments)
