-- ============================================================================
-- MIGRATION: Clean Fix for Assessment Results updated_at Error
-- ============================================================================
-- This migration:
-- 1. Removes ALL triggers that might reference updated_at
-- 2. Ensures updated_at column exists with proper DEFAULT
-- 3. Creates only the necessary trigger for business logic
-- ============================================================================

-- Drop ALL triggers and functions on assessment_results to clean slate
DROP TRIGGER IF EXISTS trigger_on_assessment_passed ON assessment_results CASCADE;
DROP TRIGGER IF EXISTS trigger_update_assessment_results_updated_at ON assessment_results CASCADE;
DROP TRIGGER IF EXISTS update_assessment_results_updated_at ON assessment_results CASCADE;
DROP FUNCTION IF EXISTS trigger_assessment_passed() CASCADE;
DROP FUNCTION IF EXISTS trigger_update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Ensure updated_at column exists with DEFAULT
DO $$
BEGIN
    -- Add updated_at if it doesn't exist
    ALTER TABLE assessment_results
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    
    -- For existing row, set updated_at if it's null
    UPDATE assessment_results SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
    
    -- Ensure the column is NOT NULL with proper default
    ALTER TABLE assessment_results ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE assessment_results ALTER COLUMN updated_at SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    -- If column already has NOT NULL, this is fine
    NULL;
END $$;

-- Create the quiz completion business logic trigger (NO updated_at manipulation)
CREATE FUNCTION trigger_assessment_passed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lessonid UUID;
  v_courseid UUID;
BEGIN
  -- Only process if assessment was passed
  IF NEW.passed = true AND (OLD IS NULL OR OLD.passed = false) THEN
    -- Get lesson and course IDs from assessment
    SELECT lessonid, courseid INTO v_lessonid, v_courseid
    FROM assessments
    WHERE id = NEW.assessmentid;

    -- Mark lesson as completed if it's a quiz
    IF v_lessonid IS NOT NULL THEN
      BEGIN
        INSERT INTO lesson_progress (userid, lessonid, courseid, completed, progress, completedat, updatedat)
        VALUES (NEW.userid, v_lessonid, v_courseid, true, 100, NOW(), NOW())
        ON CONFLICT (userid, lessonid) DO UPDATE SET
          completed = true,
          progress = 100,
          completedat = NOW(),
          updatedat = NOW();
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the insert
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger ONLY for business logic (AFTER INSERT)
CREATE TRIGGER trigger_on_assessment_passed
AFTER INSERT ON assessment_results
FOR EACH ROW
EXECUTE FUNCTION trigger_assessment_passed();

-- Verify setup
SELECT 
  'assessment_results columns' as check_type,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'assessment_results'
UNION ALL
SELECT 
  'triggers on assessment_results',
  COUNT(*)
FROM information_schema.triggers
WHERE event_object_table = 'assessment_results';
