# User Management V2 - Implementation Guide

## Overview
User Management V2 is an enhanced version of the original User Management page with a modern tab-based design, column visibility controls, and improved UX.

## Features

### 1. Tab Navigation System
Three main tabs accessible from the top of the page:

#### Tab 1: Users
- **User Table Display**: Shows all users with selected columns
- **Search Functionality**: Search by name, email, or employee ID
- **Column Manager**: Toggle column visibility with a dropdown
- **Stats Grid**: Quick view of total users, active users, learners, and managers
- **Actions**: Export users, add new users, or access bulk import
- **Column Support**: 
  - Always visible: Full Name, Email, Employee ID, Role, Status
  - Optional: Department, Designation, Manager, Company, Employment Type, Location

#### Tab 2: Add New User
- **Form-based user creation** with organized sections:
  - **Basic Information**: Full Name, Email, Employee ID, Mobile Number
  - **Role & Status**: User Role, Account Status (Active/Inactive/Pending)
  - **Organization Information**: Company, Department, Designation, Employment Type, Location
- **Form submission**: Create user and return to users list on success
- **Validation**: Required fields marked with asterisk (*)
- **Cancel/Clear options**: Easy navigation back to users list

#### Tab 3: Bulk Import
- **Bulk Add Users**: Import multiple users from Excel in one operation
- **Manager Mapping**: Update manager assignments in bulk
- **Bulk Update**: Modify specific fields for multiple users
- **User Dump Export**: Extract all user data as CSV for backup/analysis
- **Template Downloads**: Available for each bulk operation type

### 2. Column Visibility Management
Located in the Users tab toolbar:

**Features:**
- Toggle visibility of 11 columns
- Persistent across session (can be enhanced with localStorage)
- Dropdown UI with checkboxes
- Organized grid layout (2-4 columns based on screen size)
- Quick enable/disable without page reload

**Available Columns:**
1. Full Name (visible by default)
2. Email (visible by default)
3. Employee ID (visible by default)
4. Role (visible by default)
5. Status (visible by default)
6. Department (optional)
7. Designation (optional)
8. Manager (optional)
9. Company (hidden by default)
10. Employment Type (hidden by default)
11. Location (hidden by default)

### 3. Data Display Enhancements

#### User Table Formatting
- **Status Indicator**: Color-coded badges for active/inactive/pending users
- **Role Badges**: Color-coded role indicators (learner, manager, admin, instructor)
- **Interactive Rows**: Hover effects for better UX
- **View Action**: Quick access to user details

#### Stats Summary
- Total Users: Overall count
- Active Users: Filtered by status
- Learners: Filtered by role
- Managers: Filtered by role

### 4. All Original Functionalities Preserved

#### From UserAdminPage.tsx
✅ Extract User Dump (CSV export)
✅ Bulk Add Users (Excel import)
✅ Bulk Manager Mapping
✅ Bulk Update (specific fields)
✅ Excel template downloads
✅ File validation
✅ Error handling with user feedback
✅ Success notifications

## Technical Implementation

### State Management
```typescript
- activeTab: Current active tab ('users' | 'add-user' | 'bulk-import')
- users: Array of user objects
- loading: Loading state for async operations
- error: Error messages
- success: Success messages
- formData: Current form state
- columns: Column configuration with visibility
- searchTerm: Search input
- showColumnManager: Column manager visibility
```

### Database Integration
- Uses Supabase for all operations
- Profile table for user data storage
- CRUD operations for users
- CSV/Excel file processing with XLSX library

### Key Functions
- `fetchUsers()`: Load all users from database
- `handleAddUser()`: Create new user
- `handleBulkAddUsers()`: Import multiple users
- `handleBulkManagerMapping()`: Update manager assignments
- `handleBulkUpdate()`: Update specific fields
- `handleExtractUserDump()`: Export all users to CSV
- `toggleColumnVisibility()`: Toggle column visibility
- `switchTab()`: Change active tab

## Installation & Usage

### 1. Add Route to App.tsx
✅ Already added:
```typescript
import UserManagementV2Page from './pages/UserManagementV2Page';

<Route path="/admin/user-management-v2" element={
  <ProtectedRoute roles={['admin', 'instructor']}>
    <UserManagementV2Page />
  </ProtectedRoute>
} />
```

### 2. Add Sidebar Navigation
✅ Already added to AdminSidebar.tsx:
```typescript
{ path: '/admin/user-management-v2', label: 'User Management V2', icon: 'person_check' }
```

### 3. Access the Page
Navigate to: `http://[app]/admin/user-management-v2`

## Column Management Implementation

### Default Column Configuration
```typescript
baseColumns: [
  { id: 'fullname', label: 'Full Name', visible: true },
  { id: 'email', label: 'Email', visible: true },
  { id: 'user_id', label: 'Employee ID', visible: true },
  { id: 'role', label: 'Role', visible: true },
  { id: 'user_status', label: 'Status', visible: true },
  { id: 'department', label: 'Department', visible: true },
  { id: 'designation', label: 'Designation', visible: true },
  { id: 'manager_name', label: 'Manager', visible: true },
  { id: 'company', label: 'Company', visible: false },
  { id: 'employment_type', label: 'Employment Type', visible: false },
  { id: 'location', label: 'Location', visible: false },
]
```

### Toggle Function
```typescript
const toggleColumnVisibility = (columnId: string) => {
  setColumns(cols =>
    cols.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    )
  );
};
```

### Render Logic
```typescript
const visibleColumns = columns.filter(col => col.visible);

// In table header and body:
{visibleColumns.map(column => (
  // Render only visible columns
))}
```

## Improvements Over Original

| Feature | Original | V2 | Benefit |
|---------|----------|----|---------| 
| Layout | Card-based | Tab-based | Better organization |
| Search | Not available | Available | Find users quickly |
| Columns | Fixed | Configurable | Custom views |
| Stats | Not visible | Dashboard | Quick insights |
| UI/UX | Basic | Modern, polished | Professional appearance |
| Form | Unknown | Organized sections | Better UX |
| Responsiveness | Standard | Enhanced | Better mobile support |

## Future Enhancements

1. **Persistent Column Preferences**
   - Save to localStorage
   - Load on page revisit

2. **Advanced Filtering**
   - Filter by status, role, department
   - Multi-select filters

3. **Bulk Actions from Table**
   - Select multiple users
   - Delete, deactivate, assign roles

4. **User Detail Modal**
   - View/edit individual user details
   - Without full page navigation

5. **Column Grouping**
   - Group related fields (Organization, Personal, etc.)
   - Collapsible sections

6. **Export Customization**
   - Choose columns to export
   - Filter data before export

7. **Data Sorting**
   - Click column headers to sort
   - Multi-column sort

8. **Pagination/Virtual Scrolling**
   - For large datasets
   - Better performance

## Error Handling

- **File Upload Errors**: Validates file format and size
- **Database Errors**: Caught and displayed to user
- **Validation Errors**: Required fields highlighted
- **Success Confirmations**: User feedback on completion

## Security Considerations

✅ ProtectedRoute with role-based access
✅ Admin/Instructor roles required
✅ Supabase RLS policies enforced
✅ CSV export available to admins only

## Notes

- All user data operations are real-time
- Changes reflect immediately in the table
- Compatible with existing system architecture
- No conflicts with original User Management page
- Both pages can coexist for gradual migration
