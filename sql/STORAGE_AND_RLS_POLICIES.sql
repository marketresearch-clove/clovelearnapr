-- ============================================================================
-- STORAGE CONFIGURATION & ACCESS RULES
-- ============================================================================

-- STORAGE BUCKETS CONFIGURATION
-- ============================================================================

-- Bucket 1: Documents
-- ---
-- Purpose: General document storage (PDFs, presentations, etc.)
-- Access: Public (anyone can view)
-- Size Limit: 52428800 bytes (50 MB)
-- MIME Types: All allowed
-- Status: Active/Production
-- Created: 2025-12-12T09:51:57.278Z
-- 
-- Storage Rules SQL:
-- 
-- CREATE POLICY "Public Documents Access"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'Documents');
-- 
-- CREATE POLICY "Authenticated Users Upload Documents"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'Documents' AND auth.role() = 'authenticated');

-- Bucket 2: lessons-content
-- ---
-- Purpose: Lesson content including videos, images, and interactive materials
-- Access: Public (all authenticated users can view)
-- Size Limit: Unlimited
-- MIME Types: All allowed
-- Status: Active/Production
-- Created: 2025-12-12T09:55:41.937Z
--
-- Storage Rules SQL:
--
-- CREATE POLICY "Public Lessons Content Access"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'lessons-content' AND auth.role() = 'authenticated');
-- 
-- CREATE POLICY "Instructors Upload Lesson Content"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'lessons-content' 
--     AND auth.role() = 'authenticated'
--     AND (auth.jwt() ->> 'user_role')::text IN ('instructor', 'admin')
--   );

-- Bucket 3: avatars
-- ---
-- Purpose: User profile avatars and profile pictures
-- Access: Public (profile pictures visible to all)
-- Size Limit: Unlimited (recommend 5-10 MB per file)
-- MIME Types: image/* (enforced by rules)
-- Status: Active/Production
-- Created: 2025-12-20T10:43:18.611Z
--
-- Storage Rules SQL:
--
-- CREATE POLICY "Public Avatar Access"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');
-- 
-- CREATE POLICY "Users Upload Own Avatars"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'avatars'
--     AND auth.uid() = (storage.foldername(name))[1]::uuid
--     AND (storage.foldername(name))[2] = auth.uid()::text
--   );

-- Bucket 4: community-uploads
-- ---
-- Purpose: Community forum posts, user-generated content
-- Access: Public (community content visible to all users)
-- Size Limit: Unlimited
-- MIME Types: All allowed
-- Status: Active/Production
-- Created: 2025-12-22T05:45:27.427Z
--
-- Storage Rules SQL:
--
-- CREATE POLICY "Public Community Content Access"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'community-uploads');
-- 
-- CREATE POLICY "Authenticated Users Upload Community Content"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'community-uploads'
--     AND auth.role() = 'authenticated'
--   );
-- 
-- CREATE POLICY "Users Manage Own Community Content"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'community-uploads'
--     AND auth.uid() = (storage.foldername(name))[1]::uuid
--   );

-- STORAGE CONFIGURATION SETTINGS
-- ============================================================================

-- Global Settings:
-- - File Size Limit: 52428800 bytes (50 MB default)
-- - Image Transformation: disabled (not needed for LMS)
-- - S3 Protocol: enabled (allows S3-compatible access)
-- - Iceberg Catalog: disabled
-- - Vector Buckets: disabled

-- SQL to check storage config:
-- SELECT * FROM pg_settings WHERE name LIKE 'storage%';

-- To update file size limits for a bucket:
-- UPDATE storage.buckets 
-- SET file_size_limit = 104857600  -- 100 MB
-- WHERE name = 'lessons-content';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- RLS is enabled on all public schema tables for security

-- TABLE: courses
-- Policies:
-- - SELECT: Published courses visible to authenticated users
-- - CREATE: Only admins can create courses
-- - UPDATE: Only course creator/admin can update
-- - DELETE: Only admin can delete

-- SQL Example Policies:
/*
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public courses with RLS"
  ON courses FOR SELECT
  USING (is_published = true OR auth.uid() = created_by);

CREATE POLICY "Admins can manage all courses"
  ON courses FOR ALL
  USING (
    auth.jwt() ->> 'user_role' = 'admin'
    OR auth.jwt() ->> 'user_role' = 'super_admin'
  );

CREATE POLICY "Instructors manage own courses"
  ON courses FOR ALL
  USING (auth.uid() = created_by);
*/

-- TABLE: enrollments
-- Policies:
-- - Users can view their own enrollments
-- - Admins/instructors can view all enrollments in their courses
-- - Only admins can delete enrollments

/*
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Instructors view course enrollments"
  ON enrollments FOR SELECT
  USING (
    course_id IN (SELECT id FROM courses WHERE created_by = auth.uid())
  );

CREATE POLICY "Admins view all enrollments"
  ON enrollments FOR SELECT
  USING (auth.jwt() ->> 'user_role' IN ('admin', 'super_admin'));

CREATE POLICY "Only admins can enroll users"
  ON enrollments FOR INSERT
  WITH CHECK (auth.jwt() ->> 'user_role' IN ('admin', 'super_admin'));
*/

