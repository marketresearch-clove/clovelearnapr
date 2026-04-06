-- ============================================================================
-- COMPLETE DATABASE SCHEMA REFERENCE
-- Skill Spire LMS - Supabase PostgreSQL Schema
-- ============================================================================

-- ============================================================================
-- TABLE CATEGORIES - Learning Area Classification
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE PROFILES - Extended User Information
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'student', -- admin, instructor, student, manager
  department TEXT,
  manager_id UUID REFERENCES profiles(id),
  phone_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE COURSES - Main Course Information
-- ============================================================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  category_id UUID REFERENCES categories(id),
  thumbnail_url TEXT,
  duration INTERVAL,
  duration_minutes INTEGER,
  is_published BOOLEAN DEFAULT FALSE,
  difficulty_level TEXT, -- beginner, intermediate, advanced
  prerequisites JSONB DEFAULT '[]',
  learning_objectives JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN DEFAULT FALSE
);

-- Create index for common queries
CREATE INDEX idx_courses_created_by ON courses(created_by);
CREATE INDEX idx_courses_category_id ON courses(category_id);
CREATE INDEX idx_courses_is_published ON courses(is_published);

-- ============================================================================
-- TABLE LESSONS - Individual Course Lessons
-- ============================================================================
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  lesson_type TEXT NOT NULL, -- text, video, quiz, flashcard, assessment
  content JSONB, -- Structured content blocks
  order_index INTEGER,
  duration INTERVAL,
  duration_minutes INTEGER,
  is_published BOOLEAN DEFAULT TRUE,
  resource_links JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lessons_course_id ON lessons(course_id);
CREATE INDEX idx_lessons_order ON lessons(course_id, order_index);

-- ============================================================================
-- TABLE ENROLLMENTS - Student Course Enrollment
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0, -- 0-100 percentage
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  marked_by_admin BOOLEAN DEFAULT FALSE,
  notes TEXT,
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);

-- ============================================================================
-- TABLE LESSON_PROGRESS - Individual Lesson Progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);

-- ============================================================================
-- TABLE QUIZZES - Quiz Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL, -- Array of question objects
  passing_score NUMERIC DEFAULT 70,
  time_limit_minutes INTEGER,
  shuffle_questions BOOLEAN DEFAULT FALSE,
  show_correct_answers BOOLEAN DEFAULT TRUE,
  max_attempts INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quizzes_lesson_id ON quizzes(lesson_id);

-- ============================================================================
-- TABLE QUIZ_RESULTS - Quiz Attempt Results
-- ============================================================================
CREATE TABLE IF NOT EXISTS quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  passed BOOLEAN,
  answers JSONB, -- User answers
  time_taken_seconds INTEGER,
  attempt_number INTEGER DEFAULT 1,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_quiz_id ON quiz_results(quiz_id);

-- ============================================================================
-- TABLE ASSESSMENTS - Course Assessments
-- ============================================================================
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assessment_type TEXT, -- project, exam, survey
  due_date TIMESTAMP WITH TIME ZONE,
  weight NUMERIC DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assessments_course_id ON assessments(course_id);

-- ============================================================================
-- TABLE ASSESSMENT_RESULTS - Assessment Submission Results
-- ============================================================================
CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  score NUMERIC,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' -- pending, submitted, graded
);

CREATE INDEX idx_assessment_results_user_id ON assessment_results(user_id);
CREATE INDEX idx_assessment_results_assessment_id ON assessment_results(assessment_id);

-- ============================================================================
-- TABLE FLASHCARD_SETS - Flashcard Study Sets
-- ============================================================================
CREATE TABLE IF NOT EXISTS flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_flashcard_sets_lesson_id ON flashcard_sets(lesson_id);
CREATE INDEX idx_flashcard_sets_created_by ON flashcard_sets(created_by);

-- ============================================================================
-- TABLE FLASHCARDS - Individual Flashcards
-- ============================================================================
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_set_id UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  image_url TEXT,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_flashcards_set_id ON flashcards(flashcard_set_id);

-- ============================================================================
-- TABLE FLASHCARD_PROGRESS - User Flashcard Learning Progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  difficulty_level INTEGER DEFAULT 0, -- 0-4 (again, hard, good, easy, very easy)
  interval_days INTEGER DEFAULT 1,
  easiness_factor NUMERIC DEFAULT 2.5,
  reviews_count INTEGER DEFAULT 0,
  next_review_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, flashcard_id)
);

CREATE INDEX idx_flashcard_progress_user_id ON flashcard_progress(user_id);
CREATE INDEX idx_flashcard_progress_next_review ON flashcard_progress(next_review_date);

-- ============================================================================
-- TABLE SKILLS - Professional Skills
-- ============================================================================
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  type TEXT, -- technical, soft, language
  proficiency_levels JSONB DEFAULT '["beginner", "intermediate", "advanced", "expert"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE SKILL_FAMILIES - Skill Groupings
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES skill_families(id),
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE SKILL_COURSE_MAPPINGS - Links Skills to Courses
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_course_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  proficiency_level TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  generated_by_ai BOOLEAN DEFAULT FALSE,
  ai_generated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(skill_id, course_id)
);

