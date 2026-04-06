
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import Select from 'react-select';
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

const EditUserPage = () => {
  const { id } = useParams<{ id: string }>();
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchUser = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        // Set form values
        Object.keys(data).forEach(key => {
          if (key === 'role') {
            const roleOption = roleOptions.find(o => o.value === data[key]);
            if (roleOption) setValue('role', roleOption);
          } else if (key === 'user_status') {
            const statusOption = statusOptions.find(o => o.value === data[key]);
            if (statusOption) setValue('user_status', statusOption);
          } else if (key === 'allowed_views') {
            if (data[key] && Array.isArray(data[key])) {
              setValue('allowed_views', data[key].map((v: string) => allowedViewsOptions.find(o => o.value === v)).filter(Boolean));
            } else {
              setValue('allowed_views', []);
            }
          } else if (key === 'company') {
            const companyOption = companyOptions.find(o => o.value === data[key]);
            if (companyOption) setValue('company', companyOption);
          } else if (key === 'location') {
            const locationOption = locationOptions.find(o => o.value === data[key]);
            if (locationOption) setValue('location', locationOption);
          } else if (key === 'industry') {
            const industryOption = industryOptions.find(o => o.value === data[key]);
            if (industryOption) setValue('industry', industryOption);
          } else {
            setValue(key, data[key] || '');
          }
        });
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id, setValue]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const profile = {
        fullname: data.fullname || '',
        user_id: data.user_id || '',
        mobile_number: data.mobile_number || '',
        user_status: data.user_status?.value || 'Active',
        preferred_language: data.preferred_language || '',
        allowed_views: Array.isArray(data.allowed_views) ? data.allowed_views.map((v: any) => v?.value).filter(Boolean) : [],
        company: data.company?.value || '',
        department: data.department || '',
        designation: data.designation || '',
        employment_type: data.employment_type || '',
        industry: data.industry?.value || '',
        leadership_role: data.leadership_role || '',
        location: data.location?.value || '',
        role: data.role?.value || 'learner',
        persona: data.persona || '',
        team: data.team || '',
        manager_name: data.manager_name || '',
        manager_mapping: data.manager_mapping || false,
        employee_grade: data.employee_grade || '',
      };

      const { error: profileError } = await supabase.from('profiles').update(profile).eq('id', id);

      if (profileError) throw profileError;

      setSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Edit User">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold mb-8">Edit User</h1>
        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">User updated successfully!</div>}
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">Error: {error}</div>}

        {loading && <div>Loading...</div>}
        {!loading && !error && (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-lg shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Basic Info</h2>
                <div className="space-y-4">
                  <input {...register('fullname', { required: 'Full Name is required' })} placeholder="Full Name" className="w-full p-2 border rounded" />
                  {errors.fullname && <span className="text-red-500">{errors.fullname.message}</span>}

                  <input {...register('user_id')} placeholder="User ID" className="w-full p-2 border rounded" />

                  <input type="email" {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email address' } })} placeholder="Email" className="w-full p-2 border rounded" readOnly />
                  {errors.email && <span className="text-red-500">{errors.email.message}</span>}

                  <input {...register('mobile_number')} placeholder="Mobile Number" className="w-full p-2 border rounded" />

                  <Controller
                    name="user_status"
                    control={control}
                    rules={{ required: 'User Status is required' }}
                    render={({ field }) => <Select {...field} options={statusOptions} placeholder="User Status" isClearable />}
                  />
                  {errors.user_status && <span className="text-red-500">{errors.user_status.message}</span>}

                  <input {...register('preferred_language')} placeholder="Preferred Language" className="w-full p-2 border rounded" />

                  <Controller
                    name="allowed_views"
                    control={control}
                    render={({ field }) => <Select {...field} isMulti options={allowedViewsOptions} placeholder="Allowed Views" isClearable />}
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
                    render={({ field }) => <Select {...field} options={companyOptions} placeholder="Company" isClearable />}
                  />

                  <input {...register('department')} placeholder="Department" className="w-full p-2 border rounded" />
                  <input {...register('designation')} placeholder="Designation" className="w-full p-2 border rounded" />
                  <input {...register('employment_type')} placeholder="Employment Type" className="w-full p-2 border rounded" />

                  <Controller
                    name="industry"
                    control={control}
                    render={({ field }) => <Select {...field} options={industryOptions} placeholder="Industry" isClearable />}
                  />

                  <input {...register('leadership_role')} placeholder="Leadership Role" className="w-full p-2 border rounded" />

                  <Controller
                    name="location"
                    control={control}
                    render={({ field }) => <Select {...field} options={locationOptions} placeholder="Location" isClearable />}
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
                    render={({ field }) => <Select {...field} options={roleOptions} placeholder="Role" isClearable />}
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
                {loading ? 'Updating...' : 'Update User'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};

export default EditUserPage;