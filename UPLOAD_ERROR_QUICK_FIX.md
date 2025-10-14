# Upload Error Quick Fix Guide

**Issue:** 500 Internal Server Error when saving project data
**Root Cause:** Database configuration mismatch (PostgreSQL schema + SQLite database)
**Impact:** Data saves to IndexedDB only, not to backend database

---

## The Problem

Your Prisma schema is configured for PostgreSQL but you have a SQLite database file.

**Result:** Prisma client expects PostgreSQL but tries to connect to SQLite, causing all database operations to fail.

---

## Quick Fix (5 minutes)

### Option A: Use SQLite (Recommended for Development)

1. **Update Prisma schema** - Change line 7 in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"  # Changed from "postgresql"
  url      = env("DATABASE_URL")
}
```

2. **Create .env file**:

```bash
echo 'DATABASE_URL="file:./prisma/dev.db"' > .env
```

3. **Update ProjectData model** - Remove @db.Text annotations (lines 208 and 212):

```prisma
analysisData        String?   # Remove: @db.Text
chartCustomizations String?   # Remove: @db.Text
```

4. **Regenerate Prisma client**:

```bash
npx prisma generate
npx prisma db push
```

5. **Test**: Start dev server and upload a file. Should work now!

---

## Verification

After applying the fix:
- Check console for: "✅ Data saved to database successfully"
- No error about "Data saved locally but failed to save to database"
- View data in: `npx prisma studio`

---

See UPLOAD_ERROR_FLOW_COMPLETE_ANALYSIS.md for full details.
