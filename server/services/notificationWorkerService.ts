/**
 * Background Worker Service for Auto-Send Notification Rules
 * 
 * This service:
 * - Runs scheduled jobs to process auto-send rules
 * - Manages cron jobs for periodic notification processing
 * - Handles webhook triggers for event-based notifications
 * - Provides monitoring and logging
 * 
 * Can be deployed as:
 * 1. Supabase background worker
 * 2. Standalone Node.js service
 * 3. Cloud function (AWS Lambda, Google Cloud Functions, etc.)
 */

import { createClient } from "@supabase/supabase-js";
import * as cron from "node-cron";

interface ProcessingStats {
    processed: number;
    failed: number;
    skipped: number;
    duration: number;
    timestamp: string;
    nextRun?: string;
}

class NotificationWorkerService {
    private supabase;
    private isProcessing = false;
    private cronJobs: Map<string, cron.ScheduledTask> = new Map();

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
     * Initialize the worker service with all scheduled jobs
     */
    async initialize(): Promise<void> {
        console.log("[NotificationWorker] Initializing notification worker service...");

        try {
            // Schedule main auto-send processing job (every 5 minutes)
            this.scheduleJob("auto-send-processor", "*/5 * * * *", async () => {
                await this.processAutoSendRules();
            });

            // Schedule cleanup job (daily at 2 AM)
            this.scheduleJob("cleanup-logs", "0 2 * * *", async () => {
                await this.cleanupOldLogs();
            });

            // Schedule trigger evaluation reset (hourly)
            this.scheduleJob("evaluation-reset", "0 * * * *", async () => {
                await this.resetTriggerEvaluation();
            });

            // Schedule health check (every 10 minutes)
            this.scheduleJob("health-check", "*/10 * * * *", () => {
                this.healthCheck();
            });

            console.log("[NotificationWorker] Worker service initialized successfully");
        } catch (error) {
            console.error("[NotificationWorker] Initialization error:", error);
            throw error;
        }
    }

    /**
     * Schedule a new cron job
     */
    private scheduleJob(
        name: string,
        schedule: string,
        task: () => Promise<void> | void
    ): void {
        try {
            const job = cron.schedule(schedule, async () => {
                try {
                    console.log(`[NotificationWorker] Starting scheduled job: ${name}`);
                    await task();
                    console.log(`[NotificationWorker] Completed scheduled job: ${name}`);
                } catch (error) {
                    console.error(`[NotificationWorker] Error in job ${name}:`, error);
                }
            });

            this.cronJobs.set(name, job);
            console.log(`[NotificationWorker] Scheduled job registered: ${name} (${schedule})`);
        } catch (error) {
            console.error(`[NotificationWorker] Error scheduling job ${name}:`, error);
        }
    }

    /**
     * Process auto-send rules by calling the Edge Function
     */
    private async processAutoSendRules(): Promise<ProcessingStats> {
        if (this.isProcessing) {
            console.log("[NotificationWorker] Already processing, skipping this iteration");
            return { processed: 0, failed: 0, skipped: 1, duration: 0, timestamp: new Date().toISOString() };
        }

        this.isProcessing = true;
        const startTime = Date.now();

        try {
            console.log("[NotificationWorker] Processing auto-send rules...");

            // Fetch the edge function URL
            const functionUrl = `${process.env.SUPABASE_URL}/functions/v1/process-auto-notifications`;
            const authHeader = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

            // Call the edge function
            const response = await fetch(functionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                },
            });

            if (!response.ok) {
                throw new Error(`Edge function returned status ${response.status}`);
            }

            const result = await response.json();

            console.log(
                `[NotificationWorker] Auto-send processing completed: ${result.processed} sent, ${result.failed} failed`
            );

