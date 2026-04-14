import { supabase } from './supabaseClient';
import { timeTrackingService } from './timeTrackingService';

/**
 * Real-time Analytics Service
 * Provides real-time analytics for admin dashboard
 * All time values internally in SECONDS, displayed in HH:MM:SS
 */

export interface PeakActivityData {
  hour: number;
  activeUsers: number;
  lessonsCompleted: number;
  totalTimeSeconds: number;
}

export interface SessionMetrics {
  userId: string;
  userEmail: string;
  userName: string;
  totalSessions: number;
  avgSessionDurationSeconds: number;
  totalTimeSeconds: number;
  lastActivityAt: string;
}

export interface CoursePerformanceMetrics {
  courseId: string;
  courseTitle: string;
  totalEnrolled: number;
  completionRate: number;
  avgCompletionTimeSeconds: number;
  avgSessionDurationSeconds: number;
  moduleWiseMetrics: ModuleMetric[];
}

export interface ModuleMetric {
  moduleName: string;
  lessonsCompleted: number;
  avgTimeSeconds: number;
  completionRate: number;
}

export interface EngagementScore {
  userId: string;
  sessionCount: number;
  totalHours: number;
  consistency: number; // 0-100
  engagementLevel: 'High' | 'Medium' | 'Low';
}

