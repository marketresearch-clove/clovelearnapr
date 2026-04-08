# Certificate Template Manager - Integration Guide
**Date**: April 8, 2026
**Status**: ✅ Component Created & Integrated
**Location**: Admin Panel → Certificate Signatures & Templates

---

## 🎯 What Was Created

### New Component: `CertificateTemplateManager.tsx`
A comprehensive template management component that provides:
- **Template Grid View** - Display all templates with previews
- **Template Selection** - Click to select and view details
- **Live Preview** - See certificate template in iframe
- **HTML Editor** - Edit template HTML content
- **CSS Editor** - Customize template styling
- **Set as Default** - Define the default certificate template
- **Delete Templates** - Remove unused templates

### Updated File: `CertificateSignatureSettings.tsx`
- Added import for `CertificateTemplateManager`
- Integrated component below signature settings
- Added divider between sections for visual separation

---

## 📐 Page Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      ADMIN LAYOUT                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  CertificateSignatureSettings Page                           │
│  ─────────────────────────────────────────────────────────   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ SECTION 1: CERTIFICATE SIGNATURES (Existing)        │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │ Header: "Certificate Signatures"                    │    │
│  │ Button: "+ Add Signature"                           │    │
│  │                                                      │    │
│  │ [Add/Edit Signature Modal]                          │    │
│  │                                                      │    │
│  │ Table: Signature List                               │    │
│  │ ┌─────┬──────────────┬────────────┬─────────────┐  │    │
│  │ │ORDER│NAME          │DESIGNATION │IMAGE│STATUS │  │    │
│  │ ├─────┼──────────────┼────────────┼─────────────┤  │    │
│  │ │ 1   │HR Lead       │HR          │  -  │ ✓     │  │    │
│  │ │ 2   │Chief Ops Off │COO         │  -  │ ✓     │  │    │
│  │ └─────┴──────────────┴────────────┴─────────────┘  │    │
│  │                                                      │    │
│  │ Info Box: "Managing Certificate Signatures"         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ─────────────────────────────────────────────────────────   │
│           [DIVIDER] (NEW)                                    │
│  ─────────────────────────────────────────────────────────   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ SECTION 2: CERTIFICATE TEMPLATES (NEW)              │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │ Header: "Certificate Templates"                     │    │
│  │ Button: "+ Create Template"                         │    │
│  │                                                      │    │
│  │ Template Grid (3 columns on desktop):                │    │
│  │                                                      │    │
│  │ ┌─────────────────┐ ┌─────────────────┐             │    │
│  │ │ CLOVE STANDARD  │ │  [EMPTY SLOT]   │             │    │
│  │ ├─────────────────┤ ├─────────────────┤             │    │
│  │ │                 │ │                 │             │    │
│  │ │  [PREVIEW IMG]  │ │  [+ Create New] │             │    │
│  │ │                 │ │                 │             │    │
│  │ │ ✓ Default       │ │                 │             │    │
│  │ ├─────────────────┤ ├─────────────────┤             │    │
│  │ │[Preview][Edit]  │ │[Preview][Create]│             │    │
│  │ │[Set Default]    │ │[Delete]         │             │    │
│  │ └─────────────────┘ └─────────────────┘             │    │
│  │                                                      │    │
│  │ [Editor Modal - Opens on Edit]                      │    │
│  │ [Preview Modal - Opens on Preview]                  │    │
│  │                                                      │    │
│  │ Info Box: "Managing Certificate Templates"          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Template Manager UI Components

### 1. Header Section
```
┌─────────────────────────────────────────────────────────┐
│ Certificate Templates                  [+ Create Template]│
│ Manage certificate designs and templates...              │
└─────────────────────────────────────────────────────────┘
```

### 2. Success/Error Messages
```
┌─────────────────────────────────────────────────────────┐
│ ✓ Template saved successfully                        [×] │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ✗ Failed to load certificate templates               [×] │
└─────────────────────────────────────────────────────────┘
```

### 3. Template Card (Grid Item)
```
┌──────────────────────────┐
│                          │
│   [PREVIEW IMAGE]        │  ← 192px height
│   ✓ Default Badge        │
│                          │
├──────────────────────────┤
│ Clove Standard           │  ← Template name
│ Original Clove Tech...   │  ← Description (clipped)
│                          │
│ [👁 Preview] [✏ Edit]   │  ← Action buttons
│ [✓ Set Default] [🗑]    │
└──────────────────────────┘
```

