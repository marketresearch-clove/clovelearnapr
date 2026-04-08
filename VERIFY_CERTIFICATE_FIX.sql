-- Verification Script for Certificate Null Signature Fix
-- Run this script to verify the fix has been applied correctly

-- 1. Check for remaining null signature names
SELECT
    'NULL signature_name' as issue,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM public.certificate_signatures
WHERE signature_name IS NULL
UNION ALL
-- 2. Check for remaining null signature designations
SELECT
    'NULL signature_designation' as issue,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM public.certificate_signatures
WHERE signature_designation IS NULL
UNION ALL
-- 3. Check for remaining null signature text
SELECT
    'NULL signature_text' as issue,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM public.certificate_signatures
WHERE signature_text IS NULL
UNION ALL
-- 4. Check for remaining null signature image urls
SELECT
    'NULL signature_image_url' as issue,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM public.certificate_signatures
WHERE signature_image_url IS NULL;

-- 5. Show total certificate signatures stats
SELECT
    COUNT(*) as total_links,
    COUNT(DISTINCT certificate_id) as total_certificates,
    COUNT(DISTINCT signature_id) as total_signatures,
    COUNT(CASE WHEN signature_name IS NOT NULL THEN 1 END) as with_name,
    COUNT(CASE WHEN signature_designation IS NOT NULL THEN 1 END) as with_designation
FROM public.certificate_signatures;

-- 6. Sample of valid certificate signatures (should show all fields populated)
SELECT
    c.id as certificate_id,
    c.issued_at,
    u.email as user_email,
    cs.signature_name as signer_name,
    cs.signature_designation as signer_title,
    cs.display_order,
    CASE
        WHEN cs.signature_image_url IS NOT NULL THEN 'IMAGE'
        ELSE 'TEXT'
    END as signature_type
FROM public.certificates c
JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
LEFT JOIN auth.users u ON c.user_id = u.id
ORDER BY c.issued_at DESC, cs.display_order ASC
LIMIT 10;

-- 7. Check if there are any certificates with no signatures
SELECT
    c.id as certificate_id,
    c.issued_at,
    c.user_id,
    COUNT(cs.id) as signature_count
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
GROUP BY c.id, c.issued_at, c.user_id
HAVING COUNT(cs.id) = 0
ORDER BY c.issued_at DESC;

-- 8. Detailed audit trail - show before/after comparison with current settings
SELECT
    c.id as certificate_id,
    c.issued_at,
    cs.signature_id,
    cs.signature_name as snapshot_name,
    cs.signature_designation as snapshot_designation,
    css.name as current_name,
    css.designation as current_designation,
    CASE
        WHEN cs.signature_name = css.name THEN 'MATCH'
        ELSE 'MISMATCH (historical change)'
    END as name_comparison
FROM public.certificates c
JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
LEFT JOIN public.certificate_signature_settings css ON cs.signature_id = css.id
ORDER BY c.issued_at DESC, cs.display_order ASC
LIMIT 20;
