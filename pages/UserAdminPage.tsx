
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiUserPlus, FiUpload, FiDownload, FiFileText, FiUsers } from 'react-icons/fi';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

const UserAdminPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
          fullname: 'John Doe',
          user_id: 'USER123',
          email: 'john@example.com',
          mobile_number: '1234567890',
          user_status: 'Active',
          preferred_language: 'English',
          allowed_views: 'Learner View,Trainer View',
          LinkedInPartnerAccess: 'No',
          linkedin_profile_url: 'https://linkedin.com/in/johndoe',
          company: 'Acme Corp',
          department: 'Engineering',
          designation: 'Developer',
          employment_type: 'Full-time',
          industry: 'Technology',
          leadership_role: 'None',
          location: 'New York',
          role: 'learner',
          persona: 'Student',
          team: 'Alpha',
          manager_name: 'Jane Smith',
          employee_grade: 'A'
        }
      ];
      filename = 'bulk-user-import-template.xlsx';
    } else if (templateType === 'bulk-manager') {
      data = [
        { userId: 'user-uuid', managerId: 'manager-uuid', managerType: 'direct' },
        { userId: 'user-uuid', managerId: 'manager-uuid', managerType: 'direct' }
      ];
      filename = 'bulk-manager-mapping-template.xlsx';
    } else if (templateType === 'bulk-update') {
      data = [
        { email: 'user1@example.com', fullname: 'Updated Name', department: 'Updated Dept', LinkedInPartnerAccess: 'Yes', linkedin_profile_url: 'https://linkedin.com/in/user1' },
        { email: 'user2@example.com', fullname: 'Updated Name', department: 'Updated Dept', LinkedInPartnerAccess: 'No', linkedin_profile_url: 'https://linkedin.com/in/user2' }
      ];
      filename = 'bulk-update-template.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, filename);
  };

  const handleBulkAddUsers = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

      navigate('/admin/users/new', {
        state: {
          isBulkMode: true,
          bulkData: data
        }
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      event.target.value = '';
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

      const requiredFields = ['userId', 'managerId'];
      const missingFields = requiredFields.filter(field => !Object.keys(data[0]).includes(field));

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      let updatedCount = 0;

      for (const row of data) {
        try {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              managerId: row.managerId,
              managerType: row.managerType || 'direct',
              updatedAt: new Date().toISOString()
            })
            .eq('id', row.userId);

          if (updateError) throw updateError;
          updatedCount++;
        } catch (err: any) {
          console.error(`Error updating manager for user ${row.userId}:`, err);
        }
      }

      setSuccess(`Successfully updated manager mapping for ${updatedCount} users.`);
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

      const allowedFields = [
        'fullname', 'department', 'role', 'bio', 'avatarurl', 'mobile_number',
        'user_status', 'preferred_language', 'allowed_views', 'company',
        'designation', 'employment_type', 'industry', 'leadership_role',
        'LinkedInPartnerAccess', 'linkedin_profile_url', 'location',
        'manager_name', 'persona', 'team', 'employee_grade'
      ];
      let updatedCount = 0;

      for (const row of data) {
        try {
          const email = row.email;
          if (!email) {
            console.warn('Row missing email, skipping');
            continue;
          }

          const updateData: any = { updatedat: new Date().toISOString() };

          for (const field of allowedFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
              // Convert allowed_views from string to array
              if (field === 'allowed_views' && typeof row[field] === 'string') {
                updateData[field] = row[field].split(',').map(v => v.trim());
              } else {
                updateData[field] = row[field];
              }
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      event.target.value = '';
    }
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

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold mb-8">User Access Management</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Link to="/admin/users" className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center">
            <FiSearch className="text-2xl text-gray-500 mr-4" />
            <span className="text-lg">Search for existing users to view or modify them</span>
          </Link>
          <Link to="/admin/users/new" className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center">
            <FiUserPlus className="text-2xl text-gray-500 mr-4" />
            <span className="text-lg">Add a new user manually</span>
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">{success}</p>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-6">User Bulk Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-start">
              <FiUpload className="text-2xl text-green-500 mr-4 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Add new users in bulk, by importing from an Excel file</h3>
                <p className="text-sm text-gray-600 mb-3">Only non-sensitive fields are supported as part of bulk user import.</p>
                <button
                  onClick={() => downloadExcelTemplate('bulk-add')}
                  className="text-blue-600 hover:underline text-sm font-medium mb-3 block"
                >
                  Download Excel template
                </button>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkAddUsers}
                    disabled={loading}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 text-sm font-medium cursor-pointer transition-colors inline-block">
                    {loading ? 'Processing...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-start">
              <FiUsers className="text-2xl text-blue-500 mr-4 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Bulk Manager Mapping from an Excel file</h3>
                <p className="text-sm text-gray-600 mb-3">Delete columns of manager types not requiring an update.</p>
                <button
                  onClick={() => downloadExcelTemplate('bulk-manager')}
                  className="text-blue-600 hover:underline text-sm font-medium mb-3 block"
                >
                  Download Excel template
                </button>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkManagerMapping}
                    disabled={loading}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium cursor-pointer transition-colors inline-block">
                    {loading ? 'Processing...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-start">
              <FiFileText className="text-2xl text-yellow-500 mr-4 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Bulk update of specific fields, by importing from an excel</h3>
                <p className="text-sm text-gray-600 mb-3">Only non-sensitive fields are supported as part of bulk update.</p>
                <button
                  onClick={() => downloadExcelTemplate('bulk-update')}
                  className="text-blue-600 hover:underline text-sm font-medium mb-3 block"
                >
                  Download Excel template
                </button>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkUpdate}
                    disabled={loading}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-300 text-sm font-medium cursor-pointer transition-colors inline-block">
                    {loading ? 'Processing...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-start">
              <FiDownload className="text-2xl text-indigo-500 mr-4 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Extract User Dump</h3>
                <p className="text-sm text-gray-600 mb-4">Download all user data as a CSV file for reporting and analysis purposes.</p>
                <button
                  onClick={handleExtractUserDump}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 text-sm font-medium transition-colors"
                >
                  {loading ? 'Extracting...' : 'Extract & Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default UserAdminPage;

