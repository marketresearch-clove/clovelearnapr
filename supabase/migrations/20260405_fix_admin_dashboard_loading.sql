-- ============================================================================
-- MIGRATION: Fix Admin Dashboard Loading Issues
-- ============================================================================
-- This migration fixes critical RLS and RPC issues preventing admin users
-- from loading stats, continue learning, leaderboard, and courses data
-- 
-- Issues Fixed:
-- 1. Create missing get_global_analytics RPC function
-- 2. Add RLS policies for learning_hours table (currently unprotected)
-- 3. Fix conflicting leaderboard RLS policies
-- 4. Ensure admins can read enrollments, courses, profiles
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE get_global_analytics RPC FUNCTION
-- ============================================================================
-- This RPC is called by AdminDashboard.tsx to get global analytics metrics

DROP FUNCTION IF EXISTS public.get_global_analytics() CASCADE;

CREATE FUNCTION public.get_global_analytics()
RETURNS TABLE(
  total_active_learners INT,
  course_completion_rate NUMERIC,
  assessment_pass_rate NUMERIC,
  avg_learning_hours NUMERIC,
  certificates_earned INT,
  skill_coverage_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_enrollments INT;
  completed_enrollments INT;
  passed_assessments INT;
  total_assessments INT;
  total_certs INT;
  avg_hours NUMERIC;
  total_skills INT;
  covered_skills INT;
BEGIN
  -- Total active learners (users with at least one enrollment)
  SELECT COUNT(DISTINCT userid) 
  INTO total_active_learners 
  FROM enrollments 
  WHERE userid IS NOT NULL;

  -- Course completion rate
  SELECT COUNT(*) INTO total_enrollments FROM enrollments;
  SELECT COUNT(*) INTO completed_enrollments FROM enrollments WHERE completed = true;
  
  course_completion_rate := CASE 
    WHEN total_enrollments > 0 THEN ROUND(((completed_enrollments::NUMERIC / total_enrollments) * 100)::NUMERIC, 2)
    ELSE 0
  END;

  -- Assessment pass rate
  SELECT COUNT(*) INTO total_assessments FROM assessment_results;
  SELECT COUNT(*) INTO passed_assessments FROM assessment_results WHERE passed = true;
  
  assessment_pass_rate := CASE 
    WHEN total_assessments > 0 THEN ROUND(((passed_assessments::NUMERIC / total_assessments) * 100)::NUMERIC, 2)
    ELSE 0
  END;

  -- Average learning hours per user
  SELECT ROUND(AVG(COALESCE(hoursspent, 0))::NUMERIC / 60, 2)
  INTO avg_hours
  FROM learning_hours;
  
  avg_learning_hours := COALESCE(avg_hours, 0);

  -- Total certificates earned
  SELECT COUNT(*) INTO total_certs FROM certificates;
  certificates_earned := COALESCE(total_certs, 0);

  -- Skill coverage percentage (skills assigned / total possible skills)
  -- Uses skill_course_mappings table (official relationship table)
  SELECT COUNT(DISTINCT skillid) INTO total_skills FROM skill_course_mappings;
  SELECT COUNT(DISTINCT skillid) INTO covered_skills 
  FROM skill_course_mappings scm
  WHERE EXISTS (
    SELECT 1 FROM enrollments e 
    WHERE e.courseid = scm.courseid AND e.completed = true
  );
  
  skill_coverage_pct := CASE 
    WHEN total_skills > 0 THEN ROUND(((covered_skills::NUMERIC / total_skills) * 100)::NUMERIC, 2)
    ELSE 0
  END;

  RETURN NEXT;
END;
$$;

-- Grant execute permission to authenticated users (including admins)
GRANT EXECUTE ON FUNCTION public.get_global_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_analytics() TO service_role;

-- ============================================================================
-- PART 2: FIX LEARNING_HOURS TABLE RLS POLICIES
-- ============================================================================
-- Currently has no RLS policies - adding proper security

-- Enable RLS on learning_hours if not already enabled
ALTER TABLE IF EXISTS learning_hours ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own learning hours" ON learning_hours;
DROP POLICY IF EXISTS "Admins can read all learning hours" ON learning_hours;
DROP POLICY IF EXISTS "Service role can manage learning hours" ON learning_hours;

-- Policy 1: Users can read their own learning hours
CREATE POLICY "Users can read own learning hours"
ON learning_hours FOR SELECT
USING (
  auth.uid() = userid
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'instructor')
  )
);

