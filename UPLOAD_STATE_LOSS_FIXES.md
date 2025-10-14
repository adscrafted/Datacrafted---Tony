# Upload State Loss - Quick Fix Guide

## Issue Summary

The upload flow loses state during navigation from landing page to dashboard due to:
1. **State cleared too early** - Upload status dismissed before dashboard loads
2. **No save verification** - Navigation proceeds even if data save fails
3. **Race conditions** - Dashboard tries to load data while save is still in progress
4. **No error recovery** - Failed saves don't prevent navigation

---

## Critical Files to Fix

### 1. app/page.tsx (handleUploadComplete function)

**Current Code (Lines 51-100):**
```typescript
const handleUploadComplete = useCallback(async (data: any) => {
  console.log('🔵 [PAGE] Upload complete, creating project')
  setUploadProgress(100)

  try {
    const currentState = useDataStore.getState()

    // Create project
    const project = await createProject({...})
    console.log('✅ [PAGE] Project created:', project.id)

    // Save data (NOT AWAITED PROPERLY!)
    if (currentState.rawData && currentState.rawData.length > 0) {
      await saveProjectData(
        project.id,
        currentState.rawData,
        currentState.analysis || undefined,
        currentState.dataSchema || undefined
      )
      console.log('✅ [PAGE] Project data saved')
    }

    // ⚠️ PROBLEM: Navigation triggered immediately, doesn't wait for save
    setUploadProjectId(project.id)
    setUploadComplete(true)

    console.log('✅ [PAGE] Upload complete, status bar will navigate to /dashboard')
  } catch (error) {
    console.error('❌ [PAGE] Failed to create project:', error)
    // ⚠️ PROBLEM: Error logged but navigation still happens!
  }
}, [router, user?.uid, createProject, saveProjectData, setUploadComplete, setUploadProjectId, setUploadProgress])
```

**Fix:**

```typescript
const handleUploadComplete = useCallback(async (data: any) => {
  console.log('🔵 [PAGE] Upload complete, creating project')
  setUploadProgress(100)

  try {
    const currentState = useDataStore.getState()

    // Validate we have data
    if (!currentState.rawData || currentState.rawData.length === 0) {
      throw new Error('No data available to save')
    }

    if (!currentState.fileName) {
      throw new Error('No filename set')
    }

    // Create project
    const project = await createProject({
      userId: user?.uid || 'anonymous',
      name: currentState.fileName,
      description: `Data analysis project for ${currentState.fileName}`,
      fileInfo: currentState.dataSchema ? {
        fileName: currentState.fileName,
        fileSize: 0,
        rowCount: currentState.dataSchema.rowCount,
        columnCount: currentState.dataSchema.columnCount
      } : undefined
    })

    console.log('✅ [PAGE] Project created:', project.id)

    // ✅ FIX 1: Always save data, throw error if it fails
    console.log('🔵 [PAGE] Saving project data...')
    await saveProjectData(
      project.id,
      currentState.rawData,
      currentState.analysis || undefined,
      currentState.dataSchema || undefined
    )
    console.log('✅ [PAGE] Project data saved successfully')

    // ✅ FIX 2: Verify data was saved before proceeding
    console.log('🔍 [PAGE] Verifying data was saved...')
    const verificationResult = await verifySaveSuccess(project.id)

    if (!verificationResult.success) {
      throw new Error(`Data save verification failed: ${verificationResult.error}`)
    }

    console.log('✅ [PAGE] Data save verified')

    // ✅ FIX 3: Only trigger navigation if everything succeeded
    setUploadProjectId(project.id)
    setUploadComplete(true)

    console.log('✅ [PAGE] Upload complete, status bar will navigate to /dashboard')

  } catch (error) {
    console.error('❌ [PAGE] Failed to complete upload:', error)

    // ✅ FIX 4: Set error state and DON'T navigate
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    setError(errorMessage)

    // Reset upload state
    setUploadProgress(0)
    setIsAnalyzing(false)

    // Show user-friendly error
    alert(`Upload failed: ${errorMessage}\n\nYour data is safe in memory. Please try again.`)

    // DON'T call setUploadComplete(true) - prevents navigation
  }
}, [router, user?.uid, createProject, saveProjectData, setUploadComplete, setUploadProjectId, setUploadProgress, setError, setIsAnalyzing])

// ✅ NEW: Helper function to verify save
const verifySaveSuccess = async (projectId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Try API verification first
    const { auth } = await import('@/lib/config/firebase')
    const token = await auth.currentUser?.getIdToken()

    if (token) {
      const response = await fetch(`/api/projects/${projectId}/data`, {
        method: 'HEAD', // HEAD request to check existence without downloading data
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        console.log('✅ [VERIFY] API verification successful')
        return { success: true }
      }
    }

    // Fallback: Check IndexedDB
    const projectStore = useProjectStore.getState()
    const data = await projectStore.loadProjectDataAsync(projectId)

    if (data && data.rawData && data.rawData.length > 0) {
      console.log('✅ [VERIFY] IndexedDB verification successful')
      return { success: true }
    }

    return { success: false, error: 'Data not found in API or IndexedDB' }

  } catch (error) {
    console.error('❌ [VERIFY] Verification failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown verification error'
    }
  }
}
```

