# Certificate Signature Troubleshooting Guide

## Issue: Signatures Not Linked When Certificate Issued

When a new certificate is issued, signatures are not being inserted into the `certificate_signatures` table.

---

## Root Causes & Solutions

### Root Cause 1: RLS Policy Blocking Inserts ❌ FIXED

**Problem**: The RLS policy was too restrictive and blocked service role inserts.

**Solution Applied**: Updated RLS policy to allow:
1. Authenticated users to insert for their own certificates
2. Service role (when `auth.uid()` is NULL) to insert for any certificate

**File**: `sql/certificate_signatures_rls_and_backfill.sql` (Policy 2)

**New Logic**:
```sql
WITH CHECK (
  CASE
    WHEN auth.uid() IS NOT NULL THEN
      -- Authenticated user: allow only for own certificates
      certificate_id IN (SELECT id FROM certificates WHERE user_id = auth.uid())
    ELSE
      -- Service role (no auth.uid()): allow all
      true
  END
)
```

---

### Root Cause 2: Silent Error Handling ❌ FIXED

**Problem**: The `awardCertificate` function was swallowing signature insertion errors with `console.warn`, so failures weren't visible.

**Solution Applied**: Enhanced error logging in `certificateService.ts`

**Now Logs**:
```
[CERTIFICATE_SIGNATURE_ERROR] Error linking signatures
[CERTIFICATE_SIGNATURE_ERROR] Certificate ID: {id}
[CERTIFICATE_SIGNATURE_ERROR] Signatures to link: {data}
```

---

## Verification Steps

### Step 1: Reapply Updated RLS Policy

Run the UPDATED SQL script:
```bash
# Execute: sql/certificate_signatures_rls_and_backfill.sql
# Only STEP 2 & 3 (drop and recreate policies)
```

SQL Commands to run:
```sql
-- Drop old policy
DROP POLICY IF EXISTS "Admins and service can insert certificate signatures"
ON public.certificate_signatures;

-- Create new policy (see certificate_signatures_rls_and_backfill.sql)
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

### Step 2: Check Supabase Client Configuration

Verify that the certificate issuance is using the correct Supabase client:

**Location**: `lib/certificateService.ts` (line 1)

**Should Use**: Service role key for server-side operations

```typescript
// Check that supabaseClient is using service role key
import { supabase } from './supabaseClient';

// If using anon key, signatures won't be inserted properly
// You may need a separate service client
```

### Step 3: Monitor Server Logs

When a certificate is issued, look for logs:

**Expected Success Logs**:
```
[CERTIFICATE_ISSUING] About to issue certificate for user {id} on course "{title}"
[CERTIFICATE_SIGNATURE_SUCCESS] Certificate successfully awarded with X signatures
[CERTIFICATE_SUCCESS] Certificate issued with signatures
```

**Error Logs** (if signature insertion fails):
```
[CERTIFICATE_SIGNATURE_ERROR] Error linking signatures
[CERTIFICATE_SIGNATURE_ERROR] Certificate ID: {id}
[CERTIFICATE_SIGNATURE_ERROR] Signatures to link: {data}
```

### Step 4: Test Full Flow

1. **Complete a course** that has `certificate_enabled = true`
2. **Check browser console** for logs
3. **Verify database**:
   ```sql
   -- Check if new certificate exists
   SELECT * FROM certificates
   WHERE issued_at > NOW() - INTERVAL '5 minutes'
   ORDER BY issued_at DESC;

   -- Check if signatures were linked
   SELECT COUNT(*) FROM certificate_signatures
   WHERE certificate_id = '{new_cert_id}';
   ```

---

## Manual Signature Linking (Workaround)

If signatures still aren't linking automatically, you can manually link them:

```sql
-- For a specific certificate that's missing signatures
INSERT INTO certificate_signatures (
  certificate_id,
  signature_id,
  display_order,
  signature_name,
  signature_designation,
  signature_text,
  signature_image_url
)
SELECT
  'CERTIFICATE_ID_HERE' as certificate_id,
  css.id,
  css.display_order,
  css.name,
  css.designation,
  css.signature_text,
  css.signature_image_url
FROM certificate_signature_settings css
WHERE css.is_enabled = true
ON CONFLICT (certificate_id, signature_id) DO NOTHING;
```

---

## Debugging Checklist

- [ ] RLS policy updated to latest version
- [ ] Supabase client is using service role key (check env vars)
- [ ] Server logs checked for `[CERTIFICATE_SIGNATURE_ERROR]` messages
- [ ] Database has recent certificate_signatures entries
- [ ] `certificate_signature_settings` table has enabled signatures
- [ ] New certificate issued and check if signatures exist

---

## Files Modified

- ✅ `sql/certificate_signatures_rls_and_backfill.sql` - Updated RLS policy
- ✅ `lib/certificateService.ts` - Enhanced error logging

---

## Next Steps

1. Apply the updated RLS policy
2. Deploy the updated certificateService.ts
3. Complete a test course and monitor logs
4. Verify signatures are inserted into certificate_signatures table
5. Run backfill if needed for existing certificates without signatures

---

## Contact Points

If issues persist:
1. Check `[CERTIFICATE_SIGNATURE_ERROR]` logs for specific error message
2. Verify RLS policy is correctly set with `SELECT * FROM pg_policies WHERE tablename = 'certificate_signatures';`
3. Test if `getEnabledSignatures()` returns any signatures
4. Use backfill API: `POST /api/admin/backfill-certificates?action=backfill` to add missing signatures

