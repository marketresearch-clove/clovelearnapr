# RLS Policy Fix - Assessment Completion Error

## ✅ WHAT WAS WRONG

The error occurred because:
1. **Incorrect Column Names in Your Policy:**
   - You used: `course_id` (with underscore)
   - Database uses: `courseid` (no underscore)
   - You used: `lesson_id` (with underscore) 
   - Database uses: `lessonid` (no underscore)
   - You referenced: `user_id` in profiles
   - Database uses: `id` in profiles

2. **Root Cause of 403 Error:**
   - The application code was trying to **INSERT** (auto-create) assessments
   - Learners don't have INSERT permissions on assessments table
   - This caused the 403 RLS error

---

## ✅ WHAT I FIXED

### Code Fix (Already Applied)
In `pages/LessonPlayerPage.tsx`:
- Removed the auto-create assessment logic
- Now **only READS** existing assessments from the database
- Learners no longer attempt INSERT operations

**Before (Caused 403 Error):**
```typescript
const { data: createdAssessment, error: createError } = await supabase
  .from('assessments')
  .insert([newAssessment])  // ❌ 403 Error - learners can't insert
  .select()
  .single();
```

**After (Fixed):**
```typescript
const { data: existingAssessments } = await supabase
  .from('assessments')
  .select('*')  // ✅ Only reads - no 403 error
  .eq('lessonid', lessonId);
```

### RLS Policy Fix (Manual - Use Corrected SQL)
Use the corrected column names in your RLS policies:

**WRONG:**
```sql
WHERE course_id IN (...)           -- ❌ Column doesn't exist
WHERE lesson_id = ...              -- ❌ Column doesn't exist  
WHERE profiles.user_id = ...       -- ❌ Column doesn't exist
```

**RIGHT:**
```sql
WHERE courseid IN (...)            -- ✅ Correct column name
WHERE lessonid = ...               -- ✅ Correct column name
WHERE profiles.id = ...            -- ✅ Correct column name
```

---

## 📋 DEPLOYMENT STEPS

### Step 1: Code is Already Fixed ✅
The code changes to `LessonPlayerPage.tsx` are complete.

### Step 2: Update RLS Policies (Optional but Recommended)
The existing policies are already permissive enough for learners to read assessments. However, for better security, you can optionally run the corrected SQL file:

**File:** `RLS_POLICIES_ASSESSMENTS_CORRECTED.sql`

**How to Run:**
1. Go to Supabase Dashboard → Your Project
2. Click "SQL Editor" 
3. Click "New Query"
4. Copy/paste the contents of `RLS_POLICIES_ASSESSMENTS_CORRECTED.sql`
5. Click "Run" button
6. Drop any conflicting policies if prompted

**Important:** If policies exist, you may need to drop them first:
```sql
DROP POLICY IF EXISTS "Learners can read assessments for enrolled courses" ON assessments;
DROP POLICY IF EXISTS "Instructors and admins can read all assessments" ON assessments;
-- etc...
```

---

## 🧪 TESTING AFTER FIX

### Test 1: Open Quiz Lesson
- ✅ No 403 error should appear
- ✅ Assessment loads successfully
- ✅ Quiz displays properly

### Test 2: Complete Quiz and Mark Complete
- ✅ Quiz submission succeeds
- ✅ "Mark Complete" button becomes enabled
- ✅ Button shows pulsing animation
- ✅ No refresh needed

### Test 3: Verify Button Works
- ✅ Click "Mark Complete"
- ✅ Lesson marked as complete
- ✅ Progress bar updates

### Test 4: Lesson Persistence
- ✅ Refresh page
- ✅ Stay on same lesson (URL persists)
- ✅ Completion status remains

---

## 🔍 VERIFICATION QUERIES

Run these in Supabase SQL Editor to verify:

### Check 1: Assessments Table Structure
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assessments'
ORDER BY ordinal_position;
```
**Should show columns:** id, courseid, lessonid, title, description, etc.

### Check 2: RLS Policies
```sql
SELECT policyname, permissive, roles 
FROM pg_policies 
WHERE tablename = 'assessments'
ORDER BY policyname;
```
**Should show:** Existing assessment policies with correct logic

### Check 3: Can Learner Read Assessment?
```sql
-- Replace with actual user_id and assessment courseid
SELECT id, title FROM assessments 
WHERE courseid = 'YOUR_COURSE_ID'
LIMIT 1;
```
**Should return:** Assessment record(s)

---

## 🚀 SUMMARY

| Issue | Status | Fix |
|-------|--------|-----|
| Code tries to INSERT assessments | ✅ FIXED | Removed auto-create logic |
| Wrong column names in SQL | ✅ FIXED | Updated to use `courseid`, `lessonid`, `id` |
| 403 RLS Error on quiz load | ✅ FIXED | Learners now only SELECT, not INSERT |
| Mark Complete button doesn't work | ✅ FIXED | Immediate state updates on quiz pass |
| Page resets to first lesson on refresh | ✅ FIXED | URL now includes lesson ID |

---

## 📞 TROUBLESHOOTING

### Still Getting 403 Error?
1. Verify code changes are deployed
2. Check RLS policies show learner can SELECT
3. Clear browser cache and reload

### Assessment Still Not Loading?
1. Verify assessment exists in database
   ```sql
   SELECT id, title FROM assessments LIMIT 5;
   ```
2. Check the lessonid matches
   ```sql
   SELECT id FROM assessments WHERE lessonid = 'LESSON_ID_HERE';
   ```

### Quiz Not Marking Complete?
1. Check quiz passed (>= passing score)
2. Check browser console for errors
3. Verify lesson_progress table is updated

---

## 📁 FILES MODIFIED/CREATED

- ✅ `pages/LessonPlayerPage.tsx` - Code fixes (already deployed)
- ✅ `QUIZ_COMPLETE_BUTTON_FIX.md` - Documentation updated with correct SQL
- ✅ `RLS_POLICIES_ASSESSMENTS_CORRECTED.sql` - Corrected policies for deployment
- ✅ This guide - Complete troubleshooting and deployment steps
