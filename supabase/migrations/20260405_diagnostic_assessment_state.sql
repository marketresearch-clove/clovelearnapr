-- ============================================================================
-- DIAGNOSTIC: Check Assessment Results Table State
-- ============================================================================

-- Check if updated_at column exists and its definition
SELECT 
  table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'assessment_results'
ORDER BY ordinal_position;

-- Check all functions related to assessment_results
SELECT 
  p.proname,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%assessment%' OR p.proname LIKE '%quiz%'
ORDER BY p.proname;

-- Check all triggers on assessment_results
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'assessment_results'
ORDER BY trigger_name;
