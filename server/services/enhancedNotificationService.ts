/**
 * Enhanced Notification Service with Auto-Send Rules Integration
 * 
 * This service provides:
 * - Evaluation of trigger conditions for auto-send rules
 * - APIs for creating and executing notifications from rules
 * - Integration with the notification queue system
 * - Logging and metrics tracking
 */

import { createClient } from "@supabase/supabase-js";

interface TriggerParams {
    days_since?: number;
    days_inactive?: number;
    days_before_due?: number;
    completion_threshold?: number;
    days_after_assignment?: number;
    [key: string]: any;
}

interface NotificationToCreate {
    user_id: string;
    title: string;
    message: string;
    type: string;
    image_url?: string;
    link_url?: string;
    link_label?: string;
    priority: number;
    sender_id: string;
    metadata?: Record<string, any>;
}

class EnhancedNotificationService {
    private supabase;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || "";
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
            );
        }

        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    /**
     * Evaluate if a user matches a trigger condition and can receive notification
     */
    async evaluateTrigger(
        userId: string,
        triggerType: string,
        triggerParams?: TriggerParams
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            switch (triggerType) {
                case "task_pending":
                    return await this.evaluateTaskPending(userId, triggerParams);
                case "assignment_overdue":
                    return await this.evaluateAssignmentOverdue(userId);
                case "inactive_user":
                    return await this.evaluateInactiveUser(userId, triggerParams);
                case "course_due":
                    return await this.evaluateCourseDue(userId, triggerParams);
                case "low_engagement":
                    return await this.evaluateLowEngagement(userId, triggerParams);
                case "course_not_started":
                    return await this.evaluateCourseNotStarted(userId, triggerParams);
                case "achievement_unlocked":
                    return await this.evaluateAchievementUnlocked(userId);
                default:
                    console.warn(
                        `[EnhancedNotificationService] Unknown trigger type: ${triggerType}`
                    );
                    return { matches: false, reason: "Unknown trigger type" };
            }
        } catch (error) {
            console.error(
                `[EnhancedNotificationService] Error evaluating trigger ${triggerType}:`,
                error
            );
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user has pending tasks
     */
    private async evaluateTaskPending(
        userId: string,
        params?: TriggerParams
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            const daysSince = params?.days_since || 7;
            const cutoffDate = new Date(
                Date.now() - daysSince * 24 * 60 * 60 * 1000
            ).toISOString();

            const { data, error } = await this.supabase
                .from("lesson_progress")
                .select("id")
                .eq("user_id", userId)
                .eq("completed", false)
                .gte("created_at", cutoffDate)
                .limit(1);

            if (error) throw error;

            const hasTask = (data && data.length > 0);
            return {
                matches: hasTask,
                reason: hasTask ? "User has pending tasks" : "No pending tasks found",
            };
        } catch (error) {
            console.error("[EnhancedNotificationService] Error evaluating task_pending:", error);
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user has overdue assignments
     */
    private async evaluateAssignmentOverdue(
        userId: string
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            const { data, error } = await this.supabase
                .from("course_assignments")
                .select("id")
                .eq("student_id", userId)
                .lt("due_date", new Date().toISOString())
                .eq("status", "pending")
                .limit(1);

            if (error) throw error;

            const hasOverdue = (data && data.length > 0);
            return {
                matches: hasOverdue,
                reason: hasOverdue ? "User has overdue assignments" : "No overdue assignments",
            };
        } catch (error) {
            console.error(
                "[EnhancedNotificationService] Error evaluating assignment_overdue:",
                error
            );
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user is inactive
     */
    private async evaluateInactiveUser(
        userId: string,
        params?: TriggerParams
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            const daysInactive = params?.days_inactive || 7;
            const cutoffDate = new Date(
                Date.now() - daysInactive * 24 * 60 * 60 * 1000
            ).toISOString();

            const { data, error } = await this.supabase
                .from("profiles")
                .select("id, last_sign_in_at")
                .eq("id", userId)
                .lt("last_sign_in_at", cutoffDate)
                .limit(1);

            if (error) throw error;

            const isInactive = (data && data.length > 0);
            return {
                matches: isInactive,
                reason: isInactive
                    ? `User inactive for ${daysInactive}+ days`
                    : "User is active",
            };
        } catch (error) {
            console.error("[EnhancedNotificationService] Error evaluating inactive_user:", error);
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user has course due soon
     */
    private async evaluateCourseDue(
        userId: string,
        params?: TriggerParams
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            const daysDue = params?.days_before_due || 3;
            const futureDate = new Date(
                Date.now() + daysDue * 24 * 60 * 60 * 1000
            ).toISOString();

            const { data, error } = await this.supabase
                .from("enrollments")
                .select("id, deadline")
                .eq("user_id", userId)
                .gte("deadline", new Date().toISOString())
                .lte("deadline", futureDate)
                .limit(1);

            if (error) throw error;

            const hasDueCourse = (data && data.length > 0);
            return {
                matches: hasDueCourse,
                reason: hasDueCourse
                    ? `User has course due in ${daysDue} days`
                    : "No courses due soon",
            };
        } catch (error) {
            console.error("[EnhancedNotificationService] Error evaluating course_due:", error);
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user has low engagement
     */
    private async evaluateLowEngagement(
        userId: string,
        params?: TriggerParams
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            const threshold = params?.completion_threshold || 25;

            const { data, error } = await this.supabase
                .from("profiles")
                .select("id, completion_percentage")
                .eq("id", userId)
                .lt("completion_percentage", threshold)
                .limit(1);

            if (error) throw error;

            const hasLowEngagement = (data && data.length > 0);
            return {
                matches: hasLowEngagement,
                reason: hasLowEngagement
                    ? `User engagement below ${threshold}%`
                    : "User has acceptable engagement",
            };
        } catch (error) {
            console.error(
                "[EnhancedNotificationService] Error evaluating low_engagement:",
                error
            );
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user recently enrolled in course but hasn't started
     */
    private async evaluateCourseNotStarted(
        userId: string,
        params?: TriggerParams
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            const daysAfter = params?.days_after_assignment || 0;
            const cutoffDate = new Date(
                Date.now() - daysAfter * 24 * 60 * 60 * 1000
            ).toISOString();

            const { data, error } = await this.supabase
                .from("enrollments")
                .select("id, progress")
                .eq("user_id", userId)
                .eq("progress", 0)
                .gte("enrolled_at", cutoffDate)
                .limit(1);

            if (error) throw error;

            const hasUnstartedCourse = (data && data.length > 0);
            return {
                matches: hasUnstartedCourse,
                reason: hasUnstartedCourse
                    ? "User has unstarted enrolled courses"
                    : "All enrolled courses have been started",
            };
        } catch (error) {
            console.error(
                "[EnhancedNotificationService] Error evaluating course_not_started:",
                error
            );
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user recently unlocked achievement
     */
    private async evaluateAchievementUnlocked(
        userId: string
    ): Promise<{ matches: boolean; reason?: string }> {
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const { data, error } = await this.supabase
                .from("user_achievements")
                .select("id")
                .eq("user_id", userId)
                .gte("created_at", oneDayAgo)
                .limit(1);

            if (error) throw error;

            const hasAchievement = (data && data.length > 0);
            return {
                matches: hasAchievement,
                reason: hasAchievement
                    ? "User recently unlocked achievement"
                    : "No recent achievements",
            };
        } catch (error) {
            console.error(
                "[EnhancedNotificationService] Error evaluating achievement_unlocked:",
                error
            );
            return { matches: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Check if user can receive more notifications for a specific rule
     */
    async canReceiveNotification(
        ruleId: string,
        userId: string,
        maxSends: number = 1
    ): Promise<{ canReceive: boolean; reason?: string }> {
        try {
            // Check execution count
            const { data: executions, error: execError } = await this.supabase
                .from("auto_send_rule_execution_log")
                .select("id, created_at")
                .eq("rule_id", ruleId)
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (execError) throw execError;

            const executionCount = executions?.length || 0;

            // Check max sends
            if (executionCount >= maxSends) {
                return {
                    canReceive: false,
                    reason: `User has reached max sends (${executionCount}/${maxSends})`,
                };
            }

            // Check cooldown (24 hours)
            if (executions && executions.length > 0) {
                const lastExecution = new Date(executions[0].created_at);
                const cooldownMs = 24 * 60 * 60 * 1000;
                if (Date.now() - lastExecution.getTime() < cooldownMs) {
                    return {
                        canReceive: false,
                        reason: "User is still in cooldown period (24h)",
                    };
                }
            }

            return { canReceive: true, reason: "User can receive notification" };
        } catch (error) {
            console.error("[EnhancedNotificationService] Error checking notification eligibility:", error);
            return {
                canReceive: false,
                reason: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Create and queue a notification for a user
     */
    async createNotification(
        notification: NotificationToCreate
    ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
        try {
            const { data, error } = await this.supabase
                .from("notifications")
                .insert(notification)
                .select("id")
                .single();

            if (error) throw error;

            return { success: true, notificationId: data?.id };
        } catch (error) {
            console.error("[EnhancedNotificationService] Error creating notification:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Log the execution of a rule for a user
     */
    async logRuleExecution(
        ruleId: string,
        userId: string,
        notificationId: string,
        status: "sent" | "failed" | "skipped" = "sent",
        errorMessage?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await this.supabase
                .from("auto_send_rule_execution_log")
                .insert({
                    rule_id: ruleId,
                    user_id: userId,
                    notification_id: notificationId,
                    execution_status: status,
                    error_message: errorMessage || null,
                });

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error("[EnhancedNotificationService] Error logging rule execution:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Get rule statistics
     */
    async getRuleStats(ruleId: string): Promise<any> {
        try {
            const { data: rule, error: ruleError } = await this.supabase
                .from("notification_auto_send_rules")
                .select(
                    `
          *,
          execution_logs:auto_send_rule_execution_log(count)
        `
                )
                .eq("id", ruleId)
                .single();

            if (ruleError) throw ruleError;

            const { data: executions, error: execError } = await this.supabase
                .from("auto_send_rule_execution_log")
                .select("execution_status")
                .eq("rule_id", ruleId);

            if (execError) throw execError;

            const stats = {
                rule_id: ruleId,
                total_executions: executions?.length || 0,
                sent: executions?.filter((e: any) => e.execution_status === "sent").length || 0,
                failed: executions?.filter((e: any) => e.execution_status === "failed").length || 0,
                skipped: executions?.filter((e: any) => e.execution_status === "skipped").length || 0,
            };

            return stats;
        } catch (error) {
            console.error("[EnhancedNotificationService] Error getting rule stats:", error);
            throw error;
        }
    }
}

export default EnhancedNotificationService;

// Export singleton instance
export const enhancedNotificationService = new EnhancedNotificationService();
