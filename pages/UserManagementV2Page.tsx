import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiSearch, FiUserPlus, FiUpload, FiDownload, FiFileText, FiUsers,
    FiFilter, FiEye, FiEyeOff, FiX, FiChevronDown, FiEdit2, FiTrash2, FiPause, FiPlay
} from 'react-icons/fi';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface User {
    id: string;
    fullname: string;
    email: string;
    user_id: string;
    role: string;
    user_status: string;
    mobile_number?: string;
    preferred_language?: string;
    allowed_views?: string;
    company?: string;
    department?: string;
    designation?: string;
    employment_type?: string;
    industry?: string;
    leadership_role?: string;
    LinkedInPartnerAccess?: string;
    linkedin_profile_url?: string;
    location?: string;
    manager_name?: string;
    persona?: string;
    team?: string;
    employee_grade?: string;
    created_at?: string;
    [key: string]: any;
}

interface ColumnConfig {
    id: string;
    label: string;
    visible: boolean;
}

// Predefined departments list
const DEPARTMENTS = [
    'AI & Innovation Labs',
    'Admin',
    'Architectural',
    'Arch Illus',
    'BIM Consulting',
    'BIM Engineering',
    'Built Design 2D',
    'Built Design 3D',
    'Business Development',
    'CAD',
    'CAD 2 BIM',
    'CAD Drafting',
    'Client Engagement',
    'Client Management',
    'Clove Build',
    'Data Acquisition',
    'Data Processing',
    'Development',
    'Digital Construction',
    'Finance',
    'Finance & Accounts',
    'GIS',
    'Human Resources',
    'IT Support',
    'MEP',
    'Management',
    'Marketing',
    'Patent Illustration',
    'Pre - Sales',
    'Quality Management',
    'Sales',
    'Scan 2 BIM',
    'Solution Engineering Hub',
    'Steel Detailing',
    'Structural',
    'Unit Head',
    'VMS',
    'Vendor Management'
];

const UserManagementV2Page = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'users' | 'add-user' | 'bulk-import' | 'bulk-mapping'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [managers, setManagers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showColumnManager, setShowColumnManager] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Bulk mapping states
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [showNewDepartmentInput, setShowNewDepartmentInput] = useState(false);
    const [newDepartment, setNewDepartment] = useState('');
    const [bulkMappingData, setBulkMappingData] = useState({
        department: '',
        employee_grade: '',
        manager_name: '',
        company_name: '',
        location: '',
        industry: '',
    });
    const [bulkMappingSearch, setBulkMappingSearch] = useState('');
    const [bulkMappingFilters, setBulkMappingFilters] = useState({
        department: '',
        employee_grade: '',
        role: '',
        manager_name: '',
        company_name: '',
        location: '',
        industry: '',
    });
    const [bulkMappingPage, setBulkMappingPage] = useState(1);
    const [bulkMappingItemsPerPage, setBulkMappingItemsPerPage] = useState(10);

    // Bulk import preview state
    const [showBulkImportPreview, setShowBulkImportPreview] = useState(false);
    const [bulkImportPreviewData, setBulkImportPreviewData] = useState<any[]>([]);
    const [bulkImportEditedData, setBulkImportEditedData] = useState<any[]>([]);
    const [pendingBulkImportFile, setPendingBulkImportFile] = useState<React.ChangeEvent<HTMLInputElement> | null>(null);
    const [previewSearchTerm, setPreviewSearchTerm] = useState('');
    const [previewFilters, setPreviewFilters] = useState({
        department: '',
        employee_grade: '',
        designation: '',
    });

    // Filters state
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    const [companyFilter, setCompanyFilter] = useState<string>('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Reset page on search or filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, statusFilter, departmentFilter, companyFilter, itemsPerPage]);

    // Reset bulk mapping page on search or filter change
    useEffect(() => {
        setBulkMappingPage(1);
    }, [bulkMappingSearch, bulkMappingFilters, bulkMappingItemsPerPage]);

    // Form states
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        password: '',
        user_id: '',
        mobile_number: '',
        user_status: 'Active',
        preferred_language: 'English',
        allowed_views: 'default',
        company: '',
        department: '',
        designation: '',
        employment_type: 'Full-time',
        industry: '',
        leadership_role: '',
        LinkedInPartnerAccess: 'No',
        linkedin_profile_url: '',
        location: '',
        role: 'learner',
        manager_name: '',
        persona: '',
        team: '',
        employee_grade: '',
    });
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Column configuration
    const baseColumns: ColumnConfig[] = [
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
        { id: 'mobile_number', label: 'Mobile Number', visible: false },
        { id: 'preferred_language', label: 'Preferred Language', visible: false },
        { id: 'allowed_views', label: 'Allowed Views', visible: false },
        { id: 'industry', label: 'Industry', visible: false },
        { id: 'leadership_role', label: 'Leadership Role', visible: false },
        { id: 'LinkedInPartnerAccess', label: 'LinkedIn Partner Access', visible: false },
        { id: 'linkedin_profile_url', label: 'LinkedIn Profile', visible: false },
        { id: 'persona', label: 'Persona', visible: false },
        { id: 'team', label: 'Team', visible: false },
        { id: 'employee_grade', label: 'Employee Grade', visible: false },
        { id: 'created_at', label: 'Created On', visible: false },
    ];

    const [columns, setColumns] = useState<ColumnConfig[]>(baseColumns);

    // Fetch users and managers on mount
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
        fetchManagers();
    }, [activeTab]);

    const fetchManagers = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('id, fullname, email')
                .order('fullname', { ascending: true });

            if (fetchError) throw fetchError;
            setManagers(data || []);
        } catch (err: any) {
            console.error('Error fetching managers:', err.message);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .limit(100);

            if (fetchError) throw fetchError;
            setUsers(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const allFilteredUsers = users.filter(user => {
        const matchesSearch = !searchTerm || (
            user.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.user_id?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.user_status === statusFilter;
        const matchesDepartment = !departmentFilter || user.department === departmentFilter;
        const matchesCompany = !companyFilter || user.company === companyFilter;

        return matchesSearch && matchesRole && matchesStatus && matchesDepartment && matchesCompany;
    });

    const totalPages = Math.ceil(allFilteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const filteredUsers = allFilteredUsers.slice(startIndex, startIndex + itemsPerPage);

    const visibleColumns = columns.filter(col => col.visible);

    // Get unique values for filters - use DEPARTMENTS constant instead of deriving from users
    const roles = Array.from(new Set(users.map(u => u.role).filter(Boolean)));
    const statuses = Array.from(new Set(users.map(u => u.user_status).filter(Boolean)));
    // const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));
    const companies = Array.from(new Set(users.map(u => u.company).filter(Boolean)));

    // Tab switching
    const switchTab = (tab: 'users' | 'add-user' | 'bulk-import') => {
        if (tab === 'add-user') {
            setShowAddUserModal(true);
        } else {
            setActiveTab(tab);
        }
    };

    const closeAddUserModal = () => {
        setShowAddUserModal(false);
        setShowPassword(false);
        setFormData({
            fullname: '',
            email: '',
            password: '',
            user_id: '',
            mobile_number: '',
            user_status: 'Active',
            preferred_language: 'English',
            allowed_views: 'default',
            company: '',
            department: '',
            designation: '',
            employment_type: 'Full-time',
            industry: '',
            leadership_role: '',
            LinkedInPartnerAccess: 'No',
            linkedin_profile_url: '',
            location: '',
            role: 'learner',
            manager_name: '',
            persona: '',
            team: '',
            employee_grade: '',
        });
    };

    const handleEditUser = (user: User) => {
        setEditingUserId(user.id);
        setFormData({
            fullname: user.fullname || '',
            email: user.email || '',
            user_id: user.user_id || '',
            mobile_number: user.mobile_number || '',
            user_status: user.user_status || 'Active',
            preferred_language: user.preferred_language || 'English',
            allowed_views: user.allowed_views || 'default',
            company: user.company || '',
            department: user.department || '',
            designation: user.designation || '',
            employment_type: user.employment_type || 'Full-time',
            industry: user.industry || '',
            leadership_role: user.leadership_role || '',
            LinkedInPartnerAccess: user.LinkedInPartnerAccess || 'No',
            linkedin_profile_url: user.linkedin_profile_url || '',
            location: user.location || '',
            role: user.role || 'learner',
            manager_name: user.manager_name || '',
            persona: user.persona || '',
            team: user.team || '',
            employee_grade: user.employee_grade || '',
        });
        setShowEditModal(true);
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditingUserId(null);
        setFormData({
            fullname: '',
            email: '',
            user_id: '',
            mobile_number: '',
            user_status: 'Active',
            preferred_language: 'English',
            allowed_views: 'default',
            company: '',
            department: '',
            designation: '',
            employment_type: 'Full-time',
            industry: '',
            leadership_role: '',
            LinkedInPartnerAccess: 'No',
            linkedin_profile_url: '',
            location: '',
            role: 'learner',
            manager_name: '',
            persona: '',
            team: '',
            employee_grade: '',
        });
    };

    // Form handlers
    // Helper function to convert to proper case (capitalize first letter of each word)
    const toProperCase = (str: string) => {
        return str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Helper function to format employee ID to uppercase
    const formatEmployeeId = (str: string) => {
        const cleaned = str.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
        if (!cleaned.includes('-')) {
            return `CLOVE-${cleaned}`;
        }
        return cleaned;
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let processedValue = value;

            // Format user_id to uppercase with CLOVE- prefix
            if (name === 'user_id') {
                processedValue = formatEmployeeId(value);
            }
            // Convert fullname to proper case
            else if (name === 'fullname') {
                processedValue = toProperCase(value);
            }
            // Convert designation to proper case
            else if (name === 'designation') {
                processedValue = toProperCase(value);
            }

            const updated = { ...prev, [name]: processedValue };
            // If user_id changes, update password to match
            if (name === 'user_id') {
                updated.password = processedValue;
            }
            return updated;
        });
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate required fields
            if (!formData.fullname?.trim()) {
                throw new Error('Full Name is required');
            }
            if (!formData.email?.trim()) {
                throw new Error('Email is required');
            }
            if (!formData.password?.trim()) {
                throw new Error('Password is required');
            }
            if (formData.password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            // Step 1: Create auth user with provided password
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email.trim(),
                password: formData.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                    data: {
                        fullname: formData.fullname,
                        role: formData.role || 'learner'
                    }
                }
            });

            if (authError || !authData.user) {
                throw new Error(`Auth user creation failed: ${authError?.message || 'Unknown error'}`);
            }

            const userId = authData.user.id;

            // Step 2: Insert profile with the auth user ID
            const profileData = {
                id: userId,  // Use the ID from auth.users
                fullname: formData.fullname,
                email: formData.email,
                user_id: formData.user_id || '',
                mobile_number: formData.mobile_number || '',
                user_status: formData.user_status || 'Active',
                preferred_language: formData.preferred_language || 'English',
                allowed_views: formData.allowed_views ? (typeof formData.allowed_views === 'string'
                    ? formData.allowed_views.split(',').map(v => v.trim())
                    : Array.isArray(formData.allowed_views) ? formData.allowed_views : [])
                    : [],
                company: formData.company || '',
                department: formData.department || '',
                designation: formData.designation || '',
                employment_type: formData.employment_type || 'Full-time',
                industry: formData.industry || '',
                leadership_role: formData.leadership_role || '',
                LinkedInPartnerAccess: formData.LinkedInPartnerAccess || 'No',
                linkedin_profile_url: formData.linkedin_profile_url || '',
                location: formData.location || '',
                role: formData.role || 'learner',
                manager_name: formData.manager_name || '',
                persona: formData.persona || '',
                team: formData.team || '',
                employee_grade: formData.employee_grade || '',
                created_at: new Date().toISOString(),
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .insert([profileData]);

            if (profileError) throw profileError;

            setSuccess('User created successfully!');
            closeAddUserModal();

            setTimeout(() => {
                setActiveTab('users');
                fetchUsers();
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUserId) return;

        setLoading(true);
        setError(null);

        try {
            // Map formData to database column names and convert types
            const updateData = {
                fullname: formData.fullname,
                email: formData.email,
                user_id: formData.user_id,
                mobile_number: formData.mobile_number,
                user_status: formData.user_status,
                preferred_language: formData.preferred_language,
                // Convert allowed_views from string to array
                allowed_views: formData.allowed_views
                    ? (typeof formData.allowed_views === 'string'
                        ? formData.allowed_views.split(',').map(v => v.trim())
                        : Array.isArray(formData.allowed_views) ? formData.allowed_views : [])
                    : [],
                company: formData.company,
                department: formData.department,
                designation: formData.designation,
                employment_type: formData.employment_type,
                industry: formData.industry,
                leadership_role: formData.leadership_role,
                LinkedInPartnerAccess: formData.LinkedInPartnerAccess,
                linkedin_profile_url: formData.linkedin_profile_url,
                location: formData.location,
                role: formData.role,
                manager_name: formData.manager_name,
                persona: formData.persona,
                team: formData.team,
                employee_grade: formData.employee_grade,
                updatedat: new Date().toISOString(),
            };

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', editingUserId);

            if (updateError) throw updateError;

            setSuccess('User updated successfully!');
            closeEditModal();

            setTimeout(() => {
                setActiveTab('users');
                fetchUsers();
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, userEmail: string) => {
        if (!window.confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: deleteError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (deleteError) throw deleteError;

            setSuccess(`User ${userEmail} deleted successfully`);
            fetchUsers();
        } catch (err: any) {
            setError(`Failed to delete user: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleUserSelection = (userId: string) => {
        const newSelected = new Set(selectedUserIds);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUserIds(newSelected);
    };

    const handleSelectAllUsers = () => {
        if (selectedUserIds.size === users.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(users.map(u => u.id)));
        }
    };

    const handleBulkMappingChange = (field: string, value: string) => {
        setBulkMappingData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleBulkMappingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedUserIds.size === 0) {
            setError('Please select at least one user');
            return;
        }

        if (!bulkMappingData.department && !bulkMappingData.employee_grade && !bulkMappingData.manager_name && !bulkMappingData.company_name && !bulkMappingData.location && !bulkMappingData.industry) {
            setError('Please fill in at least one field');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const updateData: any = {};

            if (bulkMappingData.department) updateData.department = bulkMappingData.department;
            if (bulkMappingData.employee_grade) updateData.employee_grade = bulkMappingData.employee_grade;
            if (bulkMappingData.manager_name) updateData.manager_name = bulkMappingData.manager_name;
            if (bulkMappingData.company_name) updateData.company = bulkMappingData.company_name;
            if (bulkMappingData.location) updateData.location = bulkMappingData.location;
            if (bulkMappingData.industry) updateData.industry = bulkMappingData.industry;

            for (const userId of selectedUserIds) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', userId);

                if (updateError) throw updateError;
            }

            setSuccess(`Successfully updated ${selectedUserIds.size} user(s)`);
            setSelectedUserIds(new Set());
            setBulkMappingData({
                department: '',
                employee_grade: '',
                manager_name: '',
                company_name: '',
                location: '',
                industry: '',
            });
            fetchUsers();
        } catch (err: any) {
            setError(`Failed to bulk update: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredBulkMappingUsers = () => {
        return users.filter(user => {
            // Search filter (name or email)
            const searchMatch = bulkMappingSearch === '' ||
                user.fullname.toLowerCase().includes(bulkMappingSearch.toLowerCase()) ||
                user.email.toLowerCase().includes(bulkMappingSearch.toLowerCase());

            // Department filter (exact match)
            const departmentMatch = bulkMappingFilters.department === '' ||
                (user.department || '') === bulkMappingFilters.department;

            // Employee grade filter - exact match for dropdown values
            const gradeMatch = bulkMappingFilters.employee_grade === '' ||
                (user.employee_grade || '') === bulkMappingFilters.employee_grade;

            // Role filter
            const roleMatch = bulkMappingFilters.role === '' ||
                user.role === bulkMappingFilters.role;

            // Manager filter
            const managerMatch = bulkMappingFilters.manager_name === '' ||
                (user.manager_name || '').toLowerCase().includes(bulkMappingFilters.manager_name.toLowerCase());

            return searchMatch && departmentMatch && gradeMatch && roleMatch && managerMatch;
        });
    };

    const getPaginatedBulkMappingUsers = () => {
        const filteredUsers = getFilteredBulkMappingUsers();
        const startIndex = (bulkMappingPage - 1) * bulkMappingItemsPerPage;
        const endIndex = startIndex + bulkMappingItemsPerPage;
        return {
            data: filteredUsers.slice(startIndex, endIndex),
            total: filteredUsers.length,
            pages: Math.ceil(filteredUsers.length / bulkMappingItemsPerPage)
        };
    };

    const handlePauseUser = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        const action = newStatus === 'Active' ? 'reactivate' : 'pause';

        if (!window.confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ user_status: newStatus })
                .eq('id', userId);

            if (updateError) throw updateError;

            setSuccess(`User ${action}d successfully`);
            fetchUsers();
        } catch (err: any) {
            setError(`Failed to update user: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Bulk operations
    const handleExtractUserDump = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*');

            if (fetchError) throw fetchError;

            if (!data || data.length === 0) {
                throw new Error('No users found to export');
            }

            const csv = convertToCSV(data);
            downloadCSV(csv, `user-dump-${new Date().toISOString().split('T')[0]}.csv`);
            setSuccess('User dump extracted successfully!');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const convertToCSV = (data: any[]) => {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');

        const csvRows = data.map(row =>
            headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return JSON.stringify(value);
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        );

        return [csvHeaders, ...csvRows].join('\n');
    };

    const downloadCSV = (csv: string, filename: string) => {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const downloadExcelTemplate = (templateType: 'bulk-add' | 'bulk-manager' | 'bulk-update') => {
        let data: any[] = [];
        let filename = '';

        if (templateType === 'bulk-add') {
            data = [
                {
                    email: 'yuvasubharam56@gmail.com',
                    fullname: 'Yuva Subharam',
                    user_id: 'CLOVE-0000',
                    mobile_number: '9876543210',
                    designation: 'Market Research Analyst',
                    employment_type: 'Full-Time',
                    leadership_role: 'Entry Level',
                    location: 'Visakhapatnam',
                    persona: 'Marketing Executive',
                    team: 'Pre-Sales',
                    employee_grade: 'E1',
                }
            ];
            filename = 'bulk-user-import-template.xlsx';
        } else if (templateType === 'bulk-manager') {
            data = [
                { userId: 'user-uuid', managerId: 'manager-uuid', managerType: 'direct' },
            ];
            filename = 'bulk-manager-mapping-template.xlsx';
        } else if (templateType === 'bulk-update') {
            data = [
                { email: 'user1@example.com', fullname: 'Updated Name', department: 'Updated Dept', allowed_views: 'View1,View2' },
            ];
            filename = 'bulk-update-template.xlsx';
        }

        const ws = XLSX.utils.json_to_sheet(data);

        // Add data validation dropdowns for bulk-add template
        if (templateType === 'bulk-add') {
            // Initialize dataValidation array if it doesn't exist
            if (!ws['!dataValidation']) {
                ws['!dataValidation'] = [];
            }

            // Employment Type validation (Column F - employment_type)
            ws['!dataValidation'].push({
                type: 'list',
                operator: undefined,
                formula1: '"Full-Time,Part-Time,Contract"',
                formula2: undefined,
                showDropDown: true,
                showErrorMessage: true,
                showInputMessage: true,
                errorMessage: 'Please select from: Full-Time, Part-Time, or Contract',
                promptTitle: 'Employment Type',
                sqref: 'F2:F1000'
            });

            // Location validation (Column H - location)
            ws['!dataValidation'].push({
                type: 'list',
                operator: undefined,
                formula1: '"Visakhapatnam,Hyderabad"',
                formula2: undefined,
                showDropDown: true,
                showErrorMessage: true,
                showInputMessage: true,
                errorMessage: 'Please select from: Visakhapatnam or Hyderabad',
                promptTitle: 'Location',
                sqref: 'H2:H1000'
            });

            // Employee Grade validation (Column K - employee_grade)
            ws['!dataValidation'].push({
                type: 'list',
                operator: undefined,
                formula1: '"C1,C2,D1,D2,D3,E1,E2,E3,G1,G2,H1,L1,L2,L3,M1,M2,M3,M4,T1,V1,V2,V3"',
                formula2: undefined,
                showDropDown: true,
                showErrorMessage: true,
                showInputMessage: true,
                errorMessage: 'Please select a valid employee grade',
                promptTitle: 'Employee Grade',
                sqref: 'K2:K1000'
            });
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');
        XLSX.writeFile(wb, filename);
    };

    const readExcelFile = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsBinaryString(file);
        });
    };

    const handleBulkAddUsers = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const rawData = await readExcelFile(file);

            if (!rawData || rawData.length === 0) {
                throw new Error('No data found in Excel file');
            }

            // Filter out password field (not in profiles table) and other invalid fields
            const validFields = [
                'fullname', 'email', 'user_id', 'mobile_number', 'user_status',
                'preferred_language', 'allowed_views', 'company', 'department',
                'designation', 'employment_type', 'industry', 'leadership_role',
                'LinkedInPartnerAccess', 'linkedin_profile_url', 'location',
                'role', 'manager_name', 'persona', 'team', 'employee_grade'
            ];

            // Clean data by removing invalid fields and setting defaults
            const cleanedData = rawData.map(row => {
                const cleanedRow: any = {};
                validFields.forEach(field => {
                    if (field in row && row[field] !== undefined && row[field] !== '') {
                        let fieldValue = row[field];

                        // Format user_id to uppercase with CLOVE- prefix
                        if (field === 'user_id') {
                            const cleaned = String(fieldValue).toUpperCase().replace(/[^A-Z0-9\-]/g, '');
                            fieldValue = cleaned.includes('-') ? cleaned : `CLOVE-${cleaned}`;
                        }
                        // Convert fullname to proper case
                        else if (field === 'fullname') {
                            fieldValue = String(fieldValue)
                                .toLowerCase()
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                        }
                        // Convert designation to proper case
                        else if (field === 'designation') {
                            fieldValue = String(fieldValue)
                                .toLowerCase()
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                        }
                        // Convert allowed_views from string to array
                        else if (field === 'allowed_views' && typeof fieldValue === 'string') {
                            fieldValue = fieldValue.split(',').map(v => v.trim());
                        }

                        cleanedRow[field] = fieldValue;
                    }
                });

                // Set defaults if not provided
                if (!cleanedRow.role) {
                    cleanedRow.role = 'learner';
                }
                if (!cleanedRow.user_status) {
                    cleanedRow.user_status = 'Active';
                }
                if (!cleanedRow.preferred_language) {
                    cleanedRow.preferred_language = 'English';
                }

                return cleanedRow;
            });

            // Show preview dialog
            setBulkImportPreviewData(cleanedData);
            setBulkImportEditedData(JSON.parse(JSON.stringify(cleanedData)));
            setPreviewSearchTerm('');
            setPreviewFilters({ department: '', employee_grade: '', designation: '' });
            setShowBulkImportPreview(true);
            setPendingBulkImportFile(event);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updatePreviewData = (index: number, field: string, value: any) => {
        const updated = [...bulkImportEditedData];
        updated[index] = { ...updated[index], [field]: value };
        setBulkImportEditedData(updated);
    };

    const getFilteredPreviewData = () => {
        let filtered = bulkImportEditedData;

        // Search filter
        if (previewSearchTerm.trim()) {
            const term = previewSearchTerm.toLowerCase();
            filtered = filtered.filter(user =>
                user.fullname?.toLowerCase().includes(term) ||
                user.email?.toLowerCase().includes(term) ||
                user.user_id?.toLowerCase().includes(term) ||
                user.designation?.toLowerCase().includes(term)
            );
        }

        // Department filter
        if (previewFilters.department) {
            filtered = filtered.filter(u => u.department === previewFilters.department);
        }

        // Employee grade filter
        if (previewFilters.employee_grade) {
            filtered = filtered.filter(u => u.employee_grade === previewFilters.employee_grade);
        }

        // Designation filter
        if (previewFilters.designation) {
            filtered = filtered.filter(u => u.designation === previewFilters.designation);
        }

        return filtered;
    };

    const confirmBulkImport = async () => {
        if (!bulkImportEditedData || bulkImportEditedData.length === 0) {
            setError('No data to import');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Create auth users and then insert profiles
            const authUsers = [];
            for (const user of bulkImportEditedData) {
                if (user.email && user.user_id) {
                    const password = user.user_id; // Use user_id as password

                    // Create auth user
                    const { data: authData, error: authError } = await supabase.auth.signUp({
                        email: user.email,
                        password: password
                    });

                    if (authError) {
                        console.warn(`Auth error for ${user.email}:`, authError.message);
                    } else if (authData.user) {
                        authUsers.push({
                            ...user,
                            id: authData.user.id // Use auth user id as profile id
                        });
                    }
                }
            }

            // Insert profile data (without password field)
            if (authUsers.length > 0) {
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert(authUsers);

                if (insertError) throw insertError;

                setSuccess(`Successfully added ${authUsers.length} users!`);
                setShowBulkImportPreview(false);
                setBulkImportPreviewData([]);
                setBulkImportEditedData([]);
            } else {
                throw new Error('Failed to create auth users');
            }

            setTimeout(() => {
                setActiveTab('users');
                fetchUsers();
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            if (pendingBulkImportFile?.target) {
                pendingBulkImportFile.target.value = '';
            }
        }
    };

    const handleBulkManagerMapping = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const data = await readExcelFile(file);

            if (!data || data.length === 0) {
                throw new Error('No data found in Excel file');
            }

            let updatedCount = 0;

            for (const row of data) {
                try {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({
                            manager_name: row.managerId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', row.userId);

                    if (updateError) throw updateError;
                    updatedCount++;
                } catch (err: any) {
                    console.error(`Error updating manager for user ${row.userId}:`, err);
                }
            }

            setSuccess(`Successfully updated manager mapping for ${updatedCount} users.`);
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            event.target.value = '';
        }
    };

    const handleBulkUpdate = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const data = await readExcelFile(file);

            if (!data || data.length === 0) {
                throw new Error('No data found in Excel file');
            }

            const allowedFields = ['fullname', 'department', 'role', 'designation', 'location'];
            let updatedCount = 0;

            for (const row of data) {
                try {
                    const email = row.email;
                    if (!email) {
                        console.warn('Row missing email, skipping');
                        continue;
                    }

                    const updateData: any = { updated_at: new Date().toISOString() };

                    for (const field of allowedFields) {
                        if (row[field] !== undefined && row[field] !== null) {
                            updateData[field] = row[field];
                        }
                    }

                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update(updateData)
                        .eq('email', email);

                    if (updateError) throw updateError;
                    updatedCount++;
                } catch (err: any) {
                    console.error(`Error updating user ${row.email}:`, err);
                }
            }

            setSuccess(`Successfully updated ${updatedCount} users.`);
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            event.target.value = '';
        }
    };

    const toggleColumnVisibility = (columnId: string) => {
        setColumns(cols =>
            cols.map(col =>
                col.id === columnId ? { ...col, visible: !col.visible } : col
            )
        );
    };

    return (
        <AdminLayout title="User Management V2">
            <div className="space-y-6">
                {/* Alert Messages */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                        <p className="text-red-800 font-medium flex items-center gap-2">
                            <span className="material-symbols-rounded text-lg">error</span>
                            {error}
                        </p>
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <p className="text-green-800 font-medium flex items-center gap-2">
                            <span className="material-symbols-rounded text-lg">check_circle</span>
                            {success}
                        </p>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex gap-8 border-b border-gray-200">
                    <button
                        onClick={() => switchTab('users')}
                        className={`pb-3 px-2 font-medium flex items-center gap-2 transition-colors ${activeTab === 'users'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FiUsers size={18} />
                        <span>Users</span>
                    </button>
                    <button
                        onClick={() => switchTab('add-user')}
                        className={`pb-3 px-2 font-medium flex items-center gap-2 transition-colors ${activeTab === 'add-user'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FiUserPlus size={18} />
                        <span>Add New User</span>
                    </button>
                    <button
                        onClick={() => switchTab('bulk-import')}
                        className={`pb-3 px-2 font-medium flex items-center gap-2 transition-colors ${activeTab === 'bulk-import'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FiUpload size={18} />
                        <span>Bulk Import</span>
                    </button>
                    <button
                        onClick={() => switchTab('bulk-mapping')}
                        className={`pb-3 px-2 font-medium flex items-center gap-2 transition-colors ${activeTab === 'bulk-mapping'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FiUsers size={18} />
                        <span>Bulk Mapping</span>
                    </button>
                </div>

                {/* TAB 1: Users Table */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-1 max-w-md">
                                <FiSearch className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 mr-2 border-r border-gray-200 pr-4">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Per Page</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={30}>30</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>

                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'border-gray-300 hover:bg-gray-50'
                                        }`}
                                    title="Toggle filters"
                                >
                                    <FiFilter size={18} />
                                    <span className="text-sm font-medium">Filters</span>
                                    {(roleFilter || statusFilter || departmentFilter || companyFilter) && (
                                        <span className="flex h-2 w-2 rounded-full bg-primary"></span>
                                    )}
                                </button>

                                <button
                                    onClick={() => setShowColumnManager(!showColumnManager)}
                                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    title="Manage visible columns"
                                >
                                    <FiEye size={18} />
                                    <span className="text-sm font-medium">Columns</span>
                                    <FiChevronDown size={16} />
                                </button>

                                <button
                                    onClick={handleExtractUserDump}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors font-medium"
                                >
                                    <FiDownload size={18} />
                                    <span className="text-sm font-medium">Export</span>
                                </button>

                                <button
                                    onClick={() => switchTab('add-user')}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                                >
                                    <FiUserPlus size={18} />
                                    <span className="text-sm font-medium">Add User</span>
                                </button>
                            </div>
                        </div>

                        {/* Filters Bar */}
                        {showFilters && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <FiFilter size={16} />
                                        Advanced Filters
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setRoleFilter('');
                                            setStatusFilter('');
                                            setDepartmentFilter('');
                                            setCompanyFilter('');
                                        }}
                                        className="text-sm text-primary hover:underline font-medium"
                                    >
                                        Clear All Filters
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Role</label>
                                        <select
                                            value={roleFilter}
                                            onChange={(e) => setRoleFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white"
                                        >
                                            <option value="">All Roles</option>
                                            {roles.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</label>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white"
                                        >
                                            <option value="">All Statuses</option>
                                            {statuses.map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Department</label>
                                        <select
                                            value={departmentFilter}
                                            onChange={(e) => setDepartmentFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white"
                                        >
                                            <option value="">All Departments</option>
                                            {DEPARTMENTS.map(dept => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Company</label>
                                        <select
                                            value={companyFilter}
                                            onChange={(e) => setCompanyFilter(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white"
                                        >
                                            <option value="">All Companies</option>
                                            {companies.map(comp => (
                                                <option key={comp} value={comp}>{comp}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Column Manager Dropdown */}
                        {showColumnManager && (
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-gray-900">Visible Columns</h3>
                                    <button
                                        onClick={() => setShowColumnManager(false)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <FiX size={18} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {columns.map(column => (
                                        <label
                                            key={column.id}
                                            className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={column.visible}
                                                onChange={() => toggleColumnVisibility(column.id)}
                                                className="rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm text-gray-700 select-none">{column.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 font-semibold mb-1">TOTAL USERS</p>
                                <h3 className="text-2xl font-bold text-gray-900">{users.length}</h3>
                                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                    <span className="material-symbols-rounded text-sm">trending_up</span>
                                    Updated today
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 font-semibold mb-1">ACTIVE USERS</p>
                                <h3 className="text-2xl font-bold text-gray-900">
                                    {users.filter(u => u.user_status === 'Active').length}
                                </h3>
                                <p className="text-xs text-gray-600 mt-2">Active accounts</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 font-semibold mb-1">LEARNERS</p>
                                <h3 className="text-2xl font-bold text-gray-900">
                                    {users.filter(u => u.role === 'learner').length}
                                </h3>
                                <p className="text-xs text-gray-600 mt-2">Role type</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 font-semibold mb-1">MANAGERS</p>
                                <h3 className="text-2xl font-bold text-gray-900">
                                    {users.filter(u => u.role === 'manager').length}
                                </h3>
                                <p className="text-xs text-gray-600 mt-2">Role type</p>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500">
                                    <div className="inline-block animate-spin">
                                        <span className="material-symbols-rounded text-4xl">hourglass_top</span>
                                    </div>
                                    <p className="mt-2">Loading users...</p>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <span className="material-symbols-rounded text-4xl block mb-2">people</span>
                                    <p>No users found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                {visibleColumns.map(column => (
                                                    <th
                                                        key={column.id}
                                                        className="px-6 py-3 text-left font-semibold text-gray-700"
                                                    >
                                                        {column.label}
                                                    </th>
                                                ))}
                                                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {filteredUsers.map(user => (
                                                <tr
                                                    key={user.id}
                                                    className="hover:bg-gray-50 transition-colors"
                                                >
                                                    {visibleColumns.map(column => (
                                                        <td
                                                            key={`${user.id}-${column.id}`}
                                                            className="px-6 py-4 text-gray-900"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {column.id === 'user_status' && (
                                                                    <>
                                                                        <span
                                                                            className={`w-2 h-2 rounded-full ${user[column.id] === 'Active'
                                                                                ? 'bg-green-500'
                                                                                : 'bg-gray-300'
                                                                                }`}
                                                                        />
                                                                    </>
                                                                )}
                                                                {column.id === 'role' ? (
                                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                                        {user[column.id]}
                                                                    </span>
                                                                ) : (
                                                                    user[column.id] || '-'
                                                                )}
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => handleEditUser(user)}
                                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                                title="Edit user"
                                                            >
                                                                <FiEdit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handlePauseUser(user.id, user.user_status)}
                                                                className="text-orange-600 hover:text-orange-800 transition-colors"
                                                                title={user.user_status === 'Active' ? 'Pause user' : 'Resume user'}
                                                            >
                                                                {user.user_status === 'Active' ? <FiPause size={18} /> : <FiPlay size={18} />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id, user.email)}
                                                                className="text-red-600 hover:text-red-800 transition-colors"
                                                                title="Delete user"
                                                            >
                                                                <FiTrash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination Controls */}
                            {!loading && allFilteredUsers.length > 0 && (
                                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                                    <div className="text-sm text-gray-600">
                                        Showing <span className="font-semibold text-gray-900">{Math.min(startIndex + 1, allFilteredUsers.length)}</span> to <span className="font-semibold text-gray-900">{Math.min(startIndex + itemsPerPage, allFilteredUsers.length)}</span> of <span className="font-semibold text-gray-900">{allFilteredUsers.length}</span> users
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-sm font-medium"
                                        >
                                            Previous
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {(() => {
                                                const pages = [];
                                                for (let i = 1; i <= totalPages; i++) {
                                                    if (
                                                        i === 1 ||
                                                        i === totalPages ||
                                                        (i >= currentPage - 1 && i <= currentPage + 1)
                                                    ) {
                                                        pages.push(
                                                            <button
                                                                key={i}
                                                                onClick={() => setCurrentPage(i)}
                                                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${currentPage === i
                                                                    ? 'bg-purple-600 text-white'
                                                                    : 'hover:bg-gray-200 text-gray-600'
                                                                    }`}
                                                            >
                                                                {i}
                                                            </button>
                                                        );
                                                    } else if (i === currentPage - 2 || i === currentPage + 2) {
                                                        pages.push(<span key={i} className="px-1 text-gray-400">...</span>);
                                                    }
                                                }
                                                return pages;
                                            })()}
                                        </div>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-sm font-medium"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Bulk Import Preview Dialog */}
                {showBulkImportPreview && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-transparent">
                                <h2 className="text-2xl font-bold text-gray-900">Review Bulk Import Data</h2>
                                <button
                                    onClick={() => {
                                        setShowBulkImportPreview(false);
                                        setBulkImportPreviewData([]);
                                        setBulkImportEditedData([]);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <FiX size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="overflow-y-auto flex-1 p-6 space-y-4">
                                <p className="text-sm text-gray-600">
                                    Review and edit the processed data below before importing. You can edit department, employee grade, and manager for each row.
                                </p>

                                {/* Search and Filters Section */}
                                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    {/* Search Bar */}
                                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
                                        <FiSearch size={18} className="text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name, email, ID, or designation..."
                                            value={previewSearchTerm}
                                            onChange={(e) => setPreviewSearchTerm(e.target.value)}
                                            className="flex-1 outline-none text-sm text-gray-900"
                                        />
                                    </div>

                                    {/* Filter Controls */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <select
                                            value={previewFilters.department}
                                            onChange={(e) => setPreviewFilters({ ...previewFilters, department: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="">All Departments</option>
                                            {Array.from(new Set(bulkImportPreviewData.map(u => u.department).filter(Boolean))).map(dept => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={previewFilters.employee_grade}
                                            onChange={(e) => setPreviewFilters({ ...previewFilters, employee_grade: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="">All Grades</option>
                                            {Array.from(new Set(bulkImportPreviewData.map(u => u.employee_grade).filter(Boolean))).map(grade => (
                                                <option key={grade} value={grade}>{grade}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={previewFilters.designation}
                                            onChange={(e) => setPreviewFilters({ ...previewFilters, designation: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="">All Designations</option>
                                            {Array.from(new Set(bulkImportPreviewData.map(u => u.designation).filter(Boolean))).map(desig => (
                                                <option key={desig} value={desig}>{desig}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Data Preview Table */}
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">#</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Full Name</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Email</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Employee ID</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Department</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Employee Grade</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Designation</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Manager</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Role</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-900">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getFilteredPreviewData().map((user, displayIdx) => {
                                                const actualIdx = bulkImportEditedData.findIndex(u => u.email === user.email && u.user_id === user.user_id);
                                                return (
                                                    <tr key={displayIdx} className={displayIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <td className="px-4 py-3 text-gray-900">{displayIdx + 1}</td>
                                                        <td className="px-4 py-3 text-gray-900 font-medium">{user.fullname || '-'}</td>
                                                        <td className="px-4 py-3 text-gray-900 text-xs">{user.email || '-'}</td>
                                                        <td className="px-4 py-3 text-gray-900 font-mono text-xs">{user.user_id || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={user.department || ''}
                                                                onChange={(e) => updatePreviewData(actualIdx, 'department', e.target.value)}
                                                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full"
                                                            >
                                                                <option value="">Select</option>
                                                                {DEPARTMENTS.map(dept => (
                                                                    <option key={dept} value={dept}>{dept}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={user.employee_grade || ''}
                                                                onChange={(e) => updatePreviewData(actualIdx, 'employee_grade', e.target.value)}
                                                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full"
                                                            >
                                                                <option value="">Select</option>
                                                                {['C1', 'C2', 'D1', 'D2', 'D3', 'E1', 'E2', 'E3', 'G1', 'G2', 'H1', 'L1', 'L2', 'L3', 'M1', 'M2', 'M3', 'M4', 'T1', 'V1', 'V2', 'V3'].map(grade => (
                                                                    <option key={grade} value={grade}>{grade}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-900 text-sm">{user.designation || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={user.manager_name || ''}
                                                                onChange={(e) => updatePreviewData(actualIdx, 'manager_name', e.target.value)}
                                                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full"
                                                            >
                                                                <option value="">Select</option>
                                                                {managers.map(mgr => (
                                                                    <option key={mgr.id} value={mgr.fullname}>{mgr.fullname}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-900">
                                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                                                {user.role || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-900">
                                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                                                {user.user_status || '-'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        <strong>Showing:</strong> {getFilteredPreviewData().length} of {bulkImportPreviewData.length} users
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                                <button
                                    onClick={() => {
                                        setShowBulkImportPreview(false);
                                        setBulkImportPreviewData([]);
                                        setBulkImportEditedData([]);
                                    }}
                                    disabled={loading}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:bg-gray-100 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmBulkImport}
                                    disabled={loading}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors font-medium"
                                >
                                    {loading ? 'Importing...' : `Confirm Import (${bulkImportEditedData.length})`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: Add New User - Now Modal */}
                {showAddUserModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary/10 to-transparent">
                                <h2 className="text-2xl font-bold text-gray-900">Create New User</h2>
                                <button
                                    onClick={closeAddUserModal}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <FiX size={24} />
                                </button>
                            </div>

                            {/* Modal Content - Scrollable */}
                            <div className="overflow-y-auto flex-1 p-6">
                                <form onSubmit={handleAddUser} className="space-y-6">
                                    {/* Basic Information */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-primary">person</span>
                                            Basic Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Full Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    name="fullname"
                                                    value={formData.fullname}
                                                    onChange={handleFormChange}
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="John Doe"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Email *
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleFormChange}
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="john@example.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Password *
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        name="password"
                                                        value={formData.password}
                                                        onChange={handleFormChange}
                                                        disabled
                                                        required
                                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-gray-50 cursor-not-allowed"
                                                        placeholder="Auto-filled from Employee ID"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                    >
                                                        <span className="material-symbols-rounded text-lg">
                                                            {showPassword ? 'visibility' : 'visibility_off'}
                                                        </span>
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Password is automatically set to the Employee ID</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Employee ID
                                                </label>
                                                <div className="flex items-center">
                                                    <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-700 font-medium">CLOVE-</span>
                                                    <input
                                                        type="text"
                                                        name="user_id"
                                                        value={formData.user_id}
                                                        onChange={handleFormChange}
                                                        className="flex-1 px-3 py-2 border border-l-0 border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                        placeholder="2001"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Mobile Number
                                                </label>
                                                <input
                                                    type="tel"
                                                    name="mobile_number"
                                                    value={formData.mobile_number}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="1234567890"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Role & Permissions */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-primary">security</span>
                                            Role & Permissions
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Role *
                                                </label>
                                                <select
                                                    name="role"
                                                    value={formData.role}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="learner">Learner</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="instructor">Instructor</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Status
                                                </label>
                                                <select
                                                    name="user_status"
                                                    value={formData.user_status}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                    <option value="Pending">Pending</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Allowed Views
                                                </label>
                                                <select
                                                    name="allowed_views"
                                                    value={formData.allowed_views}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="default">Default</option>
                                                    <option value="student">Student</option>
                                                    <option value="instructor">Instructor</option>
                                                    <option value="admin">Admin Dashboard</option>
                                                    <option value="all">All Views</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Preferred Language
                                                </label>
                                                <select
                                                    name="preferred_language"
                                                    value={formData.preferred_language}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="English">English</option>
                                                    <option value="Spanish">Spanish</option>
                                                    <option value="French">French</option>
                                                    <option value="German">German</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    LinkedIn Partner Access
                                                </label>
                                                <select
                                                    name="LinkedInPartnerAccess"
                                                    value={formData.LinkedInPartnerAccess}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    LinkedIn Profile URL
                                                </label>
                                                <input
                                                    type="url"
                                                    name="linkedin_profile_url"
                                                    value={formData.linkedin_profile_url}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="https://linkedin.com/in/username"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Employment & Company */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-primary">business</span>
                                            Employment & Company
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Company
                                                </label>
                                                <select
                                                    name="company"
                                                    value={formData.company}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="">-- Select Company --</option>
                                                    <option value="Clove Technologies Pvt. Ltd.">Clove Technologies Pvt. Ltd.</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Department
                                                </label>
                                                <select
                                                    name="department"
                                                    value={formData.department}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="">-- Select Department --</option>
                                                    {DEPARTMENTS.map(dept => (
                                                        <option key={dept} value={dept}>{dept}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Designation
                                                </label>
                                                <input
                                                    type="text"
                                                    name="designation"
                                                    value={formData.designation}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="Senior Developer"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Employment Type
                                                </label>
                                                <select
                                                    name="employment_type"
                                                    value={formData.employment_type}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="Full-time">Full-time</option>
                                                    <option value="Part-time">Part-time</option>
                                                    <option value="Contract">Contract</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Location
                                                </label>
                                                <select
                                                    name="location"
                                                    value={formData.location}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="">-- Select Location --</option>
                                                    <option value="Visakhapatnam">Visakhapatnam</option>
                                                    <option value="Hyderabad">Hyderabad</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Industry
                                                </label>
                                                <select
                                                    name="industry"
                                                    value={formData.industry}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="">-- Select Industry --</option>
                                                    <option value="AEC">AEC</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Manager Details */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-primary">supervisor_account</span>
                                            Manager Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Manager Name
                                                </label>
                                                <select
                                                    name="manager_name"
                                                    value={formData.manager_name}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="">-- Select Manager --</option>
                                                    {managers.map(manager => (
                                                        <option key={manager.id} value={manager.fullname}>
                                                            {manager.fullname} ({manager.email})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Leadership Role
                                                </label>
                                                <input
                                                    type="text"
                                                    name="leadership_role"
                                                    value={formData.leadership_role}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="Team Lead"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Persona & Team */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-primary">group</span>
                                            Persona & Team
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Persona
                                                </label>
                                                <input
                                                    type="text"
                                                    name="persona"
                                                    value={formData.persona}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="Individual Contributor"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Team
                                                </label>
                                                <input
                                                    type="text"
                                                    name="team"
                                                    value={formData.team}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="Engineering Team"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Additional Information */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-primary">info</span>
                                            Additional Information
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Employee Grade
                                                </label>
                                                <select
                                                    name="employee_grade"
                                                    value={formData.employee_grade}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="">-- Select Grade --</option>
                                                    <option value="C1">C1</option>
                                                    <option value="C2">C2</option>
                                                    <option value="D1">D1</option>
                                                    <option value="D2">D2</option>
                                                    <option value="D3">D3</option>
                                                    <option value="E1">E1</option>
                                                    <option value="E2">E2</option>
                                                    <option value="E3">E3</option>
                                                    <option value="G1">G1</option>
                                                    <option value="G2">G2</option>
                                                    <option value="H1">H1</option>
                                                    <option value="L1">L1</option>
                                                    <option value="L2">L2</option>
                                                    <option value="L3">L3</option>
                                                    <option value="M1">M1</option>
                                                    <option value="M2">M2</option>
                                                    <option value="M3">M3</option>
                                                    <option value="M4">M4</option>
                                                    <option value="T1">T1</option>
                                                    <option value="V1">V1</option>
                                                    <option value="V2">V2</option>
                                                    <option value="V3">V3</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>
                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-gray-200 p-6 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={closeAddUserModal}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setFormData({
                                            fullname: '',
                                            email: '',
                                            user_id: '',
                                            mobile_number: '',
                                            user_status: 'Active',
                                            preferred_language: 'English',
                                            allowed_views: 'default',
                                            company: '',
                                            department: '',
                                            designation: '',
                                            employment_type: 'Full-time',
                                            industry: '',
                                            leadership_role: '',
                                            LinkedInPartnerAccess: 'No',
                                            linkedin_profile_url: '',
                                            location: '',
                                            role: 'learner',
                                            manager_name: '',
                                            persona: '',
                                            team: '',
                                            employee_grade: '',
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={(e) => handleAddUser(e as any)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors font-medium"
                                >
                                    {loading ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* EDIT USER MODAL - Same structure as Add User Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-transparent">
                                <h2 className="text-2xl font-bold text-gray-900">Edit User</h2>
                                <button
                                    onClick={closeEditModal}
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <FiX size={24} />
                                </button>
                            </div>

                            {/* Modal Content - Scrollable */}
                            <div className="overflow-y-auto flex-1 p-6">
                                <form onSubmit={handleUpdateUser} className="space-y-6">
                                    {/* Basic Information */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-blue-600">person</span>
                                            Basic Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Full Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    name="fullname"
                                                    value={formData.fullname}
                                                    onChange={handleFormChange}
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Email *
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleFormChange}
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                    disabled
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Employee ID
                                                </label>
                                                <input
                                                    type="text"
                                                    name="user_id"
                                                    value={formData.user_id}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Mobile Number
                                                </label>
                                                <input
                                                    type="tel"
                                                    name="mobile_number"
                                                    value={formData.mobile_number}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Role & Permissions */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-blue-600">security</span>
                                            Role & Permissions
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Role *
                                                </label>
                                                <select
                                                    name="role"
                                                    value={formData.role}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="learner">Learner</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="instructor">Instructor</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Status
                                                </label>
                                                <select
                                                    name="user_status"
                                                    value={formData.user_status}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                    <option value="Pending">Pending</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Allowed Views
                                                </label>
                                                <select
                                                    name="allowed_views"
                                                    value={formData.allowed_views}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="default">Default</option>
                                                    <option value="student">Student</option>
                                                    <option value="instructor">Instructor</option>
                                                    <option value="admin">Admin Dashboard</option>
                                                    <option value="all">All Views</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Preferred Language
                                                </label>
                                                <select
                                                    name="preferred_language"
                                                    value={formData.preferred_language}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="English">English</option>
                                                    <option value="Spanish">Spanish</option>
                                                    <option value="French">French</option>
                                                    <option value="German">German</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    LinkedIn Partner Access
                                                </label>
                                                <select
                                                    name="LinkedInPartnerAccess"
                                                    value={formData.LinkedInPartnerAccess}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    LinkedIn Profile URL
                                                </label>
                                                <input
                                                    type="url"
                                                    name="linkedin_profile_url"
                                                    value={formData.linkedin_profile_url}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                    placeholder="https://linkedin.com/in/username"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Employment & Company */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-blue-600">business</span>
                                            Employment & Company
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Company
                                                </label>
                                                <input
                                                    type="text"
                                                    name="company"
                                                    value={formData.company}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Department
                                                </label>
                                                <select
                                                    name="department"
                                                    value={formData.department}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="">-- Select Department --</option>
                                                    {DEPARTMENTS.map(dept => (
                                                        <option key={dept} value={dept}>{dept}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Designation
                                                </label>
                                                <input
                                                    type="text"
                                                    name="designation"
                                                    value={formData.designation}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Employment Type
                                                </label>
                                                <select
                                                    name="employment_type"
                                                    value={formData.employment_type}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="Full-time">Full-time</option>
                                                    <option value="Part-time">Part-time</option>
                                                    <option value="Contract">Contract</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Location
                                                </label>
                                                <input
                                                    type="text"
                                                    name="location"
                                                    value={formData.location}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Industry
                                                </label>
                                                <input
                                                    type="text"
                                                    name="industry"
                                                    value={formData.industry}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Manager Details */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-blue-600">supervisor_account</span>
                                            Manager Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Manager Name
                                                </label>
                                                <select
                                                    name="manager_name"
                                                    value={formData.manager_name}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="">-- Select Manager --</option>
                                                    {managers.map(manager => (
                                                        <option key={manager.id} value={manager.fullname}>
                                                            {manager.fullname} ({manager.email})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Leadership Role
                                                </label>
                                                <input
                                                    type="text"
                                                    name="leadership_role"
                                                    value={formData.leadership_role}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Persona & Team */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-blue-600">group</span>
                                            Persona & Team
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Persona
                                                </label>
                                                <input
                                                    type="text"
                                                    name="persona"
                                                    value={formData.persona}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Team
                                                </label>
                                                <input
                                                    type="text"
                                                    name="team"
                                                    value={formData.team}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Additional Information */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                            <span className="material-symbols-rounded text-blue-600">info</span>
                                            Additional Information
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Employee Grade
                                                </label>
                                                <select
                                                    name="employee_grade"
                                                    value={formData.employee_grade}
                                                    onChange={handleFormChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="">-- Select Grade --</option>
                                                    <option value="C1">C1</option>
                                                    <option value="C2">C2</option>
                                                    <option value="D1">D1</option>
                                                    <option value="D2">D2</option>
                                                    <option value="D3">D3</option>
                                                    <option value="E1">E1</option>
                                                    <option value="E2">E2</option>
                                                    <option value="E3">E3</option>
                                                    <option value="G1">G1</option>
                                                    <option value="G2">G2</option>
                                                    <option value="H1">H1</option>
                                                    <option value="L1">L1</option>
                                                    <option value="L2">L2</option>
                                                    <option value="L3">L3</option>
                                                    <option value="M1">M1</option>
                                                    <option value="M2">M2</option>
                                                    <option value="M3">M3</option>
                                                    <option value="M4">M4</option>
                                                    <option value="T1">T1</option>
                                                    <option value="V1">V1</option>
                                                    <option value="V2">V2</option>
                                                    <option value="V3">V3</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>
                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-gray-200 p-6 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={closeEditModal}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={(e) => handleUpdateUser(e as any)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: Bulk Import - Enhanced with Progress Steps */}
                {activeTab === 'bulk-import' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Bulk Operations</h2>
                                <p className="text-gray-600 text-sm mt-1">Import, update, and manage users in bulk using Excel templates</p>
                            </div>
                        </div>

                        {/* Progress Steps */}
                        <div className="bg-white rounded-lg border border-gray-200 p-8">
                            <h3 className="text-lg font-semibold mb-6 text-gray-900">How to Bulk Import</h3>
                            <div className="flex items-center justify-between">
                                {/* Step 1 */}
                                <div className="flex flex-col items-center flex-1">
                                    <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold mb-3">
                                        1
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 text-center">Download Template</p>
                                    <p className="text-xs text-gray-600 text-center mt-1">Get the Excel file template</p>
                                </div>

                                {/* Connector Line */}
                                <div className="flex-1 mb-9">
                                    <div className="h-0.5 bg-primary/30 w-full"></div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex flex-col items-center flex-1">
                                    <div className="w-12 h-12 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-lg font-bold mb-3">
                                        2
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 text-center">Fill Data</p>
                                    <p className="text-xs text-gray-600 text-center mt-1">Enter your data in the template</p>
                                </div>

                                {/* Connector Line */}
                                <div className="flex-1 mb-9">
                                    <div className="h-0.5 bg-primary/30 w-full"></div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex flex-col items-center flex-1">
                                    <div className="w-12 h-12 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-lg font-bold mb-3">
                                        3
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 text-center">Upload & Import</p>
                                    <p className="text-xs text-gray-600 text-center mt-1">Upload the file to import</p>
                                </div>
                            </div>
                        </div>

                        {/* Operation Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Add Users */}
                            <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                        <FiUpload className="text-green-600 text-xl" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold mb-2 text-gray-900">Bulk Add Users</h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Import multiple users from an Excel file. Each row will create a new user with all specified fields.
                                        </p>
                                        <button
                                            onClick={() => downloadExcelTemplate('bulk-add')}
                                            className="text-primary hover:text-primary/80 hover:underline text-sm font-medium mb-3 block transition-colors"
                                        >
                                            ↓ Download Template
                                        </button>
                                        <label>
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls"
                                                onChange={handleBulkAddUsers}
                                                disabled={loading}
                                                className="hidden"
                                            />
                                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 text-sm font-medium cursor-pointer transition-colors">
                                                <FiUpload size={16} />
                                                {loading ? 'Processing...' : 'Choose File'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Manager Mapping */}
                            <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <FiUsers className="text-blue-600 text-xl" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold mb-2 text-gray-900">Manager Mapping</h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Update manager assignments for multiple users in a single operation.
                                        </p>
                                        <button
                                            onClick={() => downloadExcelTemplate('bulk-manager')}
                                            className="text-primary hover:text-primary/80 hover:underline text-sm font-medium mb-3 block transition-colors"
                                        >
                                            ↓ Download Template
                                        </button>
                                        <label>
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls"
                                                onChange={handleBulkManagerMapping}
                                                disabled={loading}
                                                className="hidden"
                                            />
                                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium cursor-pointer transition-colors">
                                                <FiUpload size={16} />
                                                {loading ? 'Processing...' : 'Choose File'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Bulk Update */}
                            <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                        <FiFileText className="text-yellow-600 text-xl" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold mb-2 text-gray-900">Bulk Update</h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Update specific fields for multiple users (name, department, role, designation, location).
                                        </p>
                                        <button
                                            onClick={() => downloadExcelTemplate('bulk-update')}
                                            className="text-primary hover:text-primary/80 hover:underline text-sm font-medium mb-3 block transition-colors"
                                        >
                                            ↓ Download Template
                                        </button>
                                        <label>
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls"
                                                onChange={handleBulkUpdate}
                                                disabled={loading}
                                                className="hidden"
                                            />
                                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 text-sm font-medium cursor-pointer transition-colors">
                                                <FiUpload size={16} />
                                                {loading ? 'Processing...' : 'Choose File'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Export */}
                            <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <FiDownload className="text-purple-600 text-xl" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold mb-2 text-gray-900">Export User Data</h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Download all user data as CSV for backup, analysis, or external processing.
                                        </p>
                                        <button
                                            onClick={handleExtractUserDump}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 text-sm font-medium transition-colors"
                                        >
                                            <FiDownload size={16} />
                                            {loading ? 'Extracting...' : 'Export Data'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Guidelines Section */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="material-symbols-rounded text-blue-600">info</span>
                                Best Practices
                            </h3>
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li className="flex items-start gap-2">
                                    <span className="material-symbols-rounded text-green-600 flex-shrink-0 text-lg">check_circle</span>
                                    <span>Always download the template first to ensure correct column format</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="material-symbols-rounded text-green-600 flex-shrink-0 text-lg">check_circle</span>
                                    <span>Validate email addresses before importing (must be unique)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="material-symbols-rounded text-green-600 flex-shrink-0 text-lg">check_circle</span>
                                    <span>Keep Excel files under 5MB and under 1000 rows for optimal performance</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="material-symbols-rounded text-green-600 flex-shrink-0 text-lg">check_circle</span>
                                    <span>Test with a small batch before importing large datasets</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* TAB 4: Bulk Mapping */}
                {activeTab === 'bulk-mapping' && (
                    <div className="space-y-6">
                        {/* Header and Form */}
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">Bulk Department, Grade & Manager Mapping</h3>
                            <p className="text-gray-600 mb-6">Select users from the table below and assign department, employee grade, and/or manager to them.</p>

                            <form onSubmit={handleBulkMappingSubmit} className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Department
                                        </label>
                                        {!showNewDepartmentInput ? (
                                            <div className="space-y-2">
                                                <select
                                                    value={bulkMappingData.department}
                                                    onChange={(e) => {
                                                        if (e.target.value === '__add_new__') {
                                                            setShowNewDepartmentInput(true);
                                                            setNewDepartment('');
                                                        } else {
                                                            handleBulkMappingChange('department', e.target.value);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="">-- Select Department --</option>
                                                    {DEPARTMENTS.map(dept => (
                                                        <option key={dept} value={dept}>{dept}</option>
                                                    ))}
                                                    <option value="__add_new__" className="font-semibold">+ Add New Department</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={newDepartment}
                                                    onChange={(e) => setNewDepartment(e.target.value)}
                                                    placeholder="Enter new department name"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (newDepartment.trim()) {
                                                                handleBulkMappingChange('department', newDepartment);
                                                                setShowNewDepartmentInput(false);
                                                            }
                                                        }}
                                                        className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNewDepartmentInput(false)}
                                                        className="flex-1 px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Employee Grade
                                        </label>
                                        <select
                                            value={bulkMappingData.employee_grade}
                                            onChange={(e) => handleBulkMappingChange('employee_grade', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <option value="">-- Select Grade --</option>
                                            <option value="C1">C1</option>
                                            <option value="C2">C2</option>
                                            <option value="D1">D1</option>
                                            <option value="D2">D2</option>
                                            <option value="D3">D3</option>
                                            <option value="E1">E1</option>
                                            <option value="E2">E2</option>
                                            <option value="E3">E3</option>
                                            <option value="G1">G1</option>
                                            <option value="G2">G2</option>
                                            <option value="H1">H1</option>
                                            <option value="L1">L1</option>
                                            <option value="L2">L2</option>
                                            <option value="L3">L3</option>
                                            <option value="M1">M1</option>
                                            <option value="M2">M2</option>
                                            <option value="M3">M3</option>
                                            <option value="M4">M4</option>
                                            <option value="T1">T1</option>
                                            <option value="V1">V1</option>
                                            <option value="V2">V2</option>
                                            <option value="V3">V3</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Manager
                                        </label>
                                        <select
                                            value={bulkMappingData.manager_name}
                                            onChange={(e) => handleBulkMappingChange('manager_name', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <option value="">-- Select Manager --</option>
                                            {managers.map(manager => (
                                                <option key={manager.id} value={manager.fullname}>
                                                    {manager.fullname}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Second Row for Company, Location, Industry */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Company Name
                                        </label>
                                        <select
                                            value={bulkMappingData.company_name}
                                            onChange={(e) => handleBulkMappingChange('company_name', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <option value="">-- Select Company --</option>
                                            <option value="Clove Technologies Pvt. Ltd.">Clove Technologies Pvt. Ltd.</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Location
                                        </label>
                                        <select
                                            value={bulkMappingData.location}
                                            onChange={(e) => handleBulkMappingChange('location', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <option value="">-- Select Location --</option>
                                            <option value="Visakhapatnam">Visakhapatnam</option>
                                            <option value="Hyderabad">Hyderabad</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Industry
                                        </label>
                                        <select
                                            value={bulkMappingData.industry}
                                            onChange={(e) => handleBulkMappingChange('industry', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <option value="">-- Select Industry --</option>
                                            <option value="AEC">AEC</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-600">
                                        <span className="font-medium text-gray-900">{selectedUserIds.size}</span> user(s) selected
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading || selectedUserIds.size === 0}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 font-medium transition-colors"
                                    >
                                        {loading ? 'Updating...' : 'Apply Mapping'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Select Users</h4>

                            {/* Search Bar */}
                            <div className="mb-4 relative">
                                <FiSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={bulkMappingSearch}
                                    onChange={(e) => setBulkMappingSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            {/* Filters */}
                            <div className="mb-4 grid grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                                    <select
                                        value={bulkMappingFilters.department}
                                        onChange={(e) => setBulkMappingFilters({ ...bulkMappingFilters, department: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">All Departments</option>
                                        {DEPARTMENTS.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Employee Grade</label>
                                    <select
                                        value={bulkMappingFilters.employee_grade}
                                        onChange={(e) => setBulkMappingFilters({ ...bulkMappingFilters, employee_grade: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">All Grades</option>
                                        <option value="C1">C1</option>
                                        <option value="C2">C2</option>
                                        <option value="D1">D1</option>
                                        <option value="D2">D2</option>
                                        <option value="D3">D3</option>
                                        <option value="E1">E1</option>
                                        <option value="E2">E2</option>
                                        <option value="E3">E3</option>
                                        <option value="G1">G1</option>
                                        <option value="G2">G2</option>
                                        <option value="H1">H1</option>
                                        <option value="L1">L1</option>
                                        <option value="L2">L2</option>
                                        <option value="L3">L3</option>
                                        <option value="M1">M1</option>
                                        <option value="M2">M2</option>
                                        <option value="M3">M3</option>
                                        <option value="M4">M4</option>
                                        <option value="T1">T1</option>
                                        <option value="V1">V1</option>
                                        <option value="V2">V2</option>
                                        <option value="V3">V3</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                                    <select
                                        value={bulkMappingFilters.role}
                                        onChange={(e) => setBulkMappingFilters({ ...bulkMappingFilters, role: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">All Roles</option>
                                        <option value="admin">Admin</option>
                                        <option value="instructor">Instructor</option>
                                        <option value="learner">Learner</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Manager</label>
                                    <input
                                        type="text"
                                        placeholder="Filter by manager..."
                                        value={bulkMappingFilters.manager_name}
                                        onChange={(e) => setBulkMappingFilters({ ...bulkMappingFilters, manager_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto mb-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUserIds.size === getPaginatedBulkMappingUsers().data.length && getPaginatedBulkMappingUsers().data.length > 0}
                                                    onChange={() => {
                                                        const paginatedUsers = getPaginatedBulkMappingUsers().data;
                                                        const newSelected = new Set(selectedUserIds);
                                                        paginatedUsers.forEach(u => {
                                                            if (newSelected.has(u.id)) {
                                                                newSelected.delete(u.id);
                                                            } else {
                                                                newSelected.add(u.id);
                                                            }
                                                        });
                                                        setSelectedUserIds(newSelected);
                                                    }}
                                                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">Full Name</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">Grade</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">Manager</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {getPaginatedBulkMappingUsers().data.map((user) => (
                                            <tr key={user.id} className={`hover:bg-gray-50 ${selectedUserIds.has(user.id) ? 'bg-blue-50' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUserIds.has(user.id)}
                                                        onChange={() => handleToggleUserSelection(user.id)}
                                                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-gray-900">{user.fullname}</td>
                                                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                                                <td className="px-4 py-3 text-gray-600">{user.department || '-'}</td>
                                                <td className="px-4 py-3 text-gray-600">{user.employee_grade || '-'}</td>
                                                <td className="px-4 py-3 text-gray-600">{user.manager_name || '-'}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                        user.role === 'instructor' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-green-100 text-green-800'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* No Results */}
                            {getFilteredBulkMappingUsers().length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    No users match your search or filter criteria
                                </div>
                            )}

                            {/* Pagination */}
                            {getFilteredBulkMappingUsers().length > 0 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex items-center gap-4">
                                        <div className="text-sm text-gray-600">
                                            Showing <span className="font-medium">{(bulkMappingPage - 1) * bulkMappingItemsPerPage + 1}</span> to{' '}
                                            <span className="font-medium">
                                                {Math.min(bulkMappingPage * bulkMappingItemsPerPage, getFilteredBulkMappingUsers().length)}
                                            </span> of <span className="font-medium">{getFilteredBulkMappingUsers().length}</span> users
                                        </div>
                                        <select
                                            value={bulkMappingItemsPerPage}
                                            onChange={(e) => setBulkMappingItemsPerPage(Number(e.target.value))}
                                            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <option value={10}>10 per page</option>
                                            <option value={25}>25 per page</option>
                                            <option value={50}>50 per page</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setBulkMappingPage(Math.max(1, bulkMappingPage - 1))}
                                            disabled={bulkMappingPage === 1}
                                            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: getPaginatedBulkMappingUsers().pages }, (_, i) => i + 1).map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => setBulkMappingPage(page)}
                                                    className={`px-3 py-1 rounded text-sm ${bulkMappingPage === page
                                                        ? 'bg-primary text-white font-medium'
                                                        : 'border border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => setBulkMappingPage(Math.min(getPaginatedBulkMappingUsers().pages, bulkMappingPage + 1))}
                                            disabled={bulkMappingPage === getPaginatedBulkMappingUsers().pages}
                                            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default UserManagementV2Page;