export const realTimeAnalyticsService = {
  /**
   * Get peak activity hour (when most users are active)
   */
  async getPeakActivityHour(): Promise<PeakActivityData | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_peak_activity_hour');

      if (error) {
        console.warn('[ANALYTICS] Peak activity RPC not available, computing manually');
        return this.computePeakActivityHourManually();
      }

      return data;
    } catch (err) {
      console.error('[ANALYTICS] Error getting peak activity hour:', err);
      return this.computePeakActivityHourManually();
    }
  },

  /**
   * Compute peak activity hour manually (fallback)
   */
  async computePeakActivityHourManually(): Promise<PeakActivityData | null> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('session_start, duration_seconds, user_id')
        .gte('session_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('is_completed', true);

      if (error) throw error;

      // Count activities by hour
      const hourCounts: { [key: number]: { users: Set<string>; time: number } } = {};

      (data || []).forEach((session: any) => {
        const hour = new Date(session.session_start).getHours();
        if (!hourCounts[hour]) {
          hourCounts[hour] = { users: new Set(), time: 0 };
        }
        hourCounts[hour].users.add(session.user_id);
        hourCounts[hour].time += session.duration_seconds || 0;
      });

      // Find peak hour
      let peakHour = 0;
      let maxUsers = 0;
      for (const [hour, { users, time }] of Object.entries(hourCounts)) {
        if (users.size > maxUsers) {
          maxUsers = users.size;
          peakHour = parseInt(hour);
        }
      }

      return {
        hour: peakHour,
        activeUsers: maxUsers,
        lessonsCompleted: 0,
        totalTimeSeconds: hourCounts[peakHour]?.time || 0,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error computing peak hour manually:', error);
      return null;
    }
  },

  /**
   * Get average session duration per active user
   */
  async getAverageSessionDuration(): Promise<{
    avgDurationSeconds: number;
    avgDurationFormatted: string;
    activeUserCount: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('duration_seconds, user_id')
        .eq('is_completed', true)
        .gte('session_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const sessions = data || [];
      if (sessions.length === 0) {
        return {
          avgDurationSeconds: 0,
          avgDurationFormatted: '00:00:00',
          activeUserCount: 0,
        };
      }

      const totalSeconds = sessions.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
      const avgSeconds = Math.round(totalSeconds / sessions.length);
      const uniqueUsers = new Set(sessions.map((s: any) => s.user_id)).size;

      return {
        avgDurationSeconds: avgSeconds,
        avgDurationFormatted: timeTrackingService.formatAsHMS(avgSeconds),
        activeUserCount: uniqueUsers,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error getting average session duration:', error);
      return {
        avgDurationSeconds: 0,
        avgDurationFormatted: '00:00:00',
        activeUserCount: 0,
      };
    }
  },

  /**
   * Get course performance ranking
   */
  async getCoursePerformanceRanking(limit = 10): Promise<CoursePerformanceMetrics[]> {
    try {
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title');

      if (coursesError) throw coursesError;

      const metricsPromises = (courses || []).map(async (course: any) => {
        try {
          // Get enrollments for this course
          const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('id, userid, completed, progress')
            .eq('courseid', course.id);

          if (enrollError) throw enrollError;

          const enrollmentList = enrollments || [];
          const completedCount = enrollmentList.filter((e: any) => e.completed).length;

          // Get lesson progress to calculate time
          const { data: lessonProgress, error: progressError } = await supabase
            .from('lesson_progress')
            .select('time_spent_seconds, courseid')
            .eq('courseid', course.id)
            .eq('completed', true);

          if (progressError) throw progressError;

          const lessonProgressList = lessonProgress || [];
          const totalTimeSeconds = lessonProgressList.reduce(
            (sum: number, l: any) => sum + (l.time_spent_seconds || 0),
            0
          );
          const avgCompletionTime =
            completedCount > 0 ? Math.round(totalTimeSeconds / completedCount) : 0;

          // Get session data for this course
          const { data: sessions, error: sessionsError } = await supabase
            .from('learning_sessions')
            .select('duration_seconds')
            .eq('course_id', course.id)
            .eq('is_completed', true);

          if (sessionsError) throw sessionsError;

          const sessionsList = sessions || [];
          const avgSessionDuration =
            sessionsList.length > 0
              ? Math.round(
                sessionsList.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) /
                sessionsList.length
              )
              : 0;

          return {
            courseId: course.id,
            courseTitle: course.title,
            totalEnrolled: enrollmentList.length,
            completionRate: enrollmentList.length > 0 ? (completedCount / enrollmentList.length) * 100 : 0,
            avgCompletionTimeSeconds: avgCompletionTime,
            avgSessionDurationSeconds: avgSessionDuration,
            moduleWiseMetrics: [], // Populated separately if needed
          };
        } catch (error) {
          console.error(`[ANALYTICS] Error processing course ${course.id}:`, error);
          return null;
        }
      });

      const allMetrics = await Promise.all(metricsPromises);
      const validMetrics = allMetrics.filter((m) => m !== null) as CoursePerformanceMetrics[];

      // Sort by completion rate (descending)
      return validMetrics
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, limit);
    } catch (error) {
      console.error('[ANALYTICS] Error getting course performance ranking:', error);
      return [];
    }
  },

  /**
   * Get module-wise completion time for a course
   */
  async getModuleWiseCompletionTime(courseId: string): Promise<ModuleMetric[]> {
    try {
      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, module_title, title')
        .eq('courseid', courseId);

      if (lessonsError) throw lessonsError;

      const modernsByModule = new Map<string, string[]>();
      (lessons || []).forEach((lesson: any) => {
        const mod = lesson.module_title || 'Default Module';
        if (!modernsByModule.has(mod)) {
          modernsByModule.set(mod, []);
        }
        modernsByModule.get(mod)?.push(lesson.id);
      });

      const moduleMetrics: ModuleMetric[] = [];

      for (const [moduleName, lessonIds] of modernsByModule) {
        const { data: progressData, error: progressError } = await supabase
          .from('lesson_progress')
          .select('time_spent_seconds, completed')
          .in('lessonid', lessonIds)
          .eq('courseid', courseId);

        if (progressError) throw progressError;

        const progressList = progressData || [];
        const completedLessons = progressList.filter((p: any) => p.completed).length;
        const totalTimeSeconds = progressList.reduce(
          (sum: number, p: any) => sum + (p.time_spent_seconds || 0),
          0
        );
        const avgTime = completedLessons > 0 ? Math.round(totalTimeSeconds / completedLessons) : 0;

        moduleMetrics.push({
          moduleName,
          lessonsCompleted: completedLessons,
          avgTimeSeconds: avgTime,
          completionRate: lessonIds.length > 0 ? (completedLessons / lessonIds.length) * 100 : 0,
        });
      }

      return moduleMetrics;
    } catch (error) {
      console.error('[ANALYTICS] Error getting module-wise completion time:', error);
      return [];
    }
  },

  /**
   * Get total time learned per course (aggregated)
   */
  async getTimeLearned(): Promise<{
    [courseId: string]: {
      courseTitle: string;
      totalSecondsString: string; // HH:MM:SS format
      totalSeconds: number;
      userCount: number;
    };
  }> {
    try {
      const { data: lessons, error: lessonsError } = await supabase
        .from('lesson_progress')
        .select('courseid, time_spent_seconds');

      if (lessonsError) throw lessonsError;

      const courseMap = new Map<string, { timeSeconds: number; users: Set<string> }>();

      (lessons || []).forEach((lesson: any) => {
        if (!courseMap.has(lesson.courseid)) {
          courseMap.set(lesson.courseid, { timeSeconds: 0, users: new Set() });
        }
        const entry = courseMap.get(lesson.courseid)!;
        entry.timeSeconds += lesson.time_spent_seconds || 0;
      });

      // Get course titles
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title');

      if (coursesError) throw coursesError;

      const courseTitles = new Map((courses || []).map((c: any) => [c.id, c.title]));

      const result: {
        [courseId: string]: {
          courseTitle: string;
          totalSecondsString: string;
          totalSeconds: number;
          userCount: number;
        };
      } = {};

      for (const [courseId, { timeSeconds }] of courseMap) {
        result[courseId] = {
          courseTitle: courseTitles.get(courseId) || 'Unknown Course',
          totalSecondsString: timeTrackingService.formatAsHMS(timeSeconds),
          totalSeconds: timeSeconds,
          userCount: 0, // Will be populated separately if needed
        };
      }

      return result;
    } catch (error) {
      console.error('[ANALYTICS] Error getting time learned:', error);
      return {};
    }
  },

  /**
   * Get per-user session metrics
   */
  async getUserSessionMetrics(limit = 50): Promise<SessionMetrics[]> {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, fullname');

      if (profilesError) throw profilesError;

      const metricsPromises = (profiles || []).map(async (user: any) => {
        try {
          const { data: sessions, error: sessionsError } = await supabase
            .from('learning_sessions')
            .select('duration_seconds, session_start, is_completed')
            .eq('user_id', user.id)
            .eq('is_completed', true)
            .gte('session_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

          if (sessionsError) throw sessionsError;

          const sessionsList = sessions || [];
          if (sessionsList.length === 0) return null;

          const totalSeconds = sessionsList.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
          const avgSeconds = Math.round(totalSeconds / sessionsList.length);
          const lastActivity = sessionsList.reduce((latest: string, s: any) => {
            return new Date(s.session_start) > new Date(latest) ? s.session_start : latest;
          });

          return {
            userId: user.id,
            userEmail: user.email,
            userName: user.fullname,
            totalSessions: sessionsList.length,
            avgSessionDurationSeconds: avgSeconds,
            totalTimeSeconds: totalSeconds,
            lastActivityAt: lastActivity,
          };
        } catch (error) {
          console.error(`[ANALYTICS] Error processing user ${user.id}:`, error);
          return null;
        }
      });

      const allMetrics = await Promise.all(metricsPromises);
      const validMetrics = allMetrics.filter((m) => m !== null) as SessionMetrics[];

      // Sort by total time (descending)
      return validMetrics
        .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds)
        .slice(0, limit);
    } catch (error) {
      console.error('[ANALYTICS] Error getting user session metrics:', error);
      return [];
    }
  },

  /**
   * Calculate engagement score for user
   */
  async calculateEngagementScore(userId: string): Promise<EngagementScore> {
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('learning_sessions')
        .select('session_start, duration_seconds')
        .eq('user_id', userId)
        .eq('is_completed', true);

      if (sessionsError) throw sessionsError;

      const sessionsList = sessions || [];
      const totalSeconds = sessionsList.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
      const totalHours = totalSeconds / 3600;

      // Calculate consistency (sessions over 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sessionsInMonth = sessionsList.filter((s: any) => new Date(s.session_start) > thirtyDaysAgo);

      // Consistency score: days with activity / 30 days
      const uniqueDays = new Set(
        sessionsInMonth.map((s: any) => new Date(s.session_start).toDateString())
      ).size;
      const consistency = Math.min(100, (uniqueDays / 30) * 100);

      // Engagement level
      let engagementLevel: 'High' | 'Medium' | 'Low';
      if (consistency > 60 && totalHours > 10) {
        engagementLevel = 'High';
      } else if (consistency > 30 || totalHours > 5) {
        engagementLevel = 'Medium';
      } else {
        engagementLevel = 'Low';
      }

      return {
        userId,
        sessionCount: sessionsList.length,
        totalHours: Math.round(totalHours * 100) / 100,
        consistency: Math.round(consistency),
        engagementLevel,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error calculating engagement score:', error);
      return {
        userId,
        sessionCount: 0,
        totalHours: 0,
        consistency: 0,
        engagementLevel: 'Low',
      };
    }
  },

  /**
   * Get active users count right now
   */
  async getActiveUsersNow(): Promise<number> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('learning_sessions')
        .select('user_id')
        .eq('is_completed', false)
        .gte('session_start', fiveMinutesAgo);

      if (error) throw error;

      const uniqueUsers = new Set((data || []).map((s: any) => s.user_id));
      return uniqueUsers.size;
    } catch (error) {
      console.error('[ANALYTICS] Error getting active users:', error);
      return 0;
    }
  },

  /**
   * Format time for display
   */
  formatTimeForDisplay(seconds: number): string {
    return timeTrackingService.formatAsHMS(seconds);
  },
};
