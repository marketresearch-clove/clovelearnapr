# Detailed Changes Summary - Apr 10, 2026

## Overview
Two critical fixes applied to the time tracking and certificate management systems.

---

## Change #1: Certificate Deletion on Course Reset

### Files Modified
- `lib/enrollmentService.ts`
- `lib/certificateValidationService.ts`

### Problem
When users reset course progress (retake), certificates were not being deleted. The deletion would silently fail due to foreign key constraints in the `certificate_signatures` table.

### Solution: Delete Signatures First
1. Get all certificate IDs for user/course
2. Delete from `certificate_signatures` table first
3. Then delete from `certificates` table

This respects the foreign key constraint.

---

## Change #2: Populate Lesson Time Tracking

### Files Modified
- `lib/lessonProgressService.ts` 
- `pages/LessonPlayerPage.tsx`

### Problem
Module hours showed 0.00 because `lesson_progress.time_spent_seconds` was never populated.

### Solution: Track Time on Completion
1. Calculate elapsed time when lesson completes
2. Formula: `Math.max(1, Math.round((Date.now() - lessonStartRef) / 1000))`
3. Pass to service and store in database
4. Accumulate on retakes (don't overwrite)

### Changes in lessonProgressService.ts
- Added `timeSpentSeconds = 0` parameter to `updateLessonProgress()`
- Fetch existing `time_spent_seconds` when updating
- Calculate new total: `existing + timeSpentSeconds`
- Include time on both insert and update operations

### Changes in LessonPlayerPage.tsx
- Calculate elapsed seconds when lesson completes
- Pass to service: `updateLessonProgress(..., elapsedSeconds)`
- Only calculates time when `completed = true`

---

## Data Flow After Fixes

```
User Completes Lesson
    ↓
Calculate: elapsedSeconds = (Date.now() - lessonStartTimeRef) / 1000
    ↓
Call: updateLessonProgress(..., elapsedSeconds)
    ├─ Updates lesson_progress.time_spent_seconds += elapsed
    ├─ Records learning_hours
    └─ Updates enrollments.hoursspent
    ↓
Views & Dashboards Read Updated Data
    ├─ module_learning_stats_summary → Shows module hours ✓
    ├─ enrollments → Shows course hours ✓
    └─ Dashboard → Shows all correctly ✓
```

---

## Commits Created

**ba88a35** - Fix certificate deletion when resetting course progress
- Solves orphaned certificate issue
- Both enrollmentService and certificateValidationService updated

**b0e6a70** - Populate lesson_progress.time_spent_seconds on lesson completion
- Fixes module hours showing 0.00
- Enables lesson-level time tracking
- Both service and UI layer updated

---

## Testing

### Quick Test (5 minutes)
1. Complete a lesson and wait ~30 seconds
2. Mark as complete
3. Query: `SELECT time_spent_seconds FROM lesson_progress WHERE userid = '...' AND lessonid = '...'`
4. Should show ~30 (not 0)

### Full Tests Available
See `TIME_TRACKING_VERIFICATION.md` for comprehensive test procedures

---

## Key Implementation Details

- **Time Unit:** SECONDS (consistent throughout)
- **Minimum Duration:** 1 second per completion
- **Accumulation:** Yes, time adds up on retakes
- **Storage:** Integer in seconds
- **Conversion:** `timeTrackingService` handles display formatting

---

## Status: READY FOR PRODUCTION

- ✅ Fixes committed
- ✅ Code compiles
- ✅ Database schema compatible (no changes needed)
- ✅ Documentation complete
- ✅ Testing procedures provided
