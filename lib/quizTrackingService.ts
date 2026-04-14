import { supabase } from './supabaseClient';
import { timeTrackingService } from './timeTrackingService';

/**
 * Quiz Tracking Service
 * Handles quiz attempt tracking with time allocation validation
 */

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  courseId: string;
  lessonId?: string;
  startedAt: Date;
  finishedAt?: Date;
  timeSpentSeconds: number;
  timeAllocatedSeconds: number;
  score?: number;
  totalPoints?: number;
  percentage?: number;
  passed?: boolean;
  attemptNumber: number;
  isCompleted: boolean;
}

export const quizTrackingService = {
  /**
   * Start a quiz attempt
   */
  async startQuizAttempt(
    userId: string,
    quizId: string,
    courseId: string,
    lessonId?: string
  ): Promise<QuizAttempt | null> {
    try {
      // Get quiz info to get allocated time
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('id, duration, totalpoints')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;

      // Get current attempt number
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('attempt_number')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (attemptsError && attemptsError.code !== 'PGRST116') throw attemptsError;

      const attemptNumber = (attempts && attempts[0]?.attempt_number) || 0 + 1;

      // Create quiz attempt record
      const { data, error } = await supabase
        .from('quiz_attempts')
        .insert([
          {
            user_id: userId,
            quiz_id: quizId,
            course_id: courseId,
            lesson_id: lessonId || null,
            started_at: new Date().toISOString(),
            time_allocated_seconds: (quiz.duration || 0) * 60, // Convert minutes to seconds
            attempt_number: attemptNumber,
            is_completed: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      console.log(`[QUIZ] Started quiz attempt for user ${userId}, quiz ${quizId}, attempt #${attemptNumber}`);

      return {
        id: data.id,
        userId: data.user_id,
        quizId: data.quiz_id,
        courseId: data.course_id,
        lessonId: data.lesson_id,
        startedAt: new Date(data.started_at),
        finishedAt: undefined,
        timeSpentSeconds: 0,
        timeAllocatedSeconds: data.time_allocated_seconds,
        attemptNumber: data.attempt_number,
        isCompleted: false,
      };
    } catch (error) {
      console.error('[QUIZ] Error starting quiz attempt:', error);
      return null;
    }
  },

  /**
   * Complete a quiz attempt
   */
  async completeQuizAttempt(
    quizAttemptId: string,
    score: number,
    totalPoints: number,
    passed: boolean
  ): Promise<QuizAttempt | null> {
    try {
      const now = new Date();
      const percentage = Math.round((score / totalPoints) * 100);

      // Get the attempt to calculate time spent
      const { data: attempt, error: getError } = await supabase
        .from('quiz_attempts')
        .select('started_at, time_allocated_seconds')
        .eq('id', quizAttemptId)
        .single();

      if (getError) throw getError;

      const startTime = new Date(attempt.started_at).getTime();
      const endTime = now.getTime();
      const timeSpentSeconds = Math.floor((endTime - startTime) / 1000);

      // Update the attempt
      const { data, error } = await supabase
        .from('quiz_attempts')
        .update({
          finished_at: now.toISOString(),
          time_spent_seconds: timeSpentSeconds,
          score,
          total_points: totalPoints,
          percentage,
          passed,
          is_completed: true,
          updated_at: now.toISOString(),
        })
        .eq('id', quizAttemptId)
        .select()
        .single();

      if (error) throw error;

      console.log(
        `[QUIZ] Completed quiz attempt ${quizAttemptId}: ${score}/${totalPoints} (${percentage}%), time: ${timeTrackingService.formatAsHMS(timeSpentSeconds)}`
      );

      return {
        id: data.id,
        userId: data.user_id,
        quizId: data.quiz_id,
        courseId: data.course_id,
        lessonId: data.lesson_id,
        startedAt: new Date(data.started_at),
        finishedAt: new Date(data.finished_at),
        timeSpentSeconds: data.time_spent_seconds,
        timeAllocatedSeconds: data.time_allocated_seconds,
        score: data.score,
        totalPoints: data.total_points,
        percentage: data.percentage,
        passed: data.passed,
        attemptNumber: data.attempt_number,
        isCompleted: true,
      };
    } catch (error) {
      console.error('[QUIZ] Error completing quiz attempt:', error);
      return null;
    }
  },

  /**
   * Get quiz attempt
   */
  async getQuizAttempt(quizAttemptId: string): Promise<QuizAttempt | null> {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('id', quizAttemptId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        quizId: data.quiz_id,
        courseId: data.course_id,
        lessonId: data.lesson_id,
        startedAt: new Date(data.started_at),
        finishedAt: data.finished_at ? new Date(data.finished_at) : undefined,
        timeSpentSeconds: data.time_spent_seconds || 0,
        timeAllocatedSeconds: data.time_allocated_seconds || 0,
        score: data.score,
        totalPoints: data.total_points,
        percentage: data.percentage,
        passed: data.passed,
        attemptNumber: data.attempt_number,
        isCompleted: data.is_completed,
      };
    } catch (error) {
      console.error('[QUIZ] Error getting quiz attempt:', error);
      return null;
    }
  },

  /**
   * Get all attempts for a quiz by user
   */
  async getUserQuizAttempts(userId: string, quizId: string): Promise<QuizAttempt[]> {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .order('attempt_number', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        quizId: d.quiz_id,
        courseId: d.course_id,
        lessonId: d.lesson_id,
        startedAt: new Date(d.started_at),
        finishedAt: d.finished_at ? new Date(d.finished_at) : undefined,
        timeSpentSeconds: d.time_spent_seconds || 0,
        timeAllocatedSeconds: d.time_allocated_seconds || 0,
        score: d.score,
        totalPoints: d.total_points,
        percentage: d.percentage,
        passed: d.passed,
        attemptNumber: d.attempt_number,
        isCompleted: d.is_completed,
      }));
    } catch (error) {
      console.error('[QUIZ] Error getting user quiz attempts:', error);
      return [];
    }
  },

  /**
   * Get quiz statistics
   */
  async getQuizStatistics(quizId: string): Promise<{
    totalAttempts: number;
    uniqueUsers: number;
    avgScore: number;
    avgTimeSeconds: number;
    passRate: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('user_id, score, total_points, time_spent_seconds, passed')
        .eq('quiz_id', quizId)
        .eq('is_completed', true);

      if (error) throw error;

      const attempts = data || [];
      if (attempts.length === 0) {
        return {
          totalAttempts: 0,
          uniqueUsers: 0,
          avgScore: 0,
          avgTimeSeconds: 0,
          passRate: 0,
        };
      }

      const uniqueUsers = new Set(attempts.map((a: any) => a.user_id)).size;
      const avgScore = Math.round(
        attempts.reduce((sum: number, a: any) => sum + ((a.score / a.total_points) * 100 || 0), 0) /
        attempts.length
      );
      const avgTime = Math.round(
        attempts.reduce((sum: number, a: any) => sum + (a.time_spent_seconds || 0), 0) / attempts.length
      );
      const passCount = attempts.filter((a: any) => a.passed).length;
      const passRate = Math.round((passCount / attempts.length) * 100);

      return {
        totalAttempts: attempts.length,
        uniqueUsers,
        avgScore,
        avgTimeSeconds: avgTime,
        passRate,
      };
    } catch (error) {
      console.error('[QUIZ] Error getting quiz statistics:', error);
      return {
        totalAttempts: 0,
        uniqueUsers: 0,
        avgScore: 0,
        avgTimeSeconds: 0,
        passRate: 0,
      };
    }
  },

  /**
   * Check if user exceeded time allocation
   */
  checkTimeExceeded(timeSpentSeconds: number, timeAllocatedSeconds: number): boolean {
    return timeSpentSeconds > timeAllocatedSeconds;
  },

  /**
   * Format quiz attempt for display
   */
  formatAttempt(attempt: QuizAttempt): {
    displayTime: string;
    displayAllocated: string;
    displayScore: string;
  } {
    return {
      displayTime: timeTrackingService.formatAsHMS(attempt.timeSpentSeconds),
      displayAllocated: timeTrackingService.formatAsHMS(attempt.timeAllocatedSeconds),
      displayScore: attempt.score ? `${attempt.score}/${attempt.totalPoints}` : 'Not Scored',
    };
  },
};
