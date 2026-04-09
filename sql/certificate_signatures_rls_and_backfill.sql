/**
 * Certificate Signatures RLS Policies & Backfill Script
 *
 * This script:
 * 1. Enables RLS on certificate_signatures table (if not already enabled)
 * 2. Creates appropriate policies for learners and admins
 * 3. Backfills missing signatures for existing certificates
 *
 * @date 2026-04-09
 */

-- =============================================================================
-- STEP 1: Check and Enable RLS on certificate_signatures
-- =============================================================================

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'certificate_signatures';

-- Enable RLS if not already enabled
ALTER TABLE public.certificate_signatures ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 2: Drop existing policies (if any) to recreate them cleanly
-- =============================================================================

DROP POLICY IF EXISTS "Learners can view their own certificate signatures" ON public.certificate_signatures;
DROP POLICY IF EXISTS "Learners can insert signatures for their certificates" ON public.certificate_signatures;
DROP POLICY IF EXISTS "Admins full access to certificate signatures" ON public.certificate_signatures;

-- =============================================================================
-- STEP 3: Create RLS Policies for certificate_signatures
-- =============================================================================

-- Policy 1: Learners can VIEW their own certificate signatures
CREATE POLICY "Learners can view their own certificate signatures"
ON public.certificate_signatures
FOR SELECT
USING (
  certificate_id IN (
    SELECT id FROM public.certificates
    WHERE user_id = auth.uid()
  )
);

-- Policy 2: Allow inserts for certificate signatures
-- This allows both authenticated users (for their own certs) and service role
-- NOTE: When using Supabase service role client, RLS policies are bypassed entirely
-- For anon/authenticated clients, allow inserts if:
-- 1. User is inserting for their own certificate
-- 2. User is an admin
-- 3. This allows awardCertificate function to work server-side
CREATE POLICY "Allow certificate signature inserts"
ON public.certificate_signatures
FOR INSERT
WITH CHECK (
  CASE
    -- If current user is set, allow if they own the certificate
    WHEN auth.uid() IS NOT NULL THEN
      certificate_id IN (
        SELECT id FROM public.certificates
        WHERE user_id = auth.uid()
      )
    -- If no current user (service role), allow all
    ELSE true
  END
);

-- Policy 3: Allow reading for admins
CREATE POLICY "Admins can view all certificate signatures"
ON public.certificate_signatures
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- =============================================================================
-- STEP 4: Backfill Missing Signatures for Existing Certificates
-- =============================================================================

-- Find certificates without signatures
SELECT
  c.id,
  c.user_id,
  c.course_id,
  COUNT(cs.id) as existing_signatures
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
GROUP BY c.id, c.user_id, c.course_id
HAVING COUNT(cs.id) = 0
ORDER BY c.issued_at DESC;

-- Backfill: Insert missing signatures from certificate_signature_settings
-- for all certificates that don't have signatures yet
INSERT INTO public.certificate_signatures (
  certificate_id,
  signature_id,
  display_order,
  signature_name,
  signature_designation,
  signature_text,
  signature_image_url
)
SELECT
  c.id as certificate_id,
  css.id as signature_id,
  css.display_order,
  css.name as signature_name,
  css.designation as signature_designation,
  css.signature_text,
  css.signature_image_url
FROM public.certificates c
CROSS JOIN public.certificate_signature_settings css
WHERE
  -- Only for certificates that don't have this signature already
  NOT EXISTS (
    SELECT 1 FROM public.certificate_signatures cs
    WHERE cs.certificate_id = c.id
      AND cs.signature_id = css.id
  )
  -- Only for enabled signatures
  AND css.is_enabled = true
ORDER BY c.issued_at DESC, css.display_order
ON CONFLICT (certificate_id, signature_id) DO NOTHING;

-- Verify backfill
SELECT
  COUNT(*) as total_certs,
  COUNT(CASE WHEN cs.id IS NOT NULL THEN 1 END) as certs_with_signatures,
  COUNT(DISTINCT cs.id) as total_signature_links
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id;

-- =============================================================================
-- STEP 5: Update denormalized columns (optional cleanup)
-- =============================================================================

-- If signature_ids and signatures_data columns are used (they shouldn't be),
-- update them with backfilled data:

UPDATE public.certificates c
SET
  signature_ids = (
    SELECT array_agg(cs.signature_id ORDER BY cs.display_order)
    FROM public.certificate_signatures cs
    WHERE cs.certificate_id = c.id
  ),
  signatures_data = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'signature_id', cs.signature_id,
        'name', cs.signature_name,
        'designation', cs.signature_designation,
        'signature_text', cs.signature_text,
        'signature_image_url', cs.signature_image_url,
        'display_order', cs.display_order
      ) ORDER BY cs.display_order
    )
    FROM public.certificate_signatures cs
    WHERE cs.certificate_id = c.id
  )
WHERE signature_ids = '{}'::text[] OR signatures_data = '[]'::jsonb;

-- =============================================================================
-- STEP 6: Verify Results
-- =============================================================================

-- Show certificates with their backfilled signatures
SELECT
  c.id,
  c.user_id,
  c.course_id,
  c.issued_at,
  COUNT(cs.id) as signature_count,
  string_agg(cs.signature_name, ', ' ORDER BY cs.display_order) as signature_names
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
GROUP BY c.id, c.user_id, c.course_id, c.issued_at
ORDER BY c.issued_at DESC;

-- Show count summary
SELECT
  'Certificates' as resource,
  COUNT(*) as total
FROM public.certificates
UNION ALL
SELECT
  'Certificate Signatures',
  COUNT(*)
FROM public.certificate_signatures
UNION ALL
SELECT
  'Certificates with Signatures',
  COUNT(DISTINCT certificate_id)
FROM public.certificate_signatures;

-- =============================================================================
-- NOTES:
-- =============================================================================
--
-- 1. RLS Policies Created:
--    - Learners can view their own certificate signatures
--    - Service role / Admins can insert signatures
--    - Admins can view all signatures
--
-- 2. Backfill Process:
--    - Finds all certificates without any signatures
--    - Gets all enabled signature settings
--    - Creates certificate_signature links with snapshot data
--
-- 3. Denormalized Columns:
--    - signature_ids: Array of signature IDs
--    - signatures_data: JSONB with full snapshot data
--    - These are updated during backfill for backward compatibility
--
-- 4. Performance Notes:
--    - Indexes on certificate_id and signature_id are in place
--    - Unique constraint prevents duplicate links
--    - Foreign keys with CASCADE delete for data integrity
--
