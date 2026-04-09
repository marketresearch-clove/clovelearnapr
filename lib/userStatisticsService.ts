import { supabase } from './supabaseClient';
import { cacheService } from './cacheService';

export interface UserStatistics {
  id: string;
  userId: string;
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  totalLearningHours: number;
  currentStreak: number;
  totalPoints: number;
  leaderboardRank?: number;
  lastActivityAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const userStatisticsService = {
  async getUserStatistics(userId: string) {
    try {
      // Check cache first
      const cacheKey = `cache:user_stats:${userId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('[STATS CACHE] Using cached user statistics for:', userId);
        return cached;
      }

      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('userid', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        return await this.initializeUserStatistics(userId);
      }

      // Cache the result with 5 minute expiration
      cacheService.set(cacheKey, data, 5 * 60 * 1000);

      return data;
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      return null;
    }
  },

  async initializeUserStatistics(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_statistics')
        .insert([
          {
            userid: userId,
            totalcoursesenrolled: 0,
            coursescompleted: 0,
            totallearninghours: 0,
            currentstreak: 0,
            totalpoints: 0,
            leaderboardrank: null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error initializing user statistics:', error);
      return null;
    }
  },

  async updateLearningHours(userId: string, minutesSpent: number) {
    try {
      const stats = await this.getUserStatistics(userId);
      if (!stats) return null;

      // Convert minutes to hours and add to existing total
      const hoursSpent = minutesSpent / 60;
      const newTotalHours = (stats.totallearninghours || 0) + hoursSpent;

      const { data, error } = await supabase
        .from('user_statistics')
        .update({
          totallearninghours: Math.round(newTotalHours), // Convert to integer minutes
          lastactivityat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;
      // Invalidate cache after update
      cacheService.remove(`cache:user_stats:${userId}`);
      return data;
    } catch (error) {
      console.error('Error updating learning hours:', error);
      throw error;
    }
  },

  async incrementCoursesCompleted(userId: string) {
    try {
      const stats = await this.getUserStatistics(userId);
      if (!stats) return null;

      const { data, error } = await supabase
        .from('user_statistics')
        .update({
          coursescompleted: (stats.coursescompleted || 0) + 1,
          totalpoints: (stats.totalpoints || 0) + 100,
          lastactivityat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;
      // Invalidate cache after update
      cacheService.remove(`cache:user_stats:${userId}`);
      return data;
    } catch (error) {
      console.error('Error incrementing courses completed:', error);
      throw error;
    }
  },

  async decrementCoursesCompleted(userId: string) {
    try {
      const stats = await this.getUserStatistics(userId);
      if (!stats) return null;

      // Recalculate total learning hours from all enrollments
      // This is important when a course is retaken and its hours are reset to 0
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('hoursspent')
        .eq('userid', userId);

      const totalMinutes = (enrollments || []).reduce((sum, e) => sum + (e.hoursspent || 0), 0);
      const totalHours = Math.round(totalMinutes / 60);

      const { data, error } = await supabase
        .from('user_statistics')
        .update({
          coursescompleted: Math.max(0, (stats.coursescompleted || 0) - 1),
          totallearninghours: totalHours,
          lastactivityat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;
      // Invalidate cache after update
      cacheService.remove(`cache:user_stats:${userId}`);
      return data;
    } catch (error) {
      console.error('Error decrementing courses completed:', error);
      throw error;
    }
  },

  async updateCoursesEnrolled(userId: string, enrolled: boolean) {
    try {
      const stats = await this.getUserStatistics(userId);
      if (!stats) return null;

      const change = enrolled ? 1 : -1;
      const { data, error } = await supabase
        .from('user_statistics')
        .update({
          totalcoursesenrolled: Math.max(0, (stats.totalcoursesenrolled || 0) + change),
          lastactivityat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;
      // Invalidate cache after update
      cacheService.remove(`cache:user_stats:${userId}`);
      return data;
    } catch (error) {
      console.error('Error updating courses enrolled:', error);
      throw error;
    }
  },

  async updatePoints(userId: string, points: number) {
    try {
      const stats = await this.getUserStatistics(userId);
      if (!stats) return null;

      const { data, error } = await supabase
        .from('user_statistics')
        .update({
          totalpoints: (stats.totalpoints || 0) + points,
          lastactivityat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;
      // Invalidate cache after update
      cacheService.remove(`cache:user_stats:${userId}`);
      return data;
    } catch (error) {
      console.error('Error updating points:', error);
      throw error;
    }
  },

  async updateCurrentStreak(userId: string, streak: number) {
    try {
      const { data, error } = await supabase
        .from('user_statistics')
        .update({
          currentstreak: streak,
          lastactivityat: new Date().toISOString(),
        })
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;
      // Invalidate cache after update
      cacheService.remove(`cache:user_stats:${userId}`);
      return data;
    } catch (error) {
      console.error('Error updating streak:', error);
      throw error;
    }
  },

  async getAllUserStatistics() {
    try {
      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .order('totalpoints', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all user statistics:', error);
      return [];
    }
  },

  async getTopUsers(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .order('totalpoints', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching top users:', error);
      return [];
    }
  },
};
