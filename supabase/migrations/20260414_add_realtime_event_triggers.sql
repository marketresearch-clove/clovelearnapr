/**
 * Migration: Add Real-Time Event Triggers for Auto-Send Notifications
 * Date: 2026-04-14
 * 
 * This migration creates:
 * 1. Database triggers for enrollment events
 * 2. Triggers for achievement events
 * 3. Triggers for assignment completion
 * 4. Functions to queue notifications based on events
 */

-- ===================================
-- 1. ENROLLMENT EVENT TRIGGERS
-- ===================================

/**
 * When a user enrolls in a course, check for:
 * - "course_not_started" rules
 * - Send welcome/enrollment notifications
 */
CREATE OR REPLACE FUNCTION trigger_on_enrollment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process new enrollments
    IF TG_OP = 'INSERT' THEN
        -- Queue enrollment-related notifications
        INSERT INTO public.notification_processing_queue (rule_id, user_id, status, created_at)
        SELECT
            nar.id,
            NEW.userid,
            'pending',
            NOW()
        FROM public.notification_auto_send_rules nar
        WHERE nar.trigger_type = 'course_not_started'
          AND nar.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM public.auto_send_rule_execution_log
              WHERE rule_id = nar.id AND user_id = NEW.userid
          );

        RAISE NOTICE '[Trigger] Enrollment event for user: %, course: %', NEW.userid, NEW.courseid;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS enrollment_auto_send_trigger ON public.enrollments;
CREATE TRIGGER enrollment_auto_send_trigger
    AFTER INSERT ON public.enrollments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_on_enrollment();

-- ===================================
-- 2. ACHIEVEMENT EVENT TRIGGERS
-- ===================================

/**
 * When a user unlocks an achievement, check for:
 * - "achievement_unlocked" rules
 * - Send celebration notifications
 * NOTE: user_achievements table may not exist yet, so this trigger is skipped
 */

-- ===================================
-- 3. ASSIGNMENT COMPLETION TRIGGERS
-- ===================================

/**
 * When an assignment is completed, check for:
 * - "assignment_overdue" related notifications
 * - Progress-based notifications
 */
CREATE OR REPLACE FUNCTION trigger_on_assignment_update()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
        IF NEW.status = 'completed' THEN
            RAISE NOTICE '[Trigger] Assignment completed by user: %', NEW.userid;

            -- You could queue other events here if needed
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS assignment_auto_send_trigger ON public.course_assignments;
CREATE TRIGGER assignment_auto_send_trigger
    AFTER UPDATE ON public.course_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_on_assignment_update();

-- ===================================
-- 4. PROFILE ACTIVITY TRACKING
-- ===================================

/**
 * Track last_sign_in_at to identify inactive users
 * NOTE: last_sign_in_at column does not exist in profiles table yet
 * This would need to be created first via a separate migration
 */

-- ===================================
-- 5. COURSE PROGRESS TRACKING
-- ===================================

/**
 * Update enrollment progress and trigger progress-based notifications
 */
CREATE OR REPLACE FUNCTION trigger_on_progress_update()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.progress != OLD.progress THEN
        -- Check for low engagement notifications
        IF NEW.progress <= 50 AND OLD.progress > 50 THEN
            -- Could trigger "stuck" notifications here
            RAISE NOTICE '[Trigger] User progress decreased: %', NEW.userid;
        ELSIF NEW.progress >= 50 AND OLD.progress < 50 THEN
            -- Could trigger "halfway there" celebrations
            RAISE NOTICE '[Trigger] User progress reached 50%%: %', NEW.userid;
        ELSIF NEW.progress >= 100 THEN
            -- Course completed
            RAISE NOTICE '[Trigger] Course completed by user: %', NEW.userid;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS progress_auto_send_trigger ON public.enrollments;
CREATE TRIGGER progress_auto_send_trigger
    AFTER UPDATE ON public.enrollments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_on_progress_update();

-- ===================================
-- 6. DEADLINE APPROACHING TRIGGERS
-- ===================================

/**
 * Detect when course deadline is approaching
 * This could be called by a scheduled function
 */
