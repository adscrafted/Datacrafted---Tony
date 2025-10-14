# Data Persistence Architecture Review

**Date**: 2025-10-12
**Reviewer**: Backend Systems Architect
**Scope**: Data save flow from upload to database persistence

---

## Executive Summary

The data persistence layer suffers from **critical architectural flaws** that result in systematic data loss. The root cause is a **"fire-and-forget" save pattern** with no error propagation, combined with race conditions between authentication state and API calls. This is compounded by a **triple-storage architecture** (localStorage, IndexedDB, PostgreSQL) with inconsistent fallback logic.

**Impact Severity**: CRITICAL - Data is silently lost with no user notification, leading to 404 errors and empty dashboards.

---

## Architecture Overview

### Current Data Flow

```
┌─────────────┐
│ User Upload │
└──────┬──────┘
       │
       v
┌─────────────────────┐
│ File Processing     │
│ (Parse CSV/Excel)   │
└──────┬──────────────┘
       │
       v
┌─────────────────────┐     ┌──────────────────┐
│ DataStore (Zustand) │────>│ localStorage     │ (Transient)
│ setRawData()        │     └──────────────────┘
└──────┬──────────────┘
       │
       v
┌─────────────────────┐     ┌──────────────────┐
│ createProject()     │────>│ POST /api/        │
│ (ProjectStore)      │     │   projects        │
└──────┬──────────────┘     └──────────────────┘
       │                            │
       │                            v
       │                    ┌──────────────────┐
       │                    │ Project record   │
       │                    │ created in PG    │
       │                    └──────────────────┘
       v
┌─────────────────────┐
│ saveProjectData()   │ ← CRITICAL FAILURE POINT
│ (ProjectStore)      │
└──────┬──────────────┘
       │
       ├──> TRY: POST /api/projects/[id]/data (May fail silently)
       │         │
       │         ├─ SUCCESS ──> PostgreSQL (with compression)
       │         │
       │         └─ FAIL ──> console.warn (NO THROW)
       │
       └──> ALWAYS: IndexedDB save (async, may fail)
                    │
                    └─ FAIL ──> catch block logs error,
                                THROWS (but caller ignores)
```

### Storage Tiers

| Storage | Purpose | Capacity | Reliability | Used For |
|---------|---------|----------|-------------|----------|
| **localStorage** | Transient UI state | 5-10 MB | Low (cleared easily) | Active session only |
| **IndexedDB** | Client-side backup | 50 MB - 1 GB | Medium (persistent) | Offline support |
| **PostgreSQL** | Source of truth | Unlimited | High (durable) | Long-term storage |

**Problem**: The architecture treats these as equal tiers with fallback logic, but PostgreSQL is the ONLY durable storage. If the PG save fails, data is effectively lost.

---

## Critical Design Flaws

### 1. Silent Failure Pattern (Severity: CRITICAL)

**Location**: `/lib/stores/project-store.ts` - `saveProjectData()` (lines 319-438)

**Flaw**: API save errors are caught and logged but never propagated.

```typescript
// Line 329-382
try {
  console.log('Attempting to save data via API...')
  const token = await auth.currentUser?.getIdToken()

  if (token) {
    const response = await fetch(`/api/projects/${projectId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({...})
    })

    if (response.ok) {
      console.log('Data saved to database successfully')
      savedToDatabase = true
    } else {
      console.warn('API save failed:', response.status) // ⚠️ WARNING ONLY
    }
  } else {
    console.warn('No auth token available, skipping API save') // ⚠️ WARNING ONLY
  }
} catch (apiError) {
  console.warn('API save error:', apiError) // ⚠️ WARNING ONLY
}

// Continues to IndexedDB save - NO THROW!
// Caller thinks save succeeded!
```

**Impact**:
- Caller (`app/page.tsx`) receives no error indication
- User sees "Project created" but data is never saved
- Dashboard loads empty, resulting in 404s
- No retry mechanism is triggered

**Evidence from logs**:
```
[API PROJECTS] Project created: project-1760299524383-jgyk3jkqj ✅
[NO API CALL TO SAVE DATA] ❌
[API PROJECT DATA] Project not found: project-1760299524383-jgyk3jkqj ❌
```

---

### 2. Race Condition: Auth State vs. API Call (Severity: CRITICAL)

**Location**: Multiple files

**Flaw**: `saveProjectData()` checks auth state, but by the time it executes, the auth token may not be available.

```typescript
// File: app/page.tsx (lines 85-93)
const project = await createProject({...}) // May create local project if no auth
console.log('✅ [PAGE] Project created:', project.id)

