-- Migration: Fix Critical Time Tracking Gaps
-- Date: April 10, 2026
-- Fixes: Double counting, session reliability, idempotency, duration calculation

-- =========================================================================
-- 1. ADD IDEMPOTENCY KEY TO lesson_time_logs (CRITICAL FIX #4)
-- =========================================================================

ALTER TABLE public.lesson_time_logs
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Backfill idempotent keys for existing records
UPDATE public.lesson_time_logs
SET idempotency_key = user_id || ':' || lesson_id || ':' || session_id || ':' || created_at::text
WHERE idempotency_key IS NULL;

-- Make future inserts require idempotency key
ALTER TABLE public.lesson_time_logs
ALTER COLUMN idempotency_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_time_logs_idempotency
ON public.lesson_time_logs(idempotency_key);

--  =========================================================================
-- 2. REMOVE DUAL SOURCE OF TRUTH (CRITICAL FIX #1)
-- =========================================================================

-- Mark lesson_progress.time_spent_seconds as DERIVED (not source of truth)
COMMENT ON COLUMN public.lesson_progress.time_spent_seconds IS
'DEPRECATED: This is now DERIVED from lesson_time_logs, not source of truth.
Use: SELECT COALESCE(SUM(time_spent_seconds), 0) FROM lesson_time_logs WHERE user_id=X AND lesson_id=Y';

-- =========================================================================
-- 3. ADD SESSION AUTO-CLOSE FUNCTION (CRITICAL FIX #2)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.auto_close_stale_sessions()
RETURNS TABLE(closed_count INTEGER, updated_sessions TEXT[]) AS $$
DECLARE
  v_rows INTEGER;
  v_sessions TEXT[];
BEGIN
  -- Find sessions older than 2 hours without session_end
  WITH stale_sessions AS (
    SELECT id, user_id, course_id
    FROM public.learning_sessions
    WHERE session_end IS NULL
    AND session_start < NOW() - INTERVAL '2 hours'
  )
  UPDATE public.learning_sessions ls
  SET
    session_end = NOW(),
    is_completed = TRUE,
    updated_at = NOW()
  FROM stale_sessions ss
  WHERE ls.id = ss.id
  RETURNING ls.id::text
  INTO v_sessions;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN QUERY SELECT v_rows, v_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 4. FIX SESSION DURATION CALCULATION (CRITICAL FIX #3)
-- =========================================================================

-- Update sessions: duration should be SUM of active lesson time, not wall clock
CREATE OR REPLACE FUNCTION public.recalculate_session_duration()
RETURNS TABLE(session_id UUID, old_duration_seconds INTEGER, new_duration_seconds INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH session_durations AS (
    SELECT
      ls.id,
      ls.duration_seconds as old_duration,
      COALESCE(SUM(ltl.time_spent_seconds), 0) as new_duration
    FROM public.learning_sessions ls
    LEFT JOIN public.lesson_time_logs ltl ON ls.id = ltl.session_id
    WHERE ls.session_end IS NOT NULL
    GROUP BY ls.id, ls.duration_seconds
  )
  UPDATE public.learning_sessions ls
  SET duration_seconds = sd.new_duration
  FROM session_durations sd
  WHERE ls.id = sd.id
  AND sd.new_duration != sd.old_duration
  RETURNING ls.id, sd.old_duration, sd.new_duration;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 5. TRIGGER TO KEEP SESSION DURATION IN SYNC (CRITICAL FIX #3)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_session_duration_on_lesson_log()
RETURNS TRIGGER AS $$
BEGIN
  -- Update session duration based on sum of lesson logs
  UPDATE public.learning_sessions
  SET
    duration_seconds = (
      SELECT COALESCE(SUM(time_spent_seconds), 0)
      FROM public.lesson_time_logs
      WHERE session_id = NEW.session_id
    ),
    updated_at = NOW()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_update_session_duration_on_lesson_log
ON public.lesson_time_logs;

-- Create new trigger
CREATE TRIGGER trg_update_session_duration_on_lesson_log
AFTER INSERT OR UPDATE ON public.lesson_time_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_session_duration_on_lesson_log();

-- =========================================================================
-- 6. CREATE HELPER VIEW: ACCURATE SESSION STATS
-- =========================================================================

CREATE OR REPLACE VIEW public.v_accurate_session_stats AS
SELECT
  ls.id as session_id,
  ls.user_id,
  ls.course_id,
  ls.lesson_id,
  ls.session_start,
  ls.session_end,
  COALESCE(SUM(ltl.time_spent_seconds), 0) as active_time_seconds,
  COUNT(DISTINCT ltl.id) as lesson_logs_count,
  COUNT(DISTINCT ltl.lesson_id) as unique_lessons,
  public.convert_time_to_hours(
    COALESCE(SUM(ltl.time_spent_seconds), 0)
  ) as active_time_hours,
  ls.is_completed,
  CASE
    WHEN ls.session_end IS NULL THEN 'active'
    WHEN ls.session_end < NOW() - INTERVAL '2 hours' THEN 'stale'
    ELSE 'completed'
  END as session_status
FROM public.learning_sessions ls
LEFT JOIN public.lesson_time_logs ltl ON ls.id = ltl.session_id
GROUP BY
  ls.id, ls.user_id, ls.course_id, ls.lesson_id,
  ls.session_start, ls.session_end, ls.is_completed;

-- =========================================================================
-- 7. RECONCILIATION: DETECT MISMATCHES
-- =========================================================================

CREATE OR REPLACE VIEW public.v_time_discrepancies AS
SELECT
  ls.id as session_id,
  ls.user_id,
  ls.duration_seconds as reported_duration,
  COALESCE(SUM(ltl.time_spent_seconds), 0) as actual_active_time,
  ABS(
    ls.duration_seconds -
    COALESCE(SUM(ltl.time_spent_seconds), 0)
  ) as discrepancy_seconds,
  CASE
    WHEN ls.duration_seconds > COALESCE(SUM(ltl.time_spent_seconds), 0)
    THEN 'session_duration_inflated'
    WHEN ls.duration_seconds < COALESCE(SUM(ltl.time_spent_seconds), 0)
    THEN 'lesson_logs_incomplete'
    ELSE 'match'
  END as discrepancy_type
FROM public.learning_sessions ls
LEFT JOIN public.lesson_time_logs ltl ON ls.id = ltl.session_id
WHERE ls.session_end IS NOT NULL
GROUP BY ls.id, ls.user_id, ls.duration_seconds
HAVING ABS(ls.duration_seconds - COALESCE(SUM(ltl.time_spent_seconds), 0)) > 0
ORDER BY discrepancy_seconds DESC;

-- =========================================================================
-- 8. GRANT PERMISSIONS
-- =========================================================================

GRANT EXECUTE ON FUNCTION public.auto_close_stale_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_session_duration() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_session_duration_on_lesson_log() TO service_role;

GRANT SELECT ON public.v_accurate_session_stats TO authenticated;
GRANT SELECT ON public.v_time_discrepancies TO authenticated;

-- =========================================================================
-- 9. COMMENTS
-- =========================================================================

COMMENT ON FUNCTION public.auto_close_stale_sessions() IS
'Auto-closes sessions that have been open > 2 hours without session_end.
Call via cron job or scheduled function every 30 minutes.';

COMMENT ON FUNCTION public.recalculate_session_duration() IS
'Fixes session durations to match sum of lesson logs (active time).
Use to reconcile sessions where duration was set incorrectly.';

COMMENT ON VIEW public.v_accurate_session_stats IS
'Accurate session statistics using SUM of lesson_time_logs, not wall-clock time.
Always use this for reporting, not learning_sessions.duration_seconds directly.';

COMMENT ON VIEW public.v_time_discrepancies IS
'Identifies sessions where reported duration does not match active lesson time.
Useful for detecting issues or stale sessions.';

-- =========================================================================
-- END OF CRITICAL FIXES MIGRATION
-- =========================================================================
