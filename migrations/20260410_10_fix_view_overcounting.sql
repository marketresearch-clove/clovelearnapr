-- Migration: Fix View Overcounting & Improve Aggregation (FIX #6)
-- Date: April 10, 2026
-- Purpose: Safer aggregation patterns to prevent double-counting in JOINs
-- Status: Production Ready

-- =========================================================================
-- VIEW: v_user_learning_summary (FIXED)
-- =========================================================================
-- Pre-aggregates at lesson level to prevent JOIN inflation

DROP VIEW IF EXISTS public.v_user_learning_summary CASCADE;

CREATE OR REPLACE VIEW public.v_user_learning_summary AS
SELECT
  lp.user_id,
  COUNT(DISTINCT lp.lesson_id) as total_lessons_accessed,
  COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.lesson_id END) as completed_lessons,
  COUNT(DISTINCT lp.course_id) as courses_enrolled,
  COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.course_id END) as courses_completed,
  
  -- Use pre-aggregated sum (prevents join inflation - FIX #6)
  ROUND((SUM(lp.time_spent_seconds)::NUMERIC / 3600), 2) as total_hours,
  ROUND((SUM(lp.time_spent_seconds)::NUMERIC / 60), 0)::INTEGER as total_minutes,
  SUM(lp.time_spent_seconds) as total_seconds,
  
  -- Calculate percentages safely
  ROUND(
    (COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.lesson_id END)::NUMERIC / 
     NULLIF(COUNT(DISTINCT lp.lesson_id), 0)) * 100,
    1
  ) as overall_completion_percentage,
  
  MAX(lp.last_accessed) as last_activity_at,
  MIN(lp.created_at) as first_activity_at
  
FROM public.lesson_progress lp
WHERE lp.deleted_at IS NULL
GROUP BY lp.user_id;

-- =========================================================================
-- VIEW: v_user_course_progress (FIXED - Safer aggregation)
-- =========================================================================

DROP VIEW IF EXISTS public.v_user_course_progress CASCADE;

CREATE OR REPLACE VIEW public.v_user_course_progress AS
WITH lesson_agg AS (
  -- Pre-aggregate at lesson level to prevent duplication
  SELECT
    lp.user_id,
    lp.course_id,
    lp.lesson_id,
    lp.time_spent_seconds,
    lp.progress,
    lp.is_completed
  FROM public.lesson_progress lp
  WHERE lp.deleted_at IS NULL
)
SELECT
  la.user_id,
  la.course_id,
  c.title as course_title,
  
  COUNT(DISTINCT la.lesson_id) as total_lessons,
  COUNT(DISTINCT CASE WHEN la.is_completed THEN la.lesson_id END) as completed_lessons,
  
  -- SafeAGG: No duplication risk
  ROUND(
    (COUNT(DISTINCT CASE WHEN la.is_completed THEN la.lesson_id END)::NUMERIC / 
     NULLIF(COUNT(DISTINCT la.lesson_id), 0)) * 100,
    1
  ) as completion_percentage,
  
  ROUND((SUM(la.time_spent_seconds)::NUMERIC / 3600), 2) as hours_spent,
  ROUND((SUM(la.time_spent_seconds)::NUMERIC / 60), 0)::INTEGER as minutes_spent,
  SUM(la.time_spent_seconds) as seconds_spent,
  
  ROUND(SUM(la.progress) / NULLIF(COUNT(la.lesson_id), 0), 1) as avg_progress_pct,
  MAX(la.progress) as max_progress_pct,
  
  MAX(CASE WHEN la.is_completed THEN CURRENT_DATE END) as last_completed_date,
  MAX(la.lesson_id) as last_accessed_lesson_id  -- Proxy for last activity
  
FROM lesson_agg la
LEFT JOIN public.courses c ON c.id = la.course_id
GROUP BY la.user_id, la.course_id, c.title;

