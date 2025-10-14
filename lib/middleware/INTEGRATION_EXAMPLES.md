# Authentication Middleware - Integration Examples

This guide shows how to integrate authentication middleware into existing API routes in your DataCrafted application.

## Example 1: Protecting Dashboard API

### Before (Unprotected)
```typescript
// app/api/dashboard/[id]/route.ts
import { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Anyone can access this - security issue!
  const dashboard = await getDashboard(id)

  return Response.json({ dashboard })
}
```

### After (Protected)
```typescript
// app/api/dashboard/[id]/route.ts
import { createAuthRoute } from '@/lib/middleware/auth'

interface Params {
  id: string
}

export const GET = createAuthRoute<Params>(async (request, user, context) => {
  const { id } = await context.params

  // Only authenticated users can access
  // Verify user owns this dashboard
  const dashboard = await getDashboard(id)

  if (dashboard.userId !== user.uid) {
    return Response.json(
      { error: 'Unauthorized - Dashboard not found' },
      { status: 404 }
    )
  }

  return Response.json({ dashboard })
})
```

## Example 2: Protecting Project API

### Before (Unprotected)
```typescript
// app/api/projects/route.ts
export async function GET() {
  // Returns all projects - privacy issue!
  const projects = await getAllProjects()
  return Response.json({ projects })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  // No user association - orphaned data!
  const project = await createProject(body)
  return Response.json({ project })
}
```

### After (Protected)
```typescript
// app/api/projects/route.ts
import { withAuth } from '@/lib/middleware/auth'

export const GET = withAuth(async (request, user) => {
  // Only return user's own projects
  const projects = await getProjectsByUserId(user.uid)
  return Response.json({ projects })
})

export const POST = withAuth(async (request, user) => {
  const body = await request.json()

  // Associate project with authenticated user
  const project = await createProject({
    ...body,
    userId: user.uid,
    createdBy: user.email,
  })

  return Response.json({ project })
})
```

## Example 3: Session Management

### Protected Session Routes
```typescript
// app/api/sessions/[id]/route.ts
import { createAuthRoute } from '@/lib/middleware/auth'

interface Params {
  id: string
}

export const GET = createAuthRoute<Params>(async (request, user, context) => {
  const { id } = await context.params

  const session = await getSession(id)

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  // Verify user owns this session
  if (session.userId !== user.uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  return Response.json({ session })
})

export const PATCH = createAuthRoute<Params>(async (request, user, context) => {
  const { id } = await context.params
  const body = await request.json()

  const session = await getSession(id)

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.userId !== user.uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const updated = await updateSession(id, body)
  return Response.json({ session: updated })
})

export const DELETE = createAuthRoute<Params>(async (request, user, context) => {
  const { id } = await context.params

  const session = await getSession(id)

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.userId !== user.uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  await deleteSession(id)
  return Response.json({ success: true })
})
```

## Example 4: File Upload with Auth

```typescript
// app/api/upload/route.ts
import { withAuth } from '@/lib/middleware/auth'

export const POST = withAuth(async (request, user) => {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  // Store file with user association
  const uploadedFile = await storeFile(file, {
    userId: user.uid,
    uploadedBy: user.email,
    uploadedAt: new Date().toISOString(),
  })

  return Response.json({
    success: true,
    file: uploadedFile,
  })
})
```

## Example 5: Admin-Only Routes

```typescript
// app/api/admin/users/route.ts
import { withAuth } from '@/lib/middleware/auth'

export const GET = withAuth(
  async (request, user) => {
    // Only admins can list all users
    const users = await getAllUsers()
    return Response.json({ users })
  },
  {
    requiredClaims: { role: 'admin' }
  }
)

export const DELETE = withAuth(
  async (request, user) => {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return Response.json({ error: 'User ID required' }, { status: 400 })
    }

    // Only admins can delete users
    await deleteUser(userId)
    return Response.json({ success: true })
  },
  {
    requiredClaims: { role: 'admin' }
  }
)
```

## Example 6: Mixed Public/Private Content

