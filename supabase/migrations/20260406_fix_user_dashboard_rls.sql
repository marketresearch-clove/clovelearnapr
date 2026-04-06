-- ============================================================================
-- MIGRATION: Fix Dashboard Data Loading (Enrollments, Lesson Progress, Profiles RLS)
-- ============================================================================
-- This migration fixes critical RLS issues preventing user dashboard from loading:
-- 1. Enrollments - Users cannot read their own enrollments (BLOCKS stat cards + continue learning)
-- 2. Lesson Progress - Users need proper read/write access
-- 3. Profiles - Ensure users can read profile info
-- 4. Leaderboard - Verify policies are correct
--
-- Issue: DashboardPage.tsx fetches enrollments but RLS blocks regular users
-- ============================================================================

-- ============================================================================
-- PART 1: FIX ENROLLMENTS TABLE RLS
-- ============================================================================

ALTER TABLE IF EXISTS enrollments ENABLE ROW LEVEL SECURITY;

-- Drop conflicting or incomplete policies
DROP POLICY IF EXISTS "Admin can read all enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins can read all enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins can read enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins and instructors can read enrollments" ON enrollments;

-- Policy 1: Users can read their own enrollments (CRITICAL FOR DASHBOARD)
CREATE POLICY "Users can read their own enrollments"
ON enrollments FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 2: Admins can read all enrollments
CREATE POLICY "Admins can read all enrollments"
ON enrollments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy 3: Instructors can read enrollments for their courses
CREATE POLICY "Instructors can read course enrollments"
ON enrollments FOR SELECT
USING (
  courseid IN (
    SELECT id FROM courses 
    WHERE instructorid = auth.uid()
  )
);

-- Policy 4: Users can insert their own enrollments
CREATE POLICY "Users can enroll in courses"
ON enrollments FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 5: Users can update their own enrollments
CREATE POLICY "Users can update their own enrollments"
ON enrollments FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 6: Admins can manage all enrollments
CREATE POLICY "Admins can manage all enrollments"
ON enrollments FOR ALL
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
-- PART 2: FIX LESSON_PROGRESS TABLE RLS
-- ============================================================================

ALTER TABLE IF EXISTS lesson_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Instructors can view lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users manage own progress" ON lesson_progress;

-- Policy 1: Users can read their own lesson progress
CREATE POLICY "Users can read own lesson progress"
ON lesson_progress FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 2: Users can insert their own lesson progress
CREATE POLICY "Users can create lesson progress"
ON lesson_progress FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 3: Users can update their own lesson progress
CREATE POLICY "Users can update own lesson progress"
ON lesson_progress FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 4: Admins can read all lesson progress
CREATE POLICY "Admins can read all lesson progress"
ON lesson_progress FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy 5: Instructors can read lesson progress for their courses
CREATE POLICY "Instructors can read course lesson progress"
ON lesson_progress FOR SELECT
USING (
  courseid IN (
    SELECT id FROM courses 
    WHERE instructorid = auth.uid()
  )
);

-- Policy 6: System/Triggers can update lesson progress
CREATE POLICY "System can update lesson progress"
ON lesson_progress FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 3: VERIFY PROFILES TABLE RLS (Users need to read basic profile info)
-- ============================================================================

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Drop conflicting policies
DROP POLICY IF EXISTS "public profiles are viewable by everyone" ON profiles;

-- Policy 1: Authenticated users can read all profiles (for leaderboard, community, etc)
CREATE POLICY "Authenticated users can read profiles"
ON profiles FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = id
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = id
);

-- Policy 3: Admins can manage all profiles
CREATE POLICY "Admins can manage profiles"
ON profiles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- ============================================================================
-- PART 4: VERIFY COURSES TABLE RLS (Users need to read course info)
-- ============================================================================

ALTER TABLE IF EXISTS courses ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can read published/visible courses
CREATE POLICY "Users can read visible courses"
ON courses FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND (visibility = 'public' OR visibility IS NULL OR instructorid = auth.uid())
);

-- Policy 2: Admins can read all courses
CREATE POLICY "Admins can read all courses"
ON courses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- PART 5: ENSURE LESSONS TABLE HAS PROPER RLS
-- ============================================================================

ALTER TABLE IF EXISTS lessons ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can read lessons for courses they can see
CREATE POLICY "Users can read lessons for visible courses"
ON lessons FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND courseid IN (
    SELECT id FROM courses 
    WHERE visibility = 'public' OR visibility IS NULL
  )
);

-- Policy 2: Users enrolled in a course can read its lessons
CREATE POLICY "Enrolled users can read course lessons"
ON lessons FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND courseid IN (
    SELECT courseid FROM enrollments 
    WHERE userid = auth.uid()
  )
);

-- ============================================================================
-- PART 6: VERIFY LEADERBOARD TABLE (Should already be fixed but verify)
-- ============================================================================

ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;

-- Drop problematic policies if they exist
DO $$
DECLARE
  r text;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leaderboard')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r || '" ON leaderboard';
  END LOOP;
END $$;

-- Policy 1: Authenticated users can read leaderboard
CREATE POLICY "Authenticated users can read leaderboard"
ON leaderboard FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Service role can manage leaderboard (for triggers)
CREATE POLICY "Service role manages leaderboard"
ON leaderboard FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- VERIFICATION: Log RLS status
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('enrollments', 'lesson_progress', 'profiles', 'courses', 'lessons', 'leaderboard')
GROUP BY schemaname, tablename
ORDER BY tablename;
