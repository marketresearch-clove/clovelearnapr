
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';

interface SkillFamily {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdby: string | null;
  createdat: string | null;
  updatedat: string | null;
  skillsCount?: number;
}

interface Skill {
  id: string;
  name: string;
  family: string;
}

const SkillFamilies: React.FC = () => {
  const [skillFamilies, setSkillFamilies] = useState<SkillFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [familySkills, setFamilySkills] = useState<Record<string, any[]>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<SkillFamily | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    selectedSkills: [] as string[]
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [iconSearchQuery, setIconSearchQuery] = useState('');

  const allIcons = [...Object.keys(FaIcons), ...Object.keys(MdIcons)];
  const allIconLibraries = { ...FaIcons, ...MdIcons };

  const filteredIcons = allIcons
    .filter(icon => icon.toLowerCase().includes(iconSearchQuery.toLowerCase()))
    .slice(0, 200);

  useEffect(() => {
    fetchSkillFamilies();
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    const { data } = await supabase.from('skills').select('id, name, family');
    if (data) setAvailableSkills(data);
  };

  const fetchSkillFamilies = async () => {
    try {
      setLoading(true);

      // Fetch families
      const { data: familiesData, error: familiesError } = await supabase
        .from('skill_families')
        .select('*')
        .order('createdat', { ascending: false });

      if (familiesError) throw familiesError;

      // Fetch skills to count them per family
      const { data: skillsData, error: skillsError } = await supabase
        .from('skills')
        .select('family');

      if (skillsError) throw skillsError;

      // Calculate counts
      const counts: Record<string, number> = {};
      skillsData?.forEach((skill: any) => {
        counts[skill.family] = (counts[skill.family] || 0) + 1;
      });

      const familiesWithCounts = familiesData?.map(family => ({
        ...family,
        skillsCount: counts[family.name] || 0
      })) || [];

      setSkillFamilies(familiesWithCounts);
    } catch (error) {
      console.error('Error fetching skill families:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFamily = async () => {
    if (!formData.name) return;

    try {
      if (editingFamily) {
        const { error: updateError } = await supabase
          .from('skill_families')
          .update({
            name: formData.name,
            description: formData.description,
            icon: formData.icon,
            updatedat: new Date().toISOString()
          })
          .eq('id', editingFamily.id);

        if (updateError) throw updateError;
      } else {
        const { error: createError } = await supabase
          .from('skill_families')
          .insert([{
            name: formData.name,
            description: formData.description,
            icon: formData.icon
          }]);

        if (createError) throw createError;
      }

      if (formData.selectedSkills.length > 0) {
        const { error: updateError } = await supabase
          .from('skills')
          .update({ family: formData.name })
          .in('id', formData.selectedSkills);

        if (updateError) throw updateError;
      }

      setIsModalOpen(false);
      setEditingFamily(null);
      setFormData({ name: '', description: '', icon: '', selectedSkills: [] });
      setIconSearchQuery('');
      fetchSkillFamilies();
      fetchSkills();
    } catch (error) {
      console.error('Error saving skill family:', error);
      alert('Failed to save skill family');
    }
  };

  const handleEditClick = async (family: SkillFamily) => {
    try {
      setEditingFamily(family);

      const { data: familySkillsData, error } = await supabase
        .from('skills')
        .select('id')
        .eq('family', family.name);

      if (error) throw error;

      const skillIds = familySkillsData?.map(skill => skill.id) || [];

      setFormData({
        name: family.name,
        description: family.description || '',
        icon: family.icon || '',
        selectedSkills: skillIds
      });
      setIconSearchQuery('');
      setIsModalOpen(true);
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error fetching family skills:', error);
      setEditingFamily(family);
      setFormData({
        name: family.name,
        description: family.description || '',
        icon: family.icon || '',
        selectedSkills: []
      });
      setIconSearchQuery('');
      setIsModalOpen(true);
      setOpenMenuId(null);
    }
  };

  const handleDeleteClick = async (familyId: string, familyName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${familyName}"?`)) return;

    try {
      const { error } = await supabase
        .from('skill_families')
        .delete()
        .eq('id', familyId);

      if (error) throw error;
      fetchSkillFamilies();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error deleting skill family:', error);
      alert('Failed to delete skill family');
    }
  };

  const fetchSkillsForFamily = async (familyName: string) => {
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('id, name, description')
        .eq('family', familyName)
        .order('name');

      if (error) throw error;
      setFamilySkills(prev => ({ ...prev, [familyName]: data || [] }));
    } catch (error) {
      console.error('Error fetching family skills:', error);
    }
  };

  const toggleFamilyExpanded = async (familyId: string, familyName: string) => {
    if (expandedFamilyId === familyId) {
      setExpandedFamilyId(null);
    } else {
      setExpandedFamilyId(familyId);
      if (!familySkills[familyName]) {
        await fetchSkillsForFamily(familyName);
      }
    }
  };

  const filteredFamilies = skillFamilies.filter(family => {
    const matchesSearch = family.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'All' || family.name === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
          <input
            type="text"
            placeholder="Search Skill Families..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-500"
          />
        </div>
        <button
          onClick={() => {
            setEditingFamily(null);
            setFormData({ name: '', description: '', icon: '', selectedSkills: [] });
            setIconSearchQuery('');
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-rounded">add</span>
          Create New Skill Family
        </button>
      </div>

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {['All', 'Digital Tools', 'Functional Skills', 'Leadership Skills', 'Meta Skills'].map(tab => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors relative ${activeTab === tab
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left bg-blue-100 border-b-2 border-blue-300">
              <th className="py-3 pl-4 font-semibold text-gray-900">Skill Family</th>
              <th className="py-3 px-4 font-semibold text-gray-900">Skills Count</th>
              <th className="py-3 px-4 font-semibold text-gray-900">Created By</th>
              <th className="py-3 px-4 font-semibold text-gray-900">Created At</th>
              <th className="py-3 px-4 font-semibold text-gray-900 text-center">View Skills</th>
              <th className="py-3 pr-4 text-right font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-700">Loading skill families...</td>
              </tr>
            ) : filteredFamilies.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-700">No skill families found</td>
              </tr>
            ) : (
              filteredFamilies.flatMap(family => [
                <tr key={family.id} className="group hover:bg-blue-50 transition-colors">
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-lg">
                        {family.icon ? (
                          React.createElement((allIconLibraries as any)[family.icon])
                        ) : (
                          family.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{family.name}</span>
                    </div>
                  </td>
                  <td className="py-4 text-blue-700 font-semibold">{family.skillsCount}</td>
                  <td className="py-4 text-gray-800">{family.createdby || 'System'}</td>
                  <td className="py-4 text-gray-800">
                    {family.createdat ? new Date(family.createdat).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-4 text-center">
                    <button
                      onClick={() => toggleFamilyExpanded(family.id, family.name)}
                      className="text-blue-700 hover:text-blue-900 p-1 rounded hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
                      title={expandedFamilyId === family.id ? 'Hide' : 'View'}
                    >
                      <span className="material-symbols-rounded text-lg">
                        {expandedFamilyId === family.id ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </td>
                  <td className="py-4 pr-2 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === family.id ? null : family.id)}
                        className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <span className="material-symbols-rounded">more_horiz</span>
                      </button>
                      {openMenuId === family.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg z-10 border border-gray-300">
                          <button
                            onClick={() => handleEditClick(family)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-blue-50 first:rounded-t-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(family.id, family.name)}
                            className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 last:rounded-b-lg transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>,
                expandedFamilyId === family.id && (
                  <tr key={`${family.id}-skills`} className="bg-blue-50">
                    <td colSpan={6} className="py-4 pl-6">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">Skills in {family.name}:</p>
                        {(familySkills[family.name] || []).length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(familySkills[family.name] || []).map(skill => (
                              <div
                                key={skill.id}
                                className="p-3 bg-white rounded-lg border border-gray-300 shadow-sm"
                              >
                                <p className="text-sm font-medium text-gray-900">{skill.name}</p>
                                {skill.description && (
                                  <p className="text-xs text-gray-700 mt-1">{skill.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700">No skills assigned to this family yet</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ])
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Family Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-300">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingFamily ? 'Edit Skill Family' : 'Create Skill Family'}
              </h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Family Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  placeholder="e.g. Digital Tools"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Select Badge Icon
                </label>
                <div className="mb-2">
                  <div className="relative">
                    <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
                    <input
                      type="text"
                      value={iconSearchQuery}
                      onChange={(e) => setIconSearchQuery(e.target.value)}
                      placeholder="Search icons (e.g. medal, award)..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2 p-2 border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {filteredIcons.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: iconName })}
                      className={`p-2 flex items-center justify-center rounded-lg transition-all ${formData.icon === iconName
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      title={iconName}
                    >
                      {React.createElement((allIconLibraries as any)[iconName], { size: 20 })}
                    </button>
                  ))}
                  {filteredIcons.length === 0 && (
                    <div className="col-span-6 py-4 text-center text-xs text-gray-700">
                      No icons found matching "{iconSearchQuery}"
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Assign Skills (Optional)
                </label>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto p-2">
                  {availableSkills.map(skill => (
                    <label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.selectedSkills.includes(skill.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, selectedSkills: [...formData.selectedSkills, skill.id] });
                          } else {
                            setFormData({ ...formData, selectedSkills: formData.selectedSkills.filter(id => id !== skill.id) });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{skill.name}</span>
                        <span className="text-xs text-gray-700">Current: {skill.family}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-300 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingFamily(null);
                  setIconSearchQuery('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFamily}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {editingFamily ? 'Save Changes' : 'Create Family'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillFamilies;
