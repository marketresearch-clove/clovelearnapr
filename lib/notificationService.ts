import { supabase } from './supabaseClient';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'general' | 'course' | 'assignment' | 'system' | 'announcement';
  image_url?: string;
  link_url?: string;
  link_label?: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  priority: number;
  sender_id?: string;
  metadata?: any;
}

export interface CreateNotificationData {
  user_id: string;
  title: string;
  message: string;
  type?: 'general' | 'course' | 'assignment' | 'system' | 'announcement';
  image_url?: string;
  link_url?: string;
  link_label?: string;
  priority?: number;
  sender_id?: string;
  metadata?: any;
  expires_at?: string;
}

class NotificationService {
  // Get user notifications (excluding soft-deleted)
  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles!notifications_sender_id_fkey (
            fullname,
            avatarurl
          )
        `)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
    }
  }

  // Get unread notifications count (excluding soft-deleted)
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_deleted', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for user
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Create single notification
  async createNotification(notificationData: CreateNotificationData): Promise<Notification> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...notificationData,
          type: notificationData.type || 'general',
          priority: notificationData.priority || 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Log to audit log for history
      try {
        await supabase.from('notification_audit_log').insert({
          user_id: data.user_id,
          notification_id: data.id,
          action: 'sent',
          details: {
            source: 'notificationService.createNotification',
            type: data.type
          }
        });
      } catch (logError) {
        console.error('Failed to log notification to audit log:', logError);
        // Don't fail the whole operation if logging fails
      }

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Send notification to multiple users
  async sendToMultipleUsers(
    userIds: string[],
    notificationData: Omit<CreateNotificationData, 'user_id'>
  ): Promise<Notification[]> {
    try {
      const notifications = userIds.map(userId => ({
        ...notificationData,
        user_id: userId,
        type: notificationData.type || 'general',
        priority: notificationData.priority || 1,
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) throw error;

      // Log to audit log for history
      if (data && data.length > 0) {
        try {
          const logs = data.map(notif => ({
            user_id: notif.user_id,
            notification_id: notif.id,
            action: 'sent',
            details: {
              source: 'notificationService.sendToMultipleUsers',
              batch_size: data.length,
              type: notif.type
            }
          }));
          await supabase.from('notification_audit_log').insert(logs);
        } catch (logError) {
          console.error('Failed to log batch notifications to audit log:', logError);
        }
      }

      return data || [];
    } catch (error) {
      console.error('Error sending notifications to multiple users:', error);
      throw error;
    }
  }

  // Send notification to all users
  async sendToAllUsers(notificationData: Omit<CreateNotificationData, 'user_id'>): Promise<Notification[]> {
    try {
      // Get all user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'user');

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.id) || [];
      return await this.sendToMultipleUsers(userIds, notificationData);
    } catch (error) {
      console.error('Error sending notification to all users:', error);
      throw error;
    }
  }

  // Delete notification (soft delete to preserve history)
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Get notifications by type (excluding soft-deleted)
  async getNotificationsByType(
    userId: string,
    type: Notification['type'],
    limit: number = 20
  ): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications by type:', error);
      throw error;
    }
  }

  // Course notification helpers
  async sendCourseNotification(
    userIds: string[],
    courseId: string,
    courseTitle: string,
    message: string,
    type: 'course_started' | 'course_completed' | 'course_reminder' | 'course_updated' = 'course_started'
  ): Promise<Notification[]> {
    const titles = {
      course_started: 'New Course Available',
      course_completed: 'Course Completed!',
      course_reminder: 'Course Reminder',
      course_updated: 'Course Updated',
    };

    return await this.sendToMultipleUsers(userIds, {
      title: titles[type] || 'Course Notification',
      message,
      type: 'course',
      link_url: `/course/${courseId}`,
      link_label: `View ${courseTitle}`,
      metadata: { course_id: courseId, notification_type: type },
      priority: type === 'course_reminder' ? 3 : 2
    });
  }

  // Assignment notification helpers
  async sendAssignmentNotification(
    userIds: string[],
    assignmentId: string,
    assignmentTitle: string,
    message: string,
    type: 'assignment_assigned' | 'assignment_due' | 'assignment_graded' = 'assignment_assigned'
  ): Promise<Notification[]> {
    const titles = {
      assignment_assigned: 'New Assignment',
      assignment_due: 'Assignment Due Soon',
      assignment_graded: 'Assignment Graded',
    };

    return await this.sendToMultipleUsers(userIds, {
      title: titles[type] || 'Assignment Notification',
      message,
      type: 'assignment',
      link_url: `/assignment/${assignmentId}`,
      link_label: `View Assignment`,
      metadata: { assignment_id: assignmentId, notification_type: type },
      priority: type === 'assignment_due' ? 4 : 2
    });
  }

  // System notification helpers
  async sendSystemNotification(
    userIds: string[],
    title: string,
    message: string,
    priority: number = 1
  ): Promise<Notification[]> {
    return await this.sendToMultipleUsers(userIds, {
      title,
      message,
      type: 'system',
      priority
    });
  }

  // Real-time subscription for new notifications and deletions
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification | null, event: string) => void
  ) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Only emit if not soft-deleted
          if (!(payload.new as any).is_deleted) {
            callback(payload.new as Notification, 'INSERT');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Handle soft delete (is_deleted changed to true)
          if ((payload.new as any).is_deleted) {
            callback(null, 'DELETE');
          } else {
            callback(payload.new as Notification, 'UPDATE');
          }
        }
      )
      .subscribe();

    return channel;
  }

  // Cleanup expired notifications
  async cleanupExpiredNotifications(): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();