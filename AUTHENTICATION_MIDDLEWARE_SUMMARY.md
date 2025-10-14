# Authentication Middleware Implementation Summary

## Overview

A comprehensive authentication middleware system has been implemented for Next.js API route protection using Firebase Authentication and the Firebase Admin SDK.

## What Was Created

### 1. Core Files

#### `/lib/types/auth.ts`
TypeScript type definitions for authentication:
- `AuthUser` - Authenticated user interface
- `AuthenticatedRequest` - Extended Next.js request with user
- `AuthenticatedRouteHandler` - Type for authenticated route handlers
- `AuthError` - Custom error class for auth failures
- `AuthMiddlewareConfig` - Configuration interface for middleware

#### `/lib/config/firebase-admin.ts`
Firebase Admin SDK server-side configuration:
- Initializes Firebase Admin SDK for token verification
- Supports multiple credential methods (service account JSON, individual credentials, default)
- Handles debug mode for local development
- Exports `getAdminAuth()` and `getAdminApp()` helpers

#### `/lib/auth/server.ts`
Server-side authentication utilities:
- `extractToken(request)` - Extract Bearer token from Authorization header
- `verifyIdToken(token)` - Verify Firebase ID token using Admin SDK
- `getUserFromToken(token)` - Get user data from verified token
- `requireAuth(request)` - Main function to authenticate requests
- `verifyCustomClaims(user, claims)` - Verify user has required permissions
- `getOptionalAuth(request)` - Get auth without throwing errors
- Error response helpers

#### `/lib/middleware/auth.ts`
Main authentication middleware:
- `withAuth(handler, config?)` - **Primary HOF** for protecting routes
- `authenticate(request, config?)` - Manual authentication function
- `createAuthRoute<P>(handler, config?)` - Type-safe route creator with params
- `isAuthenticated(request)` - Check auth without throwing
- `requireRole(role)` - Helper for role-based access control
- `combineMiddleware(...configs)` - Combine multiple configs

#### `/lib/utils/api-client.ts` (Updated)
Client-side utilities for authenticated requests:
- `getAuthToken(user, forceRefresh?)` - Get Firebase ID token
- `createAuthHeader(user, forceRefresh?)` - Create Authorization header
- `authenticatedFetch(url, user, options?)` - Make authenticated requests with auto-refresh

### 2. Documentation

#### `/lib/middleware/README.md`
Comprehensive documentation including:
- Quick start guide
- API reference
- Configuration options
- Debug mode instructions
- Error handling guide
- TypeScript types
- Best practices
- Client-side integration examples
- Troubleshooting tips

### 3. Example Implementation

#### `/app/api/user/profile/route.ts`
Example protected API route demonstrating:
- GET endpoint for fetching user profile
- PATCH endpoint for updating profile
- Proper error handling
- Input validation
- TypeScript type safety

### 4. Environment Configuration

#### `.env.example` (Updated)
Added Firebase Admin SDK configuration:
```env
# Firebase Admin SDK credentials
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# OR
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Debug mode
NEXT_PUBLIC_DEBUG_MODE=false
```

## How to Use

### 1. Setup Firebase Admin SDK

**Option A: Service Account JSON (Recommended)**
```bash
# Download service account key from Firebase Console
# Project Settings > Service Accounts > Generate New Private Key

# Add to .env.local (as single-line JSON)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

**Option B: Individual Credentials**
```bash
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

### 2. Protect an API Route

```typescript
// app/api/protected/route.ts
import { withAuth } from '@/lib/middleware/auth'

export const GET = withAuth(async (request, user) => {
  // user is guaranteed to be authenticated
  return Response.json({
    message: `Hello ${user.displayName}!`,
    userId: user.uid
  })
})
```

### 3. Make Authenticated Requests from Client

```typescript
import { useAuth } from '@/lib/contexts/auth-context'
import { authenticatedFetch } from '@/lib/utils/api-client'

function MyComponent() {
  const { user } = useAuth()

  const fetchData = async () => {
    if (!user) return

    const response = await authenticatedFetch('/api/protected', user)
    const data = await response.json()
    console.log(data)
  }

  return <button onClick={fetchData}>Fetch Protected Data</button>
}
```

### 4. Advanced Usage

#### With Dynamic Routes
```typescript
// app/api/projects/[id]/route.ts
import { createAuthRoute } from '@/lib/middleware/auth'

interface Params {
  id: string
}

export const GET = createAuthRoute<Params>(async (request, user, context) => {
  const { id } = await context.params
  return Response.json({ projectId: id, userId: user.uid })
})
```

#### With Role-Based Access Control
```typescript
export const DELETE = withAuth(
  async (request, user) => {
    // Only admins can delete
    return Response.json({ deleted: true })
  },
  {
    requiredClaims: { role: 'admin' }
  }
)
```

