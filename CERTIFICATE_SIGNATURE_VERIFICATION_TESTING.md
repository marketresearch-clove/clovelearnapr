# Certificate Signature Linking - Verification & Testing Guide

## Status: ✅ FIXES APPLIED
All fixes for certificate signature linking have been implemented:
- ✅ RLS Policy updated (allows service role inserts when auth.uid() IS NULL)
- ✅ Enhanced error logging in certificateService.ts
- ✅ SQL backfill script ready for production

---

## Pre-Test Verification Checklist

### Step 1: Verify RLS Policy is Applied
Run this SQL in Supabase to check current policies:

```sql
-- Check if RLS is enabled on certificate_signatures
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'certificate_signatures';
-- Expected: rowsecurity = true

-- List all policies on the table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'certificate_signatures'
ORDER BY policyname;

-- Expected policies:
-- 1. "Learners can view their own certificate signatures"
-- 2. "Allow certificate signature inserts"
-- 3. "Admins can view all certificate signatures"
```

**If policies are missing or old**, run STEP 2 & 3 from:
```
sql/certificate_signatures_rls_and_backfill.sql
```

### Step 2: Verify Signature Settings Exist
Ensure you have at least one enabled signature in the database:

```sql
-- Check for enabled signatures
SELECT id, name, designation, is_enabled, display_order
FROM public.certificate_signature_settings
WHERE is_enabled = true
ORDER BY display_order;
```

**If no enabled signatures exist**:
1. Go to Admin Panel → Certificate Settings
2. Add at least one signature (name, designation, image optional)
3. Check the "Enabled" checkbox
4. Save

### Step 3: Check Supabase Client Configuration
Verify your environment variables:

```bash
# In .env.local or similar
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Critical**: The service role key is what allows the backend to insert signatures.

---

## Testing Process

### TEST 1: Manual Test - Complete a Course

#### Prerequisites
1. Have a test user account (learner role)
2. Have a test course with:
   - `certificate_enabled = true` ✅
   - At least one lesson
3. Have at least one enabled signature in settings

#### Steps
1. **As Admin**: Verify course has `certificate_enabled = true`
   ```sql
   SELECT id, title, certificate_enabled FROM public.courses
   WHERE title = 'YOUR_TEST_COURSE';
   ```
   Expected: `certificate_enabled = true`

2. **As Learner**: Log in and complete the test course
   - Complete all lessons
   - Check "Mark as Complete" for course

3. **Monitor Server Logs**: Look for these patterns:
   ```
   [CERTIFICATE_ISSUING] About to issue certificate for user...
   [CERTIFICATE_SIGNATURE_SUCCESS] Certificate successfully awarded...

   OR

   [CERTIFICATE_SIGNATURE_ERROR] Error linking signatures...
   [CERTIFICATE_SIGNATURE_ERROR] Certificate ID:...
   [CERTIFICATE_SIGNATURE_ERROR] Signatures to link:...
   ```

4. **Check Database Immediately**:
   ```sql
   -- Find the newly issued certificate (should be from last 5 minutes)
   SELECT id, user_id, issued_at, signature_ids, signatures_data
   FROM public.certificates
   WHERE issued_at > NOW() - INTERVAL '5 minutes'
   ORDER BY issued_at DESC
   LIMIT 1;
   ```

   **Expected Results**:
   - `signature_ids` should NOT be empty `[]`
   - `signatures_data` should NOT be empty `[]`
   - `issued_at` should be very recent

5. **Verify Signature Links**:
   ```sql
   -- Get the certificate ID from above query
   SELECT
     certificate_id,
     signature_id,
     signature_name,
     signature_designation,
     display_order
   FROM public.certificate_signatures
   WHERE certificate_id = '{CERTIFICATE_ID_FROM_ABOVE}'
   ORDER BY display_order;
   ```

   **Expected**: Should show 1+ rows with signature data

---

### TEST 2: Automated Script - Bulk Test

Create a test script to issue multiple certificates and verify:

```sql
-- Get test data
WITH test_users AS (
  SELECT id FROM public.profiles
  WHERE role = 'learner'
  LIMIT 3
),
test_courses AS (
  SELECT id FROM public.courses
  WHERE certificate_enabled = true
  LIMIT 1
)
SELECT
  u.id as user_id,
  c.id as course_id
