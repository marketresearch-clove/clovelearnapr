import { supabase } from './supabaseClient';
import { userSkillAchievementService } from './userSkillAchievementService';
import { careerPathService } from './careerPathService';
import { userStatisticsService } from './userStatisticsService';
import { awardCertificate } from './certificateService';

export const courseCompletionService = {
  markCourseAsCompleted: async (userId: string, courseId: string) => {
    try {
      // Check if already completed to avoid double counting stats
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('completed')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .maybeSingle();

      const wasCompleted = enrollment?.completed || false;

      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .update({ completed: true, completedat: new Date().toISOString() })
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (enrollmentError) throw enrollmentError;

      // If it wasn't completed before, update statistics
      if (!wasCompleted) {
        await userStatisticsService.incrementCoursesCompleted(userId);
      }

      await courseCompletionService.assignCourseSkillsToUser(userId, courseId);
      await courseCompletionService.recordCourseSkillAchievements(userId, courseId);

      // Issue certificate if enabled for this course
      await courseCompletionService.issueCertificateIfEnabled(userId, courseId);

      // Update career path readiness
      await courseCompletionService.updateCareerPathsForUser(userId);

      return { success: true };
    } catch (error) {
      console.error('Error marking course as completed:', error);
      return { success: false, error };
    }
  },

  issueCertificateIfEnabled: async (userId: string, courseId: string) => {
    try {
      // Get course details including certificate_enabled flag
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('title, certificate_enabled')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        console.log('Course not found or error fetching course details for certificate:', courseError);
        return { success: false };
      }

      // DEFENSIVE LOGGING: Log the actual certificate_enabled value
      console.log(`[CERTIFICATE_CHECK] Course: "${course.title}" (ID: ${courseId}), certificate_enabled: ${course.certificate_enabled} (type: ${typeof course.certificate_enabled})`);

      // Check if certificate is enabled for this course
      // Explicitly handle falsy values (false, null, undefined, 0)
      const isCertificateEnabled = course.certificate_enabled === true;

      if (!isCertificateEnabled) {
        console.log(`[CERTIFICATE_BLOCKED] Certificate disabled for course "${course.title}". Skipping certificate issuance.`);
        return { success: true, issued: false, reason: 'Certificate disabled for this course' };
      }

      // Check if this course has been retaken by the user (prevent certificate re-issuance after retake)
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('retake_count')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .maybeSingle();

      if (enrollment && enrollment.retake_count > 0) {
        console.log(`[CERTIFICATE_BLOCKED] Course "${course.title}" has been retaken by user ${userId}. Skipping certificate issuance.`);
        return { success: true, issued: false, reason: 'Certificate not available for retaken courses' };
      }

      // Check if certificate already issued for this user and course
      const { data: existingCert } = await supabase
        .from('certificates')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();

      if (existingCert) {
        console.log(`[CERTIFICATE_DUPLICATE] Certificate already issued for user ${userId} and course ${courseId}`);
        return { success: true, issued: false, reason: 'Certificate already issued' };
      }

      // Use the awardCertificate function which properly handles signature linking
      console.log(`[CERTIFICATE_ISSUING] About to issue certificate for user ${userId} on course "${course.title}"`);
      const certificateData = await awardCertificate(userId, courseId);

      if (!certificateData) {
        console.error('[CERTIFICATE_ERROR] Error issuing certificate via awardCertificate');
        return { success: false, error: 'Failed to award certificate' };
      }

      console.log(`[CERTIFICATE_SUCCESS] Certificate issued successfully for user ${userId} and course ${courseId} with signatures`);
      return { success: true, issued: true, certificateId: certificateData.id };
    } catch (error) {
      console.error('[CERTIFICATE_EXCEPTION] Error in issueCertificateIfEnabled:', error);
      return { success: false, error };
    }
  },

  assignCourseSkillsToUser: async (userId: string, courseId: string) => {
    try {
      const { data: mappings, error: mappingsError } = await supabase
        .from('skill_course_mappings')
        .select('skillid, expiry_date')
        .eq('courseid', courseId);

      if (mappingsError) throw mappingsError;

      if (!mappings || mappings.length === 0) {
        return { success: true, assigned: 0 };
      }

      // Note: skill_assignments table may not exist in current schema
      // This is a placeholder for future skill assignment tracking
      // Currently, skill achievements are tracked via user_skill_achievements

      return { success: true, assigned: mappings.length };
    } catch (error) {
      console.error('Error assigning course skills:', error);
      return { success: false, error, assigned: 0 };
    }
  },

  recordCourseSkillAchievements: async (userId: string, courseId: string) => {
    try {
      // Get course details including enrollment completion date
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('title, level')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        console.error('Error fetching course details for achievement:', courseError);
        return;
      }

      console.log('[COURSE_COMPLETION_DEBUG] Recording achievements for course:', course.title, '(Level:', course.level, ')');

      // Get the best quiz result for this course to use as the skill score
      const { data: assessments } = await supabase
        .from('assessments')
        .select('id')
        .eq('courseid', courseId);

      let bestScore = 0;
      if (assessments && assessments.length > 0) {
        const assessmentIds = assessments.map(a => a.id);
        const { data: results } = await supabase
          .from('assessment_results')
          .select('percentage')
          .eq('userid', userId)
          .in('assessmentid', assessmentIds)
          .order('percentage', { ascending: false })
          .limit(1);

        if (results && results.length > 0) {
          bestScore = results[0].percentage;
        }
      }

      // Get mapped skills
      const { data: mappings, error: mappingsError } = await supabase
        .from('skill_course_mappings')
        .select(`
          skillid,
          skills (
            name
          )
        `)
        .eq('courseid', courseId);

      if (mappingsError || !mappings) {
        console.error('Error fetching skill mappings for achievement:', mappingsError);
        console.log('[COURSE_COMPLETION_DEBUG] No skill mappings found for courseId:', courseId);
        return;
      }

      console.log('[COURSE_COMPLETION_DEBUG] Found', mappings.length, 'skill mappings for course:', courseId);

      for (const mapping of mappings) {
        if (!mapping.skillid) {
          console.warn('[COURSE_COMPLETION_DEBUG] Skipping skill mapping with null skillid:', mapping);
          continue;
        }

        // @ts-ignore
        const skillName = mapping.skills?.name || 'Unknown Skill';
        console.log('[COURSE_COMPLETION_DEBUG] Recording skill achievement:', skillName, '(ID:', mapping.skillid, ')');

        // Normalize level to titlecase
        const normalizedLevel = course.level
          ? course.level.charAt(0).toUpperCase() + course.level.slice(1).toLowerCase()
          : 'Beginner';

        // Record the skill achievement (user_skill_achievements table)
        await userSkillAchievementService.recordSkillAchievement(
          userId,
          mapping.skillid,
          skillName,
          (normalizedLevel as 'Beginner' | 'Intermediate' | 'Advanced'),
          courseId,
          course.title,
          bestScore // Pass the actual quiz score
        );

        // Also create/update skill assignment (skill_assignments table for MyLearning page UI)
        try {
          const { error: assignError } = await supabase
            .from('skill_assignments')
            .upsert([{
              userid: userId,
              skillid: mapping.skillid,
              visible: true,
              hidden: false,
              assignedat: new Date().toISOString(),
            }], {
              onConflict: 'userid,skillid'
            });

          if (assignError) {
            console.error('[COURSE_COMPLETION_DEBUG] Error creating skill assignment for', skillName, ':', assignError);
          } else {
            console.log('[COURSE_COMPLETION_DEBUG] Created skill assignment for', skillName);
          }
        } catch (assignErr) {
          console.error('[COURSE_COMPLETION_DEBUG] Exception creating skill assignment:', assignErr);
        }
      }

    } catch (error) {
      console.error('Error recording course skill achievements:', error);
    }
  },

  updateCareerPathsForUser: async (userId: string) => {
    try {
      const careerPaths = await careerPathService.getUserCareerPaths(userId);
      for (const path of careerPaths) {
        await careerPathService.updateCareerReadiness(userId, path.career_path_id);
      }
    } catch (error) {
      console.error('Error updating career paths:', error);
    }
  },

  syncCompletedCourseSkills: async (userId: string) => {
    try {
      // 1. Get all completed courses for this user
      const { data: completedEnrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('courseid')
        .eq('userid', userId)
        .eq('completed', true);

      if (enrollmentError) throw enrollmentError;
      if (!completedEnrollments || completedEnrollments.length === 0) {
        return { success: true, message: 'No completed courses found' };
      }

      const courseIds = completedEnrollments.map(e => e.courseid);

      // 2. Get all skills mapped to these courses
      const { data: mappings, error: mappingError } = await supabase
        .from('skill_course_mappings')
        .select('skill_id, expiry_date')
        .in('courseid', courseIds);

      if (mappingError) throw mappingError;
      if (!mappings || mappings.length === 0) {
        return { success: true, message: 'No skills mapped to completed courses' };
      }

      // 3. Note: Skill achievements are tracked via user_skill_achievements table
      // Completed courses automatically create skill achievements through recordCourseSkillAchievements

      return { success: true, message: 'Sync completed - skills are tracked via user_skill_achievements' };
    } catch (error) {
      console.error('Error syncing completed course skills:', error);
      return { success: false, error };
    }
  }
};
