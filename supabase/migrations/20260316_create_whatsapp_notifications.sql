-- WhatsApp Notification System Migration
-- Created: 2026-03-16
-- Purpose: Create tables and policies for WhatsApp notifications

-- ============================================================================
-- 1. EXTEND PROFILES TABLE
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "enrollment": true,
  "inactivity_reminder": true,
  "deadline_reminder": true,
  "weekly_summary": false,
  "certificate": true,
  "new_course": false
}'::jsonb;

-- Create index on phone number for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);

-- ============================================================================
-- 2. EXTEND ENROLLMENTS TABLE
-- ============================================================================
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS enrollment_reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS inactivity_reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS deadline_reminder_sent BOOLEAN DEFAULT false;

-- Create indexes for tracking
CREATE INDEX IF NOT EXISTS idx_enrollments_last_activity ON enrollments(last_activity);
CREATE INDEX IF NOT EXISTS idx_enrollments_reminders ON enrollments(enrollment_reminder_sent, inactivity_reminder_sent, deadline_reminder_sent);

-- ============================================================================
-- 3. CREATE NOTIFICATION_QUEUE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL, -- 'enrollment', 'inactivity_reminder', 'deadline_reminder', 'weekly_summary', 'certificate_awarded', 'new_course_recommendation'
  status VARCHAR(20) DEFAULT 'queued', -- 'queued', 'processing', 'sent', 'failed'
  priority INTEGER DEFAULT 1, -- 1-5, higher = more urgent
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  template_params JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  processing_started_at TIMESTAMP,
  sent_at TIMESTAMP
);

-- Indexes for queue management
CREATE INDEX IF NOT EXISTS idx_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_user ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_created ON notification_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON notification_queue(priority DESC, created_at ASC);

-- Enable RLS on notification_queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queue"
  ON notification_queue FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service can manage queue"
  ON notification_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4. CREATE NOTIFICATION_LOGS TABLE (Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  whatsapp_message_id TEXT,
  error_message TEXT
);

-- Indexes for log queries
CREATE INDEX IF NOT EXISTS idx_logs_user ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_message_type ON notification_logs(message_type);
CREATE INDEX IF NOT EXISTS idx_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_created ON notification_logs(created_at DESC);

-- Enable RLS on notification_logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs"
  ON notification_logs FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service can manage logs"
  ON notification_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 5. CREATE WHATSAPP_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE, -- Template identifier
  meta_template_name VARCHAR(100) NOT NULL, -- Name in Meta dashboard
  message_type VARCHAR(50) NOT NULL,
  body TEXT NOT NULL, -- Template with {{param}} placeholders
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default templates
INSERT INTO whatsapp_templates (name, meta_template_name, message_type, body) VALUES
  ('course_enrollment', 'course_enrollment_welcome', 'enrollment', 'Welcome to {{course_name}}! Excited to have you join us. Get started now!'),
  ('inactivity_reminder', 'inactivity_reminder', 'inactivity_reminder', 'Hi {{first_name}}, we miss you in {{course_name}}! Come back and continue learning.'),
  ('deadline_reminder', 'course_deadline_reminder', 'deadline_reminder', '{{first_name}}, remember {{course_name}} is due in 2 days. Finish strong!'),
  ('weekly_summary', 'weekly_summary', 'weekly_summary', 'Your weekly update: {{week_progress}}% progress in {{course_name}}.'),
  ('certificate_awarded', 'certificate_awarded', 'certificate_awarded', 'Congratulations {{first_name}}! You''ve completed {{course_name}}. Certificate ready!'),
  ('new_course_recommendation', 'new_course_recommendation', 'new_course_recommendation', 'Based on your interests, check out {{recommended_course}} - perfect for you!')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 6. CREATE MONITORING VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW notification_stats_daily AS
SELECT
  DATE(sent_at) as date,
  message_type,
  COUNT(*) as total_sent,
  SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
  SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) / COUNT(*), 2) as delivery_rate,
  ROUND(100.0 * SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) / COUNT(*), 2) as read_rate
FROM notification_logs
WHERE sent_at IS NOT NULL
GROUP BY DATE(sent_at), message_type
ORDER BY date DESC, message_type;

CREATE OR REPLACE VIEW notification_queue_status AS
SELECT
  status,
  message_type,
  COUNT(*) as count,
  MAX(created_at) as oldest_item,
  MIN(priority) as lowest_priority
FROM notification_queue
GROUP BY status, message_type
ORDER BY status, message_type;

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_logs TO authenticated;
GRANT SELECT ON whatsapp_templates TO authenticated;
GRANT SELECT ON notification_stats_daily TO authenticated;
GRANT SELECT ON notification_queue_status TO authenticated;

-- Service role gets full access (managed by RLS policies)
GRANT ALL ON notification_queue TO service_role;
GRANT ALL ON notification_logs TO service_role;
GRANT ALL ON whatsapp_templates TO service_role;
