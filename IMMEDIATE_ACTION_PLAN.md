# Immediate Action Plan - Certificate Signature Linking

**Status**: ✅ All code fixes applied - Ready for deployment and testing

---

## What Was Fixed

### ✅ Fix 1: RLS Policy Now Allows Service Role
**File**: `sql/certificate_signatures_rls_and_backfill.sql` (Lines 54-68)

**The Issue**: Service role client had `auth.uid() = NULL`, but old RLS policy required user to own certificate, blocking service-side signature inserts.

**The Fix**: Updated INSERT policy with CASE statement:
```sql
CREATE POLICY "Allow certificate signature inserts"
WITH CHECK (
  CASE
    WHEN auth.uid() IS NOT NULL THEN
      -- Authenticated user: only their own certs
      certificate_id IN (SELECT id FROM certificates WHERE user_id = auth.uid())
    ELSE
      -- Service role (no auth.uid()): allow all
      true
  END
)
```

### ✅ Fix 2: Enhanced Error Logging
**File**: `lib/certificateService.ts` (Lines 75-87)

**The Issue**: Signature insertion errors were silently logged with `console.warn`, making failures invisible.

**The Fix**: Changed to `console.error` with detailed context:
```typescript
if (linkError) {
  console.error('[CERTIFICATE_SIGNATURE_ERROR] Error linking signatures:', linkError);
  console.error('[CERTIFICATE_SIGNATURE_ERROR] Certificate ID:', certificateId);
  console.error('[CERTIFICATE_SIGNATURE_ERROR] Signatures to link:', signatureLinkData);
}
```

### ✅ Fix 3: Proper Certificate Issuance Flow
**File**: `lib/courseCompletionService.ts` (Lines 88-98)

**The Issue**: Was doing direct DB inserts without calling proper signature-linking function.

**The Fix**: Now calls `awardCertificate()` which handles signature linking:
```typescript
const certificateData = await awardCertificate(userId, courseId);
```

---

## Deployment Checklist

### ☐ Step 1: Deploy Code Changes (5 minutes)
Upload these modified files to production:

1. **lib/certificateService.ts** (enhanced error logging)
2. **lib/courseCompletionService.ts** (calls awardCertificate)
3. Deploy and restart application

### ☐ Step 2: Apply Updated RLS Policy to Database (5 minutes)
In Supabase SQL Editor, run ONLY these sections from `sql/certificate_signatures_rls_and_backfill.sql`:

```
STEP 2: Drop existing policies (lines 25-30)
STEP 3: Create new RLS policies (lines 33-77)
```

Do NOT run STEP 4 backfill yet - we'll do that after testing.

**Quick verification** (after running SQL):
```sql
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'certificate_signatures'
ORDER BY policyname;
```

Should show 3 policies:
- Admins can view all certificate signatures
- Allow certificate signature inserts
- Learners can view their own certificate signatures

### ☐ Step 3: Run Diagnostic Check (2 minutes)
Execute `CERTIFICATE_SYSTEM_DIAGNOSTIC.sql` in Supabase and verify:
- [ ] RLS is enabled: `rowsecurity = true`
- [ ] All 3 policies exist
- [ ] At least 1 signature is enabled in settings
- [ ] No CRITICAL issues found

---

## Testing Plan (20-30 minutes)

### TEST A: Pre-Test Setup
1. **Verify Test Environment**:
   - [ ] Have admin user account
   - [ ] Have test learner account
   - [ ] Have test course with `certificate_enabled = true`
   - [ ] At least 1 enabled signature in certificate settings

2. **Check Server Logs Access**:
   - [ ] Can see application logs (console/terminal where app runs)
   - [ ] Will monitor for `[CERTIFICATE_SIGNATURE_SUCCESS]` messages

### TEST B: Issue New Certificate
1. **As Admin**: Verify test course settings:
   ```sql
   SELECT id, title, certificate_enabled FROM courses
   WHERE title LIKE '%test%' LIMIT 1;
   ```
   Confirm: `certificate_enabled = true`

2. **As Learner**:
   - Log in with test account
   - Navigate to test course
   - Complete all lessons (mark as done)
   - Complete course (submit)

3. **Monitor Server Logs Immediately**:
   - Look for: `[CERTIFICATE_SIGNATURE_SUCCESS]...`
   - If error, look for: `[CERTIFICATE_SIGNATURE_ERROR]...` (indicates what went wrong)

4. **Check Database** (within 30 seconds):
   ```sql
   SELECT
     id,
     user_id,
     issued_at,
     signature_ids,
     signatures_data
   FROM certificates
   WHERE issued_at > NOW() - INTERVAL '5 minutes'
   ORDER BY issued_at DESC
   LIMIT 1;
   ```

   **Expected**:
   - `signature_ids` = `{...}` (NOT empty `{}`)
   - `signatures_data` = `[...]` (NOT empty `[]`)

5. **Verify Signature Table**:
   ```sql
   SELECT
     certificate_id,
     signature_name,
     signature_designation,
     display_order
   FROM certificate_signatures
   WHERE certificate_id = '{ID_FROM_ABOVE}'
   ORDER BY display_order;
   ```

   **Expected**: 1+ rows with signature details

