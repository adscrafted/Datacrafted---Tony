# Middleware Quick Reference

## What Was Created

A server-side route protection middleware that prevents unauthorized access to protected pages.

## Files Created/Modified

1. **Created:** `/middleware.ts` - Main middleware implementation
2. **Modified:** `/.env.example` - Added security warnings for DEBUG_MODE
3. **Created:** `/MIDDLEWARE_DOCUMENTATION.md` - Comprehensive documentation

## Protected Routes

- `/dashboard/*` - Requires authentication
- `/projects/*` - Requires authentication
- `/account/*` - Requires authentication

## How Authentication Works

### 1. Session Cookie (Preferred)
```typescript
request.cookies.get('__session')
```

### 2. Authorization Header (Alternative)
```typescript
request.headers.get('authorization')
// Format: "Bearer <firebase-token>"
```

## Key Features

### Cannot Be Bypassed
Unlike client-side checks, this runs on the **server** before the page loads:
- Works even if JavaScript is disabled
- Runs before React components render
- Edge runtime (fast, globally distributed)

### Debug Mode (Development Only)
```env
NEXT_PUBLIC_DEBUG_MODE=true
NODE_ENV=development
```

**Security:** Only works if BOTH conditions are true.

## Testing

### Test 1: Without Auth (Should Redirect)
1. Clear cookies
2. Visit `http://localhost:3000/dashboard`
3. Should redirect to `/`

### Test 2: With Auth (Should Allow)
1. Sign in
2. Verify `__session` cookie exists
3. Visit `http://localhost:3000/projects`
4. Should load successfully

### Test 3: JavaScript Disabled (Proves Server-Side Protection)
1. Disable JavaScript in DevTools
2. Clear cookies
3. Visit `http://localhost:3000/dashboard`
4. Should still redirect (proves it's not client-side!)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Request                         │
│              (http://app.com/dashboard)                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js Middleware (Edge)                   │
│                                                          │
│  1. Check if route is protected                         │
│  2. Check for auth credentials                          │
│  3. Allow or redirect                                   │
└───────────────────┬──────────────────┬──────────────────┘
                    │                  │
            Has Auth?                  No Auth?
                    │                  │
                    ▼                  ▼
          ┌─────────────────┐  ┌──────────────┐
          │  Allow Access   │  │  Redirect    │
          │  (Status 200)   │  │  to /        │
          └─────────────────┘  └──────────────┘
```

## Layered Security

The middleware is one of four security layers:

1. **Middleware (Server-side)** - Prevents page access (NEW)
2. **Client-side checks** - Better UX (`AuthGateModal`)
3. **API middleware** - Protects data (`withAuth`)
4. **Database rules** - Row-level security (Prisma)

## Common Issues

### Issue: Infinite Redirect Loop
**Cause:** Landing page redirects to `/dashboard`, middleware redirects back to `/`

**Fix:** Don't auto-redirect authenticated users from landing page. Use a manual button instead.

### Issue: Session Cookie Not Set
**Cause:** Firebase authentication doesn't automatically create session cookies.

**Fix:** Create session cookie after sign-in:
```typescript
// In sign-in API route
const sessionCookie = await admin.auth().createSessionCookie(idToken, {
  expiresIn: 60 * 60 * 24 * 5 * 1000 // 5 days
})

response.cookies.set('__session', sessionCookie, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax'
})
```

### Issue: Middleware Not Running
**Check:**
1. File is named `middleware.ts` (not `.js`)
2. File is in project root (not `app/` or `lib/`)
3. Route matches the matcher pattern

## Performance

### Fast Edge Execution
- Runs on Cloudflare Workers / Vercel Edge
- No database queries
- Only checks if credentials exist (not if they're valid)
- Validation happens in API routes

### Smart Exclusions
Middleware doesn't run on:
- Static files (`_next/static/*`)
- Images (`_next/image/*`)
- Public assets (`*.svg`, `*.png`, etc.)

## Security Notes

### What Middleware Does
- ✅ Checks if credentials exist
- ✅ Blocks access to protected routes
- ✅ Fast edge execution

### What Middleware Doesn't Do
- ❌ Validate token cryptographically
- ❌ Check if user is banned
- ❌ Check user roles/permissions
- ❌ Query database

**Why?** Token validation and database queries are too slow for edge middleware. Use API route middleware (`withAuth`) for fine-grained access control.

## Environment Variables

```env
# Required for middleware to work
NEXT_PUBLIC_DEBUG_MODE=false     # NEVER true in production
NODE_ENV=development              # Set to 'production' in production
```

## Logs to Watch

```bash
# Successful authentication
[MIDDLEWARE] Authenticated - allowing access to /dashboard

# Blocked access
[MIDDLEWARE] Unauthorized access to /projects - redirecting to /

# Debug mode (development only)
⚠️ DEBUG_MODE: Bypassing auth for /dashboard
```

## Integration Points

### Client-Side Auth Context
```typescript
// lib/contexts/auth-context.tsx
const { user, loading } = useAuth()

if (!loading && !user) {
  return <AuthGateModal /> // Better UX
}
```

### API Route Protection
```typescript
// app/api/projects/route.ts
export const GET = withAuth(async (request, user) => {
  // user is authenticated and validated
  return Response.json({ userId: user.uid })
})
```

## Summary

- **Location:** `/middleware.ts`
- **Purpose:** Server-side route protection
- **Protected:** `/dashboard/*`, `/projects/*`, `/account/*`
- **Authentication:** Session cookie or Authorization header
- **Performance:** Fast edge execution, no database queries
- **Security:** Cannot be bypassed by disabling JavaScript
- **Testing:** Disable JavaScript to verify server-side protection

This middleware adds a critical security layer that complements existing client-side and API-level authentication.
