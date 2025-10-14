# Upload Completion Fix - Quick Reference

## The Fix in 60 Seconds

**Problem**: Data wasn't saving to database after upload
**Root Cause**: Errors were swallowed silently in `saveProjectData()`
**Solution**: Proper error handling + retries + user feedback

---

## What Changed

### 1. New Toast System
```typescript
import { toast } from '@/components/ui/toast'

// Show success
toast.success('Data saved!')

// Show error with retry
toast.error('Save failed', {
  action: { label: 'Retry', onClick: () => retry() }
})
```

### 2. Retry Logic
```typescript
import { retryWithBackoff } from '@/lib/utils/retry'

await retryWithBackoff(apiCall, {
  maxRetries: 3,
  initialDelay: 1000
})
```

### 3. Better saveProjectData()
- ✅ Throws errors (no more silent failures)
- ✅ Retries 3 times with backoff
- ✅ Saves to database AND IndexedDB
- ✅ Clear error messages

### 4. Post-Auth Sync
```typescript
import { syncLocalProjectsToDatabase } from '@/lib/utils/project-sync'

// Automatically syncs local projects after sign-in
const result = await syncLocalProjectsToDatabase()
```

---

## Key Files

| File | Change | Purpose |
|------|--------|---------|
| `components/ui/toast.tsx` | NEW | User notifications |
| `lib/utils/retry.ts` | NEW | Retry with backoff |
| `lib/utils/project-sync.ts` | NEW | Post-auth sync |
| `lib/stores/project-store.ts` | MODIFIED | Enhanced save with retries |
| `app/page.tsx` | MODIFIED | Better error handling |
| `app/layout.tsx` | MODIFIED | Added toast container |
| `components/ui/upload-status-bar.tsx` | MODIFIED | Added "Saving data" stage |
| `lib/contexts/auth-context.tsx` | MODIFIED | Auto-sync after login |

---

## Testing Quick Check

### Expected Console Logs (Success)
```
🔵 [PAGE] Upload complete, creating project
✅ [PAGE] Project created: project-xxx
💾 [PAGE] Saving project data...
🌐 [PROJECT_STORE] Attempting to save data via API with retry...
✅ [PROJECT_STORE] Data saved to database successfully
✅ [PAGE] Project data saved successfully
```

### Expected Network Calls (Success)
```
POST /api/projects → 200 ✅
POST /api/projects/[id]/data → 200 ✅
GET /dashboard?id=project-xxx → 200 ✅
GET /api/projects/[id]/data → 200 ✅
```

### What to Look For (Failure)
```
❌ [PROJECT_STORE] API save failed after retries
🔄 [PROJECT_STORE] API save retry 1/3
🔄 [PROJECT_STORE] API save retry 2/3
🔄 [PROJECT_STORE] API save retry 3/3
Toast: "Failed to save project data" with Retry button
```

---

## Common Issues & Solutions

### Issue: "Data saved locally but not to database"
**Cause**: User not authenticated OR API failing
**Solution**: Sign in → Projects auto-sync
**Code**: Already handles this automatically

### Issue: "Failed after 3 retries"
**Cause**: Network issue or API down
**Solution**: Click "Retry" button in toast
**Code**: Retry button calls `handleUploadComplete(data)` again

### Issue: Rate limiting
**Cause**: Too many retries in short time
**Solution**: Exponential backoff prevents this
**Code**: `retryWithBackoff()` increases delay between attempts

---

## How It Works

### Upload Flow (Authenticated)
```
1. User uploads file
   ↓
2. File parsed and analyzed
   ↓
3. Create project in database
   ↓
4. Save data with retries (3 attempts)
   ├─ Try 1: Immediate
   ├─ Try 2: Wait 1s
   └─ Try 3: Wait 2s
   ↓
5. If success → Navigate to dashboard
   If failure → Show toast with retry
```

### Upload Flow (Unauthenticated)
```
1. User uploads file
   ↓
2. Create project locally
   ↓
3. Save data to IndexedDB only
   ↓
4. Show toast: "Saved locally"
   ↓
5. User signs in
   ↓
6. Auto-sync to database
```

### Error Handling Strategy
```
Database Save
├─ Success? → Continue
│
└─ Failed?
   ├─ Retry 1 (wait 1s)
   ├─ Retry 2 (wait 2s)
   └─ Retry 3 (wait 4s)
      │
      ├─ Success? → Continue
      │
      └─ Failed?
         ├─ Save to IndexedDB
         └─ Show error toast
```

---

## API Reference

### Toast API
```typescript
// Basic usage
toast.success(message: string, options?: ToastOptions)
toast.error(message: string, options?: ToastOptions)
toast.info(message: string, options?: ToastOptions)

// With action button
toast.error('Save failed', {
  duration: 10000, // 10 seconds
  action: {
    label: 'Retry',
    onClick: () => console.log('Retry clicked')
  }
})
```

### Retry API
```typescript
retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number        // Default: 3
    initialDelay?: number      // Default: 1000ms
    maxDelay?: number          // Default: 10000ms
    backoffMultiplier?: number // Default: 2
    onRetry?: (attempt: number, error: Error) => void
  }
): Promise<T>
```

### Sync API
```typescript
// Sync all local projects
syncLocalProjectsToDatabase(): Promise<SyncResult>

// Check if project needs sync
checkProjectNeedsSync(projectId: string): boolean

// Sync single project
syncSingleProject(projectId: string): Promise<boolean>
```

---

## Debugging Tips

### Enable Verbose Logging
All functions already log extensively. Look for:
- 🔵 = Start of operation
- ✅ = Success
- ❌ = Error
- ⚠️ = Warning
- 🔄 = Retry attempt
- 💾 = Saving data
- 🌐 = API call
- 🔍 = Debug info

### Check Browser Console
```javascript
// Check store state
useDataStore.getState()

// Check project store
useProjectStore.getState()

// Check if data exists
const state = useDataStore.getState()
console.log('Raw data rows:', state.rawData?.length)
console.log('Has schema:', !!state.dataSchema)
```

### Check Network Tab
1. Open DevTools → Network
2. Filter by "Fetch/XHR"
3. Look for:
   - `POST /api/projects` → Should be 200
   - `POST /api/projects/[id]/data` → Should be 200
   - `GET /api/projects/[id]/data` → Should be 200 (not 404)

---

## Success Indicators

### ✅ Everything Working
- Console shows all ✅ checkmarks
- Network tab shows all 200 responses
- Dashboard loads with data immediately
- No error toasts appear
- No 404 errors in console

### ❌ Something Wrong
- Console shows ❌ errors
- Network tab shows 4xx/5xx errors
- Dashboard shows "No data" or loading forever
- Error toasts appear
- 404 errors when loading dashboard

---

## Emergency Rollback

If something breaks, revert these files:
```bash
git checkout HEAD -- lib/stores/project-store.ts
git checkout HEAD -- app/page.tsx
git checkout HEAD -- components/ui/upload-status-bar.tsx
git checkout HEAD -- lib/contexts/auth-context.tsx

# Delete new files
rm components/ui/toast.tsx
rm lib/utils/retry.ts
rm lib/utils/project-sync.ts
```

---

**Last Updated**: 2025-10-12
**Quick Questions?** Check `UPLOAD_COMPLETION_FIX_SUMMARY.md` for details
