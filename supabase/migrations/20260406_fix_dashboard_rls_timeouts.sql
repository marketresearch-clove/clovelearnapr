-- ============================================================================
-- MIGRATION: Fix Dashboard Loading - Courses RLS and Timeout Issues
-- ============================================================================
-- Issue: Dashboard stuck loading after fetching enrollments/course IDs
-- Root Cause: Courses table RLS policy with visibility column is too complex
--             and causes queries to hang or timeout
-- Solution: Simplify courses RLS to allow all authenticated users to read
-- ============================================================================

ALTER TABLE IF EXISTS courses ENABLE ROW LEVEL SECURITY;

-- Drop problematic visibility-checking policies
DROP POLICY IF EXISTS "Users can read visible courses" ON courses;
DROP POLICY IF EXISTS "Courses are viewable by everyone" ON courses;
DROP POLICY IF EXISTS "public_can_read_courses" ON courses;

-- Drop admin policies to recreate cleanly
DROP POLICY IF EXISTS "Admins can read all courses" ON courses;
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;
DROP POLICY IF EXISTS "Admins can update courses" ON courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;

-- SIMPLE POLICY: All authenticated users can read all courses
-- No complex visibility checks that cause timeouts
DROP POLICY IF EXISTS "Authenticated users can read courses" ON courses;
CREATE POLICY "Authenticated users can read courses"
ON courses FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Admins can create courses
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;
CREATE POLICY "Admins can insert courses"
ON courses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can update courses
DROP POLICY IF EXISTS "Admins can update courses" ON courses;
CREATE POLICY "Admins can update courses"
ON courses FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can delete courses
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;
CREATE POLICY "Admins can delete courses"
ON courses FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- OPTIMIZE COURSES TABLE FOR DASHBOARD QUERIES
-- ============================================================================

-- Create index for commonly queried columns to speed up .in() queries
CREATE INDEX IF NOT EXISTS idx_courses_id_title_duration 
ON courses(id, title, duration);

CREATE INDEX IF NOT EXISTS idx_courses_id_instructor
ON courses(id, instructorname, instructorid);

-- ============================================================================
-- FIX LESSON_PROGRESS TABLE - ENSURE SIMPLE RLS
-- ============================================================================

ALTER TABLE IF EXISTS lesson_progress ENABLE ROW LEVEL SECURITY;

-- Drop overly complex policies
DROP POLICY IF EXISTS "Authenticated users can read lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Authenticated users can insert lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Authenticated users can update lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can read their own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can create lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can update own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can insert their own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Instructors can read course lesson progress" ON lesson_progress;

-- Simple policies that won't cause timeouts
-- Policy 1: Users can read/write their own progress (authenticated role)
DROP POLICY IF EXISTS "Users manage own lesson progress" ON lesson_progress;
CREATE POLICY "Users manage own lesson progress"
ON lesson_progress FOR ALL
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 2: Service role (triggers, backend) can manage all progress
DROP POLICY IF EXISTS "Service role manages lesson progress" ON lesson_progress;
CREATE POLICY "Service role manages lesson progress"
ON lesson_progress FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy 3: Admins can read all lesson progress
DROP POLICY IF EXISTS "Admins can read all lesson progress" ON lesson_progress;
CREATE POLICY "Admins can read all lesson progress"
ON lesson_progress FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Optimize queries with index on userid
CREATE INDEX IF NOT EXISTS idx_lesson_progress_userid_courseid
ON lesson_progress(userid, courseid);

-- ============================================================================
-- FIX LESSONS TABLE - ENSURE SIMPLE RLS  
-- ============================================================================

ALTER TABLE IF EXISTS lessons ENABLE ROW LEVEL SECURITY;

-- Drop complex policies
DROP POLICY IF EXISTS "Users can read lessons for visible courses" ON lessons;
DROP POLICY IF EXISTS "Enrolled users can read course lessons" ON lessons;

-- Simple policy: All authenticated users can read lessons
DROP POLICY IF EXISTS "Authenticated users can read lessons" ON lessons;
CREATE POLICY "Authenticated users can read lessons"
ON lessons FOR SELECT
USING (auth.role() = 'authenticated');

-- Admins can manage lessons
DROP POLICY IF EXISTS "Only admins can insert lessons" ON lessons;
DROP POLICY IF EXISTS "Only admins can update lessons" ON lessons;
DROP POLICY IF EXISTS "Only admins can delete lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can manage lessons" ON lessons;

DROP POLICY IF EXISTS "Admins can insert lessons" ON lessons;
CREATE POLICY "Admins can insert lessons"
ON lessons FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update lessons" ON lessons;
CREATE POLICY "Admins can update lessons"
ON lessons FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete lessons" ON lessons;
CREATE POLICY "Admins can delete lessons"
ON lessons FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Optimize courseid queries
CREATE INDEX IF NOT EXISTS idx_lessons_courseid
ON lessons(courseid);

-- ============================================================================
-- FIX LEADERBOARD TABLE - ENSURE SIMPLE RLS FOR TRIGGERS
-- ============================================================================

ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leaderboard')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r || '" ON leaderboard';
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated users can read leaderboard" ON leaderboard;
CREATE POLICY "Authenticated users can read leaderboard"
ON leaderboard FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert own leaderboard entry" ON leaderboard;
CREATE POLICY "Users can insert own leaderboard entry"
ON leaderboard FOR INSERT
WITH CHECK (auth.uid() = userid);

DROP POLICY IF EXISTS "Users can update own leaderboard entry" ON leaderboard;
CREATE POLICY "Users can update own leaderboard entry"
ON leaderboard FOR UPDATE
USING (auth.uid() = userid)
WITH CHECK (auth.uid() = userid);

DROP POLICY IF EXISTS "Admins can manage leaderboard" ON leaderboard;
CREATE POLICY "Admins can manage leaderboard"
ON leaderboard FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- VERIFY SIMPLIFIED RLS POLICIES
-- ============================================================================

SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('courses', 'lessons', 'lesson_progress')
GROUP BY tablename
ORDER BY tablename;
