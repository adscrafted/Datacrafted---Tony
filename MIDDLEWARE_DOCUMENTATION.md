# Server-Side Route Protection with Next.js Middleware

## Overview

The `middleware.ts` file provides **server-side route protection** that runs BEFORE pages render. This prevents unauthorized access even if JavaScript is disabled, addressing a critical security vulnerability where client-side auth checks could be bypassed.

## Implementation Location

**File:** `/middleware.ts` (project root)

## How It Works

### Execution Flow

```
User Request → Middleware → Protected Route Check → Auth Check → Response
                                      ↓                    ↓
                              Not Protected?        Authenticated?
                                      ↓                    ↓
                                  ALLOW               ALLOW
                                                           ↓
                                                   No Auth Found?
                                                           ↓
                                                   REDIRECT to /
```

### Protected Routes

The following routes require authentication:

- `/dashboard/*` - Dashboard and analytics
- `/projects/*` - Project management
- `/account/*` - User account settings (profile, billing, team)

### Public Routes

These routes are accessible without authentication:

- `/` - Landing page
- `/signin` - Sign in page (if exists)
- `/signup` - Sign up page (if exists)
- `/api/*` - API routes (protected separately by `withAuth` middleware)

## Authentication Methods

The middleware checks for authentication in the following order:

### 1. Session Cookie (Primary Method)

```typescript
const sessionCookie = request.cookies.get('__session')?.value
```

- **Name:** `__session`
- **Set by:** Firebase Authentication (server-side)
- **Security:** HTTP-only, Secure, SameSite
- **Best for:** Web application authentication

### 2. Authorization Header (Secondary Method)

```typescript
const authHeader = request.headers.get('authorization')
// Format: "Bearer <firebase-id-token>"
```

- **Format:** `Bearer <token>`
- **Set by:** Client application (fetch requests)
- **Best for:** API requests, mobile apps

## Debug Mode

For local development, you can bypass authentication:

```env
NEXT_PUBLIC_DEBUG_MODE=true
NODE_ENV=development
```

**SECURITY WARNING:**
- Only works in `development` mode
- NEVER enable in production
- Adds `X-Debug-Mode: true` header to responses
- Logs warning messages to console

```typescript
// Debug mode check
if (DEBUG_MODE === 'true' && NODE_ENV === 'development') {
  console.warn('⚠️ DEBUG_MODE: Bypassing auth')
  return NextResponse.next()
}
```

## Performance Optimizations

### 1. Lightweight Checks

The middleware only checks if credentials **exist**, not if they're **valid**:

```typescript
// ✅ Good - Fast check
const hasSession = !!request.cookies.get('__session')

// ❌ Bad - Slow (don't do this in middleware)
const user = await verifyIdToken(token) // Database query
```

**Why?**
- Middleware runs on Edge runtime (limited execution time)
- Token validation is expensive (cryptographic verification)
- Validation happens in API routes via `withAuth` middleware

