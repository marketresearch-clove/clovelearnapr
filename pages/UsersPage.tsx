
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiChevronDown, FiFilter, FiEdit } from 'react-icons/fi';
import { supabase } from '../lib/supabaseClient';
import { userService } from '../lib/userService';
import AdvancedUserSearchModal from '../components/AdvancedUserSearchModal';
import AdminLayout from '../components/AdminLayout';

const ITEMS_PER_PAGE = 25;

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [advSearchData, setAdvSearchData] = useState(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
          .from('profiles')
          .select('* ', { count: 'exact' });

        if (searchQuery) {
          query = query.ilike('fullname', `%${searchQuery}%`);
        }

        if (advSearchData) {
          Object.keys(advSearchData).forEach(key => {
            if (advSearchData[key]) {
              query = query.eq(key, advSearchData[key]);
            }
          });
        }

        const { data, error, count } = await query.range(from, to);

        if (error) throw error;

        setUsers(data);
        setTotalCount(count || 0);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [page, searchQuery, advSearchData]);

  const handleBulkAction = async (action: 'email' | 'activate' | 'deactivate') => {
    if (selectedUsers.length === 0) return;

    setBulkActionLoading(true);
    setFeedbackMessage(null);

    try {
      let result;
      if (action === 'email') {
        result = await userService.triggerWelcomeEmails(selectedUsers);
      } else {
        const status = action === 'activate' ? 'Active' : 'Inactive';
        result = await userService.bulkUpdateUserStatus(selectedUsers, status);
      }

      if (result.success) {
        setFeedbackMessage({ type: 'success', message: `Successfully performed ${action} action.` });
        // Refresh users list
        // This can be optimized by updating state directly
        const fetchUsers = async () => {
          setLoading(true);
          try {
            const from = (page - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;
            const { data, error, count } = await supabase.from('profiles').select('* ', { count: 'exact' }).range(from, to);
            if (error) throw error;
            setUsers(data);
            setTotalCount(count || 0);
          } catch (error) {
            setError(error.message);
          } finally {
            setLoading(false);
          }
        };
        fetchUsers();
        setSelectedUsers([]);
      } else {
        throw new Error(result.error?.message || 'An unknown error occurred.');
      }
    } catch (error) {
      setFeedbackMessage({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUsers(users.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleAdvancedSearch = (data: any) => {
    setAdvSearchData(data);
    setIsSearchModalOpen(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <AdminLayout title="Users">
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search User"
                className="pl-10 pr-4 py-2 border rounded-lg w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button onClick={() => setIsSearchModalOpen(true)} className="flex items-center space-x-2 text-gray-600">
              <span>Advanced Search</span>
              <FiChevronDown />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 flex justify-between items-center">
            <div>
              <span className="font-semibold">{totalCount}</span> Total Users | <span className="font-semibold">{/* Inactive count */}</span> Inactive Users | <span className="font-semibold">0</span> Unlicensed Users
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleBulkAction('email')} disabled={selectedUsers.length === 0 || bulkActionLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">Trigger Welcome Email</button>
              <button onClick={() => handleBulkAction('deactivate')} disabled={selectedUsers.length === 0 || bulkActionLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400">Bulk Deactivate</button>
              <button onClick={() => handleBulkAction('activate')} disabled={selectedUsers.length === 0 || bulkActionLoading} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">Bulk Activate</button>
            </div>
          </div>

          {feedbackMessage && (
            <div className={`p-4 text-sm ${feedbackMessage.type === 'success' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
              {feedbackMessage.message}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="p-4"><input type="checkbox" onChange={handleSelectAll} /></th>
                  <th scope="col" className="px-6 py-3">User Name</th>
                  <th scope="col" className="px-6 py-3">User ID</th>
                  <th scope="col" className="px-6 py-3">User Email</th>
                  <th scope="col" className="px-6 py-3">Created On</th>
                  <th scope="col" className="px-6 py-3">User Preferred Language</th>
                  <th scope="col" className="px-6 py-3">Allowed Views</th>
                  <th scope="col" className="px-6 py-3">User Status</th>
                  <th scope="col" className="px-6 py-3">Mobile Number</th>
                  <th scope="col" className="px-6 py-3">Company</th>
                  <th scope="col" className="px-6 py-3">Department</th>
                  <th scope="col" className="px-6 py-3">Designation</th>
                  <th scope="col" className="px-6 py-3">Employment Type</th>
                  <th scope="col" className="px-6 py-3">Industry</th>
                  <th scope="col" className="px-6 py-3">Leadership Role</th>
                  <th scope="col" className="px-6 py-3">LinkedIn Partner Access</th>
                  <th scope="col" className="px-6 py-3">Location</th>
                  <th scope="col" className="px-6 py-3">Manager</th>
                  <th scope="col" className="px-6 py-3">Persona</th>
                  <th scope="col" className="px-6 py-3">Team</th>
                  <th scope="col" className="px-6 py-3">Role</th>
                  <th scope="col" className="px-6 py-3">Employee Grade</th>
                  <th scope="col" className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="22" className="text-center py-4">Loading...</td></tr>
                ) : error ? (
                  <tr><td colSpan="23" className="text-center py-4 text-red-500">Error: {error}</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="p-4"><input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => handleSelectUser(user.id)} /></td>
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{user.fullname}</td>
                      <td className="px-6 py-4">{user.user_id}</td>
                      <td className="px-6 py-4">{user.email}</td>
                      <td className="px-6 py-4">{new Date(user.createdat).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{user.preferred_language}</td>
                      <td className="px-6 py-4">{user.allowed_views?.join(', ')}</td>
                      <td className="px-6 py-4">{user.user_status}</td>
                      <td className="px-6 py-4">{user.mobile_number}</td>
                      <td className="px-6 py-4">{user.company}</td>
                      <td className="px-6 py-4">{user.department}</td>
                      <td className="px-6 py-4">{user.designation}</td>
                      <td className="px-6 py-4">{user.employment_type}</td>
                      <td className="px-6 py-4">{user.industry}</td>
                      <td className="px-6 py-4">{user.leadership_role}</td>
                      <td className="px-6 py-4">{user.LinkedInPartnerAccess}</td>
                      <td className="px-6 py-4">{user.location}</td>
                      <td className="px-6 py-4">{user.manager_name}</td>
                      <td className="px-6 py-4">{user.persona}</td>
                      <td className="px-6 py-4">{user.team}</td>
                      <td className="px-6 py-4">{user.role}</td>
                      <td className="px-6 py-4">{user.employee_grade}</td>
                      <td className="px-6 py-4">
                        <Link to={`/admin/users/edit/${user.id}`} className="text-blue-600 hover:text-blue-900">
                          <FiEdit />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 flex justify-between items-center">
            <div>
              {selectedUsers.length > 0 && (
                <>{selectedUsers.length} User{selectedUsers.length > 1 && 's'} Selected <button onClick={() => setSelectedUsers([])} className="text-blue-600">Clear</button></>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>&lt;&lt;</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>&gt;&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default UsersPage;