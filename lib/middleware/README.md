# Authentication Middleware

This directory contains authentication middleware for protecting Next.js API routes with Firebase Authentication.

## Overview

The authentication system uses Firebase Admin SDK for server-side token verification, ensuring secure API route protection.

## Files

- **`auth.ts`** - Main middleware module with `withAuth` HOF and utilities
- **`README.md`** - This documentation file

## Quick Start

### 1. Setup Environment Variables

Add Firebase Admin SDK credentials to your `.env.local`:

```env
# Method 1: Full service account JSON (recommended)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Method 2: Individual credentials
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
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

### 3. Send Authenticated Requests from Client

```typescript
// Client-side code
import { auth } from '@/lib/config/firebase'

async function callProtectedAPI() {
  const user = auth.currentUser
  if (!user) return

  // Get Firebase ID token
  const token = await user.getIdToken()

  // Make authenticated request
  const response = await fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  const data = await response.json()
  console.log(data)
}
```

## API Reference

### `withAuth(handler, config?)`

Higher-Order Function that wraps an API route handler with authentication.

**Parameters:**
- `handler` - Your authenticated route handler function
- `config` (optional) - Middleware configuration object

**Returns:** Next.js route handler with authentication

**Example:**
```typescript
export const GET = withAuth(async (request, user) => {
  return Response.json({ userId: user.uid })
})
```

### `authenticate(request, config?)`

Manual authentication for more control within route handlers.

**Parameters:**
- `request` - Next.js request object
- `config` (optional) - Middleware configuration

**Returns:** Promise<AuthUser>

**Example:**
```typescript
export async function POST(request: NextRequest) {
  const user = await authenticate(request)
  const body = await request.json()
  // Process authenticated request
  return Response.json({ success: true })
}
```

### `createAuthRoute<P>(handler, config?)`

Create authenticated route with TypeScript params inference.

**Example:**
```typescript
// app/api/projects/[id]/route.ts
interface Params { id: string }

export const GET = createAuthRoute<Params>(async (request, user, context) => {
  const { id } = await context.params
  return Response.json({ projectId: id, userId: user.uid })
})
```

### `isAuthenticated(request)`

Check authentication without throwing errors.

**Returns:** Promise<AuthUser | null>

**Example:**
```typescript
export async function GET(request: NextRequest) {
  const user = await isAuthenticated(request)

  if (user) {
    return Response.json({ message: `Hello ${user.displayName}` })
  } else {
    return Response.json({ message: 'Hello Guest' })
  }
}
```

## Configuration Options

### `AuthMiddlewareConfig`

```typescript
interface AuthMiddlewareConfig {
  // Allow debug mode bypass (default: true)
  allowDebugMode?: boolean

  // Custom error handler
  onError?: (error: AuthError) => Response

  // Required custom claims (for role-based access)
  requiredClaims?: Record<string, any>
}
```

### Custom Error Handling

```typescript
export const POST = withAuth(
  async (request, user) => {
    return Response.json({ success: true })
  },
  {
    onError: (error) => {
      console.error('Auth error:', error)
      return Response.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
  }
)
```

### Role-Based Access Control

```typescript
export const DELETE = withAuth(
  async (request, user) => {
    // Only admins can access
    return Response.json({ deleted: true })
  },
  {
    requiredClaims: { role: 'admin' }
  }
)
```

## Debug Mode

For local development without Firebase setup:

```env
NEXT_PUBLIC_DEBUG_MODE=true
```

When enabled:
- All authentication checks are bypassed
- A mock debug user is used
- ⚠️ **NEVER enable in production!**

## Error Handling

The middleware handles these error types:

| Error Code | Status | Description |
|------------|--------|-------------|
| `NO_TOKEN` | 401 | No Authorization header provided |
| `INVALID_TOKEN` | 401 | Token is malformed or invalid |
| `EXPIRED_TOKEN` | 401 | Token has expired |
| `UNAUTHORIZED` | 403 | Missing required permissions |
| `FIREBASE_ERROR` | 401 | Firebase authentication error |

## TypeScript Types

### `AuthUser`

```typescript
interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  phoneNumber?: string | null
  customClaims?: Record<string, any>
}
```

### `AuthenticatedRouteHandler`

```typescript
type AuthenticatedRouteHandler<P = {}> = (
  request: NextRequest,
  user: AuthUser,
  context?: { params: P }
) => Promise<Response>
```

## Best Practices

1. **Always verify tokens server-side** - Never trust client-provided user data
2. **Use HTTPS in production** - Tokens should only be sent over secure connections
3. **Refresh expired tokens** - Implement token refresh logic on the client
4. **Log authentication failures** - Monitor for potential security issues
5. **Use role-based access control** - Leverage custom claims for fine-grained permissions

## Client-Side Integration

### Get ID Token

```typescript
import { auth } from '@/lib/config/firebase'

async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null

  try {
    return await user.getIdToken()
  } catch (error) {
    console.error('Failed to get token:', error)
    return null
  }
}
```

### Make Authenticated Request

```typescript
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const token = await getAuthToken()

  if (!token) {
    throw new Error('Not authenticated')
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  })
}
```

### Handle 401 Responses

```typescript
async function handleAuthenticatedRequest() {
  try {
    const response = await authenticatedFetch('/api/protected')

    if (response.status === 401) {
      // Token expired or invalid - refresh or re-authenticate
      const user = auth.currentUser
      if (user) {
        await user.getIdToken(true) // Force refresh
        // Retry request
      }
    }

    return await response.json()
  } catch (error) {
    console.error('Request failed:', error)
  }
}
```

## Troubleshooting

### "Firebase Admin SDK initialization failed"

1. Verify environment variables are set correctly
2. Check service account JSON is valid
3. Ensure private key has proper newline formatting: `\\n` → `\n`

### "Invalid authentication token"

1. Ensure client is sending token in `Authorization: Bearer <token>` format
2. Verify token hasn't expired (refresh on client)
3. Check Firebase project ID matches

### "Token verification failed"

1. Confirm Firebase Admin SDK has correct project ID
2. Verify service account has necessary permissions
3. Check system clock is synchronized (token verification is time-sensitive)

## Related Files

- `/lib/auth/server.ts` - Server-side auth utilities
- `/lib/types/auth.ts` - TypeScript type definitions
- `/lib/config/firebase-admin.ts` - Firebase Admin SDK configuration
- `/lib/config/firebase.ts` - Client-side Firebase configuration
