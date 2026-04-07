-- ============================================================================
-- Migration: Create module_learning_stats_summary view
-- Purpose: Provide aggregated learning statistics for modules (lessons)
-- Date: April 7, 2026
-- ============================================================================

-- Create the module_learning_stats_summary view
CREATE OR REPLACE VIEW public.module_learning_stats_summary AS
SELECT
  l.id as moduleid,
  l.title as module_name,
  l.description,
  c.id as courseid,
  c.title as course_name,
  COALESCE(cat.name, 'Uncategorized') as category,
  -- Enrollment statistics
  COUNT(DISTINCT e.userid) as total_users_enrolled,
  COUNT(DISTINCT CASE WHEN lp.completed THEN lp.userid END) as users_completed,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.userid) = 0 THEN 0
      ELSE COUNT(DISTINCT CASE WHEN lp.completed THEN lp.userid END)::numeric /
           COUNT(DISTINCT e.userid) * 100
    END, 2
  ) as avg_completion_percentage,
  -- Learning hours statistics
  COALESCE(
    ROUND(
      (SUM(lh.hoursspent) FILTER (WHERE lh.hoursspent > 0))::numeric,
      2
    ),
    0
  ) as total_module_hours,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.userid) = 0 THEN 0
      ELSE (SUM(lh.hoursspent) FILTER (WHERE lh.hoursspent > 0))::numeric /
           COUNT(DISTINCT e.userid)
    END,
    2
  ) as avg_hours_per_user,
  -- Completion date tracking
  MAX(lp.completed_at)::text as last_completion_date,
  COUNT(DISTINCT CASE WHEN lp.completed THEN lp.userid END) as completed_by_users
FROM
  lessons l
  LEFT JOIN courses c ON l.courseid = c.id
  LEFT JOIN public.categories cat ON c.category_id = cat.id
  LEFT JOIN enrollments e ON c.id = e.courseid
  LEFT JOIN lesson_progress lp ON l.id = lp.lessonid AND e.userid = lp.userid
  LEFT JOIN learning_hours lh ON e.userid = lh.userid AND c.id IN (
    SELECT courseid FROM enrollments WHERE userid = lh.userid
  )
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

COMMENT ON VIEW public.module_learning_stats_summary IS 'Aggregated learning statistics for modules (lessons), including enrollment, completion, and hours tracking';