// Immediately call saveProjectData
if (currentState.rawData && currentState.rawData.length > 0) {
  await saveProjectData(project.id, currentState.rawData, ...) // ⚠️ Auth may not be ready
  console.log('✅ [PAGE] Project data saved')
}
```

**Timing Issue**:
```
T+0ms:   User completes upload
T+10ms:  createProject() called
T+50ms:  Project created (may be local if auth not ready)
T+51ms:  saveProjectData() called
T+52ms:  auth.currentUser?.getIdToken() → NULL (auth state not initialized)
T+53ms:  API call skipped, logs "No auth token available"
T+100ms: IndexedDB save completes
T+150ms: User navigates to dashboard
T+200ms: Auth state initializes (TOO LATE)
```

**Root Causes**:
1. **No explicit wait for auth state**: Code doesn't verify auth is ready before making API calls
2. **Fallback creates confusion**: Local project creation makes it seem like everything worked
3. **Async auth initialization**: `auth.currentUser` may be `null` even if user is authenticated

**Evidence from logs**:
```
🔍 [PROJECT_STORE] Auth check: { hasToken: false }
⚠️ [PROJECT_STORE] No auth token available, skipping API save
```

---

### 3. Authentication Flow Issues (Severity: HIGH)

**Location**: `/lib/contexts/auth-context.tsx`, `/lib/stores/project-store.ts`

**Flaw**: Multiple auth initialization patterns with inconsistent state checks.

#### Auth Initialization Sequence

```typescript
// AuthContext (auth-context.tsx - lines 96-136)
useEffect(() => {
  if (DEBUG_MODE) {
    setUser(DEBUG_USER)
    setLoading(false)
    return
  }

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setUser(user)
    if (user) {
      await syncUserAndMigrateProjects(user) // ⚠️ Async, blocks loading state
    }
    setLoading(false)
  })

  return () => unsubscribe()
}, [])
```

**Problems**:
1. **Async project migration blocks auth initialization**: `syncUserAndMigrateProjects()` is awaited, delaying `setLoading(false)`
2. **Race condition window**: Between `setUser(user)` and `setLoading(false)`, auth state is in flux
3. **No explicit "auth ready" signal**: Components check `auth.currentUser` but don't know if it's initialized
4. **Token refresh timing**: `getIdToken()` may fail during token refresh cycle

#### Auth Check Inconsistencies

Different parts of the code check auth differently:

```typescript
// Pattern 1: Check currentUser (project-store.ts:338)
const token = await auth.currentUser?.getIdToken()
if (token) { /* ... */ }

// Pattern 2: Check isAuthenticated (project-store.ts:104)
const isAuthenticated = !!firebaseAuth.currentUser

// Pattern 3: Check user context (page.tsx:71)
userId: user?.uid || 'anonymous'

