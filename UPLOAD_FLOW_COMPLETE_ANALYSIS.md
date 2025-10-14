# Upload Flow Complete Analysis - State Loss Investigation

## Executive Summary

After reviewing the entire upload flow from landing page to dashboard, I've identified **critical state management issues** that could cause data loss during navigation. The flow involves multiple state stores, asynchronous operations, and timing-dependent navigation logic.

---

## Complete Upload Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    1. LANDING PAGE (app/page.tsx)                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  User drops/selects file in FileUploadCore component                │
│  - File validation (size, type)                                     │
│  - Sets selectedFile state                                           │
│  - Calls onDrop → handleFileProcessing()                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. FILE PROCESSING (components/upload/file-upload-core.tsx)        │
│                                                                       │
│  handleFileProcessing() executes:                                    │
│  ✓ setIsAnalyzing(true) - triggers upload status bar               │
│  ✓ setFileName(file.name)                                           │
│  ✓ setUploadStage('uploading') → 'parsing' → 'analyzing'           │
│  ✓ parseFileOptimized(file) - parses CSV/Excel                     │
│  ✓ await setRawData(result.data) - CRITICAL: stores in dataStore   │
│  ✓ analyzeDataSchema() - analyzes structure                         │
│  ✓ setDataSchema(schema) - stores schema                            │
│  ✓ setIsAnalyzing(false) - marks upload complete                    │
│  ✓ setUploadStage('saving')                                         │
│                                                                       │
│  After 500ms delay:                                                  │
│  ✓ Calls onUploadComplete(finalState.rawData)                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. UPLOAD COMPLETE HANDLER (app/page.tsx)                          │
│                                                                       │
│  handleUploadComplete() executes:                                    │
│  ✓ setUploadProgress(100)                                           │
│  ✓ Gets current store state (rawData, fileName, dataSchema)        │
│  ✓ await createProject() - creates project in project store        │
│     - Tries API call to /api/projects (POST)                        │
│     - Falls back to local creation if API fails                     │
│     - Returns project with new ID                                   │
│  ✓ await saveProjectData() - saves data to storage                 │
│     - Tries API call to /api/projects/{id}/data (POST)             │
│     - Falls back to IndexedDB if API fails                          │
│     - Updates project with dataStorageId reference                  │
│  ✓ setUploadProjectId(project.id) - CRITICAL STATE                 │
│  ✓ setUploadComplete(true) - triggers navigation                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. UPLOAD STATUS BAR (components/ui/upload-status-bar.tsx)        │
│                                                                       │
│  useEffect watches uploadComplete && uploadProjectId:               │
│  - Sets all stages as 'complete'                                     │
│  - After 1500ms delay:                                               │
│    ✓ router.push(`/dashboard?id=${uploadProjectId}`)               │
│    ✓ setIsVisible(false)                                            │
│    ✓ dismissUpload() - clears upload state                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. DASHBOARD PAGE (app/dashboard/page.tsx)                         │
│                                                                       │
│  URL: /dashboard?id={projectId}                                      │
│  Extracts: directId = searchParams.get('id')                        │
│                                                                       │
│  useEffect with directId dependency:                                 │
│  ✓ Checks if directId exists AND not already loaded                │
│  ✓ Sets isLoadingFromAPI = true                                     │
│  ✓ Marks loadedProjectIdRef.current = directId                     │
│  ✓ Calls /api/projects/{directId}/data (GET)                       │
│  ✓ Receives: { data, analysis, schema, metadata }                  │
│  ✓ setFileName(metadata.name)                                       │
│  ✓ await setRawData(data) - loads data into store                  │
│  ✓ setAnalysis(analysis) if exists                                  │
│  ✓ setDataSchema(schema) if exists                                  │
│  ✓ Sets isLoadingFromAPI = false                                    │
│                                                                       │
│  Second useEffect (analysis trigger):                                │
│  ✓ If rawData exists but no analysis:                               │
│    - Calls performAnalysis() - AI analysis                          │
│    - Sets analysis in store                                          │
│                                                                       │
│  Loading screen shows while:                                         │
│  - isLoadingFromAPI is true                                          │
│  - isAnalyzing is true                                               │
│  - rawData exists but no analysis                                    │
│                                                                       │
│  Dashboard renders when:                                             │
│  - rawData.length > 0                                                │
│  - analysis exists                                                    │
│  - !isLoadingFromAPI && !isAnalyzing                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## State Stores Involved

