# RLS Policies and Admin Permissions Audit - April 5, 2026

## Executive Summary
- **Critical Issue**: `get_global_analytics` RPC function **DOES NOT EXIST** (called in AdminDashboard.tsx:47 and AdminAnalyticsPage.tsx:102)
- **Admin Access**: Admin permissions are delegated to **application-level checks** rather than database RLS policies
- **Multiple Issues**: Several tables have conflicting or incomplete RLS policies; learning_hours table has NO RLS policies
- **Policy Duplication**: Leaderboard has TWO conflicting RLS policy migrations

---

## 1. RLS POLICIES BY TABLE

### 1.1 COURSES Table
**Current Policies** (from STORAGE_AND_RLS_POLICIES.sql - COMMENTED OUT):
```sql
-- Policy 1: "Public courses with RLS"
-- SELECT: is_published = true OR auth.uid() = created_by

-- Policy 2: "Admins can manage all courses"  
-- ALL: auth.jwt() ->> 'user_role' = 'admin' OR 'super_admin'

-- Policy 3: "Instructors manage own courses"
-- ALL: auth.uid() = created_by
```
**Status**: ⚠️ COMMENTED OUT - Not actually enabled in database
**Admin Access**: Via JWT claim `user_role` = 'admin' or 'super_admin'

---

### 1.2 ENROLLMENTS Table
**Current Policies** (from STORAGE_AND_RLS_POLICIES.sql - COMMENTED OUT):
```sql
-- Policy 1: "Users view own enrollments"
-- SELECT: auth.uid() = user_id

-- Policy 2: "Instructors view course enrollments"
-- SELECT: course_id IN (SELECT id FROM courses WHERE created_by = auth.uid())

-- Policy 3: "Admins view all enrollments"
-- SELECT: auth.jwt() ->> 'user_role' IN ('admin', 'super_admin')

-- Policy 4: "Only admins can enroll users"
-- INSERT: auth.jwt() ->> 'user_role' IN ('admin', 'super_admin')
```
**Status**: ⚠️ COMMENTED OUT - Not actually enabled in database
**Admin Access**: Via JWT claim checking user_role

---

### 1.3 LESSON_PROGRESS Table
**Current Policies** (from STORAGE_AND_RLS_POLICIES.sql - EXAMPLE ONLY):
```sql
-- Policy 1: "Users manage own progress"
-- ALL: auth.uid() = user_id

-- Policy 2: "Instructors can view progress"
-- SELECT: lesson_id IN courses they teach
```
**Status**: ⚠️ COMMENTED OUT - Not actually enabled
**Active RLS Migration**: 20260405_fix_lesson_progress_updated_at.sql
- Creates policies for "Authenticated users can read lesson progress"
- Supports INSERT and UPDATE for authenticated users
- **ISSUE**: No admin-specific read policy

---

### 1.4 PROFILES Table
**Current Policies** (from MIGRATION_FIX_PROFILES_RLS_FOR_ADMIN_INSERT.sql - ACTIVE):
```sql
-- Policy 1: "profiles_select_policy"
-- SELECT: auth.role() = 'authenticated'

-- Policy 2: "profiles_insert_policy"
-- INSERT: auth.role() = 'authenticated'
-- ⚠️ NOTE: Admin-only enforcement is application-level

-- Policy 3: "profiles_update_policy"
-- UPDATE: auth.role() = 'authenticated'
-- ⚠️ NOTE: Application enforces who can update what

-- Policy 4: "profiles_delete_policy"
-- DELETE: auth.role() = 'authenticated'
-- ⚠️ NOTE: Only super_admins can actually delete (app-enforced)
```
**Status**: ✅ ACTIVE
**Admin Access**: Application-level checks in UserManagementV2Page
**Comment in File**: "Admins will be restricted via application-level checks (checking user.role == 'admin')"

---

### 1.5 LEADERBOARD Table
**CRITICAL ISSUE**: TWO CONFLICTING MIGRATIONS
1. **20260405_add_leaderboard_rls_policies.sql** (OLDER):
   ```sql
   -- "Authenticated users can read leaderboard" - auth.role() = 'authenticated'
   -- "System can update leaderboard entries" - auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
   -- "Admins can manage leaderboard" - Same admin check
   ```
   **Issue**: Uses `auth.jwt() ->> 'role'` which may not work properly

