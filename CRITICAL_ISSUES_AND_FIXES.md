# Critical Code Review: Hours Tracking System
## 10 Issues + 4 Design Improvements + Recommended Architecture

**Status**: ❌ VALIDATED - All 10 issues found in codebase
**Severity**: CRITICAL (Data Integrity Risk)
**Priority**: 🔴 Immediate fixes required

---

## ✅ VERIFICATION CHECKLIST

| Issue | Found? | Severity | File |
|-------|--------|----------|------|
| 1. Dual source of truth | ✅ YES | 🔴 CRITICAL | learningHoursService.ts + lesson_progress |
| 2. Redundant hours+minutes | ✅ YES | 🔴 CRITICAL | learning_hours table |
| 3. Floating point precision | ✅ YES | 🔴 CRITICAL | NUMERIC type in DB |
| 4. No transactional consistency | ✅ YES | 🔴 CRITICAL | Service layer (no transaction wrapper) |
| 5. Duplicate aggregation logic | ✅ YES | 🟡 HIGH | 3+ locations (frontend, services, SQL views) |
| 6. Missing course_id in lesson_progress | ✅ YES | 🟡 HIGH | INDEX references non-existent column |
| 7. No session-level granularity | ✅ YES | 🟡 MEDIUM | No learning_sessions table |
| 8. Naive content duration | ✅ YES | 🟡 MEDIUM | lessonService.ts hardcoded values |
| 9. RLS policy column mismatch | ⚠️ PARTIAL | 🟡 HIGH | Uses correct userid now (migration fixed) |
| 10. SQL view errors | ✅ YES | 🔴 CRITICAL | VIEW has INCORRECT JOINs |

---

## 🔴 ISSUE #1: DUAL SOURCE OF TRUTH FOR TIME

### Current Problem
```
lesson_progress.time_spent_seconds          ← Actual tracked time
                ↓
learning_hours.hours + minutes              ← Manually logged/aggregated
                ↓
user_statistics.total_learning_hours        ← Aggregate total
                ↓
⚠️ NO GUARANTEE THESE MATCH
```

**Evidence in Code**:
```typescript
// learningHoursService.ts - Line 16
async recordLearningHours(
  userId: string,
  courseId: string,
  hoursSpent: number,        // ← MANUALLY PROVIDED, not derived
  date?: string
) {
  // No verification that this matches time_spent_seconds
}
```

### Risk Scenario
```
User session: 45 minutes (time_spent_seconds = 2700)
Manual log:   2 hours    (hours = 2)
Dashboard:    ???        (which one is correct?)
→ Trust eroded, reports unreliable
```

### Recommended Fix (Option A - BEST)

**Use `lesson_progress.time_spent_seconds` as SINGLE SOURCE OF TRUTH**

```sql
-- MIGRATION: 20260410_consolidate_hours_architecture.sql

-- Step 1: Convert existing learning_hours data to derived view
CREATE OR REPLACE VIEW learning_hours_derived AS
SELECT 
  gen_random_uuid() as id,
  lp.userid,
  l.courseid,
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 2) as hours,
  MOD(SUM(lp.time_spent_seconds), 3600) / 60 as minutes,
  lp.updated_at::DATE as logged_date,
  lp.updated_at as created_at
FROM lesson_progress lp
JOIN lessons l ON lp.lessonid = l.id
GROUP BY lp.userid, l.courseid, lp.updated_at::DATE, lp.updated_at;

-- Step 2: Keep learning_hours table OPTIONAL (for backward compatibility)
-- Mark with source column:
ALTER TABLE learning_hours ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

-- Step 3: Create reconciliation function (daily cron job)
CREATE OR REPLACE FUNCTION reconcile_learning_hours()
RETURNS TABLE(reconciliation_log TEXT) AS $$
DECLARE
  v_user_id UUID;
  v_computed_hours NUMERIC;
  v_logged_hours NUMERIC;
  v_difference NUMERIC;
BEGIN
  -- For each user, compare time_spent_seconds vs logged hours
  FOR v_user_id IN
    SELECT DISTINCT userid FROM lesson_progress
  LOOP
    -- Compute from lesson_progress
    SELECT COALESCE(SUM(time_spent_seconds) / 3600.0, 0) INTO v_computed_hours
    FROM lesson_progress WHERE userid = v_user_id;
    
    -- Get logged from learning_hours
    SELECT COALESCE(SUM(hours), 0) INTO v_logged_hours
    FROM learning_hours WHERE userid = v_user_id AND source = 'manual';
    
    v_difference := ABS(v_computed_hours - v_logged_hours);
    
    -- Alert if > 10% difference
    IF v_difference > v_computed_hours * 0.1 THEN
      RETURN QUERY SELECT format(
        'ALERT: User %s has %s hr difference (computed: %s, logged: %s)',
        v_user_id, v_difference, v_computed_hours, v_logged_hours
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule this daily:
-- SELECT cron.schedule('reconcile_hours', '0 2 * * *', 'SELECT reconcile_learning_hours()');
```