```typescript
// app/api/charts/[id]/route.ts
import { isAuthenticated } from '@/lib/middleware/auth'

interface Params {
  id: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params

  // Try to authenticate, but don't require it
  const user = await isAuthenticated(request)

  const chart = await getChart(id)

  if (!chart) {
    return Response.json({ error: 'Chart not found' }, { status: 404 })
  }

  // Check if chart is public or user owns it
  const canView = chart.isPublic || chart.userId === user?.uid

  if (!canView) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Return appropriate data based on auth status
  if (user) {
    return Response.json({
      chart,
      canEdit: chart.userId === user.uid,
      canShare: chart.userId === user.uid,
    })
  } else {
    return Response.json({
      chart,
      canEdit: false,
      canShare: false,
    })
  }
}
```

## Example 7: Client-Side Hook Integration

```typescript
// hooks/use-authenticated-api.ts
import { useAuth } from '@/lib/contexts/auth-context'
import { authenticatedFetch } from '@/lib/utils/api-client'
import { useState, useCallback } from 'react'

export function useAuthenticatedAPI() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(
    async (url: string, options?: RequestInit) => {
      if (!user) {
        throw new Error('User not authenticated')
      }

      setLoading(true)
      setError(null)

      try {
        const response = await authenticatedFetch(url, user, options)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Request failed')
        }

        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [user]
  )

  return { request, loading, error, user }
}

// Usage in a component
function MyComponent() {
  const { request, loading, error } = useAuthenticatedAPI()

  const fetchData = async () => {
    try {
      const data = await request('/api/protected')
      console.log(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    }
  }

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
```

## Example 8: Batch Operations with Auth

```typescript
// app/api/projects/batch/route.ts
import { withAuth } from '@/lib/middleware/auth'

export const POST = withAuth(async (request, user) => {
  const { operation, projectIds } = await request.json()

  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return Response.json(
      { error: 'Project IDs array required' },
      { status: 400 }
    )
  }

  // Verify user owns all projects
  const projects = await getProjectsByIds(projectIds)

  const unauthorized = projects.some(p => p.userId !== user.uid)

  if (unauthorized) {
    return Response.json(
      { error: 'Unauthorized - You do not own all projects' },
      { status: 403 }
    )
  }

  switch (operation) {
    case 'delete':
      await deleteProjects(projectIds)
      return Response.json({ success: true, deleted: projectIds.length })

    case 'archive':
      await archiveProjects(projectIds)
      return Response.json({ success: true, archived: projectIds.length })

    default:
      return Response.json(
        { error: 'Invalid operation' },
        { status: 400 }
      )
  }
})
```

## Example 9: Webhook with Optional Auth

```typescript
// app/api/webhooks/data-update/route.ts
import { isAuthenticated } from '@/lib/middleware/auth'

export async function POST(request: NextRequest) {
  // Check for webhook signature first
  const signature = request.headers.get('x-webhook-signature')

  if (signature) {
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(signature, await request.text())

    if (isValid) {
      // Process webhook
      return Response.json({ success: true })
    }
  }

  // Fallback to user authentication
  const user = await isAuthenticated(request)

  if (!user) {
    return Response.json(
      { error: 'Unauthorized - Invalid signature or authentication' },
      { status: 401 }
    )
  }

  // Process authenticated request
  const body = await request.json()
  await processDataUpdate(body, user.uid)

  return Response.json({ success: true })
}
```

## Migration Checklist

When adding authentication to existing routes:

- [ ] Import `withAuth` or `createAuthRoute` from middleware
- [ ] Wrap handler function with authentication
- [ ] Access user from handler parameters (not request)
- [ ] Verify resource ownership before operations
- [ ] Update client code to send Authorization header
- [ ] Handle 401 responses (token refresh/re-auth)
- [ ] Test with debug mode first
- [ ] Test with real Firebase credentials
- [ ] Update TypeScript types if needed
- [ ] Add error handling for auth failures

## Common Pitfalls to Avoid

❌ **Don't trust client-provided user data**
```typescript
// BAD
const { userId } = await request.json()
const data = await getData(userId)
```

✅ **Use server-verified user from token**
```typescript
// GOOD
export const GET = withAuth(async (request, user) => {
  const data = await getData(user.uid)
})
```

❌ **Don't skip authorization checks**
```typescript
// BAD - authenticated but not authorized
export const DELETE = withAuth(async (request, user) => {
  const { id } = await params
  await deleteProject(id) // No ownership check!
})
```

✅ **Always verify resource ownership**
```typescript
// GOOD
export const DELETE = withAuth(async (request, user) => {
  const { id } = await params
  const project = await getProject(id)

  if (project.userId !== user.uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  await deleteProject(id)
})
```
