-- ============================================================================
-- MIGRATIONS COMPLETE LOG & DOCUMENTATION
-- Skill Spire LMS - Database Migration History
-- ============================================================================

-- Migrations are tracked in supabase_migrations.schema_migrations table
-- Total Applied: 37 migrations
-- Database Version: Current (as of March 26, 2026)

-- ============================================================================
-- MIGRATION TIMELINE
-- ============================================================================

-- Phase 1: Skills & Achievements Foundation
-- 20260312050231: backfill_missing_skill_achievements_v4
--   - Backfills missing skill achievements for existing users
--   - Ensures data consistency after schema changes
--
-- 20260312061134: add_type_to_skills
--   - Adds 'type' column to skills table
--   - Categories: technical, soft, language
--
-- Phase 2: Categories & Flashcards
-- 20260312124549: create_categories_table
--   - Creates categories table for course classification
--   - Columns: id, name, description, icon_url, color
--
-- 20260312124555: insert_default_categories
--   - Inserts default category records
--   - Examples: Programming, Languages, Soft Skills, etc.
--
-- Phase 3: Flashcard System
-- 20260313085539: create_flashcard_tables
--   - Creates flashcard_sets and flashcards tables
--   - Supports spaced repetition learning
--
-- 20260313123422: add_flashcard_to_lessons_type
--   - Adds 'flashcard' as lesson_type option
--
-- 20260313123742: fix_flashcard_sets_columns
--   - Fixes column constraints and data types
--   - Ensures referential integrity
--
-- 20260313125427: create_flashcard_sets_proper
--   - Recreates flashcard_sets with proper constraints
--   - Adds foreign key relationships
--
-- 20260313125530: clean_invalid_flashcard_ids
--   - Cleans up invalid references in flashcard data
--   - Data integrity maintenance
--
-- 20260313125548: fix_lesson_content_block_ids_v2
--   - Fixes lesson content block structure
--   - Ensures JSONB content integrity
--
-- 20260313130727: create_flashcard_color_settings
--   - Creates table for custom flashcard color preferences
--   - User personalisation feature
--
-- Phase 4: WhatsApp Notifications
-- 20260316053158: create_whatsapp_notifications
--   - Creates whatsapp_templates table
--   - Base structure for WhatsApp integration
--
-- 20260316072301: create_advanced_notifications
--   - Extends notification system
--   - Creates notification_auto_send_rules table
--   - Creates notification_audit_log table
--
-- Phase 5: RLS Policies & Security
-- 20260316121047: fix_enrollments_rls_admin_access
--   - Updates RLS policies on enrollments table
--   - Ensures admin can manage enrollments
--
-- 20260316121300: fix_instructor_visibility_for_students
--   - Fixes visibility of instructors to students
--   - RLS policy refinement
--
-- Phase 6: Course Feedback System
-- 20260317043040: create_course_feedback_table
--   - Creates course_feedback table (replaces course_reviews)
--   - Columns: id, user_id, course_id, rating, comment
--
-- 20260317123215: update_course_average_rating_on_review
--   - Creates trigger to update course average rating
--   - Automatic rating calculation
--
-- Phase 7: Security Definer & Views
-- 20260318041847: enable_rls_on_public_tables
--   - Enables Row Level Security on all public tables
--   - Foundation for security model
--
-- 20260318041920: remove_security_definer_from_views
--   - Removes SECURITY DEFINER from views
--   - Simplifies view definitions
--
-- 20260318041944: fix_security_definer_views
--   - Fixes view security context issues
--   - Ensures proper access control
--
-- 20260318042108: add_rls_policies_corrected
--   - Adds corrected RLS policies
--   - Replaces previous policy attempts
--
-- 20260318042217: final_fix_security_definer_views_v2
--   - Final security context fixes for views
--   - Ensures v_pass_rate and v_skill_coverage work correctly
--
-- Phase 8: Advanced Notification Features
-- 20260318101614: update_course_feedback_rls_policies
--   - Updates RLS policies for feedback table
--   - Users see all feedback, but can only edit own
--
-- 20260318101720: migrate_course_reviews_to_feedback
--   - Migrates data from course_reviews to course_feedback
--   - Data consolidation
--
-- 20260318102010: create_trigger_update_course_rating_on_feedback
--   - Creates updated trigger for rating updates
--   - Handles feedback inserts/updates/deletes
--
-- Phase 9: Duration Standardization
-- 20260318102530: standardize_duration_columns
--   - Standardizes duration handling across tables
--   - Uses both INTERVAL and INTEGER (minutes) columns
--   - Preparation for API consistency
--
-- 20260318114542: add_duration_minutes_to_lessons
--   - Adds duration_minutes column to lessons table
--   - Enables easier API response formatting
--
-- 20260318114655: fix_lessons_rls_policies
--   - Updates RLS policies for lessons table
--   - Ensures proper access control for lesson content
--
-- Phase 10: Admin Assignment Features
-- 20260324114126: fix_enrollments_rls_for_admin_assignments
--   - Updates enrollments RLS for admin assignment workflow
--   - Allows admins to create enrollments
--
-- 20260324114243: fix_trigger_security_context
--   - Fixes security context for triggers
--   - Ensures triggers run with proper permissions
--
-- 20260324114305: fix_enrollments_trigger_bypass_rls
--   - Updates trigger to bypass RLS where needed
--   - Allows automatic operations to proceed
--
-- Phase 11: Latest Admin RLS Fixes
-- 20260326085638: fix_courses_rls_admin_insert
--   - Ensures admins can create courses
--   - Fixes INSERT policy for courses
--
-- 20260326090059: fix_assessments_rls_admin_insert
--   - Ensures admins can create assessments
--   - Fixes INSERT policy for assessments
--
-- 20260326090109: fix_career_paths_rls_admin_insert
--   - Ensures admins can create career paths
--   - Fixes INSERT policy for career_paths
--
-- 20260326090130: fix_courses_rls_admin_update_delete
--   - Allows admins to UPDATE and DELETE courses
--   - Completes admin access to courses
--
-- Phase 12: AI Generation Tracking
-- 20260326090200: add_ai_skill_mapping_columns
--   - Adds AI generation tracking to skill_course_mappings
--   - Columns: generated_by_ai (BOOLEAN), ai_generated_at (TIMESTAMP)
--   - Adds icon support to skill_families (icon TEXT)
--   - Creates index for AI-generated mappings queries
--   - Enables tracking of AI-generated skill recommendations

