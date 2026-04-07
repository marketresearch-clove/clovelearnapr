-- ============================================================================
-- Migration: Create career_path_analytics function
-- Purpose: Efficiently fetch career path development statistics
-- Date: April 7, 2026
-- Uses actual schema: career_paths (source_role, target_role) and
--                    user_career_paths (readiness_percentage, status)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_career_path_analytics()
RETURNS TABLE (
  total_paths_available BIGINT,
  users_enrolled_in_paths BIGINT,
  avg_path_readiness_percentage NUMERIC,
  users_ready_for_promotion BIGINT,
  top_career_path_id UUID,
  top_career_path_name TEXT,
  top_career_path_enrollments BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH career_path_stats AS (
    -- Get career path enrollment and readiness stats
    SELECT
      ucp.career_path_id,
      CONCAT(cp.source_role, ' → ', cp.target_role) as path_name,
      COUNT(*) as enrollments,
      COUNT(DISTINCT ucp.user_id) as unique_users,
      ROUND(AVG(COALESCE(ucp.readiness_percentage, 0))::numeric, 2) as avg_readiness,
      COUNT(*) FILTER (WHERE ucp.status = 'Ready for Promotion') as ready_for_promotion_count
    FROM user_career_paths ucp
    LEFT JOIN career_paths cp ON ucp.career_path_id = cp.id
    GROUP BY ucp.career_path_id, cp.source_role, cp.target_role
  ),
  ranked_paths AS (
    -- Rank paths by enrollment count
    SELECT
      career_path_id,
      path_name,
      enrollments,
      ROW_NUMBER() OVER (ORDER BY enrollments DESC) as rank
    FROM career_path_stats
  )
  SELECT
    (SELECT COUNT(*) FROM career_paths),
    (SELECT COUNT(DISTINCT user_id) FROM user_career_paths),
    (SELECT ROUND(AVG(COALESCE(readiness_percentage, 0))::numeric, 2) FROM user_career_paths),
    (SELECT COUNT(*) FROM user_career_paths WHERE status = 'Ready for Promotion'),
    rp.career_path_id,
    rp.path_name,
    rp.enrollments
  FROM ranked_paths rp
  WHERE rp.rank = 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Create VIEW for career path development summary (alternative approach)
-- ============================================================================

CREATE OR REPLACE VIEW career_path_development_summary AS
SELECT
  (SELECT COUNT(*) FROM career_paths) as total_paths_available,
  (SELECT COUNT(DISTINCT user_id) FROM user_career_paths) as users_enrolled_in_paths,
  COALESCE(
    ROUND(AVG(ucp.readiness_percentage)::numeric, 2),
    0
  ) as avg_path_readiness_percentage,
  (SELECT COUNT(*) FROM user_career_paths WHERE status = 'Ready for Promotion') as users_ready_for_promotion,
  (SELECT career_path_id FROM user_career_paths
   GROUP BY career_path_id
   ORDER BY COUNT(*) DESC
   LIMIT 1) as top_career_path_id,
  (SELECT CONCAT(cp.source_role, ' → ', cp.target_role) FROM career_paths cp
   WHERE cp.id = (SELECT career_path_id FROM user_career_paths
                  GROUP BY career_path_id
                  ORDER BY COUNT(*) DESC
                  LIMIT 1)) as top_career_path_name,
  (SELECT COUNT(*) FROM user_career_paths
   WHERE career_path_id = (SELECT career_path_id FROM user_career_paths
                           GROUP BY career_path_id
                           ORDER BY COUNT(*) DESC
                           LIMIT 1)) as top_career_path_enrollments
FROM user_career_paths ucp;

-- ============================================================================
-- Create additional metrics view for career path readiness
-- ============================================================================

CREATE OR REPLACE VIEW career_path_readiness_metrics AS
SELECT
  cp.id,
  CONCAT(cp.source_role, ' → ', cp.target_role) as path_name,
  COUNT(DISTINCT ucp.user_id) as total_enrolled,
  COUNT(*) FILTER (WHERE ucp.status = 'In Progress') as in_progress_count,
  COUNT(*) FILTER (WHERE ucp.status = 'Ready for Promotion') as ready_for_promotion_count,
  COUNT(*) FILTER (WHERE ucp.status = 'Completed') as completed_count,
  ROUND(AVG(COALESCE(ucp.readiness_percentage, 0))::numeric, 2) as avg_readiness_percentage,
  MAX(ucp.updated_at) as last_updated
FROM career_paths cp
LEFT JOIN user_career_paths ucp ON cp.id = ucp.career_path_id
GROUP BY cp.id, cp.source_role, cp.target_role
ORDER BY total_enrolled DESC;

COMMENT ON FUNCTION get_career_path_analytics() IS 'Efficiently fetch career path development statistics including readiness and promotion readiness';
COMMENT ON VIEW career_path_development_summary IS 'Summary view of career path development metrics across the organization';
COMMENT ON VIEW career_path_readiness_metrics IS 'Detailed metrics for each career path including readiness breakdown';
