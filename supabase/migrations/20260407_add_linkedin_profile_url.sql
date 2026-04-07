-- ============================================================================
-- MIGRATION: Add LinkedIn Profile URL Column to Profiles Table
-- ============================================================================
-- This migration adds the linkedin_profile_url column to the profiles table
-- to support storing LinkedIn profile URLs for users
-- ============================================================================

-- Add linkedin_profile_url column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.linkedin_profile_url IS 'User LinkedIn profile URL for social integration';

-- Create index for potential queries on linkedin_profile_url
CREATE INDEX IF NOT EXISTS idx_profiles_linkedin_profile_url ON profiles(linkedin_profile_url);

-- Verify the column was added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'linkedin_profile_url';