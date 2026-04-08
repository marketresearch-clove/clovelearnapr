# Certificate Signatures - Deployment Guide

**Date**: April 8, 2026
**Status**: Ready for Production Deployment

---

## Overview

This guide walks through deploying the certificate signatures system with proper database linking and historical certificate backfill.

---

## Pre-Deployment Checklist

- [ ] Database backups taken
- [ ] Review all migration files
- [ ] Team notified of deployment window
- [ ] Testing environment ready

---

## Deployment Steps

### Step 1: Review Migration Files

**Files to run in Supabase**:
1. `supabase/migrations/20260408_add_certificate_signatures.sql` - Creates junction table and RLS policies
2. `supabase/migrations/20260408_backfill_certificate_signatures.sql` - Backfills existing certificates

**Key changes**:
- ✅ Creates `certificate_signatures` junction table
- ✅ Adds proper foreign keys with CASCADE/RESTRICT policies
- ✅ Creates RLS policies for access control
- ✅ Backfills all existing certificates with current enabled signatures
- ✅ Removes hardcoded signatures from template

---

### Step 2: Deploy Database Migrations

#### Option A: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `20260408_add_certificate_signatures.sql`
3. Execute the migration
4. Verify success (check for `certificate_signatures` table)
5. Copy contents of `20260408_backfill_certificate_signatures.sql`
6. Execute the backfill migration
7. Review the output log

#### Option B: Via CLI (if available)
```bash
cd project-root
supabase migration up
```

---

### Step 3: Deploy Code Changes

**Updated files to push**:
```
✅ lib/certificateService.ts
✅ lib/certificateHTMLGenerator.ts
✅ pages/CertificatePage.tsx
✅ pages/CertificateSignatureSettings.tsx
✅ public/certificate.html
```

**Deployment method**:
- Push to your deployment branch
- Run build process
- Deploy to production

---

### Step 4: Verify Deployment

#### Database Verification
```sql
-- Check if junction table was created
SELECT * FROM information_schema.tables
WHERE table_name = 'certificate_signatures';

-- Check backfill results
SELECT COUNT(*) as total_links
FROM public.certificate_signatures;

-- Sample: View linked certificates
SELECT
  c.id,
  c.issued_at,
  css.name,
  css.designation
FROM certificates c
JOIN certificate_signatures cs ON c.id = cs.certificate_id
JOIN certificate_signature_settings css ON cs.signature_id = css.id
ORDER BY c.issued_at DESC
LIMIT 5;
```

#### Application Verification
1. **Login as Admin**
   - Navigate to Certificate Signature Settings
   - Verify you can edit signature designations
   - Verify form is no longer disabled for designation

2. **Test Old Certificate Display**
   - Find a certificate issued before deployment
   - View it in the certificate viewer
   - Verify it shows the ORIGINAL signature designations
   - Check HTML shows dynamic signatures (not hardcoded)

3. **Test New Certificate**
   - Complete a course and earn a certificate
   - View the new certificate
   - Verify it shows CURRENT signature designations

4. **Test Signature Changes**
   - Edit a signature designation (e.g., "HR Lead" → "HR Manager")
   - View old certificates → should still show "HR Lead"
   - View new certificates → should show "HR Manager"

---

## Expected Data After Deployment

### Existing Certificates (4 total)
```
ID: 3aa8e7a9-29f9-44d0-89fe-2d5ae42fafe7
Issued: 2026-01-08 09:03:31
Linked Signatures:
  - HR Lead (Sreenath P) - display_order: 1
  - Chief Operating Officer (Sidharth Kamasani) - display_order: 2

ID: 5a7b17f0-141e-4a0f-b274-1992db5ff86c
Issued: 2025-12-18 09:30:01
Linked Signatures:
  - HR Lead (Sreenath P) - display_order: 1
  - Chief Operating Officer (Sidharth Kamasani) - display_order: 2

ID: a0cc3578-c071-4937-a26a-5a69114d02a3
Issued: 2026-04-05 14:42:10
Linked Signatures:
  - HR Lead (Sreenath P) - display_order: 1
  - Chief Operating Officer (Sidharth Kamasani) - display_order: 2

ID: d47a4e63-0752-4ed1-adc4-3599beb0096d
Issued: 2025-12-22 09:15:28
Linked Signatures:
  - HR Lead (Sreenath P) - display_order: 1
  - Chief Operating Officer (Sidharth Kamasani) - display_order: 2
```

