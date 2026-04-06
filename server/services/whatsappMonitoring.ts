/**
 * WhatsApp Testing & Monitoring Utilities
 * Helpful tools for debugging and monitoring the notification system
 */

import { createClient } from "@supabase/supabase-js";
import WhatsAppService from "./whatsappService";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface NotificationStats {
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    deliveryRate: number;
    readRate: number;
}

interface NotificationLog {
    id: string;
    user_id: string;
    message_type: string;
    status: string;
    sent_at: string;
    delivered_at: string | null;
    read_at: string | null;
    error_message: string | null;
}

class WhatsAppMonitoring {
    private supabase = createClient(supabaseUrl, supabaseServiceKey);
    private whatsapp = new WhatsAppService();

    /**
     * Get notification statistics
     */
    async getNotificationStats(days: number = 7): Promise<NotificationStats> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await this.supabase
            .from("notification_logs")
            .select("status")
            .gte("created_at", startDate.toISOString());

        if (error) {
            console.error("Error fetching stats:", error);
            throw error;
        }

        const logs = data || [];
        const totalSent = logs.length;
        const totalDelivered = logs.filter((l) => l.status === "delivered").length;
        const totalRead = logs.filter((l) => l.status === "read").length;
        const totalFailed = logs.filter((l) => l.status === "failed").length;

        return {
            totalSent,
            totalDelivered,
            totalRead,
            totalFailed,
            deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
            readRate: totalSent > 0 ? (totalRead / totalSent) * 100 : 0,
        };
    }

    /**
     * Get failed notifications for review
     */
    async getFailedNotifications(limit: number = 50): Promise<NotificationLog[]> {
        const { data, error } = await this.supabase
            .from("notification_logs")
            .select("*")
            .eq("status", "failed")
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Error fetching failed notifications:", error);
            throw error;
        }

        return data || [];
    }

    /**
     * Get notification logs by message type
     */
    async getLogsByMessageType(messageType: string, limit: number = 50) {
        const { data, error } = await this.supabase
            .from("notification_logs")
            .select("*")
            .eq("message_type", messageType)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error(`Error fetching ${messageType} logs:`, error);
            throw error;
        }

        return data || [];
    }

    /**
     * Get notification queue status
     */
    async getQueueStatus() {
        const { data, error } = await this.supabase
            .from("notification_queue")
            .select("status, COUNT(*) as count")
            .group_by("status");

        if (error) {
            console.error("Error fetching queue status:", error);
            throw error;
        }

        return data || [];
    }

    /**
     * Get user notification preferences
     */
    async getUserNotificationPreferences(userId: string) {
        const { data, error } = await this.supabase
            .from("profiles")
            .select(
                "id, email, phone_number, whatsapp_opt_in, notification_preferences, whatsapp_verified"
            )
            .eq("id", userId)
            .single();

        if (error) {
            console.error("Error fetching user preferences:", error);
            throw error;
        }

        return data;
    }

    /**
     * Send test notification to a user
     */
    async sendTestNotification(
        userId: string,
        messageType: "course_enrollment" | "inactivity_reminder" | "deadline_reminder"
    ): Promise<void> {
        // Get user details
        const user = await this.getUserNotificationPreferences(userId);

        if (!user?.phone_number) {
            throw new Error("User has no phone number configured");
        }

        if (!user?.whatsapp_opt_in) {
            throw new Error("User has not opted in to WhatsApp notifications");
        }

        try {
            let templateParameters: string[] = [];

            switch (messageType) {
                case "course_enrollment":
                    templateParameters = [
                        user.email || "User",
                        "Test Course",
                        `${process.env.LMS_BASE_URL}/course/test`,
                    ];
                    break;
                case "inactivity_reminder":
                    templateParameters = [
                        user.email || "User",
                        "Test Course",
                        "50",
                        `${process.env.LMS_BASE_URL}/course/test`,
                    ];
                    break;
                case "deadline_reminder":
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    templateParameters = [
                        "Test Course",
                        tomorrow.toLocaleDateString("en-US"),
                        `${process.env.LMS_BASE_URL}/course/test`,
                    ];
                    break;
            }

            const messageId = await this.whatsapp.sendTemplateMessage(
                user.phone_number,
                messageType,
                templateParameters
            );

            // Log test notification
            await this.supabase.from("notification_logs").insert({
                user_id: userId,
                message_type: messageType,
                phone_number: user.phone_number,
                template_name: messageType,
                whatsapp_message_id: messageId,
                status: "sent",
                sent_at: new Date().toISOString(),
            });

            console.log(
                `✓ Test notification sent to ${user.phone_number} (Message ID: ${messageId})`
            );
        } catch (error) {
            console.error("Error sending test notification:", error);
            throw error;
        }
    }

    /**
     * Print formatted notification stats
     */
    async printStats(days: number = 7): Promise<void> {
        try {
            const stats = await this.getNotificationStats(days);

            console.log("\n" + "=".repeat(50));
            console.log("  WhatsApp Notification Statistics");
            console.log("=".repeat(50));
            console.log(`  Period: Last ${days} days`);
            console.log("-".repeat(50));
            console.log(`  Total Sent:         ${stats.totalSent}`);
            console.log(`  Delivered:          ${stats.totalDelivered}`);
            console.log(`  Read:               ${stats.totalRead}`);
            console.log(`  Failed:             ${stats.totalFailed}`);
            console.log("-".repeat(50));
            console.log(`  Delivery Rate:      ${stats.deliveryRate.toFixed(2)}%`);
            console.log(`  Read Rate:          ${stats.readRate.toFixed(2)}%`);
            console.log("=".repeat(50) + "\n");
        } catch (error) {
            console.error("Error printing stats:", error);
        }
    }

    /**
     * Check WhatsApp service health
     */
    async checkHealth(): Promise<{
        whatsappApiConnected: boolean;
        supabaseConnected: boolean;
        queueStatus: any;
    }> {
        try {
            console.log("Checking WhatsApp integration health...\n");

            // Check WhatsApp API
            console.log("📱 Testing WhatsApp API connection...");
            const whatsappConnected = await this.whatsapp.testConnection();
            console.log(
                whatsappConnected
                    ? "  ✓ WhatsApp API connected"
                    : "  ✗ WhatsApp API connection failed"
            );

            // Check Supabase
            console.log("🗄️  Testing Supabase connection...");
            const { error: supabaseError } = await this.supabase.from("profiles").select("COUNT(*)", {
                count: "exact",
                head: true,
            });
            const supabaseConnected = !supabaseError;
            console.log(
                supabaseConnected
                    ? "  ✓ Supabase connected"
                    : "  ✗ Supabase connection failed"
            );

            // Check queue status
            console.log("📋 Checking notification queue...");
            const queueStatus = await this.getQueueStatus();
            console.log("  Queue status:");
            queueStatus.forEach((status: any) => {
                console.log(`    • ${status.status}: ${status.count}`);
            });

            return {
                whatsappApiConnected,
                supabaseConnected,
                queueStatus,
            };
        } catch (error) {
            console.error("Health check error:", error);
            throw error;
        }
    }

    /**
     * Retry failed notifications
     */
    async retryFailedNotifications(limit: number = 50): Promise<number> {
        try {
            const failed = await this.getFailedNotifications(limit);

            let retryCount = 0;

            for (const notification of failed) {
                try {
                    // Re-queue the notification
                    await this.supabase.from("notification_queue").insert({
                        user_id: notification.user_id,
                        course_id: null,
                        message_type: notification.message_type,
                        phone_number: notification.phone_number,
                        template_name: notification.template_name || "",
                        template_parameters: notification.template_parameters,
                        status: "queued",
                    });

                    retryCount++;
                    console.log(`Requeued notification ${notification.id}`);
                } catch (error) {
                    console.error("Error requeuing notification:", error);
                }
            }

            console.log(`\n✓ Requeued ${retryCount} failed notifications`);
            return retryCount;
        } catch (error) {
            console.error("Error retrying failed notifications:", error);
            throw error;
        }
    }

    /**
     * Export notification logs to JSON
     */
    async exportLogs(days: number = 30): Promise<NotificationLog[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await this.supabase
            .from("notification_logs")
            .select("*")
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error exporting logs:", error);
            throw error;
        }

        return data || [];
    }
}

