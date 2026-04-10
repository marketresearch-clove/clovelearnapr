# Time Tracking System - Verification & Testing Guide

## ✅ Fixes Applied (Apr 10, 2026)

### 1. **Certificate Deletion Fix** (12:17)
**File:** `lib/enrollmentService.ts` (retakeCourse function)
- **Issue:** When resetting course progress, certificates weren't being deleted due to foreign key constraints
- **Fix:** Delete `certificate_signatures` table first, then `certificates`
- **Impact:** Users can now properly reset course progress without orphaned certificates

### 2. **Lesson Time Tracking Fix** (12:29)
**Files:** 
- `lib/lessonProgressService.ts` (updateLessonProgress)
- `pages/LessonPlayerPage.tsx` (calculatetime on completion)

**Issue:** `lesson_progress.time_spent_seconds` was always 0
- Module hours view couldn't calculate totals
- Only course-level time was tracked

**Fix:** 
- Calculate elapsed seconds: `Math.max(1, Math.round((Date.now() - lessonStartTimeRef) / 1000))`
- Pass to service and accumulate: `time_spent_seconds += elapsedSeconds`
- Minimum 1 second per completion (prevents 0 durations)

**Impact:** Module hours now display correctly in analytics views

---

## 🧪 Testing Procedures

### Test 1: Basic Time Recording
**Objective:** Verify lesson time is recorded when lesson is completed

**Steps:**
1. As a student, open a lesson
2. Wait ~30-60 seconds
3. Mark lesson as complete
4. Check database:
```sql
SELECT userid, lessonid, time_spent_seconds 
FROM lesson_progress 
WHERE userid = 'YOUR_USER_ID' 
  AND lessonid = 'LESSON_ID'
LIMIT 1;
```
**Expected:** `time_spent_seconds` shows ~30-60 (not 0, not NULL)

---

### Test 2: Time Accumulation on Retake
**Objective:** Verify time accumulates correctly when lesson is retaken

**Steps:**
1. Complete a lesson (wait ~30 seconds)
2. Check time_spent_seconds (should be ~30)
3. Reset course progress (retake)
4. Complete the same lesson again (wait ~20 seconds)
5. Check time_spent_seconds again
6. Expected: ~50 seconds total (30 + 20)

**SQL Query:**
```sql
SELECT time_spent_seconds 
FROM lesson_progress 
WHERE userid = 'USER_ID' 
  AND lessonid = 'LESSON_ID';
```

---

### Test 3: Module Hours Calculation
**Objective:** Verify module hours display correctly

**Steps:**
1. Open Admin Dashboard
2. Go to "Modules" tab
3. Check a module's "Total Hours"
4. Verify it's NOT 0.00 (after completing lessons in that module)

**SQL Query (behind the scenes):**
```sql
SELECT 
  moduleid,
  module_name,
  total_module_hours,
  users_completed
FROM module_learning_stats_summary
WHERE moduleid = 'MODULE_ID'
LIMIT 1;
```
**Expected:** `total_module_hours` > 0.00 after lessons completed

---

### Test 4: User Dashboard "Hours Learned"
**Objective:** Verify dashboard shows correct course-level hours

**Steps:**
1. As a student, complete a course
2. Go to user Dashboard
3. Check "Completed Learning Hrs" card
4. Verify total matches sum of lessons

**Data Sources:**
- **Dashboard shows:** enrollments.hoursspent (course level)
- **Backend uses:** SUM(lesson_progress.time_spent_seconds) per lesson

**Consistency Check:**
```sql
-- Course-level time
SELECT hoursspent FROM enrollments 
WHERE userid = 'USER_ID' AND courseid = 'COURSE_ID';

-- Should match sum of lessons
SELECT SUM(time_spent_seconds) as total_lesson_seconds
FROM lesson_progress
WHERE userid = 'USER_ID' AND courseid = 'COURSE_ID';
```

---

### Test 5: Module Breakdown on Dashboard
**Objective:** Verify category breakdown shows all categories

**Steps:**
1. Complete lessons from different categories (Business, Programming, etc)
2. Check "Completed Learning Hrs" by Category
3. Verify all categories appear with correct percentages

**Expected:**
- Total should equal sum of all categories
- Percentages should add up to 100%

---

## 📊 Key Metrics to Monitor

| Metric | Data Source | Expected Behavior |
|--------|-------------|-------------------|
| **Hours Learned (Dashboard)** | enrollments.hoursspent | Increases per course |
| **Module Hours (Admin)** | lesson_progress.time_spent_seconds | Increases per lesson |
| **Category Breakdown** | enrollments grouped by course.category | Proportional to time |
| **Completion Rate** | enrollments.completed = true | Increases with completed courses |
| **Avg Session Time** | enrollments.hoursspent / enrollments.count | Improves over time |

---

## 🔍 Debugging Checklist

If times show as 0 or incorrect:

- [ ] **Lesson completion triggered?**
  - Check console logs: `[LESSON_PROGRESS] Recording XXs for lesson`
  
- [ ] **Time calculation correct?**
  - Verify `Date.now()` and `lessonStartTimeRef.current` are different
  - Check `Math.max(1, ...)` logic
  
- [ ] **Database write successful?**
  - Check for errors in Supabase logs
  - Verify `time_spent_seconds` field exists in schema
  
- [ ] **View updated?**
  - Materialized views need refresh
  - Check `module_learning_stats_summary` recent update

---

## 🚀 Implementation Timeline

| Date | Change | Impact |
|------|--------|--------|
| Apr 9 | Certificate cleanup system added | Admin can clean orphaned certs |
| Apr 10 12:17 | Certificate deletion on retake fixed | Course reset works properly |
| Apr 10 12:29 | Lesson time tracking fixed | Module hours now display |
| Apr 10 | This verification guide | Standardized testing |

---

## 💡 Notes

1. **Time is in SECONDS** internally - all conversions use timeTrackingService
2. **Minimum 1 second** per lesson completion prevents zero durations
3. **Time accumulates** on retakes (doesn't overwrite)
4. **lessonStartTimeRef resets** per lesson access (accurate per-lesson timing)
5. **Course hours** = sum of all lesson times for that course

---

## Next Steps

1. **Deploy** both fixes to production
2. **Test** with actual users completing lessons
3. **Monitor** dashboard for time display accuracy
4. **Verify** module hours against expected totals
5. **Document** any edge cases or issues found
