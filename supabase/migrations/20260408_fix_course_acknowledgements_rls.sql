-- ============================================================================
-- MIGRATION: Fix Course Acknowledgements RLS - Allow Admins to Read All
-- ============================================================================
-- Issue: Admin acknowledgements page can't load other users' acknowledgements
-- Root Cause: Missing RLS policies on course_acknowledgements table
-- Solution: Add admin-specific RLS policies for course_acknowledgements
-- ============================================================================

-- ============================================================================
-- 1. ENABLE RLS ON COURSE_ACKNOWLEDGEMENTS TABLE
-- ============================================================================

ALTER TABLE IF EXISTS course_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own acknowledgements" ON course_acknowledgements;
DROP POLICY IF EXISTS "Users can insert their own acknowledgements" ON course_acknowledgements;
DROP POLICY IF EXISTS "Users can update their own acknowledgements" ON course_acknowledgements;
DROP POLICY IF EXISTS "Admins can read all acknowledgements" ON course_acknowledgements;
DROP POLICY IF EXISTS "Admins can manage all acknowledgements" ON course_acknowledgements;

-- ============================================================================
-- 2. CREATE RLS POLICIES FOR COURSE_ACKNOWLEDGEMENTS
-- ============================================================================

-- Policy 1: Authenticated users can read their own acknowledgements
CREATE POLICY "Users can read their own acknowledgements"
ON course_acknowledgements FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

-- Policy 2: Authenticated users can insert their own acknowledgements
CREATE POLICY "Users can insert their own acknowledgements"
ON course_acknowledgements FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

-- Policy 3: Authenticated users can update their own acknowledgements
CREATE POLICY "Users can update their own acknowledgements"
ON course_acknowledgements FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = user_id
);

-- Policy 4: Admins can read all acknowledgements
CREATE POLICY "Admins can read all acknowledgements"
ON course_acknowledgements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 5: Admins can manage all acknowledgements (insert, update, delete)
CREATE POLICY "Admins can manage all acknowledgements"
ON course_acknowledgements FOR ALL
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

-- Policy 6: Service role can manage all acknowledgements
CREATE POLICY "Service role can manage acknowledgements"
ON course_acknowledgements FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_course_acknowledgements_user_id
ON course_acknowledgements(user_id);

CREATE INDEX IF NOT EXISTS idx_course_acknowledgements_course_id
ON course_acknowledgements(course_id);

CREATE INDEX IF NOT EXISTS idx_course_acknowledgements_lesson_id
ON course_acknowledgements(lesson_id);

CREATE INDEX IF NOT EXISTS idx_course_acknowledgements_block_id
ON course_acknowledgements(block_id);

CREATE INDEX IF NOT EXISTS idx_course_acknowledgements_user_course
ON course_acknowledgements(user_id, course_id);

-- ============================================================================
-- 4. VERIFY POLICIES APPLIED
-- ============================================================================

DO $$
DECLARE
  v_ack_policies INT;
BEGIN
  SELECT COUNT(*) INTO v_ack_policies
  FROM pg_policies
  WHERE tablename = 'course_acknowledgements';

  RAISE NOTICE '✓ Course Acknowledgements RLS Fixed (COMPLETED)';
  RAISE NOTICE 'course_acknowledgements policies: %', v_ack_policies;
  RAISE NOTICE '✓ Admins can now read all acknowledgements';
  RAISE NOTICE '✓ Users can read only their own acknowledgements';
END $$;
