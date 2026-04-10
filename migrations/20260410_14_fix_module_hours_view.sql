-- Migration: Fix module_learning_stats_summary view to use lesson_progress time data
-- Date: April 10, 2026
-- Purpose: Fix hours calculation for modules (use actual lesson time, not course time)
-- Issue: Previous view used enrollments.hoursspent (course total) not lesson.time_spent_seconds
--        If user spent 69 seconds on a lesson, it was showing 4+ minutes if enrolled in 4 courses

-- Drop and recreate the view with correct aggregation using lesson_progress table
-- Use CTE to pre-aggregate lesson time (prevents JOIN inflation)
DROP VIEW IF EXISTS public.module_learning_stats_summary CASCADE;

CREATE OR REPLACE VIEW public.module_learning_stats_summary AS
WITH lesson_stats AS (
  -- Pre-aggregate lesson time per lesson (before joining to enrollments)
  -- This prevents the JOIN to enrollments from multiplying the time values
  SELECT
    lp.lessonid,
    COUNT(DISTINCT lp.userid) as users_with_progress,
    COUNT(DISTINCT CASE WHEN lp.completed THEN lp.userid END) as users_completed,
    SUM(lp.time_spent_seconds) as total_seconds_spent,
    MAX(lp.completed_at) as last_completion_date
  FROM lesson_progress lp
  WHERE lp.lessonid IS NOT NULL
  GROUP BY lp.lessonid
)
SELECT
  l.id as moduleid,
  l.title as module_name,
  l.description,
  c.id as courseid,
  c.title as course_name,
  COALESCE(cat.name, 'Uncategorized') as category,
  -- Enrollment statistics: Count distinct users enrolled in the course
  COUNT(DISTINCT e.userid) as total_users_enrolled,
  -- Completion statistics: From pre-aggregated lesson_stats
  COALESCE(ls.users_completed, 0)::integer as users_completed,
  -- Completion percentage
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.userid) = 0 THEN 0
      ELSE COALESCE(ls.users_completed, 0)::numeric /
           COUNT(DISTINCT e.userid) * 100
    END, 2
  ) as avg_completion_percentage,
  -- Learning hours: From pre-aggregated lesson_stats (no JOIN duplication)
  -- This is the actual time users spent on THIS lesson
  COALESCE(
    ROUND(
      (COALESCE(ls.total_seconds_spent, 0)::numeric / 3600),
      2
    ),
    0
  ) as total_module_hours,
  -- Average hours per user who enrolled in the course
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.userid) = 0 THEN 0
      ELSE COALESCE(ls.total_seconds_spent, 0)::numeric / 3600 /
           COUNT(DISTINCT e.userid)
    END,
    2
  ) as avg_hours_per_user,
  -- Last completion date
  COALESCE(ls.last_completion_date, NULL)::text as last_completion_date,
  -- Completed users from pre-aggregated stats
  COALESCE(ls.users_completed, 0)::integer as completed_by_users
FROM
  lessons l
  LEFT JOIN courses c ON l.courseid = c.id
  LEFT JOIN public.categories cat ON c.category_id = cat.id
  LEFT JOIN enrollments e ON c.id = e.courseid
  LEFT JOIN lesson_stats ls ON l.id = ls.lessonid
WHERE l.id IS NOT NULL
GROUP BY
  l.id,
  l.title,
  l.description,
  c.id,
  c.title,
  cat.name,
  ls.users_completed,
  ls.total_seconds_spent,
  ls.last_completion_date
ORDER BY
  c.title,
  l.title;

COMMENT ON VIEW public.module_learning_stats_summary IS
'Aggregated learning statistics for modules (lessons) with FIXED hours calculation.
Uses CTE to pre-aggregate lesson_progress.time_spent_seconds per lesson (prevents JOIN inflation).
CRITICAL FIX: Previously used enrollments.hoursspent (course-total) causing duplication.
Now uses lesson-level time from lesson_progress table (per lesson, per user).
Example: User spent 69 seconds on lesson = exactly 1m 9s, not multiplied by enrollments.';
