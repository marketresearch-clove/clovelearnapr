-- Add snapshot columns to certificate_signatures for historical accuracy
-- When a signature is edited, old certificates should keep the original values

ALTER TABLE public.certificate_signatures
ADD COLUMN IF NOT EXISTS signature_name TEXT;

ALTER TABLE public.certificate_signatures
ADD COLUMN IF NOT EXISTS signature_designation TEXT;

ALTER TABLE public.certificate_signatures
ADD COLUMN IF NOT EXISTS signature_text TEXT;

ALTER TABLE public.certificate_signatures
ADD COLUMN IF NOT EXISTS signature_image_url TEXT;

-- Add comments
COMMENT ON COLUMN public.certificate_signatures.signature_name IS
    'Snapshot of signature name at time of certificate issuance (for historical accuracy)';
COMMENT ON COLUMN public.certificate_signatures.signature_designation IS
    'Snapshot of signature designation at time of certificate issuance (prevents changes from affecting old certs)';
COMMENT ON COLUMN public.certificate_signatures.signature_text IS
    'Snapshot of signature text at time of certificate issuance';
COMMENT ON COLUMN public.certificate_signatures.signature_image_url IS
    'Snapshot of signature image URL at time of certificate issuance';