#### Optional Authentication
```typescript
import { isAuthenticated } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  const user = await isAuthenticated(request)

  if (user) {
    // Personalized response
    return Response.json({ message: `Hello ${user.displayName}` })
  } else {
    // Public response
    return Response.json({ message: 'Hello Guest' })
  }
}
```

## Debug Mode

For local development without Firebase setup:

```env
NEXT_PUBLIC_DEBUG_MODE=true
```

**Features:**
- Bypasses Firebase authentication
- Uses mock debug user (`debug-user-123`)
- No Firebase credentials required
- ⚠️ **NEVER enable in production!**

## Security Features

1. **Server-side token verification** - Tokens are verified using Firebase Admin SDK
2. **Token expiration handling** - Automatic token refresh on client
3. **Revocation checking** - Checks if tokens have been revoked
4. **Custom claims support** - Role-based access control
5. **Secure error messages** - No sensitive data in error responses
6. **Debug mode protection** - Only works when explicitly enabled

## Error Handling

The system handles these authentication errors:

| Code | Status | Description |
|------|--------|-------------|
| `NO_TOKEN` | 401 | Missing Authorization header |
| `INVALID_TOKEN` | 401 | Malformed or invalid token |
| `EXPIRED_TOKEN` | 401 | Token has expired |
| `UNAUTHORIZED` | 403 | Missing required permissions |
| `FIREBASE_ERROR` | 401 | Firebase authentication error |

## File Structure

```
datacrafted/
├── lib/
│   ├── auth/
│   │   └── server.ts              # Server-side auth utilities
│   ├── config/
│   │   ├── firebase.ts            # Client-side Firebase config
│   │   └── firebase-admin.ts      # Server-side Firebase Admin config
│   ├── middleware/
│   │   ├── auth.ts                # Main middleware (withAuth HOF)
│   │   └── README.md              # Documentation
│   ├── types/
│   │   └── auth.ts                # TypeScript types
│   └── utils/
│       └── api-client.ts          # Client-side API utilities
├── app/
│   └── api/
│       └── user/
│           └── profile/
│               └── route.ts       # Example protected route
└── .env.example                   # Environment variable template
```

## Dependencies Added

```json
{
  "firebase-admin": "^13.5.0"
}
```

## Testing the Implementation

### 1. Test with Debug Mode (Local Development)

```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
```

```bash
# Test the API
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer any-token-works-in-debug-mode"
```

### 2. Test with Real Firebase (Production-like)

```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=false
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

```typescript
// Get real token from client
const user = auth.currentUser
const token = await user.getIdToken()

// Make authenticated request
const response = await fetch('/api/user/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## Migration Guide for Existing Routes

If you have existing API routes that need protection:

**Before:**
```typescript
export async function GET(request: NextRequest) {
  // Anyone can access this
  return Response.json({ data: 'public' })
}
```

**After:**
```typescript
import { withAuth } from '@/lib/middleware/auth'

export const GET = withAuth(async (request, user) => {
  // Only authenticated users can access
  return Response.json({ data: 'private', userId: user.uid })
})
```

## Next Steps

1. **Set up Firebase Admin SDK credentials** in your environment
2. **Protect sensitive API routes** with `withAuth`
3. **Update client code** to use `authenticatedFetch` utility
4. **Test authentication flow** end-to-end
5. **Implement custom claims** for role-based access (if needed)
6. **Monitor authentication errors** in production

## Support & Troubleshooting

See `/lib/middleware/README.md` for:
- Detailed API reference
- Configuration options
- Common issues and solutions
- Best practices
- Security considerations

## Key Benefits

✅ **Type-safe** - Full TypeScript support with proper type inference
✅ **Secure** - Server-side token verification with Firebase Admin SDK
✅ **Flexible** - Multiple authentication patterns (HOF, manual, optional)
✅ **Developer-friendly** - Debug mode for local development
✅ **Production-ready** - Proper error handling, logging, and token refresh
✅ **Well-documented** - Comprehensive docs with examples
✅ **Extensible** - Custom claims, role-based access, custom error handlers

---

**Files Modified:**
- `/lib/utils/api-client.ts` - Updated to use real Firebase ID tokens
- `.env.example` - Added Firebase Admin SDK configuration

**Files Created:**
- `/lib/types/auth.ts`
- `/lib/config/firebase-admin.ts`
- `/lib/auth/server.ts`
- `/lib/middleware/auth.ts`
- `/lib/middleware/README.md`
- `/app/api/user/profile/route.ts`
- `/AUTHENTICATION_MIDDLEWARE_SUMMARY.md` (this file)
