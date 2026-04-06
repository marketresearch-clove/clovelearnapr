import React, { useState, useEffect } from 'react';
import { leaderboardService } from '../lib/leaderboardService';
import { useAuth } from '../contexts/AuthContext';
import PublicProfileModal from '../components/PublicProfileModal';

const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('All Time');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');

  // Public Profile Modal
  const [showPublicProfile, setShowPublicProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [user?.id]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const leaderboard = await leaderboardService.getLeaderboardWithProfiles(100);
      setAllUsers(leaderboard);

      if (user?.id) {
        const rank = await leaderboardService.getUserRank(user.id);
        setUserRank(rank);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search query
  const filteredUsers = searchQuery.trim() === ''
    ? allUsers
    : allUsers.filter(user => {
      const profile = user.profiles;
      const name = (profile?.fullname || user.username || '').toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });

  const topThree = filteredUsers.slice(0, 3).map(user => {
    const profile = user.profiles; // Access the joined profile data
    const avatarUrl = profile?.avatarurl || user.useravatar || `https://i.pravatar.cc/150?u=${user.userid}`;

    return {
      rank: user.rank || 0,
      userId: user.userid,
      name: profile?.fullname || user.username,
      score: user.totalpoints || 0,
      avatar: avatarUrl,
      badgeColor: user.rank === 1 ? 'bg-primary-600' : user.rank === 2 ? 'bg-teal-600' : 'bg-orange-500'
    };
  });

  const listRunners = filteredUsers.slice(3, visibleCount).map(user => {
    const profile = user.profiles;
    const avatarUrl = profile?.avatarurl || user.useravatar || `https://i.pravatar.cc/150?u=${user.userid}`;

    return {
      rank: user.rank || 0,
      userId: user.userid,
      name: profile?.fullname || user.username,
      score: user.totalpoints || 0,
      avatar: avatarUrl
    };
  });

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + 20, allUsers.length));
  };

  const openPublicProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowPublicProfile(true);
  };

  return (
    <div className="min-h-full bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 text-center border-b border-slate-50">
          <h1 className="text-xl font-bold text-slate-900">Leaderboard</h1>
          {userRank && <p className="text-xs text-slate-500 mt-1">Your Rank: #{userRank.rank || 'N/A'}</p>}
        </div>

        {/* Search and Time Range Filter */}
        <div className="px-6 py-4 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 text-slate-600 text-sm rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* Time Range and Refresh */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 text-slate-600 text-sm rounded-full px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="All Time">All Time</option>
                <option value="This Month">This Month</option>
                <option value="This Week">This Week</option>
                <option value="Today">Today</option>
              </select>
              <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
            </div>
            <button onClick={fetchLeaderboard} className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:bg-slate-50 transition-colors shrink-0">
              <span className="material-symbols-rounded text-lg">refresh</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-slate-600 text-sm">Loading leaderboard...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 px-6">
            <div className="text-center">
              <span className="material-symbols-rounded text-5xl text-red-400 block mb-3">error</span>
              <p className="text-slate-600 font-medium mb-4">{error}</p>
              <button
                onClick={fetchLeaderboard}
                className="text-primary-600 text-sm font-medium hover:underline"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : allUsers.length === 0 ? (
          <div className="flex items-center justify-center py-16 px-6">
            <div className="text-center">
              <span className="material-symbols-rounded text-5xl text-slate-300 block mb-3">leaderboard</span>
              <p className="text-slate-600 font-medium">No leaderboard data yet</p>
              <p className="text-slate-500 text-sm mt-1">Start completing courses to appear on the leaderboard</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center py-16 px-6">
            <div className="text-center">
              <span className="material-symbols-rounded text-5xl text-slate-300 block mb-3">person_off</span>
              <p className="text-slate-600 font-medium">No results found</p>
              <p className="text-slate-500 text-sm mt-1">Try searching for a different name</p>
            </div>
          </div>
        ) : (
          <>
            {/* Podium */}
            <div className="flex justify-center items-end gap-4 px-6 pt-4 pb-10 border-b border-slate-100">
              {topThree.map((user) => (
                <div key={user.rank} className={`flex flex-col items-center ${user.rank === 1 ? 'order-2 -mt-6' : user.rank === 2 ? 'order-1' : 'order-3'}`}>
                  <div className="relative mb-3">
                    <div
                      className={`rounded-full p-1 cursor-pointer hover:opacity-80 transition-opacity ${user.rank === 1 ? 'w-24 h-24 bg-pink-100' : 'w-20 h-20 bg-slate-100'}`}
                      onClick={() => openPublicProfile(user.userId)}
                    >
                      <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div className={`absolute -bottom-2 -right-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white ${user.badgeColor}`}>
                      {user.rank}
                    </div>
                  </div>
                  <p
                    className="font-bold text-slate-800 text-sm text-center cursor-pointer hover:text-primary transition-colors"
                    onClick={() => openPublicProfile(user.userId)}
                  >
                    {user.name}
                  </p>
                  <div className="mt-1 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                    {user.score.toLocaleString()} XP
                  </div>
                </div>
              ))}
            </div>

            {/* List */}
            <div className="bg-slate-50/50">
              {listRunners.length > 0 ? (
                <>
                  {listRunners.map((user) => (
                    <div key={user.rank} className="flex items-center px-6 py-4 border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold mr-4 shrink-0">
                        {user.rank}
                      </div>
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover mr-4 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => openPublicProfile(user.userId)}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-bold text-slate-800 truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => openPublicProfile(user.userId)}
                        >
                          {user.name}
                        </p>
                      </div>
                      <div className="bg-slate-200/60 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                        {user.score.toLocaleString()} XP
                      </div>
                    </div>
                  ))}

                  {visibleCount < filteredUsers.length && (
                    <div className="p-4 text-center border-t border-slate-100">
                      <button
                        onClick={handleLoadMore}
                        className="text-primary-600 text-sm font-medium hover:underline flex items-center justify-center gap-1 mx-auto"
                      >
                        Load More
                        <span className="material-symbols-rounded text-lg">expand_more</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">Only top 3 learners have scores</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showPublicProfile && selectedUserId && (
        <PublicProfileModal
          userId={selectedUserId}
          onClose={() => setShowPublicProfile(false)}
        />
      )}
    </div>
  );
};

export default LeaderboardPage;
