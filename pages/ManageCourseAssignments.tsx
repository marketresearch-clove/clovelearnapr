import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { courseAssignmentService } from '../lib/courseAssignmentService';
import { courseService, testDatabaseConnectivity } from '../lib/courseService';
import useAuthGuard from '../hooks/useAuthGuard';
import Loader from '../components/Loader';

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

interface ManageCourseAssignmentsProps {
  hideLayout?: boolean;
}

const ManageCourseAssignments: React.FC<ManageCourseAssignmentsProps> = ({ hideLayout = false }) => {
  useAuthGuard(['admin', 'instructor']);
  const location = useLocation();
  const selectedCourseId = (location.state as any)?.selectedCourseId;

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
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
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [showDesignations, setShowDesignations] = useState(false);
  const [mandatoryCourses, setMandatoryCourses] = useState<Set<string>>(new Set());
  const [courseDueDates, setCourseDueDates] = useState<Map<string, string>>(new Map());
  const [showDatePicker, setShowDatePicker] = useState<Set<string>>(new Set());
  const [coursePage, setCoursePage] = useState(0);
  const coursesPerPage = 10;
  const [userPage, setUserPage] = useState(0);
  const usersPerPage = 20;
  const [assignmentDetails, setAssignmentDetails] = useState<any[]>([]);
  const [courseFilterCategories, setCourseFilterCategories] = useState<string[]>([]);

  const loadInitialDataRef = React.useRef<boolean>(false);

  useEffect(() => {
    // Prevent multiple calls in strict mode
    if (loadInitialDataRef.current) return;
    loadInitialDataRef.current = true;

    let timeoutId: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const initData = async () => {
      timeoutId = setTimeout(() => {
        if (loading && isComponentMounted) {
          console.error('⏱️ Data loading timeout - forcing UI update');
          setLoading(false);
          setErrorMessage('Data loading timed out. Please refresh the page.');
        }
      }, 30000); // Increased to 30 seconds

      try {
        await loadInitialData();
        if (timeoutId) clearTimeout(timeoutId);
      } catch (err) {
        console.error('Error in data loading:', err);
      }
    };

    initData();

    return () => {
      isComponentMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (selectedCourseId && courses.length > 0) {
      setSelectedCourses([selectedCourseId]);
    }
  }, [selectedCourseId, courses]);

  useEffect(() => {
    applyFilters();
    setUserPage(0); // Reset to first page when filters change
  }, [users, filters, searchQuery, activeDepartment]);

  useEffect(() => {
    setCoursePage(0);
  }, [courseSearchQuery, courseFilterCategories]);

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
      setErrorMessage('');
      let hasError = false;

      // Run diagnostic test first
      console.log('🔧 [ManageCourseAssignments] Running diagnostic test...');
      const diagnosticResult = await testDatabaseConnectivity();
      if (!diagnosticResult.success) {
        console.error('❌ [ManageCourseAssignments] Diagnostic failed:', diagnosticResult.message);
        setErrorMessage(`🔴 Database Connection Error: ${diagnosticResult.message}`);
        setLoading(false);
        return;
      }
      console.log('✅ [ManageCourseAssignments] Diagnostic passed:', diagnosticResult.message);

      // Load courses
      let coursesData = [];
      let courseLoadError = '';
      try {
        console.log('📚 [ManageCourseAssignments] Fetching courses...');
        coursesData = await courseService.getCourses();
        console.log(`✅ [ManageCourseAssignments] Successfully loaded ${coursesData.length} courses`);

        // Log hidden courses separately for debugging
        const hiddenCourses = coursesData.filter((c: any) => c.is_hidden === true);
        console.log(`👁️ [ManageCourseAssignments] Hidden courses: ${hiddenCourses.length}`);
        if (hiddenCourses.length > 0) {
          console.log('🔒 [ManageCourseAssignments] Hidden course list:', hiddenCourses.map((c: any) => c.title));
        }

        // Ensure all courses have is_hidden property (default to false if missing)
        const normalizedCourses = coursesData.map((course: any) => ({
          ...course,
          is_hidden: course.is_hidden === true
        }));

        setCourses(normalizedCourses);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('❌ [ManageCourseAssignments] Error loading courses:', errorMsg);
        courseLoadError = errorMsg;
        hasError = true;
        setCourses([]);
      }

      // Load users
      let usersData = [];
      let userLoadError = '';
      try {
        console.log('👥 [ManageCourseAssignments] Fetching users...');
        usersData = await courseAssignmentService.getAllUsers();
        console.log(`✅ [ManageCourseAssignments] Successfully loaded ${usersData.length} users`);
        if (!usersData || usersData.length === 0) {
          console.warn('⚠️ [ManageCourseAssignments] No users found in database');
        }
        setUsers(usersData);
        setFilteredUsers(usersData);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('❌ [ManageCourseAssignments] Error loading users:', errorMsg);
        userLoadError = errorMsg;
        hasError = true;
        setUsers([]);
        setFilteredUsers([]);
      }

      // Load filter options
      try {
        console.log('🔍 [ManageCourseAssignments] Fetching filter values...');
        const filterValues = await courseAssignmentService.getUniqueFilterValues();
        console.log('✅ [ManageCourseAssignments] Loaded filter values');
        setFilterOptions(filterValues);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn('⚠️ [ManageCourseAssignments] Error loading filter values (not critical):', errorMsg);
        // Don't fail if filters don't load, just proceed without them
      }

      if (hasError) {
        let detailMsg = 'Some data failed to load.';
        if (courseLoadError && userLoadError) {
          detailMsg = `Courses: ${courseLoadError}. Users: ${userLoadError}`;
        } else if (courseLoadError) {
          detailMsg = `Courses failed to load: ${courseLoadError}`;
        } else if (userLoadError) {
          detailMsg = `Users failed to load: ${userLoadError}`;
        }
        setErrorMessage(`⚠️ ${detailMsg}. Please refresh the page.`);
      }
    } catch (error) {
      console.error('Unexpected error in loadInitialData:', error);
      setErrorMessage('An unexpected error occurred. Please refresh the page.');
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
    // FIXED: Don't reset selectedUsers here - preserve user selections when filters change
    // Only filter out users who are no longer in the filtered list
    const validSelectedUsers = selectedUsers.filter(userId =>
      filtered.some(u => u.id === userId)
    );
    setSelectedUsers(validSelectedUsers);
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

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const toggleAllCourses = () => {
    const filteredCourses = getFilteredCourses();
    if (selectedCourses.length === filteredCourses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(filteredCourses.map(c => c.id));
    }
  };

  const toggleDatePicker = (courseId: string) => {
    const newShowPicker = new Set(showDatePicker);
    if (newShowPicker.has(courseId)) {
      newShowPicker.delete(courseId);
    } else {
      newShowPicker.add(courseId);
    }
    setShowDatePicker(newShowPicker);
  };

  const setDueDate = (courseId: string, date: string) => {
    const newDueDates = new Map(courseDueDates);
    if (date) {
      newDueDates.set(courseId, date);
    } else {
      newDueDates.delete(courseId);
    }
    setCourseDueDates(newDueDates);
  };

  const handleAssignCourses = async () => {
    if (selectedUsers.length === 0 || selectedCourses.length === 0) {
      setErrorMessage('Please select at least one user and one course');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      console.log('[ManageCourseAssignments] Starting course assignments...', {
        users: selectedUsers.length,
        courses: selectedCourses.length
      });

      // Build detailed assignment info
      const details: any[] = [];
      const selectedUserObjects = users.filter(u => selectedUsers.includes(u.id));
      const selectedCourseObjects = courses.filter(c => selectedCourses.includes(c.id));

      for (const user of selectedUserObjects) {
        const hiddenAssignments = selectedCourseObjects.filter(c => c.is_hidden);
        if (hiddenAssignments.length > 0) {
          details.push({
            userId: user.id,
            userName: user.fullname,
            action: 'assigned',
            hiddenCourses: hiddenAssignments,
            timestamp: new Date().toLocaleString()
          });
        }
      }

      for (const courseId of selectedCourses) {
        const isMandatory = mandatoryCourses.has(courseId);
        const dueDate = courseDueDates.get(courseId);
        console.log(`[ManageCourseAssignments] Assigning course ${courseId}. Mandatory: ${isMandatory}, DueDate: ${dueDate}`);
        await courseAssignmentService.assignCoursesToUsers(
          selectedUsers,
          [courseId],
          isMandatory,
          dueDate
        );
      }

      // Clear caches after successful assignment
      console.log('[ManageCourseAssignments] Clearing assignment caches...');
      courseAssignmentService.clearAssignmentCaches();

      setSuccessMessage(`✓ Successfully assigned ${selectedCourses.length} course(s) to ${selectedUsers.length} user(s)`);
      if (details.length > 0) {
        setAssignmentDetails(prev => [...prev, ...details]);
      }
      setSelectedCourses([]);
      setMandatoryCourses(new Set());
      setCourseDueDates(new Map());
      setShowDatePicker(new Set());
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[ManageCourseAssignments] Error assigning courses:', error);
      setErrorMessage(`Failed to assign courses: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCourses = async () => {
    if (selectedUsers.length === 0 || selectedCourses.length === 0) {
      setErrorMessage('Please select at least one user and one course');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      console.log('[ManageCourseAssignments] Starting course removal...', {
        users: selectedUsers.length,
        courses: selectedCourses.length
      });

      // Build detailed removal info for hidden courses
      const details: any[] = [];
      const selectedUserObjects = users.filter(u => selectedUsers.includes(u.id));
      const selectedCourseObjects = courses.filter(c => selectedCourses.includes(c.id));

      for (const user of selectedUserObjects) {
        const hiddenRemovals = selectedCourseObjects.filter(c => c.is_hidden);
        if (hiddenRemovals.length > 0) {
          details.push({
            userId: user.id,
            userName: user.fullname,
            action: 'removed',
            hiddenCourses: hiddenRemovals,
            timestamp: new Date().toLocaleString()
          });
        }
      }

      await courseAssignmentService.removeCoursesFromUsers(selectedUsers, selectedCourses);

      // Clear caches after successful removal
      console.log('[ManageCourseAssignments] Clearing assignment caches...');
      courseAssignmentService.clearAssignmentCaches();

      setSuccessMessage(`✓ Successfully removed ${selectedCourses.length} course(s) from ${selectedUsers.length} user(s)`);
      if (details.length > 0) {
        setAssignmentDetails(prev => [...prev, ...details]);
      }
      setSelectedCourses([]);
      setMandatoryCourses(new Set());
      setCourseDueDates(new Map());
      setShowDatePicker(new Set());
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[ManageCourseAssignments] Error removing courses:', error);
      setErrorMessage(`Failed to remove courses: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const uniqueCourseCategories = useMemo(() => {
    return [
      ...new Set(
        courses
          .map(course => String(course.category || '').trim())
          .filter(category => category.length > 0)
      )
    ];
  }, [courses]);

  const getFilteredCourses = () => {
    // Always show hidden courses in admin assignment panel for admins to assign to specific users
    return courses
      .filter(course => course.title.toLowerCase().includes(courseSearchQuery.toLowerCase()))
      .filter(course => courseFilterCategories.length === 0 || courseFilterCategories.includes(String(course.category || '').trim()));
  };

  const handleCourseScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;

    if (isNearBottom) {
      const filteredCount = getFilteredCourses().length;
      const maxPages = Math.ceil(filteredCount / coursesPerPage);
      if (coursePage < maxPages - 1) {
        setCoursePage(prev => prev + 1);
      }
    }
  };

  const getDisplayedCourses = () => {
    const filtered = getFilteredCourses();
    const startIndex = 0;
    const endIndex = (coursePage + 1) * coursesPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const content = (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <span className="material-symbols-outlined text-green-600 text-xl flex-shrink-0 mt-0.5">check_circle</span>
          <p className="text-sm text-green-700 flex-1">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <span className="material-symbols-outlined text-red-600 text-xl flex-shrink-0 mt-0.5">error</span>
          <div className="flex-1">
            <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
            <button
              onClick={() => {
                console.log('[ManageCourseAssignments] User triggered retry');
                setErrorMessage('');
                loadInitialData();
              }}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
            >
              Retry Loading Data
            </button>
          </div>
        </div>
      )}

      {/* Hidden Courses Assignment Details by User */}
      {assignmentDetails.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600">visibility_off</span>
              <h3 className="font-semibold text-gray-900">Hidden Courses Assignment History</h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{assignmentDetails.length}</span>
            </div>
            <button
              onClick={() => setAssignmentDetails([])}
              className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear History
            </button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {assignmentDetails.map((detail, idx) => (
              <div key={idx} className={`p-4 rounded-lg border ${detail.action === 'assigned' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{detail.userName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${detail.action === 'assigned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {detail.action === 'assigned' ? '✓ Assigned' : '✕ Removed'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{detail.timestamp}</p>
                    <div className="mt-3 space-y-2">
                      {detail.hiddenCourses.map((course: any) => (
                        <div key={course.id} className="flex items-center gap-2 text-sm bg-white bg-opacity-50 p-2 rounded">
                          <span className="material-symbols-outlined text-xs text-red-600">lock</span>
                          <span className="text-gray-700 flex-1">{course.title}</span>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Hidden</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hideLayout && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Course Assignment</h2>
            <p className="text-gray-600 mt-1">Assign or hide courses from users.</p>
          </div>
        </div>
      )}

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
          <div className="bg-white rounded-2xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">
                Users - {activeDepartment} ({filteredUsers.length} Users)
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search User"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} className="text-sm font-medium text-primary hover:underline whitespace-nowrap">
                    Advanced Search
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      onChange={toggleAllUsers}
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    Select All
                  </label>
                </div>
              </div>
            </div>

            {showAdvancedSearch && (
              <div className="p-6 border-b border-gray-200 bg-gray-50">
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                        {filterOptions.designations.map((des: string) => (
                          <label key={des} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={filters.designation.includes(des)}
                              onChange={() => toggleFilter('designation', des)}
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-600 group-hover:text-slate-900">{des}</span>
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
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

            <div className="p-6">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="p-4 rounded-2xl border-2 border-gray-200 bg-white animate-pulse">
                      <div className="w-16 h-16 mx-auto mb-2 bg-gray-300 rounded-full"></div>
                      <div className="h-4 bg-gray-300 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
                    </div>
                  ))}
                </div>
              ) : errorMessage ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-center">
                  {errorMessage}
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-gray-500 text-center py-10">No users match the selected filters</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredUsers.slice(userPage * usersPerPage, (userPage + 1) * usersPerPage).map(user => (
                      <label key={user.id} className="cursor-pointer relative">
                        <div className={`p-4 rounded-2xl border-2 ${selectedUsers.includes(user.id) ? 'border-primary bg-blue-100' : 'border-gray-200 bg-white'} text-center transition-all hover:shadow-lg hover:border-primary`}>
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleUser(user.id)}
                            className="hidden"
                          />
                          {selectedUsers.includes(user.id) && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                          )}
                          <UserAvatar user={user} />
                          <p className="text-sm font-medium text-gray-900 truncate">{user.fullname}</p>
                          <p className="text-xs text-gray-500 truncate">{user.designation || 'No role'}</p>
                          <p className="text-xs text-gray-500 truncate">Emp ID: {user.user_id}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {filteredUsers.length > usersPerPage && (
                    <div className="mt-6 flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {userPage * usersPerPage + 1} - {Math.min((userPage + 1) * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUserPage(Math.max(0, userPage - 1))}
                          disabled={userPage === 0}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setUserPage(userPage + 1)}
                          disabled={(userPage + 1) * usersPerPage >= filteredUsers.length}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Courses Selection */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 h-fit sticky top-6 flex flex-col max-h-[calc(100vh-120px)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">
              Courses ({selectedCourses.length} selected)
            </h3>
            <button
              onClick={() => {
                console.log('[ManageCourseAssignments] Refreshing course data...');
                loadInitialData();
              }}
              className="p-1.5 hover:bg-gray-100 rounded-2xl transition-colors text-gray-600 hover:text-gray-900"
              title="Refresh course list"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
            </button>
          </div>

          <div className="flex gap-2 mb-4 items-center">
            <input
              type="text"
              placeholder="Search Courses"
              value={courseSearchQuery}
              onChange={(e) => setCourseSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            <select
              multiple
              value={courseFilterCategories}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                const filteredOptions = selectedOptions.filter(opt => opt !== '');
                setCourseFilterCategories(filteredOptions);
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white min-w-[180px]"
              size={Math.min(uniqueCourseCategories.length || 1, 6)}
            >
              <option value="" disabled>
                Categories
              </option>
              {uniqueCourseCategories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Course Summary Info */}
          <div className="mb-4 p-3 bg-indigo-80 rounded-lg border border-indigo-200">
            <p className="text-sm font-medium text-indigo-900">
              📚 Total Courses: {getFilteredCourses().length}
              {getFilteredCourses().filter(c => !c.is_hidden).length > 0 && (
                <span className="ml-3">✓ Visible: {getFilteredCourses().filter(c => !c.is_hidden).length}</span>
              )}
              {getFilteredCourses().filter(c => c.is_hidden).length > 0 && (
                <span className="ml-3 text-red-600">🔒 Hidden: {getFilteredCourses().filter(c => c.is_hidden).length}</span>
              )}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              All courses (including hidden) are shown below for admin assignment to specific users
            </p>
          </div>

          {/* Select All Courses Button */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={toggleAllCourses}
              disabled={getFilteredCourses().length === 0}
              className="flex-1 px-4 py-2 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <input
                type="checkbox"
                checked={selectedCourses.length === getFilteredCourses().length && getFilteredCourses().length > 0}
                onChange={() => { }}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
              />
              {selectedCourses.length === getFilteredCourses().length && getFilteredCourses().length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div
            className="space-y-2 overflow-y-auto flex-1 pr-2 mb-4 custom-scrollbar"
            onScroll={handleCourseScroll}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader size="lg" centered={false} />
                <button
                  onClick={() => loadInitialData()}
                  className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                >
                  Retry
                </button>
              </div>
            ) : errorMessage ? (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-red-700 text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  Load Error
                </p>
                <p className="text-red-600 text-xs mb-3">{errorMessage}</p>
                <button
                  onClick={() => {
                    console.log('[ManageCourseAssignments] User triggered retry from courses section');
                    loadInitialData();
                  }}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Retry Loading
                </button>
              </div>
            ) : courses.length === 0 ? (
              <p className="text-gray-500 text-sm">No courses available</p>
            ) : getDisplayedCourses().length === 0 ? (
              <p className="text-gray-500 text-sm">No courses match your search</p>
            ) : (
              getDisplayedCourses().map(course => (
                <div key={course.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCourses.includes(course.id)}
                        onChange={() => toggleCourse(course.id)}
                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{course.title}</p>
                          {course.is_hidden && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              <span className="material-symbols-outlined text-xs">visibility_off</span>
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{course.category}</p>
                      </div>
                    </label>
                    {selectedCourses.includes(course.id) && (
                      <div className="ml-6 mt-2 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mandatoryCourses.has(course.id)}
                            onChange={(e) => {
                              const newSet = new Set(mandatoryCourses);
                              if (e.target.checked) {
                                newSet.add(course.id);
                              } else {
                                newSet.delete(course.id);
                              }
                              setMandatoryCourses(newSet);
                            }}
                            className="w-3 h-3 text-primary rounded border-gray-300 focus:ring-primary"
                          />
                          <span className="text-xs text-gray-600">Mark as Mandatory</span>
                        </label>
                        <button
                          onClick={() => toggleDatePicker(course.id)}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          {courseDueDates.has(course.id) ? 'Change Due Date' : 'Set Due Date'}
                        </button>
                        {courseDueDates.has(course.id) && (
                          <p className="text-xs text-gray-500">Due: {new Date(courseDueDates.get(course.id)!).toLocaleDateString()}</p>
                        )}
                        {showDatePicker.has(course.id) && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <label className="block text-xs font-semibold text-gray-700 mb-2">Select Due Date</label>
                            <input
                              type="date"
                              value={courseDueDates.get(course.id) || ''}
                              onChange={(e) => setDueDate(course.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                            {courseDueDates.has(course.id) && (
                              <button
                                onClick={() => setDueDate(course.id, '')}
                                className="mt-2 w-full text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                              >
                                Remove Due Date
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {getDisplayedCourses().length < getFilteredCourses().length && (
              <p className="text-xs text-gray-500 text-center py-2">Scroll to load more courses...</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-2">
            <button
              onClick={handleAssignCourses}
              disabled={saving || selectedUsers.length === 0 || selectedCourses.length === 0}
              className="w-full px-4 py-3 bg-[#4f46e5] text-white rounded-lg font-medium hover:bg-[#4f46e5]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Assigning...' : `Assign to ${selectedUsers.length} users`}
            </button>
            <button
              onClick={handleRemoveCourses}
              disabled={saving || selectedUsers.length === 0 || selectedCourses.length === 0}
              className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Removing...' : `Hide from ${selectedUsers.length} users`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (hideLayout) {
    return content;
  }

  return (
    <AdminLayout title="Course Assignment">
      {content}
    </AdminLayout>
  );
};

export default ManageCourseAssignments;