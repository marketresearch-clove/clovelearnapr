import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { timeTrackingService } from '../lib/timeTrackingService';

interface UserData {
  id: string;
  fullname: string;
  designation: string;
  location: string;
  department: string;
  user_statistics: {
    totalpoints: number;
    totallearninghours: number;
    coursescompleted: number;
    totalcoursesenrolled: number;
  } | null;
}

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ percentage, size = 60, strokeWidth = 3 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = (percent: number) => {
    if (percent >= 80) return '#10b981'; // green
    if (percent >= 60) return '#3b82f6'; // blue
    if (percent >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(percentage)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-sm font-bold text-gray-900 dark:text-gray-900">{percentage}%</div>
      </div>
    </div>
  );
};

const UsersTable: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'points' | 'hours' | 'completion' | 'name'>('completion');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedDesignation, setSelectedDesignation] = useState<string>('all');
  const [visibleColumns, setVisibleColumns] = useState<{
    department: boolean;
    location: boolean;
    designation: boolean;
    hours: boolean;
    points: boolean;
  }>({
    department: true,
    location: true,
    designation: true,
    hours: true,
    points: true
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Get unique departments, locations, and designations
  const departments = useMemo(() => {
    const depts = new Set(users.map(u => u.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [users]);

  const locations = useMemo(() => {
    const locs = new Set(users.map(u => u.location).filter(Boolean));
    return Array.from(locs).sort();
  }, [users]);

  const designations = useMemo(() => {
    const desigs = new Set(users.map(u => u.designation).filter(Boolean));
    return Array.from(desigs).sort();
  }, [users]);

  useEffect(() => {
    fetchUsers();

    // Subscribe to changes
    const profilesSubscription = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    const statsSubscription = supabase
      .channel('public:user_statistics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_statistics' }, () => {
        fetchUsers();
      })
      .subscribe();

    // Close column menu on click outside
    const handleClickOutside = (e: MouseEvent) => {
      const columnMenu = document.getElementById('column-menu');
      const columnButton = document.getElementById('column-button');
      if (columnMenu && !columnMenu.contains(e.target as Node) && !columnButton?.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(profilesSubscription);
      supabase.removeChannel(statsSubscription);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch profiles first
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, fullname, designation, location, department, role')
        .order('fullname', { ascending: true });

      if (profilesError) {
        console.error('Profiles fetch error:', profilesError);
        throw profilesError;
      }

      console.log('📊 Profiles fetched:', profiles?.length, 'profiles');

      // Fetch enrollments to get actual time spent per user
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('userid, completed, hoursspent');

      if (enrollmentsError) {
        console.warn('Enrollments fetch error:', enrollmentsError);
      }

      // Fetch user_statistics for other data
      let stats = [];
      try {
        const { data: statsData, error: statsError } = await supabase
          .from('user_statistics')
          .select('userid, totalpoints, totallearninghours, coursescompleted, totalcoursesenrolled');

        if (statsError) {
          console.warn('Stats error:', statsError);
        } else if (statsData) {
          stats = statsData;
          console.log('📈 Statistics fetched:', statsData.length, 'records');
        }
      } catch (e) {
        console.warn('Error fetching user statistics:', e);
      }

      // Map statistics to users
      const usersWithStats = (profiles || []).map(profile => {
        const userStats = (stats || []).find((s: any) => s.userid === profile.id);

        // Calculate hours and XP from enrollments
        const userEnrollments = (enrollments || []).filter((e: any) => e.userid === profile.id);
        const totalHoursspent = userEnrollments.reduce((sum: number, e: any) => sum + (e.hoursspent || 0), 0);
        const completedCount = userEnrollments.filter((e: any) => e.completed).length;

        return {
          ...profile,
          user_statistics: {
            totalpoints: userStats?.totalpoints || 0, // Get XP from user_statistics
            totallearninghours: totalHoursspent || userStats?.totallearninghours || 0, // Get hours from enrollments or user_statistics
            coursescompleted: completedCount || (userStats?.coursescompleted || 0),
            totalcoursesenrolled: userEnrollments.length || (userStats?.totalcoursesenrolled || 0)
          }
        };
      });

      console.log('✅ Users with stats loaded:', usersWithStats.length);
      setUsers(usersWithStats);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort and filter users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter(user => {
      const matchesSearch = (user.fullname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.designation || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = selectedDepartment === 'all' || user.department === selectedDepartment;
      const matchesLocation = selectedLocation === 'all' || user.location === selectedLocation;
      const matchesDesignation = selectedDesignation === 'all' || user.designation === selectedDesignation;

      return matchesSearch && matchesDept && matchesLocation && matchesDesignation;
    });

    return filtered.sort((a, b) => {
      const aStats = a.user_statistics || { totalcoursesenrolled: 0, coursescompleted: 0, totalpoints: 0, totallearninghours: 0 };
      const bStats = b.user_statistics || { totalcoursesenrolled: 0, coursescompleted: 0, totalpoints: 0, totallearninghours: 0 };
      const aCompletion = aStats.totalcoursesenrolled > 0 ? (aStats.coursescompleted / aStats.totalcoursesenrolled) * 100 : 0;
      const bCompletion = bStats.totalcoursesenrolled > 0 ? (bStats.coursescompleted / bStats.totalcoursesenrolled) * 100 : 0;

      switch (sortBy) {
        case 'points':
          return (bStats.totalpoints || 0) - (aStats.totalpoints || 0);
        case 'hours':
          return (bStats.totallearninghours || 0) - (aStats.totallearninghours || 0);
        case 'completion':
          return bCompletion - aCompletion;
        case 'name':
          return (a.fullname || '').localeCompare(b.fullname || '');
        default:
          return 0;
      }
    });
  }, [users, sortBy, searchQuery, selectedDepartment, selectedLocation, selectedDesignation]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-700 dark:text-gray-700">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50">
      {/* Action Buttons Header */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center justify-between">


        {/* Column Visibility Toggle */}
        <div className="relative">
          <button
            id="column-button"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 bg-white text-gray-700 text-xs sm:text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors"
            title="Toggle column visibility"
          >
            <span className="material-symbols-rounded text-base">view_list</span>
            <span className="hidden sm:inline">Columns</span>
            <span className="sm:hidden">Columns</span>
            <span className="material-symbols-rounded text-xs transition-transform" style={{ transform: showColumnMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
          </button>

          {showColumnMenu && (
            <div id="column-menu" className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-0 mt-2 w-44 sm:w-48 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-200px)] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:bg-gray-50 p-2 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.department}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, department: e.target.checked })}
                    className="rounded"
                  />
                  <span className="material-symbols-rounded text-sm">location_on</span>
                  Department
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:bg-gray-50 p-2 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.location}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, location: e.target.checked })}
                    className="rounded"
                  />
                  <span className="material-symbols-rounded text-sm">place</span>
                  Location
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:bg-gray-50 p-2 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.designation}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, designation: e.target.checked })}
                    className="rounded"
                  />
                  <span className="material-symbols-rounded text-sm">work</span>
                  Designation
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:bg-gray-50 p-2 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.hours}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, hours: e.target.checked })}
                    className="rounded"
                  />
                  <span className="material-symbols-rounded text-sm">schedule</span>
                  Learning Hours
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:bg-gray-50 p-2 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.points}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, points: e.target.checked })}
                    className="rounded"
                  />
                  <span className="material-symbols-rounded text-sm">star</span>
                  Points
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar - Full Width */}
      <div className="relative min-w-0">
        <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
        <input
          type="text"
          placeholder="Search by name, department, or designation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-xs sm:text-sm"
        />
      </div>

      {/* Controls Row - Page Per View & Metric Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
        {/* Metric Filter Controls - Page Per View */}
        <div className="flex bg-white border border-gray-200 p-1 rounded-lg w-fit flex-shrink-0">
          {[
            { id: 'completion', label: 'Complete', icon: 'done_all' },
            { id: 'points', label: 'Grade', icon: 'grade' },
            { id: 'hours', label: 'Hours', icon: 'schedule' },
            { id: 'name', label: 'Name', icon: 'person' }
          ].map((metric: any) => (
            <button
              key={metric.id}
              onClick={() => setSortBy(metric.id as any)}
              className={`px-1.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-xs font-bold uppercase rounded transition-all flex items-center gap-0.5 sm:gap-1 whitespace-nowrap ${sortBy === metric.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
              title={`Sort by ${metric.label}`}
            >
              <span className="material-symbols-rounded text-xs sm:text-sm">{metric.icon}</span>
              <span>{metric.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters - Stacked for Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="px-2 sm:px-3 py-2 pr-6 sm:pr-8 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-xs sm:text-sm text-gray-700 dark:text-gray-700"
        >
          <option value="all">All Dept</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>

        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="px-2 sm:px-3 py-2 pr-6 sm:pr-8 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-xs sm:text-sm text-gray-700 dark:text-gray-700"
        >
          <option value="all">All Loc</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>

        <select
          value={selectedDesignation}
          onChange={(e) => setSelectedDesignation(e.target.value)}
          className="px-2 sm:px-3 py-2 pr-6 sm:pr-8 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-xs sm:text-sm text-gray-700 dark:text-gray-700 col-span-2 sm:col-span-1"
        >
          <option value="all">All Designation</option>
          {designations.map((desig) => (
            <option key={desig} value={desig}>{desig}</option>
          ))}
        </select>
      </div>

      {/* Stats Summary */}
      {filteredAndSortedUsers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-5 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-white dark:to-gray-50 rounded-2xl border border-indigo-100 dark:border-gray-200">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <span className="material-symbols-rounded text-indigo-600 text-2xl sm:text-3xl">people</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-indigo-600">{filteredAndSortedUsers.length}</div>
            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 mt-1">Total Users</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <span className="material-symbols-rounded text-green-600 text-2xl sm:text-3xl">check_circle</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {Math.round(filteredAndSortedUsers.reduce((sum, u) => {
                const s = u.user_statistics || {};
                return sum + (s.totalcoursesenrolled > 0 ? (s.coursescompleted / s.totalcoursesenrolled) * 100 : 0);
              }, 0) / filteredAndSortedUsers.length)}%
            </div>
            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 mt-1">Avg Complete</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <span className="material-symbols-rounded text-blue-600 text-2xl sm:text-3xl">schedule</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {timeTrackingService.formatSeconds(
                Math.round(filteredAndSortedUsers.reduce((sum, u) => sum + ((u.user_statistics?.totallearninghours) || 0), 0) / filteredAndSortedUsers.length)
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 mt-1">Avg Hours</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <span className="material-symbols-rounded text-orange-600 text-2xl sm:text-3xl">star</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-orange-600">
              {Math.round(filteredAndSortedUsers.reduce((sum, u) => sum + ((u.user_statistics?.totalpoints) || 0), 0) / filteredAndSortedUsers.length)}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 mt-1">Avg XP</div>
          </div>
        </div>
      )}

      {/* User Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredAndSortedUsers.length > 0 ? (
          filteredAndSortedUsers.map((user) => {
            const stats = user.user_statistics || {};
            const completionRate = stats.totalcoursesenrolled > 0
              ? Math.round((stats.coursescompleted / stats.totalcoursesenrolled) * 100)
              : 0;

            return (
              <div
                key={user.id}
                className="bg-white dark:bg-white rounded-2xl border border-gray-100 dark:border-gray-200 p-3 sm:p-5 hover:shadow-lg hover:border-indigo-300 transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-rounded text-indigo-600 text-lg flex-shrink-0 mt-0.5">person</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-gray-900 text-xs sm:text-sm line-clamp-2">{user.fullname || 'Unknown User'}</h3>
                        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 mt-0.5">{user.designation || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-indigo-50 dark:bg-indigo-50 text-indigo-700 dark:text-indigo-700 rounded">
                        <span className="material-symbols-rounded text-xs">location_on</span>
                        <span className="hidden sm:inline">{user.department || 'N/A'}</span>
                        <span className="sm:hidden">{(user.department || 'N/A').substring(0, 3)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-blue-50 dark:bg-blue-50 text-blue-700 dark:text-blue-700 rounded">
                        <span className="material-symbols-rounded text-xs">place</span>
                        <span className="hidden sm:inline">{user.location || 'N/A'}</span>
                        <span className="sm:hidden">{(user.location || 'N/A').substring(0, 3)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Circle */}
                <div className="flex items-center justify-center mb-3 sm:mb-4 py-1 sm:py-2">
                  <div className="relative">
                    <CircularProgress percentage={completionRate} size={60} strokeWidth={2} />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4 p-2 sm:p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-100 dark:to-gray-50 rounded-xl">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <span className="material-symbols-rounded text-indigo-600 text-base">done_all</span>
                    </div>
                    <div className="text-sm sm:text-base font-bold text-indigo-600">{stats.coursescompleted || 0}</div>
                    <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 whitespace-nowrap">Completed</div>
                  </div>
                  <div className="border-l border-r border-gray-300 dark:border-gray-300 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <span className="material-symbols-rounded text-green-600 text-base">schedule</span>
                    </div>
                    <div className="text-sm sm:text-base font-bold text-green-600">
                      {timeTrackingService.formatSeconds(stats.totallearninghours || 0)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 whitespace-nowrap">Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <span className="material-symbols-rounded text-orange-500 text-base">star</span>
                    </div>
                    <div className="text-sm sm:text-base font-bold text-orange-500">{stats.totalpoints || 0}</div>
                    <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-700 whitespace-nowrap">XP</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex justify-between items-center text-[10px] sm:text-xs">
                    <span className="text-gray-600 dark:text-gray-700 font-medium">Course Progress</span>
                    <span className="text-gray-900 dark:text-gray-900 font-bold">{stats.coursescompleted}/{stats.totalcoursesenrolled}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center">
            <span className="material-symbols-rounded text-4xl text-gray-400 dark:text-gray-700 block mb-2">person_off</span>
            <p className="text-gray-600 dark:text-gray-700 text-sm">No users found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersTable;