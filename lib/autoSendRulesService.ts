import { supabase } from './supabaseClient';

export interface AutoSendRule {
    id?: string;
    name: string;
    description?: string;
    trigger_type: 'task_pending' | 'course_not_started' | 'inactivity' | 'course_deadline' | 'achievement_unlocked';
    title: string;
    message: string;
    type: string;
    priority: number;
    send_after_days: number;
    send_before_days: number;
    max_sends_per_user: number;
    is_active: boolean;
    filter_criteria?: Record<string, any>;
    last_executed_at?: string;
    created_at?: string;
}

export interface QuickPreset {
    id: string;
    name: string;
    description: string;
    rule: Omit<AutoSendRule, 'id' | 'name' | 'description' | 'created_at' | 'last_executed_at'>;
}

export const autoSendRulesService = {
    /**
     * List all auto-send rules
     */
    async listRules(filters?: { is_active?: boolean }) {
        try {
            const response = await supabase.functions.invoke('manage-autosend-rules', {
                body: {
                    action: 'list-rules',
                    data: filters,
                },
            });

            if (response.error) throw response.error;
            return response.data.data || [];
        } catch (error) {
            console.error('Error listing auto-send rules:', error);
            return await this.listRulesDirectly(filters);
        }
    },

    /**
     * Create a new auto-send rule
     */
    async createRule(rule: Omit<AutoSendRule, 'id' | 'created_at'>) {
        try {
            const response = await supabase.functions.invoke('manage-autosend-rules', {
                body: {
                    action: 'create-rule',
                    data: rule,
                },
            });

            if (response.error) throw response.error;
            return response.data.data;
        } catch (error) {
            console.error('Error creating auto-send rule:', error);
            return await this.createRuleDirectly(rule);
        }
    },

    /**
     * Update an auto-send rule
     */
    async updateRule(id: string, updates: Partial<AutoSendRule>) {
        try {
            const response = await supabase.functions.invoke('manage-autosend-rules', {
                body: {
                    action: 'update-rule',
                    data: { id, ...updates },
                },
            });

            if (response.error) throw response.error;
            return response.data.data;
        } catch (error) {
            console.error('Error updating auto-send rule:', error);
            return await this.updateRuleDirectly(id, updates);
        }
    },

    /**
     * Delete an auto-send rule
     */
    async deleteRule(id: string) {
        try {
            const response = await supabase.functions.invoke('manage-autosend-rules', {
                body: {
                    action: 'delete-rule',
                    data: { id },
                },
            });

            if (response.error) throw response.error;
            return true;
        } catch (error) {
            console.error('Error deleting auto-send rule:', error);
            return await this.deleteRuleDirectly(id);
        }
    },

    /**
     * Trigger auto-send rules manually
     */
    async triggerRules(filters?: Record<string, any>) {
        try {
            const response = await supabase.functions.invoke('manage-autosend-rules', {
                body: {
                    action: 'trigger-rules',
                    data: filters,
                },
            });

            if (response.error) throw response.error;
            return response.data;
        } catch (error) {
            console.error('Error triggering auto-send rules:', error);
            throw error;
        }
    },

    /**
     * Get quick-enable presets
     */
    async getPresets(): Promise<QuickPreset[]> {
        try {
            const response = await supabase.functions.invoke('manage-autosend-rules', {
                body: {
                    action: 'get-presets',
                },
            });

            if (response.error) throw response.error;
            return response.data.presets || [];
        } catch (error) {
            console.error('Error fetching presets:', error);
            return this.getDefaultPresets();
        }
    },

    /**
     * Apply a quick-enable preset
     */
    async applyPreset(presetId: string) {
        try {
            const response = await supabase.functions.invoke('manage-autosend-rules', {
                body: {
                    action: 'apply-preset',
                    data: { preset_id: presetId },
                },
            });

            if (response.error) throw response.error;
            return response.data.data;
        } catch (error) {
            console.error('Error applying preset:', error);
            throw error;
        }
    },

    /**
     * Get default presets (fallback)
     */
    getDefaultPresets(): QuickPreset[] {
        return [
            {
                id: 'pending-tasks',
                name: 'Pending Tasks Reminder',
                description: 'Remind users about pending tasks',
                rule: {
                    trigger_type: 'task_pending',
                    title: '📋 Pending Task Reminder',
                    message: 'You have pending tasks that need your attention.',
                    type: 'reminder',
                    priority: 2,
                    send_after_days: 1,
                    send_before_days: 0,
                    max_sends_per_user: 1,
                    is_active: true,
                },
            },
            {
                id: 'course-not-started',
                name: 'Course Not Started',
                description: 'Encourage users to start enrolled courses',
                rule: {
                    trigger_type: 'course_not_started',
                    title: '🚀 Get Started with Your Course',
                    message: 'You have enrolled in a course but havent started yet. Begin learning today!',
                    type: 'reminder',
                    priority: 1,
                    send_after_days: 3,
                    send_before_days: 0,
                    max_sends_per_user: 1,
                    is_active: true,
                },
            },
            {
                id: 'inactive-users',
                name: 'Inactive Users Engagement',
                description: 'Re-engage inactive users',
                rule: {
                    trigger_type: 'inactivity',
                    title: '👋 We Miss You!',
                    message: 'Its been a while since you visited. Check out new courses and continue your learning journey.',
                    type: 'engagement',
                    priority: 1,
                    send_after_days: 7,
                    send_before_days: 0,
                    max_sends_per_user: 3,
                    is_active: true,
                },
            },
            {
                id: 'course-deadline',
                name: 'Course Deadline Approaching',
                description: 'Remind users about upcoming course deadlines',
                rule: {
                    trigger_type: 'course_deadline',
                    title: '⏰ Course Deadline Approaching',
                    message: 'Your course will be completed soon. Make sure youve finished all lessons.',
                    type: 'reminder',
                    priority: 3,
                    send_after_days: 0,
                    send_before_days: 3,
                    max_sends_per_user: 1,
                    is_active: true,
                },
            },
            {
                id: 'achievement-unlocked',
                name: 'Achievement Celebration',
                description: 'Celebrate user achievements and milestones',
                rule: {
                    trigger_type: 'achievement_unlocked',
                    title: '🏆 Achievement Unlocked!',
                    message: 'Congratulations! Youve achieved a new milestone. Keep up the great work!',
                    type: 'celebration',
                    priority: 1,
                    send_after_days: 0,
                    send_before_days: 0,
                    max_sends_per_user: 5,
                    is_active: true,
                },
            },
        ];
    },

    // Fallback direct database methods
    async listRulesDirectly(filters?: { is_active?: boolean }) {
        try {
            let query = supabase.from('auto_send_rules').select('*').order('created_at', { ascending: false });

            if (filters?.is_active !== undefined) {
                query = query.eq('is_active', filters.is_active);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error in listRulesDirectly:', error);
            return [];
        }
    },

    async createRuleDirectly(rule: Omit<AutoSendRule, 'id' | 'created_at'>) {
        try {
            const { data, error } = await supabase
                .from('auto_send_rules')
                .insert([
                    {
                        ...rule,
                        created_at: new Date().toISOString(),
                    },
                ])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in createRuleDirectly:', error);
            throw error;
        }
    },

    async updateRuleDirectly(id: string, updates: Partial<AutoSendRule>) {
        try {
            const { data, error } = await supabase
                .from('auto_send_rules')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in updateRuleDirectly:', error);
            throw error;
        }
    },

    async deleteRuleDirectly(id: string) {
        try {
            const { error } = await supabase.from('auto_send_rules').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error in deleteRuleDirectly:', error);
            return false;
        }
    },
};