### 4. Editor Modal
```
┌─────────────────────────────────────────────────┐
│ Edit Template: Clove Standard               [×] │
├─────────────────────────────────────────────────┤
│                                                  │
│ Template Name                                   │
│ [Clove Standard (read-only)]                   │
│                                                  │
│ HTML Content                                    │
│ ┌──────────────────────────────────────────┐   │
│ │ <!DOCTYPE html>                          │   │
│ │ <html>                                   │   │
│ │ ...                                      │   │
│ │                                          │   │
│ │ Use placeholders: {userName}, {course..} │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ Custom CSS (Optional)                           │
│ ┌──────────────────────────────────────────┐   │
│ │ /* CSS styles */                         │   │
│ │ body { ... }                             │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│         [Cancel]  [💾 Save Changes]             │
└─────────────────────────────────────────────────┘
```

### 5. Preview Modal
```
┌─────────────────────────────────────────────────┐
│ Preview: Clove Standard                     [×] │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌──────────────────────────────────────────┐   │
│ │                                          │   │
│ │      [CERTIFICATE PREVIEW IN IFRAME]    │   │
│ │      (height: 600px)                    │   │
│ │                                          │   │
│ │      Shows actual rendered template     │   │
│ │                                          │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ ┌──────────────────────┐ ┌──────────────────┐  │
│ │ Template Name        │ │ Status           │  │
│ │ Clove Standard       │ │ ✓ Default        │  │
│ └──────────────────────┘ └──────────────────┘  │
│                                                  │
│                              [Close]             │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Component Architecture

### CertificateTemplateManager.tsx
```typescript
interface Props {
  onTemplateUpdated?: (template) => void    // Callback when updated
  readOnly?: boolean                        // Read-only mode
}

State Management:
├── templates[]              // List of all templates
├── selectedTemplate         // Currently selected template
├── showEditor              // Show/hide editor modal
├── showPreview             // Show/hide preview modal
├── editingContent          // HTML being edited
├── successMessage          // Success notification
└── errorMessage            // Error notification

Functions:
├── fetchTemplates()        // Load all templates
├── handleSelectTemplate()  // Select a template
├── handleEditTemplate()    // Open editor
├── handleSaveTemplate()    // Save changes
├── handleSetAsDefault()    // Set as default
└── handleDeleteTemplate()  // Delete template
```

---

## 📋 Data Flow

### 1. Initial Load
```
Component Mount
  ↓
fetchTemplates()
  ↓
Load mock data (TODO: Replace with API)
  ↓
Display grid with templates
```

### 2. Edit Template
```
User clicks [Edit] button
  ↓
handleEditTemplate()
  ↓
Set selectedTemplate
  ↓
Copy html_content to editingContent
  ↓
Open showEditor modal
  ↓
User edits HTML
  ↓
Click [Save Changes]
  ↓
handleSaveTemplate()
  ↓
Call API: certificateTemplateService.updateTemplate()
  ↓
Update local state
  ↓
Show success message
```

### 3. Set as Default
```
User clicks [Set Default] button
  ↓
handleSetAsDefault()
  ↓
Call API: certificateTemplateService.setActiveTemplate()
  ↓
Update all templates: is_active = false
  ↓
Update selected: is_active = true
  ↓
Show success message
  ↓
Display ✓ Default badge
```

### 4. Preview Template
```
User clicks [Preview] button
  ↓
setShowPreview(true)
  ↓
Open modal with iframe
  ↓
iframe srcDoc = template.html_content
  ↓
Display rendered certificate
```

---

## 🔌 Integration Points

### 1. With certificateTemplateService.ts (To be created)
```typescript
// Functions to implement in service:
- getAllTemplates()           // Fetch all templates
- getTemplate(id)             // Fetch single template
- getActiveTemplate()         // Get default template
- createTemplate(data)        // Create new template
- updateTemplate(id, data)    // Update template
- deleteTemplate(id)          // Delete template
- setActiveTemplate(id)       // Set as default

// Replace TODO comments in component with actual API calls
```

### 2. With CertificateSignatureSettings Page
```typescript
// Component imported and placed:
<CertificateTemplateManager
  onTemplateUpdated={handleTemplateUpdated}
  readOnly={false}
/>

// Called after signature info box
// Within the max-w-6xl container
// With consistent spacing (space-y-6)
```

### 3. With Courses Admin (Future)
```typescript
// Add to CourseSettings or AdminCourses:
<select value={templateId}>
  <option value="">Use Default Template</option>
  {templates.map(t => <option value={t.id}>{t.name}</option>)}
</select>

// Fetch templates via:
const templates = await certificateTemplateService.getAllTemplates()
```

---

## 🎯 Current State vs. Future State

### Current (Before)
```
CertificateSignatureSettings
├── Header
├── Add Signature Modal
├── Signatures Table
└── Info Box
```

### After Integration (Now)
```
CertificateSignatureSettings
├── Header
├── Add Signature Modal
├── Signatures Table
├── Info Box
├── ─────────────────── [Divider]
└── CertificateTemplateManager (NEW)
    ├── Header
    ├── Create Template Button
    ├── Success/Error Messages
    ├── Template Grid
    ├── Editor Modal
    ├── Preview Modal
    └── Info Box
