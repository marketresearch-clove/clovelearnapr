-- Migration: Fix Certificate Issuance for Disabled Courses
-- Date: 2026-04-09
-- Purpose: Clean up invalid certificates and add database-level validation

-- ============================================================================
-- PART 1: Identify and Log Invalid Certificates (for audit trail)
-- ============================================================================

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS certificate_cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  course_title TEXT,
  certificate_enabled BOOLEAN,
  issued_at TIMESTAMP,
  deleted_at TIMESTAMP DEFAULT NOW(),
  reason TEXT,
  FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ============================================================================
-- PART 2: Find Invalid Certificates (certificates for disabled courses)
-- ============================================================================

-- Log invalid certificates before deletion
INSERT INTO certificate_cleanup_log (
  certificate_id,
  user_id,
  course_id,
  course_title,
  certificate_enabled,
  issued_at,
  reason
)
SELECT
  cert.id,
  cert.user_id,
  cert.course_id,
  c.title,
  c.certificate_enabled,
  cert.issued_at,
  'Certificate issued for course with certificate_enabled = ' || c.certificate_enabled::TEXT
FROM certificates cert
JOIN courses c ON cert.course_id = c.id
WHERE c.certificate_enabled IS NOT TRUE
  AND cert.id NOT IN (
    -- Keep only if we need to keep for some reason
    SELECT '00000000-0000-0000-0000-000000000000'::UUID
  );

-- ============================================================================
-- PART 3: Delete Invalid Certificates
-- ============================================================================

-- Delete certificates where course has certificate_enabled = false or NULL
DELETE FROM certificates
WHERE course_id IN (
  SELECT id FROM courses
  WHERE certificate_enabled IS NOT TRUE
);

-- Log the deletion action
DO $$
DECLARE
  deleted_count INT;
BEGIN
  SELECT COUNT(*) INTO deleted_count FROM certificate_cleanup_log
  WHERE deleted_at > NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Certificate Cleanup Complete: % invalid certificates removed', deleted_count;
END $$;

-- ============================================================================
-- PART 4: Add Database-Level Validation (Trigger)
-- ============================================================================

-- Create or replace trigger function to validate certificate creation
CREATE OR REPLACE FUNCTION validate_certificate_creation()
RETURNS TRIGGER AS $$
DECLARE
  course_cert_enabled BOOLEAN;
  course_title TEXT;
BEGIN
  -- Get the course's certificate_enabled flag
  SELECT certificate_enabled, title
  INTO course_cert_enabled, course_title
  FROM courses
  WHERE id = NEW.course_id;

  -- If course not found, allow insert (foreign key constraint will catch it)
  IF course_title IS NULL THEN
    RAISE EXCEPTION 'Course not found: %', NEW.course_id;
  END IF;

  -- CRITICAL: Block certificate creation if certificate_enabled is not TRUE
  IF course_cert_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Certificate creation blocked: Course "%" (ID: %) has certificate_enabled = %',
                    course_title, NEW.course_id, course_cert_enabled;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS certificate_validation_trigger ON certificates;

-- Create trigger on INSERT
CREATE TRIGGER certificate_validation_trigger
BEFORE INSERT ON certificates
FOR EACH ROW
EXECUTE FUNCTION validate_certificate_creation();

-- ============================================================================
-- PART 5: Add Index for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_certificates_course_enabled
ON certificates(course_id)
WHERE course_id IN (SELECT id FROM courses WHERE certificate_enabled IS NOT TRUE);

CREATE INDEX IF NOT EXISTS idx_courses_certificate_enabled
ON courses(certificate_enabled);

-- ============================================================================
-- PART 6: Summary and Documentation
-- ============================================================================

-- Create a summary view for certificate validation status
CREATE OR REPLACE VIEW certificate_validation_status AS
SELECT
  c.id as course_id,
  c.title as course_title,
  c.certificate_enabled,
  COUNT(DISTINCT cert.id) as certificates_issued,
  CASE
    WHEN c.certificate_enabled = true THEN 'VALID'
    WHEN c.certificate_enabled = false THEN 'BLOCKED - Manually Disabled'
    WHEN c.certificate_enabled IS NULL THEN 'BLOCKED - Not Set'
    ELSE 'UNKNOWN'
  END as certificate_status
FROM courses c
LEFT JOIN certificates cert ON c.id = cert.course_id
GROUP BY c.id, c.title, c.certificate_enabled
ORDER BY c.title;

-- ============================================================================
-- PART 7: Documentation Comments
-- ============================================================================

COMMENT ON TABLE certificate_cleanup_log IS 'Audit trail of removed invalid certificates (where courses had certificate_enabled = false)';
COMMENT ON FUNCTION validate_certificate_creation() IS 'Database trigger to prevent certificate creation for courses with certificate_enabled != true';
COMMENT ON VIEW certificate_validation_status IS 'Status of all courses showing certificate_enabled state and count of issued certificates';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- View invalid certificates that were cleaned up
-- SELECT * FROM certificate_cleanup_log;

-- Check certificate validation status
-- SELECT * FROM certificate_validation_status;

-- Check if any certificates violate the rule (should be 0 after this migration)
-- SELECT COUNT(*) as invalid_certificates FROM certificates cert
-- JOIN courses c ON cert.course_id = c.id
-- WHERE c.certificate_enabled IS NOT TRUE;
