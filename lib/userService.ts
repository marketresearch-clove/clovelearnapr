import { supabase } from './supabaseClient';

export interface UserProfile {
  id: string;
  email: string;
  fullname: string;
  role: 'student' | 'instructor' | 'admin';
  avatarurl?: string;
  bio?: string;
  createdat?: string;
  department?: string;
  mobile_number?: string;
  user_id?: string;
  designation?: string;
  user_status?: string;
}

export const userService = {
  async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  async getUsers(role?: string) {
    try {
      let query = supabase.from('profiles').select('*');
      
      if (role) {
        query = query.eq('role', role);
      }

      const { data, error } = await query.order('createdAt', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },

  async searchUsers(query: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`fullName.ilike.%${query}%,email.ilike.%${query}%`);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  },

  async triggerWelcomeEmails(userIds: string[]) {
    try {
      // In a real app, this would call a Supabase Edge Function
      // to send emails, to avoid exposing service keys on the client.
      console.log('Triggering welcome emails for:', userIds);
      // Example of what the Edge Function call might look like:
      // const { error } = await supabase.functions.invoke('send-welcome-email', { body: { userIds } });
      // if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error triggering welcome emails:', error);
      return { success: false, error };
    }
  },

  async bulkUpdateUserStatus(userIds: string[], status: 'Active' | 'Inactive') {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ user_status: status })
        .in('id', userIds)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error(`Error bulk updating user status to ${status}:`, error);
      return { success: false, error };
    }
  },
};