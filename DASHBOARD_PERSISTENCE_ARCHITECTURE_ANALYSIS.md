# Dashboard Data Persistence Architecture Analysis

**Date:** 2025-10-12
**Issue:** Dashboard changes (chart additions, removals, edits) are not persisting after save/exit/return
**Status:** CRITICAL - Core functionality broken

---

## Executive Summary

The dashboard persistence system has **THREE SEPARATE storage mechanisms** that are not properly synchronized:

1. **Zustand Store (localStorage)** - Client-side state (chartCustomizations)
2. **ProjectData table (database)** - Analysis and chart configurations
3. **Project settings (database)** - Dashboard config metadata

**ROOT CAUSE:** When loading a project, the system:
- ✅ Loads data and analysis from ProjectData table
- ✅ Loads chart customizations from Zustand localStorage (if projectId matches)
- ❌ **NEVER loads saved dashboard config from database back into Zustand**
- ❌ **Dashboard config is saved to database but ignored on reload**

---

## Architecture Overview

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTIONS                        │
│  (Add chart, Edit chart, Move chart, Hide chart, etc.)     │
└────────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              ZUSTAND DATA STORE (lib/store.ts)              │
│  • chartCustomizations: Record<chartId, customization>      │
│  • analysis: AnalysisResult (chartConfig)                   │
│  • Persisted to localStorage via zustand/persist            │
└────────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           PROJECT STORE (lib/stores/project-store.ts)       │
│  • saveDashboardConfig(projectId, config)                   │
│    - Saves to in-memory projects array                      │
│    - NO database API call                                   │
│  • loadDashboardConfig(projectId)                           │
│    - Reads from in-memory projects array                    │
│    - NEVER fetches from database                            │
└─────────────────────────┬───────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌──────────────────────┐      ┌──────────────────────────┐
│  LOCAL STORAGE       │      │  NO DATABASE SAVE!       │
│  (Zustand persist)   │      │  (Critical Bug)          │
│  • chartCustomizations│      │                          │
│  • analysis          │      │  Should save to:         │
│  • fileName          │      │  • ProjectData.chartCustomizations│
│  • dataSchema        │      │  • OR projects.settings  │
└──────────────────────┘      └──────────────────────────┘
```

---

## Database Schema Review

### 1. ProjectData Table (project_data)
**Location:** `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/prisma/schema.prisma:167-225`

```prisma
model ProjectData {
  id        String   @id @default(cuid())
  projectId String
  version   Int      @default(1)

  // File and compressed data storage
  originalFileName String
  compressedData   Bytes

  // Data metadata
  rowCount    Int
  columnCount Int
  columnNames String // JSON array
  columnTypes String // JSON object

  // AI Analysis storage
  analysisData        String?   @db.Text // ✅ JSON stringified analysis
  hasAnalysis         Boolean   @default(false)
  analysisVersion     Int       @default(1)
  analysisCreatedAt   DateTime?
  chartCustomizations String?   @db.Text // ✅ JSON user chart edits

  // Relationships
  project projects @relation(fields: [projectId], references: [id])
}
```

**Analysis:**
- ✅ Has `analysisData` field - stores AI-generated charts
- ✅ Has `chartCustomizations` field - **INTENDED** for user edits
- ❌ **NEVER USED** - API saves to this field but dashboard never loads from it
- ❌ No API endpoint to update `chartCustomizations` separately from full data upload

---

### 2. Projects Table
**Location:** `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/prisma/schema.prisma:149-165`

```prisma
model projects {
  id                String              @id
  name              String
  description       String?
  settings          String?             // 🔍 Could store dashboard config
  userId            String
  dashboard_configs dashboard_configs[] // 🔍 Separate table!
  projectData       ProjectData[]
}
```

**Analysis:**
- Has `settings` field (JSON string) - could store dashboard config
- Currently used for `fileInfo` and `tags` (see `/app/api/projects/route.ts:62-65`)
- Also has relationship to `dashboard_configs` table (separate storage option)

---

### 3. DashboardConfigs Table (dashboard_configs)
**Location:** `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/prisma/schema.prisma:126-147`

```prisma
model dashboard_configs {
  id                  String    @id
  createdAt           DateTime  @default(now())
  updatedAt           DateTime
  userId              String
  sessionId           String?
  projectId           String?
  chartCustomizations String     // ✅ JSON customizations
  currentTheme        String?
  currentLayout       String?
  dashboardFilters    String?
  version             Int       @default(1)

  projects            projects? @relation(...)
  sessions            Session?  @relation(...)
  users               User      @relation(...)

  @@unique([userId, sessionId, projectId])
}
```

**Analysis:**
- ✅ **PERFECT TABLE** for dashboard persistence!
- ✅ Has all necessary fields: chartCustomizations, theme, layout, filters
- ✅ Unique constraint on (userId, sessionId, projectId)
- ❌ **COMPLETELY UNUSED** - No API endpoints create/update/fetch from this table
- ❌ Project store `saveDashboardConfig` never writes to database

---

## API Endpoint Analysis

### 1. Project Data API
**File:** `/app/api/projects/[id]/data/route.ts`

#### GET `/api/projects/{id}/data`
**Lines:** 124-280

```typescript
// ✅ Returns analysis from database
analysis: projectData.analysisData ? JSON.parse(projectData.analysisData) : undefined,

