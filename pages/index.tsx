
import { Link } from 'react-router-dom';
import { FiSearch, FiUserPlus, FiUpload, FiDownload, FiEdit } from 'react-icons/fi';

const AdminPage = () => {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">User Access Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link to="/UsersPage" className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4 hover:bg-gray-50">
          <FiSearch className="text-2xl text-gray-600" />
          <span>Search for existing users to view or modify them</span>
        </Link>
        <Link to="/AddUserPage" className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4 hover:bg-gray-50">
          <FiUserPlus className="text-2xl text-gray-600" />
          <span>Add a new User manually</span>
        </Link>
      </div>

      <h2 className="text-xl font-bold mb-4">User Bulk Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-4 mb-2">
            <FiUpload className="text-2xl text-gray-600" />
            <h3 className="text-lg font-semibold">Add new users in bulk, by importing from an Excel file</h3>
          </div>
          <p className="text-sm text-gray-500">A sample of the Excel template can be downloaded <a href="#" className="text-blue-600">from here</a>.</p>
          <p className="text-sm text-gray-500">Only non-sensitive fields are supported as part of bulk user import.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-4 mb-2">
            <FiUpload className="text-2xl text-gray-600" />
            <h3 className="text-lg font-semibold">Bulk Manager Mapping from an Excel file</h3>
          </div>
          <p className="text-sm text-gray-500">A sample of the Excel template can be downloaded <a href="#" className="text-blue-600">from here</a>.</p>
          <p className="text-sm text-gray-500">Delete courses of managee does not require an update.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-4 mb-2">
            <FiEdit className="text-2xl text-gray-600" />
            <h3 className="text-lg font-semibold">Bulk update of specific fields, by importing from an Excel</h3>
          </div>
          <p className="text-sm text-gray-500">A sample of the Excel template can be downloaded <a href="#" className="text-blue-600">from here</a>.</p>
          <p className="text-sm text-gray-500">Update courses that do not require an update.</p>
          <p className="text-sm text-gray-500">Only non-sensitive fields are supported as part of bulk update.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-4 mb-2">
            <FiDownload className="text-2xl text-gray-600" />
            <h3 className="text-lg font-semibold">Extract User Dump</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;