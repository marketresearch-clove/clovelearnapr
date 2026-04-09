# Implementation Guide: Database Migrations & Code Changes

**Priority**: 🔴 CRITICAL - Address immediately
**Effort**: 3-4 weeks
**Testing**: Required for each migration

---

## 📋 Checklist: Required Migrations

```
WEEK 1 - CRITICAL FOUNDATION
[  ] 1. Add transaction RPC function
[  ] 2. Fix course_id in lesson_progress
[  ] 3. Add course_id index
[  ] 4. Fix SQL VIEW joins

WEEK 2 - DATA NORMALIZATION
[  ] 5. Migrate to duration_seconds (single unit)
[  ] 6. Create aggregation views
[  ] 7. Add reconciliation function

WEEK 3 - OPTIONAL ENHANCEMENTS
[  ] 8. Add learning_sessions table
[  ] 9. Improve video duration parsing
[  ] 10. Add idle detection
```

---

## 🔴 WEEK 1: CRITICAL FOUNDATION

### Migration #1: Create Transaction RPC Function

**File**: `supabase/migrations/20260410_01_create_transaction_rpc.sql`

```sql
-- ============================================================================
-- MIGRATION: Create atomic transaction function for learning sessions
-- Issue: Currently lesson_progress, learning_hours, and user_statistics
--        are updated separately with no guarantee of consistency
-- Solution: Wrap in PostgreSQL RPC function (ACID transaction)
-- ============================================================================

-- Drop if exists
DROP FUNCTION IF EXISTS public.record_learning_session CASCADE;

-- Create atomic function
CREATE OR REPLACE FUNCTION public.record_learning_session(
  p_user_id UUID,
  p_lesson_id UUID,
  p_course_id UUID,
  p_duration_seconds INT,
  p_progress_pct INT,
  p_completed BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  lesson_progress_id UUID,
  learning_hours_id UUID,
  user_stats_updated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lp_id UUID;
  v_lh_id UUID;
  v_course_id_resolved UUID;
  v_duration_minutes INT;
BEGIN
  -- Validate inputs
  IF p_duration_seconds < 0 THEN
    RETURN QUERY SELECT false, 'Duration cannot be negative', NULL::UUID, NULL::UUID, false;
    RETURN;
  END IF;

  -- Convert to minutes for storage
  v_duration_minutes := CEIL(p_duration_seconds::NUMERIC / 60);

  -- Convert seconds to minutes for storage
  v_duration_minutes := CEIL(p_duration_seconds::NUMERIC / 60);

  -- Resolve course_id from lesson (in case not provided)
  IF p_course_id IS NULL THEN
    SELECT l.course_id INTO v_course_id_resolved
    FROM lessons l
    WHERE l.id = p_lesson_id;
  ELSE
    v_course_id_resolved := p_course_id;
  END IF;

  -- =========================================================================
  -- TRANSACTION STEP 1: Update/Insert lesson_progress
  -- =========================================================================
  BEGIN
    INSERT INTO lesson_progress (
      user_id, lesson_id, course_id, 
      time_spent_seconds, progress, is_completed,
      last_accessed, updated_at
    ) VALUES (
      p_user_id, p_lesson_id, v_course_id_resolved,
      p_duration_seconds, p_progress_pct, p_completed,
      NOW(), NOW()
    ) ON CONFLICT (user_id, lesson_id) DO UPDATE SET
      time_spent_seconds = lesson_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
      progress = GREATEST(lesson_progress.progress, EXCLUDED.progress),
      is_completed = lesson_progress.is_completed OR EXCLUDED.is_completed,
      completed_at = CASE 
        WHEN EXCLUDED.is_completed THEN NOW()
        ELSE lesson_progress.completed_at
      END,
      last_accessed = NOW(),
      updated_at = NOW()
    RETURNING id INTO v_lp_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      false, 
      'Error updating lesson_progress: ' || SQLERRM,
      NULL::UUID, NULL::UUID, false;
    ROLLBACK;
    RETURN;
  END;

  -- =========================================================================
  -- TRANSACTION STEP 2: Update/Insert learning_hours
  -- =========================================================================
  BEGIN
    INSERT INTO learning_hours (
      user_id, course_id, duration_seconds,
      logged_date, created_at, updated_at
    ) VALUES (
      p_user_id, v_course_id_resolved, p_duration_seconds,
      CURRENT_DATE, NOW(), NOW()
    ) ON CONFLICT (user_id, course_id, logged_date) DO UPDATE SET
      duration_seconds = learning_hours.duration_seconds + EXCLUDED.duration_seconds,
      updated_at = NOW()
    RETURNING id INTO v_lh_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      false, 
      'Error updating learning_hours: ' || SQLERRM,
      v_lp_id, NULL::UUID, false;
    ROLLBACK;
    RETURN;
  END;

  -- =========================================================================
  -- TRANSACTION STEP 3: Update user_statistics
  -- =========================================================================
  BEGIN
    INSERT INTO user_statistics (
      user_id, courses_enrolled, courses_completed, 
      total_learning_hours, last_activity_date
    ) VALUES (
      p_user_id, 1, 0,
      p_duration_seconds / 3600.0, CURRENT_DATE
    ) ON CONFLICT (user_id) DO UPDATE SET
      total_learning_hours = user_statistics.total_learning_hours + 
                            (EXCLUDED.total_learning_hours),
      last_activity_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM user_statistics WHERE user_id = p_user_id
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      false, 
      'Error updating user_statistics: ' || SQLERRM,
      v_lp_id, v_lh_id, false;
    ROLLBACK;
    RETURN;
  END;

  -- All steps succeeded
  RETURN QUERY SELECT 
    true as success,
    NULL::TEXT as error_message,
    v_lp_id,
    v_lh_id,
    true as user_stats_updated;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false, 
    'Unhandled error: ' || SQLERRM,
    NULL::UUID, NULL::UUID, false;
  ROLLBACK;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.record_learning_session 
TO authenticated, service_role;

COMMENT ON FUNCTION public.record_learning_session 
IS 'Atomic transaction for recording learning sessions. Updates lesson_progress, learning_hours, and user_statistics in a single ACID transaction.';
```

