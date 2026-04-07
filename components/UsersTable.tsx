import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

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

    return () => {
      supabase.removeChannel(profilesSubscription);
      supabase.removeChannel(statsSubscription);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch profiles first - with explicit ordering to debug
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, fullname, designation, location, department, role')
        .order('fullname', { ascending: true });

      if (profilesError) {
        console.error('Profiles fetch error:', profilesError);
        throw profilesError;
      }

      console.log('📊 Profiles fetched:', profiles?.length, 'profiles');
      console.log('👥 Departments found:', new Set(profiles?.map((p: any) => p.department).filter(Boolean)));

      // Fetch all statistics with retry logic
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
        return {
          ...profile,
          user_statistics: userStats ? {
            totalpoints: userStats.totalpoints || 0,
            totallearninghours: userStats.totallearninghours || 0,
            coursescompleted: userStats.coursescompleted || 0,
            totalcoursesenrolled: userStats.totalcoursesenrolled || 0
          } : {
            totalpoints: 0,
            totallearninghours: 0,
            coursescompleted: 0,
            totalcoursesenrolled: 0
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
    <div className="p-6 space-y-6">
      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 relative min-w-0">
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Search by name, department, or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
          />
        </div>

        {/* Advanced Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2 pr-8 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-gray-700 dark:text-gray-700"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-gray-700 dark:text-gray-700"
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select
            value={selectedDesignation}
            onChange={(e) => setSelectedDesignation(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-gray-700 dark:text-gray-700"
          >
            <option value="all">All Designations</option>
            {designations.map((desig) => (
              <option key={desig} value={desig}>{desig}</option>
            ))}
          </select>
        </div>

        {/* Metric Filter Controls */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: 'completion', label: 'Completion', icon: 'analytics' },
            { id: 'points', label: 'Grade', icon: 'grade' },
            { id: 'hours', label: 'Schedule', icon: 'schedule' },
            { id: 'name', label: 'Person', icon: 'person' }
          ].map((metric: any) => (
            <button
              key={metric.id}
              onClick={() => setSortBy(metric.id as any)}
              className={`px-4 py-2 text-[11px] font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${sortBy === metric.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
              title={`Sort by ${metric.label}`}
            >
              <span className="material-symbols-rounded text-base">{metric.icon}</span>
              <span>{metric.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      {filteredAndSortedUsers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-white dark:to-gray-50 rounded-2xl border border-blue-100 dark:border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{filteredAndSortedUsers.length}</div>
            <div className="text-xs text-gray-700 dark:text-gray-700 mt-1">Total Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(filteredAndSortedUsers.reduce((sum, u) => {
                const s = u.user_statistics || {};
                return sum + (s.totalcoursesenrolled > 0 ? (s.coursescompleted / s.totalcoursesenrolled) * 100 : 0);
              }, 0) / filteredAndSortedUsers.length)}%
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-700 mt-1">Avg Completion</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(filteredAndSortedUsers.reduce((sum, u) => sum + ((u.user_statistics?.totallearninghours) || 0), 0) / filteredAndSortedUsers.length / 60)}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-700 mt-1">Avg Hours</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(filteredAndSortedUsers.reduce((sum, u) => sum + ((u.user_statistics?.totalpoints) || 0), 0) / filteredAndSortedUsers.length)} XP
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-700 mt-1">Avg Points</div>
          </div>
        </div>
      )}

      {/* User Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedUsers.length > 0 ? (
          filteredAndSortedUsers.map((user) => {
            const stats = user.user_statistics || {};
            const completionRate = stats.totalcoursesenrolled > 0
              ? Math.round((stats.coursescompleted / stats.totalcoursesenrolled) * 100)
              : 0;

            return (
              <div
                key={user.id}
                className="bg-white dark:bg-white rounded-2xl border border-gray-100 dark:border-gray-200 p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-gray-900 text-sm line-clamp-2">{user.fullname || 'Unknown User'}</h3>
                    <p className="text-xs text-gray-700 dark:text-gray-700 mt-0.5">{user.designation || 'N/A'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-50 dark:bg-blue-50 text-blue-700 dark:text-blue-700 rounded">
                        {user.department || 'N/A'}
                      </span>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-50 dark:bg-gray-50 text-gray-700 dark:text-gray-700 rounded">
                        {user.location || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Circle */}
                <div className="flex items-center justify-center mb-4 py-2">
                  <div className="relative">
                    <CircularProgress percentage={completionRate} size={70} strokeWidth={2} />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-3 p-3 bg-white dark:bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{stats.coursescompleted || 0}</div>
                    <div className="text-xs text-gray-700 dark:text-gray-700">Completed</div>
                  </div>
                  <div className="border-l border-r border-gray-200 dark:border-gray-200 text-center">
                    <div className="text-lg font-bold text-green-600">
                      {Math.round((stats.totallearninghours || 0) / 60)}
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-700">Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-500">{(stats.totalpoints || 0).toLocaleString()} XP</div>
                    <div className="text-xs text-gray-700 dark:text-gray-700">Points</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-700 dark:text-gray-700 font-medium">Course Progress</span>
                    <span className="text-gray-900 dark:text-gray-900 font-bold">{stats.coursescompleted}/{stats.totalcoursesenrolled}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-500"
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
            <p className="text-gray-700 dark:text-gray-700">No users found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersTable;