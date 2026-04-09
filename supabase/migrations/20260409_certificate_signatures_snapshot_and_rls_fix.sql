-- Add certificate signature snapshot columns and fix RLS policy for server-side inserts

-- Ensure signature snapshot columns exist on certificates
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS signature_ids UUID[] DEFAULT '{}'::uuid[];

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS signatures_data JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.certificates.signature_ids IS
  'Array of signature IDs that were linked to the certificate at issuance';
COMMENT ON COLUMN public.certificates.signatures_data IS
  'JSON snapshot of signature assignments (name, designation, text, image URL) at issuance';

-- Fix RLS policy for certificate_signatures to allow service role inserts
DROP POLICY IF EXISTS "Allow certificate signature inserts" ON public.certificate_signatures;

CREATE POLICY "Allow certificate signature inserts"
  ON public.certificate_signatures
  FOR INSERT
  WITH CHECK (
    CASE
      WHEN auth.uid() IS NOT NULL THEN
        certificate_id IN (
          SELECT id FROM public.certificates
          WHERE user_id = auth.uid()
        )
      ELSE true
    END
  );

-- Ensure admins and service_role can manage certificate_signatures if RLS is in effect
DROP POLICY IF EXISTS "Admins can manage all certificate signatures" ON public.certificate_signatures;
CREATE POLICY "Admins can manage all certificate signatures"
  ON public.certificate_signatures
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'service_role'
  );