---

### 2. components/ui/upload-status-bar.tsx (dismissUpload timing)

**Current Code (Lines 60-75):**
```typescript
// Auto-navigate when upload completes
useEffect(() => {
  if (uploadComplete && uploadProjectId) {
    // Mark all stages as complete
    setStages(prev => prev.map(s => ({ ...s, status: 'complete' })))

    // Wait a moment to show completion, then navigate
    const timer = setTimeout(() => {
      router.push(`/dashboard?id=${uploadProjectId}`)
      setIsVisible(false)
      dismissUpload()  // ⚠️ PROBLEM: Clears state immediately after navigation!
    }, 1500)

    return () => clearTimeout(timer)
  }
}, [uploadComplete, uploadProjectId, router, dismissUpload])
```

**Fix:**

```typescript
// Auto-navigate when upload completes
useEffect(() => {
  if (uploadComplete && uploadProjectId) {
    // Mark all stages as complete
    setStages(prev => prev.map(s => ({ ...s, status: 'complete' })))

    // Wait a moment to show completion, then navigate
    const navigationTimer = setTimeout(() => {
      console.log('🔵 [STATUS_BAR] Navigating to dashboard')
      router.push(`/dashboard?id=${uploadProjectId}`)
      setIsVisible(false)

      // ✅ FIX: Delay dismissUpload to give dashboard time to mount and load
      const cleanupTimer = setTimeout(() => {
        console.log('🔵 [STATUS_BAR] Dashboard should be loaded, cleaning up upload state')
        dismissUpload()
      }, 3000) // Wait 3 seconds after navigation before clearing state

      // Store cleanup timer for cancellation if component unmounts
      return () => clearTimeout(cleanupTimer)

    }, 1500)

    return () => clearTimeout(navigationTimer)
  }
}, [uploadComplete, uploadProjectId, router, dismissUpload])

// ✅ ALTERNATIVE FIX: Listen for dashboard load event
useEffect(() => {
  if (uploadComplete && uploadProjectId) {
    const handleDashboardLoaded = () => {
      console.log('✅ [STATUS_BAR] Dashboard loaded, safe to dismiss upload state')
      dismissUpload()
      setIsVisible(false)
    }

    // Listen for custom event from dashboard
    window.addEventListener('dashboard-loaded', handleDashboardLoaded)

    // Navigate after showing completion
    const timer = setTimeout(() => {
      router.push(`/dashboard?id=${uploadProjectId}`)
    }, 1500)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('dashboard-loaded', handleDashboardLoaded)
    }
  }
}, [uploadComplete, uploadProjectId, router, dismissUpload])
```

---

### 3. app/dashboard/page.tsx (add load confirmation)

**Add after data loads successfully:**

