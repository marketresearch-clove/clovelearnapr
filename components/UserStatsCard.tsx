import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const UserStatsCard: React.FC = () => {
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    completedCount: 0,
    inProgressCount: 0,
    notStartedCount: 0,
    completedPercent: 0,
    inProgressPercent: 0,
    notStartedPercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch all users
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id');

      if (usersError) throw usersError;

      const totalUsers = users?.length || 0;

      // Fetch enrollment statistics
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('userid, completed');

      if (enrollError) throw enrollError;

      const completedUsers = new Set(
        (enrollments || [])
          .filter((e: any) => e.completed)
          .map((e: any) => e.userid)
      );

      const enrolledUsers = new Set((enrollments || []).map((e: any) => e.userid));
      const inProgressCount = enrolledUsers.size - completedUsers.size;
      const notStartedCount = totalUsers - enrolledUsers.size;

      const completedCount = completedUsers.size;

      const completedPercent = totalUsers > 0 ? (completedCount / totalUsers) * 100 : 0;
      const inProgressPercent = totalUsers > 0 ? (inProgressCount / totalUsers) * 100 : 0;
      const notStartedPercent = totalUsers > 0 ? (notStartedCount / totalUsers) * 100 : 0;

      setStats({
        totalUsers,
        completedCount,
        inProgressCount,
        notStartedCount,
        completedPercent: Math.round(completedPercent),
        inProgressPercent: Math.round(inProgressPercent),
        notStartedPercent: Math.round(notStartedPercent),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const handleMouseEnter = (segment: string) => {
    setHoveredSegment(segment);
  };

  const handleMouseLeave = () => {
    setHoveredSegment(null);
  };

  const getTooltipContent = (segment: string) => {
    switch (segment) {
      case 'completed':
        return `${stats.completedCount} users (${stats.completedPercent}%) - Completed`;
      case 'inProgress':
        return `${stats.inProgressCount} users (${stats.inProgressPercent}%) - In Progress`;
      case 'notStarted':
        return `${stats.notStartedCount} users (${stats.notStartedPercent}%) - Not Started`;
      default:
        return '';
    }
  };

  const circumference = 100;
  const completedDasharray = stats.completedPercent;
  const inProgressDasharray = stats.inProgressPercent;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-800">User stats</h2>
        <span className="material-symbols-rounded text-gray-400 text-base">info</span>
      </div>
      <div className="flex items-center space-x-6">
        <div className="w-1/2">
          <p className="text-sm text-gray-500">by journey status</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Total no of users</p>
          <div className="mt-6 space-y-3">
            <div className="flex items-center text-sm">
              <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              <span className="text-gray-600 flex-1">Completed</span>
              <span className="font-medium text-gray-700">{stats.completedPercent}%</span>
            </div>
            <div className="flex items-center text-sm">
              <span className="w-3 h-3 rounded-full bg-orange-400 mr-2"></span>
              <span className="text-gray-600 flex-1">In Progress</span>
              <span className="font-medium text-gray-700">{stats.inProgressPercent}%</span>
            </div>
            <div className="flex items-center text-sm">
              <span className="w-3 h-3 rounded-full bg-gray-300 mr-2"></span>
              <span className="text-gray-600 flex-1">Not to start</span>
              <span className="font-medium text-gray-700">{stats.notStartedPercent}%</span>
            </div>
          </div>
        </div>
        <div className="w-1/2 flex justify-center items-center">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path className="stroke-current text-gray-300" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"></path>
              <path
                className={`stroke-current text-green-500 cursor-pointer transition-all ${hoveredSegment === 'completed' ? 'opacity-100' : 'opacity-70'}`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                strokeDasharray={`${completedDasharray}, ${circumference}`}
                strokeLinecap="round"
                strokeWidth={hoveredSegment === 'completed' ? 4 : 3}
                onMouseEnter={() => handleMouseEnter('completed')}
                onMouseLeave={handleMouseLeave}
              ></path>
              <path
                className={`stroke-current text-orange-400 cursor-pointer transition-all ${hoveredSegment === 'inProgress' ? 'opacity-100' : 'opacity-70'}`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                strokeDasharray={`${inProgressDasharray}, ${circumference}`}
                strokeDashoffset={`-${completedDasharray}`}
                strokeLinecap="round"
                strokeWidth={hoveredSegment === 'inProgress' ? 4 : 3}
                onMouseEnter={() => handleMouseEnter('inProgress')}
                onMouseLeave={handleMouseLeave}
              ></path>
            </svg>
            {/* Tooltip */}
            {hoveredSegment && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap mb-2">
                  {getTooltipContent(hoveredSegment)}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserStatsCard;