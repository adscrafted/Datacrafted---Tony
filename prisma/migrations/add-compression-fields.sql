-- Migration: Add compression fields to DataSession table
-- This migration adds the necessary fields to store compressed data

-- Step 1: Add new columns for compressed data storage
ALTER TABLE "DataSession" ADD COLUMN IF NOT EXISTS "compressedData" BYTEA;
ALTER TABLE "DataSession" ADD COLUMN IF NOT EXISTS "originalSize" INTEGER;
ALTER TABLE "DataSession" ADD COLUMN IF NOT EXISTS "compressedSize" INTEGER;
ALTER TABLE "DataSession" ADD COLUMN IF NOT EXISTS "compressionRatio" DOUBLE PRECISION;
ALTER TABLE "DataSession" ADD COLUMN IF NOT EXISTS "algorithm" VARCHAR(20);
ALTER TABLE "DataSession" ADD COLUMN IF NOT EXISTS "fileName" VARCHAR(255);
ALTER TABLE "DataSession" ADD COLUMN IF NOT EXISTS "rowCount" INTEGER;

-- Step 2: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "DataSession_userId_idx" ON "DataSession"("userId");
CREATE INDEX IF NOT EXISTS "DataSession_createdAt_idx" ON "DataSession"("createdAt");
CREATE INDEX IF NOT EXISTS "DataSession_algorithm_idx" ON "DataSession"("algorithm");

-- Step 3: Add comments for documentation
COMMENT ON COLUMN "DataSession"."compressedData" IS 'Compressed data buffer stored as BYTEA';
COMMENT ON COLUMN "DataSession"."originalSize" IS 'Original uncompressed size in bytes';
COMMENT ON COLUMN "DataSession"."compressedSize" IS 'Compressed size in bytes';
COMMENT ON COLUMN "DataSession"."compressionRatio" IS 'Compression ratio (compressed/original, 0-1)';
COMMENT ON COLUMN "DataSession"."algorithm" IS 'Compression algorithm used: gzip or brotli';
COMMENT ON COLUMN "DataSession"."fileName" IS 'Original file name';
COMMENT ON COLUMN "DataSession"."rowCount" IS 'Number of rows in the dataset';

-- Step 4: Optional - If you have existing data column and want to migrate
-- Uncomment and run this if you have a 'data' JSONB column you want to compress

/*
-- Create a temporary function to compress existing data
CREATE OR REPLACE FUNCTION compress_existing_data() RETURNS void AS $$
DECLARE
  session_record RECORD;
BEGIN
  FOR session_record IN SELECT id, data FROM "DataSession" WHERE data IS NOT NULL AND compressedData IS NULL LOOP
    -- This would need to be done in application code, not SQL
    -- Just marking these sessions for manual migration
    UPDATE "DataSession"
    SET algorithm = 'pending_migration'
    WHERE id = session_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration marker
SELECT compress_existing_data();

-- Drop the temporary function
DROP FUNCTION compress_existing_data();
*/

-- Step 5: Create a view for compression statistics
CREATE OR REPLACE VIEW "CompressionStats" AS
SELECT
  userId,
  COUNT(*) as totalSessions,
  SUM(originalSize) as totalOriginalSize,
  SUM(compressedSize) as totalCompressedSize,
  AVG(compressionRatio) as avgCompressionRatio,
  SUM(originalSize - compressedSize) as totalSpaceSaved,
  CASE
    WHEN SUM(originalSize) > 0
    THEN ((SUM(originalSize - compressedSize)::FLOAT / SUM(originalSize)) * 100)
    ELSE 0
  END as spaceSavedPercentage,
  MAX(createdAt) as lastUpload
FROM "DataSession"
WHERE compressedData IS NOT NULL
GROUP BY userId;

-- Step 6: Add constraints for data validation
ALTER TABLE "DataSession" ADD CONSTRAINT "check_positive_sizes"
  CHECK (originalSize >= 0 AND compressedSize >= 0);

ALTER TABLE "DataSession" ADD CONSTRAINT "check_valid_ratio"
  CHECK (compressionRatio >= 0 AND compressionRatio <= 2); -- Allow slight expansion

ALTER TABLE "DataSession" ADD CONSTRAINT "check_valid_algorithm"
  CHECK (algorithm IN ('gzip', 'brotli', 'pending_migration') OR algorithm IS NULL);

ALTER TABLE "DataSession" ADD CONSTRAINT "check_row_count"
  CHECK (rowCount >= 0 AND rowCount <= 10000);

-- Verify the migration
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'DataSession'
  AND column_name IN ('compressedData', 'originalSize', 'compressedSize', 'compressionRatio', 'algorithm', 'fileName', 'rowCount')
ORDER BY column_name;
