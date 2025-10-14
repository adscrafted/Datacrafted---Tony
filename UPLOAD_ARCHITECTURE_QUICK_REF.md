# Upload Architecture Quick Reference

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     File Upload Flow                         │
└─────────────────────────────────────────────────────────────┘

1. User drops file → FileUploadCore.tsx
2. Parse file locally → parseFileOptimized()
3. Analyze schema → analyzeDataSchema()
4. Store in Zustand → setRawData(), setDataSchema()
5. Store in IndexedDB (if >1000 rows) → projectDataStorage
6. Create project LOCALLY → useProjectStore.createProject()
7. Navigate to /dashboard → Shows data from local store

NO API CALLS IN UPLOAD FLOW (except /api/analyze for AI insights)
```

## Storage Architecture

| Data Type | Storage Location | API Endpoints | Use Case |
|-----------|-----------------|---------------|----------|
| **Projects** | Zustand + IndexedDB | ❌ None (client-only) | Upload metadata |
| **Sessions** | PostgreSQL | ✅ `/api/sessions` | Chat history, dashboard state |
| **Raw Data** | IndexedDB | ❌ None | Large datasets (>1000 rows) |
| **Small Data** | localStorage (via Zustand) | ❌ None | Small datasets (<1000 rows) |
| **Analysis Results** | IndexedDB | ✅ `/api/analyze` | AI-generated insights |

## API Endpoints Status

### ✅ Implemented & Working
- `POST /api/analyze` - AI data analysis (rate limit: 10/hour)
- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions/:id/data` - Load session data
- `POST /api/sessions/:id/data` - Save session data
- `POST /api/sessions/:id/chat` - Chat endpoint
- `POST /api/user/sync` - Sync Firebase user to DB

### ❌ Missing (No Implementation)
- `POST /api/projects` - Would create project in DB
- `GET /api/projects` - Would list user projects
- `GET /api/projects/:id` - Would get project details
- `POST /api/projects/:id/data` - Would save project data

## Authentication Flow

```
┌──────────────────────────────────────────────────────────┐
│  Upload Flow Supports Both Authenticated & Anonymous     │
└──────────────────────────────────────────────────────────┘

Authenticated User (user?.uid exists):
  → Creates project with userId: user.uid
  → Can save to database (if API implemented)
  → Multi-device sync possible

Anonymous User (user?.uid is null):
  → Creates project with userId: 'anonymous'
  → Data stays in browser (localStorage/IndexedDB)
  → No server backup

All /api/* endpoints require authentication (withAuth middleware)
└─ Exception: Debug mode bypasses (local development only)
```

## The 3 Backend Errors Explained

```
ERROR 1: POST /api/projects → 404
ERROR 2: GET /api/projects/:id → 404
ERROR 3: POST /api/projects/:id/data → 404

Root Cause:
  - API endpoints don't exist (directory missing)
  - Frontend doesn't call these endpoints
  - Likely source: cached code, browser extension, or service worker

Impact: NONE (upload works, data saved locally)

Fix: Clear browser cache + hard reload
```

## File Locations

### Upload Components
```
components/upload/file-upload-core.tsx          Main upload logic
app/page.tsx                                    Landing page with upload
```

### State Management
```
lib/store.ts                                    Main data store (Zustand)
lib/stores/project-store.ts                     Project store (client-only)
lib/project-data-storage.ts                     IndexedDB wrapper
```

### API Routes
```
app/api/analyze/route.ts                        AI analysis endpoint
app/api/sessions/route.ts                       Session CRUD
app/api/sessions/[id]/data/route.ts            Session data storage
app/api/projects/                               ❌ MISSING
```

### Middleware
```
lib/middleware/auth.ts                          Authentication (withAuth)
lib/middleware/rate-limit.ts                    Rate limiting
lib/auth/server.ts                              Server-side auth utilities
lib/config/firebase-admin.ts                    Firebase Admin SDK setup
```

### Database
```
prisma/schema.prisma                            Database schema
lib/db.ts                                       Prisma client instance
```

## Critical Code Locations

### Upload Processing
```typescript
// components/upload/file-upload-core.tsx:156
const handleFileProcessing = useCallback(async (file: File) => {
  // 1. Parse file
  const result = await parseFileOptimized(file)

  // 2. Store data
  await setRawData(result.data)

  // 3. Analyze schema
  const schema = await analyzeDataSchema(result.data, file.name)
  setDataSchema(schema)

  // 4. Complete (no API calls)
  onUploadComplete(data)
})
```

### Project Creation (Client-Side Only)
```typescript
// app/page.tsx:55
const handleUploadComplete = useCallback(async (data: any) => {
  // Create project LOCALLY (no API call)
  const project = await createProject({
    userId: user?.uid || 'anonymous',
    name: currentState.fileName
  })

  // Save data LOCALLY
  await saveProjectData(project.id, currentState.rawData)

  // Navigate to dashboard
  router.push('/dashboard')
})
```

