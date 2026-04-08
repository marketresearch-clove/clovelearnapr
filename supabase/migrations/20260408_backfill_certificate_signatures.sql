-- Backfill certificate_signatures junction table for existing certificates
-- Links all existing certificates to the current enabled signatures
-- Stores snapshots of signature data at time of issuance for historical accuracy
-- This ensures old certificates maintain their signature history

-- 1. Insert certificate_signatures for existing certificates with snapshot data
-- All existing certificates will be linked to the currently enabled signatures
-- The snapshot data preserves the exact values at time of issuance
INSERT INTO public.certificate_signatures (
    certificate_id,
    signature_id,
    display_order,
    signature_name,
    signature_designation,
    signature_text,
    signature_image_url,
    created_at
)
SELECT
    c.id as certificate_id,
    cs.id as signature_id,
    cs.display_order,
    cs.name as signature_name,
    cs.designation as signature_designation,
    cs.signature_text,
    cs.signature_image_url,
    c.issued_at as created_at
FROM public.certificates c
CROSS JOIN public.certificate_signature_settings cs
WHERE cs.is_enabled = true
AND NOT EXISTS (
    -- Avoid duplicates - only insert if this link doesn't exist
    SELECT 1 FROM public.certificate_signatures
    WHERE certificate_id = c.id
    AND signature_id = cs.id
)
ORDER BY c.issued_at DESC, cs.display_order ASC;

-- 2. Log the results
-- Check how many links were created
DO $$
DECLARE
    total_certs INTEGER;
    total_sigs INTEGER;
    total_links INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_certs FROM public.certificates;
    SELECT COUNT(*) INTO total_sigs FROM public.certificate_signature_settings WHERE is_enabled = true;
    SELECT COUNT(*) INTO total_links FROM public.certificate_signatures;

    RAISE NOTICE 'Backfill complete:';
    RAISE NOTICE '  Total certificates: %', total_certs;
    RAISE NOTICE '  Total enabled signatures: %', total_sigs;
    RAISE NOTICE '  Total certificate_signatures links: %', total_links;
    RAISE NOTICE '  Expected links: % (% certificates × % signatures)', (total_certs * total_sigs), total_certs, total_sigs;
END $$;

-- 3. Verify the backfill - show sample of linked data with snapshots
SELECT
    c.id as certificate_id,
    c.issued_at,
    cs.id as link_id,
    cs.signature_id,
    cs.signature_name as snapshot_name,
    cs.signature_designation as snapshot_designation,
    cs.display_order,
    -- Also show current values for comparison
    css.name as current_name,
    css.designation as current_designation
FROM public.certificates c
JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
LEFT JOIN public.certificate_signature_settings css ON cs.signature_id = css.id
ORDER BY c.issued_at DESC, cs.display_order ASC
LIMIT 20;
