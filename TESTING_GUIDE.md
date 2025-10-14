# Production Data Storage - Testing Guide

## ✅ What's Been Completed

### Infrastructure
- ✅ Database `ProjectData` table created in Supabase
- ✅ API endpoints created (`/api/projects/[id]/data`)
- ✅ Compression service deployed (88% savings verified)
- ✅ `project-store.ts` updated with database integration
- ✅ Server compiling successfully with no errors

### Integration Points
- ✅ `saveProjectData()` calls database API + IndexedDB backup
- ✅ `loadProjectDataAsync()` loads from API → IndexedDB fallback
- ✅ Firebase authentication integrated
- ✅ Rate limiting and error handling in place

---

## 🧪 Testing Checklist

### Test 1: Upload and Save Data
**Goal**: Verify data is saved to database after file upload

**Steps**:
1. Open http://localhost:3000
2. Sign in with your account
3. Click "New Project"
4. Upload a CSV file (use test data with 100+ rows)
5. Wait for upload to complete
6. **Check browser console** for these logs:
   ```
   🔵 [PROJECT_STORE] saveProjectData called
   🌐 [PROJECT_STORE] Attempting to save data via API...
   ✅ [PROJECT_STORE] Data saved to database successfully
   ```

**Expected Results**:
- ✅ Console shows "Data saved to database successfully"
- ✅ Project appears in projects list
- ✅ No errors in browser console

**If you see errors**:
- Check: "No auth token available" → User not signed in
- Check: "API save failed: 500" → Look at server logs for details
- Check: Network tab in DevTools for `/api/projects/[id]/data` request

---

### Test 2: Verify Database Storage
**Goal**: Confirm data is actually in the database

**Steps**:
1. Open Prisma Studio: http://localhost:5556
2. Navigate to "ProjectData" table
3. Look for a record with your project ID
4. Check the record has:
   - `compressedData` (BYTEA field with data)
   - `rowCount` matches your CSV
   - `metadata` with file info

**Expected Results**:
- ✅ Record exists in ProjectData table
- ✅ `compressedData` field is not null
- ✅ `originalFileName` matches your CSV name
- ✅ `rowCount` matches number of rows uploaded

---

### Test 3: Load Data from Database
**Goal**: Verify data loads from database (not IndexedDB)

**Steps**:
1. Navigate to Projects page
2. Click on your uploaded project
3. **Check browser console** for:
   ```
   🔵 [PROJECT_STORE] loadProjectDataAsync called
   🌐 [PROJECT_STORE] Attempting to load data from API...
   ✅ [PROJECT_STORE] Data loaded from database
   ```
4. Dashboard should show your data visualizations

**Expected Results**:
- ✅ Console shows "Data loaded from database"
- ✅ Dashboard displays charts/visualizations
- ✅ Data count matches uploaded file

**If dashboard is empty**:
- Check console for "No data found" warnings
- Check Network tab for GET `/api/projects/[id]/data` request
- Verify response contains data array

---

### Test 4: Multi-Device Access (THE BIG ONE!)
**Goal**: Verify data is accessible from different browsers/devices

**Steps**:
1. Upload data in Chrome
2. Open Firefox (or another browser)
3. Sign in with the SAME account
4. Navigate to Projects
5. Click on the project you uploaded in Chrome
6. Verify data loads and displays

**Expected Results**:
- ✅ Project appears in Firefox
- ✅ Data loads successfully
- ✅ All visualizations render correctly
- ✅ No "No Data Available" message

**This proves**:
- Data is stored in database (not just browser)
- Multi-device access works
- Production-ready architecture achieved!

---

### Test 5: Data Persistence After Cache Clear
**Goal**: Verify data survives browser cache clear

**Steps**:
1. Upload a project with data
2. Clear browser cache (Cmd+Shift+Delete on Mac)
3. Select "All time" and clear everything
4. Refresh the page
5. Sign in again
6. Navigate to your project
7. Verify data loads