### Signatures (2 total)
```
ID: 0b224b11-7b64-4073-84d8-6acfe0ad741c
Name: HR Lead
Designation: HR Lead
Signature Text: Sreenath P
Is Enabled: true
Display Order: 1

ID: e0b224b11-7b64-4073-84d8-6acfe0ad741b
Name: Chief Operating Officer
Designation: COO
Signature Text: Sidharth Kamasani
Is Enabled: true
Display Order: 2
```

---

## How It Works (Post-Deployment)

### When Viewing an Existing Certificate
```
1. User opens certificate from Jan 2026
2. getCertificate() fetches certificate + linked signatures
3. Returns signatures_data with original values:
   - "HR Lead" (not changed to "HR Manager" if later edited)
   - "Chief Operating Officer"
4. HTML generator uses this data
5. User sees ORIGINAL signatures ✅
```

### When Admin Edits Signature
```
1. Admin changes "HR Lead" → "HR Manager"
2. Updates certificate_signature_settings
3. Old certificate links still point to original values ✅
4. New certificates created use new values ✅
```

### When Issuing New Certificate
```
1. Course completed
2. awardCertificate() called
3. Creates certificate record
4. Fetches CURRENT enabled signatures
5. Creates NEW certificate_signatures links
6. New certificate locked with current values ✅
```

---

## Troubleshooting

### Issue: "Dynamic signature placeholder not found"
**Cause**: Certificate template HTML structure changed
**Solution**: Check `public/certificate.html` has the dynamic signatures section:
```html
<div class="flex flex-col sm:flex-row gap-12 sm:gap-24 mt-auto" id="dynamic-signatures">
  <!-- Signatures will be injected here -->
</div>
```

### Issue: Old certificates show blank signatures
**Cause**: Backfill didn't run or failed
**Solution**:
1. Check Supabase migration logs
2. Run backfill migration again
3. Verify with SQL query above

### Issue: Admin can't edit signatures
**Cause**: Code not deployed yet
**Solution**: Verify `CertificateSignatureSettings.tsx` is deployed (line 321 should NOT have `disabled={!!editingId}`)

### Issue: Certificate display shows "No signatures available"
**Cause**: Signature links not found OR HTML generator not replacing correctly
**Solution**:
1. Check console for warnings about dynamic signature placeholder
2. Verify certificate has links in `certificate_signatures` table
3. Check `lib/certificateHTMLGenerator.ts` regex pattern

---

## Rollback Plan

If critical issues occur:

### 1. Immediate Rollback (Code Only)
```bash
git revert <deployment-commit>
# Redeploy previous version
```

### 2. Database Rollback (if needed)
```sql
-- Drop junction table
DROP TABLE IF EXISTS public.certificate_signatures CASCADE;

-- Remove columns from certificates (optional)
ALTER TABLE certificates DROP COLUMN IF EXISTS updated_at;

-- Drop trigger
DROP TRIGGER IF EXISTS certificates_updated_at_trigger ON certificates;
```

### 3. Restore from Backup
- Restore database from pre-deployment backup
- Redeploy previous code version

---

## Post-Deployment Monitoring

### Check Logs Daily For:
- Any certificate generation errors
- Any signature fetching errors
- Any RLS policy violations

### Monitor Key Metrics:
- Certificate issuance rate (should be normal)
- Certificate view rate (should be normal)
- API response times (should be unchanged)

---

## Success Criteria

✅ All migrations executed without errors
✅ 4 existing certificates linked to 2 signatures (8 total links)
✅ Old certificates display original signature names
✅ Admin can edit signature designations freely
✅ New certificates show updated signatures
✅ Certificate HTML uses dynamic signatures (not hardcoded)
✅ No console warnings about signature placeholders

---

## Timeline

- **Pre-deployment**: 15 minutes (verification & backups)
- **Deployment**: 10 minutes (run migrations + deploy code)
- **Verification**: 15 minutes (test all scenarios)
- **Total**: ~40 minutes

---

## Support

If issues arise:
1. Check troubleshooting section
2. Review migration logs in Supabase
3. Verify file changes match deployment guide
4. Restore from backup if necessary

---

**Ready to deploy!** 🚀