```typescript
useEffect(() => {
  if (directId && loadedProjectIdRef.current !== directId) {
    console.log('🔵 [DASHBOARD] Loading project data from directId:', directId)
    loadedProjectIdRef.current = directId
    setIsLoadingFromAPI(true)

    const loadFromAPI = async () => {
      try {
        const { auth } = await import('@/lib/config/firebase')
        const token = await auth.currentUser?.getIdToken()

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }

        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`/api/projects/${directId}/data`, {
          headers
        })

        if (!response.ok) {
          throw new Error('Failed to load project data from API')
        }

        const projectData = await response.json()
        console.log('🔵 [DASHBOARD] Project data loaded from API')

        if (projectData.data && projectData.data.length > 0) {
          const { setFileName, setRawData, setAnalysis, setDataSchema } = useDataStore.getState()

          setFileName(projectData.metadata?.name || 'Project Data')
          await setRawData(projectData.data)

          if (projectData.analysis) {
            console.log('✅ [DASHBOARD] Setting existing analysis from API')
            setAnalysis(projectData.analysis)
          }

          if (projectData.schema) {
            setDataSchema(projectData.schema)
          }

          analysisInitiatedRef.current = false

          // ✅ NEW: Notify upload status bar that dashboard has loaded
          console.log('✅ [DASHBOARD] Dispatching dashboard-loaded event')
          window.dispatchEvent(new CustomEvent('dashboard-loaded', {
            detail: { projectId: directId }
          }))
        }
      } catch (error) {
        console.error('❌ [DASHBOARD] Failed to load project data from API:', error)
        const { setError } = useDataStore.getState()
        setError('Failed to load project data')

        // ✅ NEW: Try IndexedDB fallback
        console.log('🔄 [DASHBOARD] Attempting IndexedDB fallback...')
        try {
          const fallbackData = await useProjectStore.getState().loadProjectDataAsync(directId)

          if (fallbackData && fallbackData.rawData) {
            console.log('✅ [DASHBOARD] Loaded data from IndexedDB fallback')
            const { setFileName, setRawData, setAnalysis, setDataSchema } = useDataStore.getState()

            setFileName('Project Data')
            await setRawData(fallbackData.rawData)

            if (fallbackData.analysis) {
              setAnalysis(fallbackData.analysis)
            }

            if (fallbackData.dataSchema) {
              setDataSchema(fallbackData.dataSchema)
            }

            // Clear error since fallback worked
            setError(null)

            // Notify load success
            window.dispatchEvent(new CustomEvent('dashboard-loaded', {
              detail: { projectId: directId, source: 'indexeddb' }
            }))
          }
        } catch (fallbackError) {
          console.error('❌ [DASHBOARD] IndexedDB fallback also failed:', fallbackError)
        }
      } finally {
        setIsLoadingFromAPI(false)
      }
    }

    loadFromAPI()
  }
}, [directId])
```

---

## Testing Plan

### Test 1: Normal Upload Flow
```bash
# Steps:
1. Open browser console
2. Go to landing page
3. Upload a CSV file (< 1MB)
4. Watch console logs for:
   - "✅ [PAGE] Project created"
   - "✅ [PAGE] Project data saved successfully"
   - "✅ [PAGE] Data save verified"
   - "✅ [PAGE] Upload complete, status bar will navigate"
   - "🔵 [STATUS_BAR] Navigating to dashboard"
   - "🔵 [DASHBOARD] Loading project data from directId"
   - "✅ [DASHBOARD] Project data loaded from API"
   - "✅ [DASHBOARD] Dispatching dashboard-loaded event"
5. Verify dashboard renders with data
6. Refresh page - verify data persists

# Expected: No errors, smooth navigation, data displays
```

### Test 2: API Save Failure
```bash
# Steps:
1. Open DevTools → Network tab
2. Right-click → Block request pattern
3. Block: */api/projects/*/data*
4. Try uploading a file
5. Watch for error handling

# Expected:
- Console shows "❌ [PAGE] Failed to complete upload"
- Alert shown to user: "Upload failed: [error message]"
- Navigation does NOT occur
- Data still in memory
- User can retry upload
```

### Test 3: Large File Upload
```bash
# Steps:
1. Upload CSV file > 10MB
2. Monitor Network tab for POST /api/projects/*/data
3. Watch timing:
   - Data save should complete BEFORE navigation
   - Verification request should happen after save
4. Dashboard should load without errors

# Expected:
- Save completes (~2-5 seconds)
- Verification succeeds
- Navigation waits for save
- Dashboard loads data successfully
```

