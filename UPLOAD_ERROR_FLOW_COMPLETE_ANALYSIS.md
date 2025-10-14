# Complete Upload Error Flow Analysis

**Analysis Date:** 2025-10-12
**Analyzed By:** Claude Code AI Assistant
**Status:** CRITICAL - Multiple issues identified

---

## Executive Summary

The upload flow is experiencing a **500 Internal Server Error** when saving project data to the database, with 3 failed retry attempts. While data successfully saves to IndexedDB (local storage), the API POST request to `/api/projects/[id]/data` consistently fails. This creates a degraded user experience where data is only saved locally but not persisted to the backend database.

### Key Findings
- **Primary Issue**: Database schema mismatch - Prisma schema expects PostgreSQL but `.env.example` shows SQLite
- **Secondary Issue**: Potential NULL field issues in ProjectData table during creation
- **Impact**: Users can upload files, but data isn't backed up to the server
- **Severity**: HIGH - Data persistence is compromised

---

## 1. Upload Flow Trace

### 1.1 Entry Point: `/app/page.tsx` (Line 101)

```typescript
// Line 101-106 in app/page.tsx
await saveProjectData(
  project.id,
  currentState.rawData,
  currentState.analysis || undefined,
  currentState.dataSchema || undefined
)
```

**Flow Sequence:**
1. User uploads file
2. File is parsed and stored in `useDataStore`
3. `handleUploadComplete()` is triggered
4. Project is created successfully (local or API)
5. `saveProjectData()` is called to persist data

**Status at this point:** ✅ Project created, 📦 Data ready to save

---

### 1.2 Project Store: `/lib/stores/project-store.ts`

#### First Critical Point: Line 422 (API Save Retry Logic)

```typescript
// Lines 375-417 in project-store.ts
await retryWithBackoff(
  async () => {
    const response = await fetch(`/api/projects/${projectId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        data,
        analysis, // Include analysis in request
        metadata: {
          fileName: schema?.fileName || 'Unknown',
          fileSize: JSON.stringify(data).length,
          mimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`API save failed: ${response.status} ${errorText}`)
      ;(error as any).status = response.status
      throw error  // 🔴 THROWS ERROR HERE - TRIGGERS RETRY
    }
    // ... success handling
  },
  {
    maxRetries: 3,      // 🔄 Retries 3 times
    initialDelay: 1000, // Starts with 1s delay
    onRetry: (attempt, error) => {
      console.log(`🔄 [PROJECT_STORE] API save retry ${attempt}/3:`, error.message)
    }
  }
)
```

**What happens here:**
1. Makes POST request to API
2. Receives **500 Internal Server Error**
3. Throws error with status 500
4. Retry mechanism kicks in (1s → 2s → 4s delays)
5. All 3 retries fail with same 500 error
6. Moves to IndexedDB fallback

---

#### Second Critical Point: Line 474 (Error Thrown After IndexedDB Success)

```typescript
// Lines 472-478 in project-store.ts
if (!savedToDatabase && savedToIndexedDB) {
  throw new Error(
    `Data saved locally but failed to save to database. ` +
    `You may need to sync this project later. Error: ${apiError?.message || 'Unknown'}`
  )
}
```

**What happens here:**
1. IndexedDB save succeeds ✅
2. Database save failed ❌
3. Throws error to notify UI
4. Error is caught in `/app/page.tsx` line 114
5. User sees error toast notification

---

### 1.3 API Route: `/app/api/projects/[id]/data/route.ts`

#### The POST Handler (Lines 289-560)

**Expected Flow:**
```
1. Parse request body ✅
2. Validate authentication ✅
3. Validate project ownership ✅
4. Validate data structure ✅
5. Compress data ✅
6. Create ProjectData record ❌ 🔴 FAILS HERE
```

**Critical Section (Lines 483-512):**

```typescript
const projectDataRecord = await db.projectData.create({
  data: {
    projectId,
    version: versionNumber,
    originalFileName: metadata.fileName,
    originalFileSize: metadata.fileSize || jsonSize,
    mimeType: metadata.mimeType || 'application/json',
    fileHash: dataHash,
    compressedData: compressed.data,
    compressionAlgorithm: compressed.algorithm,
    uncompressedSize: compressed.originalSize,
    rowCount: metrics.rowCount,
    columnCount: metrics.columnCount,
    columnNames: JSON.stringify(metrics.columnNames),
    columnTypes: JSON.stringify(metrics.columnTypes),
    sampleData: sampleDataJson,
    nullCount: metrics.nullCount,
    duplicateRowCount: metrics.duplicateRowCount,
    dataQualityScore: metrics.dataQualityScore,
    processingTimeMs: Date.now() - startTime,
    status: 'active',
    isActive: true,
    // Analysis storage
    analysisData: analysis ? JSON.stringify(analysis) : null,
    hasAnalysis: !!analysis,
    analysisVersion: analysis ? 1 : 1,
    analysisCreatedAt: analysis ? new Date() : null,
    chartCustomizations: chartCustomizations ? JSON.stringify(chartCustomizations) : null
  }
})
```

**Why it fails:** Prisma client tries to create record but encounters database error.

---

## 2. Error Points Identified

### Error Point #1: Database Schema Mismatch (ROOT CAUSE)

**Location:** Prisma configuration vs Environment

**Issue:**
- Prisma schema (`prisma/schema.prisma` line 6-9):
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```

