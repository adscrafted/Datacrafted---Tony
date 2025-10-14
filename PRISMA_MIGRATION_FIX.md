# Prisma Migration Fix - Analysis Storage Fields

## Problem
Prisma validation error was occurring during project data upload:
```
Error [PrismaClientValidationError]:
Invalid `prisma.projectData.create()` invocation
```

**Root Cause**: The Prisma schema file (`prisma/schema.prisma`) was modified to include new analysis storage fields, but the database migration was never run. The following fields existed in the schema but not in the actual database:
- `analysisData String? @db.Text`
- `hasAnalysis Boolean @default(false)`
- `analysisVersion Int @default(1)`
- `analysisCreatedAt DateTime?`
- `chartCustomizations String? @db.Text`

## Solution

### Step 1: Created Migration SQL File
Created `/prisma/migrations/add-analysis-fields.sql` with the following changes:

```sql
-- Add analysis storage columns
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "analysisData" TEXT;
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "hasAnalysis" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "analysisVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "analysisCreatedAt" TIMESTAMP(3);
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "chartCustomizations" TEXT;

-- Add index for hasAnalysis for faster queries
CREATE INDEX IF NOT EXISTS "project_data_hasAnalysis_idx" ON "project_data"("hasAnalysis");
```

### Step 2: Ran Migration
```bash
export DATABASE_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres"
psql "$DATABASE_URL" -f prisma/migrations/add-analysis-fields.sql
```

**Result**: All 5 columns added successfully with proper defaults and constraints.

### Step 3: Regenerated Prisma Client
```bash
./node_modules/.bin/prisma generate
```

**Result**: Prisma Client regenerated with new field types and validations.

### Step 4: Verified Schema Alignment
Confirmed that:
1. Database columns exist with correct types and defaults
2. Prisma schema matches database structure
3. Generated Prisma Client includes all new fields

## Database Schema Changes

### New Columns in `project_data` Table

| Column Name | Type | Nullable | Default | Purpose |
|------------|------|----------|---------|---------|
| `analysisData` | TEXT | YES | NULL | JSON stringified AI analysis results |
| `hasAnalysis` | BOOLEAN | NO | false | Flag indicating if analysis has been performed |
| `analysisVersion` | INTEGER | NO | 1 | Version number of analysis schema |
| `analysisCreatedAt` | TIMESTAMP | YES | NULL | Timestamp when analysis was created |
| `chartCustomizations` | TEXT | YES | NULL | JSON stringified user chart customizations |

### New Index
- `project_data_hasAnalysis_idx` on `hasAnalysis` column for faster querying of analyzed projects

## API Impact

The fix enables the `/api/projects/[id]/data` POST endpoint to properly store:
1. AI analysis results alongside project data
2. User chart customizations
3. Analysis metadata (version, timestamp)

## Files Modified

1. **Database**: `project_data` table - added 5 columns + 1 index
2. **Prisma Client**: `/lib/generated/prisma/` - regenerated with new types
3. **Migration**: `/prisma/migrations/add-analysis-fields.sql` - new migration file

## Files Referenced

- `/prisma/schema.prisma` - Prisma schema (lines 208-212)
- `/app/api/projects/[id]/data/route.ts` - API endpoint using the new fields (lines 506-510)

## Verification Commands

```bash
# Check migration status
export DATABASE_URL="your-db-url"
./node_modules/.bin/prisma migrate status

# Verify database columns
psql "$DATABASE_URL" -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'project_data' AND column_name IN ('analysisData', 'hasAnalysis', 'analysisVersion', 'analysisCreatedAt', 'chartCustomizations') ORDER BY column_name;"

# Regenerate Prisma client if needed
./node_modules/.bin/prisma generate
```

## Future Migrations

To avoid this issue in the future:

1. **Always create a migration when modifying the Prisma schema**:
   ```bash
   npx prisma migrate dev --name descriptive_migration_name
   ```

2. **If using Supabase or other hosted DB, use SQL migrations**:
   - Create SQL file in `/prisma/migrations/`
   - Run with `psql` or Supabase SQL Editor
   - Regenerate Prisma client

3. **Verify schema alignment**:
   ```bash
   npx prisma db pull --print  # Compare with current schema
   ```

## Status: RESOLVED ✅

The Prisma validation error is now fixed. Project data uploads with analysis storage will work correctly.
