import { supabase } from './supabaseClient';

export interface LessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  courseId: string;
  completed: boolean;
  progress: number;
  lastAccessedAt: string;
  completedAt?: string;
}

export const lessonProgressService = {
  async getLessonProgress(userId: string, lessonId: string) {
    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('userid', userId)
        .eq('lessonid', lessonId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching lesson progress:', error);
      return null;
    }
  },

  async getUserLessonProgress(userId: string, courseId: string) {
    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .order('createdat', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user lesson progress:', error);
      return [];
    }
  },
  async getProgressByCourseIds(userId: string, courseIds: string[]) {
    try {
      if (courseIds.length === 0) return [];

      const { data, error } = await supabase
        .from('lesson_progress')
        .select('courseid, lessonid, completed')
        .eq('userid', userId)
        .in('courseid', courseIds);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching lesson progress by course IDs:', error);
      return [];
    }
  },

  async getCompletedLessonIds(userId: string) {
    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('lessonid')
        .eq('userid', userId)
        .eq('completed', true);

      if (error) throw error;
      return (data || []).map((row: any) => row.lessonid);
    } catch (error) {
      console.error('Error fetching completed lesson IDs:', error);
      return [];
    }
  },

  async recordLessonAccess(userId: string, lessonId: string, courseId: string) {
    try {
      const now = new Date().toISOString();
      const { data: existing, error: existingError } = await supabase
        .from('lesson_progress')
        .select('id')
        .eq('userid', userId)
        .eq('lessonid', lessonId)
        .maybeSingle();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('lesson_progress')
          .update({ lastaccessedat: now })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        return existing.id;
      }

      const { data, error: insertError } = await supabase
        .from('lesson_progress')
        .insert([
          {
            userid: userId,
            lessonid: lessonId,
            courseid: courseId,
            progress: 0,
            completed: false,
            lastaccessedat: now,
          },
        ])
        .select('id')
        .single();

      if (insertError) throw insertError;
      return data?.id || null;
    } catch (error) {
      console.error('Error recording lesson access:', error);
      return null;
    }
  },

  async getCourseLessonStats(userId: string, courseId: string) {
    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('completed, progress')
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (error) throw error;

      const progress = data || [];
      const totalLessons = progress.length;
      const completedLessons = progress.filter(l => l.completed).length;
      const avgProgress = totalLessons > 0
        ? progress.reduce((sum, l) => sum + l.progress, 0) / totalLessons
        : 0;

      return {
        totalLessons,
        completedLessons,
        progressPercentage: Math.round(avgProgress),
        completionRate: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
      };
    } catch (error) {
      console.error('Error getting course lesson stats:', error);
      return null;
    }
  },

  async updateLessonProgress(
    userId: string,
    lessonId: string,
    courseId: string,
    progress: number,
    completed = false
  ) {
    try {
      const now = new Date().toISOString();

      // Check if progress record exists
      const { data: existing, error: existingError } = await supabase
        .from('lesson_progress')
        .select('id')
        .eq('userid', userId)
        .eq('lessonid', lessonId)
        .maybeSingle();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      // Prepare update data
      const updateData: any = {
        progress,
        lastaccessedat: now,
      };

      if (completed) {
        updateData.completed = true;
        updateData.completedat = now;
      }

      if (existing?.id) {
        // Update existing progress record
        const { error: updateError } = await supabase
          .from('lesson_progress')
          .update(updateData)
          .eq('id', existing.id);

        if (updateError) throw updateError;
        return { success: true, id: existing.id };
      } else {
        // Create new progress record
        const { data, error: insertError } = await supabase
          .from('lesson_progress')
          .insert([
            {
              userid: userId,
              lessonid: lessonId,
              courseid: courseId,
              progress,
              completed,
              lastaccessedat: now,
              completedat: completed ? now : null,
            },
          ])
          .select('id')
          .single();

        if (insertError) throw insertError;
        return { success: true, id: data?.id };
      }
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      throw error;
    }
  },

  async markLessonComplete(userId: string, lessonId: string, courseId: string) {
    return this.updateLessonProgress(userId, lessonId, courseId, 100, true);
  },

  async resetLessonProgress(userId: string, lessonId: string) {
    try {
      const { error } = await supabase
        .from('lesson_progress')
        .update({
          progress: 0,
          completed: false,
          completedat: null,
          lastaccessedat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .eq('lessonid', lessonId);

      if (error) throw error;
    } catch (error) {
      console.error('Error resetting lesson progress:', error);
      throw error;
    }
  },

  async getCompletedLessons(userId: string, courseId: string) {
    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .eq('completed', true)
        .order('completedat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching completed lessons:', error);
      return [];
    }
  },

  async recordProgressMilestone(userId: string, courseId: string, milestonePercentage: number) {
    try {
      const { data: existingMilestone, error: queryError } = await supabase
        .from('progress_milestones')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .eq('milestone', milestonePercentage)
        .single();

      if (queryError && queryError.code !== 'PGRST116') {
        const { data, error } = await supabase
          .from('progress_milestones')
          .insert([{
            userid: userId,
            courseid: courseId,
            milestone: milestonePercentage,
            recordedat: new Date().toISOString(),
          }])
          .select()
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
      }
    } catch (error) {
      console.error('Error recording progress milestone:', error);
    }
  },
};
