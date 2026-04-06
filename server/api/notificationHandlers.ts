/**
 * LMS Integration API Hooks
 * These are the API endpoints the LMS frontend/backend calls
 * to trigger notifications in real-time
 * 
 * Usage:
 * - Call from enrollment form submission
 * - Call from lesson completion handler
 * - Call from course completion
 */

import IntegratedNotificationWorkflow from "../services/integratedNotificationWorkflow";

const workflow = new IntegratedNotificationWorkflow();

/**
 * =====================================================
 * HANDLER 1: User Enrolls in Course
 * =====================================================
 * 
 * Call this when:
 * - User clicks "Enroll" button
 * - Enrollment is confirmed in database
 * 
 * Usage:
 * await handleCourseEnrollment(userId, courseId);
 */
export async function handleCourseEnrollment(
    userId: string,
    courseId: string
): Promise<{
    success: boolean;
    message: string;
    notificationQueued?: boolean;
    error?: string;
}> {
    console.log(`[API] Course enrollment: ${userId} → ${courseId}`);

    try {
        await workflow.onCourseEnrollment(userId, courseId);

        return {
            success: true,
            message: "Enrollment notification queued",
            notificationQueued: true,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: "Failed to queue enrollment notification",
            error: message,
        };
    }
}

/**
 * =====================================================
 * HANDLER 2: User Accesses Lesson / Completes Activity
 * =====================================================
 * 
 * Call this when:
 * - User opens/views a lesson
 * - User completes a lesson activity
 * - User submits quiz/assessment
 * 
 * Usage:
 * await handleLessonActivity(userId, courseId);
 */
export async function handleLessonActivity(
    userId: string,
    courseId: string
): Promise<{
    success: boolean;
    message: string;
    activityLogged?: boolean;
    error?: string;
}> {
    console.log(`[API] Lesson activity: ${userId} → ${courseId}`);

    try {
        await workflow.onLessonActivity(userId, courseId);

        return {
            success: true,
            message: "Activity recorded - inactivity timer reset",
            activityLogged: true,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: "Failed to log activity",
            error: message,
        };
    }
}

/**
 * =====================================================
 * HANDLER 3: User Completes Course
 * =====================================================
 * 
 * Call this when:
 * - User passes final assessment
 * - User completes all lessons
 * - Admin marks course as complete
 * 
 * Usage:
 * await handleCourseCompletion(userId, courseId);
 */
export async function handleCourseCompletion(
    userId: string,
    courseId: string
): Promise<{
    success: boolean;
    message: string;
    certificateNotificationQueued?: boolean;
    error?: string;
}> {
    console.log(`[API] Course completion: ${userId} → ${courseId}`);

    try {
        await workflow.onCourseCompletion(userId, courseId);

        return {
            success: true,
            message: "Course marked complete - certificate notification queued",
            certificateNotificationQueued: true,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: "Failed to process completion",
            error: message,
        };
    }
}

/**
 * =====================================================
 * HANDLER 4: Run Daily Scheduler (Admin)
 * =====================================================
 * 
 * Call this:
 * - Manually (for testing)
 * - From cron job (scheduled)
 * - From admin dashboard
 * 
 * Usage:
 * const result = await handleDailyScheduler();
 */
export async function handleDailyScheduler(): Promise<{
    success: boolean;
    message: string;
    results?: {
        inactivityReminders: number;
        deadlineReminders: number;
        enrollmentNotifications: number;
        totalSent: number;
    };
    error?: string;
}> {
    console.log("[API] Running daily scheduler");

    try {
        const result = await workflow.runDailyChecks();

        return {
            success: result.errors.length === 0,
            message: "Daily checks completed",
            results: {
                inactivityReminders: result.inactivityChecked,
                deadlineReminders: result.deadlineChecked,
                enrollmentNotifications: 0, // Would need to track separately
                totalSent:
                    result.inactivityChecked + result.deadlineChecked + result.notificationsSent,
            },
            error:
                result.errors.length > 0
                    ? result.errors.join("; ")
                    : undefined,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: "Failed to run daily scheduler",
            error: message,
        };
    }
}

