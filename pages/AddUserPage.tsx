
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import ToggleSwitch from '../components/ToggleSwitch';
import AdminLayout from '../components/AdminLayout';

const roleOptions = [
  { value: 'learner', label: 'Learner' },
  { value: 'admin', label: 'Admin' },
  { value: 'instructor', label: 'Instructor' },
];

const statusOptions = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

const allowedViewsOptions = [
  { value: 'Learner View', label: 'Learner View' },
  { value: 'Trainer View', label: 'Trainer View' },
  { value: 'Administrator View', label: 'Administrator View' },
];

const companyOptions = [
  { value: 'Clove Technologies Pvt. Ltd.', label: 'Clove Technologies Pvt. Ltd.' },
];

const locationOptions = [
  { value: 'Visakhapatnam', label: 'Visakhapatnam' },
  { value: 'Hyderabad', label: 'Hyderabad' },
];

const industryOptions = [
  { value: 'AEC', label: 'AEC' },
];

const AddUserPage = () => {
  const { register, handleSubmit, control, formState: { errors } } = useForm();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  useEffect(() => {
    if (location.state?.isBulkMode) {
      setIsBulkMode(true);
    }
    if (location.state?.bulkData) {
      setBulkData(location.state.bulkData);
    }
  }, [location.state]);

  const downloadTemplate = () => {
    const template = [
      {
        fullname: 'John Doe',
        user_id: 'USER123',
        email: 'john@example.com',
        password: 'password123',
        mobile_number: '1234567890',
        user_status: 'Active',
        preferred_language: 'English',
        allowed_views: 'Learner View,Trainer View',
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
        manager_mapping: 'false',
        employee_grade: 'A'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'user_import_template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setBulkData(data);
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkChange = (index: number, field: string, value: string) => {
    const newData = [...bulkData];
    newData[index][field] = value;
    setBulkData(newData);
  };

  const handleBulkSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setBulkErrors([]);

    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < bulkData.length; i++) {
      const user = bulkData[i];
      try {
        // Validate required fields
        if (!user.email || !user.password || !user.role) {
          throw new Error(`Row ${i + 1}: Missing required fields (email, password, role)`);
        }

        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            data: {
              role: user.role,
            }
          }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error(`Row ${i + 1}: User not created in Auth.`);

        // 2. Update the profile in public.profiles table
        const profile = {
          email: user.email,
          fullname: user.fullname,
          user_id: user.user_id,
          mobile_number: user.mobile_number,
          user_status: user.user_status,
          preferred_language: user.preferred_language,
          allowed_views: user.allowed_views ? user.allowed_views.split(',').map((v: string) => v.trim()) : [],
          company: user.company,
          department: user.department,
          designation: user.designation,
          employment_type: user.employment_type,
          industry: user.industry,
          leadership_role: user.leadership_role,
          location: user.location,
          role: user.role,
          persona: user.persona,
          team: user.team,
          manager_name: user.manager_name,
          manager_mapping: user.manager_mapping === 'true' || user.manager_mapping === true,
          employee_grade: user.employee_grade,
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profile)
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
        successCount++;

      } catch (err: any) {
        console.error(err);
        errors.push(`Row ${i + 1} (${user.email}): ${err.message}`);
      }
    }

    setLoading(false);
    if (errors.length > 0) {
      setBulkErrors(errors);
      setError(`Imported ${successCount} users. Failed to import ${errors.length} users.`);
    } else {
      setSuccess(true);
      setBulkData([]);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: data.role.value,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User not created in Auth.');

      // 2. Update the profile in public.profiles table
      const profile = {
        email: data.email,
        fullname: data.fullname,
        user_id: data.user_id,
        mobile_number: data.mobile_number,
        user_status: data.user_status.value,
        preferred_language: data.preferred_language,
        allowed_views: data.allowed_views.map((v: any) => v.value),
        company: data.company?.value,
        department: data.department,
        designation: data.designation,
        employment_type: data.employment_type,
        industry: data.industry?.value,
        leadership_role: data.leadership_role,
        location: data.location?.value,
        role: data.role.value,
        persona: data.persona,
        team: data.team,
        manager_name: data.manager_name,
        manager_mapping: data.manager_mapping,
        employee_grade: data.employee_grade,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profile)
        .eq('id', authData.user.id);

      if (profileError) {
        // If profile update fails, the auth user still exists.
        // The user can try to update their profile again later.
        throw profileError;
      }

      setSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Add a New User">
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Add a New User</h1>
          <ToggleSwitch
            label="Bulk Import Mode"
            enabled={isBulkMode}
            onChange={setIsBulkMode}
          />
        </div>

        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">User(s) added successfully!</div>}
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">Error: {error}</div>}

        {bulkErrors.length > 0 && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <ul className="list-disc pl-5">
              {bulkErrors.map((err, idx) => <li key={idx}>{err}</li>)}
            </ul>
          </div>
        )}

        {isBulkMode ? (
          <div className="bg-white p-8 rounded-lg shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Bulk Import Users</h2>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Download Excel Template
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-2 text-sm text-gray-500">Upload an Excel file with user details.</p>
            </div>

            {bulkData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(bulkData[0]).map((key) => (
                        <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bulkData.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {Object.keys(row).map((key) => (
                          <td key={`${rowIndex}-${key}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <input
                              value={row[key]}
                              onChange={(e) => handleBulkChange(rowIndex, key, e.target.value)}
                              className="border rounded p-1 w-full"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleBulkSubmit}
                disabled={loading || bulkData.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading ? 'Importing...' : 'Import Users'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-lg shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Basic Info</h2>
                <div className="space-y-4">
                  <input {...register('fullname', { required: 'Full Name is required' })} placeholder="Full Name" className="w-full p-2 border rounded" />
                  {errors.fullname && <span className="text-red-500">{errors.fullname.message}</span>}

                  <input {...register('user_id')} placeholder="User ID" className="w-full p-2 border rounded" />

                  <input type="email" {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email address' } })} placeholder="Email" className="w-full p-2 border rounded" />
                  {errors.email && <span className="text-red-500">{errors.email.message}</span>}

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })}
                      placeholder="Password"
                      className="w-full p-2 border rounded pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      <span className="material-symbols-rounded text-lg">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {errors.password && <span className="text-red-500">{errors.password.message}</span>}

                  <input {...register('mobile_number')} placeholder="Mobile Number" className="w-full p-2 border rounded" />

                  <Controller
                    name="user_status"
                    control={control}
                    rules={{ required: 'User Status is required' }}
                    render={({ field }) => <Select {...field} options={statusOptions} placeholder="User Status" />}
                  />
                  {errors.user_status && <span className="text-red-500">{errors.user_status.message}</span>}

                  <input {...register('preferred_language')} placeholder="Preferred Language" className="w-full p-2 border rounded" />

                  <Controller
                    name="allowed_views"
                    control={control}
                    render={({ field }) => <Select {...field} isMulti options={allowedViewsOptions} placeholder="Allowed Views" />}
                  />
                </div>
              </div>

              {/* Employment / Company */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Employment / Company</h2>
                <div className="space-y-4">
                  <Controller
                    name="company"
                    control={control}
                    render={({ field }) => <Select {...field} options={companyOptions} placeholder="Company" />}
                  />

                  <input {...register('department')} placeholder="Department" className="w-full p-2 border rounded" />
                  <input {...register('designation')} placeholder="Designation" className="w-full p-2 border rounded" />
                  <input {...register('employment_type')} placeholder="Employment Type" className="w-full p-2 border rounded" />

                  <Controller
                    name="industry"
                    control={control}
                    render={({ field }) => <Select {...field} options={industryOptions} placeholder="Industry" />}
                  />

                  <input {...register('leadership_role')} placeholder="Leadership Role" className="w-full p-2 border rounded" />

                  <Controller
                    name="location"
                    control={control}
                    render={({ field }) => <Select {...field} options={locationOptions} placeholder="Location" />}
                  />
                </div>
              </div>

              {/* Role + Permissions */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Role + Permissions</h2>
                <div className="space-y-4">
                  <Controller
                    name="role"
                    control={control}
                    rules={{ required: 'Role is required' }}
                    render={({ field }) => <Select {...field} options={roleOptions} placeholder="Role" />}
                  />
                  {errors.role && <span className="text-red-500">{errors.role.message}</span>}
                </div>
              </div>

              {/* Persona & Team */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Persona & Team</h2>
                <div className="space-y-4">
                  <input {...register('persona')} placeholder="Persona" className="w-full p-2 border rounded" />
                  <input {...register('team')} placeholder="Team" className="w-full p-2 border rounded" />
                </div>
              </div>

              {/* Manager Details */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Manager Details</h2>
                <div className="space-y-4">
                  <input {...register('manager_name')} placeholder="Manager Name" className="w-full p-2 border rounded" />
                  <Controller
                    name="manager_mapping"
                    control={control}
                    defaultValue={false}
                    render={({ field }) => (
                      <ToggleSwitch
                        label="Manager Mapping"
                        enabled={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Vendor */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Vendor</h2>
                <div className="space-y-4">
                  <input {...register('employee_grade')} placeholder="Employee Grade" className="w-full p-2 border rounded" />
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {loading ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};

export default AddUserPage;