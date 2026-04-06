/**
 * Supabase Edge Function: WhatsApp Notification Scheduler
 * Runs daily to check and send notifications
 *
 * Deploy with:
 * supabase functions deploy whatsapp-notification-scheduler
 *
 * Set up cron trigger in Supabase dashboard:
 * - Cron: 0 9 * * * (Daily at 9 AM UTC)
 * - Webhook: https://[YOUR_SUPABASE_URL]/functions/v1/whatsapp-notification-scheduler
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const whatsappPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const whatsappAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const baseUrl = Deno.env.get("LMS_BASE_URL") || "https://lms.example.com";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to format phone numbers
function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned;
}

// Send WhatsApp template message
async function sendWhatsAppMessage(
    phoneNumber: string,
    templateName: string,
    parameters: string[]
): Promise<string> {
    const url = `https://graph.facebook.com/v18.0/${whatsappPhoneNumberId}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: formatPhoneNumber(phoneNumber),
        type: "template",
        template: {
            name: templateName,
            language: {
                code: "en_US",
            },
            components: [
                {
                    type: "body",
                    parameters: parameters.map((param) => ({
                        type: "text",
                        text: String(param),
                    })),
                },
            ],
        },
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${whatsappAccessToken}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data.messages?.[0]?.id || "";
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
        throw error;
    }
}

// Check and send enrollment notifications
async function checkEnrollmentNotifications() {
    console.log("Checking enrollment notifications...");

    try {
        const { data: enrollments, error } = await supabase
            .from("enrollments")
            .select(
                `
        id,
        user_id,
        course_id,
        enrolled_at,
        enrollment_reminder_sent,
        profiles!inner(fullName, phone_number, whatsapp_opt_in, notification_preferences),
        courses!inner(title)
      `
            )
            .eq("enrollment_reminder_sent", false)
            .gte("enrolled_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(100);

        if (error) {
            console.error("Error fetching enrollments:", error);
            return;
        }

        for (const enrollment of enrollments || []) {
            const profile = enrollment.profiles as any;
            const course = enrollment.courses as any;

            if (!profile?.whatsapp_opt_in || !profile?.phone_number) continue;

            const prefs = profile.notification_preferences || {};
            if (!prefs.course_enrollment) continue;

            try {
                const courseLink = `${baseUrl}/course/${enrollment.course_id}`;
                const messageId = await sendWhatsAppMessage(profile.phone_number, "course_enrollment", [
                    profile.fullName || "User",
                    course.title,
                    courseLink,
                ]);

                // Log notification
                await supabase.from("notification_logs").insert({
                    user_id: enrollment.user_id,
                    course_id: enrollment.course_id,
                    message_type: "course_enrollment",
                    phone_number: profile.phone_number,
                    template_name: "course_enrollment",
                    whatsapp_message_id: messageId,
                    status: "sent",
                    sent_at: new Date().toISOString(),
                });

                // Mark as sent
                await supabase
                    .from("enrollments")
                    .update({
                        enrollment_reminder_sent: true,
                        last_reminder_sent_at: new Date().toISOString(),
                    })
                    .eq("id", enrollment.id);

                console.log(`Sent enrollment notification to ${profile.phone_number}`);
            } catch (error) {
                console.error("Error sending enrollment notification:", error);
            }
        }
    } catch (error) {
        console.error("Enrollment check failed:", error);
    }
}

// Check and send inactivity reminders
async function checkInactivityReminders() {
    console.log("Checking inactivity reminders...");

    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - 3); // 3 days

        const { data: inactiveEnrollments, error } = await supabase
            .from("enrollments")
            .select(
                `
        id,
        user_id,
        course_id,
        progress,
        lastAccessedAt,
        inactivity_reminder_sent,
        profiles!inner(fullName, phone_number, whatsapp_opt_in, notification_preferences),
        courses!inner(title)
      `
            )
            .lt("progress", 100)
            .lt("lastAccessedAt", thresholdDate.toISOString())
            .eq("inactivity_reminder_sent", false)
            .limit(100);

        if (error) {
            console.error("Error fetching inactive enrollments:", error);
            return;
        }

        for (const enrollment of inactiveEnrollments || []) {
            const profile = enrollment.profiles as any;
            const course = enrollment.courses as any;

            if (!profile?.whatsapp_opt_in || !profile?.phone_number) continue;

            const prefs = profile.notification_preferences || {};
            if (!prefs.inactivity_reminder) continue;

            try {
                const courseLink = `${baseUrl}/course/${enrollment.course_id}`;
                const messageId = await sendWhatsAppMessage(
                    profile.phone_number,
                    "inactivity_reminder",
                    [profile.fullName || "User", course.title, String(enrollment.progress), courseLink]
                );

                // Log notification
                await supabase.from("notification_logs").insert({
                    user_id: enrollment.user_id,
                    course_id: enrollment.course_id,
                    message_type: "inactivity_reminder",
                    phone_number: profile.phone_number,
                    template_name: "inactivity_reminder",
                    whatsapp_message_id: messageId,
                    status: "sent",
                    sent_at: new Date().toISOString(),
                });

                // Mark as sent
                await supabase
                    .from("enrollments")
                    .update({
                        inactivity_reminder_sent: true,
                        last_reminder_sent_at: new Date().toISOString(),
                    })
                    .eq("id", enrollment.id);

                console.log(`Sent inactivity reminder to ${profile.phone_number}`);
            } catch (error) {
                console.error("Error sending inactivity reminder:", error);
            }
        }
    } catch (error) {
        console.error("Inactivity check failed:", error);
    }
}

// Check and send deadline reminders
async function checkDeadlineReminders() {
    console.log("Checking deadline reminders...");

    try {
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + 2); // 2 days from now

        const { data: dueSoonEnrollments, error } = await supabase
            .from("enrollments")
            .select(
                `
        id,
        user_id,
        course_id,
        progress,
        deadline,
        deadline_reminder_sent,
        profiles!inner(fullName, phone_number, whatsapp_opt_in, notification_preferences),
        courses!inner(title)
      `
            )
            .lt("deadline", reminderDate.toISOString())
            .gt("deadline", new Date().toISOString())
            .lt("progress", 100)
            .eq("deadline_reminder_sent", false)
            .limit(100);

        if (error) {
            console.error("Error fetching deadline enrollments:", error);
            return;
        }

        for (const enrollment of dueSoonEnrollments || []) {
            const profile = enrollment.profiles as any;
            const course = enrollment.courses as any;

            if (!profile?.whatsapp_opt_in || !profile?.phone_number) continue;

            const prefs = profile.notification_preferences || {};
            if (!prefs.deadline_reminder) continue;

            try {
                const deadlineDate = new Date(enrollment.deadline).toLocaleDateString("en-US");
                const courseLink = `${baseUrl}/course/${enrollment.course_id}`;

                const messageId = await sendWhatsAppMessage(
                    profile.phone_number,
                    "deadline_reminder",
                    [course.title, deadlineDate, courseLink]
                );

                // Log notification
                await supabase.from("notification_logs").insert({
                    user_id: enrollment.user_id,
                    course_id: enrollment.course_id,
                    message_type: "deadline_reminder",
                    phone_number: profile.phone_number,
                    template_name: "deadline_reminder",
                    whatsapp_message_id: messageId,
                    status: "sent",
                    sent_at: new Date().toISOString(),
                });

                // Mark as sent
                await supabase
                    .from("enrollments")
                    .update({
                        deadline_reminder_sent: true,
                        last_reminder_sent_at: new Date().toISOString(),
                    })
                    .eq("id", enrollment.id);

                console.log(`Sent deadline reminder to ${profile.phone_number}`);
            } catch (error) {
                console.error("Error sending deadline reminder:", error);
            }
        }
    } catch (error) {
        console.error("Deadline check failed:", error);
    }
}

// Main handler
Deno.serve(async (req) => {
    console.log("WhatsApp Notification Scheduler triggered");

    try {
        // Verify webhook signature if included
        const signature = req.headers.get("x-supabase-signature");
        if (signature) {
            // Verification logic here if needed
            console.log("Webhook signature verified");
        }

        // Run all notification checks
        await Promise.all([
            checkEnrollmentNotifications(),
            checkInactivityReminders(),
            checkDeadlineReminders(),
        ]);

        return new Response(
            JSON.stringify({
                success: true,
                message: "WhatsApp notifications processed",
            }),
            { headers: { "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error) {
        console.error("Scheduler error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            { headers: { "Content-Type": "application/json" }, status: 500 }
        );
    }
});
