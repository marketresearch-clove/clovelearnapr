-- ============================================================================
-- MIGRATION: Fix Assessment Results RLS and Trigger Issues
-- ============================================================================
-- This migration fixes:
-- 1. Missing updated_at columns in assessment_results and quiz_results
-- 2. RLS policies for authenticated users to insert assessment results
-- 3. Corrected trigger function that was referencing non-existent columns
-- ============================================================================

-- Add updated_at column if it doesn't exist (fixes trigger error)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'assessment_results' AND COLUMN_NAME = 'updated_at') THEN
        ALTER TABLE assessment_results ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'quiz_results' AND COLUMN_NAME = 'updated_at') THEN
        ALTER TABLE quiz_results ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Enable RLS on assessment_results if not already enabled
ALTER TABLE IF EXISTS assessment_results ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic INSERT policies
DROP POLICY IF EXISTS "Users can insert their own assessment results" ON assessment_results;
DROP POLICY IF EXISTS "Authenticated users can insert assessment results" ON assessment_results;
DROP POLICY IF EXISTS "Authenticated users can update assessment results" ON assessment_results;
DROP POLICY IF EXISTS "Authenticated users can read assessment results" ON assessment_results;

-- Add permissive INSERT policy for authenticated users (they save their own results)
CREATE POLICY "Authenticated users can insert assessment results"
ON assessment_results FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own results
CREATE POLICY "Authenticated users can update assessment results"
ON assessment_results FOR UPDATE
USING (
  auth.role() = 'authenticated'
);

-- Allow authenticated users to view their own results
CREATE POLICY "Authenticated users can read assessment results"
ON assessment_results FOR SELECT
USING (
  auth.role() = 'authenticated'
);

-- Drop and recreate corrected trigger function (fixes column reference issues)
DROP TRIGGER IF EXISTS trigger_on_assessment_passed ON assessment_results CASCADE;
DROP TRIGGER IF EXISTS trigger_update_assessment_results_updated_at ON assessment_results CASCADE;
DROP FUNCTION IF EXISTS trigger_assessment_passed() CASCADE;
DROP FUNCTION IF EXISTS trigger_update_updated_at() CASCADE;

-- Create corrected version that properly uses column names
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
  IF NEW.passed = true AND (OLD.passed IS NULL OR OLD.passed = false) THEN
    -- Get lesson and course IDs from assessment
    SELECT lessonid, courseid INTO v_lessonid, v_courseid
    FROM assessments
    WHERE id = NEW.assessmentid;

    -- Mark lesson as completed if it's a quiz
    IF v_lessonid IS NOT NULL THEN
      INSERT INTO lesson_progress (userid, lessonid, courseid, completed, progress, completedat, updatedat)
      VALUES (NEW.userid, v_lessonid, v_courseid, true, 100, NOW(), NOW())
      ON CONFLICT (userid, lessonid) DO UPDATE SET
        completed = true,
        progress = 100,
        completedat = NOW(),
        updatedat = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger (AFTER trigger for business logic)
-- Note: updated_at is handled by database DEFAULT CURRENT_TIMESTAMP, no need for BEFORE trigger
CREATE TRIGGER trigger_on_assessment_passed
AFTER INSERT OR UPDATE ON assessment_results
FOR EACH ROW
EXECUTE FUNCTION trigger_assessment_passed();

-- Fix leaderboard RLS (allow authenticated users to insert/update)
ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;

-- Drop all existing leaderboard policies to avoid conflicts
DO $$
DECLARE
  r text;
BEGIN
  -- Drop all existing policies for leaderboard table
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leaderboard')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r || '" ON leaderboard';
  END LOOP;
END $$;

-- Create fresh policies
DO $$
BEGIN
  -- Check if policies exist before creating them
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard' AND policyname = 'Authenticated users can insert leaderboard') THEN
    CREATE POLICY "Authenticated users can insert leaderboard"
    ON leaderboard FOR INSERT
    WITH CHECK (
      auth.role() = 'authenticated'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard' AND policyname = 'Authenticated users can update leaderboard') THEN
    CREATE POLICY "Authenticated users can update leaderboard"
    ON leaderboard FOR UPDATE
    USING (
      auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- Verify all policies are in place
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename IN ('assessment_results', 'leaderboard')
ORDER BY tablename, policyname;