### 1. useDataStore (lib/store.ts)
**Purpose:** Main application data store
**Key State:**
```typescript
{
  fileName: string | null
  rawData: DataRow[]
  dataSchema: DataSchema | null
  analysis: AnalysisResult | null
  isAnalyzing: boolean
  uploadProgress: number
  uploadStage: string | null
  uploadComplete: boolean
  uploadProjectId: string | null
}
```

### 2. useProjectStore (lib/stores/project-store.ts)
**Purpose:** Project management and persistence
**Key State:**
```typescript
{
  projects: Project[]
  currentProjectId: string | null
  loadingProjectData: Record<string, boolean>
}
```

**Project Structure:**
```typescript
{
  id: string
  userId: string
  name: string
  dataStorageId?: string // Reference to IndexedDB
  debugData?: {          // Direct data storage (small datasets)
    rawData: DataRow[]
    analysis: AnalysisResult | null
    dataSchema: DataSchema | null
  }
}
```

---

## Critical Issues Identified

### Issue #1: Race Condition Between Upload Complete and Navigation

**Location:** `app/page.tsx` handleUploadComplete() + `components/ui/upload-status-bar.tsx`

**Problem:**
```typescript
// app/page.tsx - Line 92-95
setUploadProjectId(project.id)
setUploadComplete(true)
// These trigger navigation immediately...

// components/ui/upload-status-bar.tsx - Line 61-75
useEffect(() => {
  if (uploadComplete && uploadProjectId) {
    const timer = setTimeout(() => {
      router.push(`/dashboard?id=${uploadProjectId}`)
      setIsVisible(false)
      dismissUpload()  // CLEARS uploadProjectId and uploadComplete!
    }, 1500)
  }
}, [uploadComplete, uploadProjectId, router, dismissUpload])
```

**Impact:**
- dismissUpload() clears uploadProjectId BEFORE dashboard loads
- Dashboard may try to read uploadProjectId that no longer exists
- Timing-dependent - may work sometimes, fail other times

**Evidence:**
```typescript
// lib/store.ts - Line 2124-2129
dismissUpload: () => set({
  uploadProgress: 0,
  uploadStage: null,
  uploadComplete: false,
  uploadProjectId: null,  // ← CLEARED!
}),
```

---

### Issue #2: Asynchronous State Updates Not Awaited

**Location:** `app/page.tsx` handleUploadComplete()

**Problem:**
```typescript
// Lines 81-89 - No await on critical operations
if (currentState.rawData && currentState.rawData.length > 0) {
  await saveProjectData(
    project.id,
    currentState.rawData,
    currentState.analysis || undefined,
    currentState.dataSchema || undefined
  )
  console.log('✅ [PAGE] Project data saved')
}

// Lines 92-93 - Immediately triggers navigation
setUploadProjectId(project.id)
setUploadComplete(true)  // Navigation starts WHILE saveProjectData may still be running
```

**Impact:**
- Navigation to dashboard may occur BEFORE data is fully saved
- Dashboard tries to load data that hasn't been committed to storage yet
- Race condition between save operation and load operation

---

### Issue #3: Dashboard Data Loading Logic Fragility

**Location:** `app/dashboard/page.tsx` Lines 148-218

**Problem:** Complex conditional loading logic with multiple paths

```typescript
// Lines 148-218
useEffect(() => {
  // CRITICAL FIX: Handle directId (from upload flow) by loading from API
  if (directId && loadedProjectIdRef.current !== directId) {
    console.log('🔵 [DASHBOARD] Loading project data from directId:', directId)
    loadedProjectIdRef.current = directId
    setIsLoadingFromAPI(true)

    // ... async load from API ...
  }
  // ... more conditional logic ...
}, [rawData, analysis, isAnalyzing, sessionId, currentSession, projectId])
```

