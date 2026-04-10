-- Migration: Standardize Time Tracking with Sessions
-- Date: April 10, 2026
-- Purpose: Implement proper time tracking with sessions and lesson-level granularity
-- All time stored in SECONDS (industry standard)

-- =========================================================================
-- 1. CREATE LEARNING_SESSIONS TABLE (NEW)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,

  -- Session timing (all in seconds)
  session_start TIMESTAMP WITH TIME ZONE NOT NULL,
  session_end TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,

  -- Session status
  is_completed BOOLEAN DEFAULT FALSE,
  is_paused BOOLEAN DEFAULT FALSE,
  idle_time_seconds INTEGER DEFAULT 0,

  -- Activity
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  client_ip INET,
  user_agent TEXT,

  CONSTRAINT check_session_duration CHECK (duration_seconds >= 0),
  CONSTRAINT check_session_end CHECK (session_end IS NULL OR session_end >= session_start)
);

-- Indexes for fast queries
CREATE INDEX idx_learning_sessions_user_id ON public.learning_sessions(user_id, session_start DESC);
CREATE INDEX idx_learning_sessions_course_id ON public.learning_sessions(course_id, created_at DESC);
CREATE INDEX idx_learning_sessions_active ON public.learning_sessions(user_id) WHERE is_completed = FALSE;

-- =========================================================================
-- 2. CREATE LESSON_TIME_LOGS TABLE (NEW)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.lesson_time_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.learning_sessions(id) ON DELETE SET NULL,

  -- Time tracking (all in seconds)
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,

  -- Completion
  is_lesson_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Idle tracking
  idle_seconds INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_time_spent CHECK (time_spent_seconds >= 0),
  CONSTRAINT check_idle_seconds CHECK (idle_seconds >= 0)
);

-- Indexes for fast queries
CREATE INDEX idx_lesson_time_logs_user_lesson ON public.lesson_time_logs(user_id, lesson_id);
CREATE INDEX idx_lesson_time_logs_session ON public.lesson_time_logs(session_id);
CREATE INDEX idx_lesson_time_logs_course ON public.lesson_time_logs(course_id, created_at DESC);
CREATE INDEX idx_lesson_time_logs_date ON public.lesson_time_logs(user_id, DATE(created_at));

-- =========================================================================
-- 3. ALTER LEARNING_HOURS TABLE - ADD SECONDS FIELD & DEPRECATION NOTICE
-- =========================================================================

ALTER TABLE public.learning_hours
ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS migration_notes TEXT;

-- Add constraint to prevent negative values
ALTER TABLE public.learning_hours
ADD CONSTRAINT check_time_spent_seconds CHECK (time_spent_seconds >= 0);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_learning_hours_seconds ON public.learning_hours(user_id, course_id, logged_date);

-- =========================================================================
-- 4. ALTER ENROLLMENTS TABLE - ADD TIME TRACKING
-- =========================================================================

ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS total_time_spent_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Create index for active sessions
CREATE INDEX IF NOT EXISTS idx_enrollments_last_accessed ON public.enrollments(user_id, last_accessed_at DESC);

-- =========================================================================
-- 5. ALTER LESSON_PROGRESS TABLE - ENSURE CONSISTENCY
-- =========================================================================

ALTER TABLE public.lesson_progress
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;

-- Make sure time_spent_seconds exists
ALTER TABLE public.lesson_progress
ADD CONSTRAINT check_lesson_progress_time CHECK (time_spent_seconds >= 0);

-- =========================================================================
-- 6. ALTER USER_STATISTICS TABLE - STANDARDIZE TIME
-- =========================================================================

ALTER TABLE public.user_statistics
ADD COLUMN IF NOT EXISTS total_time_spent_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_session_duration_seconds INTEGER DEFAULT 0;

