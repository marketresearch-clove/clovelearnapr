
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import Loader from '../../../../components/Loader';
import { generateSkillsForCourse } from '../../../../lib/aiService';
import { skillService } from '../../../../lib/skillService';
import { exportToCSV } from '../../../../lib/exportUtils';

interface SkillCourseMapping {
  id: string;
  skillid: string;
  courseid: string;
  required: boolean;
  visible: boolean;
  hidden: boolean;
  expiry_date: string | null;
  createdby: string | null;
  createdat: string | null;
  updatedat: string | null;
  generated_by_ai?: boolean;
  ai_generated_at?: string | null;
  skills: {
    name: string;
    family: string;
  };
  courses: {
    title: string;
    level: string;
    category?: string;
  };
}

const SkillCourseMappings: React.FC = () => {
  const [mappings, setMappings] = useState<SkillCourseMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRequired, setFilterRequired] = useState('all');
  const [filterFamily, setFilterFamily] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [skillFamilies, setSkillFamilies] = useState<string[]>([]);

  const [newMapping, setNewMapping] = useState({
    skillFamily: '',
    skillIds: [] as string[],
    courseId: '',
    required: false,
    expiry_date: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<SkillCourseMapping | null>(null);

  // AI Generation state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiSelectedCourseId, setAiSelectedCourseId] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiGeneratedSuggestions, setAiGeneratedSuggestions] = useState<any[]>([]);
  const [aiAddedIndices, setAiAddedIndices] = useState<number[]>([]);
  const [aiCurrentMappedSkills, setAiCurrentMappedSkills] = useState<
    Array<{ id: string; skillid: string; name: string; family: string; required: boolean; generated_by_ai: boolean }>
  >([]);
  const [aiLoadingMapped, setAiLoadingMapped] = useState(false);

  interface AISuggestionStatus {
    existingSkillId: string | null;
    isAlreadyMapped: boolean;
    resolvedName: string;
    resolvedFamily: string;
  }
  const [aiSuggestionStatuses, setAiSuggestionStatuses] = useState<AISuggestionStatus[]>([]);

  useEffect(() => {
    fetchMappings();
    fetchFormData();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('skill_course_mappings')
        .select(`
          *,
          skills (name, family),
          courses (title, level, category)
        `)
        .order('createdat', { ascending: false });

      if (error) {
        console.error('Error fetching skill-course mappings:', error);
        throw error;
      }

      console.log('Fetched skill-course mappings:', data);
      // Filter out mappings with no associated skills (deleted skills)
      const validMappings = (data || []).filter(m => m.skills !== null && m.skills !== undefined);
      setMappings(validMappings);

      // Initialize all courses as collapsed by default
      if (validMappings && validMappings.length > 0) {
        const uniqueCourseIds = new Set(validMappings.map(m => m.courseid));
        setCollapsedFamilies(uniqueCourseIds);
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
      alert(`Failed to load mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      const { data: skills } = await supabase.from('skills').select('id, name, family');
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, description, category, level');
      const { data: families } = await supabase.from('skill_families').select('name');

      if (skills) setAvailableSkills(skills);
      if (courses) setAvailableCourses(courses);
      if (families) setSkillFamilies(families.map((f: any) => f.name));
    } catch (error) {
      console.error('Error fetching form data:', error);
    }
  };

  const handleAddMapping = async () => {
    if (newMapping.skillIds.length === 0 || !newMapping.courseId) {
      alert('Please select at least one skill and a course');
      return;
    }

    try {
      const mappingsToInsert = newMapping.skillIds.map(skillId => ({
        skillid: skillId,
        courseid: newMapping.courseId,
        required: newMapping.required,
        expiry_date: newMapping.expiry_date || null,
        visible: true,
        hidden: false
      }));

      const { data, error } = await supabase
        .from('skill_course_mappings')
        .insert(mappingsToInsert)
        .select();

      if (error) throw error;

      fetchMappings();
      setIsAddModalOpen(false);
      setNewMapping({
        skillFamily: '',
        skillIds: [],
        courseId: '',
        required: false,
        expiry_date: ''
      });
    } catch (error) {
      console.error('Error adding mapping:', error);
      alert('Failed to add mapping');
    }
  };

  const handleEditMapping = async () => {
    if (!editingMapping) return;

    try {
      const { error } = await supabase
        .from('skill_course_mappings')
        .update({
          required: editingMapping.required,
          expiry_date: editingMapping.expiry_date || null,
          updatedat: new Date().toISOString()
        })
        .eq('id', editingMapping.id);

      if (error) throw error;

      fetchMappings();
      setIsEditModalOpen(false);
      setEditingMapping(null);
    } catch (error) {
      console.error('Error updating mapping:', error);
      alert('Failed to update mapping');
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const { error } = await supabase
        .from('skill_course_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;
      fetchMappings();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Failed to delete mapping');
    }
  };

  const loadMappedSkillsForCourse = async (courseId: string) => {
    if (!courseId) { setAiCurrentMappedSkills([]); return; }
    try {
      setAiLoadingMapped(true);
      const { data } = await supabase
        .from('skill_course_mappings')
        .select('id, skillid, required, generated_by_ai, skills(name, family)')
        .eq('courseid', courseId);
      setAiCurrentMappedSkills(
        (data || []).map((m: any) => ({
          id: m.id,
          skillid: m.skillid,
          name: m.skills?.name || 'Unknown',
          family: m.skills?.family || '—',
          required: m.required,
          generated_by_ai: m.generated_by_ai,
        }))
      );
    } catch { setAiCurrentMappedSkills([]); }
    finally { setAiLoadingMapped(false); }
  };

  const handleAIGenerate = async () => {
    if (!aiSelectedCourseId) {
      alert('Please select a course first');
      return;
    }
    const course = availableCourses.find((c: any) => c.id === aiSelectedCourseId);
    if (!course) return;

    try {
      setIsAIGenerating(true);
      setAiGeneratedSuggestions([]);
      setAiSuggestionStatuses([]);
      setAiAddedIndices([]);

      // Fetch all existing skills + current mappings for this course in parallel
      const [families, { data: allSkills }, { data: existingMappings }] = await Promise.all([
        skillService.getSkillFamilies(),
        supabase.from('skills').select('id, name, family'),
        supabase
          .from('skill_course_mappings')
          .select('skillid')
          .eq('courseid', aiSelectedCourseId),
      ]);

      const familyNames = families.map((f: any) => f.name);
      const skillsForAI = (allSkills || []).map((s: any) => ({ name: s.name, family: s.family }));
      const mappedSkillIds = new Set((existingMappings || []).map((m: any) => m.skillid));

      const result = await generateSkillsForCourse(
        course.title,
        course.description || '',
        course.category || 'General',
        course.level || 'beginner',
        familyNames,
        skillsForAI
      );

      if (!result.skills) return;

      // Pre-resolve each suggestion: exact name match (case-insensitive) against existing skills
      const statuses: AISuggestionStatus[] = result.skills.map((s: any) => {
        const normalizedName = s.name.toLowerCase().trim();
        const match = (allSkills || []).find(
          (e: any) => e.name.toLowerCase().trim() === normalizedName
        );
        return {
          existingSkillId: match?.id ?? null,
          isAlreadyMapped: match ? mappedSkillIds.has(match.id) : false,
          resolvedName: match?.name ?? s.name,
          resolvedFamily: match?.family ?? s.family,
        };
      });

      setAiGeneratedSuggestions(result.skills);
      setAiSuggestionStatuses(statuses);

      // Auto-mark already-mapped suggestions as added
      const alreadyAdded = statuses
        .map((st, i) => (st.isAlreadyMapped ? i : -1))
        .filter(i => i !== -1);
      if (alreadyAdded.length > 0) setAiAddedIndices(alreadyAdded);
    } catch (error) {
      console.error('Error generating skills:', error);
      alert('Failed to generate skills. Please try again.');
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleAddAISuggestion = async (idx: number) => {
    const suggestion = aiGeneratedSuggestions[idx];
    const status = aiSuggestionStatuses[idx];
    if (!suggestion) return;

    try {
      let skillId: string;

      if (status?.existingSkillId) {
        // Reuse the existing skill — no DB write needed
        skillId = status.existingSkillId;
      } else {
        // Create skill (and family if needed) via ensureSkillAndFamily
        const { skill } = await skillService.ensureSkillAndFamily({
          name: suggestion.name,
          family: suggestion.family,
          description: suggestion.description,
        });
        if (!skill?.id) return;
        skillId = skill.id;

        // Refresh available skills list so new skill appears in the manual Add Mapping modal
        setAvailableSkills(prev =>
          prev.find((s: any) => s.id === skillId)
            ? prev
            : [...prev, { id: skillId, name: suggestion.name, family: suggestion.family }]
        );
      }

      // Insert mapping only if it doesn't already exist
      const { data: existing } = await supabase
        .from('skill_course_mappings')
        .select('id')
        .eq('skillid', skillId)
        .eq('courseid', aiSelectedCourseId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase
          .from('skill_course_mappings')
          .insert([{
            skillid: skillId,
            courseid: aiSelectedCourseId,
            required: false,
            visible: true,
            hidden: false,
            generated_by_ai: true,
            ai_generated_at: new Date().toISOString(),
          }]);
        if (error) throw error;
      }

      setAiAddedIndices(prev => [...prev, idx]);
      fetchMappings();
      loadMappedSkillsForCourse(aiSelectedCourseId);
    } catch (error) {
      console.error('Error adding AI suggestion:', error);
      alert('Failed to add skill mapping.');
    }
  };

  const handleAddAllAISuggestions = async () => {
    try {
      setIsAIGenerating(true);
      for (let i = 0; i < aiGeneratedSuggestions.length; i++) {
        if (!aiAddedIndices.includes(i)) {
          await handleAddAISuggestion(i);
        }
      }
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleExport = () => {
    const dataToExport = filteredMappings.map(m => ({
      Skill: m.skills?.name || '',
      Family: m.skills?.family || '',
      Course: m.courses?.title || '',
      Level: m.courses?.level || '',
      Required: m.required ? 'Yes' : 'No',
      ExpiryDate: m.expiry_date || '-',
      CreatedAt: m.createdat ? new Date(m.createdat).toLocaleDateString() : '-'
    }));
    exportToCSV(dataToExport, 'Skill_Course_Mappings');
  };

  const filteredMappings = mappings
    .filter(mapping => mapping.skills !== null && mapping.skills !== undefined) // Additional safety check
    .filter(mapping => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        mapping.skills?.name.toLowerCase().includes(q) ||
        mapping.courses?.title.toLowerCase().includes(q) ||
        mapping.skills?.family.toLowerCase().includes(q);

      const matchesRequired =
        filterRequired === 'all' ||
        (filterRequired === 'yes' && mapping.required) ||
        (filterRequired === 'no' && !mapping.required);

      const matchesFamily =
        filterFamily === 'all' || mapping.skills?.family === filterFamily;

      const matchesLevel =
        filterLevel === 'all' || mapping.courses?.level === filterLevel;

      const matchesCategory =
        filterCategory === 'all' || mapping.courses?.category === filterCategory;

      return matchesSearch && matchesRequired && matchesFamily && matchesLevel && matchesCategory;
    });

  const families = Array.from(new Set(mappings.map(m => m.skills?.family).filter(Boolean))) as string[];
  const levels = Array.from(new Set(mappings.map(m => m.courses?.level).filter(Boolean))) as string[];
  const categories = Array.from(new Set(mappings.map(m => m.courses?.category).filter(Boolean))) as string[];

  // Group filtered mappings: courseid → { meta, mappings[] }
  const groupedByCourse = filteredMappings.reduce<
    Record<string, { title: string; category: string; level: string; mappings: SkillCourseMapping[] }>
  >((acc, m) => {
    const key = m.courseid;
    if (!acc[key]) {
      acc[key] = {
        title: m.courses?.title || 'Unknown Course',
        category: m.courses?.category || '',
        level: m.courses?.level || '',
        mappings: [],
      };
    }
    acc[key].mappings.push(m);
    return acc;
  }, {});

  const toggleCourse = (courseId: string) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev);
      next.has(courseId) ? next.delete(courseId) : next.add(courseId);
      return next;
    });
  };

  const filteredSkills = availableSkills.filter(skill =>
    !newMapping.skillFamily || skill.family === newMapping.skillFamily
  );

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-2">
        {/* Filters row */}
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative">
            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
            <input
              type="text"
              placeholder="Search skills or courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-56 text-gray-900 placeholder-gray-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 pr-8 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterFamily}
            onChange={(e) => setFilterFamily(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="all">All Families</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="all">All Levels</option>
            {levels.map(l => (
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterRequired}
            onChange={(e) => setFilterRequired(e.target.value)}
            className="px-3 py-2 pr-8 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="all">All Requirements</option>
            <option value="yes">Required</option>
            <option value="no">Optional</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleExport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <span className="material-symbols-rounded text-sm">download</span>
            Export
          </button>
          <button
            onClick={() => { setIsAIModalOpen(true); setAiGeneratedSuggestions([]); setAiSuggestionStatuses([]); setAiAddedIndices([]); setAiSelectedCourseId(''); setAiCurrentMappedSkills([]); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <span className="material-symbols-rounded text-sm">auto_awesome</span>
            AI Generate
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <span className="material-symbols-rounded text-sm">add</span>
            Add Mapping
          </button>
        </div>
      </div>

      {/* ── Grouped view ── */}
      {loading ? (
        <div className="py-20">
          <Loader size="lg" message="Loading mappings..." />
        </div>
      ) : Object.keys(groupedByCourse).length === 0 ? (
        <div className="text-center py-12 text-gray-700">No mappings found</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedByCourse)
            .sort(([, a], [, b]) => a.title.localeCompare(b.title))
            .map(([courseId, { title, category, level, mappings: courseMappings }]) => {
              const isCollapsed = collapsedFamilies.has(courseId);
              const skillCount = courseMappings.length;

              return (
                <div key={courseId} className="border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Course header */}
                  <button
                    onClick={() => toggleCourse(courseId)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-blue-100 hover:bg-blue-150 transition-colors text-left border-b border-blue-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="material-symbols-rounded text-blue-700 flex-shrink-0">menu_book</span>
                      <span className="font-semibold text-gray-900 text-sm truncate">{title}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {category && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 font-semibold">
                            {category}
                          </span>
                        )}
                        {level && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-300 text-gray-900 font-semibold capitalize">
                            {level}
                          </span>
                        )}
                        <span className="text-xs text-gray-700 ml-1">
                          {skillCount} skill{skillCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <span className={`material-symbols-rounded text-gray-900 font-semibold flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
                      expand_more
                    </span>
                  </button>

                  {/* Skills table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b-2 border-gray-300 bg-gray-50">
                            <th className="py-2 pl-5 pr-3 text-xs font-semibold text-gray-900 uppercase tracking-wide">Skill</th>
                            <th className="py-2 px-3 text-xs font-semibold text-gray-900 uppercase tracking-wide">Family</th>
                            <th className="py-2 px-3 text-xs font-semibold text-gray-900 uppercase tracking-wide">Required</th>
                            <th className="py-2 px-3 text-xs font-semibold text-gray-900 uppercase tracking-wide">Source</th>
                            <th className="py-2 px-3 text-xs font-semibold text-gray-900 uppercase tracking-wide">Expiry</th>
                            <th className="py-2 pl-3 pr-5 text-xs font-semibold text-gray-900 uppercase tracking-wide text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {courseMappings
                            .slice()
                            .sort((a, b) => (a.skills?.name || '').localeCompare(b.skills?.name || ''))
                            .map((mapping) => (
                              <tr key={mapping.id} className="hover:bg-blue-50 transition-colors">
                                <td className="py-3 pl-5 pr-3 font-semibold text-sm text-gray-900">
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-rounded text-xs text-indigo-400">bolt</span>
                                    {mapping.skills?.name || '—'}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-sm text-gray-900">
                                  {mapping.skills?.family || '—'}
                                </td>
                                <td className="py-3 px-3">
                                  {mapping.required ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-200 text-indigo-800">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-900">
                                      Optional
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  {mapping.generated_by_ai ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"
                                      title={`AI generated${mapping.ai_generated_at ? ' on ' + new Date(mapping.ai_generated_at).toLocaleDateString() : ''}`}
                                    >
                                      <span className="material-symbols-rounded text-xs">auto_awesome</span>
                                      AI
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-700">Manual</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-sm text-gray-900">
                                  {mapping.expiry_date ? new Date(mapping.expiry_date).toLocaleDateString() : '—'}
                                </td>
                                <td className="py-3 pl-3 pr-8 text-right">
                                  <div className="relative inline-block">
                                    <button
                                      onClick={() => setOpenMenuId(openMenuId === mapping.id ? null : mapping.id)}
                                      className="text-gray-700 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                    >
                                      <span className="material-symbols-rounded text-sm">more_horiz</span>
                                    </button>
                                    {openMenuId === mapping.id && (
                                      <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-700 rounded-2xl shadow-lg z-10 border border-gray-200 dark:border-gray-600">
                                        <button
                                          onClick={() => { setEditingMapping(mapping); setIsEditModalOpen(true); setOpenMenuId(null); }}
                                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-t-lg"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteMapping(mapping.id)}
                                          className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-b-lg"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-700">
          {filteredMappings.length} skill mapping{filteredMappings.length !== 1 ? 's' : ''} across {Object.keys(groupedByCourse).length} course{Object.keys(groupedByCourse).length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add Mapping Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Skill-Course Mapping</h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Course
                </label>
                <select
                  value={newMapping.courseId}
                  onChange={(e) => setNewMapping({ ...newMapping, courseId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Course</option>
                  {availableCourses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Skill Family (Filter)
                </label>
                <select
                  value={newMapping.skillFamily}
                  onChange={(e) => setNewMapping({ ...newMapping, skillFamily: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">All Families</option>
                  {skillFamilies.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Skills
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto p-2">
                  {filteredSkills.map(skill => (
                    <label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMapping.skillIds.includes(skill.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewMapping({ ...newMapping, skillIds: [...newMapping.skillIds, skill.id] });
                          } else {
                            setNewMapping({ ...newMapping, skillIds: newMapping.skillIds.filter(id => id !== skill.id) });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 dark:text-white">{skill.name}</span>
                        <span className="text-xs text-gray-700">{skill.family}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newMapping.required}
                    onChange={(e) => setNewMapping({ ...newMapping, required: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Required for Course Completion</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={newMapping.expiry_date}
                  onChange={(e) => setNewMapping({ ...newMapping, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMapping}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Add Mapping
              </button>
            </div>
          </div>
        </div>
      )}
      {/* AI Generate Mappings Modal */}
      {isAIModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <span className="material-symbols-rounded text-indigo-600 dark:text-indigo-400">auto_awesome</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Generate Skill Mappings</h3>
              <button
                onClick={() => setIsAIModalOpen(false)}
                className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Course
                </label>
                <select
                  value={aiSelectedCourseId}
                  onChange={e => {
                    const id = e.target.value;
                    setAiSelectedCourseId(id);
                    setAiGeneratedSuggestions([]);
                    setAiSuggestionStatuses([]);
                    setAiAddedIndices([]);
                    loadMappedSkillsForCourse(id);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Course</option>
                  {availableCourses.map((course: any) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              {/* Currently mapped skills */}
              {aiSelectedCourseId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Currently Mapped Skills
                    </span>
                    {!aiLoadingMapped && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {aiCurrentMappedSkills.length} skill{aiCurrentMappedSkills.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {aiLoadingMapped ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-gray-400 dark:text-gray-500">
                      <span className="material-symbols-rounded text-sm animate-spin">sync</span>
                      Loading mapped skills...
                    </div>
                  ) : aiCurrentMappedSkills.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2">
                      No skills mapped to this course yet.
                    </p>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                      {/* group by family */}
                      {Object.entries(
                        aiCurrentMappedSkills.reduce<Record<string, typeof aiCurrentMappedSkills>>((acc, s) => {
                          if (!acc[s.family]) acc[s.family] = [];
                          acc[s.family].push(s);
                          return acc;
                        }, {})
                      ).sort(([a], [b]) => a.localeCompare(b)).map(([family, skills]) => (
                        <div key={family}>
                          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            {family}
                          </div>
                          {skills.map(s => (
                            <div key={s.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-rounded text-xs text-indigo-400">bolt</span>
                                <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{s.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                {s.required && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                                    Required
                                  </span>
                                )}
                                {s.generated_by_ai && (
                                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-indigo-500 dark:text-indigo-400">
                                    <span className="material-symbols-rounded" style={{ fontSize: 11 }}>auto_awesome</span>
                                    AI
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {aiGeneratedSuggestions.length === 0 ? (
                <button
                  onClick={handleAIGenerate}
                  disabled={isAIGenerating || !aiSelectedCourseId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                >
                  <span className={`material-symbols-rounded text-sm ${isAIGenerating ? 'animate-spin' : ''}`}>
                    {isAIGenerating ? 'sync' : 'auto_awesome'}
                  </span>
                  {isAIGenerating ? 'Analysing course & generating skills...' : 'Generate Skill Suggestions'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {aiGeneratedSuggestions.length} skills suggested
                      {aiSuggestionStatuses.filter(s => s.existingSkillId).length > 0 && (
                        <span className="ml-1 text-blue-600 dark:text-blue-400">
                          ({aiSuggestionStatuses.filter(s => s.existingSkillId).length} existing matched)
                        </span>
                      )}
                    </p>
                    <button
                      onClick={handleAddAllAISuggestions}
                      disabled={isAIGenerating || aiAddedIndices.length === aiGeneratedSuggestions.length}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <span className="material-symbols-rounded text-sm">done_all</span>
                      {aiAddedIndices.length === aiGeneratedSuggestions.length ? 'All Added' : 'Add All'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {aiGeneratedSuggestions.map((s, idx) => {
                      const status = aiSuggestionStatuses[idx];
                      const isAdded = aiAddedIndices.includes(idx);
                      const isExisting = !!status?.existingSkillId;
                      const isAlreadyMapped = !!status?.isAlreadyMapped;

                      return (
                        <div
                          key={idx}
                          className={`flex items-start justify-between gap-3 p-3 border rounded-lg transition-colors ${isAdded
                            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                            }`}
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-gray-900 dark:text-white">
                                {status?.resolvedName ?? s.name}
                              </p>
                              {isAlreadyMapped ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                  Already Mapped
                                </span>
                              ) : isExisting ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                  <span className="material-symbols-rounded" style={{ fontSize: 10 }}>check_circle</span>
                                  Existing Skill
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                  <span className="material-symbols-rounded" style={{ fontSize: 10 }}>add_circle</span>
                                  New Skill
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {status?.resolvedFamily ?? s.family}
                            </p>
                            {s.description && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                                {s.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddAISuggestion(idx)}
                            disabled={isAdded || isAIGenerating}
                            className="flex-shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            {isAdded ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      setAiGeneratedSuggestions([]);
                      setAiSuggestionStatuses([]);
                      setAiAddedIndices([]);
                    }}
                    className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Regenerate suggestions
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setIsAIModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mapping Modal */}
      {isEditModalOpen && editingMapping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Skill-Course Mapping</h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Course
                </label>
                <input
                  type="text"
                  value={editingMapping.courses?.title || ''}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Skill
                </label>
                <input
                  type="text"
                  value={editingMapping.skills?.name || ''}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingMapping.required}
                    onChange={(e) => setEditingMapping({ ...editingMapping, required: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Required for Course Completion</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={editingMapping.expiry_date || ''}
                  onChange={(e) => setEditingMapping({ ...editingMapping, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingMapping(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditMapping}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillCourseMappings;
