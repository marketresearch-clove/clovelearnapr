import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generateSkillsForCourse } from '../lib/aiService';
import { skillService } from '../lib/skillService';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';

interface Skill {
    id: string;
    name: string;
    family: string;
    description?: string;
    type?: string;
}

interface SkillFamily {
    id: string;
    name: string;
    description?: string;
    icon?: string;
}

interface CourseSkillSelectorProps {
    courseTitle: string;
    courseDescription: string;
    courseCategory?: string;
    courseLevel?: string;
    selectedSkillIds?: string[];
    onSkillsChange?: (skillIds: string[]) => void;
}

const CourseSkillSelector: React.FC<CourseSkillSelectorProps> = ({
    courseTitle,
    courseDescription,
    courseCategory = '',
    courseLevel = 'beginner',
    selectedSkillIds = [],
    onSkillsChange,
}) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillFamilies, setSkillFamilies] = useState<SkillFamily[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>(selectedSkillIds);
    const [loading, setLoading] = useState(true);
    const [showAIModal, setShowAIModal] = useState(false);
    const [generatingSkills, setGeneratingSkills] = useState(false);
    const [showNewSkillModal, setShowNewSkillModal] = useState(false);
    const [showNewFamilyModal, setShowNewFamilyModal] = useState(false);
    const [aiSuggestions, setAISuggestions] = useState<any[]>([]);
    const [selectedAISuggestions, setSelectedAISuggestions] = useState<number[]>([]);
    const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
    const [expandedSkillsDropdown, setExpandedSkillsDropdown] = useState(false);

    const [newSkillData, setNewSkillData] = useState({
        name: '',
        family: '',
    });

    const [newFamilyData, setNewFamilyData] = useState({
        name: '',
        description: '',
        icon: '',
    });

    const [iconSearchQuery, setIconSearchQuery] = useState('');

    const allIcons = [...Object.keys(FaIcons), ...Object.keys(MdIcons)];
    const allIconLibraries = { ...FaIcons, ...MdIcons };

    const filteredIcons = allIcons
        .filter(icon => icon.toLowerCase().includes(iconSearchQuery.toLowerCase()))
        .slice(0, 100);

    useEffect(() => {
        fetchSkillsAndFamilies();
    }, []);

    useEffect(() => {
        console.log('CourseSkillSelector: selectedSkillIds prop changed:', selectedSkillIds);
        setSelectedSkills(selectedSkillIds);
    }, [selectedSkillIds]);

    const fetchSkillsAndFamilies = async () => {
        try {
            setLoading(true);
            console.log('CourseSkillSelector: Fetching skills and families...');

            const { data: skillsData, error: skillsError } = await supabase.from('skills').select('*');
            const { data: familiesData, error: familiesError } = await supabase.from('skill_families').select('*');

            if (skillsError) {
                console.error('Error fetching skills:', skillsError);
                throw skillsError;
            }
            if (familiesError) {
                console.error('Error fetching skill families:', familiesError);
                throw familiesError;
            }

            console.log('Fetched skills:', skillsData?.length || 0);
            console.log('Fetched families:', familiesData?.length || 0);

            if (skillsData) setSkills(skillsData);
            if (familiesData) setSkillFamilies(familiesData);
        } catch (error) {
            console.error('Error fetching skills and families:', error);
            alert(`Failed to load skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSkillToggle = (skillId: string) => {
        setSelectedSkills(prev => {
            const updated = prev.includes(skillId)
                ? prev.filter(id => id !== skillId)
                : [...prev, skillId];
            console.log('Skill toggled:', skillId, 'Updated selection:', updated);
            onSkillsChange?.(updated);
            return updated;
        });
    };

    const handleGenerateSkillsWithAI = async () => {
        if (!courseTitle || !courseDescription) {
            alert('Please enter course title and description');
            return;
        }

        try {
            setGeneratingSkills(true);
            const familyNames = skillFamilies.map(f => f.name);
            const result = await generateSkillsForCourse(
                courseTitle,
                courseDescription,
                courseCategory,
                courseLevel,
                familyNames
            );

            if (result.skills) {
                setAISuggestions(result.skills);
                setSelectedAISuggestions([]);
            }
        } catch (error) {
            console.error('Error generating skills:', error);
            alert('Failed to generate skills. Please try again.');
        } finally {
            setGeneratingSkills(false);
        }
    };

    const handleAddSkillFromAI = async (suggestionIndex: number) => {
        const suggestion = aiSuggestions[suggestionIndex];
        if (!suggestion) return;

        try {
            const { skill, family } = await skillService.ensureSkillAndFamily(suggestion);

            if (skill) {
                // If this was a new family, update state
                setSkillFamilies(prev => {
                    if (!prev.find(f => f.id === family?.id)) {
                        return [...prev, family as SkillFamily];
                    }
                    return prev;
                });

                // If this was a new skill, update state
                setSkills(prev => {
                    if (!prev.find(s => s.id === skill.id)) {
                        return [...prev, skill as Skill];
                    }
                    return prev;
                });

                handleSkillToggle(skill.id as string);
            }

            // Mark as added
            setSelectedAISuggestions(prev => [...prev, suggestionIndex]);
        } catch (error) {
            console.error('Error adding AI skill:', error);
            alert('Failed to add skill. Please try again.');
        }
    };

    const handleAddAllAISkills = async () => {
        try {
            setGeneratingSkills(true);
            const unaddedSuggestions = aiSuggestions.filter((_, idx) => !selectedAISuggestions.includes(idx));

            for (let i = 0; i < aiSuggestions.length; i++) {
                if (!selectedAISuggestions.includes(i)) {
                    await handleAddSkillFromAI(i);
                }
            }

            alert('All suggested skills have been processed!');
        } catch (error) {
            console.error('Error adding all AI skills:', error);
            alert('Encountered an error while adding some skills.');
        } finally {
            setGeneratingSkills(false);
        }
    };

    const handleCreateNewSkill = async () => {
        if (!newSkillData.name || !newSkillData.family) {
            alert('Please enter skill name and select a family');
            return;
        }

        try {
            const { data: newSkill } = await supabase
                .from('skills')
                .insert([
                    {
                        name: newSkillData.name,
                        family: newSkillData.family,
                    },
                ])
                .select()
                .single();

            if (newSkill) {
                setSkills(prev => [...prev, newSkill]);
                handleSkillToggle(newSkill.id);
                setNewSkillData({ name: '', family: '' });
                setShowNewSkillModal(false);
            }
        } catch (error) {
            console.error('Error creating skill:', error);
            alert('Failed to create skill. Please try again.');
        }
    };

    const handleCreateNewFamily = async () => {
        if (!newFamilyData.name) {
            alert('Please enter family name');
            return;
        }

        try {
            // Build insert payload; icon column may or may not exist yet
            const insertPayload: any = {
                name: newFamilyData.name,
                description: newFamilyData.description,
            };
            if (newFamilyData.icon) {
                insertPayload.icon = newFamilyData.icon;
            }

            const { data: newFamily, error } = await supabase
                .from('skill_families')
                .insert([insertPayload])
                .select()
                .single();

            if (error) throw error;

            if (newFamily) {
                setSkillFamilies(prev => [...prev, newFamily]);
                setNewFamilyData({ name: '', description: '', icon: '' });
                setIconSearchQuery('');
                setShowNewFamilyModal(false);
                alert('Family created successfully!');
            }
        } catch (error: any) {
            console.error('Error creating family:', error);
            // If error is due to missing icon column, retry without it
            if (error?.message?.includes('icon') || error?.code === '42703') {
                try {
                    const { data: newFamily, error: retryError } = await supabase
                        .from('skill_families')
                        .insert([{ name: newFamilyData.name, description: newFamilyData.description }])
                        .select()
                        .single();
                    if (retryError) throw retryError;
                    if (newFamily) {
                        setSkillFamilies(prev => [...prev, newFamily]);
                        setNewFamilyData({ name: '', description: '', icon: '' });
                        setIconSearchQuery('');
                        setShowNewFamilyModal(false);
                        alert('Family created successfully! (Note: run the icon column migration to enable icon saving)');
                    }
                } catch (retryErr) {
                    alert('Failed to create family. Please try again.');
                }
            } else {
                alert('Failed to create family. Please try again.');
            }
        }
    };

    const skillsByFamily = skills.reduce((acc: any, skill) => {
        if (!acc[skill.family]) {
            acc[skill.family] = [];
        }
        acc[skill.family].push(skill);
        return acc;
    }, {});

    const toggleFamilyExpanded = (family: string) => {
        setExpandedFamilies(prev => {
            const updated = new Set(prev);
            if (updated.has(family)) {
                updated.delete(family);
            } else {
                updated.add(family);
            }
            return updated;
        });
    };

    if (loading) {
        return <div className="text-center py-4">Loading skills...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setShowAIModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    <span className="material-symbols-rounded text-sm">auto_awesome</span>
                    Generate Skills - AI
                </button>
                <button
                    onClick={() => setShowNewSkillModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <span className="material-symbols-rounded text-sm">add</span>
                    Create Skill
                </button>
                <button
                    onClick={() => setShowNewFamilyModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                    <span className="material-symbols-rounded text-sm">category</span>
                    Create Family
                </button>
            </div>

            {/* Selected Skills Display */}
            {selectedSkills.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                        Selected Skills ({selectedSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {selectedSkills.map(skillId => {
                            const skill = skills.find(s => s.id === skillId);
                            return (
                                <div
                                    key={skillId}
                                    className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full text-sm"
                                >
                                    <span className="text-blue-900">{skill?.name}</span>
                                    <button
                                        onClick={() => handleSkillToggle(skillId)}
                                        className="text-blue-600 hover:text-blue-900"
                                    >
                                        <span className="material-symbols-rounded text-sm">close</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available Skills Dropdown */}
            <div className="border border-gray-200 rounded-lg">
                <button
                    onClick={() => setExpandedSkillsDropdown(!expandedSkillsDropdown)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                    <h3 className="text-lg font-semibold text-gray-900">Available Skills</h3>
                    <span className={`material-symbols-rounded transition-transform text-gray-600 ${expandedSkillsDropdown ? 'rotate-180' : ''}`}>
                        expand_more
                    </span>
                </button>

                {expandedSkillsDropdown && (
                    <div className="border-t border-gray-200 divide-y divide-gray-200">
                        {Object.entries(skillsByFamily).length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No skills available for the selected type
                            </div>
                        ) : (
                            Object.entries(skillsByFamily).map(([family, familySkills]: [string, any]) => (
                                <div key={family}>
                                    <button
                                        onClick={() => toggleFamilyExpanded(family)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                    >
                                        <h4 className="font-medium text-gray-900">{family}</h4>
                                        <span className={`material-symbols-rounded text-sm transition-transform text-gray-600 ${expandedFamilies.has(family) ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>

                                    {expandedFamilies.has(family) && (
                                        <div className="bg-gray-50 p-4 space-y-3 border-t border-gray-200">
                                            {(familySkills as Skill[]).map(skill => (
                                                <label
                                                    key={skill.id}
                                                    className="flex items-start gap-3 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSkills.includes(skill.id)}
                                                        onChange={() => handleSkillToggle(skill.id)}
                                                        className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="font-medium text-gray-900">{skill.name}</p>
                                                            {skill.type && (
                                                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                                                    {skill.type}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {skill.description && (
                                                            <p className="text-xs text-gray-600">{skill.description}</p>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* AI Generation Modal */}
            {showAIModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-gray-900">AI-Generated Skills</h2>
                            <button
                                onClick={() => {
                                    setShowAIModal(false);
                                    setAISuggestions([]);
                                }}
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>

                        <div className="p-6">
                            {aiSuggestions.length === 0 ? (
                                <div className="text-center">
                                    <p className="text-gray-600 mb-4">
                                        Based on the course information, here are recommended skills students will acquire:
                                    </p>
                                    <button
                                        onClick={handleGenerateSkillsWithAI}
                                        disabled={generatingSkills}
                                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors mx-auto"
                                    >
                                        <span className="material-symbols-rounded text-sm">auto_awesome</span>
                                        {generatingSkills ? 'Generating...' : 'Generate Skills'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-sm text-gray-600">
                                            Found {aiSuggestions.length} skills. You can add them individually or all at once.
                                        </p>
                                        <button
                                            onClick={handleAddAllAISkills}
                                            disabled={generatingSkills || selectedAISuggestions.length === aiSuggestions.length}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                                        >
                                            <span className="material-symbols-rounded text-sm">done_all</span>
                                            {selectedAISuggestions.length === aiSuggestions.length ? 'All Added' : 'Add All'}
                                        </button>
                                    </div>
                                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                        {aiSuggestions.map((suggestion, idx) => (
                                            <div
                                                key={idx}
                                                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-900">{suggestion.name}</p>
                                                        <p className="text-sm text-gray-600">{suggestion.family}</p>
                                                        {suggestion.description && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {suggestion.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddSkillFromAI(idx)}
                                                        disabled={selectedAISuggestions.includes(idx)}
                                                        className="flex-shrink-0 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                                                    >
                                                        {selectedAISuggestions.includes(idx) ? 'Added' : 'Add'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* New Skill Modal */}
            {showNewSkillModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900">Create New Skill</h2>
                            <button
                                onClick={() => {
                                    setShowNewSkillModal(false);
                                    setNewSkillData({ name: '', family: '' });
                                }}
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Skill Name
                                </label>
                                <input
                                    type="text"
                                    value={newSkillData.name}
                                    onChange={e => setNewSkillData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., React Development"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Skill Family
                                </label>
                                <select
                                    value={newSkillData.family}
                                    onChange={e => setNewSkillData(prev => ({ ...prev, family: e.target.value }))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select a family</option>
                                    {skillFamilies.map(family => (
                                        <option key={family.id} value={family.name}>
                                            {family.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setShowNewSkillModal(false);
                                        setNewSkillData({ name: '', family: '' });
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateNewSkill}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                                >
                                    Create Skill
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* New Family Modal */}
            {showNewFamilyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900">Create New Skill Family</h2>
                            <button
                                onClick={() => {
                                    setShowNewFamilyModal(false);
                                    setNewFamilyData({ name: '', description: '', icon: '' });
                                    setIconSearchQuery('');
                                }}
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Family Name
                                </label>
                                <input
                                    type="text"
                                    value={newFamilyData.name}
                                    onChange={e => setNewFamilyData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Technical Skills"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={newFamilyData.description}
                                    onChange={e => setNewFamilyData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Brief description of this skill family"
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Family Icon
                                </label>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                                        <input
                                            type="text"
                                            placeholder="Search icons..."
                                            value={iconSearchQuery}
                                            onChange={(e) => setIconSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1 border border-gray-200 rounded-lg">
                                        {filteredIcons.map(iconName => (
                                            <button
                                                key={iconName}
                                                type="button"
                                                onClick={() => setNewFamilyData({ ...newFamilyData, icon: iconName })}
                                                className={`p-2 rounded-lg flex items-center justify-center transition-all ${newFamilyData.icon === iconName
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                                title={iconName}
                                            >
                                                {React.createElement((allIconLibraries as any)[iconName], { size: 20 })}
                                            </button>
                                        ))}
                                    </div>
                                    {newFamilyData.icon && (
                                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                            <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center">
                                                {React.createElement((allIconLibraries as any)[newFamilyData.icon], { size: 18 })}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-blue-900 truncate">{newFamilyData.icon}</p>
                                                <p className="text-[10px] text-blue-600">Selected Icon</p>
                                            </div>
                                            <button
                                                onClick={() => setNewFamilyData({ ...newFamilyData, icon: '' })}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                <span className="material-symbols-rounded text-sm">close</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setShowNewFamilyModal(false);
                                        setNewFamilyData({ name: '', description: '', icon: '' });
                                        setIconSearchQuery('');
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateNewFamily}
                                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
                                >
                                    Create Family
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseSkillSelector;