-- =========================================================================
-- 7. CREATE TIME CONVERSION HELPER FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.convert_time_to_hours(seconds INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND(seconds::NUMERIC / 3600, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.convert_time_to_minutes(seconds INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND(seconds::NUMERIC / 60, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =========================================================================
-- 8. CREATE AGGREGATION VIEW FOR DAILY TIME TRACKING
-- =========================================================================

CREATE OR REPLACE VIEW public.v_daily_learning_stats AS
SELECT
  user_id,
  course_id,
  DATE(created_at) as learning_date,
  COUNT(DISTINCT session_id) as session_count,
  SUM(time_spent_seconds) as total_time_seconds,
  AVG(time_spent_seconds) as avg_time_per_lesson,
  MAX(created_at) as last_activity,
  COUNT(*) as lessons_practiced
FROM public.lesson_time_logs
WHERE is_lesson_completed = TRUE
GROUP BY user_id, course_id, DATE(created_at)
ORDER BY learning_date DESC;

-- =========================================================================
-- 9. CREATE SESSION SUMMARY VIEW
-- =========================================================================

CREATE OR REPLACE VIEW public.v_session_summary AS
SELECT
  ls.id as session_id,
  ls.user_id,
  ls.course_id,
  ls.lesson_id,
  ls.session_start,
  ls.session_end,
  ls.duration_seconds,
  public.convert_time_to_hours(ls.duration_seconds) as duration_hours,
  public.convert_time_to_minutes(ls.duration_seconds) as duration_minutes,
  COUNT(DISTINCT ltl.lesson_id) as unique_lessons_accessed,
  SUM(ltl.time_spent_seconds) as total_lesson_time_seconds,
  ls.is_completed
FROM public.learning_sessions ls
LEFT JOIN public.lesson_time_logs ltl ON ls.id = ltl.session_id
GROUP BY
  ls.id, ls.user_id, ls.course_id, ls.lesson_id,
  ls.session_start, ls.session_end, ls.duration_seconds, ls.is_completed
ORDER BY ls.session_start DESC;

-- =========================================================================
-- 10. CREATE RECONCILIATION CLEANUP FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.reconcile_learning_hours()
RETURNS TABLE(user_id UUID, course_id UUID, expected_seconds INTEGER, actual_seconds INTEGER, discrepancy_seconds INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ltl.user_id,
    ltl.course_id,
    (SELECT SUM(time_spent_seconds) FROM public.lesson_time_logs
     WHERE user_id = ltl.user_id AND course_id = ltl.course_id) as expected,
    (SELECT time_spent_seconds FROM public.learning_hours
     WHERE user_id = ltl.user_id AND course_id = ltl.course_id
     ORDER BY logged_date DESC LIMIT 1),
    ABS(
      COALESCE((SELECT SUM(time_spent_seconds) FROM public.lesson_time_logs
       WHERE user_id = ltl.user_id AND course_id = ltl.course_id), 0) -
      COALESCE((SELECT time_spent_seconds FROM public.learning_hours
       WHERE user_id = ltl.user_id AND course_id = ltl.course_id
       ORDER BY logged_date DESC LIMIT 1), 0)
    ) as discrepancy
  FROM public.lesson_time_logs ltl
  GROUP BY ltl.user_id, ltl.course_id;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 11. ENABLE RLS FOR NEW TABLES
-- =========================================================================

ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_time_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own sessions
CREATE POLICY "Users can see own learning sessions"
  ON public.learning_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Users can insert their own sessions
CREATE POLICY "Users can insert own learning sessions"
  ON public.learning_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own sessions
CREATE POLICY "Users can update own learning sessions"
  ON public.learning_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS: Users can see their own lesson time logs
CREATE POLICY "Users can see own lesson time logs"
  ON public.lesson_time_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Users can insert their own lesson time logs
CREATE POLICY "Users can insert own lesson time logs"
  ON public.lesson_time_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own lesson time logs
CREATE POLICY "Users can update own lesson time logs"
  ON public.lesson_time_logs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all data
CREATE POLICY "Admins view all learning sessions"
  ON public.learning_sessions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins view all lesson time logs"
  ON public.lesson_time_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- =========================================================================
-- 12. GRANT PERMISSIONS
-- =========================================================================

GRANT SELECT ON public.learning_sessions TO authenticated;
GRANT INSERT ON public.learning_sessions TO authenticated;
GRANT UPDATE ON public.learning_sessions TO authenticated;

GRANT SELECT ON public.lesson_time_logs TO authenticated;
GRANT INSERT ON public.lesson_time_logs TO authenticated;
GRANT UPDATE ON public.lesson_time_logs TO authenticated;

GRANT SELECT ON public.v_daily_learning_stats TO authenticated;
GRANT SELECT ON public.v_session_summary TO authenticated;

GRANT EXECUTE ON FUNCTION public.convert_time_to_hours(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_time_to_minutes(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_learning_hours() TO authenticated;

GRANT EXECUTE ON FUNCTION public.reconcile_learning_hours() TO service_role;

-- =========================================================================
-- 13. COMMENTS FOR DOCUMENTATION
-- =========================================================================

COMMENT ON TABLE public.learning_sessions IS
'High-level session tracking. Tracks when user starts/stops learning in a course.
Duration and idle_time measured in SECONDS.';

COMMENT ON TABLE public.lesson_time_logs IS
'Granular lesson-level time tracking. Each record = time spent on one lesson.
All time fields in SECONDS.';

COMMENT ON COLUMN public.learning_sessions.duration_seconds IS
'Total session duration in seconds. Calculated from session_start to session_end.';

COMMENT ON COLUMN public.lesson_time_logs.time_spent_seconds IS
'Time spent on this lesson in the session (in SECONDS). Excludes idle time.';

COMMENT ON COLUMN public.learning_hours.time_spent_seconds IS
'Daily aggregated time in SECONDS. Calculated from lesson_time_logs.';

-- =========================================================================
-- 14. CREATE INDEXES FOR PERFORMANCE
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_learning_sessions_date ON public.learning_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_date ON public.learning_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_time_logs_user_date ON public.lesson_time_logs(user_id, created_at DESC);

-- =========================================================================
-- END OF MIGRATION
-- =========================================================================