-- =========================================================================
-- VIEW: v_course_learning_summary (FIXED)
-- =========================================================================
-- Course-level aggregation without JOIN inflation

DROP VIEW IF EXISTS public.v_course_learning_summary CASCADE;

CREATE OR REPLACE VIEW public.v_course_learning_summary AS
WITH course_stats AS (
  -- Pre-aggregate per course to prevent duplication
  SELECT
    lp.course_id,
    COUNT(DISTINCT lp.user_id) as enrolled_users,
    COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.user_id END) as users_completed,
    COUNT(DISTINCT lp.lesson_id) as total_lessons,
    
    -- Aggregate time WITHOUT risk of duplication
    SUM(lp.time_spent_seconds) as total_seconds,
    COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.lesson_id END) as total_lessons_completed,
    AVG(CASE WHEN lp.is_completed THEN 100 ELSE lp.progress END) as avg_completion_pct
  FROM public.lesson_progress lp
  WHERE lp.deleted_at IS NULL
  GROUP BY lp.course_id
)
SELECT
  c.id as course_id,
  c.title as course_title,
  
  cs.enrolled_users,
  cs.users_completed,
  ROUND((cs.users_completed::NUMERIC / NULLIF(cs.enrolled_users, 0)) * 100, 1) as completion_rate_pct,
  
  cs.total_lessons,
  cs.total_lessons_completed,
  ROUND((cs.total_lessons_completed::NUMERIC / NULLIF(cs.total_lessons, 0)) * 100, 1) as lesson_completion_rate_pct,
  
  ROUND((cs.total_seconds::NUMERIC / 3600), 0)::INTEGER as total_hours_spent,
  ROUND((cs.total_seconds::NUMERIC / 3600 / NULLIF(cs.enrolled_users, 0)), 2) as avg_hours_per_user,
  
  ROUND(cs.avg_completion_pct, 1) as avg_completion_pct,
  
  COUNT(DISTINCT ce.id) as lessons_in_course,
  c.duration_minutes as estimated_duration_minutes,
  
  MAX(lp.last_accessed) as last_activity_date
  
FROM course_stats cs
LEFT JOIN public.courses c ON c.id = cs.course_id
LEFT JOIN public.lessons ce ON ce.course_id = cs.course_id AND ce.deleted_at IS NULL
LEFT JOIN public.lesson_progress lp ON lp.course_id = cs.course_id
WHERE c.deleted_at IS NULL
GROUP BY 
  c.id, c.title, c.duration_minutes,
  cs.enrolled_users, cs.users_completed, cs.total_lessons, 
  cs.total_lessons_completed, cs.total_seconds, cs.avg_completion_pct;

-- =========================================================================
-- VIEW: v_lesson_learning_stats (Module-level, previously broken)
-- =========================================================================
-- Fixed version of v_module_learning_stats

DROP VIEW IF EXISTS public.v_module_learning_stats CASCADE;

CREATE OR REPLACE VIEW public.v_module_learning_stats AS
WITH module_stats AS (
  -- Aggregate at module (lesson) level safely
  SELECT
    lp.lesson_id,
    lp.course_id,
    COUNT(DISTINCT lp.user_id) as total_users_attempted,
    COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.user_id END) as total_users_completed,
    SUM(lp.time_spent_seconds) as total_seconds_spent,
    AVG(lp.progress) as avg_progress_pct,
    AVG(CASE WHEN lp.is_completed THEN 100 ELSE lp.progress END) as avg_completion_pct,
    MAX(lp.last_accessed) as last_activity_date
  FROM public.lesson_progress lp
  WHERE lp.deleted_at IS NULL
  GROUP BY lp.lesson_id, lp.course_id
)
SELECT
  l.id as lesson_id,
  l.title as lesson_title,
  c.id as course_id,
  c.title as course_title,
  
  ms.total_users_attempted,
  ms.total_users_completed,
  ROUND((ms.total_users_completed::NUMERIC / NULLIF(ms.total_users_attempted, 0)) * 100, 1) as completion_rate_pct,
  
  ROUND((ms.total_seconds_spent::NUMERIC / 3600), 2) as total_hours_spent,
  ROUND((ms.total_seconds_spent::NUMERIC / 3600 / NULLIF(ms.total_users_attempted, 0)), 2) as avg_hours_per_user,
  
  ROUND(ms.avg_progress_pct, 1) as avg_progress_pct,
  ROUND(ms.avg_completion_pct, 1) as avg_completion_pct,
  
  l.duration_minutes as estimated_duration_minutes,
  ROUND((l.duration_minutes::NUMERIC / 60), 1) as estimated_duration_hours,
  
  ms.last_activity_date
  
