-- ============================================================================
-- MIGRATION: Fix RLS Policies for community_posts and user_statistics
-- ============================================================================
-- This migration ensures community_posts and user_statistics tables have
-- proper RLS policies so authenticated users can read and write data
-- ============================================================================

-- ============================================================================
-- 1. FIX COMMUNITY_POSTS TABLE RLS
-- ============================================================================

-- Enable RLS on community_posts
ALTER TABLE IF EXISTS community_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read community posts" ON community_posts;
DROP POLICY IF EXISTS "Users can create community posts" ON community_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON community_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON community_posts;

-- Policy 1: Authenticated users can read all community posts
CREATE POLICY "Authenticated users can read community posts"
ON community_posts FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Authenticated users can create posts
CREATE POLICY "Users can create community posts"
ON community_posts FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 3: Users can update their own posts
CREATE POLICY "Users can update their own posts"
ON community_posts FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 4: Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
ON community_posts FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 5: Service role (triggers) can manage community posts
CREATE POLICY "Service role can manage community posts"
ON community_posts FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 2. FIX COMMUNITY_LIKES TABLE RLS
-- ============================================================================

-- Enable RLS on community_likes if table exists
ALTER TABLE IF EXISTS community_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read community likes" ON community_likes;
DROP POLICY IF EXISTS "Users can like posts" ON community_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON community_likes;

-- Policy 1: Authenticated users can read like data
CREATE POLICY "Authenticated users can read community likes"
ON community_likes FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Authenticated users can add likes
CREATE POLICY "Users can like posts"
ON community_likes FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 3: Users can remove their own likes
CREATE POLICY "Users can unlike posts"
ON community_likes FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- ============================================================================
-- 3. FIX COMMUNITY_COMMENTS TABLE RLS (if it exists)
-- ============================================================================

-- Enable RLS on community_comments if table exists
ALTER TABLE IF EXISTS community_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read community comments" ON community_comments;
DROP POLICY IF EXISTS "Users can create comments" ON community_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON community_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON community_comments;

-- Policy 1: Authenticated users can read comments
CREATE POLICY "Authenticated users can read community comments"
ON community_comments FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Authenticated users can create comments
CREATE POLICY "Users can create comments"
ON community_comments FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 3: Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON community_comments FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 4: Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON community_comments FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- ============================================================================
-- 4. FIX USER_STATISTICS TABLE RLS
-- ============================================================================

-- Enable RLS on user_statistics
ALTER TABLE IF EXISTS user_statistics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read user statistics" ON user_statistics;
DROP POLICY IF EXISTS "Users can access their own statistics" ON user_statistics;
DROP POLICY IF EXISTS "System can update statistics" ON user_statistics;

-- Policy 1: Authenticated users can read user statistics (for leaderboard/public profiles)
CREATE POLICY "Authenticated users can read user statistics"
ON user_statistics FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Users can read and write their own statistics
CREATE POLICY "Users can access their own statistics"
ON user_statistics FOR ALL
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = userid
);

-- Policy 3: Service role (triggers, backend) can manage statistics
CREATE POLICY "Service role can update statistics"
ON user_statistics FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 5. OPTIONAL: Verify tables have needed columns
-- ============================================================================

-- Ensure community_posts has a userid column (if not, add it)
ALTER TABLE IF EXISTS community_posts
ADD COLUMN IF NOT EXISTS userid UUID REFERENCES auth.users(id);

-- Ensure community_likes has the necessary columns
ALTER TABLE IF EXISTS community_likes
ADD COLUMN IF NOT EXISTS userid UUID REFERENCES auth.users(id);

-- Ensure community_comments has a userid column (if it exists)
ALTER TABLE IF EXISTS community_comments
ADD COLUMN IF NOT EXISTS userid UUID REFERENCES auth.users(id);

-- Ensure user_statistics has a userid column
ALTER TABLE IF EXISTS user_statistics
ADD COLUMN IF NOT EXISTS userid UUID REFERENCES auth.users(id);

-- ============================================================================
-- 6. Create indexes for better query performance
-- ============================================================================

-- Index for community posts queries
CREATE INDEX IF NOT EXISTS idx_community_posts_userid ON community_posts(userid);
CREATE INDEX IF NOT EXISTS idx_community_posts_createdat ON community_posts(createdat DESC);

-- Index for community likes
CREATE INDEX IF NOT EXISTS idx_community_likes_userid ON community_likes(userid);
CREATE INDEX IF NOT EXISTS idx_community_likes_postid ON community_likes(postid);

-- Index for community comments (if table exists)
CREATE INDEX IF NOT EXISTS idx_community_comments_userid ON community_comments(userid);
CREATE INDEX IF NOT EXISTS idx_community_comments_postid ON community_comments(postid);

-- Index for user statistics
CREATE INDEX IF NOT EXISTS idx_user_statistics_userid ON user_statistics(userid);

-- ============================================================================
-- 7. Add audit timestamp columns if missing
-- ============================================================================

-- Add created_at and updated_at to community tables if they don't exist
ALTER TABLE IF EXISTS community_posts
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS community_comments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 8. Upsert helper function for stats (if needed by triggers)
-- ============================================================================

-- Create or replace function to get user stats safely
CREATE OR REPLACE FUNCTION get_or_create_user_stats(p_userid UUID)
RETURNS TABLE (
  id UUID,
  userid UUID,
  totalcoursesenrolled INT,
  coursescompleted INT,
  totallearninghours INT,
  currentstreak INT,
  totalpoints INT
) AS $$
BEGIN
  -- Try to get existing stats
  RETURN QUERY
  SELECT 
    s.id,
    s.userid,
    s.totalcoursesenrolled,
    s.coursescompleted,
    s.totallearninghours,
    s.currentstreak,
    s.totalpoints
  FROM user_statistics s
  WHERE s.userid = p_userid;

  -- If no stats found, insert default ones
  IF NOT FOUND THEN
    INSERT INTO user_statistics (userid, totalcoursesenrolled, coursescompleted, totallearninghours, currentstreak, totalpoints)
    VALUES (p_userid, 0, 0, 0, 0, 0)
    ON CONFLICT (userid) DO NOTHING;

    -- Return the created/existing stats
    RETURN QUERY
    SELECT 
      s.id,
      s.userid,
      s.totalcoursesenrolled,
      s.coursescompleted,
      s.totallearninghours,
      s.currentstreak,
      s.totalpoints
    FROM user_statistics s
    WHERE s.userid = p_userid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- TESTING: Log successful completion
-- ============================================================================

-- Output completion message
DO $$
BEGIN
  RAISE NOTICE 'RLS Policies Update - Community and Statistics Tables (COMPLETED)';
  RAISE NOTICE 'Tables updated:';
  RAISE NOTICE '✓ community_posts - All policies and indexes created';
  RAISE NOTICE '✓ community_likes - All policies created';
  RAISE NOTICE '✓ community_comments - All policies created (if table exists)';
  RAISE NOTICE '✓ user_statistics - All policies created';
  RAISE NOTICE 'Helpful function created: get_or_create_user_stats()';
END $$;
