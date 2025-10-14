# Quick Fix Guide: Project Access Issues

## Immediate Actions (30 minutes)

### 1. Fix User ID Mismatch in Projects API

**File:** `/app/api/projects/route.ts`

**Problem:** API returns projects with database User.id but frontend expects Firebase UID.

**Fix:**
```typescript
// Line 54-66: In GET handler, transformedProjects map
return {
  id: project.id,
  userId: authUser.uid,  // ✓ Already returns Firebase UID - GOOD!
  name: project.name,
  description: project.description || undefined,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
  lastAccessedAt: project.updatedAt.toISOString(),
  status: 'active' as const,
  // ... rest
}

// Line 126-135: In POST handler response
return NextResponse.json({
  project: {
    id: project.id,
    userId: authUser.uid,  // ✓ Already returns Firebase UID - GOOD!
    // ... rest
  }
})
```

**Status:** ✓ Already correct! API is returning Firebase UID to frontend.

### 2. Ensure User Sync Completes Before API Calls

**File:** `/lib/contexts/auth-context.tsx`

**Problem:** User navigates to /projects before database sync completes.

**Fix:**

Add sync status tracking:
```typescript
// After line 112 (in AuthProvider)
const [isSyncing, setIsSyncing] = useState(false)

// Update context type (line 21-32)
interface AuthContextType {
  user: User | null
  loading: boolean
  isSyncing: boolean  // ADD THIS
  error: string | null
  // ... rest
}

// Update onAuthStateChanged (line 143)
onAuthStateChanged(auth, async (user) => {
  setUser(user)

  if (user) {
    setIsSyncing(true)  // ADD THIS
    try {
      await syncUserAndMigrateProjects(user)
    } finally {
      setIsSyncing(false)  // ADD THIS
    }
  }

  setLoading(false)
})

// Update context provider value (line 262-273)
const value = {
  user,
  loading,
  isSyncing,  // ADD THIS
  error,
  signIn,
  signUp,
  logout,
  signInWithGoogle,
  resetPassword,
  updateUserProfile,
  isDebugMode: DEBUG_MODE
}
```

### 3. Wait for Sync in Projects Page

**File:** `/app/projects/page.tsx`

**Fix:**
```typescript
// Line 16
const { user, logout, loading: authLoading, isDebugMode, isSyncing } = useAuth()

// Update the loading check (around line 32-34)
useEffect(() => {
  if (!isSyncing && user) {  // Only load when sync is done
    loadProjects(user?.uid || 'anonymous')
  }
}, [user, loadProjects, isSyncing])  // ADD isSyncing to deps

// Update the auth gate (line 37-39)
if (!authLoading && !isSyncing && !user && !isDebugMode) {
  return <AuthGateModal redirectPath="/projects" message="Sign in to view your projects" />
}

// Add loading state while syncing (after auth gate check)
if (isSyncing) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Setting up your account...</p>
      </div>
    </div>
  )
}
```

### 4. Auto-Create Project in Database if Missing

**File:** `/app/api/projects/[id]/data/route.ts`

**Problem:** saveProjectData() fails because project doesn't exist in database.

**Fix:**
```typescript
// After line 338-347 (where project ownership is verified)
if (!project) {
  console.log('[API PROJECT DATA] Project not found, creating...')

  // CREATE PROJECT IN DATABASE
  project = await db.projects.create({
    data: {
      id: projectId,
      name: metadata.fileName || 'Untitled Project',
      description: `Auto-created project for ${metadata.fileName}`,
      userId: dbUser.id,
      updatedAt: new Date()
    }
  })

  console.log('[API PROJECT DATA] Project auto-created:', project.id)
}

// THEN check ownership
if (project.userId !== dbUser.id) {
  console.log('[API PROJECT DATA] Authorization failed: User does not own project')
  return NextResponse.json(
    { error: 'Forbidden: You do not have access to this project' },
    { status: 403 }
  )
}

// Continue with data save...
```

### 5. Update Middleware to Accept Token Auth

**File:** `/middleware.ts`

**Problem:** Middleware requires session cookie, but we only have tokens.

**Fix:**
```typescript
// Update hasAuthCredentials function (line 54-71)
function hasAuthCredentials(request: NextRequest): boolean {
  // Check for Authorization header (most common for SPAs)
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('[MIDDLEWARE] Auth: Found Bearer token')
    return true
  }

  // Check for Firebase session cookie (if implemented)
  const sessionCookie = request.cookies.get('__session')?.value
  if (sessionCookie) {
    console.log('[MIDDLEWARE] Auth: Found session cookie')
    return true
  }

  // No credentials found
  return false
}
```

