# Certificate Deletion Guide

## Delete Specific Certificate: 7111f400-984d-457d-8414-d3241eda9fc7

This guide explains how to delete a specific certificate from the system.

---

## Option 1: Using the API Endpoint ✅ **RECOMMENDED**

### API Request Format

```bash
DELETE /api/admin/certificates?id=7111f400-984d-457d-8414-d3241eda9fc7
```

### Using cURL

```bash
curl -X DELETE \
  'http://localhost:3000/api/admin/certificates?id=7111f400-984d-457d-8414-d3241eda9fc7' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -H 'Content-Type: application/json'
```

### Using JavaScript/Fetch

```javascript
const certificateId = '7111f400-984d-457d-8414-d3241eda9fc7';

const response = await fetch(`/api/admin/certificates?id=${certificateId}`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    // Auth headers will be added by your auth middleware
  },
});

const result = await response.json();
if (result.success) {
  console.log(`Certificate ${certificateId} deleted successfully`);
} else {
  console.error('Failed to delete certificate:', result.error);
}
```

### API Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Certificate 7111f400-984d-457d-8414-d3241eda9fc7 deleted successfully",
  "deletedId": "7111f400-984d-457d-8414-d3241eda9fc7"
}
```

**Error Response (400/401/500):**
```json
{
  "error": "Failed to delete certificate",
  "details": { /* error details */ }
}
```

---

## Option 2: Using Supabase Console

### Step 1: Delete Certificate Signatures
In Supabase Dashboard:
1. Go to **SQL Editor**
2. Run the following query:

```sql
DELETE FROM certificate_signatures
WHERE certificate_id = '7111f400-984d-457d-8414-d3241eda9fc7';
```

### Step 2: Delete Certificate
```sql
DELETE FROM certificates
WHERE id = '7111f400-984d-457d-8414-d3241eda9fc7';
```

---

## Option 3: Using TypeScript/Supabase Client

```typescript
import { supabase } from './lib/supabaseClient';

async function deleteCertificate(certificateId: string) {
  // Step 1: Delete certificate signatures (foreign key)
  const { error: sigError } = await supabase
    .from('certificate_signatures')
    .delete()
    .eq('certificate_id', certificateId);

  if (sigError) {
    console.error('Failed to delete signatures:', sigError);
    return { success: false, error: sigError };
  }

  // Step 2: Delete certificate
  const { error: certError } = await supabase
    .from('certificates')
    .delete()
    .eq('id', certificateId);

  if (certError) {
    console.error('Failed to delete certificate:', certError);
    return { success: false, error: certError };
  }

  console.log(`Certificate ${certificateId} deleted successfully`);
  return { success: true, deletedId: certificateId };
}

// Usage
await deleteCertificate('7111f400-984d-457d-8414-d3241eda9fc7');
```

---

## Deletion Process Details

### What Gets Deleted

✅ **Certificate Record**
- ID: `7111f400-984d-457d-8414-d3241eda9fc7`
- Removed from `certificates` table

✅ **Associated Signatures**
- All records in `certificate_signatures` table
- WHERE `certificate_id = 7111f400-984d-457d-8414-d3241eda9fc7`
- These are typically empty for most certificates

### What Does NOT Get Deleted

❌ **User Record** - User remains in the system
❌ **Course Record** - Course remains in the system
❌ **Enrollment Record** - User's enrollment remains
❌ **Completion Status** - Course completion status remains

---

## Deletion Order

**IMPORTANT:** The order matters due to foreign key constraints:

1. **First**: Delete from `certificate_signatures` (references certificate_id)
2. **Then**: Delete from `certificates` (can then be deleted)

The API and provided code handles this automatically.

---

## Verification After Deletion

### Check if Certificate Was Deleted

```sql
-- Should return 0 rows
SELECT COUNT(*) FROM certificates
WHERE id = '7111f400-984d-457d-8414-d3241eda9fc7';
```

### Check for Orphaned Signatures

```sql
-- Should return 0 rows (no dangling references)
SELECT * FROM certificate_signatures
WHERE certificate_id = '7111f400-984d-457d-8414-d3241eda9fc7';
```

---

## API Endpoint Summary

### Updated Endpoint: `/api/admin/certificates`

| Method | Query Param | Purpose |
|--------|-------------|---------|
| **DELETE** | `?id={id}` | Delete specific certificate |
| **POST** | `?operation=validate` | Validate all certificates |
| **POST** | `?operation=cleanup-orphaned&dryRun=true` | Preview orphaned cleanup |
| **POST** | `?operation=cleanup-orphaned` | Delete orphaned certificates |
| **POST** | `?operation=cleanup-all&dryRun=true` | Preview all issues cleanup |
| **POST** | `?operation=cleanup-all` | Delete all issues |

---

## Browser Console Example

```javascript
// Open browser console (F12) and run:
const certId = '7111f400-984d-457d-8414-d3241eda9fc7';
fetch(`/api/admin/certificates?id=${certId}`, { method: 'DELETE' })
  .then(r => r.json())
  .then(data => console.log('Result:', data));
```

---

## Troubleshooting

### Error: "Certificate not found"
- Certificate may have already been deleted
- Verify the ID is correct
- Check Supabase directly

### Error: "Foreign key constraint violated"
- Ensure you deleted signatures FIRST
- The API does this automatically, so use the API

### Error: "Unauthorized"
- Ensure you're logged in as admin
- Check authentication token/session
- Verify auth middleware is working

---

## Cleanup Service Features

The updated API now supports:

1. ✅ **Single Certificate Deletion** - Delete one certificate by ID
2. ✅ **Orphaned Certificate Cleanup** - Delete certs for disabled courses
3. ✅ **Comprehensive Validation** - Check integrity of all certificates
4. ✅ **Dry-run Mode** - Preview deletions before executing
5. ✅ **Foreign Key Handling** - Automatically deletes signatures first

---

## Files Modified

- **`pages/api/admin/certificates.ts`**
  - Added: `deleteSingleCertificate()` function
  - Added: Default handler with routing logic
  - Updated: API documentation comments