CREATE OR REPLACE FUNCTION check_approaching_deadlines()
RETURNS TABLE(enrollment_id UUID, user_id UUID, days_until_deadline INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.userid,
        EXTRACT(DAY FROM (e.due_date - NOW()))::INTEGER
    FROM public.enrollments e
    WHERE e.due_date > NOW()
      AND e.due_date < NOW() + INTERVAL '7 days'
      AND e.progress < 100;
END;
$$ LANGUAGE PLPGSQL;

-- ===================================
-- 7. INACTIVITY DETECTION FUNCTION
-- ===================================

/**
 * Detect inactive users (no login for X days)
 * NOTE: This function requires last_sign_in_at column in profiles table
 * which does not exist yet
 */

-- ===================================
-- 8. BATCH NOTIFICATION PROCESSOR
-- ===================================

/**
 * Process pending notifications from the queue
 * Called by scheduled function or webhook
 */
CREATE OR REPLACE FUNCTION process_notification_queue(p_batch_size INTEGER DEFAULT 100)
RETURNS TABLE(processed_count INTEGER, failed_count INTEGER) AS $$
DECLARE
    v_processed INTEGER := 0;
    v_failed INTEGER := 0;
    v_queue_item RECORD;
BEGIN
    FOR v_queue_item IN
        SELECT * FROM public.notification_processing_queue
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT p_batch_size
    LOOP
        BEGIN
            -- Mark as processing
            UPDATE public.notification_processing_queue
            SET status = 'processing',
                updated_at = NOW(),
                attempts = attempts + 1
            WHERE id = v_queue_item.id;
            
            -- Get rule details
            DECLARE
                v_rule RECORD;
            BEGIN
                SELECT * INTO v_rule
                FROM public.notification_auto_send_rules
                WHERE id = v_queue_item.rule_id;
                
                IF v_rule IS NOT NULL THEN
                    -- Create notification
                    INSERT INTO public.notifications (
                        user_id, title, message, type, priority,
                        image_url, link_url, link_label,
                        sender_id, metadata, created_at
                    ) VALUES (
                        v_queue_item.user_id,
                        v_rule.title,
                        v_rule.message,
                        v_rule.type,
                        v_rule.priority,
                        v_rule.image_url,
                        v_rule.link_url,
                        v_rule.link_label,
                        v_rule.admin_id,
                        jsonb_build_object('auto_send_rule_id', v_rule.id),
                        NOW()
                    );
                    
                    -- Log execution
                    INSERT INTO public.auto_send_rule_execution_log (
                        rule_id, user_id, execution_status
                    ) VALUES (
                        v_queue_item.rule_id,
                        v_queue_item.user_id,
                        'sent'
                    );
                    
                    -- Mark queue item as completed
                    UPDATE public.notification_processing_queue
                    SET status = 'completed',
                        updated_at = NOW(),
                        processed_at = NOW()
                    WHERE id = v_queue_item.id;
                    
                    v_processed := v_processed + 1;
                END IF;
            END;
            
        EXCEPTION WHEN OTHERS THEN
            -- Mark as failed
            UPDATE public.notification_processing_queue
            SET status = 'failed',
                updated_at = NOW(),
                error_message = SQLERRM
            WHERE id = v_queue_item.id;
            
            v_failed := v_failed + 1;
            RAISE NOTICE 'Error processing queue item %: %', v_queue_item.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_processed, v_failed;
END;
$$ LANGUAGE PLPGSQL;

-- ===================================
-- 9. PERFORMANCE INDEXES
-- ===================================

CREATE INDEX IF NOT EXISTS idx_enrollments_deadline ON public.enrollments(deadline)
    WHERE progress < 100;

CREATE INDEX IF NOT EXISTS idx_enrollments_progress_user ON public.enrollments(user_id, progress);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_priority 
    ON public.notification_processing_queue(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_profiles_last_signin ON public.profiles(last_sign_in_at);

-- ===================================
-- 10. DOCUMENTATION
-- ===================================

COMMENT ON FUNCTION trigger_on_enrollment() IS 'Triggered when a new enrollment is created';
COMMENT ON FUNCTION trigger_on_achievement() IS 'Triggered when a user unlocks an achievement';
COMMENT ON FUNCTION trigger_on_assignment_update() IS 'Triggered when an assignment status changes';
COMMENT ON FUNCTION check_approaching_deadlines() IS 'Returns enrollments with approaching deadlines';
COMMENT ON FUNCTION check_inactive_users(INTEGER) IS 'Returns users inactive for specified days';
COMMENT ON FUNCTION process_notification_queue(INTEGER) IS 'Processes pending notifications from queue';
