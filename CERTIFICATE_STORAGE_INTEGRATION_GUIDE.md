# Auto-Send Rules & Certificate Storage Integration Guide

## Completion Summary

✅ **Auto-Send Notification Rules Backend** - COMPLETE  
✅ **Database Migrations Applied** - COMPLETE  
✅ **Certificate Storage Cleanup Service** - COMPLETE  

---

## What Was Deployed

### 1. Auto-Send Notification Rules Infrastructure

**Database Tables Created:**
- `notification_auto_send_rules` - Stores admin-created rules
- `auto_send_rule_execution_log` - Tracks rule executions per user
- `notification_processing_queue` - Queue for pending notifications
- `trigger_evaluation_history` - Historical evaluation records

**Features:**
- 7 trigger types: task_pending, course_due, assignment_overdue, low_engagement, inactive_user, course_not_started, achievement_unlocked
- Automatic cooldown (24 hours) and max sends per user
- Real-time enrollment event triggers
- Execution logging and statistics

---

### 2. Certificate Storage Management Service

**Backend Service:** `server/services/certificateStorageService.ts`

**Capabilities:**
- 📊 List all signature images in storage
- 🔍 Identify which images are in use
- 🗑️ Detect orphaned/unused images
- 📈 Calculate storage statistics
- 🧹 Bulk delete unused images

**API Endpoints:**
```
GET  /api/certificate-storage/stats    - Get storage stats and orphaned images
POST /api/certificate-storage/delete    - Delete single image
POST /api/certificate-storage/delete-bulk - Bulk delete images
POST /api/certificate-storage/cleanup   - Clean up all orphaned images
```

---

### 3. Storage Management UI Component

**Component:** `lib/CertificateStoragePanel.tsx`

**Features:**
- Display storage usage statistics (total, in use, orphaned, space saved)
- Visual breakdown of image usage
- List all orphaned images with size and date
- Select/deselect images for deletion
- Bulk delete with confirmation
- Real-time stats refresh

---

## Integration Steps

### Step 1: Update CertificateSignatureSettings.tsx

Add the CertificateStoragePanel to the certificate settings page:

```typescript
// At the top of CertificateSignatureSettings.tsx, add import:
import { CertificateStoragePanel } from '@/lib/CertificateStoragePanel';

// Inside the CertificateSignatureSettings component, add before the closing </div>:
{/* Certificate Storage Management Panel */}
<div className="border-t border-gray-300 my-8"></div>
<CertificateStoragePanel />
```

**Location:** Add after the `CertificateTemplateManager` component near the end of the JSX.

### Step 2: Verify File Uploads

Ensure signature images are uploaded to Supabase storage bucket: `signature-images`

```typescript
// When uploading signature images:
const uploadSignatureImage = async (file: File, designation: string) => {
  const filename = `${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('signature-images')
    .upload(filename, file);
  
  if (error) throw error;
  
  return `signature-images/${data.path}`;
};
```

### Step 3: Enable API Routes

Ensure the API route file exists at:
- `pages/api/certificate-storage/[action].ts`

This is created and provides endpoints for storage management.

### Step 4: Configure Environment Variables

Verify these environment variables are set:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## How It Works

### Data Flow

```
CertificateSignatureSettings
    ↓
CertificateStoragePanel (UI Component)
    ↓
API Route: /api/certificate-storage/[action]
    ↓
CertificateStorageService (Backend)
    ↓
Supabase Database + Storage
```

### Usage Detection

1. **Scan certificate_signatures table** for signature_image_url
2. **Scan notification_auto_send_rules table** for image_url
3. **Build set of in-use URLs**
4. **Compare with storage bucket** to find orphaned images
5. **Display statistics and allow cleanup**

---

## Key Features Explained

### 1. Storage Statistics

Displays at a glance:
- **Total Images**: All images in storage bucket
- **Storage Used**: Total size of all images
- **In Use**: Images referenced by signatures/rules
- **Orphaned**: Unused images with recoverable space

### 2. Orphaned Image Detection

Images are considered "orphaned" if:
- ❌ Not referenced in `certificate_signatures` table
- ❌ Not referenced in `notification_auto_send_rules` table
- ❌ Safe to delete without breaking any functionality

### 3. Bulk Operations

Efficiently delete multiple images:
- Select/deselect individual images
- "Select All" button for quick selection
- See deletion count and space saved
- Confirmation dialog before deletion

### 4. Real-Time Safety

Protection against deleting in-use images:
- Server-side verification before deletion
- Shows reference information (which signature/rule uses it)
- Prevents accidental data loss

---

## API Usage Examples

### Get Storage Statistics

```bash
curl -X GET http://localhost:3000/api/certificate-storage/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "stats": {
    "totalImages": 15,
    "totalSize": 2048000,
    "inUseImages": 10,
    "orphanedImages": 5,
    "orphanedSize": 512000
  },
  "orphaned": [
    {
      "name": "old_signature_1.png",
      "size": 102400,
      "created_at": "2026-04-10T12:00:00Z"
    }
  ]
}
```

### Delete Bulk Images

```bash
curl -X POST http://localhost:3000/api/certificate-storage/delete-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "imageNames": ["old_sig_1.png", "old_sig_2.png"]
  }'

# Response:
{
  "success": true,
  "deleted": 2,
  "failed": 0,
  "errors": []
}
```

### Auto Cleanup All Orphaned

```bash
curl -X POST http://localhost:3000/api/certificate-storage/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "deleted": 5,
  "failed": 0,
  "spaceSaved": 512000
}
```

---

## Testing Checklist

- [ ] Navigate to Certificate Signature Settings
- [ ] See Storage Management panel displayed
- [ ] Statistics load correctly
- [ ] Upload a new signature image
- [ ] Verify it appears in "In Use" count
- [ ] Delete the signature
- [ ] Verify image appears in "Orphaned" list
- [ ] Select and delete the orphaned image
- [ ] Confirm file is removed from storage
- [ ] Stats refresh and update correctly

---

## Troubleshooting

### Issue: API endpoint returns 404
**Solution:** Ensure `pages/api/certificate-storage/[action].ts` exists and Next.js is running.

### Issue: Storage stats show but no orphaned images
**Solution:** Normal! All images are in use. This is good.

### Issue: Can't delete specific image
**Solution:** Image may be in use. Check if it's referenced in a signature or rule.

### Issue: Space not saved after deletion
**Solution:** Refresh the page or click the "Refresh Stats" button to see updated figures.

---

## Performance Notes

- Storage listing limited to 1000 files (configurable)
- Database queries optimized with indexes
- Bulk operations use transaction-like behavior
- No blocking operations on large deletions

---

## Next Steps

1. **Review the migration SQL** - Understand the database changes
2. **Test auto-send rules** - Create test rules and verify execution
3. **Monitor storage** - Use the panel regularly to identify unused images
4. **Configure schedules** - Set up cron jobs for periodic rule processing
5. **Enable monitoring** - Track rule execution and delivery rates

---

## Support Resources

- **Backend Service**: [certificateStorageService.ts](server/services/certificateStorageService.ts)
- **UI Component**: [CertificateStoragePanel.tsx](lib/CertificateStoragePanel.tsx)
- **API Routes**: [pages/api/certificate-storage/[action].ts](pages/api/certificate-storage/[action].ts)
- **Auto-Send Guide**: [AUTO_SEND_RULES_IMPLEMENTATION_GUIDE.md](AUTO_SEND_RULES_IMPLEMENTATION_GUIDE.md)
- **Database Migrations**: [20260414_*.sql](supabase/migrations/)
