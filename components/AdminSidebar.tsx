import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleLogoClick = async () => {
    // Sign out and redirect to home/landing page
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Logo click logout failed:', error);
      navigate('/');
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { path: '/admin/user-management', label: 'User Management', icon: 'group' },
    { path: '/admin/user-management-v2', label: 'User Management V2', icon: 'person_check' },
    { path: '/admin/courses', label: 'Courses', icon: 'school' },
    // { path: '/admin/course-assignments', label: 'Manage Courses', icon: 'assignment' }, // Hidden - integrated into Courses page
    { path: '/admin/assessments', label: 'Assessments', icon: 'assignment_turned_in' },
    { path: '/admin/learning-journeys', label: 'Learning Journeys', icon: 'map' },
    { path: '/admin/skills', label: 'Skill Management', icon: 'psychology' },
    { path: '/admin/analytics', label: 'Analytics', icon: 'bar_chart' },
    { path: '/admin/reports', label: 'Reports', icon: 'assessment' },
    { path: '/admin/notifications', label: 'Notifications', icon: 'notifications' },
    { path: '/admin/acknowledgements', label: 'Acknowledgements', icon: 'verified' },
    { path: '/admin/certificate-signatures', label: 'Certificate Signatures', icon: 'signature' },
    { path: '/admin/concerns', label: 'Concern Management', icon: 'support_agent' },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onToggle}
        />
      )}

      <aside className={`fixed md:relative inset-y-0 left-0 ${isOpen ? 'w-64' : 'w-20'} flex flex-col gap-y-6 border-r border-gray-200 bg-white p-4 transition-all duration-300 z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Collapse Toggle Button - Desktop Only */}
        {onToggle && (
          <button
            onClick={onToggle}
            className="hidden md:flex absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-600 hover:text-primary hover:border-primary shadow-sm z-50 transition-all duration-300"
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="material-symbols-rounded text-sm">
              {isOpen ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
        )}
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleLogoClick}>
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-rounded text-white text-base">dashboard</span>
          </div>
          {isOpen && (
            <div className="flex flex-col">
              <h1 className="text-gray-900 text-base font-semibold leading-normal">Clove Learning Portal</h1>
              <p className="text-gray-500 text-xs font-normal leading-normal">Admin</p>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive(item.path)
                ? 'bg-primary/20 text-primary'
                : 'text-gray-700 hover:bg-gray-100'
                }`}
              title={item.label}
            >
              <span className="material-symbols-rounded text-base flex-shrink-0">{item.icon}</span>
              {isOpen && <p className="text-sm font-medium leading-normal whitespace-nowrap">{item.label}</p>}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-gray-200 pt-4">
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
            title="Back to Home"
          >
            <span className="material-symbols-rounded text-base flex-shrink-0">home</span>
            {isOpen && <p className="text-sm font-medium leading-normal whitespace-nowrap">Back to Home</p>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Logout"
          >
            <span className="material-symbols-rounded text-base flex-shrink-0">logout</span>
            {isOpen && <p className="text-sm font-medium leading-normal whitespace-nowrap">Logout</p>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;