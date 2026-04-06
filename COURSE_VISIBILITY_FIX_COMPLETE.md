# Course Visibility Fix - Complete Solution

## Issues Fixed

### Issue 1: Cannot Hide Courses from Public Catalog
- **Problem**: The `is_hidden` column didn't exist in the `courses` table
- **Solution**: Created migration file to add `is_hidden` boolean column with default false
- **File**: `sql/MIGRATION_ADD_IS_HIDDEN_TO_COURSES.sql`

### Issue 2: Hidden Courses Still Showing in Public Catalog
- **Problem**: `getPublishedCourses()` wasn't filtering out hidden courses
- **Solution**: Added `.neq('is_hidden', true)` filter to the query
- **File**: `lib/courseService.ts` - Updated `getPublishedCourses()` function

### Issue 3: User Selections Reset When Applying Filters
- **Problem**: When users selected courses to hide and then applied filters, the selected users were cleared
- **Solution**: Modified `applyFilters()` to preserve user selections instead of clearing them
- **Logic**: Only removes users who are no longer in the filtered list
- **File**: `pages/ManageCourseAssignments.tsx` - Updated `applyFilters()` function

## How the Features Work

### Feature 1: Hide Course from Public Catalog
1. Admin goes to Course Details in Admin Dashboard
2. Toggles "Hide from Public Catalog" switch
3. Sets `is_hidden = true` on the course record
4. Course no longer appears in CatalogPage.tsx for public users
5. Course still available for assignment to specific users (via ManageCourseAssignments)

### Feature 2: Hide Course from Specific Users
1. Admin goes to "Manage Course Assignments"
2. Selects specific users and courses
3. Clicks "Hide from X users" button
4. Sets `is_visible = false` in `course_assignments` table for that user/course combination
5. Course no longer appears in MyLearningPage for that user
6. Course remains visible in public catalog but not assigned to that specific user

### Feature 3: Filter Users for Bulk Operations
1. Admin can now filter users by department, company, designation, etc.
2. User selections are preserved when applying filters
3. Users matching the filters remain selected after filter is applied
4. Unmatched users are removed from selection

## Database Changes Required

```sql
-- Run this migration in Supabase SQL Editor
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_courses_is_hidden 
ON public.courses(is_hidden) WHERE is_hidden = true;

COMMENT ON COLUMN public.courses.is_hidden IS 'When true, course is hidden from public catalog but can still be assigned to users by admins';
```

## Files Modified

### Database
- `sql/MIGRATION_ADD_IS_HIDDEN_TO_COURSES.sql` (NEW)

### Service Layer
- `lib/courseService.ts` - Updated `getPublishedCourses()` method
  - Added filter: `.neq('is_hidden', true)`

### UI Components
- `pages/ManageCourseAssignments.tsx` - Updated `applyFilters()` function
  - Fixed: Preserves user selections across filter changes
  - Removed: Blanket `setSelectedUsers([])` reset
  - Added: Smart filtering that only removes unfound users

## Testing Checklist

- [ ] Run the migration to add `is_hidden` column to courses table
- [ ] In Admin Dashboard, edit a course and toggle "Hide from Public Catalog" - should save without error
- [ ] Visit CatalogPage - hidden courses should not appear
- [ ] Go to ManageCourseAssignments - select users and courses
- [ ] Filter users by department - selected users should remain selected
- [ ] Click "Hide from X users" - should hide the course for those users
- [ ] User visits MyLearningPage - hidden courses should not appear
- [ ] Admin views "All Course Assignments" - should show hidden assignments with "hidden" status

## Rollback Plan

If issues occur:
1. Remove the `is_hidden` column: `ALTER TABLE courses DROP COLUMN IF EXISTS is_hidden;`
2. Revert ManageCourseAssignments.tsx to clear selectedUsers on filter changes
3. Revert courseService.ts getPublishedCourses() to not filter by is_hidden
