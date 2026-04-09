-- Migration: Add Idempotency Tracking & Monitoring
-- Date: April 10, 2026
-- Purpose: Prevent double-counting on API retries + add reconciliation monitoring
-- Status: Production Ready

-- =========================================================================
-- 1. IDEMPOTENCY TRACKING TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.learning_transaction_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  
  -- Tracking fields
  status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'DUPLICATE', 'ERROR')),
  lesson_progress_id UUID,
  learning_hours_id UUID,
  
  -- Audit trail
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  error_message TEXT,
  
  -- Metadata for debugging
  client_ip INET,
  user_agent TEXT
);

-- Index for fast lookups by idempotency key
CREATE UNIQUE INDEX idx_learning_transaction_idempotency_key
ON public.learning_transaction_log(idempotency_key);

-- Index for user audit trail
CREATE INDEX idx_learning_transaction_user_date
ON public.learning_transaction_log(user_id, created_at DESC);

-- Index for finding duplicates
CREATE INDEX idx_learning_transaction_status
ON public.learning_transaction_log(status, created_at DESC);

-- =========================================================================
-- 2. RECONCILIATION ALERTS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN ('DISCREPANCY', 'MISSING_SESSION', 'FLOATING_POINT_ERROR', 'OVERCOUNTING')),
  severity TEXT DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  
  -- Specific values
  expected_seconds INTEGER,
  actual_seconds INTEGER,
  discrepancy_seconds INTEGER,
  
  -- Status
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  resolved_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for alerts
CREATE INDEX idx_reconciliation_alerts_open
ON public.reconciliation_alerts(status, severity) WHERE status = 'OPEN';

CREATE INDEX idx_reconciliation_alerts_user_date
ON public.reconciliation_alerts(user_id, created_at DESC);

-- =========================================================================
-- 3. EXPLICIT UNIQUE INDEX FOR learning_hours
-- =========================================================================

-- Drop old index if exists (from previous migration)
DROP INDEX IF EXISTS public.idx_learning_hours_user_course_date;

-- Create new explicit unique index
CREATE UNIQUE INDEX idx_learning_hours_unique
ON public.learning_hours(user_id, course_id, logged_date)
WHERE deleted_at IS NULL;

-- =========================================================================
-- 4. RLS POLICIES FOR NEW TABLES
-- =========================================================================

-- Enable RLS
ALTER TABLE public.learning_transaction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_alerts ENABLE ROW LEVEL SECURITY;

-- Users can see their own transactions
CREATE POLICY "Users can see own transaction log"
  ON public.learning_transaction_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only authenticated users can see reconciliation alerts (for their data)
CREATE POLICY "Users can see own reconciliation alerts"
  ON public.reconciliation_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can update alerts
CREATE POLICY "Admins can update alerts"
  ON public.reconciliation_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- =========================================================================
-- 5. CLEANUP PROCEDURES (Monthly Job)
-- =========================================================================

-- Archive transaction log older than 90 days (optional)
-- Keeps transaction_log fresh for performance
CREATE OR REPLACE FUNCTION public.cleanup_old_transaction_logs()
RETURNS TABLE(archived_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.learning_transaction_log
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND status IN ('DUPLICATE', 'ERROR');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 6. MONITORING VIEW - Dashboard Friendly
-- =========================================================================

CREATE OR REPLACE VIEW public.v_transaction_health AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_transactions,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'DUPLICATE' THEN 1 ELSE 0 END) as duplicates,
  SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors,
  ROUND(
    SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    2
  ) as success_rate_pct
FROM public.learning_transaction_log
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- View for duplicate detection
CREATE OR REPLACE VIEW public.v_duplicate_transactions AS
SELECT
  idempotency_key,
  user_id,
  COUNT(*) as attempt_count,
  MIN(created_at) as first_attempt,
  MAX(created_at) as last_attempt,
  EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) as spread_seconds
FROM public.learning_transaction_log
WHERE status = 'DUPLICATE'
GROUP BY idempotency_key, user_id
HAVING COUNT(*) > 1
ORDER BY attempt_count DESC;

-- =========================================================================
-- GRANT PERMISSIONS
-- =========================================================================

GRANT SELECT ON public.learning_transaction_log TO authenticated;
GRANT SELECT ON public.reconciliation_alerts TO authenticated;
GRANT SELECT ON public.v_transaction_health TO authenticated;
GRANT SELECT ON public.v_duplicate_transactions TO authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_old_transaction_logs() TO service_role;

-- =========================================================================
-- COMMENTS FOR DOCUMENTATION
-- =========================================================================

COMMENT ON TABLE public.learning_transaction_log IS
'Tracks all learning session recordings with idempotency keys. 
Prevents double-counting on API retries. Keep for 90 days for audit trail.';

COMMENT ON TABLE public.reconciliation_alerts IS
'Tracks discrepancies found during reconciliation. Useful for debugging 
data integrity issues. Severity: INFO (normal), WARNING (investigate), CRITICAL (immediate action).';

COMMENT ON COLUMN public.learning_transaction_log.idempotency_key IS
'Unique key preventing duplicate execution. Format: UUID or hash(user_id + timestamp + random).';

COMMENT ON COLUMN public.reconciliation_alerts.severity IS
'INFO: Minor discrepancy noticed. WARNING: Potential issue. CRITICAL: Data loss risk—investigate immediately.';
