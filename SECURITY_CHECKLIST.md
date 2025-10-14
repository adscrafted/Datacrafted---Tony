# Production Security Checklist

## Pre-Deployment Critical Fixes (MUST DO)

### 1. Admin Endpoint Security
- [ ] Add `withAuth` middleware to `/app/api/admin/cleanup/route.ts`
- [ ] Add admin role check using `requiredClaims: { role: 'admin' }`
- [ ] Add rate limiting to admin endpoints
- [ ] Test with non-admin user (should get 403)
- [ ] Test with admin user (should work)

### 2. Debug Endpoints
Choose ONE approach:
- [ ] **Option A (Recommended):** Delete all debug endpoints
  - `app/api/debug-dashboard/route.ts`
  - `app/api/debug-state/route.ts`
  - `app/api/debug-store-state/route.ts`
  - `app/api/debug-store/route.ts`

- [ ] **Option B:** Protect with authentication + admin check
  - Add `withAuth` to all debug routes
  - Add production environment check
  - Remove sensitive info from responses

### 3. DEBUG_MODE Security
- [ ] Verify DEBUG_MODE=false in production environment
- [ ] Add compile-time BUILD_ENV check
- [ ] Add runtime production detection
- [ ] Test DEBUG_MODE throws error if enabled in prod
- [ ] Add monitoring alert for DEBUG_MODE in production

### 4. Health Check Sanitization
- [ ] Remove `missingEnvVars` from public response
- [ ] Remove OpenAI key status from public response
- [ ] Create separate `/api/admin/health-detailed` for admins
- [ ] Test health check doesn't leak info

### 5. Content Security Policy
- [ ] Add CSP header to `next.config.js`
- [ ] Test CSP with your domain
- [ ] Whitelist required external domains (Firebase, OpenAI)
- [ ] Monitor CSP violations

### 6. Rate Limiting Backend
- [ ] Sign up for Upstash Redis (free tier available)
- [ ] Add `UPSTASH_REDIS_URL` to environment
- [ ] Add `UPSTASH_REDIS_TOKEN` to environment
- [ ] Update rate-limit.ts to use Redis
- [ ] Test rate limiting works across multiple requests
- [ ] Verify rate limits persist across server restarts

### 7. CORS Configuration
- [ ] Create `lib/middleware/cors.ts`
- [ ] Define `ALLOWED_ORIGINS` environment variable
- [ ] Add CORS headers to API responses
- [ ] Test CORS with your frontend domain
- [ ] Add OPTIONS handler for preflight requests

### 8. Input Validation
- [ ] Install `zod`: `npm install zod`
- [ ] Add validation schemas for:
  - [ ] Session creation (name, description)
  - [ ] Project creation (name, description, color, icon)
  - [ ] Data uploads (size limits, structure)
- [ ] Return 400 with validation errors
- [ ] Test with invalid inputs

## Environment Variables Checklist

### Production Environment (.env.production or hosting platform)
```bash
# CRITICAL: Verify these are set correctly
NODE_ENV=production
NEXT_PUBLIC_BUILD_ENV=production

# DEBUG MODE: MUST be false or unset
DEBUG_MODE=false
NEXT_PUBLIC_DEBUG_MODE=false

# Database
DATABASE_URL=postgresql://...?sslmode=require
DIRECT_URL=postgresql://...  # For migrations

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# OpenAI
OPENAI_API_KEY=sk-proj-...  # Use production key, not dev key

# Rate Limiting
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Cookie Security
COOKIE_DOMAIN=.yourdomain.com
```

### Verify NOT Set in Production
- [ ] No DEBUG_MODE variables
- [ ] No development API keys
- [ ] No localhost URLs

## Security Testing Checklist

### Authentication Tests
- [ ] Cannot access API without token
- [ ] Cannot access API with expired token
- [ ] Cannot access API with invalid token
- [ ] Cannot access other users' resources
- [ ] Token refresh works correctly

### Authorization Tests
- [ ] User can only access their own sessions
- [ ] User can only access their own projects
- [ ] User cannot access admin endpoints without admin role
- [ ] Proper 403 responses for unauthorized access

### Rate Limiting Tests
- [ ] Rate limit triggers after threshold
- [ ] 429 status code returned
- [ ] Retry-After header present
- [ ] Rate limit resets after window
- [ ] Rate limit persists across instances (Redis test)

### Input Validation Tests
- [ ] Rejects oversized inputs
- [ ] Rejects invalid formats
- [ ] Rejects malicious content
- [ ] Returns clear validation errors

### Security Headers Tests
```bash
# Test security headers
curl -I https://yourdomain.com

# Should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
# Strict-Transport-Security: ...
```

## Monitoring Setup Checklist

### Error Monitoring
- [ ] Setup Sentry or similar error tracking
- [ ] Configure error alerts
- [ ] Test error reporting works
- [ ] Setup error rate alerts

### Security Monitoring
- [ ] Log authentication failures
- [ ] Log rate limit violations
- [ ] Log authorization failures
- [ ] Alert on suspicious patterns
- [ ] Monitor for DEBUG_MODE in production

### Performance Monitoring
- [ ] Setup APM (Application Performance Monitoring)
- [ ] Monitor API response times
- [ ] Monitor database query performance
- [ ] Setup slow query alerts

## Deployment Day Checklist

### Pre-Deployment (T-1 hour)
- [ ] All critical fixes deployed to staging
- [ ] Security tests passed on staging
- [ ] Load testing completed
- [ ] Backup verification tested
- [ ] Rollback plan documented

### During Deployment
- [ ] Deploy with environment variables checked
- [ ] Verify DEBUG_MODE is false
- [ ] Run smoke tests immediately
- [ ] Check logs for errors
- [ ] Verify authentication works

### Post-Deployment (T+1 hour)
- [ ] Monitor error rates
- [ ] Check authentication metrics
- [ ] Verify rate limiting working
- [ ] Test critical user flows
- [ ] Review security logs

### Post-Deployment (T+24 hours)
- [ ] Review all logs for anomalies
- [ ] Check for any security alerts
- [ ] Verify monitoring dashboards
- [ ] Test backup restoration
- [ ] Update security documentation

## Code Review Checklist

### For Each API Route
- [ ] Has `withAuth` middleware
- [ ] Has `withRateLimit` middleware
- [ ] Validates input with Zod or similar
- [ ] Checks user authorization (ownership)
- [ ] Sanitizes error messages
- [ ] Logs security events
- [ ] No sensitive data in logs
- [ ] Proper HTTP status codes

### For Each Database Query
- [ ] Uses parameterized queries (Prisma does this)
- [ ] Filters by authenticated user ID
- [ ] No raw SQL with string concatenation
- [ ] Proper error handling

### For Each Environment Variable
- [ ] Not committed to git
- [ ] Documented in .env.example
- [ ] Has production value set
- [ ] Not exposed to client (unless NEXT_PUBLIC_)

## Ongoing Security Maintenance

### Weekly
- [ ] Review security logs
- [ ] Check for failed authentication attempts
- [ ] Review rate limit violations
- [ ] Monitor error rates

### Monthly
- [ ] Update dependencies (`npm audit fix`)
- [ ] Review security advisories
- [ ] Test backup restoration
- [ ] Review access logs

### Quarterly
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Update security documentation
- [ ] Review and rotate API keys
- [ ] Security training for team

## Quick Command Reference

```bash
# Check for security vulnerabilities in dependencies
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Check for outdated packages
npm outdated

# Test production build locally
NODE_ENV=production npm run build
npm run start

# Test with production environment variables
cp .env.production .env.local
npm run dev

# Run security scan with OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://yourdomain.com

# Test SSL/TLS configuration
curl -I https://yourdomain.com | grep -i "strict-transport"

# Check CSP header
curl -I https://yourdomain.com | grep -i "content-security"
```

## Emergency Response Plan

### If Security Breach Detected

1. **Immediate Actions** (Within 5 minutes)
   - [ ] Disable affected user accounts
   - [ ] Rotate all API keys and tokens
   - [ ] Enable additional logging
   - [ ] Document timeline of events

2. **Investigation** (Within 1 hour)
   - [ ] Review access logs
   - [ ] Identify attack vector
   - [ ] Assess data exposure
   - [ ] Notify stakeholders

3. **Remediation** (Within 24 hours)
   - [ ] Deploy security patches
   - [ ] Force password resets if needed
   - [ ] Notify affected users (if required by law)
   - [ ] Update security measures

4. **Post-Incident** (Within 1 week)
   - [ ] Complete incident report
   - [ ] Update security documentation
   - [ ] Implement additional safeguards
   - [ ] Conduct security training

## Contact Information

**Security Team:**
- Email: security@yourdomain.com
- Incident Hotline: [Add phone number]
- PGP Key: [Add PGP key for secure communications]

**External Resources:**
- Firebase Support: https://firebase.google.com/support
- Vercel Support: https://vercel.com/support
- OWASP: https://owasp.org

---

**Last Updated:** 2025-10-14
**Next Review:** [Set date for next security review]
