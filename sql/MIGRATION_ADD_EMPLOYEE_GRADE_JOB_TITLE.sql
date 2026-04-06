-- ============================================================================
-- MIGRATION: ADD EMPLOYEE GRADE AND JOB TITLE TO PROFILES
-- Skill Spire LMS - Organization Hierarchy Support
-- ============================================================================

-- Add employee_grade and job_title columns to profiles table
-- This enables organizational hierarchy tracking

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS employee_grade TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS office_location TEXT;

-- Create index for manager queries (hierarchy lookup)
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);

-- Update profiles table comment
COMMENT ON TABLE public.profiles IS 'User profiles with extended organizational information';
COMMENT ON COLUMN public.profiles.employee_grade IS 'Employee grade level (e.g., Junior, Senior, Lead, Manager)';
COMMENT ON COLUMN public.profiles.job_title IS 'Job title or role';
COMMENT ON COLUMN public.profiles.office_location IS 'Office location or work site';
COMMENT ON COLUMN public.profiles.manager_id IS 'Reference to managers profile for hierarchy';
