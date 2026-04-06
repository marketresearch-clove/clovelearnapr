-- Add is_visible column to course_assignments table
-- This allows admins to hide courses from specific users without deleting the assignment record

ALTER TABLE course_assignments 
ADD COLUMN is_visible BOOLEAN DEFAULT true;

-- Create an index for faster queries filtering by visibility
CREATE INDEX idx_course_assignments_visibility ON course_assignments(userid, courseid, is_visible);

-- Add comment explaining the column
COMMENT ON COLUMN course_assignments.is_visible IS 'Controls whether the course assignment is visible to the user. When false, the course is hidden from the user but the assignment record is preserved for history/auditing.';
