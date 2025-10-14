# Production Deployment Checklist

**Application:** DataCrafted
**Version:** 1.0.0
**Date:** 2025-10-14

This checklist ensures all critical security fixes are in place before deploying to production.

---

## Pre-Deployment Checklist

### 1. Environment Variables

#### Required Variables
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` is set
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is set
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is set
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` is set
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` is set
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID` is set
- [ ] `FIREBASE_CLIENT_EMAIL` is set (server-side)
- [ ] `FIREBASE_PRIVATE_KEY` is set (server-side)
- [ ] `DATABASE_URL` is set and valid
- [ ] `OPENAI_API_KEY` is set and valid

#### Security Configuration
- [ ] `DEBUG_MODE` is NOT set in production environment
- [ ] `NEXT_PUBLIC_DEBUG_MODE` is NOT set in production environment
- [ ] `SKIP_AUTH` is NOT set
- [ ] `DISABLE_AUTH` is NOT set
- [ ] `ADMIN_UID` OR `ADMIN_EMAIL_DOMAIN` is configured for admin access

#### Optional But Recommended
- [ ] `UPSTASH_REDIS_URL` is set (for distributed rate limiting)
- [ ] `UPSTASH_REDIS_TOKEN` is set
- [ ] `SENTRY_DSN` is set (for error tracking)

**Verification Command:**
```bash
npm run build
# Should output: ✅ Environment variables validated successfully
```

---

### 2. Security Fixes Verification

#### Admin Endpoint Protection
- [ ] Test admin endpoint without auth (should return 401)
  ```bash
  curl http://localhost:3000/api/admin/cleanup
  # Expected: {"error":"Unauthorized"}
  ```

- [ ] Test admin endpoint with non-admin user (should return 403)
  ```bash
  curl -H "Authorization: Bearer <user-token>" http://localhost:3000/api/admin/cleanup
  # Expected: {"error":"Forbidden: Admin access required"}
  ```

- [ ] Test admin endpoint with admin user (should return 200)
  ```bash
  curl -H "Authorization: Bearer <admin-token>" http://localhost:3000/api/admin/cleanup
  # Expected: {"success":true,...}
  ```

#### Debug Endpoints Removed
- [ ] Verify debug endpoints return 404:
  ```bash
  curl http://localhost:3000/api/debug-dashboard    # Should 404
  curl http://localhost:3000/api/debug-state        # Should 404
  curl http://localhost:3000/api/debug-store-state  # Should 404
  curl http://localhost:3000/api/debug-store        # Should 404
  curl http://localhost:3000/api/test               # Should 404
  ```

#### DEBUG_MODE Protection
- [ ] Test production build with DEBUG_MODE (should fail):
  ```bash
  NODE_ENV=production DEBUG_MODE=true npm run build
  # Expected: FATAL SECURITY ERROR
  ```

- [ ] Test Vercel production build (should fail):
  ```bash
  VERCEL_ENV=production NEXT_PUBLIC_DEBUG_MODE=true npm run build
  # Expected: FATAL SECURITY ERROR
  ```

#### Health Check Sanitization
- [ ] Test health endpoint returns minimal info:
  ```bash
  curl http://localhost:3000/api/health
  # Should only return: {"status":"healthy","timestamp":"..."}
  # Should NOT expose: environment variables, missing vars, version, etc.
  ```

#### CSP Headers
- [ ] Verify Content-Security-Policy header is present:
  ```bash
  curl -I http://localhost:3000 | grep -i content-security-policy
  # Should return CSP header with policy
  ```

---

### 3. Code Quality

#### TypeScript
- [ ] No TypeScript errors: `npm run type-check` or `tsc --noEmit`
- [ ] All types are properly defined (no `any` types in critical code)

#### Linting
- [ ] No ESLint errors: `npm run lint`
- [ ] No ESLint security warnings

#### Dependencies
- [ ] No critical vulnerabilities: `npm audit --audit-level=critical`
- [ ] All dependencies up to date: `npm outdated`

#### Build
- [ ] Production build succeeds: `npm run build`
- [ ] No build warnings
- [ ] Bundle size is reasonable (check .next/static)

