/**
 * Supabase Edge Function: WhatsApp Webhook Receiver
 * Receives WhatsApp status updates and message events
 *
 * Deploy with:
 * supabase functions deploy whatsapp-webhook
 *
 * Set up webhook in Meta WhatsApp dashboard:
 * - Callback URL: https://[YOUR_SUPABASE_URL]/functions/v1/whatsapp-webhook
 * - Verify Token: Use WHATSAPP_VERIFY_TOKEN env variable
 */

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
