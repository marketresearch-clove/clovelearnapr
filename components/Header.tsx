import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ProfileSettingsModal from './ProfileSettingsModal';
import NotificationDropdown from './NotificationDropdown';
import UserSearchBar from './UserSearchBar';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('fullname, user_id, avatarurl')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setUserProfile(data);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user?.id, isProfileModalOpen]);

  const displayName = userProfile?.fullname || user?.email?.split('@')[0] || 'User';
  const userId = userProfile?.user_id || '';
  const avatarUrl = userProfile?.avatarurl;

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 z-[100] sticky top-0">
        {/* Mobile Menu Toggle (Visible only on small screens) */}
        <button
          className="md:hidden p-1 text-slate-500 hover:text-slate-700 mr-4"
          onClick={onMenuClick}
        >
          <span className="material-symbols-rounded">menu</span>
        </button>

        {/* Search Bar */}
        <UserSearchBar />

        {/* Right Actions */}
        <div className="flex items-center space-x-4 ml-4">
          <NotificationDropdown />

          <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>

          <div
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsProfileModalOpen(true)}
            data-tutorial="profile-icon"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{displayName}</p>
              <p className="text-xs text-slate-500">{userId}</p>
            </div>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full border-2 border-white shadow-sm bg-slate-200 flex items-center justify-center">
                <span className="material-symbols-rounded text-slate-500 text-lg">person</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};

export default Header;