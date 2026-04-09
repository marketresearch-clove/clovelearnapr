/**
 * SQL Script to Delete Specific Certificate
 * Certificate ID: 7111f400-984d-457d-8414-d3241eda9fc7
 *
 * ⚠️  WARNING: This is a destructive operation
 * Ensure you have a backup before running
 *
 * IMPORTANT: Execute in this order:
 * 1. First delete certificate_signatures (foreign key)
 * 2. Then delete certificates
 */

-- =============================================================================
-- STEP 1: Delete Certificate Signatures
-- =============================================================================
-- This deletes all signature associations for the certificate
DELETE FROM certificate_signatures
WHERE certificate_id = '7111f400-984d-457d-8414-d3241eda9fc7';

-- Verify deletion
SELECT COUNT(*) as remaining_signatures
FROM certificate_signatures
WHERE certificate_id = '7111f400-984d-457d-8414-d3241eda9fc7';


-- =============================================================================
-- STEP 2: Delete Certificate
-- =============================================================================
-- This deletes the actual certificate record
DELETE FROM certificates
WHERE id = '7111f400-984d-457d-8414-d3241eda9fc7';

-- Verify deletion
SELECT COUNT(*) as remaining_certificates
FROM certificates
WHERE id = '7111f400-984d-457d-8414-d3241eda9fc7';


-- =============================================================================
-- VERIFICATION: Check everything was cleaned up
-- =============================================================================

-- Should return 0 rows
SELECT 'Certificate Records' as check_type, COUNT(*) as count
FROM certificates
WHERE id = '7111f400-984d-457d-8414-d3241eda9fc7'
UNION ALL
SELECT 'Signature Records', COUNT(*)
FROM certificate_signatures
WHERE certificate_id = '7111f400-984d-457d-8414-d3241eda9fc7';


-- =============================================================================
-- ADDITIONAL CHECKS: Data integrity
-- =============================================================================

-- Check if this was the user's only certificate
-- (Replace USER_ID with actual user ID if known)
-- SELECT COUNT(*) as user_certificates
-- FROM certificates
-- WHERE user_id = 'USER_ID';

-- Check course details
-- SELECT id, title, certificate_enabled
-- FROM courses
-- WHERE id = (
--   SELECT course_id FROM certificates
--   WHERE id = '7111f400-984d-457d-8414-d3241eda9fc7'
-- );