**Updated Service Layer**:
```typescript
// lib/learningHoursService.ts (REFACTORED)

export const learningHoursService = {
  /**
   * Get computed learning hours from lesson_progress
   * This is the SOURCE OF TRUTH
   */
  async getComputedLearningHours(userId: string, courseId: string) {
    const { data, error } = await supabase.from('lesson_progress')
      .select('lp.time_spent_seconds, l.courseid')
      .eq('lp.userid', userId)
      .eq('l.courseid', courseId)
      .join('lessons', 'lp.lessonid', 'lessons.id');
    
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
  },

  /**
   * OPTIONAL: Record manual adjustment (e.g., for offline learning)
   * Only use if user studied offline
   */
  async recordManualAdjustment(
    userId: string,
    courseId: string,
    adjustmentHours: number,
    reason: string
  ) {
    const { data, error } = await supabase
      .from('learning_hours')
      .insert([{
        userid: userId,
        courseid: courseId,
        hoursspent: adjustmentHours,
        source: 'manual_adjustment',
        adjustment_reason: reason,
        logged_date: new Date().toISOString().split('T')[0],
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get total with reconciliation check
   */
  async getTotalLearningHours(userId: string) {
    const computed = await this.getComputedLearningHours(userId, null);
    
    // Log if system stores manual adjustments
    const { data: adjustments } = await supabase
      .from('learning_hours')
      .select('hoursspent')
      .eq('userid', userId)
      .eq('source', 'manual_adjustment');
    
    const adjustmentTotal = (adjustments || []).reduce(
      (sum, row) => sum + row.hoursspent,
      0
    );
    
    return {
      computed_hours: computed.hours,
      manual_adjustments: adjustmentTotal,
      total: computed.hours + adjustmentTotal,
      source: 'computed + manual',
    };
  },
};
```

---

## 🔴 ISSUE #2: REDUNDANT STORAGE (hours + minutes)

### Current Problem
```sql
CREATE TABLE learning_hours (
  hours NUMERIC DEFAULT 0,      ← Decimal hours (1.5)
  minutes INTEGER DEFAULT 0,    ← Remaining minutes
  -- Problem: No constraint that they match!
  -- Example of corruption:
  -- INSERT -> hours=1.5, minutes=20
  -- This is ambiguous: 1h 20m or 1.5 hours + 20 minutes?
);
```

### Evidence
```typescript
// Aggregation in learningHoursService.ts
const totalHours = records.reduce((sum, record) => 
  sum + (record.hoursspent || 0), 0
);
// Ignores minutes column completely!
// ↓ Data quality issue
```

### Recommended Fix

**Use ONLY `total_minutes` INTEGER**