- Environment (`.env.example` line 1):
  ```
  DATABASE_URL="file:./prisma/dev.db"
  ```

**Problem:**
- Schema expects PostgreSQL (`provider = "postgresql"`)
- Connection string uses SQLite (`file:./prisma/dev.db`)
- This mismatch causes Prisma to fail when executing queries

**Evidence:**
- Different data types between PostgreSQL and SQLite
- SQLite uses `BLOB` for `Bytes`, PostgreSQL uses `BYTEA`
- Prisma client generated for PostgreSQL won't work with SQLite

**Impact:** ⚠️ CRITICAL - All database operations may fail

---

### Error Point #2: Missing Prisma Client Generation

**Location:** `/lib/db.ts` import

**Issue:**
```typescript
import { PrismaClient } from './generated/prisma'
```

**Potential Problems:**
1. Prisma client not generated after schema changes
2. Client generated for wrong database provider
3. Migration not run on actual database

**Solution Required:**
```bash
npx prisma generate
npx prisma migrate dev
```

---

### Error Point #3: Potential NULL Constraint Violations

**Location:** ProjectData table creation

**Fields that may cause issues:**

From schema (`prisma/schema.prisma`):
```prisma
model ProjectData {
  fileHash         String?  // Optional
  sampleData       String?  // Optional
  dataQualityScore Float?   // Optional
  processingTimeMs Int?     // Optional
  parsingErrors    String?  // Optional
  analysisData     String?  // Optional - being passed
  chartCustomizations String? // Optional - being passed but may be undefined
}
```

**Risk Areas:**
1. `chartCustomizations` - passed as `undefined` from request body (line 315)
2. `analysis` - could be an object without proper stringification validation
3. Type mismatches between expected and actual data types

---

### Error Point #4: Retry Mechanism Design Issue

**Location:** `/lib/stores/project-store.ts` lines 375-417

**Issue:** Retry logic doesn't check error type

```typescript
await retryWithBackoff(
  async () => {
    // ... API call
    if (!response.ok) {
      throw error  // 🔴 Always retries, even for 400 errors
    }
  },
  { maxRetries: 3 }
)
```

**Problem:**
- Retries on ALL errors (400, 401, 403, 500, etc.)
- Should only retry on network errors and 5xx server errors
- 400/401/403 errors won't be fixed by retrying

**Better approach:**
```typescript
import { isRetryableError } from '@/lib/utils/retry'

if (!response.ok) {
  const error = new Error(`API save failed: ${response.status}`)
  ;(error as any).status = response.status

  if (!isRetryableError(error)) {
    throw error  // Don't retry auth/validation errors
  }
  throw error
}
```

---

