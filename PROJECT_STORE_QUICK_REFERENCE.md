# Project Store - Quick Reference Guide

## Overview

The project store now uses a **hybrid storage approach**: database API (primary) + IndexedDB (backup/offline).

---

## API Usage

### Saving Data

```typescript
import { useProjectStore } from '@/lib/stores/project-store'

const saveData = async () => {
  const { saveProjectData } = useProjectStore.getState()

  await saveProjectData(
    projectId,
    data,           // DataRow[]
    analysis,       // AnalysisResult (optional)
    schema          // DataSchema (optional)
  )
}
```

**What happens:**
1. Tries to save to database API
2. Always saves to IndexedDB (backup)
3. Updates project metadata

### Loading Data

```typescript
import { useProjectStore } from '@/lib/stores/project-store'

const loadData = async () => {
  const { loadProjectDataAsync } = useProjectStore.getState()

  const result = await loadProjectDataAsync(projectId)

  if (result) {
    const { rawData, analysis, dataSchema } = result
    // Use the data
  }
}
```

**What happens:**
1. Checks localStorage (fastest)
2. Tries database API
3. Falls back to IndexedDB
4. Returns null if not found

---

## Storage Hierarchy

### Priority Order

```
SAVE:
1. Database API    → Primary storage
2. IndexedDB       → Backup/offline

LOAD:
1. localStorage    → In-memory cache
2. Database API    → Server source
3. IndexedDB       → Offline fallback
```

### When Each is Used

| Storage | Save | Load | Purpose |
|---------|------|------|---------|
| Database API | Always attempted | Priority 2 | Server-side persistence |
| IndexedDB | Always | Priority 3 | Offline support, backup |
| localStorage | Never directly | Priority 1 | In-memory cache (via debugData) |

---

## Error Handling

### Common Scenarios

#### 1. User Not Logged In

```typescript
// API calls are skipped
// IndexedDB still works
// No errors thrown
```

**Log Output:**
```
⚠️ [PROJECT_STORE] No auth token available, skipping API save
💾 [PROJECT_STORE] Saving to IndexedDB as backup...
```

#### 2. Network Error

```typescript
// API fails gracefully
// IndexedDB takes over
// Operation succeeds
```

**Log Output:**
```
⚠️ [PROJECT_STORE] API save error: Network request failed
💾 [PROJECT_STORE] Saving to IndexedDB as backup...
✅ [PROJECT_STORE] Data saved to IndexedDB
```

#### 3. Both Storage Methods Fail

```typescript
// Metadata is still saved
// Error is thrown
// Caller can handle
```

**Log Output:**
```
❌ [PROJECT_STORE] Failed to save project data
⚠️ [PROJECT_STORE] Falling back to metadata-only save
```

---

## Logging Reference

### Log Emoji Guide

| Emoji | Meaning | Example |
|-------|---------|---------|
| 🔵 | Function entry | `🔵 [PROJECT_STORE] saveProjectData called` |
| 🌐 | API operation | `🌐 [PROJECT_STORE] Attempting to save data via API...` |
| 💾 | IndexedDB operation | `💾 [PROJECT_STORE] Saving to IndexedDB as backup...` |
| ✅ | Success | `✅ [PROJECT_STORE] Data saved successfully` |
| ⚠️ | Warning/fallback | `⚠️ [PROJECT_STORE] API save failed, using fallback` |
| ❌ | Error | `❌ [PROJECT_STORE] Failed to save project data` |
| 🏁 | Completion | `🏁 [PROJECT_STORE] saveProjectData completed` |

### Example Log Flow

**Successful Save:**
```
🔵 [PROJECT_STORE] saveProjectData called: { projectId: "abc", dataRows: 100 }
🌐 [PROJECT_STORE] Attempting to save data via API...
✅ [PROJECT_STORE] Data saved to database successfully
💾 [PROJECT_STORE] Saving to IndexedDB as backup...
✅ [PROJECT_STORE] Data saved to IndexedDB: project-abc_1234567890
🏁 [PROJECT_STORE] saveProjectData completed: { savedToDatabase: true }
```

**Offline Save:**
```
🔵 [PROJECT_STORE] saveProjectData called: { projectId: "abc", dataRows: 100 }
🌐 [PROJECT_STORE] Attempting to save data via API...
⚠️ [PROJECT_STORE] No auth token available, skipping API save
💾 [PROJECT_STORE] Saving to IndexedDB as backup...
✅ [PROJECT_STORE] Data saved to IndexedDB: project-abc_1234567890
🏁 [PROJECT_STORE] saveProjectData completed: { savedToDatabase: false }
```

---

## API Endpoints

### Save Data

**Endpoint:** `POST /api/projects/{projectId}/data`

