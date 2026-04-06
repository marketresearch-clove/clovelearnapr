import React, { useState, useEffect } from 'react';
import { searchService, UserReportData } from '../lib/searchService';

interface UserReportCardProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
}

type FilterTab = 'all' | 'courses' | 'assignments' | 'skills' | 'careerpath' | 'certificates';

const UserReportCard: React.FC<UserReportCardProps> = ({ userId, isOpen, onClose }) => {
    const [reportData, setReportData] = useState<UserReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchReportData = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await searchService.getUserReportCard(userId);
                if (data) {
                    setReportData(data);
                } else {
                    setError('Failed to load user data');
                }
            } catch (err) {
                console.error('Error fetching report:', err);
                setError('An error occurred while loading user data');
            } finally {
                setLoading(false);
            }
        };

        // Fetch initially only once when the modal opens
        fetchReportData();

        // Don't add auto-refresh interval or focus listeners
        // This was causing excessive API calls and reload issues
        // Users can manually refresh with the refresh button if needed
    }, [userId, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl my-8">
                {/* Header */}
                <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-900">
                    <div className="flex items-center gap-4">
                        {reportData?.profile.avatarUrl && (
                            <img
                                src={reportData.profile.avatarUrl}
                                alt={reportData.profile.fullName}
                                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                            />
                        )}
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {reportData?.profile.fullName}
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400">{reportData?.profile.email}</p>
                            {reportData?.statistics.totalPoints && (
                                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                                    ⭐ {reportData.statistics.totalPoints} XP
                                </p>
                            )}
                            {reportData?.leaderboardRank && (
                                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                    🏆 Leaderboard Rank: #{reportData.leaderboardRank}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setLoading(true);
                                searchService.getUserReportCard(userId).then(data => {
                                    if (data) setReportData(data);
                                    setLoading(false);
                                });
                            }}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Refresh data"
                            disabled={loading}
                        >
                            <span className={`material-symbols-rounded text-gray-900 dark:text-white ${loading ? 'animate-spin' : ''}`}>
                                refresh
                            </span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-rounded text-gray-900 dark:text-white">close</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <span className="material-symbols-rounded animate-spin text-4xl text-primary">
                            hourglass_empty
                        </span>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading report...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </div>
                ) : reportData ? (
                    <React.Fragment key={userId}>
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">
                                    {reportData.completedCourses.length}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Completed Courses
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">
                                    {reportData.enrolledCourses.length}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Enrolled Courses
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">
                                    {reportData.certificates.length}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Certificates
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">
                                    {reportData.pendingAssignments.length}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Pending Tasks
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                                    🔥 {reportData.statistics.currentStreak || 0}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Day Streak
                                </div>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 bg-white dark:bg-gray-900 sticky top-20">
                            {(['all', 'courses', 'assignments', 'skills', 'certificates', 'careerpath'] as const).map(
                                (tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 capitalize ${activeTab === tab
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                    >
                                        {tab === 'careerpath' ? 'Career Path' : tab === 'certificates' ? 'Certificates' : tab}
                                    </button>
                                )
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
                            {/* Courses Section */}
                            {(activeTab === 'all' || activeTab === 'courses') && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-rounded">school</span>
                                        Courses
                                    </h3>

                                    {/* Completed Courses */}
                                    {reportData.completedCourses.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="font-semibold text-green-600 dark:text-green-400 text-sm mb-2">
                                                ✓ Completed ({reportData.completedCourses.length})
                                            </h4>
                                            <div className="space-y-2">
                                                {reportData.completedCourses.map((course) => (
                                                    <div
                                                        key={course.id}
                                                        className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <h5 className="font-medium text-gray-900 dark:text-white">
                                                                    {course.title}
                                                                </h5>
                                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                                    By {course.instructorName} • {course.category}
                                                                </p>
                                                                {course.enrollment.completedAt && (
                                                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                                        Completed:{' '}
                                                                        {new Date(course.enrollment.completedAt).toLocaleDateString()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className="text-green-600 dark:text-green-400 material-symbols-rounded">
                                                                check_circle
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* In-Progress Courses */}
                                    {reportData.enrolledCourses.filter((c) => !c.enrollment.completed).length >
                                        0 && (
                                            <div>
                                                <h4 className="font-semibold text-blue-600 dark:text-blue-400 text-sm mb-2">
                                                    📚 In Progress (
                                                    {reportData.enrolledCourses.filter((c) => !c.enrollment.completed).length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {reportData.enrolledCourses
                                                        .filter((c) => !c.enrollment.completed)
                                                        .map((course) => (
                                                            <div
                                                                key={course.id}
                                                                className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                                                            >
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <h5 className="font-medium text-gray-900 dark:text-white">
                                                                        {course.title}
                                                                    </h5>
                                                                    <span className="text-sm text-blue-600 dark:text-blue-400">
                                                                        {course.enrollment.progress}%
                                                                    </span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                    <div
                                                                        className="bg-blue-500 h-2 rounded-full"
                                                                        style={{ width: `${course.enrollment.progress}%` }}
                                                                    ></div>
                                                                </div>
                                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                                                    {course.enrollment.hoursSpent} hours spent
                                                                </p>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            )}

                            {/* Certificates Section */}
                            {(activeTab === 'all' || activeTab === 'certificates') && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-rounded">workspace_premium</span>
                                        Certificates Earned
                                    </h3>
                                    {reportData.certificates.length > 0 ? (
                                        <div className="space-y-3">
                                            {reportData.certificates.map((certificate) => (
                                                <div
                                                    key={certificate.id}
                                                    className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex items-start gap-4">
                                                        {certificate.course?.thumbnail && (
                                                            <img
                                                                src={certificate.course.thumbnail}
                                                                alt={certificate.course.title}
                                                                className="w-20 h-20 rounded-lg object-cover"
                                                            />
                                                        )}
                                                        <div className="flex-1">
                                                            <h5 className="font-semibold text-gray-900 dark:text-white">
                                                                {certificate.course?.title || 'Certificate'}
                                                            </h5>
                                                            {certificate.course?.category && (
                                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                                    {certificate.course.category}
                                                                </p>
                                                            )}
                                                            {certificate.issuedAt && (
                                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                                                    Issued: {new Date(certificate.issuedAt).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className="text-amber-600 dark:text-amber-400 material-symbols-rounded text-2xl">
                                                            verified
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                                            No certificates earned yet. Complete courses to earn certificates!
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Assignments Section */}
                            {(activeTab === 'all' || activeTab === 'assignments') && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-rounded">assignment</span>
                                        Pending Tasks & Assignments
                                    </h3>
                                    {reportData.pendingAssignments.length > 0 ? (
                                        <div className="space-y-2">
                                            {reportData.pendingAssignments.map((assignment) => (
                                                <div
                                                    key={assignment.id}
                                                    className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <h5 className="font-medium text-gray-900 dark:text-white">
                                                                {assignment.course?.title || 'Assignment'}
                                                            </h5>
                                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                                {assignment.course?.category && `Category: ${assignment.course.category}`}
                                                            </p>
                                                            {assignment.dueDate && (
                                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                                    Due: {new Date(assignment.dueDate).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            {assignment.isMandatory && (
                                                                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded mt-1 inline-block">
                                                                    Mandatory
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-amber-600 dark:text-amber-400 material-symbols-rounded">
                                                            pending
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                                            No pending assignments
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Skills Section */}
                            {(activeTab === 'all' || activeTab === 'skills') && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-rounded">workspace_premium</span>
                                        Skills Achieved
                                    </h3>
                                    {reportData.skills.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {reportData.skills.map((skill) => (
                                                <div
                                                    key={skill.id}
                                                    className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-rounded text-sm">check_circle</span>
                                                    {skill.skills?.name || 'Unknown Skill'}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                                            No skills achieved yet
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Career Paths Section */}
                            {(activeTab === 'all' || activeTab === 'careerpath') && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-rounded">trending_up</span>
                                        Career Paths
                                    </h3>
                                    {reportData.careerPaths.length > 0 ? (
                                        <div className="space-y-3">
                                            {reportData.careerPaths.map((path) => (
                                                <div
                                                    key={path.id}
                                                    className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg"
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex-1">
                                                            <h5 className="font-semibold text-gray-900 dark:text-white">
                                                                {path.sourceRole || path.name}
                                                            </h5>
                                                            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                                <span>→</span>
                                                                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                                                    {path.targetRole || 'Future Position'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                                                {path.progress || 0}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {path.description && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                            {path.description}
                                                        </p>
                                                    )}
                                                    <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                                        <div
                                                            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                                            style={{ width: `${Math.max(path.progress || 0, 2)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                                            No career paths assigned
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-900 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </React.Fragment>
                ) : null}
            </div>
        </div>
    );
};

export default UserReportCard;