CREATE INDEX idx_skill_course_mappings_generated_by_ai ON skill_course_mappings(generated_by_ai);

-- ============================================================================
-- TABLE USER_SKILL_ACHIEVEMENTS - Track User Skill Progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_skill_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_level TEXT,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES profiles(id),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skill_achievements_user_id ON user_skill_achievements(user_id);

-- ============================================================================
-- TABLE CAREER_PATHS - Career Development Paths
-- ============================================================================
CREATE TABLE IF NOT EXISTS career_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  required_skills JSONB DEFAULT '[]',
  recommended_courses JSONB DEFAULT '[]',
  duration_months INTEGER,
  difficulty_level TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_career_paths_created_by ON career_paths(created_by);

-- ============================================================================
-- TABLE USER_CAREER_PATHS - Track User Career Path Progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_career_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  career_path_id UUID NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  start_date DATE DEFAULT CURRENT_DATE,
  completion_percentage INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, career_path_id)
);

-- ============================================================================
-- TABLE LEARNING_JOURNEYS - Guided Learning Paths
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  duration_weeks INTEGER,
  difficulty TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE JOURNEY_MODULES - Modules within Learning Journeys
-- ============================================================================
CREATE TABLE IF NOT EXISTS journey_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_journey_id UUID NOT NULL REFERENCES learning_journeys(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  module_order INTEGER,
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE NOTIFICATIONS - User Notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT, -- course_update, assignment, grade, achievement
  reference_type TEXT, -- course, assignment, quiz
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================================================
-- TABLE NOTIFICATION_LOGS - Detailed Notification Delivery Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT, -- whatsapp, email, in_app
  status TEXT DEFAULT 'queued', -- queued, sent, delivered, read, failed
  message_body TEXT,
  title TEXT,
  whatsapp_message_id TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);

-- ============================================================================
-- TABLE NOTIFICATION_AUTO_SEND_RULES - Automated Notification Rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_auto_send_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- course_due, task_pending, low_engagement, inactive_user
  trigger_params JSONB,
  title TEXT,
  message TEXT,
  type TEXT, -- reminder, announcement
  priority INTEGER DEFAULT 2,
  send_after_days INTEGER DEFAULT 0,
  max_sends_per_user INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE COURSE_FEEDBACK - User Ratings and Reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS course_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- ============================================================================
-- TABLE CERTIFICATES - Course Completion Certificates
-- ============================================================================
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id),
  certificate_number TEXT UNIQUE,
  verified_by UUID REFERENCES profiles(id),
  issued_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expiry_date TIMESTAMP WITH TIME ZONE,
  verification_token TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE COURSE_ASSIGNMENTS - Administrative Course Assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  is_mandatory BOOLEAN DEFAULT FALSE,
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

-- ============================================================================
-- TABLE USER_STATISTICS - User Learning Statistics
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  courses_enrolled INTEGER DEFAULT 0,
  courses_completed INTEGER DEFAULT 0,
  total_learning_hours NUMERIC DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE LEARNING_HOURS - Track Learning Time
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  hours NUMERIC DEFAULT 0,
  minutes INTEGER DEFAULT 0,
  logged_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE CALENDAR_EVENTS - Course/Assignment Calendar Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  event_type TEXT, -- assignment_due, assessment, course_start, course_end
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Course completion statistics
CREATE OR REPLACE VIEW v_pass_rate AS
SELECT 
  c.id,
  c.title,
  COUNT(e.id) as total_enrollments,
  COUNT(CASE WHEN e.is_completed THEN 1 END) as completed_enrollments,
  ROUND(
    COUNT(CASE WHEN e.is_completed THEN 1 END)::numeric / 
    NULLIF(COUNT(e.id), 0) * 100, 2
  ) as completion_percentage
FROM courses c
LEFT JOIN enrollments e ON c.id = e.course_id
GROUP BY c.id, c.title;

-- View: Skill coverage by course
CREATE OR REPLACE VIEW v_skill_coverage AS
SELECT 
  c.id as course_id,
  c.title as course_title,
  COUNT(DISTINCT scm.skill_id) as skills_count,
  ARRAY_AGG(DISTINCT s.name) as skill_names
FROM courses c
LEFT JOIN skill_course_mappings scm ON c.id = scm.course_id
LEFT JOIN skills s ON scm.skill_id = s.id
GROUP BY c.id, c.title;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for frequently queried combinations
CREATE INDEX idx_enrollments_user_course ON enrollments(user_id, course_id);
CREATE INDEX idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);
CREATE INDEX idx_assessment_results_user_assessment ON assessment_results(user_id, assessment_id);
CREATE INDEX idx_quiz_results_user_quiz ON quiz_results(user_id, quiz_id);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- ============================================================================
-- END OF SCHEMA DEFINITION
-- ============================================================================
-- Total Tables: 50+ in public schema
-- Additional tables in: auth schema (21), storage schema (8), realtime schema (8)
-- ============================================================================