**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "data": [
    { "id": 1, "name": "John" },
    { "id": 2, "name": "Jane" }
  ],
  "metadata": {
    "fileName": "data.csv",
    "fileSize": 1024,
    "mimeType": "text/csv"
  }
}
```

**Response:**
```json
{
  "id": "data-123",
  "projectId": "project-abc",
  "version": 1,
  "metadata": {
    "originalFileName": "data.csv",
    "rowCount": 2,
    "columnCount": 2,
    "columnNames": ["id", "name"],
    "columnTypes": { "id": "number", "name": "string" },
    "dataQualityScore": 95
  },
  "createdAt": "2025-10-12T10:00:00Z",
  "updatedAt": "2025-10-12T10:00:00Z"
}
```

### Load Data

**Endpoint:** `GET /api/projects/{projectId}/data`

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `version` (optional): Load specific version
- `sampleOnly` (optional): Return sample data only

**Response:**
```json
{
  "id": "data-123",
  "projectId": "project-abc",
  "version": 1,
  "data": [
    { "id": 1, "name": "John" },
    { "id": 2, "name": "Jane" }
  ],
  "metadata": {
    "originalFileName": "data.csv",
    "originalFileSize": 1024,
    "rowCount": 2,
    "columnCount": 2,
    "columnNames": ["id", "name"],
    "columnTypes": { "id": "number", "name": "string" },
    "dataQualityScore": 95,
    "compressionRatio": 3.2
  },
  "createdAt": "2025-10-12T10:00:00Z",
  "updatedAt": "2025-10-12T10:00:00Z",
  "isSample": false
}
```

---

## Data Transformation

### API Response → Store Format

The `loadProjectDataAsync` function transforms the API response:

**API Response:**
```json
{
  "data": [...],
  "metadata": {
    "originalFileName": "data.csv",
    "columnNames": ["id", "name"],
    "columnTypes": { "id": "number", "name": "string" }
  }
}
```

**Transformed to:**
```typescript
{
  rawData: [...],
  analysis: null,
  dataSchema: {
    fileName: "data.csv",
    columns: [
      { name: "id", type: "number", nullable: true },
      { name: "name", type: "string", nullable: true }
    ]
  }
}
```

---

## Testing

### Manual Testing

#### Test Save (Online)
1. Open browser console
2. Login to the application
3. Upload a file
4. Check logs for:
   - `✅ Data saved to database successfully`
   - `✅ Data saved to IndexedDB`

#### Test Save (Offline)
1. Open browser console
2. Set network to "Offline" in DevTools
3. Upload a file
4. Check logs for:
   - `⚠️ API save error`
   - `✅ Data saved to IndexedDB`

#### Test Load (Online)
1. Refresh the page
2. Navigate to a project
3. Check logs for:
   - `✅ Data loaded from database`

#### Test Load (Offline)
1. Set network to "Offline"
2. Navigate to a project
3. Check logs for:
   - `⚠️ API load error`
   - `✅ Data loaded from IndexedDB`

---

## Troubleshooting

### Issue: Data Not Saving to Database

**Check:**
1. Is user logged in? (`auth.currentUser`)
2. Is token valid? (Check network tab)
3. Does user own the project? (Authorization check)
4. Is data within size limits? (50MB max)

**Solution:**
- Verify authentication status
- Check browser console for errors
- Check network tab for API response

### Issue: Data Not Loading

**Check:**
1. Was data ever saved? (Check IndexedDB)
2. Is user logged in?
3. Does project exist?

**Solution:**
- Check browser console logs
- Verify project ID is correct
- Check IndexedDB directly (DevTools → Application → IndexedDB)

### Issue: Offline Mode Not Working

**Check:**
1. Is IndexedDB enabled?
2. Is browser storage full?
3. Are there quota errors?

**Solution:**
- Clear browser storage
- Check IndexedDB size
- Enable IndexedDB in browser settings

---

## Best Practices

### 1. Always Handle Errors

```typescript
try {
  await saveProjectData(projectId, data, analysis, schema)
} catch (error) {
  console.error('Failed to save data:', error)
  // Show user-friendly error message
}
```

### 2. Show Loading States

```typescript
const [loading, setLoading] = useState(false)

const loadData = async () => {
  setLoading(true)
  try {
    const data = await loadProjectDataAsync(projectId)
    // Use data
  } finally {
    setLoading(false)
  }
}
```

### 3. Monitor Logs in Development

Enable verbose console logging in development:
- Watch for API errors
- Check storage usage
- Verify data transformations

### 4. Test Both Online and Offline

Always test:
- Online save → Offline load
- Offline save → Online sync (future feature)
- Network failures during operations

---

## Performance Tips

### Save Performance

- **Batch operations**: Save multiple projects in sequence
- **Compress data**: API handles compression automatically
- **Limit data size**: Stay under 50MB uncompressed

### Load Performance

- **Use cache first**: localStorage is fastest
- **Sample data**: Use `?sampleOnly=true` for previews
- **Lazy loading**: Load data only when needed

---

## Related Documentation

- [Full Migration Guide](./PROJECT_STORE_DATABASE_MIGRATION.md)
- [API Documentation](./app/api/projects/[id]/data/route.ts)
- [IndexedDB Storage](./lib/project-data-storage.ts)
- [Auth Utilities](./lib/utils/api-client.ts)

---

## Summary

The project store now provides:
- **Robust persistence** via database API
- **Offline support** via IndexedDB
- **Graceful degradation** when services fail
- **Comprehensive logging** for debugging
- **Backward compatibility** with existing data

All changes are transparent to existing code - the same functions work with enhanced capabilities.
