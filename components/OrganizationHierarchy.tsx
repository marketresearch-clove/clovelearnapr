import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import '../styles/OrganizationHierarchy.css';

interface UserProfile {
    id: string;
    first_name: string;
    last_name: string;
    fullname: string;
    email: string;
    job_title: string;
    designation: string;
    employee_grade: string;
    department: string;
    office_location: string;
    avatar_url?: string;
    avatarurl?: string;
    role: string;
    manager_id: string;
    manager_name: string;
    linkedin_profile_url?: string;
}

interface HierarchyData {
    currentUser: UserProfile;
    manager: UserProfile | null;
    peers: UserProfile[];
    allPeers: UserProfile[];
    directReports: UserProfile[];
    departments: string[];
}

const getGradeColor = (grade: string) => {
    const gradeMap: { [key: string]: string } = {
        'L1': 'bg-blue-600',
        'L2': 'bg-blue-500',
        'L3': 'bg-blue-400',
        'E1': 'bg-indigo-600',
        'E2': 'bg-indigo-500',
        'E3': 'bg-indigo-400',
        'C1': 'bg-green-600',
        'C2': 'bg-green-500',
        'D1': 'bg-orange-600',
        'D2': 'bg-orange-500',
        'D3': 'bg-orange-400',
        'G1': 'bg-pink-600',
        'G2': 'bg-pink-500',
        'H1': 'bg-indigo-600',
        'M1': 'bg-cyan-600',
        'M2': 'bg-cyan-500',
        'M3': 'bg-cyan-400',
        'M4': 'bg-cyan-300',
        'T1': 'bg-amber-600',
        'V1': 'bg-rose-600',
        'V2': 'bg-rose-500',
        'V3': 'bg-rose-400',
    };
    return gradeMap[grade] || 'bg-slate-400';
};

const getInitials = (firstName: string, lastName: string, fullName?: string) => {
    if (fullName) {
        const parts = fullName.trim().split(' ');
        return `${parts[0]?.charAt(0) || ''}${parts[parts.length - 1]?.charAt(0) || ''}`.toUpperCase();
    }
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
};

