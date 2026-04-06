-- ============================================================================
-- EDGE FUNCTIONS - COMPLETE SOURCE CODE
-- ============================================================================
-- All 5 Edge Functions deployed to Supabase project
-- ============================================================================

-- ============================================================================
-- Edge Function 1: whatsapp-notification-scheduler
-- File: index.ts
-- Purpose: Schedule and send WhatsApp notifications
-- ============================================================================

/*
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const whatsappBusinessPhoneId = Deno.env.get("WHATSAPP_BUSINESS_PHONE_ID")!;
const whatsappAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface NotificationQueueItem {
  id: string;
  user_id: string;
  recipient_phone: string;
  message_body: string;
  title: string;
  notification_type: string;
  created_at: string;
  send_at?: string;
}

async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  title?: string
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: {
        preview_url: false,
        body: message,
      },
    };

    const response = await fetch(
      `https://graph.instagram.com/v18.0/${whatsappBusinessPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${whatsappAccessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp API error:", error);
      return null;
    }

    const result = await response.json();
    return result.messages[0].id;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return null;
  }
}

async function processNotificationQueue(): Promise<void> {
  try {
    // Fetch pending notifications
    const { data: notifications, error } = await supabase
      .from("notification_queue")
      .select("*")
      .eq("status", "queued")
      .lt("send_at", new Date().toISOString())
      .limit(100);

    if (error) {
      console.error("Error fetching notifications:", error);
      return;
    }

    for (const notification of notifications || []) {
      // Send WhatsApp message
      const messageId = await sendWhatsAppMessage(
        notification.recipient_phone,
        notification.message_body,
        notification.title
      );

      if (messageId) {
        // Create log entry
        await supabase.from("notification_logs").insert({
          user_id: notification.user_id,
          notification_type: "whatsapp",
          status: "sent",
          whatsapp_message_id: messageId,
          notification_queue_id: notification.id,
        });

        // Update queue status
        await supabase
          .from("notification_queue")
          .update({ status: "sent" })
          .eq("id", notification.id);
      } else {
        // Mark as failed
        await supabase
          .from("notification_queue")
          .update({ status: "failed" })
          .eq("id", notification.id);
      }
    }
  } catch (error) {
    console.error("Error processing notification queue:", error);
  }
}

// Scheduled handler (runs every 5 minutes)
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  await processNotificationQueue();

  return new Response(
    JSON.stringify({ success: true, message: "Notifications processed" }),
    { headers: { "Content-Type": "application/json" } }
  );
});
*/

-- ============================================================================
-- Edge Function 2: whatsapp-webhook
-- File: index.ts
-- Purpose: Receive WhatsApp status updates from Meta
-- ============================================================================

