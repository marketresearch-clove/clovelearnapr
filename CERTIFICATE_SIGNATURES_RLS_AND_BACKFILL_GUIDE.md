# Certificate Signatures: RLS Policies & Backfill Guide

## Overview

This guide covers:
1. **RLS (Row Level Security)** policies for the `certificate_signatures` table
2. **Backfill process** to add missing signatures to existing certificates
3. **How to use** the backfill API and service

---

## Problem: Missing Certificate Signatures

### Symptoms
- Certificates are issued but signatures are not loaded
- `signature_ids` and `signatures_data` columns remain empty `[]`
- Learners see blank certificates without signatures

### Root Causes
1. **Missing RLS Policies**: Without proper RLS, inserts may be blocked
2. **Incomplete Backfill**: Certificates issued before the fix need signatures backfilled
3. **Permission Issues**: Learner roles might not have proper insert permissions

---

## Solution 1: RLS Policies

### What is RLS?
**Row Level Security** controls which rows users can access in PostgreSQL tables. It's a database-level security layer.

### Current RLS Policies

#### Policy 1: Learners View Own Certificates
```sql
CREATE POLICY "Learners can view their own certificate signatures"
ON public.certificate_signatures
FOR SELECT
USING (
  certificate_id IN (
    SELECT id FROM public.certificates
    WHERE user_id = auth.uid()
  )
);
```
**Effect**: Learners can only see signatures for their own certificates

#### Policy 2: Service Role Can Insert Signatures
```sql
CREATE POLICY "Admins and service can insert certificate signatures"
ON public.certificate_signatures
FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'role' = 'service_role' OR
   (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin') OR
  certificate_id IN (
    SELECT id FROM public.certificates
    WHERE user_id = auth.uid()
  )
);
```
**Effect**: Service role and admins can insert signatures for any certificate

#### Policy 3: Admins View All Signatures
```sql
CREATE POLICY "Admins can view all certificate signatures"
ON public.certificate_signatures
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
```
**Effect**: Admins and service role can view all signatures

### Enable RLS
```sql
ALTER TABLE public.certificate_signatures ENABLE ROW LEVEL SECURITY;
```

---

## Solution 2: Backfill Process

### What is Backfilling?
Backfilling adds missing signatures to certificates that were issued before proper signature linking was implemented.

### Backfill Service

#### TypeScript Service
**File**: `lib/certificateBackfillService.ts`

**Methods**:
- `findCertificatesWithoutSignatures()` - Find certificates missing signatures
- `backfillCertificateSignatures(certificateId)` - Backfill a single certificate
- `backfillAllMissingSignatures(dryRun)` - Backfill all missing signatures
- `getBackfillStatistics()` - Get backfill statistics

### Using the Backfill Service

#### Option 1: Direct Service Call (TypeScript)
```typescript
import { certificateBackfillService } from '@/lib/certificateBackfillService';

// Get statistics
const stats = await certificateBackfillService.getBackfillStatistics();
console.log(stats);

// Preview what would be backfilled (dry-run)
const preview = await certificateBackfillService.backfillAllMissingSignatures(true);

// Execute backfill
const result = await certificateBackfillService.backfillAllMissingSignatures(false);
```

#### Option 2: API Endpoints

**Endpoint**: `/api/admin/backfill-certificates`

##### Get Statistics
```bash
GET /api/admin/backfill-certificates?action=stats
```
Response:
```json
{
  "success": true,
  "statistics": {
    "total_certificates": 10,
    "certificates_with_signatures": 7,
    "certificates_missing_signatures": 3,
    "coverage_percentage": "70.00"
  }
}
```

##### Preview Backfill (Dry-Run)
```bash
POST /api/admin/backfill-certificates?action=preview
```
Response:
```json
{
  "success": true,
  "dry_run": true,
  "would_backfill": 3,
  "certificateIds": ["cert-id-1", "cert-id-2", "cert-id-3"]
}
```

##### Execute Backfill
```bash
POST /api/admin/backfill-certificates?action=backfill
```
Response:
```json
{
  "success": true,
  "backfilled": 3,
  "failed": 0,
  "total": 3,
  "message": "Successfully backfilled 3 of 3 certificates",
  "results": [
    {
      "certificateId": "cert-id-1",
      "courseTitle": "Course Name",
      "success": true,
      "signaturesAdded": 2
    }
  ]
}
```

##### Find Missing Certificates
```bash
GET /api/admin/backfill-certificates?action=find-missing
```
Response:
```json
{
  "success": true,
  "count": 3,
  "certificates": [
    {
      "id": "cert-id-1",
      "user_id": "user-id",
      "course_id": "course-id",
      "issued_at": "2026-04-09T10:48:37.014747+00"
    }
  ]
}
```

