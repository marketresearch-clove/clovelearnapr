
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ConcernRaiseWidget from './ConcernRaiseWidget';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  onStartTutorial?: () => void;
  isTutorialActive?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onStartTutorial, isTutorialActive = false }) => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [tutorialActive, setTutorialActive] = React.useState(isTutorialActive);

  // Listen for tutorial events
  React.useEffect(() => {
    const handleTutorialStart = () => setTutorialActive(true);
    const handleTutorialEnd = () => setTutorialActive(false);

    window.addEventListener('tutorial-started', handleTutorialStart);
    window.addEventListener('tutorial-ended', handleTutorialEnd);

    return () => {
      window.removeEventListener('tutorial-started', handleTutorialStart);
      window.removeEventListener('tutorial-ended', handleTutorialEnd);
    };
  }, []);

  // Determine effective sidebar state
  const effectiveOpen = React.useMemo(() => {
    if (tutorialActive) {
      // On mobile/tablet, always open sidebar during tutorial
      // On desktop (md+), open could be controlled by user
      const isMobile = window.innerWidth < 768;
      return isMobile ? true : (isOpen ?? false);
    }
    return isOpen ?? false;
  }, [tutorialActive, isOpen]);

  const handleLogoClick = () => {
    // Sign out and redirect to home/landing page
    signOut();
    navigate('/');
    if (onClose) {
      onClose();
    }
  };

  // Prevent closing sidebar on mobile during tutorial
  const handleClose = React.useCallback(() => {
    if (!tutorialActive && onClose) {
      onClose();
    }
  }, [tutorialActive, onClose]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
    { name: 'Catalog', icon: 'grid_view', path: '/catalog' },
    { name: 'My Learning', icon: 'school', path: '/learning' },
    { name: 'Calendar', icon: 'calendar_month', path: '/calendar' },
    { name: 'Community', icon: 'forum', path: '/community' },
    { name: 'Organization', icon: 'group', path: '/hierarchy' },
    { name: 'Leaderboard', icon: 'leaderboard', path: '/leaderboard' },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {effectiveOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={handleClose}
          style={{ pointerEvents: tutorialActive ? 'none' : 'auto' }}
        />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 ${isCollapsed ? 'md:w-20' : 'w-64'} bg-white border-r border-slate-200 flex flex-col h-full z-50 shadow-sm transition-all duration-300 transform ${effectiveOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:flex md:relative`}>
        {/* Collapse Toggle Button - Desktop Only */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-500 hover:text-primary-600 hover:border-primary-200 shadow-sm z-50 transition-all duration-300"
          disabled={tutorialActive}
          title={tutorialActive ? 'Sidebar locked during tutorial' : ''}
        >
          <span className="material-symbols-rounded text-sm">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>

        {/* Header - Fixed */}
        <div className="flex-shrink-0">
          <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-6'} border-b border-slate-100 cursor-pointer overflow-hidden`} onClick={handleLogoClick}>
            <div className="flex items-center">
              <div className={`w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center ${isCollapsed ? '' : 'mr-3'} shrink-0`}>
                <span className="material-symbols-rounded text-white text-xl">landscape</span>
              </div>
              {!isCollapsed && <span className="font-heading font-bold text-xl text-slate-800 tracking-tight whitespace-nowrap">Clove LP</span>}
            </div>
            {!isCollapsed && (
              <button className="md:hidden p-1 text-slate-500 hover:text-slate-700" onClick={handleClose}>
                <span className="material-symbols-rounded">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          <nav className={`p-4 ${isCollapsed ? 'px-2' : 'space-y-1'}`}>
            {!isCollapsed && <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-2">Menu</p>}
            <div className="space-y-1">
              {navItems.map((item) => {
                const dataAttr = `menu-${item.path.replace('/', '')}`;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => !tutorialActive && handleClose()}
                    data-tutorial={dataAttr}
                    className={({ isActive }) =>
                      `flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg transition-colors group ${isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } ${tutorialActive ? 'cursor-help' : ''}`
                    }
                    title={isCollapsed ? item.name : ''}
                  >
                    <span className={`material-symbols-rounded ${isCollapsed ? '' : 'mr-3'} ${window.location.hash.includes(item.path) ? 'icon-filled' : ''}`}>
                      {item.icon}
                    </span>
                    {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>}
                  </NavLink>
                );
              })}
              <button
                onClick={handleLogout}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg transition-colors group text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isCollapsed ? 'Logout' : ''}
                disabled={tutorialActive}
              >
                <span className={`material-symbols-rounded ${isCollapsed ? '' : 'mr-3'}`}>logout</span>
                {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">Logout</span>}
              </button>
            </div>
          </nav>

          {/* Spacer to push footer down if content doesn't fill */}
          <div className="flex-1"></div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0">
          {!isCollapsed && (
            <div className="p-2 md:p-4 border-t border-slate-100 space-y-2 md:space-y-3">
              <ConcernRaiseWidget
                userId={user?.id || ''}
                userEmail={user?.email || ''}
                fullName={user?.user_metadata?.fullname || user?.user_metadata?.full_name || 'User'}
              />

              {/* Help Icon for Tutorial */}
              <button
                onClick={() => {
                  // Emit event to restart tutorial instantly
                  const event = new Event('restart-tutorial');
                  window.dispatchEvent(event);
                  // Close sidebar
                  if (onClose) onClose();
                }}
                className="w-full flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 md:py-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors border border-blue-200 text-sm md:text-base"
                title="Start platform walkthrough"
              >
                <span className="material-symbols-rounded text-base md:text-lg flex-shrink-0">help</span>
                <span className="font-medium hidden sm:inline text-sm md:text-base">Start Walkthrough</span>
                <span className="font-medium sm:hidden text-xs">Walkthrough</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;