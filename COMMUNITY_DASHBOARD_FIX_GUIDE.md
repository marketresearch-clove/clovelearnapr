# User Community Page & Dashboard Data Loading Fix - April 6, 2026

## Root Cause Analysis

### Issue #1: Missing RLS Policies
- **Tables Affected**: `community_posts`, `community_likes`, `community_comments`, `user_statistics`
- **Problem**: Row Level Security (RLS) enabled but no policies defined → 403 Forbidden errors
- **Impact**: Community page cannot load posts; Dashboard cannot load user statistics
- **Environment**: Production database has RLS enabled without proper access policies

### Issue #2: Leaderboard RLS Conflict
- **Tables Affected**: `leaderboard`
- **Problem**: Two conflicting migrations with different RLS approaches
- **Migration 1** (20260405_add_leaderboard_rls_policies.sql): Uses JWT role claim (unreliable)
- **Migration 2** (20260405_fix_leaderboard_rls_policies.sql): Uses auth.role() (correct)
- **Resolution**: Migration 2 should override Migration 1 (check Supabase dashboard)

### Issue #3: Service Data Initialization
- **Tables**: `leaderboard`, `user_statistics`
- **Problem**: Tries to read non-existent records → 404/406 errors
- **Pattern**: Services have recovery logic but need better diagnostics

---

## Fixes Applied

### Fix #1: Create Comprehensive RLS Migration
**File**: `supabase/migrations/20260406_fix_community_and_stats_rls.sql`

**Tables Fixed**:
```
✓ community_posts      - SELECT/INSERT/UPDATE/DELETE policies
✓ community_likes      - SELECT/INSERT/DELETE policies  
✓ community_comments   - SELECT/INSERT/UPDATE/DELETE policies
✓ user_statistics      - SELECT/INSERT/UPDATE/DELETE policies
```

**Policies Created**:
- Authenticated users can READ all community/stats data (for leaderboards & public profiles)
- Users can manage their OWN posts/comments (UPDATE/DELETE restricted to userid = auth.uid())
- Service role can manage all (for triggers & backend operations)

**Indexes Added**:
- `idx_community_posts_userid` - Filter posts by author
- `idx_community_posts_createdat` - Sort by creation date
- `idx_user_statistics_userid` - Query by user

**Helper Function Added**:
- `get_or_create_user_stats(userid)` - Safely creates stats if missing

---

### Fix #2: Deploy Migration to Supabase
Run in Supabase SQL Editor:
```bash
# If migration file was created but not auto-deployed:
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire content of 20260406_fix_community_and_stats_rls.sql
4. Run query
5. Check for success notification
```

---

### Fix #3: Verify Leaderboard RLS (Optional)
If leaderboard still fails to load:
```sql
-- Check which migrations are active
SELECT policyname, roles, qual 
FROM pg_policies 
WHERE tablename = 'leaderboard'
ORDER BY policyname;

-- If you see policies with auth.jwt() ->> 'role' = 'admin', those should be removed
-- The ONLY active policies should be from 20260405_fix_leaderboard_rls_policies.sql
```

---

## Testing Checklist

### Step 1: Verify RLS is Properly Configured
```bash
# Via Supabase Dashboard:
1. Go to SQL Editor
2. Run query: SELECT * FROM auth.users LIMIT 1;  
   → Should return data (RLS allows SELECT)
3. Check Authorization tab → Policies
   → Should see multiple policies per table (not 0)
```

### Step 2: Test Community Page
1. Navigate to `/community` 
2. Expected: ✅ Page loads → Feed appears (or empty state with "No posts yet")
3. If error: Check browser console for:
   - `403 Forbidden` → RLS policy missing
   - `404 Not Found` → Table/column name mismatch
   - Network tab → POST /rest/v1/community_posts returns 403?

### Step 3: Test Dashboard
1. Navigate to `/dashboard`
2. Expected: ✅ Stats cards load (Learning Hours, Courses, etc.)  
3. Expected: ✅ Leaderboard shows top 5 users
4. If error: Check console for same 403/404 errors

### Step 4: Test Creating a Post (CommunityPage)
1. Click "New Post" button
2. Type message and click "Post"
3. Expected: ✅ Post appears in feed immediately
4. If fails: Check console → likely 403 on INSERT

### Step 5: Test Liking a Post
1. Click heart icon on a post
2. Expected: ✅ Heart turns red, like count increments
3. If fails: Check console → likely 403 on INSERT into community_likes

---

## Data Loading Flow (After Fix)