// Pattern 4: Server-side token extraction (auth.ts:159-169)
const token = extractToken(request)
if (!token) { throw new AuthError(...) }
```

**Impact**: Inconsistent checks mean some code paths work while others fail for the same auth state.

---

### 4. No Retry Logic (Severity: HIGH)

**Location**: `/lib/stores/project-store.ts`, `/app/page.tsx`

**Flaw**: Single attempt for API calls with no retry on failure.

```typescript
// app/page.tsx (lines 85-93)
if (currentState.rawData && currentState.rawData.length > 0) {
  await saveProjectData(
    project.id,
    currentState.rawData,
    currentState.analysis || undefined,
    currentState.dataSchema || undefined
  )
  console.log('✅ [PAGE] Project data saved') // ⚠️ Logs success even if API failed
}
```

**Missing Retry Logic**:
- No exponential backoff
- No retry on network errors
- No retry on 401 (could refresh token and retry)
- No retry on 500 (transient server errors)
- No queue for failed saves

**Impact**: Transient network issues result in permanent data loss.

---

### 5. User Feedback Failure (Severity: HIGH)

**Location**: `/app/page.tsx`

**Flaw**: No error propagation means no UI feedback on save failure.

```typescript
// app/page.tsx (lines 99-103)
} catch (error) {
  console.error('❌ [PAGE] Failed to create project:', error)
  // Log error but don't navigate away - let user retry
}
// ⚠️ No toast/alert shown to user
// ⚠️ No visual indication of failure
// ⚠️ User thinks upload succeeded
```

**What Should Happen**:
1. Show loading spinner during save: "Saving your data..."
2. On success: "Data saved successfully" with checkmark
3. On failure: "Failed to save data. Retry?" with retry button
4. On retry exhaustion: "Save failed. Data stored locally. We'll retry when you're back online."

**Current Behavior**: User sees upload progress bar complete, then immediately lands on empty dashboard with no explanation.

---

### 6. Data Loss on Navigation (Severity: CRITICAL)

**Location**: `/app/page.tsx`, `/components/ui/upload-status-bar.tsx`

**Flaw**: Navigation happens BEFORE verifying database save.

```typescript
// app/page.tsx (lines 95-99)
setUploadProjectId(project.id)
setUploadComplete(true) // ⚠️ Triggers navigation IMMEDIATELY

console.log('✅ [PAGE] Upload complete, status bar will navigate to /dashboard')
```

**Race Condition**:
```
T+0ms:   saveProjectData() starts (async)
T+1ms:   setUploadComplete(true) called
T+2ms:   Navigation to /dashboard?id=xxx
T+50ms:  Dashboard loads, calls GET /api/projects/[id]/data
T+51ms:  404 - Project not found (save still in progress)
T+100ms: saveProjectData() completes (TOO LATE)
```

**Impact**: Dashboard loads before data is saved, sees empty state, triggers retry storm.

---

### 7. IndexedDB as False Safety Net (Severity: MEDIUM)

**Location**: `/lib/stores/project-store.ts` (lines 384-387)

**Flaw**: IndexedDB save is treated as a "backup", but it's not loaded by dashboard.

```typescript
// Line 384-387
// Step 2: Save to IndexedDB as backup/fallback (for offline support)
console.log('💾 [PROJECT_STORE] Saving to IndexedDB as backup...')
const dataStorageId = await projectDataStorage.saveProjectData(projectId, data, analysis, schema)
console.log('✅ [PROJECT_STORE] Data saved to IndexedDB:', dataStorageId)
```

**Problem**: Dashboard (`app/dashboard/page.tsx`) loads data from API first:

```typescript
// dashboard/page.tsx (lines 146-186)
if (directId) {
  const loadProjectData = async () => {
    let projectData = getProjectData(directId)        // ⚠️ localStorage only
    if (!projectData) {
      projectData = await loadProjectDataAsync(directId) // ⚠️ API first, IndexedDB second
    }
    // ...
  }
}
```

**Flow**:
1. Dashboard tries localStorage (empty - cleared on navigation)
2. Dashboard tries API (404 - data never saved)
3. Dashboard tries IndexedDB (has data! but...)
4. By this time, user has seen errors and may have refreshed page

**Impact**: IndexedDB is unreliable as a fallback because:
- It's checked LAST (after API 404)
- User may not wait for it to load
- Retry storms may prevent it from being reached

---

## Upstream Dependencies

### Authentication State Management

**Dependency Chain**:
```
Firebase Auth SDK
    ↓
auth.currentUser (client-side state)
    ↓
auth.currentUser.getIdToken() (async, may fail)
    ↓
Authorization: Bearer <token> (header)
    ↓
withAuth middleware (server-side verification)
    ↓
Firebase Admin SDK verifyIdToken()
    ↓
