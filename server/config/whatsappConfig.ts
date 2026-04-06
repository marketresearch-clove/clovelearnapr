/**
 * WhatsApp Service Configuration
 * Centralized configuration management for the WhatsApp integration
 */

interface WhatsAppConfig {
    apiVersion: string;
    baseUrl: string;
    phoneNumberId: string;
    accessToken: string;
    verifyToken: string;
    businessAccountId?: string;
    defaultLanguage: string;
    timezone: string;
}

interface NotificationConfig {
    inactivityDays: number;
    deadlineReminderDays: number;
    maxRetryAttempts: number;
    queueProcessingBatchSize: number;
    rateLimitPerMinute: number;
}

interface LmsConfig {
    baseUrl: string;
    environment: "development" | "staging" | "production";
    logLevel: "debug" | "info" | "warning" | "error";
}

class WhatsAppConfigManager {
    private whatsappConfig: WhatsAppConfig;
    private notificationConfig: NotificationConfig;
    private lmsConfig: LmsConfig;

    constructor() {
        this.whatsappConfig = this.initWhatsAppConfig();
        this.notificationConfig = this.initNotificationConfig();
        this.lmsConfig = this.initLmsConfig();

        this.validate();
    }

    private initWhatsAppConfig(): WhatsAppConfig {
        return {
            apiVersion: process.env.WHATSAPP_API_VERSION || "v18.0",
            baseUrl: "https://graph.facebook.com",
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
            verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
            businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
            defaultLanguage: process.env.WHATSAPP_DEFAULT_LANGUAGE || "en_US",
            timezone: process.env.WHATSAPP_TIMEZONE || "UTC",
        };
    }

    private initNotificationConfig(): NotificationConfig {
        return {
            inactivityDays: parseInt(process.env.NOTIFICATION_INACTIVITY_DAYS || "3"),
            deadlineReminderDays: parseInt(process.env.NOTIFICATION_DEADLINE_REMINDER_DAYS || "2"),
            maxRetryAttempts: parseInt(process.env.NOTIFICATION_MAX_RETRY_ATTEMPTS || "3"),
            queueProcessingBatchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || "50"),
            rateLimitPerMinute: parseInt(process.env.NOTIFICATION_RATE_LIMIT || "60"),
        };
    }

    private initLmsConfig(): LmsConfig {
        return {
            baseUrl: process.env.LMS_BASE_URL || "http://localhost:5173",
            environment: (process.env.LMS_ENV as any) || "development",
            logLevel: (process.env.LOG_LEVEL as any) || "info",
        };
    }

    private validate(): void {
        const errors: string[] = [];

        // Check required fields
        if (!this.whatsappConfig.phoneNumberId) {
            errors.push("WHATSAPP_PHONE_NUMBER_ID is required");
        }
        if (!this.whatsappConfig.accessToken) {
            errors.push("WHATSAPP_ACCESS_TOKEN is required");
        }
        if (!this.whatsappConfig.verifyToken) {
            errors.push("WHATSAPP_VERIFY_TOKEN is required");
        }
        if (!this.lmsConfig.baseUrl) {
            errors.push("LMS_BASE_URL is required");
        }

        if (errors.length > 0) {
            console.error("WhatsApp Configuration Errors:");
            errors.forEach((error) => console.error(`  ✗ ${error}`));
            throw new Error("WhatsApp configuration validation failed");
        }
    }

    /**
     * Get WhatsApp configuration
     */
    getWhatsAppConfig(): WhatsAppConfig {
        return { ...this.whatsappConfig };
    }

    /**
     * Get notification configuration
     */
    getNotificationConfig(): NotificationConfig {
        return { ...this.notificationConfig };
    }

    /**
     * Get LMS configuration
     */
    getLmsConfig(): LmsConfig {
        return { ...this.lmsConfig };
    }

    /**
     * Get all configuration
     */
    getAllConfig() {
        return {
            whatsapp: this.getWhatsAppConfig(),
            notification: this.getNotificationConfig(),
            lms: this.getLmsConfig(),
        };
    }

    /**
     * Print configuration (without sensitive data)
     */
    printSafeConfig(): void {
        const config = {
            whatsapp: {
                ...this.whatsappConfig,
                accessToken: this.whatsappConfig.accessToken.substring(0, 10) + "...",
                verifyToken: this.whatsappConfig.verifyToken.substring(0, 10) + "...",
            },
            notification: this.notificationConfig,
            lms: this.lmsConfig,
        };

        console.log("WhatsApp Configuration:");
        console.table(config);
    }

    /**
     * Check if in development mode
     */
    isDevelopment(): boolean {
        return this.lmsConfig.environment === "development";
    }

    /**
     * Check if in production mode
     */
    isProduction(): boolean {
        return this.lmsConfig.environment === "production";
    }
}

export default new WhatsAppConfigManager();
