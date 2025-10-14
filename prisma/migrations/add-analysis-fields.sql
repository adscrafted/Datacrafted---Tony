-- Migration: Add analysis storage fields to project_data table
-- This migration adds fields to store AI analysis results and chart customizations

-- Add analysis storage columns
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "analysisData" TEXT;
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "hasAnalysis" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "analysisVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "analysisCreatedAt" TIMESTAMP(3);
ALTER TABLE "project_data" ADD COLUMN IF NOT EXISTS "chartCustomizations" TEXT;

-- Add index for hasAnalysis for faster queries
CREATE INDEX IF NOT EXISTS "project_data_hasAnalysis_idx" ON "project_data"("hasAnalysis");

-- Verify the migration
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'project_data'
  AND column_name IN ('analysisData', 'hasAnalysis', 'analysisVersion', 'analysisCreatedAt', 'chartCustomizations')
ORDER BY column_name;
