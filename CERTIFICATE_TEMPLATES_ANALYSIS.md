# Certificate Templates Analysis & Architecture Plan
**Date**: April 8, 2026
**Status**: Pre-Implementation Review

---

## 📋 Current Architecture (Hardcoded Single Template)

### Current Flow
```
Certificate Request
  ↓
getCertificate() → Fetch from `/certificate.html` (static file)
  ↓
generateCertificateHTML() → String replacements with hardcoded placeholders
  ↓
Render in iFrame → Download as PDF
```

### Current Limitations
- ❌ Only **one template** supported (Clove Learning Portal design)
- ❌ Templates stored as **static files** (`/public/certificate.html`)
- ❌ Hard-coded placeholder strings:
  - `"Yuva Subharam"` → User name
  - `"Risk Management from Daily Life to Business"` → Course title
  - `"07 September, 2023"` → Issue date
  - `"XXXXXXXXXXXXXXXXXXXXXXXXXXXXX"` → Certificate ID
- ❌ Signatures use hardcoded names (Sidharth K, Sreenath)
- ❌ No template selection mechanism
- ❌ No template management UI

---

## 📁 Current Template File

**Location**: `public/certificate.html`
**Size**: ~164 lines
**Design**: Clove Technologies (Dark Teal + Orange scheme)
**Components**:
- Left sidebar: Grid pattern with geometric shapes (logo area)
- Right main area: Certificate content
  - "Certificate of Completion" heading
  - User name (accent orange color)
  - Course title in bold
  - Grade display
  - Issue date (highlighted box)
  - **Signature section** (dynamic, pulled from DB)

### Current Placeholders
```html
<!-- User Name -->
<h3 class="text-4xl md:text-5xl font-bold text-accent">Yuva Subharam</h3>

<!-- Course Title -->
<strong class="text-xl block mt-1">Risk Management from Daily Life to Business</strong>

<!-- Certificate ID -->
Certificate ID: XXXXXXXXXXXXXXXXXXXXXXXXXXXXX

<!-- Issue Date -->
<p>Date of Issue: 07 September, 2023</p>

<!-- Grade -->
Grade: <span class="font-bold">Qualified</span>

<!-- Signatures (Dynamic - fetched from DB) -->
<!-- Updated dynamically from certificate_signature_settings table -->
```

---

## 💾 Database Structure

### Current Tables Involved

#### `certificates` Table
```sql
-- Stores issued certificates
id: UUID (PRIMARY KEY)
user_id: UUID (FOREIGN KEY → profiles)
course_id: UUID (FOREIGN KEY → courses)
issued_at: TIMESTAMP
-- HTML template is NOT stored here, fetched from `/certificate.html`
```

#### `certificate_signature_settings` Table
```sql
-- Stores signature information for certificates
id: UUID (PRIMARY KEY)
name: VARCHAR (e.g., "Sidharth K")
designation: VARCHAR (e.g., "Chief Operating Officer")
signature_image_url: TEXT (image URL in storage)
signature_text: TEXT (cursive text fallback)
is_enabled: BOOLEAN (controls which signatures appear)
display_order: INTEGER (signature ordering)
created_at: TIMESTAMP
updated_at: TIMESTAMP
created_by: UUID
```

---

## 🎨 Current Template Design Details

### Visual Elements
- **Left Panel** (33% width on desktop):
  - Geometric grid pattern (4x4)
  - Color blocks: Primary (teal), Accent (orange), Accent-light (yellow)
  - Company branding (vertical text "Clove Learning Portal")

- **Right Panel** (67% width on desktop):
  - Radial gradient background pattern
  - Large decorative circle (top-right) with star icon
  - Geometric shapes (bottom-right)

### Color Scheme
- **Primary**: `#0F3D47` (Dark Teal)
- **Accent**: `#E29562` (Orange)
- **Accent-light**: `#F2D597` (Light Yellow)
- **Background**: `#F3F1E7` (Off-white paper)

### Font Stack
- Display: `Space Grotesk` (bold headings)
- Body: `Inter` (regular text)
- Signature: `Dancing Script` (cursive)

### Dynamic Signatures Section
```html
<!-- Generated from certificate_signature_settings -->
<div style="display: flex; justify-content: space-around;">
  <!-- For each enabled signature: -->
  <div>
    <img|text> <!-- Signature image or styled text -->
    <line> <!-- Border line -->
    <name> <!-- Person name -->
    <designation> <!-- Role/title -->
  </div>
</div>
```

---

## 🔄 Service Functions

### `certificateService.ts`
- **getCertificate(certificateId)** - Fetches cert + user data + **static HTML template**
  - Currently fetches `/certificate.html` via HTTP
  - Does NO database query for template content

- **awardCertificate(userId, courseId)** - Creates certificate record
  - Validates `certificate_enabled` flag on course
  - Stores in `certificates` table

- **getUserCertificates(userId)** - Lists user's certificates
  - Returns simplified cert data

### `certificateHTMLGenerator.ts`
- **generateCertificateHTML(baseTemplate, data)** - Populates template
  - Takes static HTML + data object
  - Does string replacements: `userName`, `courseTitle`, `issueDate`, `certificateId`
  - **Fetches signatures** from `certificate_signature_settings` table dynamically
  - Returns populated HTML string

