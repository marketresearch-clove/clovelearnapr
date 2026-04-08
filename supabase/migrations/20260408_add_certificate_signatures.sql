-- Link certificates and certificate_signature_settings tables
-- This ensures certificates maintain proper references to signatures used at time of issuance
-- Prevents old certificates from showing updated signature designations

-- 1. Create junction table for certificate-signature relationships
CREATE TABLE IF NOT EXISTS public.certificate_signatures (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL,
    signature_id UUID NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT certificate_signatures_pkey PRIMARY KEY (id),
    CONSTRAINT certificate_signatures_unique UNIQUE (certificate_id, signature_id),
    CONSTRAINT certificate_signatures_certificate_fkey FOREIGN KEY (certificate_id)
        REFERENCES certificates(id) ON DELETE CASCADE,
    CONSTRAINT certificate_signatures_signature_fkey FOREIGN KEY (signature_id)
        REFERENCES certificate_signature_settings(id) ON DELETE RESTRICT
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_certificate_signatures_certificate_id
    ON public.certificate_signatures(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificate_signatures_signature_id
    ON public.certificate_signatures(signature_id);
CREATE INDEX IF NOT EXISTS idx_certificate_signatures_order
    ON public.certificate_signatures(certificate_id, display_order);

-- 2. Update certificates table with updated_at column if needed
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS updated_at
    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for efficient certificate queries
CREATE INDEX IF NOT EXISTS idx_certificates_user_id
    ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id
    ON public.certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at
    ON public.certificates(issued_at DESC);

-- Add comments for clarity
COMMENT ON TABLE public.certificate_signatures IS
    'Junction table linking certificates to the signatures that were active when issued';
COMMENT ON COLUMN public.certificate_signatures.signature_id IS
    'Reference to the signature used in this certificate (maintains historical accuracy)';
COMMENT ON COLUMN public.certificates.updated_at IS
    'Timestamp when certificate was last updated';

-- 3. Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_certificates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS certificates_updated_at_trigger ON public.certificates;

CREATE TRIGGER certificates_updated_at_trigger
BEFORE UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.set_certificates_updated_at();

-- 4. Enable RLS for certificate_signatures
ALTER TABLE public.certificate_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certificate_signatures
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view signatures for their own certificates" ON public.certificate_signatures;
DROP POLICY IF EXISTS "Admins can manage all certificate signatures" ON public.certificate_signatures;
DROP POLICY IF EXISTS "Users can view signatures for their certificates" ON public.certificate_signatures;

-- Users can view signatures for their own certificates only
CREATE POLICY "Users can view signatures for their own certificates"
    ON public.certificate_signatures FOR SELECT
    USING (
        -- Only view signatures linked to their own certificates
        certificate_id IN (
            SELECT id FROM certificates
            WHERE user_id = auth.uid()
        )
    );

-- Admins can view and manage all certificate signatures
-- Uses JWT role claim instead of querying auth.users table
CREATE POLICY "Admins can manage all certificate signatures"
    ON public.certificate_signatures FOR ALL
    USING (
        -- Check if user has admin role in JWT token
        auth.jwt() ->> 'role' = 'admin'
    );

-- Add comment
COMMENT ON COLUMN public.certificate_signatures.display_order IS
    'Order in which signatures appear on the certificate (lower numbers first)';
