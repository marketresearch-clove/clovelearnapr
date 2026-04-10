import { supabase } from './supabaseClient';
import { userStatisticsService } from './userStatisticsService';
import { userSkillAchievementService } from './userSkillAchievementService';
import { courseService } from './courseService';
import { cacheService } from './cacheService';

export interface EnrollmentData {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  completed: boolean;
  hoursSpent: number;
  lastAccessedAt?: string;
  enrolledAt?: string;
  completedAt?: string;
}

export const enrollmentService = {
  async getUserEnrollments(userId: string) {
    try {
      // Check cache first
      const cacheKey = `${cacheService['keys']?.ENROLLMENTS || 'cache:enrollments:'}${userId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('[ENROLLMENT] Using cached enrollments for user:', userId);
        return cached as any[];
      }

      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('userid', userId)
        .order('lastaccessedat', { ascending: false });

      if (error) throw error;

      // Cache the result with custom expiration
      const expirationMs = 3 * 60 * 1000; // 3 minutes
      cacheService.set(cacheKey, data || [], expirationMs);

      return data || [];
    } catch (error) {
      console.error('Error fetching user enrollments:', error);
      return [];
    }
  },

  async getEnrollment(userId: string, courseId: string) {
    try {
      // Check cache first
      const cacheKey = `cache:enrollment:${userId}:${courseId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('[ENROLLMENT] Using cached enrollment for:', userId, courseId);
        return cached as any;
      }

      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Cache the result
      if (data) {
        cacheService.set(cacheKey, data, 3 * 60 * 1000); // 3 minutes
      }

      return data || null;
    } catch (error) {
      console.error('Error fetching enrollment:', error);
      return null;
    }
  },

  async enrollCourse(userId: string, courseId: string) {
    try {
      const existing = await this.getEnrollment(userId, courseId);
      if (existing) return existing;

      const { data, error } = await supabase
        .from('enrollments')
        .insert([{
          userid: userId,
          courseid: courseId,
          progress: 0,
          completed: false,
          hoursspent: 0,
          enrolledat: new Date().toISOString(),
          lastaccessedat: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Invalidate user enrollments cache after enrolling
      cacheService.remove(`cache:enrollments:${userId}`);
      // Also invalidate course assignments cache
      cacheService.clearByPrefix('cache:course_assignments:');

      await userStatisticsService.updateCoursesEnrolled(userId, true);
      return data;
    } catch (error) {
      console.error('Error enrolling in course:', error);
      throw error;
    }
  },

  async updateProgress(userId: string, courseId: string, progress: number) {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .update({ progress, lastaccessedat: new Date().toISOString() })
        .eq('userid', userId)
        .eq('courseid', courseId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  },

  async completeCourse(userId: string, courseId: string, hoursSpent: number = 0) {
    try {
      // Ensure user has stats initialized first
      await userStatisticsService.getUserStatistics(userId);

      // Get current enrollment to preserve existing hoursspent
      const currentEnrollment = await this.getEnrollment(userId, courseId);
      const currentHoursSpent = currentEnrollment?.hoursspent || 0;

      // When a course is completed, use the course duration as the authoritative hours spent
      // The course duration represents the expected/designed time for the course
      // This prevents inflated learning_hours from incorrectly increasing total hours
      let finalHoursSpent = hoursSpent;

      // If no course duration was provided, check if we already have recorded hours
      if (hoursSpent === 0 && currentHoursSpent > 0) {
        // Keep existing hours if no new duration provided
        finalHoursSpent = currentHoursSpent;
      }

      console.log(`[COURSE_COMPLETION] Course ${courseId}: courseDuration=${hoursSpent}, currentHours=${currentHoursSpent}, final=${finalHoursSpent}`);

      const { data, error } = await supabase
        .from('enrollments')
        .update({
          progress: 100,
          completed: true,
          hoursspent: finalHoursSpent,
          completedat: new Date().toISOString(),
          lastaccessedat: new Date().toISOString()
        })
        .eq('userid', userId)
        .eq('courseid', courseId)
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache for this enrollment and user's enrollments
      cacheService.remove(`cache:enrollment:${userId}:${courseId}`);
      cacheService.remove(`cache:enrollments:${userId}`);

      // Refresh user statistics to get latest values from server
      await this.updateUserStatistics(userId);

      return data;
    } catch (error) {
      console.error('Error completing course:', error);
      throw error;
    }
  },

  async updateUserStatistics(userId: string) {
    try {
      const enrollments = await this.getUserEnrollments(userId);
      if (enrollments.length === 0) return;

      const completedCount = enrollments.filter((e: any) => e.completed).length;

      // Calculate total hours with a fallback to learning_hours table
      // This ensures we capture hours even if enrollments.hoursspent is 0
      let totalMinutes = 0;

      // First, try to sum from enrollments
      const enrollmentMinutes = enrollments.reduce((sum: number, e: any) => sum + (e.hoursspent || 0), 0);

      if (enrollmentMinutes > 0) {
        // If enrollments has data, use it
        totalMinutes = enrollmentMinutes;
      } else {
        // If enrollments.hoursspent is 0, check learning_hours table for actual data
        const { data: learningHours } = await supabase
          .from('learning_hours')
          .select('hoursspent')
          .eq('userid', userId);

        totalMinutes = (learningHours || []).reduce((sum: number, lh: any) => sum + (lh.hoursspent || 0), 0);
      }

      const totalEnrolled = enrollments.length;
      const hoursInHours = Math.round(totalMinutes / 60);

      const stats = await supabase
        .from('user_statistics')
        .select('id, totalpoints')
        .eq('userid', userId)
        .maybeSingle();

      if (stats.data?.id) {
        await supabase
          .from('user_statistics')
          .update({
            coursescompleted: completedCount,
            totallearninghours: hoursInHours,
            totalcoursesenrolled: totalEnrolled,
            updatedat: new Date().toISOString(),
          })
          .eq('userid', userId);
      } else {
        // Initialize if not exists
        await supabase
          .from('user_statistics')
          .insert([{
            userid: userId,
            coursescompleted: completedCount,
            totallearninghours: hoursInHours,
            totalcoursesenrolled: totalEnrolled,
            totalpoints: completedCount * 100,
          }]);
      }
    } catch (error) {
      console.error('Error updating user statistics:', error);
    }
  },

  async getCoursesInProgress(userId: string) {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('userid', userId)
        .eq('completed', false)
        .order('lastaccessedat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching in-progress courses:', error);
      return [];
    }
  },

  async getCompletedCourses(userId: string) {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('userid', userId)
        .eq('completed', true)
        .order('completedat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching completed courses:', error);
      return [];
    }
  },

  async updateHoursSpent(userId: string, courseId: string, additionalHours: number) {
    try {
      const enrollment = await this.getEnrollment(userId, courseId);
      if (!enrollment) return null;

      const newTotal = (enrollment.hoursspent || 0) + additionalHours;

      const response = await fetch('http://localhost:3001/api/enrollment/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId, hoursspent: newTotal }),
      });

      if (!response.ok) throw new Error('Failed to update hours spent');
      return await response.json();
    } catch (error) {
      console.error('Error updating hours spent:', error);
      throw error;
    }
  },

  async retakeCourse(userId: string, courseId: string) {
    try {
      console.log(`[RETAKE] Starting retake for user ${userId} on course ${courseId}`);

      // 1. Delete all lesson progress for this course
      const { error: lessonProgressError } = await supabase
        .from('lesson_progress')
        .delete()
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (lessonProgressError) throw lessonProgressError;
      console.log(`[RETAKE] Cleared lesson progress`);

      // 2. Delete all quiz results for this course
      const { error: quizResultsError } = await supabase
        .from('quiz_results')
        .delete()
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (quizResultsError) throw quizResultsError;
      console.log(`[RETAKE] Cleared quiz results`);

      // 3. Get all assessments for this course and delete their results
      const { data: assessments } = await supabase
        .from('assessments')
        .select('id')
        .eq('courseid', courseId);

      if (assessments && assessments.length > 0) {
        const assessmentIds = assessments.map(a => a.id);
        const { error: assessmentResultsError } = await supabase
          .from('assessment_results')
          .delete()
          .eq('userid', userId)
          .in('assessmentid', assessmentIds);

        if (assessmentResultsError) throw assessmentResultsError;
        console.log(`[RETAKE] Cleared assessment results for ${assessmentIds.length} assessments`);
      }

      // 4. Delete external assessment results for this course
      const { data: extAssessments } = await supabase
        .from('external_assessments')
        .select('id')
        .eq('courseid', courseId);

      if (extAssessments && extAssessments.length > 0) {
        const extAssessmentIds = extAssessments.map(a => a.id);
        const { error: extResultsError } = await supabase
          .from('external_assessment_results')
          .delete()
          .eq('userid', userId)
          .in('external_assessmentid', extAssessmentIds);

        if (extResultsError && extResultsError.code !== 'PGRST116') {
          // PGRST116 means no rows found, which is OK
          throw extResultsError;
        }
        console.log(`[RETAKE] Cleared external assessment results`);
      }

      // 5. Delete certificates for this user/course
      // First, get certificate IDs for this user/course
      const { data: certificatesForDeletion } = await supabase
        .from('certificates')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (certificatesForDeletion && certificatesForDeletion.length > 0) {
        const certificateIds = certificatesForDeletion.map(c => c.id);

        // Delete certificate_signatures first (foreign key constraint)
        const { error: sigError } = await supabase
          .from('certificate_signatures')
          .delete()
          .in('certificate_id', certificateIds);

        if (sigError && sigError.code !== 'PGRST116') {
          throw sigError;
        }
        console.log(`[RETAKE] Cleared certificate signatures for ${certificateIds.length} certificates`);

        // Then delete certificates
        const { error: certificateError } = await supabase
          .from('certificates')
          .delete()
          .in('id', certificateIds);

        if (certificateError && certificateError.code !== 'PGRST116') {
          throw certificateError;
        }
        console.log(`[RETAKE] Cleared ${certificateIds.length} certificates`);
      } else {
        console.log(`[RETAKE] No certificates found to clear`);
      }

      // 6. Delete learning hours for this specific course (IMPORTANT: only this course, not all courses)
      const { error: learningHoursError } = await supabase
        .from('learning_hours')
        .delete()
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (learningHoursError && learningHoursError.code !== 'PGRST116') {
        throw learningHoursError;
      }
      console.log(`[RETAKE] Cleared learning hours for this course only`);

      // 7. Get all skill achievements for this course BEFORE deleting them
      const { data: skillAchievementsForCourse } = await supabase
        .from('user_skill_achievements')
        .select('skill_id, skill_name')
        .eq('user_id', userId)
        .eq('course_id', courseId);

      const skillIdsFromThisCourse = (skillAchievementsForCourse || []).map(a => a.skill_id);
      console.log(`[RETAKE] Found ${skillIdsFromThisCourse.length} skills acquired from this course`);

      // 8. For each skill from this course, check if user has achievements from OTHER courses
      // If not, delete the skill assignment
      if (skillIdsFromThisCourse.length > 0) {
        for (const skillId of skillIdsFromThisCourse) {
          if (!skillId) continue;

          // Check if this skill is acquired from ANY other course
          const { data: otherAchievements, error: checkError } = await supabase
            .from('user_skill_achievements')
            .select('id')
            .eq('user_id', userId)
            .eq('skill_id', skillId)
            .neq('course_id', courseId);  // Different course

          if (checkError) {
            console.warn(`[RETAKE] Error checking other achievements for skill ${skillId}:`, checkError.message);
            continue;
          }

          // If no other courses have this skill achievement, delete the skill assignment
          if (!otherAchievements || otherAchievements.length === 0) {
            const { error: deleteAssignError } = await supabase
              .from('skill_assignments')
              .delete()
              .eq('userid', userId)
              .eq('skillid', skillId);

            if (deleteAssignError && deleteAssignError.code !== 'PGRST116') {
              console.warn(`[RETAKE] Warning deleting skill assignment for skill ${skillId}:`, deleteAssignError.message);
            } else {
              console.log(`[RETAKE] Deleted skill assignment for skill ${skillId} (no other courses have this skill)`);
            }
          } else {
            console.log(`[RETAKE] Keeping skill assignment for skill ${skillId} (user has achievements from other courses)`);
          }
        }
      }

      // 9. Remove skill achievements for this course
      const { error: skillAchievError } = await supabase
        .from('user_skill_achievements')
        .delete()
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (skillAchievError && skillAchievError.code !== 'PGRST116') {
        console.warn(`[RETAKE] Warning clearing skill achievements: ${skillAchievError.message}`);
      } else {
        console.log(`[RETAKE] Cleared all skill achievements for this course`);
      }

      // 10. Reset the enrollment record (clear progress AND hours spent for this course only)
      // First get current retake_count
      const { data: currentEnrollment } = await supabase
        .from('enrollments')
        .select('retake_count')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .maybeSingle();

      const currentRetakeCount = currentEnrollment?.retake_count || 0;

      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .update({
          progress: 0,
          completed: false,
          completedat: null,
          completed_at: null,
          hoursspent: 0,
          lastaccessedat: new Date().toISOString(),
          retake_count: currentRetakeCount + 1
        })
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (enrollmentError) throw enrollmentError;
      console.log(`[RETAKE] Reset enrollment record - progress, completion, and hours spent cleared for this course only`);

      // 11. Decrement courses completed in statistics (which also recalculates total learning hours)
      await userStatisticsService.decrementCoursesCompleted(userId);
      console.log(`[RETAKE] Updated user statistics with recalculated learning hours`);

      console.log(`[RETAKE] Completed retake for user ${userId} on course ${courseId}`);
      return { success: true };
    } catch (error) {
      console.error('Error retaking course:', error);
      throw error;
    }
  },

  async unenrollCourse(userId: string, courseId: string) {
    try {
      // Get the enrollment to check if it was completed BEFORE deleting
      const enrollment = await this.getEnrollment(userId, courseId);

      // Delete all lesson progress for this course
      await supabase
        .from('lesson_progress')
        .delete()
        .eq('userid', userId)
        .eq('courseid', courseId);

      // Delete the enrollment
      const { error: deleteError } = await supabase
        .from('enrollments')
        .delete()
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (deleteError) throw deleteError;

      // Update user statistics
      if (enrollment?.completed) {
        await userStatisticsService.decrementCoursesCompleted(userId);
      }

      await this.updateUserStatistics(userId);

      return { success: true };
    } catch (error) {
      console.error('Error unenrolling from course:', error);
      throw error;
    }
  },
};