// CLI Tool for debugging
async function runCLI() {
    const monitoring = new WhatsAppMonitoring();

    const command = process.argv[2];
    const args = process.argv.slice(3);

    try {
        switch (command) {
            case "stats":
                const days = parseInt(args[0] || "7");
                await monitoring.printStats(days);
                break;

            case "failed":
                const limit = parseInt(args[0] || "10");
                const failed = await monitoring.getFailedNotifications(limit);
                console.log("Failed Notifications:");
                console.table(failed);
                break;

            case "health":
                const health = await monitoring.checkHealth();
                break;

            case "retry":
                await monitoring.retryFailedNotifications();
                break;

            case "test":
                const userId = args[0];
                const messageType = args[1] as any;
                if (!userId || !messageType) {
                    console.error("Usage: npm run whatsapp-test <userId> <messageType>");
                    console.error("messageType: course_enrollment | inactivity_reminder | deadline_reminder");
                    process.exit(1);
                }
                await monitoring.sendTestNotification(userId, messageType);
                break;

            default:
                console.log("WhatsApp Monitoring CLI");
                console.log("\nUsage:");
                console.log("  npm run whatsapp stats [days]              - Show notification stats");
                console.log("  npm run whatsapp failed [limit]            - Show failed notifications");
                console.log("  npm run whatsapp health                    - Check service health");
                console.log("  npm run whatsapp retry                     - Retry failed notifications");
                console.log("  npm run whatsapp test <userId> <type>      - Send test notification");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runCLI();
}

export default WhatsAppMonitoring;
