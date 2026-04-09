# Certificate Signature Linking - Quick Reference

## Current Status
✅ **All code fixes applied and ready for deployment**

---

## The Problem (Solved)
New certificates were issued WITHOUT signatures being linked to the `certificate_signatures` table.

## Root Causes (Identified & Fixed)
1. ❌ RLS policy blocked service role inserts (auth.uid() = NULL) → ✅ FIXED
2. ❌ Silent error logging hid failures → ✅ FIXED
3. ❌ Wrong function used to issue certificates → ✅ FIXED

---

## The Solution

### Modified Files (Deploy These)
```
lib/certificateService.ts          ← Enhanced error logging
lib/courseCompletionService.ts     ← Calls awardCertificate()
```

### Database SQL (Apply This)
```
sql/certificate_signatures_rls_and_backfill.sql (STEP 2 & 3 only)
```

---

## Deploy in 2 Steps

### Step 1: Deploy Code (5 min)
```bash
# Upload to production:
lib/certificateService.ts
lib/courseCompletionService.ts
```

### Step 2: Apply RLS Policy (5 min)
In Supabase SQL Editor, run:
```
STEP 2: Drop existing policies (drop 3 old ones)
STEP 3: Create new policies (create 3 new ones)
```

That's it! ✅

---

## Verify It Works

### Quick Test (10 min)
1. Complete a test course as learner
2. Check server logs: should see `[CERTIFICATE_SIGNATURE_SUCCESS]`
3. Query database:
   ```sql
   SELECT signature_ids, signatures_data FROM certificates
   WHERE issued_at > NOW() - INTERVAL '1 minute'
   LIMIT 1;
   ```
   Should be non-empty (not `[]` or `{}`)

### Run Full Diagnostic (2 min)
```sql
-- Copy entire CERTIFICATE_SYSTEM_DIAGNOSTIC.sql and run in Supabase
-- Should show NO CRITICAL issues
```

---

## If It Fails

### Check Server Logs First
Look for: `[CERTIFICATE_SIGNATURE_ERROR]`

### Most Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "violates row level security" | RLS not updated | Re-run STEP 2 & 3 |
| Empty signature arrays | No enabled signatures | Add 1 in Admin Settings |
| No logs appearing | Old code deployed | Redeploy + restart |
| "column enabled not found" | Wrong SQL | Use `is_enabled` not `enabled` |

### Detailed Troubleshooting
See: `CERTIFICATE_SIGNATURE_TROUBLESHOOTING.md`

---

## Key Files

| File | What | When |
|------|------|------|
| `IMMEDIATE_ACTION_PLAN.md` | Deployment checklist | 📌 Start here |
| `CERTIFICATE_SIGNATURE_VERIFICATION_TESTING.md` | How to test | Testing |
| `CERTIFICATE_SYSTEM_DIAGNOSTIC.sql` | Health check | After deployment |
| `CERTIFICATE_SIGNATURE_TROUBLESHOOTING.md` | Detailed help | If issues |

---

## The Flow (How It Works Now)

```
Learner completes course
    ↓
courseCompletionService.issueCertificateIfEnabled()
    ↓
calls → awardCertificate(userId, courseId)
    ↓
Creates certificate in DB
    ↓
Fetches enabled signatures
    ↓
RLS policy allows service role insert (auth.uid() IS NULL)
    ↓
Inserts signature links to certificate_signatures table
    ↓
[CERTIFICATE_SIGNATURE_SUCCESS] logged
    ↓
Learner sees complete certificate with signatures ✅
```

---

## Critical Knowledge

### RLS Policy Logic
```sql
WHEN auth.uid() IS NOT NULL THEN
  -- User login: only own certs
  allow if user_id = auth.uid()
ELSE
  -- Service role: allow all
  allow all
```

### Log Patterns to Watch
```
✅ Success:
[CERTIFICATE_SIGNATURE_SUCCESS] Certificate successfully awarded with X signatures

❌ Failure:
[CERTIFICATE_SIGNATURE_ERROR] Error linking signatures: {error message}
[CERTIFICATE_SIGNATURE_ERROR] Certificate ID: {id}
[CERTIFICATE_SIGNATURE_ERROR] Signatures to link: {data}
```

---

## Success Checklist

- [ ] Code deployed and running
- [ ] RLS policy applied (3 policies exist)
- [ ] Test course completed
- [ ] Server logs show `[CERTIFICATE_SIGNATURE_SUCCESS]`
- [ ] Database shows non-empty signature_ids/signatures_data
- [ ] Learner can view certificate with signatures
- [ ] No `[CERTIFICATE_SIGNATURE_ERROR]` in logs

---

## Next Steps After Fix

1. Monitor production for 24h (watch for error logs)
2. Optionally backfill old certificates:
   ```bash
   POST /api/admin/backfill-certificates?action=backfill
   ```
3. Update documentation as resolved

---

**Created**: April 9, 2026
**Status**: Ready to Deploy
**Estimated Time to Fix**: 30 minutes

For detailed information, see `IMMEDIATE_ACTION_PLAN.md`
