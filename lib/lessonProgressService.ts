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
      const response = await fetch('http://localhost:3001/api/lesson-progress/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lessonId, courseId, progress, completed }),
      });

      if (!response.ok) throw new Error('Failed to update lesson progress');
      return await response.json();
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
