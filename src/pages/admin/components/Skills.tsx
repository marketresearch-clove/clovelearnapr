
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import Loader from '../../../../components/Loader';

interface Skill {
  id: string;
  name: string;
  family: string;
  description: string | null;
  createdby: string | null;
  createdat: string | null;
  updatedat: string | null;
}

const Skills: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [families, setFamilies] = useState<string[]>([]);
  const [selectedFamily, setSelectedFamily] = useState('All');
  const [familiesLoading, setFamiliesLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    family: '',
    description: ''
  });

  useEffect(() => {
    fetchSkills();
    fetchFamilies();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('createdat', { ascending: false });

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilies = async () => {
    try {
      setFamiliesLoading(true);
      const { data: familiesData, error } = await supabase
        .from('skill_families')
        .select('name')
        .order('name');

      if (error) throw error;
      if (familiesData) {
        const familyNames = familiesData.map((f: any) => f.name);
        setFamilies(['All', ...familyNames]);
      }
    } catch (error) {
      console.error('Error fetching families:', error);
    } finally {
      setFamiliesLoading(false);
    }
  };

  const handleSaveSkill = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a skill name');
      return;
    }
    if (!formData.family) {
      alert('Please select a skill family');
      return;
    }

    try {
      if (editingSkill) {
        const { error } = await supabase
          .from('skills')
          .update({
            name: formData.name,
            family: formData.family,
            description: formData.description,
            updatedat: new Date().toISOString()
          })
          .eq('id', editingSkill.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('skills')
          .insert([{
            name: formData.name,
            family: formData.family,
            description: formData.description
          }]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingSkill(null);
      setFormData({ name: '', family: '', description: '' });
      fetchSkills();
    } catch (error) {
      console.error('Error saving skill:', error);
      alert('Failed to save skill');
    }
  };

  const handleEditClick = (skill: Skill) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name,
      family: skill.family,
      description: skill.description || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this skill?')) return;

    try {
      const { error } = await supabase
        .from('skills')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchSkills();
    } catch (error) {
      console.error('Error deleting skill:', error);
      alert('Failed to delete skill');
    }
  };

  const filteredSkills = skills.filter(skill =>
    (selectedFamily === 'All' || skill.family === selectedFamily) &&
    (skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.family.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative flex-1 w-full sm:w-96">
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
          <input
            type="text"
            placeholder="Search Skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-500"
          />
        </div>
        <button
          onClick={() => {
            if (familiesLoading || families.length <= 1) {
              alert('Please wait for skill families to load');
              return;
            }
            setEditingSkill(null);
            const defaultFamily = families.find(f => f !== 'All') || '';
            setFormData({ name: '', family: defaultFamily, description: '' });
            setIsModalOpen(true);
          }}
          disabled={familiesLoading || families.length <= 1}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-rounded">add</span>
          Create New Skill
        </button>
      </div>

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {families.map(family => (
          <button
            key={family}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative ${selectedFamily === family
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setSelectedFamily(family)}
          >
            {family}
            {selectedFamily === family && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl border border-gray-300">
        <table className="w-full">
          <thead className="bg-blue-100 border-b-2 border-blue-300">
            <tr className="text-left">
              <th className="pb-4 pt-4 pl-4 font-semibold text-gray-900">Skill</th>
              <th className="pb-4 pt-4 font-semibold text-gray-900">Skill Family</th>
              <th className="pb-4 pt-4 font-semibold text-gray-900">Created By</th>
              <th className="pb-4 pt-4 font-semibold text-gray-900">Created At</th>
              <th className="pb-4 pt-4 pr-4 text-right font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20">
                  <Loader size="lg" message="Loading skills..." />
                </td>
              </tr>
            ) : filteredSkills.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-700">No skills found</td>
              </tr>
            ) : (
              filteredSkills.map(skill => (
                <tr key={skill.id} className="group hover:bg-blue-50 transition-colors">
                  <td className="py-4 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                        {skill.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{skill.name}</span>
                    </div>
                  </td>
                  <td className="py-4 text-gray-700">{skill.family}</td>
                  <td className="py-4 text-gray-700">{skill.createdby || 'System'}</td>
                  <td className="py-4 text-gray-700">
                    {skill.createdat ? new Date(skill.createdat).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-4 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(skill)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-rounded text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(skill.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <span className="material-symbols-rounded text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-4">
        <div className="text-sm text-gray-600">
          Showing {filteredSkills.length} items
        </div>
      </div>

      {/* Create/Edit Skill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-300">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSkill ? 'Edit Skill' : 'Create New Skill'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Skill Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  placeholder="e.g. Python"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Skill Family
                </label>
                <select
                  value={formData.family}
                  onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                >
                  <option value="">Select Family</option>
                  {families.filter(f => f !== 'All').map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
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
            </div>
            <div className="p-6 border-t border-gray-300 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSkill}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {editingSkill ? 'Save Changes' : 'Create Skill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Skills;
