# Certificate Toggle Bug Fix - April 9, 2026

## Issue Summary
**Courses with certificate toggle OFF were still issuing certificates during course completion.**

---

## Root Cause

In `components/CourseDetailsForm.tsx`, the certificate toggle initialization logic was using incorrect comparison:

### ❌ BEFORE (Lines 90 & 133):
```typescript
certificate_enabled: courseData.certificate_enabled !== false,
```

### Problem with `!== false` logic:
| Value | Result | Issue |
|-------|--------|-------|
| `true` | `true !== false` = **true** ✓ | Correct |
| `false` | `false !== false` = **false** ✓ | Correct |
| `null` | `null !== false` = **true** ✗ | **BUG!** |
| `undefined` | `undefined !== false` = **true** ✗ | **BUG!** |

**Impact**: Any course with `certificate_enabled = null` or `undefined` (including older courses without explicit values) would have certificates **enabled by default** in the form, even if the toggle was OFF.

---

## The Fix

### ✅ AFTER (Lines 90 & 133):
```typescript
certificate_enabled: courseData.certificate_enabled === true,
```

### Correct `=== true` logic:
| Value | Result | Outcome |
|-------|--------|---------|
| `true` | `true === true` = **true** ✓ | Correct |
| `false` | `false === true` = **false** ✓ | Correct |
| `null` | `null === true` = **false** ✓ | Safe default (disabled) |
| `undefined` | `undefined === true` = **false** ✓ | Safe default (disabled) |

**Benefits**:
- ✅ Explicit check for `true` value
- ✅ Safe defaults for `null`/`undefined` (disabled)
- ✅ Matches backend validation in `courseCompletionService.ts` (line 67)
- ✅ Respects the toggle UI accurately

---

## Files Modified

### `components/CourseDetailsForm.tsx`
- **Line 90**: Updated form state initialization in `useEffect`
- **Line 133**: Updated initial `formData` state

### Backend Validation (Already Correct)
The `lib/courseCompletionService.ts` (line 67) already uses correct logic:
```typescript
const isCertificateEnabled = course.certificate_enabled === true;
```

---

## Testing

### How to Verify the Fix

1. **Edit an existing course** with `certificate_enabled = false`:
   - Open course in builder
   - Verify certificate toggle is OFF
   - Save changes
   - Certificate should NOT be issued on completion

2. **Edit a legacy course** (where `certificate_enabled = null`):
   - Open course in builder
   - Verify certificate toggle defaults to OFF (not ON)
   - This is the key change from the bug

3. **Create a new course**:
   - Certificate toggle should default to OFF
   - Explicitly toggle ON to enable certificates
   - Save and verify behavior

### Browser Console Check
When a course completes, check console logs:
```
[CERTIFICATE_CHECK] Course: "..." certificate_enabled: false (type: boolean)
[CERTIFICATE_BLOCKED] Certificate disabled for course "...". Skipping certificate issuance.
```

---

## Impact Summary

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| New course, toggle OFF | ❌ Issued cert | ✅ No cert |
| Legacy course (null) | ❌ Issued cert | ✅ No cert |
| Course, toggle ON | ✅ Issued cert | ✅ Issued cert |
| Course, toggle OFF | ✅ No cert | ✅ No cert |

---

## Cleanup Needed

The existing orphaned certificates from the bug can be cleaned up using the Certificate Management feature:

1. Navigate to Admin → Certificate Management
2. Click "Validate Certificates"
3. Review orphaned certificates (from disabled courses)
4. Check "Dry Run" and preview cleanup
5. Uncheck "Dry Run" and execute cleanup

See `CERTIFICATE_ISSUANCE_GUIDE.md` for details.

