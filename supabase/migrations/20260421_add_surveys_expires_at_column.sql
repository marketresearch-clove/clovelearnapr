-- Add an optional expiration date to surveys
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
