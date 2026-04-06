import { supabase } from './supabaseClient';

export interface QuizResult {
  id: string;
  userId: string;
  courseId: string;
  assessmentId: string;
  quizTitle: string;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answers?: Record<string, any>;
  timeTaken: number;
  attemptNumber: number;
  completedAt: string;
  createdAt: string;
}

export interface QuizResultInput {
  userId: string;
  courseId: string;
  assessmentId: string;
  quizTitle: string;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answers?: Record<string, any>;
  timeTaken: number;
  attemptNumber?: number;
}

export const quizResultsService = {
  async saveQuizResult(result: QuizResultInput): Promise<QuizResult | null> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .insert([
          {
            userid: result.userId,
            courseid: result.courseId,
            assessmentid: result.assessmentId,
            quiztitle: result.quizTitle,
            pointsearned: result.pointsEarned,
            totalpoints: result.totalPoints,
            percentage: result.percentage,
            passed: result.passed,
            answers: result.answers || {},
            timetaken: result.timeTaken,
            attemptnumber: result.attemptNumber || 1,
            completedat: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving quiz result:', error);
      throw error;
    }
  },

  async getUserQuizResults(userId: string): Promise<QuizResult[]> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('userid', userId)
        .order('completedat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user quiz results:', error);
      return [];
    }
  },

  async getCourseQuizResults(userId: string, courseId: string): Promise<QuizResult[]> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .order('completedat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching course quiz results:', error);
      return [];
    }
  },

  async getQuizAttempts(
    userId: string,
    assessmentId: string
  ): Promise<QuizResult[]> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('userid', userId)
        .eq('assessmentid', assessmentId)
        .order('attemptnumber', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching quiz attempts:', error);
      return [];
    }
  },

  async getBestQuizScore(
    userId: string,
    assessmentId: string
  ): Promise<QuizResult | null> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('userid', userId)
        .eq('assessmentid', assessmentId)
        .order('pointsearned', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching best quiz score:', error);
      return null;
    }
  },

  async getUserTotalPoints(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('pointsearned')
        .eq('userid', userId);

      if (error) throw error;

      const totalPoints = (data || []).reduce(
        (sum: number, result: any) => sum + (result.pointsearned || 0),
        0
      );

      return totalPoints;
    } catch (error) {
      console.error('Error calculating user total points:', error);
      return 0;
    }
  },

  async getCourseTotalPoints(
    userId: string,
    courseId: string
  ): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('pointsearned')
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (error) throw error;

      const totalPoints = (data || []).reduce(
        (sum: number, result: any) => sum + (result.pointsearned || 0),
        0
      );

      return totalPoints;
    } catch (error) {
      console.error('Error calculating course total points:', error);
      return 0;
    }
  },

  async getQuizStats(assessmentId: string) {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('pointsearned, percentage, passed')
        .eq('assessmentid', assessmentId);

      if (error) throw error;

      const results = data || [];
      const totalAttempts = results.length;
      const passedCount = results.filter((r: any) => r.passed).length;
      const totalPointsEarned = results.reduce(
        (sum: number, r: any) => sum + (r.pointsearned || 0),
        0
      );
      const avgPercentage =
        results.length > 0
          ? results.reduce((sum: number, r: any) => sum + (r.percentage || 0), 0) /
            results.length
          : 0;

      return {
        totalAttempts,
        passedCount,
        passRate: totalAttempts > 0 ? (passedCount / totalAttempts) * 100 : 0,
        totalPointsEarned,
        averagePercentage: Math.round(avgPercentage * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting quiz stats:', error);
      return null;
    }
  },
};
