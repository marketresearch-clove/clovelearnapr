
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { userSkillAchievementService } from '../lib/userSkillAchievementService';
import { leaderboardService } from '../lib/leaderboardService';
import { userStatisticsService } from '../lib/userStatisticsService';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';

interface PublicProfileModalProps {
  userId: string;
  onClose: () => void;
}

const PublicProfileModal: React.FC<PublicProfileModalProps> = ({ userId, onClose }) => {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Fetch stats from leaderboard first (as requested)
        const rankData = await leaderboardService.getUserRank(userId);

        if (rankData) {
          setStats(rankData);
        } else {
          // Fallback to user statistics
          const userStats = await userStatisticsService.getUserStatistics(userId);
          setStats(userStats);
        }

        // Fetch badges
        const userBadges = await userSkillAchievementService.getUserBadges(userId);
        setBadges(userBadges);

      } catch (error) {
        console.error('Error fetching public profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header/Cover */}
        <div className="h-24 bg-gradient-to-r from-primary-600 to-indigo-600"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors z-10"
        >
          <span className="material-symbols-rounded">close</span>
        </button>

        <div className="px-6 pb-8 -mt-12">
          {/* Profile Header */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={profile.avatarurl || `https://i.pravatar.cc/150?u=${userId}`}
                alt={profile.fullname}
                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 object-cover shadow-lg"
              />
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{profile.fullname}</h2>
              {profile.role === 'admin' && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
              )}
              {profile.role === 'instructor' && (
                <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Instructor</span>
              )}
            </div>
            <p className="text-primary-600 dark:text-primary-400 font-semibold text-sm">
              {profile.designation || (profile.role === 'admin' ? 'Administrator' : profile.role === 'instructor' ? 'Instructor' : 'Learner')}
            </p>
            <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">{profile.department || 'General'}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-slate-50 dark:bg-gray-800 p-4 rounded-2xl text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {(stats?.totalpoints || (stats?.coursescompleted || 0) * 100).toLocaleString()}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total XP</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-800 p-4 rounded-2xl text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.coursescompleted || 0}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed</p>
            </div>
          </div>

          {/* User Details */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-slate-600 dark:text-gray-300">
              <span className="material-symbols-rounded text-lg opacity-70">badge</span>
              <div className="text-sm">
                <span className="text-slate-400 text-xs block">Employee ID</span>
                <span className="font-medium">{profile.user_id || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-gray-300">
              <span className="material-symbols-rounded text-lg opacity-70">business</span>
              <div className="text-sm">
                <span className="text-slate-400 text-xs block">Department</span>
                <span className="font-medium">{profile.department || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Achievements</h3>
              <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-bold">{badges.length} Earned</span>
            </div>

            {badges.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 mt-4 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {badges.map((badge, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center text-center gap-2"
                    title={badge.name}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-gray-700 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: badge.isEFSET ? `${badge.color}15` : 'rgba(79, 70, 229, 0.1)',
                        color: badge.isEFSET ? badge.color : 'rgb(79, 70, 229)'
                      }}
                    >
                      {badge.isEFSET ? (
                        <span className="material-symbols-rounded text-2xl">{badge.icon}</span>
                      ) : badge.icon && (FaIcons as any)[badge.icon] ? (
                        React.createElement((FaIcons as any)[badge.icon], { size: 24 })
                      ) : badge.icon && (MdIcons as any)[badge.icon] ? (
                        React.createElement((MdIcons as any)[badge.icon], { size: 24 })
                      ) : (
                        <span className="material-symbols-rounded text-2xl">workspace_premium</span>
                      )}
                    </div>
                    <p className="text-[10px] leading-tight font-medium text-slate-600 dark:text-gray-400 break-words w-full">
                      {badge.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-slate-200 dark:border-gray-700">
                No badges earned yet.
              </p>
            )}
          </div>

          <div className="mt-8">
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfileModal;