---

### 4. Database

#### Migrations
- [ ] All Prisma migrations are up to date: `npx prisma migrate status`
- [ ] Database schema matches Prisma schema
- [ ] Backup of production database exists

#### Connection
- [ ] Database connection string uses SSL: `?sslmode=require`
- [ ] Database connection pooling is configured
- [ ] Test database connection: `npx prisma db pull`

---

### 5. Authentication

#### Firebase Configuration
- [ ] Firebase project is in production mode (not test mode)
- [ ] Firebase security rules are configured
- [ ] Firebase Storage rules are configured
- [ ] OAuth providers are configured (Google, etc.)

#### Testing
- [ ] User can sign up
- [ ] User can sign in
- [ ] User can sign out
- [ ] Password reset works
- [ ] Email verification works (if enabled)

---

### 6. Security Headers

Verify all security headers are present:

- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- [ ] `Content-Security-Policy` with appropriate policies

**Verification Command:**
```bash
curl -I https://yourdomain.com | grep -E "X-Frame-Options|X-Content-Type|Referrer-Policy|X-XSS|Permissions-Policy|Strict-Transport|Content-Security"
```

---

### 7. Rate Limiting

- [ ] Rate limiting is configured (in-memory or Redis)
- [ ] Test rate limiting by making 30+ requests:
  ```bash
  for i in {1..35}; do curl http://localhost:3000/api/sessions; done
  # Should see 429 errors after 30 requests
  ```
- [ ] Rate limit headers are present: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

---

### 8. File Upload

- [ ] File size limits are enforced (50MB default)
- [ ] File type validation works (CSV, XLSX, XLS, JSON)
- [ ] Malicious file upload is rejected
- [ ] Large file upload works without timeout

---

### 9. API Testing

#### Public Endpoints
- [ ] `/api/health` - Returns healthy status
- [ ] Landing page loads correctly

#### Protected Endpoints (Require Authentication)
- [ ] `/api/sessions` - Create/list sessions
- [ ] `/api/sessions/[id]` - Get/update/delete session
- [ ] `/api/projects` - Create/list projects
- [ ] `/api/projects/[id]` - Get/update/delete project
- [ ] `/api/analyze` - AI analysis
- [ ] `/api/chat` - Chat with AI

#### Admin Endpoints (Require Admin Role)
- [ ] `/api/admin/cleanup` - Cleanup database

---

### 10. Monitoring & Logging

#### Error Tracking
- [ ] Sentry (or alternative) is configured
- [ ] Test error tracking by triggering an error
- [ ] Error alerts are routed to correct channels

#### Logging
- [ ] Production logs are collected (CloudWatch, Papertrail, etc.)
- [ ] Log level is appropriate (no debug logs in production)
- [ ] No sensitive data in logs (passwords, tokens, PII)

#### Uptime Monitoring
- [ ] Uptime monitoring is configured (UptimeRobot, Pingdom, etc.)
- [ ] Health check endpoint is monitored
- [ ] Alerts are configured for downtime

---

### 11. Performance

- [ ] Lighthouse score > 90 for Performance
- [ ] Time to First Byte (TTFB) < 600ms
- [ ] First Contentful Paint (FCP) < 1.8s
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Cumulative Layout Shift (CLS) < 0.1

**Test Command:**
```bash
# Run Lighthouse in Chrome DevTools or CLI
npx lighthouse https://yourdomain.com --view
```

---

### 12. SSL/TLS

- [ ] SSL certificate is valid
- [ ] SSL Labs rating is A or A+: https://www.ssllabs.com/ssltest/
- [ ] Certificate auto-renewal is configured
- [ ] HTTPS redirect is working (HTTP → HTTPS)

---

### 13. Backup & Recovery

- [ ] Database backup is automated
- [ ] Backup retention policy is configured (30 days recommended)
- [ ] Backup restore procedure is documented
- [ ] Test database restore from backup

---

## Deployment Steps

### 1. Pre-Deployment

1. [ ] Create a backup of production database
2. [ ] Tag release in git: `git tag v1.0.0`
3. [ ] Push to staging environment first
4. [ ] Run all tests in staging
5. [ ] Get approval from stakeholders

