import { supabase } from './supabaseClient';
import { notificationService } from './notificationService';

export interface CourseNotificationData {
  courseId: string;
  courseTitle: string;
  courseThumbnail?: string;
  instructorName?: string;
  userIds?: string[];
  sendToAllEnrolled?: boolean;
  customMessage?: string;
}

class CourseNotificationService {
  // Send notification when user enrolls in a course
  async sendCourseEnrollmentNotification(
    userId: string,
    courseId: string,
    courseTitle: string
  ): Promise<void> {
    try {
      // Get course details
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('title, thumbnail, instructorname, description')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      await notificationService.createNotification({
        user_id: userId,
        title: 'Welcome to Your New Course!',
        message: `You've successfully enrolled in "${course.title}". Start your learning journey today!`,
        type: 'course',
        image_url: course.thumbnail,
        link_url: `/course/${courseId}`,
        link_label: 'Start Learning',
        metadata: { 
          course_id: courseId,
          notification_type: 'course_enrolled'
        },
        priority: 2
      });
    } catch (error) {
      console.error('Error sending course enrollment notification:', error);
      throw error;
    }
  }

  // Send notification when course is completed
  async sendCourseCompletionNotification(
    userId: string,
    courseId: string,
    courseTitle: string
  ): Promise<void> {
    try {
      // Get course details
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('title, thumbnail, instructorname')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      await notificationService.createNotification({
        user_id: userId,
        title: '🎉 Course Completed!',
        message: `Congratulations! You've successfully completed "${course.title}". Check your certificates!`,
        type: 'course',
        image_url: course.thumbnail,
        link_url: `/course/${courseId}`,
        link_label: 'View Certificate',
        metadata: { 
          course_id: courseId,
          notification_type: 'course_completed'
        },
        priority: 3
      });
    } catch (error) {
      console.error('Error sending course completion notification:', error);
      throw error;
    }
  }

