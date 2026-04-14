/**
 * Certificate Storage Image Cleanup Service
 * 
 * Manages certificate template images uploaded to Supabase Storage
 * - Lists all images in storage bucket
 * - Identifies which images are in use
 * - Finds and deletes orphaned images
 */

import { createClient } from "@supabase/supabase-js";

interface StorageImage {
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
}

interface ImageUsageStatus {
    path: string;
    name: string;
    inUse: boolean;
    usedBy?: string[]; // References (rule IDs, template IDs, etc.)
    size: number;
    created_at: string;
}

class CertificateStorageService {
    private supabase;
    private readonly SIGNATURES_BUCKET = "signature-images";
    private readonly CERTIFICATES_BUCKET = "certificate-templates";

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || "";
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
            );
        }

        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    /**
     * List all images in signature storage bucket
     */
    async listSignatureImages(): Promise<StorageImage[]> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.SIGNATURES_BUCKET)
                .list("", {
                    limit: 1000,
                    offset: 0,
                    sortBy: {
                        column: "created_at",
                        order: "desc",
                    },
                });

            if (error) throw error;

            return (data || []).map((file: any) => ({
                name: file.name,
                path: `${this.SIGNATURES_BUCKET}/${file.name}`,
                size: file.metadata?.size || 0,
                created_at: file.created_at,
                updated_at: file.updated_at,
            }));
        } catch (error) {
            console.error(
                "[CertificateStorageService] Error listing signature images:",
                error
            );
            throw error;
        }
    }

    /**
     * List all images in certificate templates bucket
     */
    async listCertificateImages(): Promise<StorageImage[]> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.CERTIFICATES_BUCKET)
                .list("", {
                    limit: 1000,
                    offset: 0,
                    sortBy: {
                        column: "created_at",
                        order: "desc",
                    },
                });

            if (error) throw error;

            return (data || []).map((file: any) => ({
                name: file.name,
                path: `${this.CERTIFICATES_BUCKET}/${file.name}`,
                size: file.metadata?.size || 0,
                created_at: file.created_at,
                updated_at: file.updated_at,
            }));
        } catch (error) {
            console.error(
                "[CertificateStorageService] Error listing certificate images:",
                error
            );
            throw error;
        }
    }

    /**
     * Get all signature images and their usage status
     */
    async getSignatureImageUsageStatus(): Promise<ImageUsageStatus[]> {
        try {
            const storageImages = await this.listSignatureImages();

            // Get all signatures from database
            const { data: signatures, error: sigError } = await this.supabase
                .from("certificate_signatures")
                .select("id, signature_image_url");

            if (sigError) throw sigError;

            // Get all auto-send rule images
            const { data: rules, error: rulesError } = await this.supabase
                .from("notification_auto_send_rules")
                .select("id, image_url");

            if (rulesError) throw rulesError;

            // Extract used URLs
            const usedUrls = new Set<string>();
            const urlToReferences: Map<string, string[]> = new Map();

            // Add signature image URLs
            (signatures || []).forEach((sig: any) => {
                if (sig.signature_image_url) {
                    usedUrls.add(sig.signature_image_url);
                    const refs = urlToReferences.get(sig.signature_image_url) || [];
                    refs.push(`signature:${sig.id}`);
                    urlToReferences.set(sig.signature_image_url, refs);
                }
            });

            // Add rule image URLs
            (rules || []).forEach((rule: any) => {
                if (rule.image_url) {
                    usedUrls.add(rule.image_url);
                    const refs = urlToReferences.get(rule.image_url) || [];
                    refs.push(`rule:${rule.id}`);
                    urlToReferences.set(rule.image_url, refs);
                }
            });

            // Create usage status for each storage image
            return storageImages.map((img) => ({
                path: img.path,
                name: img.name,
                inUse: usedUrls.has(img.path) || usedUrls.has(img.name),
                usedBy: urlToReferences.get(img.path) || urlToReferences.get(img.name),
                size: img.size,
                created_at: img.created_at,
            }));
        } catch (error) {
            console.error(
                "[CertificateStorageService] Error getting signature image usage:",
                error
            );
            throw error;
        }
    }

    /**
     * Get orphaned/unused images
     */
    async getOrphanedSignatureImages(): Promise<ImageUsageStatus[]> {
        try {
            const allImages = await this.getSignatureImageUsageStatus();
            return allImages.filter((img) => !img.inUse);
        } catch (error) {
            console.error(
                "[CertificateStorageService] Error getting orphaned images:",
                error
            );
            throw error;
        }
    }

    /**
     * Delete unused/orphaned signature image
     */
    async deleteOrphanedImage(imageName: string): Promise<{ success: boolean; message: string }> {
        try {
            // Verify it's not in use
            const usage = await this.getSignatureImageUsageStatus();
            const imageUsage = usage.find(
                (img) => img.name === imageName || img.path.endsWith(imageName)
            );

            if (imageUsage && imageUsage.inUse) {
                return {
                    success: false,
                    message: `Image is in use by: ${imageUsage.usedBy?.join(", ")}`,
                };
            }

            // Delete from storage
            const { error } = await this.supabase.storage
                .from(this.SIGNATURES_BUCKET)
                .remove([imageName]);

            if (error) throw error;

            console.log(
                `[CertificateStorageService] Deleted orphaned image: ${imageName}`
            );
            return {
                success: true,
                message: `Successfully deleted ${imageName}`,
            };
        } catch (error) {
            console.error(
                "[CertificateStorageService] Error deleting orphaned image:",
                error
            );
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Bulk delete unused images
     */
    async deleteOrphanedImages(imageNames: string[]): Promise<{
        success: number;
        failed: number;
        errors: string[];
    }> {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        try {
            // Verify none are in use
            const usage = await this.getSignatureImageUsageStatus();
            const inUseNames = usage
                .filter((img) => img.inUse)
                .flatMap((img) => [img.name, ...img.usedBy || []])
                .flat();

            const namesToDelete = imageNames.filter(
                (name) => !inUseNames.includes(name)
            );

            if (namesToDelete.length === 0) {
                return { success: 0, failed: imageNames.length, errors: ["All images are in use"] };
            }

            // Delete from storage
            const { error } = await this.supabase.storage
                .from(this.SIGNATURES_BUCKET)
                .remove(namesToDelete);

            if (error) {
                throw error;
            }

            success = namesToDelete.length;
            console.log(
                `[CertificateStorageService] Bulk deleted ${success} orphaned images`
            );
        } catch (error) {
            const errorMsg =
                error instanceof Error ? error.message : String(error);
            errors.push(errorMsg);
            failed = imageNames.length - success;
            console.error(
                "[CertificateStorageService] Error in bulk delete:",
                error
            );
        }

        return { success, failed, errors };
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats(): Promise<{
        totalImages: number;
        totalSize: number;
        inUseImages: number;
        orphanedImages: number;
        orphanedSize: number;
    }> {
        try {
            const usage = await this.getSignatureImageUsageStatus();

            const totalImages = usage.length;
            const totalSize = usage.reduce((sum, img) => sum + img.size, 0);
            const inUseImages = usage.filter((img) => img.inUse).length;
            const orphanedImages = totalImages - inUseImages;
            const orphanedSize = usage
                .filter((img) => !img.inUse)
                .reduce((sum, img) => sum + img.size, 0);

            return {
                totalImages,
                totalSize,
                inUseImages,
                orphanedImages,
                orphanedSize,
            };
        } catch (error) {
            console.error(
                "[CertificateStorageService] Error getting storage stats:",
                error
            );
            throw error;
        }
    }

    /**
     * Clean up all orphaned images
     */
    async cleanupAllOrphanedImages(): Promise<{
        deleted: number;
        failed: number;
        spaceSaved: number;
    }> {
        try {
            const orphaned = await this.getOrphanedSignatureImages();
            const orphanedNames = orphaned.map((img) => img.name);

            if (orphanedNames.length === 0) {
                console.log("[CertificateStorageService] No orphaned images to clean up");
                return { deleted: 0, failed: 0, spaceSaved: 0 };
            }

            const result = await this.deleteOrphanedImages(orphanedNames);
            const spaceSaved = orphaned
                .slice(0, result.success)
                .reduce((sum, img) => sum + img.size, 0);

            return {
                deleted: result.success,
                failed: result.failed,
                spaceSaved,
            };
        } catch (error) {
            console.error(
                "[CertificateStorageService] Error in cleanup all:",
                error
            );
            throw error;
        }
    }
}

export default CertificateStorageService;

// Export singleton instance
export const certificateStorageService = new CertificateStorageService();
