import { supabase } from './supabaseClient';

export interface Quiz {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  description?: string;
  type: 'quiz' | 'assessment' | 'final_exam';
  passingScore: number;
  totalPoints: number;
  duration: number;
  questions: any[];
  totalQuestions: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuizInput {
  courseId: string;
  lessonId: string;
  title: string;
  description?: string;
  type?: 'quiz' | 'assessment' | 'final_exam';
  passingScore?: number;
  totalPoints?: number;
  duration?: number;
  questions?: any[];
}

export const quizService = {
  async createQuiz(quiz: CreateQuizInput): Promise<Quiz | null> {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .insert([
          {
            courseid: quiz.courseId,
            lessonid: quiz.lessonId,
            title: quiz.title,
            description: quiz.description,
            type: quiz.type || 'quiz',
            passingscore: quiz.passingScore || 70,
            totalpoints: quiz.totalPoints || 100,
            duration: quiz.duration || 30,
            questions: quiz.questions || [],
            totalquestions: quiz.questions?.length || 0,
            isactive: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw error;
    }
  },

  async getQuiz(quizId: string): Promise<Quiz | null> {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      return null;
    }
  },

  async getQuizzesByLesson(lessonId: string): Promise<Quiz[]> {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('lessonid', lessonId)
        .eq('isactive', true)
        .order('createdat', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching quizzes by lesson:', error);
      return [];
    }
  },

  async getQuizzesByCourse(courseId: string): Promise<Quiz[]> {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('courseid', courseId)
        .eq('isactive', true)
        .order('createdat', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching quizzes by course:', error);
      return [];
    }
  },

  async updateQuiz(quizId: string, updates: Partial<CreateQuizInput>): Promise<Quiz | null> {
    try {
      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.description) updateData.description = updates.description;
      if (updates.type) updateData.type = updates.type;
      if (updates.passingScore !== undefined) updateData.passingscore = updates.passingScore;
      if (updates.totalPoints !== undefined) updateData.totalpoints = updates.totalPoints;
      if (updates.duration !== undefined) updateData.duration = updates.duration;
      if (updates.questions !== undefined) {
        updateData.questions = updates.questions;
        updateData.totalquestions = updates.questions.length;
      }
      updateData.updatedat = new Date().toISOString();

      const { data, error } = await supabase
        .from('quizzes')
        .update(updateData)
        .eq('id', quizId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating quiz:', error);
      throw error;
    }
  },

  async deleteQuiz(quizId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting quiz:', error);
      throw error;
    }
  },

  async deleteQuizzesByLesson(lessonId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('lessonid', lessonId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting quizzes for lesson:', error);
      throw error;
    }
  },

  async getQuizStats(quizId: string) {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('pointsearned, percentage, passed')
        .eq('assessmentid', quizId);

      if (error) throw error;

      const results = data || [];
      const totalAttempts = results.length;
      const passedCount = results.filter((r: any) => r.passed).length;
      const avgPercentage =
        results.length > 0
          ? results.reduce((sum: number, r: any) => sum + (r.percentage || 0), 0) /
            results.length
          : 0;

      return {
        totalAttempts,
        passedCount,
        passRate: totalAttempts > 0 ? (passedCount / totalAttempts) * 100 : 0,
        averagePercentage: Math.round(avgPercentage * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting quiz stats:', error);
      return null;
    }
  },
};
