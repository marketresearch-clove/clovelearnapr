/**
 * Notification Service
 * Core logic for determining and managing notification triggers
 */

import { createClient } from "@supabase/supabase-js";
import WhatsAppService from "./whatsappService";

interface User {
    id: string;
    phone_number: string;
    fullName: string;
    whatsapp_opt_in: boolean;
    notification_preferences: Record<string, boolean>;
}

interface Course {
    id: string;
    title: string;
}

interface Enrollment {
    id: string;
    user_id: string;
    course_id: string;
    progress: number;
    enrolled_at: string;
    deadline: string;
    last_reminder_sent_at: string;
    lastAccessedAt: string;
    completed: boolean;
}

type MessageType =
    | "course_enrollment"
    | "inactivity_reminder"
    | "deadline_reminder"
    | "weekly_summary"
    | "certificate_awarded"
    | "new_course_recommendation";

interface NotificationPayload {
    userId: string;
    courseId?: string;
    messageType: MessageType;
    phoneNumber: string;
    templateName: string;
    templateParameters: string[];
    metadata?: Record<string, unknown>;
}

class NotificationService {
    private supabase;
    private whatsappService: WhatsAppService;
    private readonly INACTIVITY_DAYS = 3;
    private readonly DEADLINE_REMINDER_DAYS = 2;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || "";
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
        this.whatsappService = new WhatsAppService();
    }

    /**
     * Check and send enrollment notifications
     */
    async checkEnrollmentNotifications(): Promise<void> {
        console.log("[Notification] Checking enrollment notifications...");

        try {
            // Get recent enrollments without enrollment notification
            const { data: enrollments, error } = await this.supabase
                .from("enrollments")
                .select(
                    `
          id,
          user_id,
          course_id,
          enrolled_at,
          enrollment_reminder_sent,
          users:profiles(fullName, phone_number, whatsapp_opt_in, notification_preferences),
          courses(title)
        `
                )
                .eq("enrollment_reminder_sent", false)
                .gte("enrolled_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(100);

            if (error) {
                console.error("[Notification] Error fetching enrollments:", error);
                return;
            }

            for (const enrollment of enrollments || []) {
                await this.sendEnrollmentNotification(enrollment);
            }
        } catch (error) {
            console.error("[Notification] Enrollment check failed:", error);
        }
    }

    /**
     * Check and send inactivity reminders
     */
    async checkInactivityReminders(): Promise<void> {
        console.log("[Notification] Checking inactivity reminders...");

        try {
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - this.INACTIVITY_DAYS);

            const { data: inactiveEnrollments, error } = await this.supabase
                .from("enrollments")
                .select(
                    `
          id,
          user_id,
          course_id,
          progress,
          last_reminder_sent_at,
          inactivity_reminder_sent,
          lastAccessedAt,
          users:profiles(fullName, phone_number, whatsapp_opt_in, notification_preferences),
          courses(title)
        `
                )
                .lt("progress", 100)
                .lt("lastAccessedAt", thresholdDate.toISOString())
                .eq("inactivity_reminder_sent", false)
                .limit(100);

            if (error) {
                console.error("[Notification] Error fetching inactive courses:", error);
                return;
            }

            for (const enrollment of inactiveEnrollments || []) {
                await this.sendInactivityReminder(enrollment);
            }
        } catch (error) {
            console.error("[Notification] Inactivity check failed:", error);
        }
    }

    /**
     * Check and send deadline reminders
     */
    async checkDeadlineReminders(): Promise<void> {
        console.log("[Notification] Checking deadline reminders...");

        try {
            const reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + this.DEADLINE_REMINDER_DAYS);

            const { data: dueSoonEnrollments, error } = await this.supabase
                .from("enrollments")
                .select(
                    `
          id,
          user_id,
          course_id,
          deadline,
          progress,
          deadline_reminder_sent,
          users:profiles(fullName, phone_number, whatsapp_opt_in, notification_preferences),
          courses(title)
        `
                )
                .lt("deadline", reminderDate.toISOString())
                .gt("deadline", new Date().toISOString())
                .lt("progress", 100)
                .eq("deadline_reminder_sent", false)
                .limit(100);

            if (error) {
                console.error("[Notification] Error fetching deadline enrollments:", error);
                return;
            }

            for (const enrollment of dueSoonEnrollments || []) {
                await this.sendDeadlineReminder(enrollment);
            }
        } catch (error) {
            console.error("[Notification] Deadline check failed:", error);
        }
    }

    /**
     * Send enrollment welcome notification
     */
    private async sendEnrollmentNotification(enrollment: any): Promise<void> {
        const user = enrollment.users;
        const course = enrollment.courses;

        if (!user?.whatsapp_opt_in || !user?.phone_number) {
            console.log("[Notification] User opted out or no phone number");
            return;
        }

        const prefs = user.notification_preferences || {};
        if (!prefs.course_enrollment) {
            console.log("[Notification] User disabled course enrollment notifications");
            return;
        }

        const courseLink = `${process.env.LMS_BASE_URL}/course/${enrollment.course_id}`;

        const payload: NotificationPayload = {
            userId: enrollment.user_id,
            courseId: enrollment.course_id,
            messageType: "course_enrollment",
            phoneNumber: user.phone_number,
            templateName: "course_enrollment",
            templateParameters: [user.fullName, course.title, courseLink],
        };

        await this.queueNotification(payload);

        // Mark as sent
        await this.supabase
            .from("enrollments")
            .update({ enrollment_reminder_sent: true, last_reminder_sent_at: new Date().toISOString() })
            .eq("id", enrollment.id);
    }

    /**
     * Send inactivity reminder
     */
    private async sendInactivityReminder(enrollment: any): Promise<void> {
        const user = enrollment.users;
        const course = enrollment.courses;

        if (!user?.whatsapp_opt_in || !user?.phone_number) {
            return;
        }

        const prefs = user.notification_preferences || {};
        if (!prefs.inactivity_reminder) {
            return;
        }

        const courseLink = `${process.env.LMS_BASE_URL}/course/${enrollment.course_id}`;

        const payload: NotificationPayload = {
            userId: enrollment.user_id,
            courseId: enrollment.course_id,
            messageType: "inactivity_reminder",
            phoneNumber: user.phone_number,
            templateName: "inactivity_reminder",
            templateParameters: [
                user.fullName,
                course.title,
                String(enrollment.progress),
                courseLink,
            ],
        };

        await this.queueNotification(payload);

        // Mark as sent
        await this.supabase
            .from("enrollments")
            .update({ inactivity_reminder_sent: true, last_reminder_sent_at: new Date().toISOString() })
            .eq("id", enrollment.id);
    }

    /**
     * Send deadline reminder
     */
    private async sendDeadlineReminder(enrollment: any): Promise<void> {
        const user = enrollment.users;
        const course = enrollment.courses;

        if (!user?.whatsapp_opt_in || !user?.phone_number) {
            return;
        }

        const prefs = user.notification_preferences || {};
        if (!prefs.deadline_reminder) {
            return;
        }

        const deadlineDate = new Date(enrollment.deadline).toLocaleDateString("en-US");
        const courseLink = `${process.env.LMS_BASE_URL}/course/${enrollment.course_id}`;

        const payload: NotificationPayload = {
            userId: enrollment.user_id,
            courseId: enrollment.course_id,
            messageType: "deadline_reminder",
            phoneNumber: user.phone_number,
            templateName: "deadline_reminder",
            templateParameters: [course.title, deadlineDate, courseLink],
        };

        await this.queueNotification(payload);

        // Mark as sent
        await this.supabase
            .from("enrollments")
            .update({ deadline_reminder_sent: true, last_reminder_sent_at: new Date().toISOString() })
            .eq("id", enrollment.id);
    }

    /**
     * Queue notification for processing
     */
    private async queueNotification(payload: NotificationPayload): Promise<void> {
        try {
            const { error } = await this.supabase.from("notification_queue").insert({
                user_id: payload.userId,
                course_id: payload.courseId || null,
                message_type: payload.messageType,
                phone_number: payload.phoneNumber,
                template_name: payload.templateName,
                template_parameters: JSON.stringify(payload.templateParameters),
                status: "queued",
            });

            if (error) {
                console.error("[Notification] Failed to queue notification:", error);
            }
        } catch (error) {
            console.error("[Notification] Queue error:", error);
        }
    }

    /**
     * Process queued notifications
     */
    async processNotificationQueue(): Promise<void> {
        console.log("[Notification] Processing notification queue...");

        try {
            // Get queued notifications
            const { data: queuedNotifications, error } = await this.supabase
                .from("notification_queue")
                .select("*")
                .eq("status", "queued")
                .lt("processing_attempts", 3)
                .order("priority", { ascending: false })
                .order("created_at", { ascending: true })
                .limit(50);

            if (error) {
                console.error("[Notification] Error fetching queue:", error);
                return;
            }

            for (const notification of queuedNotifications || []) {
                await this.sendQueuedNotification(notification);
            }
        } catch (error) {
            console.error("[Notification] Queue processing failed:", error);
        }
    }

    /**
     * Send a single queued notification
     */
    private async sendQueuedNotification(notification: any): Promise<void> {
        try {
            // Update status to processing
            await this.supabase
                .from("notification_queue")
                .update({
                    status: "processing",
                    processing_attempted_at: new Date().toISOString(),
                    processing_attempts: (notification.processing_attempts || 0) + 1,
                })
                .eq("id", notification.id);

            // Send via WhatsApp
            const messageId = await this.whatsappService.sendTemplateMessage(
                notification.phone_number,
                notification.template_name,
                JSON.parse(notification.template_parameters)
            );

            // Log notification
            await this.supabase.from("notification_logs").insert({
                user_id: notification.user_id,
                course_id: notification.course_id,
                message_type: notification.message_type,
                phone_number: notification.phone_number,
                template_name: notification.template_name,
                template_parameters: notification.template_parameters,
                whatsapp_message_id: messageId,
                status: "sent",
                sent_at: new Date().toISOString(),
            });

            // Update queue status
            await this.supabase
                .from("notification_queue")
                .update({ status: "sent" })
                .eq("id", notification.id);

            console.log(`[Notification] Sent notification ${messageId} to ${notification.phone_number}`);
        } catch (error) {
            console.error("[Notification] Failed to send queued notification:", error);

            // Mark as failed if max retries reached
            const attempts = (notification.processing_attempts || 0) + 1;
            if (attempts >= 3) {
                await this.supabase
                    .from("notification_queue")
                    .update({
                        status: "failed",
                        error_message: String(error),
                    })
                    .eq("id", notification.id);
            }
        }
    }
}

export default NotificationService;