### `certificateSignatureService.ts`
- **getEnabledSignatures()** - Returns signatures where `is_enabled = true`
- Full CRUD operations for admin management

---

## 🎯 Proposed Dynamic Template Architecture

### Option 1: Database-Stored Templates (Recommended)
```sql
-- New table: certificate_templates
id: UUID (PRIMARY KEY)
template_name: VARCHAR (e.g., "Clove Standard", "Modern Blue", "Classic White")
description: TEXT
html_content: TEXT (complete HTML)
css_content: TEXT (custom CSS, optional)
is_active: BOOLEAN (default template)
created_by: UUID
created_at: TIMESTAMP
updated_at: TIMESTAMP
preview_image_url: TEXT
display_order: INTEGER

-- Update certificates table
ALTER TABLE certificates ADD COLUMN template_id UUID REFERENCES certificate_templates(id)
```

### Option 2: Hybrid Storage (File + DB Metadata)
```sql
-- Template metadata in DB
id: UUID
template_name: VARCHAR
file_path: TEXT (e.g., "/templates/clove-standard.html")
is_active: BOOLEAN
preview_image_url: TEXT

-- Files stored in Supabase Storage at `certificate-templates/`
```

### Updated Service Flow
```
Certificate Request
  ↓
getCertificate() → Fetch template info + user data
  ├─ Load template_id from certificates OR use default
  ├─ Fetch HTML from certificate_templates table
  └─ Fetch enabled signatures
  ↓
generateCertificateHTML() → Populate with data
  ├─ Replace placeholders (userName, courseTitle, etc.)
  ├─ Render signature section
  └─ Apply custom CSS if provided
  ↓
Render in iFrame → Download as PDF
```

---

## 📊 Sample Template Candidates

### 1. Current Template (Clove Standard)
- **Name**: `clove-standard`
- **Design**: Geometric + Modern
- **Colors**: Teal + Orange
- **Status**: ✅ Exists (public/certificate.html)

### 2. Classic Professional (To Add)
- **Design**: Traditional certificate style
- **Colors**: Gold + Navy Blue
- **Features**: Decorative borders, classical fonts

### 3. Modern Minimal (To Add)
- **Design**: Clean, contemporary
- **Colors**: Monochrome + accent color
- **Features**: Flat design, sans-serif fonts

### 4. Corporate Branded (To Add)
- **Design**: Customizable company branding
- **Colors**: Company colors
- **Features**: Logo placement, flexible signatures

---

## 🔌 UI Components Needed

### Admin Panel
- **Template Manager** (`/admin/certificate-templates`)
  - List all templates
  - Preview template
  - Enable/disable template
  - Edit HTML/CSS
  - Upload preview image
  - Delete template

### Course Settings
- **Certificate Template Selection**
  - Dropdown to choose template per course
  - Preview before saving

### Certificate Viewer
- No changes needed (automatic template loading)

---

## 📝 Implementation Steps (For Next Session)

1. ✅ **Create `certificate_templates` table** (migration)
2. ✅ **Add `template_id` to `certificates` table** (migration)
3. ✅ **Migrate existing template** to database
4. ✅ **Update `certificateService.ts`**
   - Modify `getCertificate()` to fetch from DB
   - Add `getTemplateById()` function
   - Default to first active template if not specified
5. ✅ **Update `certificateHTMLGenerator.ts`**
   - Accept template from DB
   - Handle missing fields gracefully
6. ✅ **Create Template Manager UI**
   - Admin page to manage templates
7. ✅ **Update Course Admin**
   - Add template selector dropdown
8. ✅ **Create Sample Templates**
   - Classic Professional
   - Modern Minimal
9. ✅ **Test & Validation**
   - Template switching
   - PDF generation
   - Print preview
   - Signature rendering

---

## ⚠️ Migration Strategy

### Backward Compatibility
- All existing certificates remain unchanged
- Courses without template_id use default (first active)
- Fallback to `/certificate.html` if DB template missing

### Data Safety
- Preserve all existing certificate records
- Keep static HTML file as backup
- Create new table without altering existing schema initially

---

## 📌 Key Files to Modify

```
pages/
  ├── CertificatePage.tsx (no changes needed)
  └── AdminCertificateTemplates.tsx (NEW)

lib/
  ├── certificateService.ts (MODIFY - fetch from DB)
  ├── certificateHTMLGenerator.ts (MODIFY - handle multiple templates)
  └── certificateTemplateService.ts (NEW - CRUD ops)

components/
  ├── TemplatePreview.tsx (NEW)
  └── TemplateManager.tsx (NEW)

supabase/migrations/
  ├── 20260408_create_certificate_templates_table.sql (NEW)
  └── 20260408_add_template_id_to_certificates.sql (NEW)

public/
  └── certificate.html (KEEP - used as default/fallback)
```

---

## 🎬 Next Steps

1. **Review this analysis** in the next session
2. **Decide on storage approach** (DB vs Hybrid)
3. **Create migrations**
4. **Implement service layer changes**
5. **Build template manager UI**
6. **Test with multiple templates**

---

## 📚 Related Files
- `CertificatePage.tsx:1-248` - Certificate rendering UI
- `certificateService.ts:42-94` - getCertificate() function
- `certificateHTMLGenerator.ts:57-101` - Template population
- `public/certificate.html:1-164` - Current template
- `certificateSignatureService.ts:55-69` - Signature fetching