/**
 * =====================================================
 * HANDLER 5: Send Manual Test Notification (Admin)
 * =====================================================
 * 
 * Call this:
 * - To test specific notification
 * - For admin testing
 * - For debugging
 * 
 * Usage:
 * await handleManualNotification(userId, courseId, "inactivity_reminder");
 */
export async function handleManualNotification(
    userId: string,
    courseId: string,
    type: "course_start" | "inactivity_reminder" | "deadline_reminder"
): Promise<{
    success: boolean;
    message: string;
    notificationQueued?: boolean;
    error?: string;
}> {
    console.log(`[API] Manual notification: ${type} for ${userId} → ${courseId}`);

    try {
        await workflow.manualNotification(userId, courseId, type);

        return {
            success: true,
            message: `Manual ${type} notification queued`,
            notificationQueued: true,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: "Failed to queue notification",
            error: message,
        };
    }
}

/**
 * =====================================================
 * HANDLER 6: Get User Notification Status (User)
 * =====================================================
 * 
 * Call this:
 * - To show user their notification history
 * - For dashboard display
 * 
 * Usage:
 * const status = await handleGetNotificationStatus(userId);
 */
export async function handleGetNotificationStatus(userId: string): Promise<{
    success: boolean;
    notifications?: Array<{
        id: string;
        messageType: string;
        status: string;
        sentAt: string;
        deliveredAt?: string;
        readAt?: string;
    }>;
    error?: string;
}> {
    console.log(`[API] Get notification status for ${userId}`);

    try {
        const status = await workflow.getNotificationStatus(userId);

        return {
            success: true,
            notifications: (status || []).map((n: any) => ({
                id: n.id,
                messageType: n.message_type,
                status: n.status,
                sentAt: n.sent_at,
                deliveredAt: n.delivered_at,
                readAt: n.read_at,
            })),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: message,
        };
    }
}

/**
 * =====================================================
 * EXPRESS/FASTIFY ROUTE EXAMPLES
 * =====================================================
 */

/**
 * Example Express routes:
 * 
 * // Enrollment trigger
 * router.post("/api/notifications/enroll", async (req, res) => {
 *   const { userId, courseId } = req.body;
 *   const result = await handleCourseEnrollment(userId, courseId);
 *   res.json(result);
 * });
 * 
 * // Lesson activity
 * router.post("/api/notifications/activity", async (req, res) => {
 *   const { userId, courseId } = req.body;
 *   const result = await handleLessonActivity(userId, courseId);
 *   res.json(result);
 * });
 * 
 * // Course completion
 * router.post("/api/notifications/complete", async (req, res) => {
 *   const { userId, courseId } = req.body;
 *   const result = await handleCourseCompletion(userId, courseId);
 *   res.json(result);
 * });
 * 
 * // Admin: Run scheduler
 * router.post("/api/admin/notifications/scheduler", async (req, res) => {
 *   const result = await handleDailyScheduler();
 *   res.json(result);
 * });
 * 
 * // Admin: Manual notification
 * router.post("/api/admin/notifications/manual", async (req, res) => {
 *   const { userId, courseId, type } = req.body;
 *   const result = await handleManualNotification(userId, courseId, type);
 *   res.json(result);
 * });
 * 
 * // User: Get notification status
 * router.get("/api/notifications/status/:userId", async (req, res) => {
 *   const { userId } = req.params;
 *   const result = await handleGetNotificationStatus(userId);
 *   res.json(result);
 * });
 */

export default {
    handleCourseEnrollment,
    handleLessonActivity,
    handleCourseCompletion,
    handleDailyScheduler,
    handleManualNotification,
    handleGetNotificationStatus,
};
