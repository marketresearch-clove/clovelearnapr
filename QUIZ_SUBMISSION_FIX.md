# Quiz Submission Error Fix (updated_at Trigger Issue)

## Issue Summary
When learners submitted a quiz, the browser console showed:
```
Error: record "new" has no field "updated_at" (code: 42703)
POST https://veaawiernjkdsfiziqen.supabase.co/rest/v1/assessment_results 400 (Bad Request)
```

## Root Cause
The `assessment_results` table has an `updated_at` column, but there was no trigger function to automatically set this field on INSERT. When triggers or constraints tried to reference this field during insert, PostgreSQL threw error `42703: undefined_column` because the field wasn't being populated.

## Solution Applied
Updated the migration file: `supabase/migrations/20260405_fix_assessment_results_RLS_and_triggers.sql`

### Changes Made:

1. **Added BEFORE trigger for automatic `updated_at` update**:
   ```sql
   CREATE FUNCTION trigger_update_updated_at()
   RETURNS TRIGGER
   LANGUAGE plpgsql
   AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$;

   CREATE TRIGGER trigger_update_assessment_results_updated_at
   BEFORE INSERT OR UPDATE ON assessment_results
   FOR EACH ROW
   EXECUTE FUNCTION trigger_update_updated_at();
   ```

2. **Trigger Execution Order**:
   - `BEFORE` trigger: Sets `updated_at = NOW()` on INSERT/UPDATE
   - `AFTER` trigger: Handles business logic (marking lesson as complete)

### Why This Works
- The BEFORE trigger ensures `updated_at` is always populated before any AFTER triggers or constraints fire
- Prevents "field does not exist" errors when the database tries to reference this field
- Automatically maintains the `updated_at` timestamp for every insert and update

## Files Modified
- `supabase/migrations/20260405_fix_assessment_results_RLS_and_triggers.sql`

## Deployment
1. Run the updated migration in your Supabase project
2. Test quiz submission - should now work without errors
3. The `assessment_results` table will correctly record timestamps for all new submissions

## Testing
After applying the fix:
1. Submit a quiz as a learner
2. Check browser console - should not show 400 error
3. Check Supabase dashboard - `assessment_results` table should have new entry with `updated_at` populated
