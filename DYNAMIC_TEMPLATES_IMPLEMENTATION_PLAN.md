# Dynamic Certificate Templates - Implementation Plan
**Created**: April 8, 2026
**Status**: Ready for Implementation
**Estimated Effort**: 3-4 hours

---

## 🎯 Goal
Transform from **single hardcoded template** to **multiple dynamic templates** stored in database and selectable per course.

---

## 📊 Architecture Comparison

### Current (Hardcoded Single Template)
```
┌─────────────────────────────────────┐
│  Hardcoded File-Based              │
├─────────────────────────────────────┤
│  /public/certificate.html           │
│  (Static, 164 lines)                │
│                                     │
│  String replacements:               │
│  - "Yuva Subharam" → User name      │
│  - "Risk Management..." → Course    │
│  - "07 September, 2023" → Date      │
│  - "XXX..." → Certificate ID        │
│                                     │
│  ❌ No template selection           │
│  ❌ No admin management UI          │
│  ❌ No preview capability           │
│  ❌ Hard to add new designs         │
└─────────────────────────────────────┘
```

### Proposed (Dynamic Database-Stored)
```
┌──────────────────────────────────────┐
│  Dynamic Database-Driven            │
├──────────────────────────────────────┤
│  Database Table:                     │
│  certificate_templates               │
│  ├─ template_name                    │
│  ├─ html_content (full HTML)         │
│  ├─ css_content (custom CSS)         │
│  ├─ is_active (default template)     │
│  ├─ preview_image_url                │
│  └─ display_order                    │
│                                      │
│  Courses Table:                      │
│  certificates                        │
│  └─ template_id (foreign key)        │
│                                      │
│  ✅ Multiple templates supported    │
│  ✅ Admin template manager UI        │
│  ✅ Template preview images          │
│  ✅ Easy to add new templates        │
│  ✅ Can customize per course         │
└──────────────────────────────────────┘
```

---

## 📋 Implementation Checklist

### Phase 1: Database Setup
- [ ] Create `certificate_templates` table
- [ ] Add `template_id` foreign key to `certificates` table
- [ ] Migrate existing template to database
- [ ] Create default template record
- [ ] Add RLS policies for template access
- [ ] Test database queries

### Phase 2: Service Layer
- [ ] Update `certificateService.ts`
  - Modify `getCertificate()` to fetch template from DB
  - Add fallback to static file if template not found
  - Handle NULL template_id (use default)

- [ ] Update `certificateHTMLGenerator.ts`
  - Accept template object instead of string
  - Handle custom CSS injection
  - Preserve signature generation logic

- [ ] Create `certificateTemplateService.ts`
  - `getTemplate(id)` - Fetch single template
  - `getActiveTemplate()` - Get default template
  - `getAllTemplates()` - List all templates (admin)
  - `createTemplate(data)` - Add new template
  - `updateTemplate(id, data)` - Edit template
  - `deleteTemplate(id)` - Remove template
  - `setActiveTemplate(id)` - Set default

### Phase 3: Admin UI
- [ ] Create admin template manager page
  - List templates with previews
  - Create new template
  - Edit template HTML/CSS
  - Upload preview image
  - Toggle active status
  - Delete template

- [ ] Add template selector to course admin
  - Dropdown in course settings
  - Preview on hover
  - Save selection

### Phase 4: Testing & Validation
- [ ] Verify template loading for each course
- [ ] Test PDF generation with different templates
- [ ] Test print preview
- [ ] Test mobile responsiveness
- [ ] Test backward compatibility (old certificates)
- [ ] Performance testing (template retrieval)

### Phase 5: Sample Templates
- [ ] Classic Professional template
- [ ] Modern Minimal template
- [ ] Keep Clove Standard as default

---

## 🗂️ File Structure Changes

### New Files to Create
```
lib/
  └── certificateTemplateService.ts (70-100 lines)
       ├─ getTemplate(id)
       ├─ getActiveTemplate()
       ├─ getAllTemplates()
       ├─ createTemplate(data)
       ├─ updateTemplate(id, data)
       ├─ deleteTemplate(id)
       └─ setActiveTemplate(id)

pages/
  └── AdminCertificateTemplates.tsx (250-300 lines)
       ├─ TemplateList
       ├─ TemplateForm
       ├─ TemplatePreview
       ├─ Add/Edit/Delete operations
       └─ Upload preview image

components/
  ├─ TemplatePreview.tsx (100-150 lines)
  │  └─ Preview certificate with data
  │
  └─ TemplateManager.tsx (200-250 lines)
     ├─ CRUD forms
     ├─ HTML editor
     ├─ CSS editor
     └─ Preview panel
```