FROM test_users u, test_courses c;
```

Use the results to programmatically:
1. Mark lessons complete
2. Complete course
3. Check for certificate issuance
4. Verify signatures were linked

---

### TEST 3: View Certificate as Learner

1. **As Learner**: Go to "My Certificates"
2. **Expected**: Certificate should load with signature information
3. **If error**: Check browser console for errors

---

## Diagnosis: If Signatures Still Aren't Linking

### Check Server Logs First

Look for any `[CERTIFICATE_SIGNATURE_ERROR]` messages:

```
[CERTIFICATE_SIGNATURE_ERROR] Error linking signatures to certificate: {error}
[CERTIFICATE_SIGNATURE_ERROR] Certificate ID: abc-123
[CERTIFICATE_SIGNATURE_ERROR] Signatures to link: [{...}]
```

### Common Issues & Solutions

#### Issue 1: RLS Policy Blocking Inserts
**Error in logs**: "violates row level security policy"

**Solution**:
1. Verify policy is applied:
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'certificate_signatures'
   AND policyname = 'Allow certificate signature inserts';
   ```

2. Drop old policy and recreate:
   ```sql
   DROP POLICY IF EXISTS "Allow certificate signature inserts"
   ON public.certificate_signatures;

   CREATE POLICY "Allow certificate signature inserts"
   ON public.certificate_signatures
   FOR INSERT
   WITH CHECK (
     CASE
       WHEN auth.uid() IS NOT NULL THEN
         certificate_id IN (
           SELECT id FROM public.certificates
           WHERE user_id = auth.uid()
         )
       ELSE true
     END
   );
   ```

#### Issue 2: No Enabled Signatures
**Error in logs**: "No enabled signatures found" or signatures array is empty

**Solution**:
1. Check signature settings:
   ```sql
   SELECT * FROM public.certificate_signature_settings;
   ```

2. If table is empty or all disabled:
   - Go to Admin → Certificate Settings
   - Add at least one signature
   - Check "Enabled" checkbox
   - Save

#### Issue 3: Foreign Key Error
**Error in logs**: "violates foreign key constraint"

**Solution**:
1. Check signature_id is valid:
   ```sql
   SELECT id FROM public.certificate_signature_settings
   WHERE id = '{signature_id}';
   ```

2. Verify certificate_id exists:
   ```sql
   SELECT id FROM public.certificates
   WHERE id = '{certificate_id}';
   ```

#### Issue 4: Unique Constraint Violation
**Error in logs**: "duplicate key value"

**Solution**: This is OK! It means signatures were already linked.
- Run backfill with `ON CONFLICT ... DO NOTHING` to skip duplicates

---

## Verification After Fix

### Query 1: Certificate Completeness Check
```sql
SELECT
  c.id,
  c.user_id,
  c.course_id,
  c.issued_at,
  COUNT(cs.id) as signature_count,
  CASE WHEN COUNT(cs.id) > 0 THEN '✅' ELSE '❌' END as has_signatures,
  string_agg(cs.signature_name, ', ' ORDER BY cs.display_order) as signature_names
FROM public.certificates c
LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
WHERE c.issued_at > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.user_id, c.course_id, c.issued_at
ORDER BY c.issued_at DESC;
```

**Expected**: All new certificates should have `signature_count > 0` and `has_signatures = ✅`