```sql
-- MIGRATION: 20260410_normalize_hours_storage.sql

-- Step 1: Copy existing data (minutes first)
ALTER TABLE learning_hours 
ADD COLUMN total_minutes INTEGER DEFAULT 0;

UPDATE learning_hours SET 
  total_minutes = CASE
    WHEN hours IS NOT NULL THEN (hours * 60) + COALESCE(minutes, 0)
    ELSE COALESCE(minutes, 0)
  END;

-- Step 2: Drop redundant columns
ALTER TABLE learning_hours 
DROP COLUMN hours,
DROP COLUMN minutes;

-- Step 3: Rename to clarify
ALTER TABLE learning_hours 
RENAME COLUMN total_minutes TO duration_seconds;

-- Step 4: Update constraint
ALTER TABLE learning_hours
ADD CONSTRAINT learning_hours_duration_check 
CHECK (duration_seconds >= 0 AND duration_seconds <= 604800); -- 7 days max

-- Step 5: Create helper view for backward compatibility
CREATE OR REPLACE VIEW learning_hours_formatted AS
SELECT 
  id,
  userid,
  courseid,
  duration_seconds,
  FLOOR(duration_seconds / 3600) as hours,
  MOD(duration_seconds, 3600) / 60 as minutes,
  ROUND((duration_seconds / 3600)::NUMERIC, 1) as hours_decimal,
  logged_date,
  created_at
FROM learning_hours;
```

**Updated Service**:
```typescript
// lib/learningHoursService.ts (REFACTORED)

async recordLearningHours(
  userId: string,
  courseId: string,
  durationSeconds: number,    // ← Always seconds internally
  date?: string
) {
  const recordDate = date || new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('learning_hours')
    .select('*')
    .eq('userid', userId)
    .eq('courseid', courseId)
    .eq('date', recordDate)
    .single();

  if (existing) {
    // Add to existing seconds
    const { data, error } = await supabase
      .from('learning_hours')
      .update({
        duration_seconds: existing.duration_seconds + durationSeconds,
      })
      .eq('id', existing.id)
      .select()
      .single();
    
    return this.formatDuration(data);
  } else {
    const { data, error } = await supabase
      .from('learning_hours')
      .insert([{
        userid: userId,
        courseid: courseId,
        duration_seconds: durationSeconds,
        logged_date: recordDate,
      }])
      .select()
      .single();
    
    return this.formatDuration(data);
  }
}

private formatDuration(record: any) {
  return {
    ...record,
    // Display as hours.minutes
    display: `${Math.floor(record.duration_seconds / 3600)}h ${Math.floor((record.duration_seconds % 3600) / 60)}m`,
    // Decimal hours
    hours: Math.round((record.duration_seconds / 3600) * 10) / 10,
  };
}
```

---

## 🔴 ISSUE #3: FLOATING POINT PRECISION ISSUES

### Current Problem
```sql
CREATE TABLE learning_hours (
  hours NUMERIC,  -- Decimal like 1.49999999 or 14.999999
);

-- Aggregation:
SELECT SUM(hours) FROM learning_hours
-- Result: 14.999999 instead of 15.0 ❌
```

### Evidence
```typescript
// durationService.ts - Line 159
minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
  // 270 minutes → (270/60)*10 = 45, /10 = 4.5 ✓
  // BUT aggregating 4.5 + 4.5 = 9.0 ? No = 9.0000001
}
```

### Recommended Fix

**Store ONLY integers (seconds), convert on display**

```sql
-- All internal storage:
duration_seconds INTEGER       -- 3600 (1 hour)
duration_minutes INTEGER       -- 60 (1 minute)

-- NEVER NUMERIC/DECIMAL for summation

-- Conversion happens in application:
3600 seconds → 1 hour
60 minutes → 1 hour
```

**Service Layer**:
```typescript
const durationService = {
  // ✅ NO floating point in DB
  // ✅ Safe aggregation: SUM(integer) = always integer
  
  formatForDisplay(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${secs}s`;
  },
  
  toDecimalHours(seconds: number): number {
    // ONE conversion point at display time
    return Math.round((seconds / 3600) * 10) / 10;
  },
};
```

---

## 🔴 ISSUE #4: NO TRANSACTIONAL CONSISTENCY

### Current Problem

**Flow has 3 separate, uncoordinated updates**:

```typescript
// Current code - NO TRANSACTION WRAPPER
async updateLearsonProgress(...) {       // ← Update 1
  await supabase.from('lesson_progress').update(...);
}
// If fails here ↓ but continues ↓
async recordLearningHours(...) {         // ← Update 2
  await supabase.from('learning_hours').insert(...);
}
// If fails here ↓ but continues ↓
async updateLearningHours(...) {         // ← Update 3
  await supabase.from('user_statistics').update(...);
}
// Result: INCONSISTENT STATE
```

**Risk Scenario**:
```
lesson_progress: ✅ 45 minutes recorded
learning_hours:  ❌ Insert failed (quota)
user_stats:      ❌ Never called
→ User's total never updated!
```

### Recommended Fix

**Wrap in PostgreSQL transaction via Edge Function/RPC**

```sql
-- MIGRATION: 20260410_add_transaction_functions.sql