```

---

## 🚀 Next Steps to Complete

### 1. Create Service Layer
**File**: `lib/certificateTemplateService.ts`
```typescript
// Implement functions referenced in component TODOs:
export const getAllTemplates = async () => {...}
export const getTemplate = async (id) => {...}
export const createTemplate = async (data) => {...}
export const updateTemplate = async (id, data) => {...}
export const deleteTemplate = async (id) => {...}
export const setActiveTemplate = async (id) => {...}
```

### 2. Create Database Tables
**Migrations**:
- `20260408_create_certificate_templates_table.sql`
- `20260408_add_template_id_to_certificates.sql`

**Tables**:
```sql
CREATE TABLE certificate_templates (
  id UUID PRIMARY KEY,
  template_name VARCHAR UNIQUE,
  description TEXT,
  html_content TEXT,
  css_content TEXT,
  is_active BOOLEAN,
  preview_image_url TEXT,
  display_order INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by UUID
);

ALTER TABLE certificates ADD COLUMN template_id UUID;
```

### 3. Add RLS Policies
```sql
-- Anyone can read templates
CREATE POLICY "Anyone can read templates"
ON certificate_templates FOR SELECT USING (true);

-- Only admins can modify
CREATE POLICY "Only admins manage templates"
ON certificate_templates FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');
```

### 4. Migrate Current Template
```sql
INSERT INTO certificate_templates (...)
VALUES (
  'Clove Standard',
  'Original design',
  /* HTML from /certificate.html */,
  '',
  true,
  1
);
```

### 5. Update Components
- Replace mock data with API calls in `CertificateTemplateManager.tsx`
- Add template selector to course admin pages
- Update `certificateService.ts` to fetch from DB

### 6. Testing
- Test template loading
- Test editor functionality
- Test preview rendering
- Test default template switching
- Test PDF generation with templates

---

## 📝 Component Code Summary

### File: `components/CertificateTemplateManager.tsx`
- **Lines**: ~450
- **Type**: Functional React Component with TypeScript
- **Dependencies**: React hooks only
- **State**: 8 state variables
- **Functions**: 6 handler functions + 1 effect
- **Modals**: 2 (Editor + Preview)
- **Features**: Full CRUD template management with visual preview

### File: `pages/CertificateSignatureSettings.tsx`
- **Changes**: 2 edits
  1. Added import for `CertificateTemplateManager`
  2. Added component call + divider below info box
- **Compatibility**: Fully backward compatible
- **Impact**: No changes to existing signature functionality

---

## ✅ Integration Checklist

- ✅ Created `CertificateTemplateManager.tsx` component
- ✅ Updated `CertificateSignatureSettings.tsx` to include component
- ✅ Component has all UI elements (grid, modals, editors)
- ✅ Component has state management
- ✅ Component has error/success messages
- ✅ Component has responsive design
- ✅ Component has preview functionality
- ✅ Component has TODO markers for API integration
- ✅ Component matches existing UI styling
- ❌ Service layer (certificateTemplateService.ts) - TO DO
- ❌ Database tables - TO DO
- ❌ RLS policies - TO DO
- ❌ API integration - TO DO

---

## 🎬 How to Use (Admin Perspective)

### View Templates
1. Navigate to Admin → Certificate Signatures & Templates
2. Scroll down to "Certificate Templates" section
3. See all available templates in grid format

### Edit a Template
1. Click [Edit] button on template card
2. Modify HTML content in textarea
3. Optionally add custom CSS
4. Click [Save Changes]
5. See success message

### Preview Template
1. Click [👁 Preview] button on template card
2. See rendered certificate in modal
3. Close modal to return

### Set as Default
1. Click [✓ Set Default] on any template
2. "Default" badge appears on template
3. All new certificates will use this template

### Create New Template
1. Click "+ Create Template" button (future implementation)
2. Enter template details
3. Add HTML and CSS
4. Save new template

---

## 🎨 Styling Notes

### Consistent with Existing
- Uses Tailwind classes matching signature section
- Blue-100 headers for sections
- Gray-50 backgrounds for containers
- Primary color buttons
- Material Design icons
- Responsive grid (1 col mobile → 3 cols desktop)

### Custom Elements
- Template card with preview image area
- Green badge for "Default" status
- Iframe preview in modal
- Editor textarea with monospace font
- Placeholder text showing variable formats

---

## 📚 Documentation References

- See `CERTIFICATE_TEMPLATES_ANALYSIS.md` for full architecture
- See `DYNAMIC_TEMPLATES_IMPLEMENTATION_PLAN.md` for implementation steps
- See `CURRENT_TEMPLATE_PREVIEW.md` for template design details

---

**Status**: ✅ Component fully created and integrated
**Next Step**: Create service layer + database tables in next session
**Time to Complete**: ~2-3 hours for full implementation
