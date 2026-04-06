import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { careerPathService } from '../../../../lib/careerPathService';
import { userSkillAchievementService } from '../../../../lib/userSkillAchievementService';

import { exportToCSV } from '../../../../lib/exportUtils';

const UserAvatar = ({ user }: { user: any }) => {
  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return `${name[0]}`.toUpperCase();
  };

  const colors = [
    'bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-indigo-500',
    'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'
  ];

  const color = colors[user.fullname?.length % colors.length || 0];

  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 overflow-hidden">
      {user.avatarurl ? (
        <img src={user.avatarurl} alt={user.fullname} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${color}`}>
          {getInitials(user.fullname)}
        </div>
      )}
    </div>
  );
};

interface User {
  id: string;
  fullname?: string;
  email?: string;
  department?: string;
}

interface CareerPath {
  id: string;
  source_role: string;
  target_role: string;
}

interface UserCareerPath {
  id: string;
  user_id: string;
  career_path_id: string;
  source_role_name: string;
  target_role_name: string;
  readiness_percentage: number;
  status: string;
  assigned_at?: string;
  target_date?: string;
  user_name?: string;
  avatarurl?: string;
}

const UserCareerAssignments: React.FC = () => {
  const [userCareerPaths, setUserCareerPaths] = useState<UserCareerPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTargetRole, setFilterTargetRole] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableCareerPaths, setAvailableCareerPaths] = useState<CareerPath[]>([]);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [selectedAssignmentForView, setSelectedAssignmentForView] = useState<UserCareerPath | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedPathForAssignments, setSelectedPathForAssignments] = useState<CareerPath | null>(null);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);

  const [assignFormData, setAssignFormData] = useState({
    targetUserIds: [] as string[],
    departmentFilter: 'all',
    careerPathId: '',
    targetDate: ''
  });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSkillProgress, setUserSkillProgress] = useState<any[]>([]);

  useEffect(() => {
    fetchUserCareerPaths();
    fetchFormData();
  }, []);

  // if department filter changes, drop any selected users outside that department
  useEffect(() => {
    const dept = assignFormData.departmentFilter;
    if (dept === 'all') return;
    setAssignFormData(prev => ({
      ...prev,
      targetUserIds: prev.targetUserIds.filter(id => {
        const user = availableUsers.find(u => u.id === id);
        return user && user.department === dept;
      })
    }));
  }, [assignFormData.departmentFilter, availableUsers]);

  const fetchFormData = async () => {
    try {
      const { data: usersData } = await supabase.from('profiles').select('id, fullname, email, department, avatarurl');
      const paths = await careerPathService.getCareerPaths();

      if (usersData) setAvailableUsers(usersData);
      if (paths) setAvailableCareerPaths(paths);
    } catch (error) {
      console.error('Error fetching form data:', error);
    }
  };

  const fetchUserCareerPaths = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_career_paths')
        .select(`
          *,
          profiles:user_id (fullname, email, department, avatarurl)
        `)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      const mappedData = (data || []).map((item: any) => ({
        ...item,
        user_name: item.profiles?.fullname || item.profiles?.email || item.user_id,
        avatarurl: item.profiles?.avatarurl || '',
        department: item.profiles?.department || ''
      }));

      setUserCareerPaths(mappedData);
    } catch (error) {
      console.error('Error fetching user career paths:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCareerPath = async () => {
    if (assignFormData.targetUserIds.length === 0 || !assignFormData.careerPathId) {
      alert('Please select at least one user and a career path');
      return;
    }

    try {
      for (const userId of assignFormData.targetUserIds) {
        await careerPathService.assignUserToCareerPath(
          userId,
          assignFormData.careerPathId,
          assignFormData.targetDate || undefined
        );
        await updateReadiness(userId, assignFormData.careerPathId);
      }

      setIsAssignModalOpen(false);
      setAssignFormData({ targetUserIds: [], departmentFilter: 'all', careerPathId: '', targetDate: '' });
      fetchUserCareerPaths();
      alert('Career path assigned successfully!');
    } catch (error) {
      console.error('Error assigning career path:', error);
      alert('Failed to assign career path');
    }
  };

  const updateReadiness = async (userId: string, careerPathId: string) => {
    try {
      await careerPathService.updateCareerReadiness(userId, careerPathId);
      fetchUserCareerPaths();
    } catch (error) {
      console.error('Error updating readiness:', error);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this career path assignment?')) return;

    try {
      const assignment = userCareerPaths.find(a => a.id === id);
      if (assignment) {
        await careerPathService.removeUserFromCareerPath(assignment.user_id, assignment.career_path_id);
        fetchUserCareerPaths();
        setOpenMenuId(null);
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Failed to remove assignment');
    }
  };

  const handleViewAssignments = async (path: CareerPath) => {
    setSelectedPathForAssignments(path);
    setShowAssignmentsModal(true);
  };

  const handleViewProgress = async (assignment: UserCareerPath) => {
    try {
      setOpenMenuId(null);
      setSelectedAssignmentForView(assignment);
      setShowProgressModal(true);
      setModalLoading(true);

      const progress = await userSkillAchievementService.getSkillProgressForCareerPath(
        assignment.user_id,
        assignment.career_path_id
      );

      setUserSkillProgress(progress);
    } catch (error) {
      console.error('Error loading skill progress:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready for Promotion':
        return 'bg-green-100 text-green-900';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-900';
      case 'Completed':
        return 'bg-blue-100 text-blue-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  const getReadinessColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleExport = () => {
    const dataToExport = filteredPaths.map(item => ({
      User: item.user_name,
      CurrentRole: item.source_role_name,
      TargetRole: item.target_role_name,
      Readiness: `${item.readiness_percentage}`,
      Status: item.status,
      AssignedAt: item.assigned_at ? new Date(item.assigned_at).toLocaleDateString() : '-'
    }));
    exportToCSV(dataToExport, 'User_Career_Paths');
  };

  const filteredPaths = userCareerPaths.filter(item => {
    const matchesSearch =
      item.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source_role_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.target_role_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      item.status === filterStatus;

    const matchesTarget =
      filterTargetRole === 'all' ||
      item.target_role_name === filterTargetRole;

    const matchesDepartment =
      filterDepartment === 'all' ||
      item.department === filterDepartment;

    return matchesSearch && matchesStatus && matchesTarget && matchesDepartment;
  });

  const statuses = Array.from(new Set(userCareerPaths.map(item => item.status)));
  const targetRoles = Array.from(new Set(userCareerPaths.map(item => item.target_role_name)));
  const departments = Array.from(new Set(userCareerPaths.map(item => item.department).filter(Boolean)));

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              type="text"
              placeholder="Search User Career Paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            value={filterTargetRole}
            onChange={(e) => setFilterTargetRole(e.target.value)}
            className="px-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Target Roles</option>
            {targetRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Departments</option>
            {departments.map(dep => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-rounded">download</span>
            Export
          </button>
          <button
            onClick={() => {
              setAssignFormData({ targetUserIds: [], departmentFilter: 'all', careerPathId: '', targetDate: '' });
              setIsAssignModalOpen(true);
            }}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-rounded">add</span>
            Assign Career Path
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="pb-3 pl-2 font-semibold text-gray-600">User</th>
              <th className="pb-3 font-semibold text-gray-600">Current Role</th>
              <th className="pb-3 font-semibold text-gray-600">Target Role</th>
              <th className="pb-3 font-semibold text-gray-600">Readiness</th>
              <th className="pb-3 font-semibold text-gray-600">Status</th>
              <th className="pb-3 font-semibold text-gray-600">Assigned At</th>
              <th className="pb-3 pr-2 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-4 text-gray-500">Loading assignments...</td>
              </tr>
            ) : filteredPaths.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4 text-gray-500">No career path assignments found</td>
              </tr>
            ) : (
              filteredPaths.map(item => (
                <tr key={item.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={item} />
                      <span className="font-medium text-gray-900 text-sm">{item.user_name}</span>
                    </div>
                  </td>
                  <td className="py-4 text-gray-600">{item.source_role_name}</td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{item.target_role_name}</span>
                      <span className="material-symbols-rounded text-gray-400 text-sm">arrow_forward</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                        <div
                          className={`h-2 rounded-full ${item.readiness_percentage >= 80
                            ? 'bg-green-600'
                            : item.readiness_percentage >= 50
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                            }`}
                          style={{ width: `${item.readiness_percentage}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${getReadinessColor(item.readiness_percentage)}`}>
                        {item.readiness_percentage}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs  font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 text-gray-600">
                    {item.assigned_at ? new Date(item.assigned_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-4 pr-2 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <span className="material-symbols-rounded">more_horiz</span>
                      </button>
                      {openMenuId === item.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg z-10 border border-gray-200">
                          <button
                            onClick={() => handleViewProgress(item)}
                            className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-50 first:rounded-t-lg font-medium"
                          >
                            View Progress
                          </button>
                          <button
                            onClick={() => updateReadiness(item.user_id, item.career_path_id)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                          >
                            Refresh Readiness
                          </button>
                          <button
                            onClick={() => handleRemoveAssignment(item.id)}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 last:rounded-b-lg font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assign Career Path to User</h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={assignFormData.departmentFilter}
                  onChange={(e) => setAssignFormData({ ...assignFormData, departmentFilter: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                >
                  <option value="all">All Departments</option>
                  {Array.from(new Set(availableUsers.map(u => u.department || '')))
                    .filter(d => d)
                    .map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                </select>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Users
                </label>
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="w-full px-3 py-2 mb-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Users <span className="text-red-500">*</span>
                </label>
                <div className="h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                  {availableUsers
                    .filter(u => {
                      const dept = assignFormData.departmentFilter;
                      const matchesDept = dept === 'all' || u.department === dept;
                      const search = userSearchQuery.toLowerCase();
                      const matchesSearch =
                        u.fullname?.toLowerCase().includes(search) ||
                        u.email?.toLowerCase().includes(search);
                      return matchesDept && (!userSearchQuery || matchesSearch);
                    })
                    .map(user => (
                      <label key={user.id} className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-blue-600"
                          checked={assignFormData.targetUserIds.includes(user.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAssignFormData(prev => {
                              const ids = new Set(prev.targetUserIds);
                              if (checked) ids.add(user.id);
                              else ids.delete(user.id);
                              return { ...prev, targetUserIds: Array.from(ids) };
                            });
                          }}
                        />
                        <span className="text-sm text-gray-900">
                          {user.fullname || user.email || user.id}
                          {user.department ? ` (${user.department})` : ''}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Career Path <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignFormData.careerPathId}
                  onChange={(e) => setAssignFormData({ ...assignFormData, careerPathId: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select a career path</option>
                  {availableCareerPaths.map(path => (
                    <option key={path.id} value={path.id}>
                      {path.source_role} → {path.target_role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Date (Optional)
                </label>
                <input
                  type="date"
                  value={assignFormData.targetDate}
                  onChange={(e) => setAssignFormData({ ...assignFormData, targetDate: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignCareerPath}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Assign Path
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && selectedAssignmentForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Career Readiness Details
                </h3>
                <p className="text-sm text-gray-500">
                  User: <span className="font-medium text-gray-900">{selectedAssignmentForView.user_name}</span> |
                  Target: <span className="font-medium text-gray-900">{selectedAssignmentForView.target_role_name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowProgressModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-gray-50">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-500">Loading user achievements...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Header */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500">Overall Readiness</span>
                        <span className={`text-2xl font-bold ${getReadinessColor(selectedAssignmentForView.readiness_percentage)}`}>
                          {selectedAssignmentForView.readiness_percentage}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${selectedAssignmentForView.readiness_percentage >= 80 ? 'bg-green-500' :
                            selectedAssignmentForView.readiness_percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          style={{ width: `${selectedAssignmentForView.readiness_percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Status</p>
                        <p className={`text-sm font-bold mt-1 ${selectedAssignmentForView.status === 'Ready for Promotion' ? 'text-green-600' : 'text-yellow-600'
                          }`}>{selectedAssignmentForView.status}</p>
                      </div>
                    </div>
                  </div>

                  {/* Skills List */}
                  <div className="grid grid-cols-1 gap-4">
                    <h4 className="font-bold text-gray-900 px-1">Required Skills Breakdown</h4>
                    {userSkillProgress.map((skill: any, idx: number) => (
                      <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <h5 className="font-bold text-gray-900 flex items-center gap-2">
                              {skill.skill_name}
                              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {skill.skill_family}
                              </span>
                            </h5>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span>Required Level: <b className="text-gray-700">{skill.required_level}</b></span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">{skill.percentage_achieved} Match</div>
                            <div className="text-xs text-gray-500">Current: {skill.user_achieved_level}</div>
                          </div>
                        </div>

                        {/* Courses/Assignments */}
                        {skill.completed_courses && skill.completed_courses.length > 0 ? (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Acquired Via</p>
                            <div className="flex flex-wrap gap-2">
                              {skill.completed_courses.map((course: any, cIdx: number) => (
                                <div key={cIdx} className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs border border-blue-100">
                                    <span className="material-symbols-rounded text-sm">
                                      {course.course_title === 'Manually Assigned' ? 'admin_panel_settings' : 'school'}
                                    </span>
                                    <span className="font-medium">{course.course_title || course.course_level}</span>
                                    <span className="opacity-50 text-[10px]">({course.course_level})</span>
                                  </div>
                                  {course.expiry_date && (
                                    <span className="text-[10px] text-amber-600 font-bold ml-1">
                                      Expires: {new Date(course.expiry_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400 italic">
                            <span className="material-symbols-rounded text-sm">info</span>
                            No relevant courses completed yet
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowProgressModal(false)}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCareerAssignments;
