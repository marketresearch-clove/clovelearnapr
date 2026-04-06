-- ============================================================================
-- MIGRATION: Course Type + Acknowledgement Tables
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add course_type column to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'regular';

-- Valid values: 'regular', 'policy', 'compliance'
COMMENT ON COLUMN public.courses.course_type IS 'Course type: regular | policy | compliance';

CREATE INDEX IF NOT EXISTS idx_courses_course_type ON public.courses(course_type);

-- ============================================================================
-- 2. Create course_acknowledgements table
--    Stores each learner's signed acknowledgement per policy block
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,                  -- content block UUID within the lesson
  policy_title TEXT,                       -- display name of the policy
  signature TEXT NOT NULL,                 -- learner's typed full name
  acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_course_ack_user     ON public.course_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_course_ack_course   ON public.course_acknowledgements(course_id);
CREATE INDEX IF NOT EXISTS idx_course_ack_lesson   ON public.course_acknowledgements(lesson_id);

-- ============================================================================
-- 3. RLS Policies for course_acknowledgements
-- ============================================================================
ALTER TABLE public.course_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent re-run safety)
DROP POLICY IF EXISTS "Learners can insert own acknowledgements" ON public.course_acknowledgements;
DROP POLICY IF EXISTS "Learners can view own acknowledgements"   ON public.course_acknowledgements;
DROP POLICY IF EXISTS "Admins can view all acknowledgements"     ON public.course_acknowledgements;

-- Learner can insert/read their own acknowledgements
CREATE POLICY "Learners can insert own acknowledgements"
  ON public.course_acknowledgements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Learners can view own acknowledgements"
  ON public.course_acknowledgements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all acknowledgements
CREATE POLICY "Admins can view all acknowledgements"
  ON public.course_acknowledgements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );
