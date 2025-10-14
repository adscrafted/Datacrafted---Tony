# Project Creation Flow and Routing System Analysis

## Executive Summary

**Issue:** Authenticated users cannot access projects/dashboard after login.

**Root Cause:** Multi-layered authentication disconnect between Firebase auth state, database user records, and route protection middleware.

**Impact:** Users sign in successfully but get redirected away from protected routes or see empty project lists.

---

## How the System Currently Works

### 1. Project Creation Flow

#### **Landing Page Upload (app/page.tsx)**
```
User uploads file → handleUploadComplete() triggered
  ↓
createProject() called with userId (user?.uid || 'anonymous')
  ↓
saveProjectData() saves to IndexedDB + attempts database save
  ↓
Navigation to /dashboard?id={projectId}
```

#### **Projects Page Upload (app/projects/page.tsx)**
```
User clicks "New Project" → Upload file
  ↓
handleFileUpload() creates project
  ↓
Same flow as landing page
  ↓
Navigation to /dashboard?id={projectId}
```

### 2. Project Store Architecture (lib/stores/project-store.ts)

**Storage Hierarchy:**
1. **localStorage** (Zustand persist) - Project metadata only
2. **IndexedDB** (projectDataStorage) - Full data for large datasets
3. **PostgreSQL** (via API) - Persistent storage for authenticated users

**createProject() Logic:**
```typescript
if (!isAuthenticated) {
  // Create local project with generated ID
  id: `project-${Date.now()}-${Math.random()...}`
  userId: 'anonymous' or user.uid
  Store in localStorage only
} else {
  // Try API creation
  POST /api/projects with Firebase token

  if (API fails) {
    // Fallback to local creation
    Same as unauthenticated flow
  }
}
```

**saveProjectData() Logic:**
```typescript
1. Try database API (POST /api/projects/{id}/data)
   - Requires valid Firebase token
   - Requires user in database
   - Requires project ownership match

2. Fallback to IndexedDB
   - Always saves here as backup

3. Update project metadata in store
```

### 3. Authentication Flow (lib/contexts/auth-context.tsx)

```
User signs in/up → Firebase authentication
  ↓
onAuthStateChanged() triggered
  ↓
syncUserAndMigrateProjects() called:
  1. syncUserToDatabase(user) - Creates user record in Postgres
  2. Migrate anonymous projects to authenticated user
  3. syncLocalProjectsToDatabase() - Upload local projects to API
  ↓
Set user state in context
```

**User Sync (POST /api/user/sync):**
```typescript
Firebase user → Check if exists in Postgres by firebaseUid
  ↓
if (!exists) {
  Create new User record with:
  - firebaseUid: Firebase UID
  - email, name, photoURL from Firebase
  - Generates internal database ID (CUID)
}
```

### 4. Routing and Middleware System

#### **middleware.ts - Server-Side Route Protection**
```typescript
Protected routes: ['/dashboard', '/projects', '/account']

Request → Check if route is protected
  ↓
Check for authentication:
  1. __session cookie (Firebase session)
  2. Authorization header (Bearer token)
  ↓
if (hasAuth) {
  Allow access
} else if (DEBUG_MODE && NODE_ENV === 'development') {
  Allow with warning
} else {
  Redirect to / with auth_required=true
}
```

#### **Client-Side Auth Gates**
Both `/projects` and `/dashboard` have:
```typescript
if (!authLoading && !user && !isDebugMode) {
  return <AuthGateModal />
}
```

### 5. Database Schema (Prisma)

**User Model:**
```prisma
model User {
  id            String   @id @default(cuid())  // Database ID
  firebaseUid   String?  @unique              // Firebase UID
  email         String?  @unique
  projects      projects[]
}
```

**Projects Model:**
```prisma
model projects {
  id          String   @id                    // Can be custom or generated
  userId      String                          // References User.id (NOT firebaseUid!)
  users       User     @relation(...)
  projectData ProjectData[]
}
```

**ProjectData Model:**
```prisma
model ProjectData {
  id              String   @id @default(cuid())
  projectId       String                      // References projects.id
  compressedData  Bytes                       // Actual data storage
  project         projects @relation(...)
}
```

---

## Critical Disconnects Causing the Issue