### Migration #2: Add course_id to lesson_progress

**File**: `supabase/migrations/20260410_02_add_course_id_to_lesson_progress.sql`

```sql
-- ============================================================================
-- MIGRATION: Add course_id denormalized column to lesson_progress
-- Issue: Queries require lesson → course join for every user filter
-- Solution: Denormalize course_id directly in lesson_progress
-- Performance: O(n) joins → O(1) index lookup
-- ============================================================================

-- Step 1: Add column
ALTER TABLE lesson_progress
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

-- Step 2: Populate from lessons for existing records
UPDATE lesson_progress lp
SET course_id = l.course_id
FROM lessons l
WHERE lp.lesson_id = l.id
  AND lp.course_id IS NULL;

-- Step 3: Create trigger to auto-populate on INSERT
DROP TRIGGER IF EXISTS lesson_progress_set_course_id ON lesson_progress;

CREATE OR REPLACE FUNCTION set_lesson_progress_course_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate course_id from lesson
  IF NEW.course_id IS NULL THEN
    SELECT l.course_id INTO NEW.course_id
    FROM lessons l
    WHERE l.id = NEW.lesson_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_progress_set_course_id
BEFORE INSERT ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION set_lesson_progress_course_id();

-- Step 4: Remove broken index if exists
DROP INDEX IF EXISTS idx_lesson_progress_userid_courseid;

-- Step 5: Create proper performance index
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course_date
ON lesson_progress(user_id, course_id, updated_at DESC);

-- Step 6: Add constraint validation
ALTER TABLE lesson_progress
ADD CONSTRAINT lesson_progress_course_consistency
CHECK (course_id IS NOT NULL);

-- Grant permissions
COMMENT ON COLUMN lesson_progress.course_id 
IS 'Denormalized course_id for query performance. Auto-populated from lessons table.';
```

### Migration #3: Fix SQL VIEW with Correct JOINs

**File**: `supabase/migrations/20260410_03_fix_module_learning_stats_view.sql`

