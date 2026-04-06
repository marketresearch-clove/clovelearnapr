
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import Loader from '../../../../components/Loader';
import { courseAssignmentService } from '../../../../lib/courseAssignmentService';
import { exportToCSV } from '../../../../lib/exportUtils';

interface CourseAssignment {
  id: string;
  userid: string;
  courseid: string;
  assigned_by: string;
  is_mandatory: boolean;
  due_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  courses: {
    title: string;
    category?: string;
  };
  user_profile?: { fullname: string; department?: string; avatarurl?: string; user_id?: string };
  assigner_profile?: { fullname: string };
  enrollment?: {
    completed: boolean;
    progress: number;
  };
}

const getStatusColor = (assignment: CourseAssignment) => {
  if (!assignment) return 'bg-gray-100 text-gray-900';
  if (assignment.enrollment?.completed) return 'bg-green-100 text-green-900';

  const dueDate = assignment.due_date;
  if (!dueDate) return 'bg-gray-100 text-gray-900';

  const due = new Date(dueDate);
  const now = new Date();
  if (due < now) return 'bg-red-100 text-red-900'; // Overdue
  return 'bg-blue-100 text-blue-900'; // In Progress
};

const getStatusText = (assignment: CourseAssignment) => {
  if (!assignment) return 'Unknown';
  if (assignment.enrollment?.completed) return 'Completed';

  const dueDate = assignment.due_date;
  if (!dueDate) return 'In Progress';

  const due = new Date(dueDate);
  const now = new Date();
  if (due < now) return 'Overdue';
  return 'In Progress';
};

const CourseAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [sortDueDate, setSortDueDate] = useState<'none' | 'asc' | 'desc'>('none');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<CourseAssignment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    is_mandatory: false,
    due_date: '',
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; assignmentId: string | null }>({ isOpen: false, assignmentId: null });

  // Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignType, setAssignType] = useState<'individual' | 'department' | 'designation'>('individual');
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableDesignations, setAvailableDesignations] = useState<string[]>([]);

  const [assignFormData, setAssignFormData] = useState({
    selectedCourseIds: [] as string[],
    targetId: '', // userId, department name, or designation name
    is_mandatory: false,
    due_date: '',
    notes: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'assignments' | 'courses'>('assignments');
  const [assignModalCategoryFilter, setAssignModalCategoryFilter] = useState<string[]>([]);
  const [showAssignModalCategoryDropdown, setShowAssignModalCategoryDropdown] = useState(false);
  const assignModalCategoryDropdownRef = React.useRef<HTMLDivElement>(null);

  // Course Assignment Modal State (for individual course assignment from courses tab)
  const [isCourseAssignModalOpen, setIsCourseAssignModalOpen] = useState(false);
  const [selectedCourseForAssignment, setSelectedCourseForAssignment] = useState<any>(null);
  const [courseAssignType, setCourseAssignType] = useState<'individual' | 'department' | 'designation'>('individual');
  const [courseAssignFormData, setCourseAssignFormData] = useState({
    targetId: '',
    targetIds: [] as string[],
    is_mandatory: false,
    due_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchAssignments();
    fetchFormData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (assignModalCategoryDropdownRef.current && !assignModalCategoryDropdownRef.current.contains(event.target as Node)) {
        setShowAssignModalCategoryDropdown(false);
      }
    };
    if (showCategoryDropdown || showAssignModalCategoryDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showCategoryDropdown, showAssignModalCategoryDropdown]);

  const fetchFormData = async () => {
    try {
      console.log('[CourseAssignments] Fetching form data...');
      const { courses, profiles, categories, departments, designations } =
        await courseAssignmentService.getFormDataForAssignments();

      console.log('[CourseAssignments] Form data loaded:', {
        coursesCount: courses?.length || 0,
        profilesCount: profiles?.length || 0,
        categoriesCount: categories?.length || 0,
        departmentsCount: departments?.length || 0,
        designationsCount: designations?.length || 0,
      });

      setAvailableCourses(courses || []);
      setAvailableCategories(categories || []);
      setAvailableUsers(profiles || []);
      setAvailableDepartments(departments || []);
      setAvailableDesignations(designations || []);
    } catch (error) {
      console.error('[CourseAssignments] Error fetching form data:', error);
      setError(`Failed to load form data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAssignCourses = async () => {
    if (assignFormData.selectedCourseIds.length === 0 || !assignFormData.targetId) {
      alert('Please select courses and a target');
      return;
    }

    try {
      let userIdsToAssign: string[] = [];

      if (assignType === 'individual') {
        userIdsToAssign = [assignFormData.targetId];
      } else if (assignType === 'department') {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('department', assignFormData.targetId);
        if (data) userIdsToAssign = data.map((u: any) => u.id);
      } else if (assignType === 'designation') {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('designation', assignFormData.targetId);
        if (data) userIdsToAssign = data.map((u: any) => u.id);
      }

      if (userIdsToAssign.length === 0) {
        alert('No users found for the selected criteria');
        return;
      }

      // Get current user ID for assigned_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const assignmentsToInsert = [];
      for (const userId of userIdsToAssign) {
        for (const courseId of assignFormData.selectedCourseIds) {
          assignmentsToInsert.push({
            userid: userId,
            courseid: courseId,
            assigned_by: user.id,
            is_mandatory: assignFormData.is_mandatory,
            due_date: assignFormData.due_date || null,
            notes: assignFormData.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      const { error } = await supabase
        .from('course_assignments')
        .insert(assignmentsToInsert);

      if (error) throw error;

      // Clear cache after assignment creation
      courseAssignmentService.clearAssignmentCaches();

      setIsAssignModalOpen(false);
      setAssignFormData({
        selectedCourseIds: [],
        targetId: '',
        is_mandatory: false,
        due_date: '',
        notes: ''
      });
      fetchAssignments();
      alert(`Successfully assigned courses to ${userIdsToAssign.length} users`);
    } catch (error) {
      console.error('Error assigning courses:', error);
      alert('Failed to assign courses');
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[CourseAssignments] Starting to fetch assignments...');

      const enrichedAssignments = await courseAssignmentService.getAssignmentsWithDetails();

      console.log('[CourseAssignments] Received assignments:', enrichedAssignments);
      console.log('[CourseAssignments] Total assignments:', enrichedAssignments.length);

      if (!enrichedAssignments || enrichedAssignments.length === 0) {
        console.log('[CourseAssignments] No assignments found');
        setAssignments([]);
      } else {
        setAssignments(enrichedAssignments);

        // Extract unique categories from assignments
        const categories = Array.from(
          new Set(enrichedAssignments
            .map((a: any) => a.courses?.category)
            .filter((cat: string | undefined) => cat && cat.trim() !== '')
          )
        );
        setAvailableCategories(categories as string[]);
        console.log('[CourseAssignments] Updated categories:', categories);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CourseAssignments] Error fetching assignments:', error);
      console.error('[CourseAssignments] Error details:', errorMsg);
      setError(`Failed to load assignments: ${errorMsg}`);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (assignment: CourseAssignment) => {
    setEditingAssignment(assignment);
    setEditFormData({
      is_mandatory: assignment.is_mandatory,
      due_date: assignment.due_date ? new Date(assignment.due_date).toISOString().split('T')[0] : '',
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (assignment: CourseAssignment) => {
    setDeleteConfirmation({ isOpen: true, assignmentId: assignment.id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.assignmentId) return;

    try {
      const { error } = await supabase
        .from('course_assignments')
        .delete()
        .eq('id', deleteConfirmation.assignmentId);

      if (error) throw error;

      // Clear cache after deletion
      courseAssignmentService.clearAssignmentCaches();

      // Update local state by removing the deleted assignment
      setAssignments(assignments.filter(a => a.id !== deleteConfirmation.assignmentId));
      setDeleteConfirmation({ isOpen: false, assignmentId: null });
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment');
    }
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return;

    try {
      const { error } = await supabase
        .from('course_assignments')
        .update({
          is_mandatory: editFormData.is_mandatory,
          due_date: editFormData.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingAssignment.id);

      if (error) throw error;

      // Clear cache after update
      courseAssignmentService.clearAssignmentCaches();

      // Update local state
      setAssignments(assignments.map(a =>
        a.id === editingAssignment.id
          ? { ...a, ...editFormData, due_date: editFormData.due_date || null }
          : a
      ));

      setIsEditModalOpen(false);
      setEditingAssignment(null);
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update assignment');
    }
  };

  const handleExport = () => {
    const dataToExport = filteredAssignments.map(a => ({
      User: a.user_profile?.fullname || a.userid,
      Course: a.courses?.title || '',
      AssignedBy: a.assigner_profile?.fullname || a.assigned_by,
      DueDate: a.due_date ? new Date(a.due_date).toLocaleDateString() : '-',
      Type: a.is_mandatory ? 'Mandatory' : 'Optional',
      Status: getStatusText(a),
      Progress: a.enrollment?.progress || 0
    }));
    exportToCSV(dataToExport, 'Course_Assignments');
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch =
      assignment.courses?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.user_profile?.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.user_profile?.user_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.userid.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === 'all' ||
      (filterType === 'mandatory' && assignment.is_mandatory) ||
      (filterType === 'optional' && !assignment.is_mandatory);

    const status = getStatusText(assignment).toLowerCase();
    const matchesStatus =
      filterStatus === 'all' ||
      status === filterStatus.toLowerCase();

    const matchesDepartment =
      filterDepartment === 'all' ||
      assignment.user_profile?.department === filterDepartment;

    const matchesUser =
      filterUser === 'all' ||
      assignment.userid === filterUser;

    const courseCategoryValue = (assignment.courses as any)?.category || '';
    const matchesCategory =
      filterCategory.length === 0 ||
      filterCategory.includes(courseCategoryValue);

    return matchesSearch && matchesType && matchesStatus && matchesDepartment && matchesUser && matchesCategory;
  }).sort((a, b) => {
    if (sortDueDate === 'none') return 0;

    const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;

    if (sortDueDate === 'asc') {
      return dateA - dateB;
    } else {
      return dateB - dateA;
    }
  });

  // Group assignments by user
  const groupedAssignments = filteredAssignments.reduce((acc: any, assignment) => {
    const userId = assignment.userid;
    if (!acc[userId]) {
      acc[userId] = {
        user: assignment.user_profile,
        userId,
        assignments: []
      };
    }
    acc[userId].assignments.push(assignment);
    return acc;
  }, {});

  const userGroups = Object.values(groupedAssignments) as Array<any>;

  // Pagination logic
  const totalPages = Math.ceil(userGroups.length / itemsPerPage);
  const paginatedUserGroups = userGroups.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Toggle user expansion
  const toggleUserExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterStatus, filterDepartment, filterUser, filterCategory, sortDueDate, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('assignments');
            setCurrentPage(1);
          }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'assignments'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-rounded text-base">assignment</span>
            Assignments
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('courses');
            setCurrentPage(1);
          }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'courses'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-rounded text-base">school</span>
            Courses
          </span>
        </button>
      </div>

      {activeTab === 'assignments' && (
        <>
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <span className="material-symbols-rounded text-red-600 text-xl flex-shrink-0 mt-0.5">error</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    fetchAssignments();
                  }}
                  className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
                >
                  Try Again
                </button>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-700 flex-shrink-0"
              >
                <span className="material-symbols-rounded text-lg">close</span>
              </button>
            </div>
          )}

          {/* Search Bar and Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-500"
              />
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  console.log('[CourseAssignments] Manual refresh triggered');
                  courseAssignmentService.clearAssignmentCaches();
                  setError(null);
                  fetchAssignments();
                }}
                className="flex-1 sm:flex-none bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                title="Refresh assignments from database"
              >
                <span className="material-symbols-rounded">refresh</span>
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
              >
                <span className="material-symbols-rounded">download</span>
                Export
              </button>
              <button
                onClick={() => {
                  setIsAssignModalOpen(true);
                  setAssignModalCategoryFilter([]);
                }}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
              >
                <span className="material-symbols-rounded">add</span>
                Assign Course
              </button>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
            >
              <option value="all">All Types</option>
              <option value="mandatory">Mandatory</option>
              <option value="optional">Optional</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in progress">In Progress</option>
              <option value="overdue">Overdue</option>
            </select>

            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
            >
              <option value="all">All Departments</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
            >
              <option value="all">All Users</option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>{user.fullname || user.id} {user.user_id ? `(${user.user_id})` : ''}</option>
              ))}
            </select>

            <div className="relative" ref={categoryDropdownRef}>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                Categories {filterCategory.length > 0 && `(${filterCategory.length})`}
                <span className="material-symbols-rounded text-sm">{showCategoryDropdown ? 'expand_less' : 'expand_more'}</span>
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                  <div className="p-3 border-b border-gray-200">
                    <button
                      onClick={() => setFilterCategory([])}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    >
                      ✓ All Categories ({availableCategories.length})
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                    {availableCategories.map(category => {
                      const isSelected = filterCategory.includes(category);
                      const courseCount = assignments.filter(a => a.courses?.category === category).length;
                      return (
                        <label
                          key={category}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setFilterCategory(filterCategory.filter(c => c !== category));
                              } else {
                                setFilterCategory([...filterCategory, category]);
                              }
                            }}
                            className="rounded cursor-pointer w-4 h-4 text-blue-600"
                          />
                          <span className="flex-1">{category}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{courseCount}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <select
              value={sortDueDate}
              onChange={(e) => setSortDueDate(e.target.value as 'none' | 'asc' | 'desc')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
            >
              <option value="none">Sort by Due Date</option>
              <option value="asc">Earliest First</option>
              <option value="desc">Latest First</option>
            </select>
          </div>

          {/* Items Per Page Selector */}
          {filteredAssignments.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <strong>{paginatedUserGroups.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong>{Math.min(currentPage * itemsPerPage, userGroups.length)}</strong> of <strong>{userGroups.length}</strong> users
              </div>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={30}>30 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          )}

          {/* User Groups Display */}
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-20">
              <Loader size="lg" message="Loading assignments..." />
              <p className="text-xs text-center text-gray-500 mt-2">This may take a moment if there are many assignments</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <span className="material-symbols-rounded text-4xl text-gray-400 block mb-2">assignment_ind</span>
              <p className="text-gray-600 font-medium">No assignments found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterCategory.length > 0
                  ? 'Try adjusting your filters'
                  : 'Click "Assign Course" to get started'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedUserGroups.map((group) => {
                const isExpanded = expandedUsers.has(group.userId);
                return (
                  <div key={group.userId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* User Header */}
                    <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-indigo-100 transition-colors" onClick={() => toggleUserExpand(group.userId)}>
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleUserExpand(group.userId);
                          }}
                          className="text-gray-600 hover:text-gray-900 p-1 transition-colors flex-shrink-0"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          <span className={`material-symbols-rounded transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                            expand_more
                          </span>
                        </button>
                        {group.user?.avatarurl ? (
                          <img
                            src={group.user.avatarurl}
                            alt={group.user?.fullname || 'User'}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-sm font-semibold flex-shrink-0">
                            {(group.user?.fullname || group.userId).substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">
                            {group.user?.fullname || 'Unknown User'}
                            {group.user?.user_id && <span className="text-gray-500 text-sm ml-1">({group.user.user_id})</span>}
                          </span>
                          <span className="text-xs text-gray-600">
                            {group.user?.department || 'No Department'} • {group.assignments.length} {group.assignments.length === 1 ? 'course' : 'courses'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Courses - Collapsible */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-200">
                        {group.assignments.map((assignment) => (
                          <div key={assignment.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900 truncate flex-1">
                                    {assignment.courses?.title || 'Unknown Course'}
                                  </h4>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-200 text-indigo-800 whitespace-nowrap flex-shrink-0">
                                    {assignment.is_mandatory ? 'Mandatory' : 'Optional'}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <p>
                                    <span className="font-medium">Category:</span> {(assignment.courses as any)?.category || '-'}
                                  </p>
                                  <p>
                                    <span className="font-medium">Assigned By:</span> {assignment.assigner_profile?.fullname || assignment.assigned_by}
                                  </p>
                                  <p>
                                    <span className="font-medium">Due Date:</span> {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : '-'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-3 flex-shrink-0">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(assignment)}`}>
                                  {getStatusText(assignment)}
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditClick(assignment)}
                                    className="text-blue-600 hover:text-blue-900 p-1.5 rounded hover:bg-blue-100 transition-colors"
                                    title="Edit"
                                  >
                                    <span className="material-symbols-rounded text-base">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(assignment)}
                                    className="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-100 transition-colors"
                                    title="Delete"
                                  >
                                    <span className="material-symbols-rounded text-base">delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {userGroups.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <span className="material-symbols-rounded text-base">chevron_left</span>
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg transition-colors ${currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <span className="material-symbols-rounded text-base">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'courses' && (
        <div className="space-y-4">
          {/* Courses Header with Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">All Courses</h2>
              <p className="text-sm text-gray-500 mt-1">Total: <strong>{availableCourses.length}</strong> courses</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search courses..."
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                <span className="material-symbols-rounded text-base inline mr-1">search</span>
                Search
              </button>
            </div>
          </div>

          {/* Category Filter and Sort */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-xs" ref={categoryDropdownRef}>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm flex items-center justify-between hover:bg-gray-50 transition-colors text-gray-900 font-medium"
              >
                <span>
                  <span className="material-symbols-rounded text-base inline mr-2">filter_list</span>
                  Categories
                  {availableCategories.length > 0 && <span className="ml-2 text-gray-500">({availableCategories.length})</span>}
                </span>
                <span className="material-symbols-rounded text-sm">{showCategoryDropdown ? 'expand_less' : 'expand_more'}</span>
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {availableCategories.map(category => {
                      const courseCount = availableCourses.filter(c => c.category === category).length;
                      return (
                        <label key={category} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" />
                          <span className="flex-1 text-sm font-medium text-gray-700">{category}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-semibold">{courseCount}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <select className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500">
              <option>Sort by: Popular</option>
              <option>Sort by: Recent</option>
              <option>Sort by: Name</option>
            </select>
          </div>

          {/* Courses Grid */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {availableCourses.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <span className="material-symbols-rounded text-5xl block mb-4 text-gray-300">school</span>
                <p className="font-medium mb-2">No courses available</p>
                <p className="text-sm">Courses will appear here once they are created</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Course Title</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Level</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Students</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {availableCourses.map((course) => (
                      <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{course.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{course.id}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700 bg-blue-50 px-2.5 py-1 rounded font-medium">{course.category || 'Uncategorized'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700 font-medium">-</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">{course.totalstudents || 0}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${course.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {course.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedCourseForAssignment(course);
                                setCourseAssignType('individual');
                                setCourseAssignFormData({
                                  targetId: '',
                                  targetIds: [],
                                  is_mandatory: false,
                                  due_date: '',
                                  notes: ''
                                });
                                setIsCourseAssignModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 p-1.5 rounded hover:bg-blue-100 transition-colors"
                              title="Assign this course"
                            >
                              <span className="material-symbols-rounded text-base">person_add</span>
                            </button>
                            <button
                              className="text-gray-600 hover:text-gray-900 p-1.5 rounded hover:bg-gray-100 transition-colors"
                              title="View details"
                            >
                              <span className="material-symbols-rounded text-base">visibility</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Course</h3>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Assignment Type Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${assignType === 'individual'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  onClick={() => { setAssignType('individual'); setAssignFormData({ ...assignFormData, targetId: '' }); }}
                >
                  Individual
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${assignType === 'department'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  onClick={() => { setAssignType('department'); setAssignFormData({ ...assignFormData, targetId: '' }); }}
                >
                  Department
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${assignType === 'designation'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  onClick={() => { setAssignType('designation'); setAssignFormData({ ...assignFormData, targetId: '' }); }}
                >
                  Designation
                </button>
              </div>

              {/* Target Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {assignType === 'individual' ? 'Select User' : assignType === 'department' ? 'Select Department' : 'Select Designation'}
                </label>
                <select
                  value={assignFormData.targetId}
                  onChange={(e) => setAssignFormData({ ...assignFormData, targetId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Target</option>
                  {assignType === 'individual' && availableUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.fullname || user.id}</option>
                  ))}
                  {assignType === 'department' && availableDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  {assignType === 'designation' && availableDesignations.map(desig => (
                    <option key={desig} value={desig}>{desig}</option>
                  ))}
                </select>
              </div>

              {/* Course Selection with Category Filter */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Courses <span className="font-normal text-gray-500">({assignFormData.selectedCourseIds.length} selected)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const filteredCourseIds = availableCourses
                          .filter(course => assignModalCategoryFilter.length === 0 || assignModalCategoryFilter.includes(course.category))
                          .map(c => c.id);
                        setAssignFormData({ ...assignFormData, selectedCourseIds: filteredCourseIds });
                      }}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <span className="material-symbols-rounded text-sm inline mr-1">check_circle</span>
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignFormData({ ...assignFormData, selectedCourseIds: [] });
                      }}
                      className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="material-symbols-rounded text-sm inline mr-1">clear_all</span>
                      Clear
                    </button>
                  </div>
                </div>

                {/* Category Filter Dropdown */}
                <div className="mb-4 relative" ref={assignModalCategoryDropdownRef}>
                  <button
                    onClick={() => setShowAssignModalCategoryDropdown(!showAssignModalCategoryDropdown)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span>
                      <span className="material-symbols-rounded text-base inline mr-2">filter_list</span>
                      Filter by Category
                      {assignModalCategoryFilter.length > 0 && <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">({assignModalCategoryFilter.length})</span>}
                    </span>
                    <span className="material-symbols-rounded text-sm">{showAssignModalCategoryDropdown ? 'expand_less' : 'expand_more'}</span>
                  </button>

                  {showAssignModalCategoryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20">
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => setAssignModalCategoryFilter([])}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors font-medium"
                        >
                          <span className="material-symbols-rounded text-sm inline mr-2">done_all</span>
                          All Categories
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3 space-y-2">
                        {availableCategories.map(category => {
                          const isSelected = assignModalCategoryFilter.includes(category);
                          const courseCount = availableCourses.filter(c => c.category === category).length;
                          return (
                            <label
                              key={category}
                              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setAssignModalCategoryFilter(assignModalCategoryFilter.filter(c => c !== category));
                                  } else {
                                    setAssignModalCategoryFilter([...assignModalCategoryFilter, category]);
                                  }
                                }}
                                className="rounded cursor-pointer w-4 h-4 text-blue-600"
                              />
                              <span className="flex-1 font-medium">{category}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-semibold">{courseCount}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Course List */}
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
                  {availableCourses.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                      <span className="material-symbols-rounded text-3xl block mb-2">school</span>
                      No courses available
                    </div>
                  ) : (
                    <>
                      {availableCourses
                        .filter(course => assignModalCategoryFilter.length === 0 || assignModalCategoryFilter.includes(course.category))
                        .map((course, idx, filtered) => (
                          <label key={course.id} className={`flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors ${idx < filtered.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}>
                            <input
                              type="checkbox"
                              checked={assignFormData.selectedCourseIds.includes(course.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignFormData({ ...assignFormData, selectedCourseIds: [...assignFormData.selectedCourseIds, course.id] });
                                } else {
                                  setAssignFormData({ ...assignFormData, selectedCourseIds: assignFormData.selectedCourseIds.filter(id => id !== course.id) });
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{course.title}</p>
                              {course.category && <p className="text-xs text-gray-500 dark:text-gray-400">{course.category}</p>}
                            </div>
                            {assignFormData.selectedCourseIds.includes(course.id) && (
                              <span className="material-symbols-rounded text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">check_circle</span>
                            )}
                          </label>
                        ))}
                      {availableCourses
                        .filter(course => assignModalCategoryFilter.length === 0 || assignModalCategoryFilter.includes(course.category)).length === 0 && (
                          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                            <span className="material-symbols-rounded text-3xl block mb-2">filter_alt_off</span>
                            No courses match the selected filter
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>

              {/* Additional Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={assignFormData.due_date}
                    onChange={(e) => setAssignFormData({ ...assignFormData, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center h-full pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignFormData.is_mandatory}
                      onChange={(e) => setAssignFormData({ ...assignFormData, is_mandatory: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Mandatory Assignment</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={assignFormData.notes}
                  onChange={(e) => setAssignFormData({ ...assignFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignCourses}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Assign Courses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Course Assignment Modal */}
      {isCourseAssignModalOpen && selectedCourseForAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assign Course: {selectedCourseForAssignment.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span className="material-symbols-rounded text-sm inline mr-1">folder</span>
                    {selectedCourseForAssignment.category || 'Uncategorized'}
                  </p>
                </div>
                <button
                  onClick={() => setIsCourseAssignModalOpen(false)}
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
                >
                  <span className="material-symbols-rounded text-base">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Assignment Type Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
                {[
                  { type: 'individual', label: 'Individual User', icon: 'person' },
                  { type: 'department', label: 'Department', icon: 'business' },
                  { type: 'designation', label: 'Designation', icon: 'badge' }
                ].map(tab => (
                  <button
                    key={tab.type as string}
                    className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${courseAssignType === tab.type
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                      }`}
                    onClick={() => {
                      setCourseAssignType(tab.type as any);
                      setCourseAssignFormData({ ...courseAssignFormData, targetId: '', targetIds: [] });
                    }}
                  >
                    <span className="material-symbols-rounded text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Target Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  {courseAssignType === 'individual' && (
                    <>
                      <span className="material-symbols-rounded text-base inline mr-2">person</span>
                      Select Users
                    </>
                  )}
                  {courseAssignType === 'department' && (
                    <>
                      <span className="material-symbols-rounded text-base inline mr-2">business</span>
                      Select Departments
                    </>
                  )}
                  {courseAssignType === 'designation' && (
                    <>
                      <span className="material-symbols-rounded text-base inline mr-2">badge</span>
                      Select Designations
                    </>
                  )}
                </label>

                <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
                  {courseAssignType === 'individual' && availableUsers.length > 0 && (
                    <div>
                      {availableUsers.map((user, idx) => (
                        <label
                          key={user.id}
                          className={`flex items-center gap-3 p-4 hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${idx < availableUsers.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={courseAssignFormData.targetIds.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCourseAssignFormData({
                                  ...courseAssignFormData,
                                  targetIds: [...courseAssignFormData.targetIds, user.id]
                                });
                              } else {
                                setCourseAssignFormData({
                                  ...courseAssignFormData,
                                  targetIds: courseAssignFormData.targetIds.filter(id => id !== user.id)
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{user.fullname || 'Unknown User'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.department || 'No Department'}</p>
                          </div>
                          {courseAssignFormData.targetIds.includes(user.id) && (
                            <span className="material-symbols-rounded text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">check_circle</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}

                  {courseAssignType === 'department' && availableDepartments.length > 0 && (
                    <div>
                      {availableDepartments.map((dept, idx) => (
                        <label
                          key={dept}
                          className={`flex items-center gap-3 p-4 hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${idx < availableDepartments.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={courseAssignFormData.targetIds.includes(dept)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCourseAssignFormData({
                                  ...courseAssignFormData,
                                  targetIds: [...courseAssignFormData.targetIds, dept]
                                });
                              } else {
                                setCourseAssignFormData({
                                  ...courseAssignFormData,
                                  targetIds: courseAssignFormData.targetIds.filter(id => id !== dept)
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                          />
                          <p className="text-sm font-medium text-gray-900 dark:text-white flex-1">{dept}</p>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full font-semibold">
                            {availableUsers.filter(u => u.department === dept).length} users
                          </span>
                          {courseAssignFormData.targetIds.includes(dept) && (
                            <span className="material-symbols-rounded text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">check_circle</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}

                  {courseAssignType === 'designation' && availableDesignations.length > 0 && (
                    <div>
                      {availableDesignations.map((desig, idx) => (
                        <label
                          key={desig}
                          className={`flex items-center gap-3 p-4 hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${idx < availableDesignations.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={courseAssignFormData.targetIds.includes(desig)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCourseAssignFormData({
                                  ...courseAssignFormData,
                                  targetIds: [...courseAssignFormData.targetIds, desig]
                                });
                              } else {
                                setCourseAssignFormData({
                                  ...courseAssignFormData,
                                  targetIds: courseAssignFormData.targetIds.filter(id => id !== desig)
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                          />
                          <p className="text-sm font-medium text-gray-900 dark:text-white flex-1">{desig}</p>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full font-semibold">
                            {availableUsers.filter(u => u.designation === desig).length} users
                          </span>
                          {courseAssignFormData.targetIds.includes(desig) && (
                            <span className="material-symbols-rounded text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">check_circle</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}

                  {((courseAssignType === 'individual' && availableUsers.length === 0) ||
                    (courseAssignType === 'department' && availableDepartments.length === 0) ||
                    (courseAssignType === 'designation' && availableDesignations.length === 0)) && (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <span className="material-symbols-rounded text-3xl block mb-2">inbox</span>
                        <p className="text-sm font-medium">No {courseAssignType}s available</p>
                      </div>
                    )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <span className="material-symbols-rounded text-sm inline mr-1">info</span>
                  {courseAssignFormData.targetIds.length} {courseAssignType === 'individual' ? 'user(s)' : courseAssignType === 'department' ? 'department(s)' : 'designation(s)'} selected
                </p>
              </div>

              {/* Assignment Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="material-symbols-rounded text-base inline mr-1">calendar_today</span>
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={courseAssignFormData.due_date}
                    onChange={(e) => setCourseAssignFormData({ ...courseAssignFormData, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={courseAssignFormData.is_mandatory}
                      onChange={(e) => setCourseAssignFormData({ ...courseAssignFormData, is_mandatory: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      <span className="material-symbols-rounded text-base inline mr-1">done_all</span>
                      Mandatory Course
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <span className="material-symbols-rounded text-base inline mr-1">notes</span>
                  Notes (Optional)
                </label>
                <textarea
                  value={courseAssignFormData.notes}
                  onChange={(e) => setCourseAssignFormData({ ...courseAssignFormData, notes: e.target.value })}
                  placeholder="Add any notes or instructions for the assigned users..."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsCourseAssignModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (courseAssignFormData.targetIds.length === 0) {
                    alert('Please select at least one user, department, or designation');
                    return;
                  }

                  try {
                    let userIdsToAssign: string[] = [];

                    if (courseAssignType === 'individual') {
                      userIdsToAssign = courseAssignFormData.targetIds;
                    } else if (courseAssignType === 'department') {
                      const { data } = await supabase
                        .from('profiles')
                        .select('id')
                        .in('department', courseAssignFormData.targetIds);
                      if (data) userIdsToAssign = data.map((u: any) => u.id);
                    } else if (courseAssignType === 'designation') {
                      const { data } = await supabase
                        .from('profiles')
                        .select('id')
                        .in('designation', courseAssignFormData.targetIds);
                      if (data) userIdsToAssign = data.map((u: any) => u.id);
                    }

                    if (userIdsToAssign.length === 0) {
                      alert('No users found for the selected criteria');
                      return;
                    }

                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error('No authenticated user');

                    const assignmentsToInsert = userIdsToAssign.map(userId => ({
                      userid: userId,
                      courseid: selectedCourseForAssignment.id,
                      assigned_by: user.id,
                      is_mandatory: courseAssignFormData.is_mandatory,
                      due_date: courseAssignFormData.due_date || null,
                      notes: courseAssignFormData.notes,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    }));

                    const { error } = await supabase
                      .from('course_assignments')
                      .insert(assignmentsToInsert);

                    if (error) throw error;

                    setIsCourseAssignModalOpen(false);
                    setCourseAssignFormData({
                      targetId: '',
                      targetIds: [],
                      is_mandatory: false,
                      due_date: '',
                      notes: ''
                    });
                    fetchAssignments();
                    alert(`Successfully assigned "${selectedCourseForAssignment.title}" to ${userIdsToAssign.length} user(s)`);
                  } catch (error) {
                    console.error('Error assigning course:', error);
                    alert('Failed to assign course');
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-base">send</span>
                Assign Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="material-symbols-rounded text-red-600 dark:text-red-400">warning</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Assignment</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300">Are you sure you want to delete this course assignment? This action cannot be undone.</p>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmation({ isOpen: false, assignmentId: null })}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Assignment</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mandatory
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.is_mandatory}
                    onChange={(e) => setEditFormData({ ...editFormData, is_mandatory: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Is this course mandatory?</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editFormData.due_date}
                  onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAssignment}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseAssignments;
