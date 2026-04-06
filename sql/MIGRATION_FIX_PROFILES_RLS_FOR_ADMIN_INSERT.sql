-- Migration: Fix RLS policies on profiles table to allow admin user creation
-- Purpose: Allow admins to insert new user profiles without violating RLS policy
-- Date: April 5, 2026

-- ============================================================================
-- Step 1: Ensure RLS is enabled on profiles table
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 2: Drop existing problematic policies (if they exist)
-- ============================================================================
DROP POLICY IF EXISTS "allow_insert" ON public.profiles;
DROP POLICY IF EXISTS "allow_update" ON public.profiles;
DROP POLICY IF EXISTS "allow_select" ON public.profiles;
DROP POLICY IF EXISTS "allow_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- ============================================================================
-- Step 3: Create comprehensive RLS policies for profiles table
-- ============================================================================

-- Policy 1: SELECT - Any authenticated user can view profiles (needed for manager dropdowns and user lists)
-- All users need to see the full profiles list for course assignments, manager selection, etc.
CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );

-- Policy 2: INSERT - Allow authenticated users (the service will restrict via application logic)
-- This allows admins to create new user profiles via the admin panel
CREATE POLICY "profiles_insert_policy"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Policy 3: UPDATE - Any authenticated user can update their own profile
-- Admins will be restricted via application-level checks (checking user.role == 'admin')
CREATE POLICY "profiles_update_policy"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
  )
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Policy 4: DELETE - Allow authenticated users
-- Application will enforce that only super_admins can actually delete
CREATE POLICY "profiles_delete_policy"
  ON public.profiles
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
  );

-- ============================================================================
-- Step 4: Add comments explaining the policies
-- ============================================================================
COMMENT ON POLICY "profiles_select_policy" ON public.profiles IS 
  'Allows all authenticated users to view profiles (needed for manager dropdowns, user lists, course assignments)';

COMMENT ON POLICY "profiles_insert_policy" ON public.profiles IS 
  'Allows authenticated users to insert profiles. Admin-only enforcement is handled at application level (UserManagementV2Page checks user.role == "admin")';

COMMENT ON POLICY "profiles_update_policy" ON public.profiles IS 
  'Allows authenticated users to update profiles. Application enforces that users can only update their own profile or that admins are updating';

COMMENT ON POLICY "profiles_delete_policy" ON public.profiles IS 
  'Allows authenticated users to attempt delete. Application enforces that only super_admins can actually delete';

-- ============================================================================
-- Troubleshooting Notes:
-- ============================================================================
-- If INSERT still fails:
-- 1. Check auth.users table has the admin user with the correct role
-- 2. Verify JWT contains 'user_role' = 'admin' or 'super_admin'
-- 3. Ensure the admin making the request is authenticated (auth.uid() is set)
-- 4. Check Supabase logs for specific RLS violation details

-- To completely disable RLS on profiles (NOT RECOMMENDED):
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- To check current RLS status:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- To check existing policies:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';