```sql
-- ============================================================================
-- MIGRATION: Fix v_module_learning_stats VIEW
-- Issue: Courses table (c) referenced before JOIN, broken COLUMN references
-- Solution: Reorder JOINs, use correct columns, use seconds not hours
-- ============================================================================

-- Drop broken view
DROP VIEW IF EXISTS public.module_learning_stats_summary CASCADE;
DROP VIEW IF EXISTS public.v_module_learning_stats CASCADE;

-- Create fixed view
CREATE OR REPLACE VIEW v_module_learning_stats AS
SELECT
  l.id as lesson_id,
  l.title as lesson_name,
  l.lesson_type,
  c.id as course_id,
  c.title as course_title,
  COALESCE(cat.name, 'Uncategorized') as category,
  
  -- Enrollment statistics
  COUNT(DISTINCT e.user_id) as total_users_enrolled,
  COUNT(DISTINCT CASE WHEN e.is_completed THEN e.user_id END) as users_completed,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.user_id) = 0 THEN 0
      ELSE COUNT(DISTINCT CASE WHEN e.is_completed THEN e.user_id END)::NUMERIC /
           COUNT(DISTINCT e.user_id) * 100
    END, 1
  ) as completion_percentage,
  
  -- Time tracking statistics (SOURCE OF TRUTH: time_spent_seconds)
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 1) as total_hours_spent,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.user_id) = 0 THEN 0
      ELSE SUM(lp.time_spent_seconds)::NUMERIC / COUNT(DISTINCT e.user_id) / 3600
    END, 1
  ) as avg_hours_per_user,
  
  -- Completion tracking
  MAX(lp.completed_at)::DATE as last_completion_date,
  COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.user_id END) as users_who_completed

FROM lessons l
  LEFT JOIN courses c ON l.course_id = c.id  -- ← JOIN FIRST
  LEFT JOIN categories cat ON c.category_id = cat.id
  LEFT JOIN enrollments e ON c.id = e.course_id  -- Now c is available
  LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id 
                              AND e.user_id = lp.user_id

WHERE l.id IS NOT NULL

GROUP BY
  l.id, l.title, l.lesson_type,
  c.id, c.title,
  cat.name

ORDER BY c.title, l.title;

-- Grant permissions
GRANT SELECT ON v_module_learning_stats TO authenticated, service_role;

COMMENT ON VIEW v_module_learning_stats 
IS 'Aggregated learning statistics per lesson/module. Data sourced from lesson_progress (time_spent_seconds).';
```

---

## 🟡 WEEK 2: DATA NORMALIZATION

### Migration #4: Normalize Duration Storage

**File**: `supabase/migrations/20260410_04_normalize_duration_storage.sql`

```sql
-- ============================================================================
-- MIGRATION: Consolidate hours + minutes → duration_seconds
-- Issue: NUMERIC precision errors, dual storage risk
-- Solution: Use INTEGER seconds only, convert on display
-- ============================================================================

-- Step 1: Add new column
ALTER TABLE learning_hours
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

-- Step 2: Migrate data (hours + minutes→ seconds)
UPDATE learning_hours SET
  duration_seconds = CASE
    WHEN hours > 0 THEN (hours * 3600)::INT + COALESCE(minutes * 60, 0)
    WHEN minutes > 0 THEN minutes * 60
    ELSE 0
  END
WHERE duration_seconds = 0;

-- Step 3: Add constraint (0-7 days max)
ALTER TABLE learning_hours
ADD CONSTRAINT duration_seconds_valid
CHECK (duration_seconds >= 0 AND duration_seconds <= 604800);

-- Step 4: Create view for backward compatibility
CREATE OR REPLACE VIEW learning_hours_formatted AS
SELECT 
  id,
  user_id,
  course_id,
  duration_seconds,
  FLOOR(duration_seconds / 3600)::INT as hours_component,
  FLOOR(MOD(duration_seconds, 3600) / 60)::INT as minutes_component,
  ROUND((duration_seconds / 3600.0)::NUMERIC, 1) as hours_decimal,
  logged_date,
  created_at,
  updated_at
FROM learning_hours;

-- Step 5: Drop old columns (after verification)
-- DELAYED: Verify views/queries work first
-- ALTER TABLE learning_hours DROP COLUMN hours, DROP COLUMN minutes;

-- Grant permissions
GRANT SELECT ON learning_hours_formatted TO authenticated, service_role;
```