### Files to Modify
```
lib/
  ├── certificateService.ts (lines 42-94)
  │   └─ Update getCertificate() to load from DB
  │
  └── certificateHTMLGenerator.ts (lines 57-101)
      └─ Update to handle template objects

pages/
  ├── CertificatePage.tsx
  │   └─ No changes needed (automatic)
  │
  └── AdminCourses.tsx (if exists)
      └─ Add template selector dropdown

supabase/migrations/
  ├── 20260408_create_certificate_templates_table.sql
  └── 20260408_add_template_id_to_certificates.sql
```

### Files to Keep Unchanged
```
public/
  └── certificate.html (keep as fallback/default)

components/
  └── (existing certificate components - no changes)

pages/
  └── CertificatePage.tsx (no changes needed)
```

---

## 📊 Database Schema

### New Table: `certificate_templates`
```sql
CREATE TABLE certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  html_content TEXT NOT NULL,
  css_content TEXT,
  is_active BOOLEAN DEFAULT false,
  preview_image_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT template_name_length CHECK (LENGTH(template_name) > 3),
  CONSTRAINT html_not_empty CHECK (LENGTH(html_content) > 0)
);

-- Indexes for performance
CREATE INDEX idx_templates_is_active ON certificate_templates(is_active);
CREATE INDEX idx_templates_display_order ON certificate_templates(display_order);

-- RLS Policies
-- Anyone can read templates
-- Only admins can create/update/delete
```

### Updated Table: `certificates`
```sql
ALTER TABLE certificates
ADD COLUMN template_id UUID REFERENCES certificate_templates(id);

-- Create index for foreign key
CREATE INDEX idx_certificates_template_id ON certificates(template_id);
```

### Migration Queries
```sql
-- 1. Insert current template as default
INSERT INTO certificate_templates (
  template_name,
  description,
  html_content,
  is_active,
  display_order
) VALUES (
  'Clove Standard',
  'Original Clove Technologies certificate design with geometric patterns',
  (SELECT htmlcontent FROM /* Read from /certificate.html */),
  true,
  1
);

-- 2. Update all existing certificates to use this template
UPDATE certificates
SET template_id = (SELECT id FROM certificate_templates WHERE template_name = 'Clove Standard')
WHERE template_id IS NULL;

-- 3. Make template_id NOT NULL after migration
ALTER TABLE certificates
ALTER COLUMN template_id SET NOT NULL;
```

---

## 🔄 Service Function Updates

### `certificateService.ts` - Before
```typescript
export const getCertificate = async (certificateId: string) => {
  const { data } = await supabase
    .from('certificates')
    .select('id, user_id, issued_at, courses:course_id ( id, title )')
    .eq('id', certificateId)
    .single();

  // ... user data fetch ...

  let html_template = '';
  try {
    const response = await fetch('/certificate.html'); // Static file
    html_template = await response.text();
  } catch (err) {
    console.error('Error fetching certificate template:', err);
  }

  return {
    ...data,
    profiles: { /* ... */ },
    html_template // ← Returned as string
  };
};
```

### `certificateService.ts` - After
```typescript
export const getCertificate = async (certificateId: string) => {
  const { data } = await supabase
    .from('certificates')
    .select(`
      id,
      user_id,
      issued_at,
      template_id,
      courses:course_id ( id, title )
    `)
    .eq('id', certificateId)
    .single();

  // ... user data fetch ...

  // Fetch template from database
  let template_data = null;
  if (data?.template_id) {
    const templateService = await import('./certificateTemplateService');
    template_data = await templateService.getTemplate(data.template_id);
  } else {
    // Fallback to active template
    const templateService = await import('./certificateTemplateService');
    template_data = await templateService.getActiveTemplate();
  }

  return {
    ...data,
    profiles: { /* ... */ },
    template: template_data, // ← Return full template object
    html_template: template_data?.html_content || '' // ← For backward compatibility
  };
};
```