### 1. **User ID Mismatch (CRITICAL)**

**The Problem:**
- Frontend uses: `user.uid` (Firebase UID)
- Projects API expects: Database `User.id` (CUID)
- Project store uses: `user.uid` for filtering

**Example Flow:**
```typescript
// Frontend creates project
createProject({ userId: 'firebase-uid-123' })

// API receives this but expects database ID
const project = await db.projects.create({
  userId: 'firebase-uid-123'  // WRONG! Should be database User.id
})

// Later, API tries to fetch projects
db.projects.findMany({
  where: { userId: dbUser.id }  // Uses database ID
})
// Returns projects with userId = database ID

// Frontend filters projects
projects.filter(p => p.userId === user.uid)  // Uses Firebase UID
// Returns projects with userId = Firebase UID

// Result: No projects match!
```

**Location in Code:**
- `/app/api/projects/route.ts:54` - Returns `authUser.uid` instead of `dbUser.id`
- `/app/api/projects/route.ts:126` - Returns `authUser.uid` instead of `dbUser.id`
- `/app/projects/page.tsx:115` - Filters by `user?.uid || 'anonymous'`
- `/lib/stores/project-store.ts:92-205` - Uses Firebase UID throughout

### 2. **User Sync Race Condition**

**The Problem:**
When user signs in:
1. Firebase authentication completes
2. User state updates in React context
3. `syncUserToDatabase()` is called **asynchronously**
4. User might navigate to `/projects` **before** database sync completes
5. API calls fail because user doesn't exist in database yet

**Evidence:**
```typescript
// auth-context.tsx:143-148
onAuthStateChanged(auth, async (user) => {
  setUser(user)  // User state set immediately

  if (user) {
    await syncUserAndMigrateProjects(user)  // Async, might not complete
  }

  setLoading(false)  // Loading done, UI proceeds
})
```

### 3. **Project API Authorization Failure**

**The Problem:**
`POST /api/projects/{id}/data` requires:
1. User authenticated (has token) ✓
2. User exists in database (synced) ✗ (race condition)
3. Project exists in database ✗ (never created)
4. User owns project ✗ (ID mismatch)

**What Happens:**
```typescript
// saveProjectData() in project-store.ts
try {
  await fetch(`/api/projects/${projectId}/data`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ data, metadata })
  })
  // This fails with 404 (user not found) or 403 (forbidden)
} catch (error) {
  console.error('API save failed')
  // Falls back to IndexedDB only
}
```

### 4. **Middleware Cookie Requirement**

**The Problem:**
Middleware checks for `__session` cookie, but:
- Firebase client SDK doesn't automatically set session cookies
- Session cookies require server-side Firebase Admin SDK setup
- Client-side auth only provides tokens, not cookies

**Current Check:**
```typescript
// middleware.ts:56-60
const sessionCookie = request.cookies.get('__session')?.value
if (sessionCookie) {
  return true
}
```

**Result:** Middleware redirects authenticated users because no session cookie exists.

### 5. **Local vs Database Project Confusion**

**The Problem:**
Projects can exist in three states:
1. **Local only** - Created without auth, stored in localStorage/IndexedDB
2. **Database only** - Fetched from API, might not have local data
3. **Both** - Synced between local and database

**Current Logic:**
```typescript
// loadProjects() tries to merge local and database projects
const mergedProjects = [
  ...fetchedProjects,
  ...localProjects.filter(p => !fetchedProjectsMap.has(p.id))
]
```

**Issue:** Local projects with Firebase UID don't match database projects with database User.id

---

## Why Dashboard/Projects Are Inaccessible

### Scenario A: User Signs In and Goes to /projects

1. ✓ Firebase authentication succeeds
2. ✓ User context updates with Firebase user
3. ⚠️ User sync to database starts (async)
4. ✓ Client-side auth gate passes (user exists)
5. ✓ Middleware allows access (has auth token)
6. ✗ `loadProjects()` calls `GET /api/projects`
7. ✗ API: "User not found in database" (sync not done)
8. ✗ Returns empty projects array
9. ✗ User sees "No projects yet"

### Scenario B: User Uploads File on Landing Page

