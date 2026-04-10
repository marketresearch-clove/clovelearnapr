-- Migration: Fix module_learning_stats_summary view to use lesson_progress time data
-- Date: April 10, 2026
-- Purpose: Fix hours calculation for modules (use actual lesson time, not course time)
-- Issue: Previous view used enrollments.hoursspent (course total) not lesson.time_spent_seconds
--        If user spent 69 seconds on a lesson, it was showing 4+ minutes if enrolled in 4 courses

-- Drop and recreate the view with correct aggregation using lesson_progress table
DROP VIEW IF EXISTS public.module_learning_stats_summary CASCADE;

CREATE OR REPLACE VIEW public.module_learning_stats_summary AS
SELECT
  l.id as moduleid,
  l.title as module_name,
  l.description,
  c.id as courseid,
  c.title as course_name,
  COALESCE(cat.name, 'Uncategorized') as category,
  -- Enrollment statistics: Count distinct users enrolled in the course
  COUNT(DISTINCT e.userid) as total_users_enrolled,
  -- Completion statistics: Count distinct users who completed this lesson
  COUNT(DISTINCT CASE WHEN lp.completed THEN lp.userid END) as users_completed,
  -- Completion percentage
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.userid) = 0 THEN 0
      ELSE COUNT(DISTINCT CASE WHEN lp.completed THEN lp.userid END)::numeric /
           COUNT(DISTINCT e.userid) * 100
    END, 2
  ) as avg_completion_percentage,
  -- Learning hours: Get time_spent_seconds from lesson_progress table (per lesson, not per course)
  -- This is the actual time users spent on THIS lesson
  COALESCE(
    ROUND(
      (SUM(COALESCE(lp.time_spent_seconds, 0))::numeric / 3600),
      2
    ),
    0
  ) as total_module_hours,
  -- Average hours per user who enrolled in the course
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.userid) = 0 THEN 0
      ELSE COALESCE(SUM(COALESCE(lp.time_spent_seconds, 0))::numeric / 3600, 0) /
           COUNT(DISTINCT e.userid)
    END,
    2
  ) as avg_hours_per_user,
  -- Last completion date
  MAX(lp.completed_at)::text as last_completion_date,
  COUNT(DISTINCT CASE WHEN lp.completed THEN lp.userid END) as completed_by_users
FROM
  lessons l
  LEFT JOIN courses c ON l.courseid = c.id
  LEFT JOIN public.categories cat ON c.category_id = cat.id
  LEFT JOIN enrollments e ON c.id = e.courseid
  -- Join lesson_progress directly: this has time_spent_seconds per lesson per user
  LEFT JOIN lesson_progress lp ON l.id = lp.lessonid AND e.userid = lp.userid
WHERE l.id IS NOT NULL
GROUP BY
  l.id,
  l.title,
  l.description,
  c.id,
  c.title,
  cat.name
ORDER BY
  c.title,
  l.title;

COMMENT ON VIEW public.module_learning_stats_summary IS
'Aggregated learning statistics for modules (lessons) with FIXED hours calculation.
Uses time_spent_seconds from lesson_progress table (per-lesson, not per-course time).
FIX: Now correctly sums actual lesson time, not course enrollment time.
Example: User spent 69s on lesson = 1m 9s in module_hours (not multiplied by course enrollments).';