##### Backfill Single Certificate
```bash
POST /api/admin/backfill-certificates?action=backfill-single
Content-Type: application/json

{
  "certificateId": "cert-id-1"
}
```

---

## Implementation Steps

### Step 1: Apply RLS Policies
Execute the SQL in `sql/certificate_signatures_rls_and_backfill.sql`:
```bash
# In Supabase SQL Editor, paste:
-- Copy contents from certificate_signatures_rls_and_backfill.sql
-- STEP 1 & 2 & 3 sections
```

### Step 2: Run Backfill Preview
```bash
curl -X POST http://localhost:3000/api/admin/backfill-certificates?action=preview \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Step 3: Execute Backfill
```bash
curl -X POST http://localhost:3000/api/admin/backfill-certificates?action=backfill \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Step 4: Verify Results
```bash
curl -X GET http://localhost:3000/api/admin/backfill-certificates?action=stats \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## SQL Backfill Alternative

If you prefer to backfill directly via SQL:

```sql
-- Find certificates without signatures
SELECT c.id, c.course_id, COUNT(cs.id) as sig_count
FROM certificates c
LEFT JOIN certificate_signatures cs ON c.id = cs.certificate_id
GROUP BY c.id
HAVING COUNT(cs.id) = 0;

-- Backfill signatures
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
  c.id,
  css.id,
  css.display_order,
  css.name,
  css.designation,
  css.signature_text,
  css.signature_image_url
FROM certificates c
CROSS JOIN certificate_signature_settings css
WHERE NOT EXISTS (
  SELECT 1 FROM certificate_signatures cs
  WHERE cs.certificate_id = c.id AND cs.signature_id = css.id
)
AND css.enabled = true
ON CONFLICT (certificate_id, signature_id) DO NOTHING;
```

---

## Verification

### Check RLS Status
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'certificate_signatures';
```

### Count Backfilled Signatures
```sql
SELECT
  COUNT(DISTINCT c.id) as certificates_with_sigs,
  COUNT(cs.id) as total_signature_links
FROM certificates c
LEFT JOIN certificate_signatures cs ON c.id = cs.certificate_id;
```

### Test Certificate Viewing
```typescript
// As learner, should only see their own certificates
const certs = await supabase
  .from('certificates')
  .select(`
    id,
    certificate_signatures (
      signature_name,
      signature_designation,
      signature_image_url
    )
  `)
  .eq('user_id', auth.user.id);
```

---

## Files Created

1. **SQL Script**: `sql/certificate_signatures_rls_and_backfill.sql`
   - RLS policy definitions
   - Backfill queries
   - Verification queries

2. **TypeScript Service**: `lib/certificateBackfillService.ts`
   - Backfill service functions
   - Statistics calculation
   - Error handling

3. **API Endpoint**: `pages/api/admin/backfill-certificates.ts`
   - REST endpoints for backfill operations
   - Admin authentication required

---

## Troubleshooting

### Backfill Returns "No enabled signatures"
**Issue**: No signatures are enabled in `certificate_signature_settings`

**Solution**:
1. Go to admin panel
2. Configure at least one signature in certificate settings
3. Mark it as `enabled = true`
4. Run backfill again

### Permission Denied Error
**Issue**: RLS policy is blocking inserts

**Solution**:
1. Check if RLS is enabled on `certificate_signatures`
2. Verify the RLS policies are created
3. Ensure user has proper role (admin or service_role)

### Some Certificates Still Missing Signatures After Backfill
**Issue**: Backfill only adds signatures for enabled ones

**Solution**:
1. Check which signatures are enabled in settings
2. Run `find-missing` action to see remaining certificates
3. Enable more signatures if needed
4. Run backfill again

---

## Performance Notes

- Backfill uses `ON CONFLICT ... DO NOTHING` to prevent duplicate inserts
- Indexes on `certificate_id` and `signature_id` optimize queries
- Foreign key constraints ensure data integrity
- RLS policies are applied at database level (secure)

---

## Security Considerations

✅ **Learners can only view their own signatures**
✅ **Only admins and service role can insert signatures**
✅ **Cascade delete removes signatures when certificate is deleted**
✅ **RLS prevents unauthorized data access**

---

## Related Fixes

This backfill addresses issues from:
- Certificate signatures not loading for learners
- Missing signature links in certificate_signatures table
- RLS policy enforcement for secure access

Combined with the earlier fix in `courseCompletionService.ts` that calls `awardCertificate()`, this ensures:
1. ✅ New certificates are issued WITH proper signature links
2. ✅ Old certificates can be backfilled with missing signatures
3. ✅ RLS policies control access properly
