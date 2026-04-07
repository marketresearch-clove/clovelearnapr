import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { externalAssessmentService, ExternalAssessment, ExternalAssessmentResult } from '../lib/externalAssessmentService';
import { courseAssignmentService } from '../lib/courseAssignmentService';
import { supabase } from '../lib/supabaseClient';
import useAuthGuard from '../hooks/useAuthGuard';

interface FilterState {
  department: string[];
  company: string[];
  designation: string[];
  employmentType: string[];
  industry: string[];
  leadershipRole: string[];
  location: string[];
  persona: string[];
  team: string[];
  grade: string[];
}

const UserAvatar = ({ user }: { user: any }) => {
  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return `${name[0]}`.toUpperCase();
  };

  const colors = [
    'bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-indigo-500',
    'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'
  ];

  const color = colors[user.fullname?.length % colors.length || 0];

  return (
    <div className="w-16 h-16 mx-auto mb-2 relative">
      {user.avatarurl ? (
        <img src={user.avatarurl} alt={user.fullname} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl ${color}`}>
          {getInitials(user.fullname)}
        </div>
      )}
    </div>
  );
};

const AdminAssessmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manage' | 'assign' | 'active' | 'results'>('manage');
  useAuthGuard(['admin', 'instructor']);

  return (
    <AdminLayout title="Assessment Management">
      <div className="flex flex-col gap-6">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'manage' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('manage')}
          >
            Manage Assessments
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'assign' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('assign')}
          >
            Assign Assessments
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'active' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('active')}
          >
            Active Assignments
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap ${activeTab === 'results' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('results')}
          >
            Results & Reports
          </button>
        </div>

        <div className="flex-1">
          {activeTab === 'manage' && <ManageAssessmentsTab />}
          {activeTab === 'assign' && <AssignAssessmentsTab />}
          {activeTab === 'active' && <ActiveAssignmentsTab />}
          {activeTab === 'results' && <AssessmentResultsTab />}
        </div>
      </div>
    </AdminLayout>
  );
};

const ManageAssessmentsTab: React.FC = () => {
  const [assessments, setAssessments] = useState<ExternalAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    provider: 'EFSET',
    external_url: '',
    duration: 60,
    attempt_limit: 1,
    instructions: '',
    certificate_required: true,
    thumbnail_url: '',
    score_mapping: [] as { level: string; min: number; max: number }[]
  });

  const DEFAULT_EFSET_MAPPING = [
    { level: 'pre-A1', min: 0, max: 20 },
    { level: 'A1 Beginner', min: 21, max: 30 },
    { level: 'A2 Elementary', min: 31, max: 40 },
    { level: 'B1 Intermediate', min: 41, max: 50 },
    { level: 'B2 Upper Intermediate', min: 51, max: 60 },
    { level: 'C1 Advanced', min: 61, max: 70 },
    { level: 'C2 Proficient', min: 71, max: 100 }
  ];

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const data = await externalAssessmentService.getAssessments();
      setAssessments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (assessment: ExternalAssessment) => {
    setEditingId(assessment.id);
    setFormData({
      title: assessment.title,
      provider: assessment.provider,
      external_url: assessment.external_url,
      duration: assessment.duration,
      attempt_limit: assessment.attempt_limit,
      instructions: assessment.instructions || '',
      certificate_required: assessment.certificate_required,
      thumbnail_url: assessment.thumbnail_url || '',
      score_mapping: assessment.score_mapping || (assessment.provider === 'EFSET' ? DEFAULT_EFSET_MAPPING : [])
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assessment? This will also remove all associated assignments and results.')) return;
    try {
      await externalAssessmentService.deleteAssessment(id);
      fetchAssessments();
    } catch (err) {
      console.error(err);
      alert('Failed to delete assessment');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await externalAssessmentService.updateAssessment(editingId, formData);
      } else {
        await externalAssessmentService.createAssessment(formData);
      }
      setShowForm(false);
      setEditingId(null);
      fetchAssessments();
      setFormData({
        title: '',
        provider: 'EFSET',
        external_url: '',
        duration: 60,
        attempt_limit: 1,
        instructions: '',
        certificate_required: true,
        thumbnail_url: '',
        score_mapping: []
      });
    } catch (err) {
      console.error(err);
      alert(`Failed to ${editingId ? 'update' : 'create'} assessment`);
    }
  };

  const addScoreMapping = () => {
    setFormData({
      ...formData,
      score_mapping: [...formData.score_mapping, { level: '', min: 0, max: 100 }]
    });
  };

  const removeScoreMapping = (index: number) => {
    const newMapping = [...formData.score_mapping];
    newMapping.splice(index, 1);
    setFormData({ ...formData, score_mapping: newMapping });
  };

  const updateScoreMapping = (index: number, field: string, value: string | number) => {
    const newMapping = [...formData.score_mapping];
    newMapping[index] = { ...newMapping[index], [field]: value };
    setFormData({ ...formData, score_mapping: newMapping });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Assessments</h3>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              title: '',
              provider: 'EFSET',
              external_url: '',
              duration: 60,
              attempt_limit: 1,
              instructions: '',
              certificate_required: true,
              thumbnail_url: '',
              score_mapping: DEFAULT_EFSET_MAPPING
            });
            setShowForm(true);
          }}
          className="bg-[#4f46e5] text-[#ffffff] px-4 py-2 rounded-lg font-bold flex items-center gap-2"
        >
          <span className="material-symbols-rounded">add</span>
          Create Assessment
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Assessment Title</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-[#000000] rounded-lg px-4 py-2 text-sm"
                    placeholder="e.g. EFSET English Proficiency Test"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Provider</label>
                  <input
                    required
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full bg-gray-50 text-[#000000] border border-gray-200 rounded-lg px-4 py-2 text-sm"
                    placeholder="e.g. EFSET"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">External URL</label>
                  <input
                    required
                    type="url"
                    value={formData.external_url}
                    onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                    className="w-full bg-gray-50 border text-[#000000] border-gray-200 rounded-lg px-4 py-2 text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700  mb-1">Duration (mins)</label>
                    <input
                      required
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                      className="w-full bg-gray-50 border text-[#000000] border-gray-200 rounded-lg px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Attempt Limit</label>
                    <input
                      required
                      type="number"
                      value={formData.attempt_limit}
                      onChange={(e) => setFormData({ ...formData, attempt_limit: parseInt(e.target.value) })}
                      className="w-full bg-gray-50 text-[#000000] border border-gray-200 rounded-lg px-4 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Instructions</label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    className="w-full bg-gray-50 border text-[#000000] border-gray-200 rounded-lg px-4 py-2 text-sm h-24"
                    placeholder="Provide instructions for learners..."
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-rounded text-base">rule</span>
                  Score Mapping (Level Determination)
                </h4>
                <button
                  type="button"
                  onClick={addScoreMapping}
                  className="text-xs font-bold text-white hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-rounded text-sm">add_circle</span>
                  Add Level
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {formData.score_mapping.map((mapping, index) => (
                  <div key={index} className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-3 relative group">
                    <button
                      type="button"
                      onClick={() => removeScoreMapping(index)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-rounded text-sm">close</span>
                    </button>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Level Name</label>
                      <input
                        type="text"
                        value={mapping.level}
                        onChange={(e) => updateScoreMapping(index, 'level', e.target.value)}
                        className="w-full bg-white light:bg-slate-800 border border-gray-200 rounded px-2 py-1 text-xs"
                        placeholder="e.g. B2 Intermediate"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Min Score</label>
                        <input
                          type="number"
                          value={mapping.min}
                          onChange={(e) => updateScoreMapping(index, 'min', parseInt(e.target.value))}
                          className="w-full bg-white light:bg-slate-800 border border-gray-200 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Max Score</label>
                        <input
                          type="number"
                          value={mapping.max}
                          onChange={(e) => updateScoreMapping(index, 'max', parseInt(e.target.value))}
                          className="w-full bg-white light:bg-slate-800 border border-gray-200 rounded px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-6 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-8 py-2 rounded-lg text-sm font-bold transition-transform active:scale-95 shadow-lg shadow-primary/20"
              >
                {editingId ? 'Update Assessment' : 'Create Assessment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assessments.map((assessment) => (
          <div key={assessment.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm group">
            <div className="h-32 bg-slate-100 relative">
              {assessment.thumbnail_url && <img src={assessment.thumbnail_url} alt="" className="w-full h-full object-cover" />}
              <div className="absolute top-2 right-2 flex gap-2">
                <div className="bg-white/90 px-2 py-1 rounded text-[10px] font-bold">
                  {assessment.provider}
                </div>
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  onClick={() => handleEdit(assessment)}
                  className="bg-white text-gray-900 p-2 rounded-full hover:bg-primary hover:text-white transition-colors"
                  title="Edit Assessment"
                >
                  <span className="material-symbols-rounded">edit</span>
                </button>
                <button
                  onClick={() => handleDelete(assessment.id)}
                  className="bg-white text-red-600 p-2 rounded-full hover:bg-red-600 hover:text-white transition-colors"
                  title="Delete Assessment"
                >
                  <span className="material-symbols-rounded">delete</span>
                </button>
              </div>
            </div>
            <div className="p-5">
              <h4 className="font-bold text-gray-900 mb-2 line-clamp-1">{assessment.title}</h4>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-rounded text-sm">schedule</span>
                  {assessment.duration} min
                </div>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-rounded text-sm">history</span>
                  Limit: {assessment.attempt_limit}
                </div>
              </div>
              {assessment.score_mapping && assessment.score_mapping.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Score Ranges</p>
                  <div className="flex flex-wrap gap-1">
                    {assessment.score_mapping.slice(0, 3).map((m, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 light:bg-slate-900 rounded text-[9px] font-medium">
                        {m.level}: {m.min}-{m.max}
                      </span>
                    ))}
                    {assessment.score_mapping.length > 3 && (
                      <span className="text-[9px] text-gray-400">+{assessment.score_mapping.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {assessments.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <span className="material-symbols-rounded text-5xl text-gray-300 mb-4">assignment</span>
            <p className="text-gray-500">No external assessments created yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AssignAssessmentsTab: React.FC = () => {
  const [assessments, setAssessments] = useState<ExternalAssessment[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [validUntil, setValidUntil] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'simplified'>('table');
  const [assessmentSearchQuery, setAssessmentSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState<any>({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    department: [],
    company: [],
    designation: [],
    employmentType: [],
    industry: [],
    leadershipRole: [],
    location: [],
    persona: [],
    team: [],
    grade: [],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assessmentsData, { data: usersData }, filterValues] = await Promise.all([
        externalAssessmentService.getAssessments(),
        supabase.from('profiles').select('id, fullname, email, role, department, company, designation, employment_type, industry, leadership_role, location, persona, team, avatarurl, user_id'),
        courseAssignmentService.getUniqueFilterValues()
      ]);
      setAssessments(assessmentsData);
      setUsers(usersData || []);
      setFilterOptions(filterValues);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const departmentCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const user of users) {
      const department = user.department || 'Other';
      counts[department] = (counts[department] || 0) + 1;
    }
    return counts;
  }, [users]);

  const toggleFilter = (filterType: keyof FilterState, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[filterType].includes(value)) {
        newFilters[filterType] = newFilters[filterType].filter(v => v !== value);
      } else {
        newFilters[filterType] = [...newFilters[filterType], value];
      }

      if (filterType === 'department') {
        setActiveDepartment('All');
      }

      return newFilters;
    });
  };

  const filteredUsers = React.useMemo(() => {
    let filtered = users;

    // Apply department filter only if NOT searching
    if (!searchQuery && activeDepartment !== 'All') {
      filtered = filtered.filter(u => (u.department || 'Other') === activeDepartment);
    }

    if (showAdvancedSearch) {
      if (filters.department.length > 0) {
        filtered = filtered.filter(u => filters.department.includes(u.department));
      }
      if (filters.company.length > 0) {
        filtered = filtered.filter(u => filters.company.includes(u.company));
      }
      if (filters.designation.length > 0) {
        filtered = filtered.filter(u => filters.designation.includes(u.designation));
      }
      if (filters.employmentType.length > 0) {
        filtered = filtered.filter(u => filters.employmentType.includes(u.employment_type));
      }
      if (filters.industry.length > 0) {
        filtered = filtered.filter(u => filters.industry.includes(u.industry));
      }
      if (filters.leadershipRole.length > 0) {
        filtered = filtered.filter(u => filters.leadershipRole.includes(u.leadership_role));
      }
      if (filters.location.length > 0) {
        filtered = filtered.filter(u => filters.location.includes(u.location));
      }
      if (filters.persona.length > 0) {
        filtered = filtered.filter(u => filters.persona.includes(u.persona));
      }
      if (filters.team.length > 0) {
        filtered = filtered.filter(u => filters.team.includes(u.team));
      }
      if (filters.grade.length > 0) {
        filtered = filtered.filter(u => filters.grade.includes(u.grade));
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.fullname?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.department?.toLowerCase().includes(query) ||
        u.user_id?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [users, activeDepartment, searchQuery, filters, showAdvancedSearch]);

  const handleAssign = async () => {
    if (!selectedAssessmentId || selectedUserIds.length === 0) {
      alert('Please select an assessment and at least one user.');
      return;
    }

    try {
      setSubmitting(true);
      await externalAssessmentService.assignToUsers(
        selectedAssessmentId,
        selectedUserIds,
        validUntil || undefined
      );
      alert('Assessment assigned successfully!');
      setSelectedUserIds([]);
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') {
        alert('Some users are already assigned to this assessment.');
      } else {
        alert('Failed to assign assessment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const filteredAssessments = React.useMemo(() => {
    if (!assessmentSearchQuery) return assessments;
    const query = assessmentSearchQuery.toLowerCase();
    return assessments.filter(a =>
      a.title?.toLowerCase().includes(query) ||
      a.provider?.toLowerCase().includes(query)
    );
  }, [assessments, assessmentSearchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 mb-4">
        <h3 className="font-semibold text-gray-900">Assign Assessments</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${viewMode === 'table'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            title="Table View"
          >
            <span className="material-symbols-rounded text-lg">table_chart</span>
            Table
          </button>
          <button
            onClick={() => setViewMode('simplified')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${viewMode === 'simplified'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            title="Card View"
          >
            <span className="material-symbols-rounded text-lg">dashboard</span>
            Cards
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* User Filters - Common for both views */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveDepartment('All')}
            className={`px-4 py-2 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === 'All' ? 'bg-[#4f46e5] text-white' : 'bg-white text-black border border-black'}`}
          >
            All Users ({users.length})
          </button>
          {Object.entries(departmentCounts).map(([department, count]) => (
            <button
              key={department}
              onClick={() => setActiveDepartment(department)}
              className={`px-4 py-2 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === department ? 'bg-[#4f46e5] text-white' : 'bg-white text-black border border-black'}`}
            >
              {department} ({count})
            </button>
          ))}
        </div>

        {viewMode === 'simplified' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Users - {activeDepartment} ({filteredUsers.length} Users)
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                      <input
                        type="text"
                        placeholder="Search User"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#4f46e5] text-sm"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Clear search"
                        >
                          <span className="material-symbols-rounded text-lg">close</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <button
                        onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        className="text-sm font-medium text-[#4f46e5] hover:underline whitespace-nowrap"
                      >
                        Advanced Search
                      </button>
                      <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          onChange={() => {
                            const allInFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id));
                            if (allInFilteredSelected) {
                              setSelectedUserIds(prev => prev.filter(id => !filteredUsers.some(u => u.id === id)));
                            } else {
                              setSelectedUserIds(prev => {
                                const newIds = new Set([...prev, ...filteredUsers.map(u => u.id)]);
                                return Array.from(newIds);
                              });
                            }
                          }}
                          checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id))}
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-[#4f46e5]"
                        />
                        Select All
                      </label>
                    </div>
                  </div>
                </div>

                {showAdvancedSearch && (
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-4 text-sm">Advanced Search</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {filterOptions.departments?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Department</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.departments.map((dept: string) => (
                              <label key={dept} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.department.includes(dept)}
                                  onChange={() => toggleFilter('department', dept)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{dept}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.companies?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Company</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.companies.map((comp: string) => (
                              <label key={comp} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.company.includes(comp)}
                                  onChange={() => toggleFilter('company', comp)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{comp}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.designations?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Designation</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.designations.map((des: string) => (
                              <label key={des} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.designation.includes(des)}
                                  onChange={() => toggleFilter('designation', des)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{des}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.locations?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Location</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.locations.map((loc: string) => (
                              <label key={loc} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.location.includes(loc)}
                                  onChange={() => toggleFilter('location', loc)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{loc}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.employmentTypes?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Employment Type</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.employmentTypes.map((type: string) => (
                              <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.employmentType.includes(type)}
                                  onChange={() => toggleFilter('employmentType', type)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{type}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.industries?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Industry</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.industries.map((ind: string) => (
                              <label key={ind} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.industry.includes(ind)}
                                  onChange={() => toggleFilter('industry', ind)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{ind}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.leadershipRoles?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Leadership Role</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.leadershipRoles.map((role: string) => (
                              <label key={role} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.leadershipRole.includes(role)}
                                  onChange={() => toggleFilter('leadershipRole', role)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{role}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.personas?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Persona</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.personas.map((pers: string) => (
                              <label key={pers} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.persona.includes(pers)}
                                  onChange={() => toggleFilter('persona', pers)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{pers}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.teams?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Team</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.teams.map((team: string) => (
                              <label key={team} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.team.includes(team)}
                                  onChange={() => toggleFilter('team', team)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{team}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="max-h-[600px] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                    {filteredUsers.map(user => (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedUserIds.includes(user.id)
                          ? 'border-[#4f46e5] bg-[#4f46e5]/5'
                          : 'border-gray-100 hover:border-gray-200'
                          }`}
                      >
                        <UserAvatar user={user} />
                        <div className="text-center">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{user.fullname || 'Anonymous'}</h4>
                          {user.user_id && (
                            <p className="text-xs text-gray-600 truncate font-medium">{user.user_id}</p>
                          )}
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          <div className="mt-2 flex flex-wrap justify-center gap-1">
                            {user.department && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                                {user.department}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && (
                      <div className="col-span-full py-12 text-center text-gray-500">
                        No users found matching your criteria
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Assessment Selection */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4">Select Assessment</h3>

                <div className="relative mb-4">
                  <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                  <input
                    type="text"
                    placeholder="Search assessments..."
                    value={assessmentSearchQuery}
                    onChange={(e) => setAssessmentSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#4f46e5] outline-none text-sm"
                  />
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {filteredAssessments.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No assessments found</p>
                  ) : (
                    filteredAssessments.map(assessment => (
                      <div
                        key={assessment.id}
                        onClick={() => setSelectedAssessmentId(assessment.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedAssessmentId === assessment.id
                          ? 'border-[#4f46e5] bg-[#4f46e5]/5'
                          : 'border-gray-100 hover:border-gray-200'
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{assessment.title}</h4>
                            <p className="text-[10px] text-gray-500">{assessment.provider} • {assessment.duration} mins</p>
                          </div>
                          {selectedAssessmentId === assessment.id && (
                            <span className="material-symbols-rounded text-[#4f46e5] text-lg">check_circle</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valid Until (Optional)
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#4f46e5] outline-none text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Selected Users:</span>
                      <span className="font-bold text-gray-900">{selectedUserIds.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Assessment:</span>
                      <span className="font-bold text-gray-900 truncate max-w-[150px]">
                        {assessments.find(a => a.id === selectedAssessmentId)?.title || 'None'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleAssign}
                    disabled={submitting || selectedUserIds.length === 0 || !selectedAssessmentId}
                    className="w-full bg-[#4f46e5] text-white font-bold py-3 rounded-lg shadow-lg hover:bg-[#4338ca] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Assigning...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-rounded">assignment_turned_in</span>
                        Assign Assessment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">1. Select Assessment</h3>
                <div className="space-y-3">
                  {assessments.map(a => (
                    <label
                      key={a.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedAssessmentId === a.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      <input
                        type="radio"
                        name="assessment"
                        checked={selectedAssessmentId === a.id}
                        onChange={() => setSelectedAssessmentId(a.id)}
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-bold text-sm text-gray-900">{a.title}</p>
                        <p className="text-[10px] text-gray-500">{a.provider}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">3. Assignment Settings</h3>
                <label className="block text-sm font-bold text-gray-700 mb-2">Valid Until (Optional)</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full bg-gray-50 border text-[#000000] border-gray-200 rounded-lg px-4 py-2 text-sm mb-6"
                />
                <button
                  onClick={handleAssign}
                  disabled={submitting || !selectedAssessmentId || selectedUserIds.length === 0}
                  className="w-full bg-indigo-600 text-[#ffffff] px-4 py-3 rounded-xl font-bold transition-transform active:scale-95 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-rounded">person_add</span>
                  Assign to {selectedUserIds.length} Users
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Select Users</h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                      <input
                        type="text"
                        placeholder="Search User"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-gray-50"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Clear search"
                        >
                          <span className="material-symbols-rounded text-lg">close</span>
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        className="text-sm font-medium text-[#4f46e5] hover:underline whitespace-nowrap"
                      >
                        Advanced Search
                      </button>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedUserIds(filteredUsers.map(u => u.id))}
                          className="text-xs font-bold text-[#ffffff] bg-indigo-600 px-2 py-2 rounded-lg hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => setSelectedUserIds([])}
                          className="text-xs font-bold text-gray-500 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {showAdvancedSearch && (
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-4 text-sm">Advanced Search</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {filterOptions.departments?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Department</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.departments.map((dept: string) => (
                              <label key={dept} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.department.includes(dept)}
                                  onChange={() => toggleFilter('department', dept)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{dept}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.companies?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Company</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.companies.map((comp: string) => (
                              <label key={comp} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.company.includes(comp)}
                                  onChange={() => toggleFilter('company', comp)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{comp}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.designations?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Designation</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.designations.map((des: string) => (
                              <label key={des} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.designation.includes(des)}
                                  onChange={() => toggleFilter('designation', des)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{des}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.locations?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Location</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.locations.map((loc: string) => (
                              <label key={loc} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.location.includes(loc)}
                                  onChange={() => toggleFilter('location', loc)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{loc}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.employmentTypes?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Employment Type</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.employmentTypes.map((type: string) => (
                              <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.employmentType.includes(type)}
                                  onChange={() => toggleFilter('employmentType', type)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{type}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.industries?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Industry</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.industries.map((ind: string) => (
                              <label key={ind} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.industry.includes(ind)}
                                  onChange={() => toggleFilter('industry', ind)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{ind}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.leadershipRoles?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Leadership Role</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.leadershipRoles.map((role: string) => (
                              <label key={role} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.leadershipRole.includes(role)}
                                  onChange={() => toggleFilter('leadershipRole', role)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{role}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.personas?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Persona</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.personas.map((pers: string) => (
                              <label key={pers} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.persona.includes(pers)}
                                  onChange={() => toggleFilter('persona', pers)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{pers}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {filterOptions.teams?.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Team</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                            {filterOptions.teams.map((team: string) => (
                              <label key={team} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filters.team.includes(team)}
                                  onChange={() => toggleFilter('team', team)}
                                  className="w-3.5 h-3.5 text-[#4f46e5] rounded border-gray-300 focus:ring-[#4f46e5]"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-900">{team}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Select</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map(user => (
                        <tr
                          key={user.id}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedUserIds.includes(user.id) ? 'bg-primary/5' : ''}`}
                          onClick={() => toggleUserSelection(user.id)}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={() => { }} // Handled by tr onClick
                              className="rounded text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.fullname}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{user.department || 'Other'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="py-20 text-center">
                      <p className="text-gray-500">No users found matching your criteria.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ActiveAssignmentsTab: React.FC = () => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await externalAssessmentService.getAllAssignments();
      setAssignments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = statusFilter === 'All'
    ? assignments
    : assignments.filter(a => a.status === statusFilter);

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this assignment?')) return;
    try {
      await externalAssessmentService.deleteAssignment(id);
      setAssignments(assignments.filter(a => a.id !== id));
      alert('Assignment revoked successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to revoke assignment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {['All', 'assigned', 'in_progress', 'submitted', 'evaluated'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all ${statusFilter === status
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              {status === 'assigned' ? 'Pending' : status === 'All' ? 'All Status' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Learner</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Assessment</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Assigned At</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAssignments.map(assignment => (
              <tr key={assignment.id} className="text-sm hover:bg-gray-50/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-bold text-gray-900 flex items-center gap-2">
                        {assignment.user?.fullname}
                        {assignment.user?.role === 'admin' && (
                          <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded uppercase">Admin</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500">{assignment.user?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-900">{assignment.assessment?.name}</p>
                  <p className="text-[10px] text-gray-500">{assignment.assessment?.provider}</p>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(assignment.assigned_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${assignment.status === 'evaluated' ? 'bg-green-100 text-green-700' :
                    assignment.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                      assignment.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-yellow-100 text-yellow-700'
                    }`}>
                    {assignment.status === 'assigned' ? 'Pending' : assignment.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleRevoke(assignment.id)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs"
                  >
                    <span className="material-symbols-rounded text-sm">cancel</span>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAssignments.length === 0 && !loading && (
          <div className="py-20 text-center">
            <span className="material-symbols-rounded text-5xl text-gray-300 mb-4">person_remove</span>
            <p className="text-gray-500">No {statusFilter !== 'All' ? statusFilter.replace('_', ' ') : ''} assignments found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AssessmentResultsTab: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [remarks, setRemarks] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const assignments = await externalAssessmentService.getAllAssignments();

      const flattened = assignments.flatMap(a => {
        if (!a.results || a.results.length === 0) {
          return [{
            id: `pending-${a.id}`,
            is_pending: true,
            user: a.user,
            assessment: a.assessment,
            status: a.status,
            assigned_at: a.assigned_at,
            verification_status: 'pending'
          }];
        }
        return a.results.map((r: any) => ({
          ...r,
          user: a.user,
          assessment: a.assessment,
          is_pending: false
        }));
      });

      // Sort by submitted_at or assigned_at
      flattened.sort((a, b) => {
        const dateA = new Date(a.submitted_at || a.assigned_at).getTime();
        const dateB = new Date(b.submitted_at || b.assigned_at).getTime();
        return dateB - dateA;
      });

      setData(flattened);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (status: 'approved' | 'rejected') => {
    if (!selectedResult) return;
    try {
      setVerifying(true);
      await externalAssessmentService.verifyResult(selectedResult.id, status, remarks);
      alert(`Result ${status} successfully!`);
      setSelectedResult(null);
      setRemarks('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to verify result');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Learner / Admin</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Assessment</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Score</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Level</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Submitted</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row) => (
              <tr key={row.id} className="text-sm hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-bold text-gray-900 flex items-center gap-2">
                        {row.user?.fullname}
                        {row.user?.role === 'admin' && (
                          <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded uppercase">Admin</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500">{row.user?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-900">{row.assessment?.name}</p>
                  <p className="text-[10px] text-gray-500">{row.assessment?.provider}</p>
                </td>
                <td className="px-6 py-4 text-center font-bold text-indigo-600">
                  {row.is_pending ? '-' : row.score}
                </td>
                <td className="px-6 py-4 text-center font-medium">
                  {row.is_pending ? '-' : row.determined_level}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : 'Pending'}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${row.verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                    row.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                    {row.verification_status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {!row.is_pending && row.verification_status === 'pending' && (
                    <button
                      onClick={() => setSelectedResult(row)}
                      className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Verify
                    </button>
                  )}
                  {!row.is_pending && row.certificate_url && (
                    <a
                      href={row.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline text-xs font-bold ml-2"
                    >
                      View Cert
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && !loading && (
          <div className="py-20 text-center">
            <p className="text-gray-500">No results found.</p>
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Verify Assessment Result</h3>
              <button onClick={() => setSelectedResult(null)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Learner</p>
                  <p className="font-bold">{selectedResult.user?.fullname}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Assessment</p>
                  <p className="font-bold">{selectedResult.assessment?.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Score</p>
                  <p className="font-bold text-indigo-600">{selectedResult.score}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Level</p>
                  <p className="font-bold">{selectedResult.determined_level}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Remarks / Feedback (Optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm h-24"
                  placeholder="Provide feedback or internal notes..."
                ></textarea>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled={verifying}
                onClick={() => handleVerify('rejected')}
                className="flex-1 px-4 py-2 rounded-lg font-bold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Reject
              </button>
              <button
                disabled={verifying}
                onClick={() => handleVerify('approved')}
                className="flex-1 px-4 py-2 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
              >
                Approve Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssessmentsPage;
