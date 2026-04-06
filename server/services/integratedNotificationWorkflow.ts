/**
 * Integrated Notification Workflow Handler
 * Main orchestrator for the entire notification system
 * Bridges LMS events → Supabase → WhatsApp API
 */

import { createClient } from "@supabase/supabase-js";
import WhatsAppService from "./whatsappService";

interface NotificationPayload {
    type: "course_start" | "inactivity_reminder" | "deadline_reminder";
    userId: string;
    courseId: string;
    metadata?: Record<string, any>;
}

interface EnrollmentData {
    id: string;
    user_id: string;
    course_id: string;
    progress: number;
    last_activity: string;
    deadline: string;
    enrolled_at: string;
    user: {
        fullName: string;
        phone_number: string;
        whatsapp_opt_in: boolean;
    };
    course: {
        title: string;
    };
}

class IntegratedNotificationWorkflow {
    private supabase;
    private whatsappService: WhatsAppService;
    private readonly INACTIVITY_DAYS = 3;
    private readonly DEADLINE_DAYS = 2;
    private readonly BASE_URL = process.env.LMS_BASE_URL || "https://lms.example.com";

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || "";
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
        this.whatsappService = new WhatsAppService();
    }

    /**
     * ===================================================================
     * EVENT-BASED TRIGGERS (Real-time from LMS)
     * ===================================================================
     */

    /**
     * Trigger when user enrolls in a course
     * Called from: Enrollment form submission / API
     */
    async onCourseEnrollment(userId: string, courseId: string): Promise<void> {
        console.log(
            `[Workflow] Course enrollment trigger: User ${userId}, Course ${courseId}`
        );

        try {
            // Get user and course details
            const { data: enrollment } = await this.supabase
                .from("enrollments")
                .select(
                    `
          id,
          user_id,
          course_id,
          users:profiles(fullName, phone_number, whatsapp_opt_in, notification_preferences),
          courses(title)
        `
                )
                .eq("user_id", userId)
                .eq("course_id", courseId)
                .single();

            if (!enrollment) {
                console.warn(`[Workflow] Enrollment not found for ${userId}, ${courseId}`);
                return;
            }

            // Check user preferences
            const user = enrollment.users as any;
            if (!user?.whatsapp_opt_in || !user?.phone_number) {
                console.log(`[Workflow] User opted out or no phone number`);
                return;
            }

            const prefs = user.notification_preferences || {};
            if (!prefs.course_enrollment) {
                console.log(`[Workflow] User disabled course enrollment notifications`);
                return;
            }

            // Queue the notification
            await this.queueNotification({
                type: "course_start",
                userId,
                courseId,
                metadata: {
                    enrollmentId: enrollment.id,
                    courseName: enrollment.course.title,
                    phoneNumber: user.phone_number,
                    userName: user.fullName,
                },
            });

            console.log(`[Workflow] ✓ Enrollment notification queued`);
        } catch (error) {
            console.error(`[Workflow] Error in onCourseEnrollment:`, error);
        }
    }

    /**
     * Trigger when user accesses/completes a lesson
     * Called from: Lesson view / completion
     * Updates last_activity timestamp
     */
    async onLessonActivity(userId: string, courseId: string): Promise<void> {
        console.log(`[Workflow] Lesson activity: User ${userId}, Course ${courseId}`);

        try {
            // Update last activity
            const { error } = await this.supabase
                .from("enrollments")
                .update({ lastAccessedAt: new Date().toISOString() })
                .eq("user_id", userId)
                .eq("course_id", courseId);

            if (error) {
                console.error(`[Workflow] Error updating activity:`, error);
            }

            console.log(`[Workflow] ✓ Activity updated`);
        } catch (error) {
            console.error(`[Workflow] Error in onLessonActivity:`, error);
        }
    }

    /**
     * Trigger when course is completed
     * Called from: Assessment pass / manual completion
     */
    async onCourseCompletion(userId: string, courseId: string): Promise<void> {
        console.log(
            `[Workflow] Course completion: User ${userId}, Course ${courseId}`
        );

        try {
            // Mark as completed
            await this.supabase
                .from("enrollments")
                .update({
                    completed: true,
                    progress: 100,
                    completedAt: new Date().toISOString(),
                })
                .eq("user_id", userId)
                .eq("course_id", courseId);

            // Queue certificate notification
            await this.queueNotification({
                type: "course_start", // Can be "certificate" if template exists
                userId,
                courseId,
                metadata: {
                    type: "certificate",
                    completedAt: new Date().toISOString(),
                },
            });

            console.log(`[Workflow] ✓ Completion notification queued`);
        } catch (error) {
            console.error(`[Workflow] Error in onCourseCompletion:`, error);
        }
    }

    /**
     * ===================================================================
     * SCHEDULED TRIGGERS (Batch processing)
     * Called by Edge Function cron job daily
     * ===================================================================
     */

    /**
     * Main scheduler - Check all triggers
     * Called daily at 9 AM UTC from Edge Function
     */
    async runDailyChecks(): Promise<{
        inactivityChecked: number;
        deadlineChecked: number;
        notificationsSent: number;
        errors: string[];
    }> {
        console.log("[Scheduler] Daily checks starting...");

        const results = {
            inactivityChecked: 0,
            deadlineChecked: 0,
            notificationsSent: 0,
            errors: [] as string[],
        };

        try {
            // Check inactivity
            const inactivityResult = await this.checkInactivityReminders();
            results.inactivityChecked = inactivityResult;

            // Check deadlines
            const deadlineResult = await this.checkDeadlineReminders();
            results.deadlineChecked = deadlineResult;

            // Process notification queue
            const queueResult = await this.processNotificationQueue();
            results.notificationsSent = queueResult;

            console.log("[Scheduler] ✓ Daily checks completed", results);
            return results;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            results.errors.push(message);
            console.error("[Scheduler] Error:", message);
            return results;
        }
    }

    /**
     * Check for inactive enrollments (3+ days without activity)
     */
    private async checkInactivityReminders(): Promise<number> {
        console.log("[Scheduler] Checking inactivity reminders...");

        try {
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - this.INACTIVITY_DAYS);

            // Get inactive enrollments
            const { data: enrollments, error } = await this.supabase
                .from("enrollments")
                .select(
                    `
          id,
          user_id,
          course_id,
          progress,
          lastAccessedAt,
          inactivity_reminder_sent,
          users:profiles(fullName, phone_number, whatsapp_opt_in, notification_preferences),
          courses(title)
        `
                )
                .lt("progress", 100)
                .lt("lastAccessedAt", thresholdDate.toISOString())
                .eq("inactivity_reminder_sent", false)
                .limit(100);

            if (error) throw error;

            let count = 0;
            for (const enrollment of enrollments || []) {
                try {
                    const user = enrollment.users as any;
                    if (!user?.whatsapp_opt_in || !user?.phone_number) continue;

                    const prefs = user.notification_preferences || {};
                    if (!prefs.inactivity_reminder) continue;

                    // Queue notification
                    await this.queueNotification({
                        type: "inactivity_reminder",
                        userId: enrollment.user_id,
                        courseId: enrollment.course_id,
                        metadata: {
                            enrollmentId: enrollment.id,
                            courseName: enrollment.course.title,
                            progress: enrollment.progress,
                            phoneNumber: user.phone_number,
                            userName: user.fullName,
                        },
                    });

                    // Mark as sent
                    await this.supabase
                        .from("enrollments")
                        .update({
                            inactivity_reminder_sent: true,
                            last_reminder_sent_at: new Date().toISOString(),
                        })
                        .eq("id", enrollment.id);

                    count++;
                } catch (e) {
                    console.error("[Scheduler] Error processing enrollment:", e);
                }
            }

            console.log(`[Scheduler] ✓ Inactivity check: ${count} users`);
            return count;
        } catch (error) {
            console.error("[Scheduler] Inactivity check error:", error);
            return 0;
        }
    }

    /**
     * Check for upcoming deadlines (within 2 days)
     */
    private async checkDeadlineReminders(): Promise<number> {
        console.log("[Scheduler] Checking deadline reminders...");

        try {
            const reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + this.DEADLINE_DAYS);

            // Get enrollments with approaching deadlines
            const { data: enrollments, error } = await this.supabase
                .from("enrollments")
                .select(
                    `
          id,
          user_id,
          course_id,
          progress,
          deadline,
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

            if (error) throw error;

            let count = 0;
            for (const enrollment of enrollments || []) {
                try {
                    const user = enrollment.users as any;
                    if (!user?.whatsapp_opt_in || !user?.phone_number) continue;

                    const prefs = user.notification_preferences || {};
                    if (!prefs.deadline_reminder) continue;

                    const deadlineDate = new Date(enrollment.deadline).toLocaleDateString(
                        "en-US"
                    );

                    // Queue notification
                    await this.queueNotification({
                        type: "deadline_reminder",
                        userId: enrollment.user_id,
                        courseId: enrollment.course_id,
                        metadata: {
                            enrollmentId: enrollment.id,
                            courseName: enrollment.course.title,
                            deadline: deadlineDate,
                            phoneNumber: user.phone_number,
                            userName: user.fullName,
                        },
                    });

                    // Mark as sent
                    await this.supabase
                        .from("enrollments")
                        .update({
                            deadline_reminder_sent: true,
                            last_reminder_sent_at: new Date().toISOString(),
                        })
                        .eq("id", enrollment.id);

                    count++;
                } catch (e) {
                    console.error("[Scheduler] Error processing enrollment:", e);
                }
            }

            console.log(`[Scheduler] ✓ Deadline check: ${count} users`);
            return count;
        } catch (error) {
            console.error("[Scheduler] Deadline check error:", error);
            return 0;
        }
    }

    /**
     * ===================================================================
     * QUEUE MANAGEMENT
     * ===================================================================
     */

    /**
     * Queue a notification for processing
     */
    private async queueNotification(payload: NotificationPayload): Promise<void> {
        try {
            const templateMap: Record<string, string> = {
                course_start: "course_enrollment",
                inactivity_reminder: "inactivity_reminder",
                deadline_reminder: "deadline_reminder",
            };

            const templateName = templateMap[payload.type];
            const phoneNumber = payload.metadata?.phoneNumber;
            const userName = payload.metadata?.userName;
            const courseName = payload.metadata?.courseName;

            if (!phoneNumber || !templateName) {
                console.warn("[Queue] Missing required fields:", payload);
                return;
            }

            // Build template parameters based on type
            let templateParameters: string[] = [];

            switch (payload.type) {
                case "course_start":
                    templateParameters = [
                        userName,
                        courseName,
                        `${this.BASE_URL}/course/${payload.courseId}`,
                    ];
                    break;
                case "inactivity_reminder":
                    templateParameters = [
                        userName,
                        courseName,
                        String(payload.metadata?.progress || 0),
                        `${this.BASE_URL}/course/${payload.courseId}`,
                    ];
                    break;
                case "deadline_reminder":
                    templateParameters = [
                        courseName,
                        payload.metadata?.deadline || "Soon",
                        `${this.BASE_URL}/course/${payload.courseId}`,
                    ];
                    break;
            }

            // Queue in database
            const { error } = await this.supabase.from("notification_queue").insert({
                user_id: payload.userId,
                course_id: payload.courseId,
                message_type: payload.type,
                phone_number: phoneNumber,
                template_name: templateName,
                template_parameters: JSON.stringify(templateParameters),
                status: "queued",
                priority: 5,
            });

            if (error) {
                console.error("[Queue] Error inserting notification:", error);
                return;
            }

            console.log(
                `[Queue] ✓ Queued ${payload.type} for user ${payload.userId}`
            );
        } catch (error) {
            console.error("[Queue] Error queuing notification:", error);
        }
    }

    /**
     * Process queued notifications - Send them via WhatsApp
     */
    private async processNotificationQueue(): Promise<number> {
        console.log("[Queue] Processing notification queue...");

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

            if (error) throw error;

            let sentCount = 0;

            for (const notification of queuedNotifications || []) {
                try {
                    // Update to processing
                    await this.supabase
                        .from("notification_queue")
                        .update({
                            status: "processing",
                            processing_attempted_at: new Date().toISOString(),
                            processing_attempts: (notification.processing_attempts || 0) + 1,
                        })
                        .eq("id", notification.id);

                    // Send message
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

                    // Mark queue as sent
                    await this.supabase
                        .from("notification_queue")
                        .update({ status: "sent" })
                        .eq("id", notification.id);

                    sentCount++;
                    console.log(`[Queue] ✓ Sent message ${messageId}`);
                } catch (error) {
                    console.error("[Queue] Error sending notification:", error);

                    // Mark as failed if max retries
                    if (notification.processing_attempts >= 2) {
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

            console.log(`[Queue] ✓ Processed ${sentCount} notifications`);
            return sentCount;
        } catch (error) {
            console.error("[Queue] Error processing queue:", error);
            return 0;
        }
    }

    /**
     * ===================================================================
     * UTILITY METHODS
     * ===================================================================
     */

    /**
     * Manually trigger notification (for testing/admin)
     */
    async manualNotification(
        userId: string,
        courseId: string,
        type: "course_start" | "inactivity_reminder" | "deadline_reminder"
    ): Promise<void> {
        console.log(
            `[Workflow] Manual trigger: ${type} for user ${userId}, course ${courseId}`
        );

        const { data: enrollment } = await this.supabase
            .from("enrollments")
            .select(
                `
        id,
        user_id,
        course_id,
        progress,
        deadline,
        users:profiles(fullName, phone_number),
        courses(title)
      `
            )
            .eq("user_id", userId)
            .eq("course_id", courseId)
            .single();

        if (!enrollment) {
            throw new Error("Enrollment not found");
        }

        const user = enrollment.users as any;
        const course = enrollment.courses as any;

        let metadata: Record<string, any> = {
            enrollmentId: enrollment.id,
            courseName: course.title,
            phoneNumber: user.phone_number,
            userName: user.fullName,
        };

        if (type === "inactivity_reminder") {
            metadata.progress = enrollment.progress;
        } else if (type === "deadline_reminder") {
            metadata.deadline = new Date(enrollment.deadline).toLocaleDateString(
                "en-US"
            );
        }

        await this.queueNotification({
            type,
            userId,
            courseId,
            metadata,
        });
    }

    /**
     * Get notification status for a user
     */
    async getNotificationStatus(userId: string) {
        const { data, error } = await this.supabase
            .from("notification_logs")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) throw error;
        return data;
    }
}

export default IntegratedNotificationWorkflow;