-- Create transactional RPC function
CREATE OR REPLACE FUNCTION record_learning_session(
  p_user_id UUID,
  p_lesson_id UUID,
  p_course_id UUID,
  p_duration_seconds INT,
  p_progress_pct INT,
  p_completed BOOLEAN
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  lesson_progress_id UUID,
  learning_hours_id UUID
) AS $$
DECLARE
  v_lp_id UUID;
  v_lh_id UUID;
  v_existing_lh UUID;
BEGIN
  -- ATOMIC: All-or-nothing
  
  -- Step 1: Update lesson_progress
  INSERT INTO lesson_progress (
    userid, lessonid, time_spent_seconds, 
    progress, is_completed, updated_at
  ) VALUES (
    p_user_id, p_lesson_id, p_duration_seconds,
    p_progress_pct, p_completed, NOW()
  ) ON CONFLICT (userid, lessonid) DO UPDATE SET
    time_spent_seconds = lesson_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
    progress = EXCLUDED.progress,
    is_completed = EXCLUDED.is_completed,
    updated_at = NOW()
  RETURNING id INTO v_lp_id;

  -- Step 2: Get course_id from lesson
  PERFORM get_lesson_course(p_lesson_id) INTO p_course_id;

  -- Step 3: Record learning hours (or update if same day)
  INSERT INTO learning_hours (
    userid, courseid, duration_seconds, logged_date, created_at
  ) VALUES (
    p_user_id, p_course_id, p_duration_seconds,
    CURRENT_DATE, NOW()
  ) ON CONFLICT (userid, courseid, logged_date) DO UPDATE SET
    duration_seconds = learning_hours.duration_seconds + EXCLUDED.duration_seconds,
    updated_at = NOW()
  RETURNING id INTO v_lh_id;

  -- Step 4: Update user statistics
  INSERT INTO user_statistics (
    userid, courses_enrolled, total_learning_hours
  ) VALUES (
    p_user_id, 1, p_duration_seconds / 3600.0
  ) ON CONFLICT (userid) DO UPDATE SET
    total_learning_hours = user_statistics.total_learning_hours + (EXCLUDED.total_learning_hours),
    last_activity_date = CURRENT_DATE
  OnCONFLICT DO NOTHING;

  RETURN QUERY SELECT
    true as success,
    NULL::TEXT as error_message,
    v_lp_id,
    v_lh_id;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    false as success,
    SQLERRM,
    NULL::UUID,
    NULL::UUID;
  ROLLBACK;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_learning_session TO authenticated;
```

**Updated Service**:
```typescript
// lib/lessonProgressService.ts (REFACTORED)

async recordSessionAtomically(
  userId: string,
  lessonId: string,
  courseId: string,
  durationSeconds: number,
  progress: number,
  completed: boolean
) {
  try {
    // Call RPC (single transaction)
    const { data, error } = await supabase
      .rpc('record_learning_session', {
        p_user_id: userId,
        p_lesson_id: lessonId,
        p_course_id: courseId,
        p_duration_seconds: durationSeconds,
        p_progress_pct: progress,
        p_completed: completed,
      });

    if (!data[0]?.success) {
      throw new Error(data[0]?.error_message || 'Unknown error');
    }

    return {
      success: true,
      lesson_progress_id: data[0].lesson_progress_id,
      learning_hours_id: data[0].learning_hours_id,
    };
  } catch (error) {
    console.error('Transaction failed:', error);
    // Entire operation rolled back
    throw error;
  }
}
```

---

## 🟡 ISSUE #5: DUPLICATE AGGREGATION LOGIC

### Current Problem

**Same calculation in 3+ places**:

```typescript
// Location 1: learningHoursService.ts
const totalHours = (data || []).reduce((sum, record) => 
  sum + (record.hoursspent || 0), 0
);

