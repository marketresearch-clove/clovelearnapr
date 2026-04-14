/**
 * API Routes for Certificate Storage Management
 * 
 * Endpoints:
 * - GET /api/certificate-storage/stats - Get storage usage statistics
 * - POST /api/certificate-storage/delete - Delete single orphaned image
 * - POST /api/certificate-storage/delete-bulk - Bulk delete orphaned images
 * - POST /api/certificate-storage/cleanup - Cleanup all orphaned images
 */

import { createClient } from "@supabase/supabase-js";
import { NextApiRequest, NextApiResponse } from "next";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Get storage statistics and orphaned images
 */
export async function getStorageStats(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // Get all signature images from storage
        const { data: storageFiles, error: listError } = await supabase.storage
            .from("signature-images")
            .list("", { limit: 1000 });

        if (listError) throw listError;

        // Get all signatures
        const { data: signatures, error: sigError } = await supabase
            .from("certificate_signatures")
            .select("signature_image_url");

        if (sigError) throw sigError;

        // Get all rules with images
        const { data: rules, error: rulesError } = await supabase
            .from("notification_auto_send_rules")
            .select("image_url");

        if (rulesError) throw rulesError;

        // Collect in-use URLs
        const inUseUrls = new Set<string>();
        const urlToReferences: Map<string, string[]> = new Map();

        (signatures || []).forEach((sig: any) => {
            if (sig.signature_image_url) {
                inUseUrls.add(sig.signature_image_url);
                const refs = urlToReferences.get(sig.signature_image_url) || [];
                refs.push(`signature:${sig.id}`);
                urlToReferences.set(sig.signature_image_url, refs);
            }
        });

        (rules || []).forEach((rule: any) => {
            if (rule.image_url) {
                inUseUrls.add(rule.image_url);
                const refs = urlToReferences.get(rule.image_url) || [];
                refs.push(`rule:${rule.id}`);
                urlToReferences.set(rule.image_url, refs);
            }
        });

        // Calculate stats
        let totalSize = 0;
        let inUseCount = 0;
        let orphanedSize = 0;
        const orphanedImages = [];

        (storageFiles || []).forEach((file: any) => {
            const fileSize = file.metadata?.size || 0;
            totalSize += fileSize;

            const isInUse = inUseUrls.has(file.name) ||
                inUseUrls.has(`signature-images/${file.name}`);

            if (isInUse) {
                inUseCount++;
            } else {
                orphanedSize += fileSize;
                orphanedImages.push({
                    name: file.name,
                    path: `signature-images/${file.name}`,
                    size: fileSize,
                    created_at: file.created_at,
                    inUse: false,
                });
            }
        });

        const stats = {
            totalImages: storageFiles?.length || 0,
            totalSize,
            inUseImages: inUseCount,
            orphanedImages: (storageFiles?.length || 0) - inUseCount,
            orphanedSize,
        };

        return res.status(200).json({ stats, orphaned: orphanedImages });
    } catch (error) {
        console.error("[CertificateStorage] Error getting stats:", error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to get stats",
        });
    }
}

/**
 * Delete single orphaned image
 */
export async function deleteImage(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { imageName } = req.body;

        if (!imageName) {
            return res.status(400).json({ error: "Image name required" });
        }

        // Verify it's not in use
        const { data: signatures } = await supabase
            .from("certificate_signatures")
            .select("signature_image_url")
            .eq("signature_image_url", imageName)
            .limit(1);

        if (signatures && signatures.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Image is in use by a certificate signature",
            });
        }

        // Delete from storage
        const { error } = await supabase.storage
            .from("signature-images")
            .remove([imageName]);

        if (error) throw error;

        return res.status(200).json({
            success: true,
            message: `Successfully deleted ${imageName}`,
        });
    } catch (error) {
        console.error("[CertificateStorage] Error deleting image:", error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete image",
        });
    }
}

/**
 * Bulk delete orphaned images
 */
export async function deleteImagesBulk(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { imageNames } = req.body;

        if (!Array.isArray(imageNames) || imageNames.length === 0) {
            return res.status(400).json({ error: "Image names array required" });
        }

        // Verify none are in use
        const { data: signatures } = await supabase
            .from("certificate_signatures")
            .select("signature_image_url")
            .in("signature_image_url", imageNames);

        if (signatures && signatures.length > 0) {
            const inUseImages = signatures.map((s: any) => s.signature_image_url);
            return res
                .status(400)
                .json({ success: false, inUseImages, total: imageNames.length });
        }

        // Delete from storage
        const { error } = await supabase.storage
            .from("signature-images")
            .remove(imageNames);

        if (error) throw error;

        return res.status(200).json({
            success: true,
            deleted: imageNames.length,
            failed: 0,
            errors: [],
        });
    } catch (error) {
        console.error("[CertificateStorage] Error bulk deleting images:", error);
        return res.status(500).json({
            success: false,
            deleted: 0,
            failed: (req.body.imageNames || []).length,
            errors: [
                error instanceof Error ? error.message : "Failed to delete images",
            ],
        });
    }
}

/**
 * Cleanup all orphaned images
 */
export async function cleanupAllOrphaned(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // Get all storage files
        const { data: storageFiles, error: listError } = await supabase.storage
            .from("signature-images")
            .list("", { limit: 1000 });

        if (listError) throw listError;

        // Get in-use images
        const { data: signatures } = await supabase
            .from("certificate_signatures")
            .select("signature_image_url");

        const inUseUrls = new Set<string>();
        (signatures || []).forEach((sig: any) => {
            if (sig.signature_image_url) {
                inUseUrls.add(sig.signature_image_url);
            }
        });

        // Find orphaned images
        const orphanedNames = (storageFiles || [])
            .filter((f: any) => !inUseUrls.has(f.name))
            .map((f: any) => f.name);

        if (orphanedNames.length === 0) {
            return res
                .status(200)
                .json({ deleted: 0, failed: 0, spaceSaved: 0, message: "No orphaned images" });
        }

        // Delete orphaned images
        const { error } = await supabase.storage
            .from("signature-images")
            .remove(orphanedNames);

        if (error) throw error;

        // Calculate space saved
        const spaceSaved = (storageFiles || [])
            .filter((f: any) => orphanedNames.includes(f.name))
            .reduce((sum: number, f: any) => sum + (f.metadata?.size || 0), 0);

        console.log(
            `[CertificateStorage] Cleanup completed: deleted ${orphanedNames.length} images, saved ${spaceSaved} bytes`
        );

        return res
            .status(200)
            .json({ deleted: orphanedNames.length, failed: 0, spaceSaved });
    } catch (error) {
        console.error("[CertificateStorage] Error cleaning up orphaned images:", error);
        return res.status(500).json({
            deleted: 0,
            failed: 1,
            spaceSaved: 0,
            error: error instanceof Error ? error.message : "Cleanup failed",
        });
    }
}

// Main API handler
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { action } = req.query;

    switch (action) {
        case "stats":
            return getStorageStats(req, res);
        case "delete":
            return deleteImage(req, res);
        case "delete-bulk":
            return deleteImagesBulk(req, res);
        case "cleanup":
            return cleanupAllOrphaned(req, res);
        default:
            return res.status(400).json({ error: "Unknown action" });
    }
}