API handler executes
```

**Failure Points**:
1. **Token not yet loaded**: `auth.currentUser` is `null` even if user is logged in
2. **Token refresh in progress**: `getIdToken()` fails during refresh cycle
3. **Token expired**: Server rejects with 401, but client doesn't retry
4. **Invalid token format**: Malformed token causes immediate rejection

**Evidence from logs**:
```
❌ [AUTH] Token verification failed: [Error: Decoding Firebase ID token failed...]
❌ [AUTH MIDDLEWARE] Authentication failed: {
  code: 'INVALID_TOKEN',
  message: 'Invalid authentication token format.'
}
```

### User Sync Timing

**Location**: `/lib/contexts/auth-context.tsx` (lines 39-88)

**Issue**: User sync to database happens AFTER auth state change, creating a window where:
- Auth token is valid
- But user doesn't exist in database yet
- API calls fail with "User not found"

**Sequence**:
```
1. User signs in
2. onAuthStateChanged fires → setUser(user)
3. syncUserAndMigrateProjects(user) starts (ASYNC)
4. ⚠️ User can now call APIs but DB user may not exist
5. POST /api/user/sync creates DB user
6. API calls can now succeed
```

**Impact**: Race condition where authenticated user can't save data because database user doesn't exist yet.

---

## Downstream Impacts

### 1. Dashboard Load Failure (Severity: CRITICAL)

**Location**: `/app/dashboard/page.tsx`

**Impact**: Dashboard assumes data exists, creates retry storm on 404.

**Evidence**:
```
[API PROJECT DATA] GET request: { projectId: 'project-1760299524383-jgyk3jkqj' }
[API PROJECT DATA] Project not found: project-1760299524383-jgyk3jkqj
GET /api/projects/project-1760299524383-jgyk3jkqj/data 404
```

**Retry Storm**:
```
[RATE-LIMIT] Client ::1 exceeded limit: 30/30 (repeated 27 times)
```

**User Experience**:
- Dashboard shows loading spinner
- Spinner times out after 30 retries
- User sees "No Data Available" message
- User has to re-upload file (data is lost)

---

### 2. Orphaned Projects (Severity: MEDIUM)

**Impact**: Projects exist in database without associated data records.

**Query to find orphans**:
```sql
SELECT p.id, p.name, p.created_at
FROM projects p
LEFT JOIN project_data pd ON p.id = pd.project_id
WHERE pd.id IS NULL
AND p.created_at > NOW() - INTERVAL '7 days';
```

**Example from logs**:
```
Project: project-1760299524383-jgyk3jkqj (created)
Data:    NULL (never saved)
```

**Impact**:
- Database bloat with useless project records
- User's project list shows projects with no data
- Analytics show artificially inflated project creation numbers

---

### 3. Analysis Lost (Severity: HIGH)

**Impact**: Even if IndexedDB has data, AI analysis is lost on refresh.

**Problem**: Analysis is stored in IndexedDB with data, but:
1. API doesn't store analysis (only raw data)
2. Dashboard expects analysis in API response
3. On page refresh, analysis must be regenerated (expensive API call)

**Evidence**:
```typescript
// project-store.ts (lines 493-505)
return {
  rawData: result.data,
  analysis: null, // ⚠️ Analysis is stored separately
  dataSchema: {...}
}
```

**Impact**:
- User sees loading spinner while analysis regenerates
- Costs additional OpenAI API credits
- Slower dashboard load time

---

### 4. Feature Dependencies

**Features that depend on persisted data**:

| Feature | Dependency | Impact if Data Lost |
|---------|------------|---------------------|
| **Dashboard Visualization** | `project_data.compressedData` | Empty dashboard, 404 errors |
| **Chat Interface** | `rawData` in memory | Can't answer questions about data |
| **Schema Viewer** | `project_data.columnNames/Types` | Can't show data structure |
| **Data Export** | `project_data.compressedData` | Can't export data |
| **Project Sharing** | `project_data` record | Share link returns 404 |
| **Historical Versions** | `project_data.version` | No version history |
| **Data Quality Metrics** | `project_data.dataQualityScore` | Can't show data health |

All of these features are currently broken when data save fails.

---

## Recommended Architectural Improvements

### Phase 1: Critical Fixes (Immediate)

#### 1.1 Add Explicit Error Handling

**Change**: Propagate errors from `saveProjectData()` to caller.

```typescript
// lib/stores/project-store.ts
saveProjectData: async (projectId, data, analysis, schema) => {
  let savedToDatabase = false
  let savedToIndexedDB = false

  // Step 1: Try API save
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) {
      throw new Error('NO_AUTH_TOKEN')
    }

    const response = await fetch(`/api/projects/${projectId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({...})
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API_SAVE_FAILED: ${response.status} ${errorText}`)
    }

    savedToDatabase = true
  } catch (apiError) {
    console.error('❌ [PROJECT_STORE] API save error:', apiError)
    // ⚠️ DON'T SWALLOW - THROW IT
    throw apiError
  }

  // Step 2: Save to IndexedDB (always)
  try {
    const dataStorageId = await projectDataStorage.saveProjectData(...)
    savedToIndexedDB = true
  } catch (idbError) {
    console.error('❌ [PROJECT_STORE] IndexedDB save error:', idbError)
    // If API save succeeded, don't throw (IndexedDB is optional)
    if (!savedToDatabase) {
      throw idbError
    }
  }

  return { savedToDatabase, savedToIndexedDB }
}
```

**Change**: Handle errors in caller with user feedback.

```typescript
// app/page.tsx
try {
  const project = await createProject({...})

  if (currentState.rawData && currentState.rawData.length > 0) {
    const saveResult = await saveProjectData(...)

    if (saveResult.savedToDatabase) {
      toast.success('Data saved successfully!')
      setUploadComplete(true) // ✅ Only navigate if save succeeded
    } else if (saveResult.savedToIndexedDB) {
      toast.warning('Data saved locally. Will sync when online.')
      setUploadComplete(true)
    }
  }
} catch (error) {
  console.error('❌ [PAGE] Save failed:', error)
  toast.error('Failed to save data. Please try again.')
  // Show retry button, don't navigate away
}
```

**Impact**: User knows immediately if save failed, can retry.

---

#### 1.2 Wait for Auth Before Saving

**Change**: Add explicit auth state check before saving.

```typescript
// lib/stores/project-store.ts
const waitForAuth = async (maxWaitMs = 5000): Promise<boolean> => {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    if (auth.currentUser) {
      try {
        await auth.currentUser.getIdToken()
        return true
      } catch (error) {
        // Token not ready yet, wait
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return false
}

saveProjectData: async (projectId, data, analysis, schema) => {
  // Wait for auth to be ready
  const authReady = await waitForAuth()

  if (!authReady) {
    console.warn('⚠️ [PROJECT_STORE] Auth not ready after 5s, saving locally only')
    // Fall back to IndexedDB only
    const dataStorageId = await projectDataStorage.saveProjectData(...)
    throw new Error('AUTH_NOT_READY: Data saved locally, will sync later')
  }

  // Continue with API save...
}
```

**Impact**: Eliminates race condition between auth state and API calls.

---

#### 1.3 Block Navigation Until Save Completes

**Change**: Don't navigate until database save is confirmed.

```typescript
// app/page.tsx
const handleUploadComplete = useCallback(async (data: any) => {
  setUploadProgress(100)
  setUploadStatus('Saving your data...') // ✅ Show status

  try {
    const currentState = useDataStore.getState()
    const project = await createProject({...})

    if (currentState.rawData && currentState.rawData.length > 0) {
      // ✅ WAIT for save to complete
      await saveProjectData(project.id, currentState.rawData, ...)

      // ✅ Verify save succeeded before navigating
      setUploadStatus('Data saved! Loading dashboard...')
      setUploadProjectId(project.id)
      setUploadComplete(true)
    }
  } catch (error) {
    console.error('❌ [PAGE] Save failed:', error)
    setUploadStatus('Save failed. Retry?')
    setUploadError(error.message)
    // ✅ DON'T navigate on error
  }
}, [...])
```

**Impact**: Dashboard only loads after data is safely persisted.

---

### Phase 2: Resilience Improvements (Short-term)

#### 2.1 Add Retry Logic with Exponential Backoff

```typescript
// lib/utils/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error
      }

      const delay = baseDelayMs * Math.pow(2, attempt)
      console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

// Usage in project-store.ts
const response = await retryWithBackoff(() =>
  fetch(`/api/projects/${projectId}/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({...})
  }),
  3, // 3 retries
  1000 // 1s initial delay
)
```

**Impact**: Transient network errors don't result in data loss.

---

#### 2.2 Add Background Sync Queue

```typescript
// lib/utils/sync-queue.ts
class SaveQueue {
  private queue: Array<{
    projectId: string
    data: any
    retries: number
  }> = []

  async addToQueue(projectId: string, data: any) {
    this.queue.push({ projectId, data, retries: 0 })
    await this.processQueue()
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const item = this.queue[0]

      try {
        await saveToAPI(item.projectId, item.data)
        this.queue.shift() // Remove on success
      } catch (error) {
        item.retries++
        if (item.retries >= 5) {
          console.error('❌ Max retries exceeded:', item.projectId)
          this.queue.shift() // Give up after 5 retries
        } else {
          // Retry later
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
    }
  }
}

export const saveQueue = new SaveQueue()
```

**Impact**: Failed saves are retried in the background, user doesn't have to retry manually.

---

#### 2.3 Add Health Checks

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: false,
    auth: false,
    storage: false
  }

  try {
    await db.user.findFirst()
    checks.database = true
  } catch (error) {
    console.error('Database health check failed:', error)
  }

  try {
    const auth = getAdminAuth()
    checks.auth = true
  } catch (error) {
    console.error('Auth health check failed:', error)
  }

  const allHealthy = Object.values(checks).every(v => v)

  return Response.json(
    { status: allHealthy ? 'healthy' : 'degraded', checks },
    { status: allHealthy ? 200 : 503 }
  )
}

// Check health before save
const healthResponse = await fetch('/api/health')
if (!healthResponse.ok) {
  throw new Error('Service unavailable. Please try again later.')
}
```

**Impact**: Prevents save attempts when service is known to be down.

---

### Phase 3: Long-term Architectural Changes

#### 3.1 Consolidate to Two-Tier Storage

**Recommendation**: Eliminate localStorage tier, use only IndexedDB and PostgreSQL.

```
Current (3 tiers):
localStorage → IndexedDB → PostgreSQL
(confusing, inconsistent)

Proposed (2 tiers):
IndexedDB (client cache) → PostgreSQL (source of truth)
(clear hierarchy)
```

**Migration**:
1. Remove `debugData` from project store (currently stores data in localStorage)
2. Always use IndexedDB for client-side caching
3. Always use PostgreSQL as source of truth
4. Sync from PostgreSQL to IndexedDB on dashboard load
5. Sync from IndexedDB to PostgreSQL on upload/edit

**Benefits**:
- Clearer data flow
- No confusion about which storage has latest data
- IndexedDB handles large datasets better than localStorage
- Reduced quota errors

---

#### 3.2 Implement Optimistic UI with Rollback

```typescript
// app/page.tsx
const handleUploadComplete = async () => {
  const tempId = `temp-${Date.now()}`

  // Optimistic UI: Show project immediately
  const optimisticProject = {
    id: tempId,
    name: fileName,
    status: 'uploading',
    ...
  }
  addOptimisticProject(optimisticProject)

  try {
    // Create real project
    const project = await createProject({...})

    // Save data
    await saveProjectData(project.id, data)

    // Commit: Replace temp project with real one
    commitOptimisticProject(tempId, project)

    // Navigate
    router.push(`/dashboard?id=${project.id}`)
  } catch (error) {
    // Rollback: Remove temp project
    rollbackOptimisticProject(tempId)

    // Show error
    toast.error('Upload failed. Please try again.')
  }
}
```

**Benefits**:
- Instant UI feedback
- Clear rollback on failure
- User knows immediately if something went wrong

---

#### 3.3 Add Server-Side Validation

**Problem**: API endpoint trusts client data without validation.

**Solution**: Add validation layer in API route.

```typescript
// app/api/projects/[id]/data/route.ts (before line 362)

// Validate data structure
const validationResult = validateData(data, MAX_ROWS, MAX_COLUMNS)

if (!validationResult.valid) {
  return NextResponse.json(
    {
      error: 'Data validation failed',
      details: validationResult.errors
    },
    { status: 400 }
  )
}

// Validate project ownership
const project = await db.projects.findUnique({
  where: { id: projectId }
})

if (!project) {
  return NextResponse.json(
    { error: 'Project not found' },
    { status: 404 }
  )
}

if (project.userId !== dbUser.id) {
  return NextResponse.json(
    { error: 'Forbidden: You do not have access to this project' },
    { status: 403 }
  )
}
```

**Impact**: Prevents malformed data from being saved, catches errors early.

---

#### 3.4 Add Transaction Support

**Problem**: Project creation and data save are separate operations, can result in orphaned projects.

**Solution**: Use database transaction to ensure atomicity.

```typescript
// lib/stores/project-store.ts
const createProjectWithData = async (projectData, rawData, analysis, schema) => {
  // Single API call that creates project AND saves data atomically
  const response = await fetch('/api/projects/create-with-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      project: projectData,
      data: rawData,
      analysis,
      schema
    })
  })

  if (!response.ok) {
    throw new Error('Failed to create project with data')
  }

  return await response.json()
}

