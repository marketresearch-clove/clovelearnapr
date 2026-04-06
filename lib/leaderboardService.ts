import { supabase } from './supabaseClient';
import { userStatisticsService } from './userStatisticsService';

export interface LeaderboardEntry {
  id: string;
  userid: string;
  username: string;
  useravatar?: string;
  totalpoints: number;
  rank: number;
  coursescompleted: number;
  totalhours: number;
}

export const leaderboardService = {
  async getLeaderboard(limit = 100) {
    try {
      const { data, error, status, statusText } = await supabase
        .from('leaderboard')
        .select('*')
        .order('totalpoints', { ascending: false })
        .order('coursescompleted', { ascending: false })
        .order('userid', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching leaderboard:', {
          error: error?.message,
          code: error?.code,
          status,
          statusText
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  },

  async getUserRank(userId: string) {
    try {
      let { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('userid', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user rank:', {
          userId,
          error: error?.message,
          code: error?.code
        });

        // If it's a 406 or has no data, try to create leaderboard entry
        if (!data && error.code === 'PGRST116') {
          console.log('Creating new leaderboard entry for user:', userId);

          // Get user profile info
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, fullname, avatarurl')
            .eq('id', userId)
            .single();

          if (profile) {
            const created = await this.initializeLeaderboardEntry(
              userId,
              profile.fullname || 'User',
              profile.avatarurl
            );
            if (created) {
              return { ...created, rank: undefined };
            }
          }
        }

        // Only throw if it's a real error, not just "record not found"
        if (error.code !== 'PGRST116') {
          throw error;
        }
      }

      if (!data) {
        console.warn('No leaderboard entry found for user:', userId);
        // Try to create the entry
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, fullname, avatarurl')
          .eq('id', userId)
          .single();

        if (profile) {
          const created = await this.initializeLeaderboardEntry(
            userId,
            profile.fullname || 'User',
            profile.avatarurl
          );
          if (created) {
            return { ...created, rank: undefined };
          }
        }
        return null;
      }

      // Always calculate rank dynamically to ensure it matches the sorted leaderboard
      const { count, error: countError } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .or(`totalpoints.gt.${data.totalpoints},and(totalpoints.eq.${data.totalpoints},coursescompleted.gt.${data.coursescompleted}),and(totalpoints.eq.${data.totalpoints},coursescompleted.eq.${data.coursescompleted},userid.lt.${data.userid})`);

      if (countError) {
        console.error('Error calculating rank:', countError);
        throw countError;
      }

      data.rank = (count || 0) + 1;
      return data;
    } catch (error) {
      console.error('Error fetching user rank:', error);
      return null;
    }
  },

  async initializeLeaderboardEntry(userId: string, userName: string, userAvatar?: string) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .insert([
          {
            userid: userId,
            username: userName,
            useravatar: userAvatar,
            totalpoints: 0,
            rank: null,
            coursescompleted: 0,
            totalhours: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error initializing leaderboard entry:', error);
      return null;
    }
  },

  async updateLeaderboardEntry(userId: string, updates: Partial<LeaderboardEntry>) {
    try {
      // Fetch latest profile data to ensure sync
      const { data: profile } = await supabase
        .from('profiles')
        .select('fullname, avatarurl')
        .eq('id', userId)
        .single();

      const existing = await this.getUserRank(userId);

      if (!existing) {
        await this.initializeLeaderboardEntry(
          userId,
          profile?.fullname || 'User',
          profile?.avatarurl
        );
      }

      // Merge profile updates with provided updates
      const finalUpdates = {
        ...updates,
        username: profile?.fullname || updates.username, // Keep username synced with fullname
        useravatar: profile?.avatarurl || updates.useravatar // Keep avatar synced
      };

      const { data, error } = await supabase
        .from('leaderboard')
        .update(finalUpdates)
        .eq('userid', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      throw error;
    }
  },

  async updateLeaderboardFromStatistics(userId: string) {
    try {
      const stats = await userStatisticsService.getUserStatistics(userId);
      if (!stats) return null;

      const result = await this.updateLeaderboardEntry(userId, {
        totalpoints: stats.totalpoints,
        coursescompleted: stats.coursescompleted,
        totalhours: stats.totallearninghours,
      });

      // Recalculate rankings after update
      await this.recalculateRankings();

      return result;
    } catch (error) {
      console.error('Error updating leaderboard from statistics:', error);
      throw error;
    }
  },

  async recalculateRankings() {
    try {
      const { data: leaderboard, error: fetchError } = await supabase
        .from('leaderboard')
        .select('*')
        .order('totalpoints', { ascending: false })
        .order('coursescompleted', { ascending: false })
        .order('userid', { ascending: true });

      if (fetchError) throw fetchError;

      if (!leaderboard || leaderboard.length === 0) return;

      const updates = leaderboard.map((entry: any, index: number) => ({
        id: entry.id,
        userid: entry.userid,
        username: entry.username,
        useravatar: entry.useravatar,
        totalpoints: entry.totalpoints,
        rank: index + 1,
        coursescompleted: entry.coursescompleted,
        totalhours: entry.totalhours,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('leaderboard')
          .update({ rank: update.rank })
          .eq('userid', update.userid);

        if (error) throw error;
      }

      return updates;
    } catch (error) {
      console.error('Error recalculating rankings:', error);
      throw error;
    }
  },

  async getTopUsers(limit = 10) {
    return this.getLeaderboardWithProfiles(limit);
  },

  async getNearbyUsers(userId: string, range = 5) {
    try {
      const userRank = await this.getUserRank(userId);
      if (!userRank || userRank.rank === null) return [];

      const startRank = Math.max(1, (userRank.rank as number) - range);
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .gte('rank', startRank)
        .lte('rank', (userRank.rank as number) + range)
        .order('rank', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching nearby users:', error);
      return [];
    }
  },

  async getLeaderboardWithProfiles(limit = 100) {
    try {
      // Fetch leaderboard data sorted by points with deterministic tie-breaking
      const { data: leaderboard, error, status, statusText } = await supabase
        .from('leaderboard')
        .select('*')
        .order('totalpoints', { ascending: false })
        .order('coursescompleted', { ascending: false })
        .order('userid', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Leaderboard query error:', {
          error,
          status,
          statusText,
          message: error?.message,
          code: error?.code
        });
        throw error;
      }

      if (!leaderboard || leaderboard.length === 0) {
        console.warn('No leaderboard data found');
        return [];
      }

      // Fetch profiles manually to avoid join issues
      const userIds = leaderboard.map((entry: any) => entry.userid);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, fullname, email, avatarurl, department')
        .in('id', userIds);

      if (profilesError) {
        console.error('Profiles query error:', profilesError);
        throw profilesError;
      }

      // Create a map of profiles for easy lookup
      const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);

      // Combine data and calculate rank
      return leaderboard.map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1, // Calculate rank based on position
        profiles: profilesMap.get(entry.userid) || {
          fullname: entry.username,
          avatarurl: entry.useravatar
        }
      }));
    } catch (error) {
      console.error('Error fetching leaderboard with profiles:', error);
      return [];
    }
  },

  // Diagnostic method to test leaderboard connectivity
  async testLeaderboardConnection() {
    try {
      console.log('Testing leaderboard table connection...');

      // Test 1: Simple select count
      const { count, error: countError } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Connection test failed:', countError);
        return { connected: false, error: countError?.message };
      }

      console.log(`✓ Leaderboard table accessible. Records count: ${count}`);

      // Test 2: Fetch one record
      const { data, error: dataError } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(1);

      if (dataError) {
        console.error('Data fetch test failed:', dataError);
        return { connected: true, countable: true, error: dataError?.message };
      }

      console.log(`✓ Leaderboard data fetch successful. Sample data:`, data?.[0]);

      return {
        connected: true,
        countable: true,
        dataAccessible: true,
        recordCount: count
      };
    } catch (error) {
      console.error('Diagnostic test error:', error);
      return { connected: false, error: String(error) };
    }
  },
};
