import { supabase } from './supabaseClient';

// ====================================
// TYPES & INTERFACES
// ====================================

export interface NotificationDraft {
    id: string;
    admin_id: string;
    title: string;
    message: string;
    type: 'general' | 'course' | 'assignment' | 'system' | 'announcement';
    image_url?: string;
    link_url?: string;
    link_label?: string;
    priority: number;
    metadata?: any;
    is_template: boolean;
    template_name?: string;
    created_at: string;
    updated_at: string;
}

export interface ScheduledNotification {
    id: string;
    campaign_id?: string;
    draft_id?: string;
    admin_id: string;
    title: string;
    message: string;
    type: 'general' | 'course' | 'assignment' | 'system' | 'announcement';
    image_url?: string;
    link_url?: string;
    link_label?: string;
    priority: number;
    metadata?: any;
    scheduled_for: string;
    is_recurring: boolean;
    recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | 'once';
    recurrence_end_date?: string;
    recipient_type: 'all' | 'users' | 'departments' | 'roles' | 'custom';
    recipient_users?: string[];
    recipient_departments?: string[];
    recipient_roles?: string[];
    recipient_filters?: any;
    status: 'draft' | 'scheduled' | 'sent' | 'cancelled' | 'failed';
    sent_at?: string;
    failed_reason?: string;
    created_at: string;
    updated_at: string;
}

export interface NotificationCampaign {
    id: string;
    admin_id: string;
    name: string;
    description?: string;
    target_condition: string;
    target_condition_details?: any;
    status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
    updated_at: string;
    started_at?: string;
    completed_at?: string;
}

export interface NotificationAuditLog {
    id: string;
    scheduled_notification_id?: string;
    user_id: string;
    notification_id?: string;
    action: 'sent' | 'viewed' | 'clicked' | 'failed' | 'bounced' | 'deleted';
    details?: any;
    error_message?: string;
    created_at: string;
}

export interface AutoSendRule {
    id: string;
    admin_id: string;
    name: string;
    description?: string;
    trigger_type: 'task_pending' | 'course_due' | 'assignment_overdue' | 'low_engagement' | 'inactive_user';
    trigger_params?: any;
    title: string;
    message: string;
    type: 'general' | 'course' | 'assignment' | 'system' | 'announcement' | 'reminder';
    image_url?: string;
    link_url?: string;
    link_label?: string;
    priority: number;
    send_after_days: number;
    send_before_days?: number;
    max_sends_per_user: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ====================================
// ADVANCED NOTIFICATION SERVICE
// ====================================

class AdvancedNotificationService {
    // ====================================
    // DRAFT MANAGEMENT
    // ====================================

    async createDraft(draft: Omit<NotificationDraft, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationDraft> {
        try {
            const { data, error } = await supabase
                .from('notification_drafts')
                .insert(draft)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating notification draft:', error);
            throw error;
        }
    }

    async updateDraft(id: string, updates: Partial<NotificationDraft>): Promise<NotificationDraft> {
        try {
            const { data, error } = await supabase
                .from('notification_drafts')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating notification draft:', error);
            throw error;
        }
    }

    async getDrafts(adminId: string, isTemplate?: boolean): Promise<NotificationDraft[]> {
        try {
            let query = supabase
                .from('notification_drafts')
                .select('*')
                .eq('admin_id', adminId)
                .order('updated_at', { ascending: false });

            if (isTemplate !== undefined) {
                query = query.eq('is_template', isTemplate);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching drafts:', error);
            throw error;
        }
    }

    async getDraft(id: string): Promise<NotificationDraft> {
        try {
            const { data, error } = await supabase
                .from('notification_drafts')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching draft:', error);
            throw error;
        }
    }

    async deleteDraft(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('notification_drafts')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting draft:', error);
            throw error;
        }
    }

    // ====================================
    // SCHEDULED NOTIFICATIONS
    // ====================================

    async scheduleNotification(notification: Omit<ScheduledNotification, 'id' | 'created_at' | 'updated_at'>): Promise<ScheduledNotification> {
        try {
            const { data, error } = await supabase
                .from('scheduled_notifications')
                .insert(notification)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error scheduling notification:', error);
            throw error;
        }
    }

    async updateScheduledNotification(id: string, updates: Partial<ScheduledNotification>): Promise<ScheduledNotification> {
        try {
            const { data, error } = await supabase
                .from('scheduled_notifications')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating scheduled notification:', error);
            throw error;
        }
    }

    async getScheduledNotifications(adminId?: string, status?: string): Promise<ScheduledNotification[]> {
        try {
            let query = supabase
                .from('scheduled_notifications')
                .select('*')
                .order('scheduled_for', { ascending: true });

            if (adminId) {
                query = query.eq('admin_id', adminId);
            }

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching scheduled notifications:', error);
            throw error;
        }
    }

    async getScheduledNotification(id: string): Promise<ScheduledNotification> {
        try {
            const { data, error } = await supabase
                .from('scheduled_notifications')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching scheduled notification:', error);
            throw error;
        }
    }

    async cancelScheduledNotification(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('scheduled_notifications')
                .update({ status: 'cancelled' })
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error cancelling scheduled notification:', error);
            throw error;
        }
    }

