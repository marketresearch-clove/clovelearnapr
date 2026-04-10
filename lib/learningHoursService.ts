import { supabase } from './supabaseClient';
import { timeTrackingService } from './timeTrackingService';

export interface LearningHours {
  id: string;
  userId: string;
  courseId: string;
  timeSpentSeconds: number; // PRIMARY: all time in seconds
  hoursSpent?: number; // DEPRECATED: for backward compatibility
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export const learningHoursService = {
  /**
   * Record learning hours - now uses SECONDS as standard unit
   * @param userId User ID
   * @param courseId Course ID
   * @param timeSpentSeconds Time spent in SECONDS (standardized)
   * @param date Optional date (defaults to today)
   */
  async recordLearningHours(
    userId: string,
    courseId: string,
    timeSpentSeconds: number,
    date?: string
  ) {
    try {
      if (!timeTrackingService.isValidTime(timeSpentSeconds)) {
        throw new Error('Invalid time value. Must be non-negative number in seconds.');
      }

      const recordDate = date || new Date().toISOString().split('T')[0];

      const { data: existing, error: queryError } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('logged_date', recordDate)
        .maybeSingle();

      if (queryError && queryError.code !== 'PGRST116') throw queryError;

      if (existing) {
        // Update: add to existing time
        const totalSeconds = (existing.time_spent_seconds || 0) + timeSpentSeconds;

        const { data, error } = await supabase
          .from('learning_hours')
          .update({
            time_spent_seconds: totalSeconds,
            hours: timeTrackingService.secondsToHours(totalSeconds), // For backward compat
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        console.log(`[LEARNING_HOURS] Updated time for user ${userId}, course ${courseId}: +${timeSpentSeconds}s (total: ${totalSeconds}s)`);
        return this.mapFromDb(data);
      } else {
        // Insert: new record
        const { data, error } = await supabase
          .from('learning_hours')
          .insert([
            {
              user_id: userId,
              course_id: courseId,
              time_spent_seconds: timeSpentSeconds,
              hours: timeTrackingService.secondsToHours(timeSpentSeconds),
              logged_date: recordDate,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        console.log(`[LEARNING_HOURS] Recorded ${timeSpentSeconds}s for user ${userId}, course ${courseId}`);
        return this.mapFromDb(data);
      }
    } catch (error) {
      console.error('Error recording learning hours:', error);
      throw error;
    }
  },

  /**
   * Get today's total learning time in seconds
   */
  async getTodayLearningHours(userId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('learning_hours')
        .select('time_spent_seconds')
        .eq('user_id', userId)
        .eq('logged_date', today);

      if (error) throw error;

      const totalSeconds = (data || []).reduce((sum, record) => sum + (record.time_spent_seconds || 0), 0);
      return {
        seconds: totalSeconds,
        minutes: timeTrackingService.secondsToMinutes(totalSeconds),
        hours: timeTrackingService.secondsToHours(totalSeconds),
        formatted: timeTrackingService.formatSeconds(totalSeconds),
      };
    } catch (error) {
      console.error('Error fetching today learning hours:', error);
      return {
        seconds: 0,
        minutes: 0,
        hours: 0,
        formatted: '0s',
      };
    }
  },

  /**
   * Get total course learning time in seconds
   */
  async getCourseLearningHours(userId: string, courseId: string) {
    try {
      const { data, error } = await supabase
        .from('learning_hours')
        .select('time_spent_seconds')
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (error) throw error;

      const totalSeconds = (data || []).reduce((sum, record) => sum + (record.time_spent_seconds || 0), 0);
      return {
        seconds: totalSeconds,
        minutes: timeTrackingService.secondsToMinutes(totalSeconds),
        hours: timeTrackingService.secondsToHours(totalSeconds),
        formatted: timeTrackingService.formatSeconds(totalSeconds),
      };
    } catch (error) {
      console.error('Error fetching course learning hours:', error);
      return {
        seconds: 0,
        minutes: 0,
        hours: 0,
        formatted: '0s',
      };
    }
  },

  /**
   * Get user learning hours for date range (in seconds)
   */
  async getUserLearningHours(userId: string, startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('learning_hours')
        .select('*')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('logged_date', startDate);
      }

      if (endDate) {
        query = query.lte('logged_date', endDate);
      }

      const { data, error } = await query.order('logged_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((record) => this.mapFromDb(record));
    } catch (error) {
      console.error('Error fetching user learning hours:', error);
      return [];
    }
  },

  /**
   * Get course learning hours by date
   */
  async getCourseLearningHoursByDate(courseId: string, date: string) {
    try {
      const { data, error } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('course_id', courseId)
        .eq('logged_date', date);

      if (error) throw error;

      return (data || []).map((record) => this.mapFromDb(record));
    } catch (error) {
      console.error('Error fetching course learning hours by date:', error);
      return [];
    }
  },

  /**
   * Get weekly learning hours (last 7 days)
   */
  async getWeeklyLearningHours(userId: string) {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const records = await this.getUserLearningHours(userId, startDate, endDate);

      const totalSeconds = records.reduce((sum, record) => sum + record.timeSpentSeconds, 0);

      return {
        seconds: totalSeconds,
        minutes: timeTrackingService.secondsToMinutes(totalSeconds),
        hours: timeTrackingService.secondsToHours(totalSeconds),
        formatted: timeTrackingService.formatSeconds(totalSeconds),
        records,
      };
    } catch (error) {
      console.error('Error fetching weekly learning hours:', error);
      return {
        seconds: 0,
        minutes: 0,
        hours: 0,
        formatted: '0s',
        records: [],
      };
    }
  },

  /**
   * Get monthly learning hours
   */
  async getMonthlyLearningHours(userId: string, year?: number, month?: number) {
    try {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month !== undefined ? month : now.getMonth();

      const startDate = new Date(targetYear, targetMonth, 1)
        .toISOString()
        .split('T')[0];
      const endDate = new Date(targetYear, targetMonth + 1, 0)
        .toISOString()
        .split('T')[0];

      const records = await this.getUserLearningHours(userId, startDate, endDate);

      const totalSeconds = records.reduce((sum, record) => sum + record.timeSpentSeconds, 0);

      return {
        seconds: totalSeconds,
        minutes: timeTrackingService.secondsToMinutes(totalSeconds),
        hours: timeTrackingService.secondsToHours(totalSeconds),
        formatted: timeTrackingService.formatSeconds(totalSeconds),
        records,
      };
    } catch (error) {
      console.error('Error fetching monthly learning hours:', error);
      return {
        seconds: 0,
        minutes: 0,
        hours: 0,
        formatted: '0s',
        records: [],
      };
    }
  },

  /**
   * Delete learning hours record
   */
  async deleteLearningHours(id: string) {
    try {
      const { error } = await supabase
        .from('learning_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log(`[LEARNING_HOURS] Deleted record ${id}`);
    } catch (error) {
      console.error('Error deleting learning hours:', error);
      throw error;
    }
  },

  /**
   * Map database record to interface (snake_case to camelCase)
   */
  mapFromDb(data: any): LearningHours {
    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      timeSpentSeconds: data.time_spent_seconds || 0,
      hoursSpent: data.hours, // deprecated field
      date: data.logged_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
};
