-- ============================================================================
-- MIGRATION: Update user_skill_achievements schema
-- Adds course-related columns and fixes constraint validation
-- ============================================================================

-- 1. Add missing columns to user_skill_achievements
ALTER TABLE public.user_skill_achievements
  ADD COLUMN IF NOT EXISTS skill_name TEXT,
  ADD COLUMN IF NOT EXISTS course_level TEXT,
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS course_title TEXT,
  ADD COLUMN IF NOT EXISTS percentage_achieved NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Drop and recreate CHECK constraint for course_level
-- Accept both titlecase and lowercase variants
ALTER TABLE public.user_skill_achievements
  DROP CONSTRAINT IF EXISTS user_skill_achievements_course_level_check;

ALTER TABLE public.user_skill_achievements
  ADD CONSTRAINT user_skill_achievements_course_level_check
    CHECK (course_level IN ('Beginner', 'Intermediate', 'Advanced', 'beginner', 'intermediate', 'advanced', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'));

-- 3. Drop old UNIQUE constraint (will use simple unique constraint on user_id, skill_id)
ALTER TABLE public.user_skill_achievements
  DROP CONSTRAINT IF EXISTS user_skill_achievements_user_id_skill_id_key,
  DROP CONSTRAINT IF EXISTS user_skill_achievements_unique;

-- 4. Create simple UNIQUE constraint on user_id, skill_id
-- Prevents duplicate skill achievements per user regardless of course/level
ALTER TABLE public.user_skill_achievements
  ADD CONSTRAINT user_skill_achievements_unique UNIQUE (user_id, skill_id);

-- 5. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_skill_achievements_course_id
  ON public.user_skill_achievements(course_id);

CREATE INDEX IF NOT EXISTS idx_user_skill_achievements_skill_id
  ON public.user_skill_achievements(skill_id);

CREATE INDEX IF NOT EXISTS idx_user_skill_achievements_course_level
  ON public.user_skill_achievements(course_level);
