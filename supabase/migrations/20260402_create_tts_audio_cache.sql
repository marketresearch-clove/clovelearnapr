-- Create lesson_audio_cache table for TTS audio caching
-- This table stores metadata about generated audio files for lessons

CREATE TABLE IF NOT EXISTS public.lesson_audio_cache (
  id BIGSERIAL PRIMARY KEY,
  lesson_id UUID NOT NULL,
  block_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  audio_url TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('piper', 'browser')),
  duration INTEGER NOT NULL, -- Duration in seconds
  file_path TEXT, -- Path in Supabase Storage if uploaded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicate caches
  UNIQUE(lesson_id, block_id, chunk_index)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_audio_cache_lesson_id ON public.lesson_audio_cache(lesson_id);
CREATE INDEX IF NOT EXISTS idx_audio_cache_created_at ON public.lesson_audio_cache(created_at);

-- Add RLS policies for security
ALTER TABLE public.lesson_audio_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read audio cache (it's public learning content)
CREATE POLICY "Audio cache is viewable by learners" ON public.lesson_audio_cache
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update/delete audio cache
CREATE POLICY "Only admins can manage audio cache" ON public.lesson_audio_cache
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

CREATE POLICY "Only admins can update audio cache" ON public.lesson_audio_cache
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

CREATE POLICY "Only admins can delete audio cache" ON public.lesson_audio_cache
  FOR DELETE
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Create lesson_tts_settings table for course-level TTS preferences
CREATE TABLE IF NOT EXISTS public.lesson_tts_settings (
  id BIGSERIAL PRIMARY KEY,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  
  -- TTS Provider settings
  default_provider TEXT NOT NULL DEFAULT 'piper' CHECK (default_provider IN ('piper', 'browser')),
  fallback_provider TEXT NOT NULL DEFAULT 'browser' CHECK (fallback_provider IN ('piper', 'browser')),
  
  -- Quality settings
  lecture_quality TEXT NOT NULL DEFAULT 'high' CHECK (lecture_quality IN ('high', 'medium', 'low')),
  summary_quality TEXT NOT NULL DEFAULT 'medium' CHECK (summary_quality IN ('high', 'medium', 'low')),
  
  -- Voice preferences
  voice_gender TEXT NOT NULL DEFAULT 'female' CHECK (voice_gender IN ('male', 'female')),
  
  -- Enable/Disable features
  auto_pause_enabled BOOLEAN DEFAULT true,
  cache_audio BOOLEAN DEFAULT true,
  preload_audio BOOLEAN DEFAULT false,
  
  -- Speed control
  default_speed DECIMAL(3, 2) DEFAULT 1.0,
  min_speed DECIMAL(3, 2) DEFAULT 0.5,
  max_speed DECIMAL(3, 2) DEFAULT 2.0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(lesson_id),
  UNIQUE(course_id)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tts_settings_lesson_id ON public.lesson_tts_settings(lesson_id);
CREATE INDEX IF NOT EXISTS idx_tts_settings_course_id ON public.lesson_tts_settings(course_id);

-- Add RLS policies
ALTER TABLE public.lesson_tts_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Learners can view TTS settings
CREATE POLICY "TTS settings are viewable by learners" ON public.lesson_tts_settings
  FOR SELECT
  USING (true);

-- Policy: Only course instructors/admins can modify TTS settings
CREATE POLICY "Only instructors can modify TTS settings" ON public.lesson_tts_settings
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = lesson_tts_settings.course_id
    AND (c.instructor_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    ))
  ));

CREATE POLICY "Only instructors can update TTS settings" ON public.lesson_tts_settings
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = lesson_tts_settings.course_id
    AND (c.instructor_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    ))
  ));

-- Function to clean up old audio cache automatically
CREATE OR REPLACE FUNCTION public.cleanup_old_audio_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Delete audio cache entries older than 30 days
  DELETE FROM public.lesson_audio_cache
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Cleaned up old audio cache entries';
END;
$$;

-- Optional: Create a scheduled job to clean up old cache (requires pg_cron)
-- SELECT cron.schedule('cleanup_audio_cache', '0 2 * * *', 'SELECT public.cleanup_old_audio_cache()');