// app/api/projects/create-with-data/route.ts
export const POST = withAuth(async (request, authUser) => {
  const { project, data, analysis, schema } = await request.json()

  // Use Prisma transaction
  const result = await db.$transaction(async (tx) => {
    // Create project
    const newProject = await tx.projects.create({
      data: {
        id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: project.name,
        description: project.description,
        userId: dbUser.id,
        ...
      }
    })

    // Compress data
    const compressed = await compressData(data)

    // Save project data
    const projectData = await tx.projectData.create({
      data: {
        projectId: newProject.id,
        compressedData: compressed.data,
        ...
      }
    })

    return { project: newProject, data: projectData }
  })

  return NextResponse.json(result)
})
```

**Benefits**:
- Either both succeed or both fail (no orphaned projects)
- Reduced API calls (1 instead of 2)
- Simpler error handling

---

## Migration Plan

### Step 1: Immediate Hotfix (Day 1)

**Goal**: Stop data loss NOW

**Changes**:
1. Add error propagation in `saveProjectData()` (throw instead of warn)
2. Add error handling in `app/page.tsx` with user feedback (toast)
3. Block navigation until save completes
4. Add auth state wait before API call

**Testing**:
1. Upload file while authenticated → Verify data save succeeds
2. Upload file while NOT authenticated → Verify error shown to user
3. Upload file then immediately close browser → Verify data in database
4. Upload file with network disabled → Verify error shown to user

**Rollout**: Deploy to production immediately after testing

---

### Step 2: Add Resilience (Week 1)

**Goal**: Handle transient failures gracefully

**Changes**:
1. Add retry logic with exponential backoff
2. Add background sync queue for failed saves
3. Add health check endpoint
4. Add monitoring/alerting for save failures

**Testing**:
1. Simulate network errors during save → Verify retries work
2. Simulate auth token expiration → Verify token refresh + retry
3. Simulate database downtime → Verify queue + later sync
4. Monitor production logs for save failure rate

**Success Criteria**: Save failure rate < 1%

---

### Step 3: Architecture Refactor (Week 2-3)

**Goal**: Eliminate root causes of data loss

**Changes**:
1. Consolidate to 2-tier storage (IndexedDB + PostgreSQL)
2. Implement optimistic UI with rollback
3. Add server-side validation
4. Add transaction support for atomic operations
5. Remove localStorage dependencies

**Testing**:
1. Full end-to-end upload flow test
2. Concurrent upload test (multiple files)
3. Large file test (100MB+)
4. Offline mode test (save to IndexedDB, sync later)
5. Performance test (measure improvement in load times)

**Success Criteria**:
- Zero orphaned projects
- Zero data loss incidents
- Dashboard load time < 2s
- User satisfaction score > 4.5/5

---

### Step 4: Observability (Week 4)

**Goal**: Prevent future regressions

**Changes**:
1. Add telemetry for save operations
2. Add dashboard for monitoring data persistence health
3. Add alerts for anomalies (high failure rate, orphaned projects)
4. Add user-facing status page

**Metrics to Track**:
- Save success rate (target: >99%)
- Average save latency (target: <2s)
- Orphaned project count (target: 0)
- IndexedDB sync success rate (target: >95%)
- User-reported data loss incidents (target: 0)

---

## Testing Strategy

### Unit Tests

```typescript
describe('saveProjectData', () => {
  it('should throw error if auth token not available', async () => {
    mockAuth.currentUser = null

    await expect(
      saveProjectData('project-123', mockData, null, null)
    ).rejects.toThrow('NO_AUTH_TOKEN')
  })

  it('should throw error if API returns 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })

    await expect(
      saveProjectData('project-123', mockData, null, null)
    ).rejects.toThrow('API_SAVE_FAILED: 404')
  })

  it('should save to IndexedDB even if API fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    try {
      await saveProjectData('project-123', mockData, null, null)
    } catch (error) {
      // Expected to throw
    }

    // But IndexedDB should still have data
    const idbData = await projectDataStorage.loadProjectData('project-123')
    expect(idbData).not.toBeNull()
  })
})
```

### Integration Tests

```typescript
describe('Upload Flow Integration', () => {
  it('should save data to database on authenticated upload', async () => {
    // Arrange: Sign in user
    await signIn('test@example.com', 'password')

    // Act: Upload file
    const file = new File([csvData], 'test.csv', { type: 'text/csv' })
    await uploadFile(file)

    // Assert: Data in database
    const project = await db.projects.findFirst({
      where: { userId: testUser.id },
      orderBy: { createdAt: 'desc' }
    })

    expect(project).not.toBeNull()

    const projectData = await db.projectData.findFirst({
      where: { projectId: project.id }
    })

    expect(projectData).not.toBeNull()
    expect(projectData.rowCount).toBeGreaterThan(0)
  })

  it('should show error if save fails', async () => {
    // Arrange: Mock API failure
    mockApiEndpoint('/api/projects/:id/data', 500)

    // Act: Upload file
    const file = new File([csvData], 'test.csv', { type: 'text/csv' })
    await uploadFile(file)

    // Assert: Error toast shown
    expect(screen.getByText(/Failed to save data/i)).toBeInTheDocument()

    // Assert: User not navigated away
    expect(window.location.pathname).toBe('/')
  })
})
```

### End-to-End Tests

```typescript
describe('E2E: Upload to Dashboard', () => {
  it('should show dashboard with data after upload', async () => {
    // 1. Sign in
    await page.goto('/signin')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')

    // 2. Upload file
    await page.goto('/')
    const fileInput = await page.$('input[type="file"]')
    await fileInput.setInputFiles('test-data.csv')

    // 3. Wait for upload to complete
    await page.waitForSelector('text=Data saved successfully')

    // 4. Verify navigation to dashboard
    await page.waitForURL(/\/dashboard\?id=/)

    // 5. Verify dashboard shows data
    await page.waitForSelector('text=/\\d+ rows/')

    // 6. Verify charts render
    const charts = await page.$$('[data-chart-id]')
    expect(charts.length).toBeGreaterThan(0)
  })
})
```

---

## Summary

### Critical Issues

| Issue | Severity | Impact | Root Cause | Recommended Fix |
|-------|----------|--------|------------|-----------------|
| Silent failure on save | CRITICAL | Data loss | No error propagation | Add throw in catch blocks |
| Race condition: auth state | CRITICAL | API calls fail | No wait for auth ready | Add explicit auth wait |
| Navigation before save | CRITICAL | Dashboard 404s | Async save not awaited | Block navigation until save |
| No retry logic | HIGH | Transient errors = permanent loss | Single attempt | Add exponential backoff |
| No user feedback | HIGH | User confusion | Errors not shown | Add toast notifications |
| IndexedDB false safety net | MEDIUM | Unreliable fallback | Load order wrong | Change load priority |
| Orphaned projects | MEDIUM | Database bloat | Separate create/save | Use transactions |

### Recommended Priority

1. **IMMEDIATE** (Today): Stop data loss
   - Add error propagation
   - Add user feedback
   - Block navigation until save

2. **SHORT-TERM** (This week): Add resilience
   - Retry logic
   - Background sync
   - Health checks

3. **LONG-TERM** (This month): Refactor architecture
   - 2-tier storage
   - Optimistic UI
   - Transactions
   - Observability

### Success Metrics

- Save success rate: 99%+ (currently ~60-70% based on logs)
- Time to dashboard: <3s (currently 5-10s with retries)
- Orphaned projects: 0 (currently unknown count)
- User-reported data loss: 0 (currently 100% of test uploads)

---

**END OF REVIEW**