**Issues:**
1. **Ref-based deduplication** - loadedProjectIdRef may prevent reload if stale
2. **Multiple dependencies** - effect runs on many state changes, could miss updates
3. **No error recovery** - if API fails, no retry mechanism
4. **Timing assumptions** - assumes data will be available when API is called

---

### Issue #4: State Not Persisted Between Routes

**Location:** Store persistence configuration

**Problem:**
```typescript
// lib/store.ts - Lines 2187-2226
persist(
  (set, get) => ({ /* store logic */ }),
  {
    name: 'datacrafted-store',
    partialize: (state) => ({
      recentSessions: state.recentSessions,
      currentTheme: state.currentTheme,
      // ... other fields ...
      fileName: state.fileName,
      dataId: state.dataId,
      dataSchema: state.dataSchema,
      analysis: state.analysis,
      // rawData is NOT persisted! ← ISSUE
      hasData: state.rawData && state.rawData.length > 0,
    })
  }
)
```

**Impact:**
- rawData is deliberately NOT persisted to localStorage
- If page reloads or navigation occurs, rawData must be reloaded
- Relies on IndexedDB or API to restore data
- **If upload dismissal clears state before load, data is lost**

---

### Issue #5: Upload Dismissal Happens Too Early

**Location:** `components/ui/upload-status-bar.tsx` Line 70

**Problem:**
```typescript
const timer = setTimeout(() => {
  router.push(`/dashboard?id=${uploadProjectId}`)
  setIsVisible(false)
  dismissUpload()  // ← Clears state immediately after navigation
}, 1500)
```

**Timeline:**
```
T=0ms:    uploadComplete=true, uploadProjectId='proj-123'
T=1500ms: Navigation initiated to /dashboard?id=proj-123
T=1500ms: dismissUpload() called → uploadProjectId cleared
T=1600ms: Dashboard component mounts, reads directId from URL
T=1600ms: Dashboard tries to access uploadProjectId from store → UNDEFINED!
T=1700ms: API call to /api/projects/proj-123/data
```

**The Problem:**
- Navigation and dismissal happen in **same tick**
- If dashboard needs uploadProjectId from store, it's already cleared
- Dashboard must rely solely on URL parameter (which is correct, but fragile)

---

## Data Flow States

### State 1: Upload Complete (Landing Page)
```typescript
useDataStore: {
  fileName: 'data.csv',
  rawData: [...1000 rows...],
  dataSchema: {...},
  uploadProjectId: 'proj-123',
  uploadComplete: true,
  isAnalyzing: false
}

useProjectStore: {
  projects: [
    {
      id: 'proj-123',
      name: 'data.csv',
      dataStorageId: 'storage-456', // IndexedDB reference
      debugData: undefined  // Not stored here for large files
    }
  ]
}
```

### State 2: During Navigation (1500ms delay)
```typescript
// Navigation starts
router.push('/dashboard?id=proj-123')

// Immediately after
dismissUpload() // ← CLEARS STATE

useDataStore: {
  fileName: 'data.csv',
  rawData: [...1000 rows...],  // Still in memory (not cleared by dismissUpload)
  dataSchema: {...},
  uploadProjectId: null,       // ← CLEARED!
  uploadComplete: false,       // ← CLEARED!
  isAnalyzing: false
}
```

### State 3: Dashboard Mount (New Route)
```typescript
// URL: /dashboard?id=proj-123
// directId extracted from searchParams

// Dashboard tries to load:
1. Check if rawData exists in store → YES (still in memory)
2. Check if analysis exists in store → NO (analysis happens later)
3. Check if directId matches loadedProjectIdRef → NO (first load)
4. Trigger API load: GET /api/projects/proj-123/data
5. Wait for response...
```

