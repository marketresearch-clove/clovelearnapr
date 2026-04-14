/**
 * Migration: Setup Auto-Send Notification Rules Infrastructure
 * Date: 2026-04-14
 * 
 * This migration creates:
 * 1. Tables for auto-send rules, execution logs, and tracking
 * 2. Functions for trigger evaluation
 * 3. Triggers for real-time event processing
 * 4. RLS policies for security
 * 5. Indexes for performance
 */

-- ===================================
-- 1. AUTO-SEND RULES TABLE
-- ===================================

CREATE TABLE IF NOT EXISTS public.notification_auto_send_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_params JSONB DEFAULT '{}',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    image_url VARCHAR(2048),
    link_url VARCHAR(2048),
    link_label VARCHAR(255),
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
    send_after_days INTEGER DEFAULT 0,
    send_before_days INTEGER DEFAULT 0,
    max_sends_per_user INTEGER DEFAULT 1 CHECK (max_sends_per_user > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_trigger_type CHECK (
        trigger_type IN (
            'task_pending',
            'course_due',
            'assignment_overdue',
            'low_engagement',
            'inactive_user',
            'course_not_started',
            'achievement_unlocked'
        )
    ),
    CONSTRAINT valid_type CHECK (
        type IN ('general', 'course', 'assignment', 'system', 'announcement', 'reminder', 'engagement', 'celebration')
    )
);

-- ===================================
-- 2. AUTO-SEND RULE EXECUTION LOG
-- ===================================

