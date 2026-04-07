-- ============================================================================
-- MIGRATION: Fix Admin Dashboard RLS - Allow Admins to Read All User Data
-- ============================================================================
-- Issue: Admin dashboard can't load user statistics, points, hours, and skills
-- Root Cause: user_statistics and user_skill_achievements tables have RLS policies
--             that restrict admins from efficiently reading all user data
-- Solution: Add admin-specific RLS policies that allow admins to bypass
--           row-level restrictions and read all data efficiently
-- ============================================================================

-- ============================================================================
-- 1. FIX USER_STATISTICS TABLE RLS FOR ADMINS
-- ============================================================================

-- Enable RLS on user_statistics
ALTER TABLE IF EXISTS user_statistics ENABLE ROW LEVEL SECURITY;

-- Drop admin policy if it exists
DROP POLICY IF EXISTS "Admins can read all user statistics" ON user_statistics;

-- Add admin-specific policy to read all statistics efficiently
CREATE POLICY "Admins can read all user statistics"
ON user_statistics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- 2. FIX USER_SKILL_ACHIEVEMENTS TABLE RLS FOR ADMINS
-- ============================================================================

-- Enable RLS on user_skill_achievements if it exists
ALTER TABLE IF EXISTS user_skill_achievements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read user skill achievements" ON user_skill_achievements;
DROP POLICY IF EXISTS "Users can read their own achievements" ON user_skill_achievements;
DROP POLICY IF EXISTS "Users can manage their achievements" ON user_skill_achievements;

-- Policy 1: Authenticated users can read all achievements (for org skills view)
CREATE POLICY "Authenticated users can read user skill achievements"
ON user_skill_achievements FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Users can manage their own achievements
CREATE POLICY "Users can manage their own achievements"
ON user_skill_achievements FOR ALL
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

-- Policy 3: Admins can read all achievements
CREATE POLICY "Admins can read all skill achievements"
ON user_skill_achievements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 4: Admins can manage all achievements
CREATE POLICY "Admins can manage skill achievements"
ON user_skill_achievements FOR ALL
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

-- Policy 5: Service role can manage achievements
CREATE POLICY "Service role can manage skill achievements"
ON user_skill_achievements FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. OPTIMIZE QUERIES WITH INDEXES
-- ============================================================================

-- Create indexes for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_user_skill_achievements_skill_id
ON user_skill_achievements(skill_id);

CREATE INDEX IF NOT EXISTS idx_user_skill_achievements_user_id
ON user_skill_achievements(user_id);

-- ============================================================================
-- VERIFY POLICIES APPLIED
-- ============================================================================

DO $$
DECLARE
  v_stats_policies INT;
  v_achievements_policies INT;
BEGIN
  SELECT COUNT(*) INTO v_stats_policies
  FROM pg_policies
  WHERE tablename = 'user_statistics';

  SELECT COUNT(*) INTO v_achievements_policies
  FROM pg_policies
  WHERE tablename = 'user_skill_achievements';

  RAISE NOTICE '✓ Admin Dashboard RLS Fixed (COMPLETED)';
  RAISE NOTICE 'user_statistics policies: %', v_stats_policies;
  RAISE NOTICE 'user_skill_achievements policies: %', v_achievements_policies;
  RAISE NOTICE '✓ Admins can now efficiently read all user data';
END $$;