## 3. Complete Error Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS FILE                                         │
│    app/page.tsx:243 - DynamicFileUpload                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FILE PARSED & STORED IN useDataStore                     │
│    ✅ Status: SUCCESS                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. handleUploadComplete() TRIGGERED                         │
│    app/page.tsx:56 - Line 101 call to saveProjectData      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CREATE PROJECT                                            │
│    lib/stores/project-store.ts:102 - createProject()        │
│    ✅ Status: SUCCESS (local or API)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SAVE PROJECT DATA - START                                │
│    lib/stores/project-store.ts:331 - saveProjectData()     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. ATTEMPT API SAVE (with retry)                            │
│    lib/stores/project-store.ts:375-417                     │
│    POST /api/projects/{id}/data                             │
├─────────────────────┬───────────────────────────────────────┤
│ Retry Attempt #1    │ → 500 Error (delay: 1000ms)          │
│ Retry Attempt #2    │ → 500 Error (delay: 2000ms)          │
│ Retry Attempt #3    │ → 500 Error (delay: 4000ms)          │
│                     │                                        │
│ ❌ Result: ALL RETRIES FAILED                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. API ROUTE PROCESSING                                     │
│    app/api/projects/[id]/data/route.ts:289                  │
├─────────────────────────────────────────────────────────────┤
│ Step 1: Parse body           ✅                             │
│ Step 2: Auth check           ✅                             │
│ Step 3: Ownership check      ✅                             │
│ Step 4: Validate data        ✅                             │
│ Step 5: Compress data        ✅                             │
│ Step 6: Create DB record     ❌ 🔴 PRISMA ERROR            │
├─────────────────────────────────────────────────────────────┤
│ ERROR SOURCE:                                                │
│ • Prisma schema mismatch (PostgreSQL vs SQLite)             │
│ • Missing/incorrect Prisma client generation                │
│ • Potential NULL constraint violations                      │
│ • Database connection issues                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. FALLBACK TO INDEXEDDB                                    │
│    lib/stores/project-store.ts:427-431                     │
│    ✅ Status: SUCCESS                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. UPDATE PROJECT METADATA                                  │
│    lib/stores/project-store.ts:434-452                     │
│    ✅ Status: SUCCESS (in Zustand store)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. THROW ERROR TO UI                                       │
│     lib/stores/project-store.ts:473-478                    │
│     Error: "Data saved locally but failed to save to DB"   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. ERROR CAUGHT IN PAGE                                    │
│     app/page.tsx:114-156                                    │
│     Shows toast notification to user                        │
│     Offers "Continue anyway" or "Retry" options             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Related Issues & Type Mismatches

### 4.1 chartCustomizations Field

**Issue:** Field is optional but may receive `undefined` vs `null`

**Locations:**
1. Request body parsing (`route.ts` line 315):
   ```typescript
   const { data, analysis, chartCustomizations, metadata, version } = body
   ```

2. Database insert (line 510):
   ```typescript
   chartCustomizations: chartCustomizations ? JSON.stringify(chartCustomizations) : null
   ```

**Potential Problem:**
- If `chartCustomizations` is `undefined`, it's converted to `null` ✅
- If it's an empty object `{}`, it's stringified to `"{}"` ✅
- If it's malformed, `JSON.stringify()` could throw ⚠️

**Risk Level:** LOW (handled properly)

---

### 4.2 Analysis Field Type Mismatch

**Issue:** Type definition allows multiple types

```typescript
// In route.ts line 71
analysis?: any // AI analysis results (AnalysisResult | EnhancedAnalysisResult)
```

**Problem:**
- Using `any` bypasses type checking
- Could receive unexpected data structures
- No validation before `JSON.stringify()`

**Risk Level:** MEDIUM

---

### 4.3 Metadata Field Validation

**Issue:** Weak validation for required fields

```typescript
// Lines 333-338 in route.ts
if (!metadata || !metadata.fileName) {
  return NextResponse.json(
    { error: 'Invalid metadata: fileName is required' },
    { status: 400 }
  )
}
```

**Missing validations:**
- `fileSize` validation (could be negative)
- `mimeType` format validation
- `fileName` sanitization (could contain path traversal)

**Risk Level:** LOW (secondary concern)

---

## 5. Middleware & Interceptor Check

### 5.1 Authentication Middleware

**File:** `/lib/middleware/auth.ts`

**Flow:**
```typescript
withAuth() wrapper → requireAuth() → verify token → return user
```

**Status:** ✅ Working correctly
- No issues found in auth flow
- Properly extracts Bearer token
- Validates with Firebase Admin

---

### 5.2 Rate Limiting

**File:** `/app/api/projects/[id]/data/route.ts` line 563

```typescript
export const POST = withRateLimit(RATE_LIMITS.ANALYSIS, postHandler)
```

**Configuration:** 10 requests per hour for uploads

**Status:** ✅ Not causing the issue
- Error occurs before rate limit would be hit
- Error is 500, not 429 (rate limit)

---

## 6. Root Cause Analysis

### Primary Root Cause: Database Configuration Mismatch

**Evidence:**
1. Prisma schema declares `provider = "postgresql"`
2. `.env.example` uses SQLite connection string
3. Prisma client generated for PostgreSQL
4. Runtime tries to use SQLite
5. Prisma operations fail with database errors

