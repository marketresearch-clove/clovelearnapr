# Admin Dashboard Data Loading Fixes

## Summary of Issues Fixed

### 1. ✅ User Statistics RLS Policy (APPLIED)
**Issue**: Admin dashboard couldn't display XP points, completed courses, hours
**Root Cause**: `user_statistics` table had no admin bypass policy
**Solution**: Added two RLS policies:
- `"Admins can read all user statistics"` - allows admins to query all user stats
- `"Authenticated users can read all user statistics"` - allows public stats access

**Status**: ✅ Successfully applied to database

### 2. ⚠️ Module Learning Stats View (NEEDS APPLICATION)
**Issue**: ModulesTable showing no data, filters not populating
**Root Cause**: Migration file had column name mismatches and invalid syntax
- Used `user_id` instead of `userid`
- Used `is_completed` instead of `completed`
- Used `time_spent_seconds` instead of `hoursspent`
- Tried to create indexes on view (invalid in PostgreSQL)
- Invalid RLS policy syntax

**Solution**: Fixed migration file at `supabase/migrations/20260407_create_module_learning_stats_view.sql`

**Required Action**: Run this migration in Supabase CLI:
```bash
supabase db push
```

### 3. ⚠️ Top Skills Data Loading
**Issue**: AdminDashboard showing "No skills data available"
**Root Cause**: Either:
- Skills table is empty, OR
- `user_skill_achievements` query returns no data

**Solution**: Verify data exists:
```sql
-- Check if skills exist
SELECT COUNT(*) FROM skills;

-- Check if user achievements exist
SELECT COUNT(*) FROM user_skill_achievements;
```

**Required Action**:
- If skills table is empty, add test skills data
- If achievements table is empty, ensure skill assignments are being created

### 4. ⚠️ UsersTable Showing 0 XP
**Issue**: Even with RLS fix, users still show 0 XP
**Root Cause**: Could be:
- RLS policy permissions issue
- No actual data in `user_statistics` table
- Data hasn't been populated by triggers

**Solution**: Check:
```sql
-- Verify data is being populated
SELECT userid, totalpoints, totallearninghours, coursescompleted
FROM user_statistics
LIMIT 5;

-- Check if RLS policy is working (run as admin):
SELECT roles FROM auth.users LIMIT 1; -- Verify you're admin
SELECT COUNT(*) FROM user_statistics; -- Should return > 0
```

**Required Action**:
- Manually trigger stat calculations if needed
- Verify users have learning hours logged

## Files Modified

1. ✅ `supabase/migrations/20260407_fix_admin_dashboard_rls.sql` - APPLIED
2. 🔧 `supabase/migrations/20260407_create_module_learning_stats_view.sql` - FIXED, NEEDS APPLICATION
3. 📋 `supabase/migrations/20260407_add_linkedin_profile_url.sql` - Already exists

## Deployment Steps

1. **Apply Module Learning Stats View Migration**:
   ```bash
   supabase db push
   ```

2. **Test Admin Dashboard**:
   - Navigate to Admin Dashboard
   - Verify XP points load in users table
   - Verify "Top Skills in Organization" section populates
   - Verify ModulesTable filters show courses and categories
   - Verify all analytics cards show data

3. **Verify RLS Policies in Supabase**:
   - Go to SQL Editor
   - Run: `SELECT tablename, policyname FROM pg_policies WHERE tablename = 'user_statistics' ORDER BY policyname;`
   - Should see both new policies: "Admins can read all user statistics" and "Authenticated users can read all user statistics"

## Key Database Tables & Columns

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `user_statistics` | userid, totalpoints, totallearninghours, coursescompleted | User learning stats |
| `user_skill_achievements` | user_id, skill_id, proficiency_level | User skill data |
| `enrollments` | userid, courseid, completed | Course enrollments |
| `learning_hours` | userid, hoursspent | Learning time tracking |
| `lessons` | id, title, courseid | Module/lesson definitions |
| `lesson_progress` | userid, lessonid, completed | User lesson progress |
| `courses` | id, title, categoryid | Course metadata |
| `skills` | id, name | Skill definitions |

## Column Name Corrections Applied

| Table | Old Column | Correct Column |
|-------|-----------|-----------------|
| enrollments | course_id | courseid |
| enrollments | user_id | userid |
| lesson_progress | lesson_id | lessonid |
| lesson_progress | user_id | userid |
| lesson_progress | is_completed | completed |
| lesson_progress | time_spent_seconds | (use learning_hours table instead) |
| lessons | course_id | courseid |
| user_skill_achievements | user_id | user_id (correct) |

## Testing Checklist

- [ ] Module learning stats view successfully created
- [ ] Admin dashboard "Total Employees" shows correct count
- [ ] Admin dashboard "Active Learners" shows correct count
- [ ] Admin dashboard "Learning Hours" shows total hours
- [ ] Admin dashboard "Completion Rate" shows percentage
- [ ] UsersTable shows XP points (not 0)
- [ ] UsersTable shows Learning Hours (not 0)
- [ ] UsersTable shows Completed Courses (not 0)
- [ ] "Top Skills in Organization" section populates with skills
- [ ] ModulesTable shows courses in filter dropdown
- [ ] ModulesTable shows categories in filter dropdown
- [ ] ModulesTable filters work correctly
- [ ] All analytics metrics are accurate
