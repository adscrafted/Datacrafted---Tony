# Implementation Checklist: Fix Project Access

## Pre-Implementation

- [ ] Backup current codebase
- [ ] Create feature branch: `fix/project-access-issues`
- [ ] Review all analysis documents
- [ ] Set up database backup
- [ ] Note current environment variables

---

## Phase 1: Critical Fixes (30 minutes)

### Fix 1: Add Sync State to Auth Context

**File:** `lib/contexts/auth-context.tsx`

- [ ] **Line 112:** Add `isSyncing` state
  ```typescript
  const [isSyncing, setIsSyncing] = useState(false)
  ```

- [ ] **Line 21-32:** Update `AuthContextType` interface
  ```typescript
  interface AuthContextType {
    user: User | null
    loading: boolean
    isSyncing: boolean  // ADD THIS LINE
    error: string | null
    // ... rest of interface
  }
  ```

- [ ] **Line 143-154:** Update `onAuthStateChanged` handler
  ```typescript
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
  ```

- [ ] **Line 262-273:** Add `isSyncing` to context value
  ```typescript
  const value = {
    user,
    loading,
    isSyncing,  // ADD THIS LINE
    error,
    signIn,
    // ... rest of value
  }
  ```

- [ ] **Save file**
- [ ] **Verify:** TypeScript compiles without errors

---

### Fix 2: Wait for Sync in Projects Page

**File:** `app/projects/page.tsx`

- [ ] **Line 16:** Destructure `isSyncing` from `useAuth()`
  ```typescript
  const { user, logout, loading: authLoading, isDebugMode, isSyncing } = useAuth()
  ```

- [ ] **Line 32-34:** Add `isSyncing` to loadProjects dependencies
  ```typescript
  useEffect(() => {
    if (!isSyncing && user) {  // ADD !isSyncing check
      loadProjects(user?.uid || 'anonymous')
    }
  }, [user, loadProjects, isSyncing])  // ADD isSyncing to deps
  ```

- [ ] **Line 37-39:** Update auth gate check
  ```typescript
  if (!authLoading && !isSyncing && !user && !isDebugMode) {
    return <AuthGateModal redirectPath="/projects" message="Sign in to view your projects" />
  }
  ```