1. ✓ User uploads file
2. ✓ `createProject()` called
3. ⚠️ If authenticated: API project creation
   - ✗ Might fail if user not synced yet
   - ✗ Falls back to local creation with Firebase UID
4. ⚠️ `saveProjectData()` called
   - ✗ API fails (user not in DB or project not found)
   - ✓ Falls back to IndexedDB
5. ✓ Navigates to `/dashboard?id={projectId}`
6. ✓ Dashboard loads project from IndexedDB
7. ✗ But project won't appear in `/projects` list (ID mismatch)

### Scenario C: Middleware Blocks Access

1. ✓ User signs in
2. ✓ Firebase auth state updates
3. ✗ No session cookie set (only token exists)
4. ✗ Middleware checks for `__session` cookie
5. ✗ Cookie check fails
6. ⚠️ Falls back to Authorization header check
7. ✓ Header exists (Bearer token)
8. ✓ Middleware allows access
9. **BUT:** If token is in localStorage, not sent with request
10. ✗ Middleware redirects to `/`

---

## Specific Code Fixes Needed

### Fix 1: Consistent User ID Usage

**Problem:** Mixed use of Firebase UID and database User ID

**Solution:** Always use Firebase UID in frontend, map to database ID in API

**Changes:**

#### `/app/api/projects/route.ts`
```typescript
// Current (WRONG):
const transformedProjects = projects.map(project => ({
  id: project.id,
  userId: authUser.uid,  // ← Inconsistent! Project has dbUser.id
  // ...
}))

// Fixed:
const transformedProjects = projects.map(project => ({
  id: project.id,
  userId: authUser.uid,  // Always return Firebase UID to frontend
  _dbUserId: project.userId,  // Keep database ID for reference
  // ...
}))

// Also update CREATE:
const project = await db.projects.create({
  data: {
    // ... other fields
    userId: dbUser.id,  // Use database User.id for FK relationship
  }
})

// Return with Firebase UID for frontend
return NextResponse.json({
  project: {
    id: project.id,
    userId: authUser.uid,  // Return Firebase UID
    // ...
  }
})
```

#### `/app/projects/page.tsx`
```typescript
// Filter projects by Firebase UID (already correct)
const activeProjects = projects.filter(p =>
  p.status === 'active' &&
  p.userId === (user?.uid || 'anonymous')
)
```

#### `/lib/stores/project-store.ts`
```typescript
// In loadProjects(), ensure consistent userId
set({ projects: mergedProjects.map(p => ({
  ...p,
  userId: authUser?.uid || p.userId  // Normalize to Firebase UID
})) })
```

### Fix 2: Ensure User Sync Completes Before Navigation

**Problem:** Race condition between user sync and navigation

**Solution:** Wait for sync to complete before allowing navigation

**Changes:**

#### `/lib/contexts/auth-context.tsx`
```typescript
// Add syncing state
const [isSyncing, setIsSyncing] = useState(false)

const AuthContext = createContext<AuthContextType>({
  // ...
  isSyncing: boolean
})

// Update auth state listener
onAuthStateChanged(auth, async (user) => {
  setUser(user)

  if (user) {
    setIsSyncing(true)
    try {
      await syncUserAndMigrateProjects(user)
    } finally {
      setIsSyncing(false)
    }
  }

  setLoading(false)
})

// Update sign in/up to wait for sync
const signIn = async (email: string, password: string) => {
  setError(null)
  await signInWithEmailAndPassword(auth, email, password)

  // Wait for sync to complete before navigating
  while (isSyncing) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  router.push('/projects')
}
```

#### `/app/projects/page.tsx`
```typescript
const { user, loading: authLoading, isSyncing } = useAuth()

// Show loading while syncing
if (authLoading || isSyncing) {
  return <LoadingState />
}
```

### Fix 3: Fix Project Data API Authorization

**Problem:** API fails when project doesn't exist in database

**Solution:** Create project in database if it doesn't exist (for local projects)

**Changes:**

#### `/app/api/projects/[id]/data/route.ts`
```typescript
// In POST handler, after authorization check:
const project = await db.projects.findUnique({
  where: { id: projectId }
})

if (!project) {
  console.log('[API PROJECT DATA] Project not in database, creating...')

  // Create project record in database
  await db.projects.create({
    data: {
      id: projectId,
      name: metadata.fileName || 'Untitled Project',
      description: 'Auto-created from data upload',
      userId: dbUser.id,
      updatedAt: new Date()
    }
  })
}

// Continue with data save...
```