    async deleteScheduledNotification(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('scheduled_notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting scheduled notification:', error);
            throw error;
        }
    }

    // ====================================
    // CAMPAIGNS
    // ====================================

    async createCampaign(campaign: Omit<NotificationCampaign, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationCampaign> {
        try {
            const { data, error } = await supabase
                .from('notification_campaigns')
                .insert(campaign)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw error;
        }
    }

    async updateCampaign(id: string, updates: Partial<NotificationCampaign>): Promise<NotificationCampaign> {
        try {
            const { data, error } = await supabase
                .from('notification_campaigns')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating campaign:', error);
            throw error;
        }
    }

    async getCampaigns(adminId?: string, status?: string): Promise<NotificationCampaign[]> {
        try {
            let query = supabase
                .from('notification_campaigns')
                .select('*')
                .order('created_at', { ascending: false });

            if (adminId) {
                query = query.eq('admin_id', adminId);
            }

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            throw error;
        }
    }

    async getCampaign(id: string): Promise<NotificationCampaign> {
        try {
            const { data, error } = await supabase
                .from('notification_campaigns')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching campaign:', error);
            throw error;
        }
    }

    // ====================================
    // AUDIT LOG & HISTORY
    // ====================================

    async logNotificationAction(log: Omit<NotificationAuditLog, 'id' | 'created_at'>): Promise<NotificationAuditLog> {
        try {
            const { data, error } = await supabase
                .from('notification_audit_log')
                .insert(log)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error logging notification action:', error);
            throw error;
        }
    }

    async getNotificationHistory(
        scheduledNotificationId?: string,
        userId?: string,
        action?: string,
        limit: number = 100
    ): Promise<NotificationAuditLog[]> {
        try {
            let query = supabase
                .from('notification_audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (scheduledNotificationId) {
                query = query.eq('scheduled_notification_id', scheduledNotificationId);
            }

            if (userId) {
                query = query.eq('user_id', userId);
            }

            if (action) {
                query = query.eq('action', action);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching notification history:', error);
            throw error;
        }
    }

    async getNotificationStats(scheduledNotificationId: string) {
        try {
            const { data, error } = await supabase
                .from('notification_audit_log')
                .select('action', { count: 'exact' })
                .eq('scheduled_notification_id', scheduledNotificationId);

            if (error) throw error;

            const stats = {
                sent: 0,
                viewed: 0,
                clicked: 0,
                failed: 0,
                bounced: 0
            };

            (data || []).forEach(log => {
                stats[log.action as keyof typeof stats]++;
            });

            return stats;
        } catch (error) {
            console.error('Error fetching notification stats:', error);
            throw error;
        }
    }

    // ====================================
    // AUTO-SEND RULES
    // ====================================

    async createAutoSendRule(rule: Omit<AutoSendRule, 'id' | 'created_at' | 'updated_at'>): Promise<AutoSendRule> {
        try {
            const { data, error } = await supabase
                .from('notification_auto_send_rules')
                .insert(rule)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating auto-send rule:', error);
            throw error;
        }
    }

    async updateAutoSendRule(id: string, updates: Partial<AutoSendRule>): Promise<AutoSendRule> {
        try {
            const { data, error } = await supabase
                .from('notification_auto_send_rules')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating auto-send rule:', error);
            throw error;
        }
    }

    async getAutoSendRules(adminId?: string, isActive?: boolean): Promise<AutoSendRule[]> {
        try {
            let query = supabase
                .from('notification_auto_send_rules')
                .select('*')
                .order('created_at', { ascending: false });

            if (adminId) {
                query = query.eq('admin_id', adminId);
            }

            if (isActive !== undefined) {
                query = query.eq('is_active', isActive);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching auto-send rules:', error);
            throw error;
        }
    }

    async getAutoSendRule(id: string): Promise<AutoSendRule> {
        try {
            const { data, error } = await supabase
                .from('notification_auto_send_rules')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching auto-send rule:', error);
            throw error;
        }
    }

    async deleteAutoSendRule(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('notification_auto_send_rules')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting auto-send rule:', error);
            throw error;
        }
    }

    async getAutoSendRuleExecutionLog(ruleId: string, limit: number = 100) {
        try {
            const { data, error } = await supabase
                .from('auto_send_rule_execution_log')
                .select(`
          *,
          profiles:user_id (fullname, email)
        `)
                .eq('rule_id', ruleId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching auto-send rule execution log:', error);
            throw error;
        }
    }

    async getSentNotifications(limit: number = 100) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
          id,
          title,
          message,
          type,
          priority,
          created_at,
          user_id,
          sender_id,
          image_url,
          link_url,
          link_label,
          profiles:user_id (id, fullname, email),
          sender:sender_id (id, fullname)
        `)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching sent notifications:', error);
            throw error;
        }
    }

    async deleteSentNotification(notificationId: string) {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }

    async updateNotification(notificationId: string, updates: any) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', notificationId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating notification:', error);
            throw error;
        }
    }
}

export const advancedNotificationService = new AdvancedNotificationService();
