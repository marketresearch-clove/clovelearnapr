-- Fix NULL signature names and designations in certificate_signatures table
-- This migration repairs any null snapshot values by retrieving them from certificate_signature_settings

-- 1. Backfill signature_name from certificate_signature_settings where NULL
UPDATE public.certificate_signatures cs
SET signature_name = css.name
FROM public.certificate_signature_settings css
WHERE cs.signature_id = css.id
  AND cs.signature_name IS NULL;

-- 2. Backfill signature_designation from certificate_signature_settings where NULL
UPDATE public.certificate_signatures cs
SET signature_designation = css.designation
FROM public.certificate_signature_settings css
WHERE cs.signature_id = css.id
  AND cs.signature_designation IS NULL;

-- 3. Backfill signature_text from certificate_signature_settings where NULL
UPDATE public.certificate_signatures cs
SET signature_text = css.signature_text
FROM public.certificate_signature_settings css
WHERE cs.signature_id = css.id
  AND cs.signature_text IS NULL;

-- 4. Backfill signature_image_url from certificate_signature_settings where NULL
UPDATE public.certificate_signatures cs
SET signature_image_url = css.signature_image_url
FROM public.certificate_signature_settings css
WHERE cs.signature_id = css.id
  AND cs.signature_image_url IS NULL;

-- 5. Verify the fixes - report any remaining nulls
SELECT
    'signature_name' as field,
    COUNT(*) as null_count
FROM public.certificate_signatures
WHERE signature_name IS NULL
UNION ALL
SELECT
    'signature_designation' as field,
    COUNT(*) as null_count
FROM public.certificate_signatures
WHERE signature_designation IS NULL
UNION ALL
SELECT
    'signature_text' as field,
    COUNT(*) as null_count
FROM public.certificate_signatures
WHERE signature_text IS NULL
UNION ALL
SELECT
    'signature_image_url' as field,
    COUNT(*) as null_count
FROM public.certificate_signatures
WHERE signature_image_url IS NULL;

-- 6. Show sample of fixed data
SELECT
    cs.certificate_id,
    cs.signature_id,
    cs.display_order,
    cs.signature_name,
    cs.signature_designation,
    cs.signature_text,
    cs.signature_image_url,
    css.name as current_name,
    css.designation as current_designation
FROM public.certificate_signatures cs
LEFT JOIN public.certificate_signature_settings css ON cs.signature_id = css.id
ORDER BY cs.created_at DESC, cs.display_order ASC
LIMIT 10;