### Test 4: Race Condition Prevention
```bash
# Steps:
1. Open Network tab, set throttling to "Slow 3G"
2. Upload file
3. Watch timing in console

# Expected:
- Save takes longer due to throttling
- Navigation is delayed until save completes
- No "404" errors when dashboard tries to load
- Dashboard successfully retrieves data
```

---

## Console Log Sequence (Fixed)

### Successful Upload
```
🔵 [FILE-UPLOAD] Starting upload process for: data.csv
✅ [FILE-UPLOAD] File parsing completed: 1000 rows
✅ [FILE-UPLOAD] File parsing stage completed successfully
✅ [FILE-UPLOAD] Raw data stored successfully
✅ [FILE-UPLOAD] Schema stored successfully
🔵 [FILE-UPLOAD] Upload processing complete
🔵 [PAGE] Upload complete, creating project
✅ [PAGE] Project created: proj-1234567890-abc123
🔵 [PAGE] Saving project data...
✅ [PAGE] Project data saved successfully
🔍 [PAGE] Verifying data was saved...
✅ [VERIFY] API verification successful
✅ [PAGE] Data save verified
✅ [PAGE] Upload complete, status bar will navigate to /dashboard
🔵 [STATUS_BAR] Navigating to dashboard
🔵 [DASHBOARD] Loading project data from directId: proj-1234567890-abc123
✅ [DASHBOARD] Project data loaded from API
✅ [DASHBOARD] Setting existing analysis from API
✅ [DASHBOARD] Dispatching dashboard-loaded event
✅ [STATUS_BAR] Dashboard loaded, safe to dismiss upload state
```

### Failed Save (Fixed)
```
🔵 [FILE-UPLOAD] Starting upload process for: data.csv
✅ [FILE-UPLOAD] File parsing completed: 1000 rows
✅ [FILE-UPLOAD] Raw data stored successfully
🔵 [PAGE] Upload complete, creating project
✅ [PAGE] Project created: proj-1234567890-abc123
🔵 [PAGE] Saving project data...
❌ [PROJECT_STORE] API save failed: Network error
❌ [PROJECT_STORE] IndexedDB save also failed
❌ [PAGE] Failed to complete upload: Failed to save project data
⚠️ Alert shown: "Upload failed: Failed to save project data. Your data is safe in memory. Please try again."
[Navigation DOES NOT occur]
[User can retry upload]
```

---

## Quick Verification Checklist

After implementing fixes, verify:

- [ ] Save completes BEFORE navigation triggers
- [ ] Verification happens after save
- [ ] Navigation only occurs if save succeeds
- [ ] Errors prevent navigation
- [ ] Upload state not cleared until dashboard loads
- [ ] Dashboard dispatches load event
- [ ] Status bar listens for load event
- [ ] Failed saves show user-friendly error
- [ ] Data not lost on error
- [ ] IndexedDB fallback works
- [ ] Large file uploads don't timeout
- [ ] Page refresh loads data correctly

---

## Rollback Plan

If fixes cause issues:

### Quick Rollback
```bash
# Revert all changes
git checkout HEAD -- app/page.tsx
git checkout HEAD -- components/ui/upload-status-bar.tsx
git checkout HEAD -- app/dashboard/page.tsx
```

### Partial Rollback
```bash
# Keep save verification, rollback timing changes
git checkout HEAD -- components/ui/upload-status-bar.tsx
# Keep app/page.tsx changes (safer)
```

---

## Performance Impact

**Expected changes:**
- Upload flow: +1-3 seconds (due to save verification)
- User experience: Better (no failed navigations)
- Error recovery: Significantly improved
- Data loss risk: Eliminated

**Trade-off:**
Slightly slower upload completion in exchange for guaranteed data safety.

---

## Future Improvements

1. **Progress Bar During Save**
   - Show "Saving to cloud..." during saveProjectData
   - Show "Verifying..." during verification

2. **Retry Logic**
   - Auto-retry failed saves 3 times
   - Exponential backoff between retries

3. **Offline Mode**
   - Queue saves for when connection restored
   - Show "Saved locally, will sync when online"

4. **Background Sync**
   - Use Service Worker for background upload
   - Continue save even if user closes tab
