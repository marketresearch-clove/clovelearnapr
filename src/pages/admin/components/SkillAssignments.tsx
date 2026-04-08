
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import Loader from '../../../../components/Loader';
import { careerPathService } from '../../../../lib/careerPathService';
import { skillService } from '../../../../lib/skillService';

import { exportToCSV } from '../../../../lib/exportUtils';

interface SkillAssignment {
  id: string;
  userid: string;
  skillid: string;
  visible: boolean;
  hidden: boolean;
  assignedat: string | null;
  expiry_date: string | null;
  createdat: string | null;
  auto_assigned?: boolean; // flag added by recent migration
  skills: {
    name: string;
    skill_course_mappings?: {
      courses: {
        title: string;
        level: string;
      };
    }[];
  };
  profiles?: {
    fullname: string;
    email: string;
    department?: string;
  };
}

interface Skill {
  id: string;
  name: string;
  family: string;
}

interface User {
  id: string;
  fullname?: string;
  email?: string;
}

const SkillAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<SkillAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisibility, setFilterVisibility] = useState('all');
  const [filterFamily, setFilterFamily] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());

  // Assign Skill Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBatchExpiryModalOpen, setIsBatchExpiryModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<SkillAssignment | null>(null);
  const [batchExpiryData, setBatchExpiryData] = useState({ duration: '1year', customDate: '' });
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [assignFormData, setAssignFormData] = useState({
    selectedSkillIds: [] as string[],
    targetUserId: '',
    expiry_date: ''
  });
  const [editFormData, setEditFormData] = useState({
    visible: true,
    hidden: false,
    expiry_date: ''
  });

  useEffect(() => {
    fetchAssignments();
    fetchFormData();

    // subscribe to realtime updates so admin sees changes as they occur
    const channel = supabase
      .channel('public:skill_assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skill_assignments' }, () => {
        fetchAssignments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFormData = async () => {
    try {
      const { data: skillsData } = await supabase.from('skills').select('id, name, family');
      const { data: usersData } = await supabase.from('profiles').select('id, fullname, email, department');

      if (skillsData) setAvailableSkills(skillsData);
      if (usersData) setAvailableUsers(usersData);
    } catch (error) {
      console.error('Error fetching form data:', error);
    }
  };

  const handleClearExpired = async () => {
    if (!window.confirm('Are you sure you want to delete all expired skill assignments?')) return;

    try {
      setLoading(true);
      const count = await skillService.deleteExpiredSkillAssignments();
      fetchAssignments();
      alert(`Deleted ${count} expired assignments.`);
    } catch (error) {
      console.error('Error clearing expired assignments:', error);
      alert('Failed to clear expired assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSetExpiry = async () => {
    if (selectedAssignmentIds.size === 0) {
      alert('Please select at least one assignment');
      return;
    }

    try {
      let expiryDate: Date;
      const now = new Date();

      switch (batchExpiryData.duration) {
        case '3months':
          expiryDate = new Date(now.setMonth(now.getMonth() + 3));
          break;
        case '6months':
          expiryDate = new Date(now.setMonth(now.getMonth() + 6));
          break;
        case '1year':
          expiryDate = new Date(now.setFullYear(now.getFullYear() + 1));
          break;
        case '2years':
          expiryDate = new Date(now.setFullYear(now.getFullYear() + 2));
          break;
        case 'custom':
          if (!batchExpiryData.customDate) {
            alert('Please select a custom date');
            return;
          }
          expiryDate = new Date(batchExpiryData.customDate);
          break;
        default:
          return;
      }

      setLoading(true);
      const assignmentIdsArray = Array.from(selectedAssignmentIds);

      // Update all selected assignments
      await Promise.all(
        assignmentIdsArray.map(id => {
          // Handle both admin assignments and achievements
          if ((id as string).startsWith('achievement_')) {
            // For achievements, we need to update user_skill_achievements instead
            const achievementId = (id as string).replace('achievement_', '');
            return supabase
              .from('user_skill_achievements')
              .update({ expiry_date: expiryDate.toISOString() })
              .eq('id', achievementId);
          } else {
            // For admin assignments, update skill_assignments
            return supabase
              .from('skill_assignments')
              .update({ expiry_date: expiryDate.toISOString() })
              .eq('id', id);
          }
        })
      );

      setIsBatchExpiryModalOpen(false);
      setSelectedAssignmentIds(new Set());
      setBatchExpiryData({ duration: '1year', customDate: '' });
      fetchAssignments();
      alert(`Updated expiry date for ${assignmentIdsArray.length} assignments`);
    } catch (error) {
      console.error('Error updating expiry dates:', error);
      alert('Failed to update expiry dates');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignmentSelection = (id: string) => {
    const newSelected = new Set(selectedAssignmentIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAssignmentIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedAssignmentIds.size === filteredAssignments.length) {
      setSelectedAssignmentIds(new Set());
    } else {
      setSelectedAssignmentIds(new Set(filteredAssignments.map(a => a.id)));
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);

      // Fetch skill assignments
      const { data: assignmentData, error: assignError } = await supabase
        .from('skill_assignments')
        .select(`
          *,
          skills (
            name,
            family,
            skill_course_mappings (
              courses (title, level)
            )
          )
        `)
        .order('assignedat', { ascending: false });

      if (assignError) throw assignError;

      // Fetch user skill achievements (acquired from courses)
      const { data: achievementData, error: achieveError } = await supabase
        .from('user_skill_achievements')
        .select(`
          id,
          user_id,
          skill_id,
          skill_name,
          course_id,
          course_title,
          course_level,
          completed_at,
          percentage_achieved
        `)
        .order('completed_at', { ascending: false });

      if (achieveError) throw achieveError;

      // Manually fetch profiles
      const allUserIds = Array.from(new Set([
        ...(assignmentData?.map(a => a.userid) || []),
        ...(achievementData?.map(a => a.user_id) || [])
      ]));

      let profilesMap: Record<string, any> = {};

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, fullname, email, department')
          .in('id', allUserIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Transform skill assignments
      const formattedAssignments = assignmentData?.map((assignment: any) => {
        // assignments inserted by the auto-assign trigger are marked via auto_assigned flag
        const isAuto = assignment.auto_assigned === true;
        return {
          ...assignment,
          profiles: profilesMap[assignment.userid] || { fullname: 'Unknown User', email: '' },
          source: isAuto ? 'course_acquired' : 'admin_assigned',
          is_acquired: isAuto
        };
      }) || [];

      // Transform skill achievements (add uniqueness by achievement ID)
      const formattedAchievements = achievementData?.map((achievement: any, idx: number) => ({
        id: `achievement_${achievement.id}`,
        userid: achievement.user_id,
        skillid: achievement.skill_id,
        visible: true,
        hidden: false,
        assignedat: achievement.completed_at,
        expiry_date: null,
        createdat: achievement.completed_at,
        profiles: profilesMap[achievement.user_id] || { fullname: 'Unknown User', email: '' },
        skills: {
          name: achievement.skill_name,
          family: '',
          skill_course_mappings: [
            {
              courses: {
                title: achievement.course_title,
                level: achievement.course_level
              }
            }
          ]
        },
        source: 'course_acquired',
        is_acquired: true,
        percentage_achieved: achievement.percentage_achieved
      })) || [];

      // Combine and deduplicate
      // - If a skill exists in both admin assignments and achievements, mark as acquired
      // - Auto-assigned rows should adopt achievement metadata so they look "acquired"
      // - Manual admin assignments should also show achievement dates when available
      const assignmentMap = new Map();

      formattedAssignments.forEach(a => {
        assignmentMap.set(`${a.userid}_${a.skillid}`, a);
      });

      formattedAchievements.forEach(a => {
        const key = `${a.userid}_${a.skillid}`;
        if (assignmentMap.has(key)) {
          const existing = assignmentMap.get(key);
          // Merge achievement data into any admin assignment (auto or manual)
          // This shows the course completion and marks it as acquired
          assignmentMap.set(key, {
            ...existing,
            skills: a.skills,
            assignedat: a.assignedat,
            expiry_date: a.expiry_date,
            source: 'course_acquired',
            is_acquired: true,
            percentage_achieved: a.percentage_achieved
          });
        } else {
          // Achievement without admin assignment - add it standalone
          assignmentMap.set(key, a);
        }
      });

      setAssignments(Array.from(assignmentMap.values()));
    } catch (error) {
      console.error('Error fetching skill assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return;

    try {
      const isAchievement = (editingAssignment.id as string).startsWith('achievement_');

      if (isAchievement) {
        // Update user_skill_achievements
        const achievementId = (editingAssignment.id as string).replace('achievement_', '');
        const { error } = await supabase
          .from('user_skill_achievements')
          .update({
            expiry_date: editFormData.expiry_date || null
          })
          .eq('id', achievementId);

        if (error) throw error;
      } else {
        // Update skill_assignments
        const { error } = await supabase
          .from('skill_assignments')
          .update({
            visible: editFormData.visible,
            hidden: editFormData.hidden,
            expiry_date: editFormData.expiry_date || null
          })
          .eq('id', editingAssignment.id);

        if (error) throw error;
      }

      setIsEditModalOpen(false);
      setEditingAssignment(null);
      fetchAssignments();
      alert('Assignment updated successfully!');
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update assignment');
    }
  };

  const handleDeleteAssignment = async (assignment: SkillAssignment) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const isAchievement = (assignment.id as string).startsWith('achievement_');
      let error;

      if (isAchievement) {
        // Delete from user_skill_achievements
        const achievementId = (assignment.id as string).replace('achievement_', '');
        const result = await supabase
          .from('user_skill_achievements')
          .delete()
          .eq('id', achievementId);
        error = result.error;
      } else {
        // Delete from skill_assignments
        const result = await supabase
          .from('skill_assignments')
          .delete()
          .eq('id', assignment.id);
        error = result.error;
      }

      if (error) throw error;

      // Update career path readiness for this user
      const userCareerPaths = await careerPathService.getUserCareerPaths(assignment.userid);
      for (const path of userCareerPaths) {
        await careerPathService.updateCareerReadiness(assignment.userid, path.career_path_id);
      }

      fetchAssignments();
      alert('Assignment deleted successfully!');
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment');
    }
  };

  const handleAssignSkills = async () => {
    if (!assignFormData.targetUserId || assignFormData.selectedSkillIds.length === 0) {
      alert('Please select a user and at least one skill');
      return;
    }

    try {
      const assignmentsToInsert = assignFormData.selectedSkillIds.map(skillId => ({
        userid: assignFormData.targetUserId,
        skillid: skillId,
        visible: true,
        hidden: false,
        assignedat: new Date().toISOString(),
        expiry_date: assignFormData.expiry_date || null
      }));

      const { error } = await supabase
        .from('skill_assignments')
        .upsert(assignmentsToInsert, { onConflict: 'userid,skillid', ignoreDuplicates: true });

      if (error) throw error;

      // Update career path readiness for this user
      const userCareerPaths = await careerPathService.getUserCareerPaths(assignFormData.targetUserId);
      for (const path of userCareerPaths) {
        await careerPathService.updateCareerReadiness(assignFormData.targetUserId, path.career_path_id);
      }

      setIsAssignModalOpen(false);
      setAssignFormData({ selectedSkillIds: [], targetUserId: '', expiry_date: '' });
      fetchAssignments();
      alert('Skills assigned successfully!');
    } catch (error) {
      console.error('Error assigning skills:', error);
      alert('Failed to assign skills');
    }
  };

  const handleExport = () => {
    const dataToExport = filteredAssignments.map(a => ({
      User: a.profiles?.fullname || a.userid,
      Email: a.profiles?.email || '',
      Skill: a.skills?.name || '',
      Family: (a.skills as any)?.family || '',
      Course: a.skills?.skill_course_mappings?.[0]?.courses?.title || '-',
      Level: a.skills?.skill_course_mappings?.[0]?.courses?.level || '-',
      AssignedAt: a.assignedat ? new Date(a.assignedat).toLocaleDateString() : '-',
      ExpiryDate: a.expiry_date ? new Date(a.expiry_date).toLocaleDateString() : 'Never', AutoAssigned: a.auto_assigned ? 'Yes' : 'No', Acquired: (a as any).is_acquired ? 'Yes' : 'No',
      Visibility: a.hidden ? 'Hidden' : 'Visible'
    }));
    exportToCSV(dataToExport, 'Skill_Assignments');      // note: auto_assigned column exported as well for clarity
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch =
      assignment.skills?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.profiles?.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.userid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.skills?.skill_course_mappings?.[0]?.courses?.title?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVisibility =
      filterVisibility === 'all' ||
      (filterVisibility === 'visible' && !assignment.hidden) ||
      (filterVisibility === 'hidden' && assignment.hidden);

    const matchesFamily =
      filterFamily === 'all' ||
      (assignment.skills as any)?.family === filterFamily;

    const matchesLevel =
      filterLevel === 'all' ||
      assignment.skills?.skill_course_mappings?.[0]?.courses?.level === filterLevel;

    const matchesCourse =
      filterCourse === 'all' ||
      assignment.skills?.skill_course_mappings?.[0]?.courses?.title === filterCourse;

    const matchesDepartment =
      filterDepartment === 'all' ||
      assignment.profiles?.department === filterDepartment;

    const matchesUser =
      filterUser === 'all' ||
      assignment.userid === filterUser;

    return matchesSearch && matchesVisibility && matchesFamily && matchesLevel && matchesCourse && matchesDepartment && matchesUser;
  });

  const families = Array.from(new Set(assignments.map(a => (a.skills as any)?.family).filter(Boolean)));
  const levels = Array.from(new Set(assignments.map(a => a.skills?.skill_course_mappings?.[0]?.courses?.level).filter(Boolean)));
  const courses = Array.from(new Set(assignments.map(a => a.skills?.skill_course_mappings?.[0]?.courses?.title).filter(Boolean)));
  const departments = Array.from(new Set(assignments.map(a => a.profiles?.department).filter(Boolean)));
  const uniqueUsers = Array.from(new Map(assignments.map(a => [a.userid, { id: a.userid, fullname: a.profiles?.fullname, email: a.profiles?.email }])).values());

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 mb-6">
        {/* Filters Grid - Responsive Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          {/* Search Box - Full Width */}
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="relative">
              <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
              <input
                type="text"
                placeholder="Search Assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-500 text-sm"
              />
            </div>
          </div>

          {/* Filter Dropdowns */}
          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            className="w-full px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-sm"
          >
            <option value="all">All Visibility</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>

          <select
            value={filterFamily}
            onChange={(e) => setFilterFamily(e.target.value)}
            className="w-full px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-sm"
          >
            <option value="all">All Families</option>
            {families.map(family => (
              <option key={family} value={family}>{family}</option>
            ))}
          </select>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="w-full px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-sm"
          >
            <option value="all">All Levels</option>
            {levels.map(level => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-sm"
          >
            <option value="all">All Courses</option>
            {courses.map(course => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="w-full px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-sm"
          >
            <option value="all">All Users</option>
            {uniqueUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.fullname} ({user.email})
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons - Responsive */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-end w-full">
          {selectedAssignmentIds.size > 0 && (
            <button
              onClick={() => setIsBatchExpiryModalOpen(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-2 sm:py-1.5 rounded-lg flex items-center justify-center sm:justify-start gap-2 transition-colors border border-amber-200 text-xs sm:text-sm font-medium whitespace-nowrap"
              title={'Set expiry for ' + selectedAssignmentIds.size + ' selected assignment(s)'}
            >
              <span className="material-symbols-rounded text-sm">schedule</span>
              <span className="hidden sm:inline">Set Expiry</span>
              <span className="sm:hidden">Expiry</span>
            </button>
          )}
          <button
            onClick={handleClearExpired}
            className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 sm:py-1.5 rounded-lg flex items-center justify-center sm:justify-start gap-2 transition-colors border border-red-200 text-xs sm:text-sm font-medium whitespace-nowrap"
            title="Delete all expired assignments"
          >
            <span className="material-symbols-rounded text-sm">delete_sweep</span>
            <span className="hidden sm:inline">Clear Expired</span>
            <span className="sm:hidden">Clear</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 sm:py-1.5 rounded-lg flex items-center justify-center sm:justify-start gap-2 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
          >
            <span className="material-symbols-rounded text-sm">download</span>
            Export
          </button>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 sm:py-1.5 rounded-lg flex items-center justify-center sm:justify-start gap-2 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
          >
            <span className="material-symbols-rounded text-sm">add</span>
            <span className="hidden sm:inline">Assign Skill</span>
            <span className="sm:hidden">Assign</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="text-left bg-emerald-100 border-b-2 border-emerald-300">
              <th className="py-3 pl-4 font-semibold">
                <input
                  type="checkbox"
                  checked={selectedAssignmentIds.size === filteredAssignments.length && filteredAssignments.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </th>
              <th className="pb-3 pl-2 font-semibold text-gray-900">User</th>
              <th className="pb-3 font-semibold text-gray-900">Skill</th>
              <th className="pb-3 font-semibold text-gray-900">Course</th>
              <th className="pb-3 font-semibold text-gray-900">Level</th>
              <th className="pb-3 font-semibold text-gray-900">Validity</th>
              <th className="pb-3 font-semibold text-gray-900">Acquired</th>
              <th className="pb-3 font-semibold text-gray-900">Visibility</th>
              <th className="pb-3 pr-2 text-right font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-20">
                  <Loader size="lg" message="Loading assignments..." />
                </td>
              </tr>
            ) : filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-4 text-gray-700">No assignments found</td>
              </tr>
            ) : (
              filteredAssignments.map(assignment => (
                <tr key={assignment.id} className="group hover:bg-emerald-50 transition-colors border-b border-gray-200">
                  <td className="py-4 pl-2">
                    <input
                      type="checkbox"
                      checked={selectedAssignmentIds.has(assignment.id)}
                      onChange={() => toggleAssignmentSelection(assignment.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-xs font-semibold">
                        {assignment.profiles?.fullname
                          ? assignment.profiles.fullname.substring(0, 2).toUpperCase()
                          : assignment.userid.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 text-sm truncate max-w-[150px]" title={assignment.profiles?.fullname || assignment.userid}>
                          {assignment.profiles?.fullname || assignment.userid}
                        </span>
                        {assignment.profiles?.email && (
                          <span className="text-xs text-gray-700 truncate max-w-[150px]">{assignment.profiles.email}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-gray-800 font-medium">
                    <div className="flex flex-col">
                      <span>{assignment.skills?.name || 'Unknown Skill'}</span>
                      {(assignment as any).source === 'course_acquired' && (
                        <span className="text-xs text-amber-700 font-semibold">Acquired</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-gray-800 font-medium">
                    {assignment.skills?.skill_course_mappings?.[0]?.courses?.title || '-'}
                  </td>
                  <td className="py-4 text-gray-800 font-medium">
                    {assignment.skills?.skill_course_mappings?.[0]?.courses?.level
                      ? assignment.skills.skill_course_mappings[0].courses.level.charAt(0).toUpperCase() + assignment.skills.skill_course_mappings[0].courses.level.slice(1)
                      : '-'}
                  </td>
                  <td className="py-4 text-gray-800 font-medium">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-700">Assigned: {assignment.assignedat ? new Date(assignment.assignedat).toLocaleDateString() : '-'}</span>
                      {assignment.expiry_date ? (
                        <span className={`text-xs font-medium ${new Date(assignment.expiry_date) < new Date() ? 'text-red-500' :
                          (new Date(assignment.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) < 10 ? 'text-amber-500' : 'text-green-600'
                          }`}>
                          Expires: {new Date(assignment.expiry_date).toLocaleDateString()}
                          {new Date(assignment.expiry_date) >= new Date() && (
                            <span className="ml-1">
                              ({Math.ceil((new Date(assignment.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d left)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 italic">No Expiry</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4">
                    {(assignment as any).is_acquired ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <span className="material-symbols-rounded text-sm mr-1">check_circle</span>
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">
                        <span className="material-symbols-rounded text-sm mr-1">cancel</span>
                        No
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    {assignment.hidden ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">
                        Hidden
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-200 text-blue-800">
                        Visible
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingAssignment(assignment);
                          setEditFormData({
                            visible: assignment.visible,
                            hidden: assignment.hidden,
                            expiry_date: assignment.expiry_date ? assignment.expiry_date.split('T')[0] : ''
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="text-blue-700 hover:text-blue-900 p-1 rounded-full hover:bg-blue-100 transition-colors"
                        title="Edit Assignment"
                      >
                        <span className="material-symbols-rounded text-xl">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(assignment)}
                        className="text-red-700 hover:text-red-900 p-1 rounded-full hover:bg-red-100 transition-colors"
                        title="Delete Assignment"
                      >
                        <span className="material-symbols-rounded text-xl">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 gap-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredAssignments.length} items
        </div>
      </div>

      {/* Assign Skill Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Skill to User</h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select User
                </label>
                <select
                  value={assignFormData.targetUserId}
                  onChange={(e) => setAssignFormData({ ...assignFormData, targetUserId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select a user</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.fullname || user.email || user.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={assignFormData.expiry_date || ''}
                  onChange={(e) => setAssignFormData({ ...assignFormData, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Skills (Multiple)
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto p-2">
                  {availableSkills.map(skill => (
                    <label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignFormData.selectedSkillIds.includes(skill.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignFormData({
                              ...assignFormData,
                              selectedSkillIds: [...assignFormData.selectedSkillIds, skill.id]
                            });
                          } else {
                            setAssignFormData({
                              ...assignFormData,
                              selectedSkillIds: assignFormData.selectedSkillIds.filter(id => id !== skill.id)
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 dark:text-white">{skill.name}</span>
                        <span className="text-xs text-gray-500">{skill.family}</span>
                      </div>
                    </label>
                  ))}
                  {availableSkills.length === 0 && (
                    <p className="text-sm text-gray-500 p-2">No skills available</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssignFormData({ selectedSkillIds: [], targetUserId: '' });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSkills}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Assign Skills
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Expiry Modal */}
      {isBatchExpiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Set Expiry Date</h3>
              <p className="text-sm text-gray-500 mt-1">Update expiry for {selectedAssignmentIds.size} selected assignment(s)</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Duration
                </label>
                <div className="space-y-2">
                  {[
                    { id: '3months', label: '3 Months', days: 90 },
                    { id: '6months', label: '6 Months', days: 180 },
                    { id: '1year', label: '1 Year', days: 365 },
                    { id: '2years', label: '2 Years', days: 730 }
                  ].map(option => (
                    <label key={option.id} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="radio"
                        name="duration"
                        value={option.id}
                        checked={batchExpiryData.duration === option.id}
                        onChange={(e) => setBatchExpiryData({ ...batchExpiryData, duration: e.target.value })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{option.label}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="duration"
                      value="custom"
                      checked={batchExpiryData.duration === 'custom'}
                      onChange={(e) => setBatchExpiryData({ ...batchExpiryData, duration: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">Custom Date</span>
                  </label>
                </div>
              </div>

              {batchExpiryData.duration === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Date
                  </label>
                  <input
                    type="date"
                    value={batchExpiryData.customDate}
                    onChange={(e) => setBatchExpiryData({ ...batchExpiryData, customDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsBatchExpiryModalOpen(false);
                  setBatchExpiryData({ duration: '1year', customDate: '' });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchSetExpiry}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Apply to {selectedAssignmentIds.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Assignment</h3>
              <p className="text-sm text-gray-500 mt-1">
                {editingAssignment?.profiles?.fullname} - {editingAssignment?.skills?.name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={editFormData.expiry_date || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">Leave empty for no expiry</p>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Visible</span>
                  <span className="text-xs text-gray-500">Show this skill in the user's acquired skills</span>
                </div>
                <input
                  type="checkbox"
                  checked={editFormData.visible}
                  onChange={(e) => setEditFormData({ ...editFormData, visible: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Hidden</span>
                  <span className="text-xs text-gray-500">Temporarily hide this skill from the user</span>
                </div>
                <input
                  type="checkbox"
                  checked={editFormData.hidden}
                  onChange={(e) => setEditFormData({ ...editFormData, hidden: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingAssignment(null);
                }}
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

export default SkillAssignments;
