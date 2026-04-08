# 🚀 Certificate Signatures - CORRECT Deployment Steps

**CRITICAL**: Migrations MUST be run in this exact order!

---

## ⚠️ **MIGRATION ORDER (DO NOT SKIP OR REORDER)**

```
Step 1: 20260408_add_certificate_signatures.sql
        ↓ (Wait for success)
Step 2: 20260408_add_signature_snapshot.sql
        ↓ (Wait for success)
Step 3: 20260408_backfill_certificate_signatures.sql
        ↓ (Wait for success)
Step 4: Deploy code changes
```

---

## 📋 Step-by-Step Deployment

### **Step 1: Create Junction Table & RLS Policies**

**File**: `20260408_add_certificate_signatures.sql`

**In Supabase Dashboard**:
1. Go to SQL Editor
2. Copy the entire content of `20260408_add_certificate_signatures.sql`
3. Paste into editor
4. Click "Run"
5. ✅ Verify: You should see `CREATE TABLE` success message

**What it does**:
- ✅ Creates `certificate_signatures` junction table
- ✅ Creates indexes
- ✅ Creates trigger for `updated_at`
- ✅ Adds RLS policies for access control

---

### **Step 2: Add Snapshot Columns**

**File**: `20260408_add_signature_snapshot.sql`

**In Supabase Dashboard**:
1. Go to SQL Editor
2. Copy the entire content of `20260408_add_signature_snapshot.sql`
3. Paste into editor
4. Click "Run"
5. ✅ Verify: You should see `ALTER TABLE` success messages

**What it does**:
- ✅ Adds snapshot columns to `certificate_signatures`:
  - `signature_name` (TEXT)
  - `signature_designation` (TEXT)
  - `signature_text` (TEXT)
  - `signature_image_url` (TEXT)

**⚠️ CRITICAL**: If Step 2 is skipped, the code will fail with:
```
column certificate_signatures_1.signature_name does not exist
```

---

### **Step 3: Backfill Existing Certificates**

**File**: `20260408_backfill_certificate_signatures.sql`

**In Supabase Dashboard**:
1. Go to SQL Editor
2. Copy the entire content of `20260408_backfill_certificate_signatures.sql`
3. Paste into editor
4. Click "Run"
5. ✅ Verify: Check the output for:
   ```
   Total certificates: 4
   Total enabled signatures: 2
   Total certificate_signatures links: 8
   ```

**What it does**:
- ✅ Links 4 existing certificates to 2 signatures (8 total links)
- ✅ Populates snapshot columns with current signature values
- ✅ Creates immutable record of signatures at time of issuance

---

### **Step 4: Deploy Code Changes**

**Files to deploy**:
```
✅ lib/certificateService.ts
✅ lib/certificateHTMLGenerator.ts
✅ pages/CertificatePage.tsx
✅ pages/CertificateSignatureSettings.tsx
✅ public/certificate.html
```

**Deployment**:
1. Commit all code changes
2. Push to deployment branch
3. Run build
4. Deploy to production

---

## ✅ Verification After Deployment

### **1. Database Verification**

Run these queries in Supabase SQL Editor:

```sql
-- Check junction table exists and has data
SELECT COUNT(*) as total_links FROM certificate_signatures;
-- Expected: 8 (or more if backfilled multiple times)

-- Check snapshot columns are populated
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN signature_name IS NOT NULL THEN 1 ELSE 0 END) as with_snapshots
FROM certificate_signatures;
-- Expected: total=8, with_snapshots=8

-- View sample of linked data
SELECT
  c.id as cert_id,
  c.issued_at,
  cs.signature_designation as snapshot_designation,
  css.designation as current_designation
FROM certificates c
JOIN certificate_signatures cs ON c.id = cs.certificate_id
LEFT JOIN certificate_signature_settings css ON cs.signature_id = css.id
ORDER BY c.issued_at DESC
LIMIT 5;
```

### **2. Application Verification**

#### **Test Old Certificate Display**
```
1. Open any certificate issued before today
2. Verify it displays signatures
3. Verify browser console has NO errors about "signature_name does not exist"
4. Check that signature names/designations display correctly
```

#### **Test Admin Edit Signature**
```
1. Login as admin
2. Go to Certificate Signature Settings
3. Edit a signature designation (e.g., "HR Lead" → "HR Manager")
4. ✅ Designation field should NOT be disabled
5. Save the change
6. View old certificate → should still show "HR Lead"
7. Create new certificate → should show "HR Manager"
```

#### **Test RLS Policies**
```
1. Login as LEARNER (non-admin)
2. Try to view certificate
3. ✅ Should see their own certificates only
4. ✅ Should NOT see other users' certificates

5. Login as ADMIN
6. ✅ Should see/manage all certificate signatures
```

---

## 🚨 Troubleshooting

### **Error: "column certificate_signatures_1.signature_name does not exist"**

**Cause**: Step 2 migration wasn't run

**Solution**:
1. Run `20260408_add_signature_snapshot.sql` immediately
2. Refresh the page in browser
3. Try again

### **Error: "duplicate key value violates unique constraint"**

**Cause**: Backfill ran multiple times

**Solution**:
```sql
-- Delete all certificate_signatures (they can be recreated)
DELETE FROM certificate_signatures;

-- Run backfill again
-- (Copy and paste 20260408_backfill_certificate_signatures.sql)
```

### **Error: "42501: new row violates row-level security policy"**

**Cause**: RLS policy is blocking access

**Solution**:
1. Check user role in `auth.users` table
2. Verify admin user has `role = 'admin'`
3. For learners, ensure they're viewing only their own certificates

---

## 📊 Expected Data After Deployment

### **certificate_signatures Table** (8 rows)
```
certificate_id | signature_id | signature_name | signature_designation | display_order
3aa8e7a9...   | 0b224b11...  | HR Lead       | HR Lead              | 1
3aa8e7a9...   | e0b224b11... | COO           | Chief Operating Officer | 2
5a7b17f0...   | 0b224b11...  | HR Lead       | HR Lead              | 1
5a7b17f0...   | e0b224b11... | COO           | Chief Operating Officer | 2
a0cc3578...   | 0b224b11...  | HR Lead       | HR Lead              | 1
a0cc3578...   | e0b224b11... | COO           | Chief Operating Officer | 2
d47a4e63...   | 0b224b11...  | HR Lead       | HR Lead              | 1
d47a4e63...   | e0b224b11... | COO           | Chief Operating Officer | 2
```

---

## 🔐 RLS Policy Changes

### **Before** (Too Permissive)
```
Any authenticated user could view ANY user's certificate signatures
```

### **After** (Proper Security)
```
✅ Learners: Can view signatures for their OWN certificates only
✅ Admins: Can view/manage ALL certificate signatures
```

---

## ✨ Post-Deployment Checklist

- [ ] Step 1 migration: SUCCESS
- [ ] Step 2 migration: SUCCESS
- [ ] Step 3 migration: SUCCESS (8 links created)
- [ ] Code deployed
- [ ] Old certificate loads without errors
- [ ] Admin can edit signature designation
- [ ] Old certificate still shows original designation
- [ ] New certificate shows new designation
- [ ] Learner can view own certificates
- [ ] Learner cannot view others' certificates
- [ ] Admin can view all certificates

---

## 🎉 Deployment Complete!

Once all steps pass, you have:
- ✅ Proper certificate-signature relationships
- ✅ Historical accuracy (old certs show original designations)
- ✅ Admin freedom (can edit designations anytime)
- ✅ Secure RLS policies (proper access control)
- ✅ Dynamic signatures (no hardcoding)

**Status**: Production Ready 🚀
