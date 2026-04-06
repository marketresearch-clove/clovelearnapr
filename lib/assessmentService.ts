import { supabase } from './supabaseClient';
import { userStatisticsService } from './userStatisticsService';
import { leaderboardService } from './leaderboardService';

export interface Question {
  id: number;
  text: string;
  type: 'multiple-choice' | 'short-answer' | 'true-false';
  options?: string[];
  correctAnswer: string | number;
  points: number;
}

export interface Assessment {
  id: string;
  courseId: string;
  lessonId?: string;
  title: string;
  description?: string;
  type: 'quiz' | 'assessment' | 'final_exam';
  passingScore: number;
  questions: Question[];
  totalQuestions: number;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  userId: string;
  score: number;
  percentage: number;
  passed: boolean;
  answers: Record<string, string>;
  timeTaken: number;
  attemptNumber: number;
  completedAt: string;
}

export const assessmentService = {
  async getAssessment(assessmentId: string) {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching assessment:', error);
      return null;
    }
  },

  async getCourseAssessments(courseId: string) {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('courseId', courseId)
        .order('createdAt', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching course assessments:', error);
      return [];
    }
  },

  async getLessonAssessments(lessonId: string) {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('lessonid', lessonId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching lesson assessments:', error);
      return [];
    }
  },

  async createAssessment(assessment: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .insert([assessment])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating assessment:', error);
      throw error;
    }
  },

  async updateAssessment(assessmentId: string, updates: Partial<Assessment>) {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .update(updates)
        .eq('id', assessmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating assessment:', error);
      throw error;
    }
  },

  async deleteAssessment(assessmentId: string) {
    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', assessmentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting assessment:', error);
      throw error;
    }
  },

  // Results Management
  async submitAssessment(
    assessmentId: string,
    userId: string,
    answers: Record<string, string>,
    timeTaken: number
  ) {
    try {
      const assessment = await this.getAssessment(assessmentId);
      if (!assessment) throw new Error('Assessment not found');

      let score = 0;
      const questions = assessment.questions || [];

      questions.forEach((question: Question) => {
        const userAnswer = answers[question.id.toString()];
        if (userAnswer && userAnswer === question.correctAnswer.toString()) {
          score += question.points;
        }
      });

      const totalPoints = questions.reduce((sum: number, q: Question) => sum + q.points, 0);
      const percentage = (score / totalPoints) * 100;
      const passed = percentage >= assessment.passingScore;

      const { data, error } = await supabase
        .from('assessment_results')
        .insert([{
          assessmentid: assessmentId,
          userid: userId,
          score,
          percentage: Math.round(percentage * 100) / 100,
          passed,
          answers,
          timetaken: timeTaken,
          attemptnumber: 1,
        }])
        .select()
        .single();

      if (error) throw error;

      if (passed) {
        const points = Math.round(percentage);
        await userStatisticsService.updatePoints(userId, points);
        await leaderboardService.updateLeaderboardFromStatistics(userId);
      }

      return data;
    } catch (error) {
      console.error('Error submitting assessment:', error);
      throw error;
    }
  },

  async getUserAssessmentResults(userId: string, assessmentId: string) {
    try {
      const { data, error } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('userId', userId)
        .eq('assessmentId', assessmentId)
        .order('completedAt', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching assessment results:', error);
      return [];
    }
  },

  async getUserCourseResults(userId: string, courseId: string) {
    try {
      const { data, error } = await supabase
        .from('assessment_results')
        .select(`
          *,
          assessments(id, title, type, courseId)
        `)
        .eq('userId', userId)
        .eq('assessments.courseId', courseId)
        .order('completedAt', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching course results:', error);
      return [];
    }
  },

  async getAssessmentStats(assessmentId: string) {
    try {
      const { data, error } = await supabase
        .from('assessment_results')
        .select('score, percentage, passed')
        .eq('assessmentId', assessmentId);

      if (error) throw error;

      const results = data || [];
      const totalAttempts = results.length;
      const passedCount = results.filter((r: AssessmentResult) => r.passed).length;
      const avgScore = results.length > 0
        ? results.reduce((sum: number, r: AssessmentResult) => sum + r.percentage, 0) / results.length
        : 0;

      return {
        totalAttempts,
        passedCount,
        passRate: totalAttempts > 0 ? (passedCount / totalAttempts) * 100 : 0,
        averageScore: Math.round(avgScore * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting assessment stats:', error);
      return null;
    }
  },

  async getBestResult(userId: string, assessmentId: string) {
    try {
      const { data, error } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('userId', userId)
        .eq('assessmentId', assessmentId)
        .order('score', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching best result:', error);
      return null;
    }
  },
};
