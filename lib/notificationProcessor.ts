import { supabase } from './supabaseClient';
import { advancedNotificationService } from './advancedNotificationService';

/**
 * Background notification processor
 * Handles:
 * - Processing scheduled notifications due to be sent
 * - Handling recurring notifications
 * - Processing auto-send rules based on triggers
 * - Maintaining notification audit logs
 */

export class NotificationProcessor {
    /**
     * Process all scheduled notifications that are due to be sent
     */
    static async processScheduledNotifications(): Promise<{
        processed: number;
        failed: number;
        errors: string[];
    }> {
        if ((window as any)._isProcessingScheduled) {
            return { processed: 0, failed: 0, errors: [] };
        }
        (window as any)._isProcessingScheduled = true;

        console.log('[NotificationProcessor] Processing scheduled notifications...');
        let processed = 0;
        let failed = 0;
        const errors: string[] = [];

        try {
            // Get all scheduled notifications that are due
            const now = new Date().toISOString();
            const { data: scheduledNotifs, error: fetchError } = await supabase
                .from('scheduled_notifications')
                .select('*')
                .eq('status', 'scheduled')
                .lte('scheduled_for', now)
                .order('scheduled_for', { ascending: true });

            if (fetchError) throw fetchError;

            if (!scheduledNotifs || scheduledNotifs.length === 0) {
                console.log('[NotificationProcessor] No scheduled notifications to process');
                return { processed, failed, errors };
            }

            console.log(`[NotificationProcessor] Found ${scheduledNotifs.length} notifications to process`);

            for (const notification of scheduledNotifs) {
                try {
                    // Resolve recipients based on recipient_type
                    const recipients = await this.resolveRecipients(notification);

                    if (recipients.length === 0) {
                        console.warn(`[NotificationProcessor] No recipients found for notification ${notification.id}`);
                        continue;
                    }

                    // Create notifications for each recipient
                    for (const userId of recipients) {
                        try {
                            // Check for cooldown to prevent duplicate reappearing notifications
                            const { data: previousExecutions } = await supabase
                                .from('notification_audit_log')
                                .select('created_at')
                                .eq('scheduled_notification_id', notification.id)
                                .eq('user_id', userId)
                                .eq('action', 'sent')
                                .order('created_at', { ascending: false })
                                .limit(1);

                            const lastSent = previousExecutions && previousExecutions.length > 0 
                                ? new Date(previousExecutions[0].created_at)
                                : null;
                            
                            const cooldownMs = 24 * 60 * 60 * 1000; // 24 hour cooldown
                            if (lastSent && (Date.now() - lastSent.getTime()) < cooldownMs) {
                                console.log(`[NotificationProcessor] Skipping user ${userId} for scheduled notification ${notification.id} due to 24h cooldown`);
                                continue;
                            }

                            const { data: createdNotif, error: insertError } = await supabase
                                .from('notifications')
                                .insert({
                                    user_id: userId,
                                    title: notification.title,
                                    message: notification.message,
                                    type: notification.type,
                                    image_url: notification.image_url || null,
                                    link_url: notification.link_url || null,
                                    link_label: notification.link_label || null,
                                    priority: notification.priority,
                                    sender_id: notification.admin_id,
                                    metadata: {
                                        ...notification.metadata,
                                        scheduled_notification_id: notification.id,
                                    },
                                })
                                .select()
                                .single();

                            if (insertError) throw insertError;

                            // Log the action for the recipient
                            await advancedNotificationService.logNotificationAction({
                                scheduled_notification_id: notification.id,
                                user_id: userId,
                                notification_id: createdNotif.id,
                                action: 'sent',
                                details: {
                                    recipient_type: notification.recipient_type,
                                },
                            });
                        } catch (recipError) {
                            console.error(`[NotificationProcessor] Error processing recipient ${userId} for notification ${notification.id}:`, recipError);
                        }
                    }

                    // Update scheduled notification status
                    const updateData: any = {
                        status: notification.is_recurring ? 'scheduled' : 'sent',
                        sent_at: now,
                    };

                    // If recurring, schedule the next occurrence
                    if (notification.is_recurring && notification.recurrence_pattern) {
                        updateData.scheduled_for = this.calculateNextRecurrence(
                            notification.scheduled_for,
                            notification.recurrence_pattern,
                            notification.recurrence_end_date
                        );

                        // Check if we've passed the recurrence end date
                        if (
                            notification.recurrence_end_date &&
                            new Date(updateData.scheduled_for) > new Date(notification.recurrence_end_date)
                        ) {
                            updateData.status = 'sent';
                        }
                    }

                    await supabase
                        .from('scheduled_notifications')
                        .update(updateData)
                        .eq('id', notification.id);

                    processed++;
                    console.log(`[NotificationProcessor] Successfully processed notification ${notification.id}`);
                } catch (error) {
                    failed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    errors.push(`Notification ${notification.id}: ${errorMsg}`);
                    console.error(`[NotificationProcessor] Error processing notification ${notification.id}:`, error);

                    // Log the failure
                    try {
                        await supabase
                            .from('scheduled_notifications')
                            .update({
                                status: 'failed',
                                failed_reason: errorMsg,
                            })
                            .eq('id', notification.id);
                    } catch (updateError) {
                        console.error('Failed to update notification status:', updateError);
                    }
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push(`Fatal error: ${errorMsg}`);
            console.error('[NotificationProcessor] Fatal error:', error);
        } finally {
            (window as any)._isProcessingScheduled = false;
        }

        console.log(
            `[NotificationProcessor] Completed: ${processed} processed, ${failed} failed`
        );
        return { processed, failed, errors };
    }

    /**
     * Process auto-send rules
     */
    static async processAutoSendRules(): Promise<{
        processed: number;
        failed: number;
        errors: string[];
    }> {
        // Prevent multiple simultaneous executions if multiple admin tabs are open
        if ((window as any)._isProcessingAutoRules) {
            return { processed: 0, failed: 0, errors: [] };
        }
        (window as any)._isProcessingAutoRules = true;

        console.log('[NotificationProcessor] Processing auto-send rules...');
        let processed = 0;
        let failed = 0;
        const errors: string[] = [];

        try {
            // Get all active auto-send rules
            const { data: rules, error: rulesError } = await supabase
                .from('notification_auto_send_rules')
                .select('*')
                .eq('is_active', true);

            if (rulesError) throw rulesError;

            if (!rules || rules.length === 0) {
                console.log('[NotificationProcessor] No active auto-send rules');
                return { processed, failed, errors };
            }

            for (const rule of rules) {
                try {
                    // Get users matching the trigger condition
                    const targetUsers = await this.getUsersForTrigger(rule.trigger_type, rule.trigger_params);

                    if (targetUsers.length === 0) {
                        console.log(`[NotificationProcessor] No users found for rule ${rule.id}`);
                        continue;
                    }

                    // Check if user has already received max sends or was notified recently
                    for (const userId of targetUsers) {
                        try {
                            const { data: previousExecutions, error: logError } = await supabase
                                .from('auto_send_rule_execution_log')
                                .select('created_at')
                                .eq('rule_id', rule.id)
                                .eq('user_id', userId);

                            if (logError) throw logError;

                            const executionCount = previousExecutions?.length || 0;

                            if (executionCount >= rule.max_sends_per_user) {
                                console.log(
                                    `[NotificationProcessor] User ${userId} has reached max sends for rule ${rule.id}`
                                );
                                continue;
                            }

                            // Prevent duplicate notifications within a cooldown period (e.g., 24 hours)
                            // This stops notifications from reappearing immediately if a user clears them
                            const lastSent = previousExecutions && previousExecutions.length > 0 
                                ? new Date(Math.max(...previousExecutions.map(e => new Date(e.created_at).getTime())))
                                : null;
                            
                            const cooldownMs = 24 * 60 * 60 * 1000; // 24 hour cooldown
                            if (lastSent && (Date.now() - lastSent.getTime()) < cooldownMs) {
                                console.log(`[NotificationProcessor] Skipping user ${userId} for rule ${rule.id} due to cooldown`);
                                continue;
                            }

                            // Create notification
                            const { data: notification, error: notifError } = await supabase
                                .from('notifications')
                                .insert({
                                    user_id: userId,
                                    title: rule.title,
                                    message: rule.message,
                                    type: rule.type,
                                    image_url: rule.image_url || null,
                                    link_url: rule.link_url || null,
                                    link_label: rule.link_label || null,
                                    priority: rule.priority,
                                    sender_id: rule.admin_id,
                                    metadata: {
                                        auto_send_rule_id: rule.id,
                                        trigger_type: rule.trigger_type,
                                    },
                                })
                                .select()
                                .single();

                            if (notifError) throw notifError;

                            // Log execution
                            await supabase
                                .from('auto_send_rule_execution_log')
                                .insert({
                                    rule_id: rule.id,
                                    user_id: userId,
                                    notification_id: notification.id,
                                    execution_status: 'sent',
                                });

                            processed++;
                        } catch (userError) {
                            const errorMsg = userError instanceof Error ? userError.message : String(userError);
                            errors.push(`Rule ${rule.id}, User ${userId}: ${errorMsg}`);
                            console.error(`[NotificationProcessor] Error processing user for rule:`, userError);
                            failed++;
                        }
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    errors.push(`Rule ${rule.id}: ${errorMsg}`);
                    console.error(`[NotificationProcessor] Error processing rule ${rule.id}:`, error);
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push(`Fatal error: ${errorMsg}`);
            console.error('[NotificationProcessor] Fatal error:', error);
        } finally {
            (window as any)._isProcessingAutoRules = false;
        }

        console.log(
            `[NotificationProcessor] Auto-send: ${processed} sent, ${failed} failed`
        );
        return { processed, failed, errors };
    }

    /**
     * Resolve recipients based on recipient type and filters
     */
    private static async resolveRecipients(notification: any): Promise<string[]> {
        const recipients: string[] = [];

        try {
            if (notification.recipient_type === 'all') {
                // Get all active users
                const { data: users, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('role', 'student');

                if (error) throw error;
                return (users || []).map(u => u.id);
            }

            if (notification.recipient_type === 'users' && notification.recipient_users?.length > 0) {
                return notification.recipient_users;
            }

            if (
                notification.recipient_type === 'departments' &&
                notification.recipient_departments?.length > 0
            ) {
                const { data: users, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .in('department', notification.recipient_departments);

                if (error) throw error;
                return (users || []).map(u => u.id);
            }

            if (notification.recipient_type === 'roles' && notification.recipient_roles?.length > 0) {
                const { data: users, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .in('role', notification.recipient_roles);

                if (error) throw error;
                return (users || []).map(u => u.id);
            }
        } catch (error) {
            console.error('[NotificationProcessor] Error resolving recipients:', error);
        }

        return recipients;
    }

    /**
     * Get users matching a trigger condition
     */
    private static async getUsersForTrigger(
        triggerType: string,
        triggerParams: any
    ): Promise<string[]> {
        const users: string[] = [];

        try {
            switch (triggerType) {
                case 'task_pending':
                    // Get users with pending tasks/assignments
                    // profiles/enrollments/lesson_progress use camelCase
                    const { data: pendingUsers } = await supabase
                        .from('lesson_progress')
                        .select('userId')
                        .eq('completed', false)
                        .gte(
                            'createdAt',
                            new Date(Date.now() - (triggerParams?.days_since || 7) * 24 * 60 * 60 * 1000)
                                .toISOString()
                        );

                    return (pendingUsers || []).map(u => u.userId);

                case 'assignment_overdue':
                    // Get users with overdue assignments
                    // course_assignments might use student_id or userId? 
                    // Let's check DATABASE_SCHEMA.sql for assignments
                    const { data: overdueUsers } = await supabase
                        .from('course_assignments')
                        .select('studentId')
                        .lt('dueDate', new Date().toISOString())
                        .eq('status', 'pending');

                    return (overdueUsers || []).map(u => u.studentId);

                case 'inactive_user':
                    // Get inactive users (no activity in X days)
                    const inactiveDays = triggerParams?.days || 7;
                    const { data: inactiveUsers } = await supabase
                        .from('profiles')
                        .select('id')
                        .lt('updatedAt', new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000).toISOString());

                    return (inactiveUsers || []).map(u => u.id);

                case 'course_due':
                    // Get users enrolled in courses due soon
                    const dueSoon = triggerParams?.days || 3;
                    const { data: courseDueUsers } = await supabase
                        .from('enrollments')
                        .select('userId')
                        .gte('dueDate', new Date().toISOString())
                        .lte(
                            'dueDate',
                            new Date(Date.now() + dueSoon * 24 * 60 * 60 * 1000).toISOString()
                        );

                    return (courseDueUsers || []).map(u => u.userId);

                case 'low_engagement':
                    // Get users with low engagement
                    const engagementThreshold = triggerParams?.threshold || 25;
                    const { data: lowEngagementUsers } = await supabase
                        .from('profiles')
                        .select('id')
                        .lte('completionRate', engagementThreshold);

                    return (lowEngagementUsers || []).map(u => u.id);

                default:
                    console.warn(`[NotificationProcessor] Unknown trigger type: ${triggerType}`);
            }
        } catch (error) {
            console.error(`[NotificationProcessor] Error getting users for trigger ${triggerType}:`, error);
        }

        return users;
    }

    /**
     * Calculate next recurrence date
     */
    private static calculateNextRecurrence(
        currentDate: string,
        pattern: string,
        endDate?: string
    ): string {
        const date = new Date(currentDate);

        switch (pattern) {
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            default:
                date.setDate(date.getDate() + 1);
        }

        return date.toISOString();
    }
}

/**
 * Initialize background notification processor
 * Call this in your main app or from a cron job handler
 */
export async function initializeNotificationProcessor(): Promise<void> {
    console.log('[NotificationProcessor] Initializing notification processor...');

    // Check every 5 minutes
    const checkInterval = 5 * 60 * 1000;

    setInterval(async () => {
        try {
            await NotificationProcessor.processScheduledNotifications();
            await NotificationProcessor.processAutoSendRules();
        } catch (error) {
            console.error('[NotificationProcessor] Error in background processing:', error);
        }
    }, checkInterval);

    console.log(
        `[NotificationProcessor] Notification processor initialized (checking every ${checkInterval / 1000} seconds)`
    );
}

/**
 * Run a single batch of notification processing
 * Useful for manual triggers or cron jobs
 */
export async function runNotificationProcessing(): Promise<{
    scheduled: { processed: number; failed: number; errors: string[] };
    autoRules: { processed: number; failed: number; errors: string[] };
}> {
    console.log('[NotificationProcessor] Running manual notification processing...');

    const startTime = Date.now();

    const scheduled = await NotificationProcessor.processScheduledNotifications();
    const autoRules = await NotificationProcessor.processAutoSendRules();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(
        `[NotificationProcessor] Processing completed in ${duration}s. Scheduled: ${scheduled.processed}/${scheduled.failed}, AutoRules: ${autoRules.processed}/${autoRules.failed}`
    );

    return { scheduled, autoRules };
}
