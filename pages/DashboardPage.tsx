import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { durationService } from '../lib/durationService';
import { lessonProgressService } from '../lib/lessonProgressService';
import { userStatisticsService } from '../lib/userStatisticsService';
import { leaderboardService } from '../lib/leaderboardService';
import { enrollmentService } from '../lib/enrollmentService';
import PlatformTutorial from '../components/PlatformTutorial';

const StatCard: React.FC<{ title: string; value: string; icon: string; color: string; trend?: string }> = ({ title, value, icon, color, trend }) => (
  <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-slate-100 flex items-start justify-between">
    <div>
      <p className="text-slate-500 text-xs md:text-sm font-medium mb-1">{title}</p>
      <h3 className="text-xl md:text-2xl font-bold text-slate-900">{value}</h3>
      {trend && <p className="text-xs text-green-600 mt-2 font-medium flex items-center gap-1"><span className="material-symbols-rounded text-sm">trending_up</span> {trend}</p>}
    </div>
    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}>
      <span className="material-symbols-rounded text-white text-lg md:text-xl">{icon}</span>
    </div>
  </div>
);

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    coursesInProgress: 0,
    coursesCompleted: 0,
    hoursLearned: 0,
    certificatesEarned: 0
  });
  const [topLearners, setTopLearners] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unenrollModal, setUnenrollModal] = useState<{ isOpen: boolean; courseId: string; courseName: string }>({
    isOpen: false,
    courseId: '',
    courseName: ''
  });
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Check if user has completed tutorial on mount
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem(`tutorial_completed_${user?.id}`);
    if (!tutorialCompleted && user?.id) {
      // Show tutorial to first-time users
      setShowTutorial(true);
    }
  }, [user?.id]);

  // Listen for tutorial restart event from Sidebar
  useEffect(() => {
    const handleRestartTutorial = () => {
      if (user?.id) {
        // Clear the completion flag
        localStorage.removeItem(`tutorial_completed_${user.id}`);
        // Show tutorial immediately
        setShowTutorial(true);
      }
    };

    window.addEventListener('restart-tutorial', handleRestartTutorial);
    return () => window.removeEventListener('restart-tutorial', handleRestartTutorial);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user?.id]);

  // Helper: Timeout wrapper for queries
  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 10000, label = ''): Promise<T> => {
    const timeoutId = setTimeout(() => {
      console.error(`⏱️ TIMEOUT: ${label} exceeded ${timeoutMs}ms`);
    }, timeoutMs);

    try {
      const result = await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms - ${label}`)), timeoutMs)
        )
      ]);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const fetchUserData = async () => {
    if (!user?.id) return;

    setLoading(true);
    setLoadingError(null);
    try {
      console.log('🔷 Fetching user data for user:', user.id);

      // Fetch profile
      console.log('⏳ Fetching profile...');
      const profileRes = await withTimeout(
        supabase
          .from('profiles')
          .select('fullname')
          .eq('id', user.id)
          .single(),
        10000,
        'profiles.select(id)'
      );

      if (profileRes.error) {
        console.error('❌ Profile fetch error:', profileRes.error);
      } else if (profileRes.data) {
        setUserProfile(profileRes.data);
      }
      console.log('📋 Profile fetched:', { error: profileRes.error?.message, data: profileRes.data });

      // Fetch enrollments first
      console.log('⏳ Fetching enrollments...');
      const allEnrollmentsRes = await withTimeout(
        supabase
          .from('enrollments')
          .select('id, progress, completed, hoursspent, courseid, lastaccessedat')
          .eq('userid', user.id)
          .order('lastaccessedat', { ascending: false }),
        10000,
        'enrollments.select(userid)'
      );

      console.log('📚 Enrollments response:', {
        error: allEnrollmentsRes.error,
        count: allEnrollmentsRes.data?.length || 0,
        data: allEnrollmentsRes.data?.slice(0, 3) // Show first 3 enrollments
      });

      let allEnrollments = allEnrollmentsRes.data || [];

      // Fetch course details separately to avoid join issues
      if (allEnrollments.length > 0) {
        const courseIds = allEnrollments
          .map((e: any) => e.courseid)
          .filter((id: any, idx: number, arr: any[]) => arr.indexOf(id) === idx); // Remove duplicates

        console.log('🎓 Course IDs to fetch:', courseIds);

        if (courseIds.length > 0) {
          try {
            console.log('⏳ Fetching course details...', { courseIds: courseIds.length });
            const coursesRes = await withTimeout(
              supabase
                .from('courses')
                .select('id, title, certificate_enabled, duration, thumbnail, instructorname, category, totalstudents')
                .in('id', courseIds),
              15000,
              `courses.select(${courseIds.length} ids)`
            );

            console.log('🖼️ Courses response:', {
              error: coursesRes.error,
              count: coursesRes.data?.length || 0,
              took: 'see timestamp above'
            });

            const courseMap = new Map();
            if (coursesRes.data) {
              coursesRes.data.forEach((course: any) => {
                courseMap.set(course.id, course);
              });
              console.log('📍 CourseMap built with', courseMap.size, 'courses');
            }

            console.log('🔀 Before merge - allEnrollments:', allEnrollments.length);
            console.log('📌 Enrollment sample:', allEnrollments.slice(0, 2).map((e: any) => ({
              id: e.id,
              courseid: e.courseid,
              completed: e.completed
            })));

            // Merge courses into enrollments
            allEnrollments = allEnrollments
              .map((e: any) => ({
                ...e,
                courses: courseMap.get(e.courseid),
              }))
              .filter((e: any) => {
                if (!e.courses) {
                  console.log('🚫 Filtering out enrollment with no course:', e.courseid);
                  return false;
                }
                return true;
              });

            console.log('🔗 After merging courses:', allEnrollments.length, 'enrollments with course data');
          } catch (coursesErr: any) {
            console.error('❌ Error fetching courses:', {
              message: coursesErr?.message,
              code: coursesErr?.code
            });
            // Still continue with empty course list
          }
        } else {
          console.log('⚠️ No course IDs found');
        }
      } else {
        console.log('⚠️ No enrollments found');
      }

      // Calculate stats from enrollments
      const coursesInProgress = allEnrollments.filter((e: any) => !e.completed).length;

      // Certificates earned: count only completed courses with certificate_enabled = true
      const certificatesEarned = allEnrollments.filter((e: any) =>
        e.completed && e.courses?.certificate_enabled === true
      ).length;

      // Calculate total learning hours from enrollments' hoursspent
      const totalMinutes = allEnrollments.reduce((sum: number, e: any) => sum + (e.hoursspent || 0), 0);
      const hoursLearned = Math.round(totalMinutes / 60);

      console.log('📊 Stats calculated:', {
        coursesInProgress,
        coursesCompleted: allEnrollments.filter((e: any) => e.completed).length,
        hoursLearned,
        certificatesEarned
      });

      setStats({
        coursesInProgress,
        coursesCompleted: allEnrollments.filter((e: any) => e.completed).length,
        hoursLearned: hoursLearned,
        certificatesEarned,
      });

      // Fetch user rank and top learners
      try {
        const userRankData = await leaderboardService.getUserRank(user.id);
        setUserRank(userRankData);
        console.log('🏆 User rank fetched:', userRankData);
      } catch (err) {
        console.error('❌ Error fetching user rank:', err);
      }

      try {
        const topLearnersData = await leaderboardService.getTopUsers(5);
        setTopLearners(topLearnersData);
        console.log('⭐ Top learners fetched:', topLearnersData?.length || 0, 'users');
      } catch (err) {
        console.error('❌ Error fetching top learners:', err);
      }

      const inProgressEnrollments = allEnrollments.filter((e: any) => {
        return !e.completed; // Only show incomplete courses in "Continue Learning"
      });

      console.log('🚀 In-progress enrollments:', inProgressEnrollments.length);
      console.log('📋 In-progress enrollment details:', inProgressEnrollments.map((e: any) => ({
        id: e.id,
        courseid: e.courseid,
        hasCoursesObject: !!e.courses,
        courseTitle: e.courses?.title,
        completed: e.completed
      })));

      if (inProgressEnrollments && inProgressEnrollments.length > 0) {
        // Fetch course IDs for in-progress courses
        const courseIds = inProgressEnrollments
          .filter((e: any) => e.courses?.id)
          .map((e: any) => e.courses.id);

        console.log('🎯 Course IDs to fetch lessons for:', courseIds);

        if (courseIds.length > 0) {
          try {
            console.log('⏳ Fetching lessons...');
            const lessonCountsRes = await withTimeout(
              supabase
                .from('lessons')
                .select('courseid, id')
                .in('courseid', courseIds),
              10000,
              `lessons.select(${courseIds.length} courses)`
            );

            console.log('📖 Lessons fetch:', {
              error: lessonCountsRes.error?.message,
              count: lessonCountsRes.data?.length || 0
            });

            const lessonsByCourseBefore: Record<string, string[]> = {};
            if (lessonCountsRes.data) {
              lessonCountsRes.data.forEach((lesson: any) => {
                if (!lessonsByCourseBefore[lesson.courseid]) {
                  lessonsByCourseBefore[lesson.courseid] = [];
                }
                lessonsByCourseBefore[lesson.courseid].push(lesson.id);
              });
            }

            console.log('⏳ Fetching lesson progress...');
            const lessonProgressRes = await withTimeout(
              supabase
                .from('lesson_progress')
                .select('courseid, lessonid, completed')
                .eq('userid', user.id)
                .in('courseid', courseIds),
              10000,
              `lesson_progress.select(userid, ${courseIds.length} courses)`
            );

            const completedLessonsByCourseBefore: Record<string, number> = {};
            if (lessonProgressRes.data) {
              lessonProgressRes.data.forEach((progress: any) => {
                if (progress.completed) {
                  if (!completedLessonsByCourseBefore[progress.courseid]) {
                    completedLessonsByCourseBefore[progress.courseid] = 0;
                  }
                  completedLessonsByCourseBefore[progress.courseid]++;
                }
              });
            }

            const courses = inProgressEnrollments
              .map((enrollment: any) => {
                const course = enrollment.courses;
                if (!course) {
                  console.warn('⚠️ Missing course data for enrollment:', enrollment.id);
                  return null;
                }

                const totalLessons = lessonsByCourseBefore[course.id]?.length || 0;
                const completedLessons = completedLessonsByCourseBefore[course.id] || 0;
                const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

                console.log(`📚 Mapping course: ${course.title}`, {
                  courseId: course.id,
                  totalLessons,
                  completedLessons,
                  progressPercentage
                });

                return {
                  id: course.id,
                  title: course.title || 'Untitled Course',
                  instructor: course.instructorname || 'Unknown Instructor',
                  thumbnail: course.thumbnail || 'https://picsum.photos/400/225?random=1',
                  progress: progressPercentage,
                  completedLessons: completedLessons,
                  totalLessons: totalLessons,
                  category: course.category || 'General',
                  rating: 4.8,
                  duration: durationService.formatDurationForDisplay(course.duration || 0),
                  totalstudents: course.totalstudents || 0,
                  level: 'Intermediate',
                };
              })
              .filter(Boolean) as Course[];

            console.log('✅ Final mapped courses for Continue Learning:', courses.length);
            if (courses.length === 0) {
              console.warn('⚠️ No courses mapped! inProgressEnrollments:', inProgressEnrollments.length);
            }

            setEnrolledCourses(courses);
          } catch (lessonErr: any) {
            console.error('❌ Error fetching lessons/progress:', {
              message: lessonErr?.message,
              code: lessonErr?.code,
              stack: lessonErr?.stack
            });
            // Still show stats even if lesson data fails
            console.warn('⚠️ Setting enrolledCourses to empty due to error');
            setEnrolledCourses([]);
          }
        } else {
          console.log('⚠️ No course IDs found in in-progress enrollments');
          setEnrolledCourses([]);
        }
      } else {
        console.log('⚠️ No in-progress enrollments found');
        setEnrolledCourses([]);
      }

      console.log('✅ User data fetch complete');
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to load dashboard data';
      console.error('❌ Error fetching user data:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      setLoadingError(errorMsg);
      // Set default empty/zero values for stats so page doesn't break
      setStats({
        coursesInProgress: 0,
        coursesCompleted: 0,
        hoursLearned: 0,
        certificatesEarned: 0
      });
      setEnrolledCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!user?.id || !unenrollModal.courseId) return;

    setIsUnenrolling(true);
    try {
      await enrollmentService.unenrollCourse(user.id, unenrollModal.courseId);

      // Refresh the course list
      await fetchUserData();

      // Close modal and show success message
      setUnenrollModal({ isOpen: false, courseId: '', courseName: '' });
    } catch (error) {
      console.error('Error unenrolling from course:', error);
      alert('Failed to unenroll from course. Please try again.');
    } finally {
      setIsUnenrolling(false);
    }
  };

  const openUnenrollModal = (courseId: string, courseName: string) => {
    setUnenrollModal({ isOpen: true, courseId, courseName });
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const firstName = userProfile?.fullname?.split(' ')[0] || 'User';

  const handleTutorialComplete = () => {
    localStorage.setItem(`tutorial_completed_${user?.id}`, 'true');
    setShowTutorial(false);
  };

  return (
    <>
      <PlatformTutorial
        isOpen={showTutorial}
        onClose={() => {
          handleTutorialComplete();
        }}
        onComplete={handleTutorialComplete}
      />
      <div className="space-y-8">
        {/* Error Banner */}
        {loadingError && (
          <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-100">Failed to Load Dashboard</h3>
                <p className="text-sm text-red-700 dark:text-red-200 mt-1">{loadingError}</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-2">If you see a 403 error in the console, the database RLS policies may need updating. Try refreshing the page.</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-slate-900">Hello, {firstName}! 👋</h1>
            <p className="text-slate-500">Let's learn something new today.</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-sm font-medium hover:bg-slate-50 transition-colors">
              View Reports
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatCard title="Courses in Progress" value={stats.coursesInProgress.toString()} icon="book" color="bg-blue-500" />
          <StatCard title="Courses Completed" value={stats.coursesCompleted.toString()} icon="check_circle" color="bg-green-500" />
          <StatCard title="Hours Learned" value={`${stats.hoursLearned}h`} icon="schedule" color="bg-indigo-500" />
          <StatCard title="Certificates Earned" value={stats.certificatesEarned.toString()} icon="workspace_premium" color="bg-yellow-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Continue Learning - Main Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Continue Learning</h2>
              <button onClick={() => navigate('/catalog')} className="text-primary-600 text-sm font-medium hover:underline">View All</button>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
                    <p className="text-slate-600">Loading courses...</p>
                  </div>
                </div>
              ) : enrolledCourses.length === 0 ? (
                <div className="bg-white p-8 rounded-md border border-slate-100 text-center">
                  <span className="material-symbols-rounded text-5xl text-slate-300 block mb-3">school</span>
                  <p className="text-slate-600 font-medium mb-2">No courses yet</p>
                  <p className="text-slate-500 text-sm mb-4">Explore our catalog and start learning</p>
                  <button onClick={() => navigate('/catalog')} className="text-primary-600 font-medium hover:underline">Browse Courses</button>
                </div>
              ) : (
                enrolledCourses.map((course) => (
                  <div key={course.id} className="bg-white p-4 rounded-md border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => navigate(`/course/${course.id}`)}>
                    {/* Unenroll Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openUnenrollModal(course.id, course.title);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                      title="Unenroll from this course"
                    >
                      <span className="material-symbols-rounded text-sm">close</span>
                    </button>

                    <div className="relative w-full sm:w-48 h-32 flex-shrink-0">
                      <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover rounded" />
                      <div className="absolute inset-0 bg-black/10 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <span className="material-symbols-rounded text-primary-600">play_arrow</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded uppercase tracking-wider">{course.category}</span>
                        </div>
                        <h3 className="font-bold text-slate-900 mb-1">{course.title}</h3>
                        <p className="text-sm text-slate-500">by {course.instructor}</p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-rounded text-base">schedule</span>
                            {course.duration}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-rounded text-base">people</span>
                            {course.totalstudents} learners
                          </div>
                        </div>

                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium text-slate-700">{course.progress}% Complete</span>
                          <span className="text-slate-400">{course.completedLessons}/{course.totalLessons} Lessons</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${course.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column - Leaderboard & Activity */}
          <div className="space-y-6">
            {/* Daily Goal */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-1">Daily Goal</h3>
                <p className="text-slate-300 text-sm mb-4">Keep your streak alive!</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold">45</span>
                  <span className="text-sm text-slate-400 mb-1">/ 60 mins</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 mb-1">
                  <div className="bg-green-400 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              <span className="material-symbols-rounded absolute -right-4 -bottom-4 text-9xl text-white/5 rotate-12">timer</span>
            </div>

            {/* Leaderboard */}
            <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">Top Learners</h3>
                  {userRank && <p className="text-xs text-slate-500">Your Rank: #{userRank.rank || 'N/A'}</p>}
                </div>
              </div>
              <div className="space-y-4">
                {topLearners.length > 0 ? (
                  topLearners.map((learner: any, index: number) => {
                    const profile = learner.profiles;
                    const name = profile?.fullname || learner.username;
                    const avatar = profile?.avatarurl || learner.useravatar || `https://i.pravatar.cc/150?u=${learner.userid}`;

                    return (
                      <div key={learner.userid} className="flex items-center gap-3">
                        <span className={`text-sm font-bold w-4 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-orange-400' : 'text-slate-400'}`}>
                          {index + 1}
                        </span>
                        <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{name}</p>
                          <p className="text-xs text-slate-500">{learner.totalpoints.toLocaleString()} XP</p>
                        </div>
                        {index === 0 && <span className="material-symbols-rounded text-yellow-500 text-lg">emoji_events</span>}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No leaderboard data yet</p>
                )}
              </div>
              <button onClick={() => navigate('/leaderboard')} className="w-full mt-4 text-sm text-slate-500 hover:text-primary-600 font-medium border-t border-slate-50 pt-3">
                View Full Leaderboard
              </button>
            </div>
          </div>
        </div>

        {/* Unenroll Confirmation Modal */}
        {unenrollModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
                <span className="material-symbols-rounded text-red-600 text-xl">warning</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Unenroll from Course?</h3>
              <p className="text-slate-600 text-center mb-1">
                Are you sure you want to unenroll from <span className="font-semibold">{unenrollModal.courseName}</span>?
              </p>
              <p className="text-slate-500 text-sm text-center mb-6">
                This will delete all your progress and lessons completed in this course. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUnenrollModal({ isOpen: false, courseId: '', courseName: '' })}
                  disabled={isUnenrolling}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnenroll}
                  disabled={isUnenrolling}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUnenrolling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Unenrolling...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-lg">delete</span>
                      Unenroll
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div >
    </>
  );
};

export default DashboardPage;