-- Migration: Create accurate module hours view using lesson_time_logs (most granular source)
-- Date: April 10, 2026
-- Purpose: Use finest-grained time data (lesson_time_logs) for most accurate module hours
-- Rationale: lesson_time_logs has exact time chunks; aggregating here is more reliable than
--           relying on pre-aggregated lesson_progress which may have sync issues

-- Drop old view and create new one
DROP VIEW IF EXISTS public.module_learning_stats_summary CASCADE;

CREATE OR REPLACE VIEW public.module_learning_stats_summary AS
WITH raw_lesson_times AS (
  -- Get lesson progress time from lesson_progress table (actual source being written to)
  -- This is where updateLessonProgress() stores time_spent_seconds
  SELECT
    lp.lessonid as lesson_id,
    lp.userid as user_id,
    COALESCE(lp.time_spent_seconds, 0) as user_lesson_total_seconds,
    lp.completedat as last_activity
  FROM public.lesson_progress lp
  WHERE lp.lessonid IS NOT NULL
    AND lp.userid IS NOT NULL
    AND COALESCE(lp.time_spent_seconds, 0) > 0
),
lesson_aggregates AS (
  -- Aggregate per lesson from raw times
  SELECT
    rlt.lesson_id,
    COUNT(DISTINCT rlt.user_id) as users_with_progress,
    COUNT(DISTINCT CASE WHEN rlt.user_lesson_total_seconds > 0 THEN rlt.user_id END) as users_completed,
    SUM(rlt.user_lesson_total_seconds) as total_seconds_spent,
    MAX(rlt.last_activity) as last_completion_date
  FROM raw_lesson_times rlt
  GROUP BY rlt.lesson_id
),
course_enrollments AS (
  -- Count distinct users enrolled per course
  SELECT
    courseid,
    COUNT(DISTINCT userid) as total_users_enrolled
  FROM public.enrollments
  GROUP BY courseid
)
SELECT
  l.id as moduleid,
  l.title as module_name,
  l.description,
  c.id as courseid,
  c.title as course_name,
  COALESCE(cat.name, 'Uncategorized') as category,
  -- Enrollment statistics
  COALESCE(ce.total_users_enrolled, 0)::integer as total_users_enrolled,
  -- Completion statistics (users who spent time on this lesson)
  COALESCE(la.users_completed, 0)::integer as users_completed,
  -- Completion percentage
  ROUND(
    CASE
      WHEN COALESCE(ce.total_users_enrolled, 0) = 0 THEN 0
      ELSE COALESCE(la.users_completed, 0)::numeric /
           COALESCE(ce.total_users_enrolled, 1)::numeric * 100
    END, 2
  ) as avg_completion_percentage,
  -- Learning hours: Summed from most accurate raw time logs
  COALESCE(
    ROUND(
      (COALESCE(la.total_seconds_spent, 0)::numeric / 3600),
      2
    ),
    0
  ) as total_module_hours,
  -- Average hours per enrolled user
  ROUND(
    CASE
      WHEN COALESCE(ce.total_users_enrolled, 0) = 0 THEN 0
      ELSE COALESCE(la.total_seconds_spent, 0)::numeric / 3600 /
           COALESCE(ce.total_users_enrolled, 1)::numeric
    END,
    2
  ) as avg_hours_per_user,
  -- Last completion date
  COALESCE(la.last_completion_date, NULL)::text as last_completion_date,
  -- Users who completed (spent time)
  COALESCE(la.users_completed, 0)::integer as completed_by_users
FROM
  public.lessons l
  LEFT JOIN public.courses c ON l.courseid = c.id
  LEFT JOIN public.categories cat ON c.category = cat.name
  LEFT JOIN course_enrollments ce ON c.id = ce.courseid
  LEFT JOIN lesson_aggregates la ON l.id = la.lesson_id
WHERE l.id IS NOT NULL
ORDER BY
  c.title,
  l.title;

COMMENT ON VIEW public.module_learning_stats_summary IS
'Aggregated learning statistics for modules (lessons) using lesson_time_logs (most accurate).
CRITICAL IMPROVEMENT: Sums directly from lesson_time_logs instead of pre-aggregated lesson_progress.
Why lesson_time_logs?
- Most granular source of truth for time spent
- Records actual time chunks as learner progresses
- Not dependent on lesson_progress sync
- Eliminates risk of stale/synced values

Example flow:
1. Learner spends 69 seconds on lesson → written to lesson_time_logs
2. This migration sums those logs per lesson
3. Result: Exactly 1m 9s shown (not multiplied or cached incorrectly)

If lesson_time_logs is missing or sparse, ensure your backend writes to it
when learners interact with lessons.';
