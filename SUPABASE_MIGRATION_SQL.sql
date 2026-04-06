-- ============================================
-- SUPABASE MIGRATION: Add Course Visibility
-- ============================================
-- Run this in Supabase SQL Editor
-- https://app.supabase.com > SQL Editor > New Query

-- Add is_visible column
ALTER TABLE public.course_assignments 
ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;

-- Add due_date column
ALTER TABLE public.course_assignments 
ADD COLUMN IF NOT EXISTS due_date date DEFAULT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_course_assignments_is_visible 
ON public.course_assignments(userid, is_visible);

-- Create composite index
CREATE INDEX IF NOT EXISTS idx_course_assignments_userid_visible
ON public.course_assignments(userid, is_visible, courseid);