// ✅ Returns chart customizations from database
chartCustomizations: projectData.chartCustomizations ? JSON.parse(projectData.chartCustomizations) : undefined,
```

**Issue:**
- ✅ Endpoint **DOES** return `chartCustomizations` from database
- ❌ Dashboard **NEVER CALLS** this endpoint to load customizations
- ❌ Dashboard loads from localStorage (Zustand) instead

---

#### POST `/api/projects/{id}/data`
**Lines:** 289-564

```typescript
// ✅ Saves chart customizations to database
chartCustomizations: chartCustomizations ? JSON.stringify(chartCustomizations) : null
```

**Issue:**
- ✅ Endpoint **DOES** save customizations to database
- ✅ Called during upload via `saveProjectData()` in project-store.ts:374-417
- ❌ Only called during **INITIAL UPLOAD**, not when user saves dashboard changes
- ❌ No way to UPDATE customizations after initial save

---

### 2. Projects API
**File:** `/app/api/projects/route.ts`

#### GET `/api/projects`
**Lines:** 6-79

```typescript
// Returns projects with settings
settings: project.settings ? JSON.parse(project.settings) : null

// Transform includes:
dashboardConfig: settings?.dashboardConfig,  // Line 65
```

**Issue:**
- ✅ Can return `dashboardConfig` from `settings` field
- ❌ Never populated - settings only stores `fileInfo` and `tags`
- ❌ No API to save dashboard config to projects.settings

---

#### POST `/api/projects`
**Lines:** 83-144

**Issue:**
- ✅ Creates projects with optional settings
- ❌ Never called with dashboardConfig in settings
- ❌ No update endpoint for project settings

---

### 3. Missing API Endpoints

**NO ENDPOINTS EXIST FOR:**

1. ❌ `PUT /api/projects/{id}/config` - Update dashboard configuration
2. ❌ `GET /api/projects/{id}/config` - Fetch dashboard configuration
3. ❌ `PUT /api/projects/{id}/data/customizations` - Update chart customizations only
4. ❌ Any CRUD operations on `dashboard_configs` table

---

## Client-Side Data Flow

### 1. Project Store - Save Dashboard
**File:** `/lib/stores/project-store.ts:604-622`

```typescript
saveDashboardConfig: async (projectId, config) => {
  const now = new Date().toISOString()
  set((state) => ({
    projects: state.projects.map(p =>
      p.id === projectId
        ? {
            ...p,
            dashboardConfig: {
              ...config,
              lastModified: now
            },
            updatedAt: now
          }
        : p
    ),
    isDirty: false,
    lastSavedAt: now
  }))
}
```

**CRITICAL BUG:**
- ✅ Updates in-memory project array
- ✅ Updates localStorage (via Zustand persist)
- ❌ **NO DATABASE API CALL** - changes never reach server
- ❌ **EPHEMERAL** - Lost when localStorage is cleared or user switches devices

---

### 2. Project Store - Load Dashboard
**File:** `/lib/stores/project-store.ts:624-633`

```typescript
loadDashboardConfig: (projectId) => {
  const project = get().projects.find(p => p.id === projectId)
  if (project?.dashboardConfig) {
    const { lastModified, ...config } = project.dashboardConfig
    // Reset dirty state when loading config
    set({ isDirty: false, lastSavedAt: project.dashboardConfig.lastModified })
    return config
  }
  return null
}
```

**CRITICAL BUG:**
- ✅ Reads from in-memory project array
- ✅ Reads from localStorage (via Zustand persist)
- ❌ **NEVER FETCHES FROM DATABASE** - can't load saved config from server
- ❌ Only works if same browser/device with intact localStorage

---

### 3. Dashboard Page - Load Project Data
**File:** `/app/dashboard/page.tsx:324-378`

```typescript
const loadProjectData = async () => {
  // Try synchronous first (for small datasets in localStorage)
  let projectData = getProjectData(directId)

  // If not found, try async (for large datasets in IndexedDB or database)
  if (!projectData) {
    projectData = await loadProjectDataAsync(directId)
  }

  if (projectData && projectData.rawData && projectData.rawData.length > 0) {
    const { setFileName, setRawData, setAnalysis, setDataSchema } = useDataStore.getState()
    setFileName(projectData.dataSchema?.fileName || 'Project Data')
    await setRawData(projectData.rawData)

    if (projectData.analysis) {
      setAnalysis(projectData.analysis)
    }

    if (projectData.dataSchema) {
      setDataSchema(projectData.dataSchema)
    }
  }
}
```

**CRITICAL BUG:**
- ✅ Loads data and analysis
- ❌ **NEVER LOADS DASHBOARD CONFIG** - missing this crucial step:
  ```typescript
  // MISSING CODE:
  const savedConfig = loadDashboardConfig(directId)
  if (savedConfig) {
    // Apply saved customizations to Zustand store
    Object.entries(savedConfig.chartCustomizations).forEach(([chartId, customization]) => {
      updateChartCustomization(chartId, customization)
    })
  }
  ```

---

### 4. Flexible Dashboard Layout - Load Config Effect
**File:** `/components/dashboard/flexible-dashboard-layout.tsx:122-135`

```typescript
useEffect(() => {
  if (currentProjectId) {
    const savedConfig = loadDashboardConfig(currentProjectId)
    if (savedConfig) {
      Object.entries(savedConfig.chartCustomizations).forEach(([chartId, customization]) => {
        updateChartCustomization(chartId, customization)
      })
    } else {
      Object.keys(chartCustomizations).forEach(chartId => {
        updateChartCustomization(chartId, { position: undefined })
      })
    }
  }
}, [currentProjectId, loadDashboardConfig, updateChartCustomization])
```

**Analysis:**
- ✅ **CORRECT LOGIC** - tries to load saved config
- ❌ **WRONG DATA SOURCE** - `loadDashboardConfig()` only reads localStorage, not database
- ⚠️ Works ONLY if user hasn't cleared localStorage

---

### 5. Save Dashboard Button
**File:** `/components/dashboard/save-dashboard-button.tsx:75-128`

```typescript
const handleSave = useCallback(async () => {
  // ... validation ...

  try {
    // Save dashboard configuration
    await saveDashboardConfig(currentProjectId, {
      chartCustomizations,
      currentLayout,
      filters: dashboardFilters,
      theme: currentTheme
    })

    markAsClean()
    toast.success('Dashboard saved successfully')
  } catch (error) {
    toast.error('Failed to save dashboard. Please try again.')
  }
}, [/* deps */])
```

**Analysis:**
- ✅ UI correctly detects changes (dirty state)
- ✅ Calls saveDashboardConfig
- ❌ saveDashboardConfig **DOESN'T SAVE TO DATABASE**
- ❌ Success message is misleading - only saved to localStorage

---

## Data Storage Comparison

| Storage Location | Analysis | Chart Customizations | Theme/Layout | Persistence | Multi-Device |
|-----------------|----------|---------------------|--------------|-------------|--------------|
| **Zustand localStorage** | ✅ Loaded | ✅ Saved/Loaded | ✅ Saved/Loaded | Session-scoped | ❌ No |
| **ProjectData.analysisData** | ✅ Saved/Loaded | ❌ Field exists but unused | ❌ N/A | ✅ Permanent | ✅ Yes |
| **ProjectData.chartCustomizations** | ❌ N/A | ⚠️ Saved but never loaded | ❌ N/A | ✅ Permanent | ✅ Yes |
| **projects.settings** | ❌ N/A | ⚠️ Field exists but unused | ⚠️ Field exists but unused | ✅ Permanent | ✅ Yes |
| **dashboard_configs table** | ❌ N/A | ⚠️ Table exists but unused | ⚠️ Table exists but unused | ✅ Permanent | ✅ Yes |

---

## Root Cause Analysis

### The Bug Chain

1. **User uploads data** → Saved to ProjectData.analysisData ✅
2. **User customizes dashboard** → Saved to Zustand store (localStorage) ✅
3. **User clicks "Save Dashboard"** →
   - Calls `saveDashboardConfig()` ✅
   - Updates in-memory project array ✅
   - Updates localStorage ✅
   - **NEVER CALLS DATABASE API** ❌
4. **User exits and returns** →
   - Loads data from database ✅
   - Loads analysis from database ✅
   - Loads customizations from... **localStorage** ⚠️
   - If localStorage cleared → **ALL CUSTOMIZATIONS LOST** ❌

### Why This Happens

**Design Mismatch:**
- Database schema was designed for full persistence (dashboard_configs table)
- Project store was implemented with localStorage-only persistence
- **Missing bridge** between client state and database

**Historical Context:**
- Code shows evidence of session-based architecture (Session model, session API endpoints)
- Later pivoted to project-based architecture
- Dashboard config persistence never updated for new architecture
- `dashboard_configs` table still references both sessionId and projectId

---

## Specific Code Issues

### Issue 1: No Database Save on Dashboard Changes
**Location:** `/lib/stores/project-store.ts:604-622`

**Current Code:**
```typescript
saveDashboardConfig: async (projectId, config) => {
  set((state) => ({
    projects: state.projects.map(p =>
      p.id === projectId ? { ...p, dashboardConfig: { ...config, lastModified: now } } : p
    ),
    isDirty: false
  }))
}
```

**Required Fix:**
```typescript
saveDashboardConfig: async (projectId, config) => {
  // 1. Save to database
  const token = await auth.currentUser?.getIdToken()
  const response = await fetch(`/api/projects/${projectId}/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(config)
  })

  if (!response.ok) {
    throw new Error('Failed to save dashboard config to database')
  }

  // 2. Update local state
  set((state) => ({
    projects: state.projects.map(p =>
      p.id === projectId ? { ...p, dashboardConfig: { ...config, lastModified: now } } : p
    ),
    isDirty: false
  }))
}
```

---

### Issue 2: No Database Load on Dashboard Mount
**Location:** `/app/dashboard/page.tsx:324-378`

**Current Code:**
```typescript
// Loads data and analysis, but NOT dashboard config
if (projectData.analysis) {
  setAnalysis(projectData.analysis)
}
```

**Required Fix:**
```typescript
// Load data and analysis
if (projectData.analysis) {
  setAnalysis(projectData.analysis)
}

// CRITICAL FIX: Load dashboard config from database
try {
  const token = await auth.currentUser?.getIdToken()
  const configResponse = await fetch(`/api/projects/${directId}/config`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })

  if (configResponse.ok) {
    const { config } = await configResponse.json()
    if (config && config.chartCustomizations) {
      // Apply saved customizations to Zustand store
      Object.entries(config.chartCustomizations).forEach(([chartId, customization]) => {
        updateChartCustomization(chartId, customization)
      })
    }
  }
} catch (error) {
  console.error('Failed to load dashboard config:', error)
}
```

---

### Issue 3: Missing API Endpoints
**Required New Endpoints:**

#### 1. Update Project Dashboard Config
```typescript
// PUT /api/projects/[id]/config/route.ts
export const PUT = withAuth(async (request, authUser, context) => {
  const { id: projectId } = await context!.params
  const body = await request.json()
  const { chartCustomizations, currentLayout, filters, theme } = body

  // Save to dashboard_configs table
  await db.dashboard_configs.upsert({
    where: {
      userId_sessionId_projectId: {
        userId: authUser.uid,
        sessionId: null,
        projectId: projectId
      }
    },
    update: {
      chartCustomizations: JSON.stringify(chartCustomizations),
      currentTheme: JSON.stringify(theme),
      currentLayout: JSON.stringify(currentLayout),
      dashboardFilters: JSON.stringify(filters),
      updatedAt: new Date()
    },
    create: {
      id: `config-${Date.now()}`,
      userId: authUser.uid,
      projectId: projectId,
      chartCustomizations: JSON.stringify(chartCustomizations),
      currentTheme: JSON.stringify(theme),
      currentLayout: JSON.stringify(currentLayout),
      dashboardFilters: JSON.stringify(filters)
    }
  })

  return NextResponse.json({ success: true })
})
```

#### 2. Fetch Project Dashboard Config
```typescript
// GET /api/projects/[id]/config/route.ts
export const GET = withAuth(async (request, authUser, context) => {
  const { id: projectId } = await context!.params

  // Fetch from dashboard_configs table
  const config = await db.dashboard_configs.findUnique({
    where: {
      userId_sessionId_projectId: {
        userId: authUser.uid,
        sessionId: null,
        projectId: projectId
      }
    }
  })

  if (!config) {
    return NextResponse.json({ config: null })
  }

  return NextResponse.json({
    config: {
      chartCustomizations: JSON.parse(config.chartCustomizations),
      currentTheme: config.currentTheme ? JSON.parse(config.currentTheme) : null,
      currentLayout: config.currentLayout ? JSON.parse(config.currentLayout) : null,
      filters: config.dashboardFilters ? JSON.parse(config.dashboardFilters) : []
    }
  })
})
```

---

## Recommended Solution

### Option A: Use dashboard_configs Table (RECOMMENDED)

**Pros:**
- ✅ Table already exists with all necessary fields
- ✅ Proper database normalization
- ✅ Supports versioning
- ✅ Can track userId + projectId + sessionId
- ✅ Clear separation of concerns

**Implementation:**
1. Create `/api/projects/[id]/config/route.ts` with GET and PUT handlers
2. Update `project-store.ts` saveDashboardConfig to call API
3. Update dashboard mount logic to fetch config from API
4. Keep localStorage as cache for offline support

**Effort:** Medium (2-3 hours)

---

### Option B: Use ProjectData.chartCustomizations

**Pros:**
- ✅ Field already exists
- ✅ Data already co-located with analysis
- ✅ Simpler data model

**Cons:**
- ❌ Requires separate UPDATE endpoint (can't reuse POST /data)
- ❌ Mixes user edits with AI-generated content
- ❌ No support for theme/layout (only customizations)
- ❌ No versioning support

**Implementation:**
1. Create `/api/projects/[id]/data/customizations/route.ts`
2. Add PUT handler to update only chartCustomizations field
3. Extend to include theme/layout in ProjectData schema
4. Update project store and dashboard mount logic

**Effort:** Medium-High (3-4 hours)

---

### Option C: Use projects.settings JSON Field

**Pros:**
- ✅ Field already exists
- ✅ Flexible JSON storage
- ✅ Simple to implement

**Cons:**
- ❌ Unstructured data (no schema validation)
- ❌ Requires parsing entire settings object
- ❌ No versioning or change tracking
- ❌ Harder to query/index

**Implementation:**
1. Create `/api/projects/[id]/settings/route.ts`
2. Extend settings JSON with dashboardConfig key
3. Update GET /projects to return settings.dashboardConfig
4. Update project store and dashboard mount logic

**Effort:** Low-Medium (2 hours)

---

## Recommended Implementation Plan

### Phase 1: Create API Endpoints (2 hours)

**Files to Create:**
1. `/app/api/projects/[id]/config/route.ts`
   - GET handler - fetch dashboard config
   - PUT handler - save dashboard config
   - Use dashboard_configs table
   - Include auth and rate limiting

**Database Migration:**
```sql
-- No migration needed - table already exists
-- Verify unique constraint:
SELECT * FROM dashboard_configs
WHERE userId = ? AND projectId = ? AND sessionId IS NULL;
```

---

### Phase 2: Update Project Store (1 hour)

**File:** `/lib/stores/project-store.ts`

**Changes:**
1. Update `saveDashboardConfig()` - add API call
2. Update `loadDashboardConfig()` - add API fetch
3. Add error handling and retry logic
4. Keep localStorage as fallback/cache

---

### Phase 3: Update Dashboard Mount (1 hour)

**File:** `/app/dashboard/page.tsx`

**Changes:**
1. Add config fetch after loading project data
2. Apply config to Zustand store
3. Handle missing/corrupt config gracefully
4. Add loading states

---

### Phase 4: Testing (1 hour)

**Test Scenarios:**
1. ✅ Save dashboard → Reload → Verify customizations persist
2. ✅ Add chart → Save → Reload → Verify chart exists
3. ✅ Remove chart → Save → Reload → Verify chart is gone
4. ✅ Move chart → Save → Reload → Verify new position
5. ✅ Edit chart data mapping → Save → Reload → Verify mapping
6. ✅ Change theme → Save → Reload → Verify theme
7. ✅ Clear localStorage → Reload → Verify loads from database
8. ✅ Switch devices → Verify config syncs

---

## Migration Strategy

### Backward Compatibility

**Challenge:** Existing users have dashboard configs in localStorage only

**Solution:**
```typescript
// In dashboard mount effect
const loadDashboardConfig = async (projectId: string) => {
  // 1. Try loading from database
  const dbConfig = await fetchConfigFromDatabase(projectId)

  if (dbConfig) {
    // Database has config - use it
    return dbConfig
  }

  // 2. Fallback to localStorage
  const localConfig = loadDashboardConfigFromLocalStorage(projectId)

  if (localConfig) {
    // Migrate localStorage config to database
    try {
      await saveDashboardConfigToDatabase(projectId, localConfig)
      console.log('✅ Migrated localStorage config to database')
    } catch (error) {
      console.warn('⚠️ Failed to migrate config to database:', error)
    }
    return localConfig
  }

  // 3. No config found - return null
  return null
}
```

---

## Performance Considerations

### Caching Strategy

**Problem:** Fetching config on every dashboard load adds latency

**Solution:**
```typescript
// Cache config in Zustand store with TTL
interface ConfigCache {
  projectId: string
  config: DashboardConfig
  fetchedAt: number
  ttl: number // 5 minutes
}

const getConfigWithCache = async (projectId: string) => {
  const cached = get().configCache[projectId]

  // Return cache if fresh
  if (cached && Date.now() - cached.fetchedAt < cached.ttl) {
    return cached.config
  }

  // Fetch from database
  const config = await fetchConfigFromDatabase(projectId)

  // Update cache
  set((state) => ({
    configCache: {
      ...state.configCache,
      [projectId]: {
        projectId,
        config,
        fetchedAt: Date.now(),
        ttl: 5 * 60 * 1000 // 5 minutes
      }
    }
  }))

  return config
}
```

---

## Security Considerations

1. **Authorization:** Verify user owns project before returning config
2. **Rate Limiting:** Apply RATE_LIMITS.SESSION to config endpoints
3. **Input Validation:** Validate config structure before saving
4. **XSS Prevention:** Sanitize any user-provided strings in config
5. **Size Limits:** Limit config JSON size to prevent DoS

---

## Testing Checklist

### Unit Tests
- [ ] saveDashboardConfig saves to database
- [ ] saveDashboardConfig handles network errors
- [ ] loadDashboardConfig fetches from database
- [ ] loadDashboardConfig falls back to localStorage
- [ ] Config migration works correctly

### Integration Tests
- [ ] Full save/load cycle preserves all config
- [ ] Multi-device sync works
- [ ] Concurrent updates don't corrupt data
- [ ] localStorage and database stay in sync

### E2E Tests
- [ ] User saves dashboard changes
- [ ] User reloads page and sees changes
- [ ] User logs out, logs in, sees changes
- [ ] User switches devices, sees changes

---

## Rollout Plan

### Stage 1: API Endpoints (Low Risk)
- Deploy new GET/PUT /api/projects/[id]/config endpoints
- Monitor for errors
- No user-facing changes yet

### Stage 2: Dashboard Save (Medium Risk)
- Update saveDashboardConfig to call API
- Keep localStorage as fallback
- Add error logging
- Monitor save success rate

### Stage 3: Dashboard Load (High Risk)
- Update dashboard mount to fetch from database
- Keep localStorage as cache
- Add migration logic
- Gradual rollout with feature flag

### Stage 4: Cleanup (Low Risk)
- Remove localStorage fallbacks (optional)
- Add database indexes if needed
- Monitor performance

---

## Monitoring & Observability

### Metrics to Track
1. **Config Save Success Rate** - % of saves that succeed
2. **Config Load Latency** - Time to fetch config from database
3. **Migration Success Rate** - % of localStorage configs migrated
4. **Cache Hit Rate** - % of loads served from cache
5. **Error Rate by Endpoint** - Track failures per API endpoint

### Alerts
1. Save success rate < 95% → Page on-call
2. Load latency > 500ms → Warning
3. Error rate > 5% → Page on-call

---

## Code Locations Reference

### Files to Modify
1. `/lib/stores/project-store.ts` - Update save/load functions
2. `/app/dashboard/page.tsx` - Add config fetch on mount
3. `/components/dashboard/flexible-dashboard-layout.tsx` - Load config effect (already correct)
4. `/components/dashboard/save-dashboard-button.tsx` - No changes needed

### Files to Create
1. `/app/api/projects/[id]/config/route.ts` - New API endpoints
2. `/lib/utils/dashboard-config.ts` - Config validation utilities

### Database Tables
1. `dashboard_configs` - Primary storage (RECOMMENDED)
2. `projects` - Alternative: settings field
3. `project_data` - Alternative: chartCustomizations field

---

## Summary

**Current State:**
- Dashboard changes saved to localStorage only
- Database has the right schema but no code uses it
- Users lose all customizations when localStorage is cleared

**Required Changes:**
1. Create GET/PUT `/api/projects/[id]/config` endpoints
2. Update `saveDashboardConfig()` to call API
3. Update dashboard mount to fetch config from API
4. Add migration logic for existing localStorage configs

**Effort Estimate:** 5-6 hours total
**Risk Level:** Medium (requires database operations + state management changes)
**Impact:** High (core feature broken for all users)

---

**Next Steps:**
1. Review this analysis with team
2. Choose storage option (Option A recommended)
3. Create API endpoints
4. Update project store
5. Update dashboard mount
6. Test thoroughly
7. Deploy with monitoring
