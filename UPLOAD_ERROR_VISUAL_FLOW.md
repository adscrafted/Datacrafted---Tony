# Upload Error Visual Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER ACTION: Upload CSV File                                         │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FILE UPLOAD COMPONENT                                                │
│  components/upload/dynamic-file-upload.tsx                           │
│  • Parses CSV/Excel file                                             │
│  • Stores in useDataStore (client-side state)                        │
│  Status: ✅ SUCCESS                                                   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UPLOAD COMPLETE HANDLER                                              │
│  app/page.tsx:56 - handleUploadComplete()                            │
│  • Retrieves data from useDataStore                                  │
│  • Calls createProject()                                             │
│  Status: ✅ SUCCESS                                                   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CREATE PROJECT                                                       │
│  lib/stores/project-store.ts:102 - createProject()                   │
│  • Creates project metadata (ID, name, description)                  │
│  • Stores in Zustand + localStorage                                  │
│  Status: ✅ SUCCESS                                                   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  SAVE PROJECT DATA - ENTRY POINT                                      │
│  app/page.tsx:101 - saveProjectData()                                │
│  Parameters:                                                          │
│    • projectId: "project-123..."                                     │
│    • rawData: [{...}, {...}] (1000 rows)                             │
│    • analysis: {...} (AI analysis results)                           │
│    • dataSchema: {...} (column info)                                 │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  SAVE TO DATABASE - ATTEMPT WITH RETRY                                │
│  lib/stores/project-store.ts:375-417                                 │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Retry Attempt #1 (delay: 0ms)                                │    │
│  │ POST /api/projects/project-123.../data                       │    │
│  │ Response: ❌ 500 Internal Server Error                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                             │                                         │
│                             ▼ Wait 1000ms                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Retry Attempt #2 (delay: 1000ms)                            │    │
│  │ POST /api/projects/project-123.../data                       │    │
│  │ Response: ❌ 500 Internal Server Error                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                             │                                         │
│                             ▼ Wait 2000ms                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Retry Attempt #3 (delay: 2000ms)                            │    │
│  │ POST /api/projects/project-123.../data                       │    │
│  │ Response: ❌ 500 Internal Server Error                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  Status: ❌ ALL RETRIES EXHAUSTED (Total: ~7 seconds wasted)         │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  API ROUTE PROCESSING                                                 │
│  app/api/projects/[id]/data/route.ts:289 - POST handler              │
│                                                                        │
│  Step 1: Parse request body              ✅ SUCCESS                  │
│  Step 2: Verify authentication           ✅ SUCCESS                  │
│  Step 3: Check project ownership         ✅ SUCCESS                  │
│  Step 4: Validate data                   ✅ SUCCESS                  │
│  Step 5: Compress data                   ✅ SUCCESS                  │
│  Step 6: Create ProjectData record       ❌ PRISMA ERROR             │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  ERROR DETAILS (Line 483-512)                                │   │
│  │                                                                │   │
│  │  await db.projectData.create({...})                          │   │
│  │                                                                │   │
│  │  Prisma Error:                                                │   │
│  │  • Expected: PostgreSQL database                             │   │
│  │  • Found: SQLite database                                    │   │
│  │  • Prisma client generated for PostgreSQL                    │   │
│  │  • DATABASE_URL env variable: undefined                      │   │
│  │  • Fallback to SQLite file: /prisma/dev.db                   │   │
│  │                                                                │   │
│  │  Root Cause:                                                  │   │
│  │  Schema provider mismatch causes type incompatibilities      │   │
│  │  (BYTEA vs BLOB for Bytes type, etc.)                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  Returns: 500 Internal Server Error                                  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FALLBACK TO INDEXEDDB                                                │
│  lib/stores/project-store.ts:427-431                                 │
│                                                                        │
│  await projectDataStorage.saveProjectData(...)                       │
│                                                                        │
│  Status: ✅ SUCCESS                                                   │
│  Storage: Browser IndexedDB (local only)                             │
│  Persistence: Until browser cache cleared                            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UPDATE PROJECT METADATA                                              │
│  lib/stores/project-store.ts:434-452                                 │
│                                                                        │
│  Updates Zustand store with:                                         │
│  • dataStorageId: "idb-project-123..."                              │
│  • fileInfo: { fileName, rowCount, etc. }                            │
│  • updatedAt: timestamp                                              │
│                                                                        │
│  Status: ✅ SUCCESS (in-memory only)                                 │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  THROW ERROR TO UI                                                    │
│  lib/stores/project-store.ts:473-478                                 │
│                                                                        │
│  throw new Error(                                                     │
│    "Data saved locally but failed to save to database."              │
│  )                                                                     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ERROR CAUGHT IN PAGE COMPONENT                                       │
│  app/page.tsx:114-156                                                 │
│                                                                        │
│  Shows toast notification to user:                                   │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  ⚠️  Data saved locally but not to database.               │     │
│  │     You may need to sync this project later.               │     │
│  │                                                              │     │
│  │  [Continue anyway]                                          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  User can click "Continue anyway" to navigate to dashboard          │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FINAL STATE                                                          │
│                                                                        │
│  ✅ Project created (metadata in Zustand + localStorage)             │
│  ✅ Data saved to IndexedDB (browser-only)                           │
│  ❌ Data NOT saved to backend database                               │
│  ❌ No server backup                                                 │
│  ❌ Can't access from other devices                                  │
│  ❌ Data lost if browser cache cleared                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Error Timeline

```
Time    Event
─────────────────────────────────────────────────────────────
0ms     User uploads file
+50ms   File parsed, data in useDataStore ✅
+100ms  Project created ✅
+150ms  Start saveProjectData()
+200ms  API call #1 → 500 error ❌
+1200ms API call #2 → 500 error ❌ (1s delay)
+3200ms API call #3 → 500 error ❌ (2s delay)
+3250ms Fallback to IndexedDB ✅
+3300ms Show error toast to user
```

**Total time wasted on retries:** ~3 seconds
**User experience:** Poor (sees errors, data not backed up)

---

## Fix Impact

After applying the database configuration fix:

```
Time    Event
─────────────────────────────────────────────────────────────
0ms     User uploads file
+50ms   File parsed, data in useDataStore ✅
+100ms  Project created ✅
+150ms  Start saveProjectData()
+200ms  API call #1 → 201 Created ✅
+250ms  Data saved to database ✅
+300ms  Data saved to IndexedDB (backup) ✅
+350ms  Show success message to user ✅
```

**Total time saved:** ~3 seconds
**User experience:** Excellent (no errors, data backed up)
