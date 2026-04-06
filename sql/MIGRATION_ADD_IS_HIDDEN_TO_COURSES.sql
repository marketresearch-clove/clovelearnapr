-- Migration: Add is_hidden column to courses table
-- Purpose: Allow admins to hide courses from public catalog while keeping them available for admin assignment
-- This enables hiding specific courses from the public catalog page while still being assignable to users

-- Add is_hidden column to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Create index on is_hidden for query performance when filtering visible courses in public catalog
CREATE INDEX IF NOT EXISTS idx_courses_is_hidden 
ON public.courses(is_hidden) WHERE is_hidden = true;

-- Add comment explaining the column
COMMENT ON COLUMN public.courses.is_hidden IS 'When true, course is hidden from public catalog but can still be assigned to users by admins';