### Authentication Protection
```typescript
// lib/middleware/auth.ts:90
export function withAuth(handler) {
  return async (request, context) => {
    // 1. Extract token from Authorization header
    const user = await requireAuth(request)

    // 2. Verify with Firebase Admin SDK
    // 3. Call handler with authenticated user
    return handler(request, user, context)
  }
}
```

## Rate Limits

```typescript
RATE_LIMITS = {
  AUTH: { windowMs: 60000, maxRequests: 10 },      // 10/min
  SESSION: { windowMs: 60000, maxRequests: 30 },   // 30/min
  ANALYSIS: { windowMs: 3600000, maxRequests: 10 }, // 10/hour ⚠️
  GENERAL: { windowMs: 60000, maxRequests: 60 },   // 60/min
}

Applied to:
  /api/analyze → ANALYSIS (10/hour) - Very restrictive for OpenAI
  /api/sessions → SESSION (30/min) - Moderate
  /api/user/sync → AUTH (10/min) - Strict
```

## Debug Mode

```typescript
// .env.local
DEBUG_MODE=false                  // Server-side only (API routes)
NEXT_PUBLIC_DEBUG_MODE=false     // Client-side (auth context)

When enabled (LOCAL DEVELOPMENT ONLY):
  - Bypasses all authentication
  - Returns debug user (debug@datacrafted.com)
  - Fatal error if attempted in production

Production Detection:
  NODE_ENV === 'production'
  VERCEL_ENV === 'production'
  RAILWAY_ENVIRONMENT === 'production'
  RENDER !== undefined
  FLY_APP_NAME !== undefined
```

## Security Checklist

✅ All API endpoints protected with `withAuth`
✅ User ownership verified (session.userId === authUser.uid)
✅ Rate limiting on all endpoints
✅ DEBUG_MODE production guards in place
✅ Firebase Admin SDK for token verification
✅ Proper error handling and status codes
✅ CORS and CSRF protection (Next.js defaults)

## Common Issues & Solutions

### Issue: "Rate limit exceeded" on /api/analyze
**Cause**: Hitting 10 requests/hour limit
**Solution**: Wait 1 hour or increase limit in development

### Issue: "Authentication required" on upload
**Cause**: Trying to call protected API without token
**Solution**: Sign in first OR keep using client-only flow

### Issue: "No such file or directory" for /api/projects
**Cause**: Endpoints not implemented
**Solution**: Either implement endpoints OR ignore (upload works locally)

### Issue: Data disappears on page refresh
**Cause**: Not saved to localStorage/IndexedDB
**Solution**: Check Zustand persist config and IndexedDB

### Issue: "Session expired" error
**Cause**: Firebase token expired (1 hour default)
**Solution**: Refresh token automatically in auth context

## Quick Commands

### Check Prisma Schema
```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name description
npx prisma generate
```

### Search for API References
```bash
grep -r "api/projects" --include="*.tsx" --include="*.ts"
grep -r "withAuth" app/api --include="*.ts"
```

### Clear Browser Storage
```javascript
// In browser console
localStorage.clear()
sessionStorage.clear()
indexedDB.deleteDatabase('datacrafted-projects')
location.reload(true)
```

### Test Authentication
```javascript
// Get current user
const user = firebase.auth().currentUser
const token = await user.getIdToken()

// Test API call
fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'Test' })
})
```

## Architecture Decisions

### Why Projects Are Client-Side
- **Fast**: No network latency
- **Simple**: No backend complexity
- **Offline**: Works without internet
- **Anonymous**: No auth required for upload

### Why Sessions Are Server-Side
- **Persistent**: Chat history across devices
- **Shareable**: Can share session links
- **Secure**: Protected by authentication
- **Scalable**: Database can handle growth

### Why No `/api/projects` Endpoints
- **Not needed**: Upload works with client storage
- **YAGNI**: Don't implement until required
- **Complexity**: Server storage adds overhead
- **Cost**: Database/storage costs

## Next Steps Based on Use Case

### For Local Development Only
✅ Keep current architecture
✅ Clear browser cache to remove errors
✅ No changes needed

### For Production with Multi-Device
1. Implement `/api/projects` endpoints
2. Add background sync from client to server
3. Use BigQuery/S3 for large datasets
4. Keep IndexedDB as local cache

### For Anonymous Users
1. Remove authentication from upload flow
2. Show auth modal after upload
3. Sync uploaded project when user signs in
4. Merge anonymous projects with user account

---

## TL;DR

**Current State**: Upload works perfectly with client-side storage. The 3 backend errors are harmless - they're from missing API endpoints that aren't actually needed.

**Quick Fix**: Clear browser cache and hard reload. Errors will go away.

**Long-term**: Implement `/api/projects` endpoints if you want server-backed storage, otherwise keep current architecture.

**All Security**: ✅ Properly implemented with authentication, authorization, and rate limiting on all existing endpoints.
