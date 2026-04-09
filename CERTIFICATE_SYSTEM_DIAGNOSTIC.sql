/**
 * Certificate System Diagnostic Script
 *
 * Run this in Supabase SQL Editor to get complete system health check
 * Shows: RLS status, signature settings, certificate coverage, recent issues
 *
 * Date: 2026-04-09
 */

-- =============================================================================
-- SECTION 1: RLS POLICY VERIFICATION
-- =============================================================================

ECHO '=== RLS POLICY VERIFICATION ===';

-- Check if RLS is enabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'certificate_signatures';

-- List all policies
SELECT
  policyname,
  cmd as policy_type,
  CASE WHEN cmd = 'INSERT' THEN '✅ INSERT' ELSE cmd END as policy_action,
  CASE WHEN qual IS NOT NULL THEN 'USING' ELSE '-' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN 'WITH CHECK' ELSE '-' END as has_check
FROM pg_policies
WHERE tablename = 'certificate_signatures'
ORDER BY policyname;

-- =============================================================================
-- SECTION 2: SIGNATURE SETTINGS STATUS
-- =============================================================================

ECHO '=== SIGNATURE SETTINGS STATUS ===';

SELECT
  COUNT(*) as total_signatures,
  COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled_count,
  COUNT(CASE WHEN is_enabled = false THEN 1 END) as disabled_count
FROM public.certificate_signature_settings;

-- Show enabled signatures
SELECT
  id,
  name,
  designation,
  is_enabled,
  display_order
FROM public.certificate_signature_settings
ORDER BY display_order;

-- =============================================================================
-- SECTION 3: OVERALL CERTIFICATE COVERAGE
-- =============================================================================

ECHO '=== OVERALL CERTIFICATE COVERAGE ===';

SELECT
  COUNT(DISTINCT c.id) as total_certificates,
  COUNT(CASE WHEN cs.id IS NOT NULL THEN 1 END) /
    NULLIF(COUNT(DISTINCT c.id), 0) * 100 as coverage_percent,
  COUNT(DISTINCT c.id) FILTER (WHERE cs.id IS NULL) as certificates_without_signatures,
  COUNT(DISTINCT cs.certificate_id) as certificates_with_signatures
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id;

-- =============================================================================
-- SECTION 4: RECENT CERTIFICATES (LAST 24 HOURS)
-- =============================================================================

ECHO '=== RECENT CERTIFICATES (LAST 24 HOURS) ===';

SELECT
  c.id,
  c.user_id,
  c.course_id,
  c.issued_at,
  COUNT(cs.id) as signature_count,
  CASE WHEN COUNT(cs.id) > 0 THEN '✅ YES' ELSE '❌ NO' END as has_signatures,
  c.signature_ids,
  CASE
    WHEN c.signature_ids = '{}' THEN 'Empty'
    WHEN c.signature_ids IS NULL THEN 'NULL'
    ELSE array_length(c.signature_ids, 1)::text
  END as denormalized_count
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
WHERE c.issued_at > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.user_id, c.course_id, c.issued_at, c.signature_ids
ORDER BY c.issued_at DESC;

-- =============================================================================
-- SECTION 5: CERTIFICATE-SIGNATURE RELATIONSHIPS
-- =============================================================================

ECHO '=== CERTIFICATE-SIGNATURE RELATIONSHIPS ===';

SELECT
  c.id as cert_id,
  COUNT(cs.id) as signature_links,
  string_agg(DISTINCT cs.signature_name, ', ' ORDER BY cs.signature_name) as signature_names
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
WHERE c.issued_at > NOW() - INTERVAL '7 days'
GROUP BY c.id
ORDER BY c.id DESC
LIMIT 20;

-- =============================================================================
-- SECTION 6: DETECT ISSUES
-- =============================================================================

ECHO '=== POTENTIAL ISSUES ===';

-- Issue 1: Certificates without signatures
SELECT
  'Missing Signatures' as issue_type,
  COUNT(*) as count,
  'WARNING' as severity
FROM (
  SELECT DISTINCT c.id
  FROM public.certificates c
  LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
  WHERE cs.id IS NULL
    AND c.issued_at > NOW() - INTERVAL '24 hours'
) sub
HAVING COUNT(*) > 0;

-- Issue 2: No enabled signatures in settings
SELECT
  'No Enabled Signatures' as issue_type,
  COUNT(*) as enabled_count,
  CASE WHEN COUNT(*) = 0 THEN 'CRITICAL' ELSE 'OK' END as severity
FROM public.certificate_signature_settings
WHERE is_enabled = true;

-- Issue 3: RLS not enabled
SELECT
  'RLS Not Enabled' as issue_type,
  1 as count,
  'CRITICAL' as severity
FROM pg_tables
WHERE tablename = 'certificate_signatures'
  AND rowsecurity = false;

-- Issue 4: Missing RLS policies
WITH expected_policies AS (
  SELECT 'Learners can view their own certificate signatures' as policy_name
  UNION ALL
  SELECT 'Allow certificate signature inserts'
  UNION ALL
  SELECT 'Admins can view all certificate signatures'
),
existing_policies AS (
  SELECT DISTINCT policyname
  FROM pg_policies
  WHERE tablename = 'certificate_signatures'
)
SELECT
  'Missing RLS Policy' as issue_type,
  COUNT(*) as missing_policy_count,
  CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END as severity
FROM expected_policies e
LEFT JOIN existing_policies p ON e.policy_name = p.policyname
WHERE p.policyname IS NULL;

-- =============================================================================
-- SECTION 7: COURSES WITH CERTIFICATE ENABLED
-- =============================================================================

ECHO '=== COURSE CERTIFICATE STATUS ===';

SELECT
  COUNT(*) as total_courses,
  COUNT(CASE WHEN certificate_enabled = true THEN 1 END) as cert_enabled,
  COUNT(CASE WHEN certificate_enabled = false THEN 1 END) as cert_disabled,
  COUNT(CASE WHEN certificate_enabled IS NULL THEN 1 END) as cert_unknown
FROM public.courses;

-- =============================================================================
-- SECTION 8: DATABASE SCHEMA VERIFICATION
-- =============================================================================

ECHO '=== DATABASE SCHEMA VERIFICATION ===';

-- Check required columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'certificate_signatures'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- SECTION 9: RECENT CERTIFICATE SIGNATURE INSERTS (LAST 100)
-- =============================================================================

ECHO '=== RECENT SIGNATURE LINKS ===';

SELECT
  certificate_id,
  signature_id,
  signature_name,
  signature_designation,
  created_at,
  updated_at
FROM public.certificate_signatures
ORDER BY updated_at DESC
LIMIT 100;

-- =============================================================================
-- SECTION 10: ACTION ITEMS BASED ON FINDINGS
-- =============================================================================

ECHO '=== ACTION ITEMS ===';

SELECT 'Review Output Above' as action, 'Check for any issues marked CRITICAL or WARNING' as details
UNION ALL
SELECT 'If missing signatures', 'Run backfill: POST /api/admin/backfill-certificates?action=backfill'
UNION ALL
SELECT 'If RLS not enabled', 'Run STEP 1 from certificate_signatures_rls_and_backfill.sql'
UNION ALL
SELECT 'If policies missing', 'Run STEP 2 & 3 from certificate_signatures_rls_and_backfill.sql'
UNION ALL
SELECT 'If no enabled signatures', 'Go to Admin → Certificate Settings and add/enable at least one'
UNION ALL
SELECT 'To test new issuance', 'Complete a course and monitor server logs for [CERTIFICATE_SIGNATURE_SUCCESS]';