-- ============================================================================
-- AUTHENTICATION SYSTEM
-- ============================================================================

-- Supabase Auth Configuration:
-- - Provider: Postgrest (PostgreSQL-based)
-- - Default: Email/Password authentication
-- - Supports: OAuth providers (Google, GitHub, etc.)
-- - MFA: Enabled (via Auth settings)
-- - JWT: Signed tokens with user claims

-- Auth Flow:
-- 1. User signs up/logs in
-- 2. Supabase Auth creates entry in auth.users
-- 3. Database trigger creates profile entry
-- 4. JWT token issued containing:
--    - sub: user ID (UUID)
--    - email: user email
--    - aud: 'authenticated'
--    - role: 'authenticated'
--    - iat: issued at timestamp
--    - exp: expiration timestamp
--
-- Custom JWT Claims:
-- - user_role: extracted from profiles.role column
-- - department: extracted from profiles.department column

-- Auth Tables (auth schema):
-- - auth.users: Main user accounts
-- - auth.identities: OAuth provider identities
-- - auth.sessions: Active sessions
-- - auth.refresh_tokens: Refresh token storage
-- - auth.mfa_factors: MFA setup records
-- - auth.webauthn_credentials: FIDO2/WebAuthn keys

-- ============================================================================
-- REALTIME FEATURES
-- ============================================================================

-- Realtime Database Configuration:
-- - Enabled in Supabase project
-- - Tables with realtime: Configurable per table in dashboard
-- - Database changes broadcast to subscribed clients

-- Realtime Tables:
-- - realtime.messages: Main message storage
-- - realtime.messages_YYYY_MM_DD: Date-partitioned message tables
-- - realtime.subscription: Subscription tracking
-- - realtime.schema_migrations: Migration tracking

-- Use Cases:
-- - Live notifications as they arrive
-- - Real-time dashboard updates
-- - Collaborative features (not currently used)
-- - Presence detection (could be added)

-- ============================================================================
-- VAULT SYSTEM (Secrets Management)
-- ============================================================================

-- Vault Schema Tables:
-- - vault.secrets: Encrypted secret storage
-- - vault.decrypted_secrets: Decrypted view (only visible to creator)

-- Stored Secrets:
-- - WHATSAPP_ACCESS_TOKEN: WhatsApp Business API token
-- - WHATSAPP_BUSINESS_PHONE_ID: WhatsApp phone number ID
-- - WHATSAPP_VERIFY_TOKEN: Webhook verification token

-- To create a secret:
-- SELECT vault.create_secret(
--   'secret_name',
--   'secret_value',
--   'Description of secret'
-- );

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Indexes Created:
-- - Primary indexes on all UUID primary keys
-- - Foreign key indexes (auto-created)
-- - Composite indexes for common queries:
--   - idx_enrollments_user_course (user_id, course_id)
--   - idx_lesson_progress_user_lesson (user_id, lesson_id)
--   - idx_notification_logs_created_at (DESC for recent logs)
--   - Course-related queries
--   - User statistics queries

-- Query Plans:
-- - Use EXPLAIN ANALYZE to check query plans
-- - Consider adding indexes for frequently filtered columns
-- - Monitor query performance in Supabase dashboard

-- Partitioning:
-- - Realtime message tables have been date-partitioned
-- - Improves query performance on large tables
-- - Consider for notification_logs table if it grows large

-- ============================================================================
-- BACKUP & RECOVERY
-- ============================================================================

-- Backups are automatically managed by Supabase:
-- - Daily automatic backups
-- - 30-day retention policy
-- - Point-in-time recovery available

-- Manual backup via CLI:
-- supabase db pull --db-url "postgresql://[user]:[password]@[host]:5432/[db]"

-- Manual backup via pg_dump:
-- pg_dump -h db.veaawiernjkdsfiziqen.supabase.co \
--   -U postgres \
--   -d postgres \
--   > backup.sql

-- Restore from backup:
-- psql -h db.[project-ref].supabase.co \
--   -U postgres \
--   -d postgres \
--   < backup.sql

-- ============================================================================
-- DATABASE MAINTENANCE
-- ============================================================================

-- Regular maintenance tasks:

-- 1. Vacuum (auto-runs, but can be manual):
-- VACUUM ANALYZE;

-- 2. Check table sizes:
-- SELECT 
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
-- FROM pg_tables
-- WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. Check index sizes:
-- SELECT 
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as size
-- FROM pg_stat_user_indexes
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- 4. Monitor slow queries:
-- SELECT query, calls, total_time, mean_time
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 10;

-- ============================================================================
-- COMPLIANCE & SECURITY
-- ============================================================================

-- Data Protection:
-- - Encryption in transit (TLS/SSL)
-- - Encryption at rest (Supabase managed)
-- - Row Level Security (RLS) on all public tables
-- - Service role for admin operations

-- Audit Trail:
-- - auth.audit_log_entries: Auth events
-- - notification_audit_log: Notification events
-- - Consider adding audit triggers for other tables

-- Access Control:
-- - Role-based access control (RBAC)
-- - Roles: super_admin, admin, instructor, student
-- - Policies enforce minimum necessary access

-- ============================================================================
-- KNOWN LIMITATIONS & FUTURE CONSIDERATIONS
-- ============================================================================

-- Current Limitations:
-- 1. No built-in full-text search (can add pg_trgm extension)
-- 2. No built-in analytics engine (could add PostgREST plugin)
-- 3. WhatsApp integration auth token stored in vault, needs rotation
-- 4. No built-in rate limiting (implement in Edge Function)

-- Future Improvements:
-- 1. Add full-text search on course titles/descriptions
-- 2. Implement more sophisticated analytics views
-- 3. Add email notification system (currently WhatsApp only)
-- 4. Implement progressive web app (PWA) features
-- 5. Add video streaming integration (e.g., Mux, Vimeo)
-- 6. Implement advanced reporting with analytics warehouse

-- ============================================================================
-- PROJECT INFORMATION
-- ============================================================================

-- Project: Skill Spire LMS
-- Purpose: Learning Management System with skill tracking and notifications
-- Status: Production
-- Last Updated: March 26, 2026
-- Supabase Project Ref: veaawiernjkdsfiziqen
-- 
-- Key Features:
-- - Course management and enrollment
-- - Lesson progress tracking
-- - Skill-based learning paths
-- - Flashcard study system
-- - Assessments and quizzes
-- - WhatsApp notifications
-- - Community features
-- - Career path recommendations
-- - Learning journey modules
-- - Real-time updates

-- ============================================================================
-- QUICK REFERENCE: COMMON TASKS
-- ============================================================================

-- Get database size:
-- SELECT pg_size_pretty(pg_database_size('postgres'));

-- Get most recent notifications:
-- SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;

-- Get course completion leaderboard:
-- SELECT p.first_name, p.last_name, COUNT(*) as courses_completed
-- FROM profiles p
-- JOIN enrollments e ON p.id = e.user_id
-- WHERE e.is_completed = true
-- GROUP BY p.id, p.first_name, p.last_name
-- ORDER BY courses_completed DESC LIMIT 10;

-- Get active learners (last 7 days):
-- SELECT 
--   p.id, p.first_name, p.last_name,
--   MAX(lp.updated_at) as last_activity
-- FROM profiles p
-- JOIN lesson_progress lp ON p.id = lp.user_id
-- WHERE lp.updated_at >= NOW() - INTERVAL '7 days'
-- GROUP BY p.id, p.first_name, p.last_name;

-- Get failing students (completion < 50%):
-- SELECT 
--   p.id, p.first_name, p.last_name,
--   COUNT(*) as courses_enrolled,
--   AVG(e.progress) as avg_progress
-- FROM profiles p
-- JOIN enrollments e ON p.id = e.user_id
-- WHERE e.progress < 50 AND e.is_completed = false
-- GROUP BY p.id, p.first_name, p.last_name;

-- ============================================================================
-- END OF MIGRATIONS & DOCUMENTATION
-- ============================================================================
