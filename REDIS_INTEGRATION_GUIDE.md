# Redis Integration Guide for Production Rate Limiting

## Why Redis is Required for Production

The current in-memory implementation works for development and single-server deployments, but has critical limitations for production:

**Issues with In-Memory Store:**
- Rate limits are NOT shared across multiple server instances
- Each server tracks its own limits independently
- Attacker can bypass limits by targeting different servers
- Data is lost on server restart

**Redis Solution:**
- Shared rate limit state across all servers
- Persistent storage (survives restarts)
- High performance (sub-millisecond latency)
- Automatic expiration (TTL support)

## Option 1: Upstash Redis (Recommended for Serverless)

Best for: Vercel, Netlify, AWS Lambda, serverless deployments

### Step 1: Create Upstash Account

1. Go to [https://upstash.com](https://upstash.com)
2. Sign up for free account
3. Create a new Redis database
4. Select region closest to your users
5. Copy the REST URL and token

### Step 2: Install Dependencies

```bash
npm install @upstash/redis
```

### Step 3: Set Environment Variables

Add to `.env.local`:
```bash
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token-here
```

Add to Vercel/production environment:
```bash
vercel env add UPSTASH_REDIS_URL
vercel env add UPSTASH_REDIS_TOKEN
```

### Step 4: Update rate-limit.ts

Replace the in-memory implementation in `/lib/middleware/rate-limit.ts`:

```typescript
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null

/**
 * Check if client has exceeded rate limit (Redis implementation)
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
  // Fallback to in-memory if Redis not configured (development)
  if (!redis) {
    console.warn('[RATE-LIMIT] Redis not configured, using in-memory store')
    return checkRateLimitInMemory(clientId, config)
  }

  const key = `ratelimit:${clientId}`
  const now = Date.now()

  try {
    // Get current rate limit data from Redis
    const data = await redis.get<RateLimitStore>(key)

    // Initialize or reset if window expired
    if (!data || now > data.resetTime) {
      const resetTime = now + config.windowMs
      const newData: RateLimitStore = { count: 1, resetTime }

      // Store in Redis with TTL
      await redis.set(key, newData, {
        ex: Math.ceil(config.windowMs / 1000),
      })

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime,
      }
    }

    // Check if limit exceeded
    if (data.count >= config.maxRequests) {
      const retryAfter = Math.ceil((data.resetTime - now) / 1000)

      if (DEBUG_MODE) {
        console.warn(
          `[RATE-LIMIT] Client ${clientId} exceeded limit: ${data.count}/${config.maxRequests}`
        )
      }

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: data.resetTime,
        retryAfter,
      }
    }

    // Increment counter
    data.count++
    await redis.set(key, data, {
      ex: Math.ceil(config.windowMs / 1000),
    })

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - data.count,
      resetTime: data.resetTime,
    }
  } catch (error) {
    // On Redis error, allow request (fail open)
    console.error('[RATE-LIMIT] Redis error, allowing request:', error)
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    }
  }
}

/**
 * Fallback in-memory implementation for development
 */
const rateLimitsMemory = new Map<string, RateLimitStore>()

function checkRateLimitInMemory(
  clientId: string,
  config: RateLimitConfig
) {
  // ... keep existing in-memory implementation as fallback ...
  const now = Date.now()
  const clientData = rateLimitsMemory.get(clientId)

  if (!clientData || now > clientData.resetTime) {
    const resetTime = now + config.windowMs
    rateLimitsMemory.set(clientId, { count: 1, resetTime })
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime,
    }
  }

  if (clientData.count >= config.maxRequests) {
    const retryAfter = Math.ceil((clientData.resetTime - now) / 1000)
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: clientData.resetTime,
      retryAfter,
    }
  }

  clientData.count++
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - clientData.count,
    resetTime: clientData.resetTime,
  }
}
```

### Step 5: Test

```bash
# Development (uses fallback)
npm run dev

# Production (uses Redis)
vercel deploy
```

### Step 6: Verify

Check Upstash dashboard to see:
- Keys being created (`ratelimit:<ip-address>`)
- TTL counting down
- Keys expiring automatically

## Option 2: Vercel KV (Vercel-Specific)

Best for: Applications deployed exclusively on Vercel

### Step 1: Add KV Storage

1. Go to Vercel Dashboard
2. Select your project
3. Go to Storage tab
4. Click "Create Database"
5. Select "KV" (Redis-compatible)
6. Environment variables are auto-configured

### Step 2: Install Dependencies

```bash
npm install @vercel/kv
```

### Step 3: Update rate-limit.ts

```typescript
import { kv } from '@vercel/kv'

async function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
) {
  const key = `ratelimit:${clientId}`
  const now = Date.now()

  try {
    const data = await kv.get<RateLimitStore>(key)

    if (!data || now > data.resetTime) {
      const resetTime = now + config.windowMs
      const newData: RateLimitStore = { count: 1, resetTime }

      await kv.set(key, newData, {
        ex: Math.ceil(config.windowMs / 1000),
      })

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime,
      }
    }

    if (data.count >= config.maxRequests) {
      const retryAfter = Math.ceil((data.resetTime - now) / 1000)
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: data.resetTime,
        retryAfter,
      }
    }

    data.count++
    await kv.set(key, data, {
      ex: Math.ceil(config.windowMs / 1000),
    })

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - data.count,
      resetTime: data.resetTime,
    }
  } catch (error) {
    console.error('[RATE-LIMIT] KV error, allowing request:', error)
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    }
  }
}
```

## Option 3: Self-Hosted Redis

Best for: AWS, Google Cloud, Azure deployments

### Step 1: Set Up Redis

**AWS ElastiCache:**
1. Create ElastiCache cluster
2. Select Redis engine
3. Choose instance type (cache.t3.micro for dev)
4. Configure security group
5. Copy endpoint URL

**Google Cloud Memorystore:**
1. Enable Memorystore API
2. Create Redis instance
3. Select region and tier
4. Copy connection string

**Docker (Local Development):**
```bash
docker run -d -p 6379:6379 redis:alpine
```

### Step 2: Install Dependencies

```bash
npm install ioredis
```

### Step 3: Set Environment Variable

```bash
# AWS ElastiCache
REDIS_URL=redis://your-redis.cache.amazonaws.com:6379

# Google Cloud
REDIS_URL=redis://10.0.0.3:6379

# Local Docker
REDIS_URL=redis://localhost:6379
```

### Step 4: Update rate-limit.ts

```typescript
import Redis from 'ioredis'

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : null

async function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
) {
  if (!redis) {
    console.warn('[RATE-LIMIT] Redis not configured, using in-memory store')
    return checkRateLimitInMemory(clientId, config)
  }

  const key = `ratelimit:${clientId}`
  const now = Date.now()

  try {
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
        resetTime,
      }
    }

    if (data.count >= config.maxRequests) {
      const retryAfter = Math.ceil((data.resetTime - now) / 1000)
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: data.resetTime,
        retryAfter,
      }
    }

    data.count++
    await redis.set(
      key,
      JSON.stringify(data),
      'EX',
      Math.ceil(config.windowMs / 1000)
    )

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - data.count,
      resetTime: data.resetTime,
    }
  } catch (error) {
    console.error('[RATE-LIMIT] Redis error, allowing request:', error)
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    }
  }
}
```

## Comparison

| Feature | Upstash | Vercel KV | Self-Hosted |
|---------|---------|-----------|-------------|
| Setup Difficulty | Easy | Easiest | Medium |
| Cost (Low Traffic) | Free tier | Free tier | ~$10/month |
| Cost (High Traffic) | Pay-as-you-go | Pay-as-you-go | Fixed |
| Latency | Low | Lowest | Varies |
| Serverless Support | Excellent | Excellent | Limited |
| Multi-Cloud | Yes | Vercel only | Yes |
| Control | Medium | Low | Full |

## Recommendations

**Choose Upstash if:**
- Deploying to multiple platforms (Vercel, Netlify, etc.)
- Want serverless-friendly solution
- Need multi-region support
- Want simple setup

**Choose Vercel KV if:**
- Deploying exclusively to Vercel
- Want automatic configuration
- Need lowest possible latency
- Already using other Vercel services

**Choose Self-Hosted if:**
- Already have Redis infrastructure
- Need full control over configuration
- Have specific compliance requirements
- Want predictable costs at scale

## Testing Redis Integration

### Test Connection

```typescript
// Add to rate-limit.ts for testing
export async function testRedisConnection() {
  try {
    if (!redis) {
      console.log('Redis not configured')
      return false
    }

    await redis.set('test-key', 'test-value', { ex: 10 })
    const value = await redis.get('test-key')

    console.log('Redis connection successful:', value === 'test-value')
    return value === 'test-value'
  } catch (error) {
    console.error('Redis connection failed:', error)
    return false
  }
}
```

### Test Rate Limiting

```bash
# Make 15 requests to test rate limiting with Redis
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/user/sync \
    -H "Authorization: Bearer TOKEN"
  echo "Request $i"
  sleep 0.5
done
```

### Monitor Redis

**Upstash Dashboard:**
- View real-time commands
- See key count
- Monitor memory usage

**Redis CLI:**
```bash
redis-cli -h your-host -p 6379
> KEYS ratelimit:*
> TTL ratelimit:192.168.1.1
> GET ratelimit:192.168.1.1
```

## Troubleshooting

### Issue: Redis connection fails

**Check:**
1. Environment variables are set correctly
2. Redis server is running
3. Firewall allows connections
4. Credentials are valid

**Solution:**
- Test connection separately
- Check Redis logs
- Verify network access
- Ensure fallback works

### Issue: High Redis latency

**Causes:**
- Redis server far from application
- Network congestion
- Redis overloaded

**Solutions:**
- Choose closer region
- Upgrade Redis instance
- Add Redis replica
- Optimize queries

### Issue: Rate limits still not shared

**Check:**
1. Redis is actually being used (check logs)
2. Environment variables loaded
3. No errors in Redis calls
4. Keys visible in Redis

**Debug:**
```typescript
console.log('Redis configured:', !!redis)
console.log('Using Redis for rate limiting')
```

## Performance Considerations

**Redis Call Pattern:**
- GET: ~1ms (local network)
- SET: ~1ms (local network)
- Total overhead: ~2ms per request

**Optimization:**
- Use pipelining for batch operations
- Set appropriate TTL (cleanup automatic)
- Use read replicas for high traffic
- Consider caching in edge functions

## Security

**Best Practices:**
1. Use TLS/SSL for Redis connections
2. Require authentication (password)
3. Restrict network access (VPC/private network)
4. Rotate credentials regularly
5. Monitor for unusual activity

**Upstash Security:**
- TLS by default
- Token-based auth
- HTTPS REST API

**Self-Hosted Security:**
```redis
# redis.conf
requirepass your-strong-password
tls-port 6380
tls-cert-file /path/to/cert.crt
tls-key-file /path/to/key.key
```

## Cost Estimation

**Upstash (Pay-as-you-go):**
- Free: 10K requests/day
- $0.20 per 100K requests
- Example: 1M requests/month = ~$2

**Vercel KV:**
- Free: 3GB storage, 30K requests/day
- Pro: $1/month + overages
- Example: Similar to Upstash pricing

**Self-Hosted (AWS):**
- cache.t3.micro: ~$15/month
- cache.m5.large: ~$80/month
- Data transfer: Variable

## Monitoring

**Metrics to Track:**
1. Redis latency
2. Error rate
3. Memory usage
4. Key count
5. Eviction rate

**Set Up Alerts:**
- Redis connection failures
- High latency (>10ms)
- Memory usage >80%
- Error rate >1%

---

**Next Steps:**
1. Choose Redis provider
2. Follow setup guide for your provider
3. Update rate-limit.ts
4. Test locally
5. Deploy to production
6. Monitor Redis metrics
7. Optimize based on usage