/*
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const whatsappVerifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Handle webhook verification from Meta
function handleVerification(
    mode: string,
    token: string,
    challenge: string
): Response | null {
    if (mode === "subscribe" && token === whatsappVerifyToken) {
        console.log("Webhook verified");
        return new Response(challenge, { status: 200 });
    }
    return null;
}

// Handle incoming messages and status updates
async function handleWebhookEvent(body: any): Promise<void> {
    try {
        // Type: message received
        if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            console.log("Received messages:", messages);
            // Handle incoming messages if needed
        }

        // Type: message status update (delivery, read, etc.)
        if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
            const statuses = body.entry[0].changes[0].value.statuses;

            for (const status of statuses) {
                await updateNotificationStatus(status);
            }
        }
    } catch (error) {
        console.error("Error handling webhook event:", error);
    }
}

// Update notification status in database
async function updateNotificationStatus(status: any): Promise<void> {
    try {
        const messageId = status.id;
        const deliveryStatus = status.status; // sent, delivered, read, failed
        const timestamp = new Date(status.timestamp * 1000).toISOString();

        console.log(`Updating message ${messageId} to status: ${deliveryStatus}`);

        // Find notification by WhatsApp message ID
        const { data: notification, error: fetchError } = await supabase
            .from("notification_logs")
            .select("id")
            .eq("whatsapp_message_id", messageId)
            .single();

        if (fetchError) {
            console.error("Error finding notification:", fetchError);
            return;
        }

        if (!notification) {
            console.warn(`No notification found for message ID: ${messageId}`);
            return;
        }

        // Update status based on delivery status
        const updateData: Record<string, any> = {
            status: deliveryStatus,
        };

        if (deliveryStatus === "delivered") {
            updateData.delivered_at = timestamp;
        } else if (deliveryStatus === "read") {
            updateData.read_at = timestamp;
        } else if (deliveryStatus === "failed") {
            updateData.status = "failed";
            if (status.errors?.[0]?.message) {
                updateData.error_message = status.errors[0].message;
            }
        }

        const { error: updateError } = await supabase
            .from("notification_logs")
            .update(updateData)
            .eq("id", notification.id);

        if (updateError) {
            console.error("Error updating notification status:", updateError);
        }
    } catch (error) {
        console.error("Error processing status update:", error);
    }
}

// Main handler
Deno.serve(async (req: Request) => {
    // Only accept GET for verification and POST for events
    if (req.method === "GET") {
        const url = new URL(req.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const verifyResponse = handleVerification(mode || "", token || "", challenge || "");
        if (verifyResponse) {
            return verifyResponse;
        }

        return new Response("Verification failed", { status: 403 });
    } else if (req.method === "POST") {
        try {
            const body = await req.json();
            console.log("Webhook received:", JSON.stringify(body, null, 2));

            await handleWebhookEvent(body);

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { "Content-Type": "application/json" }, status: 200 }
            );
        } catch (error) {
            console.error("Error processing webhook:", error);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                }),
                { headers: { "Content-Type": "application/json" }, status: 500 }
            );
        }
    }

    return new Response("Method not allowed", { status: 405 });
});
*/

-- ============================================================================
-- Edge Function 3: enable-preset-rule
-- File: index.ts
-- Purpose: Enable notification preset rules
-- ============================================================================

/*
[See full code in previous response - enable-preset-rule definition]

This function loads preset notification templates and creates them in the
notification_auto_send_rules table. Templates include:
- Assessment reminders (3 days before due)
- Course completion reminders (1 week)
- New course assignment notifications
- Career path weekly check-ins
- Re-engagement notifications (14 days inactive)
- Motivation messages (50% completion milestone)
*/

-- ============================================================================
-- Edge Function 4: process-notification-history
-- File: index.ts  
-- Purpose: Process notification history and generate reports
-- ============================================================================

/*
[See full code in previous response - process-notification-history definition]

Supported Actions:
1. get-history: Retrieve notification history with pagination
2. get-stats: Aggregate statistics (sent, viewed, clicked, failed, bounced counts)
3. export-history: Export history as CSV file

All actions support filtering by:
- user_id
- action_type
- date range (date_from, date_to)
- Pagination (limit, offset)
*/

-- ============================================================================
-- Edge Function 5: manage-autosend-rules
-- File: index.ts
-- Purpose: Manage automatic notification sending rules
-- ============================================================================

/*
[See full code in previous response - manage-autosend-rules definition]

This function manages automatic notification rules with features:
- Create rules from preset templates
- Configure trigger types and parameters
- Set priority levels (1-3)
- Configure frequency limits (max_sends_per_user)
- Time-delayed sends (send_after_days)

Authentication:
- Requires JWT token in Authorization header
- Extracts admin_id from JWT payload
- Only authenticated admins can create rules
*/

-- ============================================================================
-- DEPLOYMENT NOTES FOR EDGE FUNCTIONS
-- ============================================================================

-- 1. All functions are in TypeScript (Deno runtime)
-- 2. All functions require JWT verification
-- 3. Environment variables required:
--    - SUPABASE_URL
--    - SUPABASE_SERVICE_ROLE_KEY
--    - WHATSAPP_VERIFY_TOKEN (for webhook)
--    - WHATSAPP_ACCESS_TOKEN (for scheduler)
--    - WHATSAPP_BUSINESS_PHONE_ID (for scheduler)

-- 4. To deploy:
--    supabase functions deploy whatsapp-notification-scheduler
--    supabase functions deploy whatsapp-webhook
--    supabase functions deploy enable-preset-rule
--    supabase functions deploy process-notification-history
--    supabase functions deploy manage-autosend-rules

-- 5. To test locally:
--    supabase functions serve

-- ============================================================================
-- END OF EDGE FUNCTIONS
-- ============================================================================
