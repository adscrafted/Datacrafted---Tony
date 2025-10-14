# Dashboard Data Loading Fix

## Issue Discovered

When uploading files from the home page, the dashboard showed **no data** (rawDataLength: 0) even though:
- ✅ Projects were created successfully
- ✅ Analysis was running
- ✅ `saveProjectData()` was being called

## Root Cause

The dashboard navigation uses `?id=project-xxx` (becomes `directId` parameter), but the dashboard only had logic to load project data when the `projectId` parameter existed.

**Flow breakdown**:
1. Home page uploads file
2. `handleUploadComplete` creates project → `project-1760208013239-0g6d6gjro`
3. `saveProjectData()` is called (lines 86-91 of app/page.tsx)
4. Navigation to `/dashboard?id=project-1760208013239-0g6d6gjro`
5. **❌ Dashboard had NO logic to load data from `directId`**
6. Dashboard showed empty (rawDataLength: 0)

## Fix Applied

**File**: `app/dashboard/page.tsx`
**Lines**: 143-190

Added handling for the `directId` parameter:

```typescript
// If we have a direct ID (from home page upload), load project data
if (directId) {
  const loadProjectData = async () => {
    console.log('🔵 [DASHBOARD] Loading project data from directId:', directId)
    try {
      // Try synchronous first (for small datasets in localStorage)
      let projectData = getProjectData(directId)

      // If not found, try async (for large datasets in IndexedDB or database)
      if (!projectData) {
        console.log('🌐 [DASHBOARD] Project data not in localStorage, trying async load...')
        projectData = await loadProjectDataAsync(directId)
      }

      if (projectData && projectData.rawData && projectData.rawData.length > 0) {
        const { setFileName, setRawData, setAnalysis, setDataSchema } = useDataStore.getState()
        setFileName(projectData.dataSchema?.fileName || 'Project Data')
        await setRawData(projectData.rawData)

        console.log('✅ [DASHBOARD] Project data loaded from directId:', {
          hasAnalysis: !!projectData.analysis,
          chartCount: projectData.analysis?.chartConfig?.length || 0,
          rowCount: projectData.rawData.length,
          directId
        })

        if (projectData.analysis) {
          setAnalysis(projectData.analysis)
        }
        if (projectData.dataSchema) {
          setDataSchema(projectData.dataSchema)
        }
        analysisInitiatedRef.current = false
      } else {
        console.warn('⚠️ [DASHBOARD] No project data found for directId:', directId)
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Failed to load project data from directId:', error)
      const { setError } = useDataStore.getState()
      setError('Failed to load project data')
    }
  }

  loadProjectData()
  return
}
```

Also updated the useEffect dependency array to include `directId`.

## Expected Behavior After Fix

When a file is uploaded from the home page:
1. Project created ✅
2. `saveProjectData()` called → API POST to `/api/projects/[id]/data` ✅
3. Navigate to `/dashboard?id=project-xxx` ✅
4. **Dashboard detects `directId`** ✅
5. **Calls `loadProjectDataAsync(directId)`** ✅
6. **API GET request to `/api/projects/[id]/data`** ✅
7. **Data loaded from database** ✅
8. **Dashboard displays data** ✅

## Testing Instructions

1. Go to http://localhost:3000
2. Upload a CSV file
3. Wait for processing to complete
4. Dashboard should load with data visible

**Watch for these console logs**:
```
🔵 [DASHBOARD] Loading project data from directId: project-xxx
🌐 [DASHBOARD] Project data not in localStorage, trying async load...
✅ [DASHBOARD] Project data loaded from directId: { rowCount: 130, ... }
```

**Watch for these server logs**:
```
[MIDDLEWARE] Request: { pathname: '/api/projects/[id]/data', method: 'GET' }
[API PROJECT DATA] GET request: { projectId: 'project-xxx', ... }
```

## Status

- ✅ Fix implemented
- ⏳ Awaiting user testing
- ⏳ Need to verify API calls appear in server logs

## Next Steps

User should:
1. Upload a new file
2. Check browser console for dashboard load logs
3. Check server console for API GET requests to `/api/projects/[id]/data`
4. Verify dashboard displays the uploaded data
5. Test multi-device access (open from different browser)

---

**Date**: 2025-10-12
**Fixed By**: Claude Code Assistant
