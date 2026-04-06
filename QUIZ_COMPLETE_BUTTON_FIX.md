# Quiz Completion Button & RLS Fix

## Issues Fixed

### 1. ✅ Mark Complete Button Enable on Quiz Pass
The "Mark Complete" button in the header is now properly enabled when a quiz is passed, allowing learners to complete the lesson without refreshing the page.

**Changes Made:**
- Simplified `handleQuizSubmit()` to immediately update state when quiz is passed
- Button disabled state properly checks `quizPassed` flag
- Button shows pulsing animation when quiz is passed and ready to be marked complete
- Success alert directs user to click "Mark Complete" button in header

**Current Flow:**
1. User completes quiz → Quiz submit handler calculates if passed
2. If `percentage >= passingScore`: `setQuizPassed(true)` is called
3. Success alert shows score and instruction to mark complete
4. "Mark Complete" button in header becomes enabled and pulsing
5. User clicks button to complete lesson → `updateLessonProgress(100, true)`

---

### 2. ✅ Fixed RLS Error on Assessment Loading
The 403 RLS error (`new row violates row-level security policy for table "assessments"`) is now fixed.

**Root Cause:**
The application was attempting to auto-create assessments when loading a quiz lesson, but learners don't have (and shouldn't have) INSERT permissions on the assessments table.

**Changes Made in `LessonPlayerPage.tsx`:**
```typescript
// OLD: Tried to INSERT assessments (causes 403 RLS error for learners)
const { data: createdAssessment, error: createError } = await supabase
  .from('assessments')
  .insert([newAssessment])
  .select()
  .single();

// NEW: Only reads existing assessments
const { data: existingAssessments, error: readError } = await supabase
  .from('assessments')
  .select('*')
  .eq('lessonid', lessonId);

if (existingAssessments && existingAssessments.length > 0) {
  setAssociatedAssessment(existingAssessments[0]);
  // Success - assessment loaded
} else {
  console.warn(`No assessment found for lesson ${lessonId}`);
  // Assessment should be created by instructor only
}
```

**Why This is Better:**
- ✅ Learners can only READ assessments (no 403 errors)
- ✅ Assessments are created by instructors/admins only
- ✅ Proper separation of concerns and security

---

## Setup Instructions

### For Course Instructors/Admins:

**Assessments MUST be created by instructors** - they are no longer auto-created by learners.

To create a quiz assessment for a lesson:
1. Go to Course Builder → Find the lesson with quiz content
2. The assessment should be created via the admin interface
3. Quiz content in the lesson body will be referenced when loading the assessment

---

### For Supabase Configuration:

Ensure the RLS policy on the `assessments` table allows:

**For Learners/Authenticated Users:**
- ✅ SELECT (read assessments for courses they're enrolled in)
- ✅ Cannot INSERT (instructors only)
- ✅ Cannot UPDATE (instructors only)
- ✅ Cannot DELETE (instructors only)

**For Instructors/Admin:**
- ✅ SELECT, INSERT, UPDATE, DELETE (full permissions)

**Recommended RLS Policy:**

```sql
-- For learners: Can read assessments for their enrolled courses
CREATE POLICY "Learners can read assessments for enrolled courses"
ON assessments FOR SELECT
USING (
  courseid IN (
    SELECT courseid FROM enrollments 
    WHERE userid = auth.uid()
  )
);

-- For instructors/admins: Full access
CREATE POLICY "Instructors and admins manage assessments"
ON assessments FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role = 'admin' OR role = 'instructor'
  )
);
```

---

## Testing Checklist

- [ ] Learner opens quiz lesson without RLS 403 error
- [ ] Learner completes quiz successfully
- [ ] "Mark Complete" button becomes enabled (not grayed out)
- [ ] "Mark Complete" button shows pulsing animation
- [ ] User clicks "Mark Complete" button (no refresh needed)
- [ ] Lesson marked as complete and sidebar updates
- [ ] User switches to another lesson and back - completion status persists

---

## Troubleshooting

### Still Getting 403 Error?
1. Check Supabase RLS policies on `assessments` table
2. Verify learner can SELECT from assessments
3. Ensure assessments are created for quiz lessons in the database

### Mark Complete Button Not Appearing?
1. Check browser console for errors
2. Verify quiz passed condition: `quizPassed === true`
3. Check that `associatedAssessment` loaded successfully

### Quiz Passed State Not Updating?
Run this in browser console to debug:
```javascript
console.log({
  quizPassed,
  associatedAssessment: associatedAssessment?.id,
  lessonType: activeLesson?.type,
  buttonDisabled: /* check disabled property */
})
```

---

## Files Modified
- `pages/LessonPlayerPage.tsx`
  - `loadOrCreateAssessment()` - Now read-only
  - `handleQuizSubmit()` - Simplified state updates
  - `handleLessonClick()` - Added lesson progress loading

---

## Related Code Sections

**Mark Complete Button Logic (Desktop):**
```typescript
disabled={
  (activeLesson?.type === 'pdf' && !pdfScrolledToEnd) ||
  (activeLesson?.type === 'quiz' && !quizPassed) ||  // ← Checks quizPassed
  contentBlocks.some(b => b.type === 'acknowledgement' && (!acknowledgedBlocks[b.id] || !signatureValues[b.id]?.trim()))
}
className={`
  ${/* ... */ activeLesson?.type === 'quiz' && quizPassed
    ? 'bg-emerald-600 animate-pulse'  // ← Pulsing when passed
    : 'bg-emerald-600'
  }`}
```

**Quiz Passed State Check:**
```typescript
useEffect(() => {
  if (activeLesson?.type === 'quiz' && associatedAssessment?.id && user?.id) {
    checkAndSetQuizPassed(associatedAssessment.id);  // ← Auto-checks on load
  }
}, [associatedAssessment?.id, activeLesson?.type, user?.id]);
```
