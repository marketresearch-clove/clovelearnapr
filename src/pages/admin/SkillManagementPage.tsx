
import React, { useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import Skills from './components/Skills';
import SkillFamilies from './components/SkillFamilies';
import SkillAssignments from './components/SkillAssignments';
import CourseAssignments from './components/CourseAssignments';
import SkillCourseMappings from './components/SkillCourseMappings';

const SkillManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('skills');

  const tabs = [
    { id: 'skills', label: 'Skills' },
    { id: 'skillFamilies', label: 'Skill Families' },
    { id: 'skillAssignments', label: 'Skill Assignments' },
    { id: 'courseAssignments', label: 'Course Assignments' },
    { id: 'skillCourseMappings', label: 'Skill-Course Mappings' },
  ];

  return (
    <AdminLayout title="Skill Management">
      <div className="flex flex-col gap-6">
        {/* Navigation Tabs - Modern Design with Horizontal Scrolling */}
        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'skills' && <Skills />}
          {activeTab === 'skillFamilies' && <SkillFamilies />}
          {activeTab === 'skillAssignments' && <SkillAssignments />}
          {activeTab === 'courseAssignments' && <CourseAssignments />}
          {activeTab === 'skillCourseMappings' && <SkillCourseMappings />}
        </div>
      </div>
    </AdminLayout>
  );
};

export default SkillManagementPage;