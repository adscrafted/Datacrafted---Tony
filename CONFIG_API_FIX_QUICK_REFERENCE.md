# Config API Fix - Quick Reference

## Problem

**Symptom**: Dashboard crashes within 30 seconds of creating a new project with infinite 403 errors.

**Root Cause**: Authorization logic compares wrong identifiers:
- `project.userId` (database ID like `clx123...`)
- vs `authUser.uid` (Firebase UID like `NSxVx0...`)
- These are NEVER equal → Always returns 403

## 3-Minute Fix (Critical)

### File: `app/api/projects/[id]/config/route.ts`

**Current (BROKEN):**
```typescript
const project = await db.projects.findUnique({
  where: { id: projectId }
})

if (project.userId !== authUser.uid) {  // ❌ Wrong comparison
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

**Fixed:**
```typescript
const project = await db.projects.findUnique({
  where: { id: projectId },
  include: {
    users: {
      select: {
        firebaseUid: true,
        id: true
      }
    }
  }
})

if (project.users.firebaseUid !== authUser.uid) {  // ✅ Correct comparison
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

**Apply to BOTH `getHandler` (line 10) and `putHandler` (line 87)**

## Files to Modify

### 1. Fix Authorization (CRITICAL - Deploy Immediately)

```
app/api/projects/[id]/config/route.ts
  - Line 15-32: Fix getHandler authorization
  - Line 92-109: Fix putHandler authorization
```

### 2. Add Retry Logic (Deploy Same Day)

```
lib/stores/project-store.ts
  - Line 663-731: Update loadDashboardConfig()
  - Add: import { retryFetch } from '@/lib/utils/api-retry'
```

### 3. New Files to Create

```
lib/utils/api-retry.ts
  - Circuit breaker implementation
  - Exponential backoff retry logic
  - Already created ✅
```

## Code Changes

### Change 1: Config API GET Handler

**Location**: `app/api/projects/[id]/config/route.ts:10-79`

```typescript
const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // FIXED: Include user relation for proper authorization
    const project = await db.projects.findUnique({
      where: { id: projectId },
      include: {
        users: {
          select: {
            firebaseUid: true,
            id: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // CRITICAL FIX: Compare Firebase UIDs, not database IDs
    if (project.users.firebaseUid !== authUser.uid) {
      console.error('[CONFIG API] Authorization failed:', {
        projectId,
        projectFirebaseUid: project.users.firebaseUid,
        authUserUid: authUser.uid
      })

      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this project' },
        { status: 403 }
      )
    }

    // Get dashboard config using database user ID
    const config = await db.dashboard_configs.findFirst({
      where: {
        projectId,
        userId: project.userId  // Use database user ID for lookup
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    if (!config) {
      // Return empty config (NOT 404) for new projects
      return NextResponse.json({
        chartCustomizations: {},
        currentTheme: null,
        currentLayout: null,
        dashboardFilters: null,
        version: 1
      })
    }

    // Parse and return config
    const chartCustomizations = config.chartCustomizations
      ? JSON.parse(config.chartCustomizations)
      : {}
    const dashboardFilters = config.dashboardFilters
      ? JSON.parse(config.dashboardFilters)
      : null

    return NextResponse.json({
      chartCustomizations,
      currentTheme: config.currentTheme,
      currentLayout: config.currentLayout,
      dashboardFilters,
      version: config.version,
      lastModified: config.updatedAt.toISOString()
    })
  } catch (error) {
    console.error('[CONFIG API] Error fetching dashboard config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard config' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)
```

### Change 2: Config API PUT Handler

**Location**: `app/api/projects/[id]/config/route.ts:87-160`

```typescript
const putHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // FIXED: Include user relation for proper authorization
    const project = await db.projects.findUnique({
      where: { id: projectId },
      include: {
        users: {
          select: {
            firebaseUid: true,
            id: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // CRITICAL FIX: Compare Firebase UIDs
    if (project.users.firebaseUid !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      chartCustomizations = {},
      currentTheme = null,
      currentLayout = null,
      dashboardFilters = null
    } = body

    // Use database user ID for config operations
    const dbUserId = project.userId
    const configId = `${dbUserId}_${projectId}`

    // Upsert dashboard config
    const config = await db.dashboard_configs.upsert({
      where: { id: configId },
      create: {
        id: configId,
        userId: dbUserId,
        projectId,
        chartCustomizations: JSON.stringify(chartCustomizations),
        currentTheme,
        currentLayout,
        dashboardFilters: dashboardFilters ? JSON.stringify(dashboardFilters) : null,
        version: 1,
        updatedAt: new Date()
      },
      update: {
        chartCustomizations: JSON.stringify(chartCustomizations),
        currentTheme,
        currentLayout,
        dashboardFilters: dashboardFilters ? JSON.stringify(dashboardFilters) : null,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      configId: config.id,
      lastModified: config.updatedAt.toISOString()
    })
  } catch (error) {
    console.error('[CONFIG API] Error saving dashboard config:', error)
    return NextResponse.json(
      { error: 'Failed to save dashboard config' },
      { status: 500 }
    )
  }
})

export const PUT = withRateLimit(RATE_LIMITS.SESSION, putHandler)
```

### Change 3: Project Store with Retry Logic

**Location**: `lib/stores/project-store.ts:663-731`

Add import at top:
```typescript
import { retryFetch } from '@/lib/utils/api-retry'
```

Update `loadDashboardConfig`:
```typescript
loadDashboardConfig: async (projectId) => {
  // Try to load from database API first
  try {
    console.log('🌐 [PROJECT_STORE] Loading dashboard config from database...')
    const token = await auth.currentUser?.getIdToken()

    if (token) {
      // Use retry mechanism with circuit breaker
      const response = await retryFetch(`/api/projects/${projectId}/config`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, {
        maxRetries: 3,
        initialDelayMs: 500,
        shouldRetry: (error, attempt, maxRetries) => {
          // Don't retry 403 (auth error) or 404 (not found)
          if (error.status === 403 || error.status === 404) {
            return false
          }
          // Retry 429 (rate limit) and 5xx (server errors)
          return attempt < maxRetries && (error.status === 429 || error.status >= 500)
        },
        onRetry: (attempt, error) => {
          console.log(`🔄 [PROJECT_STORE] Config load retry ${attempt}/3:`, error)
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ [PROJECT_STORE] Dashboard config loaded from database')

        // Save to localStorage for quick access
        const now = new Date().toISOString()
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  dashboardConfig: {
                    chartCustomizations: result.chartCustomizations,
                    currentLayout: result.currentLayout,
                    filters: result.dashboardFilters,
                    theme: result.currentTheme,
                    lastModified: result.lastModified || now
                  },
                  updatedAt: now
                }
              : p
          ),
          isDirty: false,
          lastSavedAt: result.lastModified || now
        }))

        return {
          chartCustomizations: result.chartCustomizations,
          currentLayout: result.currentLayout,
          filters: result.dashboardFilters,
          theme: result.currentTheme
        }
      } else {
        const status = response.status
        const errorText = await response.text()

        if (status === 403) {
          console.error('❌ [PROJECT_STORE] Authorization failed:', {
            projectId,
            status,
            error: errorText
          })
        } else if (status === 404) {
          console.log('ℹ️ [PROJECT_STORE] No config exists yet (expected for new projects)')
        } else {
          console.warn('⚠️ [PROJECT_STORE] Failed to load config:', status, errorText)
        }
      }
    } else {
      console.warn('⚠️ [PROJECT_STORE] No auth token, skipping database load')
    }
  } catch (error) {
    // Circuit breaker may have triggered
    if (error instanceof Error && error.message.includes('Circuit breaker')) {
      console.error('🔴 [PROJECT_STORE] Circuit breaker open:', error.message)
    } else {
      console.error('❌ [PROJECT_STORE] Error loading config:', error)
    }
  }

  // Fallback to localStorage
  console.log('💾 [PROJECT_STORE] Loading dashboard config from localStorage')
  const project = get().projects.find(p => p.id === projectId)
  if (project?.dashboardConfig) {
    const { lastModified, ...config } = project.dashboardConfig
    set({ isDirty: false, lastSavedAt: project.dashboardConfig.lastModified })
    return config
  }

  console.log('ℹ️ [PROJECT_STORE] No dashboard config found (new project)')
  return null
}
```

## Testing

### Quick Smoke Test

1. **Create new project**:
   ```bash
   # Should NOT return 403
   curl -X POST http://localhost:3000/api/projects \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Project"}'
   ```

2. **Get config immediately**:
   ```bash
   # Should return 200 with empty config, NOT 403
   curl http://localhost:3000/api/projects/$PROJECT_ID/config \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Check logs**:
   ```bash
   # Should NOT see 403 errors
   tail -f logs/app.log | grep "CONFIG API"
   ```

### Expected Results

✅ **Success indicators:**
- GET /config returns 200 (even if config is empty)
- No 403 errors in logs
- Dashboard loads without crashes
- Circuit breaker stays closed

❌ **Failure indicators:**
- Still getting 403 errors
- Circuit breaker opens
- "Authorization failed" in logs

## Rollback Plan

If issues occur:

1. **Quick rollback**:
   ```bash
   git revert HEAD
   npm run build
   npm run deploy
   ```

2. **Emergency hotfix**:
   - Temporarily disable config API calls in frontend
   - Use localStorage-only config

3. **Database consistency**:
   ```sql
   -- Check for user sync issues
   SELECT p.id, p.userId, u.firebaseUid
   FROM projects p
   JOIN users u ON p.userId = u.id
   WHERE u.firebaseUid IS NULL;
   ```

## Monitoring Commands

```bash
# Watch for 403 errors
tail -f logs/app.log | grep "403"

# Check circuit breaker status
curl http://localhost:3000/api/debug/circuit-breakers

# Monitor config API calls
tail -f logs/app.log | grep "CONFIG API"

# Database user lookup
psql $DATABASE_URL -c \
  "SELECT id, firebaseUid FROM users WHERE firebaseUid='$FIREBASE_UID';"
```

## Success Criteria

- [ ] No 403 errors for project owners
- [ ] Config API responds < 200ms
- [ ] Dashboard loads successfully for new projects
- [ ] Circuit breaker remains closed
- [ ] No application crashes

## Support

**If issues persist after fix:**
1. Check user sync: `/api/user/sync`
2. Verify Firebase UID matches database: Run SQL query above
3. Check circuit breaker status
4. Review logs for auth errors

**Emergency contact:**
- Check `PRODUCTION_CONFIG_API_FIX.md` for detailed analysis
- Review `lib/utils/api-retry.ts` for circuit breaker logic