### Query 2: Backfill Status
```sql
-- Certificates with and without signatures
SELECT
  COUNT(*) as total_certificates,
  COUNT(CASE WHEN sig_count > 0 THEN 1 END) as with_signatures,
  COUNT(CASE WHEN sig_count = 0 THEN 1 END) as without_signatures,
  ROUND(100.0 * COUNT(CASE WHEN sig_count > 0 THEN 1 END) / COUNT(*), 2) as coverage_percent
FROM (
  SELECT c.id, COUNT(cs.id) as sig_count
  FROM public.certificates c
  LEFT JOIN public.certificate_signatures cs ON c.id = cs.certificate_id
  GROUP BY c.id
) sub;
```

**Expected After Fixes**:
- All NEW certificates issued after fixes: `with_signatures` should be 100%
- Old certificates: May need backfill

---

## If New Certificates Still Missing Signatures

### Option 1: Backfill API

```bash
# Preview what would be backfilled
curl -X POST http://localhost:3000/api/admin/backfill-certificates?action=preview \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Execute backfill
curl -X POST http://localhost:3000/api/admin/backfill-certificates?action=backfill \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Option 2: Direct SQL Backfill

```sql
-- Backfill missing signatures for all certificates
INSERT INTO public.certificate_signatures (
  certificate_id,
  signature_id,
  display_order,
  signature_name,
  signature_designation,
  signature_text,
  signature_image_url
)
SELECT
  c.id as certificate_id,
  css.id as signature_id,
  css.display_order,
  css.name,
  css.designation,
  css.signature_text,
  css.signature_image_url
FROM public.certificates c
CROSS JOIN public.certificate_signature_settings css
WHERE
  NOT EXISTS (
    SELECT 1 FROM public.certificate_signatures cs
    WHERE cs.certificate_id = c.id
      AND cs.signature_id = css.id
  )
  AND css.is_enabled = true
ORDER BY c.issued_at DESC, css.display_order
ON CONFLICT (certificate_id, signature_id) DO NOTHING;

-- Verify
SELECT
  COUNT(DISTINCT certificate_id) as certs_with_sigs,
  COUNT(*) as total_sig_links
FROM public.certificate_signatures;
```

---

## Complete End-to-End Testing Checklist

- [ ] RLS policies verified in database
- [ ] At least one signature enabled in settings
- [ ] Environment variables configured correctly
- [ ] Test user account ready
- [ ] Test course with `certificate_enabled = true`
- [ ] Completed test course as learner
- [ ] Checked server logs for `[CERTIFICATE_SIGNATURE_SUCCESS]` or `[CERTIFICATE_SIGNATURE_ERROR]`
- [ ] Verified certificate in database has signatures
- [ ] Verified certificate_signatures table has entries for new cert
- [ ] Viewed certificate as learner (appears in My Certificates)
- [ ] Certificate displays with signature information
- [ ] Backfilled any old certificates without signatures

---

## Files to Review

**Code Fixes**:
- ✅ `lib/certificateService.ts` - Lines 75-87 (error logging)
- ✅ `sql/certificate_signatures_rls_and_backfill.sql` - Lines 54-68 (RLS policy)
- ✅ `lib/courseCompletionService.ts` - Lines 88-98 (calls awardCertificate)

**Testing Tools**:
- `pages/api/admin/backfill-certificates.ts` - Backfill API
- `lib/certificateBackfillService.ts` - Backfill service
- `CERTIFICATE_SIGNATURE_TROUBLESHOOTING.md` - Detailed troubleshooting

---

## Summary

**New Certificate Signature Linking Flow**:
1. ✅ Learner completes course
2. ✅ `awardCertificate()` called from `courseCompletionService`
3. ✅ Certificate created in DB
4. ✅ `getEnabledSignatures()` fetches enabled signatures
5. ✅ RLS policy allows insert (service role context, auth.uid() IS NULL)
6. ✅ Signature snapshot data inserted to `certificate_signatures` table
7. ✅ Enhanced logging captures any errors with [CERTIFICATE_SIGNATURE_ERROR]
8. ✅ Learner sees certificate with signatures in "My Certificates"

---

**Date**: April 9, 2026
**Status**: Ready for Testing
**Next Step**: Run TEST 1 and monitor logs