### TEST C: View Certificate as Learner
1. **As Learner**: Go to "My Certificates"
2. **Expected**: Certificate appears with all signature information
3. **If missing**: Check browser console for errors

### TEST D: Verify Learner Permissions
```sql
-- Simulate learner viewing their own cert signatures
-- (This is what the frontend does)
SELECT
  cs.certificate_id,
  cs.signature_name,
  cs.signature_designation
FROM certificate_signatures cs
WHERE cs.certificate_id IN (
  SELECT id FROM certificates
  WHERE user_id = '{LEARNER_ID}'
)
ORDER BY cs.display_order;
```

Should return the signatures.

---

## If Tests PASS ✅

Congratulations! Certificate signature linking is working.

### Next Steps:
1. **Backfill Old Certificates** (optional, for completeness):
   ```bash
   POST /api/admin/backfill-certificates?action=backfill
   ```

2. **Monitor Production** (24 hours):
   - Watch for `[CERTIFICATE_SIGNATURE_ERROR]` in logs
   - If any appear, check error message and refer to troubleshooting guide

3. **Update Documentation**:
   - Archive troubleshooting guides as historical reference
   - Mark issue as "RESOLVED"

---

## If Tests FAIL ❌

Check server logs for error message (should now be visible with `[CERTIFICATE_SIGNATURE_ERROR]`).

### Common Error Messages & Quick Fixes

**Error: "violates row level security policy"**
- RLS policy not updated properly
- Run STEP 2 & 3 again from certificate_signatures_rls_and_backfill.sql
- Verify 3 policies exist with diagnostic script

**Error: "no rows returned"**
- `getEnabledSignatures()` returned empty
- Go to Admin → Certificate Settings
- Add at least one signature and check "Enabled"

**Error: "foreign key violation"**
- Signature ID doesn't exist in certificate_signature_settings
- Verify signatures exist:
  ```sql
  SELECT id, name, is_enabled FROM certificate_signature_settings;
  ```

**Error: "column 'css.enabled' does not exist"**
- Backfill SQL has wrong column name
- Use `css.is_enabled` instead of `css.enabled`
- See CERTIFICATE_SIGNATURE_TROUBLESHOOTING.md

**No logs appearing at all**
- Check server is using updated certificateService.ts
- Force redeploy if needed
- Check application logs location

---

## File Reference

All fixes and tools:

| File | Purpose | Status |
|------|---------|--------|
| `lib/certificateService.ts` | Enhanced error logging | ✅ Applied |
| `lib/courseCompletionService.ts` | Calls awardCertificate | ✅ Applied |
| `sql/certificate_signatures_rls_and_backfill.sql` | RLS policy + backfill | ✅ Ready to apply |
| `CERTIFICATE_SIGNATURE_VERIFICATION_TESTING.md` | Complete testing guide | 📋 Use for TEST B |
| `CERTIFICATE_SYSTEM_DIAGNOSTIC.sql` | System health check | 🔧 Run after SQL |
| `CERTIFICATE_SIGNATURE_TROUBLESHOOTING.md` | Detailed troubleshooting | ❓ If issues occur |
| `CERTIFICATE_SIGNATURE_RLS_AND_BACKFILL_GUIDE.md` | Detailed reference | 📚 Full documentation |

---

## Timeline

| Step | Time | Owner |
|------|------|-------|
| Deploy code | 5 min | DevOps |
| Apply RLS policy | 5 min | DevOps |
| Run diagnostic | 2 min | QA |
| Complete TEST B | 10-15 min | QA |
| Backfill (if needed) | 5 min | DevOps |
| **Total** | **~30 min** | - |

---

## Success Criteria

**Certificate signature linking is working when**:

1. ✅ New certificate issued when course completed
2. ✅ Certificate has `signature_ids` NOT empty
3. ✅ Certificate has `signatures_data` NOT empty
4. ✅ Entries exist in `certificate_signatures` table
5. ✅ Learner can view certificate with signatures
6. ✅ No `[CERTIFICATE_SIGNATURE_ERROR]` in server logs
7. ✅ Repeatable: Works for multiple courses/users

---

## Support

If you encounter issues:

1. **Check logs first** (look for `[CERTIFICATE_SIGNATURE_ERROR]`)
2. **Run diagnostic** (`CERTIFICATE_SYSTEM_DIAGNOSTIC.sql`)
3. **Review troubleshooting** (see `CERTIFICATE_SIGNATURE_TROUBLESHOOTING.md`)
4. **Verify RLS policy** (3 policies should exist)
5. **Check enabled signatures** (at least 1 required)

---

## Questions to Answer

Before declaring success:
- [ ] Can new courses be completed without errors?
- [ ] Do new certificates get issued?
- [ ] Do new certificates have signatures?
- [ ] Can learners view certificates?
- [ ] Do old certificates display correctly?
- [ ] Are there any error logs?

---

**Created**: April 9, 2026
**Status**: Ready for Deployment
**Next Action**: Deploy code changes and apply RLS policy

Good luck! 🚀
