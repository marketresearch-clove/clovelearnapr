-- Create function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create certificate_templates table for image-based certificates
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  background_image_url TEXT NOT NULL,
  placeholder_config JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_active BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  width INTEGER DEFAULT 3125,
  height INTEGER DEFAULT 2209,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Add template_id to certificates table
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES certificate_templates(id);

-- Add template_id to courses table to allow per-course templates
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES certificate_templates(id);

-- Enable RLS
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certificate_templates
-- Public Read for Active Templates
DO $$ BEGIN
    CREATE POLICY "Public Read for Active Templates"
    ON certificate_templates
    FOR SELECT
    USING (is_active = true OR (auth.role() = 'authenticated' AND (
        SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admin All Access"
    ON certificate_templates
    FOR ALL
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_certificate_templates_updated_at ON certificate_templates;
CREATE TRIGGER update_certificate_templates_updated_at
BEFORE UPDATE ON certificate_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON certificate_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_certificates_template_id ON certificates(template_id);
CREATE INDEX IF NOT EXISTS idx_courses_template_id ON courses(template_id);

-- Storage configuration for certificate templates
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificate-templates', 'certificate-templates', true, 52428800, '{image/png,image/jpeg,image/jpg,image/webp}')
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies
DO $$ BEGIN
    CREATE POLICY "Public Template Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'certificate-templates');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins Manage Templates"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'certificate-templates' 
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
