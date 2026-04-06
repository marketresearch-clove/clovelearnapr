-- ============================================================================
-- MIGRATION: Fix lesson_progress updated_at Column
-- ============================================================================
-- This migration fixes: 'record "new" has no field "updated_at"' on lesson_progress
-- Same issue as assessment_results - need updated_at with proper DEFAULT
-- ============================================================================

-- Drop all problematic triggers on lesson_progress
DROP TRIGGER IF EXISTS trigger_update_lesson_progress_updated_at ON lesson_progress CASCADE;
DROP TRIGGER IF EXISTS trigger_lesson_progress_completed ON lesson_progress CASCADE;
DROP FUNCTION IF EXISTS trigger_update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS trigger_lesson_progress_completed() CASCADE;

-- Ensure updated_at column exists with DEFAULT and NOT NULL
DO $$
BEGIN
    -- Add updatedat column if it doesn't exist (using snake_case)
    ALTER TABLE lesson_progress
    ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    
    -- For existing rows, set updatedat if it's null
    UPDATE lesson_progress SET updatedat = CURRENT_TIMESTAMP WHERE updatedat IS NULL;
    
    -- Ensure the column is NOT NULL with proper default
    ALTER TABLE lesson_progress ALTER COLUMN updatedat SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE lesson_progress ALTER COLUMN updatedat SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    -- If column already has NOT NULL, this is fine
    NULL;
END $$;

-- Enable RLS on lesson_progress
ALTER TABLE IF EXISTS lesson_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies if any
DROP POLICY IF EXISTS "Users can view their own progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON lesson_progress;

-- Create RLS policies for lesson_progress
CREATE POLICY "Authenticated users can read lesson progress"
ON lesson_progress FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert lesson progress"
ON lesson_progress FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update lesson progress"
ON lesson_progress FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Verify setup
SELECT 
  'lesson_progress columns' as check_type,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'lesson_progress'
UNION ALL
SELECT 
  'triggers on lesson_progress',
  COUNT(*)
FROM information_schema.triggers
WHERE event_object_table = 'lesson_progress'
UNION ALL
SELECT
  'lesson_progress RLS policies',
  COUNT(*)
FROM pg_policies
WHERE tablename = 'lesson_progress';
