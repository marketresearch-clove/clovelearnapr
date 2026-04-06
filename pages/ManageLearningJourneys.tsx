import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';
import { supabase } from '../lib/supabaseClient';
import { courseAssignmentService } from '../lib/courseAssignmentService';
import { learningJourneyService, LearningJourney, JourneyModule } from '../lib/learningJourneyService';
import { courseService } from '../lib/courseService';
import { lessonService } from '../lib/lessonService';
import useAuthGuard from '../hooks/useAuthGuard';
import { useAuth } from '../contexts/AuthContext';

import { exportToCSV } from '../lib/exportUtils';
import CareerManagement from '../src/pages/admin/components/CareerManagement';
import UserCareerAssignments from '../src/pages/admin/components/UserCareerAssignments'; // progress/tracking view
import { careerPathService } from '../lib/careerPathService';

interface FilterState {
  department: string[];
  company: string[];
  designation: string[];
  employmentType: string[];
  industry: string[];
  leadershipRole: string[];
  location: string[];
  persona: string[];
  team: string[];
  grade: string[];
}

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
    <div className="w-16 h-16 mx-auto mb-2 relative">
      {user.avatarurl ? (
        <img src={user.avatarurl} alt={user.fullname} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl ${color}`}>
          {getInitials(user.fullname)}
        </div>
      )}
    </div>
  );
};

// Simplified version of the Assign Journeys tab, adapted for career paths
const AssignCareerPathsTab: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [careerPaths, setCareerPaths] = useState<any[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>({});
  const [filters, setFilters] = useState<FilterState>({
    department: [],
    company: [],
    designation: [],
    employmentType: [],
    industry: [],
    leadershipRole: [],
    location: [],
    persona: [],
    team: [],
    grade: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showDesignations, setShowDesignations] = useState(false);
  const [targetDate, setTargetDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, fullname, email, department, designation, location, avatarurl');
      if (usersData) setUsers(usersData);

      const paths = await careerPathService.getCareerPaths();
      setCareerPaths(paths);

      // build filter options from users
      const departments = Array.from(new Set(usersData?.map((u: any) => u.department).filter(Boolean)));
      const designations = Array.from(new Set(usersData?.map((u: any) => u.designation).filter(Boolean)));
      const locations = Array.from(new Set(usersData?.map((u: any) => u.location).filter(Boolean)));
      setFilterOptions({ departments, designations, locations });
    } catch (err) {
      console.error('Error loading users/paths', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let list = [...users];
    if (activeDepartment !== 'All') {
      list = list.filter(u => u.department === activeDepartment);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u =>
        u.fullname?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    // apply advanced filters
    if (filters.department.length) {
      list = list.filter(u => filters.department.includes(u.department));
    }
    if (filters.designation.length) {
      list = list.filter(u => filters.designation.includes(u.designation));
    }
    if (filters.location.length) {
      list = list.filter(u => filters.location.includes(u.location));
    }
    setFilteredUsers(list);
  }, [users, activeDepartment, searchQuery, filters]);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const toggleFilter = (field: keyof FilterState, value: string) => {
    setFilters(prev => {
      const arr = new Set(prev[field]);
      if (arr.has(value)) arr.delete(value);
      else arr.add(value);
      return { ...prev, [field]: Array.from(arr) };
    });
  };

  const togglePath = (id: string) => {
    setSelectedPaths(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (selectedUsers.length === 0 || selectedPaths.length === 0) return;
    setSaving(true);
    try {
      for (const uid of selectedUsers) {
        for (const pid of selectedPaths) {
          await careerPathService.assignUserToCareerPath(uid, pid, targetDate || undefined);
        }
      }
      // after assignment clear selections
      setSelectedUsers([]);
      setSelectedPaths([]);
      setTargetDate('');
      alert('Career paths assigned');
    } catch (err) {
      console.error('Assignment failed', err);
      alert('Failed to assign career paths');
    } finally {
      setSaving(false);
    }
  };

  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => {
      const dep = u.department || 'None';
      counts[dep] = (counts[dep] || 0) + 1;
    });
    return counts;
  }, [users]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        {/* Role Filters duplicated from assign journeys */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveDepartment('All')}
            className={`px-4 py-2 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === 'All' ? 'bg-[#4f46e5] text-white' : 'bg-white text-black border border-black'}`}
          >
            All Users ({users.length})
          </button>
          {Object.entries(departmentCounts).map(([department, count]) => (
            <button
              key={department}
              onClick={() => setActiveDepartment(department)}
              className={`px-4 py-2 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === department ? 'bg-[#4f46e5] text-white' : 'bg-white text-black border border-black'}`}
            >
              {department} ({count})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <h3 className="font-semibold text-gray-900">
                Users - {activeDepartment} ({filteredUsers.length} Users)
              </h3>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Search User"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
                <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} className="text-sm font-medium text-indigo-600 hover:underline">
                  Advanced Search
                </button>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    onChange={toggleAllUsers}
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600"
                  />
                  Select All
                </label>
              </div>
            </div>
          </div>

          {showAdvancedSearch && (
            <div className="p-6 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-900 mb-4">Advanced Search</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {filterOptions.departments && filterOptions.departments.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.departments.map((dept: string) => (
                        <label key={dept} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.department.includes(dept)}
                            onChange={() => toggleFilter('department', dept)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{dept}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.designations && filterOptions.designations.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Designation</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.designations.map((desig: string) => (
                        <label key={desig} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.designation.includes(desig)}
                            onChange={() => toggleFilter('designation', desig)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{desig}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.locations && filterOptions.locations.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.locations.map((loc: string) => (
                        <label key={loc} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.location.includes(loc)}
                            onChange={() => toggleFilter('location', loc)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{loc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.grades && filterOptions.grades.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Employee Grade</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.grades.map((grade: string) => (
                        <label key={grade} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.grade.includes(grade)}
                            onChange={() => toggleFilter('grade', grade)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{grade}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.companies && filterOptions.companies.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.companies.map((company: string) => (
                        <label key={company} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.company.includes(company)}
                            onChange={() => toggleFilter('company', company)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{company}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.employmentTypes && filterOptions.employmentTypes.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Employment Type</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.employmentTypes.map((type: string) => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.employmentType.includes(type)}
                            onChange={() => toggleFilter('employmentType', type)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.industries && filterOptions.industries.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Industry</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.industries.map((industry: string) => (
                        <label key={industry} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.industry.includes(industry)}
                            onChange={() => toggleFilter('industry', industry)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{industry}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.leadershipRoles && filterOptions.leadershipRoles.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Leadership Role</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.leadershipRoles.map((role: string) => (
                        <label key={role} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.leadershipRole.includes(role)}
                            onChange={() => toggleFilter('leadershipRole', role)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.personas && filterOptions.personas.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Persona</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.personas.map((persona: string) => (
                        <label key={persona} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.persona.includes(persona)}
                            onChange={() => toggleFilter('persona', persona)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{persona}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {filterOptions.teams && filterOptions.teams.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {filterOptions.teams.map((team: string) => (
                        <label key={team} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.team.includes(team)}
                            onChange={() => toggleFilter('team', team)}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900">{team}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="max-h-[600px] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedUsers.includes(user.id)
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-200'
                    }`}
                >
                  <UserAvatar user={user} />
                  <div className="text-center">
                    <h4 className="font-bold text-gray-900 text-sm truncate">{user.fullname}</h4>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-1">
                      {user.department && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                          {user.department}
                        </span>
                      )}
                      {user.designation && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                          {user.designation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Career Paths List */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
          <h3 className="font-bold text-gray-900 mb-4">Select Career Paths</h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {careerPaths.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No career paths available</p>
            ) : (
              careerPaths.map(path => (
                <div
                  key={path.id}
                  onClick={() => togglePath(path.id)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedPaths.includes(path.id)
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-200'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{path.source_role} → {path.target_role}</h4>
                      <span className="text-xs text-gray-500 truncate">{path.description}</span>
                    </div>
                    {selectedPaths.includes(path.id) && (
                      <span className="material-symbols-rounded text-indigo-600 text-lg">check_circle</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-600">Selected Users:</span>
              <span className="font-bold text-gray-900">{selectedUsers.length}</span>
            </div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm text-gray-600">Selected Paths:</span>
              <span className="font-bold text-gray-900">{selectedPaths.length}</span>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Date (Optional)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
              />
            </div>

            <button
              onClick={handleAssign}
              disabled={saving || selectedUsers.length === 0 || selectedPaths.length === 0}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Assigning...
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded">assignment_add</span>
                  Assign Paths
                </>
              )}
            </button>
            {(selectedUsers.length === 0 || selectedPaths.length === 0) && (
              <p className="text-xs text-center text-gray-500 mt-2">
                Select at least one user and one career path to assign.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
const ManageLearningJourneys: React.FC = () => {
  useAuthGuard(['admin', 'instructor']);
  const { user } = useAuth();
  const location = useLocation();

  const [journeys, setJourneys] = useState<LearningJourney[]>([]);
  const [selectedJourneys, setSelectedJourneys] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>({});
  const [filters, setFilters] = useState<FilterState>({
    department: [],
    company: [],
    designation: [],
    employmentType: [],
    industry: [],
    leadershipRole: [],
    location: [],
    persona: [],
    team: [],
    grade: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [journeySearchQuery, setJourneySearchQuery] = useState('');
  const [filterJourneyType, setFilterJourneyType] = useState('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showDesignations, setShowDesignations] = useState(false);
  const [activeTab, setActiveTab] = useState<'assign' | 'manage' | 'careerPaths' | 'userCareerAssignments' | 'careerProgress'>('assign');

  // Career Paths View Mode
  const [careerPathsViewMode, setCareerPathsViewMode] = useState<'table' | 'simplified'>('table');
  const [careerPathsList, setCareerPathsList] = useState<any[]>([]);
  const [careerPathsSearchQuery, setCareerPathsSearchQuery] = useState('');
  const [selectedCareerPathForDetails, setSelectedCareerPathForDetails] = useState<any>(null);
  const [userProgressModalOpen, setUserProgressModalOpen] = useState(false);
  const [userProgressData, setUserProgressData] = useState<any[]>([]);
  const [progressModalLoading, setProgressModalLoading] = useState(false);
  const [progressViewMode, setProgressViewMode] = useState<'users' | 'skills'>('users');
  const [skillProgressData, setSkillProgressData] = useState<any[]>([]);
  const [skillProgressLoading, setSkillProgressLoading] = useState(false);

  // Journey Creation/Edit State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);

  // Journey Assignment Start Date
  const [journeyStartDate, setJourneyStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newJourney, setNewJourney] = useState<{
    title: string;
    description: string;
    type: 'Standard' | 'Drip' | 'Flexible';
    modules: Partial<JourneyModule>[];
  }>({
    title: '',
    description: '',
    type: 'Standard',
    modules: []
  });

  // Assignment Management State
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
  const [currentJourneyAssignments, setCurrentJourneyAssignments] = useState<any[]>([]);
  const [selectedJourneyForAssignments, setSelectedJourneyForAssignments] = useState<LearningJourney | null>(null);
  const [refreshingAssignments, setRefreshingAssignments] = useState(false);

  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Career Path Creation State
  const [showCreateCareerPathModal, setShowCreateCareerPathModal] = useState(false);
  const [editingCareerPathId, setEditingCareerPathId] = useState<string | null>(null);
  const [availableSkillsForCareerPath, setAvailableSkillsForCareerPath] = useState<any[]>([]);
  const [careerPathSkillSearch, setCareerPathSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [newCareerPath, setNewCareerPath] = useState({
    currentRole: '',
    nextRole: '',
    description: '',
    skillRequirements: [] as Array<{
      skillId: string;
      skillName: string;
      skillFamily: string;
      level: 'Beginner' | 'Intermediate' | 'Advanced';
      min_score_beginner: number;
      min_score_intermediate: number;
      min_score_advanced: number;
    }>
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, filters, searchQuery, activeDepartment]);

  useEffect(() => {
    if (courseSearchQuery.length > 2) {
      searchCourses();
    } else {
      setSearchResults([]);
    }
  }, [courseSearchQuery]);

  // Handle URL parameters to set active tab and selected items
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const journeyIdParam = params.get('journeyId');
    const careerPathIdParam = params.get('careerPathId');

    if (tabParam) {
      setActiveTab(tabParam as any);
    }

    if (journeyIdParam && tabParam === 'manage') {
      // Set the journey to be edited/viewed
      setEditingJourneyId(journeyIdParam);
    }

    if (careerPathIdParam && tabParam === 'careerPaths') {
      // Set the career path to be viewed
      setSelectedCareerPathForDetails(
        careerPathsList.find((cp: any) => cp.id === careerPathIdParam) || null
      );
    }
  }, [location.search, careerPathsList]);

  // Fetch skills for career path modal
  useEffect(() => {
    if (showCreateCareerPathModal && availableSkillsForCareerPath.length === 0) {
      const fetchSkills = async () => {
        try {
          const { data } = await supabase.from('skills').select('id, name, family');
          if (data) setAvailableSkillsForCareerPath(data);
        } catch (error) {
          console.error('Error fetching skills:', error);
        }
      };
      fetchSkills();
    }
  }, [showCreateCareerPathModal]);

  const searchCourses = async () => {
    const results = await courseService.searchCourses(courseSearchQuery);
    setSearchResults(results);
  };

  const departmentCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const user of users) {
      const department = user.department || 'Other';
      counts[department] = (counts[department] || 0) + 1;
    }
    return counts;
  }, [users]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [journeysData, usersData, filterValues, careerPathsData] = await Promise.all([
        learningJourneyService.getJourneys(),
        courseAssignmentService.getAllUsers(),
        courseAssignmentService.getUniqueFilterValues(),
        careerPathService.getCareerPaths(),
      ]);

      setJourneys(journeysData);
      setUsers(usersData);
      setFilterOptions(filterValues);
      setFilteredUsers(usersData);
      setCareerPathsList(careerPathsData || []);
    } catch (error) {
      setErrorMessage('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = users;

    if (activeDepartment !== 'All') {
      filtered = filtered.filter(u => u.department === activeDepartment);
    }

    if (showAdvancedSearch) {
      if (filters.department.length > 0) {
        filtered = filtered.filter(u => filters.department.includes(u.department));
      }
      if (filters.company.length > 0) {
        filtered = filtered.filter(u => filters.company.includes(u.company));
      }
      if (filters.designation.length > 0) {
        filtered = filtered.filter(u => filters.designation.includes(u.designation));
      }
      if (filters.employmentType.length > 0) {
        filtered = filtered.filter(u => filters.employmentType.includes(u.employment_type));
      }
      if (filters.industry.length > 0) {
        filtered = filtered.filter(u => filters.industry.includes(u.industry));
      }
      if (filters.leadershipRole.length > 0) {
        filtered = filtered.filter(u => filters.leadershipRole.includes(u.leadership_role));
      }
      if (filters.location.length > 0) {
        filtered = filtered.filter(u => filters.location.includes(u.location));
      }
      if (filters.persona.length > 0) {
        filtered = filtered.filter(u => filters.persona.includes(u.persona));
      }
      if (filters.team.length > 0) {
        filtered = filtered.filter(u => filters.team.includes(u.team));
      }
      if (filters.grade.length > 0) {
        filtered = filtered.filter(u => filters.grade.includes(u.grade));
      }
    }

    if (searchQuery) {
      filtered = filtered.filter(u =>
        u.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
    setSelectedUsers([]);
  };

  const toggleFilter = (filterType: keyof FilterState, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[filterType].includes(value)) {
        newFilters[filterType] = newFilters[filterType].filter(v => v !== value);
      } else {
        newFilters[filterType] = [...newFilters[filterType], value];
      }

      if (filterType === 'department') {
        setShowDesignations(newFilters.department.length > 0);
        if (newFilters.department.length === 0) {
          newFilters.designation = [];
        }
        setActiveDepartment('All');
      }

      return newFilters;
    });
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleJourney = (journeyId: string) => {
    setSelectedJourneys(prev =>
      prev.includes(journeyId) ? prev.filter(id => id !== journeyId) : [...prev, journeyId]
    );
  };

  const handleAssignJourneys = async () => {
    if (selectedUsers.length === 0 || selectedJourneys.length === 0) {
      setErrorMessage('Please select at least one user and one journey');
      return;
    }

    if (!journeyStartDate) {
      setErrorMessage('Please select a start date for the journey');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');

      for (const journeyId of selectedJourneys) {
        await learningJourneyService.assignJourneyToUsers(
          selectedUsers,
          journeyId,
          user?.id || '',
          undefined,
          journeyStartDate
        );
      }

      setSuccessMessage(`Successfully assigned ${selectedJourneys.length} journey(s) to ${selectedUsers.length} user(s) starting ${new Date(journeyStartDate).toLocaleDateString()}`);
      setSelectedUsers([]);
      setSelectedJourneys([]);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to assign journeys');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateJourney = async () => {
    if (!newJourney.title) {
      setErrorMessage('Journey title is required');
      return;
    }

    try {
      setSaving(true);

      let journeyId = editingJourneyId;

      if (editingJourneyId) {
        // Update existing journey
        await learningJourneyService.updateJourney(editingJourneyId, {
          title: newJourney.title,
          description: newJourney.description,
          type: newJourney.type,
        });

        // For simplicity, we'll delete all modules and recreate them
        // A better approach would be to diff them, but this ensures sequence and data are correct
        await learningJourneyService.deleteJourneyModules(editingJourneyId);
      } else {
        // Create new journey
        const createdJourney = await learningJourneyService.createJourney({
          title: newJourney.title,
          description: newJourney.description,
          type: newJourney.type,
        });
        journeyId = createdJourney.id;
      }

      if (journeyId) {
        // Create Modules
        for (let i = 0; i < newJourney.modules.length; i++) {
          const module = newJourney.modules[i];
          await learningJourneyService.addModuleToJourney({
            journey_id: journeyId,
            title: module.title || 'Untitled Module',
            type: module.type || 'Micro-Learning Module',
            course_id: module.course_id,
            duration: module.duration,
            sequence_order: i + 1,
            unlock_days_after_start: module.unlock_days_after_start || 0,
            image_url: module.image_url,
            provider: module.provider
          });
        }
      }

      setSuccessMessage(editingJourneyId ? 'Journey updated successfully' : 'Journey created successfully');
      setShowCreateModal(false);
      setNewJourney({ title: '', description: '', type: 'Standard', modules: [] });
      setEditingJourneyId(null);
      loadInitialData();
    } catch (error) {
      console.error('Error saving journey:', error);
      setErrorMessage('Failed to save journey');
    } finally {
      setSaving(false);
    }
  };

  const handleEditJourney = async (journey: LearningJourney) => {
    try {
      setLoading(true);
      const modules = await learningJourneyService.getJourneyModules(journey.id);

      setNewJourney({
        title: journey.title,
        description: journey.description || '',
        type: journey.type,
        modules: modules
      });
      setEditingJourneyId(journey.id);
      setShowCreateModal(true);
    } catch (error) {
      console.error('Error loading journey details:', error);
      setErrorMessage('Failed to load journey details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJourney = async (journeyId: string) => {
    if (!window.confirm('Are you sure you want to delete this journey? This will also delete all user assignments and progress.')) {
      return;
    }

    try {
      setSaving(true);
      await learningJourneyService.deleteJourney(journeyId);
      setSuccessMessage('Journey deleted successfully');
      loadInitialData();
    } catch (error) {
      console.error('Error deleting journey:', error);
      setErrorMessage('Failed to delete journey');
    } finally {
      setSaving(false);
    }
  };

  const handleExportJourneys = () => {
    const dataToExport = filteredJourneys.map(j => ({
      Title: j.title,
      Type: j.type,
      Description: j.description || '',
      CreatedAt: new Date(j.created_at).toLocaleDateString()
    }));
    exportToCSV(dataToExport, 'Learning_Journeys');
  };

  const filteredJourneys = journeys.filter(j => {
    const matchesSearch = j.title.toLowerCase().includes(journeySearchQuery.toLowerCase());
    const matchesType = filterJourneyType === 'all' || j.type === filterJourneyType;
    return matchesSearch && matchesType;
  });

  const handleViewAssignments = async (journey: LearningJourney) => {
    try {
      setLoading(true);
      setSelectedJourneyForAssignments(journey);
      const assignments = await learningJourneyService.getAssignmentsByJourney(journey.id);

      // Fetch module progress for all assignments
      const { data: allModuleProgress } = await supabase
        .from('user_journey_module_progress')
        .select('*, module:journey_modules(*)')
        .in('user_journey_id', assignments.map(a => a.id));

      const modules = await learningJourneyService.getJourneyModules(journey.id);

      // Map assignments to include user details and module progress
      const assignmentsWithUsers = assignments.map(assignment => {
        const user = users.find(u => u.id === assignment.user_id);
        const moduleProgress = (allModuleProgress || [])
          .filter(p => p.user_journey_id === assignment.id)
          .sort((a, b) => (a.module?.sequence_order || 0) - (b.module?.sequence_order || 0));

        return { ...assignment, user, moduleProgress, modules };
      }).filter(a => a.user);

      setCurrentJourneyAssignments(assignmentsWithUsers);
      setShowAssignmentsModal(true);
    } catch (error) {
      console.error('Error loading assignments:', error);
      setErrorMessage('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignUser = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to unassign this user? Their progress will be lost.')) {
      return;
    }

    try {
      await learningJourneyService.deleteAssignment(assignmentId);
      setCurrentJourneyAssignments(prev => prev.filter(a => a.id !== assignmentId));
      setSuccessMessage('User unassigned successfully');
    } catch (error) {
      console.error('Error unassigning user:', error);
      setErrorMessage('Failed to unassign user');
    }
  };

  const handleRefreshAssignments = async () => {
    if (!selectedJourneyForAssignments) return;
    try {
      setRefreshingAssignments(true);
      const assignments = await learningJourneyService.getAssignmentsByJourney(selectedJourneyForAssignments.id);

      // Fetch module progress for all assignments
      const { data: allModuleProgress } = await supabase
        .from('user_journey_module_progress')
        .select('*, module:journey_modules(*)')
        .in('user_journey_id', assignments.map(a => a.id));

      const modules = await learningJourneyService.getJourneyModules(selectedJourneyForAssignments.id);

      // Map assignments to include user details and module progress
      const assignmentsWithUsers = assignments.map(assignment => {
        const user = users.find(u => u.id === assignment.user_id);
        const moduleProgress = (allModuleProgress || [])
          .filter(p => p.user_journey_id === assignment.id)
          .sort((a, b) => (a.module?.sequence_order || 0) - (b.module?.sequence_order || 0));

        return { ...assignment, user, moduleProgress, modules };
      }).filter(a => a.user);

      setCurrentJourneyAssignments(assignmentsWithUsers);
      setSuccessMessage('Progress updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error refreshing assignments:', error);
      setErrorMessage('Failed to refresh assignments');
    } finally {
      setRefreshingAssignments(false);
    }
  };

  const addModule = async (course?: any) => {
    let duration = '';

    if (course) {
      try {
        const lessons = await lessonService.getLessonsByCourseId(course.id);
        if (lessons && lessons.length > 0) {
          const totalMinutes = lessons.reduce((acc: number, lesson: any) => {
            return acc + (lesson.duration || 0);
          }, 0);

          if (totalMinutes > 0) {
            duration = `${totalMinutes} mins`;
          } else {
            duration = course.duration ? `${course.duration} mins` : '';
          }
        } else {
          duration = course.duration ? `${course.duration} mins` : '';
        }
      } catch (error) {
        console.error('Error calculating course duration:', error);
        duration = course.duration ? `${course.duration} mins` : '';
      }
    }

    setNewJourney(prev => {
      const newModules = [...prev.modules, {
        title: course ? course.title : '',
        type: course ? 'Course' : 'Micro-Learning Module',
        course_id: course?.id,
        duration: duration,
        image_url: course?.thumbnail,
        provider: course?.instructorname,
        unlock_days_after_start: 0
      }];

      // Auto-calculate total duration if needed, though currently duration is a string "X mins"
      // We could parse and sum it up if we had a total duration field for the journey

      return {
        ...prev,
        modules: newModules
      };
    });
    setCourseSearchQuery('');
    setSearchResults([]);
  };

  const removeModule = (index: number) => {
    setNewJourney(prev => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== index)
    }));
  };

  const updateModule = (index: number, field: string, value: any) => {
    setNewJourney(prev => ({
      ...prev,
      modules: prev.modules.map((m, i) => i === index ? { ...m, [field]: value } : m)
    }));
  };

  const filteredCareerPaths = useMemo(() => {
    let filtered = careerPathsList;
    if (careerPathsSearchQuery) {
      const query = careerPathsSearchQuery.toLowerCase();
      filtered = filtered.filter(path =>
        path.source_role?.toLowerCase().includes(query) ||
        path.target_role?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [careerPathsList, careerPathsSearchQuery]);

  const handleViewCareerPathDetails = async (path: any) => {
    setSelectedCareerPathForDetails(path);
    setUserProgressModalOpen(true);
    setProgressModalLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_career_paths')
        .select(`
          *,
          profiles:user_id (fullname, email, department)
        `)
        .eq('career_path_id', path.id);

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        user_name: item.profiles?.fullname || 'Unknown',
        user_email: item.profiles?.email || '',
        department: item.profiles?.department || '',
        source_role: item.source_role_name || '',
        target_role: item.target_role_name || '',
        readiness: item.readiness_percentage || 0,
        status: item.status || 'pending',
        assigned_at: item.assigned_at || '',
        target_date: item.target_date || ''
      }));

      setUserProgressData(formattedData);
    } catch (err) {
      console.error('Error fetching user progress:', err);
    } finally {
      setProgressModalLoading(false);
    }
  };

  const fetchSkillProgress = async () => {
    if (!selectedCareerPathForDetails) return;
    setSkillProgressLoading(true);
    try {
      // First get the career path with skill requirements
      const { data: careerPathData, error: careerPathError } = await supabase
        .from('career_paths')
        .select('skill_requirements')
        .eq('id', selectedCareerPathForDetails.id)
        .single();

      if (careerPathError) throw careerPathError;

      // Extract skill IDs from skill_requirements JSONB
      const skillRequirements = careerPathData?.skill_requirements || [];
      const requiredSkillIds = Array.isArray(skillRequirements)
        ? skillRequirements.map((s: any) => s.id || s.skill_id).filter(Boolean)
        : [];

      if (requiredSkillIds.length === 0) {
        setSkillProgressData([]);
        return;
      }

      // Get all users assigned to this career path
      const { data: userCareerPaths, error: careerError } = await supabase
        .from('user_career_paths')
        .select('user_id')
        .eq('career_path_id', selectedCareerPathForDetails.id);

      if (careerError) throw careerError;

      const userIds = (userCareerPaths || []).map(item => item.user_id);

      if (userIds.length === 0) {
        setSkillProgressData([]);
        return;
      }

      // Get skill achievements for these users for the required skills
      const { data: skillData, error: skillError } = await supabase
        .from('user_skill_achievements')
        .select('skill_id, skill_name, course_level, percentage_achieved, user_id')
        .in('user_id', userIds)
        .in('skill_id', requiredSkillIds);

      if (skillError) throw skillError;

      // Group and aggregate skills
      const skillMap = new Map<string, any>();
      (skillData || []).forEach(item => {
        const key = item.skill_id;
        if (!skillMap.has(key)) {
          skillMap.set(key, {
            skill_id: item.skill_id,
            skill_name: item.skill_name,
            users_count: new Set(),
            levels: [],
            total_percentage: 0,
            count: 0
          });
        }
        const skill = skillMap.get(key);
        skill.users_count.add(item.user_id || 'unknown');
        if (item.course_level) skill.levels.push(item.course_level);
        skill.total_percentage += (item.percentage_achieved || 0);
        skill.count += 1;
      });

      // Convert to array and calculate averages
      const aggregatedSkills = Array.from(skillMap.values()).map(skill => ({
        id: skill.skill_id,
        skill_name: skill.skill_name || 'Unknown Skill',
        users_count: skill.users_count.size,
        avg_proficiency: skill.count > 0 ? Math.round(skill.total_percentage / skill.count) : 0,
        levels: skill.levels.length > 0 ? skill.levels.join(', ') : 'N/A',
        total_assignments: skill.count
      }));

      setSkillProgressData(aggregatedSkills);
    } catch (err) {
      console.error('Error fetching skill progress:', err);
    } finally {
      setSkillProgressLoading(false);
    }
  };

  const handleProgressViewChange = (mode: 'users' | 'skills') => {
    setProgressViewMode(mode);
    if (mode === 'skills' && skillProgressData.length === 0) {
      fetchSkillProgress();
    }
  };

  const SimplifiedCareerPathsView = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="w-full sm:w-80">
          <div className="relative">
            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              type="text"
              placeholder="Search career paths..."
              value={careerPathsSearchQuery}
              onChange={(e) => setCareerPathsSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCareerPaths.map(path => (
          <div key={path.id} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg line-clamp-2">{path.source_role}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-400">→</span>
                  <p className="text-sm text-indigo-600 font-semibold">{path.target_role}</p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-6 flex-1">
              {path.description || 'Career path for skill development and progression.'}
            </p>

            <div className="border-t border-gray-200 pt-4 mt-auto">
              <button
                onClick={() => handleViewCareerPathDetails(path)}
                className="w-full py-2 px-4 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-rounded">info</span>
                View Details
              </button>
            </div>
          </div>
        ))}

        {filteredCareerPaths.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <span className="material-symbols-rounded text-4xl text-gray-400 mb-2">trending_up</span>
            <p className="text-gray-500">No career paths found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );

  // Helper functions for career path skill management
  const addSkillToCareerPath = (skillId: string) => {
    const skill = availableSkillsForCareerPath.find(s => s.id === skillId);
    if (!skill) return;

    // Check if skill already added
    if (newCareerPath.skillRequirements.some(r => r.skillId === skillId)) {
      return;
    }

    setNewCareerPath({
      ...newCareerPath,
      skillRequirements: [
        ...newCareerPath.skillRequirements,
        {
          skillId: skill.id,
          skillName: skill.name,
          skillFamily: skill.family,
          level: 'Intermediate',
          min_score_beginner: 20,
          min_score_intermediate: 50,
          min_score_advanced: 70,
        },
      ],
    });
    setCareerPathSkillSearch('');
    setShowSkillDropdown(false);
  };

  const removeSkillFromCareerPath = (skillId: string) => {
    setNewCareerPath({
      ...newCareerPath,
      skillRequirements: newCareerPath.skillRequirements.filter(r => r.skillId !== skillId),
    });
  };

  const updateCareerPathSkillLevel = (skillId: string, level: 'Beginner' | 'Intermediate' | 'Advanced') => {
    setNewCareerPath({
      ...newCareerPath,
      skillRequirements: newCareerPath.skillRequirements.map(r =>
        r.skillId === skillId ? { ...r, level } : r
      ),
    });
  };

  const filteredSkillsForCareerPath = availableSkillsForCareerPath.filter(
    skill =>
      !newCareerPath.skillRequirements.some(r => r.skillId === skill.id) &&
      (skill.name.toLowerCase().includes(careerPathSkillSearch.toLowerCase()) ||
        skill.family.toLowerCase().includes(careerPathSkillSearch.toLowerCase()))
  );

  return (
    <AdminLayout title="Learning Journey Management">
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader size="lg" message="Loading learning journeys..." />
        </div>
      ) : (
        <div className="space-y-6">
          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Learning Journey Management</h2>
              <p className="text-gray-600 mt-1">Create, manage, and assign learning journeys.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditingJourneyId(null);
                  setNewJourney({ title: '', description: '', type: 'Standard', modules: [] });
                  setShowCreateModal(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-rounded">add</span>
                Create Journey
              </button>
              <button
                onClick={() => {
                  setEditingCareerPathId(null);
                  setNewCareerPath({
                    currentRole: '',
                    nextRole: '',
                    description: '',
                    skillRequirements: []
                  });
                  setShowCreateCareerPathModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-rounded">add</span>
                Create Career Path
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('assign')}
                className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'assign'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
              >
                Assign Journeys
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'manage'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
              >
                Manage Journeys
              </button>
              <button
                onClick={() => setActiveTab('careerPaths')}
                className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'careerPaths'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
              >
                Career Paths
              </button>
              <button
                onClick={() => setActiveTab('careerProgress')}
                className={
                  `
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'careerProgress'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
              >
                Manage Career Paths
              </button>
              <button
                onClick={() => setActiveTab('userCareerAssignments')}
                className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'userCareerAssignments'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
              >
                User Career Paths
              </button>
            </nav>
          </div>

          {activeTab === 'assign' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">

                {/* Role Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveDepartment('All')}
                    className={`px-4 py-2 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === 'All' ? 'bg-[#4f46e5] text-white' : 'bg-white text-black border border-black'}`}
                  >
                    All Users ({users.length})
                  </button>
                  {Object.entries(departmentCounts).map(([department, count]) => (
                    <button
                      key={department}
                      onClick={() => setActiveDepartment(department)}
                      className={`px-4 py-2 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === department ? 'bg-[#4f46e5] text-white' : 'bg-white text-black border border-black'}`}
                    >
                      {department} ({count})
                    </button>
                  ))}
                </div>

                {/* Users List */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                      <h3 className="font-semibold text-gray-900">
                        Users - {activeDepartment} ({filteredUsers.length} Users)
                      </h3>
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          placeholder="Search User"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                        <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} className="text-sm font-medium text-indigo-600 hover:underline">
                          Advanced Search
                        </button>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            onChange={toggleAllUsers}
                            checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600"
                          />
                          Select All
                        </label>
                      </div>
                    </div>
                  </div>

                  {showAdvancedSearch && (
                    <div className="p-6 border-b border-gray-200 bg-white">
                      <h3 className="font-semibold text-gray-900 mb-4">Advanced Search</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {/* Filter Grid */}
                        {filterOptions.departments && filterOptions.departments.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.departments.map((dept: string) => (
                                <label key={dept} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.department.includes(dept)}
                                    onChange={() => toggleFilter('department', dept)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{dept}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.designations && filterOptions.designations.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Designation</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.designations.map((desig: string) => (
                                <label key={desig} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.designation.includes(desig)}
                                    onChange={() => toggleFilter('designation', desig)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{desig}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.locations && filterOptions.locations.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.locations.map((loc: string) => (
                                <label key={loc} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.location.includes(loc)}
                                    onChange={() => toggleFilter('location', loc)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{loc}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.grades && filterOptions.grades.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Employee Grade</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.grades.map((grade: string) => (
                                <label key={grade} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.grade.includes(grade)}
                                    onChange={() => toggleFilter('grade', grade)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{grade}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.companies && filterOptions.companies.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.companies.map((company: string) => (
                                <label key={company} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.company.includes(company)}
                                    onChange={() => toggleFilter('company', company)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{company}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.employmentTypes && filterOptions.employmentTypes.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Employment Type</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.employmentTypes.map((type: string) => (
                                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.employmentType.includes(type)}
                                    onChange={() => toggleFilter('employmentType', type)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{type}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.industries && filterOptions.industries.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Industry</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.industries.map((industry: string) => (
                                <label key={industry} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.industry.includes(industry)}
                                    onChange={() => toggleFilter('industry', industry)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{industry}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.leadershipRoles && filterOptions.leadershipRoles.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Leadership Role</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.leadershipRoles.map((role: string) => (
                                <label key={role} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.leadershipRole.includes(role)}
                                    onChange={() => toggleFilter('leadershipRole', role)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{role}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.personas && filterOptions.personas.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Persona</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.personas.map((persona: string) => (
                                <label key={persona} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.persona.includes(persona)}
                                    onChange={() => toggleFilter('persona', persona)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{persona}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterOptions.teams && filterOptions.teams.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                              {filterOptions.teams.map((team: string) => (
                                <label key={team} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={filters.team.includes(team)}
                                    onChange={() => toggleFilter('team', team)}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{team}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="max-h-[600px] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
                      {filteredUsers.map(user => (
                        <div
                          key={user.id}
                          onClick={() => toggleUser(user.id)}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedUsers.includes(user.id)
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-200'
                            }`}
                        >
                          <UserAvatar user={user} />
                          <div className="text-center">
                            <h4 className="font-bold text-gray-900 text-sm truncate">{user.fullname}</h4>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            <div className="mt-2 flex flex-wrap justify-center gap-1">
                              {user.department && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                                  {user.department}
                                </span>
                              )}
                              {user.designation && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                                  {user.designation}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar - Journeys List */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
                  <h3 className="font-bold text-gray-900 mb-4">Select Journeys</h3>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {journeys.map(journey => (
                      <div
                        key={journey.id}
                        onClick={() => toggleJourney(journey.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedJourneys.includes(journey.id)
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-200'
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{journey.title}</h4>
                            <span className="text-xs text-gray-500">{journey.type}</span>
                          </div>
                          {selectedJourneys.includes(journey.id) && (
                            <span className="material-symbols-rounded text-indigo-600 text-lg">check_circle</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-gray-600">Selected Users:</span>
                      <span className="font-bold text-gray-900">{selectedUsers.length}</span>
                    </div>
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-sm text-gray-600">Selected Journeys:</span>
                      <span className="font-bold text-gray-900">{selectedJourneys.length}</span>
                    </div>

                    {/* Journey Start Date Picker */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Journey Start Date
                      </label>
                      <input
                        type="date"
                        value={journeyStartDate}
                        onChange={(e) => setJourneyStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                      <p className="text-xs text-gray-600 mt-2">
                        ℹ️ Journey will start immediately with this date. Module unlock dates will be calculated from this date.
                      </p>
                    </div>

                    <button
                      onClick={handleAssignJourneys}
                      disabled={saving || selectedUsers.length === 0 || selectedJourneys.length === 0}
                      className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Assigning...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-rounded">assignment_add</span>
                          Assign Journeys
                        </>
                      )}
                    </button>
                    {(selectedUsers.length === 0 || selectedJourneys.length === 0) && (
                      <p className="text-xs text-center text-gray-500 mt-2">
                        Select at least one user and one journey to assign.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
                  <div className="relative w-full sm:w-80">
                    <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-white-400">search</span>
                    <input
                      type="text"
                      placeholder="Search journeys..."
                      value={journeySearchQuery}
                      onChange={(e) => setJourneySearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <select
                    value={filterJourneyType}
                    onChange={(e) => setFilterJourneyType(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Types</option>
                    <option value="Standard">Standard</option>
                    <option value="Drip">Drip</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </div>
                <button
                  onClick={handleExportJourneys}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold"
                >
                  <span className="material-symbols-rounded">download</span>
                  Export Journeys
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredJourneys.map(journey => (
                  <div key={journey.id} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{journey.title}</h3>
                        <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] rounded-full mt-1 font-bold uppercase">
                          {journey.type}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditJourney(journey)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Journey"
                        >
                          <span className="material-symbols-rounded text-xl">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteJourney(journey.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Journey"
                        >
                          <span className="material-symbols-rounded text-xl">delete</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-6 flex-1 line-clamp-3">
                      {journey.description || 'No description provided.'}
                    </p>

                    <div className="border-t border-gray-200 pt-4 mt-auto">
                      <button
                        onClick={() => handleViewAssignments(journey)}
                        className="w-full py-2 px-4 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-rounded">group</span>
                        Manage Assignments
                      </button>
                    </div>
                  </div>
                ))}

                {filteredJourneys.length === 0 && (
                  <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <span className="material-symbols-rounded text-4xl text-gray-400 mb-2">school</span>
                    <p className="text-gray-500">No learning journeys found matching your filters.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'careerPaths' && <CareerManagement />}
          {activeTab === 'careerProgress' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900">Manage Career Paths</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCareerPathsViewMode('table')}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${careerPathsViewMode === 'table'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    title="Table View"
                  >
                    <span className="material-symbols-rounded text-lg">table_chart</span>
                    Table
                  </button>
                  <button
                    onClick={() => setCareerPathsViewMode('simplified')}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${careerPathsViewMode === 'simplified'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    title="Card View"
                  >
                    <span className="material-symbols-rounded text-lg">dashboard</span>
                    Cards
                  </button>
                </div>
              </div>
              {careerPathsViewMode === 'simplified' ? <SimplifiedCareerPathsView /> : <UserCareerAssignments />}
            </div>
          )}
          {activeTab === 'userCareerAssignments' && <AssignCareerPathsTab />}
        </div>
      )}

      {/* User Career Path Progress Modal */}
      {userProgressModalOpen && selectedCareerPathForDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Progress Tracking</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCareerPathForDetails.source_role} → {selectedCareerPathForDetails.target_role}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleProgressViewChange('users')}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${progressViewMode === 'users'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <span className="material-symbols-rounded">group</span>
                    Users
                  </button>
                  <button
                    onClick={() => handleProgressViewChange('skills')}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${progressViewMode === 'skills'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <span className="material-symbols-rounded">trending_up</span>
                    Skills
                  </button>
                </div>
                <button
                  onClick={() => setUserProgressModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {progressViewMode === 'users' ? (
                <>
                  {progressModalLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                  ) : userProgressData.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No users assigned to this career path yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white border-b border-gray-200">
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">User Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Email</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Department</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Readiness</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Assigned Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Target Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userProgressData.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-white">
                              <td className="px-4 py-3 text-gray-900 font-medium">{item.user_name}</td>
                              <td className="px-4 py-3 text-gray-600">{item.user_email}</td>
                              <td className="px-4 py-3 text-gray-600">{item.department}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-indigo-600 h-2 rounded-full"
                                      style={{ width: `${item.readiness}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-bold text-gray-700">{item.readiness}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : item.status === 'in_progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                  }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {item.assigned_at ? new Date(item.assigned_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {item.target_date ? new Date(item.target_date).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {skillProgressLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                  ) : skillProgressData.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No skills data available for this career path yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white border-b border-gray-200">
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Skill Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Users Working On Skill</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Average Proficiency</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Levels Achieved</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Total Assignments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skillProgressData.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-white">
                              <td className="px-4 py-3 text-gray-900 font-medium">{item.skill_name}</td>
                              <td className="px-4 py-3 text-gray-600">{item.users_count}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-green-600 h-2 rounded-full"
                                      style={{ width: `${item.avg_proficiency}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-bold text-gray-700">{item.avg_proficiency}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{item.levels}</td>
                              <td className="px-4 py-3 text-gray-600 text-center">{item.total_assignments}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Journey Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">
                {editingJourneyId ? 'Edit Learning Journey' : 'Create New Learning Journey'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Journey Title</label>
                  <input
                    type="text"
                    value={newJourney.title}
                    onChange={(e) => setNewJourney(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g., Onboarding 2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Journey Type</label>
                  <select
                    value={newJourney.type}
                    onChange={(e) => setNewJourney(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Drip">Drip (Time-released)</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newJourney.description}
                    onChange={(e) => setNewJourney(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={3}
                    placeholder="Describe the purpose of this journey..."
                  />
                  {newJourney.type === 'Standard' && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-semibold">Standard Journey:</span> Modules are unlocked sequentially. Users must complete the previous module to unlock the next one.
                    </p>
                  )}
                  {newJourney.type === 'Flexible' && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-semibold">Flexible Journey:</span> All modules are unlocked immediately. Users can complete them in any order.
                    </p>
                  )}
                  {newJourney.type === 'Drip' && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-semibold">Drip Journey:</span> Modules are unlocked based on a schedule (days after start).
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-bold text-gray-900 mb-4">Journey Modules</h4>

                {/* Course Search */}
                <div className="mb-6 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Course as Module</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={courseSearchQuery}
                      onChange={(e) => setCourseSearchQuery(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Search for courses..."
                    />
                    <button
                      onClick={() => addModule()}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white text-gray-700 font-medium"
                    >
                      Add Custom Module
                    </button>
                  </div>

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-10">
                      {searchResults.map(course => (
                        <div
                          key={course.id}
                          onClick={() => addModule(course)}
                          className="p-3 hover:bg-white cursor-pointer flex items-center gap-3 border-b border-gray-100 last:border-0"
                        >
                          <img src={course.thumbnail || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded object-cover" />
                          <div>
                            <div className="font-medium text-gray-900">{course.title}</div>
                            <div className="text-xs text-gray-500">{course.instructorname} • {course.duration} mins</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modules Table */}
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white">
                        <th className="p-3 border-b border-gray-200 font-semibold text-gray-700 w-12">#</th>
                        <th className="p-3 border-b border-gray-200 font-semibold text-gray-700 min-w-[200px]">Module Title</th>
                        <th className="p-3 border-b border-gray-200 font-semibold text-gray-700 w-40">Type</th>
                        <th className="p-3 border-b border-gray-200 font-semibold text-gray-700 w-32">Duration</th>
                        {newJourney.type === 'Drip' && (
                          <th className="p-3 border-b border-gray-200 font-semibold text-gray-700 w-32">Unlock (Days)</th>
                        )}
                        <th className="p-3 border-b border-gray-200 font-semibold text-gray-700 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newJourney.modules.map((module, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-white">
                          <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={module.title}
                              onChange={(e) => updateModule(idx, 'title', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                              placeholder="Module Title"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={module.type}
                              onChange={(e) => updateModule(idx, 'type', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                            >
                              <option value="Micro-Learning Module">Micro-Learning</option>
                              <option value="Classroom Module">Classroom</option>
                              <option value="Course">Course</option>
                              <option value="General feedback">Feedback</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={module.duration}
                              onChange={(e) => updateModule(idx, 'duration', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                              placeholder="e.g. 30 mins"
                            />
                          </td>
                          {newJourney.type === 'Drip' && (
                            <td className="p-3">
                              <input
                                type="number"
                                value={module.unlock_days_after_start}
                                onChange={(e) => updateModule(idx, 'unlock_days_after_start', parseInt(e.target.value))}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                                min="0"
                                placeholder="0"
                              />
                            </td>
                          )}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => removeModule(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Remove Module"
                            >
                              <span className="material-symbols-rounded text-xl">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {newJourney.modules.length === 0 && (
                        <tr>
                          <td colSpan={newJourney.type === 'Drip' ? 6 : 5} className="p-8 text-center text-gray-500">
                            No modules added yet. Search for courses or add custom modules above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-white">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJourney}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded">save</span>
                    {editingJourneyId ? 'Update Journey' : 'Create Journey'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Career Path Modal */}
      {showCreateCareerPathModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <span className="material-symbols-rounded text-blue-600">trending_up</span>
                  {editingCareerPathId ? 'Edit Career Path' : 'Create Career Path'}
                </h2>
                <p className="text-gray-600 text-sm mt-2">Define roles and required skills for career progression</p>
              </div>
              <button
                onClick={() => setShowCreateCareerPathModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Role Information Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-rounded text-indigo-600">person_search</span>
                  Role Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCareerPath.currentRole}
                      onChange={(e) => setNewCareerPath({ ...newCareerPath, currentRole: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                      placeholder="e.g. Customer Service Manager"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCareerPath.nextRole}
                      onChange={(e) => setNewCareerPath({ ...newCareerPath, nextRole: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                      placeholder="e.g. Customer Service Director"
                    />
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newCareerPath.description}
                  onChange={(e) => setNewCareerPath({ ...newCareerPath, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                  rows={2}
                  placeholder="Optional description of the career progression"
                />
              </div>

              {/* Skill Requirements Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-rounded text-amber-600">diamond</span>
                  Skill Requirements
                </h4>

                {/* Searchable Skill Dropdown */}
                <div className="relative mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Search skills..."
                        value={careerPathSkillSearch}
                        onChange={(e) => {
                          setCareerPathSkillSearch(e.target.value);
                          setShowSkillDropdown(true);
                        }}
                        onFocus={() => setShowSkillDropdown(true)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                      />
                      {showSkillDropdown && filteredSkillsForCareerPath.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {filteredSkillsForCareerPath.map(skill => (
                            <button
                              key={skill.id}
                              onClick={() => addSkillToCareerPath(skill.id)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium">{skill.name}</div>
                              <div className="text-xs text-gray-500">{skill.family}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                      className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
                    >
                      <span className="material-symbols-rounded text-lg">add</span>
                      Add Skill
                    </button>
                  </div>
                </div>

                {/* Added Skills List */}
                <div className="space-y-3 border border-gray-300 rounded-lg p-4 max-h-56 overflow-y-auto bg-gray-50">
                  {newCareerPath.skillRequirements.length > 0 ? (
                    newCareerPath.skillRequirements.map(skill => (
                      <div key={skill.skillId} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-900">{skill.skillName}</p>
                            <p className="text-xs text-gray-500 mt-1">{skill.skillFamily}</p>
                          </div>
                          <button
                            onClick={() => removeSkillFromCareerPath(skill.skillId)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors px-2 py-1 hover:bg-red-50 rounded"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 pt-3 border-t border-gray-100">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Proficiency Level
                            </label>
                            <select
                              value={skill.level}
                              onChange={(e) =>
                                updateCareerPathSkillLevel(
                                  skill.skillId,
                                  e.target.value as 'Beginner' | 'Intermediate' | 'Advanced'
                                )
                              }
                              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                            >
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No skills added yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateCareerPathModal(false)}
                className="px-4 py-2 text-gray-700 font-medium border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newCareerPath.currentRole || !newCareerPath.nextRole) {
                    alert('Please fill in all required fields');
                    return;
                  }
                  if (newCareerPath.skillRequirements.length === 0) {
                    alert('Please add at least one skill requirement');
                    return;
                  }
                  // TODO: Implement career path creation logic
                  alert('Career path creation will be implemented');
                  setShowCreateCareerPathModal(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-rounded">check_circle</span>
                {editingCareerPathId ? 'Update Path' : 'Create Path'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignments Management Modal */}
      {showAssignmentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Manage Assignments</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedJourneyForAssignments?.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshAssignments}
                  disabled={refreshingAssignments}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh progress"
                >
                  <span className={`material-symbols-rounded ${refreshingAssignments ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                </button>
                <button onClick={() => setShowAssignmentsModal(false)} className="text-gray-500 hover:text-gray-700">
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
            </div>

            <div className="p-0 overflow-y-auto flex-1">
              {currentJourneyAssignments.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {currentJourneyAssignments.map((assignment) => (
                    <div key={assignment.id} className="p-6 hover:bg-white transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                            {assignment.user?.fullname?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{assignment.user?.fullname}</div>
                            <div className="text-xs text-gray-500">{assignment.user?.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Assigned Date</div>
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : '-'}
                            </div>
                          </div>
                          {assignment.start_date && (
                            <div className="text-right">
                              <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Start Date</div>
                              <div className="text-sm font-medium text-gray-900">
                                {new Date(assignment.start_date).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                          <div className="text-right">
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Status</div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize
                              ${assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'}`}>
                              {assignment.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-right min-w-[100px]">
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Overall Progress</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-20 overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${assignment.progress || 0}%` }}></div>
                              </div>
                              <span className="text-sm font-bold text-gray-900">{assignment.progress || 0}%</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnassignUser(assignment.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Unassign User"
                          >
                            <span className="material-symbols-rounded">person_remove</span>
                          </button>
                        </div>
                      </div>

                      {/* Module Progress Grid */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Module Breakdown</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {assignment.modules?.map((module: any) => {
                            const progress = assignment.moduleProgress?.find((p: any) => p.module_id === module.id);
                            return (
                              <div key={module.id} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm">
                                <div className="flex-1 min-w-0 mr-3">
                                  <div className="text-sm font-bold text-gray-900 truncate" title={module.title}>
                                    {module.title}
                                  </div>
                                  <div className="text-[10px] text-gray-500 uppercase font-medium">{module.type}</div>
                                </div>
                                <div className="flex-shrink-0">
                                  {progress?.status === 'completed' ? (
                                    <span className="material-symbols-rounded text-green-500">check_circle</span>
                                  ) : progress?.status === 'unlocked' ? (
                                    <span className="material-symbols-rounded text-blue-500 animate-pulse">pending</span>
                                  ) : (
                                    <span className="material-symbols-rounded text-gray-300">lock</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="material-symbols-rounded text-4xl text-gray-300 mb-2">person_off</span>
                  <p className="text-gray-500">No users assigned to this journey yet.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-white flex justify-end">
              <button
                onClick={() => setShowAssignmentsModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageLearningJourneys;
