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
        large: 'w-56 p-3',
        medium: 'w-48 p-2.5',
        small: 'w-44 p-2'
    };

    const imgSizeClasses = {
        large: 'w-14 h-14',
        medium: 'w-12 h-12',
        small: 'w-10 h-10'
    };

    const nameClasses = {
        large: 'text-base font-bold',
        medium: 'text-sm font-bold',
        small: 'text-xs font-bold'
    };

    const titleClasses = {
        large: 'text-xs',
        medium: 'text-[10px]',
        small: 'text-[9px]'
    };

    const handleLinkedInClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (user.linkedin_profile_url) {
            window.open(user.linkedin_profile_url, '_blank');
        }
    };

    return (
        <div
            className={`group cursor-pointer transition-all duration-300 ${isHighlighted
                ? 'bg-white p-3 shadow-2xl shadow-blue-600/10 border-2 border-blue-600 ring-8 ring-blue-600/5'
                : 'bg-white p-3 shadow-xl shadow-slate-900/5 hover:scale-105 border border-transparent hover:border-blue-600/20'
                } ${sizeClasses[size] || sizeClasses.medium}`}
            style={{ borderRadius: '15px' }}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="relative">
                    {user.avatar_url || user.avatarurl ? (
                        <img
                            src={(user.avatar_url || user.avatarurl) as string}
                            alt={user.fullname || `${user.first_name} ${user.last_name}`}
                            className={`${imgSizeClasses[size]} object-cover shadow-md ${!isHighlighted ? 'grayscale group-hover:grayscale-0 transition-all' : ''}`}
                            style={{ borderRadius: '15px' }}
                        />
                    ) : (
                        <div
                            className={`${imgSizeClasses[size]} flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md ${!isHighlighted ? 'grayscale group-hover:grayscale-0 transition-all' : ''}`}
                            style={{ borderRadius: '15px' }}
                        >
                            {getInitials(user.first_name, user.last_name, user.fullname)}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {user.employee_grade && (
                        <span
                            className={`${isHighlighted ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'} text-[8px] font-black px-1 py-0.5 tracking-wider`}
                            style={{ borderRadius: '15px' }}
                        >
                            {user.employee_grade}
                        </span>
                    )}
                    {user.linkedin_profile_url && (
                        <button
                            onClick={handleLinkedInClick}
                            className={`${isHighlighted ? 'text-blue-600 hover:text-blue-700' : 'text-slate-400 hover:text-blue-600'} transition-colors cursor-pointer text-sm`}
                            title="View LinkedIn Profile"
                        >
                            in
                        </button>
                    )}
                    {!user.linkedin_profile_url && (
                        <span className={`text-sm ${isHighlighted ? 'text-blue-300' : 'text-slate-200'}`}>
                            in
                        </span>
                    )}
                </div>
            </div>
            <h3 className={`${nameClasses[size]} text-slate-900 line-clamp-2`}>
                {user.fullname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User'}
            </h3>
            <p className={`${titleClasses[size]} ${isHighlighted ? 'text-blue-600 font-bold' : 'text-slate-500 font-medium'} line-clamp-1`}>
                {isHighlighted ? 'Current / ' : ''}{user.designation || user.job_title || 'Team Member'}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                <div>
                    <p className="text-[8px] uppercase font-bold text-slate-400 tracking-tighter">Dept</p>
                    <p className={`${size === 'small' ? 'text-[9px]' : 'text-[10px]'} font-semibold text-slate-700 truncate`}>{user.department || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-[8px] uppercase font-bold text-slate-400 tracking-tighter">Status</p>
                    <p className={`${size === 'small' ? 'text-[9px]' : 'text-[10px]'} font-semibold text-emerald-600`}>Active</p>
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
        large: 'w-52 p-2.5',
        medium: 'w-44 p-2',
        small: 'w-40 p-1.5'
    };

    const imgSizeClasses = {
        large: 'w-10 h-10',
        medium: 'w-10 h-10',
        small: 'w-8 h-8'
    };

    const handleLinkedInClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (report.linkedin_profile_url) {
            window.open(report.linkedin_profile_url, '_blank');
        }
    };

    return (
        <div className={`group cursor-pointer bg-white shadow-md shadow-slate-900/5 hover:-translate-y-0.5 transition-all border border-transparent hover:border-blue-600/20 ${sizeClasses[size]}`} style={{ borderRadius: '15px' }}>
            <div className="flex items-start gap-1.5">
                <div className="relative flex-shrink-0">
                    {report.avatar_url || report.avatarurl ? (
                        <img src={(report.avatar_url || report.avatarurl) as string} alt={report.fullname} className={`${imgSizeClasses[size]} object-cover`} style={{ borderRadius: '15px' }} />
                    ) : (
                        <div className={`${imgSizeClasses[size]} bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs`} style={{ borderRadius: '15px' }}>
                            {getInitials(report.first_name, report.last_name, report.fullname)}
                        </div>
                    )}
                </div>
                <div className="truncate flex-1">
                    <h4 className={`font-bold text-slate-900 truncate line-clamp-1 ${size === 'small' ? 'text-xs' : 'text-sm'}`}>{report.fullname || `${report.first_name} ${report.last_name}`}</h4>
                    <p className={`text-slate-500 font-medium truncate line-clamp-1 ${size === 'small' ? 'text-[8px]' : 'text-[9px]'}`}>{report.designation || 'Team Member'}</p>
                    <div className={`mt-0.5 flex items-center gap-0.5 text-slate-600 ${size === 'small' ? 'text-[7px]' : 'text-[8px]'}`}>
                        <span className={`${getGradeColor(report.employee_grade)} text-white px-1 py-0.5 font-bold`} style={{ borderRadius: '15px' }}>{report.employee_grade}</span>
                        {report.linkedin_profile_url ? (
                            <button
                                onClick={handleLinkedInClick}
                                className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer text-xs ml-0.5"
                                title="View LinkedIn Profile"
                            >
                                in
                            </button>
                        ) : (
                            <span className="text-slate-200 text-xs ml-0.5">in</span>
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
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 animate-spin mb-3" style={{ borderRadius: '15px' }}></div>
                    <p className="text-slate-600 text-sm">Loading organizational hierarchy...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 flex items-center gap-2" style={{ borderRadius: '15px' }}>
                <span className="material-symbols-outlined text-lg">error</span>
                <div>
                    <p className="font-semibold text-sm">Error Loading Hierarchy</p>
                    <p className="text-xs">{error}</p>
                </div>
            </div>
        );
    }

    if (!hierarchyData) {
        return (
            <div className="text-center py-16">
                <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">account_tree</span>
                <p className="text-slate-600 text-sm">No hierarchy data available</p>
            </div>
        );
    }

    const { currentUser, manager, peers, allPeers, directReports, departments } = hierarchyData;

    // Filter peers by grade
    const sameLevelPeers = peers.filter(p =>
        p.employee_grade === currentUser.employee_grade &&
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
    const hasOtherDepts = Object.keys(otherDeptsByName).length > 0;

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Hierarchy Visualization Canvas - Exclude from mobile optimization (as requested) */}
            <div
                className="bg-slate-200 border border-slate-300 shadow-sm w-full overflow-auto"
                style={{
                    minHeight: '500px',
                    position: 'relative',
                    zIndex: 1,
                    borderRadius: '15px'
                }}
            >
                {/* Fixed Filter Options and Controls on Top */}
                <div className="sticky top-0 left-0 right-0 z-[60] p-3 sm:p-4 pointer-events-none flex justify-between items-start gap-2 flex-wrap">
                    <div className="flex gap-2 pointer-events-auto flex-wrap">
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="bg-white/90 backdrop-blur-sm border border-slate-200 text-xs sm:text-sm px-2 sm:px-3 py-1.5 pr-7 focus:ring-2 focus:ring-indigo-600 shadow-sm transition-all hover:bg-white"
                            style={{ borderRadius: '15px' }}
                        >
                            <option value="All">All Departments</option>
                            {hierarchyData?.departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                        <select
                            value={selectedGrade}
                            onChange={(e) => setSelectedGrade(e.target.value)}
                            className="bg-white/90 backdrop-blur-sm border border-slate-200 text-xs sm:text-sm px-2 sm:px-3 py-1.5 pr-7 focus:ring-2 focus:ring-indigo-600 shadow-sm transition-all hover:bg-white"
                            style={{ borderRadius: '15px' }}
                        >
                            <option>All Grades</option>
                            <option>L1</option>
                            <option>E2</option>
                            <option>E1</option>
                            <option>C1</option>
                            <option>C2</option>
                        </select>
                    </div>

                    <div className="flex flex-col items-end gap-2 pointer-events-auto">
                        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1.5 shadow-sm border border-slate-200" style={{ borderRadius: '15px' }}>
                            <button title="Zoom Out" onClick={() => setZoom(Math.max(0.3, zoom - 0.2))} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-600">
                                <span className="material-symbols-rounded text-lg sm:text-xl">zoom_out</span>
                            </button>
                            <span className="text-[10px] sm:text-xs font-bold px-1 sm:px-2 min-w-[40px] sm:min-w-[50px] text-center text-slate-700">{Math.round(zoom * 100)}%</span>
                            <button title="Zoom In" onClick={() => setZoom(Math.min(3, zoom + 0.2))} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-600">
                                <span className="material-symbols-rounded text-lg sm:text-xl">zoom_in</span>
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                            <button title="Reset View" onClick={resetZoomPan} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-600">
                                <span className="material-symbols-rounded text-lg sm:text-xl">fit_screen</span>
                            </button>
                        </div>
                        <p className="hidden sm:block text-[9px] font-bold text-slate-500 bg-white/80 backdrop-blur-sm px-2 py-1 border border-slate-200/50 shadow-sm" style={{ borderRadius: '15px' }}>
                            💡 Left-click + drag to pan | Mouse wheel to zoom | 🔄 Reset available
                        </p>
                    </div>
                </div>

                <div
                    ref={canvasRef}
                    className="p-3 sm:p-4 md:p-6 flex flex-col items-center justify-start relative select-none touch-none"
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
                        minHeight: '500px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* Decorative Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0053db 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    {/* Manager Level */}
                    <div className="relative z-10 flex flex-col items-center mb-6">
                        {manager ? (
                            <UserCard user={manager} size="large" />
                        ) : currentUser.manager_name ? (
                            <div className="group cursor-pointer bg-white p-4 w-56 shadow-xl shadow-slate-900/5 hover:scale-105 transition-transform duration-300" style={{ borderRadius: '15px' }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ borderRadius: '15px' }}>
                                        {getInitials('', '', currentUser.manager_name)}
                                    </div>
                                    <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-1.5 py-0.5 tracking-wider" style={{ borderRadius: '15px' }}>Manager</span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900">{currentUser.manager_name}</h3>
                                <p className="text-xs text-slate-500 font-medium">Reporting Manager</p>
                            </div>
                        ) : null}
                        {hasHierarchy && <div className="w-[2px] h-6 bg-indigo-500 mt-1"></div>}
                    </div>

                    {/* Teams Section - Simplified */}
                    {hasSameLevelPeers && (
                        <div className="w-full mb-8 z-10 flex flex-col items-center">
                            {sameLevelPeers.length > 2 && (
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider px-3 py-1.5 bg-white border border-indigo-100 mb-4" style={{ borderRadius: '15px' }}>
                                    {sameLevelPeers.length + 1} Team Members
                                </span>
                            )}
                            <div className="flex justify-center items-start gap-4 flex-wrap">
                                {sameLevelPeers.map((peer) => (
                                    <UserCard key={peer.id} user={peer} size={sameLevelPeers.length > 6 ? 'small' : 'medium'} />
                                ))}
                                <UserCard user={currentUser} isHighlighted={true} size="large" />
                            </div>
                            {hasReports && <div className="w-[2px] h-8 bg-indigo-500 mt-4"></div>}
                        </div>
                    )}

                    {/* No Peers */}
                    {!hasSameLevelPeers && (
                        <div className="flex justify-center mb-8 z-10">
                            <UserCard user={currentUser} isHighlighted={true} size="large" />
                            {hasReports && <div className="w-[2px] h-8 bg-indigo-500 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full"></div>}
                        </div>
                    )}

                    {/* Direct Reports */}
                    {hasReports && (
                        <div className="w-full z-10">
                            {directReports.length > 2 && (
                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider px-3 py-1.5 bg-white border border-emerald-100 mb-4 inline-block" style={{ borderRadius: '15px' }}>
                                    {directReports.length} Direct Reports
                                </span>
                            )}
                            <div className="flex justify-center items-start gap-4 flex-wrap">
                                {directReports.map((report) => (
                                    <ReportCard key={report.id} report={report} size={directReports.length > 6 ? 'small' : 'medium'} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other Departments */}
                    {hasOtherDepts && (
                        <div className="w-full mt-12 z-10">
                            <h3 className="text-sm font-bold text-indigo-900 px-3 py-1.5 bg-indigo-50 border border-indigo-100 mb-6 text-center" style={{ borderRadius: '15px' }}>
                                Other Departments
                            </h3>
                            <div className="space-y-8">
                                {Object.entries(otherDeptsByName).map(([dept, peersInDept]) => (
                                    <div key={dept} className="flex flex-col items-center">
                                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 px-3 py-1.5 bg-white border border-indigo-100" style={{ borderRadius: '15px' }}>{dept}</p>
                                        <div className="flex justify-center items-start gap-4 flex-wrap">
                                            {peersInDept.map((peer) => (
                                                <UserCard key={peer.id} user={peer} size={peersInDept.length > 6 ? 'small' : 'medium'} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bento Grid - Optimized for mobile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-8">
                <div className="md:col-span-2 bg-slate-50 p-5 sm:p-6 border border-slate-100" style={{ borderRadius: '15px' }}>
                    <h3 className="text-lg font-black mb-4 text-slate-900">Hierarchy Insights</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-white p-4 border border-slate-200/50 shadow-sm" style={{ borderRadius: '15px' }}>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Team Size</p>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-black text-slate-900">{sameLevelPeers.length + 1}</span>
                                <span className="text-xs text-emerald-600 font-bold pb-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">group</span>
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">at Your Level</p>
                        </div>
                        <div className="bg-white p-4 border border-slate-200/50 shadow-sm" style={{ borderRadius: '15px' }}>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Department</p>
                            <p className="text-lg font-black text-slate-900">{currentUser.department || 'N/A'}</p>
                            <p className="text-xs text-slate-400 mt-1">Current</p>
                        </div>
                        <div className="bg-white p-4 border border-slate-200/50 shadow-sm" style={{ borderRadius: '15px' }}>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Manager</p>
                            <p className="text-sm font-black text-slate-900 truncate">{currentUser.manager_name || 'N/A'}</p>
                            <p className="text-xs text-slate-400 mt-1">Reports To</p>
                        </div>
                        <div className="bg-white p-4 border border-slate-200/50 shadow-sm" style={{ borderRadius: '15px' }}>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Reports</p>
                            <p className="text-lg font-black text-slate-900">{directReports.length}</p>
                            <p className="text-xs text-slate-400 mt-1">Direct Reports</p>
                        </div>
                    </div>
                </div>
                <div className="bg-blue-600 text-white p-5 sm:p-6 flex flex-col justify-between overflow-hidden relative group" style={{ borderRadius: '15px' }}>
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <span className="material-symbols-outlined text-[10rem]">hub</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-black tracking-tight mb-3">Export Structure</h3>
                        <p className="text-blue-100 text-xs leading-relaxed mb-6">Generate detailed PDF report of your organizational structure.</p>
                    </div>
                    <button className="relative z-10 w-full bg-white text-blue-600 py-2.5 font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-colors" style={{ borderRadius: '15px' }}>
                        Download PDF
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {!manager && !currentUser.manager_name && peers.length === 0 && directReports.length === 0 && (
                <div className="text-center py-10 bg-blue-50 border-2 border-dashed border-blue-200" style={{ borderRadius: '15px' }}>
                    <span className="material-symbols-outlined text-4xl text-blue-300 block mb-2">account_tree</span>
                    <p className="text-slate-700 font-semibold text-sm mb-1">Organizational structure incomplete</p>
                    <p className="text-slate-500 text-xs">Contact admin to set up manager relationships.</p>
                </div>
            )}
        </div>
    );
};

export default OrganizationHierarchy;
