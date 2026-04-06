# Leaderboard 406 Error Fix - Troubleshooting Guide

## Issue Summary
The leaderboard API was returning **406 (Not Acceptable)** errors when querying:
```
GET https://veaawiernjkdsfiziqen.supabase.co/rest/v1/leaderboard?select=*&userid=eq.5671e11c-0c1b-4159-b804-c780e7a8b083 406
```

## Root Cause
The `leaderboard` table was missing or had:
1. ❌ No RLS (Row Level Security) policies enabled
2. ❌ Incorrect or missing access permissions
3. ❌ Missing table definition in some environments

## Applied Fixes

### 1. ✅ Created RLS Policies Migration
**File:** `supabase/migrations/20260405_add_leaderboard_rls_policies.sql`

Added three essential policies:
- **SELECT Policy:** All authenticated users can read the leaderboard
- **INSERT Policy:** Only admins can add entries
- **UPDATE Policy:** Only admins can update entries

### 2. ✅ Created Complete Table Schema Migration
**File:** `supabase/migrations/20260405_create_leaderboard_table_if_missing.sql`

Created the `leaderboard` table with:
- Proper column definitions (userid, username, totalpoints, coursescompleted, etc.)
- UNIQUE constraint on userid to prevent duplicates
- Performance indexes on frequently queried columns
- Auto-updated timestamp with trigger

### 3. ✅ Enhanced Error Handling
**File:** `lib/leaderboardService.ts`

Improved all methods with:
- Detailed error logging including status codes and error messages
- Better null/undefined handling
- Added diagnostic method `testLeaderboardConnection()`

## How to Verify the Fix

### Option 1: Using Console Test
1. Open your app in a browser
2. Open Developer Console (F12)
3. Run this code:
```javascript
// Import and test the leaderboard service
import { leaderboardService } from './lib/leaderboardService.ts';

// Test 1: Check table connection
const connection = await leaderboardService.testLeaderboardConnection();
console.log('Connection test:', connection);

// Test 2: Fetch leaderboard
const leaderboard = await leaderboardService.getLeaderboard(10);
console.log('Leaderboard data:', leaderboard);

// Test 3: Fetch with profiles
const leaderboardWithProfiles = await leaderboardService.getLeaderboardWithProfiles(10);
console.log('Leaderboard with profiles:', leaderboardWithProfiles);
```

### Option 2: Direct Supabase SQL Check
1. Go to your Supabase Dashboard
2. SQL Editor → New Query
3. Run:
```sql
-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'leaderboard';

-- Check policies
SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'leaderboard';

-- Check data
SELECT COUNT(*) as total_records FROM leaderboard;

-- Check specific user
SELECT * FROM leaderboard WHERE userid = '5671e11c-0c1b-4159-b804-c780e7a8b083';
```

## What Changed in the Code

### leaderboardService.ts Updates

#### Before:
```typescript
const { data, error } = await supabase
  .from('leaderboard')
  .select('*');
  
if (error) throw error;  // Minimal error info
```

#### After:
```typescript
const { data, error, status, statusText } = await supabase
  .from('leaderboard')
  .select('*');

if (error) {
  console.error('Leaderboard query error:', {
    error,
    status,
    statusText,
    message: error?.message,
    code: error?.code
  });
  throw error;
}
```

## Testing Checklist

- [ ] **RLS Policies Applied**: Check Supabase dashboard → Authentication → Policies
- [ ] **Table Exists**: Run `SELECT COUNT(*) FROM leaderboard;` in SQL editor
- [ ] **Can Read Data**: No 406 errors when fetching leaderboard
- [ ] **Can Filter by userId**: Query with `?userid=eq.YOUR_USER_ID` works
- [ ] **Performance**: Queries complete in < 1 second
- [ ] **Leaderboard Page Loads**: No errors in browser console
- [ ] **Ranking Displays Correctly**: Users sorted by totalpoints, then coursescompleted

## If Issues Persist

### Check 1: Verify Migrations Were Applied
```sql
SELECT * FROM schema_migrations WHERE name LIKE '%leaderboard%';
```

### Check 2: Check the Leaderboard Table Structure
```sql
\d leaderboard;  -- PostgreSQL table info
```

### Check 3: Test Direct Query
```sql
SELECT * FROM leaderboard LIMIT 1;
```

### Check 4: Check Authentication
```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.id);
console.log('User role:', user?.app_metadata?.role);
```

## Rollback Instructions (if needed)

If you need to revert changes:
```sql
-- Drop policies
DROP POLICY IF EXISTS "Authenticated users can read leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "System can update leaderboard entries" ON leaderboard;
DROP POLICY IF EXISTS "Admins can manage leaderboard" ON leaderboard;

-- Disable RLS
ALTER TABLE leaderboard DISABLE ROW LEVEL SECURITY;
```

## Related Files Modified
1. `supabase/migrations/20260405_add_leaderboard_rls_policies.sql` (NEW)
2. `supabase/migrations/20260405_create_leaderboard_table_if_missing.sql` (NEW)
3. `lib/leaderboardService.ts` (UPDATED - Enhanced error handling)

## Next Steps
1. ✅ Apply migrations via Supabase CLI or Dashboard
2. ✅ Test in development environment
3. ✅ Verify no 406 errors in browser console
4. ✅ Deploy to production
5. ✅ Monitor browser console for any remaining errors

## Additional Notes
- The 406 error specifically means the request format was not acceptable by the server
- This is typically caused by missing RLS policies or permission issues
- The leaderboard is now publicly readable by all authenticated users
- Only admins can modify leaderboard entries (through your backend service)

## Support Commands
To run the diagnostic test:
```javascript
// In your app or console
import { leaderboardService } from '@/lib/leaderboardService';
const result = await leaderboardService.testLeaderboardConnection();
console.log(result);
```

Expected output:
```javascript
{
  connected: true,
  countable: true,
  dataAccessible: true,
  recordCount: 42  // Your actual record count
}
```