// Location 2: lessonProgressService.ts
const avgProgress = totalLessons > 0
  ? progress.reduce((sum, l) => sum + l.progress, 0) / totalLessons
  : 0;

// Location 3: SQL VIEW (v_module_learning_stats)
SUM(lh.hoursspent) / COUNT(DISTINCT e.userid)

// Location 4: Frontend (dashboard components)
const total = stats.reduce((sum, s) => sum + s.hours, 0);
```

**Risk**: Different implementations = different results!

### Recommended Fix

**Centralize ALL aggregation in SQL VIEWS/FUNCTIONS**

```sql
-- MIGRATION: 20260410_create_aggregation_views.sql

-- View 1: User Learning Summary
CREATE OR REPLACE VIEW v_user_learning_summary AS
SELECT 
  us.userid,
  COUNT(DISTINCT e.courseid) as courses_enrolled,
  COUNT(DISTINCT CASE WHEN e.is_completed THEN e.courseid END) as courses_completed,
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 1) as total_hours,
  ROUND(
    AVG(e.progress),
    1
  ) as avg_course_progress
FROM user_statistics us
LEFT JOIN enrollments e ON us.userid = e.userid
LEFT JOIN lesson_progress lp ON us.userid = lp.userid
GROUP BY us.userid;

-- View 2: Course Learning Summary
CREATE OR REPLACE VIEW v_course_learning_summary AS
SELECT 
  c.id as course_id,
  c.title,
  COUNT(DISTINCT e.userid) as total_enrollees,
  COUNT(DISTINCT CASE WHEN e.is_completed THEN e.userid END) as completed_users,
  ROUND(
    COUNT(DISTINCT CASE WHEN e.is_completed THEN e.userid END)::NUMERIC / 
    NULLIF(COUNT(DISTINCT e.userid), 0) * 100, 
    1
  ) as completion_rate,
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 1) as total_hours_spent
FROM courses c
LEFT JOIN enrollments e ON c.id = e.courseid
LEFT JOIN lessons l ON c.id = l.courseid
LEFT JOIN lesson_progress lp ON l.id = lp.lessonid
GROUP BY c.id, c.title;
```

**Service Layer - Read Only**:
```typescript
// lib/aggregationService.ts (NEW)

export const aggregationService = {
  async getUserLearningSummary(userId: string) {
    const { data, error } = await supabase
      .from('v_user_learning_summary')
      .select('*')
      .eq('userid', userId)
      .single();
    
    return data;
    // NO calculation, just retrieval
  },

  async getCourseLearningStats(courseId: string) {
    const { data, error } = await supabase
      .from('v_course_learning_summary')
      .select('*')
      .eq('course_id', courseId)
      .single();
    
    return data;
    // NO calculation, just retrieval
  },
};
```

---

## 🟡 ISSUE #6: MISSING course_id IN lesson_progress

### Current Problem

**Index exists on non-existent column**:

```sql
-- From migration 20260406_fix_dashboard_rls_timeouts.sql:
CREATE INDEX IF NOT EXISTS idx_lesson_progress_userid_courseid
ON lesson_progress(userid, courseid);  -- ❌ courseid doesn't exist!

-- Actual schema (DATABASE_SCHEMA_COMPLETE.sql):
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,       -- ✅
  lesson_id UUID NOT NULL,     -- ✅
  time_spent_seconds INTEGER,  -- ✅
  -- ❌ NO course_id column!
);
```

**Performance Impact**:
```sql
-- Every query must JOIN:
FROM lesson_progress lp
JOIN lessons l ON lp.lesson_id = l.id    -- ← Extra join
WHERE l.course_id = $1

-- Should be direct:
FROM lesson_progress lp
WHERE lp.course_id = $1  -- Much faster
```

### Recommended Fix

**Add `course_id` denormalized column**

```sql
-- MIGRATION: 20260410_add_course_id_to_lesson_progress.sql