            return {
                ...result,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error("[NotificationWorker] Error processing auto-send rules:", error);
            return {
                processed: 0,
                failed: 0,
                skipped: 0,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Clean up old logs and history
     */
    private async cleanupOldLogs(): Promise<void> {
        try {
            console.log("[NotificationWorker] Starting cleanup of old logs...");

            // Clean up execution logs older than 90 days
            const { error: execError } = await this.supabase.rpc(
                "cleanup_old_execution_logs",
                { p_days_to_keep: 90 }
            );

            if (execError) throw execError;

            // Clean up trigger history older than 90 days
            const { error: histError } = await this.supabase.rpc(
                "cleanup_old_trigger_history",
                { p_days_to_keep: 90 }
            );

            if (histError) throw histError;

            console.log("[NotificationWorker] Cleanup completed successfully");
        } catch (error) {
            console.error("[NotificationWorker] Error during cleanup:", error);
        }
    }

    /**
     * Reset trigger evaluation status
     */
    private async resetTriggerEvaluation(): Promise<void> {
        try {
            console.log("[NotificationWorker] Resetting trigger evaluation status...");

            // Update rules to allow re-evaluation if needed
            const { error } = await this.supabase
                .from("notification_auto_send_rules")
                .update({ updated_at: new Date().toISOString() })
                .eq("is_active", true);

            if (error) throw error;

            console.log("[NotificationWorker] Trigger evaluation reset completed");
        } catch (error) {
            console.error("[NotificationWorker] Error resetting trigger evaluation:", error);
        }
    }

    /**
     * Health check to ensure worker is running
     */
    private healthCheck(): void {
        console.log(
            `[NotificationWorker] Health check - Active jobs: ${this.cronJobs.size}, Processing: ${this.isProcessing}`
        );
    }

    /**
     * Stop all scheduled jobs
     */
    stop(): void {
        console.log("[NotificationWorker] Stopping all scheduled jobs...");
        this.cronJobs.forEach((job) => job.stop());
        this.cronJobs.clear();
        console.log("[NotificationWorker] All jobs stopped");
    }

    /**
     * Get status of all scheduled jobs
     */
    getStatus(): any {
        return {
            isProcessing: this.isProcessing,
            activeJobs: Array.from(this.cronJobs.keys()),
            jobCount: this.cronJobs.size,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Manually trigger auto-send processing (for testing or manual runs)
     */
    async manualTrigger(): Promise<ProcessingStats> {
        console.log("[NotificationWorker] Manual trigger received");
        return this.processAutoSendRules();
    }

    /**
     * Handle webhook events for real-time processing
     * Called when specific database events occur
     */
    async handleWebhookEvent(
        event: string,
        data: any
    ): Promise<{ success: boolean; message: string }> {
        try {
            console.log(
                `[NotificationWorker] Webhook event received: ${event}`,
                JSON.stringify(data)
            );

            switch (event) {
                case "enrollment.created":
                    return await this.handleEnrollmentEvent(data);
                case "assignment.completed":
                    return await this.handleAssignmentEvent(data);
                case "user.achievement_unlocked":
                    return await this.handleAchievementEvent(data);
                default:
                    console.warn(`[NotificationWorker] Unknown webhook event: ${event}`);
                    return { success: false, message: "Unknown event type" };
            }
        } catch (error) {
            console.error("[NotificationWorker] Error handling webhook event:", error);
            return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Handle enrollment events
     */
    private async handleEnrollmentEvent(data: any): Promise<{ success: boolean; message: string }> {
        try {
            // Check if there are "course_not_started" rules that match
            const { data: rules, error } = await this.supabase
                .from("notification_auto_send_rules")
                .select("*")
                .eq("trigger_type", "course_not_started")
                .eq("is_active", true);

            if (error) throw error;

            if (rules && rules.length > 0) {
                console.log(
                    `[NotificationWorker] Found ${rules.length} matching course_not_started rules`
                );
            }

            return { success: true, message: "Enrollment event processed" };
        } catch (error) {
            console.error("[NotificationWorker] Error handling enrollment event:", error);
            return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Handle assignment completion events
     */
    private async handleAssignmentEvent(data: any): Promise<{ success: boolean; message: string }> {
        try {
            // Check if there are related notification rules to trigger
            const { data: rules, error } = await this.supabase
                .from("notification_auto_send_rules")
                .select("*")
                .eq("trigger_type", "assignment_overdue")
                .eq("is_active", true);

            if (error) throw error;

            return { success: true, message: "Assignment event processed" };
        } catch (error) {
            console.error("[NotificationWorker] Error handling assignment event:", error);
            return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Handle achievement unlock events
     */
    private async handleAchievementEvent(data: any): Promise<{ success: boolean; message: string }> {
        try {
            // Check if there are "achievement_unlocked" rules that match
            const { data: rules, error } = await this.supabase
                .from("notification_auto_send_rules")
                .select("*")
                .eq("trigger_type", "achievement_unlocked")
                .eq("is_active", true);

            if (error) throw error;

            if (rules && rules.length > 0) {
                console.log(
                    `[NotificationWorker] Found ${rules.length} matching achievement_unlocked rules`
                );
            }

            return { success: true, message: "Achievement event processed" };
        } catch (error) {
            console.error("[NotificationWorker] Error handling achievement event:", error);
            return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
    }
}

// Export singleton instance
export const notificationWorker = new NotificationWorkerService();

// Initialize if running as standalone service
if (process.env.NODE_ENV !== "test") {
    notificationWorker
        .initialize()
        .catch((error) => {
            console.error("[NotificationWorker] Fatal initialization error:", error);
            process.exit(1);
        });
}

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("[NotificationWorker] SIGTERM received, shutting down gracefully...");
    notificationWorker.stop();
    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("[NotificationWorker] SIGINT received, shutting down gracefully...");
    notificationWorker.stop();
    process.exit(0);
});

export default notificationWorker;