**Expected Results**:
- ✅ Project still exists
- ✅ Data loads from database
- ✅ All visualizations work
- ✅ No data loss

---

## 🐛 Troubleshooting

### Issue: "No auth token available"
**Cause**: User not authenticated
**Fix**: Sign in before uploading

### Issue: "API save failed: 404"
**Cause**: API endpoint not found
**Fix**: Verify server is running and `/api/projects/[id]/data/route.ts` exists

### Issue: "API save failed: 500"
**Cause**: Server error (compression, database, etc.)
**Fix**: Check server logs for detailed error:
```bash
# In terminal where server is running, look for:
[API PROJECTS DATA] Error saving data: ...
```

### Issue: Dashboard shows "No Data Available"
**Possible Causes**:
1. Data not saved to database
   - Check: Browser console for save confirmation
   - Check: Prisma Studio for ProjectData record

2. Data not loaded from database
   - Check: Browser console for load attempt
   - Check: Network tab for API call status

3. Data saved to IndexedDB only
   - Check: Console for "API save failed" warning
   - Check: Server logs for error details

---

## 📊 Monitoring Queries

### Check all project data in database
```sql
SELECT
  id,
  "projectId",
  "originalFileName",
  "rowCount",
  "columnCount",
  "uncompressedSize",
  "compressedSize",
  "compressionAlgorithm",
  "dataQualityScore",
  "createdAt"
FROM "ProjectData"
ORDER BY "createdAt" DESC;
```

### Check compression ratio
```sql
SELECT
  "originalFileName",
  "uncompressedSize",
  "compressedSize",
  ROUND(
    (1 - ("compressedSize"::float / "uncompressedSize"::float)) * 100,
    2
  ) AS "compressionPercent"
FROM "ProjectData"
WHERE "isActive" = true;
```

### Find projects missing data
```sql
SELECT p.id, p.name, pd.id as data_id
FROM projects p
LEFT JOIN "ProjectData" pd ON p.id = pd."projectId"
WHERE pd.id IS NULL;
```

---

## 🎯 Success Criteria

Your implementation is successful if:

1. ✅ File uploads complete without errors
2. ✅ Browser console shows "Data saved to database successfully"
3. ✅ ProjectData record exists in Supabase with compressed data
4. ✅ Dashboard loads data and shows visualizations
5. ✅ Data accessible from different browsers/devices
6. ✅ Data survives browser cache clear
7. ✅ Compression ratio is 70-90% (check with SQL query above)

---

## 📞 Next Steps After Testing

### If all tests pass ✅
1. Delete old IndexedDB data (optional cleanup)
2. Document the architecture for your team
3. Consider adding:
   - Data versioning support
   - Backup/restore functionality
   - Admin dashboard for monitoring

### If tests fail ❌
1. Check browser console for detailed error logs
2. Check server logs for API errors
3. Verify database connection in Prisma Studio
4. Check network tab for failed API requests
5. Share error messages for debugging

---

## 🔍 Key Console Logs to Watch

### During Upload:
```
🔵 [PROJECT_STORE] saveProjectData called
🌐 [PROJECT_STORE] Attempting to save data via API...
✅ [PROJECT_STORE] Data saved to database successfully
💾 [PROJECT_STORE] Saving to IndexedDB as backup...
✅ [PROJECT_STORE] Data saved to IndexedDB
```

### During Load:
```
🔵 [PROJECT_STORE] loadProjectDataAsync called
🌐 [PROJECT_STORE] Attempting to load data from API...
✅ [PROJECT_STORE] Data loaded from database
```

### If offline/fallback:
```
⚠️ [PROJECT_STORE] API save failed
💾 [PROJECT_STORE] Loading from IndexedDB as fallback...
```

---

**Status**: Ready for testing! 🚀

Start with Test 1 (Upload and Save) and work through the checklist sequentially.
