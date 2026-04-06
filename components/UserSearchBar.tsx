import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchService, SearchCourseResult, SearchMentorResult, SearchSkillResult } from '../lib/searchService';

const UserSearchBar: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [courses, setCourses] = useState<SearchCourseResult[]>([]);
    const [mentors, setMentors] = useState<SearchMentorResult[]>([]);
    const [skills, setSkills] = useState<SearchSkillResult[]>([]);
    const [activeTab, setActiveTab] = useState<'courses' | 'mentors' | 'skills'>('courses');
    const [loading, setLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setCourses([]);
            setMentors([]);
            setSkills([]);
            setIsOpen(false);
            return;
        }

        const searchAll = async () => {
            setLoading(true);
            try {
                const [coursesData, mentorsData, skillsData] = await Promise.all([
                    searchService.searchCourses(query),
                    searchService.searchMentors(query),
                    searchService.searchSkills(query),
                ]);

                setCourses(coursesData);
                setMentors(mentorsData);
                setSkills(skillsData);

                const hasAnyResults = (coursesData?.length || 0) > 0 ||
                    (mentorsData?.length || 0) > 0 ||
                    (skillsData?.length || 0) > 0;
                if (hasAnyResults) {
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(searchAll, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleCourseClick = (courseId: string) => {
        setIsOpen(false);
        setQuery('');
        navigate(`/course/${courseId}`);
    };

    const handleMentorClick = (mentorId: string) => {
        setIsOpen(false);
        setQuery('');
        navigate(`/catalog?mentor=${mentorId}`);
    };

    const handleSkillClick = (skillName: string) => {
        setIsOpen(false);
        setQuery('');
        navigate(`/catalog?category=${encodeURIComponent(skillName)}`);
    };

    const getResults = () => {
        switch (activeTab) {
            case 'courses':
                return courses;
            case 'mentors':
                return mentors;
            case 'skills':
                return skills;
            default:
                return [];
        }
    };

    const results = getResults();
    const hasResults = (courses?.length || 0) > 0 || (mentors?.length || 0) > 0 || (skills?.length || 0) > 0;

    return (
        <div className="flex-1 max-w-xl relative" ref={searchRef}>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-rounded">
                    search
                </span>
                <input
                    type="text"
                    placeholder="Search for courses, skills, or mentors..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => hasResults && setIsOpen(true)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400"
                />
            </div>

            {/* Search Results Dropdown */}
            {isOpen && hasResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 bg-slate-50 px-4">
                        <button
                            onClick={() => setActiveTab('courses')}
                            className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'courses'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Courses ({courses.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('mentors')}
                            className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'mentors'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Mentors ({mentors.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('skills')}
                            className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'skills'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Skills ({skills.length})
                        </button>
                    </div>

                    {/* Results */}
                    <div className="overflow-y-auto max-h-80">
                        {loading ? (
                            <div className="p-4 text-center text-slate-500">
                                <span className="material-symbols-rounded animate-spin">hourglass_empty</span>
                                <p className="text-sm mt-2">Searching...</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="divide-y divide-slate-200">
                                {results.map((result: any) => (
                                    <div
                                        key={result.id}
                                        onClick={() => {
                                            if (activeTab === 'courses') handleCourseClick(result.id);
                                            else if (activeTab === 'mentors') handleMentorClick(result.id);
                                            else if (activeTab === 'skills') handleSkillClick(result.name);
                                        }}
                                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-primary-500"
                                    >
                                        {activeTab === 'courses' && (
                                            <div className="flex gap-3">
                                                {result.thumbnail && (
                                                    <img
                                                        src={result.thumbnail}
                                                        alt={result.title}
                                                        className="w-12 h-12 rounded object-cover"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-slate-900 truncate">
                                                        {result.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {result.instructorName}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                                            {result.category}
                                                        </span>
                                                        {typeof result.averageRating === 'number' && (
                                                            <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                                                <span className="material-symbols-rounded text-xs">star</span>
                                                                {result.averageRating.toFixed(1)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'mentors' && (
                                            <div className="flex gap-3 items-center">
                                                <img
                                                    src={result.avatarUrl || `https://i.pravatar.cc/150?u=${result.id}`}
                                                    alt={result.fullName}
                                                    className="w-10 h-10 rounded-full object-cover"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-slate-900 truncate">
                                                        {result.fullName}
                                                    </h4>
                                                    <p className="text-xs text-slate-500">
                                                        {result.coursesCount} courses
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'skills' && (
                                            <div>
                                                <h4 className="font-semibold text-slate-900">{result.name}</h4>
                                                <p className="text-xs text-slate-500 mt-1">{result.description}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                No {activeTab} found for "{query}"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* No Results */}
            {isOpen && !hasResults && query.trim() && !loading && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-4 text-center text-slate-500 text-sm">
                    No results found for "{query}"
                </div>
            )}
        </div>
    );
};

export default UserSearchBar;
