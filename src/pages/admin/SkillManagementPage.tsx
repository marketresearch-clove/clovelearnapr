
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-6 py-4 text-sm font-medium transition-colors relative ${activeTab === tab.id
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
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