### State 4: After API Response
```typescript
useDataStore: {
  fileName: 'data.csv',
  rawData: [...1000 rows...],  // Loaded from API
  dataSchema: {...},           // Loaded from API
  analysis: {...},             // Loaded from API OR generated by AI
  isAnalyzing: false,
  isLoadingFromAPI: false
}

// Dashboard renders with data
```

---

## Potential Failure Scenarios

### Scenario A: API Save Fails, Navigation Proceeds
```
1. Upload completes, data in memory
2. createProject() succeeds (local or API)
3. saveProjectData() FAILS (network error, API down)
   - Error logged but not thrown
   - No data persisted to storage
4. setUploadProjectId() and setUploadComplete() called anyway
5. Navigation to dashboard with project ID
6. Dashboard tries to load: GET /api/projects/{id}/data
7. API returns 404 - No data saved
8. Dashboard shows error or empty state
9. USER LOSES DATA
```

**Fix Needed:** Don't navigate if saveProjectData fails

---

### Scenario B: Race Between Save and Load
```
1. Upload completes
2. saveProjectData() starts (async, takes 2000ms for large file)
3. Navigation triggers after 500ms
4. Dashboard mounts, calls GET /api/projects/{id}/data immediately
5. API responds: "Data not found" (save still in progress)
6. Dashboard shows error
7. Save completes 1500ms later (too late)
8. Data is saved but dashboard already errored out
```

**Fix Needed:** Await saveProjectData before allowing navigation

---

### Scenario C: Store State Lost on Navigation
```
1. Upload completes, data in useDataStore.rawData
2. Navigation triggered
3. dismissUpload() clears uploadProjectId
4. If navigation causes component unmount/remount:
   - Zustand persist may not have synced yet
   - rawData might be lost from memory
5. Dashboard loads with empty store
6. API call needed to restore data
7. If API fails, data is permanently lost
```

**Fix Needed:** Ensure data is persisted BEFORE navigation

---

### Scenario D: Concurrent Upload State Cleanup
```
1. User uploads file A
2. Processing starts
3. User cancels and uploads file B (before A completes)
4. Both upload processes running concurrently
5. dismissUpload() called for A
6. Upload B state gets cleared inadvertently
7. Upload B completes but state is already cleared
8. Navigation fails or navigates with wrong ID
```

**Fix Needed:** Better upload state management with unique IDs

---

## Loading State Conditions Analysis

### Dashboard Loading Screen Logic
**Location:** `app/dashboard/page.tsx` Lines 378-456

```typescript
const shouldShowLoading = isLoadingFromAPI ||
                          isAnalyzing ||
                          (rawData && rawData.length > 0 && !analysis) ||
                          (fileName && !rawData) ||
                          (dataId && (!rawData || rawData.length === 0))
```

**Condition Breakdown:**

1. **isLoadingFromAPI**: Set when loading from API endpoint
   - ✓ Good: Prevents UI flash while data loads
   - ⚠️ Issue: Not set if loading from IndexedDB fallback

2. **isAnalyzing**: Set during AI analysis
   - ✓ Good: Shows progress during analysis
   - ⚠️ Issue: Cleared immediately after upload, before navigation

3. **(rawData && !analysis)**: Has data but no analysis yet
   - ✓ Good: Triggers analysis generation
   - ⚠️ Issue: If analysis fails, stuck in loading state

4. **(fileName && !rawData)**: Filename set but data not loaded
   - ✓ Good: Indicates data needs to be fetched
   - ⚠️ Issue: Edge case if only filename persists after reload

5. **(dataId && !rawData)**: IndexedDB reference but data not loaded
   - ✓ Good: Triggers IndexedDB data load
   - ⚠️ Issue: No automatic load triggered, waits for manual fetch

---

## URL Parameter Flow

### Upload Status Bar Navigation
**Location:** `components/ui/upload-status-bar.tsx` Line 68

```typescript
router.push(`/dashboard?id=${uploadProjectId}`)
```

**URL Format:** `/dashboard?id=proj-1234567890-abc123`

### Dashboard Parameter Extraction
**Location:** `app/dashboard/page.tsx` Lines 32-35

