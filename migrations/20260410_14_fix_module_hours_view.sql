-- Migration: Fix module_learning_stats_summary view overcounting
-- Date: April 10, 2026
-- Purpose: Fix hours calculation for modules (was summing across multiple enrollments)
-- Issue: View was joining learning_hours improperly, causing duplicate hour counts
--        If a user completed course in 69 seconds but was enrolled in 4 courses, it would show 4+ minutes

-- Drop and recreate the view with correct aggregation
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
  -- Learning hours: Get from enrollments table (single source of truth)
  -- Sum hoursspent only for users who actually worked on this lesson
  COALESCE(
    ROUND(
      (SUM(CASE WHEN lp.userid IS NOT NULL THEN COALESCE(e.hoursspent, 0) ELSE 0 END)::numeric),
      2
    ),
    0
  ) as total_module_hours,
  -- Average hours per user who enrolled in the course
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.userid) = 0 THEN 0
      ELSE COALESCE(SUM(CASE WHEN lp.userid IS NOT NULL THEN COALESCE(e.hoursspent, 0) ELSE 0 END)::numeric, 0) /
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
  -- Join lesson_progress to track which lessons were actually accessed
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
Gets hoursspent from enrollments table (single source), only for users with lesson_progress.
FIX: Removed problematic learning_hours JOIN that was causing duplicate counting.
Now: User spent 69s on course = 69s in module_hours (not 4x 69s if in 4 courses).';
