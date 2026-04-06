import React from 'react';

interface RoleSelectorProps {
  isOpen: boolean;
  onSelect: (role: 'student' | 'admin') => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ isOpen, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 border border-gray-200 dark:border-gray-800">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Select Your Role
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Choose how you'd like to access the platform
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onSelect('student')}
            className="w-full p-6 text-left rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
                  school
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Learner Dashboard
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Learn and complete courses
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelect('admin')}
            className="w-full p-6 text-left rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl">
                  admin_panel_settings
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Admin/Instructor Dashboard
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage courses and content
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
          You can change your role preference anytime from your profile settings
        </p>
      </div>
    </div>
  );
};

export default RoleSelector;