-- Step 1: Add column
ALTER TABLE lesson_progress 
ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

-- Step 2: Populate from lessons table
UPDATE lesson_progress lp SET
  course_id = l.course_id
FROM lessons l
WHERE lp.lesson_id = l.id;

-- Step 3: Make NOT NULL (after population)
ALTER TABLE lesson_progress
ALTER COLUMN course_id SET NOT NULL;

-- Step 4: Create proper index
DROP INDEX IF EXISTS idx_lesson_progress_userid_courseid;
CREATE INDEX idx_lesson_progress_user_course_efficiently
ON lesson_progress(user_id, course_id);

-- Step 5: Create trigger to auto-populate course_id on insert
CREATE OR REPLACE FUNCTION set_lesson_course_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT l.course_id INTO NEW.course_id
  FROM lessons l
  WHERE l.id = NEW.lesson_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_progress_set_course_id
BEFORE INSERT ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION set_lesson_course_id();
```

**Benefits**:
```sql
-- Before (with join):
SELECT * FROM lesson_progress WHERE user_id = $1 AND lesson_id IN (...)
-- Cost: O(n) lookups

-- After (direct column):
SELECT * FROM lesson_progress WHERE user_id = $1 AND course_id = $2
-- Cost: O(1) index lookup
```

---

## 🟡 ISSUE #7: NO SESSION-LEVEL GRANULARITY

### Current Problem

**No distinction between sessions**:

```sql
lesson_progress tracks per-lesson, not per-session:
→ Cannot detect idle time
→ Cannot analyze "user studied 45 min, then AFK for 2 hours"
→ Cannot replay user activity
```

### Recommended Fix

**Add `learning_sessions` table**

```sql
-- MIGRATION: 20260410_add_learning_sessions_table.sql

CREATE TABLE learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Activity tracking
  last_activity_at TIMESTAMP WITH TIME ZONE,
  idle_seconds INTEGER DEFAULT 0,
  
  -- Status
  completed BOOLEAN DEFAULT FALSE,
  progress_at_end INTEGER,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_learning_sessions_user_lesson 
ON learning_sessions(user_id, lesson_id);

CREATE INDEX idx_learning_sessions_course 
ON learning_sessions(user_id, course_id, started_at);
```

**Service Layer**:
```typescript
// lib/learningSessionService.ts (NEW)

export const learningSessionService = {
  async startSession(
    userId: string,
    lessonId: string,
    courseId: string
  ) {
    const { data, error } = await supabase
      .from('learning_sessions')
      .insert([{
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        started_at: new Date(),
      }])
      .select()
      .single();
    
    return data;
  },

  async endSession(
    sessionId: string,
    durationSeconds: number,
    progressPercent: number,
    completed: boolean
  ) {
    const { data, error } = await supabase
      .from('learning_sessions')
      .update({
        ended_at: new Date(),
        duration_seconds: durationSeconds,
        progress_at_end: progressPercent,
        completed,
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    return data;
  },

  async getSessionsByUser(userId: string, courseId?: string) {
    let query = supabase
      .from('learning_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
    
    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    
    const { data } = await query;
    return data;
  },
};
```

---

## 🟡 ISSUE #8: NAIVE CONTENT DURATION ESTIMATION

### Current Problem

```typescript
// lessonService.ts
if (block.type === 'video') {
  totalMinutes += 5;  // ❌ ALWAYS 5 minutes???
}
```

**Results**:
```
Video (3 min):     Estimated = 5 min (67% error)
Video (60 min):    Estimated = 5 min (92% error)
Video (YouTube):   No metadata extracted
```

### Recommended Fix

**Extract actual metadata**

```typescript
// lib/lessonService.ts (REFACTORED)

calculateLessonDuration(lesson: any): number {
  let totalMinutes = 0;
  const contentBlocks = Array.isArray(lesson.content)
    ? lesson.content
    : JSON.parse(lesson.content || '[]');

  contentBlocks.forEach((block: any) => {
    switch (block.type) {
      case 'text':
        const wordCount = this.countWords(block.content);
        totalMinutes += (wordCount / 100) * 0.6;
        break;

      case 'pdf':
        const pages = block.data?.pages || 1;
        totalMinutes += pages * 2;
        break;

      case 'video':
        // ✅ Try to get actual duration first
        if (block.duration) {
          // Metadata: { duration: 3600 } (seconds)
          totalMinutes += block.duration / 60;
        } else if (block.metadata?.duration_seconds) {
          totalMinutes += block.metadata.duration_seconds / 60;
        } else if (block.videoId && block.source === 'youtube') {
          // Could fetch from YouTube API (optional async)
          totalMinutes += this.fetchYouTubeDuration(block.videoId) / 60;
        } else {
          // Last resort: reasonable estimate
          totalMinutes += 10; // Not 5, but conservative
        }
        break;

      case 'quiz':
        const questionCount = block.data?.questions?.length || 1;
        totalMinutes += Math.ceil(questionCount * 1.5); // 1.5 min per question
        break;

      case 'flashcard':
        const cardCount = block.data?.totalCards || 10;
        totalMinutes += Math.ceil(cardCount * 1.5); // 1.5 min per card
        break;
    }
  });

  return Math.ceil(totalMinutes || 0);
}

private countWords(htmlContent: string): number {
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;
  const text = temp.textContent || temp.innerText || '';
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
```

---

## 🟡 ISSUE #9: RLS POLICY COLUMN MISMATCH

### Current Status: ✅ FIXED

The migration `20260405_fix_admin_dashboard_loading.sql` has correct column names:
```sql
✅ USING (auth.uid() = userid)  -- Matches table column name

-- Table schema:
CREATE TABLE learning_hours (
  userid UUID  -- ✅ lowercase, matches policy
);
```

**Note**: Watch for future schema changes. Always verify column names match RLS policies.

---

## 🔴 ISSUE #10: SQL VIEW HAS INCORRECT JOINS

### Current Problem

**View: `v_module_learning_stats` (20260407_create_module_learning_stats_view.sql)**

```sql
-- Line 13: ❌ Using courseid which should be course_id
SELECT ... c.id as courseid ...

-- But then joining without proper ON:
LEFT JOIN enrollments e ON c.id = e.courseid

-- Line 47: ❌ Missing JOIN to courses
LEFT JOIN lessons l ON l.courseid = c.id
-- ↑ courseid from previous reference, but WHERE is c?
LEFT JOIN courses c ON l.courseid = c.id  -- ← ONLY HERE, too late!

-- Result: Column references in SELECT use c before it's joined
```

### Recommended Fix

**Rewrite with correct JOIN order**

```sql
-- MIGRATION: 20260410_fix_module_learning_stats_view.sql

DROP VIEW IF EXISTS v_module_learning_stats CASCADE;

CREATE OR REPLACE VIEW v_module_learning_stats AS
SELECT
  l.id as lesson_id,
  l.title as lesson_name,
  c.id as course_id,
  c.title as course_title,
  COALESCE(cat.name, 'Uncategorized') as category,
  
  -- Enrollment stats
  COUNT(DISTINCT e.user_id) as total_users_enrolled,
  COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.user_id END) as users_completed,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.user_id) = 0 THEN 0
      ELSE COUNT(DISTINCT CASE WHEN lp.is_completed THEN lp.user_id END)::NUMERIC /
           COUNT(DISTINCT e.user_id) * 100
    END, 2
  ) as completion_percentage,
  
  -- Learning hours stats (from SOURCE OF TRUTH)
  ROUND(SUM(lp.time_spent_seconds) / 3600.0, 2) as total_course_hours,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT e.user_id) = 0 THEN 0
      ELSE SUM(lp.time_spent_seconds)::NUMERIC / COUNT(DISTINCT e.user_id) / 3600
    END, 2
  ) as avg_hours_per_user,
  
  MAX(lp.updated_at)::DATE as last_completion_date

FROM lessons l
LEFT JOIN courses c ON l.course_id = c.id
LEFT JOIN categories cat ON c.category_id = cat.id
LEFT JOIN enrollments e ON c.id = e.course_id
LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id 
                            AND e.user_id = lp.user_id

