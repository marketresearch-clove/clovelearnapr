# Organization Hierarchy Feature - Implementation Guide

## Overview
Created a comprehensive organizational hierarchy dashboard that displays users' positions in the organization through visual card-based layouts. The feature clearly shows the learner's position relative to their manager, peers, and direct reports.

## Components Created

### 1. **Migration File**
**File:** `sql/MIGRATION_ADD_EMPLOYEE_GRADE_JOB_TITLE.sql`

Adds three new columns to the profiles table:
- `employee_grade` (TEXT) - Employee level (e.g., Junior, Senior, Lead, Manager)
- `job_title` (TEXT) - Job title or role
- `office_location` (TEXT) - Office location or work site

Creates an index on `manager_id` for efficient hierarchy lookups.

**To apply migration:**
```sql
-- Run via Supabase SQL editor or migration runner
-- This adds the necessary columns for organizational tracking
```

### 2. **OrganizationHierarchy Component**
**File:** `components/OrganizationHierarchy.tsx`

Main component that fetches and displays organizational structure:

**Features:**
- Fetches user's manager, peers, direct reports, and organization path
- Displays hierarchical structure in organized card layouts
- Shows avatar, name, email, job title, grade, department, and location
- Responsive grid layout
- Loading and error states
- Empty state messaging

**Key Functions:**
```typescript
fetchHierarchyData() - Fetches all hierarchy data from Supabase
- Current user profile
- Manager information (if exists)
- Peers (colleagues under same manager)
- Direct reports (team members)
- Organization path (manager → current user)
```

**Props:**
- `userId: string` - The user ID to display hierarchy for

### 3. **Styling**
**File:** `styles/OrganizationHierarchy.css`

Professional styling featuring:
- Card-based design with hover effects
- Color-coded sections (managers, peers, team)
- Responsive grid layouts
- Animation transitions
- Mobile-optimized layout
- Gradient backgrounds for visual hierarchy

