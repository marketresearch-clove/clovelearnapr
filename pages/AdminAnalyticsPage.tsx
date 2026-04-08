import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabaseClient';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';
import { courseService } from '../lib/courseService';
import { RiFileExcel2Line, RiFilePdfLine } from 'react-icons/ri';

const AdminAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(true);
  const [trendFilter, setTrendFilter] = useState('daily');
  const [stats, setStats] = useState<any>({
    totalActiveLearners: 0,
    courseCompletionRate: 0,
    assessmentPassRate: 0,
    avgLearningHours: 0,
    certificatesEarned: 0,
    skillCoverage: 0,
    totalUsers: 0,
    totalCourses: 0,
    avgCourseRating: 0,
    monthlyGrowth: 0,
    topDepartment: '',
    avgSessionTime: 0,
  });
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [engagementMetrics, setEngagementMetrics] = useState<any>({
    avgSessionDuration: 0,
    peakActivityHour: 0,
    engagementQualityScore: 0,
    activeUsersOnline: 0,
    departmentEngagement: []
  });
  const [courseStats, setCourseStats] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any[]>([]);
  const [skillMatrix, setSkillMatrix] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [gapData, setGapData] = useState<any[]>([]);
  const [careerPathData, setCareerPathData] = useState<any[]>([]);
  const [skillAchievements, setSkillAchievements] = useState<any[]>([]);
  const [topDepartments, setTopDepartments] = useState<any[]>([]);
  const [departmentFilterMetric, setDepartmentFilterMetric] = useState('userCount');

  const processedEngagementData = React.useMemo(() => {
    if (!engagementData || engagementData.length === 0) return [];

    if (trendFilter === 'daily') return engagementData.slice(-10);

    // Grouping for weekly/monthly
    const grouped: any = {};
    engagementData.forEach((d: any) => {
      const date = new Date(d.date);
      let key;
      if (trendFilter === 'weekly') {
        const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
        key = firstDay.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      }

      if (!grouped[key]) {
        grouped[key] = { date: key, active_users: 0, lessons_completed: 0, count: 0 };
      }
      grouped[key].active_users += d.active_users;
      grouped[key].lessons_completed += d.lessons_completed;
      grouped[key].count += 1;
    });

    return Object.values(grouped).map((g: any) => ({
      ...g,
      active_users: Math.round(g.active_users / g.count) // Avg for users, sum for lessons might be better but following active_users trend
    }));
  }, [engagementData, trendFilter]);

  const last28DaysData = React.useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = engagementData.find((ed: any) => {
        const edDate = ed.date.includes('T') ? ed.date.split('T')[0] : ed.date;
        return edDate === dateStr;
      });
      data.push(existing || { date: dateStr, active_users: 0, lessons_completed: 0 });
    }
    return data;
  }, [engagementData]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Global Analytics
      try {
        const { data: globalData, error: globalError } = await supabase.rpc('get_global_analytics');
        if (!globalError && globalData && globalData[0]) {
          const d = globalData[0];
          setStats((prev: any) => ({
            ...prev,
            totalActiveLearners: d.total_active_learners || 0,
            courseCompletionRate: d.course_completion_rate || 0,
            assessmentPassRate: d.assessment_pass_rate || 0,
            avgLearningHours: d.avg_learning_hours || 0,
            skillCoverage: d.skill_coverage_pct || 0,
            // Skip certificatesEarned from RPC - will fetch actual count from database
          }));
        }
      } catch (error) {
        console.error('Error fetching global analytics:', error);
      }

      // Fetch Real-time Active Learners
      const { count: activeCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      if (activeCount !== null) {
        setStats((prev: any) => ({ ...prev, totalActiveLearners: activeCount }));
      }

      // Total Users
      const { count: totalUsersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      // Total Courses
      const { count: totalCoursesCount } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true });

      // Average Course Rating (average of course averages, not individual reviews)
      const { data: courseRatings } = await supabase
        .from('courses')
        .select('average_rating')
        .gt('average_rating', 0);

      const avgRating = courseRatings && courseRatings.length > 0
        ? courseRatings.reduce((sum, c) => sum + (c.average_rating || 0), 0) / courseRatings.length
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

      // Top 10 Departments with multiple metrics - fetch ALL profiles
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, department');

      const { data: deptProfiles } = await supabase
        .from('profiles')
        .select('id, department')
        .not('department', 'is', null);

      if (allProfiles && allProfiles.length > 0) {
        // Get enrollment data for courses enrolled and completed
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('userid, completed');

        // Get XP data (assuming XP is stored in user_xp or similar table, using learning_hours as proxy)
        const { data: xpData } = await supabase
          .from('learning_hours')
          .select('userid, hoursspent');

        // Calculate metrics per department - use deptProfiles for department-specific data
        const deptMetrics: any = {};

        deptProfiles?.forEach(profile => {
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
          const profile = deptProfiles?.find(p => p.id === enrollment.userid);
          if (profile) {
            const dept = profile.department;
            deptMetrics[dept].coursesEnrolled += 1;
            if (enrollment.completed) {
              deptMetrics[dept].coursesCompleted += 1;
            }
          }
        });

        // Add XP data (using hours spent as XP proxy)
        xpData?.forEach(xp => {
          const profile = deptProfiles?.find(p => p.id === xp.userid);
          if (profile) {
            const dept = profile.department;
            deptMetrics[dept].totalXP += xp.hoursspent || 0;
          }
        });

        // Convert to array and sort by user count initially
        const topDepts = Object.values(deptMetrics)
          .sort((a: any, b: any) => b.userCount - a.userCount)
          .slice(0, 10);

        setTopDepartments(topDepts);
        const topDept = (topDepts[0] as any)?.department || 'N/A';

        // Average Session Time (hoursspent is already in hours)
        const { data: sessionData } = await supabase
          .from('learning_hours')
          .select('userid, hoursspent');

        const totalSessionHours = (sessionData || []).reduce((sum, s) => sum + (s.hoursspent || 0), 0);
        const totalSessionRecords = (sessionData || []).length;
        const avgSessionTime = totalSessionRecords > 0
          ? totalSessionHours / totalSessionRecords
          : 0;

        setStats((prev: any) => ({
          ...prev,
          totalUsers: totalUsersCount || 0,
          totalCourses: totalCoursesCount || 0,
          avgCourseRating: Math.round(avgRating * 10) / 10,
          monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
          topDepartment: topDept,
          avgSessionTime: Math.round(avgSessionTime * 10) / 10,
          certificatesEarned: 0, // Will be set with actual count from database
        }));

        // Engagement Trend
        const { data: engData } = await supabase.rpc('get_engagement_analytics');
        if (engData) setEngagementData(engData);

        // Enhanced Engagement Metrics
        try {
          // Get session/activity data
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('id, createdat, updatedat, completed, userid');

          const { data: learningHours } = await supabase
            .from('learning_hours')
            .select('userid, hoursspent, createdat');

          // Get certificates data for department engagement
          const { data: certificatesData } = await supabase
            .from('certificates')
            .select('user_id, course_id');

          // Calculate average session duration (hoursspent is already in hours)
          const totalHours = (learningHours || []).reduce((sum: number, lh: any) => sum + (lh.hoursspent || 0), 0);
          const totalLearningRecords = (learningHours || []).length;
          const avgSessionDuration = totalLearningRecords > 0
            ? Math.round((totalHours / totalLearningRecords) * 100) / 100
            : 0;

          // Calculate peak activity hour (from createdat timestamps)
          const hourCounts: any = {};
          (enrollments || []).forEach((e: any) => {
            if (e.createdat) {
              const hour = new Date(e.createdat).getHours();
              hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
          });
          const peakActivityHour = Object.entries(hourCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 0;

          // Calculate engagement quality score (0-100)
          const completionRate = engData && engData.length > 0
            ? (engData.reduce((sum: any, d: any) => sum + (d.lessons_completed || 0), 0) / (engData.length * 10)) * 100
            : 0;
          const engagementQualityScore = Math.min(Math.round(completionRate), 100);

          // Department engagement metrics with certificates earned - use all profiles
          const deptEngagement = (allProfiles || []).reduce((acc: any, profile: any) => {
            const dept = profile.department || 'Unassigned';
            const deptCerts = (certificatesData || []).filter((c: any) => {
              const userProfile = allProfiles?.find((p: any) => p.id === c.user_id);
              return userProfile?.department === dept;
            }).length;
            const existing = acc.find((d: any) => d.department === dept);
            if (existing) {
              existing.userCount += 1;
              existing.certificatesEarned = (existing.certificatesEarned || 0) + deptCerts;
              existing.active_users = (existing.active_users || 0) + 1;
            } else {
              acc.push({
                department: dept,
                userCount: 1,
                certificatesEarned: deptCerts,
                active_users: 1
              });
            }
            return acc;
          }, []).sort((a: any, b: any) => b.userCount - a.userCount);

          setEngagementMetrics({
            avgSessionDuration,
            peakActivityHour: Math.round(Number(peakActivityHour) || 0),
            engagementQualityScore,
            activeUsersOnline: allProfiles?.length || 0,
            departmentEngagement: deptEngagement.slice(0, 5)
          });
        } catch (error) {
          console.error('Error fetching engagement metrics:', error);
        }

        // Recent Certificates with User & Course Details
        try {
          const { data: certData } = await supabase
            .from('certificates')
            .select('id, issued_at, user_id, course_id')
            .order('issued_at', { ascending: false });

          if (certData && certData.length > 0) {
            const enrichedCerts = await Promise.all(certData.map(async (cert: any) => {
              try {
                const { data: prof } = await supabase
                  .from('profiles')
                  .select('fullname, email, department')
                  .eq('id', cert.user_id)
                  .single();

                const { data: course } = await supabase
                  .from('courses')
                  .select('title')
                  .eq('id', cert.course_id)
                  .single();

                const fullName = prof?.fullname || 'Unknown User';

                return {
                  ...cert,
                  profiles: {
                    fullname: fullName,
                    email: prof?.email,
                    department: prof?.department
                  },
                  courses: {
                    title: course?.title || 'Unknown Course'
                  }
                };
              } catch (profError) {
                console.error('Error fetching certificate details:', profError);
                return {
                  ...cert,
                  profiles: {
                    fullname: 'Unknown User',
                    email: '',
                    department: 'N/A'
                  },
                  courses: {
                    title: 'Unknown Course'
                  }
                };
              }
            }));
            setCertificates(enrichedCerts);
            // Update certificatesEarned stat to match actual count
            setStats((prev: any) => ({
              ...prev,
              certificatesEarned: enrichedCerts.length
            }));
          } else {
            setCertificates([]);
            setStats((prev: any) => ({
              ...prev,
              certificatesEarned: 0
            }));
          }
        } catch (error) {
          console.error('Error fetching certificates:', error);
          setCertificates([]);
          setStats((prev: any) => ({
            ...prev,
            certificatesEarned: 0
          }));
        }

        // Course Performance - Use courseService for efficiency (already calculates enrollments and ratings)
        try {
          const courses = await courseService.getCourses();

          if (courses && courses.length > 0) {
            // Get assessment data for avg score calculation
            const { data: allAssessments } = await supabase
              .from('assessment_results')
              .select('courseid, score');

            // Group assessments by course
            const assessmentsByRepo: any = {};
            (allAssessments || []).forEach((a: any) => {
              if (!assessmentsByRepo[a.courseid]) {
                assessmentsByRepo[a.courseid] = [];
              }
              assessmentsByRepo[a.courseid].push(a.score);
            });

            const coursePerformance = courses
              .filter((c: any) => c.status === 'published') // Only published courses
              .map((course: any) => {
                // Calculate average score from stored assessment data
                const courseScores = assessmentsByRepo[course.id] || [];
                const avgScore = courseScores.length > 0
                  ? Math.round(courseScores.reduce((a: number, b: number) => a + (b || 0), 0) / courseScores.length)
                  : 0;

                // Completion rate - calculate from enrolled vs completed
                const completionRate = course.totalstudents > 0
                  ? course.completionrate || 0
                  : 0;

                return {
                  course_id: course.id,
                  course_name: course.title || 'Unknown',
                  category: course.category || 'Uncategorized',
                  enrollment_count: course.totalstudents || 0,
                  completion_rate: completionRate,
                  avg_score: avgScore,
                  feedback_score: course.averagerating || 0
                };
              });

            setCourseStats(coursePerformance);
          } else {
            setCourseStats([]);
          }
        } catch (error) {
          console.error('Error fetching course stats:', error);
          setCourseStats([]);
        }

        // CEFR Distribution
        try {
          const { data: distData, error: distError } = await supabase.rpc('get_assessment_distribution');
          if (distData && !distError) setDistribution(distData);
        } catch (error) {
          console.error('Error fetching assessment distribution:', error);
          setDistribution([]);
        }

        // Compliance - Calculate from enrollments if RPC doesn't exist
        try {
          const { data: compData, error: compError } = await supabase.rpc('get_compliance_stats');
          if (compData && !compError) {
            setCompliance(compData);
          } else {
            // Fallback: Calculate compliance from enrollments table
            const { data: enrollmentsData } = await supabase
              .from('enrollments')
              .select('completed');

            const totalEnrollments = enrollmentsData?.length || 0;
            const completedEnrollments = enrollmentsData?.filter((e: any) => e.completed).length || 0;

            setCompliance([
              { status: 'Compliant', count: completedEnrollments },
              { status: 'Non-Compliant', count: totalEnrollments - completedEnrollments }
            ]);
          }
        } catch (error) {
          console.error('Error fetching compliance stats:', error);
          setCompliance([
            { status: 'Compliant', count: 0 },
            { status: 'Non-Compliant', count: 0 }
          ]);
        }

        // Skill Matrix
        try {
          const { data: smData } = await supabase.rpc('get_skill_matrix_data');
          if (smData) setSkillMatrix(smData);
        } catch (error) {
          console.error('Error fetching skill matrix:', error);
          setSkillMatrix([]);
        }

        // Skill Gaps
        try {
          const { data: gData, error: gError } = await supabase.rpc('get_skill_gap_analysis');
          if (gData && !gError) setGapData(gData);
        } catch (error) {
          console.error('Error fetching skill gap analysis:', error);
          setGapData([]);
        }

        // Career Paths with Required Skills (join with career_paths to get skill_requirements)
        const { data: cpData } = await supabase
          .from('user_career_paths')
          .select(`
          id,
          user_id,
          career_path_id,
          source_role_name,
          target_role_name,
          readiness_percentage,
          status,
          assigned_at,
          target_date,
          profiles!user_id (
            id,
            fullname,
            department
          ),
          career_paths!career_path_id (
            id,
            source_role,
            target_role,
            skill_requirements
          )
        `)
          .limit(50);
        if (cpData) setCareerPathData(cpData);

        // User Skill Achievements
        const { data: saData } = await supabase
          .from('user_skill_achievements')
          .select('user_id, skill_id, skill_name, course_level, course_id, course_title, percentage_achieved, completed_at')
          .limit(500);
        if (saData) setSkillAchievements(saData);
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'executive', label: 'Executive View', icon: 'insights' },
    { id: 'engagement', label: 'Engagement', icon: 'bolt' },
    { id: 'courses', label: 'Course Performance', icon: 'auto_stories' },
    { id: 'assessments', label: 'Assessments', icon: 'assignment_turned_in' },
    { id: 'certificates', label: 'Certificates & Compliance', icon: 'verified' },
    { id: 'skills', label: 'Skill Matrix', icon: 'grid_view' },
    { id: 'career', label: 'Career Paths', icon: 'trending_up' },
    { id: 'gaps', label: 'Skill Gaps', icon: 'radar' },
  ];

  return (
    <AdminLayout title="LMS Analytics & Metrics">
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-bold border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50 rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="material-symbols-rounded text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Top KPI Cards - Only show on Executive tab */}
        {activeTab === 'executive' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            <KPICard title="Active Learners" value={stats.totalActiveLearners} icon="group" trend="+12%" color="blue" />
            <KPICard title="Total Users" value={stats.totalUsers} icon="people" trend="+8%" color="green" />
            <KPICard title="Total Courses" value={stats.totalCourses} icon="school" trend="+15%" color="purple" />
            <KPICard title="Completion Rate" value={`${stats.courseCompletionRate}%`} icon="task_alt" trend="+5%" color="emerald" />
            <KPICard title="Pass Rate" value={`${stats.assessmentPassRate}%`} icon="grade" trend="+2%" color="orange" />
            <KPICard title="Avg Learning Hrs" value={stats.avgLearningHours} icon="schedule" trend="+1.5h" color="teal" />
            <KPICard title="Certificates" value={stats.certificatesEarned} icon="workspace_premium" trend="+24" color="indigo" />
            <KPICard title="Skill Coverage" value={`${stats.skillCoverage}%`} icon="radar" trend="+8%" color="pink" />
            <KPICard title="Avg Rating" value={stats.avgCourseRating} icon="star" trend="+0.3" color="yellow" />
            <KPICard title="Monthly Growth" value={`${stats.monthlyGrowth}%`} icon="trending_up" trend="+12%" color="cyan" />
            <KPICard title="Top Department" value={stats.topDepartment} icon="business" trend="Leading" color="violet" />
            <KPICard title="Avg Session" value={`${stats.avgSessionTime}h`} icon="timer" trend="+0.5h" color="rose" />
          </div>
        )}

        {/* Top Departments Chart - Only show on Executive tab */}
        {activeTab === 'executive' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-col gap-4 mb-6">
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-rounded text-blue-500">bar_chart</span>
                Top 10 Departments
              </h4>
              <div className="flex bg-gray-100 p-1 rounded-xl flex-wrap gap-1 sm:gap-0 w-full sm:w-fit">
                {[
                  { id: 'userCount', label: 'Users' },
                  { id: 'totalXP', label: 'XP' },
                  { id: 'coursesEnrolled', label: 'Enrolled' },
                  { id: 'coursesCompleted', label: 'Completed' }
                ].map((metric) => (
                  <button
                    key={metric.id}
                    onClick={() => setDepartmentFilterMetric(metric.id)}
                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase rounded-xl transition-all ${departmentFilterMetric === metric.id
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
              {topDepartments
                .sort((a: any, b: any) => b[departmentFilterMetric] - a[departmentFilterMetric])
                .slice(0, 10)
                .map((dept: any, index: number) => {
                  const maxValue = Math.max(...topDepartments.map((d: any) => d[departmentFilterMetric]));
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
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-1000"
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

        {/* Content based on tab */}
        <div className="min-h-[500px]">
          {activeTab === 'executive' && (
            <ExecutiveDashboard
              stats={stats}
              engagementData={processedEngagementData}
              trendFilter={trendFilter}
              setTrendFilter={setTrendFilter}
            />
          )}
          {activeTab === 'engagement' && <EngagementDashboard engagementData={last28DaysData} engagementMetrics={engagementMetrics} />}
          {activeTab === 'courses' && <CourseDashboard courseStats={courseStats} />}
          {activeTab === 'assessments' && <AssessmentDashboard distribution={distribution} />}
          {activeTab === 'certificates' && <CertificateDashboard compliance={compliance} certificates={certificates} />}
          {activeTab === 'skills' && <SkillsDashboard skillMatrix={skillMatrix} />}
          {activeTab === 'career' && <CareerPathDashboard careerPaths={careerPathData} achievements={skillAchievements} />}
          {activeTab === 'gaps' && <SkillGapDashboard gapData={gapData} />}
        </div>
      </div>
    </AdminLayout>
  );
};

const KPICard = ({ title, value, icon, trend, color }: any) => {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    teal: 'bg-teal-50 text-teal-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    pink: 'bg-pink-50 text-pink-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600'
  };

  const isPositive = trend.startsWith('+');

  return (
    <div className="bg-white p-3 sm:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-2 sm:mb-3">
        <div className={`p-1.5 sm:p-2 rounded-xl ${colorMap[color] || colorMap.blue}`}>
          <span className="material-symbols-rounded text-base sm:text-xl">{icon}</span>
        </div>
        <div className={`flex items-center gap-0.5 text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full ${isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
          <span className="material-symbols-rounded text-[10px] sm:text-[12px]">
            {isPositive ? 'trending_up' : 'trending_down'}
          </span>
          {trend}
        </div>
      </div>
      <p className="text-gray-600 text-[9px] sm:text-xs font-bold uppercase tracking-wider">{title}</p>
      <h3 className="text-lg sm:text-2xl font-black text-gray-900 mt-1">{value}</h3>
    </div>
  );
};

const ExecutiveDashboard = ({ stats, engagementData, trendFilter, setTrendFilter }: any) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-rounded text-indigo-500">show_chart</span>
          Active Users Trend
        </h4>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {['daily', 'weekly', 'monthly'].map((f) => (
            <button
              key={f}
              onClick={() => setTrendFilter(f)}
              className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${trendFilter === f
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 flex items-end gap-3 px-2 relative">
        {/* Simple Line Representation (Simplified) */}
        {engagementData.length > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none px-10 pb-10" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2"
              strokeOpacity="0.2"
              points={engagementData.map((day: any, i: number) => {
                const x = (i / (engagementData.length - 1)) * 100;
                const y = 100 - Math.min(day.active_users * 10, 90);
                return `${x},${y}`;
              }).join(' ')}
            />
          </svg>
        )}

        {engagementData.length > 0 ? (
          engagementData.map((day: any, i: number) => {
            const height = Math.min(day.active_users * 15, 100)

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-2 group"
              >
                {/* Bar Wrapper (FIXED HEIGHT) */}
                <div className="relative w-full h-full flex items-end">
                  <div
                    className="w-full rounded-t-lg transition-all duration-300
               bg-gradient-to-t from-indigo-600 to-indigo-400
               group-hover:from-indigo-500 group-hover:to-indigo-300"
                    style={{ height: `${height}%` }}
                  >
                    {/* Data Label Above Bar */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-center">
                      <span className="text-[10px] font-bold text-gray-900 bg-white px-1.5 py-0.5 rounded-md shadow-sm">
                        {day.active_users}
                      </span>
                    </div>
                    {/* Tooltip */}
                    <div
                      className="absolute -top-12 left-1/2 -translate-x-1/2
                 bg-gray-900 text-white text-[11px]
                 px-2 py-1 rounded-md shadow-md
                 opacity-0 group-hover:opacity-100
                 transition-opacity whitespace-nowrap"
                    >
                      {day.active_users} users
                    </div>
                  </div>
                </div>

                {/* Day Label */}
                <span className="text-[11px] font-semibold uppercase text-gray-500">
                  {trendFilter === 'daily'
                    ? new Date(day.date).toLocaleDateString(undefined, { weekday: "short" })
                    : day.date}
                </span>
              </div>
            )
          })
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            No activity data found
          </div>
        )}
      </div>
    </div>




    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="material-symbols-rounded text-green-600">pie_chart</span>
        Completion vs Dropout
      </h4>
      <div className="flex items-center justify-center h-64 gap-12">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-gray-100" strokeWidth="4"></circle>
            <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-[#4f46e5]" strokeWidth="4" strokeDasharray={`${stats.courseCompletionRate}, 100`}></circle>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center transform rotate-360">
            <span className="text-3xl font-black text-gray-900">{stats.courseCompletionRate}%</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Completed</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
            <span className="text-sm text-gray-800">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-200"></span>
            <span className="text-sm text-gray-800">Progress / Dropout</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const EngagementDashboard: React.FC<{ engagementData: any[], engagementMetrics: any }> = ({ engagementData: initialData, engagementMetrics }) => {
  const [realTimeData, setRealTimeData] = useState(initialData);
  const [isLive, setIsLive] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 27);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Real-time subscription to engagement data (Supabase v2+ compatible)
  useEffect(() => {
    try {
      const channel = supabase
        .channel('learning_hours_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'learning_hours',
          },
          (payload: any) => {
            setIsLive(true);
            // Update the real-time data
            setRealTimeData((prev: any) => {
              const updated = [...prev];
              const today = new Date().toISOString().split('T')[0];
              const todayIndex = updated.findIndex((d: any) => d.date === today);

              if (todayIndex !== -1) {
                updated[todayIndex] = {
                  ...updated[todayIndex],
                  lessons_completed: (updated[todayIndex].lessons_completed || 0) + 1
                };
              }
              return updated;
            });
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    } catch (error) {
      console.warn('Real-time subscription not available:', error);
      // Gracefully handle if real-time is not available
    }
  }, []);

  const getIntensityColor = (value: number) => {
    if (value === 0) return 'bg-gray-100';
    if (value < 0.3) return 'bg-blue-200';
    if (value < 0.6) return 'bg-blue-400';
    if (value < 0.9) return 'bg-blue-600';
    return 'bg-blue-800';
  };

  // Filter data based on date range
  const filteredData = React.useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return (isLive ? realTimeData : initialData).filter((d: any) => {
      const dataDate = new Date(d.date);
      return dataDate >= start && dataDate <= end;
    });
  }, [startDate, endDate, isLive, realTimeData, initialData]);

  const displayData = isLive ? realTimeData : initialData;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h5 className="text-xs sm:text-sm font-semibold text-gray-800">Session Duration</h5>
            <span className="material-symbols-rounded text-blue-500 text-xl sm:text-2xl">schedule</span>
          </div>
          <p className="text-lg sm:text-3xl font-bold text-gray-900">{Math.round(engagementMetrics.avgSessionDuration * 60)} min</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2">per active user</p>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h5 className="text-xs sm:text-sm font-semibold text-gray-800">Peak Activity</h5>
            <span className="material-symbols-rounded text-orange-500 text-xl sm:text-2xl">trending_up</span>
          </div>
          <p className="text-lg sm:text-3xl font-bold text-gray-900">{Math.round(engagementMetrics.peakActivityHour)}:00</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2">peak activity hour</p>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h5 className="text-xs sm:text-sm font-semibold text-gray-800">Quality Score</h5>
            <span className="material-symbols-rounded text-green-500 text-xl sm:text-2xl">verified_user</span>
          </div>
          <p className="text-lg sm:text-3xl font-bold text-gray-900">{engagementMetrics.engagementQualityScore}%</p>
          <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5 mt-2 sm:mt-3">
            <div
              className="bg-green-500 h-1 sm:h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${engagementMetrics.engagementQualityScore}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h5 className="text-xs sm:text-sm font-semibold text-gray-800">Users Online</h5>
            <span className="material-symbols-rounded text-indigo-500 text-xl sm:text-2xl">people</span>
          </div>
          <p className="text-lg sm:text-3xl font-bold text-gray-900">{engagementMetrics.activeUsersOnline}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2">currently online</p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-100">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-base sm:text-lg text-gray-900 flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                  <span className="material-symbols-rounded text-blue-600 text-xl sm:text-2xl">calendar_month</span>
                  <span>Daily Lessons Completed Activity</span>
                  {isLive && (
                    <span className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red-100 text-red-600 text-[9px] sm:text-xs font-bold rounded-full">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                      LIVE
                    </span>
                  )}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600">
                  Data from {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-5 text-[9px] sm:text-[11px] font-semibold text-gray-600 bg-white px-2 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-200 whitespace-nowrap">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="hidden sm:inline">Less</span>
                  <div className="flex gap-0.5 sm:gap-1.5">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-gray-200 rounded-sm shadow-sm"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-100 rounded-sm shadow-sm"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-300 rounded-sm shadow-sm"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-sm shadow-sm"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-700 rounded-sm shadow-sm"></div>
                  </div>
                  <span className="hidden sm:inline">More</span>
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-blue-100">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-600 uppercase">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                  className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-600 uppercase">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <button
                onClick={() => {
                  const now = new Date();
                  setEndDate(now.toISOString().split('T')[0]);
                  const start = new Date(now);
                  start.setDate(start.getDate() - 27);
                  setStartDate(start.toISOString().split('T')[0]);
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-base">refresh</span>
                Last 28 Days
              </button>

              <div className="ml-auto text-xs font-semibold text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200">
                {filteredData.length} days selected
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="p-4 sm:p-8">
          {filteredData.length > 0 ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Week rows - Dynamic based on filtered data */}
              {Math.ceil(filteredData.length / 7) > 0 && Array.from({ length: Math.ceil(filteredData.length / 7) }).map((_, weekIdx) => (
                <div key={weekIdx} className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-14 sm:w-20 text-xs font-semibold text-gray-500 shrink-0">
                      Week {weekIdx + 1}
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent"></div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-3 overflow-x-auto pb-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((_, dayIdx) => {
                      const dataIdx = weekIdx * 7 + dayIdx;
                      const dayData = filteredData[dataIdx];
                      const intensity = dayData ? Math.min(dayData.lessons_completed / 10, 1) : 0;
                      const hasData = !!dayData && dayData.lessons_completed > 0;

                      return (
                        <div key={`${weekIdx}-${dayIdx}`} className="flex flex-col items-center gap-1 sm:gap-2 flex-shrink-0">
                          <div
                            className={`
                              w-7 h-7 sm:w-12 sm:h-12 rounded-lg transition-all duration-200 cursor-pointer
                              ${getIntensityColor(intensity)}
                              ${hasData ? 'hover:ring-2 hover:ring-blue-400 hover:shadow-lg' : 'opacity-50'}
                              hover:scale-110 shadow-sm
                            `}
                            title={dayData ? `${dayData.date}: ${dayData.lessons_completed} lessons, ${dayData.active_users} active users` : 'No data'}
                          ></div>
                          <span className="text-[10px] sm:text-xs font-medium text-gray-500 text-center w-12 sm:w-12 truncate">
                            {dayData ? new Date(dayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex gap-3">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} className="h-12 w-12 rounded-lg bg-gray-100 animate-pulse"></div>
                ))}
              </div>
            </div>
          )}

          {/* Statistics Footer */}
          {filteredData.length > 0 && (
            <div className="mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] sm:text-xs font-semibold text-blue-600 uppercase mb-1 sm:mb-2">Total Lessons</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-900">
                    {filteredData.reduce((sum: number, d: any) => sum + (d.lessons_completed || 0), 0)}
                  </p>
                </div>
                <div className="bg-emerald-50 p-3 sm:p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] sm:text-xs font-semibold text-emerald-600 uppercase mb-1 sm:mb-2">Average/Day</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-900">
                    {Math.round(
                      filteredData.reduce((sum: number, d: any) => sum + (d.lessons_completed || 0), 0) / Math.max(filteredData.length, 1)
                    )}
                  </p>
                </div>
                <div className="bg-indigo-50 p-3 sm:p-4 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] sm:text-xs font-semibold text-indigo-600 uppercase mb-1 sm:mb-2">Peak Day</p>
                  <p className="text-xl sm:text-2xl font-bold text-indigo-900">
                    {Math.max(...filteredData.map((d: any) => d.lessons_completed || 0), 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Department Engagement Breakdown */}
      {engagementMetrics.departmentEngagement && engagementMetrics.departmentEngagement.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="material-symbols-rounded text-indigo-500">apartment</span>
            Engagement by Department
          </h4>
          <div className="space-y-4">
            {engagementMetrics.departmentEngagement.map((dept: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{dept.department || 'Unassigned'}</p>
                    <p className="text-xs text-gray-500">{dept.active_users} active users</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{dept.certificatesEarned || 0}</p>
                  <p className="text-xs text-gray-500">certificates earned</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CourseDashboard = ({ courseStats }: any) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'enrollments' | 'completion' | 'score' | 'feedback'>('enrollments');

  // Get unique categories
  const categories: string[] = ['All', ...new Set((courseStats?.map((c: any) => c.category).filter(Boolean) || []) as string[])].sort();

  // Filter and sort courses
  const filteredCourses = courseStats
    .filter((c: any) => {
      const searchMatch = c.course_name.toLowerCase().includes(searchFilter.toLowerCase());
      const categoryMatch = categoryFilter === 'All' || c.category === categoryFilter;
      return searchMatch && categoryMatch;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case 'enrollments':
          return b.enrollment_count - a.enrollment_count;
        case 'completion':
          return b.completion_rate - a.completion_rate;
        case 'score':
          return b.avg_score - a.avg_score;
        case 'feedback':
          return b.feedback_score - a.feedback_score;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-4 mb-6">
          <h4 className="font-bold text-gray-900">Course Performance Ranking</h4>

          {/* Filter Controls */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search courses..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="enrollments">Sort by Enrollments</option>
              <option value="completion">Sort by Completion Rate</option>
              <option value="score">Sort by Avg Score</option>
              <option value="feedback">Sort by Feedback</option>
            </select>

            {/* Clear Filters Button */}
            {(searchFilter || categoryFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchFilter('');
                  setCategoryFilter('All');
                }}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results Count */}
          <p className="text-xs text-gray-500">
            Showing {filteredCourses.length} of {courseStats.length} courses
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="pb-4">Course</th>
                <th className="pb-4 text-center">Enrollments</th>
                <th className="pb-4 text-center">Completion</th>
                <th className="pb-4 text-center">Avg Score</th>
                <th className="pb-4 text-center">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCourses.length > 0 ? (
                filteredCourses.map((c: any) => (
                  <tr key={c.course_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 text-sm font-bold text-gray-900">{c.course_name}</td>
                    <td className="py-4 text-center text-sm text-gray-900">{c.enrollment_count}</td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary " style={{ width: `${c.completion_rate}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-gray-900">{c.completion_rate}%</span>
                      </div>
                    </td>
                    <td className="py-4 text-center text-sm font-bold text-primary">{c.avg_score}%</td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="material-symbols-rounded text-orange-400 text-sm">star</span>
                        <span className="text-sm font-bold text-gray-900">{c.feedback_score}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 text-sm italic">
                    No courses match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AssessmentDashboard = ({ distribution }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <h4 className="font-bold text-gray-900 mb-6">Score Distribution (CEFR)</h4>
      <div className="flex items-end h-48 gap-3">
        {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((label) => {
          const val = distribution?.find((d: any) => d.cefr_level === label)?.user_count || 0;
          const max = Math.max(...(distribution?.map((d: any) => d.user_count) || [1]), 1);
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-primary rounded-t-lg transition-all duration-1000" style={{ height: `${(val / max) * 100}%` }}></div>
              <span className="text-xs font-bold text-gray-500">{label}</span>
            </div>
          );
        })}
      </div>
    </div>

    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <h4 className="font-bold text-gray-900 mb-6">Live Assessment Insights</h4>
      <div className="space-y-6 py-4">
        {distribution?.slice(0, 4).map((d: any, i: number) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase text-gray-500">
              <span>{d.cefr_level} Proficiency</span>
              <span>{d.user_count} Learners</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${(d.user_count / Math.max(...(distribution?.map((x: any) => x.user_count) || [1]), 1)) * 100}%` }}></div>
            </div>
          </div>
        ))}
        {(!distribution || distribution.length === 0) && <p className="text-center text-gray-400 text-sm italic">No distribution data available</p>}
      </div>
    </div>
  </div>
);

const CertificateDashboard = ({ compliance, certificates }: any) => {
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [userSearchFilter, setUserSearchFilter] = useState('');

  const compliant = compliance?.find((c: any) => c?.status === 'Compliant')?.count || 0;
  const nonCompliant = compliance?.find((c: any) => c?.status === 'Non-Compliant')?.count || 0;
  const total = compliant + nonCompliant || 1;
  const rate = total > 0 ? Math.round((compliant / total) * 100) : 0;

  // Get unique departments and courses for filters
  const departments = ['All', ...new Set(certificates?.map((c: any) => c.profiles?.department).filter(Boolean) || [])].sort();
  const courses = ['All', ...new Set(certificates?.map((c: any) => c.courses?.title).filter(Boolean) || [])].sort();

  // Filter certificates
  const filteredCertificates = certificates?.filter((cert: any) => {
    const deptMatch = departmentFilter === 'All' || cert.profiles?.department === departmentFilter;
    const courseMatch = courseFilter === 'All' || cert.courses?.title === courseFilter;
    const userMatch = userSearchFilter === '' || cert.profiles?.fullname?.toLowerCase().includes(userSearchFilter.toLowerCase());
    return deptMatch && courseMatch && userMatch;
  }) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="material-symbols-rounded text-teal-500">verified</span>
          Mandatory Training Compliance
        </h4>
        <div className="flex items-center justify-around h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-gray-100" strokeWidth="3"></circle>
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-green-500 transition-all duration-1000" strokeWidth="3" strokeDasharray={`${rate}, 100`}></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center transform rotate-360 text-xl font-black text-gray-900">{rate}%</div>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase">Compliant</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-bold text-gray-700">Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm font-bold text-gray-700">Non-Compliant</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-gray-900">Recent Certificates</h4>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">{filteredCertificates.length}/{certificates?.length || 0}</span>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-4 pb-4 border-b border-gray-100">
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-gray-400 uppercase mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 outline-none"
            >
              {departments.map((dept: any) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-gray-400 uppercase mb-1">Course</label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 outline-none"
            >
              {courses.map((course: any) => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-gray-400 uppercase mb-1">Search User</label>
            <input
              type="text"
              placeholder="Search..."
              value={userSearchFilter}
              onChange={(e) => setUserSearchFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 outline-none"
            />
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredCertificates && filteredCertificates.length > 0 ? (
            filteredCertificates.map((cert: any) => {
              const userName = cert?.profiles?.fullname || cert?.user_id || 'Unknown User';
              const courseName = cert?.courses?.title || 'Unknown Course';
              const issueDate = cert?.issued_at ? new Date(cert.issued_at).toLocaleDateString() : 'N/A';

              return (
                <div key={cert?.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="material-symbols-rounded text-teal-500 text-base flex-shrink-0 mt-0.5">workspace_premium</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 truncate">{courseName}</p>
                      <p className="text-[10px] text-gray-600 truncate">{userName}</p>
                      <p className="text-[9px] text-gray-400">{issueDate}</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-gray-400 text-sm italic py-4">No certificates found</p>
          )}
        </div>
      </div>
    </div>
  );
};

const SkillsDashboard = ({ skillMatrix }: any) => {
  const [rowType, setRowType] = useState<'department' | 'user' | 'skill' | 'family'>('department');
  const [colType, setColType] = useState<'skill' | 'family'>('skill');
  const [matrixMetric, setMatrixMetric] = useState<'proficiency' | 'assignment'>('proficiency');
  const [deptFilter, setDeptFilter] = useState('All');
  const [familyFilter, setFamilyFilter] = useState('All');
  const [skillFilter, setSkillFilter] = useState('All');
  const [userSearch, setUserSearch] = useState('');

  // Dropdown lists always populated from full dataset - "All" always first
  const departments = ['All', ...new Set(skillMatrix?.map((s: any) => s.department) || [])].sort((a: any, b: any) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
  const families = ['All', ...new Set(skillMatrix?.map((s: any) => s.skill_family) || [])].sort((a: any, b: any) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
  const skillsList = ['All', ...new Set(skillMatrix?.map((s: any) => s.skill_name) || [])].sort((a: any, b: any) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));

  const filteredMatrix = skillMatrix?.filter((s: any) => {
    const matchDept = deptFilter === 'All' || (s?.department === deptFilter);
    const matchFamily = familyFilter === 'All' || (s?.skill_family === familyFilter);
    const matchSkill = skillFilter === 'All' || (s?.skill_name === skillFilter);
    const matchUser = userSearch === '' || ((s?.fullname || '').toLowerCase().includes(userSearch.toLowerCase()));
    return matchDept && matchFamily && matchSkill && matchUser;
  }) || [];

  // Display logic: Columns are determined by the colType toggle and pruned by category filters (Family/Skill)
  // but are NOT hidden by entity filters (Dept/User) to keep the matrix stable.
  const displayCols = (colType === 'family'
    ? [...new Set(skillMatrix?.filter((s: any) => familyFilter === 'All' || s.skill_family === familyFilter).map((s: any) => s.skill_family) || [])]
    : [...new Set(skillMatrix?.filter((s: any) =>
      (familyFilter === 'All' || s.skill_family === familyFilter) &&
      (skillFilter === 'All' || s.skill_name === skillFilter)
    ).map((s: any) => s.skill_name) || [])]).sort();

  // Rows are determined by the rowType toggle and pruned by ALL filters.
  const displayRows = (rowType === 'user'
    ? [...new Set(filteredMatrix.map((s: any) => s.fullname))]
    : rowType === 'skill'
      ? [...new Set(filteredMatrix.map((s: any) => s.skill_name))]
      : rowType === 'family'
        ? [...new Set(filteredMatrix.map((s: any) => s.skill_family))]
        : [...new Set(filteredMatrix.map((s: any) => s.department))]).sort();

  const handleExport = (format: 'pdf' | 'excel') => {
    const filename = `Skill_Matrix_${rowType}_vs_${colType}_${matrixMetric}_${new Date().toISOString().split('T')[0]}`;
    const title = `Organization Skill Matrix (${matrixMetric}) - Rows: ${rowType}, Cols: ${colType}`;

    const exportData = displayRows.map((rowLabel: any) => {
      const row: any = {
        [rowType.charAt(0).toUpperCase() + rowType.slice(1)]: rowLabel
      };

      displayCols.forEach((colLabel: any) => {
        const dataPoints = filteredMatrix.filter((s: any) => {
          const rowMatch = rowType === 'user' ? s.fullname === rowLabel :
            rowType === 'skill' ? s.skill_name === rowLabel :
              rowType === 'family' ? s.skill_family === rowLabel :
                s.department === rowLabel;

          const colMatch = colType === 'family' ? s.skill_family === colLabel : s.skill_name === colLabel;

          return rowMatch && colMatch;
        });

        const avg = dataPoints.length > 0
          ? dataPoints.reduce((acc: number, curr: any) => {
            const val = matrixMetric === 'proficiency' ? curr.proficiency_avg : (curr.is_assigned ? 100 : 0);
            return acc + Number(val);
          }, 0) / dataPoints.length
          : 0;

        row[colLabel] = dataPoints.length > 0 ? `${Math.round(avg)}%` : '-';
      });

      return row;
    });

    if (format === 'excel') exportToExcel(exportData, filename);
    else if (format === 'pdf') exportToPDF(exportData, filename, title);
  };




  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Row 1: Title and User Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h4 className="font-bold text-gray-900 whitespace-nowrap text-lg">Organization Skill Matrix (Live)</h4>

          <div className="flex flex-col w-full md:w-auto">
            <span className="text-[9px] font-bold text-gray-400 uppercase ml-1 mb-1">User Search</span>
            <input
              type="text"
              placeholder="Search user..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                if (e.target.value !== '') setRowType('user');
              }}
              className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 min-w-[200px]"
            />
          </div>
        </div>

        {/* Row 2: Matrix Configuration (Metric, Rows, Columns) */}
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-2 ml-1">Display Metric</span>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {[
                { id: 'proficiency', label: 'Proficiency' },
                { id: 'assignment', label: 'Assigned %' }
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setMatrixMetric(v.id as any)}
                  className={`px-4 py-2 text-[10px] font-bold uppercase rounded-xl transition-all ${matrixMetric === v.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-2 ml-1">Rows</span>
            <div className="flex bg-gray-100 p-1 rounded-lg flex-wrap gap-0.5">
              {[
                { id: 'department', label: 'Dept' },
                { id: 'user', label: 'User' },
                { id: 'skill', label: 'Skill' },
                { id: 'family', label: 'Family' }
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setRowType(v.id as any)}
                  className={`px-3 py-2 text-[10px] font-bold uppercase rounded-xl transition-all ${rowType === v.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-2 ml-1">Columns</span>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {[
                { id: 'skill', label: 'Skill' },
                { id: 'family', label: 'Family' }
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setColType(v.id as any)}
                  className={`px-4 py-2 text-[10px] font-bold uppercase rounded-xl transition-all ${colType === v.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Filters and Export Buttons */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase ml-1 mb-2">Filter by Department</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
              >
                {departments.map(d => <option key={d as string} value={d as string}>{d as string}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase ml-1 mb-2">Filter by Skill Family</span>
              <select
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
              >
                {families.map(f => <option key={f as string} value={f as string}>{f as string}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase ml-1 mb-2">Filter by Skill</span>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]"
              >
                {skillsList.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-lg hover:bg-green-100 transition-all border border-green-100 flex-1 lg:flex-none" title="Export to Excel"
            >
              <RiFileExcel2Line className="text-sm" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-lg hover:bg-red-100 transition-all border border-red-100 flex-1 lg:flex-none" title="Export to PDF"
            >
              <RiFilePdfLine className="text-sm" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto border border-gray-100 rounded-2xl">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="py-4 px-6 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                {rowType.charAt(0).toUpperCase() + rowType.slice(1)}
              </th>
              {displayCols.map(col => {
                const family = colType === 'skill'
                  ? skillMatrix?.find((s: any) => s.skill_name === col)?.skill_family
                  : '';
                return (
                  <th key={col as string} className="py-4 px-4 text-center min-w-[120px] border-b border-gray-100">
                    <div className="text-[10px] font-black text-gray-700 uppercase leading-tight">{col as string}</div>
                    {family && <div className="text-[8px] text-primary/60 font-bold uppercase tracking-tighter mt-1">{family}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayRows.map((rowLabel: any) => (
              <tr key={rowLabel} className="group hover:bg-gray-50/50 transition-colors">
                <td className="py-4 px-6 text-sm font-black text-gray-900 sticky left-0 bg-white z-10 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  {rowLabel}
                </td>
                {displayCols.map((colLabel: any) => {
                  const dataPoints = filteredMatrix.filter((s: any) => {
                    const rowMatch = rowType === 'user' ? s.fullname === rowLabel :
                      rowType === 'skill' ? s.skill_name === rowLabel :
                        rowType === 'family' ? s.skill_family === rowLabel :
                          s.department === rowLabel;

                    const colMatch = colType === 'family' ? s.skill_family === colLabel : s.skill_name === colLabel;

                    return rowMatch && colMatch;
                  });

                  const avg = dataPoints.length > 0
                    ? dataPoints.reduce((acc: number, curr: any) => {
                      const val = matrixMetric === 'proficiency' ? curr.proficiency_avg : (curr.is_assigned ? 100 : 0);
                      return acc + Number(val);
                    }, 0) / dataPoints.length
                    : 0;

                  const val = Math.round(avg);
                  const color = matrixMetric === 'assignment' ? (
                    val > 90 ? 'bg-indigo-100 text-indigo-700' :
                      val > 50 ? 'bg-blue-100 text-blue-700' :
                        val > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                  ) : (
                    val > 80 ? 'bg-green-100 text-green-700' :
                      val > 60 ? 'bg-blue-100 text-blue-700' :
                        val > 40 ? 'bg-yellow-100 text-yellow-700' :
                          val > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-gray-400'
                  );
                  const level = dataPoints.find((d: any) => d.course_level)?.course_level;

                  return (
                    <td key={colLabel} className="py-4 px-2 border-b border-gray-100">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-16 h-9 rounded-lg flex items-center justify-center text-[11px] font-black shadow-sm ${color}`}>
                          {dataPoints.length > 0 ? `${val}%` : '-'}
                        </div>
                        {matrixMetric === 'proficiency' && level && (
                          <span className="text-[8px] font-bold text-gray-500 uppercase">{level}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={displayCols.length + 1} className="py-12 text-center text-gray-400 italic bg-gray-50/30">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-rounded text-3xl opacity-20">grid_off</span>
                    No matching data found for the current filters
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CareerPathDashboard = ({ careerPaths, achievements }: { careerPaths: any[]; achievements: any[] }) => {
  const [selectedPath, setSelectedPath] = useState<any | null>(careerPaths?.[0] || null);
  const [userFilter, setUserFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [sortBy, setSortBy] = useState('assigned_at');
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique users with names
  const users = React.useMemo(() => {
    const uniqueUsers = new Map();
    careerPaths.forEach((cp: any) => {
      if (cp.profiles) {
        uniqueUsers.set(cp.user_id, {
          id: cp.user_id,
          name: cp.profiles.fullname || cp.user_id,
          department: cp.profiles.department || 'N/A'
        });
      }
    });
    return Array.from(uniqueUsers.values());
  }, [careerPaths]);

  // Get unique departments
  const departments = React.useMemo(() => {
    const uniqueDepts = new Set();
    careerPaths.forEach((cp: any) => {
      if (cp.profiles?.department) {
        uniqueDepts.add(cp.profiles.department);
      }
    });
    return ['All', ...Array.from(uniqueDepts)].filter(Boolean);
  }, [careerPaths]);

  // Filter and sort career paths
  const filteredAndSortedPaths = React.useMemo(() => {
    let filtered = careerPaths.filter(cp => {
      const userMatch = userFilter === 'All' || cp.user_id === userFilter;
      const deptMatch = departmentFilter === 'All' || cp.profiles?.department === departmentFilter;
      const searchMatch = searchQuery === '' ||
        (cp.profiles?.fullname?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cp.target_role_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cp.source_role_name?.toLowerCase().includes(searchQuery.toLowerCase()));
      return userMatch && deptMatch && searchMatch;
    });

    // Sort based on selected criteria
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          const aDate = a.target_date ? new Date(a.target_date) : new Date('9999-12-31');
          const bDate = b.target_date ? new Date(b.target_date) : new Date('9999-12-31');
          return aDate.getTime() - bDate.getTime();
        case 'readiness':
          return (b.readiness_percentage || 0) - (a.readiness_percentage || 0);
        case 'user_name':
          const aName = a.profiles?.fullname || a.user_id;
          const bName = b.profiles?.fullname || b.user_id;
          return aName.localeCompare(bName);
        case 'assigned_at':
        default:
          const aAssigned = new Date(a.assigned_at || '1970-01-01');
          const bAssigned = new Date(b.assigned_at || '1970-01-01');
          return bAssigned.getTime() - aAssigned.getTime(); // Most recent first
      }
    });

    return filtered;
  }, [careerPaths, userFilter, departmentFilter, sortBy, searchQuery]);

  // Update selected path when filters change
  React.useEffect(() => {
    if (filteredAndSortedPaths.length > 0 && !filteredAndSortedPaths.find(cp => cp.id === selectedPath?.id)) {
      setSelectedPath(filteredAndSortedPaths[0]);
    }
  }, [filteredAndSortedPaths, selectedPath]);

  // Enhanced skill analysis: Compare required skills vs user achievements
  const skillAnalysis = React.useMemo(() => {
    if (!selectedPath || !selectedPath.career_paths) return { required: [], achieved: [], gaps: [], met: [] };

    const userAchievements = achievements.filter(a => a.user_id === selectedPath.user_id);
    const requiredSkills = selectedPath.career_paths?.skill_requirements || [];

    // Build maps for easy lookup
    const achievedMap = new Map();
    userAchievements.forEach(a => {
      achievedMap.set(a.skill_id || a.skill_name, a);
    });

    // Analyze required skills
    const requiredAnalysis = requiredSkills.map((req: any) => {
      const skillId = req.skill_id || req.skillId;
      const skillName = req.skill_name || req.skillName;
      const requiredLevel = req.level || 'Advanced';

      const achievement = achievedMap.get(skillId) || achievedMap.get(skillName);
      const isMetRequirement = achievement &&
        ((requiredLevel === 'Beginner' && ['Beginner', 'Intermediate', 'Advanced'].includes(achievement.course_level)) ||
          (requiredLevel === 'Intermediate' && ['Intermediate', 'Advanced'].includes(achievement.course_level)) ||
          (requiredLevel === 'Advanced' && achievement.course_level === 'Advanced'));

      return {
        id: skillId,
        name: skillName,
        required_level: requiredLevel,
        min_score: req.min_score || 70,
        achieved: !!achievement,
        achieved_level: achievement?.course_level || null,
        percentage: achievement?.percentage_achieved || 0,
        course: achievement?.course_title || null,
        completed_at: achievement?.completed_at || null,
        is_met: isMetRequirement,
        status: !achievement ? 'Not Started' : isMetRequirement ? 'Met' : 'In Progress'
      };
    });

    // Separate into categories
    const gaps = requiredAnalysis.filter((s: any) => !s.achieved);
    const inProgress = requiredAnalysis.filter((s: any) => s.achieved && !s.is_met);
    const met = requiredAnalysis.filter((s: any) => s.is_met);

    // Get additional skills achieved but not required
    const additionalSkills = userAchievements.filter(a =>
      !requiredSkills.some((r: any) => (r.skill_id || r.skillId) === a.skill_id || (r.skill_name || r.skillName) === a.skill_name)
    );

    return {
      required: requiredAnalysis,
      gaps,
      inProgress,
      met,
      additional: additionalSkills,
      completionPercentage: requiredAnalysis.length > 0 ? Math.round((requiredAnalysis.filter((s: any) => s.is_met).length / requiredAnalysis.length) * 100) : 0
    };
  }, [selectedPath, achievements]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-rounded text-indigo-500">trending_up</span>
            Career Path Readiness & Skill Progress
          </h4>
          <p className="text-xs text-gray-500 mt-1">Compare required skills vs acquired skills to track promotion readiness.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Filter by User</span>
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
              }}
              className="text-xs bg-white border border-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="All">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.department !== 'N/A' ? `(${u.department})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Filter by Department</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs bg-white border border-gray-100 rounded-lg px-3 py-2 pr-8 outline-none focus:ring-2 focus:ring-primary/20"
            >
              {departments.map((dept: any) => (
                <option key={dept as string} value={dept as string}>{dept === 'All' ? 'All Departments' : dept}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-white border border-gray-100 rounded-lg px-3 py-2 pr-8 outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="assigned_at">Recently Assigned</option>
              <option value="due_date">Due Date</option>
              <option value="readiness">Readiness Score</option>
              <option value="user_name">User Name</option>
            </select>
          </div>
          <div className="flex flex-col pr-4">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Search</span>
            <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-1.5 py-1.5 outline-none focus-within:ring-2  focus-within:ring-primary/20">
              <span className="material-symbols-rounded text-gray-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Search by name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 outline-none text-xs rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Career Path List */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h5 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Active Assignments</h5>
          <div className="space-y-3">
            {filteredAndSortedPaths.length > 0 ? (
              filteredAndSortedPaths.map((cp: any) => (
                <button
                  key={cp.id}
                  onClick={() => setSelectedPath(cp)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedPath?.id === cp.id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-100 hover:border-primary/50'
                    }`}
                >
                  <div className="text-xs font-bold text-gray-500 uppercase">Target Role</div>
                  <p className="font-bold text-gray-900 mt-1">{cp.target_role_name}</p>
                  <div className="text-[10px] text-gray-500 mt-2">
                    User: {cp.profiles?.fullname || cp.user_id}
                    {cp.profiles?.department && ` (${cp.profiles.department})`}
                  </div>
                  <div className="text-[10px] text-gray-500">From: {cp.source_role_name}</div>
                  {cp.target_date && (
                    <div className="text-[10px] text-orange-600 mt-1">
                      Due: {new Date(cp.target_date).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${cp.readiness_percentage || 0}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-primary">{cp.readiness_percentage || 0}%</span>
                  </div>
                  <div className="text-[9px] text-gray-400 mt-2">
                    {cp.status === 'Completed' ? (
                      <span className="text-green-600">Completed</span>
                    ) : cp.status === 'Ready for Promotion' ? (
                      <span className="text-orange-600">Ready for Promotion</span>
                    ) : (
                      <span>In Progress</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-gray-400 text-sm italic py-4">No career paths match the current filters</p>
            )}
          </div>
        </div>

        {/* Selected Path Details & Required vs Achieved Skills Comparison */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPath ? (
            <>
              {/* Header with Metrics */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Career Path Overview</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Readiness Score</p>
                    <p className="text-3xl font-black text-primary mt-1">{selectedPath.readiness_percentage || 0}%</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Target Date</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {selectedPath.target_date ? new Date(selectedPath.target_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-2xl">
                    <p className="text-[10px] text-green-600 uppercase font-bold">Required Met</p>
                    <p className="text-3xl font-black text-green-600 mt-1">{skillAnalysis.met.length}/{skillAnalysis.required.length}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-2xl">
                    <p className="text-[10px] text-red-600 uppercase font-bold">Skill Gaps</p>
                    <p className="text-3xl font-black text-red-600 mt-1">{skillAnalysis.gaps.length}</p>
                  </div>
                </div>
              </div>

              {/* Required Skills vs Achieved */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                  Required Skills Analysis
                </h5>

                {/* Skills Met */}
                {skillAnalysis.met.length > 0 && (
                  <div className="mb-6">
                    <div className="text-xs font-bold text-green-600 uppercase mb-3 flex items-center gap-2">
                      <span className="material-symbols-rounded text-sm">check_circle</span>
                      Skills Met ({skillAnalysis.met.length})
                    </div>
                    <div className="space-y-2">
                      {skillAnalysis.met.map((skill: any, i: number) => (
                        <div key={i} className="p-3 bg-green-50 rounded-2xl">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-bold text-gray-900 text-xs">{skill.name}</p>
                              <p className="text-[9px] text-green-600">
                                <strong>{skill.required_level}</strong> → Achieved: <strong>{skill.achieved_level}</strong>
                              </p>
                              {skill.course && <p className="text-[9px] text-gray-500 mt-1">{skill.course}</p>}
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                              ✓ {skill.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills In Progress */}
                {skillAnalysis.inProgress.length > 0 && (
                  <div className="mb-6">
                    <div className="text-xs font-bold text-orange-600 uppercase mb-3 flex items-center gap-2">
                      <span className="material-symbols-rounded text-sm">schedule</span>
                      In Progress ({skillAnalysis.inProgress.length})
                    </div>
                    <div className="space-y-2">
                      {skillAnalysis.inProgress.map((skill: any, i: number) => (
                        <div key={i} className="p-3 bg-orange-50 rounded-2xl">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="flex-1">
                              <p className="font-bold text-gray-900 text-xs">{skill.name}</p>
                              <p className="text-[9px] text-orange-600">
                                <strong>{skill.required_level}</strong> → Achieved: <strong>{skill.achieved_level}</strong>
                              </p>
                              {skill.course && <p className="text-[9px] text-gray-500 mt-1">{skill.course}</p>}
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 transition-all duration-500"
                              style={{ width: `${skill.percentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[9px] text-gray-500">{skill.percentage}%</span>
                            {skill.completed_at && (
                              <span className="text-[9px] text-gray-400">Started: {new Date(skill.completed_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills Not Started (Gaps) */}
                {skillAnalysis.gaps.length > 0 && (
                  <div className="mb-6">
                    <div className="text-xs font-bold text-red-600 uppercase mb-3 flex items-center gap-2">
                      <span className="material-symbols-rounded text-sm">warning</span>
                      Missing Skills ({skillAnalysis.gaps.length})
                    </div>
                    <div className="space-y-2">
                      {skillAnalysis.gaps.map((skill: any, i: number) => (
                        <div key={i} className="p-3 bg-red-50 rounded-2xl border-l-2 border-red-500">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-bold text-gray-900 text-xs">{skill.name}</p>
                              <p className="text-[9px] text-red-600">
                                Level: <strong>{skill.required_level}</strong> | Status: <strong>Not Started</strong>
                              </p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap">
                              Missing
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Skills Acquired */}
                {skillAnalysis.additional && skillAnalysis.additional.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2">
                      <span className="material-symbols-rounded text-sm">star</span>
                      Bonus Skills ({skillAnalysis.additional.length})
                    </div>
                    <div className="space-y-2">
                      {skillAnalysis.additional.slice(0, 5).map((skill: any, i: number) => (
                        <div key={i} className="p-3 bg-blue-50 rounded-2xl">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-bold text-gray-900 text-xs">{skill.skill_name}</p>
                              <p className="text-[9px] text-blue-600">
                                <strong>{skill.course_level}</strong>
                              </p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {skill.percentage_achieved || 0}%
                            </span>
                          </div>
                        </div>
                      ))}
                      {skillAnalysis.additional && skillAnalysis.additional.length > 5 && (
                        <p className="text-xs text-gray-500 italic pt-2">+{skillAnalysis.additional.length - 5} more bonus skills</p>
                      )}
                    </div>
                  </div>
                )}

                {skillAnalysis.required.length === 0 && (
                  <p className="text-center text-gray-400 text-sm italic py-8">No skill requirements defined for this career path</p>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-center text-gray-400 text-sm italic">Select a career path to view details</p>
            </div>
          )
          }
        </div >
      </div >
    </div >
  );
};

const SkillGapDashboard = ({ gapData }: { gapData: any[] }) => {
  const [deptFilter, setDeptFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [userSearch, setUserSearch] = useState('');

  const depts = ['All', ...new Set(gapData.map(d => d.department))].sort();
  const courses = ['All', ...new Set(gapData.filter(d => d.course_title).map(d => d.course_title))].sort();

  const filteredData = gapData.filter(d => {
    const matchDept = deptFilter === 'All' || d.department === deptFilter;
    const matchCourse = courseFilter === 'All' || d.course_title === courseFilter;
    const matchUser = userSearch === '' || d.fullname?.toLowerCase().includes(userSearch.toLowerCase());
    return matchDept && matchCourse && matchUser;
  });

  // Helpers to support various backend field namings
  const getUserKey = (d: any) => d.user_id || d.user_id || d.userId || d.user || d.userIdText || d.id || (d.fullname ? `name:${d.fullname}` : 'unknown');
  const getDisplayName = (d: any) => d.fullname || d.full_name || d.username || d.name || 'Unknown';
  const getStatusRaw = (d: any) => (d.status || d.state || '').toString().toLowerCase();
  const getDueValue = (d: any) => d.due_date || d.target_date || d.assignment_due_date || d.due || d.dueDate || d.targetDate || d.assigned_at;
  const getCurrentProf = (d: any) => Number(d.current_proficiency ?? d.percentage_achieved ?? d.percentage ?? d.completionpercentage ?? 0);

  // Per-learner aggregated stats used for Risk / Completion Ratio / Overdue indicators
  const perLearnerStats = React.useMemo(() => {
    const map: Record<string, any> = {};
    const now = new Date();
    filteredData.forEach((d: any) => {
      const key = getUserKey(d);
      if (!map[key]) map[key] = { name: getDisplayName(d), totalReq: 0, achieved: 0, pending: 0, overdue: 0 };

      const status = getStatusRaw(d);
      const isReq = status === 'gap' || status === 'met' || status === 'required' || status === 'missing';
      if (isReq) map[key].totalReq++;
      if (status === 'met' || status === 'achieved') map[key].achieved++;
      else if (isReq) map[key].pending++;

      const due = getDueValue(d);
      if (due) {
        const dueDate = new Date(due);
        if (isReq && status !== 'met' && dueDate < now) map[key].overdue++;
      }
    });

    Object.keys(map).forEach(k => {
      const s = map[k];
      s.completionRatio = s.totalReq > 0 ? Math.round((s.achieved / s.totalReq) * 100) : 0;
    });

    return map;
  }, [filteredData]);

  const aggregatedBySkill = React.useMemo(() => {
    const skills: Record<string, { total_req: number, total_met: number, avg_prof: number, count: number }> = {};
    filteredData.forEach((d: any) => {
      const skillName = d.skill_name || d.skill || d.skill_id || 'Unknown Skill';
      if (!skills[skillName]) {
        skills[skillName] = { total_req: 0, total_met: 0, avg_prof: 0, count: 0 };
      }
      const status = getStatusRaw(d);
      if (status === 'gap' || status === 'met' || status === 'required') skills[skillName].total_req++;
      if (status === 'met' || status === 'achieved') skills[skillName].total_met++;
      skills[skillName].avg_prof += getCurrentProf(d);
      skills[skillName].count++;
    });
    return Object.entries(skills).map(([name, s]) => ({
      name,
      req_pct: s.total_req > 0 ? Math.round((s.total_met / s.total_req) * 100) : 0,
      avg_prof: s.count > 0 ? Math.round(s.avg_prof / s.count) : 0,
      is_critical: s.total_req > 0 && (s.total_met / s.total_req) < 0.4
    })).sort((a, b) => a.req_pct - b.req_pct);
  }, [filteredData]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-rounded text-indigo-500">radar</span>
            Required vs Available Skills
          </h4>
          <p className="text-xs text-gray-500 mt-1">Analyzing gaps between assigned courses and user skill sets.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Search Learner</span>
            <input
              type="text"
              placeholder="Name..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="text-xs bg-white border border-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 min-w-[150px]"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Course</span>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="text-xs bg-white border border-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 min-w-[150px]"
            >
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Department</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs bg-white border border-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 min-w-[120px]"
            >
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h5 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider flex items-center justify-between">
            Organization Skill Fulfillment
            <span className="text-[10px] font-normal text-gray-500">Target: 100%</span>
          </h5>
          <div className="space-y-6">
            {aggregatedBySkill.length > 0 ? (
              aggregatedBySkill.slice(0, 10).map((skill, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-900 flex items-center gap-2">
                      {skill.name}
                      {skill.is_critical && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded uppercase">
                          <span className="material-symbols-rounded text-[10px]">warning</span>
                          Critical
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{skill.req_pct}% Met</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${skill.req_pct < 40 ? 'bg-red-500' : skill.req_pct < 75 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                      style={{ width: `${skill.req_pct}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-sm italic py-10">No skill requirement data found</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h5 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Critical Individual Gaps</h5>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-4">Learner</th>
                  <th className="pb-4">Requirement Source</th>
                  <th className="pb-4">Skill</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.filter(d => getStatusRaw(d) === 'gap').length > 0 ? (
                  filteredData.filter(d => getStatusRaw(d) === 'gap').slice(0, 15).map((gap, i) => {
                    const key = getUserKey(gap);
                    const displayName = getDisplayName(gap);
                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-xs font-bold text-gray-900">
                          <div className="flex flex-col">
                            <span>{displayName}</span>
                            <span className="text-[9px] text-gray-400 font-normal">{gap.department}</span>
                            <span className="text-[9px] text-gray-500 mt-1">Completion: {perLearnerStats[key]?.completionRatio ?? 0}%</span>
                          </div>
                        </td>
                        <td className="py-3 text-[10px] text-gray-500 italic max-w-[150px] truncate">
                          {gap.course_title || 'Mandatory Skill'}
                        </td>
                        <td className="py-3 text-xs text-gray-600 font-bold">{gap.skill_name}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Gap</span>
                            {(() => {
                              const due = getDueValue(gap);
                              if (due) {
                                const dueDate = new Date(due);
                                if (dueDate < new Date()) {
                                  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>;
                                }
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="py-3">
                          {(() => {
                            const ratio = perLearnerStats[key]?.completionRatio ?? 0;
                            const label = ratio <= 30 ? 'High' : ratio <= 70 ? 'Medium' : 'Low';
                            const color = label === 'High' ? 'bg-red-50 text-red-600' : label === 'Medium' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600';
                            return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
                          })()}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400 text-sm italic">No missing skills identified</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;

