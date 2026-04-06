/**
 * WhatsApp Service Layer
 * Handles all WhatsApp API integrations with Meta Cloud API
 */

import fetch from "node-fetch";

interface WhatsAppTemplate {
    name: string;
    language: string;
    components: WhatsAppComponent[];
}

interface WhatsAppComponent {
    type: "body";
    parameters: WhatsAppParameter[];
}

interface WhatsAppParameter {
    type: "text";
    text: string;
}

interface WhatsAppMessage {
    messaging_product: "whatsapp";
    to: string;
    type: "template" | "text";
    template?: WhatsAppTemplate;
    text?: {
        body: string;
    };
}

interface WhatsAppResponse {
    messages: Array<{
        id: string;
    }>;
    contacts: Array<{
        input: string;
        wa_id: string;
    }>;
}

class WhatsAppService {
    private apiVersion: string = "v18.0";
    private baseUrl: string = "https://graph.facebook.com";
    private phoneNumberId: string;
    private accessToken: string;

    constructor(phoneNumberId?: string, accessToken?: string) {
        this.phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
        this.accessToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";

        if (!this.phoneNumberId || !this.accessToken) {
            throw new Error(
                "WhatsApp service requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN environment variables"
            );
        }
    }

    /**
     * Send a template-based message
     * @param recipientPhone - Recipient's WhatsApp phone number (with country code)
     * @param templateName - Name of the approved WhatsApp template
     * @param parameters - Array of parameter values for the template
     * @returns Promise with WhatsApp message ID
     */
    async sendTemplateMessage(
        recipientPhone: string,
        templateName: string,
        parameters: string[]
    ): Promise<string> {
        const message: WhatsAppMessage = {
            messaging_product: "whatsapp",
            to: this.formatPhoneNumber(recipientPhone),
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

        return this.sendMessage(message);
    }

    /**
     * Send a text message (for development/testing)
     * Note: For production use template messages
     * @param recipientPhone - Recipient's WhatsApp phone number
     * @param messageText - Plain text message content
     * @returns Promise with WhatsApp message ID
     */
    async sendTextMessage(recipientPhone: string, messageText: string): Promise<string> {
        const message: WhatsAppMessage = {
            messaging_product: "whatsapp",
            to: this.formatPhoneNumber(recipientPhone),
            type: "text",
            text: {
                body: messageText,
            },
        };

        return this.sendMessage(message);
    }

    /**
     * Internal method to send message via WhatsApp API
     */
    private async sendMessage(message: WhatsAppMessage): Promise<string> {
        const url = `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.accessToken}`,
                },
                body: JSON.stringify(message),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    `WhatsApp API error: ${response.status} - ${JSON.stringify(errorData)}`
                );
            }

            const data: WhatsAppResponse = await response.json();

            if (!data.messages || data.messages.length === 0) {
                throw new Error("No message ID returned from WhatsApp API");
            }

            return data.messages[0].id;
        } catch (error) {
            console.error("Error sending WhatsApp message:", error);
            throw error;
        }
    }

    /**
     * Format phone number to WhatsApp format
     * Ensures country code prefix (e.g., 91 for India, 1 for US)
     */
    private formatPhoneNumber(phone: string): string {
        // Remove any non-digit characters
        let cleaned = phone.replace(/\D/g, "");

        // If doesn't start with country code, assume it needs one
        // This is a basic implementation - adjust based on your needs
        if (!cleaned.startsWith("1") && cleaned.length === 10) {
            // Assume US number starting with 10 digits
            cleaned = "1" + cleaned;
        }

        return cleaned;
    }

    /**
     * Verify webhook signature (for receiving webhook events from WhatsApp)
     */
    verifyWebhookSignature(
        payload: string,
        signature: string,
        verifyToken: string
    ): boolean {
        const crypto = require("crypto");
        const expectedSignature = crypto
            .createHmac("sha256", verifyToken)
            .update(payload)
            .digest("hex");

        return signature === expectedSignature;
    }

    /**
     * Test connection to WhatsApp API
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(
                `${this.baseUrl}/${this.apiVersion}/me?fields=id,name`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                    },
                }
            );

            return response.ok;
        } catch (error) {
            console.error("WhatsApp connection test failed:", error);
            return false;
        }
    }
}

export default WhatsAppService;