### `certificateHTMLGenerator.ts` - Before
```typescript
export const generateCertificateHTML = async (
  baseTemplate: string,
  data: CertificateGenerationData
): Promise<string> => {
  let html = baseTemplate; // String replacement on plain text
  html = html.replace(/Yuva Subharam/g, data.userName);
  // ... more replacements ...
  return html;
};
```

### `certificateHTMLGenerator.ts` - After
```typescript
export const generateCertificateHTML = async (
  template: { html_content: string; css_content?: string },
  data: CertificateGenerationData
): Promise<string> => {
  let html = template.html_content;

  // Same replacements, now from template object
  html = html.replace(/{{userName}}/g, data.userName);
  html = html.replace(/{{courseTitle}}/g, data.courseTitle);
  // ... etc ...

  // Inject custom CSS if provided
  if (template.css_content) {
    html = html.replace('</head>', `<style>${template.css_content}</style></head>`);
  }

  // Signature section (unchanged logic)
  const signatureHTML = generateSignatureSectionHTML(signatures);
  html = html.replace(signaturePattern, signatureHTML);

  return html;
};
```

### New: `certificateTemplateService.ts`
```typescript
import { supabase } from './supabaseClient';

export interface CertificateTemplate {
  id: string;
  template_name: string;
  description?: string;
  html_content: string;
  css_content?: string;
  is_active: boolean;
  preview_image_url?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const getTemplate = async (id: string): Promise<CertificateTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching template:', error);
    return null;
  }
};

export const getActiveTemplate = async (): Promise<CertificateTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error fetching active template:', error);
    return null;
  }
};

export const getAllTemplates = async (): Promise<CertificateTemplate[]> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
};

export const createTemplate = async (
  template: Omit<CertificateTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<CertificateTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .insert([template])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating template:', error);
    return null;
  }
};

export const updateTemplate = async (
  id: string,
  updates: Partial<Omit<CertificateTemplate, 'id' | 'created_at'>>
): Promise<CertificateTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('certificate_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating template:', error);
    return null;
  }
};

export const deleteTemplate = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('certificate_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting template:', error);
    return false;
  }
};

export const setActiveTemplate = async (id: string): Promise<boolean> => {
  try {
    // First, deactivate all templates
    const { error: deactivateError } = await supabase
      .from('certificate_templates')
      .update({ is_active: false })
      .neq('id', id);

    if (deactivateError) throw deactivateError;

    // Then activate the selected one
    const { error: activateError } = await supabase
      .from('certificate_templates')
      .update({ is_active: true })
      .eq('id', id);

    if (activateError) throw activateError;
    return true;
  } catch (error) {
    console.error('Error setting active template:', error);
    return false;
  }
};
```

---

## 🎯 UI Component Examples

### Admin Template Manager - List View
```tsx
// AdminCertificateTemplates.tsx
import { useState, useEffect } from 'react';
import { getAllTemplates, deleteTemplate, setActiveTemplate } from '../lib/certificateTemplateService';

export const AdminCertificateTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const data = await getAllTemplates();
    setTemplates(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this template?')) {
      await deleteTemplate(id);
      loadTemplates();
    }
  };

  const handleSetActive = async (id: string) => {
    await setActiveTemplate(id);
    loadTemplates();
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Certificate Templates</h1>

      <button className="mb-6 bg-indigo-600 text-white px-4 py-2 rounded">
        Create New Template
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="border rounded-lg overflow-hidden shadow">
            {template.preview_image_url && (
              <img src={template.preview_image_url} alt={template.template_name} />
            )}

            <div className="p-4">
              <h3 className="font-bold text-lg">{template.template_name}</h3>
              <p className="text-gray-600 text-sm mb-2">{template.description}</p>

              <div className="flex gap-2 justify-between">
                <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm">
                  Edit
                </button>

                {!template.is_active && (
                  <button
                    onClick={() => handleSetActive(template.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Set as Default
                  </button>
                )}

                {template.is_active && (
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm">
                    Default ✓
                  </span>
                )}

                <button
                  onClick={() => handleDelete(template.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Course Settings - Template Selector
```tsx
// In AdminCourses.tsx or CourseSettings.tsx
<div className="form-group">
  <label htmlFor="certificateTemplate">Certificate Template</label>
  <select
    id="certificateTemplate"
    value={selectedTemplateId}
    onChange={(e) => setSelectedTemplateId(e.target.value)}
  >
    <option value="">Use Default Template</option>
    {templates.map((t) => (
      <option key={t.id} value={t.id}>
        {t.template_name}
      </option>
    ))}
  </select>
  <small className="text-gray-600">
    Preview: <a href={selectedTemplate?.preview_image_url} target="_blank">View</a>
  </small>