### Migration #5: Create Aggregation Views

**File**: `supabase/migrations/20260410_05_create_aggregation_views.sql`

```sql
-- ============================================================================
-- MIGRATION: Centralize all aggregation logic in SQL views
-- Issue: Same calculations in 5+ places (services, frontend, views)
-- Solution: Single source of aggregation logic
-- ============================================================================

-- View 1: User Learning Summary
CREATE OR REPLACE VIEW v_user_learning_summary AS
SELECT 
  us.user_id,
  COUNT(DISTINCT e.course_id) as courses_enrolled,
  COUNT(DISTINCT CASE WHEN e.is_completed THEN e.course_id END) as courses_completed,
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 1) as total_hours,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.course_id) = 0 THEN 0
      ELSE AVG(e.progress)
    END,
    1
  ) as avg_course_progress,
  MAX(lp.updated_at) as last_activity_at
FROM user_statistics us
  LEFT JOIN enrollments e ON us.user_id = e.user_id
  LEFT JOIN lesson_progress lp ON us.user_id = lp.user_id
GROUP BY us.user_id;

-- View 2: Course Learning Summary
CREATE OR REPLACE VIEW v_course_learning_summary AS
SELECT 
  c.id as course_id,
  c.title,
  COUNT(DISTINCT e.user_id) as total_enrollees,
  COUNT(DISTINCT CASE WHEN e.is_completed THEN e.user_id END) as completed_users,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.user_id) = 0 THEN 0
      ELSE COUNT(DISTINCT CASE WHEN e.is_completed THEN e.user_id END)::NUMERIC / 
           COUNT(DISTINCT e.user_id) * 100
    END, 1
  ) as completion_rate,
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 1) as total_hours_spent,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.user_id) = 0 THEN 0
      ELSE SUM(lp.time_spent_seconds)::NUMERIC / COUNT(DISTINCT e.user_id) / 3600
    END, 1
  ) as avg_hours_per_user
FROM courses c
  LEFT JOIN enrollments e ON c.id = e.course_id
  LEFT JOIN lessons l ON c.id = l.course_id
  LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id
GROUP BY c.id, c.title;

-- View 3: User-Course Learning Progress
CREATE OR REPLACE VIEW v_user_course_progress AS
SELECT 
  e.user_id,
  e.course_id,
  COUNT(DISTINCT l.id) as total_lessons,
  COUNT(DISTINCT CASE WHEN lp.is_completed THEN l.id END) as completed_lessons,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT l.id) = 0 THEN 0
      ELSE COUNT(DISTINCT CASE WHEN lp.is_completed THEN l.id END)::NUMERIC / 
           COUNT(DISTINCT l.id) * 100
    END, 1
  ) as completion_percentage,
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 1) as hours_spent,
  MAX(lp.updated_at) as last_accessed_at
FROM enrollments e
  LEFT JOIN lessons l ON e.course_id = l.course_id
  LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id 
                              AND e.user_id = lp.user_id
GROUP BY e.user_id, e.course_id;

-- Grant permissions
GRANT SELECT ON v_user_learning_summary TO authenticated, service_role;
GRANT SELECT ON v_course_learning_summary TO authenticated, service_role;
GRANT SELECT ON v_user_course_progress TO authenticated, service_role;
```

### Migration #6: Add Reconciliation Function

**File**: `supabase/migrations/20260410_06_add_reconciliation_function.sql`

