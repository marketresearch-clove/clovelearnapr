# Current Certificate Template Preview
**Template Name**: Clove Standard Certificate
**File**: `public/certificate.html`
**Design Date**: Current
**Status**: Production

---

## 🎨 Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: CLOVE | TECHNOLOGIES                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  LEFT PANEL (33%)           │    RIGHT PANEL (67%)              │
│  ─────────────────          │    ─────────────────              │
│                             │                                    │
│  [Geometric Grid]           │    ☆ (decorative circle)          │
│  ┌─┬─┬─┬─┐                  │    ⟲⟲⟲⟲⟲                        │
│  ├─┼─┼─┼─┤ Colors:         │                                    │
│  ├─┼─┼─┼─┤ ■ Teal          │    🎓 Certificate                 │
│  ├─┼─┼─┼─┤ ■ Orange        │       Of Completion               │
│  └─┴─┴─┴─┘ ■ Yellow        │                                    │
│                             │    Certificate ID: [ID]           │
│  [Vertical Text]            │    ─────────────────────          │
│  "Clove                      │                                    │
│   Learning                  │    is awarded to                  │
│   Portal"                   │                                    │
│                             │    ✨ USER NAME                   │
│  "Skills &                  │                                    │
│   Professional              │    For Completion of the          │
│   Training"                 │    COURSE TITLE                   │
│                             │                                    │
│                             │    Grade: Qualified               │
│                             │                                    │
│                             │    [Date of Issue: DD MMM, YYYY]  │
│                             │                                    │
│                             │    [Signature 1]  [Signature 2]   │
│                             │     Name 1         Name 2         │
│                             │     Title 1        Title 2        │
│                             │                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Content Areas

### Header
- **Company Name**: CLOVE
- **Subtitle**: TECHNOLOGIES
- **Font**: Bold, Dark Teal
- **Size**: 2xl (responsive)

### Left Panel (Geometric Design)
- **Background**: Alternating grid of colors
- **Colors Used**:
  - Primary Teal: `#0F3D47`
  - Accent Orange: `#E29562`
  - Accent Light: `#F2D597`
  - Off-white: `#F3F1E7`
- **Vertical Text**: "Clove Learning Portal"
- **Subtitle**: "Skills & Professional Training"
- **Orientation**: Text rotated 90° (right-side reading)

### Right Panel (Certificate Content)
- **Background**: Subtle radial gradient with pattern
- **Decoration**:
  - Large scalloped circle (top-right) with star icon
  - Geometric shapes (bottom-right, triangles/blocks)

### Main Certificate Content
```
┌─ MAIN HEADING ─────────────────────┐
│                                     │
│  Certificate                        │
│  Of Completion                      │
│                                     │
│  Certificate ID: [Dynamic ID]      │
│  ─────────────────────────────────  │
│                                     │
│  is awarded to                      │
│                                     │
│  ✨ [USER NAME]                    │ ← Accent Orange, Large (4xl-5xl)
│                                     │
│  For Completion of the              │
│  [COURSE TITLE]                     │ ← Bold Primary Color
│                                     │
│  Grade: [GRADE TEXT]                │ ← Dynamic (e.g., "Qualified")
│                                     │
│  ┌────────────────────────┐         │
│  │ Date of Issue: [DATE]  │         │ ← Highlighted box, Accent color
│  └────────────────────────┘         │
│                                     │
└─────────────────────────────────────┘
```

---

## 🖊️ Signature Section (Dynamic)

```
╔════════════════════════════════════════════════╗
║ Signatures - Generated from Database           ║
║ (certificate_signature_settings table)         ║
╚════════════════════════════════════════════════╝

┌─ Layout: Flex Container ─────────────────────┐
│                                               │
│  [Sig 1]          [Sig 2]         [Sig 3]    │
│  ─────             ─────            ─────    │
│  Name 1            Name 2          Name 3    │
│  Title 1           Title 2         Title 3   │
│                                               │
│  Each Signature:                             │
│  • Image OR cursive text                     │
│  • Horizontal line (underline)               │
│  • Name (font-weight: bold)                  │
│  • Designation (smaller, gray)              │
│                                               │
│  Number of signatures: Dynamic based on      │
│  enabled entries in certificate_signature_   │
│  settings where is_enabled = true            │
│                                               │
└──────────────────────────────────────────────┘
```