</div>
```

---

## 🔐 Security Considerations

### RLS Policies Needed
```sql
-- certificate_templates table RLS

-- Anyone can read templates (for certificate generation)
CREATE POLICY "Anyone can read templates"
ON certificate_templates FOR SELECT
USING (true);

-- Only admins can create/update/delete
CREATE POLICY "Only admins manage templates"
ON certificate_templates FOR ALL
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');
```

### Data Validation
- Template name: Non-empty, unique
- HTML content: Must contain valid HTML
- CSS content: Validate CSS syntax
- Preview image: File size limits, image type validation

---

## 📈 Performance Considerations

### Database Queries
- Cache active template (reduces queries on certificate view)
- Index on `is_active` and `display_order`
- Fetch template data once, reuse in batch operations

### Frontend Optimization
- Lazy load template previews
- Cache template list in component state
- Preview images: Optimize size (<200KB each)

### Backward Compatibility
- Keep static HTML file as fallback
- Handle missing template_id (use default)
- Support legacy certificate data

---

## ✅ Testing Checklist

### Unit Tests
- [ ] Template CRUD operations
- [ ] Template fetching (by ID, active, all)
- [ ] HTML content replacement logic
- [ ] CSS injection

### Integration Tests
- [ ] Generate certificate with different templates
- [ ] Switch template per course
- [ ] PDF generation with custom CSS
- [ ] Print preview rendering

### End-to-End Tests
- [ ] Create certificate → View → Download PDF
- [ ] Admin: Create/Edit/Delete template
- [ ] Admin: Set default template
- [ ] Course: Select specific template
- [ ] Mobile: Responsive templates

### Manual Testing
- [ ] Visual inspection of each template
- [ ] PDF quality check
- [ ] Signature rendering
- [ ] Date/user data population
- [ ] Browser print preview

---

## 📞 Rollback Plan

If issues occur:

1. **Immediate**: Disable new template selector in UI
2. **Fallback**: Use original static HTML from `/certificate.html`
3. **Recovery**:
   - Add `template_id` column as nullable
   - Update `getCertificate()` to check for NULL
   - Serve static file if template not found
4. **Data Preservation**: Keep `certificates` table unchanged

---

## 🎯 Success Metrics

✅ **Functional**
- Multiple templates stored in database
- Certificates use selected template
- Admin can manage templates

✅ **Usability**
- Admin template interface is intuitive
- Course admin can select template
- Templates preview before use

✅ **Performance**
- Template loading < 100ms
- No regression in PDF generation speed
- No database query spikes

✅ **Reliability**
- Fallback to default if template missing
- Backward compatible with old certificates
- No data loss during migration

---

## 📚 Resources

### Files to Review First
1. `public/certificate.html` - Current template structure
2. `lib/certificateService.ts:42-94` - Current template loading
3. `lib/certificateHTMLGenerator.ts:57-101` - Current template population
4. `lib/certificateSignatureService.ts` - Signature handling

### References
- Supabase Docs: RLS policies, migrations
- React best practices: State management, forms
- Tailwind CSS: Responsive utilities, component patterns

---

## 🚀 Quick Start (When Ready)

1. Create migrations in `supabase/migrations/`
2. Create `certificateTemplateService.ts` in `lib/`
3. Update `certificateService.ts` to fetch from DB
4. Update `certificateHTMLGenerator.ts` to accept objects
5. Create admin page: `AdminCertificateTemplates.tsx`
6. Test with existing certificate
7. Add sample templates
8. Deploy and monitor

**Estimated time**: 3-4 hours of focused development

---

## 📝 Notes for Next Session

- **Starting point**: This implementation plan + analysis documents
- **Database ready**: Migrations file structure prepared
- **Sample templates**: Plan to create 2-3 additional templates
- **Admin UI**: Focus on UX/simplicity, not fancy features
- **Testing**: Comprehensive before deployment

---

*This plan is flexible and can be adjusted based on requirements discovered during implementation.*
