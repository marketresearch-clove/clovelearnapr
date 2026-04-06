import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchService, SearchUserResult, SearchCourseResult, SearchSkillResult } from '../lib/searchService';
import UserReportCard from './UserReportCard';

interface AdminSearchBarProps {
    onUserSelect?: (userId: string) => void;
}

type SearchCriteria = 'users' | 'courses' | 'assignments' | 'skills' | 'careerpath' | 'learningjourney';

const AdminSearchBar: React.FC<AdminSearchBarProps> = ({ onUserSelect }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [showCriteria, setShowCriteria] = useState(false);
    const [users, setUsers] = useState<SearchUserResult[]>([]);
    const [courses, setCourses] = useState<SearchCourseResult[]>([]);
    const [skills, setSkills] = useState<SearchSkillResult[]>([]);
    const [careerPaths, setCareerPaths] = useState<any[]>([]);
    const [learningJourneys, setLearningJourneys] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const criteriaOptions: { label: string; value: SearchCriteria; icon: string }[] = [
        { label: 'Users', value: 'users', icon: 'person' },
        { label: 'Courses', value: 'courses', icon: 'school' },
        { label: 'Assignments', value: 'assignments', icon: 'assignment' },
        { label: 'Skills', value: 'skills', icon: 'workspace_premium' },
        { label: 'Learning Journeys', value: 'learningjourney', icon: 'conversion_path' },
        { label: 'Career Path', value: 'careerpath', icon: 'trending_up' },
    ];

    const currentCriteriaLabel = searchCriteria
        ? criteriaOptions.find((c) => c.value === searchCriteria)?.label
        : 'Search option';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowCriteria(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim() || !searchCriteria) {
            setUsers([]);
            setCourses([]);
            setSkills([]);
            setCareerPaths([]);
            setLearningJourneys([]);
            if (!query.trim()) {
                setIsOpen(false);
            }
            return;
        }

        const performSearch = async () => {
            setLoading(true);
            try {
                switch (searchCriteria) {
                    case 'users':
                        console.log('Searching users with query:', query);
                        const usersData = await searchService.searchUsers(query);
                        console.log('Users search result:', usersData);
                        setUsers(usersData);
                        setCourses([]);
                        setSkills([]);
                        setCareerPaths([]);
                        setLearningJourneys([]);
                        if (usersData.length > 0) setIsOpen(true);
                        break;
                    case 'courses':
                    case 'assignments':
                        console.log('Searching courses with query:', query);
                        const coursesData = await searchService.searchCourses(query);
                        console.log('Courses search result:', coursesData);
                        setCourses(coursesData);
                        setUsers([]);
                        setSkills([]);
                        setCareerPaths([]);
                        setLearningJourneys([]);
                        if (coursesData.length > 0) setIsOpen(true);
                        break;
                    case 'skills':
                        const skillsData = await searchService.searchSkills(query);
                        setSkills(skillsData);
                        setUsers([]);
                        setCourses([]);
                        setCareerPaths([]);
                        setLearningJourneys([]);
                        if (skillsData.length > 0) setIsOpen(true);
                        break;
                    case 'learningjourney':
                        const journeyData = await searchService.searchLearningJourneys(query);
                        setLearningJourneys(journeyData);
                        setUsers([]);
                        setCourses([]);
                        setSkills([]);
                        setCareerPaths([]);
                        if (journeyData.length > 0) setIsOpen(true);
                        break;
                    case 'careerpath':
                        const careerPathsData = await searchService.searchCareerPaths(query);
                        setCareerPaths(careerPathsData);
                        setUsers([]);
                        setCourses([]);
                        setSkills([]);
                        setLearningJourneys([]);
                        if (careerPathsData.length > 0) setIsOpen(true);
                        break;
                        setUsers([]);
                        setCourses([]);
                        setSkills([]);
                        if (careerPathsData.length > 0) setIsOpen(true);
                        break;
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(performSearch, 300);
        return () => clearTimeout(timer);
    }, [query, searchCriteria]);

    const handleUserSelect = (userId: string) => {
        setSelectedUserId(userId);
        setIsOpen(false);
        setQuery('');
        setSearchCriteria(null);
        setShowCriteria(false);
        onUserSelect?.(userId);
    };

    const handleCourseSelect = (courseId: string) => {
        setIsOpen(false);
        setQuery('');
        setSearchCriteria(null);
        setShowCriteria(false);
        // Navigate to course assignments management with the selected course
        navigate(`/admin/course-assignments?courseId=${courseId}`);
    };

    const handleAssignmentSelect = (courseId: string) => {
        setIsOpen(false);
        setQuery('');
        setSearchCriteria(null);
        setShowCriteria(false);
        // Navigate to course assignments management  
        navigate(`/admin/course-assignments?courseId=${courseId}`);
    };

    const handleSkillSelect = (skillName: string) => {
        setIsOpen(false);
        setQuery('');
        setSearchCriteria(null);
        setShowCriteria(false);
        // Could navigate to skills management page if needed
    };

    const handleCareerPathSelect = (careerPathId: string) => {
        setIsOpen(false);
        setQuery('');
        setSearchCriteria(null);
        setShowCriteria(false);
        // Navigate to manage career paths tab
        navigate(`/admin/learning-journeys?tab=careerPaths&careerPathId=${careerPathId}`);
    };

    const handleLearningJourneySelect = (journeyId: string) => {
        setIsOpen(false);
        setQuery('');
        setSearchCriteria(null);
        setShowCriteria(false);
        // Navigate to manage learning journeys tab
        navigate(`/admin/learning-journeys?tab=manage&journeyId=${journeyId}`);
    };

    const renderResults = () => {
        if (!searchCriteria) return null;

        return (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-500">
                        <span className="material-symbols-rounded animate-spin inline-block">hourglass_empty</span>
                        <p className="text-sm mt-2">Searching...</p>
                    </div>
                ) : searchCriteria === 'users' ? (
                    users.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    onClick={() => handleUserSelect(user.id)}
                                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-primary"
                                >
                                    <div className="flex gap-3 items-center">
                                        <img
                                            src={user.avatarUrl || `https://i.pravatar.cc/150?u=${user.id}`}
                                            alt={user.fullName}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 truncate text-sm">
                                                {user.fullName}
                                            </h4>
                                            <p className="text-xs text-gray-500 truncate">
                                                {user.email}
                                            </p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded capitalize">
                                                    {user.role}
                                                </span>
                                                {user.department && (
                                                    <span className="text-xs text-gray-600 truncate">
                                                        {user.department}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : query.trim() ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No users found for "{query}"
                        </div>
                    ) : null
                ) : (searchCriteria === 'courses' || searchCriteria === 'assignments') ? (
                    courses.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {courses.map((course) => (
                                <div
                                    key={course.id}
                                    onClick={() => searchCriteria === 'assignments' ? handleAssignmentSelect(course.id) : handleCourseSelect(course.id)}
                                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-primary"
                                >
                                    <div className="flex gap-3 items-center">
                                        {course.thumbnail && (
                                            <img
                                                src={course.thumbnail}
                                                alt={course.title}
                                                className="w-10 h-10 rounded object-cover"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 truncate text-sm">
                                                {course.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 truncate">
                                                {course.instructorName}
                                            </p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                                    {course.category}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : query.trim() ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No {searchCriteria} found for "{query}"
                        </div>
                    ) : null
                ) : searchCriteria === 'skills' ? (
                    skills.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {skills.map((skill) => (
                                <div
                                    key={skill.id}
                                    onClick={() => handleSkillSelect(skill.name)}
                                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-primary"
                                >
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {skill.name}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {skill.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : query.trim() ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No skills found for "{query}"
                        </div>
                    ) : null
                ) : searchCriteria === 'learningjourney' ? (
                    learningJourneys.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {learningJourneys.map((journey) => (
                                <div
                                    key={journey.id}
                                    onClick={() => handleLearningJourneySelect(journey.id)}
                                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-primary"
                                >
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {journey.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {journey.description}
                                    </p>
                                    {journey.type && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-2 inline-block">
                                            {journey.type}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : query.trim() ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No learning journeys found for "{query}"
                        </div>
                    ) : null
                ) : searchCriteria === 'careerpath' ? (
                    careerPaths.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {careerPaths.map((cp) => (
                                <div
                                    key={cp.id}
                                    onClick={() => handleCareerPathSelect(cp.id)}
                                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-primary"
                                >
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {cp.name || cp.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {cp.sourceRole} → {cp.targetRole}
                                    </p>
                                    {cp.description && (
                                        <p className="text-xs text-gray-600 mt-1">
                                            {cp.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : query.trim() ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No career paths found for "{query}"
                        </div>
                    ) : null
                ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        Search not available for this criteria yet
                    </div>
                )}
            </div>
        );
    };

    const renderCriteriaDropdown = () => {
        if (!showCriteria) return null;

        return (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {criteriaOptions.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => {
                            setSearchCriteria(option.value);
                            setQuery('');
                            setUsers([]);
                            setCourses([]);
                            setSkills([]);
                            setCareerPaths([]);
                            setLearningJourneys([]);
                            setShowCriteria(false);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                    >
                        <span className="material-symbols-rounded text-base text-gray-500">
                            {option.icon}
                        </span>
                        <div>
                            <p className="text-sm font-medium text-gray-900">{option.label}</p>
                            <p className="text-xs text-gray-500">Search by {option.label.toLowerCase()}</p>
                        </div>
                    </button>
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="relative hidden md:block w-full max-w-2xl" ref={searchRef}>
                {/* Main Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span className="material-symbols-rounded text-gray-400">search</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => {
                            if (!searchCriteria) {
                                setShowCriteria(true);
                                setIsOpen(false);
                            } else if (query.trim()) {
                                setIsOpen(true);
                            }
                        }}
                        className="flex-1 bg-transparent border-none text-sm text-gray-900 placeholder-gray-500 focus:outline-none"
                        placeholder={searchCriteria ? `Search ${currentCriteriaLabel?.toLowerCase()}...` : 'Start typing to search...'}
                    />
                    {searchCriteria && (
                        <button
                            onClick={() => {
                                setSearchCriteria(null);
                                setQuery('');
                                setUsers([]);
                                setCourses([]);
                                setSkills([]);
                                setCareerPaths([]);
                                setLearningJourneys([]);
                                setIsOpen(false);
                                setShowCriteria(false);
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="Clear search"
                        >
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    )}
                    {query && searchCriteria && (
                        <button
                            onClick={() => {
                                setQuery('');
                                setUsers([]);
                                setCourses([]);
                                setSkills([]);
                                setCareerPaths([]);
                                setLearningJourneys([]);
                                setIsOpen(false);
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="Clear query"
                        >
                            <span className="material-symbols-rounded text-base">backspace</span>
                        </button>
                    )}
                </div>

                {/* Criteria Dropdown */}
                {renderCriteriaDropdown()}

                {/* Search Results Dropdown */}
                {isOpen && searchCriteria && renderResults()}
            </div>

            {/* User Report Card Modal */}
            {selectedUserId && (
                <UserReportCard
                    userId={selectedUserId}
                    isOpen={!!selectedUserId}
                    onClose={() => setSelectedUserId(null)}
                />
            )}
        </>
    );
};

export default AdminSearchBar;