### 2. Deployment

1. [ ] Deploy to production
2. [ ] Run database migrations (if any)
3. [ ] Monitor deployment logs for errors
4. [ ] Verify all services are healthy

### 3. Post-Deployment

1. [ ] Run smoke tests
2. [ ] Check health check endpoint
3. [ ] Test authentication flow
4. [ ] Test critical user journeys
5. [ ] Monitor error rates
6. [ ] Monitor performance metrics

---

## Post-Deployment Verification

### Immediate (Within 5 Minutes)

- [ ] Health check returns healthy: `curl https://yourdomain.com/api/health`
- [ ] Landing page loads
- [ ] User can sign in
- [ ] No critical errors in logs

### Short Term (Within 1 Hour)

- [ ] User can upload file
- [ ] User can analyze data
- [ ] User can view dashboard
- [ ] No elevated error rates
- [ ] No performance degradation

### Medium Term (Within 24 Hours)

- [ ] Monitor error tracking dashboard
- [ ] Check server resource usage (CPU, memory)
- [ ] Review security logs
- [ ] Check rate limiting is working
- [ ] Verify no authentication issues

---

## Rollback Plan

If critical issues are detected:

### Immediate Rollback
1. Revert to previous deployment version
2. Restore database from backup (if schema changed)
3. Clear CDN cache
4. Notify users of temporary issues

### Investigation
1. Review deployment logs
2. Check error tracking system
3. Identify root cause
4. Fix in development environment
5. Test thoroughly
6. Redeploy with fixes

---

## Security Incident Response

If security breach is detected:

### Immediate Actions
1. [ ] Take affected services offline
2. [ ] Notify security team
3. [ ] Preserve logs and evidence
4. [ ] Change all credentials and API keys
5. [ ] Review access logs

### Investigation
1. [ ] Identify breach vector
2. [ ] Assess impact (data accessed, users affected)
3. [ ] Document timeline of events
4. [ ] Report to authorities (if required by law)

### Recovery
1. [ ] Fix vulnerability
2. [ ] Restore from backup (if needed)
3. [ ] Reset all user passwords
4. [ ] Notify affected users
5. [ ] Implement additional monitoring

---

## Additional Recommendations

### Before Next Deployment

1. **Input Validation**
   - Add Zod schemas to all API endpoints
   - Implement request size limits
   - Add file type validation

2. **Rate Limiting**
   - Migrate to Redis-backed rate limiting
   - Configure per-endpoint limits
   - Add IP-based blocking

3. **Audit Logging**
   - Log all admin actions
   - Log all authentication events
   - Store logs securely

4. **Security Scanning**
   - Set up automated OWASP ZAP scanning
   - Enable GitHub security alerts
   - Integrate Snyk for dependency scanning

---

## Sign-Off

### Technical Lead
- [ ] All pre-deployment checks passed
- [ ] Code reviewed and approved
- [ ] Tests passing
- [ ] Security fixes verified

**Name:** ________________  
**Date:** ________________  
**Signature:** ________________

### Security Engineer
- [ ] Security audit completed
- [ ] All critical vulnerabilities fixed
- [ ] Penetration testing passed
- [ ] Compliance requirements met

**Name:** ________________  
**Date:** ________________  
**Signature:** ________________

### Product Owner
- [ ] Stakeholder approval obtained
- [ ] Release notes prepared
- [ ] User communication planned
- [ ] Support team briefed

**Name:** ________________  
**Date:** ________________  
**Signature:** ________________

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Technical Lead | | |
| Security Engineer | | |
| DevOps Engineer | | |
| Database Administrator | | |
| On-Call Engineer | | |

---

## Reference Documents

- Security Audit Report: `SECURITY_AUDIT_REPORT.md`
- Security Fixes Implementation: `SECURITY_FIXES_IMPLEMENTATION.md`
- API Documentation: `docs/api/`
- Architecture Documentation: `docs/architecture/`

---

**Checklist Version:** 1.0
**Last Updated:** 2025-10-14
**Next Review:** After each deployment

