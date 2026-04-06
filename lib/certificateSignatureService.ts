/**
 * Certificate Signature Settings Service
 * Manages certificate signatures with dynamic enable/disable based on designation
 */

import { supabase } from './supabaseClient';

export interface CertificateSignature {
    id: string;
    name: string;
    designation: string;
    signature_image_url?: string;
    signature_text?: string;
    is_enabled: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
    created_by?: string;
}

export interface CreateSignatureRequest {
    name: string;
    designation: string;
    signature_image_url?: string;
    signature_text?: string;
    is_enabled?: boolean;
    display_order?: number;
}

export interface UpdateSignatureRequest extends Partial<CreateSignatureRequest> {
    id: string;
}

/**
 * Fetch all certificate signatures ordered by display_order
 */
export const getAllSignatures = async (): Promise<CertificateSignature[]> => {
    try {
        const { data, error } = await supabase
            .from('certificate_signature_settings')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching signatures:', error);
        throw error;
    }
};

/**
 * Fetch only enabled signatures
 */
export const getEnabledSignatures = async (): Promise<CertificateSignature[]> => {
    try {
        const { data, error } = await supabase
            .from('certificate_signature_settings')
            .select('*')
            .eq('is_enabled', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching enabled signatures:', error);
        throw error;
    }
};

/**
 * Fetch signature by designation
 */
export const getSignatureByDesignation = async (
    designation: string
): Promise<CertificateSignature | null> => {
    try {
        const { data, error } = await supabase
            .from('certificate_signature_settings')
            .select('*')
            .eq('designation', designation)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    } catch (error) {
        console.error('Error fetching signature by designation:', error);
        return null;
    }
};

/**
 * Create a new signature
 */
export const createSignature = async (
    signature: CreateSignatureRequest
): Promise<CertificateSignature> => {
    try {
        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('certificate_signature_settings')
            .insert({
                ...signature,
                is_enabled: signature.is_enabled ?? true,
                display_order: signature.display_order ?? 0,
                created_by: user?.id,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating signature:', error);
        throw error;
    }
};

/**
 * Update an existing signature
 */
export const updateSignature = async (
    request: UpdateSignatureRequest
): Promise<CertificateSignature> => {
    try {
        const { id, ...updateData } = request;

        const { data, error } = await supabase
            .from('certificate_signature_settings')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating signature:', error);
        throw error;
    }
};

/**
 * Toggle signature enabled/disabled status
 */
export const toggleSignatureStatus = async (
    id: string,
    isEnabled: boolean
): Promise<CertificateSignature> => {
    try {
        const { data, error } = await supabase
            .from('certificate_signature_settings')
            .update({
                is_enabled: isEnabled,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error toggling signature status:', error);
        throw error;
    }
};

/**
 * Delete a signature
 */
export const deleteSignature = async (id: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('certificate_signature_settings')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting signature:', error);
        throw error;
    }
};

/**
 * Reorder signatures (update display_order for multiple signatures)
 */
export const reorderSignatures = async (
    updates: Array<{ id: string; display_order: number }>
): Promise<void> => {
    try {
        for (const update of updates) {
            const { error } = await supabase
                .from('certificate_signature_settings')
                .update({
                    display_order: update.display_order,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', update.id);

            if (error) throw error;
        }
    } catch (error) {
        console.error('Error reordering signatures:', error);
        throw error;
    }
};

/**
 * Upload signature image to storage
 */
export const uploadSignatureImage = async (
    file: File,
    designationName: string
): Promise<string> => {
    try {
        const fileName = `${designationName}-${Date.now()}.${file.type.split('/')[1]
            }`;
        const filePath = `certificate-signatures/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('Error uploading signature image:', error);
        throw error;
    }
};

/**
 * Delete signature image from storage
 */
export const deleteSignatureImage = async (imageUrl: string): Promise<void> => {
    try {
        // Extract file path from URL
        const urlParts = imageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `certificate-signatures/${fileName}`;

        const { error } = await supabase.storage
            .from('documents')
            .remove([filePath]);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting signature image:', error);
        throw error;
    }
};
