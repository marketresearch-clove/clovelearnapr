import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import UserStatsCard from '../components/UserStatsCard';
import CompletedLearningHoursCard from '../components/CompletedLearningHoursCard';
import UsersTable from '../components/UsersTable';
import ModulesTable from '../components/ModulesTable';
import useAuthGuard from '../hooks/useAuthGuard';
import { supabase } from '../lib/supabaseClient';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    // Basic metrics
    totalEmployees: 0,
    totalActiveLearners: 0,
    totalLearningHours: 0,
    activeCourses: 0,
    completionRate: 0,
    assessmentPassRate: 0,
    certificatesEarned: 0,
    skillCoverage: 0,
    avgCourseRating: 0,
    monthlyGrowth: 0,
    avgSessionTime: 0,
    topDepartment: '',

    // Advanced metrics
    coursePopularity: [] as any[],
    departmentStats: [] as any[],
    topDepartments: [] as any[],
  });

  useAuthGuard(['admin', 'instructor']);

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

      // Fetch total learning hours (convert minutes to hours)
      const { data: learningHours } = await supabase
        .from('learning_hours')
        .select('hoursspent, userid');

      const totalMinutes = (learningHours || []).reduce((sum, record) => sum + (record.hoursspent || 0), 0);
      const totalLearningHours = Math.round(totalMinutes / 60);

      // Average Session Time (calculate average hours per user with learning activity)
      const uniqueUsersWithActivity = new Set((learningHours || []).map((lh: any) => lh.userid));
      const avgSessionTime = uniqueUsersWithActivity.size > 0
        ? (totalMinutes / 60) / uniqueUsersWithActivity.size
        : 0;

      // Fetch all enrollments for completion rate and department stats
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('userid, courseid, completed');

      console.log('📚 Enrollments fetch:', {
        error: enrollmentsError?.message,
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

      // Fetch department-wise stats and top departments
      const { data: deptProfiles, error: deptError } = await supabase
        .from('profiles')
        .select('id, department')
        .not('department', 'is', null);

      console.log('👥 Profiles fetch:', {
        error: deptError?.message,
        count: deptProfiles?.length || 0
      });

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

        // Add XP data (using hours spent as XP proxy)
        learningHours?.forEach(xp => {
          const profile = deptProfiles.find(p => p.id === xp.userid);
          if (profile) {
            const dept = profile.department;
            deptMetrics[dept].totalXP += xp.hoursspent || 0;
          }
        });

        // Convert to array and sort by user count initially
        topDepartments = Object.values(deptMetrics)
          .sort((a: any, b: any) => b.userCount - a.userCount)
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

      setStats({
        // Basic metrics
        totalEmployees: totalUsersCount || 0,
        totalActiveLearners: activeCount || globalStats.totalActiveLearners || 0,
        totalLearningHours,
        activeCourses: activeCoursesCount || 0,
        completionRate,
        assessmentPassRate: globalStats.assessmentPassRate || 0,
        certificatesEarned: certificateCount || globalStats.certificatesEarned || 0,
        skillCoverage: globalStats.skillCoverage || 0,
        avgCourseRating: Math.round(avgRating * 10) / 10,
        monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
        avgSessionTime: Math.round(avgSessionTime * 10) / 10,
        topDepartment,

        // Advanced metrics
        coursePopularity,
        departmentStats,
        topDepartments,
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
    <AdminLayout title="Admin Overview">
      <div className="space-y-8 bg-gray-50">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
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
              className="text-sm font-bold text-red-600 hover:text-red-700 flex-shrink-0 px-3 py-1 hover:bg-red-100 rounded-lg transition-colors"
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
                <div className="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin mb-3"></div>
              </div>
              <p className="text-gray-600 font-medium">Loading dashboard data...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 bg-gray-50">
              {/* Core Metrics */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <span className="material-symbols-rounded text-blue-600">people</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-green-600 bg-green-50">
                    <span className="material-symbols-rounded text-[12px]">trending_up</span>
                    +{stats.monthlyGrowth}%
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Total Employees</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.totalEmployees.toLocaleString()}</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <span className="material-symbols-rounded text-emerald-600">group</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-green-600 bg-green-50">
                    <span className="material-symbols-rounded text-[12px]">trending_up</span>
                    +5%
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Active Learners</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.totalActiveLearners.toLocaleString()}</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-purple-50 rounded-md">
                    <span className="material-symbols-rounded text-purple-600">schedule</span>
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Learning Hours</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.totalLearningHours.toLocaleString()}h</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-orange-50 rounded-md">
                    <span className="material-symbols-rounded text-orange-600">book</span>
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Active Courses</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.activeCourses}</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-50 rounded-md">
                    <span className="material-symbols-rounded text-green-600">done_all</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-green-600 bg-green-50">
                    <span className="material-symbols-rounded text-[12px]">trending_up</span>
                    +2%
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Completion Rate</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.completionRate}%</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-teal-50 rounded-md">
                    <span className="material-symbols-rounded text-teal-600">verified</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-green-600 bg-green-50">
                    <span className="material-symbols-rounded text-[12px]">trending_up</span>
                    +8%
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Pass Rate</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.assessmentPassRate}%</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-indigo-50 rounded-md">
                    <span className="material-symbols-rounded text-indigo-600">card_giftcard</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-green-600 bg-green-50">
                    <span className="material-symbols-rounded text-[12px]">trending_up</span>
                    +12
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Certificates</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.certificatesEarned}</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-pink-50 rounded-md">
                    <span className="material-symbols-rounded text-pink-600">radar</span>
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Skill Coverage</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.skillCoverage}%</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-yellow-50 rounded-md">
                    <span className="material-symbols-rounded text-yellow-600">star</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-green-600 bg-green-50">
                    <span className="material-symbols-rounded text-[12px]">trending_up</span>
                    +0.2
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Avg Rating</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.avgCourseRating}★</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-cyan-50 rounded-md">
                    <span className="material-symbols-rounded text-cyan-600">business</span>
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Top Department</p>
                <h3 className="text-lg font-black text-gray-900 mt-1 truncate">{stats.topDepartment}</h3>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-rose-50 rounded-md">
                    <span className="material-symbols-rounded text-rose-600">access_time</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-green-600 bg-green-50">
                    <span className="material-symbols-rounded text-[12px]">trending_up</span>
                    +0.3h
                  </div>
                </div>
                <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Avg Session</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.avgSessionTime}h</h3>
              </div>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <UserStatsCard />
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <CompletedLearningHoursCard />
              </div>
            </div>

            {/* Top Departments Chart */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-rounded text-blue-500">bar_chart</span>
                  Top 10 Departments
                </h4>
                <div className="text-sm text-gray-500">Ranked by user count</div>
              </div>
              <div className="space-y-3">
                {stats.topDepartments.length > 0 ? (
                  stats.topDepartments.slice(0, 10).map((dept: any, index: number) => {
                    const maxValue = Math.max(...stats.topDepartments.map((d: any) => d.userCount));
                    const percentage = maxValue > 0 ? (dept.userCount / maxValue) * 100 : 0;

                    return (
                      <div key={dept.department} className="flex items-center gap-4">
                        <div className="w-8 text-sm font-bold text-gray-500">#{index + 1}</div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-gray-900">{dept.department}</span>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{dept.userCount} users</span>
                              <span>{Math.round(dept.totalXP)} XP</span>
                              <span>{dept.coursesCompleted}/{dept.coursesEnrolled} courses</span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-gray-400 text-sm italic py-4">No department data available</p>
                )}
              </div>
            </div>

            {/* Course Popularity */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
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
                      <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${course.percentage}%` }}
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

            {/* Users & Modules Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-100">
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-4 px-2 font-bold text-sm transition-all relative ${activeTab === 'users'
                      ? 'text-primary'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    By users
                    {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                  </button>
                  <button
                    onClick={() => setActiveTab('modules')}
                    className={`pb-4 px-2 font-bold text-sm transition-all relative ${activeTab === 'modules'
                      ? 'text-primary'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    By modules
                    {activeTab === 'modules' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                  </button>
                </div>
              </div>
              {activeTab === 'users' ? <UsersTable /> : <ModulesTable />}
            </div>

            {/* Department Completion */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-12">
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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              {row.users} Employees
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="flex-1 max-w-[160px] h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-700"
                                  style={{ width: `${row.progress}%` }}
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
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
