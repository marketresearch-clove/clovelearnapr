import { supabase } from './supabaseClient';
import { cacheService } from './cacheService';

// Diagnostic function to test database connectivity
export async function testDatabaseConnectivity() {
  try {
    console.log('🔍 Testing database connectivity...');

    // Test 1: Check if user is authenticated
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      throw new Error('Not authenticated. Please log in first.');
    }
    console.log(`✅ Authenticated as user: ${authData.user.id}`);

    // Test 2: Try a simple count query on courses
    const { data: courseCount, error: courseError } = await supabase
      .from('courses')
      .select('id', { count: 'exact' })
      .limit(1);

    if (courseError) {
      throw new Error(`Courses table access failed: ${courseError.message} (${courseError.code})`);
    }
    console.log(`✅ Courses table accessible`);

    // Test 3: Try a simple count query on profiles
    const { data: profileCount, error: profileError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .limit(1);

    if (profileError) {
      throw new Error(`Profiles table access failed: ${profileError.message} (${profileError.code})`);
    }
    console.log(`✅ Profiles table accessible`);

    return {
      success: true,
      message: 'Database connectivity OK',
      userId: authData.user.id
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Database connectivity test failed:', errorMsg);
    return {
      success: false,
      message: errorMsg
    };
  }
}

export interface Course {
  id?: string;
  title: string;
  instructorid: string;
  instructorname: string;
  category: string;
  totalstudents: number;
  completionrate: number;
  status: 'published' | 'draft';
  thumbnail: string;
  description?: string;
  createdat?: string;
  updatedat?: string;
  level?: string;
  duration?: number;
  averagerating?: number;
  is_mandatory?: boolean;
  certificate_enabled?: boolean;
  is_hidden?: boolean;
}

export interface CourseWithAssignmentStatus extends Course {
  assignment_status?: 'assigned' | 'not_assigned';
  is_mandatory_for_user?: boolean;
  due_date?: string;
  progress?: number;
  completion_status?: 'completed' | 'in_progress' | 'not_started';
}

export const courseService = {
  async getCourses() {
    try {
      console.log('🔄 Fetching courses from Supabase...');

      // Check cache first
      const cacheKey = 'cache:all_courses';
      const cached = cacheService.get<any[]>(cacheKey);
      if (cached) {
        console.log('[COURSE CACHE] Using cached all courses');
        return cached;
      }

      // Fetch courses
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('*');

      if (coursesError) {
        console.error('❌ Courses query error:', coursesError.message, coursesError.code);
        throw new Error(`Courses fetch failed: ${coursesError.message} (${coursesError.code})`);
      }

      console.log(`✅ Courses loaded: ${courses?.length || 0} records`);

      // Use cached enrollments and lessons if available
      const enrollmentsCacheKey = 'cache:all_enrollments_summary';
      let enrollmentsData = cacheService.get<any[]>(enrollmentsCacheKey);

      if (!enrollmentsData) {
        // Fetch ALL enrollments without limit - explicitly use a very high range to bypass pagination
        const { data: enrollments, error: enrollmentsError, count } = await supabase
          .from('enrollments')
          .select('courseid, completed, progress', { count: 'exact' })
          .range(0, 999999); // Fetch up to 1M records to bypass pagination

        if (enrollmentsError) {
          console.warn('⚠️ Enrollments fetch warning (continuing):', enrollmentsError.message);
        }
        enrollmentsData = enrollments || [];
        console.log(`[COURSE] Fetched ${enrollmentsData.length} total enrollments (count: ${count})`);
        // Cache for 10 minutes
        cacheService.set(enrollmentsCacheKey, enrollmentsData, 10 * 60 * 1000);
      } else {
        console.log('[COURSE] Using cached enrollments for admin');
      }

      // Fetch feedback data with caching
      const feedbackCacheKey = 'cache:course_feedback_summary';
      let feedbackData = cacheService.get<any[]>(feedbackCacheKey);

      if (!feedbackData) {
        const { data: feedback } = await supabase
          .from('course_feedback')
          .select('courseid, rating')
          .range(0, 999999); // Fetch up to 1M records to bypass pagination

        feedbackData = feedback || [];
        console.log(`[COURSE] Fetched ${feedbackData.length} feedback records`);
        cacheService.set(feedbackCacheKey, feedbackData, 15 * 60 * 1000);
      } else {
        console.log('[COURSE] Using cached feedback data');
      }

      // Get lessons for all courses - use cache
      const lessonsCacheKey = 'cache:all_lessons_summary';
      let lessonsData = cacheService.get<any[]>(lessonsCacheKey);

      if (!lessonsData) {
        const { data: allLessons } = await supabase
          .from('lessons')
          .select('courseid, duration');

        lessonsData = allLessons || [];
        // Cache for 15 minutes
        cacheService.set(lessonsCacheKey, lessonsData, 15 * 60 * 1000);
      } else {
        console.log('[COURSE] Using cached lessons for admin');
      }

      const result = (courses || []).map((course: any) => {
        const courseEnrollments = enrollmentsData.filter((e: any) => e.courseid === course.id);
        const totalStudents = courseEnrollments.length;
        const completedStudents = courseEnrollments.filter((e: any) => e.completed).length;
        const completionRate = totalStudents > 0
          ? Math.round((completedStudents / totalStudents) * 100)
          : 0;

        // Calculate average rating from feedback
        const courseFeedback = feedbackData.filter((f: any) => f.courseid === course.id);
        const validRatings = courseFeedback
          .map((f: any) => f.rating)
          .filter((r: any) => r !== null && r !== undefined && !isNaN(r));
        const averagerating = validRatings.length > 0
          ? Math.round((validRatings.reduce((a: number, b: number) => a + b, 0) / validRatings.length) * 10) / 10
          : 0;

        // If course doesn't have duration, calculate from lessons
        let duration = course.duration;
        if (!duration || duration === 0) {
          const courseLessons = lessonsData.filter((l: any) => l.courseid === course.id);
          const totalMinutes = courseLessons.reduce((sum: number, lesson: any) => {
            const lessonDuration = lesson.duration || 0;
            return sum + lessonDuration;
          }, 0);
          duration = totalMinutes > 0 ? totalMinutes : 0;
        }

        return {
          ...course,
          duration,
          totalstudents: totalStudents,
          completionrate: completionRate,
          averagerating: averagerating
        };
      });

      // Cache result with 5 minute expiry for admin view
      const sizeInKB = new Blob([JSON.stringify(result)]).size / 1024;
      if (sizeInKB < 1024) {
        cacheService.set(cacheKey, result, 5 * 60 * 1000);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Fatal error fetching courses:', errorMsg);
      throw error;
    }
  },

  async getPublishedCourses() {
    try {
      // Check cache first
      const cacheKey = 'cache:published_courses';
      const cached = cacheService.get<any[]>(cacheKey);
      if (cached) {
        console.log('[COURSE CACHE] Using cached published courses');
        return cached;
      }

      // Try to fetch with is_hidden filter first
      const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'published')
        .neq('is_hidden', true) // Exclude courses that are explicitly hidden (handles NULL as not-hidden)
        .order('createdat', { ascending: false });

      // If column doesn't exist, fall back to fetching all published courses
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('is_hidden')) {
          console.warn('is_hidden column not found, fetching all published courses');
          return await this.getPublishedCoursesWithoutHiddenFilter();
        }
        console.error('Supabase error:', error.message, error.code, error.details);
        throw error;
      }

      const formattedCourses = await this.formatPublishedCourses(courses || []);

      // Only cache if data is reasonably sized (under 1MB to avoid quota issues)
      const sizeInKB = new Blob([JSON.stringify(formattedCourses)]).size / 1024;
      if (sizeInKB < 1024) {
        // Cache the result with 5 minute expiration (much shorter to avoid quota issues)
        cacheService.set(cacheKey, formattedCourses, 5 * 60 * 1000);
      } else {
        console.warn(`[COURSE] Published courses too large (${(sizeInKB / 1024).toFixed(2)}MB) - skipping cache`);
      }

      return formattedCourses;
    } catch (error) {
      console.error('Error in getPublishedCourses:', error);
      return await this.getPublishedCoursesWithoutHiddenFilter();
    }
  },

  async getPublishedCoursesWithoutHiddenFilter() {
    try {
      const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'published')
        .order('createdat', { ascending: false });

      if (error) throw error;
      return await this.formatPublishedCourses(courses || []);
    } catch (error) {
      console.error('Error fetching published courses (fallback):', error);
      return [];
    }
  },

  async formatPublishedCourses(courses: any[]) {
    try {
      // Fetch enrollment counts for these courses - with caching
      const enrollmentsCacheKey = 'cache:all_enrollments_summary';
      let enrollmentsData = cacheService.get<any[]>(enrollmentsCacheKey);

      if (!enrollmentsData) {
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('courseid')
          .range(0, 999999); // Fetch up to 1M records to bypass pagination

        if (enrollmentsError) {
          console.warn('Error fetching enrollments for published courses:', enrollmentsError);
          enrollmentsData = [];
        } else {
          enrollmentsData = enrollments || [];
          console.log(`[COURSE] Fetched ${enrollmentsData.length} total enrollments for published courses`);
          // Cache with 10 minute expiration since enrollment counts don't change as frequently
          cacheService.set(enrollmentsCacheKey, enrollmentsData, 10 * 60 * 1000);
        }
      } else {
        console.log('[COURSE] Using cached enrollments summary');
      }

      // Fetch feedback data for ratings - with caching
      const feedbackCacheKey = 'cache:course_feedback_summary';
      let feedbackData = cacheService.get<any[]>(feedbackCacheKey);

      if (!feedbackData) {
        const { data: feedback } = await supabase
          .from('course_feedback')
          .select('courseid, rating')
          .range(0, 999999); // Fetch up to 1M records to bypass pagination

        feedbackData = feedback || [];
        console.log(`[COURSE] Fetched ${feedbackData.length} feedback records for published courses`);
        cacheService.set(feedbackCacheKey, feedbackData, 15 * 60 * 1000);
      } else {
        console.log('[COURSE] Using cached feedback summary');
      }

      // Get lessons for all courses to calculate/fill in missing durations - with caching
      const lessonsCacheKey = 'cache:all_lessons_summary';
      let lessonsData = cacheService.get<any[]>(lessonsCacheKey);

      if (!lessonsData) {
        const { data: allLessons } = await supabase
          .from('lessons')
          .select('courseid, duration');

        lessonsData = allLessons || [];
        // Cache lessons with longer expiration since they change infrequently
        cacheService.set(lessonsCacheKey, lessonsData, 15 * 60 * 1000);
      } else {
        console.log('[COURSE] Using cached lessons summary');
      }

      return courses.map((course: any) => {
        // Calculate total students
        const totalStudents = enrollmentsData.filter((e: any) => e.courseid === course.id).length;

        // Calculate average rating from feedback
        const courseFeedback = feedbackData.filter((f: any) => f.courseid === course.id);
        const validRatings = courseFeedback
          .map((f: any) => f.rating)
          .filter((r: any) => r !== null && r !== undefined && !isNaN(r));
        const averagerating = validRatings.length > 0
          ? Math.round((validRatings.reduce((a: number, b: number) => a + b, 0) / validRatings.length) * 10) / 10
          : 0;

        // If course doesn't have duration, calculate from lessons
        let duration = course.duration;
        if (!duration || duration === 0) {
          const courseLessons = lessonsData.filter((l: any) => l.courseid === course.id);
          const totalMinutes = courseLessons.reduce((sum: number, lesson: any) => {
            const lessonDuration = lesson.duration || 0;
            return sum + lessonDuration;
          }, 0);
          duration = totalMinutes > 0 ? totalMinutes : 0;
        }

        return {
          ...course,
          duration,
          totalstudents: totalStudents,
          averagerating: averagerating
        };
      });
    } catch (error) {
      console.error('Error formatting published courses:', error);
      return [];
    }
  },

  async getCourseById(id: string) {
    try {
      // Check cache first
      const cacheKey = `cache:course:${id}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('[COURSE CACHE] Using cached course:', id);
        return cached;
      }

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Cache the result
      if (data) {
        cacheService.set(cacheKey, data, 10 * 60 * 1000); // 10 minute expiration
      }

      return data;
    } catch (error) {
      console.error('Error fetching course:', error);
      return null;
    }
  },

  async createCourse(course: Omit<Course, 'id' | 'createdat'>) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([{ ...course, createdat: new Date().toISOString() }])
        .select();

      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  },

  async updateCourse(id: string, updates: Partial<Course>) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error updating course:', error);
        return null;
      }

      // Invalidate all course-related caches after update
      this.clearCoursesCaches();

      return data ? data[0] : null;
    } catch (error) {
      console.error('Error updating course:', error);
      throw error;
    }
  },

  clearCoursesCaches() {
    console.log('🧹 Clearing all course caches...');
    try {
      if (cacheService && typeof cacheService.remove === 'function') {
        cacheService.remove('cache:all_courses');
        cacheService.remove('cache:published_courses');
        cacheService.remove('cache:all_enrollments_summary');
        cacheService.remove('cache:course_feedback_summary');
        cacheService.remove('cache:all_lessons_summary');
        console.log('✅ Course caches cleared successfully');
      } else {
        console.warn('[CACHE] cacheService.remove not available');
      }
    } catch (err) {
      console.warn('[CACHE] Error clearing caches:', err);
    }
  },

  async deleteCourse(id: string) {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Clear caches after deletion
      this.clearCoursesCaches();
    } catch (error) {
      console.error('Error deleting course:', error);
      throw error;
    }
  },

  async searchCourses(query: string) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching courses:', error);
      return [];
    }
  },

  async getUserAssignedCourses(userId: string): Promise<CourseWithAssignmentStatus[]> {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          courseid,
          is_mandatory,
          due_date,
          progress,
          completed,
          completedAt,
          courses(*)
        `)
        .eq('userid', userId)
        .eq('courses.status', 'published');

      if (error) throw error;

      return (data || []).map((enrollment: any) => ({
        ...enrollment.courses,
        assignment_status: 'assigned',
        is_mandatory_for_user: enrollment.is_mandatory,
        due_date: enrollment.due_date,
        progress: enrollment.progress,
        completion_status: enrollment.completed ? 'completed' : enrollment.progress > 0 ? 'in_progress' : 'not_started',
      }));
    } catch (error) {
      console.error('Error fetching user assigned courses:', error);
      return [];
    }
  },

  async getMandatoryCoursesForUser(userId: string): Promise<CourseWithAssignmentStatus[]> {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          courseid,
          is_mandatory,
          due_date,
          progress,
          completed,
          completedAt,
          courses(*)
        `)
        .eq('userid', userId)
        .eq('is_mandatory', true)
        .eq('courses.status', 'published');

      if (error) throw error;

      return (data || []).map((enrollment: any) => ({
        ...enrollment.courses,
        assignment_status: 'assigned',
        is_mandatory_for_user: true,
        due_date: enrollment.due_date,
        progress: enrollment.progress,
        completion_status: enrollment.completed ? 'completed' : enrollment.progress > 0 ? 'in_progress' : 'not_started',
      }));
    } catch (error) {
      console.error('Error fetching mandatory courses:', error);
      return [];
    }
  },

  async getCoursesByStatus(status: 'draft' | 'published') {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', status)
        .order('createdat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching courses by status:', error);
      return [];
    }
  },
};