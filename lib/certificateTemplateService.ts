/**
 * Certificate Template Service
 * Manages image-based certificate templates and placeholder mappings
 */

import { supabase } from './supabaseClient';

export interface PlaceholderConfig {
  id: string;
  name: string;
  type: 'text' | 'image' | 'signature';
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: string;
  maxWidth?: number;
  maxHeight?: number;
  opacity?: number;
}

export interface CertificateTemplate {
  id: string;
  template_name: string;
  description?: string;
  background_image_url: string;
  placeholder_config: PlaceholderConfig[];
  is_active: boolean;
  display_order: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateTemplateRequest {
  template_name: string;
  description?: string;
  background_image_url: string;
  placeholder_config: PlaceholderConfig[];
  is_active?: boolean;
  display_order?: number;
  width?: number;
  height?: number;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  id: string;
}

/**
 * Fetch all certificate templates ordered by display_order
 */
export const getAllTemplates = async (): Promise<CertificateTemplate[]> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

/**
 * Fetch only active templates
 */
export const getActiveTemplates = async (): Promise<CertificateTemplate[]> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active templates:', error);
    throw error;
  }
};

/**
 * Get the primary active template
 */
export const getDefaultTemplate = async (): Promise<CertificateTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching default template:', error);
    return null;
  }
};

/**
 * Get template by ID
 */
export const getTemplateById = async (id: string): Promise<CertificateTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching template by ID:', error);
    return null;
  }
};

/**
 * Create a new template
 */
export const createTemplate = async (
  template: CreateTemplateRequest
): Promise<CertificateTemplate> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('certificate_templates')
      .insert({
        ...template,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
};

/**
 * Update an existing template
 */
export const updateTemplate = async (
  request: UpdateTemplateRequest
): Promise<CertificateTemplate> => {
  try {
    const { id, ...updateData } = request;

    const { data, error } = await supabase
      .from('certificate_templates')
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
    console.error('Error updating template:', error);
    throw error;
  }
};

/**
 * Delete a template
 */
export const deleteTemplate = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('certificate_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

/**
 * Upload template background image to storage
 */
export const uploadTemplateImage = async (
  file: File,
  templateName: string
): Promise<string> => {
  try {
    const fileExt = file.type.split('/')[1] || 'png';
    const fileName = `${templateName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${fileExt}`;
    const filePath = fileName; // Upload directly to bucket root or specific folder

    const { error: uploadError } = await supabase.storage
      .from('certificate-templates')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('certificate-templates')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading template image:', error);
    throw error;
  }
};
