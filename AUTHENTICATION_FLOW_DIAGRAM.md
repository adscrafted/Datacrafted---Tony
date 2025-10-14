# Authentication and Project Flow Diagrams

## Current Flow (Broken)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER SIGNS IN                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Firebase Authentication                                                     │
│  ✓ User authenticated with Firebase                                         │
│  ✓ User object created: { uid: "firebase-abc123", email: "user@email.com" } │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  React Context Update (auth-context.tsx)                                    │
│  ✓ setUser(firebaseUser)          ← User state set IMMEDIATELY             │
│  ✓ setLoading(false)               ← Loading done, UI can proceed          │
│  ⚠️  syncUserAndMigrateProjects()  ← Async function starts (doesn't wait!) │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
    ┌───────────────────────────────┐   ┌──────────────────────────────┐
    │  User Navigates to /projects  │   │  Background: User Sync       │
    │  (Happens IMMEDIATELY)        │   │  POST /api/user/sync         │
    │                               │   │  (Takes 500-2000ms)          │
    │  Problems:                    │   │                              │
    │  • No loading state           │   │  Problems:                   │
    │  • API calls start too early  │   │  • Might not complete yet    │
    │  • User not in DB yet         │   │  • Race condition            │
    └───────────────────────────────┘   └──────────────────────────────┘
                    │                               │
                    ▼                               ▼
    ┌───────────────────────────────┐   ┌──────────────────────────────┐
    │  loadProjects() Called        │   │  Creates User in Database    │
    │  GET /api/projects            │   │  firebaseUid: "firebase-abc" │
    │                               │   │  id: "db-cuid-xyz123"        │
    │  Result:                      │   └──────────────────────────────┘
    │  ❌ 404 - User not found      │
    │  Returns empty array: []      │
    └───────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │  UI Shows Empty State         │
    │  "No projects yet"            │
    │                               │
    │  User confused - they had     │
    │  projects before!             │
    └───────────────────────────────┘
```

## Fixed Flow (With Sync Wait)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER SIGNS IN                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Firebase Authentication                                                     │
│  ✓ User authenticated with Firebase                                         │
│  ✓ User object created: { uid: "firebase-abc123", email: "user@email.com" } │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  React Context Update (auth-context.tsx)                                    │
│  ✓ setUser(firebaseUser)                                                    │
│  ✓ setIsSyncing(true)           ← NEW: Signal sync starting                │
│  ✓ await syncUserAndMigrateProjects() ← WAIT for completion                │
│  ✓ setIsSyncing(false)          ← NEW: Signal sync done                    │
│  ✓ setLoading(false)            ← Now safe to proceed                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  syncUserAndMigrateProjects() - Runs to Completion                          │
│                                                                              │
│  Step 1: POST /api/user/sync                                                │
│  ✓ Creates User in database                                                 │
│    - firebaseUid: "firebase-abc123"                                         │
│    - id: "db-cuid-xyz123"                                                   │
│                                                                              │
│  Step 2: Migrate anonymous projects                                         │
│  ✓ Find local projects with userId: "anonymous"                            │
│  ✓ Update to userId: "firebase-abc123"                                     │
│                                                                              │
│  Step 3: syncLocalProjectsToDatabase()                                      │
│  ✓ Upload local projects to database                                       │
│  ✓ Match project data in IndexedDB with database                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Projects Page Loads (app/projects/page.tsx)                                │
│                                                                              │
│  Check 1: if (isSyncing) {                                                  │
│    Show: "Setting up your account..." ← NEW: Better UX                     │
│  }                                                                           │
│                                                                              │
│  Check 2: if (!user && !isDebugMode) {                                      │
│    Show: <AuthGateModal />                                                  │
│  }                                                                           │
│                                                                              │
│  ✓ All checks pass - proceed to load projects                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  loadProjects() Called                                                       │
│  GET /api/projects                                                           │
│                                                                              │
│  Request Headers:                                                            │
│  Authorization: Bearer eyJhbGc...                                           │
│                                                                              │
│  Server checks:                                                              │
│  ✓ Token valid                                                              │
│  ✓ User exists in database (firebaseUid: "firebase-abc123")                │
│  ✓ Query projects WHERE userId = "db-cuid-xyz123"                          │
│                                                                              │
│  Response:                                                                   │
│  {                                                                           │
│    projects: [                                                               │
│      {                                                                       │
│        id: "project-123",                                                    │
│        userId: "firebase-abc123",  ← Converted back to Firebase UID        │
│        name: "My Project"                                                    │
│      }                                                                       │
│    ]                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  UI Shows Projects List                                                      │
│  ✓ User sees their projects                                                 │
│  ✓ Can click to open dashboard                                             │
│  ✓ Can create new projects                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Creation Flow (Current - Broken)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    USER UPLOADS FILE FROM HOME PAGE                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  handleUploadComplete() (app/page.tsx)                                       │
│  ✓ File parsed and data loaded into store                                   │
│  ✓ Data: 1000 rows x 10 columns                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  createProject() (project-store.ts)                                          │
│                                                                              │
│  Input: { userId: "firebase-abc123", name: "Sales Data" }                   │
│                                                                              │
│  Step 1: Check authentication                                                │
│  ✓ User is authenticated                                                    │
│                                                                              │
│  Step 2: Try API creation                                                   │
│  POST /api/projects                                                          │
│  Body: { name: "Sales Data", userId: "firebase-abc123" }                    │
│                                                                              │
│  Problems:                                                                   │
│  • User might not be synced to DB yet (race condition)                      │
│  • If not synced: 404 error                                                 │
│  • Falls back to local creation                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Local Fallback                                                              │
│  ✓ Creates project with ID: "project-1699564800000-abc123"                 │
│  ✓ Stored in localStorage                                                   │
│  ❌ NOT in database                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  saveProjectData() (project-store.ts)                                        │
│                                                                              │
│  Input: projectId: "project-1699564800000-abc123", data: [1000 rows]        │
│                                                                              │
│  Step 1: Try database API                                                   │
│  POST /api/projects/project-1699564800000-abc123/data                       │
│                                                                              │
│  Server checks:                                                              │
│  ✓ Token valid                                                              │
│  ✓ User exists in database                                                  │
│  ❌ Project NOT found (doesn't exist in DB!)                                 │
│  ❌ Returns 404 error                                                        │
│                                                                              │
│  Step 2: Fallback to IndexedDB                                              │
│  ✓ Saves data to IndexedDB                                                  │
│  ✓ Data accessible locally                                                  │
│  ❌ NOT synced to database                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Navigate to Dashboard                                                       │
│  URL: /dashboard?id=project-1699564800000-abc123                            │
│                                                                              │
│  Dashboard loads:                                                            │
│  ✓ Finds data in IndexedDB                                                  │
│  ✓ Shows dashboard with charts                                              │
│  ✓ Everything works!                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  User Goes Back to /projects                                                 │
│                                                                              │
│  loadProjects() runs:                                                        │
│  GET /api/projects                                                           │
│  Returns: { projects: [] }  ← Empty! Project only exists locally           │
│                                                                              │
│  Filters local projects:                                                     │
│  projects.filter(p => p.userId === "firebase-abc123")                       │
│                                                                              │
│  Local project has:                                                          │
│  userId: "firebase-abc123"                                                   │
│                                                                              │
│  Result:                                                                     │
│  ✓ Project appears in list (from localStorage)                             │
│  ✓ User can click it                                                        │
│  ✓ Dashboard loads from IndexedDB                                           │
│  ❌ But project is NOT backed up to database                                 │
│  ❌ If user clears browser data, project is lost!                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Creation Flow (Fixed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    USER UPLOADS FILE FROM HOME PAGE                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  handleUploadComplete() (app/page.tsx)                                       │
│  ✓ File parsed and data loaded into store                                   │
│  ✓ Data: 1000 rows x 10 columns                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  createProject() (project-store.ts)                                          │
│                                                                              │
│  Input: { userId: "firebase-abc123", name: "Sales Data" }                   │
│                                                                              │
│  Step 1: Check authentication                                                │
│  ✓ User is authenticated                                                    │
│  ✓ User already synced to DB (because we waited!)                          │
│                                                                              │
│  Step 2: Create via API                                                     │
│  POST /api/projects                                                          │
│  Body: { name: "Sales Data", description: "..." }                           │
│                                                                              │
│  Server:                                                                     │
│  ✓ Token valid                                                              │
│  ✓ User found: { id: "db-cuid-xyz", firebaseUid: "firebase-abc123" }       │
│  ✓ Creates project:                                                         │
│    {                                                                         │
│      id: "project-1699564800000-abc123",                                    │
│      userId: "db-cuid-xyz",  ← Stores database User.id                     │
│      name: "Sales Data"                                                      │
│    }                                                                         │
│  ✓ Returns project with userId converted to Firebase UID                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  saveProjectData() (project-store.ts)                                        │
│                                                                              │
│  Input: projectId: "project-1699564800000-abc123", data: [1000 rows]        │
│                                                                              │
│  Step 1: Try database API                                                   │
│  POST /api/projects/project-1699564800000-abc123/data                       │
│                                                                              │
│  Server checks:                                                              │
│  ✓ Token valid                                                              │
│  ✓ User exists: { id: "db-cuid-xyz", firebaseUid: "firebase-abc123" }      │
│  ✓ Project exists: { id: "project-...", userId: "db-cuid-xyz" }            │
│  ❌ Ownership check fails IF...                                              │
│                                                                              │
│  WAIT - NEW FIX: Auto-create project if not found!                          │
│  ✓ Project not found? Create it first                                       │
│  ✓ Then check ownership                                                     │
│  ✓ Ownership matches!                                                       │
│                                                                              │
│  ✓ Compresses data (1000 rows → 50KB compressed)                           │
│  ✓ Saves to ProjectData table                                               │
│  ✓ Returns success                                                          │
│                                                                              │
│  Step 2: Also save to IndexedDB (backup)                                    │
│  ✓ Saves data to IndexedDB for offline access                              │
│  ✓ Data accessible locally                                                  │
│  ✓ AND backed up to database                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Navigate to Dashboard                                                       │
│  URL: /dashboard?id=project-1699564800000-abc123                            │
│                                                                              │
│  Dashboard loads:                                                            │
│  ✓ First tries IndexedDB (fast)                                            │
│  ✓ Shows dashboard with charts immediately                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  User Goes Back to /projects                                                 │
│                                                                              │
│  loadProjects() runs:                                                        │
│  GET /api/projects                                                           │
│                                                                              │
│  Server:                                                                     │
│  ✓ Finds user: { id: "db-cuid-xyz", firebaseUid: "firebase-abc123" }       │
│  ✓ Queries: WHERE userId = "db-cuid-xyz"                                   │
│  ✓ Finds project!                                                           │
│  ✓ Converts userId to Firebase UID in response                              │
│                                                                              │
│  Returns:                                                                    │
│  {                                                                           │
│    projects: [                                                               │
│      {                                                                       │
│        id: "project-1699564800000-abc123",                                  │
│        userId: "firebase-abc123",  ← Converted for frontend                │
│        name: "Sales Data"                                                    │
│      }                                                                       │
│    ]                                                                         │
│  }                                                                           │
│                                                                              │
│  Frontend:                                                                   │
│  ✓ Receives projects from API                                               │
│  ✓ Merges with local projects                                               │
│  ✓ Filters: p.userId === "firebase-abc123"                                 │
│  ✓ Project matches!                                                         │
│  ✓ Shows in UI                                                              │
│  ✓ User can click and load dashboard                                        │
│  ✓ Data is safe in database                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                                 │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Firebase Auth                       Zustand Store                        │
│  ┌────────────┐                     ┌─────────────┐                      │
│  │ User:      │                     │ Projects:   │                      │
│  │  uid       │────────────────────▶│  userId     │◀─ Filter by UID     │
│  │  email     │                     │  (Firebase) │                      │
│  │  name      │                     └─────────────┘                      │
│  └────────────┘                              │                            │
│                                               ▼                            │
│                                      ┌─────────────────┐                  │
│                                      │ localStorage    │                  │
│                                      │ • Project meta  │                  │
│                                      └─────────────────┘                  │
│                                               │                            │
│                                               ▼                            │
│                                      ┌─────────────────┐                  │
│                                      │ IndexedDB       │                  │
│                                      │ • Project data  │                  │
│                                      │ • Analysis      │                  │
│                                      └─────────────────┘                  │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ API Calls
                                       │ (Bearer Token)
                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Next.js API)                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Auth Middleware                     API Routes                           │
│  ┌────────────────┐                 ┌──────────────┐                     │
│  │ verifyToken    │────────────────▶│ /api/user/   │                     │
│  │ Firebase Admin │                 │   sync       │                     │
│  └────────────────┘                 └──────────────┘                     │
│         │                                    │                             │
│         │                                    ▼                             │
│         │                            ┌──────────────┐                     │
│         └───────────────────────────▶│ /api/        │                     │
│                                      │   projects   │                     │
│                                      └──────────────┘                     │
│                                              │                             │
│                                              ▼                             │
│                                      ┌──────────────┐                     │
│                                      │ /api/        │                     │
│                                      │   projects/  │                     │
│                                      │   [id]/data  │                     │
│                                      └──────────────┘                     │
│                                              │                             │
└──────────────────────────────────────────────┼─────────────────────────────┘
                                               │
                                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (PostgreSQL)                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Users                         Projects                                    │
│  ┌─────────────────┐           ┌──────────────────┐                      │
│  │ id (CUID)       │◀──────────│ userId (FK)      │                      │
│  │ firebaseUid (!) │           │ id               │                      │
│  │ email           │           │ name             │                      │
│  └─────────────────┘           └──────────────────┘                      │
│                                          │                                 │
│                                          │                                 │
│                                          ▼                                 │
│                                 ┌────────────────────┐                    │
│                                 │ ProjectData        │                    │
│                                 │ projectId (FK)     │                    │
│                                 │ compressedData     │                    │
│                                 │ metadata           │                    │
│                                 └────────────────────┘                    │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘

Key ID Mapping:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend:  Uses Firebase UID everywhere      (e.g., "firebase-abc123")
Backend:   Maps Firebase UID ↔ Database ID   (e.g., "firebase-abc123" ↔ "db-cuid-xyz")
Database:  Stores Database ID as FK          (e.g., "db-cuid-xyz")
Response:  Converts back to Firebase UID     (e.g., "firebase-abc123")
```

## Middleware Flow

```
Request to /projects
        │
        ▼
┌──────────────────┐
│ middleware.ts    │
├──────────────────┤
│ Check route      │
│ Is protected?    │
└──────────────────┘
        │
        ├─ No ──▶ Allow
        │
        ▼ Yes
┌──────────────────────────┐
│ Check authentication     │
├──────────────────────────┤
│ 1. Session cookie?       │
│    __session             │
│    (Not set currently)   │
│                          │
│ 2. Bearer token?         │
│    Authorization header  │
│    ✓ Set by fetch()      │
│    ✗ Not sent by browser │
│      navigation          │
│                          │
│ 3. Debug mode?           │
│    Only in dev           │
└──────────────────────────┘
        │
        ├─ Authenticated ──▶ Allow
        │
        ▼ Not authenticated
┌──────────────────┐
│ Redirect to /    │
│ with query:      │
│ ?auth_required   │
└──────────────────┘
```

**Problem:** Browser navigation doesn't send Authorization header!

**Solution:** Use session cookies OR disable middleware for client navigation.

---

## Summary

The issue is a **coordination problem** between:
1. Firebase authentication (provides Firebase UID)
2. Database user records (uses internal CUID)
3. Async user sync (race condition)
4. Middleware auth checking (expects session cookie)
5. Project storage (mixed local/database state)

**Primary fixes:**
- Wait for user sync before navigation
- Auto-create projects in database when data is uploaded
- Use Firebase UID consistently in frontend

**Secondary fixes:**
- Implement session cookies for middleware
- Add retry logic for failed saves
- Better loading states and error handling