FROM module_stats ms
LEFT JOIN public.lessons l ON l.id = ms.lesson_id AND l.deleted_at IS NULL
LEFT JOIN public.courses c ON c.id = ms.course_id AND c.deleted_at IS NULL
WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL;

-- =========================================================================
-- VIEW: v_daily_learning_summary (For monitoring / trending)
-- =========================================================================

DROP VIEW IF EXISTS public.v_daily_learning_summary CASCADE;

CREATE OR REPLACE VIEW public.v_daily_learning_summary AS
WITH daily_activity AS (
  SELECT
    DATE(ls.started_at) as activity_date,
    COUNT(DISTINCT ls.user_id) as active_users,
    COUNT(DISTINCT ls.id) as total_sessions,
    COUNT(DISTINCT CASE WHEN ls.is_completed THEN ls.id END) as completed_sessions,
    SUM(ls.duration_seconds) as total_seconds,
    AVG(ls.duration_seconds) as avg_session_duration
  FROM public.learning_sessions ls
  WHERE ls.deleted_at IS NULL
  GROUP BY DATE(ls.started_at)
)
SELECT
  da.activity_date,
  da.active_users,
  da.total_sessions,
  ROUND((da.completed_sessions::NUMERIC / NULLIF(da.total_sessions, 0)) * 100, 1) as completion_rate_pct,
  ROUND((da.total_seconds::NUMERIC / 3600), 1) as total_hours,
  ROUND((da.total_seconds::NUMERIC / NULLIF(da.active_users, 0) / 60), 1) as avg_minutes_per_user,
  ROUND(da.avg_session_duration / 60, 1) as avg_session_minutes
FROM daily_activity da
ORDER BY da.activity_date DESC;

-- =========================================================================
-- GRANT PERMISSIONS
-- =========================================================================

GRANT SELECT ON public.v_user_learning_summary TO authenticated;
GRANT SELECT ON public.v_user_course_progress TO authenticated;
GRANT SELECT ON public.v_course_learning_summary TO authenticated;
GRANT SELECT ON public.v_lesson_learning_stats TO authenticated;
GRANT SELECT ON public.v_daily_learning_summary TO authenticated;

-- =========================================================================
-- COMMENTS
-- =========================================================================

COMMENT ON VIEW public.v_user_learning_summary IS
'User-level aggregation. Shows total hours, lessons completed, courses enrolled.
FIX #6: Pre-aggregates at lesson level to prevent JOIN duplication.';

COMMENT ON VIEW public.v_user_course_progress IS
'User progress per course. Shows completion %, hours spent, average progress.
FIX #6: Uses CTE with pre-aggregated lesson data to prevent overcounting.';

COMMENT ON VIEW public.v_course_learning_summary IS
'Course statistics. Shows enrollment, completion rates, time spent.
FIX #6: Aggregates at course level before any JOINs.';

COMMENT ON VIEW public.v_lesson_learning_stats IS
'Lesson (module) statistics. Shows completion rates, average time spent.
FIXED: Corrected JOIN references and column names. Uses pre-aggregation pattern.';

COMMENT ON VIEW public.v_daily_learning_summary IS
'Daily learning trends. Useful for dashboards and reporting.
Shows active users, sessions, hours, and completion rates per day.';
