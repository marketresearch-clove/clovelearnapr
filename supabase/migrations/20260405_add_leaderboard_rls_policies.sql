-- ============================================================================
-- MIGRATION: Add RLS Policies for Leaderboard Table
-- ============================================================================
-- This migration ensures the leaderboard table has proper RLS policies
-- to allow authenticated users to read the leaderboard
-- ============================================================================

-- Enable RLS on leaderboard table if not already enabled
ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can read leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Admins can manage leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "System can update leaderboard entries" ON leaderboard;

-- Policy 1: All authenticated users can read the leaderboard
CREATE POLICY "Authenticated users can read leaderboard"
ON leaderboard FOR SELECT
USING (
  auth.role() = 'authenticated'
);

-- Policy 2: Admins and the system can insert/update leaderboard entries
CREATE POLICY "System can update leaderboard entries"
ON leaderboard FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
);

-- Policy 3: Admins can update leaderboard entries
CREATE POLICY "Admins can manage leaderboard"
ON leaderboard FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
);

-- Add comment to help future maintenance
COMMENT ON TABLE leaderboard IS 'Stores user leaderboard rankings based on points, courses completed, and learning hours';
