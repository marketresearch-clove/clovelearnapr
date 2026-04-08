import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
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
    manager_id: string | null;
    manager_name?: string;
    linkedin_profile_url?: string;
}

interface HierarchyNode {
    user: UserProfile;
    level: number;
    children: HierarchyNode[];
}

// Grade to Level Mapping
const GRADE_LEVEL_MAP: Record<string, { level: number; roleTitle: string }> = {
    'T': { level: 1, roleTitle: 'Trainee' },
    'T1': { level: 1, roleTitle: 'Trainee' },
    'E': { level: 2, roleTitle: 'Executive' },
    'E1': { level: 2, roleTitle: 'Executive' },
    'E2': { level: 2, roleTitle: 'Executive' },
    'E3': { level: 2, roleTitle: 'Executive' },
    'L': { level: 3, roleTitle: 'Lead' },
    'L1': { level: 3, roleTitle: 'Lead' },
    'L2': { level: 3, roleTitle: 'Lead' },
    'L3': { level: 3, roleTitle: 'Lead' },
    'M': { level: 4, roleTitle: 'Manager' },
    'M1': { level: 4, roleTitle: 'Manager' },
    'M2': { level: 4, roleTitle: 'Manager' },
    'M3': { level: 4, roleTitle: 'Manager' },
    'M4': { level: 4, roleTitle: 'Manager' },
    'G': { level: 5, roleTitle: 'Head' },
    'G1': { level: 5, roleTitle: 'Head' },
    'G2': { level: 5, roleTitle: 'Head' },
    'V': { level: 6, roleTitle: 'Vice President' },
    'V1': { level: 6, roleTitle: 'Vice President' },
    'V2': { level: 6, roleTitle: 'Vice President' },
    'V3': { level: 6, roleTitle: 'Vice President' },
    'C': { level: 7, roleTitle: 'Chief Officer' },
    'C1': { level: 7, roleTitle: 'Chief Officer' },
    'C2': { level: 7, roleTitle: 'Chief Officer' },
};

const getGradeLevel = (grade: string): number => GRADE_LEVEL_MAP[grade]?.level || 0;
const getRoleTitle = (grade: string): string => GRADE_LEVEL_MAP[grade]?.roleTitle || 'Employee';

const GRADE_ORDER = ['T', 'E1', 'E2', 'E3', 'L1', 'L2', 'L3', 'M1', 'M2', 'M3', 'G1', 'G2', 'V1', 'V2', 'V3', 'C1', 'C2'];
const getGradeOrderIndex = (grade: string) => {
    const normalized = grade?.toUpperCase?.();
    const exactIndex = GRADE_ORDER.indexOf(normalized);
    if (exactIndex !== -1) return exactIndex;

    const prefix = normalized?.match(/^[A-Z]+/)?.[0] || normalized;
    const fallbackIndex = GRADE_ORDER.findIndex(item => item.startsWith(prefix));
    return fallbackIndex !== -1 ? fallbackIndex : GRADE_ORDER.length;
};

const compareByGradeOrder = (a: string, b: string) => {
    return getGradeOrderIndex(a) - getGradeOrderIndex(b);
};

const normalizeName = (value?: string | null) =>
    value?.trim().toLowerCase() || '';

const resolveManagerId = (profile: UserProfile, profileByName: Map<string, string>) => {
    if (profile.manager_id) return profile.manager_id;
    const normalizedManagerName = normalizeName(profile.manager_name);
    if (!normalizedManagerName) return null;
    return profileByName.get(normalizedManagerName) || null;
};

interface HierarchyData {
    currentUser: UserProfile;
    manager: UserProfile | null;
    peers: UserProfile[];
    allPeers: UserProfile[];
    directReports: UserProfile[];
    departments: string[];
    allGrades: string[];
    allOtherDeptProfiles: UserProfile[];
    allProfiles: UserProfile[];
}

const getGradeColor = (grade: string) => {
    const gradeMap: { [key: string]: string } = {
        'L1': 'bg-blue-600', 'L2': 'bg-blue-500', 'L3': 'bg-blue-400',
        'E1': 'bg-indigo-600', 'E2': 'bg-indigo-500', 'E3': 'bg-indigo-400',
        'C1': 'bg-green-600', 'C2': 'bg-green-500',
        'D1': 'bg-orange-600', 'D2': 'bg-orange-500', 'D3': 'bg-orange-400',
        'G1': 'bg-pink-600', 'G2': 'bg-pink-500',
        'H1': 'bg-indigo-600', 'M1': 'bg-cyan-600', 'M2': 'bg-cyan-500',
        'M3': 'bg-cyan-400', 'M4': 'bg-cyan-300',
        'T1': 'bg-amber-600', 'V1': 'bg-rose-600', 'V2': 'bg-rose-500', 'V3': 'bg-rose-400',
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

// Build hierarchical tree based on manager relationships
// Always returns a single unified tree starting from the top-level person
const buildHierarchyTree = (allProfiles: UserProfile[], selectedDept: string, selectedGrade: string): HierarchyNode[] => {
    if (allProfiles.length === 0) return [];

    const profileByName = new Map<string, string>();
    allProfiles.forEach(profile => {
        const normalized = normalizeName(profile.fullname || `${profile.first_name || ''} ${profile.last_name || ''}`);
        if (normalized && !profileByName.has(normalized)) {
            profileByName.set(normalized, profile.id);
        }
    });

    const resolveManagerKey = (profile: UserProfile) => resolveManagerId(profile, profileByName);

    // 1. Filter based on department
    let filteredProfiles = allProfiles;
    if (selectedDept !== 'All') {
        // Include dept members AND their chain of managers up to the root
        const deptMembers = allProfiles.filter(p => p.department === selectedDept);
        const managerIds = new Set<string>();
        const queue = [...deptMembers];

        while (queue.length > 0) {
            const person = queue.shift();
            const managerId = person ? resolveManagerKey(person) : null;
            if (managerId && !managerIds.has(managerId)) {
                managerIds.add(managerId);
                const manager = allProfiles.find(p => p.id === managerId);
                if (manager) queue.push(manager);
            }
        }

        const uniqueProfiles = new Map<string, UserProfile>();
        [...deptMembers, ...allProfiles.filter(p => managerIds.has(p.id))].forEach(profile => {
            uniqueProfiles.set(profile.id, profile);
        });
        filteredProfiles = Array.from(uniqueProfiles.values());
    }

    // 2. Grade filter - only if specified
    if (selectedGrade !== 'All') {
        filteredProfiles = filteredProfiles.filter(p => p.employee_grade === selectedGrade);
    }

    // 3. Build manager->reports map from filtered profiles
    const reportsByManager = new Map<string, UserProfile[]>();
    filteredProfiles.forEach(profile => {
        const managerId = resolveManagerKey(profile);
        if (managerId) {
            if (!reportsByManager.has(managerId)) {
                reportsByManager.set(managerId, []);
            }
            reportsByManager.get(managerId)!.push(profile);
        }
    });

    // 4. Recursively build tree
    const buildNodeTree = (user: UserProfile, visited = new Set<string>()): HierarchyNode => {
        if (visited.has(user.id)) {
            return { user, level: getGradeLevel(user.employee_grade), children: [] };
        }

        visited.add(user.id);
        const reports = reportsByManager.get(user.id) || [];
        const sortedReports = reports.sort((a, b) =>
            compareByGradeOrder(b.employee_grade) - compareByGradeOrder(a.employee_grade) ||
            (a.department || '').localeCompare(b.department || '') ||
            (a.fullname || '').localeCompare(b.fullname || '')
        );

        return {
            user,
            level: getGradeLevel(user.employee_grade),
            children: sortedReports.map(r => buildNodeTree(r, new Set(visited)))
        };
    };

    // 4.5 Cache resolved manager IDs so root detection uses the same resolution
    const resolvedManagerByProfile = new Map<string, string | null>();
    const getResolvedManagerId = (profile: UserProfile) => {
        if (resolvedManagerByProfile.has(profile.id)) return resolvedManagerByProfile.get(profile.id)!;
        const managerId = resolveManagerKey(profile);
        resolvedManagerByProfile.set(profile.id, managerId);
        return managerId;
    };

    // 5. Find all roots (people with no manager in filtered profiles)
    const rootPeople = filteredProfiles.filter(p => {
        const managerId = getResolvedManagerId(p);
        if (!managerId) return true;
        return !filteredProfiles.some(f => f.id === managerId);
    });

    if (rootPeople.length === 0) return [];

    // 6. Build a tree for each root so the full organization chart is shown
    return rootPeople
        .sort((a, b) =>
            compareByGradeOrder(b.employee_grade) - compareByGradeOrder(a.employee_grade) ||
            (a.department || '').localeCompare(b.department || '') ||
            (a.fullname || '').localeCompare(b.fullname || '')
        )
        .map(root => buildNodeTree(root));
};

const UserCard: React.FC<{ user: UserProfile; isHighlighted?: boolean; size?: 'large' | 'medium' | 'small'; onDeselect?: () => void }> = ({
    user, isHighlighted = false, size = 'medium', onDeselect
}) => {
    const cardW = { large: 224, medium: 192, small: 176 }[size];
    const imgSize = { large: 'w-14 h-14', medium: 'w-12 h-12', small: 'w-10 h-10' }[size];
    const nameSz = { large: 'text-base font-bold', medium: 'text-sm font-bold', small: 'text-xs font-bold' }[size];
    const titleSz = { large: 'text-xs', medium: 'text-[10px]', small: 'text-[9px]' }[size];

    const handleLinkedInClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (user.linkedin_profile_url) window.open(user.linkedin_profile_url, '_blank');
    };

    return (
        <div
            className={`group cursor-pointer transition-all duration-300 relative ${isHighlighted
                ? 'bg-white shadow-2xl shadow-blue-600/10 border-2 border-blue-600 ring-8 ring-blue-600/5'
                : 'bg-white shadow-xl shadow-slate-900/5 hover:scale-105 border border-transparent hover:border-blue-600/20'
                }`}
            style={{ borderRadius: '15px', width: cardW, padding: size === 'large' ? '12px' : size === 'medium' ? '10px' : '8px', flexShrink: 0 }}
        >
            {isHighlighted && onDeselect && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeselect();
                    }}
                    title="Deselect user"
                    style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 16,
                        padding: 0,
                        zIndex: 10,
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#991b1b'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                </button>
            )}
            <div className="flex items-start justify-between mb-2">
                <div className="relative">
                    {user.avatar_url || user.avatarurl ? (
                        <img
                            src={(user.avatar_url || user.avatarurl) as string}
                            alt={user.fullname || `${user.first_name} ${user.last_name}`}
                            className={`${imgSize} object-cover shadow-md ${!isHighlighted ? 'grayscale group-hover:grayscale-0 transition-all' : ''}`}
                            style={{ borderRadius: '15px' }}
                        />
                    ) : (
                        <div
                            className={`${imgSize} flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md ${!isHighlighted ? 'grayscale group-hover:grayscale-0 transition-all' : ''}`}
                            style={{ borderRadius: '15px' }}
                        >
                            {getInitials(user.first_name, user.last_name, user.fullname)}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 leading-none">
                    {user.employee_grade && (
                        <span
                            style={{
                                backgroundColor: isHighlighted ? '#2563eb' : '#f1f5f9',
                                color: isHighlighted ? '#ffffff' : '#64748b',
                                fontSize: '9px',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                borderRadius: '6px',
                                padding: '2px 5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: '2',
                                whiteSpace: 'nowrap',
                                minWidth: '20px'
                            }}
                        >
                            {user.employee_grade}
                        </span>
                    )}

                    {user.linkedin_profile_url ? (
                        <button
                            onClick={handleLinkedInClick}
                            style={{
                                color: isHighlighted ? '#2563eb' : '#94a3b8',
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '2px 4px',
                                lineHeight: '1',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: 'pointer'
                            }}
                            title="View LinkedIn Profile"
                        >
                            in
                        </button>
                    ) : (
                        <span
                            style={{
                                color: isHighlighted ? '#dbeafe' : '#94a3b8',
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '2px 4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            in
                        </span>
                    )}
                </div>
            </div>
            <h3 className={`${nameSz} text-slate-900 line-clamp-2`}>
                {user.fullname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User'}
            </h3>
            <p className={`${titleSz} ${isHighlighted ? 'text-blue-600 font-bold' : 'text-slate-500 font-medium'} line-clamp-1`}>
                {isHighlighted ? 'Current / ' : ''}{user.designation || user.job_title || 'Team Member'}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                <div>
                    <p className="text-[8px] uppercase font-bold text-slate-400 tracking-tighter">Dept</p>
                    <p className="text-[10px] font-semibold text-slate-700 truncate">{user.department || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-[8px] uppercase font-bold text-slate-400 tracking-tighter">Status</p>
                    <p className="text-[10px] font-semibold text-emerald-600">Active</p>
                </div>
            </div>
        </div>
    );
};

const TreeConnector: React.FC<{
    xs: number[];
    width: number;
    parentX: number;
    label?: string;
    height?: number;
    childDepts?: string[];
}> = ({ xs, width, parentX, label, height: propHeight, childDepts }) => {
    // Filter out NaN values and clamp small rounding errors around the container edges
    const clampX = (x: number) => Math.max(0, Math.min(width, x));
    const validXs = xs
        .filter(x => !isNaN(x) && x >= -2 && x <= width + 2)
        .map(clampX);

    if (!width || parentX === undefined || parentX === null || validXs.length === 0) {
        return <div style={{ height: `${propHeight ?? 52}px` }} />;
    }

    // Determine if we show dept labels
    const uniqueDepts = childDepts
        ? Array.from(new Set(childDepts.filter(Boolean)))
        : [];
    const showDeptLabels = uniqueDepts.length > 1 && childDepts?.length === xs.length;
    const height = propHeight ?? (showDeptLabels ? 72 : 52);

    const minX = Math.min(...validXs);
    const maxX = Math.max(...validXs);
    const midY = Math.round(height / 2);
    const color = '#4f46e5';
    const lineWidth = 2.5;

    // Calculate dept groups for labeling
    const deptGroups: { dept: string; xs: number[] }[] = [];
    if (showDeptLabels && childDepts) {
        // Group consecutive children by department
        const indexed: { x: number; dept: string }[] = [];
        validXs.forEach((x, vIdx) => {
            // Find which original index this valid x corresponds to
            let originalIdx = -1;
            let count = 0;
            for (let i = 0; i < xs.length; i++) {
                if (!isNaN(xs[i]) && xs[i] >= 0 && xs[i] <= width) {
                    if (count === vIdx) {
                        originalIdx = i;
                        break;
                    }
                    count++;
                }
            }
            if (originalIdx >= 0 && childDepts[originalIdx]) {
                indexed.push({ x, dept: childDepts[originalIdx] });
            }
        });

        let i = 0;
        while (i < indexed.length) {
            const dept = indexed[i].dept;
            const groupXs = [indexed[i].x];
            let j = i + 1;
            while (j < indexed.length && indexed[j].dept === dept) {
                groupXs.push(indexed[j].x);
                j++;
            }
            deptGroups.push({ dept, xs: groupXs });
            i = j;
        }
    }

    return (
        <svg
            width={width}
            height={height}
            style={{
                display: 'block',
                flexShrink: 0,
                overflow: 'visible',
                backfaceVisibility: 'hidden'
            }}
            className="pointer-events-none"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            vectorEffect="non-scaling-stroke"
        >
            {/* Vertical line from parent down to midpoint */}
            {parentX !== undefined && (
                <line
                    x1={parentX}
                    y1={0}
                    x2={parentX}
                    y2={midY}
                    stroke={color}
                    strokeWidth={lineWidth}
                    strokeLinecap="round"
                />
            )}

            {/* Horizontal line connecting all children (if more than 1) */}
            {validXs.length > 1 && (
                <line
                    x1={minX}
                    y1={midY}
                    x2={maxX}
                    y2={midY}
                    stroke={color}
                    strokeWidth={lineWidth}
                    strokeLinecap="round"
                />
            )}

            {/* Vertical lines down to each child */}
            {validXs.map((x, i) => (
                <line
                    key={`child-${i}`}
                    x1={x}
                    y1={validXs.length === 1 ? 0 : midY}
                    x2={x}
                    y2={height}
                    stroke={color}
                    strokeWidth={lineWidth}
                    strokeLinecap="round"
                />
            ))}

            {/* Department labels (one per dept group) */}
            {showDeptLabels && deptGroups.length > 0 &&
                deptGroups.map(({ dept, xs: groupXs }, idx) => {
                    const midX = groupXs.reduce((a, b) => a + b, 0) / groupXs.length;
                    const labelW = Math.max(dept.length * 6.5 + 16, 55);
                    return (
                        <g key={`dept-${idx}`}>
                            <rect
                                x={midX - labelW / 2}
                                y={midY - 10}
                                width={labelW}
                                height={20}
                                fill="white"
                                rx={8}
                                stroke="#c7d2fe"
                                strokeWidth="1"
                            />
                            <text
                                x={midX}
                                y={midY + 4}
                                textAnchor="middle"
                                fontSize="7.5"
                                fontWeight="bold"
                                fill={color}
                                letterSpacing="0.6"
                            >
                                {dept.toUpperCase()}
                            </text>
                        </g>
                    );
                })
            }

            {/* Center label (when no dept labels and multiple children) */}
            {label && !showDeptLabels && validXs.length > 1 && (
                <g>
                    <rect
                        x={(minX + maxX) / 2 - 54}
                        y={midY - 10}
                        width={108}
                        height={20}
                        fill="white"
                        rx={9}
                        stroke="#e0e7ff"
                        strokeWidth="1"
                    />
                    <text
                        x={(minX + maxX) / 2}
                        y={midY + 4}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="bold"
                        fill={color}
                        letterSpacing="0.8"
                    >
                        {label.toUpperCase()}
                    </text>
                </g>
            )}
        </svg>
    );
};

// Render hierarchical tree recursively with reliable DOM-measured connectors
const HierarchyTreeNode: React.FC<{ node: HierarchyNode; isRoot?: boolean; currentUserId?: string; highlightedUserId?: string | null; onDeselect?: () => void }> = ({
    node,
    isRoot = false,
    currentUserId,
    highlightedUserId,
    onDeselect
}) => {
    const isCurrentUser = node.user.id === currentUserId;
    const levelInfo = GRADE_LEVEL_MAP[node.user.employee_grade];

    const childrenContainerRef = useRef<HTMLDivElement>(null);
    const childWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [childXs, setChildXs] = useState<number[]>([]);
    const [containerWidth, setContainerWidth] = useState(0);
    const measureRequestRef = useRef<number | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const measurePositions = useCallback(() => {
        if (!childrenContainerRef.current) return;

        const xs: number[] = [];
        childWrapperRefs.current.forEach(ref => {
            if (ref) {
                // offsetLeft is relative to offset parent, not viewport
                // This works correctly even when parent has CSS transforms (zoom/scale)
                const childCenterX = ref.offsetLeft + ref.offsetWidth / 2;
                xs.push(childCenterX);
            }
        });

        // Calculate container width based on actual child positions with padding
        // This ensures SVG lines extend far enough to connect all cards
        const containerElement = childrenContainerRef.current;
        let calculatedWidth = Math.max(containerElement.offsetWidth, containerElement.scrollWidth);

        if (xs.length > 0) {
            const maxChildX = Math.max(...xs);
            const minChildX = Math.min(...xs);
            const contentWidth = maxChildX - minChildX + 240; // Add more padding on both sides for mobile
            calculatedWidth = Math.max(calculatedWidth, contentWidth);
        }

        // Ensure minimum width for mobile devices
        calculatedWidth = Math.max(calculatedWidth, 400);

        setContainerWidth(calculatedWidth);

        if (xs.length === node.children.length) {
            const same = childXs.length === xs.length && xs.every((value, index) => Math.abs(value - childXs[index]) < 0.5);
            if (!same) {
                setChildXs(xs);
            }
        }
    }, [childXs.length, node.children.length]);

    useLayoutEffect(() => {
        if (!childrenContainerRef.current) return;

        const observe = () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }

            const observer = new ResizeObserver(() => {
                if (measureRequestRef.current) {
                    cancelAnimationFrame(measureRequestRef.current);
                }
                measureRequestRef.current = requestAnimationFrame(measurePositions);
            });

            resizeObserverRef.current = observer;
            observer.observe(childrenContainerRef.current);
            childWrapperRefs.current.forEach(el => { if (el) observer.observe(el); });
        };

        const timer = window.setTimeout(() => {
            measurePositions();
            observe();
        }, 50);

        return () => {
            window.clearTimeout(timer);
            if (measureRequestRef.current) {
                cancelAnimationFrame(measureRequestRef.current);
            }
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }
        };
    }, [measurePositions, node.children]);

    // Sort children by department > grade > name for consistent layout
    const sortedChildren = useMemo(() => {
        return [...node.children].sort((a, b) =>
            compareByGradeOrder(b.user.employee_grade) - compareByGradeOrder(a.user.employee_grade) ||
            (a.user.department || '').localeCompare(b.user.department || '') ||
            (a.user.fullname || '').localeCompare(b.user.fullname || '')
        );
    }, [node.children]);

    // Compute child departments for multi-dept labeling
    const childDepts = sortedChildren.map(c => c.user.department || '');
    const uniqueChildDepts = new Set(childDepts.filter(Boolean));
    const hasMultipleDepts = uniqueChildDepts.size > 1;

    // Generate fallback child positions (evenly distributed)
    const fallbackChildXs = sortedChildren.map((_, i) =>
        ((i + 0.5) / sortedChildren.length) * (containerWidth || 800)
    );

    // Use measured positions if available, otherwise fallback
    const effectiveChildXs = childXs.length === sortedChildren.length
        ? childXs
        : fallbackChildXs;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, overflow: 'visible' }}>
            {/* User Card and Role Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', maxWidth: '280px' }}>
                <UserCard
                    user={node.user}
                    isHighlighted={isCurrentUser || node.user.id === highlightedUserId}
                    size={isRoot ? 'large' : 'medium'}
                    onDeselect={node.user.id === highlightedUserId ? onDeselect : undefined}
                />
                {levelInfo && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#4f46e5',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        background: 'white',
                        border: '1px solid #e0e7ff',
                        borderRadius: 12,
                        padding: '3px 10px',
                        lineHeight: '3',
                        marginTop: '5px',
                        height: 'auto',
                        minHeight: '25px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%'
                    }}>
                        {levelInfo.roleTitle} ({node.user.employee_grade})
                    </div>
                )}
            </div>

            {/* Children Connector and Layout */}
            {sortedChildren.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'fit-content', minWidth: '100%', overflow: 'visible' }}>
                    {/* Connector SVG */}
                    <TreeConnector
                        xs={effectiveChildXs}
                        width={Math.max(containerWidth, 400) || 800}
                        parentX={Math.max(containerWidth, 400) ? Math.max(containerWidth, 400) / 2 : 400}
                        childDepts={hasMultipleDepts ? childDepts : undefined}
                    />

                    {/* Children Container */}
                    <div
                        ref={childrenContainerRef}
                        className="hierarchy-tree-wrapper"
                        style={{
                            display: 'flex',
                            gap: 24,
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            position: 'relative',
                            flexWrap: 'nowrap',
                            width: 'fit-content',
                            minWidth: '100%',
                            minHeight: '1px', // Ensure container is measurable
                            overflow: 'visible',
                            backfaceVisibility: 'hidden',
                            WebkitFontSmoothing: 'antialiased'
                        }}
                    >
                        {sortedChildren.map((child, i) => (
                            <div
                                key={child.user.id}
                                ref={el => { childWrapperRefs.current[i] = el; }}
                                className="hierarchy-card-wrapper"
                                style={{ flexShrink: 0 }}
                            >
                                <HierarchyTreeNode
                                    node={child}
                                    currentUserId={currentUserId}
                                    highlightedUserId={highlightedUserId}
                                    onDeselect={onDeselect}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const OrganizationHierarchy: React.FC<{ userId: string }> = ({ userId }) => {
    const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedGrade, setSelectedGrade] = useState('All');
    const [zoom, setZoom] = useState(0.9);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [searchInput, setSearchInput] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);

    const viewportRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchDropdownRef = useRef<HTMLDivElement>(null);
    const pinchDistanceRef = useRef<number | null>(null);

    useEffect(() => {
        fetchHierarchyData();
    }, [userId]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY * 0.002;
        setZoom(prev => Math.max(0.2, Math.min(3, prev - delta)));
    };

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

    const handleMouseUp = () => setIsPanning(false);

    // Helper function to calculate distance between two touch points
    const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // Two-finger pinch zoom
            e.preventDefault();
            pinchDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
            setIsPanning(false);
        } else if (e.touches.length === 1) {
            // Single-finger pan
            pinchDistanceRef.current = null;
            setIsPanning(true);
            setPanStart({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchDistanceRef.current !== null) {
            // Two-finger pinch zoom
            e.preventDefault();
            const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
            const distanceDelta = currentDistance - pinchDistanceRef.current;

            // Scale zoom based on distance change (0.005 is sensitivity factor)
            setZoom(prev => Math.max(0.2, Math.min(3, prev + distanceDelta * 0.005)));

            // Update pinch distance for next move event
            pinchDistanceRef.current = currentDistance;
        } else if (isPanning && e.touches.length === 1) {
            // Single-finger pan
            e.preventDefault();
            setPanX(e.touches[0].clientX - panStart.x);
            setPanY(e.touches[0].clientY - panStart.y);
        }
    };

    const handleTouchEnd = () => {
        setIsPanning(false);
        pinchDistanceRef.current = null;
    };

    const resetZoomPan = () => { setZoom(0.9); setPanX(0); setPanY(0); };

    const exportPdfSinglePage = async () => {
        if (!canvasRef.current || !viewportRef.current) return;

        try {
            // Save current zoom/pan state
            const savedZoom = zoom;
            const savedPanX = panX;
            const savedPanY = panY;
            const savedCanvasStyle = canvasRef.current.style.cssText;

            // Temporarily set zoom/pan to 1/0 for export
            setZoom(1);
            setPanX(0);
            setPanY(0);

            // Wait for state update and DOM to settle
            await new Promise(resolve => setTimeout(resolve, 400));

            // Measure actual content bounds
            const canvas = canvasRef.current;
            const children = canvas.querySelectorAll('[style*="flex"]');
            let maxRight = 0;
            let maxBottom = 0;

            // Find the rightmost and bottommost content
            children.forEach(child => {
                const rect = (child as HTMLElement).getBoundingClientRect();
                const relativeRight = rect.right - canvas.getBoundingClientRect().left;
                const relativeBottom = rect.bottom - canvas.getBoundingClientRect().top;
                maxRight = Math.max(maxRight, relativeRight);
                maxBottom = Math.max(maxBottom, relativeBottom);
            });

            // Get content dimensions with generous padding
            const contentPadding = 140; // Extra padding on all sides (120px + 20px buffer for text overflow)
            const contentWidth = Math.max(maxRight + contentPadding, canvas.scrollWidth || canvas.offsetWidth || 2000);
            const contentHeight = Math.max(maxBottom + contentPadding, canvas.scrollHeight || canvas.offsetHeight || 3000);

            // Calculate export dimensions - no restrictive minimums
            const exportWidth = Math.max(contentWidth, 2000);
            const exportHeight = Math.max(contentHeight, 2000);

            // Capture the canvas as high-quality image
            const canvasImage = await html2canvas(canvasRef.current, {
                backgroundColor: '#f9fafb',
                scale: 4, // Balanced quality and file size
                useCORS: true,
                allowTaint: true,
                logging: false,
                windowHeight: exportHeight + 300,
                windowWidth: exportWidth + 300,
                imageTimeout: 0, // Prevent timeout on images
                ignoreElements: (el: Element) => {
                    // Don't ignore any elements - we want everything
                    return false;
                },
                onclone: (clonedDoc) => {
                    // Find the canvas element and ensure it has proper dimensions
                    const clonedCanvas = clonedDoc.querySelector('[data-export="canvas"]') as HTMLElement;

                    if (clonedCanvas) {
                        // Remove transforms for export
                        clonedCanvas.style.transform = 'none';
                        clonedCanvas.style.transition = 'none';
                        clonedCanvas.style.animation = 'none';
                        clonedCanvas.style.cursor = 'default';
                        clonedCanvas.style.userSelect = 'auto';
                        clonedCanvas.style.touchAction = 'auto';
                        clonedCanvas.style.position = 'relative';
                        clonedCanvas.style.overflow = 'visible';
                        clonedCanvas.style.width = 'fit-content';
                        clonedCanvas.style.minWidth = 'auto';
                        clonedCanvas.style.height = 'auto';
                        clonedCanvas.style.minHeight = 'auto';
                        clonedCanvas.style.display = 'flex';
                        clonedCanvas.style.flexDirection = 'column';
                        clonedCanvas.style.alignItems = 'center';
                    }

                    // Remove all transitions and animations
                    const allElements = clonedDoc.querySelectorAll('*');
                    allElements.forEach((el) => {
                        const htmlEl = el as HTMLElement;
                        htmlEl.style.transition = 'none !important';
                        htmlEl.style.animation = 'none !important';
                    });

                    // Ensure SVG elements are visible and properly rendered
                    const svgs = clonedDoc.querySelectorAll('svg');
                    svgs.forEach(svg => {
                        svg.style.overflow = 'visible';
                        svg.style.display = 'block';
                        svg.setAttribute('preserveAspectRatio', 'none');
                    });

                    // Force visibility on all nested elements
                    allElements.forEach((el) => {
                        const htmlEl = el as HTMLElement;
                        htmlEl.style.visibility = 'visible';
                        htmlEl.style.opacity = '1';
                        htmlEl.style.display = htmlEl.style.display === 'none' ? 'block' : htmlEl.style.display;

                        // Ensure overflow is visible for text content
                        htmlEl.style.overflow = 'visible';
                        htmlEl.style.textOverflow = 'clip';
                        htmlEl.style.whiteSpace = 'normal';
                    });
                }
            });

            // Convert canvas to blob and download as PNG image
            canvasImage.toBlob((blob) => {
                if (!blob) {
                    alert('Failed to generate image. Please try again.');
                    // Restore state
                    setZoom(savedZoom);
                    setPanX(savedPanX);
                    setPanY(savedPanY);
                    return;
                }

                // Create download link
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;

                // Create filename with filters applied
                const deptLabel = selectedDept !== 'All' ? ` - ${selectedDept}` : '';
                const gradeLabel = selectedGrade !== 'All' ? ` - ${selectedGrade}` : '';
                const timestamp = new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }).replace(/\s+/g, '-');

                link.download = `Organization_Hierarchy${deptLabel}${gradeLabel} (${timestamp}).png`;

                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Cleanup object URL
                URL.revokeObjectURL(url);

                // Restore original zoom/pan state
                setZoom(savedZoom);
                setPanX(savedPanX);
                setPanY(savedPanY);
            }, 'image/png');
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export image. Please try again.');
            // Restore zoom/pan on error
            setZoom(savedZoom);
            setPanX(savedPanX);
            setPanY(savedPanY);
        }
    };

    const handleSearch = useCallback((query: string) => {
        setSearchInput(query);
        if (!hierarchyData || query.trim().length === 0) {
            setSearchResults([]);
            setShowSearchResults(false);
            setHighlightedUserId(null); // Clear highlighted user when search is cleared
            return;
        }

        const lowerQuery = query.toLowerCase();
        const results = hierarchyData.allProfiles.filter(user =>
            (user.fullname?.toLowerCase().includes(lowerQuery)) ||
            (user.first_name?.toLowerCase().includes(lowerQuery)) ||
            (user.last_name?.toLowerCase().includes(lowerQuery)) ||
            (user.email?.toLowerCase().includes(lowerQuery)) ||
            (user.department?.toLowerCase().includes(lowerQuery)) ||
            (user.job_title?.toLowerCase().includes(lowerQuery))
        );

        setSearchResults(results.slice(0, 8)); // Limit to 8 results
        setShowSearchResults(true);
    }, [hierarchyData]);

    const handleSelectSearchUser = (user: UserProfile) => {
        setHighlightedUserId(user.id);
        setSearchInput(user.fullname || `${user.first_name} ${user.last_name}`);
        setShowSearchResults(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                searchDropdownRef.current &&
                !searchDropdownRef.current.contains(e.target as Node) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(e.target as Node)
            ) {
                setShowSearchResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchHierarchyData = async () => {
        try {
            setLoading(true);
            setError(null);

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

            // Fetch manager by ID if manager_id exists
            if (currentUser.manager_id) {
                try {
                    const { data: managerData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', currentUser.manager_id)
                        .single();
                    if (managerData) manager = managerData;
                } catch (err) {
                    console.warn('Manager lookup failed');
                }

                // Fetch all peers (people with same manager)
                try {
                    const { data: allPeersData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('manager_id', currentUser.manager_id)
                        .neq('id', userId)
                        .order('department', { ascending: true })
                        .order('employee_grade', { ascending: true })
                        .order('fullname', { ascending: true });
                    if (allPeersData) {
                        allPeers = allPeersData;
                        peers = allPeersData.filter(p => p.department === currentUser.department);
                    }
                } catch (err) {
                    console.warn('Peers lookup failed:', err);
                }
            }

            // Fetch direct reports by manager_id
            try {
                const { data: reportsData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('manager_id', currentUser.id)
                    .order('employee_grade', { ascending: true })
                    .order('fullname', { ascending: true });
                if (reportsData) directReports = reportsData;
            } catch (err) {
                console.warn('Direct reports lookup failed:', err);
            }

            // Fetch all unique departments from entire database
            const { data: allProfilesData } = await supabase
                .from('profiles')
                .select('*');

            const departments = Array.from(new Set(allProfilesData?.map(p => p.department).filter(Boolean) as string[])).sort();
            const allGrades = Array.from(new Set(allProfilesData?.map(p => p.employee_grade).filter(Boolean) as string[])).sort();

            // Fetch ALL people from other departments
            let allOtherDeptProfiles: UserProfile[] = [];
            try {
                const { data: otherDeptData } = await supabase
                    .from('profiles')
                    .select('*')
                    .neq('department', currentUser.department)
                    .order('department', { ascending: true })
                    .order('fullname', { ascending: true });
                if (otherDeptData) allOtherDeptProfiles = otherDeptData;
            } catch (err) {
                console.warn('Failed to fetch all other dept profiles:', err);
            }

            setHierarchyData({
                currentUser,
                manager,
                peers,
                allPeers,
                directReports,
                departments,
                allGrades,
                allOtherDeptProfiles,
                allProfiles: allProfilesData || []
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch hierarchy data');
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

    // Calculate organization statistics from the hierarchy tree
    const { currentUser, departments, allGrades, allProfiles } = hierarchyData;

    // Build hierarchical tree based on selected filters
    const hierarchyTrees = buildHierarchyTree(allProfiles, selectedDept, selectedGrade);

    const countTreeNodes = (node: HierarchyNode): number => {
        return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
    };

    const findUserInTrees = (trees: HierarchyNode[], userId: string): HierarchyNode | null => {
        for (const tree of trees) {
            if (tree.user.id === userId) return tree;
            const found = findUserInTrees(tree.children, userId);
            if (found) return found;
        }
        return null;
    };

    const currentUserNode = hierarchyTrees.length > 0 ? findUserInTrees(hierarchyTrees, currentUser.id) : null;
    const totalOrgSize = hierarchyTrees.reduce((sum, tree) => sum + countTreeNodes(tree), 0);
    const currentUserReports = currentUserNode ? currentUserNode.children.length : 0;
    const currentUserLevel = currentUserNode ? currentUserNode.level : 0;
    const levelInfo = GRADE_LEVEL_MAP[currentUser.employee_grade];

    // Calculate team count (people in the same department)
    const calculateTeamCount = (): number => {
        if (!hierarchyData) return 0;
        // Count all profiles in the same department as current user
        const teamMembers = hierarchyData.allProfiles.filter(p => p.department === currentUser.department);
        return teamMembers.length;
    };

    const currentUserTeamCount = calculateTeamCount();

    const dropdownStyle: React.CSSProperties = {
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #e2e8f0',
        fontSize: 12,
        fontWeight: 600,
        color: '#334155',
        padding: '6px 32px 6px 14px',
        appearance: 'none' as const,
        WebkitAppearance: 'none' as const,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        outline: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpolygon points='0,0 10,0 5,6' fill='%23666'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        backgroundSize: '10px 6px',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, width: '100%', boxSizing: 'border-box' }}>
            {/* Canvas Viewport */}
            <div
                ref={viewportRef}
                className="canvas-viewport"
                style={{
                    position: 'relative',
                    width: '100%',
                    height: 620,
                    background: '#e8ecf0',
                    border: '1px solid #cbd5e1',
                    borderRadius: 15,
                    overflow: 'auto',
                    boxSizing: 'border-box',
                }}
            >
                {/* Filter Bar — fixed inside viewport, not transformed */}
                <div
                    style={{
                        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                        padding: '12px 14px', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start', pointerEvents: 'none',
                        background: 'linear-gradient(to bottom, rgba(232,236,240,0.95) 60%, transparent)',
                    }}
                >
                    {/* Left: filter dropdowns + search */}
                    <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto', alignItems: 'center', position: 'relative' }}>
                        <select
                            value={selectedDept}
                            onChange={e => setSelectedDept(e.target.value)}
                            style={dropdownStyle}
                        >
                            <option value="All">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                        <select
                            value={selectedGrade}
                            onChange={e => setSelectedGrade(e.target.value)}
                            style={dropdownStyle}
                        >
                            <option value="All">All Grades</option>
                            {allGrades.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>

                        {/* Search Bar */}
                        <div style={{ position: 'relative', zIndex: 20 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                borderRadius: '20px',
                                background: 'rgba(255,255,255,0.95)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                paddingRight: 8,
                                overflow: 'visible'
                            }}>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search user..."
                                    value={searchInput}
                                    onChange={e => handleSearch(e.target.value)}
                                    onFocus={() => searchInput.trim().length > 0 && setShowSearchResults(true)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: '#334155',
                                        padding: '6px 12px',
                                        outline: 'none',
                                        minWidth: 140,
                                    }}
                                />
                                {searchInput.trim().length > 0 || highlightedUserId ? (
                                    <button
                                        title="Clear search and deselect user"
                                        onClick={() => {
                                            setSearchInput('');
                                            setHighlightedUserId(null);
                                            setSearchResults([]);
                                            setShowSearchResults(false);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px 2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: '#94a3b8',
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#475569'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                    >
                                        <span className="material-symbols-rounded" style={{ fontSize: 16, flexShrink: 0 }}>close</span>
                                    </button>
                                ) : (
                                    <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#94a3b8', flexShrink: 0 }}>search</span>
                                )}
                            </div>

                            {/* Search Results Dropdown */}
                            {showSearchResults && searchResults.length > 0 && (
                                <div
                                    ref={searchDropdownRef}
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: 4,
                                        background: 'rgba(255,255,255,0.98)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 12,
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                        maxHeight: 320,
                                        overflowY: 'auto',
                                        zIndex: 30,
                                        minWidth: 280,
                                    }}
                                >
                                    {searchResults.map(user => (
                                        <div
                                            key={user.id}
                                            onClick={() => handleSelectSearchUser(user)}
                                            style={{
                                                padding: '10px 12px',
                                                borderBottom: '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.15s',
                                                backgroundColor: user.id === highlightedUserId ? '#eff6ff' : 'transparent'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = user.id === highlightedUserId ? '#eff6ff' : 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 10,
                                                    background: 'linear-gradient(to br, #2563eb, #1e40af)',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    flexShrink: 0
                                                }}>
                                                    {getInitials(user.first_name, user.last_name, user.fullname)}
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', margin: '0 0 2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        {user.fullname || `${user.first_name} ${user.last_name}`}
                                                    </p>
                                                    <p style={{ fontSize: 9, color: '#64748b', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        {user.designation || user.job_title || 'Team Member'} • {user.department || 'N/A'}
                                                    </p>
                                                </div>
                                                {user.id === highlightedUserId && (
                                                    <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#2563eb', flexShrink: 0 }}>check_circle</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: zoom controls + hint */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'auto' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 2,
                            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
                            border: '1px solid #e2e8f0', borderRadius: 15, padding: '4px 6px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                        }}>
                            <button
                                title="Zoom Out"
                                onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}
                                style={{ padding: '2px 4px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center' }}
                            >
                                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>zoom_out</span>
                            </button>
                            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: 'center', color: '#334155' }}>
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                title="Zoom In"
                                onClick={() => setZoom(z => Math.min(3, z + 0.15))}
                                style={{ padding: '2px 4px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center' }}
                            >
                                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>zoom_in</span>
                            </button>
                            <div style={{ width: 1, height: 16, background: '#e2e8f0', margin: '0 2px' }} />
                            <button
                                title="Reset View"
                                onClick={resetZoomPan}
                                style={{ padding: '2px 4px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center' }}
                            >
                                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>fit_screen</span>
                            </button>
                        </div>
                        <p style={{
                            fontSize: 9, fontWeight: 700, color: '#64748b',
                            background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(226,232,240,0.6)', borderRadius: 10,
                            padding: '3px 8px', margin: 0
                        }}>
                            💡 <span className="hidden sm:inline">Left-click + drag to pan | Mouse wheel to zoom</span><span className="sm:hidden">Drag to pan | Pinch to zoom</span> | 🔄 Reset
                        </p>
                    </div>
                </div>

                {/* Dot grid background */}
                <div
                    style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                        backgroundImage: 'radial-gradient(#0053db18 1px, transparent 1px)',
                        backgroundSize: '24px 24px'
                    }}
                />

                {/* Pannable / Zoomable Canvas Content */}
                <div
                    ref={canvasRef}
                    data-export="canvas"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        width: '100%',
                        minHeight: '100%',
                        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                        transformOrigin: 'center top',
                        transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                        cursor: isPanning ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        touchAction: 'none',
                        zIndex: 10,
                        paddingTop: 72,
                        paddingBottom: 48,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        overflow: 'visible',
                    }}
                >
                    {/* Single Organization Tree View */}
                    {hierarchyTrees.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 24px', width: '100%', boxSizing: 'border-box' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#cbd5e1' }}>account_tree</span>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0 }}>No hierarchy data available</p>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Try adjusting filters or selecting a different user</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', padding: '24px 0', boxSizing: 'border-box' }}>
                            {hierarchyTrees.map(tree => (
                                <div key={tree.user.id} style={{ flex: '1 1 0', minWidth: 320 }}>
                                    <HierarchyTreeNode
                                        node={tree}
                                        isRoot
                                        currentUserId={currentUser.id}
                                        highlightedUserId={highlightedUserId}
                                        onDeselect={() => {
                                            setHighlightedUserId(null);
                                            setSearchInput('');
                                            setSearchResults([]);
                                            setShowSearchResults(false);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bento Grid - Responsive Layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 16,
                width: '100%',
                boxSizing: 'border-box'
            }} className="organization-overview-bento">
                <div style={{ background: '#f8fafc', padding: '16px 12px', border: '1px solid #f1f5f9', borderRadius: 15 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, color: '#0f172a', margin: '0 0 16px' }}>Organization Overview</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        {[
                            { label: 'Organization Size', value: totalOrgSize, sub: 'Total Members' },
                            { label: 'Your Department', value: currentUser.department || 'N/A', sub: 'Current', small: true },
                            { label: 'Direct Reports', value: currentUserReports, sub: 'reporting to you' },
                            { label: 'Your Team', value: currentUserTeamCount, sub: 'team members' },
                            { label: 'Your Manager', value: currentUser.manager_name || 'No Manager', sub: 'Reporting To', small: true },
                            { label: 'Your Level', value: levelInfo?.roleTitle || 'Employee', sub: `Grade: ${currentUser.employee_grade}`, small: true },
                        ].map(({ label, value, sub, small }) => (
                            <div key={label} style={{ background: 'white', padding: '12px 10px', border: '1px solid #f1f5f9', borderRadius: 15, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px' }}>{label}</p>
                                <p style={{ fontSize: small ? 12 : 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>{value}</p>
                                <p style={{ fontSize: 9, color: '#94a3b8', margin: '2px 0 0' }}>{sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{
                    background: '#2563eb', color: 'white', padding: '20px 16px', borderRadius: 15,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    overflow: 'hidden', position: 'relative',
                    minHeight: 'auto'
                }}>
                    <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.08 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 140 }}>hub</span>
                    </div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px' }}>Export Structure</h3>
                        <p style={{ fontSize: 11, color: '#bfdbfe', lineHeight: 1.5, margin: '0 0 16px' }}>
                            Generate detailed PNG image of your organizational structure with current filters applied.
                        </p>
                    </div>
                    <button
                        onClick={exportPdfSinglePage}
                        style={{
                            position: 'relative', zIndex: 1, width: '100%', background: 'white',
                            color: '#2563eb', padding: '8px 0', fontWeight: 900, fontSize: 10,
                            letterSpacing: 1.5, textTransform: 'uppercase', border: 'none', borderRadius: 15, cursor: 'pointer',
                            transition: 'all 0.2s ease', hover: { opacity: 0.9 }
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        Download PNG
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {hierarchyTrees.length === 0 && (
                <div style={{
                    textAlign: 'center', padding: '40px 24px',
                    background: '#eff6ff', border: '2px dashed #bfdbfe', borderRadius: 15,
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#93c5fd', display: 'block', marginBottom: 8 }}>account_tree</span>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#1e40af', margin: '0 0 4px' }}>No organizational structure found</p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Adjust filters or check if hierarchy relationships are configured.</p>
                </div>
            )}
        </div>
    );
};

export default OrganizationHierarchy;
