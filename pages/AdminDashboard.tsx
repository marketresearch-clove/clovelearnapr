import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import UserStatsCard from '../components/UserStatsCard';
import CompletedLearningHoursCard from '../components/CompletedLearningHoursCard';
import UsersTable from '../components/UsersTable';
import ModulesTable from '../components/ModulesTable';
import useAuthGuard from '../hooks/useAuthGuard';
import { supabase } from '../lib/supabaseClient';
import { timeTrackingService } from '../lib/timeTrackingService'; // ADD THIS IMPORT

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentFilterMetric, setDepartmentFilterMetric] = useState('userCount');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Default section order
  const defaultSectionOrder = [
    'metrics',
    'analytics',
    'engagementSummary',
    'courseCompletion',
    'careerPathMetrics',
    'teamsManaged',
    'topDepartments',
    'coursePopularity',
    'assessmentMetrics',
    'topSkills',
    'usersModules',
    'departmentCompletion'
  ];

  // Card visibility state with default all visible
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('dashboardSections');
    return saved ? JSON.parse(saved) : {
      metrics: true,
      analytics: true,
      engagementSummary: true,
      courseCompletion: true,
      careerPathMetrics: true,
      teamsManaged: true,
      topDepartments: true,
      coursePopularity: true,
      assessmentMetrics: true,
      topSkills: true,
      usersModules: true,
      departmentCompletion: true
    };
  });

  // Card order state
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboardSectionOrder');
    return saved ? JSON.parse(saved) : defaultSectionOrder;
  });

  const [stats, setStats] = useState({
    // Basic metrics
    totalEmployees: 0,
    totalActiveLearners: 0,
    totalLearningHours: 0,
    formattedTotalTime: '0s',
    activeCourses: 0,
    completionRate: 0,
    completedEnrollments: 0,
    totalEnrollments: 0,
    assessmentPassRate: 0,
    certificatesEarned: 0,
    skillCoverage: 0,
    avgCourseRating: 0,
    monthlyGrowth: 0,
    avgSessionTime: 0,
    avgSessionTimeFormatted: '0s',
    topDepartment: '',

    // Career Path metrics
    careerPathsAvailable: 0,
    usersEnrolledInPaths: 0,
    avgPathReadiness: 0,
    usersReadyForPromotion: 0,
    topCareerPath: '',

    // Advanced metrics
    coursePopularity: [] as any[],
    departmentStats: [] as any[],
    topDepartments: [] as any[],
    teamsManagedData: [] as any[],
    topSkills: [] as any[],
  });

  useAuthGuard(['admin', 'instructor']);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const toggleSection = (section: string) => {
    const updated = { ...visibleSections, [section]: !visibleSections[section] };
    setVisibleSections(updated);
    localStorage.setItem('dashboardSections', JSON.stringify(updated));
  };

  const resetToDefaults = () => {
    const defaults = {
      metrics: true,
      analytics: true,
      engagementSummary: true,
      courseCompletion: true,
      careerPathMetrics: true,
      teamsManaged: true,
      topDepartments: true,
      coursePopularity: true,
      assessmentMetrics: true,
      topSkills: true,
      usersModules: true,
      departmentCompletion: true
    };
    setVisibleSections(defaults);
    localStorage.setItem('dashboardSections', JSON.stringify(defaults));

    // Reset order to defaults
    setSectionOrder(defaultSectionOrder);
    localStorage.setItem('dashboardSectionOrder', JSON.stringify(defaultSectionOrder));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: string) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetItem: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetItem) return;

    const draggedIndex = sectionOrder.indexOf(draggedItem);
    const targetIndex = sectionOrder.indexOf(targetItem);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...sectionOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    setSectionOrder(newOrder);
    localStorage.setItem('dashboardSectionOrder', JSON.stringify(newOrder));
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // Helper to get the order index for a section
  const getOrderIndex = (sectionId: string) => {
    const index = sectionOrder.indexOf(sectionId);
    return index === -1 ? 999 : index; // Ensure unknown sections go to the end
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('👨‍💼 AdminDashboard: Starting data fetch...');

      // Global Analytics from RPC function
      const { data: globalData, error: globalError } = await supabase.rpc('get_global_analytics');
      console.log('📊 Global Analytics:', { error: globalError?.message, dataCount: globalData?.length || 0 });

      if (globalError) {
        console.error('❌ get_global_analytics RPC error:', globalError);
        // Don't fail completely - continue with other data
      }

      let globalStats: any = {};
      if (!globalError && globalData && globalData[0]) {
        const d = globalData[0];
        globalStats = {
          totalActiveLearners: d.total_active_learners || 0,
          courseCompletionRate: d.course_completion_rate || 0,
          assessmentPassRate: d.assessment_pass_rate || 0,
          avgLearningHours: d.avg_learning_hours || 0,
          certificatesEarned: d.certificates_earned || 0,
          skillCoverage: d.skill_coverage_pct || 0,
        };
      }

      // Fetch Real-time Active Learners
      const { count: activeCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      // Total Users/Employees
      const { count: totalUsersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      // Total Courses
      const { count: totalCoursesCount } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true });

      // Active Courses (published)
      const { count: activeCoursesCount } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published');

      // Average Course Rating (average of course averages, not individual reviews)
      const { data: courseRatings } = await supabase
        .from('courses')
        .select('averagerating')
        .gt('averagerating', 0);

      const avgRating = courseRatings && courseRatings.length > 0
        ? courseRatings.reduce((sum, c) => sum + (c.averagerating || 0), 0) / courseRatings.length
        : 0;

      // Monthly Growth (new users this month vs last month)
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const { count: thisMonthUsers } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('createdat', thisMonth.toISOString());

      const { count: lastMonthUsers } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('createdat', lastMonth.toISOString())
        .lt('createdat', thisMonth.toISOString());

      const monthlyGrowth = (lastMonthUsers || 0) > 0
        ? (((thisMonthUsers || 0) - (lastMonthUsers || 0)) / (lastMonthUsers || 1)) * 100
        : 0;

      // Fetch total learning hours from enrollments (same source as DashboardPage)
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('userid, hoursspent, completed');

      const totalSeconds = (enrollmentData || []).reduce((sum, record) => {
        // hoursspent is in SECONDS
        return sum + (record.hoursspent || 0);
      }, 0);
      const totalLearningHours = timeTrackingService.secondsToHours(totalSeconds);
      const formattedTotalTime = timeTrackingService.formatSeconds(totalSeconds);

      // Average Session Time (calculate average time per enrollment record)
      const totalSessionRecords = (enrollmentData || []).length;
      const avgSessionTimeSeconds = totalSessionRecords > 0
        ? totalSeconds / totalSessionRecords
        : 0;
      const avgSessionTime = timeTrackingService.secondsToHours(avgSessionTimeSeconds);
      const avgSessionTimeFormatted = timeTrackingService.formatSeconds(avgSessionTimeSeconds);

      // Fetch all enrollments for completion rate and department stats
      const enrollments = enrollmentData;

      console.log('📚 Enrollments fetch:', {
        count: enrollments?.length || 0,
        data: enrollments ? `[${enrollments.slice(0, 2).map(e => `{userid:${e.userid?.slice(0, 8)}...,courseid:${e.courseid?.slice(0, 8)}...}`).join(',')}...]` : 'null'
      });

      const completedEnrollments = (enrollments || []).filter((e: any) => e.completed).length;
      const totalEnrollmentsCount = enrollments?.length || 0;
      const completionRate = totalEnrollmentsCount > 0
        ? Math.round((completedEnrollments / totalEnrollmentsCount) * 100)
        : 0;

      // Fetch course popularity
      const courseCounts = new Map();
      (enrollments || []).forEach((enrollment: any) => {
        courseCounts.set(
          enrollment.courseid,
          (courseCounts.get(enrollment.courseid) || 0) + 1
        );
      });

      const { data: courseDetails, error: coursesError } = await supabase
        .from('courses')
        .select('id, title');

      console.log('🎓 Courses fetch:', {
        error: coursesError?.message,
        count: courseDetails?.length || 0
      });

      const coursePopularity = Array.from(courseCounts.entries())
        .map(([courseId, count]) => {
          const course = (courseDetails || []).find((c: any) => c.id === courseId);
          return {
            title: course?.title || 'Unknown',
            enrollment: count,
            percentage: totalEnrollmentsCount > 0
              ? Math.round((count / totalEnrollmentsCount) * 100)
              : 0,
          };
        })
        .sort((a, b) => b.enrollment - a.enrollment)
        .slice(0, 5);

      // Fetch top skills in organization
      const { data: skillsData, error: skillsError } = await supabase
        .from('skills')
        .select('id, name');

      console.log('🎯 Skills fetch:', {
        error: skillsError?.message,
        count: skillsData?.length || 0
      });

      let topSkills: any[] = [];
      if (skillsData && skillsData.length > 0) {
        // For each skill, get user achievements and calculate stats
        const skillStats = await Promise.all(
          skillsData.map(async (skill: any) => {
            const { data: achievements, error: achievementError } = await supabase
              .from('user_skill_achievements')
              .select('user_id, percentage_achieved')
              .eq('skill_id', skill.id);

            if (achievementError || !achievements) {
              console.warn(`⚠️ Error fetching achievements for skill ${skill.name}:`, achievementError?.message);
              return null;
            }

            // Use percentage_achieved directly (already a percentage 0-100)
            const avgProficiency = achievements.length > 0
              ? Math.round(
                achievements.reduce((sum: number, a: any) => {
                  const percentage = (a.percentage_achieved || 0);
                  return sum + percentage;
                }, 0) / achievements.length
              )
              : 0;

            return {
              id: skill.id,
              name: skill.name,
              proficiency: avgProficiency,
              usersCount: achievements.length
            };
          })
        );

        topSkills = skillStats
          .filter((s: any) => s !== null)
          .sort((a: any, b: any) => b.proficiency - a.proficiency)
          .slice(0, 10);

        console.log('✅ Top Skills calculated:', topSkills);
      }

      // Fetch department-wise stats and top departments
      const { data: deptProfiles, error: deptError } = await supabase
        .from('profiles')
        .select('id, department')
        .not('department', 'is', null);

      console.log('👥 Profiles fetch:', {
        error: deptError?.message,
        count: deptProfiles?.length || 0
      });

      // Fetch user XP data from leaderboard table (source of truth for points)
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard')
        .select('userid, totalpoints');

      if (leaderboardError) {
        console.warn('⚠️ Error fetching leaderboard data:', leaderboardError?.message);
      }
      console.log('📊 Leaderboard data fetched:', leaderboardData?.length || 0, 'records');

      let topDepartments: any[] = [];
      let departmentStats: any[] = [];
      let topDepartment = '';

      if (deptProfiles) {
        // Calculate department metrics
        const deptMetrics: any = {};

        deptProfiles.forEach(profile => {
          const dept = profile.department;
          if (!deptMetrics[dept]) {
            deptMetrics[dept] = {
              department: dept,
              userCount: 0,
              totalXP: 0,
              coursesEnrolled: 0,
              coursesCompleted: 0
            };
          }
          deptMetrics[dept].userCount += 1;
        });

        // Add enrollment data
        enrollments?.forEach(enrollment => {
          const profile = deptProfiles.find(p => p.id === enrollment.userid);
          if (profile) {
            const dept = profile.department;
            deptMetrics[dept].coursesEnrolled += 1;
            if (enrollment.completed) {
              deptMetrics[dept].coursesCompleted += 1;
            }
          }
        });

        // Add XP data from leaderboard table
        (leaderboardData || []).forEach((leaderboardEntry: any) => {
          const profile = deptProfiles.find(p => p.id === leaderboardEntry.userid);
          if (profile) {
            const dept = profile.department;
            deptMetrics[dept].totalXP += leaderboardEntry.totalpoints || 0;
          }
        });

        // Convert to array and sort by courses completed, then by XP (not just user count)
        topDepartments = Object.values(deptMetrics)
          .sort((a: any, b: any) => {
            // Primary sort: courses completed (descending)
            if (b.coursesCompleted !== a.coursesCompleted) {
              return b.coursesCompleted - a.coursesCompleted;
            }
            // Secondary sort: total XP (descending) when courses completed are equal
            return b.totalXP - a.totalXP;
          })
          .slice(0, 10);

        topDepartment = (topDepartments[0] as any)?.department || 'N/A';

        // Department completion stats
        const departmentMap = new Map();
        deptProfiles.forEach((profile: any) => {
          const dept = profile.department || 'Unassigned';
          if (!departmentMap.has(dept)) {
            departmentMap.set(dept, { dept, users: 0, totalEnrollments: 0, completedEnrollments: 0 });
          }
          const current = departmentMap.get(dept);
          current.users += 1;

          // Count enrollments for this user
          const userEnrollments = (enrollments || []).filter(e => e.userid === profile.id);
          current.totalEnrollments += userEnrollments.length;
          current.completedEnrollments += userEnrollments.filter(e => e.completed).length;
        });

        departmentStats = Array.from(departmentMap.values())
          .map(dept => ({
            ...dept,
            progress: dept.totalEnrollments > 0
              ? Math.round((dept.completedEnrollments / dept.totalEnrollments) * 100)
              : 0
          }))
          .sort((a, b) => b.users - a.users)
          .slice(0, 5);
      }

      // Fetch actual certificate count for consistency
      const { count: certificateCount } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true });

      // Fetch career path data using optimized SQL function
      let careerPathsAvailable = 0;
      let usersEnrolledInPaths = 0;
      let avgPathReadiness = 0;
      let usersReadyForPromotion = 0;
      let topCareerPath = '';

      try {
        // Use RPC function for efficient career path analytics
        const { data: cpAnalytics, error: cpError } = await supabase.rpc('get_career_path_analytics');

        if (cpError) {
          console.warn('⚠️ RPC function not available, falling back to view:', cpError?.message);

          // Fallback: Query the view directly
          const { data: viewData, error: viewError } = await supabase
            .from('career_path_development_summary')
            .select('*')
            .single();

          if (!viewError && viewData) {
            careerPathsAvailable = viewData.total_paths_available || 0;
            usersEnrolledInPaths = viewData.users_enrolled_in_paths || 0;
            avgPathReadiness = Math.round(viewData.avg_path_readiness_percentage || 0);
            usersReadyForPromotion = viewData.users_ready_for_promotion || 0;
            topCareerPath = viewData.top_career_path_name || '';

            console.log('✅ Career Path Analytics (View):', {
              careerPathsAvailable,
              usersEnrolledInPaths,
              avgPathReadiness,
              usersReadyForPromotion,
              topCareerPath
            });
          }
        } else if (cpAnalytics && cpAnalytics.length > 0) {
          const stats = cpAnalytics[0];
          careerPathsAvailable = stats.total_paths_available || 0;
          usersEnrolledInPaths = stats.users_enrolled_in_paths || 0;
          avgPathReadiness = Math.round(stats.avg_path_readiness_percentage || 0);
          usersReadyForPromotion = stats.users_ready_for_promotion || 0;
          topCareerPath = stats.top_career_path_name || '';

          console.log('✅ Career Path Analytics (RPC):', {
            careerPathsAvailable,
            usersEnrolledInPaths,
            avgPathReadiness,
            usersReadyForPromotion,
            topCareerPath,
            topPathEnrollments: stats.top_career_path_enrollments
          });
        }
      } catch (error) {
        console.warn('⚠️ Error fetching career path data:', error);
      }

      setStats({
        // Basic metrics
        totalEmployees: totalUsersCount || 0,
        totalActiveLearners: activeCount || globalStats.totalActiveLearners || 0,
        totalLearningHours,
        formattedTotalTime,
        activeCourses: activeCoursesCount || 0,
        completionRate,
        completedEnrollments,
        totalEnrollments: totalEnrollmentsCount,
        assessmentPassRate: globalStats.assessmentPassRate || 0,
        certificatesEarned: certificateCount || globalStats.certificatesEarned || 0,
        skillCoverage: globalStats.skillCoverage || 0,
        avgCourseRating: Math.round(avgRating * 10) / 10,
        monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
        avgSessionTime: Math.round(avgSessionTime * 10) / 10,
        avgSessionTimeFormatted,
        topDepartment,

        // Career Path metrics
        careerPathsAvailable,
        usersEnrolledInPaths,
        avgPathReadiness,
        usersReadyForPromotion,
        topCareerPath,

        // Advanced metrics
        coursePopularity,
        departmentStats,
        topDepartments,
        teamsManagedData: [],
        topSkills,
      });

      console.log('✅ AdminDashboard data fetch complete');
    } catch (error) {
      console.error('❌ Error fetching admin dashboard data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to load dashboard data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Dashboard">

      <div className="flex flex-col gap-8 bg-gray-50">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 flex items-start gap-3" style={{ borderRadius: '15px' }}>
            <span className="material-symbols-rounded text-red-600 text-xl flex-shrink-0 mt-0.5">error</span>
            <div className="flex-1">
              <h4 className="font-bold text-red-900 mb-1">Dashboard Error</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => {
                setError(null);
                fetchDashboardData();
              }}
              className="text-sm font-bold text-red-600 hover:text-red-700 flex-shrink-0 px-3 py-1 hover:bg-red-100 transition-colors"
              style={{ borderRadius: '15px' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-primary animate-spin mb-3" style={{ borderRadius: '50%' }}></div>
              </div>
              <p className="text-gray-600 font-medium">Loading dashboard data...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
            </div>
          </div>
        )}




        {!loading && (
          <>

            {/* Dashboard Customizer Panel */}
            <div className="bg-white border border-gray-100 shadow-sm ml-auto w-fit" style={{ borderRadius: '15px' }}>
              <button
                onClick={() => setShowCustomizer(!showCustomizer)}
                className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-indigo-600 text-sm">tune</span>
                  <span className="font-bold text-sm text-gray-900">Edit Layout</span>
                </div>
                <span className="material-symbols-rounded text-gray-400 text-sm ml-auto" style={{ transform: showCustomizer ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  expand_more
                </span>
              </button>

              {showCustomizer && (
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Toggle Sections</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                      {[
                        { id: 'metrics', label: 'Metric Cards', icon: 'dashboard' },
                        { id: 'analytics', label: 'Analytics', icon: 'pie_chart' },
                        { id: 'engagementSummary', label: 'Engagement Summary', icon: 'show_chart' },
                        { id: 'courseCompletion', label: 'Course Completion', icon: 'trending_up' },
                        { id: 'careerPathMetrics', label: 'Career Paths', icon: 'flag' },
                        { id: 'teamsManaged', label: 'Teams Managed', icon: 'group_work' },
                        { id: 'topDepartments', label: 'Top Departments', icon: 'bar_chart' },
                        { id: 'coursePopularity', label: 'Course Popularity', icon: 'pie_chart' },
                        { id: 'assessmentMetrics', label: 'Assessment Metrics', icon: 'assignment' },
                        { id: 'topSkills', label: 'Top Skills', icon: 'auto_awesome' },
                        { id: 'usersModules', label: 'Users & Modules', icon: 'people' },
                        { id: 'departmentCompletion', label: 'Completion', icon: 'done_all' }
                      ].map(section => (
                        <button
                          key={section.id}
                          onClick={() => toggleSection(section.id)}
                          className={`px-3 py-2 rounded-lg border-2 font-bold text-xs flex items-center gap-2 transition-all ${visibleSections[section.id]
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                            }`}
                        >
                          <span className="material-symbols-rounded text-sm">{section.icon}</span>
                          {section.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                      <span className="material-symbols-rounded text-xs align-middle mr-1">pan_tool</span>
                      Reorder Sections (Drag to arrange)
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {sectionOrder.map((sectionId) => {
                        const section = [
                          { id: 'metrics', label: 'Metric Cards', icon: 'dashboard' },
                          { id: 'analytics', label: 'Analytics', icon: 'pie_chart' },
                          { id: 'engagementSummary', label: 'Engagement Summary', icon: 'show_chart' },
                          { id: 'courseCompletion', label: 'Course Completion', icon: 'trending_up' },
                          { id: 'careerPathMetrics', label: 'Career Paths', icon: 'flag' },
                          { id: 'teamsManaged', label: 'Teams Managed', icon: 'group_work' },
                          { id: 'topDepartments', label: 'Top Departments', icon: 'bar_chart' },
                          { id: 'coursePopularity', label: 'Course Popularity', icon: 'pie_chart' },
                          { id: 'assessmentMetrics', label: 'Assessment Metrics', icon: 'assignment' },
                          { id: 'topSkills', label: 'Top Skills', icon: 'auto_awesome' },
                          { id: 'usersModules', label: 'Users & Modules', icon: 'people' },
                          { id: 'departmentCompletion', label: 'Completion', icon: 'done_all' }
                        ].find(s => s.id === sectionId);

                        if (!section) return null;

                        return (
                          <div
                            key={section.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, section.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, section.id)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 cursor-move transition-all ${draggedItem === section.id
                              ? 'opacity-50 border-indigo-400 bg-indigo-100'
                              : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                              }`}
                          >
                            <span className="material-symbols-rounded text-gray-400 text-sm flex-shrink-0">drag_indicator</span>
                            <span className="material-symbols-rounded text-gray-500 text-sm">{section.icon}</span>
                            <span className="text-xs font-bold text-gray-700 flex-1">{section.label}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${visibleSections[section.id]
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                              }`}>
                              {visibleSections[section.id] ? 'visible' : 'hidden'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 mt-4 pt-4">
                    <button
                      onClick={resetToDefaults}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <span className="material-symbols-rounded text-sm">refresh</span>
                      Reset to Defaults
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Stats Grid */}
            {visibleSections.metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 bg-gray-50" style={{ order: getOrderIndex('metrics') }}>
                {/* Core Metrics */}
                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-blue-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-blue-600 text-lg sm:text-xl">people</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 text-green-600 bg-green-50" style={{ borderRadius: '10px' }}>
                      <span className="material-symbols-rounded text-[10px] sm:text-[12px]">trending_up</span>
                      +{stats.monthlyGrowth}%
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Employees</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.totalEmployees.toLocaleString()}</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-emerald-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-emerald-600 text-lg sm:text-xl">group</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 text-green-600 bg-green-50" style={{ borderRadius: '10px' }}>
                      <span className="material-symbols-rounded text-[10px] sm:text-[12px]">trending_up</span>
                      +5%
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Learners</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.totalActiveLearners.toLocaleString()}</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-indigo-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-indigo-600 text-lg sm:text-xl">schedule</span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Time Learned</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.formattedTotalTime || '0s'}</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-orange-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-orange-600 text-lg sm:text-xl">book</span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Courses</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.activeCourses}</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-green-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-green-600 text-lg sm:text-xl">done_all</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 text-green-600 bg-green-50" style={{ borderRadius: '10px' }}>
                      <span className="material-symbols-rounded text-[10px] sm:text-[12px]">trending_up</span>
                      +2%
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Complete</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.completionRate}%</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-teal-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-teal-600 text-lg sm:text-xl">verified</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 text-green-600 bg-green-50" style={{ borderRadius: '10px' }}>
                      <span className="material-symbols-rounded text-[10px] sm:text-[12px]">trending_up</span>
                      +8%
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Pass Rate</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.assessmentPassRate}%</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-indigo-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-indigo-600 text-lg sm:text-xl">card_giftcard</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 text-green-600 bg-green-50" style={{ borderRadius: '10px' }}>
                      <span className="material-symbols-rounded text-[10px] sm:text-[12px]">trending_up</span>
                      +12
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Certificate</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.certificatesEarned}</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-pink-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-pink-600 text-lg sm:text-xl">radar</span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Skills</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.skillCoverage}%</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-yellow-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-yellow-600 text-lg sm:text-xl">star</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 text-green-600 bg-green-50" style={{ borderRadius: '10px' }}>
                      <span className="material-symbols-rounded text-[10px] sm:text-[12px]">trending_up</span>
                      +0.2
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Rating</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.avgCourseRating}★</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all col-span-2 sm:col-span-1" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-cyan-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-cyan-600 text-lg sm:text-xl">business</span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Top Dept</p>
                  <h3 className="text-xs sm:text-lg font-black text-gray-900 mt-1 truncate">{stats.topDepartment}</h3>
                </div>

                <div className="bg-white p-3 sm:p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all col-span-2 sm:col-span-1" style={{ borderRadius: '15px' }}>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-rose-50" style={{ borderRadius: '12px' }}>
                      <span className="material-symbols-rounded text-rose-600 text-lg sm:text-xl">access_time</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 text-green-600 bg-green-50" style={{ borderRadius: '10px' }}>
                      <span className="material-symbols-rounded text-[10px] sm:text-[12px]">trending_up</span>
                      +0.3h
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Session</p>
                  <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{stats.avgSessionTimeFormatted || '0s'}</h3>
                </div>
              </div>
            )}

            {/* Analytics Cards */}
            {visibleSections.analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ order: getOrderIndex('analytics') }}>
                <div className="bg-white p-6 border border-gray-100 shadow-sm" style={{ borderRadius: '15px' }}>
                  <UserStatsCard />
                </div>
                <div className="bg-white p-6 border border-gray-100 shadow-sm" style={{ borderRadius: '15px' }}>
                  <CompletedLearningHoursCard />
                </div>
              </div>
            )}

            {/* Engagement Summary & Course Completion - 2 Column Layout */}
            {(visibleSections.engagementSummary || visibleSections.courseCompletion) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ order: Math.min(getOrderIndex('engagementSummary'), getOrderIndex('courseCompletion')) }}>
                {/* Engagement Summary Card */}
                {visibleSections.engagementSummary && (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <span className="material-symbols-rounded text-blue-600">show_chart</span>
                          Engagement Metrics
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">Real-time user engagement</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-rounded text-blue-600 text-lg">schedule</span>
                          <div>
                            <p className="text-xs text-gray-600 font-semibold">Avg Session Duration</p>
                            <p className="text-lg font-bold text-gray-900">{stats.avgSessionTimeFormatted || '0s'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-rounded text-indigo-600 text-lg">trending_up</span>
                          <div>
                            <p className="text-xs text-gray-600 font-semibold">Monthly Growth</p>
                            <p className="text-lg font-bold text-gray-900">+{stats.monthlyGrowth || 0}%</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-rounded text-green-600 text-lg">people</span>
                          <div>
                            <p className="text-xs text-gray-600 font-semibold">Active Learners</p>
                            <p className="text-lg font-bold text-gray-900">{stats.totalActiveLearners || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Course Completion Overview */}
                {visibleSections.courseCompletion && (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <span className="material-symbols-rounded text-green-600">pie_chart</span>
                      Course Completion
                    </h4>
                    <div className="flex items-center justify-center h-48 gap-8">
                      <div className="relative w-40 h-40">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-gray-100" strokeWidth="3"></circle>
                          <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-green-500" strokeWidth="3" strokeDasharray={`${stats.completionRate}, 100`}></circle>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-gray-900">{stats.completionRate || 0}%</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Completed</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-green-500"></span>
                          <span className="text-sm text-gray-700 font-medium">
                            Completed: {stats.completedEnrollments} users
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-gray-200"></span>
                          <span className="text-sm text-gray-700 font-medium">
                            In Progress: {stats.totalEnrollments - stats.completedEnrollments} users
                          </span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold mb-2">Total Enrolled</p>
                          <p className="text-xl font-black text-gray-900">{stats.totalEnrollments || 0} users</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assessment Metrics Card */}
            {visibleSections.assessmentMetrics && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm" style={{ order: getOrderIndex('assessmentMetrics') }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="material-symbols-rounded text-amber-600">assignment_turned_in</span>
                      Assessment Performance
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">Test and quiz metrics</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                    <p className="text-xs sm:text-xs text-gray-600 font-semibold mb-2">Pass Rate</p>
                    <p className="text-2xl sm:text-3xl font-black text-amber-600">{stats.assessmentPassRate || 0}%</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 mt-2">Avg Success</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <p className="text-xs sm:text-xs text-gray-600 font-semibold mb-2">Certificates</p>
                    <p className="text-2xl sm:text-3xl font-black text-blue-600">{stats.certificatesEarned || 0}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 mt-2">Earned</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <p className="text-xs sm:text-xs text-gray-600 font-semibold mb-2">Skill Coverage</p>
                    <p className="text-2xl sm:text-3xl font-black text-purple-600">{stats.skillCoverage || 0}%</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 mt-2">Covered</p>
                  </div>
                </div>
              </div>
            )}

            {/* Career Path Metrics Card */}
            {visibleSections.careerPathMetrics && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm" style={{ order: getOrderIndex('careerPathMetrics') }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="material-symbols-rounded text-cyan-600">flag</span>
                      Career Path Development
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">Organizational career growth progress</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Available Paths</p>
                    <p className="text-3xl font-black text-cyan-600">{stats.careerPathsAvailable || 0}</p>
                    <p className="text-[10px] text-gray-500 mt-2">Total paths</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Enrolled Users</p>
                    <p className="text-3xl font-black text-blue-600">{stats.usersEnrolledInPaths || 0}</p>
                    <p className="text-[10px] text-gray-500 mt-2">Active learners</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Avg Readiness</p>
                    <p className="text-3xl font-black text-emerald-600">{stats.avgPathReadiness || 0}%</p>
                    <p className="text-[10px] text-gray-500 mt-2">Development level</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Ready for Promo</p>
                    <p className="text-3xl font-black text-amber-600">{stats.usersReadyForPromotion || 0}</p>
                    <p className="text-[10px] text-gray-500 mt-2">Promotion ready</p>
                  </div>
                </div>
                {stats.topCareerPath && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600 font-semibold mb-2">📈 Most Popular Path</p>
                    <p className="text-sm font-bold text-gray-900 truncate" title={stats.topCareerPath}>
                      {stats.topCareerPath}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Teams & Departments Section - 2 Column Layout */}
            {(visibleSections.teamsManaged || visibleSections.topDepartments) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ order: Math.min(getOrderIndex('teamsManaged'), getOrderIndex('topDepartments')) }}>
                {/* Teams Managed Card */}
                {visibleSections.teamsManaged && (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <span className="material-symbols-rounded text-purple-500">group_work</span>
                          Teams Managed
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">Team sizes across departments</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {stats.departmentStats && stats.departmentStats.length > 0 ? (
                        stats.departmentStats.map((dept: any) => (
                          <div key={dept.dept} className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-900">{dept.dept}</span>
                                <span className="inline-flex items-center px-3 py-1 text-xs font-bold bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                                  {dept.users} Employees
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 rounded-full transition-all duration-1000"
                                  style={{ width: `${Math.min((dept.users / Math.max(...(stats.departmentStats?.map((d: any) => d.users) || [1]), 1)) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-gray-400 text-sm italic py-4">No team data available</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Top Departments Chart - Only show on Executive tab */}
                {visibleSections.topDepartments && (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col gap-4 mb-6">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-rounded text-blue-500">bar_chart</span>
                        Top 10 Departments
                      </h4>
                      <div className="flex bg-gray-100 p-1 rounded-xl w-full flex-wrap gap-1 sm:gap-0">
                        {[
                          { id: 'userCount', label: 'Users' },
                          { id: 'totalXP', label: 'XP' },
                          { id: 'coursesEnrolled', label: 'Enrolled' },
                          { id: 'coursesCompleted', label: 'Completed' }
                        ].map((metric) => (
                          <button
                            key={metric.id}
                            onClick={() => setDepartmentFilterMetric(metric.id)}
                            className={`flex-1 sm:flex-none px-1.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase rounded-xl transition-all ${departmentFilterMetric === metric.id
                              ? 'bg-white text-primary shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                            {metric.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {stats.topDepartments
                        .sort((a: any, b: any) => b[departmentFilterMetric] - a[departmentFilterMetric])
                        .slice(0, 10)
                        .map((dept: any, index: number) => {
                          const maxValue = Math.max(...stats.topDepartments.map((d: any) => d[departmentFilterMetric]));
                          const percentage = maxValue > 0 ? (dept[departmentFilterMetric] / maxValue) * 100 : 0;

                          const getDisplayValue = () => {
                            switch (departmentFilterMetric) {
                              case 'userCount':
                                return `${dept.userCount} users`;
                              case 'totalXP':
                                return `${Math.round(dept.totalXP)} XP`;
                              case 'coursesEnrolled':
                                return `${dept.coursesEnrolled} enrolled`;
                              case 'coursesCompleted':
                                return `${dept.coursesCompleted} completed`;
                              default:
                                return dept.userCount;
                            }
                          };

                          return (
                            <div key={`${dept.department}-${index}`} className="flex items-center gap-4">
                              <div className="w-8 text-sm font-bold text-gray-500">#{index + 1}</div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm font-bold text-gray-900">{dept.department}</span>
                                  <span className="text-sm text-gray-500">{getDisplayValue()}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className="bg-primary h-1.5 rounded-full transition-all duration-1000"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Course Popularity */}
            {visibleSections.coursePopularity && (
              <div className="bg-white p-6 border border-gray-100 shadow-sm" style={{ borderRadius: '15px', order: getOrderIndex('coursePopularity') }}>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Popularity</h3>
                    <p className="text-sm text-gray-500">Top performing courses by enrollment</p>
                  </div>
                  <span className="material-symbols-rounded text-gray-400">trending_up</span>
                </div>
                <div className="space-y-6">
                  {stats.coursePopularity.length > 0 ? (
                    stats.coursePopularity.map((course: any) => (
                      <div key={course.title} className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700 font-semibold truncate max-w-[70%]">{course.title}</span>
                          <span className="text-gray-900 font-bold">{course.percentage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 overflow-hidden" style={{ borderRadius: '15px' }}>
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-700 ease-out"
                            style={{ width: `${course.percentage}%`, borderRadius: '15px' }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400 text-sm italic">
                      No course data available yet
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Top Skills Card */}
            {visibleSections.topSkills && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm" style={{ order: getOrderIndex('topSkills') }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="material-symbols-rounded text-green-500">auto_awesome</span>
                      Top Skills in Organization
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">Most developed skills across workforce</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {stats.topSkills && stats.topSkills.length > 0 ? (
                    stats.topSkills.map((skill: any, index: number) => {
                      const maxProficiency = Math.max(...(stats.topSkills?.map((s: any) => s.proficiency || 0) || [1]), 1);
                      const percentage = maxProficiency > 0 ? (skill.proficiency / maxProficiency) * 100 : 0;

                      return (
                        <div key={skill.name} className="flex items-center gap-4">
                          <div className="w-8 text-sm font-bold text-gray-500">#{index + 1}</div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-bold text-gray-900">{skill.name}</span>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-semibold">
                                  {skill.proficiency || 0}% proficiency
                                </span>
                                <span>{skill.usersCount || 0} users</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 rounded-full transition-all duration-1000"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-gray-400 text-sm italic py-4">No skills data available</p>
                  )}
                </div>
              </div>
            )}

            {/* Users & Modules Section */}
            {visibleSections.usersModules && (
              <div className="shadow-sm border border-gray-100 overflow-hidden" style={{ borderRadius: '15px', order: getOrderIndex('usersModules') }}>
                <div className="bg-white px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100">
                  <div className="flex items-center gap-1 sm:gap-8 overflow-x-auto scrollbar-hide">
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`pb-3 sm:pb-4 px-3 sm:px-4 font-bold text-xs sm:text-sm transition-all relative whitespace-nowrap flex items-center gap-1.5 sm:gap-2 ${activeTab === 'users'
                        ? 'text-indigo-600'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      <span className="material-symbols-rounded text-sm sm:text-base">people</span>
                      <span className="hidden sm:inline">Users</span>
                      <span className="sm:hidden text-[10px]">Users</span>
                      {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" style={{ borderRadius: '15px 15px 0 0' }} />}
                    </button>
                    <button
                      onClick={() => setActiveTab('modules')}
                      className={`pb-3 sm:pb-4 px-3 sm:px-4 font-bold text-xs sm:text-sm transition-all relative whitespace-nowrap flex items-center gap-1.5 sm:gap-2 ${activeTab === 'modules'
                        ? 'text-indigo-600'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      <span className="material-symbols-rounded text-sm sm:text-base">library_books</span>
                      <span className="hidden sm:inline">Modules</span>
                      <span className="sm:hidden text-[10px]">Modules</span>
                      {activeTab === 'modules' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" style={{ borderRadius: '15px 15px 0 0' }} />}
                    </button>
                  </div>
                </div>
                {activeTab === 'users' ? <UsersTable /> : <ModulesTable />}
              </div>
            )}

            {/* Department Completion */}
            {visibleSections.departmentCompletion && (
              <div className="bg-white border border-gray-100 shadow-sm overflow-hidden mb-12" style={{ borderRadius: '15px', order: getOrderIndex('departmentCompletion') }}>
                <div className="p-8 border-b border-gray-50">
                  <h3 className="text-lg font-bold text-gray-900">Completion</h3>
                  <p className="text-sm text-gray-500 mt-1">Detailed breakdown of learning progress across departments</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-8 py-4 text-left text-gray-500 text-xs font-bold uppercase tracking-widest">Department</th>
                        <th className="px-8 py-4 text-left text-gray-500 text-xs font-bold uppercase tracking-widest">Team Size</th>
                        <th className="px-8 py-4 text-left text-gray-500 text-xs font-bold uppercase tracking-widest">Avg. Completion Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stats.departmentStats.length > 0 ? (
                        stats.departmentStats.map((row: any) => (
                          <tr key={row.dept} className="hover:bg-gray-50/30 transition-colors">
                            <td className="px-8 py-5 text-gray-900 font-bold text-sm">{row.dept}</td>
                            <td className="px-8 py-5">
                              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100" style={{ borderRadius: '15px' }}>
                                {row.users} Employees
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="flex-1 max-w-[160px] h-1.5 bg-gray-200 overflow-hidden" style={{ borderRadius: '15px' }}>
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700"
                                    style={{ width: `${row.progress}%`, borderRadius: '15px' }}
                                  />
                                </div>
                                <span className="text-gray-900 font-bold text-sm">{row.progress}%</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-8 py-12 text-gray-400 text-sm text-center italic">
                            No department statistics available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
