
import React from 'react';
import { useForm } from 'react-hook-form';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (data: any) => void;
}

const AdvancedUserSearchModal: React.FC<AdvancedSearchModalProps> = ({ isOpen, onClose, onSearch }) => {
  const { register, handleSubmit } = useForm();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">Advanced Search</h2>
        <form onSubmit={handleSubmit(onSearch)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add all the searchable fields here */}
            <input {...register('fullname')} placeholder="Full Name" className="w-full p-2 border rounded" />
            <input {...register('email')} placeholder="Email" className="w-full p-2 border rounded" />
            <input {...register('company')} placeholder="Company" className="w-full p-2 border rounded" />
            <input {...register('department')} placeholder="Department" className="w-full p-2 border rounded" />
            <select {...register('role')} className="w-full p-2 border rounded">
              <option value="">Any Role</option>
              <option value="learner">Learner</option>
              <option value="admin">Admin</option>
              <option value="instructor">Instructor</option>
            </select>
            <select {...register('user_status')} className="w-full p-2 border rounded">
              <option value="">Any Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="mt-8 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
              Cancel
            </button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdvancedUserSearchModal;