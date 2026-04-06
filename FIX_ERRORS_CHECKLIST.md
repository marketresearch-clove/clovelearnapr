# Error Fix Checklist - April 2026

## Errors to Fix

### 1. ✅ FIXED: AuthContext Import Error
**Error**: `useAuth must be used within an AuthProvider`
**Cause**: Circular import dependency with userStatisticsService
**Solution**: Changed to dynamic import in AuthContext.tsx (already done)

---

### 2. 🔴 TODO: Start Backend Server (PORT 3001)
**Error**: `Failed to load resource: net::ERR_CONNECTION_REFUSED` on `:3001/api/enrollment/update`
**Cause**: Backend server not running

**How to fix**:
```bash
# Open a new terminal and navigate to server directory
cd server
npm install  # if needed
node index.js
# or
npm start
```

**Expected output**: `Server listening on port 3001`

---

### 3. 🔴 TODO: Fix Supabase 403 Errors
**Error**: `Failed to load resource: the server responded with a status of 403`  
**URLs affected**: 
- `/rest/v1/enrollments?userid=eq.xxx&courseid=eq.xxx` 
- `/rest/v1/courses` queries in some cases

**Cause**: Row Level Security (RLS) policies missing or incorrect permissions

**How to fix**:

#### Option A: Temporarily Disable RLS (for testing only)
1. Go to Supabase Dashboard → SQL Editor
2. Run these commands:
```sql
-- Disable RLS on user-facing tables
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE certificates DISABLE ROW LEVEL SECURITY;
```

#### Option B: Fix RLS Policies (proper solution)
1. Go to Supabase Dashboard → Authentication → Policies
2. Check each table has proper policies for:
   - Users can read/write their own enrollments
   - Users can read/write their own statistics
   - Add public read access for courses (if needed)

**For enrollments table**, add policy:
```sql
CREATE POLICY "Users can access their own enrollments"
ON enrollments FOR ALL
USING (userid = auth.uid());
```

**For user_statistics table**, add policy:
```sql
CREATE POLICY "Users can access their own statistics"
ON user_statistics FOR ALL
USING (userid = auth.uid());
```

---

## Testing Steps

After fixing, test in this order:

1. **Frontend loads without errors**
   - App should load at http://localhost:5173
   - No "useAuth" errors in console

2. **Server is running**
   - Check: Can see "Server listening on port 3001" in terminal

3. **User can complete a course**
   - Enroll in a course
   - Complete all lessons  
   - Complete the quiz
   - Check console for: `[COMPLETION] Updated stats for user...`

4. **Stats update properly**
   - Dashboard shows: ✅ Learning hours
   - Dashboard shows: ✅ Courses completed
   - Profile shows: ✅ Acquired skills
   - Profile shows: ✅ XP points

5. **Certificate issued**
   - Dashboard shows certificate if enabled

---

## Common Fixes Summary

| Error | Fix |
|-------|-----|
| `net::ERR_CONNECTION_REFUSED :3001` | Start server: `node server/index.js` |
| `403 Supabase errors` | Disable RLS or fix policies |
| `useAuth must be used within an AuthProvider` | ✅ Already fixed |
| `Failed to complete course` | Both #1 and #2 must be fixed |

---

## If Still Getting Errors

1. **Check browser console** for detailed error messages
2. **Check server logs** for backend errors  
3. **Check Supabase logs** (Dashboard → Logs)
4. **Environment variables** - ensure VITE_SUPABASE_URL and keys are set
5. **Database permissions** - check service role key is valid
