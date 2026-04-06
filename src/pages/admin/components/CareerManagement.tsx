import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { careerPathService } from '../../../../lib/careerPathService';

import { exportToCSV } from '../../../../lib/exportUtils';

interface CareerPath {
  id: string;
  source_role: string;
  target_role: string;
  description?: string;
  skill_requirements?: any[];
  created_by?: string;
  created_at?: string;
}

interface Skill {
  id: string;
  name: string;
  family: string;
}

const CareerManagement: React.FC = () => {
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSourceRole, setFilterSourceRole] = useState('all');
  const [filterTargetRole, setFilterTargetRole] = useState('all');
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<CareerPath | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    currentRole: '',
    nextRole: '',
    description: '',
    skillRequirements: [] as Array<{
      skillId: string;
      skillName: string;
      skillFamily: string;
      level: 'Beginner' | 'Intermediate' | 'Advanced';
      min_score_beginner: number;
      min_score_intermediate: number;
      min_score_advanced: number;
    }>
  });

  useEffect(() => {
    fetchCareerPaths();
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const { data } = await supabase.from('skills').select('id, name, family');
      if (data) setAvailableSkills(data);
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  };

  const fetchCareerPaths = async () => {
    try {
      setLoading(true);
      const paths = await careerPathService.getCareerPaths();
      setCareerPaths(paths);
    } catch (error) {
      console.error('Error fetching career paths:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCareerPath = async () => {
    if (!formData.currentRole || !formData.nextRole) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.skillRequirements.length === 0) {
      alert('Please add at least one skill requirement');
      return;
    }

    try {
      if (editingPath) {
        await careerPathService.updateCareerPath(editingPath.id, {
          currentRole: formData.currentRole,
          nextRole: formData.nextRole,
          description: formData.description,
          skillRequirements: formData.skillRequirements.map(req => ({
            skill_id: req.skillId,
            skill_name: req.skillName,
            skill_family: req.skillFamily,
            level: req.level,
            min_score_beginner: req.min_score_beginner,
            min_score_intermediate: req.min_score_intermediate,
            min_score_advanced: req.min_score_advanced
          }))
        });
      } else {
        await careerPathService.createCareerPath(
          formData.currentRole,
          formData.nextRole,
          formData.description,
          formData.skillRequirements.map(req => ({
            skillId: req.skillId,
            skillName: req.skillName,
            skillFamily: req.skillFamily,
            level: req.level,
            minScoreBeginner: req.min_score_beginner,
            minScoreIntermediate: req.min_score_intermediate,
            minScoreAdvanced: req.min_score_advanced
          }))
        );
      }

      setIsModalOpen(false);
      setEditingPath(null);
      setFormData({
        currentRole: '',
        nextRole: '',
        description: '',
        skillRequirements: []
      });
      fetchCareerPaths();
      alert('Career path saved successfully!');
    } catch (error) {
      console.error('Error saving career path:', error);
      alert('Failed to save career path');
    }
  };

  const handleEditClick = (path: CareerPath) => {
    setEditingPath(path);
    setFormData({
      currentRole: path.source_role,
      nextRole: path.target_role,
      description: path.description || '',
      skillRequirements: (path.skill_requirements || []).map((req: any) => ({
        skillId: req.skill_id || req.skillId,
        skillName: req.skill_name || req.skillName || '',
        skillFamily: req.skill_family || req.skillFamily || '',
        level: req.level || 'Advanced',
        min_score: req.min_score || (req.level === 'Beginner' ? req.min_score_beginner : req.level === 'Intermediate' ? req.min_score_intermediate : req.min_score_advanced) || 0,
        min_score_beginner: req.min_score_beginner || 20,
        min_score_intermediate: req.min_score_intermediate || 50,
        min_score_advanced: req.min_score_advanced || 70
      }))
    });
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = async (pathId: string) => {
    if (!window.confirm('Are you sure you want to delete this career path?')) return;

    try {
      await careerPathService.deleteCareerPath(pathId);
      fetchCareerPaths();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error deleting career path:', error);
      alert('Failed to delete career path');
    }
  };

  const addSkillRequirement = (skillId: string) => {
    const skill = availableSkills.find(s => s.id === skillId);
    if (!skill) return;

    if (formData.skillRequirements.find(r => r.skillId === skillId)) {
      alert('This skill is already added');
      return;
    }

    setFormData({
      ...formData,
      skillRequirements: [
        ...formData.skillRequirements,
        {
          skillId,
          skillName: skill.name,
          skillFamily: skill.family,
          level: 'Advanced',
          min_score: 70,
          min_score_beginner: 20,
          min_score_intermediate: 50,
          min_score_advanced: 70
        }
      ]
    });
  };

  const removeSkillRequirement = (skillId: string) => {
    setFormData({
      ...formData,
      skillRequirements: formData.skillRequirements.filter(r => r.skillId !== skillId)
    });
  };

  const updateSkillRequirement = (skillId: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      skillRequirements: prev.skillRequirements.map(req =>
        req.skillId === skillId ? { ...req, [field]: value } : req
      )
    }));
  };

  const handleExport = () => {
    const dataToExport = filteredPaths.map(p => ({
      CurrentRole: p.source_role,
      NextRole: p.target_role,
      Description: p.description || '',
      SkillsCount: (p.skill_requirements || []).length,
      CreatedAt: p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'
    }));
    exportToCSV(dataToExport, 'Career_Paths');
  };

  const filteredPaths = careerPaths.filter(path => {
    const matchesSearch =
      path.source_role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      path.target_role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSource =
      filterSourceRole === 'all' ||
      path.source_role === filterSourceRole;

    const matchesTarget =
      filterTargetRole === 'all' ||
      path.target_role === filterTargetRole;

    return matchesSearch && matchesSource && matchesTarget;
  });

  const sourceRoles = Array.from(new Set(careerPaths.map(p => p.source_role)));
  const targetRoles = Array.from(new Set(careerPaths.map(p => p.target_role)));

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              type="text"
              placeholder="Search Career Paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <select
            value={filterSourceRole}
            onChange={(e) => setFilterSourceRole(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="all">All Current Roles</option>
            {sourceRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          <select
            value={filterTargetRole}
            onChange={(e) => setFilterTargetRole(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="all">All Next Roles</option>
            {targetRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-rounded">download</span>
            Export
          </button>
          <button
            onClick={() => {
              setEditingPath(null);
              setFormData({
                currentRole: '',
                nextRole: '',
                description: '',
                skillRequirements: []
              });
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-rounded">add</span>
            Create Career Path
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
              <th className="pb-3 pl-2 font-semibold text-dark-600 dark:text-grey-900">Current Role</th>
              <th className="pb-3 font-semibold text-dark-600 dark:text-grey-900">Next Role</th>
              <th className="pb-3 font-semibold text-dark-600 dark:text-grey-900">Skills Required</th>
              <th className="pb-3 font-semibold text-dark-600 dark:text-grey-900">Created At</th>
              <th className="pb-3 pr-2 text-right font-semibold text-dark-600 dark:text-grey-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-dark-500 dark:text-grey-400">Loading career paths...</td>
              </tr>
            ) : filteredPaths.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-dark-500 dark:text-grey-400">No career paths found</td>
              </tr>
            ) : (
              filteredPaths.map(path => (
                <tr key={path.id} className="group hover:bg-dark-50 dark:hover:bg-dark-800/50 transition-colors">
                  <td className="py-4 pl-2">
                    <span className="font-medium text-dark-900 dark:text-dark">{path.source_role}</span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-dark-600 dark:text-dark">{path.target_role}</span>
                      <span className="material-symbols-rounded text-dark-400 text-sm">arrow_forward</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-900 dark:bg-blue-900/10 dark:text-blue-900">
                      {(path.skill_requirements || []).length} skills
                    </span>
                  </td>
                  <td className="py-4 text-dark-600 dark:text-dark">
                    {path.created_at ? new Date(path.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-4 pr-2 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === path.id ? null : path.id)}
                        className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 p-1 rounded-full hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                      >
                        <span className="material-symbols-rounded">more_horiz</span>
                      </button>
                      {openMenuId === path.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-dark-50 dark:bg-gray-700 rounded-lg shadow-lg z-10 border border-dark-200 dark:border-dark-600">
                          <button
                            onClick={() => handleEditClick(path)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 first:rounded-t-lg"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(path.id)}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-600 last:rounded-b-lg"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPath ? 'Edit Career Path' : 'Create Career Path'}
              </h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currentRole}
                    onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border text-white border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Customer Service Manager"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Next Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nextRole}
                    onChange={(e) => setFormData({ ...formData, nextRole: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Customer Service Director"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 text-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Skill Requirements <span className="text-red-500">*</span>
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) addSkillRequirement(e.target.value);
                      e.target.value = '';
                    }}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <option value="">+ Add Skill</option>
                    {availableSkills
                      .filter(s => !formData.skillRequirements.find(r => r.skillId === s.id))
                      .map(skill => (
                        <option key={skill.id} value={skill.id}>
                          {skill.name} ({skill.family})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {formData.skillRequirements.length > 0 ? (
                    formData.skillRequirements.map(req => (
                      <div key={req.skillId} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{req.skillName}</p>
                            <p className="text-xs text-gray-500">{req.skillFamily}</p>
                          </div>
                          <button
                            onClick={() => removeSkillRequirement(req.skillId)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Proficiency Level
                            </label>
                            <select
                              value={req.level}
                              onChange={(e) => {
                                const newLevel = e.target.value as 'Beginner' | 'Intermediate' | 'Advanced';
                                updateSkillRequirement(req.skillId, 'level', newLevel);

                                // Sync min_score with the selected level's default score
                                let defaultScore = 0;
                                if (newLevel === 'Beginner') defaultScore = req.min_score_beginner || 20;
                                else if (newLevel === 'Intermediate') defaultScore = req.min_score_intermediate || 50;
                                else if (newLevel === 'Advanced') defaultScore = req.min_score_advanced || 70;

                                updateSkillRequirement(req.skillId, 'min_score', defaultScore);
                              }}
                              className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded"
                            >
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No skills added yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPath(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCareerPath}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {editingPath ? 'Save Changes' : 'Create Path'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareerManagement;