  // Send reminder for incomplete courses
  async sendCourseReminderNotifications(
    daysInactive: number = 7
  ): Promise<void> {
    try {
      // Get users with incomplete courses who haven't accessed them recently
      const { data: inactiveEnrollments, error } = await supabase
        .from('enrollments')
        .select(`
          userid,
          courseid,
          progress,
          lastaccessedat,
          courses!enrollments_courseid_fkey (
            title,
            thumbnail
          )
        `)
        .eq('completed', false)
        .lt('progress', 100)
        .lt('lastaccessedat', new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      for (const enrollment of inactiveEnrollments || []) {
        const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
        const daysSinceLastAccess = Math.floor(
          (Date.now() - new Date(enrollment.lastaccessedat).getTime()) / (1000 * 60 * 60 * 24)
        );

        await notificationService.createNotification({
          user_id: enrollment.userid,
          title: 'Continue Your Learning Journey',
          message: `It's been ${daysSinceLastAccess} days since you last accessed "${course?.title || 'your course'}". You're ${enrollment.progress}% complete - keep going!`,
          type: 'course',
          image_url: course?.thumbnail,
          link_url: `/course/${enrollment.courseid}`,
          link_label: 'Resume Learning',
          metadata: { 
            course_id: enrollment.courseid,
            notification_type: 'course_reminder',
            days_inactive: daysSinceLastAccess
          },
          priority: 2
        });
      }
    } catch (error) {
      console.error('Error sending course reminder notifications:', error);
      throw error;
    }
  }

  // Send notification when new course is published
  async sendNewCourseNotification(
    courseId: string,
    targetUserIds?: string[],
    departments?: string[]
  ): Promise<void> {
    try {
      // Get course details
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('title, thumbnail, instructorname, category, description')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      let userIds: string[] = [];

      if (targetUserIds) {
        userIds = targetUserIds;
      } else if (departments) {
        // Get users from specific departments
        const { data: users } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'user')
          .in('department', departments);
        
        userIds = users?.map(u => u.id) || [];
      } else {
        // Send to all users
        const { data: users } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'user');
        
        userIds = users?.map(u => u.id) || [];
      }

      if (userIds.length === 0) return;

      await notificationService.sendToMultipleUsers(userIds, {
        title: '🆕 New Course Available',
        message: `Check out "${course.title}" - a new ${course.category} course that might interest you!`,
        type: 'course',
        image_url: course.thumbnail,
        link_url: `/course/${courseId}`,
        link_label: 'Explore Course',
        metadata: { 
          course_id: courseId,
          notification_type: 'new_course'
        },
        priority: 2
      });
    } catch (error) {
      console.error('Error sending new course notification:', error);
      throw error;
    }
  }

  // Send notification when course content is updated
  async sendCourseUpdateNotification(
    courseId: string,
    updateType: 'content' | 'lessons' | 'resources' | 'general',
    updateDescription: string
  ): Promise<void> {
    try {
      // Get enrolled users
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select('userid')
        .eq('courseid', courseId);

      if (error) throw error;

      const userIds = enrollments?.map(e => e.userid) || [];
      if (userIds.length === 0) return;

      // Get course details
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('title, thumbnail')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      const updateMessages = {
        content: 'New content has been added',
        lessons: 'New lessons are available',
        resources: 'New learning resources have been added',
        general: 'Course has been updated'
      };

      await notificationService.sendToMultipleUsers(userIds, {
        title: 'Course Updated',
        message: `${updateMessages[updateType]} for "${course.title}". ${updateDescription}`,
        type: 'course',
        image_url: course.thumbnail,
        link_url: `/course/${courseId}`,
        link_label: 'View Updates',
        metadata: { 
          course_id: courseId,
          notification_type: 'course_updated',
          update_type: updateType
        },
        priority: 2
      });
    } catch (error) {
      console.error('Error sending course update notification:', error);
      throw error;
    }
  }

  // Send notification for upcoming assignment deadlines
  async sendAssignmentDeadlineNotifications(
    hoursBefore: number = 24
  ): Promise<void> {
    try {
      const deadlineTime = new Date(Date.now() + hoursBefore * 60 * 60 * 1000).toISOString();

      // Get assignments due soon
      const { data: assignments, error } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          courseid,
          duedate,
          courses!assignments_courseid_fkey (
            title,
            thumbnail
          ),
          enrollments!assignments_courseid_fkey (
            userid
          )
        `)
        .lte('duedate', deadlineTime)
        .gt('duedate', new Date().toISOString());

      if (error) throw error;

      for (const assignment of assignments || []) {
        const course = Array.isArray(assignment.courses) ? assignment.courses[0] : assignment.courses;
        const userIds = assignment.enrollments?.map((e: any) => e.userid) || [];

        if (userIds.length === 0) continue;

        const hoursUntilDeadline = Math.floor(
          (new Date(assignment.duedate).getTime() - Date.now()) / (1000 * 60 * 60)
        );

        await notificationService.sendToMultipleUsers(userIds, {
          title: '⏰ Assignment Due Soon',
          message: `"${assignment.title}" is due in ${hoursUntilDeadline} hours. Don't miss the deadline!`,
          type: 'assignment',
          image_url: course?.thumbnail,
          link_url: `/assignment/${assignment.id}`,
          link_label: 'Submit Assignment',
          metadata: { 
            assignment_id: assignment.id,
            course_id: assignment.courseid,
            notification_type: 'assignment_due_soon',
            hours_until_deadline: hoursUntilDeadline
          },
          priority: 4
        });
      }
    } catch (error) {
      console.error('Error sending assignment deadline notifications:', error);
      throw error;
    }
  }

  // Send achievement notifications
  async sendAchievementNotification(
    userId: string,
    achievementType: 'first_course' | 'course_streak' | 'fast_learner' | 'perfect_score',
    achievementData: any
  ): Promise<void> {
    try {
      const achievementMessages = {
        first_course: {
          title: '🎯 First Course Completed!',
          message: 'Congratulations on completing your first course! You\'re on your way to becoming a lifelong learner.'
        },
        course_streak: {
          title: '🔥 Learning Streak!',
          message: `You've completed ${achievementData.streak} courses in a row. Keep up the great work!`
        },
        fast_learner: {
          title: '⚡ Fast Learner!',
          message: `You completed "${achievementData.courseTitle}" in record time. Excellent progress!`
        },
        perfect_score: {
          title: '🌟 Perfect Score!',
          message: `You achieved a perfect score in "${achievementData.courseTitle}". Outstanding performance!`
        }
      };

      const achievement = achievementMessages[achievementType];
      
      await notificationService.createNotification({
        user_id: userId,
        title: achievement.title,
        message: achievement.message,
        type: 'general',
        metadata: { 
          notification_type: 'achievement',
          achievement_type: achievementType,
          ...achievementData
        },
        priority: 3
      });
    } catch (error) {
      console.error('Error sending achievement notification:', error);
      throw error;
    }
  }

  // Send personalized course recommendations
  async sendCourseRecommendationNotification(
    userId: string,
    recommendedCourses: any[]
  ): Promise<void> {
    try {
      if (recommendedCourses.length === 0) return;

      const topRecommendation = recommendedCourses[0];
      
      await notificationService.createNotification({
        user_id: userId,
        title: '📚 Recommended for You',
        message: `Based on your learning history, we think you'll enjoy "${topRecommendation.title}". ${recommendedCourses.length > 1 ? `+${recommendedCourses.length - 1} more courses recommended.` : ''}`,
        type: 'course',
        image_url: topRecommendation.thumbnail,
        link_url: `/course/${topRecommendation.id}`,
        link_label: 'View Recommendation',
        metadata: { 
          notification_type: 'course_recommendation',
          recommended_courses: recommendedCourses.map(c => c.id)
        },
        priority: 1
      });
    } catch (error) {
      console.error('Error sending course recommendation notification:', error);
      throw error;
    }
  }
}

export const courseNotificationService = new CourseNotificationService();