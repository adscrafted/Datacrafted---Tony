# Dashboard Config Race Condition - Fix Guide

## Quick Summary

The dashboard loads saved configs correctly but still runs AI analysis due to a race condition. The flag `analysisInitiatedRef.current` is set inside an async function, but `setRawData()` triggers the effect before the flag is set.

---

## The Problem (Simplified)

```typescript
// Current Code (BROKEN):
async function loadFromAPI() {
  const projectData = await fetch('/api/projects/id/data')
  const savedConfig = await loadDashboardConfig(id)

  if (savedConfig) {
    analysisInitiatedRef.current = true  // Set flag
  }

  await setRawData(projectData.data)  // ← Effect runs HERE!
  // Effect checks flag, but it's not set yet (async timing)
}

// Effect (runs when rawData changes):
if (rawData && !analysis && !analysisInitiatedRef.current) {
  performAnalysis()  // ← Runs because flag not set yet!
}
```

---

## The Fix (3 Changes)

### Change 1: Add Loading State

**File**: `/app/dashboard/page.tsx`

**Line 79** - Add new state variable:
```typescript
// Track if we're currently loading data from API
const [isLoadingFromAPI, setIsLoadingFromAPI] = useState(false)

// ADD THIS:
const [isLoadingConfig, setIsLoadingConfig] = useState(false)
```

### Change 2: Set Flag BEFORE Loading Config

**File**: `/app/dashboard/page.tsx`

**Line 185-189** - Set flag and loading state FIRST:
```typescript
if (directId && !hasDataInStore && loadedProjectIdRef.current !== directId) {
  console.log('🔵 [DASHBOARD] No data in store, loading from API:', directId)
  loadedProjectIdRef.current = directId
  setIsLoadingFromAPI(true)

  // ADD THESE TWO LINES:
  setIsLoadingConfig(true)
  analysisInitiatedRef.current = true  // Set flag IMMEDIATELY, before async operations

  const loadFromAPI = async () => {
    // ... rest of function
```

**Line 283** - Clear loading state:
```typescript
} finally {
  setIsLoadingFromAPI(false)
  setIsLoadingConfig(false)  // ADD THIS
}
```

**Do the same for projectId path** at line 314:
```typescript
else if (projectId) {
  // ADD THESE TWO LINES:
  setIsLoadingConfig(true)
  analysisInitiatedRef.current = true  // Set flag IMMEDIATELY

  const loadProjectData = async () => {
```

**And clear at line 394**:
```typescript
} catch (error) {
  console.error('Failed to load project data:', error)
  const { setError } = useDataStore.getState()
  setError('Failed to load project data')
} finally {
  setIsLoadingConfig(false)  // ADD THIS
}
```

### Change 3: Update Effect Condition

**File**: `/app/dashboard/page.tsx`

**Line 407-412** - Add isLoadingConfig check:
```typescript
// Perform analysis if we have data but no analysis (only once)
if (rawData && rawData.length > 0 && !analysis && !isAnalyzing && !analysisInitiatedRef.current && !isLoadingConfig) {
  //                                                                                                   ^^^^^^^^^^^^^^ ADD THIS
  analysisInitiatedRef.current = true
  // Run analysis - it will use fallback charts if no API key
  performAnalysis()
}
```

---

## Optional Optimization: Remove Duplicate API Call

**File**: `/app/dashboard/page.tsx`

**Current code** (lines 203-223):
```typescript
const response = await fetch(`/api/projects/${directId}/data`, {
  headers
})

const projectData = await response.json()

// Later (line 223):
const savedConfig = await loadDashboardConfig(directId)
```

**Problem**: The data API already returns `analysis` in the response, but we ignore it and load config separately.

**Optimized code**:
```typescript
const response = await fetch(`/api/projects/${directId}/data`, {
  headers
})

const projectData = await response.json()

// Use analysis from API if it exists
if (projectData.analysis) {
  setAnalysis(projectData.analysis)
  console.log('✅ [DASHBOARD] Using saved analysis from API')
} else {
  // Only load separate config if no analysis in data API
  const savedConfig = await loadDashboardConfig(directId)
  // ... apply config
}
```

---

## Testing the Fix

### Test 1: Project with Saved Config
1. Upload a file and customize charts
2. Click "Save Dashboard"
3. Refresh the page
4. **Expected**: Dashboard loads instantly, no "AI-powered analysis" message
5. **Check console**: Should see "✅ [DASHBOARD] Found saved config, marking to skip AI analysis"
6. **Should NOT see**: "Performing analysis" or AI progress bar

### Test 2: Fresh Project (No Config)
1. Upload a new file
2. Navigate to dashboard
3. **Expected**: AI analysis runs normally
4. **Check console**: Should see "Performing analysis"

### Test 3: Project with Saved Analysis (No Custom Config)
1. Upload a file and let AI analysis complete
2. Save the project (analysis is saved automatically)
3. Close and reopen the project
4. **Expected**: Saved analysis loads, no new AI call
5. **Check console**: Should see "Using saved analysis from API"

---

## Verification Checklist

After applying the fix, verify:

- [ ] Console shows "Found saved config, marking to skip AI analysis" when opening saved projects
- [ ] No "AI-powered analysis in progress" message when config exists
- [ ] Dashboard loads instantly (< 1 second) for saved projects
- [ ] Fresh uploads still trigger AI analysis normally
- [ ] Page refreshes don't trigger duplicate AI analysis
- [ ] Console doesn't show "Performing analysis" for saved projects

---

## Code Locations Quick Reference

| Change | File | Line |
|--------|------|------|
| Add isLoadingConfig state | `/app/dashboard/page.tsx` | ~79 |
| Set flag before directId load | `/app/dashboard/page.tsx` | ~189 |
| Clear flag after directId load | `/app/dashboard/page.tsx` | ~283 |
| Set flag before projectId load | `/app/dashboard/page.tsx` | ~314 |
| Clear flag after projectId load | `/app/dashboard/page.tsx` | ~394 |
| Update effect condition | `/app/dashboard/page.tsx` | ~408 |

---

## Why This Fix Works

### Before (Broken):
```
1. Start async function
2. Load config (async)
3. If config exists, set flag ← Flag set here
4. setRawData() ← Effect triggers here
5. Effect checks flag ← But flag not set yet!
6. performAnalysis() ← Unnecessary call
```

### After (Fixed):
```
1. Set flag IMMEDIATELY ← Flag set FIRST
2. Set loading state ← Prevent effect from running
3. Start async function
4. Load config (async)
5. setRawData() ← Effect tries to trigger
6. Effect checks flag ← Flag already set ✅
7. Effect checks loading state ← Still loading ✅
8. Effect skips analysis ← Success!
```

---

## Impact

**Before Fix**:
- Every saved project reload = Unnecessary AI analysis
- 3-5 second delay loading saved dashboards
- Wasted AI API credits
- Poor user experience

**After Fix**:
- Saved projects load instantly
- No unnecessary AI calls
- Proper config application
- Better user experience

---

## Additional Notes

1. The `analysisInitiatedRef` is a ref (not state) so setting it doesn't trigger re-renders
2. Setting the flag before async operations is safe because refs update synchronously
3. The loading state provides a second layer of protection during async operations
4. The effect will only run analysis once all conditions are met
