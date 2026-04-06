-- Migration: Add created_at column to profiles table
-- Purpose: Track when user profiles were created
-- Date: April 5, 2026

-- ============================================================================
-- Step 1: Add created_at column to profiles table
-- ============================================================================
ALTER TABLE public.profiles
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- Step 2: Create index on created_at for query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- ============================================================================
-- Step 3: Update existing records with a reasonable timestamp
-- ============================================================================
UPDATE public.profiles
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

-- ============================================================================
-- Step 4: Make created_at NOT NULL
-- ============================================================================
ALTER TABLE public.profiles
ALTER COLUMN created_at SET NOT NULL;

-- ============================================================================
-- Verification
-- ============================================================================
-- To verify the column was added:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'created_at';