```sql
-- ============================================================================
-- MIGRATION: Create daily reconciliation function
-- Purpose: Verify data consistency between lesson_progress and learning_hours
-- Usage: Run daily via scheduled job
-- ============================================================================

DROP FUNCTION IF EXISTS public.reconcile_learning_hours CASCADE;

CREATE OR REPLACE FUNCTION public.reconcile_learning_hours()
RETURNS TABLE(
  reconciliation_id INT,
  user_id UUID,
  course_id UUID,
  computed_duration_seconds INT,
  logged_duration_seconds INT,
  difference_seconds INT,
  status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_record RECORD;
  v_reconciliation_id INT := 0;
BEGIN
  
  CREATE TEMP TABLE temp_reconciliation (
    reconciliation_id INT,
    user_id UUID,
    course_id UUID,
    computed_duration_seconds INT,
    logged_duration_seconds INT,
    difference_seconds INT,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
  );

  -- For each user-course combo
  FOR v_record IN
    SELECT DISTINCT lp.user_id, lp.course_id
    FROM lesson_progress lp
  LOOP
    v_reconciliation_id := v_reconciliation_id + 1;

    -- Compute from lesson_progress
    INSERT INTO temp_reconciliation
    SELECT 
      v_reconciliation_id,
      v_record.user_id,
      v_record.course_id,
      COALESCE(SUM(lp.time_spent_seconds), 0),
      COALESCE(SUM(lh.duration_seconds), 0),
      ABS(
        COALESCE(SUM(lp.time_spent_seconds), 0) - 
        COALESCE(SUM(lh.duration_seconds), 0)
      ),
      CASE 
        WHEN ABS(
          COALESCE(SUM(lp.time_spent_seconds), 0) - 
          COALESCE(SUM(lh.duration_seconds), 0)
        ) < 60 THEN 'OK'
        WHEN ABS(
          COALESCE(SUM(lp.time_spent_seconds), 0) - 
          COALESCE(SUM(lh.duration_seconds), 0)
        ) < 300 THEN 'MINOR_DIFF'
        ELSE 'ALERT'
      END,
      NOW()
    FROM lesson_progress lp
      LEFT JOIN learning_hours lh 
        ON lp.user_id = lh.user_id 
        AND lp.course_id = lh.course_id
    WHERE lp.user_id = v_record.user_id
      AND lp.course_id = v_record.course_id
    GROUP BY lp.user_id, lp.course_id;
  END LOOP;

  RETURN QUERY SELECT * FROM temp_reconciliation;
  DROP TABLE temp_reconciliation;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Reconciliation error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.reconcile_learning_hours 
TO service_role;

-- Create audit table for reconciliation logs
CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  course_id UUID REFERENCES courses(id),
  computed_seconds INT,
  logged_seconds INT,
  difference_seconds INT,
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_logs_status 
ON reconciliation_logs(status, created_at DESC);

-- Schedule daily at 2 AM:
-- SELECT cron.schedule('reconcile_hours', '0 2 * * *', 
--   'INSERT INTO reconciliation_logs 
--    SELECT user_id, course_id, computed_duration_seconds, logged_duration_seconds, 
--           difference_seconds, status, created_at 
--    FROM reconcile_learning_hours()');
```

---

## 🟢 WEEK 3: OPTIONAL ENHANCEMENTS

### Migration #7: Add Learning Sessions Table

**File**: `supabase/migrations/20260410_07_add_learning_sessions_table.sql`

```sql
-- ============================================================================
-- MIGRATION: Add learning_sessions for session-level granularity
-- Purpose: Track individual learning sessions, detect idle time
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Session timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INT,
  
  -- Activity
  last_activity_at TIMESTAMP WITH TIME ZONE,
  idle_seconds INT DEFAULT 0,
  
  -- Completion
  completed BOOLEAN DEFAULT FALSE,
  progress_at_end INT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: session must end after start
  CONSTRAINT session_timing_valid 
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Indexes
CREATE INDEX idx_learning_sessions_user_lesson 
ON learning_sessions(user_id, lesson_id, started_at DESC);

CREATE INDEX idx_learning_sessions_course 
ON learning_sessions(user_id, course_id, started_at DESC);

CREATE INDEX idx_learning_sessions_duration 
ON learning_sessions(user_id, duration_seconds);

-- RLS Policies
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
ON learning_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sessions"
ON learning_sessions FOR ALL
USING (auth.role() = 'service_role');

GRANT SELECT, INSERT, UPDATE ON learning_sessions TO authenticated, service_role;
```

---

## 📝 Service Layer Updates

### Updated learningHoursService.ts

