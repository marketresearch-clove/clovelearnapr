-- ============================================================================
-- MIGRATION: Fix RLS Policies for Assessments Table
-- ============================================================================
-- This migration fixes the 406 error by ensuring assessments have proper
-- read policies for authenticated users
-- ============================================================================

-- Enable RLS on assessments table if not already enabled
ALTER TABLE IF EXISTS assessments ENABLE ROW LEVEL SECURITY;

-- Drop conflicting or overly restrictive policies
DROP POLICY IF EXISTS "Learners can read assessments for enrolled courses" ON assessments;
DROP POLICY IF EXISTS "Instructors can read all assessments" ON assessments;
DROP POLICY IF EXISTS "Instructors can create assessments" ON assessments;
DROP POLICY IF EXISTS "Instructors can update assessments" ON assessments;
DROP POLICY IF EXISTS "Instructors can delete own assessments" ON assessments;

-- Policy 1: All authenticated users can read assessments
-- (Lesson access control is handled by enrollment checks in the application layer)
CREATE POLICY "Authenticated users can read assessments"
ON assessments FOR SELECT
USING (
  auth.role() = 'authenticated'
);

-- Policy 2: Admins can insert assessments
CREATE POLICY "Admins can insert assessments"
ON assessments FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
);

-- Policy 3: Admins can update assessments
CREATE POLICY "Admins can update assessments"
ON assessments FOR UPDATE
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

-- Policy 4: Admins can delete assessments
CREATE POLICY "Admins can delete assessments"
ON assessments FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
);
