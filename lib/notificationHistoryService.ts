import { supabase } from './supabaseClient';

export interface NotificationHistoryFilter {
    user_id?: string;
    action_type?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
}

export interface NotificationStats {
    sent: number;
    viewed: number;
    clicked: number;
    failed: number;
    bounced: number;
}

export const notificationHistoryService = {
    /**
     * Get notification history with filters
     */
    async getHistory(filters: NotificationHistoryFilter) {
        try {
            const response = await supabase.functions.invoke('process-notification-history', {
                body: {
                    action: 'get-history',
                    filters,
                },
            });

            if (response.error) throw response.error;
            return response.data;
        } catch (error) {
            console.error('Error fetching notification history:', error);
            throw error;
        }
    },

    /**
     * Get notification statistics
     */
    async getStats(filters: Omit<NotificationHistoryFilter, 'limit' | 'offset'>) {
        try {
            const response = await supabase.functions.invoke('process-notification-history', {
                body: {
                    action: 'get-stats',
                    filters,
                },
            });

            if (response.error) throw response.error;
            return response.data as NotificationStats;
        } catch (error) {
            console.error('Error fetching notification stats:', error);
            throw error;
        }
    },

    /**
     * Export notification history as CSV
     */
    async exportHistory(filters: Omit<NotificationHistoryFilter, 'limit' | 'offset'>) {
        try {
            const response = await supabase.functions.invoke('process-notification-history', {
                body: {
                    action: 'export-history',
                    filters,
                },
            });

            if (response.error) throw response.error;
            return response.data;
        } catch (error) {
            console.error('Error exporting notification history:', error);
            throw error;
        }
    },

    /**
     * Get history directly from database (fallback)
     */
    async getHistoryDirectly(filters: NotificationHistoryFilter) {
        try {
            let query = supabase
                .from('notification_audit_log')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (filters.user_id) {
                query = query.eq('user_id', filters.user_id);
            }

            if (filters.action_type) {
                query = query.eq('action', filters.action_type);
            }

            if (filters.date_from) {
                query = query.gte('created_at', filters.date_from);
            }

            if (filters.date_to) {
                query = query.lte('created_at', filters.date_to);
            }

            const limit = filters.limit || 1000;
            const offset = filters.offset || 0;

            const { data, error, count } = await query.range(offset, offset + limit - 1);

            if (error) throw error;
            return { data, count, limit, offset };
        } catch (error) {
            console.error('Error fetching notification history directly:', error);
            throw error;
        }
    },

    /**
     * Get statistics directly from database (fallback)
     */
    async getStatsDirectly(filters: Omit<NotificationHistoryFilter, 'limit' | 'offset'>) {
        try {
            let query = supabase
                .from('notification_audit_log')
                .select('action');

            if (filters.user_id) {
                query = query.eq('user_id', filters.user_id);
            }

            if (filters.date_from) {
                query = query.gte('created_at', filters.date_from);
            }

            if (filters.date_to) {
                query = query.lte('created_at', filters.date_to);
            }

            const { data, error } = await query;

            if (error) throw error;

            const stats: NotificationStats = {
                sent: 0,
                viewed: 0,
                clicked: 0,
                failed: 0,
                bounced: 0,
            };

            data?.forEach((entry: any) => {
                if (entry.action in stats) {
                    stats[entry.action as keyof NotificationStats]++;
                }
            });

            return stats;
        } catch (error) {
            console.error('Error fetching notification stats directly:', error);
            throw error;
        }
    },
};