### Fix 4: Implement Session Cookie for Middleware

**Problem:** Middleware can't verify authentication without session cookie

**Solution A (Quick):** Rely on Authorization header only

```typescript
// middleware.ts - Remove session cookie requirement
function hasAuthCredentials(request: NextRequest): boolean {
  // Check for Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return true
  }

  return false
}
```

**Solution B (Proper):** Set session cookie after Firebase auth

```typescript
// Add new API endpoint: /api/auth/session
// POST /api/auth/session
export async function POST(request: NextRequest) {
  const { idToken } = await request.json()

  // Verify token with Firebase Admin
  const decodedToken = await admin.auth().verifyIdToken(idToken)

  // Create session cookie (expires in 5 days)
  const sessionCookie = await admin.auth().createSessionCookie(idToken, {
    expiresIn: 5 * 24 * 60 * 60 * 1000
  })

  // Set cookie
  const response = NextResponse.json({ success: true })
  response.cookies.set('__session', sessionCookie, {
    maxAge: 5 * 24 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: 'lax'
  })

  return response
}

// Call this after Firebase sign in
// auth-context.tsx
const signIn = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password)
  const idToken = await result.user.getIdToken()

  // Set session cookie
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  })

  router.push('/projects')
}
```

### Fix 5: Improve Project Loading Logic

**Problem:** Projects don't appear after creation due to ID mismatch

**Solution:** Normalize project IDs and user IDs during load

**Changes:**

#### `/lib/stores/project-store.ts`
```typescript
loadProjects: async (userId) => {
  try {
    // Fetch from API
    const response = await fetch('/api/projects', {
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      const apiProjects = data.projects || []

      // Merge with local projects
      const localProjects = get().projects

      // Create a Set of API project IDs
      const apiProjectIds = new Set(apiProjects.map(p => p.id))

      // Keep local projects that aren't in API yet
      const localOnlyProjects = localProjects.filter(p =>
        !apiProjectIds.has(p.id) &&
        (p.userId === userId || p.userId === 'anonymous')
      )

      // Combine and normalize
      const allProjects = [
        ...apiProjects,
        ...localOnlyProjects
      ].map(p => ({
        ...p,
        userId: userId  // Normalize all to current user's Firebase UID
      }))

      set({ projects: allProjects })
    } else {
      // API failed, use local projects only
      const localProjects = get().projects.filter(p =>
        p.userId === userId || p.userId === 'anonymous'
      )
      set({ projects: localProjects })
    }
  } catch (error) {
    // Fallback to local
    console.error('Failed to load projects:', error)
  }
}
```

### Fix 6: Add Better Error Handling and Retry Logic

**Problem:** Silent failures make debugging difficult

**Solution:** Add explicit error states and retry mechanisms

**Changes:**

#### `/lib/stores/project-store.ts`
```typescript
interface ProjectStore {
  // ... existing fields
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  syncError: string | null

  retrySaveProjectData: (projectId: string) => Promise<void>
}

// Add retry function
retrySaveProjectData: async (projectId) => {
  const project = get().projects.find(p => p.id === projectId)
  if (!project || !project.dataStorageId) {
    throw new Error('Project not found or has no data')
  }

  // Load from IndexedDB
  const data = await projectDataStorage.loadProjectData(projectId)
  if (!data) {
    throw new Error('Project data not found')
  }

  // Retry save
  await get().saveProjectData(
    projectId,
    data.rawData,
    data.analysis,
    data.dataSchema
  )
}
```

---

## Recommended Implementation Order

### Phase 1: Critical Fixes (Do First)
1. **Fix User ID consistency** (Fix 1) - Ensures projects are visible
2. **Wait for user sync** (Fix 2) - Prevents race conditions
3. **Auto-create projects in DB** (Fix 3) - Allows data saving to work

### Phase 2: Middleware Improvements
4. **Update middleware auth check** (Fix 4, Solution A) - Quick win
5. **Test middleware with token-only auth** - Verify access works