---

## 📐 Responsive Breakpoints

### Desktop (md and above)
- Left panel: 33% width
- Right panel: 67% width
- Font sizes: max (text-6xl for heading)
- Padding: p-16 on content area
- Signature section: Horizontal flex

### Tablet/Mobile (sm - md)
- Left panel: 100% -> 33% (stacked then side-by-side)
- Right panel: 100%
- Font sizes: reduced (text-5xl for heading)
- Padding: p-6 to p-8
- Signature section: Horizontal but reduced gaps

### Mobile (< sm)
- Full width layout
- Signatures stack vertically
- Reduced padding and font sizes
- Decoration elements hidden (`hidden sm:block`)

---

## 🔤 Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Main Heading | Space Grotesk | 5xl/6xl | Bold | Primary (#0F3D47) |
| User Name | Space Grotesk | 4xl/5xl | Bold | Accent (#E29562) |
| Course Title | Inter | xl | Bold | Primary (#0F3D47) |
| Labels | Inter | lg | Regular | Gray-700 |
| Grade | Inter | lg | Bold | Primary (#0F3D47) |
| Date Box | Inter | lg | Medium | White on Accent |
| Signature Name | Inter | sm | Bold | Primary (#0F3D47) |
| Signature Title | Inter | sm | Bold | Black |
| Signature Image | Cursive | 4xl | N/A | Gray-800 |

---

## 🎨 Color Palette

```
PRIMARY (Teal):      #0F3D47
├─ Used for: Main headings, borders, text
├─ RGB: rgb(15, 61, 71)
└─ Tailwind: text-primary, bg-primary

ACCENT (Orange):     #E29562
├─ Used for: User name, date box background
├─ RGB: rgb(226, 149, 98)
└─ Tailwind: text-accent, bg-accent

ACCENT-LIGHT (Yellow): #F2D597
├─ Used for: Accent blocks, decorative shapes
├─ RGB: rgb(242, 213, 151)
└─ Tailwind: text-accent-light, bg-accent-light

BACKGROUND (Cream):  #F3F1E7
├─ Used for: Main background
├─ RGB: rgb(243, 241, 231)
└─ Tailwind: bg-background-light

GRAY-700:            Gray text
GRAY-600:            Lighter gray text
GRAY-400/500:        Lines and borders
```

---

## 🖼️ Decorative Elements

### Top-Right Circle
```css
/* Large scalloped circle with star icon */
width: 128px (8rem)
height: 128px (8rem)
background: Accent Orange (#E29562)
clip-path: scalloped polygon (custom)
border: 4px white/gray border
inner-circle: 2px white border
icon: Material Design "star" (white, 6xl)
shadow: drop-shadow
```

### Bottom-Right Shapes
```css
/* Grid of geometric shapes */
width: 192px (12rem)
height: 192px (12rem)
grid: 2x2
├─ Transparent block
├─ Accent-light with rounded top-left
├─ Primary color block
└─ Accent-light with rounded bottom-right

/* Triangle shape below */
width: 64px (4rem)
height: 64px (4rem)
shape: Downward triangle (CSS clip-path)
background: Accent-light (#F2D597)
position: 32px from right
```

---

## 📄 Current Placeholders (Hardcoded)

| Placeholder | Location | Replacement | Type |
|-------------|----------|-------------|------|
| `Yuva Subharam` | Line 126 | User full name | String |
| `Risk Management from Daily Life to Business` | Line 131 | Course title | String |
| `07 September, 2023` | Line 140 | Issue date | Date |
| `XXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | Line 121 | Certificate ID | UUID |
| `Qualified` | Line 136 | Grade (optional) | String |
| Signature blocks | Lines 142-160 | Signature section | Dynamic HTML |

---

## 🔄 How It's Currently Generated

### In `certificateHTMLGenerator.ts`
```typescript
let html = baseTemplate; // Load certificate.html

// String replacements
html = html.replace(/Yuva Subharam/g, data.userName);
html = html.replace(/Risk Management from Daily Life to Business/g, data.courseTitle);
html = html.replace(/07 September, 2023/g, data.issueDate);
html = html.replace(/XXXXXXXXXXXXXXXXXXXXXXXXXXXXX/g, data.certificateId);

// Signature replacement
const signatureHTML = generateSignatureSectionHTML(signatures);
html = html.replace(oldSignaturePattern, signatureHTML);

return html;
```

### Dynamic Signature Generation
```typescript
// For each enabled signature:
<div style="flex: 1; text-align: center; padding: 0 20px;">
  <div style="margin-bottom: 20px;">
    <!-- Image or cursive text -->
  </div>
  <div style="border-top: 2px solid #333; padding-top: 10px;">
    <div style="font-weight: bold;">${sig.name}</div>
    <div style="font-size: 12px; color: #666;">${sig.designation}</div>
  </div>
</div>
```

---

## 📱 Mobile Responsive Features

- **Hidden on mobile** (< sm):
  - Decorative circle (top-right)
  - Grid pattern doesn't scale

- **Layout adjustments**:
  - Left panel: Falls below on small screens
  - Right panel: Full width on mobile
  - Text sizes: Reduced but readable
  - Signature section: Flex wraps or stacks

- **Print-friendly**:
  - Works with browser print dialog
  - All colors render in print
  - Responsive design maintains on paper

---

## ✅ Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires:
  - CSS Grid support
  - Flexbox support
  - Tailwind CSS framework
  - Google Fonts (Space Grotesk, Dancing Script, Inter)
  - Material Icons

---

## 🎯 Design Strengths

✅ **Modern & Professional**: Clean geometric design with professional color scheme
✅ **Branded**: Incorporates company branding (Clove Technologies)
✅ **Flexible**: Dynamic signatures and user content
✅ **Responsive**: Works on all device sizes
✅ **Print-Ready**: Optimized for PDF generation and printing
✅ **Accessible**: Good contrast ratios, readable fonts
✅ **Fast**: Static HTML, minimal dependencies

---

## ⚠️ Current Limitations

❌ **Single Template Only**: No alternative designs
❌ **Static HTML**: Difficult to create new templates without code changes
❌ **Hardcoded Placeholders**: Relies on specific string matching
❌ **No Admin UI**: Can't manage templates without developer access
❌ **No Preview**: Can't see templates before issuing certificates
❌ **No Customization**: Company colors/branding can't be changed easily

---

## 📋 Sample Data for Testing

```javascript
{
  userName: "John Smith",
  courseTitle: "Advanced Project Management",
  issueDate: "15 April, 2026",
  certificateId: "CERT-2026-04-15-001",
  userEmail: "john.smith@company.com",
  userDepartment: "Product Development",
  grade: "Distinction",
  signatures: [
    {
      id: "sig-1",
      name: "Jane Director",
      designation: "Chief Learning Officer",
      signature_image_url: "https://...",
      is_enabled: true
    },
    {
      id: "sig-2",
      name: "Bob Manager",
      designation: "HR Director",
      signature_text: "Bob Manager",
      is_enabled: true
    }
  ]
}
```

---

## 🚀 Next Template Ideas (To Be Created)

### 1. Classic Professional
- Borders and ornamental elements
- Traditional serif fonts
- Gold and navy blue colors
- Suitable for formal credentials

### 2. Modern Minimal
- Ultra-clean design
- Sans-serif typography only
- Single accent color
- Flat design, no decorative elements

### 3. Tech-Focused
- Glassmorphism design
- Gradient backgrounds
- Code-like elements
- Modern tech company aesthetic

### 4. Corporate Custom
- Customizable logo placement
- Company color override
- Flexible layout
- Signature field customization

---

## 📞 Support

For questions about the current template or to request design changes, refer to:
- **Design file**: `public/certificate.html`
- **Generator**: `lib/certificateHTMLGenerator.ts`
- **Service**: `lib/certificateService.ts`
- **Signatures**: `lib/certificateSignatureService.ts`
