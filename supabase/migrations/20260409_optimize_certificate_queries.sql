-- Migration: Add indexes for certificate queries and add database constraint
-- Improves performance for finding orphaned certificates and other certificate lookups

-- Index on courses.certificate_enabled for faster filtering
CREATE INDEX IF NOT EXISTS idx_courses_certificate_enabled
ON courses(certificate_enabled);

-- Index on certificates (course_id, user_id) for unique certificate check
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_user_course
ON certificates(user_id, course_id);

-- Index for finding certificates by course_id
CREATE INDEX IF NOT EXISTS idx_certificates_course_id
ON certificates(course_id);

-- Index for finding certificates by user_id
CREATE INDEX IF NOT EXISTS idx_certificates_user_id
ON certificates(user_id);

-- Constraint to prevent certificate issuance errors
ALTER TABLE certificates
ADD CONSTRAINT fk_certificates_course_valid
FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

-- Add comment documenting the certificate_enabled column
COMMENT ON COLUMN courses.certificate_enabled IS
'Controls whether certificates are automatically issued when users complete this course.
When FALSE, no new certificates will be issued even if users complete the course.
Existing certificates are not affected.';

-- Log migration completion
SELECT now() as "Migration completed at";