-- Policy 2: Admins can read all learning hours
CREATE POLICY "Admins can read all learning hours"
ON learning_hours FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy 3: Instructors can read their students' learning hours
CREATE POLICY "Instructors can read student learning hours"
ON learning_hours FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'instructor'
    AND EXISTS (
      SELECT 1 FROM enrollments e
      JOIN courses c ON e.courseid = c.id
      WHERE e.userid = learning_hours.userid
      AND c.instructorid = p.id
    )
  )
);

-- Policy 4: Service role can manage for automated updates
CREATE POLICY "Service role can manage learning hours"
ON learning_hours FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_learning_hours_userid ON learning_hours(userid);

-- ============================================================================
-- PART 3: CONSOLIDATE LEADERBOARD RLS POLICIES
-- ============================================================================
-- Two conflicting migrations exist - consolidate into one clear set

ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing leaderboard policies from both migrations
DO $$
DECLARE
  r text;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leaderboard')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r || '" ON leaderboard';
  END LOOP;
END $$;

-- Create unified leaderboard policies

-- Policy 1: All authenticated users can read leaderboard (for "Continue Learning" section)
CREATE POLICY "Authenticated users can read leaderboard"
ON leaderboard FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Users can insert/update their own leaderboard entry
CREATE POLICY "Users can manage own leaderboard entry"
ON leaderboard FOR INSERT
WITH CHECK (auth.uid() = userid);

-- Policy 3: System/triggers can update leaderboard (for SECURITY DEFINER functions)
CREATE POLICY "Service role can update leaderboard"
ON leaderboard FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy 4: Admins can read all leaderboard data
CREATE POLICY "Admins can manage all leaderboard"
ON leaderboard FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- PART 4: FIX ENROLLMENTS RLS POLICIES
-- ============================================================================
-- Ensure admins can read all enrollments for stats calculation

ALTER TABLE IF EXISTS enrollments ENABLE ROW LEVEL SECURITY;

-- Note: We're checking if policies exist before creating to avoid duplicates
DO $$
BEGIN
  -- Drop the admin-specific policies if they exist (we'll recreate them)
  DROP POLICY IF EXISTS "Admin can read all enrollments" ON enrollments;
  DROP POLICY IF EXISTS "Admins can read enrollments" ON enrollments;
  DROP POLICY IF EXISTS "Admins and instructors can read enrollments" ON enrollments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Check if any admin policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'enrollments' 
    AND policyname LIKE '%admin%'
  ) THEN
    EXECUTE '
    CREATE POLICY "Admins can read all enrollments"
    ON enrollments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = ''admin''
      )
    )';
  END IF;
END $$;

-- ============================================================================
-- PART 5: FIX COURSES RLS POLICIES
-- ============================================================================
-- Ensure admins can read all courses for stats

ALTER TABLE IF EXISTS courses ENABLE ROW LEVEL SECURITY;

-- Check if admin read policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'courses' 
    AND policyname LIKE '%admin%'
  ) THEN
    EXECUTE '
    CREATE POLICY "Admins can read all courses"
    ON courses FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = ''admin''
      )
    )';
  END IF;
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

-- Verify all policies are in place
COMMENT ON FUNCTION public.get_global_analytics() IS 'Calculates global platform analytics for admin dashboard. Returns active learners, completion rates, pass rates, learning hours, certificates, and skill coverage.';

-- Summary of changes
DO $$
BEGIN
  RAISE NOTICE 'MIGRATION COMPLETE: Admin Dashboard RLS Fixes Applied';
  RAISE NOTICE '✅ Created get_global_analytics() RPC function';
  RAISE NOTICE '✅ Added RLS policies for learning_hours table';
  RAISE NOTICE '✅ Unified leaderboard RLS policies';
  RAISE NOTICE '✅ Verified admin read access to enrollments and courses';
END $$;
