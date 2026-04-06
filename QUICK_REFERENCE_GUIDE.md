# Certificate Signature Management - Quick Reference Guide

## 🎯 At a Glance

| Task | Location | Steps |
|------|----------|-------|
| **View signatures** | `/admin/certificate-signatures` | Admin Dashboard → Certificate Signatures |
| **Add signature** | Same page | Click "Add Signature" button → Fill form → Create |
| **Edit signature** | Same page | Click pencil icon → Edit → Update |
| **Enable/Disable** | Same page | Click status badge → Toggles immediately |
| **Reorder** | Same page | Click up/down arrows → Saves immediately |
| **Delete** | Same page | Click trash icon → Confirm → Deletes |

## 📋 Form Fields Explained

### When Creating/Editing a Signature

**Signature Name** (Required)
- The actual name of the person signing
- Example: "Sreenath P", "Sidharth Kamasani"
- Appears below the signature on certificate

**Designation** (Required, Unique)
- The job title/role
- Example: "HR", "COO", "Manager", "Director"
- Cannot be changed after creation (prevents duplicates)

**Signature Text** (Optional)
- Text to display if no image uploaded
- Can be handwriting style text or typed name
- Used as fallback when image not available

**Signature Image** (Optional)
- Upload PNG or JPG file of actual signature
- Recommended: transparent background (PNG)
- Size: Under 5MB, preferably 200-400px wide
- Displayed above the name on certificate

**Display Order** (Required)
- Number determining position on certificate
- Lower numbers appear first (leftmost/topmost)
- Examples: 1 (first), 2 (second), 3 (third)
- Using: 0, 1, 2, 3... or 10, 20, 30... both work

**Enable** (Optional)
- Checkbox to include on certificates
- Disabled signatures won't appear on new certificates
- Enabled = appears on certificates, Disabled = hidden

## ⚡ Quick Actions

### Add HR/Manager Signature
```
Name: [Manager Full Name]
Designation: HR
Signature Text: [Optional]
Image: [Upload signature.png]
Order: 1
Enable: ✓
```

### Add COO Signature
```
Name: [COO Full Name]
Designation: COO
Signature Text: [Optional]
Image: [Upload signature.png]
Order: 2
Enable: ✓
```

### Add Director Signature
```
Name: [Director Full Name]
Designation: Director
Signature Text: [Optional]
Image: [Upload signature.png]
Order: 3
Enable: ✓
```

## 🔄 Common Operations

### Change Signature Order
1. Find the signature in the table
2. Click **up/down arrows** in Order column
3. ✅ Done! (Saves automatically)

### Update Signature Image
1. Click **pencil icon** on the row
2. Upload new image in "Signature Image" field
3. Click **Update**
4. ✅ New image will appear on next certificate

### Temporarily Hide a Signature
1. Click the **status badge** (Enabled/Disabled)
2. Badge changes to "Disabled"
3. This signature won't appear on new certificates
4. ✅ Can re-enable anytime by clicking again

### Remove a Signature
1. Click **trash icon** on the row
2. Confirm deletion in dialog
3. Image deleted from storage automatically
4. ✅ Cannot undo - make sure it's correct!

## 📊 Status Reference

| Status | Meaning | Action |
|--------|---------|--------|
| **Enabled** (green) | Shows on certificates | Click to disable |
| **Disabled** (gray) | Hidden from certificates | Click to enable |

## 💡 Tips & Tricks

### For Signature Images
- ✅ Use PNG with transparency for best results
- ✅ Keep image width 200-400px
- ✅ Ensure signature is centered
- ✅ Test on mobile before approving
- ❌ Avoid very large files (> 5MB)

### For Ordering
- ✅ Use simple numbers: 1, 2, 3, 4...
- ✅ Leave gaps if you might add more later: 10, 20, 30...
- ✅ Most important signatures first (lower number)
- ❌ Don't use negative numbers or decimals

### For Designations
- ✅ Use standard titles: HR, COO, CEO, Manager, Director
- ✅ Keep consistent with organization structure
- ✅ One person per designation (enforced)
- ❌ Don't duplicate designations

## 🔍 Viewing Certificates with Signatures

### User Perspective
1. User completes a course
2. Certificate is generated
3. System fetches **enabled signatures** from database
4. Signatures appear in **display order**
5. User can view, print, or download

### Example Certificate Display
```
┌─────────────────────────────────────┐
│         CERTIFICATE                 │
│      OF COMPLETION                  │
│                                     │
│  Awarded to: [Student Name]         │
│  Course: [Course Title]             │
│  Date: [Issue Date]                 │
│                                     │
│  ═════════════════════════════      │
│                                     │
│  [Signature]  [Signature]           │
│  John Smith   Jane Doe              │
│  HR Lead      Chief Officer         │
│                                     │
└─────────────────────────────────────┘
```

## ❓ FAQ

**Q: Can I have people with same designation?**
A: No, designation must be unique. This prevents confusion.

**Q: What if I upload both image and text?**
A: Image is used first. Text only shows if image fails to load.

**Q: Do past certificates update when I change signatures?**
A: No, already-issued certificates are unchanged. Only new ones use updated settings.

**Q: Can I delete and recreate a signature?**
A: Yes, but it creates a new ID. Better to edit or disable instead of delete.

**Q: What happens if all signatures are disabled?**
A: Certificate displays without signature section (just blank space where signatures were).

**Q: Can I reorder Signature #1 after deleting old Signature #1?**
A: Yes, just re-order. Remember it must have a unique designation.

**Q: How many signatures can I have?**
A: Unlimited. Add as many as your organization needs.

**Q: Can students see these settings?**
A: No, admin-only. Students only see final certificates.

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Image won't upload | Check file format (PNG/JPG), file size (<5MB) |
| Signature not on certificate | Check if enabled, verify display_order |
| Changes not appearing | Clear browser cache, hard refresh (Ctrl+Shift+R) |
| Designation error | Check for duplicates (each must be unique) |
| Can't delete signature | Confirm dialog may be hidden - check browser alerts |
| Order arrows not working | Refresh page if at first/last position |

## 🔗 Navigation

**From Admin Dashboard:**
```
Admin Dashboard
  ↓
Left Sidebar → Certificate Signatures
  ↓
Settings Page (Create/Edit/Delete)
```

**Direct URL:**
```
/admin/certificate-signatures
```

**Requires:**
- Admin role
- Active authentication
- Supabase connection

## 📱 Responsive Design

- ✅ Works on desktop (recommended for editing)
- ✅ Works on tablet (viewing works well)
- ✅ Works on mobile (cramped but functional)
- 💡 Best experience: Use desktop for management

## 🎨 Customization

### Changing Styling
Edit in `pages/CertificateSignatureSettings.tsx`:
- Button colors (search for `bg-primary`)
- Table styling
- Form layout
- Icon choices

### Changing Signature HTML Format
Edit in `lib/certificateHTMLGenerator.ts`:
- `generateSignatureSectionHTML()` function
- Adjust spacing, alignment, styling
- Change font sizes
- Modify layout

## 📞 Support

For issues:
1. Check troubleshooting section above
2. Review `CERTIFICATE_SIGNATURE_SYSTEM.md` for details
3. Check error messages in browser console
4. Contact your development team

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Print This**: Save as PDF for reference