```typescript
const searchParams = useSearchParams()
const sessionId = searchParams.get('session')
const projectId = searchParams.get('project')
const directId = searchParams.get('id')  // ← Used for upload flow
```

### Parameter Priority
```typescript
// Lines 38-53
useEffect(() => {
  // Priority 1: Old project-based routing (redirects away)
  if (projectId) {
    router.replace(`/projects/${projectId}`)
    return
  }

  // Priority 2: No parameters at all - check store
  if (!sessionId && !projectId && !directId) {
    const storeData = useDataStore.getState()
    if (!storeData.rawData || storeData.rawData.length === 0) {
      router.replace('/')  // Redirect to landing
      return
    }
  }
}, [projectId, sessionId, directId, router])
```

**Critical Finding:**
- **directId** is the ONLY parameter used for the upload → dashboard flow
- If directId is missing or invalid, dashboard redirects to landing page
- If URL parameter is lost during navigation, flow breaks

---

## Recommendations

### Priority 1: Fix Upload Complete → Navigation Flow

**Current Code (app/page.tsx):**
```typescript
// Lines 92-95 - BROKEN
setUploadProjectId(project.id)
setUploadComplete(true)
```

**Recommended Fix:**
```typescript
// Don't trigger navigation immediately
// Let the upload status bar handle it AFTER ensuring data is saved
try {
  const project = await createProject({...})

  // CRITICAL: Await save completion before proceeding
  await saveProjectData(
    project.id,
    currentState.rawData,
    currentState.analysis,
    currentState.dataSchema
  )

  // Verify data was actually saved
  const verifyResponse = await fetch(`/api/projects/${project.id}/data`)
  if (!verifyResponse.ok) {
    throw new Error('Data save verification failed')
  }

  // Only NOW trigger navigation
  setUploadProjectId(project.id)
  setUploadComplete(true)

} catch (error) {
  console.error('Failed to save project:', error)
  setError('Failed to save your data. Please try again.')
  // DON'T trigger navigation on failure
}
```

---

### Priority 2: Delay Upload Dismissal

**Current Code (upload-status-bar.tsx):**
```typescript
// Lines 67-72 - BROKEN
const timer = setTimeout(() => {
  router.push(`/dashboard?id=${uploadProjectId}`)
  setIsVisible(false)
  dismissUpload()  // ← TOO EARLY!
}, 1500)
```

**Recommended Fix:**
```typescript
// Dismiss upload state AFTER dashboard confirms load
const timer = setTimeout(() => {
  router.push(`/dashboard?id=${uploadProjectId}`)
  setIsVisible(false)

  // Wait for dashboard to load before clearing state
  setTimeout(() => {
    dismissUpload()
  }, 5000)  // Give dashboard time to load from API
}, 1500)

// OR better: Listen for a custom event from dashboard
window.addEventListener('dashboard-loaded', () => {
  dismissUpload()
})
```

---

### Priority 3: Add State Verification Before Navigation

**New Code (app/page.tsx):**
```typescript
const verifyStateBeforeNavigation = async (projectId: string) => {
  console.log('🔍 Verifying state before navigation...')

  // Check 1: Data exists in store
  const state = useDataStore.getState()
  if (!state.rawData || state.rawData.length === 0) {
    throw new Error('No data in store')
  }

  // Check 2: Project exists
  const project = await useProjectStore.getState().loadProject(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  // Check 3: Data accessible from API or IndexedDB
  try {
    const response = await fetch(`/api/projects/${projectId}/data`)
    if (!response.ok) {
      // Try IndexedDB fallback
      const projectData = await useProjectStore.getState().loadProjectDataAsync(projectId)
      if (!projectData) {
        throw new Error('Data not accessible')
      }
    }
  } catch (error) {
    throw new Error('Data verification failed')
  }

  console.log('✅ State verification passed')
  return true
}

// Use it:
await verifyStateBeforeNavigation(project.id)
setUploadProjectId(project.id)
setUploadComplete(true)
```

---

### Priority 4: Improve Dashboard Loading Recovery