2. **20260405_fix_leaderboard_rls_policies.sql** (NEWER - LIKELY OVERRIDES):
   ```sql
   -- "Authenticated users can insert leaderboard" - auth.role() = 'authenticated'
   -- "Authenticated users can update leaderboard" - auth.role() = 'authenticated'
   -- "Authenticated users can read leaderboard" - auth.role() = 'authenticated'
   -- "Service role can manage leaderboard" - auth.role() = 'service_role'
   ```
   **Status**: ✅ ACTIVE
   **Advantage**: Uses `auth.role()` which is more reliable
   **Security**: Allows authenticated users to update leaderboard directly (may allow point manipulation)

---

### 1.6 ASSESSMENTS Table (ACTIVE)
**Migration**: 20260405_fix_assessments_rls_policies.sql
```sql
-- Policy 1: "Authenticated users can read assessments"
-- SELECT: auth.role() = 'authenticated'

-- Policy 2: "Admins can insert assessments"
-- INSERT: auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin') OR auth.jwt() ->> 'role' = 'admin'

-- Policy 3: "Admins can update assessments"
-- UPDATE: Same admin check

-- Policy 4: "Admins can delete assessments"
-- DELETE: Same admin check
```
**Status**: ✅ ACTIVE
**Admin Access**: Checks profiles.role = 'admin' OR JWT claim

---

### 1.7 ASSESSMENT_RESULTS Table (ACTIVE)
**Migration**: 20260405_fix_assessment_results_RLS_and_triggers.sql
```sql
-- Policy 1: "Authenticated users can insert assessment results"
-- INSERT: auth.role() = 'authenticated'

-- Policy 2: "Authenticated users can update assessment results"
-- UPDATE: auth.role() = 'authenticated'

-- Policy 3: "Authenticated users can read assessment results"
-- SELECT: auth.role() = 'authenticated'
```
**Status**: ✅ ACTIVE
**Concern**: No role-based restrictions - all authenticated users can read all results

---

### 1.8 LEARNING_HOURS Table
**Status**: ❌ **NO RLS POLICIES EXIST**
**Definition** (from DATABASE_SCHEMA_COMPLETE.sql):
```sql
CREATE TABLE IF NOT EXISTS learning_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID REFERENCES courses(id),
  hours NUMERIC DEFAULT 0,
  minutes INTEGER DEFAULT 0,
  logged_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Security Risk**: Anyone with DB access can read all users' learning hours
**Used By**: 
- CompletedLearningHoursCard.tsx
- AdminAnalyticsPage.tsx
- AdminDashboard.tsx
- advancedReportsService.ts

---

### 1.9 CONCERNS_TICKETS Table (NEW - ACTIVE)
**Migration**: 20260405_create_concerns_tickets.sql
```sql
-- Policy 1: "Users can view their own concerns"
-- SELECT: auth.uid() = user_id

-- Policy 2: "Users can create concerns"
-- INSERT: auth.uid() = user_id AND user_id = auth.uid()

-- Policy 3: "Admins can view all concerns"
-- SELECT: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')

-- Policy 4: "Admins can update concerns"
-- UPDATE: Same admin check via subquery
```
**Status**: ✅ ACTIVE
**Admin Access**: Via profiles.role = 'admin' subquery

---

### 1.10 NOTIFICATIONS Table (ACTIVE)
**Migration**: 20240119_create_notifications.sql
```sql
-- Policy 1: "Users can view their own notifications"
-- SELECT: auth.uid() = recipient_id

-- Policy 2: "Admins can insert notifications"
-- INSERT: Check if user is admin

-- Policy 3: "Admins can view all notifications"
-- SELECT: Auth checks for admin role
```
**Status**: ✅ ACTIVE

---

### 1.11 LESSON_AUDIO_CACHE & LESSON_TTS_SETTINGS Tables (ACTIVE)
**Migration**: 20260402_create_tts_audio_cache.sql
```sql
-- Audio Cache:
-- "Audio cache is viewable by learners" - GET on lesson_audio_cache
-- "Only admins can manage audio cache" - INSERT/UPDATE/DELETE

-- TTS Settings:
-- "TTS settings are viewable by learners" - GET
-- "Only instructors can modify TTS settings" - INSERT/UPDATE
```
**Status**: ✅ ACTIVE

---

## 2. CRITICAL ISSUES IDENTIFIED

### Issue #1: Missing `get_global_analytics` RPC Function ⚠️ CRITICAL
**Location**: Called in:
- [AdminDashboard.tsx](AdminDashboard.tsx#L47)
- [AdminAnalyticsPage.tsx](AdminAnalyticsPage.tsx#L102)

**Expected Return**:
```javascript
{
  total_active_learners: number,
  course_completion_rate: number,
  assessment_pass_rate: number,
  avg_learning_hours: number,
  certificates_earned: number,
  skill_coverage_pct: number
}
```

**Current Status**: ❌ FUNCTION DOES NOT EXIST
**Impact**: Admin dashboard fails to load analytics
**Solution Needed**: Create RPC function with SECURITY DEFINER to bypass RLS

---

### Issue #2: LEARNING_HOURS Table Has No RLS ⚠️ HIGH
**Current State**: No RLS policies enabled
**Security Implication**: Any authenticated user can query learning hours for any other user
**Required Policy**:
```sql
-- Users can view their own learning hours
CREATE POLICY "Users can view own learning hours"
  ON learning_hours FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all learning hours
