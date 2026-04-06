-- Migration: Add visibility and due_date columns to course_assignments table
-- Purpose: Fix course hide/removal functionality by adding missing is_visible and due_date columns
-- Created: 2026-04-05

-- Add is_visible column if it doesn't exist
-- This column tracks whether a course assignment is visible/active for a user
ALTER TABLE public.course_assignments
ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;

-- Add due_date column if it doesn't exist  
-- This column stores the due date for mandatory course assignments
ALTER TABLE public.course_assignments
ADD COLUMN IF NOT EXISTS due_date date DEFAULT NULL;

-- Create index on is_visible for query performance when filtering visible assignments
CREATE INDEX IF NOT EXISTS idx_course_assignments_is_visible 
ON public.course_assignments(userid, is_visible);

-- Create index on due_date for deadline queries
CREATE INDEX IF NOT EXISTS idx_course_assignments_due_date 
ON public.course_assignments(due_date);

-- Create composite index for common query pattern (userid + is_visible)
CREATE INDEX IF NOT EXISTS idx_course_assignments_userid_visible
ON public.course_assignments(userid, is_visible, courseid);

-- Add comment documenting the columns
COMMENT ON COLUMN public.course_assignments.is_visible IS 'Whether this course assignment is visible/active to the user. false means course has been hidden/removed.';
COMMENT ON COLUMN public.course_assignments.due_date IS 'Optional due date for the course assignment';