**Color Scheme:**
- **Manager:** Amber/Gold (#f59e0b)
- **Current User:** Green (#10b981)
- **Peers:** Purple (#8b5cf6)
- **Team Members:** Pink (#ec4899)

### 4. **Organization Hierarchy Page**
**File:** `pages/OrganizationHierarchyPage.tsx`

Full-page component featuring:
- Sidebar and Header integration
- Main hierarchy component
- Help section with explanations
- Authentication guard
- Professional layout

**Route:** `/hierarchy`

## Database Schema Changes

### Updated `profiles` Table
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_grade TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS office_location TEXT;
```

### Existing Columns Used
- `id` - User ID
- `first_name`, `last_name`, `email` - User identity
- `manager_id` - References manager's profile (self-referential)
- `department` - Department information
- `role` - User role in system
- `avatar_url` - User profile picture

## User Interface Sections

### 1. **Organization Path Breadcrumb**
Visual chain showing the user's position in the organization:
- Manager → Current User
- Shows hierarchy level with indicators

### 2. **Manager Card** (If exists)
Shows direct manager information:
- Avatar, name, email
- Job title and grade
- Department and location

### 3. **Your Profile Card** (Current User)
Highlighted card showing:
- Complete profile information
- User's role in system
- Position in organization

### 4. **Peers Section** (If exists)
Grid of colleagues under the same manager:
- Shows all peers with their information
- Enables team connectivity

### 5. **Team Section** (If user manages others)
Grid of direct reports:
- Shows all team members
- Displays their information and positions
- Enables team management overview

## Integration Points

### Updated Files:
1. **app.tsx**
   - Added import for `OrganizationHierarchyPage`
   - Added route: `<Route path="/hierarchy" element={<ProtectedRoute><OrganizationHierarchyPage /></ProtectedRoute>} />`

2. **components/Sidebar.tsx**
   - Added menu item: `{ name: 'Organization', icon: 'org_chart', path: '/hierarchy' }`
   - Now appears in navigation menu with org_chart icon

## Data Flow

```
User Navigates to /hierarchy
        ↓
OrganizationHierarchyPage Renders
        ↓
OrganizationHierarchy Component Mounts
        ↓
fetchHierarchyData() Executes:
  1. Get current user profile → profiles table
  2. Get manager (if manager_id exists) → profiles table
  3. Get peers (same manager_id, different user)
  4. Get direct reports (their manager_id = current user)
  5. Build organization path (manager chain)
        ↓
Display in Card Layout with Styling
```

## Usage Instructions

### For Users:
1. Click "Organization" in sidebar menu
2. View your position in the organization
3. See manager, team members, and peers
4. Connect and collaborate with team

### For Administrators:
1. Set up organizational structure in User Management
2. Assign manager_id to users (creating relationships)
3. Set employee_grade and job_title for all users
4. Verify hierarchy displays correctly

### Sample Data Setup:
```sql
-- CEO (no manager)
UPDATE profiles SET 
  manager_id = NULL,
  job_title = 'Chief Executive Officer',
  employee_grade = 'Executive',
  department = 'Executive'
WHERE id = 'ceo-uuid';

-- Manager under CEO
UPDATE profiles SET 
  manager_id = 'ceo-uuid',
  job_title = 'Director of Engineering',
  employee_grade = 'Senior',
  department = 'Engineering'
WHERE id = 'director-uuid';

-- Team member under Director
UPDATE profiles SET 
  manager_id = 'director-uuid',
  job_title = 'Senior Developer',
  employee_grade = 'Senior',
  department = 'Engineering'
WHERE id = 'developer-uuid';
```

## Features Highlights

✅ **Hierarchical Visualization** - Clear card-based structure
✅ **Multiple Views** - Manager, peers, team in organized sections
✅ **Responsive Design** - Works on desktop and mobile
✅ **Rich Information** - Displays all relevant user and organizational data
✅ **Empty States** - Helpful messaging when hierarchy incomplete
✅ **Performance Optimized** - Efficient database queries with indexing
✅ **Error Handling** - Graceful error states and loading indicators
✅ **Accessibility** - Material icons and semantic HTML
✅ **Professional Styling** - Modern card design with animations
✅ **Authentication** - Protected route with role-based access

## Testing Checklist

- [ ] Test with user having manager and team
- [ ] Test with user having only manager (no team)
- [ ] Test with user having no manager
- [ ] Test with CEO-level user (no manager, has team)
- [ ] Verify responsive design on mobile
- [ ] Test loading states
- [ ] Test error handling
- [ ] Verify sidebar menu item appears
- [ ] Test navigation to hierarchy page
- [ ] Verify all user information displays correctly
- [ ] Test with missing profile data
- [ ] Verify animations smooth
- [ ] Test on different browsers

## Future Enhancements

Potential additions:
1. **Org Chart Visualization** - Tree/flowchart style view
2. **Search & Filter** - Find users in hierarchy
3. **Direct Messaging** - Quick chat with team members
4. **Learning Analytics** - Team performance dashboard
5. **Team Goals** - Collaborative learning objectives
6. **Skills Matrix** - Team skills visualization
7. **Export** - Download hierarchy as PDF/image
8. **Bulk Actions** - Assign courses to team
9. **Historical View** - Track organizational changes
10. **Custom Roles** - Extend beyond manager/peer/report

## Troubleshooting

**Hierarchy not displaying:**
- Verify manager_id is set correctly in profiles
- Check employee_grade and job_title are populated
- Clear browser cache and reload
- Verify user has necessary permissions

**Missing sections:**
- Manager section: Verify manager_id is set
- Peers section: Verify other users share same manager_id
- Team section: Verify users have current user as manager_id

**Styling issues:**
- Ensure styles/OrganizationHierarchy.css is properly imported
- Check Material Icons are loaded in HTML head
- Verify Tailwind CSS is configured in project

## Files Summary

| File | Type | Purpose |
|------|------|---------|
| `sql/MIGRATION_ADD_EMPLOYEE_GRADE_JOB_TITLE.sql` | SQL | Database schema updates |
| `components/OrganizationHierarchy.tsx` | React | Main hierarchy component |
| `styles/OrganizationHierarchy.css` | CSS | Component styling |
| `pages/OrganizationHierarchyPage.tsx` | React | Full page container |
| `app.tsx` | React | Route registration |
| `components/Sidebar.tsx` | React | Navigation menu |

---

**Created:** April 5, 2026
**Feature:** Organization Hierarchy Dashboard
**Status:** Ready for Integration & Testing