### 2. Smart Matcher Configuration

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)',
  ],
}
```

This excludes:
- `_next/static/*` - Static assets
- `_next/image/*` - Image optimization
- `favicon.ico` - Favicon
- `*.svg`, `*.png`, `*.jpg` - Public images

**Why?**
- Reduces middleware execution count
- Improves performance
- Static assets don't need auth checks

## Security Features

### 1. Cannot Be Bypassed by Disabling JavaScript

Unlike client-side checks, middleware runs on the **server** before the page is sent to the browser:

```typescript
// Client-side check (can be bypassed)
useEffect(() => {
  if (!user) {
    router.push('/')
  }
}, [user])

// Server-side check (cannot be bypassed)
export function middleware(request: NextRequest) {
  if (!hasAuth(request)) {
    return NextResponse.redirect('/')
  }
}
```

### 2. Redirect with Context

When redirecting unauthenticated users, we include helpful context:

```typescript
const redirectUrl = new URL('/', request.url)
redirectUrl.searchParams.set('auth_required', 'true')
redirectUrl.searchParams.set('redirect_from', pathname)

return NextResponse.redirect(redirectUrl)
```

This allows the landing page to:
- Show "Please sign in to continue" message
- Remember which page the user wanted to access
- Redirect after successful login

### 3. Defense in Depth

The middleware is part of a **layered security approach**:

1. **Middleware** - Prevents page access (this file)
2. **Client-side checks** - Better UX (AuthGateModal)
3. **API route middleware** - Protects data access (`withAuth`)
4. **Database rules** - Row-level security (Prisma)

## Testing Instructions

### Test 1: Protected Route Without Auth

1. **Disable debug mode:**
   ```env
   NEXT_PUBLIC_DEBUG_MODE=false
   ```

2. **Clear cookies:**
   - Open DevTools → Application → Cookies
   - Delete all cookies for localhost

3. **Try to access protected route:**
   ```
   http://localhost:3000/dashboard
   ```

4. **Expected result:**
   - Redirected to: `/?auth_required=true&redirect_from=/dashboard`
   - Console log: `[MIDDLEWARE] Unauthorized access to /dashboard - redirecting to /`

### Test 2: Protected Route With Auth

1. **Sign in to the application**

2. **Verify session cookie exists:**
   - DevTools → Application → Cookies
   - Look for `__session` cookie

3. **Navigate to protected route:**
   ```
   http://localhost:3000/projects
   ```

4. **Expected result:**
   - Page loads successfully
   - Console log: `[MIDDLEWARE] Authenticated - allowing access to /projects`

### Test 3: JavaScript Disabled

1. **Disable JavaScript:**
   - DevTools → ⚙️ Settings → Debugger
   - Check "Disable JavaScript"

2. **Clear cookies to log out**

3. **Try to access protected route:**
   ```
   http://localhost:3000/dashboard
   ```

4. **Expected result:**
   - Still redirected to landing page (proves server-side protection works!)
   - Client-side auth check never runs (because JavaScript is disabled)

### Test 4: Debug Mode

1. **Enable debug mode:**
   ```env
   NEXT_PUBLIC_DEBUG_MODE=true
   NODE_ENV=development
   ```

2. **Clear all cookies**

3. **Access protected route:**
   ```
   http://localhost:3000/projects
   ```

4. **Expected result:**
   - Page loads successfully
   - Console warning: `⚠️ DEBUG_MODE: Bypassing auth for /projects`
   - Response header: `X-Debug-Mode: true`

### Test 5: API Routes (Should Not Be Affected)

1. **API routes have their own protection** via `withAuth` middleware

2. **Test API route:**
   ```bash
   curl http://localhost:3000/api/projects
   ```

3. **Expected result:**
   - Not redirected by middleware
   - Returns 401 Unauthorized (from API middleware)

## Limitations and Edge Cases

### 1. Does Not Validate Token

The middleware only checks if credentials **exist**, not if they're **valid**.

**Why?**
- Token validation requires cryptographic operations
- Edge runtime has limited execution time
- Better to fail fast and validate in API routes

**Implication:**
- Expired tokens will pass middleware
- They'll be caught by API route middleware
- User will see "Session expired" error

### 2. No Database Queries

Middleware cannot query the database to check user status.

**Why?**
- Middleware runs on Edge runtime (distributed globally)
- Database connections are limited and slow
- Would create performance bottleneck

**Implication:**
- Can't check if user is banned
- Can't check user roles/permissions
- Use API route middleware for fine-grained access control

### 3. Debug Mode Security

Debug mode only works in `development` to prevent accidents:

```typescript
if (DEBUG_MODE === 'true' && NODE_ENV === 'development') {
  // Only allows if BOTH conditions are true
}
```

**But what if someone sets `NODE_ENV=development` in production?**

This is a misconfiguration that would cause many other issues. Best practices:
- Use environment-specific `.env` files
- Never commit `.env.local` to git
- Use CI/CD to set production environment variables

## Integration with Existing Auth System

### Client-Side Auth (lib/contexts/auth-context.tsx)

```typescript
// Client-side provides better UX
if (!authLoading && !user && !isDebugMode) {
  return <AuthGateModal redirectPath="/dashboard" />
}
```

**Relationship:**
- Middleware: Primary security (cannot be bypassed)
- AuthGateModal: Better UX (shows nice modal instead of redirect)
- Both work together for defense in depth

### API Route Auth (lib/middleware/auth.ts)

```typescript
// API routes have granular control
export const GET = withAuth(async (request, user) => {
  // user is authenticated and token is valid
  return Response.json({ userId: user.uid })
})
```

**Relationship:**
- Middleware: Prevents page access
- withAuth: Protects API endpoints
- Different but complementary

### Session Cookies vs Tokens

**Session Cookies** (preferred for web apps):
```typescript
// Set by Firebase Admin SDK
const sessionCookie = await admin.auth().createSessionCookie(idToken)

// HTTP-only, Secure, SameSite
response.cookies.set('__session', sessionCookie, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 5 // 5 days
})
```

**Authorization Headers** (preferred for APIs):
```typescript
// Set by client
const token = await user.getIdToken()

fetch('/api/projects', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## Troubleshooting

### Issue: Infinite Redirect Loop

**Symptoms:**
- Browser shows "Too many redirects" error
- URL keeps changing between `/` and `/dashboard`

**Causes:**
1. Landing page (`/`) redirects to `/dashboard`
2. Middleware redirects `/dashboard` back to `/`

**Solution:**
```typescript
// In app/page.tsx - Don't auto-redirect
export default function LandingPage() {
  // ❌ Don't do this
  // useEffect(() => {
  //   if (user) router.push('/dashboard')
  // }, [user])

  // ✅ Do this instead - provide manual navigation
  return (
    <div>
      {user ? (
        <Button onClick={() => router.push('/dashboard')}>
          Go to Dashboard
        </Button>
      ) : (
        <Button onClick={() => setShowAuthModal(true)}>
          Sign In
        </Button>
      )}
    </div>
  )
}
```

### Issue: Middleware Not Running

**Symptoms:**
- Protected routes load without auth
- No middleware logs in console

**Check:**
1. File is named `middleware.ts` (not `middleware.js`)
2. File is in project root (not in `app/` or `lib/`)
3. Matcher pattern includes the route:
   ```typescript
   export const config = {
     matcher: ['/dashboard/:path*', '/projects/:path*']
   }
   ```

### Issue: Session Cookie Not Set

**Symptoms:**
- Middleware logs "No credentials found"
- Cookie tab in DevTools is empty

**Solution:**

You need to set session cookies after Firebase authentication:

```typescript
// In your sign-in API route
import { getAdminAuth } from '@/lib/config/firebase-admin'

export async function POST(request: NextRequest) {
  const { idToken } = await request.json()

  // Create session cookie (5 days)
  const expiresIn = 60 * 60 * 24 * 5 * 1000
  const sessionCookie = await getAdminAuth().createSessionCookie(
    idToken,
    { expiresIn }
  )

  // Set HTTP-only cookie
  const response = NextResponse.json({ success: true })
  response.cookies.set('__session', sessionCookie, {
    maxAge: expiresIn,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })

  return response
}
```

## Best Practices

### 1. Always Use HTTPS in Production

Session cookies should only be sent over HTTPS:

```typescript
response.cookies.set('__session', sessionCookie, {
  secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
  sameSite: 'lax',
  httpOnly: true
})
```

### 2. Set Appropriate Cookie Expiration

Match your session cookie expiration to Firebase token expiration:

```typescript
// Firebase default: 1 hour
// Session cookie: 5 days (requires refresh)
const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 days
```

### 3. Log Middleware Activity

Use consistent logging for debugging:

```typescript
console.log('[MIDDLEWARE]', {
  pathname: request.nextUrl.pathname,
  hasAuth: hasAuthCredentials(request),
  action: 'redirect' | 'allow'
})
```

### 4. Test in Production-Like Environment

Before deploying:
1. Set `NODE_ENV=production`
2. Disable debug mode
3. Test all protected routes
4. Verify redirects work correctly

## Summary

The middleware provides:
- ✅ Server-side route protection
- ✅ Cannot be bypassed by disabling JavaScript
- ✅ Fast execution (no database queries)
- ✅ Debug mode for development
- ✅ Detailed logging for debugging
- ✅ Integration with existing auth system

This is a critical security layer that complements (not replaces) client-side and API-level authentication.
