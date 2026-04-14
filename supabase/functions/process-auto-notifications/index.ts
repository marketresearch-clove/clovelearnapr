/**
 * Supabase Edge Function: Process Auto-Send Notifications
 * 
 * Handles:
 * - Processing active auto-send rules
 * - Evaluating trigger conditions for each user
 * - Creating and sending notifications
 * - Logging execution history
 * - Managing cooldowns and max sends per user
 * 
 * Trigger: Scheduled function (cron) - runs every 5 minutes in production
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
}

interface AutoSendRule {
    id: string;
    admin_id: string;
    name: string;
    description?: string;
    trigger_type:
    | "task_pending"
    | "course_due"
    | "assignment_overdue"
    | "low_engagement"
    | "inactive_user"
    | "course_not_started"
    | "achievement_unlocked";
    trigger_params?: Record<string, any>;
    title: string;
    message: string;
    type: string;
    image_url?: string;
    link_url?: string;
    link_label?: string;
    priority: number;
    send_after_days: number;
    send_before_days?: number;
    max_sends_per_user: number;
    is_active: boolean;
}

interface ProcessResult {
    success: boolean;
    processed: number;
    failed: number;
    skipped: number;
    errors: string[];
    duration: number;
    timestamp: string;
}

async function getUsersForTrigger(
    supabase: any,
    triggerType: string,
    triggerParams?: Record<string, any>
): Promise<string[]> {
    const users: string[] = [];

    try {
        switch (triggerType) {
            case "task_pending":
                // Get users with pending tasks/assignments
                const { data: pendingUsers } = await supabase
                    .from("lesson_progress")
                    .select("user_id")
                    .eq("completed", false)
                    .gte(
                        "created_at",
                        new Date(
                            Date.now() - (triggerParams?.days_since || 7) * 24 * 60 * 60 * 1000
                        ).toISOString()
                    );

                return (pendingUsers || []).map((u: any) => u.user_id).filter(Boolean);

            case "assignment_overdue":
                // Get users with overdue assignments
                const { data: overdueUsers } = await supabase
                    .from("course_assignments")
                    .select("student_id")
                    .lt("due_date", new Date().toISOString())
                    .eq("status", "pending");

                return (overdueUsers || []).map((u: any) => u.student_id).filter(Boolean);

            case "inactive_user":
                // Get inactive users (no activity in X days)
                const inactiveDays = triggerParams?.days_inactive || 7;
                const { data: inactiveUsers } = await supabase
                    .from("profiles")
                    .select("id")
                    .lt(
                        "last_sign_in_at",
                        new Date(
                            Date.now() - inactiveDays * 24 * 60 * 60 * 1000
                        ).toISOString()
                    );

                return (inactiveUsers || []).map((u: any) => u.id).filter(Boolean);

            case "course_due":
                // Get users enrolled in courses due soon
                const dueSoon = triggerParams?.days_before_due || 3;
                const { data: courseDueUsers } = await supabase
                    .from("enrollments")
                    .select("user_id")
                    .gte("deadline", new Date().toISOString())
                    .lte(
                        "deadline",
                        new Date(
                            Date.now() + dueSoon * 24 * 60 * 60 * 1000
                        ).toISOString()
                    );

                return (courseDueUsers || []).map((u: any) => u.user_id).filter(Boolean);

            case "low_engagement":
                // Get users with low engagement (completion rate below threshold)
                const engagementThreshold = triggerParams?.completion_threshold || 25;
                const { data: lowEngagementUsers } = await supabase
                    .from("profiles")
                    .select("id, completion_percentage")
                    .lt("completion_percentage", engagementThreshold);

                return (lowEngagementUsers || [])
                    .map((u: any) => u.id)
                    .filter(Boolean);

            case "course_not_started":
                // Get users enrolled but haven't started course
                const { data: notStartedUsers } = await supabase
                    .from("enrollments")
                    .select("user_id")
                    .eq("progress", 0)
                    .gte(
                        "enrolled_at",
                        new Date(
                            Date.now() - (triggerParams?.days_after_assignment || 0) * 24 * 60 * 60 * 1000
                        ).toISOString()
                    );

                return (notStartedUsers || [])
                    .map((u: any) => u.user_id)
                    .filter(Boolean);

            case "achievement_unlocked":
                // Get users who have recently unlocked achievements
                const { data: achievementUsers } = await supabase
                    .from("user_achievements")
                    .select("user_id")
                    .gte(
                        "created_at",
                        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                    );

                return (achievementUsers || [])
                    .map((u: any) => u.user_id)
                    .filter(Boolean);

            default:
                console.warn(
                    `[ProcessAutoNotifications] Unknown trigger type: ${triggerType}`
                );
        }
    } catch (error) {
        console.error(
            `[ProcessAutoNotifications] Error getting users for trigger ${triggerType}:`,
            error
        );
    }

    return users;
}

async function processAutoSendRules(supabase: any): Promise<ProcessResult> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    console.log(
        "[ProcessAutoNotifications] Starting auto-send rules processing..."
    );

    try {
        // Get all active auto-send rules
        const { data: rules, error: rulesError } = await supabase
            .from("notification_auto_send_rules")
            .select("*")
            .eq("is_active", true);

        if (rulesError) throw rulesError;

        if (!rules || rules.length === 0) {
            console.log("[ProcessAutoNotifications] No active auto-send rules found");
            return {
                success: true,
                processed,
                failed,
                skipped,
                errors,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            };
        }

        console.log(
            `[ProcessAutoNotifications] Found ${rules.length} active rules to process`
        );

        // Process each rule
        for (const rule of rules) {
            try {
                console.log(
                    `[ProcessAutoNotifications] Processing rule: ${rule.id} (${rule.name})`
                );

                // Get users matching the trigger condition
                const targetUsers = await getUsersForTrigger(
                    supabase,
                    rule.trigger_type,
                    rule.trigger_params
                );

                if (targetUsers.length === 0) {
                    console.log(
                        `[ProcessAutoNotifications] No users found for rule ${rule.id}`
                    );
                    skipped++;
                    continue;
                }

                console.log(
                    `[ProcessAutoNotifications] Found ${targetUsers.length} target users for rule ${rule.id}`
                );

                // Process each user
                for (const userId of targetUsers) {
                    try {
                        // Get previous executions for this rule and user
                        const { data: previousExecutions, error: logError } = await supabase
                            .from("auto_send_rule_execution_log")
                            .select("created_at")
                            .eq("rule_id", rule.id)
                            .eq("user_id", userId)
                            .order("created_at", { ascending: false });

                        if (logError) throw logError;

                        const executionCount = previousExecutions?.length || 0;

                        // Check max sends per user
                        if (executionCount >= rule.max_sends_per_user) {
                            console.log(
                                `[ProcessAutoNotifications] User ${userId} has reached max sends (${executionCount}/${rule.max_sends_per_user}) for rule ${rule.id}`
                            );
                            continue;
                        }

                        // Check cooldown period (24 hours)
                        const lastSent =
                            previousExecutions && previousExecutions.length > 0
                                ? new Date(
                                    Math.max(
                                        ...previousExecutions.map((e: any) =>
                                            new Date(e.created_at).getTime()
                                        )
                                    )
                                )
                                : null;

                        const cooldownMs = 24 * 60 * 60 * 1000; // 24 hour cooldown
                        if (lastSent && Date.now() - lastSent.getTime() < cooldownMs) {
                            console.log(
                                `[ProcessAutoNotifications] Skipping user ${userId} for rule ${rule.id} due to 24h cooldown`
                            );
                            continue;
                        }

                        // Create notification
                        const { data: notification, error: notifError } = await supabase
                            .from("notifications")
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
                        const { error: logInsertError } = await supabase
                            .from("auto_send_rule_execution_log")
                            .insert({
                                rule_id: rule.id,
                                user_id: userId,
                                notification_id: notification?.id,
                                execution_status: "sent",
                            });

                        if (logInsertError) {
                            console.error(
                                `[ProcessAutoNotifications] Error logging execution:`,
                                logInsertError
                            );
                            // Don't fail the whole process if logging fails
                        }

                        processed++;
                    } catch (userError) {
                        const errorMsg =
                            userError instanceof Error
                                ? userError.message
                                : String(userError);
                        errors.push(
                            `Rule ${rule.id}, User ${userId}: ${errorMsg}`
                        );
                        console.error(
                            `[ProcessAutoNotifications] Error processing user ${userId} for rule ${rule.id}:`,
                            userError
                        );
                        failed++;
                    }
                }
            } catch (error) {
                const errorMsg =
                    error instanceof Error ? error.message : String(error);
                errors.push(`Rule ${rule.id}: ${errorMsg}`);
                console.error(
                    `[ProcessAutoNotifications] Error processing rule ${rule.id}:`,
                    error
                );
                failed++;
            }
        }
    } catch (error) {
        const errorMsg =
            error instanceof Error ? error.message : String(error);
        errors.push(`Fatal error: ${errorMsg}`);
        console.error("[ProcessAutoNotifications] Fatal error:", error);
        return {
            success: false,
            processed,
            failed,
            skipped,
            errors,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        };
    }

    const duration = Date.now() - startTime;
    console.log(
        `[ProcessAutoNotifications] Processing completed in ${(duration / 1000).toFixed(2)}s`
    );
    console.log(
        `[ProcessAutoNotifications] Results - Processed: ${processed}, Failed: ${failed}, Skipped: ${skipped}`
    );

    return {
        success: true,
        processed,
        failed,
        skipped,
        errors,
        duration,
        timestamp: new Date().toISOString(),
    };
}

// Main handler
Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
            },
        });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Process auto-send rules
        const result = await processAutoSendRules(supabase);

        return new Response(JSON.stringify(result), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            status: result.success ? 200 : 500,
        });
    } catch (error) {
        console.error("[ProcessAutoNotifications] Unexpected error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                status: 500,
            }
        );
    }
});
