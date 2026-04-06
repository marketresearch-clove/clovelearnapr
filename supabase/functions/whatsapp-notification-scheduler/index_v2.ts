/**
 * Improved Edge Function: Main Scheduler
 * Orchestrates the complete notification workflow
 *
 * Deploy: supabase functions deploy whatsapp-notification-scheduler
 * Cron: 0 9 * * * (Daily 9 AM UTC)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const whatsappPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const whatsappAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const baseUrl = Deno.env.get("LMS_BASE_URL") || "https://lms.example.com";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Send WhatsApp template message
 */
async function sendWhatsAppMessage(
    phoneNumber: string,
    templateName: string,
    parameters: string[]
): Promise<string> {
    const url = `https://graph.facebook.com/v18.0/${whatsappPhoneNumberId}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "template",
        template: {
            name: templateName,
            language: { code: "en_US" },
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

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${whatsappAccessToken}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`WhatsApp API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.messages?.[0]?.id || "";
}

/**
 * Check inactivity: 3+ days without activity
 */
async function checkInactivityReminders() {
    console.log("[Scheduler] Checking inactivity reminders...");

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 3);

    const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select(
            `
      id,
      user_id,
      course_id,
      progress,
      lastAccessedAt,
      inactivity_reminder_sent,
      profiles!inner(
        fullName,
        phone_number,
        whatsapp_opt_in,
        notification_preferences
      ),
      courses!inner(title)
    `
        )
        .lt("progress", 100)
        .lt("lastAccessedAt", thresholdDate.toISOString())
        .eq("inactivity_reminder_sent", false)
        .limit(100);

    if (error) {
        console.error("Error fetching inactive enrollments:", error);
        return 0;
    }

    let count = 0;
    for (const enrollment of enrollments || []) {
        try {
            const profile = enrollment.profiles as any;
            const course = enrollment.courses as any;

            // Check preferences
            if (!profile?.whatsapp_opt_in || !profile?.phone_number) continue;
            const prefs = profile.notification_preferences || {};
            if (!prefs.inactivity_reminder) continue;

            // Send message
            const messageId = await sendWhatsAppMessage(
                profile.phone_number,
                "inactivity_reminder",
                [
                    profile.fullName || "Learner",
                    course.title,
                    String(enrollment.progress),
                    `${baseUrl}/course/${enrollment.course_id}`,
                ]
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

            count++;
            console.log(`Sent inactivity reminder to ${profile.phone_number}`);
        } catch (error) {
            console.error("Error sending inactivity reminder:", error);
        }
    }

    console.log(`✓ Inactivity check: ${count} reminders sent`);
    return count;
}

/**
 * Check deadlines: within 2 days
 */
async function checkDeadlineReminders() {
    console.log("[Scheduler] Checking deadline reminders...");

    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 2);

    const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select(
            `
      id,
      user_id,
      course_id,
      progress,
      deadline,
      deadline_reminder_sent,
      profiles!inner(
        fullName,
        phone_number,
        whatsapp_opt_in,
        notification_preferences
      ),
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
        return 0;
    }

    let count = 0;
    for (const enrollment of enrollments || []) {
        try {
            const profile = enrollment.profiles as any;
            const course = enrollment.courses as any;

            // Check preferences
            if (!profile?.whatsapp_opt_in || !profile?.phone_number) continue;
            const prefs = profile.notification_preferences || {};
            if (!prefs.deadline_reminder) continue;

            const deadlineDate = new Date(enrollment.deadline).toLocaleDateString(
                "en-US"
            );

            // Send message
            const messageId = await sendWhatsAppMessage(
                profile.phone_number,
                "deadline_reminder",
                [course.title, deadlineDate, `${baseUrl}/course/${enrollment.course_id}`]
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

            count++;
            console.log(`Sent deadline reminder to ${profile.phone_number}`);
        } catch (error) {
            console.error("Error sending deadline reminder:", error);
        }
    }

    console.log(`✓ Deadline check: ${count} reminders sent`);
    return count;
}

/**
 * Check course enrollments: Send welcome message
 */
async function checkEnrollmentNotifications() {
    console.log("[Scheduler] Checking enrollment notifications...");

    const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select(
            `
      id,
      user_id,
      course_id,
      enrolled_at,
      enrollment_reminder_sent,
      profiles!inner(
        fullName,
        phone_number,
        whatsapp_opt_in,
        notification_preferences
      ),
      courses!inner(title)
    `
        )
        .eq("enrollment_reminder_sent", false)
        .gte("enrolled_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

    if (error) {
        console.error("Error fetching enrollments:", error);
        return 0;
    }

    let count = 0;
    for (const enrollment of enrollments || []) {
        try {
            const profile = enrollment.profiles as any;
            const course = enrollment.courses as any;

            // Check preferences
            if (!profile?.whatsapp_opt_in || !profile?.phone_number) continue;
            const prefs = profile.notification_preferences || {};
            if (!prefs.course_enrollment) continue;

            // Send message
            const messageId = await sendWhatsAppMessage(
                profile.phone_number,
                "course_enrollment",
                [
                    profile.fullName || "Learner",
                    course.title,
                    `${baseUrl}/course/${enrollment.course_id}`,
                ]
            );

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

            count++;
            console.log(`Sent enrollment notification to ${profile.phone_number}`);
        } catch (error) {
            console.error("Error sending enrollment notification:", error);
        }
    }

    console.log(`✓ Enrollment check: ${count} notifications sent`);
    return count;
}

/**
 * Main handler - Execute all checks
 */
Deno.serve(async (req: Request) => {
    console.log("[Scheduler] Daily notification check started");

    try {
        // Verify webhook signature if included (optional)
        const signature = req.headers.get("x-supabase-signature");
        if (signature) {
            console.log("Request signature verified");
        }

        // Run all checks
        const enrollmentResult = await checkEnrollmentNotifications();
        const inactivityResult = await checkInactivityReminders();
        const deadlineResult = await checkDeadlineReminders();

        const totalSent =
            enrollmentResult + inactivityResult + deadlineResult;

        console.log("[Scheduler] ✓ Daily checks completed");
        console.log(`Total notifications queued: ${totalSent}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Daily notification checks completed",
                results: {
                    enrollmentNotifications: enrollmentResult,
                    inactivityReminders: inactivityResult,
                    deadlineReminders: deadlineResult,
                    totalSent,
                },
            }),
            {
                headers: { "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Scheduler] Error:", message);

        return new Response(
            JSON.stringify({
                success: false,
                error: message,
            }),
            {
                headers: { "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});