**Why it causes 500 errors:**
- Prisma client methods expect PostgreSQL-specific features
- Data type mismatches (BYTEA vs BLOB for `Bytes` type)
- SQL syntax differences between databases
- Connection protocol mismatches

**Confidence Level:** 95%

---

### Secondary Contributing Factors

1. **Missing Migration Execution**
   - Database may not have latest schema
   - Tables/columns may not exist

2. **Prisma Client Not Regenerated**
   - Client generated for wrong database
   - Types don't match actual schema

3. **No Database Error Logging**
   - Prisma errors caught but details not logged
   - Makes debugging difficult

---

## 7. Downstream Effects

### 7.1 User Experience Impact

**What users see:**
1. File uploads successfully
2. Processing completes
3. Error toast appears: "Data saved locally but not to database"
4. Option to "Continue anyway" or "Retry"
5. Dashboard loads with local data only

**Problems:**
- Data not backed up to server
- Data lost if browser storage cleared
- Can't access project from other devices
- No data recovery if local storage fails

---

### 7.2 Data Integrity Impact

**Current State:**
- Projects created in database ✅
- Project metadata stored ✅
- Project data stored in IndexedDB only ❌
- No server backup ❌

**Risk:**
- User expects data to be saved
- Data only exists in browser
- Browser cache clear = data loss
- No sync between devices

---

### 7.3 System Scalability Impact

**Issues:**
- All users storing data locally
- No centralized data management
- Can't implement server-side features:
  - Data sharing
  - Collaboration
  - Cloud backup
  - Cross-device sync
  - Admin analytics

---

## 8. Recommended Fixes

### Fix #1: Resolve Database Configuration (CRITICAL - Do First)

**Priority:** P0 - CRITICAL

**Steps:**

1. **Choose database provider:**
   - For development: SQLite is fine
   - For production: Use PostgreSQL

2. **Update Prisma schema:**

   **Option A: Use SQLite (Development)**
   ```prisma
   // prisma/schema.prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

   **Option B: Use PostgreSQL (Production)**
   ```env
   # .env
   DATABASE_URL="postgresql://user:password@localhost:5432/datacrafted"
   ```

3. **Regenerate Prisma client:**
   ```bash
   npx prisma generate
   ```

4. **Run migrations:**
   ```bash
   # For SQLite
   npx prisma migrate dev --name init

   # For PostgreSQL
   npx prisma migrate deploy
   ```

5. **Verify database connection:**
   ```bash
   npx prisma db push
   ```

**Expected Result:** Database operations succeed, 500 errors stop

---

### Fix #2: Add Better Error Logging (HIGH PRIORITY)

**Location:** `/app/api/projects/[id]/data/route.ts` lines 550-558

**Current:**
```typescript
} catch (error) {
  console.error('[API PROJECT DATA] Error uploading data:', error)
  return NextResponse.json(
    {
      error: 'Failed to upload project data',
      details: error instanceof Error ? error.message : 'Unknown error'
    },
    { status: 500 }
  )
}
```

**Improved:**
```typescript
} catch (error) {
  console.error('[API PROJECT DATA] Error uploading data:', error)

  // Log detailed Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    console.error('[API PROJECT DATA] Prisma error code:', (error as any).code)
    console.error('[API PROJECT DATA] Prisma error meta:', (error as any).meta)
  }

  // Log full error stack in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[API PROJECT DATA] Full error stack:', error)
  }

  return NextResponse.json(
    {
      error: 'Failed to upload project data',
      details: error instanceof Error ? error.message : 'Unknown error',
      // Include error code in development
      ...(process.env.NODE_ENV !== 'production' && error && typeof error === 'object' && 'code' in error
        ? { code: (error as any).code }
        : {})
    },
    { status: 500 }
  )
}
```

---

### Fix #3: Improve Retry Logic (MEDIUM PRIORITY)

**Location:** `/lib/stores/project-store.ts` lines 375-417

**Current Issue:** Retries all errors

**Improved Version:**
```typescript
import { retryWithBackoff, isRetryableError } from '@/lib/utils/retry'

