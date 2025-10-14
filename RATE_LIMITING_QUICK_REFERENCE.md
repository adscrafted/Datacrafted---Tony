# Rate Limiting - Quick Reference

## Current Implementation Status

Rate limiting is implemented and active on all authentication and session endpoints.

## Rate Limits Summary

| Endpoint | Limit | Window |
|----------|-------|--------|
| Authentication (`/api/user/*`) | 10 requests | 1 minute |
| Sessions (`/api/sessions/*`) | 30 requests | 1 minute |
| AI Analysis (`/api/analyze`) | 10 requests | 1 hour |

## Quick Usage

### Basic Pattern

```typescript
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

export const POST = withRateLimit(RATE_LIMITS.AUTH, handler)
```

### With Authentication

```typescript
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const handler = withAuth(async (request, user) => {
  // Your logic here
})

export const POST = withRateLimit(RATE_LIMITS.AUTH, handler)
```

## Response Codes

- **200**: Success (within rate limit)
- **429**: Too Many Requests (rate limit exceeded)

## Response Headers

All responses include:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1699564800000
```

Rate limited responses also include:
```
Retry-After: 45
```

## Production Deployment

**Important:** For production with multiple servers, you MUST use Redis:

### Option 1: Upstash Redis (Recommended)

```bash
npm install @upstash/redis
```

Environment variables:
```
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token
```

### Option 2: Vercel KV (Vercel deployments)

```bash
npm install @vercel/kv
```

Add KV storage via Vercel Dashboard.

## Testing

```bash
# Make multiple requests to test rate limiting
for i in {1..15}; do
  curl http://localhost:3000/api/user/sync \
    -H "Authorization: Bearer TOKEN"
done
```

Expected: First 10 succeed, remaining return 429.

## Common Issues

**Issue:** Users getting rate limited too quickly
**Fix:** Increase `maxRequests` in `RATE_LIMITS` configuration

**Issue:** Rate limits not shared across servers
**Fix:** Implement Redis (see Production Deployment)

**Issue:** All requests show same IP
**Fix:** Configure proxy to forward client IP headers

## Security Benefits

- Prevents brute force attacks on authentication
- Protects against DOS attacks
- Limits abuse of expensive AI operations
- Standard HTTP 429 responses
- Transparent rate limit headers

## Files Modified

1. `/lib/middleware/rate-limit.ts` - Main middleware
2. `/app/api/user/*.ts` - Auth endpoints
3. `/app/api/sessions/*.ts` - Session endpoints
4. `/app/api/analyze/route.ts` - AI analysis endpoint

## Next Steps

For production deployment:
1. Set up Redis (Upstash or Vercel KV)
2. Update `rate-limit.ts` to use Redis
3. Test with multiple server instances
4. Monitor 429 response rates
5. Adjust limits based on usage patterns

## Documentation

Full documentation: `RATE_LIMITING_IMPLEMENTATION.md`

---

**Status:** Implemented and Active
**Production Ready:** Yes (with Redis for multi-server)