### Phase 3: Long-term Robustness
6. **Implement session cookies** (Fix 4, Solution B) - Proper solution
7. **Improve project loading** (Fix 5) - Better merge logic
8. **Add error handling** (Fix 6) - Better UX

### Phase 4: Testing
9. Test authentication flow end-to-end
10. Test project creation flow
11. Test project loading and display
12. Test anonymous to authenticated migration

---

## Testing Checklist

### Authentication Flow
- [ ] User can sign up and is redirected to /projects
- [ ] User can sign in and is redirected to /projects
- [ ] User sees loading state during sync
- [ ] User record is created in database
- [ ] Anonymous projects are migrated to authenticated user

### Project Creation Flow
- [ ] User can upload file from landing page
- [ ] Project is created with correct userId
- [ ] Project data is saved to database
- [ ] Project appears in /projects list immediately
- [ ] User can navigate to dashboard
- [ ] Dashboard loads project data correctly

### Project Loading
- [ ] /projects shows all user's projects
- [ ] Projects are sorted by lastAccessedAt
- [ ] Local-only projects appear in list
- [ ] Database projects appear in list
- [ ] No duplicate projects in list

### Middleware and Routing
- [ ] Authenticated users can access /projects
- [ ] Authenticated users can access /dashboard
- [ ] Unauthenticated users are redirected from protected routes
- [ ] Debug mode works in development
- [ ] Debug mode is disabled in production

### Error Scenarios
- [ ] API failure falls back to IndexedDB
- [ ] Failed sync shows error message
- [ ] Retry mechanism works for failed saves
- [ ] User can continue working if API is down

---

## Architecture Recommendations

### Long-term Improvements

1. **Simplify User ID Mapping**
   - Store Firebase UID as primary key in database
   - Remove internal CUID generation
   - Use Firebase UID everywhere consistently

2. **Implement Queue-based Sync**
   - Add sync queue for failed operations
   - Retry failed syncs in background
   - Show sync status in UI

3. **Add Optimistic Updates**
   - Show project immediately in UI
   - Sync to database in background
   - Update UI when sync completes

4. **Implement Proper Session Management**
   - Use Firebase session cookies
   - Set up Firebase Admin SDK properly
   - Implement token refresh logic

5. **Add Database Indexes**
   ```sql
   CREATE INDEX idx_projects_user_id ON projects(userId);
   CREATE INDEX idx_projects_created_at ON projects(createdAt);
   CREATE INDEX idx_user_firebase_uid ON users(firebaseUid);
   ```

6. **Consider Service Architecture**
   - Separate user service
   - Separate project service
   - Shared authentication service
   - Message queue for async operations

---

## Quick Debug Commands

```bash
# Check if user exists in database
psql $DATABASE_URL -c "SELECT id, firebaseUid, email FROM users WHERE firebaseUid = 'YOUR_FIREBASE_UID';"

# Check projects for user
psql $DATABASE_URL -c "SELECT id, userId, name FROM projects WHERE userId IN (SELECT id FROM users WHERE firebaseUid = 'YOUR_FIREBASE_UID');"

# Check localStorage projects
# In browser console:
JSON.parse(localStorage.getItem('datacrafted-projects'))

# Check IndexedDB projects
# In browser console:
const request = indexedDB.open('project-data-storage');
request.onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction('projects', 'readonly');
  const store = tx.objectStore('projects');
  const getAll = store.getAll();
  getAll.onsuccess = () => console.log('Projects in IndexedDB:', getAll.result);
};
```

---

## Summary

The core issue is a **three-way disconnect** between:
1. **Firebase authentication** (provides Firebase UID)
2. **Database user records** (uses internal CUID as primary key)
3. **Frontend project store** (uses Firebase UID for filtering)

This causes:
- Projects created with Firebase UID don't match database queries using CUID
- User sync race conditions prevent API calls from working
- Middleware can't verify sessions without proper cookie setup
- Projects saved locally never sync to database successfully

**Primary Fix:** Ensure consistent use of Firebase UID throughout the stack, with proper mapping to database IDs only at the API boundary.

**Secondary Fix:** Wait for user sync to complete before allowing navigation to protected routes.

**Tertiary Fix:** Implement proper session cookie management for middleware authentication.
