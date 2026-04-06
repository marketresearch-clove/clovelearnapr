-- ============================================================================
-- MIGRATION: Add updated_at Columns to Assessment Tables
-- ============================================================================
-- Adds missing updated_at columns to assessment_results and quiz_results
-- This is a separate migration to ensure columns are properly created
-- ============================================================================

-- Add updated_at to assessment_results if it doesn't exist
ALTER TABLE assessment_results 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at to quiz_results if it doesn't exist
ALTER TABLE quiz_results 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Verify columns were added
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('assessment_results', 'quiz_results')
AND column_name = 'updated_at'
ORDER BY table_name;
