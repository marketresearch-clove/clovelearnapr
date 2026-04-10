-- =========================================================================
-- DESTRUCTIVE CLEANUP: Clear ALL User Learning Data
-- Date: April 10, 2026
-- WARNING: This permanently deletes all learning history
-- =========================================================================

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- =========================================================================
-- 1. CLEAR CERTIFICATES & SIGNATURES
-- =========================================================================

DELETE FROM public.certificate_signatures;
DELETE FROM public.certificates;

-- =========================================================================
-- 2. CLEAR TIME TRACKING
-- =========================================================================

DELETE FROM public.lesson_time_logs;
DELETE FROM public.learning_sessions;
DELETE FROM public.learning_transaction_log;
DELETE FROM public.learning_hours;

-- =========================================================================
-- 3. CLEAR PROGRESS & RESULTS
-- =========================================================================

DELETE FROM public.lesson_progress;
DELETE FROM public.quiz_results;
DELETE FROM public.assessment_results;

-- =========================================================================
-- 4. CLEAR ACKNOWLEDGEMENTS
-- =========================================================================

DELETE FROM public.acknowledgement_documents;

-- =========================================================================
-- 5. CLEAR ENROLLMENTS
-- =========================================================================

DELETE FROM public.enrollments;

-- =========================================================================
-- 6. CLEAR SKILLS & XP
-- =========================================================================

DELETE FROM public.skill_assignments;
DELETE FROM public.user_skill_achievements;

-- =========================================================================
-- 7. CLEAR USER STATISTICS & XP
-- =========================================================================

DELETE FROM public.user_statistics;

-- =========================================================================
-- 8. RE-ENABLE FOREIGN KEY CHECKS
-- =========================================================================

SET session_replication_role = 'origin';

-- =========================================================================
-- CLEANUP COMPLETE
-- =========================================================================

-- Summary of deletions
SELECT
  NOW() as cleanup_timestamp,
  'All user learning data cleared' as status,
  'Includes: lesson_progress, enrollments, certificates, xp, skills, acknowledgements' as cleared_items;