- [ ] **After auth gate:** Add loading state for sync
  ```typescript
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

- [ ] **Save file**
- [ ] **Verify:** Page compiles without errors

---

### Fix 3: Auto-Create Project in Database

**File:** `app/api/projects/[id]/data/route.ts`

- [ ] **Find line 338-347:** Location where project ownership is checked

- [ ] **Replace the existing check** with:
  ```typescript
  // Verify project exists and ownership
  let project = await db.projects.findUnique({
    where: { id: projectId }
  })

  if (!project) {
    console.log('[API PROJECT DATA] Project not found in database, creating...')

    // AUTO-CREATE PROJECT
    try {
      project = await db.projects.create({
        data: {
          id: projectId,
          name: metadata.fileName || 'Untitled Project',
          description: `Auto-created project for ${metadata.fileName || 'data upload'}`,
          userId: dbUser.id,
          updatedAt: new Date()
        }
      })
      console.log('[API PROJECT DATA] Project auto-created:', project.id)
    } catch (createError) {
      console.error('[API PROJECT DATA] Failed to create project:', createError)
      return NextResponse.json(
        { error: 'Failed to create project for data upload' },
        { status: 500 }
      )
    }
  }

  // NOW check ownership
  if (project.userId !== dbUser.id) {
    console.log('[API PROJECT DATA] Authorization failed: User does not own project')
    return NextResponse.json(
      { error: 'Forbidden: You do not have access to this project' },
      { status: 403 }
    )
  }
  ```

- [ ] **Save file**
- [ ] **Verify:** TypeScript compiles without errors

---

### Fix 4: Update Middleware Auth Check (Optional but Recommended)

**File:** `middleware.ts`

- [ ] **Find line 54-71:** `hasAuthCredentials()` function

- [ ] **Update to prioritize token over cookie:**
  ```typescript
  function hasAuthCredentials(request: NextRequest): boolean {
    // Check for Authorization header (primary method for SPAs)
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

- [ ] **Save file**
- [ ] **Verify:** TypeScript compiles without errors

---

## Phase 2: Testing (15 minutes)

### Test 1: Sign Up Flow

- [ ] Open app in incognito window
- [ ] Click "Sign In" or go to sign up
- [ ] Create new account
- [ ] **Verify:** See "Setting up your account..." message
- [ ] **Verify:** Redirect to `/projects` page
- [ ] **Verify:** No errors in console
- [ ] **Check console for:**
  ```
  ✓ [AUTH] Syncing user to database
  ✓ [AUTH] User synced to database
  ✓ [PROJECT_STORE] Found 0 projects from API
  ```

### Test 2: Project Creation from Landing Page

- [ ] Go to landing page (/) while signed in
- [ ] Upload a CSV/Excel file
- [ ] **Verify:** See progress bar
- [ ] **Verify:** See "Creating project..." message
- [ ] **Verify:** See "Saving data..." message
- [ ] **Verify:** Navigate to `/dashboard?id={projectId}`
- [ ] **Verify:** Dashboard loads with data
- [ ] **Check console for:**
  ```
  ✓ [PROJECT_STORE] createProject called
  ✓ [PROJECT_STORE] Project created via API
  ✓ [PROJECT_STORE] Data saved to database successfully
  ```

### Test 3: Project Creation from Projects Page

- [ ] Go to `/projects` page
- [ ] Click "New Project" button
- [ ] Upload a file
- [ ] **Verify:** Same flow as Test 2
- [ ] Go back to `/projects`
- [ ] **Verify:** New project appears in list
- [ ] Click the project
- [ ] **Verify:** Dashboard loads

### Test 4: Page Reload

- [ ] On `/projects` page with projects visible
- [ ] Refresh page (F5)
- [ ] **Verify:** "Setting up your account..." does NOT appear (already synced)
- [ ] **Verify:** Projects still visible
- [ ] Click a project
- [ ] **Verify:** Dashboard loads

### Test 5: Sign Out and Sign In

- [ ] Sign out
- [ ] Sign in again
- [ ] **Verify:** See "Setting up your account..." briefly
- [ ] **Verify:** Redirect to `/projects`
- [ ] **Verify:** All previous projects visible

### Test 6: Database Verification

- [ ] Run SQL query to check user:
  ```sql
  SELECT id, firebaseUid, email, createdAt
  FROM users
  WHERE email = 'your-test-email@example.com';
  ```
  **Expected:** One row with valid data

- [ ] Run SQL query to check projects:
  ```sql
  SELECT p.id, p.name, p.userId, u.firebaseUid, u.email
  FROM projects p
  JOIN users u ON p.userId = u.id
  WHERE u.email = 'your-test-email@example.com';
  ```
  **Expected:** Rows matching created projects

- [ ] Run SQL query to check project data:
  ```sql
  SELECT pd.id, pd.projectId, pd.rowCount, pd.columnCount,
         LENGTH(pd.compressedData) as dataSize
  FROM project_data pd
  JOIN projects p ON pd.projectId = p.id
  JOIN users u ON p.userId = u.id
  WHERE u.email = 'your-test-email@example.com';
  ```
  **Expected:** Rows with project data

---

## Phase 3: Error Scenarios (10 minutes)

### Scenario 1: Network Failure During Sync

- [ ] Open DevTools → Network tab
- [ ] Set network to "Offline"
- [ ] Try to sign in
- [ ] **Expected:** Error message or retry option
- [ ] Set network to "Online"
- [ ] **Expected:** Sync completes automatically

### Scenario 2: Database Unavailable

- [ ] Stop database (if testing locally)
- [ ] Try to create project
- [ ] **Expected:** Falls back to IndexedDB
- [ ] **Expected:** Error message: "Data saved locally..."
- [ ] Start database
- [ ] **Expected:** Sync happens on next action

### Scenario 3: Invalid Token

- [ ] Sign in successfully
- [ ] Wait 1 hour (token expires)
- [ ] Try to create project
- [ ] **Expected:** Token automatically refreshed
- [ ] **Expected:** Operation succeeds

---

## Phase 4: Console Log Verification

### Success Patterns to Look For

Authentication:
```
✓ [AUTH] Syncing user to database: {uid}
✓ [API] Syncing user: {uid}
✓ [API] User synced successfully: {id}
✓ [AUTH] User synced to database: {id}
```

Project Creation:
```
✓ [PROJECT_STORE] createProject called
✓ [PROJECT_STORE] User authenticated, creating project via API
✓ [API PROJECTS] Creating project for user: {uid}
✓ [API PROJECTS] Project created: {projectId}
✓ [PROJECT_STORE] Project created via API: {projectId}
```

Data Save:
```
✓ [PROJECT_STORE] saveProjectData called
✓ [PROJECT_STORE] Attempting to save data via API
✓ [API PROJECT DATA] POST request: {projectId}
✓ [API PROJECT DATA] Authorization passed
✓ [API PROJECT DATA] Saving to database...
✓ [PROJECT_STORE] Data saved to database successfully
```

### Failure Patterns to Watch For

Authentication Failures:
```
✗ [AUTH] Failed to sync user to database
✗ [API] Error syncing user
✗ 404 User not found in database
```

Project Creation Failures:
```
✗ [PROJECT_STORE] API project creation failed
✗ Creating project locally (fallback)
✗ 403 Forbidden
✗ 404 Not Found
```

Data Save Failures:
```
✗ [PROJECT_STORE] API save failed
✗ [API PROJECT DATA] Project not found
✗ [API PROJECT DATA] Authorization failed
✗ Failed to save to database
```

---

## Phase 5: Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Console shows success patterns
- [ ] Database queries return expected data
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Code reviewed by team member

### Environment Variables Check

- [ ] **Production:** `DEBUG_MODE=false`
- [ ] **Production:** `NEXT_PUBLIC_DEBUG_MODE=false`
- [ ] **Production:** Firebase credentials set
- [ ] **Production:** `DATABASE_URL` set correctly
- [ ] **Production:** All `NEXT_PUBLIC_FIREBASE_*` variables set

### Deployment Steps

- [ ] Merge feature branch to main
- [ ] Deploy to staging environment
- [ ] Run smoke tests on staging
- [ ] Monitor staging logs for 15 minutes
- [ ] Deploy to production
- [ ] Monitor production logs for 30 minutes
- [ ] Test production with real account

### Rollback Plan

If issues occur in production:

- [ ] Revert to previous deployment
- [ ] Check production logs for errors
- [ ] Identify which fix is causing the issue
- [ ] Fix in development
- [ ] Re-test
- [ ] Re-deploy

---

## Phase 6: Monitoring (Ongoing)

### Metrics to Track

Authentication:
- [ ] Sign-up success rate
- [ ] Sign-in success rate
- [ ] User sync completion time (should be < 2 seconds)
- [ ] User sync failure rate (should be < 1%)

Projects:
- [ ] Project creation success rate
- [ ] Projects visible in list after creation (should be 100%)
- [ ] Project data save success rate
- [ ] IndexedDB fallback rate (should be < 5%)

Performance:
- [ ] Time from sign-in to projects page load
- [ ] Time to create project
- [ ] Time to load dashboard
- [ ] Database query performance

### Error Monitoring

Set up alerts for:
- [ ] High rate of auth sync failures
- [ ] High rate of project creation failures
- [ ] High rate of data save failures
- [ ] Slow user sync times (> 5 seconds)

### User Feedback

Monitor for:
- [ ] User complaints about missing projects
- [ ] User complaints about slow loading
- [ ] User complaints about sign-in issues
- [ ] User reports of data loss

---

## Completion Checklist

- [ ] **Phase 1:** All critical fixes implemented
- [ ] **Phase 2:** All tests passing
- [ ] **Phase 3:** Error scenarios handled
- [ ] **Phase 4:** Console logs show success
- [ ] **Phase 5:** Deployed to production
- [ ] **Phase 6:** Monitoring set up

### Documentation Updates

- [ ] Update API documentation
- [ ] Update architecture diagrams
- [ ] Update developer onboarding docs
- [ ] Create troubleshooting guide
- [ ] Document new auth flow

### Team Communication

- [ ] Notify team of deployment
- [ ] Share test results
- [ ] Document known issues (if any)
- [ ] Schedule follow-up review meeting
- [ ] Update project board/tickets

---

## Success Criteria

The fix is successful when:

1. **Authentication:** User can sign up/in and is redirected to `/projects` with loading state
2. **Project List:** User sees their projects after sign-in (not empty)
3. **Project Creation:** User can upload file and project appears in list immediately
4. **Dashboard Access:** User can click project and dashboard loads with data
5. **Page Reload:** Projects persist after page reload
6. **Database Sync:** All projects and data are backed up to database
7. **No Errors:** No console errors during normal flow
8. **Fast Performance:** Auth sync completes in < 2 seconds

---

## Troubleshooting

### Issue: Still seeing empty projects list

**Check:**
- [ ] Is user synced to database? (Check console for sync logs)
- [ ] Do projects exist in database? (Run SQL query)
- [ ] Are project userIds matching? (Check userId in projects vs user.uid)
- [ ] Is API returning projects? (Check Network tab)

**Fix:**
- Wait for sync to complete (should see loading state)
- Check database for user and projects
- Verify project userId matches Firebase UID

### Issue: Projects not saving to database

**Check:**
- [ ] Is project being created in database? (Check SQL)
- [ ] Is data upload API working? (Check Network tab)
- [ ] Are there errors in console? (Look for API errors)
- [ ] Is project ownership check passing? (Check API logs)

**Fix:**
- Verify auto-create code is working
- Check project userId matches database User.id
- Verify token is valid

### Issue: Middleware redirecting authenticated users

**Check:**
- [ ] Is session cookie set? (Check DevTools → Application → Cookies)
- [ ] Is Authorization header present? (Check Network tab)
- [ ] Is middleware checking token? (Check middleware logs)

**Fix:**
- Verify Fix 4 was applied correctly
- Consider implementing session cookie (long-term fix)
- Temporarily disable middleware for testing

---

**Checklist Version:** 1.0
**Last Updated:** 2025-10-12
**Estimated Time:** 30-60 minutes total
