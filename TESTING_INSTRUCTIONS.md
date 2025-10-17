# Testing Instructions for File Upload Fix

## Overview
This document provides instructions for testing the file upload hang fix.

## What Was Fixed
The file upload was hanging indefinitely when processing CSV files. The issue was caused by dynamic imports in the parsing logic that never resolved in the Next.js development environment.

## Quick Test

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Open Browser Console
- Open Chrome/Firefox DevTools (F12 or Cmd+Option+I)
- Navigate to the Console tab
- Clear any existing logs

### 3. Upload a CSV File
1. Navigate to the file upload page
2. Drop or select your "CampaignStats.csv" file
3. Watch the console logs

### Expected Console Output

You should see a complete sequence of logs like this:

```
[FILE-UPLOAD] Calling parseFileOptimized
[PARSER] parseOnMainThread called { fileName: 'CampaignStats.csv', fileSize: 12345, extension: 'csv' }
[PARSER] Using regular parser for file
[PARSER] Starting file parsing based on extension: csv
[PARSER] Calling parseCSV...
[FILE-PARSER] parseCSV called for file: CampaignStats.csv
[FILE-PARSER] Calling Papa.parse...
[FILE-PARSER] Papa.parse initiated (async)
[FILE-PARSER] Papa.parse completed { rowCount: X, errors: 0, meta: {...} }
[PARSER] parseCSV completed, rows: X
[PARSER] Parse completed successfully
[FILE-UPLOAD] File parsing completed: { rowCount: X, columns: [...], ... }
```

### What to Look For

#### Success Indicators ✅
- All log messages appear in sequence
- No hanging after "[FILE-UPLOAD] Calling parseFileOptimized"
- Parse completes within 1-2 seconds for small files
- Progress indicator shows and completes
- Navigation to dashboard occurs automatically
- Data appears correctly in the dashboard

#### Failure Indicators ❌
- Logs stop after "[FILE-UPLOAD] Calling parseFileOptimized"
- No "[PARSER]" or "[FILE-PARSER]" logs appear
- Progress indicator spins indefinitely
- No error messages in console
- Upload never completes

## Testing Different File Types

### CSV Files
1. Test with small CSV (<1MB)
2. Test with large CSV (>5MB) - should use streaming parser
3. Test with CSV containing special characters
4. Test with CSV with empty rows

### Excel Files
1. Test with .xlsx file
2. Test with .xls file
3. Test with multiple sheets (uses first sheet)

## Edge Cases to Test

### 1. File Too Large
- Upload a file >50MB
- Should see error: "File size exceeds 50MB limit"

### 2. Invalid File Type
- Upload a .txt or .pdf file
- Should see error: "Unsupported file type"

### 3. Empty File
- Upload an empty CSV
- Should see error: "No data found in file"

### 4. Malformed CSV
- Upload CSV with mismatched column counts
- Should see parse warnings in console
- Should still complete (with warnings)

## Performance Benchmarks

### Small Files (<1MB)
- Parse time: <500ms
- Total upload time: <2s

### Medium Files (1-5MB)
- Parse time: 500ms - 2s
- Total upload time: 2-5s

### Large Files (5-50MB)
- Parse time: 2-10s (streaming parser)
- Total upload time: 5-15s

## Debugging Failed Tests

If the upload still hangs:

1. **Check Console Logs**
   - Look for the last log message
   - Check for any error messages
   - Look for stack traces

2. **Check Network Tab**
   - Verify file is being uploaded
   - Check for API errors

3. **Check Browser Compatibility**
   - Test in Chrome (recommended)
   - Test in Firefox
   - Check for Web Worker support

4. **Clear Cache and Reload**
   ```bash
   # Stop dev server
   # Clear Next.js cache
   rm -rf .next
   # Restart dev server
   npm run dev
   ```

5. **Check Dependencies**
   ```bash
   # Verify Papa Parse is installed
   npm list papaparse

   # Verify XLSX is installed
   npm list xlsx

   # Reinstall if needed
   npm install
   ```

## Reporting Issues

If you encounter issues, please provide:

1. **Console Logs**
   - Copy all console output from upload attempt
   - Include both info and error messages

2. **File Information**
   - File name
   - File size
   - File type
   - Sample of first few rows (if not sensitive)

3. **Environment**
   - Browser and version
   - Node.js version (`node --version`)
   - Operating system

4. **Steps to Reproduce**
   - Exact steps taken
   - Expected vs actual behavior
   - Frequency (always, sometimes, once)

## Additional Logging (Optional)

If you need more detailed logging, you can temporarily enable additional debug output:

1. Open `/lib/utils/file-parser-optimized.ts`
2. Add more `console.log` statements at specific points
3. Save and reload the page

## Clean Up Logs (Production)

Before deploying to production, you may want to remove or reduce logging:

1. Search for `console.log('[PARSER]'` and `console.log('[FILE-PARSER]'`
2. Either remove or wrap in `if (process.env.NODE_ENV === 'development')`
3. Keep error logs (`console.error`) for production debugging

## Success Criteria

The fix is successful if:

1. ✅ File uploads complete without hanging
2. ✅ Console shows complete log sequence
3. ✅ Progress indicator functions correctly
4. ✅ Data appears in dashboard after upload
5. ✅ No errors in browser console
6. ✅ Performance is acceptable (<5s for typical files)
7. ✅ All file types (CSV, XLSX, XLS) work correctly
8. ✅ Error handling works for invalid files