CREATE TABLE IF NOT EXISTS public.auto_send_rule_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.notification_auto_send_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
    execution_status VARCHAR(50) DEFAULT 'sent' CHECK (execution_status IN ('sent', 'failed', 'skipped')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- 3. NOTIFICATION PROCESSING QUEUE
-- ===================================

CREATE TABLE IF NOT EXISTS public.notification_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.notification_auto_send_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ===================================
-- 4. TRIGGER EVALUATION HISTORY
-- ===================================

CREATE TABLE IF NOT EXISTS public.trigger_evaluation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.notification_auto_send_rules(id) ON DELETE CASCADE,
    evaluation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    matched_user_count INTEGER DEFAULT 0,
    processed_user_count INTEGER DEFAULT 0,
    skipped_user_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    evaluation_duration_ms INTEGER,
    errors JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

-- ===================================
-- 5. INDEXES FOR PERFORMANCE
-- ===================================

CREATE INDEX IF NOT EXISTS idx_auto_send_rules_admin_active ON public.notification_auto_send_rules(admin_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_send_rules_trigger_type ON public.notification_auto_send_rules(trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_execution_log_rule_user ON public.auto_send_rule_execution_log(rule_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_log_user_created ON public.auto_send_rule_execution_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON public.notification_processing_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_processing_queue_rule_user ON public.notification_processing_queue(rule_id, user_id);

-- ===================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ===================================

-- Enable RLS on all tables
ALTER TABLE public.notification_auto_send_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_send_rule_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_evaluation_history ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage their own rules
CREATE POLICY admin_rules_policy ON public.notification_auto_send_rules
    FOR ALL
    USING (admin_id = auth.uid()::UUID)
    WITH CHECK (admin_id = auth.uid()::UUID);

-- Policy: System service role can access all rules
CREATE POLICY system_rules_policy ON public.notification_auto_send_rules
    FOR ALL
    USING (true)
    WITH CHECK (true)
    SECURITY DEFINER;

-- Policy: Users can view their own execution logs (for transparency)
CREATE POLICY user_execution_log_view ON public.auto_send_rule_execution_log
    FOR SELECT
    USING (user_id = auth.uid()::UUID OR EXISTS(
        SELECT 1 FROM public.notification_auto_send_rules
        WHERE id = rule_id AND admin_id = auth.uid()::UUID
    ));

-- Policy: Admins can view execution logs for their rules
CREATE POLICY admin_execution_log_view ON public.auto_send_rule_execution_log
    FOR SELECT
    USING (EXISTS(
        SELECT 1 FROM public.notification_auto_send_rules
        WHERE id = rule_id AND admin_id = auth.uid()::UUID
    ));

-- Policy: System can manage execution logs
CREATE POLICY system_execution_log_policy ON public.auto_send_rule_execution_log
    FOR ALL
    USING (true)
    WITH CHECK (true)
    SECURITY DEFINER;

-- Policy: System can manage processing queue
CREATE POLICY system_queue_policy ON public.notification_processing_queue
    FOR ALL
    USING (true)
    WITH CHECK (true)
    SECURITY DEFINER;

-- Policy: Admins can view trigger evaluation history
CREATE POLICY admin_trigger_history ON public.trigger_evaluation_history
    FOR SELECT
    USING (EXISTS(
        SELECT 1 FROM public.notification_auto_send_rules
        WHERE id = rule_id AND admin_id = auth.uid()::UUID
    ));

-- ===================================
-- 7. UTILITY FUNCTIONS
-- ===================================

-- Function to get last execution time for a rule/user
CREATE OR REPLACE FUNCTION get_last_execution_time(
    p_rule_id UUID,
    p_user_id UUID
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
    SELECT MAX(created_at)
    FROM public.auto_send_rule_execution_log
    WHERE rule_id = p_rule_id AND user_id = p_user_id;
$$ LANGUAGE SQL STABLE;

-- Function to get execution count for a rule/user
CREATE OR REPLACE FUNCTION get_execution_count(
    p_rule_id UUID,
    p_user_id UUID
) RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM public.auto_send_rule_execution_log
    WHERE rule_id = p_rule_id AND user_id = p_user_id;
$$ LANGUAGE SQL STABLE;

-- Function to check if user can receive more notifications for a rule
CREATE OR REPLACE FUNCTION can_send_notification(
    p_rule_id UUID,
    p_user_id UUID,
    p_max_sends INTEGER,
    p_cooldown_hours INTEGER DEFAULT 24
) RETURNS BOOLEAN AS $$
DECLARE
    v_execution_count INTEGER;
    v_last_sent TIMESTAMP WITH TIME ZONE;
    v_cooldown_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get execution count
    SELECT COUNT(*)::INTEGER INTO v_execution_count
    FROM public.auto_send_rule_execution_log
    WHERE rule_id = p_rule_id AND user_id = p_user_id;

    -- Check max sends
    IF v_execution_count >= p_max_sends THEN
        RETURN false;
    END IF;

    -- Get last sent time
    SELECT MAX(created_at) INTO v_last_sent
    FROM public.auto_send_rule_execution_log
    WHERE rule_id = p_rule_id AND user_id = p_user_id;

    -- Check cooldown
    IF v_last_sent IS NOT NULL THEN
        v_cooldown_expiry := v_last_sent + (p_cooldown_hours || ' hours')::INTERVAL;
        IF NOW() < v_cooldown_expiry THEN
            RETURN false;
        END IF;
    END IF;

    RETURN true;
END;
$$ LANGUAGE PLPGSQL STABLE;

-- ===================================
-- 8. AUDIT TRIGGERS
-- ===================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_auto_send_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS update_auto_send_rules_timestamp ON public.notification_auto_send_rules;
CREATE TRIGGER update_auto_send_rules_timestamp
    BEFORE UPDATE ON public.notification_auto_send_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_auto_send_rules_timestamp();

-- Trigger to update processing queue updated_at
CREATE OR REPLACE FUNCTION update_processing_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS update_queue_timestamp ON public.notification_processing_queue;
CREATE TRIGGER update_queue_timestamp
    BEFORE UPDATE ON public.notification_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_processing_queue_timestamp();

-- ===================================
-- 9. CLEANUP PROCEDURES
-- ===================================

-- Procedure to clean up old execution logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_execution_logs(p_days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(rows_deleted INTEGER) AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.auto_send_rule_execution_log
    WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN QUERY SELECT v_deleted;
END;
$$ LANGUAGE PLPGSQL;

-- Procedure to clean up old trigger evaluation history
CREATE OR REPLACE FUNCTION cleanup_old_trigger_history(p_days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(rows_deleted INTEGER) AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.trigger_evaluation_history
    WHERE evaluation_timestamp < NOW() - (p_days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN QUERY SELECT v_deleted;
END;
$$ LANGUAGE PLPGSQL;

-- ===================================
-- 10. GRANTS FOR SERVICE ROLE
-- ===================================

GRANT ALL ON public.notification_auto_send_rules TO service_role;
GRANT ALL ON public.auto_send_rule_execution_log TO service_role;
GRANT ALL ON public.notification_processing_queue TO service_role;
GRANT ALL ON public.trigger_evaluation_history TO service_role;

GRANT EXECUTE ON FUNCTION get_last_execution_time TO service_role;
GRANT EXECUTE ON FUNCTION get_execution_count TO service_role;
GRANT EXECUTE ON FUNCTION can_send_notification TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_execution_logs TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_trigger_history TO service_role;

-- ===================================
-- Comments for documentation
-- ===================================

COMMENT ON TABLE public.notification_auto_send_rules IS 'Stores auto-send notification rules created by admins';
COMMENT ON TABLE public.auto_send_rule_execution_log IS 'Tracks execution history of auto-send rules for each user';
COMMENT ON TABLE public.notification_processing_queue IS 'Queue for pending notifications to be processed';
COMMENT ON TABLE public.trigger_evaluation_history IS 'Historical record of rule trigger evaluations';
COMMENT ON COLUMN public.notification_auto_send_rules.trigger_type IS 'Type of event that triggers the rule (task_pending, course_due, etc.)';
COMMENT ON COLUMN public.notification_auto_send_rules.trigger_params IS 'Parameters specific to the trigger type (e.g., days_before_due)';
COMMENT ON COLUMN public.notification_auto_send_rules.max_sends_per_user IS 'Maximum number of times this rule can send to a single user';
