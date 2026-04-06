import React, { useState } from 'react';
import AdminLayout from '../components/AdminLayout';

interface User {
  id: string;
  fullName: string;
  employeeId: string;
  email: string;
  mobile: string;
  department: string;
  designation: string;
  role: 'Admin' | 'Instructor' | 'Learner' | 'Guest';
  status: 'active' | 'inactive' | 'suspended';
  joiningDate: string;
  lastLogin: string;
  learningHours: number;
  coursesCompleted: number;
  profilePhoto?: string;
}

const Users: React.FC = () => {
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const mockUsers: User[] = [
    {
      id: '1',
      fullName: 'John Smith',
      employeeId: 'EMP001',
      email: 'john.smith@company.com',
      mobile: '+1-555-0101',
      department: 'Engineering',
      designation: 'Senior Engineer',
      role: 'Learner',
      status: 'active',
      joiningDate: '2022-01-15',
      lastLogin: '2025-12-11',
      learningHours: 120,
      coursesCompleted: 8,
    },
    {
      id: '2',
      fullName: 'Sarah Johnson',
      employeeId: 'EMP002',
      email: 'sarah.johnson@company.com',
      mobile: '+1-555-0102',
      department: 'Sales',
      designation: 'Sales Manager',
      role: 'Instructor',
      status: 'active',
      joiningDate: '2021-06-20',
      lastLogin: '2025-12-10',
      learningHours: 95,
      coursesCompleted: 12,
    },
    {
      id: '3',
      fullName: 'Michael Brown',
      employeeId: 'EMP003',
      email: 'michael.brown@company.com',
      mobile: '+1-555-0103',
      department: 'Marketing',
      designation: 'Marketing Lead',
      role: 'Learner',
      status: 'active',
      joiningDate: '2023-03-10',
      lastLogin: '2025-12-09',
      learningHours: 60,
      coursesCompleted: 5,
    },
    {
      id: '4',
      fullName: 'Emily Davis',
      employeeId: 'EMP004',
      email: 'emily.davis@company.com',
      mobile: '+1-555-0104',
      department: 'HR',
      designation: 'HR Manager',
      role: 'Admin',
      status: 'active',
      joiningDate: '2020-11-05',
      lastLogin: '2025-12-11',
      learningHours: 150,
      coursesCompleted: 18,
    },
  ];

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = !filterDept || user.department === filterDept;
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || user.status === filterStatus;
    
    return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  const departments = Array.from(new Set(mockUsers.map(u => u.department)));
  const roles: ('Admin' | 'Instructor' | 'Learner' | 'Guest')[] = ['Admin', 'Instructor', 'Learner', 'Guest'];
  const statuses: ('active' | 'inactive' | 'suspended')[] = ['active', 'inactive', 'suspended'];

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Employee Directory</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-rounded text-base">add</span>
              New User
            </button>
            <button className="border border-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors">
              <span className="material-symbols-rounded text-base">download</span>
              Export
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">search</span>
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-gray-900 placeholder-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-gray-900"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-gray-900"
              >
                <option value="">All Roles</option>
                {roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-gray-900"
              >
                <option value="">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status} className="capitalize">{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
              <button className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-primary hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-rounded text-base">tune</span>
                More Filters
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {!selectedUser ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Learning Hours</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="font-medium text-primary hover:underline"
                        >
                          {user.fullName}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.employeeId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.department}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' :
                          user.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.learningHours}h</td>
                      <td className="px-6 py-4">
                        <button className="text-gray-400 hover:text-gray-600 p-1">
                          <span className="material-symbols-rounded text-base">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-600">Showing {filteredUsers.length} of {mockUsers.length} users</p>
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-100">Previous</button>
                <button className="px-3 py-1 border border-gray-200 rounded text-sm bg-primary text-white">1</button>
                <button className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-100">2</button>
                <button className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-100">Next</button>
              </div>
            </div>
          </div>
        ) : (
          /* User Profile View */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedUser(null)}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <span className="material-symbols-rounded text-base">arrow_back</span>
              Back to Users
            </button>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-8 border-b border-gray-200 flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {selectedUser.fullName.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedUser.fullName}</h2>
                  <p className="text-gray-500">{selectedUser.designation}</p>
                </div>
                <div className="flex gap-3">
                  <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</button>
                  <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <span className="material-symbols-rounded text-base">more_vert</span>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex gap-8 px-8 overflow-x-auto">
                  {['Overview', 'Learning Activity', 'Attendance', 'Documents', 'Notes', 'Audit Log'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '-'))}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                        activeTab === tab.toLowerCase().replace(' ', '-')
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-8">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Personal Details</h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-gray-500">Full Name</p>
                          <p className="text-gray-900">{selectedUser.fullName}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Employee ID</p>
                          <p className="text-gray-900">{selectedUser.employeeId}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Email</p>
                          <p className="text-gray-900">{selectedUser.email}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Mobile</p>
                          <p className="text-gray-900">{selectedUser.mobile}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Employment Details</h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-gray-500">Department</p>
                          <p className="text-gray-900">{selectedUser.department}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Designation</p>
                          <p className="text-gray-900">{selectedUser.designation}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date of Joining</p>
                          <p className="text-gray-900">{new Date(selectedUser.joiningDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">System Details</h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-gray-500">Role</p>
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {selectedUser.role}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-500">Status</p>
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                            selectedUser.status === 'active' ? 'bg-green-100 text-green-800' :
                            selectedUser.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {selectedUser.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-500">Last Login</p>
                          <p className="text-gray-900">{new Date(selectedUser.lastLogin).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'learning-activity' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-gray-500 text-sm">Courses Completed</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedUser.coursesCompleted}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-gray-500 text-sm">Learning Hours</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedUser.learningHours}h</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-gray-500 text-sm">Average Score</p>
                        <p className="text-2xl font-bold text-gray-900">85%</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">Recent Learning Activity</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Advanced React Patterns</p>
                            <p className="text-sm text-gray-500">Completed on 2025-12-01</p>
                          </div>
                          <span className="text-sm font-semibold text-green-600">Completed</span>
                        </div>
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">TypeScript Mastery</p>
                            <p className="text-sm text-gray-500">In Progress - 65% complete</p>
                          </div>
                          <span className="text-sm font-semibold text-yellow-600">In Progress</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'attendance' && (
                  <div className="text-center py-12">
                    <span className="material-symbols-rounded text-4xl text-gray-400 block mb-3">event</span>
                    <p className="text-gray-500">No attendance records available</p>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="text-center py-12">
                    <span className="material-symbols-rounded text-4xl text-gray-400 block mb-3">description</span>
                    <p className="text-gray-500">No documents uploaded</p>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <textarea
                      placeholder="Add notes about this user..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-gray-900 placeholder-gray-500"
                      rows={4}
                    />
                    <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                      Save Notes
                    </button>
                  </div>
                )}

                {activeTab === 'audit-log' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      <span className="material-symbols-rounded text-gray-400 text-base flex-shrink-0 mt-0.5">info</span>
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-gray-900">User role updated</p>
                        <p className="text-gray-500">Changed from Learner to Instructor by Admin</p>
                        <p className="text-xs text-gray-400 mt-1">2025-11-15 10:30 AM</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      <span className="material-symbols-rounded text-gray-400 text-base flex-shrink-0 mt-0.5">assignment</span>
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-gray-900">Course assigned</p>
                        <p className="text-gray-500">Advanced React Patterns assigned</p>
                        <p className="text-xs text-gray-400 mt-1">2025-11-01 03:15 PM</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Users;