-- TABLE: lesson_progress
-- Policies:
-- - Users can only view/update their own progress
-- - Auto-updated by system

/*
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress"
  ON lesson_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Instructors can view progress"
  ON lesson_progress FOR SELECT
  USING (
    lesson_id IN (
      SELECT id FROM lessons WHERE course_id IN (
        SELECT id FROM courses WHERE created_by = auth.uid()
      )
    )
  );
*/

-- TABLE: profiles
-- Policies:
-- - Users can view public profile info
-- - Users can edit their own profiles
-- - Admins can view all profiles

/*
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profile view"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (auth.jwt() ->> 'user_role' IN ('admin', 'super_admin'));
*/

-- TABLE: notifications
-- Policies:
-- - Users can only view their own notifications
-- - System can create notifications for users

/*
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "System creates notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR auth.jwt() ->> 'user_role' IN ('admin', 'super_admin')
  );
*/

-- TABLE: quiz_results
-- Policies:
-- - Users can view their own quiz results
-- - Instructors can view results for their courses
-- - System auto-creates results

/*
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own results"
  ON quiz_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Instructors view course results"
  ON quiz_results FOR SELECT
  USING (
    quiz_id IN (
      SELECT id FROM quizzes WHERE lesson_id IN (
        SELECT id FROM lessons WHERE course_id IN (
          SELECT id FROM courses WHERE created_by = auth.uid()
        )
      )
    )
  );

CREATE POLICY "System creates results"
  ON quiz_results FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
*/

-- TABLE: certificates
-- Policies:
-- - Users can view their own certificates
-- - Public access to verify certificates

/*
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public certificate verification"
  ON certificates FOR SELECT
  USING (
    verification_token IS NOT NULL
    AND (certificate_number = current_setting('search_path'))
  );
*/

-- TABLE: career_paths
-- Policies:
-- - Published career paths visible to all authenticated users
-- - Only admins can manage

/*
ALTER TABLE career_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published career paths visible"
  ON career_paths FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins manage all career paths"
  ON career_paths FOR ALL
  USING (auth.jwt() ->> 'user_role' IN ('admin', 'super_admin'));
*/

-- TABLE: notification_preferences
-- Policies:
-- - Users can only manage their own preferences

/*
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
*/

-- TABLE: user_statistics
-- Policies:
-- - Users can view their own statistics
-- - Instructors can view student statistics
-- - Admins can view all

/*
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stats"
  ON user_statistics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Instructors view student stats"
  ON user_statistics FOR SELECT
  USING (
    user_id IN (
      SELECT DISTINCT user_id FROM enrollments 
      WHERE course_id IN (
        SELECT id FROM courses WHERE created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Admins view all stats"
  ON user_statistics FOR SELECT
  USING (auth.jwt() ->> 'user_role' IN ('admin', 'super_admin'));
*/

-- ============================================================================
-- ADMIN BYPASS & SECURITY CONTEXT
-- ============================================================================

-- For admin operations that need to bypass RLS:
-- 1. Use SECURITY_DEFINER stored procedures (run as function owner)
-- 2. Service role key can bypass RLS in edge functions
-- 3. Custom claims in JWT for role-based access

-- Example SECURITY_DEFINER function for admin operations:
/*
CREATE OR REPLACE FUNCTION admin_enroll_users(
  course_id UUID,
  user_ids UUID[]
)
RETURNS TABLE (user_id UUID, success BOOLEAN)
SECURITY DEFINER
SET search_path TO public
LANGUAGE plpgsql
AS $$
DECLARE
  uid UUID;
BEGIN
  -- Check if caller is admin
  IF (auth.jwt() ->> 'user_role') NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admins can enroll users';
  END IF;

  -- Enroll each user
  FOREACH uid IN ARRAY user_ids LOOP
    INSERT INTO enrollments (user_id, course_id, enrolled_at)
    VALUES (uid, course_id, NOW())
    ON CONFLICT DO NOTHING;
    
    RETURN QUERY SELECT uid, true;
  END LOOP;
END;
$$;
*/

-- ============================================================================
-- POLICY BEST PRACTICES IMPLEMENTED
-- ============================================================================

-- 1. Principle of Least Privilege
--    - Users only access their own data by default
--    - Escalated access for roles (instructor, admin)

-- 2. Role-Based Access Control (RBAC)
--    - super_admin: Full access to all data
--    - admin: Can manage courses, users, settings
--    - instructor: Can manage own courses and view student progress
--    - student: Can only view/access enrolled courses

-- 3. Data Integrity
--    - Audit logs for sensitive operations
--    - Timestamps for tracking changes
--    - Soft deletes where applicable

-- 4. Performance Optimization
--    - Indexes on commonly filtered columns (user_id, course_id, created_by)
--    - Partition tables by date where applicable (messages, logs)

-- 5. Multi-tenancy Ready
--    - If organization-level isolation needed, add org_id to tables
--    - Use auth.jwt() claims for organization context

-- ============================================================================
-- END STORAGE & SECURITY CONFIGURATION
-- ============================================================================