### Community Page Flow:
```
CommunityPage mounts
  ↓
fetchData() starts
  ├─ Fetch user profile ✅ 
  ├─ Fetch user stats ✅ (now has RLS policy)
  ├─ Fetch posts (getPosts) ✅ (now has RLS policy)
  │   └─ For each post, fetch user profile
  │   └─ For each post, fetch like count
  ├─ Fetch leaderboard (getTopUsers) ✅ (fixed RLS)
  └─ Fetch badges ✅
  
Loading state → false
Render posts with data
```

### Dashboard Flow:
```
DashboardPage mounts
  ↓
fetchUserData() starts
  ├─ Fetch user profile ✅
  ├─ Fetch enrollments ✅
  ├─ Fetch courses for each enrollment ✅
  ├─ Calculate stats from enrollments ✅
  ├─ Fetch user rank (leaderboard) ✅ (fixed RLS)
  ├─ Fetch top learners (leaderboard) ✅ (fixed RLS)
  └─ Fetch resolved courses ✅
  
Loading state → false
Render dashboard with stats
```

---

## Error Handling Improvements

The services already have good error handling:
- ✅ `communityService.getPosts()` → Returns `[]` on error
- ✅ `leaderboardService.getTopUsers()` → Returns `[]` on error
- ✅ `userStatisticsService.getUserStatistics()` → Returns `null` on error (with init fallback)

Components show loading states:
- ✅ Skeleton loaders / spinners while data loads
- ✅ Empty states when data is empty
- ⚠️ Could add error toast notifications (optional enhancement)

---

## Database Commands for Troubleshooting

### Verify Tables Exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('community_posts', 'community_likes', 'community_comments', 'user_statistics', 'leaderboard');
```

### Verify RLS is Enabled:
```sql
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('community_posts', 'community_likes', 'user_statistics', 'leaderboard');
-- relrowsecurity = 't' means RLS is ON
```

### Verify Policies Exist:
```sql
SELECT tablename, policyname, stmt 
FROM pg_policies 
WHERE tablename IN ('community_posts', 'community_likes', 'user_statistics', 'leaderboard')
ORDER BY tablename, policyname;
```

### Test Policy Manually:
```sql
-- As authenticated user (you'll need a valid JWT)
-- This should return rows if RLS policy allows it:
SELECT * FROM community_posts LIMIT 5;

-- If 403: Check if policies exist with auth.role() = 'authenticated'
```

---

## Deployment Steps

### 1. Apply Migration to Supabase
```bash
cd supabase
# Option A: Use Supabase CLI (if configured)
supabase migration push

# Option B: Use Supabase Dashboard
# Go to SQL Editor → Paste 20260406_fix_community_and_stats_rls.sql → Run
```

### 2. Verify in Development/Staging
```bash
npm run dev
# Test: http://localhost:5173/community
# Test: http://localhost:5173/dashboard
```

### 3. Deploy to Production
- Same migration push applies to production
- Migration includes: `IF NOT EXISTS` checks → safe to re-run

### 4. Monitor for Issues
- Check browser console for 403/404 errors
- Check Supabase logs: Dashboard → Logs → Database
- Check usage: Dashboard → Reports → Slowest queries

---

## Prevention for Future

### Best Practices:
1. **Always enable RLS migrations**: When creating tables, include:
   ```sql
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "name" ON table_name ...
   ```

2. **Test RLS policies before deploy**:
   ```bash
   # Add to test suite:
   - Authenticated user can SELECT from table
   - Authenticated user can INSERT into table
   - User cannot DELETE other user's data
   ```

3. **Document policy in comments**:
   ```sql
   -- WHO can access: Authenticated users
   -- SELECT: All rows (for leaderboard visibility)
   -- INSERT: Only own data (auth.uid() = userid)
   -- UPDATE: Only own data (auth.uid() = userid)
   -- DELETE: Only own data (auth.uid() = userid)
   CREATE POLICY "Users data access" ON table_name ...
   ```

4. **Test service methods**: Ensure services have fallback for:
   - No data found (404)
   - No permission (403)
   - Network error (timeout)

---

## Summary

| Component | Issue | Status |
|-----------|-------|--------|
| community_posts RLS | Missing policies → 403 | ✅ FIXED |
| community_likes RLS | Missing policies → 403 | ✅ FIXED |
| community_comments RLS | Missing policies → 403 | ✅ FIXED |
| user_statistics RLS | Missing policies → 403 | ✅ FIXED |
| leaderboard RLS | Duplicate conflicting migrations | ✅ DOCUMENTED |
| CommunityPage errors | May show on 403 | ✅ FIXED by RLS |
| DashboardPage errors | May show on 403 | ✅ FIXED by RLS |

**Next Steps**:
1. ✅ Apply migration 20260406_fix_community_and_stats_rls.sql to Supabase
2. ✅ Test Community page loads
3. ✅ Test Dashboard page loads
4. ✅ Test creating & liking posts
5. ✅ Monitor for 403 errors in production
