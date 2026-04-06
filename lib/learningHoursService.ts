import { supabase } from './supabaseClient';

export interface LearningHours {
  id: string;
  userId: string;
  courseId: string;
  hoursSpent: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export const learningHoursService = {
  async recordLearningHours(
    userId: string,
    courseId: string,
    hoursSpent: number,
    date?: string
  ) {
    try {
      const recordDate = date || new Date().toISOString().split('T')[0];
      
      const { data: existing, error: queryError } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId)
        .eq('date', recordDate)
        .single();

      if (queryError && queryError.code !== 'PGRST116') throw queryError;

      if (existing) {
        const { data, error } = await supabase
          .from('learning_hours')
          .update({
            hoursspent: (existing.hoursspent || 0) + hoursSpent,
            updatedat: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('learning_hours')
          .insert([
            {
              userid: userId,
              courseid: courseId,
              hoursspent: hoursSpent,
              date: recordDate,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error recording learning hours:', error);
      throw error;
    }
  },

  async getTodayLearningHours(userId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId)
        .eq('date', today);

      if (error) throw error;
      
      const totalHours = (data || []).reduce((sum, record) => sum + (record.hoursspent || 0), 0);
      return totalHours;
    } catch (error) {
      console.error('Error fetching today learning hours:', error);
      return 0;
    }
  },

  async getCourseLearningHours(userId: string, courseId: string) {
    try {
      const { data, error } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId)
        .eq('courseid', courseId);

      if (error) throw error;
      
      const totalHours = (data || []).reduce((sum, record) => sum + (record.hoursspent || 0), 0);
      return totalHours;
    } catch (error) {
      console.error('Error fetching course learning hours:', error);
      return 0;
    }
  },

  async getUserLearningHours(userId: string, startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('learning_hours')
        .select('*')
        .eq('userid', userId);

      if (startDate) {
        query = query.gte('date', startDate);
      }
      
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query.order('date', { ascending: true });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching user learning hours:', error);
      return [];
    }
  },

  async getCourseLearningHoursByDate(courseId: string, date: string) {
    try {
      const { data, error } = await supabase
        .from('learning_hours')
        .select('*')
        .eq('courseid', courseId)
        .eq('date', date);

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching course learning hours by date:', error);
      return [];
    }
  },

  async getWeeklyLearningHours(userId: string) {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      return await this.getUserLearningHours(userId, startDate, endDate);
    } catch (error) {
      console.error('Error fetching weekly learning hours:', error);
      return [];
    }
  },

  async getMonthlyLearningHours(userId: string, year?: number, month?: number) {
    try {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month !== undefined ? month : now.getMonth();

      const startDate = new Date(targetYear, targetMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(targetYear, targetMonth + 1, 0).toISOString().split('T')[0];

      return await this.getUserLearningHours(userId, startDate, endDate);
    } catch (error) {
      console.error('Error fetching monthly learning hours:', error);
      return [];
    }
  },

  async deleteLearningHours(id: string) {
    try {
      const { error } = await supabase
        .from('learning_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting learning hours:', error);
      throw error;
    }
  },
};
