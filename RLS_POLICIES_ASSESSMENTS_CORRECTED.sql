-- ============================================
-- CORRECTED RLS Policies for Assessments Table
-- ============================================
-- Use this SQL in your Supabase SQL Editor
-- This script safely updates existing policies

-- Enable RLS on assessments if not already enabled
ALTER TABLE IF EXISTS assessments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to replace them with corrected versions
DROP POLICY IF EXISTS "Learners can read assessments for enrolled courses" ON assessments;
DROP POLICY IF EXISTS "Instructors and admins can read all assessments" ON assessments;
DROP POLICY IF EXISTS "Instructors and admins can create assessments" ON assessments;
DROP POLICY IF EXISTS "Instructors and admins can update assessments" ON assessments;
DROP POLICY IF EXISTS "Instructors and admins can delete assessments" ON assessments;

-- Keep existing general policies that are working well
-- "Assessments are viewable by everyone" - SELECT policy with true condition
-- "Admins can insert assessments" - INSERT policy for admins
-- "Admins can update assessments" - UPDATE policy for admins
-- "Admins can delete assessments" - DELETE policy for admins

-- Policy 1: Learners can read assessments for courses they're enrolled in
CREATE POLICY "Learners can read assessments for enrolled courses"
ON assessments FOR SELECT
USING (
  courseid IN (
    SELECT courseid FROM enrollments 
    WHERE userid = auth.uid()
  )
);

-- Policy 2: Instructors can read all assessments
CREATE POLICY "Instructors can read all assessments"
ON assessments FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'instructor'
  )
  OR
  auth.jwt() ->> 'role' = 'instructor'
);

-- Policy 3: Instructors can create assessments for their courses
CREATE POLICY "Instructors can create assessments"
ON assessments FOR INSERT
WITH CHECK (
  courseid IN (
    SELECT id FROM courses 
    WHERE instructorid = auth.uid()
  )
  OR
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
);

-- Policy 4: Instructors can update assessments for their courses
CREATE POLICY "Instructors can update assessments"
ON assessments FOR UPDATE
USING (
  courseid IN (
    SELECT id FROM courses 
    WHERE instructorid = auth.uid()
  )
  OR
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
)
WITH CHECK (
  courseid IN (
    SELECT id FROM courses 
    WHERE instructorid = auth.uid()
  )
  OR
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
);

-- Policy 5: Instructors can delete assessments for their courses
CREATE POLICY "Instructors can delete own assessments"
ON assessments FOR DELETE
USING (
  courseid IN (
    SELECT id FROM courses 
    WHERE instructorid = auth.uid()
  )
  OR
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin'
  )
  OR
  auth.jwt() ->> 'role' = 'admin'
);