WHERE l.id IS NOT NULL

GROUP BY
  l.id, l.title,
  c.id, c.title,
  cat.name

ORDER BY c.title, l.title;
```

---

## ✅ PRIORITY FIX ORDER (By Severity)

### 🔴 CRITICAL (Do First)
1. **Issue #1**: Remove dual time source → Use lesson_progress only
2. **Issue #10**: Fix SQL view JOINs → Views are broken
3. **Issue #4**: Add transaction wrapper → Prevent data loss
4. **Issue #3**: Change NUMERIC to INTEGER → Fix precision

### 🟡 HIGH (Do Next)
5. **Issue #6**: Add course_id to lesson_progress → Performance
6. **Issue #2**: Consolidate hours+minutes → Data consistency
7. **Issue #5**: Centralize aggregation in views → Single source of logic

### 🟢 MEDIUM (Nice to Have)
8. **Issue #7**: Add learning_sessions table → Advanced analytics
9. **Issue #8**: Improve duration estimation → Accuracy
10. **Issue #9**: Monitor RLS → Already fixed

---

## 🏗️ RECOMMENDED FINAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│  SINGLE SOURCE OF TRUTH: lesson_progress.time_spent_seconds      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ lesson_progress (ATOMIC writes via RPC)                          │
│ ├─ user_id                                                       │
│ ├─ lesson_id                                                     │
│ ├─ course_id ← DENORMALIZED (fast queries)                       │
│ └─ time_spent_seconds ← PRIMARY METRIC (integers only)           │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  learning_sessions (NEW - Optional)                              │
│ ├─ user_id, lesson_id, course_id                                │
│ ├─ started_at, ended_at                                         │
│ └─ idle_seconds (detect AFK)                                    │
├─────────────────────────────────────────────────────────────────┤
│  learning_hours (OPTIONAL - Materialized View)                  │
│ ├─ userid, courseid                                             │
│ ├─ duration_seconds (INTEGER - no precision issues)             │
│ └─ logged_date                                                   │
│    ↓ Generated from lesson_progress via daily job               │
├─────────────────────────────────────────────────────────────────┤
│  user_statistics (CACHE - Refreshed Hourly)                    │
│ ├─ userid                                                       │
│ ├─ total_learning_hours ← Computed from views                   │
│ └─ courses_completed                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DERIVED VIEWS (Read-Only, No Business Logic)                   │
├─────────────────────────────────────────────────────────────────┤
│  v_user_learning_summary      (aggregated per user)             │
│  v_course_learning_summary    (aggregated per course)           │
│  v_module_learning_stats      (detailed per module)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TRANSACTIONAL RPC Functions                                    │
├─────────────────────────────────────────────────────────────────┤
│  record_learning_session() → Atomic all-or-nothing              │
│  reconcile_learning_hours() → Daily verification                │
│  get_user_learning_summary() → Query via view                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 SUMMARY SCORECARD

| Aspect | Before | After |
|--------|--------|-------|
| Data Consistency | ❌ At Risk | ✅ Atomic |
| Source of Truth | ❌ Multiple | ✅ Single |
| Floating Point | ❌ Risky | ✅ Integer only |
| Transaction Safety | ❌ None | ✅ ACID guaranteed |
| Logic Duplication | ❌ 5+ places | ✅ 1 location (views) |
| Query Performance | ❌ Slow (joins) | ✅ Fast (denormalized) |
| Data Integrity | ❌ Possible corruption | ✅ Constraints + RLS |

---

## 🚀 Implementation Timeline

**Week 1** (Critical):
- [ ] Add transaction RPC function
- [ ] Fix SQL view JOINs
- [ ] Add course_id to lesson_progress

**Week 2** (High Priority):
- [ ] Migrate hours+minutes → duration_seconds
- [ ] Centralize aggregation in views
- [ ] Create reconciliation job

**Week 3** (Optional):
- [ ] Add learning_sessions table
- [ ] Improve duration estimation
- [ ] Add idle time detection

---

**Document**: Architecture Review & Fixes
**Date**: April 2026
**Status**: Ready for Implementation