```typescript
// lib/learningHoursService.ts (REFACTORED)

export const learningHoursService = {
  
  /**
   * PRIMARY METHOD: Record a complete learning session
   * Uses atomic RPC - guaranteed all-or-nothing
   */
  async recordLearningSession(
    userId: string,
    lessonId: string,
    courseId: string,
    durationSeconds: number,
    progressPercent: number,
    completed: boolean
  ) {
    try {
      // Call atomic RPC function
      const { data, error } = await supabase
        .rpc('record_learning_session', {
          p_user_id: userId,
          p_lesson_id: lessonId,
          p_course_id: courseId,
          p_duration_seconds: durationSeconds,
          p_progress_pct: progressPercent,
          p_completed: completed,
        });

      if (error) throw error;

      const result = data[0];
      if (!result.success) {
        throw new Error(result.error_message);
      }

      return {
        success: true,
        lesson_progress_id: result.lesson_progress_id,
        learning_hours_id: result.learning_hours_id,
      };
    } catch (error) {
      console.error('Error recording learning session:', error);
      throw error;
    }
  },

  /**
   * Get computed learning hours from lesson_progress (SOURCE OF TRUTH)
   */
  async getComputedLearningHours(
    userId: string,
    courseId?: string
  ) {
    try {
      let query = supabase
        .from('lesson_progress')
        .select('time_spent_seconds')
        .eq('user_id', userId);

      if (courseId) {
        query = query.eq('course_id', courseId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalSeconds = (data || []).reduce(
        (sum, row) => sum + (row.time_spent_seconds || 0),
        0
      );

      return {
        seconds: totalSeconds,
        minutes: Math.round(totalSeconds / 60),
        hours: Math.round((totalSeconds / 3600) * 10) / 10,
      };
    } catch (error) {
      console.error('Error computing learning hours:', error);
      return { seconds: 0, minutes: 0, hours: 0 };
    }
  },

  /**
   * Get summary view (read-only, aggregated)
   */
  async getUserLearningSummary(userId: string) {
    try {
      const { data, error } = await supabase
        .from('v_user_learning_summary')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching learning summary:', error);
      return null;
    }
  },

  /**
   * Get course progress
   */
  async getUserCourseProgress(userId: string, courseId: string) {
    try {
      const { data, error } = await supabase
        .from('v_user_course_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching course progress:', error);
      return null;
    }
  },
};
```

---

## 🧪 Testing Checklist

```sql
-- After each migration, run these tests:

-- Test 1: RPC Transaction (All-or-Nothing)
SELECT record_learning_session(
  'userId'::UUID,
  'lessonId'::UUID,
  'courseId'::UUID,
  3600,    -- 1 hour
  75,      -- 75% progress
  true     -- completed
);

-- Test 2: Verify course_id populated automatically
SELECT course_id FROM lesson_progress LIMIT 1;
-- Should NOT be NULL

-- Test 3: Verify views work
SELECT * FROM v_user_learning_summary LIMIT 1;
SELECT * FROM v_course_learning_summary LIMIT 1;
SELECT * FROM v_module_learning_stats LIMIT 1;

-- Test 4: Run reconciliation
SELECT * FROM reconcile_learning_hours();

-- Test 5: Verify duration_seconds math
SELECT duration_seconds, 
       FLOOR(duration_seconds / 3600) as hours,
       FLOOR(MOD(duration_seconds, 3600) / 60) as minutes
FROM learning_hours LIMIT 5;
```

---

## 📊 Migration Order & Dependencies

```
┌─ Migration #1: Transaction RPC
│  (Independent - adds function)
│
├─ Migration #2: course_id column
│  (Independent - adds column)
│
├─ Migration #3: Fix VIEW joins
│  (Depends on #2 for course_id)
│
├─ Migration #4: Normalize duration
│  (Independent - refactors hours/minutes)
│
├─ Migration #5: Create aggregation views
│  (Depends on #2, #3 - uses course_id)
│
├─ Migration #6: Reconciliation function
│  (Depends on #2, #4 - uses correct columns)
│
└─ Migration #7: Learning sessions
   (Independent - new table)
```

**Safe Deploy Order**:
1. All independent migrations first (#1, #2, #4, #7)
2. Then dependent migrations (#3, #5, #6)
3. Test at each stage
4. Deploy to production last

---

**Migrations Location**: `supabase/migrations/`
**Services Location**: `lib/*Service.ts`
**Testing**: Write tests in `.test.ts` files

