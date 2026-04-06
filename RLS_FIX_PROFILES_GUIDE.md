# RLS Policy Error Fix - User Creation in Admin Panel

## Problem
When admins try to create a new user in the User Management page, they get:
```
new row violates row-level security policy for table "profiles"
```

## Root Cause
The `profiles` table has Row-Level Security (RLS) enabled, but the INSERT policy doesn't allow admins to insert new rows.

## Solution

### 1. Run the Migration
Execute the SQL migration file in Supabase SQL Editor:
```sql
sql/MIGRATION_FIX_PROFILES_RLS_FOR_ADMIN_INSERT.sql
```

This will:
- Enable RLS on the profiles table
- Drop any conflicting policies
- Create proper policies for SELECT, INSERT, UPDATE, DELETE operations
- Allow admins to insert new user profiles

### 2. Verify the Migration
Check that the policies are in place:

```sql
-- View all policies on the profiles table
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Check RLS status
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';
```

### 3. Verify User Role in auth.users
Ensure the admin user has the correct role set in `auth.users`:

```sql
-- Check the admin user's role
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE email = 'admin@example.com';

-- The raw_user_meta_data should contain: {"user_role": "admin"}
```

If the user_role is missing, update it:
```sql
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'), 
  '{user_role}', 
  '"admin"'
)
WHERE email = 'admin@example.com';
```

### 4. Code-Side: Ensure Admin User Has Correct Role
When a user logs in or their role changes, make sure the JWT includes the role:

In your authentication service or login handler, ensure the user_role is set in the JWT claims.

## RLS Policy Details

The new policies are:

| Operation | Policy | Allows |
|-----------|--------|--------|
| SELECT | profiles_select_policy | Users viewing their own profile + admins viewing all |
| INSERT | profiles_insert_policy | **Only admins and super_admins** ← This fixes the issue |
| UPDATE | profiles_update_policy | Users updating themselves + admins updating any |
| DELETE | profiles_delete_policy | Only super_admins |

## Testing

After applying the migration:

1. Go to User Management → Add User
2. Fill in the form with a new user
3. Click "Create User" button
4. Should now succeed without RLS violation

If it still fails:
- Check auth.users has user_role = 'admin' for the logged-in admin
- Check browser console for detailed error message
- Check Supabase logs for RLS violation details
- Ensure the admin is properly authenticated (auth.uid() is set)

## Alternative: Temporarily Disable RLS (Not Recommended)
```sql
-- To completely disable RLS (SECURITY RISK - not recommended)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Always re-enable after testing
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

## Related Files
- Migration: `sql/MIGRATION_FIX_PROFILES_RLS_FOR_ADMIN_INSERT.sql`
- UI: `pages/UserManagementV2Page.tsx` - handleAddUser function (line ~293)
- Service: Uses Supabase client to insert into profiles table
