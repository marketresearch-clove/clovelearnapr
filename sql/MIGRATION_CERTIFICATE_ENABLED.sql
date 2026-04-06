-- Migration: Add certificate_enabled column to courses table
-- Allows admins to enable/disable certificate generation per course

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS certificate_enabled boolean NOT NULL DEFAULT true;

-- Backfill: existing courses default to certificate enabled
UPDATE courses SET certificate_enabled = true WHERE certificate_enabled IS NULL;