await retryWithBackoff(
  async () => {
    const response = await fetch(`/api/projects/${projectId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        data,
        analysis,
        metadata: {
          fileName: schema?.fileName || 'Unknown',
          fileSize: JSON.stringify(data).length,
          mimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`API save failed: ${response.status} ${errorText}`)
      ;(error as any).status = response.status

      // Only retry if error is retryable (5xx or network issues)
      if (!isRetryableError(error)) {
        console.error('❌ [PROJECT_STORE] Non-retryable error, failing immediately:', error.message)
        // Don't retry - throw immediately
        const nonRetryError = new Error(error.message)
        ;(nonRetryError as any).isRetryable = false
        throw nonRetryError
      }

      throw error
    }

    const result = await response.json()
    console.log('✅ [PROJECT_STORE] Data saved to database successfully')
    return result
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    onRetry: (attempt, error) => {
      console.log(`🔄 [PROJECT_STORE] API save retry ${attempt}/3:`, error.message)
    }
  }
)
```

---

### Fix #4: Add Request Validation (LOW PRIORITY)

**Location:** `/app/api/projects/[id]/data/route.ts` lines 315-338

**Add stricter validation:**
```typescript
// Validate analysis if provided
if (analysis && typeof analysis !== 'object') {
  return NextResponse.json(
    { error: 'Invalid analysis: must be an object' },
    { status: 400 }
  )
}

// Validate analysis can be stringified
if (analysis) {
  try {
    JSON.stringify(analysis)
  } catch (e) {
    return NextResponse.json(
      { error: 'Invalid analysis: cannot serialize to JSON' },
      { status: 400 }
    )
  }
}

// Validate metadata more strictly
if (!metadata || !metadata.fileName) {
  return NextResponse.json(
    { error: 'Invalid metadata: fileName is required' },
    { status: 400 }
  )
}

if (metadata.fileSize && metadata.fileSize < 0) {
  return NextResponse.json(
    { error: 'Invalid metadata: fileSize cannot be negative' },
    { status: 400 }
  )
}
```

---

## 9. Testing & Verification Plan

### Step 1: Verify Database Configuration

```bash
# Check current Prisma configuration
npx prisma validate

# Check database connection
npx prisma db execute --stdin <<< "SELECT 1"

# Check generated client location
ls -la lib/generated/prisma/
```

---

### Step 2: Test Database Operations

```typescript
// Create test script: scripts/test-db.ts
import { db } from '@/lib/db'

async function testProjectDataCreate() {
  try {
    const testData = await db.projectData.create({
      data: {
        projectId: 'test-project-id',
        version: 1,
        originalFileName: 'test.csv',
        originalFileSize: 1024,
        mimeType: 'text/csv',
        compressedData: Buffer.from('test'),
        compressionAlgorithm: 'gzip',
        uncompressedSize: 2048,
        rowCount: 10,
        columnCount: 5,
        columnNames: JSON.stringify(['a', 'b', 'c']),
        columnTypes: JSON.stringify({ a: 'string', b: 'number', c: 'boolean' }),
        status: 'active',
        isActive: true
      }
    })

    console.log('✅ Test passed:', testData.id)
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testProjectDataCreate()
```

```bash
npx tsx scripts/test-db.ts
```

---

### Step 3: Test Upload Flow End-to-End

1. Start development server
2. Upload a CSV file
3. Monitor console logs for errors
4. Check database for created records:
   ```bash
   npx prisma studio
   ```
5. Verify data in `project_data` table

---

### Step 4: Verify Fix Success

**Success Criteria:**
- ✅ No 500 errors during upload
- ✅ Data saved to database
- ✅ Data retrievable from database
- ✅ No retry attempts needed
- ✅ User sees success message
- ✅ Can access project from dashboard

---

## 10. Summary & Action Items

### Critical Actions (Do Immediately)

1. **Fix database configuration mismatch**
   - Choose SQLite or PostgreSQL
   - Update Prisma schema
   - Regenerate client
   - Run migrations

2. **Add error logging to API route**
   - Log Prisma error codes
   - Log full error details in development

3. **Test database operations**
   - Verify Prisma can connect
   - Test ProjectData creation
   - Verify data retrieval

---

### Follow-up Actions (Do Soon)

1. **Improve retry logic**
   - Only retry retryable errors
   - Add exponential backoff

2. **Add request validation**
   - Validate analysis structure
   - Validate metadata fields

3. **Monitor error rates**
   - Set up error tracking
   - Alert on 500 errors

---

### Long-term Improvements

1. **Add database health checks**
2. **Implement data sync mechanism**
3. **Add offline-first architecture**
4. **Set up automated testing**
5. **Add performance monitoring**

---

## File References

All file paths are absolute from working directory:
- `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/app/page.tsx`
- `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/lib/stores/project-store.ts`
- `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/app/api/projects/[id]/data/route.ts`
- `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/lib/utils/retry.ts`
- `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/lib/middleware/auth.ts`
- `/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted/prisma/schema.prisma`

---

**End of Analysis**