**New Code (app/dashboard/page.tsx):**
```typescript
// Add retry logic for failed loads
const [retryCount, setRetryCount] = useState(0)
const MAX_RETRIES = 3

useEffect(() => {
  if (directId && loadedProjectIdRef.current !== directId) {
    loadedProjectIdRef.current = directId
    setIsLoadingFromAPI(true)

    const loadWithRetry = async (attempt = 0) => {
      try {
        const response = await fetch(`/api/projects/${directId}/data`)
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        const projectData = await response.json()
        // ... set data in store ...

      } catch (error) {
        console.error(`Load attempt ${attempt + 1} failed:`, error)

        if (attempt < MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          setTimeout(() => {
            setRetryCount(attempt + 1)
            loadWithRetry(attempt + 1)
          }, delay)
        } else {
          // Final fallback: try IndexedDB
          const fallbackData = await useProjectStore.getState()
            .loadProjectDataAsync(directId)

          if (fallbackData) {
            setRawData(fallbackData.rawData)
            setAnalysis(fallbackData.analysis)
            setDataSchema(fallbackData.dataSchema)
          } else {
            setError('Failed to load project data after multiple attempts')
          }
        }
      } finally {
        setIsLoadingFromAPI(false)
      }
    }

    loadWithRetry()
  }
}, [directId, retryCount])
```

---

## Testing Checklist

### Scenario Tests

#### Test 1: Normal Upload Flow
```
1. Go to landing page
2. Upload CSV file (< 1MB)
3. Wait for processing
4. Verify navigation to dashboard
5. Verify data displays correctly
6. Check browser console for errors
7. Refresh page - verify data persists
```

#### Test 2: Large File Upload
```
1. Upload CSV file (> 10MB)
2. Monitor network tab during save
3. Ensure navigation waits for save completion
4. Verify IndexedDB contains data
5. Check API /api/projects/{id}/data works
```

#### Test 3: Failed API Save
```
1. Block /api/projects/* in devtools network tab
2. Upload file
3. Verify error handling
4. Verify no navigation occurs
5. Verify data not lost from memory
6. Unblock API and retry
```

#### Test 4: Concurrent Uploads
```
1. Upload file A
2. During processing, upload file B
3. Verify only file B processes
4. Verify file A processing cancelled
5. Verify clean state after B completes
```

#### Test 5: Navigation Interruption
```
1. Upload file
2. During navigation delay (1500ms), click browser back
3. Verify state not corrupted
4. Verify can re-upload
```

#### Test 6: Dashboard Direct Access
```
1. Upload file, get project ID
2. Copy dashboard URL
3. Close tab
4. Open new tab, paste URL
5. Verify data loads from API/IndexedDB
```

---

## Performance Metrics to Monitor

```typescript
// Add to components
import { startTiming, endTiming } from '@/lib/utils/performance-monitor'

// Measure critical operations
startTiming('upload_to_navigation', {}, ['upload', 'performance'])
// ... upload flow ...
endTiming('upload_to_navigation', { success: true })

startTiming('dashboard_data_load', {}, ['dashboard', 'performance'])
// ... load data ...
endTiming('dashboard_data_load', { dataSize: data.length })
```

**Key Metrics:**
- Time from upload complete to navigation start
- Time from navigation start to dashboard render
- Time from API request to data display
- Success rate of API saves
- Fallback to IndexedDB frequency

---

## Conclusion

The upload flow has **multiple critical points of failure** related to:
1. **Timing issues** - Asynchronous operations not awaited
2. **State cleanup** - Upload state cleared before dashboard loads
3. **Race conditions** - Save and load operations overlapping
4. **No verification** - Navigation proceeds even if save fails
5. **Weak error recovery** - Failed loads have no retry mechanism

**Immediate Actions Required:**
1. Await saveProjectData before allowing navigation
2. Delay dismissUpload until dashboard confirms load
3. Add state verification before navigation
4. Implement retry logic for failed API calls
5. Add comprehensive error handling throughout flow

**Impact:** HIGH - These issues can cause complete data loss and poor user experience.