const UserCard: React.FC<{ user: UserProfile; isHighlighted?: boolean; size?: 'large' | 'medium' | 'small' }> = ({
    user,
    isHighlighted = false,
    size = 'medium'
}) => {
    const sizeClasses = {
        large: 'w-64 p-4',
        medium: 'w-56 p-3',
        small: 'w-52 p-2.5'
    };

    const imgSizeClasses = {
        large: 'w-16 h-16',
        medium: 'w-14 h-14',
        small: 'w-12 h-12'
    };

    const nameClasses = {
        large: 'text-lg font-bold',
        medium: 'text-base font-bold',
        small: 'text-sm font-bold'
    };

    const titleClasses = {
        large: 'text-sm',
        medium: 'text-xs',
        small: 'text-[10px]'
    };

    const handleLinkedInClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (user.linkedin_profile_url) {
            window.open(user.linkedin_profile_url, '_blank');
        }
    };

    return (
        <div
            className={`group cursor-pointer rounded-3xl transition-all duration-300 ${isHighlighted
                ? 'bg-white p-6 shadow-2xl shadow-blue-600/10 border-2 border-blue-600 ring-8 ring-blue-600/5'
                : 'bg-white p-6 shadow-xl shadow-slate-900/5 hover:scale-105 border border-transparent hover:border-blue-600/20'
                } ${sizeClasses[size] || sizeClasses.medium}`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="relative">
                    {user.avatar_url || user.avatarurl ? (
                        <img
                            src={(user.avatar_url || user.avatarurl) as string}
                            alt={user.fullname || `${user.first_name} ${user.last_name}`}
                            className={`${imgSizeClasses[size]} rounded-2xl object-cover shadow-md ${!isHighlighted ? 'grayscale group-hover:grayscale-0 transition-all' : ''}`}
                        />
                    ) : (
                        <div
                            className={`${imgSizeClasses[size]} rounded-2xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md ${!isHighlighted ? 'grayscale group-hover:grayscale-0 transition-all' : ''}`}
                        >
                            {getInitials(user.first_name, user.last_name, user.fullname)}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {user.employee_grade && (
                        <span
                            className={`${isHighlighted ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'} text-[10px] font-black px-2 py-1 rounded-lg tracking-wider`}
                        >
                            {user.employee_grade}
                        </span>
                    )}
                    {user.linkedin_profile_url && (
                        <button
                            onClick={handleLinkedInClick}
                            className={`${isHighlighted ? 'text-blue-600 hover:text-blue-700' : 'text-slate-400 hover:text-blue-600'} transition-colors cursor-pointer text-base`}
                            title="View LinkedIn Profile"
                        >
                            in
                        </button>
                    )}
                    {!user.linkedin_profile_url && (
                        <span className={`text-base ${isHighlighted ? 'text-blue-300' : 'text-slate-200'}`}>
                            in
                        </span>
                    )}
                </div>
            </div>
            <h3 className={`${nameClasses[size]} text-slate-900`}>
                {user.fullname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User'}
            </h3>
            <p className={`${titleClasses[size]} ${isHighlighted ? 'text-blue-600 font-bold' : 'text-slate-500 font-medium'}`}>
                {isHighlighted ? 'Current Learner / ' : ''}{user.designation || user.job_title || 'Team Member'}
            </p>
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
                <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-tighter">Department</p>
                    <p className={`${size === 'small' ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-700 truncate`}>{user.department || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-tighter">Status</p>
                    <p className={`${size === 'small' ? 'text-[10px]' : 'text-xs'} font-semibold text-emerald-600`}>Active</p>
                </div>
            </div>
        </div>
    );
};

const ReportCard: React.FC<{ report: UserProfile; size?: 'large' | 'medium' | 'small' }> = ({
    report,
    size = 'medium'
}) => {
    const sizeClasses = {
        large: 'w-64 p-4',
        medium: 'w-56 p-3',
        small: 'w-52 p-2.5'
    };

    const imgSizeClasses = {
        large: 'w-12 h-12',
        medium: 'w-12 h-12',
        small: 'w-10 h-10'
    };

    const handleLinkedInClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (report.linkedin_profile_url) {
            window.open(report.linkedin_profile_url, '_blank');
        }
    };

    return (
        <div className={`group cursor-pointer bg-white rounded-2xl shadow-md shadow-slate-900/5 hover:-translate-y-1 transition-all border border-transparent hover:border-blue-600/20 ${sizeClasses[size]}`}>
            <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                    {report.avatar_url || report.avatarurl ? (
                        <img src={(report.avatar_url || report.avatarurl) as string} alt={report.fullname} className={`${imgSizeClasses[size]} rounded-xl object-cover`} />
                    ) : (
                        <div className={`${imgSizeClasses[size]} rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs`}>
                            {getInitials(report.first_name, report.last_name, report.fullname)}
                        </div>
                    )}
                </div>
                <div className="truncate flex-1">
                    <h4 className={`font-bold text-slate-900 truncate ${size === 'small' ? 'text-xs' : 'text-sm'}`}>{report.fullname || `${report.first_name} ${report.last_name}`}</h4>
                    <p className={`text-slate-500 font-medium truncate ${size === 'small' ? 'text-[9px]' : 'text-[10px]'}`}>{report.designation || 'Team Member'}</p>
                    <div className={`mt-1 flex items-center gap-1 text-slate-600 ${size === 'small' ? 'text-[8px]' : 'text-[9px]'}`}>
                        <span className={`${getGradeColor(report.employee_grade)} text-white px-2 py-0.5 rounded font-bold`}>{report.employee_grade}</span>
                        {report.linkedin_profile_url ? (
                            <button
                                onClick={handleLinkedInClick}
                                className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer text-xs ml-1"
                                title="View LinkedIn Profile"
                            >
                                in
                            </button>
                        ) : (
                            <span className="text-slate-200 text-xs ml-1">in</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const OrganizationHierarchy: React.FC<{ userId: string }> = ({ userId }) => {
    const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedGrade, setSelectedGrade] = useState('All');
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const canvasRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchHierarchyData();
    }, [userId]);

    // Zoom — scroll wheel only, no Ctrl required, range 0.3x–3x
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY * 0.002;
        const newZoom = Math.max(0.3, Math.min(3, zoom - delta));
        setZoom(newZoom);
    };

    // Pan — left-click drag, immediate (no hold timer)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPanX(e.clientX - panStart.x);
            setPanY(e.clientY - panStart.y);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    // Touch pan — single finger, all screen sizes
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsPanning(true);
            setPanStart({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isPanning && e.touches.length === 1) {
            e.preventDefault();
            setPanX(e.touches[0].clientX - panStart.x);
            setPanY(e.touches[0].clientY - panStart.y);
        }
    };

    const handleTouchEnd = () => {
        setIsPanning(false);
    };

    const resetZoomPan = () => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
    };

    const fetchHierarchyData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch current user
            const { data: currentUser, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            let manager: UserProfile | null = null;
            let peers: UserProfile[] = [];
            let allPeers: UserProfile[] = [];
            let directReports: UserProfile[] = [];

            // Fetch manager by trying fullname match first
            if (currentUser.manager_name && currentUser.manager_name.trim()) {
                try {
                    const { data: managerData } = await supabase
                        .from('profiles')
                        .select('*')
                        .ilike('fullname', `%${currentUser.manager_name}%`)
                        .limit(1);

                    if (managerData && managerData.length > 0) {
                        manager = managerData[0];
                    }
                } catch (err) {
                    console.warn('Manager lookup failed, will show manager_name as text');
                }

                // Fetch ALL peers (others with same manager_name, regardless of department)
                try {
                    const { data: allPeersData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('manager_name', currentUser.manager_name)
                        .neq('id', userId)
                        .order('department', { ascending: true })
                        .order('employee_grade', { ascending: true })
                        .order('fullname', { ascending: true });

                    if (allPeersData) {
                        allPeers = allPeersData;
                        // Separate same department peers
                        peers = allPeersData.filter(p => p.department === currentUser.department);
                    }
                } catch (err) {
                    console.warn('Peers lookup failed:', err);
                }
            }

            // Fetch direct reports
            try {
                const currentUserFullName = currentUser.fullname || `${currentUser.first_name} ${currentUser.last_name}`.trim();
                const { data: reportsData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('manager_name', currentUserFullName)
                    .order('employee_grade', { ascending: true })
                    .order('fullname', { ascending: true });

                if (reportsData) {
                    directReports = reportsData;
                }
            } catch (err) {
                console.warn('Direct reports lookup failed:', err);
            }

            // Get all unique departments from peers
            const departments = Array.from(new Set(allPeers.map(p => p.department))).sort();

            setHierarchyData({
                currentUser,
                manager,
                peers,
                allPeers,
                directReports,
                departments
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch hierarchy data');
            console.error('Hierarchy fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-600">Loading organizational hierarchy...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl">error</span>
                <div>
                    <p className="font-semibold">Error Loading Hierarchy</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (!hierarchyData) {
        return (
            <div className="text-center py-20">
                <span className="material-symbols-outlined text-6xl text-slate-300 block mb-4">account_tree</span>
                <p className="text-slate-600">No hierarchy data available</p>
            </div>
        );
    }

    const { currentUser, manager, peers, allPeers, directReports, departments } = hierarchyData;

    // Filter peers by grade
    const sameLevelPeers = peers.filter(p =>
        p.employee_grade === currentUser.employee_grade &&
        (selectedGrade === 'All' || p.employee_grade === selectedGrade)
    );
    const differentLevelPeers = peers.filter(p =>
        p.employee_grade !== currentUser.employee_grade &&
        (selectedGrade === 'All' || p.employee_grade === selectedGrade)
    );

    // Get other department peers
    const otherDeptPeers = allPeers.filter(p => p.department !== currentUser.department);

    // Filter other department peers by selected department and grade
    const filteredOtherDeptPeers = otherDeptPeers.filter(p =>
        (selectedDept === 'All' || p.department === selectedDept) &&
        (selectedGrade === 'All' || p.employee_grade === selectedGrade)
    );

    // Group other department peers by department
    const otherDeptsByName = filteredOtherDeptPeers.reduce((acc, peer) => {
        if (!acc[peer.department]) {
            acc[peer.department] = [];
        }
        acc[peer.department].push(peer);
        return acc;
    }, {} as Record<string, UserProfile[]>);

    // Check if hierarchy exists
    const hasPeers = peers.length > 0;
    const hasReports = directReports.length > 0;
    const hasHierarchy = manager || currentUser.manager_name || hasPeers || hasReports;
    const hasSameLevelPeers = sameLevelPeers.length > 0;
    const hasDifferentLevelPeers = differentLevelPeers.length > 0;
    const hasOtherDepts = Object.keys(otherDeptsByName).length > 0;

    return (
        <div className="space-y-12">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-16">

                <div className="flex gap-3">
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="bg-slate-50 border-none rounded-xl text-sm px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-600 shadow-sm"
                    >
                        <option value="All">All Departments</option>
                        {hierarchyData?.departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="bg-slate-50 border-none rounded-xl text-sm px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-600 shadow-sm"
                    >
                        <option>All Grades</option>
                        <option>L1</option>
                        <option>E2</option>
                        <option>E1</option>
                        <option>C1</option>
                        <option>C2</option>
                    </select>
                </div>
            </div>

            {/* Hierarchy Visualization Canvas */}
            <div
                className="bg-slate-50 rounded-2xl border border-slate-100 shadow-sm w-full"
                style={{
                    minHeight: '600px',
                    overflow: 'auto',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                <div
                    ref={canvasRef}
                    className="p-8 md:p-12 flex flex-col items-center justify-start relative select-none touch-none"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                        minHeight: '600px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                {/* Decorative Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0053db 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                {/* Manager Level */}
                <div className="relative z-10 flex flex-col items-center mb-8">
                    {manager ? (
                        <UserCard user={manager} size="large" />
                    ) : currentUser.manager_name ? (
                        <div className="group cursor-pointer bg-white p-6 rounded-3xl w-72 shadow-xl shadow-slate-900/5 hover:scale-105 transition-transform duration-300">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                    {getInitials('', '', currentUser.manager_name)}
                                </div>
                                <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg tracking-wider">Manager</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">{currentUser.manager_name}</h3>
                            <p className="text-sm text-slate-500 font-medium">Reporting Manager</p>
                        </div>
                    ) : null}
                    {hasHierarchy && <div className="w-[2px] h-8 bg-slate-200 mt-2"></div>}
                </div>

                {hasSameLevelPeers && sameLevelPeers.length <= 2 && (
                    <div className="w-full mb-12 flex justify-center px-4">
                        <div
                            className="relative w-full max-w-2xl h-[1.5px]"
                            style={{ background: 'linear-gradient(to right, transparent, #4f46e5, transparent)' }}
                        >
                            {/* Left column connector */}
                            <div
                                className="absolute bottom-0 w-[1.5px] h-12 translate-y-full"
                                style={{ left: '16.66%', background: 'linear-gradient(to top, #4f46e5, rgba(79,70,229,0.3))' }}
                            ></div>
                            {/* Center column connector */}
                            <div
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-12 translate-y-full"
                                style={{ background: 'linear-gradient(to top, #4f46e5, rgba(79,70,229,0.3))' }}
                            ></div>
                            {/* Right column connector */}
                            <div
                                className="absolute bottom-0 w-[1.5px] h-12 translate-y-full"
                                style={{ right: '16.66%', background: 'linear-gradient(to top, #4f46e5, rgba(79,70,229,0.3))' }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Small Team: 3-Column Layout (Up to 2 peers) */}
                {hasSameLevelPeers && sameLevelPeers.length <= 2 && (
                    <div className="w-full mb-12 z-10">
                        <div className="grid grid-cols-3 gap-8 justify-items-center">
                            {/* Left Peer */}
                            <div className="flex justify-center items-start">
                                {sameLevelPeers.length > 0 ? (
                                    <UserCard user={sameLevelPeers[0]} size="medium" />
                                ) : null}
                            </div>

                            {/* Current User - Center (Highlighted) */}
                            <div className="flex justify-center items-start relative">
                                <UserCard user={currentUser} isHighlighted={true} size="large" />
                                {hasReports && <div className="w-[2px] h-12 bg-slate-200 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full"></div>}
                            </div>

                            {/* Right Peer */}
                            <div className="flex justify-center items-start">
                                {sameLevelPeers.length > 1 ? (
                                    <UserCard user={sameLevelPeers[1]} size="medium" />
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}

                {/* Large Team: Grid Layout (3+ peers) */}
                {hasSameLevelPeers && sameLevelPeers.length > 2 && (
                    <div className="w-full mb-12 z-10">
                        <div className="flex justify-center mb-8">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-2 bg-slate-100 rounded-full">
                                {sameLevelPeers.length + 1} Team Members at Your Level
                            </span>
                        </div>
                        <div className="grid grid-cols-5 gap-8 justify-items-center">
                            {/* Map through all peers */}
                            {sameLevelPeers.map((peer) => (
                                <div key={peer.id} className="flex justify-center">
                                    <UserCard
                                        user={peer}
                                        size={sameLevelPeers.length > 10 ? 'small' : 'medium'}
                                    />
                                </div>
                            ))}

                            {/* Current User - Always highlighted and prominent */}
                            <div className="flex justify-center relative">
                                <UserCard user={currentUser} isHighlighted={true} size="large" />
                                {hasReports && <div className="w-[2px] h-12 bg-slate-200 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full"></div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* When no peers, show current user alone */}
                {!hasSameLevelPeers && (
                    <div className="flex justify-center relative mb-12 z-10">
                        <UserCard user={currentUser} isHighlighted={true} size="large" />
                        {hasReports && <div className="w-[2px] h-16 bg-slate-200 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full"></div>}
                    </div>
                )}

                {/* Bottom Level: Direct Reports */}
                {hasReports && (
                    <div className="w-full relative">
                        {directReports.length <= 2 ? (
                            // Small reports team: centered 2-column layout
                            <div className="max-w-4xl mx-auto">
                                <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-slate-200">
                                    <div className="absolute top-0 left-0 w-px h-8 bg-slate-200"></div>
                                    <div className="absolute top-0 right-0 w-px h-8 bg-slate-200"></div>
                                </div>
                                <div className="flex justify-center gap-12 mt-8 z-10 relative flex-wrap">
                                    {directReports.map((report) => (
                                        <ReportCard key={report.id} report={report} size="medium" />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            // Large reports team: grid layout
                            <div>
                                <div className="flex justify-center mb-8">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-2 bg-slate-100 rounded-full">
                                        {directReports.length} Direct Reports
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-8 justify-items-center z-10 relative">
                                    {directReports.map((report) => (
                                        <ReportCard
                                            key={report.id}
                                            report={report}
                                            size={directReports.length > 10 ? 'small' : 'medium'}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Other Department Teams - Show when filter shows different departments */}
                {hasOtherDepts && (
                    <div className="w-full mt-20 z-10">
                        <div className="flex items-center justify-center mb-12 gap-4">
                            <div className="h-[1px] flex-1 bg-slate-200"></div>
                            <h3 className="text-lg font-bold text-slate-700 px-4">Teams in Other Departments</h3>
                            <div className="h-[1px] flex-1 bg-slate-200"></div>
                        </div>
                        <div className="space-y-12">
                            {Object.entries(otherDeptsByName).map(([dept, peersInDept]) => (
                                <div key={dept} className="flex flex-col items-center">
                                    <p className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-8 px-4 py-2 bg-slate-100 rounded-lg">{dept}</p>
                                    <div className="grid grid-cols-5 gap-8 justify-items-center">
                                        {peersInDept.map((peer) => (
                                            <UserCard
                                                key={peer.id}
                                                user={peer}
                                                size={peersInDept.length > 10 ? 'small' : 'medium'}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex justify-center gap-2 mt-8 bg-white rounded-2xl p-4 shadow-md border border-slate-100">
                <button title="Zoom Out (Scroll wheel)" onClick={() => setZoom(Math.max(0.3, zoom - 0.2))} className="p-2 hover:bg-slate-100 rounded-lg transition">
                    <span className="material-symbols-rounded text-sm">zoom_out</span>
                </button>
                <span className="text-sm font-medium px-4 min-w-[80px] text-center">{Math.round(zoom * 100)}%</span>
                <button title="Zoom In (Scroll wheel)" onClick={() => setZoom(Math.min(3, zoom + 0.2))} className="p-2 hover:bg-slate-100 rounded-lg transition">
                    <span className="material-symbols-rounded text-sm">zoom_in</span>
                </button>
                <button title="Reset Zoom & Pan" onClick={resetZoomPan} className="p-2 hover:bg-slate-100 rounded-lg transition">
                    <span className="material-symbols-rounded text-sm">fit_screen</span>
                </button>
            </div>
            <div className="text-xs text-slate-500 text-center mt-2">
                <span>💡 Left-click + drag to pan | Mouse wheel to zoom | 🔄 Reset button available</span>
            </div>


            {/* Bento Grid - Insights & Export */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                    <h3 className="text-xl font-black mb-6 text-slate-900">Hierarchy Insights</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Team Size</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-slate-900">{sameLevelPeers.length + 1}</span>
                                <span className="text-xs text-emerald-600 font-bold pb-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">group</span>
                                    at Level
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Under {currentUser.manager_name || 'Manager'}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Department</p>
                            <p className="text-xl font-black text-slate-900 mt-2">{currentUser.department || 'N/A'}</p>
                            <p className="text-xs text-slate-400 mt-3">Current Assignment</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Reporting Manager</p>
                            <p className="text-lg font-black text-slate-900 mt-2 truncate">{currentUser.manager_name || 'N/A'}</p>
                            <p className="text-xs text-slate-400 mt-3">Direct Report</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Reporting Lines</p>
                            <div className="flex gap-1 mt-4">
                                <div className="h-2 w-1/4 bg-blue-600 rounded-full"></div>
                                <div className="h-2 w-1/3 bg-blue-400 rounded-full"></div>
                                <div className="h-2 w-1/6 bg-slate-200 rounded-full"></div>
                                <div className="h-2 w-1/4 bg-slate-100 rounded-full"></div>
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                                <span>Direct ({directReports.length})</span>
                                <span>Peers ({peers.length})</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-blue-600 text-white rounded-[2rem] p-8 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <span className="material-symbols-outlined text-[12rem]">hub</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-2xl font-black tracking-tight mb-4">Export Structure</h3>
                        <p className="text-blue-100 text-sm leading-relaxed mb-8">Generate a detailed PDF report of the current organizational breakdown including skills and learning paths.</p>
                    </div>
                    <button className="relative z-10 w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-50 transition-colors">
                        Download PDF
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {!manager && !currentUser.manager_name && peers.length === 0 && directReports.length === 0 && (
                <div className="text-center py-12 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200">
                    <span className="material-symbols-outlined text-5xl text-blue-300 block mb-4">account_tree</span>
                    <p className="text-slate-700 font-semibold mb-2">Your organizational structure is incomplete</p>
                    <p className="text-slate-500 text-sm">Contact your administrator to set up manager relationships in User Management.</p>
                </div>
            )}
        </div>
    );
};

export default OrganizationHierarchy;