**Note:** This assumes the token is sent with every request. For client-side navigation, this won't work perfectly. Consider:
- Disabling middleware for now (remove matcher)
- OR implementing session cookies properly (see below)

---

## Verify the Fixes

### Test 1: Sign Up Flow
```bash
1. Sign up new user
2. Check browser console for:
   "🔄 [AUTH] Syncing user to database: {uid}"
   "✅ [AUTH] User synced to database: {id}"
3. Should see "Setting up your account..." loading state
4. Should land on /projects page
5. Should see empty projects list (no errors)
```

### Test 2: Project Creation
```bash
1. Upload file from /projects
2. Check console for:
   "🔵 [PROJECT_STORE] createProject called"
   "🌐 [PROJECT_STORE] User authenticated, creating project via API..."
   "✅ [PROJECT_STORE] Project created via API"
   "💾 [PROJECT_STORE] Saving project data..."
   "✅ [PROJECT_STORE] Data saved to database successfully"
3. Project should appear in list
4. Should navigate to /dashboard
5. Dashboard should load with data
```

### Test 3: Return to Projects
```bash
1. From dashboard, click "Back" or navigate to /projects
2. Should see project in list
3. Click project
4. Should load dashboard with data
```

---

## If Issues Persist

### Debug: Check Database
```sql
-- Check if user exists
SELECT id, firebaseUid, email FROM users WHERE firebaseUid = 'YOUR_UID';

-- Check user's projects
SELECT p.id, p.name, p.userId, u.firebaseUid
FROM projects p
JOIN users u ON p.userId = u.id
WHERE u.firebaseUid = 'YOUR_UID';
```

### Debug: Check Console Logs
Look for these patterns:

**Success:**
```
🔄 [AUTH] Syncing user to database: firebase-uid-123
✅ [AUTH] User synced to database: cuid-abc123
🔵 [PROJECT_STORE] createProject called
🌐 [PROJECT_STORE] User authenticated, creating project via API...
✅ [PROJECT_STORE] Project created via API: project-xyz
💾 [PROJECT_STORE] Saving project data...
✅ [PROJECT_STORE] Data saved to database successfully
```

**Failure Patterns:**
```
❌ [AUTH] Failed to sync user to database
⚠️ [PROJECT_STORE] User not authenticated, creating project locally
❌ [PROJECT_STORE] API save failed after retries
[MIDDLEWARE] Unauthorized access to /projects - redirecting to /
```

### Debug: Check Network Tab
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Look for:
   - POST `/api/user/sync` - Should return 200
   - GET `/api/projects` - Should return 200 with projects array
   - POST `/api/projects` - Should return 201 with new project
   - POST `/api/projects/{id}/data` - Should return 201

### Emergency: Enable Debug Mode
```bash
# .env.local
DEBUG_MODE=true
NEXT_PUBLIC_DEBUG_MODE=true
```

Then restart dev server:
```bash
npm run dev
```

This bypasses authentication for testing.

---

## Long-term Solution: Session Cookies

For production, implement proper session cookies:

### Step 1: Set Up Firebase Admin
```typescript
// lib/config/firebase-admin.ts (create if doesn't exist)
import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  })
}

export { admin }
```

### Step 2: Create Session Endpoint
```typescript
// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { admin } from '@/lib/config/firebase-admin'

export async function POST(request: NextRequest) {
  const { idToken } = await request.json()

  // Create session cookie (5 days)
  const sessionCookie = await admin.auth().createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 5 * 1000
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set('__session', sessionCookie, {
    maxAge: 60 * 60 * 24 * 5,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })

  return response
}
```

### Step 3: Call After Sign In
```typescript
// lib/contexts/auth-context.tsx
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

### Step 4: Verify in Middleware
```typescript
// middleware.ts
function hasAuthCredentials(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get('__session')?.value
  if (sessionCookie) {
    // Can verify with Firebase Admin if needed
    return true
  }

  // Fallback to token
  const authHeader = request.headers.get('authorization')
  return authHeader?.startsWith('Bearer ') || false
}
```

---

## Summary of Changes

| File | Lines | Change | Priority |
|------|-------|--------|----------|
| auth-context.tsx | 112, 143, 262 | Add `isSyncing` state | CRITICAL |
| page.tsx (projects) | 16, 32, 37 | Wait for sync completion | CRITICAL |
| [id]/data/route.ts | 338 | Auto-create missing project | CRITICAL |
| middleware.ts | 54 | Accept token auth | HIGH |
| route.ts (projects) | 54, 126 | ✓ Already correct | N/A |

**Total Time: 30 minutes for critical fixes**