CREATE POLICY "Admins can view all learning hours"
  ON learning_hours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Instructors can view for their students
CREATE POLICY "Instructors can view student learning hours"
  ON learning_hours FOR SELECT
  USING (
    user_id IN (
      SELECT DISTINCT e.user_id FROM enrollments e
      INNER JOIN courses c ON e.course_id = c.id
      WHERE c.created_by = auth.uid()
    )
  );
```

---

### Issue #3: Leaderboard Has Duplicate Conflicting Migrations ⚠️ MEDIUM
**Problem**: Two migrations define RLS for leaderboard:
1. `20260405_add_leaderboard_rls_policies.sql` - Uses JWT role claim (may fail)
2. `20260405_fix_leaderboard_rls_policies.sql` - Uses auth.role() (more reliable)

**Recommendation**: Keep only the second migration; drop the first one

---

### Issue #4: Admin Access Is Application-Level, Not Database-Level ⚠️ MEDIUM
**Current Pattern**:
- Most tables use `auth.jwt() ->> 'user_role'` or subquery to profiles.role
- PROFILES table explicitly notes: "Admin-only enforcement is handled at application level"
- No SECURITY DEFINER functions for admin operations

**Risk**: 
- If JWT is compromised, database doesn't enforce admin-only access
- Subqueries to profiles table redundant and slow
- Inconsistent patterns across migrations

**Best Practice**:
- Use SECURITY DEFINER stored procedures for privileged operations
- Service role key for backend operations
- JWT claims as secondary check only

---

### Issue #5: Assessment Results Have No Role-Based Filtering ⚠️ MEDIUM
**Current State**: All authenticated users can read all assessment results
```sql
"Authenticated users can read assessment results"
SELECT: auth.role() = 'authenticated'
```

**Issue**: Learners can see other learners' assessment results
**Should Be**: Users can only see their own results or instructor results

---

### Issue #6: COURSES Table RLS Is Commented Out ⚠️ MEDIUM
**File**: STORAGE_AND_RLS_POLICIES.sql
**Status**: All course policies are in SQL comments (not applied)
**Question**: Are courses table actually using RLS or is it unprotected?

---

## 3. ADMIN PERMISSION ARCHITECTURE

### Current Pattern
Admin access is implemented through **multiple inconsistent methods**:

#### Method 1: JWT Claims (Used in some policies)
```sql
auth.jwt() ->> 'user_role' = 'admin'
auth.jwt() ->> 'role' = 'admin'
```
**Problem**: Inconsistent claim paths; may not exist if JWT not configured properly

#### Method 2: Subquery to Profiles Table (Used in newer migrations)
```sql
EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
)
```
**Advantage**: Reliable, source of truth in database
**Disadvantage**: Slower (requires additional query)

#### Method 3: Application-Level Checks (Used for sensitive operations)
```typescript
// Example from UserManagementV2Page
if (user.role !== 'admin') {
  throw new Error('Not authorized');
}
```
**Used For**: Profile creation, deletion, user management
**Weakness**: Can be bypassed if app logic is exploited

---

## 4. ADMIN READ PERMISSIONS SUMMARY

| Table | Admin Read Access | Method | Status |
|-------|-------------------|--------|--------|
| courses | JWT + Commented | JWT claim or subquery | ⚠️ Unclear |
| enrollments | JWT + Commented | JWT claim | ⚠️ Commented out |
| lessons | Not defined | - | ❌ Missing |
| learning_hours | None | - | ❌ No RLS |
| leaderboard | Both JWT & role() | One of two conflicting | ⚠️ Conflicting |
| assessments | Subquery to profiles | profiles.role = 'admin' | ✅ Active |
| assessment_results | None (all can read) | auth.role() = 'authenticated' | ⚠️ Overly permissive |
| profiles | Subquery via app | Application enforced | ✅ Active |
| concerns_tickets | Subquery to profiles | profiles.role = 'admin' | ✅ Active |
| notifications | Not clearly defined | - | ⚠️ Unclear |
| lesson_audio_cache | Subquery | profiles.role = 'admin' | ✅ Active |

---

## 5. POLICY CONFLICTS & INCONSISTENCIES

### Conflict 1: JWT Methods
- Some use `auth.jwt() ->> 'user_role'`
- Some use `auth.jwt() ->> 'role'`
- Some use subqueries to profiles table
- **Resolution**: Standardize on subqueries or SECURITY DEFINER functions

### Conflict 2: Role Name Format
- JWT claims: 'admin', 'super_admin'
- Profiles table: 'admin', 'superadmin' (no underscore)
- **Resolution**: Ensure consistent role naming

### Conflict 3: Application vs Database Enforcement
- Some operations enforce admin check at DB (RLS)
- Some operations enforce admin check in app code
- **Resolution**: Use DATABASE as source of truth

---

## 6. MISSING RPC FUNCTIONS

| Function | Called From | Status | Expected Return |
|----------|-------------|--------|-----------------|
| `get_global_analytics` | AdminDashboard.tsx, AdminAnalyticsPage.tsx | ❌ Missing | Analytics metrics |
| Admin enrollment function | - | ❌ Missing | Batch enrollment |
| Course visibility function | - | ❌ Missing | User's visible courses |

---

## 7. RECOMMENDATIONS

### Priority 1 - Critical (Do Immediately)
1. **Create `get_global_analytics` RPC function**
   - Returns dashboard metrics
   - Use SECURITY DEFINER for admin bypass
   - Permissions: Admin and instructors only

2. **Add RLS to learning_hours table**
   - Users read own records
   - Admins read all records
   - Instructors read their students' records

3. **Resolve leaderboard RLS conflicts**
   - Drop 20260405_add_leaderboard_rls_policies.sql
   - Keep 20260405_fix_leaderboard_rls_policies.sql

### Priority 2 - High (Do Soon)
4. **Fix assessment_results visibility**
   - Users can only see their own results
   - Instructors can see their course results
   - Admins can see all results

5. **Apply courses table RLS**
   - Move commented policies from STORAGE_AND_RLS_POLICIES.sql to active migration

6. **Create SECURITY DEFINER admin functions**
   - Replace JWT checks with proper admin functions
   - Better security and performance

### Priority 3 - Medium (Do Next Sprint)
7. **Standardize admin access pattern**
   - Choose one consistent method across all tables
   - Recommendation: Subquery to profiles.role OR SECURITY DEFINER functions

8. **Add RLS to remaining tables**
   - Verify all tables have appropriate RLS
   - Check: lessons, quiz_results, certificates, career_paths

9. **Add performance indexes**
   - Add indexes on role column in profiles
   - Index foreign keys used in subquery RLS

---

## 8. TESTING CHECKLIST

- [ ] Admin can read global analytics
- [ ] Admin can read leaderboard
- [ ] Admin can read all users' learning_hours
- [ ] Regular user cannot see other users' learning_hours
- [ ] Instructor can see only their students' learning_hours
- [ ] User cannot see other users' assessment results
- [ ] Leaderboard doesn't return errors on update
- [ ] Admin dashboard completes loading within 3 seconds
- [ ] Analytics page shows all metrics correctly

---

## 9. MIGRATION FILES REFERENCED

| File | Status | Purpose |
|------|--------|---------|
| STORAGE_AND_RLS_POLICIES.sql | Examples (commented) | Template policies |
| MIGRATION_FIX_PROFILES_RLS_FOR_ADMIN_INSERT.sql | ✅ Active | Profiles table RLS |
| MIGRATION_ACKNOWLEDGEMENT_COURSE_TYPE.sql | ✅ Active | Course acknowledgements RLS |
| 20260405_add_leaderboard_rls_policies.sql | ⚠️ Active (conflicting) | Initial leaderboard RLS |
| 20260405_fix_leaderboard_rls_policies.sql | ✅ Active (overrides) | Fixed leaderboard RLS |
| 20260405_fix_assessments_rls_policies.sql | ✅ Active | Assessments RLS |
| 20260405_fix_assessment_results_RLS_and_triggers.sql | ✅ Active | Assessment results RLS |
| 20260405_create_concerns_tickets.sql | ✅ Active | Concerns tickets RLS |
| 20240119_create_notifications.sql | ✅ Active | Notifications RLS |
| 20260402_create_tts_audio_cache.sql | ✅ Active | Audio cache & TTS RLS |

---

## Generated
April 5, 2026
