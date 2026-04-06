import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import useAuthGuard from '../hooks/useAuthGuard';
import { supabase } from '../lib/supabaseClient';
import { advancedNotificationService, ScheduledNotification, NotificationDraft, AutoSendRule } from '../lib/advancedNotificationService';
import { courseAssignmentService } from '../lib/courseAssignmentService';

type TabType = 'send' | 'drafts' | 'scheduled' | 'history' | 'auto-rules';

interface UserProfile {
    id: string;
    fullname: string;
    email: string;
    department?: string;
    company?: string;
    designation?: string;
    employment_type?: string;
    industry?: string;
    leadership_role?: string;
    location?: string;
    persona?: string;
    team?: string;
    role: string;
    avatarurl?: string;
}

interface FilterState {
    department: string[];
    company: string[];
    designation: string[];
    employmentType: string[];
    industry: string[];
    leadershipRole: string[];
    location: string[];
    persona: string[];
    team: string[];
}

const AdvancedNotificationsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('send');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
    const [filterOptions, setFilterOptions] = useState<any>({});
    const [filters, setFilters] = useState<FilterState>({
        department: [],
        company: [],
        designation: [],
        employmentType: [],
        industry: [],
        leadershipRole: [],
        location: [],
        persona: [],
        team: [],
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [activeDepartment, setActiveDepartment] = useState('All');

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Send notification state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [notificationForm, setNotificationForm] = useState({
        title: '',
        message: '',
        type: 'general' as 'general' | 'course' | 'assignment' | 'announcement' | 'system',
        image_url: '',
        link_url: '',
        link_label: '',
        priority: 1,
        send_to_all: true,
        recipient_type: 'all' as 'all' | 'users' | 'filters',
    });
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

    // Drafts state
    const [drafts, setDrafts] = useState<NotificationDraft[]>([]);
    const [showDraftForm, setShowDraftForm] = useState(false);
    const [editingDraft, setEditingDraft] = useState<string | null>(null);
    const [draftForm, setDraftForm] = useState({
        title: '',
        message: '',
        type: 'general' as 'general' | 'course' | 'assignment' | 'announcement' | 'system',
        image_url: '',
        link_url: '',
        link_label: '',
        priority: 1,
        is_template: false,
        template_name: '',
    });

    // Scheduled notifications state
    const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        title: '',
        message: '',
        type: 'general' as 'general' | 'course' | 'assignment' | 'announcement' | 'system',
        image_url: '',
        link_url: '',
        link_label: '',
        priority: 1,
        scheduled_for: '',
        is_recurring: false,
        recurrence_pattern: 'once' as 'daily' | 'weekly' | 'monthly' | 'once',
        recipient_type: 'all' as 'all' | 'users' | 'departments' | 'roles' | 'custom',
    });
    const [selectedScheduleUsers, setSelectedScheduleUsers] = useState<string[]>([]);
    const [selectedScheduleDepartments, setSelectedScheduleDepartments] = useState<string[]>([]);

    // Auto-send rules state
    const [autoRules, setAutoRules] = useState<AutoSendRule[]>([]);
    const [showAutoRuleForm, setShowAutoRuleForm] = useState(false);
    const [editingAutoRule, setEditingAutoRule] = useState<string | null>(null);
    const [autoRuleForm, setAutoRuleForm] = useState({
        name: '',
        description: '',
        trigger_type: 'task_pending' as const,
        trigger_params: {} as any,
        title: '',
        message: '',
        type: 'reminder' as const,
        priority: 2,
        send_after_days: 1,
        send_before_days: 0,
        max_sends_per_user: 1,
        is_active: true,
    });

    // History state
    const [historyEntries, setHistoryEntries] = useState<any[]>([]);
    const [historyFilter, setHistoryFilter] = useState('');
    const [sentNotifications, setSentNotifications] = useState<any[]>([]);
    const [editingNotification, setEditingNotification] = useState<any>(null);
    const [isEditingNotification, setIsEditingNotification] = useState(false);
    const [editNotificationForm, setEditNotificationForm] = useState({ title: '', message: '' });
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; notificationId: string | null }>({ isOpen: false, notificationId: null });

    useAuthGuard(['admin']);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [users, filters, searchQuery, activeDepartment]);

    const departmentCounts = useMemo(() => {
        const counts: { [key: string]: number } = {};
        for (const user of users) {
            const department = user.department || 'Other';
            counts[department] = (counts[department] || 0) + 1;
        }
        return counts;
    }, [users]);

    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUser(user);

            // Fetch users and filter options
            const [usersData, filterValues] = await Promise.all([
                courseAssignmentService.getAllUsers(),
                courseAssignmentService.getUniqueFilterValues(),
            ]);

            setUsers(usersData || []);
            setFilteredUsers(usersData || []);
            setFilterOptions(filterValues);

            // Fetch drafts
            if (user) {
                const draftsData = await advancedNotificationService.getDrafts(user.id);
                setDrafts(draftsData);

                const scheduledData = await advancedNotificationService.getScheduledNotifications(user.id);
                setScheduledNotifications(scheduledData);

                const rulesData = await advancedNotificationService.getAutoSendRules(user.id);
                setAutoRules(rulesData);

                // Fetch and enrich history
                setHistoryLoading(true);
                try {
                    const historyData = await advancedNotificationService.getNotificationHistory(undefined, undefined, undefined, 50);

                    if (historyData && historyData.length > 0) {
                        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
                        const enrichedHistory = historyData.map(h => ({
                            ...h,
                            user: usersMap.get(h.user_id),
                        }));
                        setHistoryEntries(enrichedHistory);
                    } else {
                        setHistoryEntries([]);
                    }
                } catch (historyErr) {
                    console.error('Error fetching history:', historyErr);
                } finally {
                    setHistoryLoading(false);
                }

                // Fetch sent notifications
                try {
                    const sentData = await advancedNotificationService.getSentNotifications(100);
                    setSentNotifications(sentData || []);
                } catch (sentErr) {
                    console.error('Error fetching sent notifications:', sentErr);
                }
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = users;

        if (activeDepartment !== 'All') {
            filtered = filtered.filter(u => u.department === activeDepartment);
        }

        if (showAdvancedSearch) {
            if (filters.department.length > 0) {
                filtered = filtered.filter(u => filters.department.includes(u.department || ''));
            }
            if (filters.company.length > 0) {
                filtered = filtered.filter(u => filters.company.includes(u.company || ''));
            }
            if (filters.designation.length > 0) {
                filtered = filtered.filter(u => filters.designation.includes(u.designation || ''));
            }
            if (filters.employmentType.length > 0) {
                filtered = filtered.filter(u => filters.employmentType.includes(u.employment_type || ''));
            }
            if (filters.industry.length > 0) {
                filtered = filtered.filter(u => filters.industry.includes(u.industry || ''));
            }
            if (filters.leadershipRole.length > 0) {
                filtered = filtered.filter(u => filters.leadershipRole.includes(u.leadership_role || ''));
            }
            if (filters.location.length > 0) {
                filtered = filtered.filter(u => filters.location.includes(u.location || ''));
            }
            if (filters.persona.length > 0) {
                filtered = filtered.filter(u => filters.persona.includes(u.persona || ''));
            }
            if (filters.team.length > 0) {
                filtered = filtered.filter(u => filters.team.includes(u.team || ''));
            }
        }

        if (searchQuery) {
            filtered = filtered.filter(u =>
                u.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredUsers(filtered);
    };

    const toggleFilter = (filterType: keyof FilterState, value: string) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            if (newFilters[filterType].includes(value)) {
                newFilters[filterType] = newFilters[filterType].filter(v => v !== value);
            } else {
                newFilters[filterType] = [...newFilters[filterType], value];
            }
            return newFilters;
        });
    };

    const toggleAllUsers = () => {
        if (selectedUsers.length === filteredUsers.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(filteredUsers.map(u => u.id));
        }
    };

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    // ====================================
    // SEND NOTIFICATIONS
    // ====================================

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            let recipients: string[] = [];

            if (notificationForm.send_to_all) {
                recipients = users.map(u => u.id);
            } else {
                recipients = selectedUsers;
            }

            if (recipients.length === 0) {
                alert('Please select at least one recipient');
                return;
            }

            const notificationsToCreate = recipients.map(userId => ({
                user_id: userId,
                title: notificationForm.title,
                message: notificationForm.message,
                type: notificationForm.type,
                image_url: notificationForm.image_url || null,
                link_url: notificationForm.link_url || null,
                link_label: notificationForm.link_label || null,
                priority: notificationForm.priority,
                sender_id: currentUser?.id
            }));

            const { data: createdNotifications, error } = await supabase
                .from('notifications')
                .insert(notificationsToCreate)
                .select();

            if (error) throw error;

            // Log actions in history
            if (createdNotifications && createdNotifications.length > 0) {
                const logs = createdNotifications.map(notif => ({
                    user_id: notif.user_id,
                    notification_id: notif.id,
                    action: 'sent' as const,
                    details: {
                        manual_send: true,
                        admin_id: currentUser?.id,
                        type: notificationForm.type
                    }
                }));

                await supabase.from('notification_audit_log').insert(logs);
            }

            setNotificationForm({
                title: '',
                message: '',
                type: 'general',
                image_url: '',
                link_url: '',
                link_label: '',
                priority: 1,
                send_to_all: true,
                recipient_type: 'all'
            });
            setSelectedUsers([]);
            setShowCreateForm(false);

            alert(`Notification sent to ${recipients.length} users!`);
        } catch (error) {
            console.error('Error sending notification:', error);
            alert('Failed to send notification');
        }
    };

    // ====================================
    // DRAFT MANAGEMENT
    // ====================================

    const handleSaveDraft = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingDraft) {
                await advancedNotificationService.updateDraft(editingDraft, draftForm);
            } else {
                await advancedNotificationService.createDraft({
                    admin_id: currentUser.id,
                    ...draftForm
                });
            }

            setDraftForm({
                title: '',
                message: '',
                type: 'general',
                image_url: '',
                link_url: '',
                link_label: '',
                priority: 1,
                is_template: false,
                template_name: '',
            });
            setEditingDraft(null);
            setShowDraftForm(false);

            const updatedDrafts = await advancedNotificationService.getDrafts(currentUser.id);
            setDrafts(updatedDrafts);

            alert(editingDraft ? 'Draft updated!' : 'Draft saved!');
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Failed to save draft');
        }
    };

    const handleLoadDraft = (draft: NotificationDraft) => {
        setNotificationForm(prev => ({
            ...prev,
            title: draft.title,
            message: draft.message,
            type: draft.type,
            image_url: draft.image_url || '',
            link_url: draft.link_url || '',
            link_label: draft.link_label || '',
            priority: draft.priority,
        }));
        setShowCreateForm(true);
    };

    const handleDeleteDraft = async (id: string) => {
        if (!confirm('Are you sure you want to delete this draft?')) return;

        try {
            await advancedNotificationService.deleteDraft(id);
            const updatedDrafts = await advancedNotificationService.getDrafts(currentUser.id);
            setDrafts(updatedDrafts);
            alert('Draft deleted!');
        } catch (error) {
            console.error('Error deleting draft:', error);
            alert('Failed to delete draft');
        }
    };

    // ====================================
    // SCHEDULED NOTIFICATIONS
    // ====================================

    const handleScheduleNotification = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            let recipients: string[] = [];

            if (scheduleForm.recipient_type === 'all') {
                recipients = users.map(u => u.id);
            } else {
                recipients = selectedUsers;
            }

            if (recipients.length === 0) {
                alert('Please select at least one recipient');
                return;
            }

            await advancedNotificationService.scheduleNotification({
                admin_id: currentUser.id,
                title: scheduleForm.title,
                message: scheduleForm.message,
                type: scheduleForm.type,
                image_url: scheduleForm.image_url || undefined,
                link_url: scheduleForm.link_url || undefined,
                link_label: scheduleForm.link_label || undefined,
                priority: scheduleForm.priority,
                scheduled_for: new Date(scheduleForm.scheduled_for).toISOString(),
                is_recurring: scheduleForm.is_recurring,
                recurrence_pattern: scheduleForm.recurrence_pattern,
                recipient_type: scheduleForm.recipient_type as any,
                recipient_users: recipients,
                status: 'scheduled',
            });

            setScheduleForm({
                title: '',
                message: '',
                type: 'general',
                image_url: '',
                link_url: '',
                link_label: '',
                priority: 1,
                scheduled_for: '',
                is_recurring: false,
                recurrence_pattern: 'once',
                recipient_type: 'all',
            });
            setSelectedScheduleUsers([]);
            setSelectedScheduleDepartments([]);
            setShowScheduleForm(false);

            const updatedScheduled = await advancedNotificationService.getScheduledNotifications(currentUser.id);
            setScheduledNotifications(updatedScheduled);

            alert('Notification scheduled!');
        } catch (error) {
            console.error('Error scheduling notification:', error);
            alert('Failed to schedule notification');
        }
    };

    const handleCancelScheduled = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this scheduled notification?')) return;

        try {
            await advancedNotificationService.cancelScheduledNotification(id);
            const updatedScheduled = await advancedNotificationService.getScheduledNotifications(currentUser.id);
            setScheduledNotifications(updatedScheduled);
            alert('Scheduled notification cancelled!');
        } catch (error) {
            console.error('Error cancelling scheduled notification:', error);
            alert('Failed to cancel scheduled notification');
        }
    };

    // ====================================
    // AUTO-SEND RULES
    // ====================================

    const handleEnablePreset = async (presetId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Not authenticated');
                return;
            }

            const PRESET_RULES: Record<string, any> = {
                'assessment-3day': {
                    name: 'Assessment Due (3 Days)',
                    description: 'Remind before assessment due date',
                    trigger_type: 'course_due',
                    trigger_params: { days_before_due: 3 },
                    title: '⏰ {assessment_name} Due in 3 Days',
                    message: 'Your {assessment_type} "{assessment_name}" is due on {due_date}. You have 3 days to complete it. Here\'s a tip: review your notes and take it in a distraction-free environment. You\'re well-prepared! 💪',
                    type: 'assignment',
                    priority: 3,
                    send_after_days: 3,
                    send_before_days: 0,
                    max_sends_per_user: 2,
                    is_active: true,
                },
                'course-1week': {
                    name: 'Course Due (1 Week)',
                    description: 'Early reminder before course completion',
                    trigger_type: 'course_due',
                    trigger_params: { days_before_due: 7 },
                    title: '📚 {course_name} Due in 1 Week!',
                    message: 'One week left for {course_name}! You\'re at {progress}% completion. Pick up the pace and finish strong. You only need to complete {remaining_lessons} more lessons. Let\'s go! 🚀',
                    type: 'course',
                    priority: 2,
                    send_after_days: 7,
                    send_before_days: 0,
                    max_sends_per_user: 1,
                    is_active: true,
                },
                'course-assigned': {
                    name: 'New Course Assigned',
                    description: 'Notify when course is assigned',
                    trigger_type: 'task_pending',
                    trigger_params: { days_after_assignment: 0 },
                    title: '🆕 New Course Assigned: {course_name}',
                    message: 'You\'ve been assigned a new course! 📖 {course_name} is now in your learning queue. This course will take approximately {duration} hours and is due by {due_date}. Start today to stay on schedule!',
                    type: 'course',
                    priority: 2,
                    send_after_days: 0,
                    send_before_days: 0,
                    max_sends_per_user: 1,
                    is_active: true,
                },
                'careerpath-weekly': {
                    name: 'Career Path Weekly Check',
                    description: 'Weekly progress reminder (Monday 9 AM)',
                    trigger_type: 'low_engagement',
                    trigger_params: { frequency: 'weekly', recommended_day: 'Monday' },
                    title: '🎯 Career Path Weekly Check-in',
                    message: 'How\'s your career path journey going? 📈 This week, try to complete {suggested_courses} more courses. You\'re {progress}% through your path to becoming a {target_role}. Stay consistent!',
                    type: 'course',
                    priority: 1,
                    send_after_days: 7,
                    send_before_days: 0,
                    max_sends_per_user: 1,
                    is_active: true,
                },
                'reengagement-14day': {
                    name: 'Re-engagement (14 Days Inactive)',
                    description: 'Bring back inactive learners',
                    trigger_type: 'inactive_user',
                    trigger_params: { days_inactive: 14 },
                    title: '😴 We Miss You! Let\'s Get Back on Track',
                    message: 'It\'s been 2 weeks since your last login! 👋 We miss having you here. You\'re close to your learning milestones - don\'t fall behind now. Come back and complete your next course today!',
                    type: 'announcement',
                    priority: 2,
                    send_after_days: 14,
                    send_before_days: 0,
                    max_sends_per_user: 1,
                    is_active: true,
                },
                'motivation-midcourse': {
                    name: 'Mid-Course Motivation',
                    description: 'Encourage at 50% completion',
                    trigger_type: 'low_engagement',
                    trigger_params: { completion_threshold: 50 },
                    title: '✨ You\'re Halfway There!',
                    message: 'Fantastic progress! 🎉 You\'ve completed 50% of {course_name}. The hardest part is behind you - keep the momentum going and finish this course strong. Just a bit more to go! 💪',
                    type: 'announcement',
                    priority: 2,
                    send_after_days: 3,
                    send_before_days: 0,
                    max_sends_per_user: 1,
                    is_active: true,
                },
            };

            const preset = PRESET_RULES[presetId];
            if (!preset) {
                alert(`Unknown preset: ${presetId}`);
                return;
            }

            // Check if rule already exists
            const { data: existingRules, error: checkError } = await supabase
                .from('notification_auto_send_rules')
                .select('id')
                .eq('admin_id', user.id)
                .eq('name', preset.name);

            if (checkError) throw checkError;

            if (existingRules && existingRules.length > 0) {
                // Rule already exists, just enable it
                const { error: updateError } = await supabase
                    .from('notification_auto_send_rules')
                    .update({ is_active: true })
                    .eq('id', existingRules[0].id);

                if (updateError) throw updateError;
            } else {
                // Create new rule from preset
                const newRule = {
                    admin_id: user.id,
                    ...preset,
                };

                const { error: createError } = await supabase
                    .from('notification_auto_send_rules')
                    .insert([newRule]);

                if (createError) throw createError;
            }

            // Refresh rules list
            const updatedRules = await advancedNotificationService.getAutoSendRules(user.id);
            setAutoRules(updatedRules);
            alert('Preset rule enabled successfully! ✓');
        } catch (error: any) {
            console.error('Error enabling preset:', error);
            alert(`Failed to enable preset: ${error.message}`);
        }
    };

    const handleSaveAutoRule = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingAutoRule) {
                await advancedNotificationService.updateAutoSendRule(editingAutoRule, autoRuleForm);
            } else {
                await advancedNotificationService.createAutoSendRule({
                    admin_id: currentUser.id,
                    ...autoRuleForm
                });
            }

            setAutoRuleForm({
                name: '',
                description: '',
                trigger_type: 'task_pending',
                trigger_params: {},
                title: '',
                message: '',
                type: 'reminder',
                priority: 2,
                send_after_days: 1,
                send_before_days: 0,
                max_sends_per_user: 1,
                is_active: true,
            });
            setEditingAutoRule(null);
            setShowAutoRuleForm(false);

            const updatedRules = await advancedNotificationService.getAutoSendRules(currentUser.id);
            setAutoRules(updatedRules);

            alert(editingAutoRule ? 'Rule updated!' : 'Rule created!');
        } catch (error) {
            console.error('Error saving auto-send rule:', error);
            alert('Failed to save rule');
        }
    };

    const handleToggleAutoRule = async (id: string, isActive: boolean) => {
        try {
            await advancedNotificationService.updateAutoSendRule(id, { is_active: !isActive });
            const updatedRules = await advancedNotificationService.getAutoSendRules(currentUser.id);
            setAutoRules(updatedRules);
        } catch (error) {
            console.error('Error toggling auto-send rule:', error);
            alert('Failed to update rule');
        }
    };

    const handleDeleteAutoRule = async (id: string) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;

        try {
            await advancedNotificationService.deleteAutoSendRule(id);
            const updatedRules = await advancedNotificationService.getAutoSendRules(currentUser.id);
            setAutoRules(updatedRules);
            alert('Rule deleted!');
        } catch (error) {
            console.error('Error deleting auto-send rule:', error);
            alert('Failed to delete rule');
        }
    };

    const handleEditNotification = (notification: any) => {
        setEditingNotification(notification);
        setEditNotificationForm({ title: notification.title, message: notification.message });
        setIsEditingNotification(true);
    };

    const handleSaveNotification = async () => {
        if (!editingNotification) return;

        try {
            await advancedNotificationService.updateNotification(editingNotification.id, editNotificationForm);
            const updated = sentNotifications.map(n =>
                n.id === editingNotification.id ? { ...n, ...editNotificationForm } : n
            );
            setSentNotifications(updated);
            setIsEditingNotification(false);
            setEditingNotification(null);
            alert('Notification updated!');
        } catch (error) {
            console.error('Error updating notification:', error);
            alert('Failed to update notification');
        }
    };

    const handleDeleteNotification = (notificationId: string) => {
        setDeleteConfirmation({ isOpen: true, notificationId });
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmation.notificationId) return;

        try {
            await advancedNotificationService.deleteSentNotification(deleteConfirmation.notificationId);
            setSentNotifications(sentNotifications.filter(n => n.id !== deleteConfirmation.notificationId));
            setDeleteConfirmation({ isOpen: false, notificationId: null });
            alert('Notification deleted!');
        } catch (error) {
            console.error('Error deleting notification:', error);
            alert('Failed to delete notification');
        }
    };

    const handleResendNotification = async (notification: any) => {
        if (!confirm(`Resend notification "${notification.title}" to ${notification.profiles?.fullname}?`)) return;

        try {
            await supabase
                .from('notifications')
                .insert([{
                    user_id: notification.user_id,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    priority: notification.priority,
                    image_url: notification.image_url,
                    link_url: notification.link_url,
                    link_label: notification.link_label,
                    sender_id: currentUser.id,
                }]);

            // Refresh sent notifications
            const updated = await advancedNotificationService.getSentNotifications(100);
            setSentNotifications(updated);
            alert('Notification resent!');
        } catch (error) {
            console.error('Error resending notification:', error);
            alert('Failed to resend notification');
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Advanced Notifications">
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">Loading...</div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Advanced Notifications">
            <div className="space-y-6">
                {/* Tabs */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex border-b border-slate-200 overflow-x-auto">
                        {(['send', 'drafts', 'scheduled', 'history', 'auto-rules'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 px-4 py-3 font-medium text-sm transition-colors ${activeTab === tab
                                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                    }`}
                            >
                                {tab === 'send' && 'Send Now'}
                                {tab === 'drafts' && 'Drafts'}
                                {tab === 'scheduled' && 'Scheduled'}
                                {tab === 'history' && 'History'}
                                {tab === 'auto-rules' && 'Auto-Send Rules'}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {/* SEND TAB */}
                        {activeTab === 'send' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-slate-800">Send Notifications</h3>
                                    <button
                                        onClick={() => setShowCreateForm(!showCreateForm)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {showCreateForm ? 'Cancel' : 'New Notification'}
                                    </button>
                                </div>

                                {showCreateForm && (
                                    <form onSubmit={handleSendNotification} className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Title"
                                                value={notificationForm.title}
                                                onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                            <select
                                                value={notificationForm.type}
                                                onChange={(e) => setNotificationForm(prev => ({ ...prev, type: e.target.value as any }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="general">General</option>
                                                <option value="course">Course</option>
                                                <option value="assignment">Assignment</option>
                                                <option value="announcement">Announcement</option>
                                                <option value="system">System</option>
                                            </select>
                                        </div>

                                        <textarea
                                            placeholder="Message"
                                            value={notificationForm.message}
                                            onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={4}
                                            required
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="url"
                                                placeholder="Image URL (optional)"
                                                value={notificationForm.image_url}
                                                onChange={(e) => setNotificationForm(prev => ({ ...prev, image_url: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="url"
                                                placeholder="Link URL (optional)"
                                                value={notificationForm.link_url}
                                                onChange={(e) => setNotificationForm(prev => ({ ...prev, link_url: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Link Label (optional)"
                                                value={notificationForm.link_label}
                                                onChange={(e) => setNotificationForm(prev => ({ ...prev, link_label: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <select
                                                value={notificationForm.priority}
                                                onChange={(e) => setNotificationForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="1">Priority: Low</option>
                                                <option value="2">Priority: Medium</option>
                                                <option value="3">Priority: High</option>
                                                <option value="4">Priority: Critical</option>
                                                <option value="5">Priority: Urgent</option>
                                            </select>
                                        </div>

                                        {/* Recipients Selection */}
                                        <div className="space-y-4 border-t border-slate-300 pt-4">
                                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="sendTo"
                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                                                        checked={notificationForm.send_to_all}
                                                        onChange={() => setNotificationForm(prev => ({ ...prev, send_to_all: true }))}
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">Send to All Users ({users.length})</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="sendTo"
                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                                                        checked={!notificationForm.send_to_all}
                                                        onChange={() => setNotificationForm(prev => ({ ...prev, send_to_all: false }))}
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">Select Recipients</span>
                                                </label>
                                            </div>

                                            {!notificationForm.send_to_all && (
                                                <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                                    {/* Role/Department Filters */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveDepartment('All')}
                                                            className={`px-4 py-2 text-xs font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === 'All' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                                                        >
                                                            All Users ({users.length})
                                                        </button>
                                                        {Object.entries(departmentCounts).map(([department, count]) => (
                                                            <button
                                                                type="button"
                                                                key={department}
                                                                onClick={() => setActiveDepartment(department)}
                                                                className={`px-4 py-2 text-xs font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === department ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                                                            >
                                                                {department} ({count})
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="flex flex-wrap justify-between items-center gap-4">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <div className="relative flex-1 max-w-md">
                                                                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search users..."
                                                                    value={searchQuery}
                                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                                                                className={`text-sm font-medium flex items-center gap-1 ${showAdvancedSearch ? 'text-blue-600' : 'text-slate-500'} hover:underline`}
                                                            >
                                                                <span className="material-symbols-rounded text-sm">filter_list</span>
                                                                Advanced Filters
                                                            </button>
                                                        </div>
                                                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600">
                                                            <input
                                                                type="checkbox"
                                                                onChange={toggleAllUsers}
                                                                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                            />
                                                            Select All Visible ({filteredUsers.length})
                                                        </label>
                                                    </div>

                                                    {showAdvancedSearch && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                                            {filterOptions.departments?.length > 0 && (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                                                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                                        {filterOptions.departments.map((dept: string) => (
                                                                            <label key={dept} className="flex items-center gap-2 cursor-pointer group">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={filters.department.includes(dept)}
                                                                                    onChange={() => toggleFilter('department', dept)}
                                                                                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                                />
                                                                                <span className="text-sm text-slate-600 group-hover:text-slate-900">{dept}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {filterOptions.designations?.length > 0 && (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Designation</label>
                                                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                                        {filterOptions.designations.map((item: string) => (
                                                                            <label key={item} className="flex items-center gap-2 cursor-pointer group">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={filters.designation.includes(item)}
                                                                                    onChange={() => toggleFilter('designation', item)}
                                                                                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                                />
                                                                                <span className="text-sm text-slate-600 group-hover:text-slate-900">{item}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {filterOptions.locations?.length > 0 && (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                                                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                                        {filterOptions.locations.map((item: string) => (
                                                                            <label key={item} className="flex items-center gap-2 cursor-pointer group">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={filters.location.includes(item)}
                                                                                    onChange={() => toggleFilter('location', item)}
                                                                                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                                />
                                                                                <span className="text-sm text-slate-600 group-hover:text-slate-900">{item}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Selected Count */}
                                                    <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full inline-block">
                                                        {selectedUsers.length} Users Selected
                                                    </div>

                                                    {/* Scrollable User List */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {filteredUsers.length > 0 ? (
                                                            filteredUsers.map((user) => (
                                                                <div
                                                                    key={user.id}
                                                                    onClick={() => toggleUser(user.id)}
                                                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${selectedUsers.includes(user.id)
                                                                        ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                                                                        : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                                                                        }`}
                                                                >
                                                                    <div className="relative flex-shrink-0">
                                                                        <div className={`w-4 h-4 rounded-full absolute -top-1 -left-1 z-10 flex items-center justify-center border border-white ${selectedUsers.includes(user.id) ? 'bg-blue-600' : 'bg-slate-200'
                                                                            }`}>
                                                                            {selectedUsers.includes(user.id) && <span className="material-symbols-rounded text-white text-[10px]">check</span>}
                                                                        </div>
                                                                        {user.avatarurl ? (
                                                                            <img src={user.avatarurl} alt={user.fullname} className="w-10 h-10 rounded-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                                                                                {user.fullname.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 overflow-hidden">
                                                                        <p className="text-sm font-bold text-slate-900 truncate">{user.fullname}</p>
                                                                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                                                                        <p className="text-[10px] text-blue-600 font-medium mt-0.5">{user.department || 'No Dept'}</p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="col-span-full py-12 text-center text-slate-400">
                                                                <span className="material-symbols-rounded text-4xl block mb-2">person_search</span>
                                                                <p>No users found matching your criteria</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Send Notification
                                        </button>
                                    </form>
                                )}

                                {drafts.length > 0 && (
                                    <div className="border-t border-slate-200 pt-6">
                                        <h4 className="font-semibold text-slate-800 mb-4">Load from Drafts</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {drafts.filter(d => !d.is_template).map(draft => (
                                                <div key={draft.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                                    <h5 className="font-semibold text-slate-800 mb-2">{draft.title}</h5>
                                                    <p className="text-sm text-slate-600 mb-4">{draft.message}</p>
                                                    <button
                                                        onClick={() => handleLoadDraft(draft)}
                                                        className="w-full px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                    >
                                                        Load Draft
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DRAFTS TAB */}
                        {activeTab === 'drafts' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-slate-800">Message Drafts</h3>
                                    <button
                                        onClick={() => {
                                            setShowDraftForm(!showDraftForm);
                                            setEditingDraft(null);
                                            setDraftForm({
                                                title: '',
                                                message: '',
                                                type: 'general',
                                                image_url: '',
                                                link_url: '',
                                                link_label: '',
                                                priority: 1,
                                                is_template: false,
                                                template_name: '',
                                            });
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {showDraftForm ? 'Cancel' : 'New Draft'}
                                    </button>
                                </div>

                                {showDraftForm && (
                                    <form onSubmit={handleSaveDraft} className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Title"
                                                value={draftForm.title}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, title: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                            <select
                                                value={draftForm.type}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, type: e.target.value as any }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="general">General</option>
                                                <option value="course">Course</option>
                                                <option value="assignment">Assignment</option>
                                                <option value="announcement">Announcement</option>
                                                <option value="system">System</option>
                                            </select>
                                        </div>

                                        <textarea
                                            placeholder="Message"
                                            value={draftForm.message}
                                            onChange={(e) => setDraftForm(prev => ({ ...prev, message: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={4}
                                            required
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="url"
                                                placeholder="Image URL (optional)"
                                                value={draftForm.image_url}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, image_url: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="url"
                                                placeholder="Link URL (optional)"
                                                value={draftForm.link_url}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, link_url: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Link Label (optional)"
                                                value={draftForm.link_label}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, link_label: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <select
                                                value={draftForm.priority}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="1">Priority: Low</option>
                                                <option value="2">Priority: Medium</option>
                                                <option value="3">Priority: High</option>
                                                <option value="4">Priority: Critical</option>
                                                <option value="5">Priority: Urgent</option>
                                            </select>
                                        </div>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={draftForm.is_template}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, is_template: e.target.checked }))}
                                            />
                                            <span>Save as Template</span>
                                        </label>

                                        {draftForm.is_template && (
                                            <input
                                                type="text"
                                                placeholder="Template Name"
                                                value={draftForm.template_name}
                                                onChange={(e) => setDraftForm(prev => ({ ...prev, template_name: e.target.value }))}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        )}

                                        <button
                                            type="submit"
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            {editingDraft ? 'Update Draft' : 'Save Draft'}
                                        </button>
                                    </form>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {drafts.map(draft => (
                                        <div key={draft.id} className="p-4 bg-white border border-slate-200 rounded-lg">
                                            <div className="flex justify-between items-start mb-3">
                                                <h5 className="font-semibold text-slate-800">{draft.title}</h5>
                                                {draft.is_template && (
                                                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Template</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mb-4">{draft.message}</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingDraft(draft.id);
                                                        setDraftForm({
                                                            title: draft.title,
                                                            message: draft.message,
                                                            type: draft.type,
                                                            image_url: draft.image_url || '',
                                                            link_url: draft.link_url || '',
                                                            link_label: draft.link_label || '',
                                                            priority: draft.priority,
                                                            is_template: draft.is_template,
                                                            template_name: draft.template_name || '',
                                                        });
                                                        setShowDraftForm(true);
                                                    }}
                                                    className="flex-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDraft(draft.id)}
                                                    className="flex-1 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SCHEDULED TAB */}
                        {activeTab === 'scheduled' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-slate-800">Scheduled Notifications</h3>
                                    <button
                                        onClick={() => setShowScheduleForm(!showScheduleForm)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {showScheduleForm ? 'Cancel' : 'Schedule Notification'}
                                    </button>
                                </div>

                                {showScheduleForm && (
                                    <form onSubmit={handleScheduleNotification} className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Title"
                                                value={scheduleForm.title}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, title: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                            <select
                                                value={scheduleForm.type}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, type: e.target.value as any }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="general">General</option>
                                                <option value="course">Course</option>
                                                <option value="assignment">Assignment</option>
                                                <option value="announcement">Announcement</option>
                                                <option value="system">System</option>
                                            </select>
                                        </div>

                                        <textarea
                                            placeholder="Message"
                                            value={scheduleForm.message}
                                            onChange={(e) => setScheduleForm(prev => ({ ...prev, message: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={4}
                                            required
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="datetime-local"
                                                value={scheduleForm.scheduled_for}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduled_for: e.target.value }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                            <select
                                                value={scheduleForm.priority}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                                                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="1">Priority: Low</option>
                                                <option value="2">Priority: Medium</option>
                                                <option value="3">Priority: High</option>
                                                <option value="4">Priority: Critical</option>
                                                <option value="5">Priority: Urgent</option>
                                            </select>
                                        </div>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={scheduleForm.is_recurring}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, is_recurring: e.target.checked }))}
                                            />
                                            <span>Recurring Notification</span>
                                        </label>

                                        {scheduleForm.is_recurring && (
                                            <select
                                                value={scheduleForm.recurrence_pattern}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, recurrence_pattern: e.target.value as any }))}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        )}

                                        <div className="space-y-4 border-t border-slate-300 pt-4">
                                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="scheduleSendTo"
                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                                                        checked={scheduleForm.recipient_type === 'all'}
                                                        onChange={() => setScheduleForm(prev => ({ ...prev, recipient_type: 'all' }))}
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">Send to All Users ({users.length})</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="scheduleSendTo"
                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                                                        checked={scheduleForm.recipient_type !== 'all'}
                                                        onChange={() => setScheduleForm(prev => ({ ...prev, recipient_type: 'users' }))}
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">Select Recipients</span>
                                                </label>
                                            </div>

                                            {scheduleForm.recipient_type !== 'all' && (
                                                <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                                    {/* Role/Department Filters */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveDepartment('All')}
                                                            className={`px-4 py-2 text-xs font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === 'All' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                                                        >
                                                            All Users ({users.length})
                                                        </button>
                                                        {Object.entries(departmentCounts).map(([department, count]) => (
                                                            <button
                                                                type="button"
                                                                key={department}
                                                                onClick={() => setActiveDepartment(department)}
                                                                className={`px-4 py-2 text-xs font-semibold rounded-full flex items-center gap-2 transition-colors ${activeDepartment === department ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                                                            >
                                                                {department} ({count})
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="flex flex-wrap justify-between items-center gap-4">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <div className="relative flex-1 max-w-md">
                                                                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search users..."
                                                                    value={searchQuery}
                                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                                                                className={`text-sm font-medium flex items-center gap-1 ${showAdvancedSearch ? 'text-blue-600' : 'text-slate-500'} hover:underline`}
                                                            >
                                                                <span className="material-symbols-rounded text-sm">filter_list</span>
                                                                Advanced Filters
                                                            </button>
                                                        </div>
                                                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600">
                                                            <input
                                                                type="checkbox"
                                                                onChange={toggleAllUsers}
                                                                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                            />
                                                            Select All Visible ({filteredUsers.length})
                                                        </label>
                                                    </div>

                                                    {showAdvancedSearch && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                                            {filterOptions.departments?.length > 0 && (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                                                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                                        {filterOptions.departments.map((dept: string) => (
                                                                            <label key={dept} className="flex items-center gap-2 cursor-pointer group">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={filters.department.includes(dept)}
                                                                                    onChange={() => toggleFilter('department', dept)}
                                                                                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                                />
                                                                                <span className="text-sm text-slate-600 group-hover:text-slate-900">{dept}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {filterOptions.designations?.length > 0 && (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Designation</label>
                                                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                                        {filterOptions.designations.map((item: string) => (
                                                                            <label key={item} className="flex items-center gap-2 cursor-pointer group">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={filters.designation.includes(item)}
                                                                                    onChange={() => toggleFilter('designation', item)}
                                                                                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                                />
                                                                                <span className="text-sm text-slate-600 group-hover:text-slate-900">{item}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {filterOptions.locations?.length > 0 && (
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                                                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                                        {filterOptions.locations.map((item: string) => (
                                                                            <label key={item} className="flex items-center gap-2 cursor-pointer group">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={filters.location.includes(item)}
                                                                                    onChange={() => toggleFilter('location', item)}
                                                                                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                                />
                                                                                <span className="text-sm text-slate-600 group-hover:text-slate-900">{item}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Selected Count */}
                                                    <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full inline-block">
                                                        {selectedUsers.length} Users Selected
                                                    </div>

                                                    {/* Scrollable User List */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {filteredUsers.length > 0 ? (
                                                            filteredUsers.map((user) => (
                                                                <div
                                                                    key={user.id}
                                                                    onClick={() => toggleUser(user.id)}
                                                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${selectedUsers.includes(user.id)
                                                                        ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                                                                        : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                                                                        }`}
                                                                >
                                                                    <div className="relative flex-shrink-0">
                                                                        <div className={`w-4 h-4 rounded-full absolute -top-1 -left-1 z-10 flex items-center justify-center border border-white ${selectedUsers.includes(user.id) ? 'bg-blue-600' : 'bg-slate-200'
                                                                            }`}>
                                                                            {selectedUsers.includes(user.id) && <span className="material-symbols-rounded text-white text-[10px]">check</span>}
                                                                        </div>
                                                                        {user.avatarurl ? (
                                                                            <img src={user.avatarurl} alt={user.fullname} className="w-10 h-10 rounded-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                                                                                {user.fullname.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 overflow-hidden">
                                                                        <p className="text-sm font-bold text-slate-900 truncate">{user.fullname}</p>
                                                                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                                                                        <p className="text-[10px] text-blue-600 font-medium mt-0.5">{user.department || 'No Dept'}</p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="col-span-full py-12 text-center text-slate-400">
                                                                <span className="material-symbols-rounded text-4xl block mb-2">person_search</span>
                                                                <p>No users found matching your criteria</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Schedule Notification
                                        </button>
                                    </form>
                                )}

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50">
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Scheduled For</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Recipients</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scheduledNotifications.map(notif => (
                                                <tr key={notif.id} className="border-b border-slate-200 hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-slate-800 font-medium">{notif.title}</td>
                                                    <td className="px-4 py-3 text-slate-600">
                                                        {new Date(notif.scheduled_for).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 text-xs rounded-full ${notif.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                                            notif.status === 'sent' ? 'bg-green-100 text-green-800' :
                                                                notif.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                                                                    'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {notif.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 text-xs">
                                                        {notif.recipient_type === 'all' ? 'All users' : notif.recipient_type}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {notif.status === 'scheduled' && (
                                                            <button
                                                                onClick={() => handleCancelScheduled(notif.id)}
                                                                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* HISTORY TAB */}
                        {activeTab === 'history' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-slate-800">Notification History</h3>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Filter by action or user..."
                                            value={historyFilter}
                                            onChange={(e) => setHistoryFilter(e.target.value)}
                                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            onClick={async () => {
                                                setHistoryLoading(true);
                                                try {
                                                    const historyData = await advancedNotificationService.getNotificationHistory(undefined, undefined, undefined, 50);
                                                    if (historyData && historyData.length > 0) {
                                                        const usersMap = new Map(users.map(u => [u.id, u]) || []);
                                                        const enrichedHistory = historyData.map(h => ({
                                                            ...h,
                                                            user: usersMap.get(h.user_id),
                                                        }));
                                                        setHistoryEntries(enrichedHistory);
                                                    } else {
                                                        setHistoryEntries([]);
                                                    }
                                                } catch (err) {
                                                    console.error('Refresh error:', err);
                                                } finally {
                                                    setHistoryLoading(false);
                                                }
                                            }}
                                            className="p-2 text-slate-500 hover:text-blue-600 border border-slate-300 rounded-lg transition-colors"
                                            title="Refresh history"
                                        >
                                            <span className={`material-symbols-rounded ${historyLoading ? 'animate-spin' : ''}`}>refresh</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50">
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Recipient</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date & Time</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                                                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-12 text-center">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                                        <p className="text-slate-500">Loading notifications...</p>
                                                    </td>
                                                </tr>
                                            ) : sentNotifications.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                                        <span className="material-symbols-rounded text-4xl block mb-2 text-slate-300">history_off</span>
                                                        No notification history found
                                                    </td>
                                                </tr>
                                            ) : (
                                                sentNotifications
                                                    .filter(n => {
                                                        const searchStr = historyFilter.toLowerCase();
                                                        return !historyFilter ||
                                                            n.title?.toLowerCase().includes(searchStr) ||
                                                            n.profiles?.fullname?.toLowerCase().includes(searchStr) ||
                                                            n.profiles?.email?.toLowerCase().includes(searchStr);
                                                    })
                                                    .map(notification => (
                                                        <tr key={notification.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-slate-800">{notification.title}</div>
                                                                <div className="text-[10px] text-slate-500 truncate max-w-xs">{notification.message}</div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-slate-800">{notification.profiles?.fullname || 'Unknown'}</div>
                                                                <div className="text-[10px] text-slate-500 font-mono">{notification.profiles?.email || notification.user_id}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                                                                {new Date(notification.created_at).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${notification.type === 'general' ? 'bg-blue-100 text-blue-800' :
                                                                        notification.type === 'course' ? 'bg-purple-100 text-purple-800' :
                                                                            notification.type === 'assignment' ? 'bg-orange-100 text-orange-800' :
                                                                                notification.type === 'system' ? 'bg-red-100 text-red-800' :
                                                                                    'bg-gray-100 text-gray-800'
                                                                    }`}>
                                                                    {notification.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                                                                <button
                                                                    onClick={() => handleEditNotification(notification)}
                                                                    className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <span className="material-symbols-rounded text-lg">edit</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleResendNotification(notification)}
                                                                    className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors"
                                                                    title="Resend"
                                                                >
                                                                    <span className="material-symbols-rounded text-lg">send</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteNotification(notification.id)}
                                                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <span className="material-symbols-rounded text-lg">delete</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* AUTO-RULES TAB */}
                        {activeTab === 'auto-rules' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-slate-800">Auto-Send Rules</h3>
                                    <button
                                        onClick={() => {
                                            setShowAutoRuleForm(!showAutoRuleForm);
                                            setEditingAutoRule(null);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {showAutoRuleForm ? 'Cancel' : '+ Create Custom Rule'}
                                    </button>
                                </div>

                                {/* PRESET RULES SECTION */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-700">Quick-Enable Presets</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Assessment Reminder - 3 Days */}
                                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-slate-800 text-sm">⏰ Assessment Due (3 Days)</h5>
                                                    <p className="text-xs text-slate-500 mt-1">Remind before assessment due date</p>
                                                </div>
                                                <div className="flex gap-2 ml-3 flex-shrink-0">
                                                    {autoRules.find(r => r.name === 'Assessment Due (3 Days)') && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Assessment Due (3 Days)');
                                                                    if (rule) {
                                                                        setEditingAutoRule(rule.id);
                                                                        setAutoRuleForm({
                                                                            name: rule.name,
                                                                            description: rule.description || '',
                                                                            trigger_type: rule.trigger_type as any,
                                                                            title: rule.title,
                                                                            message: rule.message,
                                                                            type: rule.type as any,
                                                                            priority: rule.priority || 2,
                                                                            send_after_days: rule.send_after_days,
                                                                            send_before_days: rule.send_before_days || 0,
                                                                            max_sends_per_user: rule.max_sends_per_user,
                                                                            is_active: rule.is_active,
                                                                        });
                                                                        setShowAutoRuleForm(true);
                                                                    }
                                                                }}
                                                                className="p-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                                                                title="Edit this rule"
                                                            >
                                                                <span className="material-symbols-rounded text-sm">edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Assessment Due (3 Days)');
                                                                    if (rule) handleToggleAutoRule(rule.id, rule.is_active);
                                                                }}
                                                                className={`p-2 text-xs rounded transition-colors flex items-center gap-1 ${autoRules.find(r => r.name === 'Assessment Due (3 Days)')?.is_active
                                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                                                    }`}
                                                                title={autoRules.find(r => r.name === 'Assessment Due (3 Days)')?.is_active ? 'Disable' : 'Enable'}
                                                            >
                                                                <span className="material-symbols-rounded text-sm">{autoRules.find(r => r.name === 'Assessment Due (3 Days)')?.is_active ? 'toggle_on' : 'toggle_off'}</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    {!autoRules.find(r => r.name === 'Assessment Due (3 Days)') && (
                                                        <button
                                                            onClick={() => handleEnablePreset('assessment-3day')}
                                                            className="px-3 py-2 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                                                        >
                                                            <span className="material-symbols-rounded text-sm">add_circle</span>
                                                            Enable
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <p>📅 When: 3 days before due date</p>
                                                <p>👥 Max per user: 2 times</p>
                                            </div>
                                        </div>

                                        {/* Course Due - 7 Days */}
                                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-slate-800 text-sm">📚 Course Due (1 Week)</h5>
                                                    <p className="text-xs text-slate-500 mt-1">Early reminder before course completion</p>
                                                </div>
                                                <div className="flex gap-2 ml-3 flex-shrink-0">
                                                    {autoRules.find(r => r.name === 'Course Due (1 Week)') && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Course Due (1 Week)');
                                                                    if (rule) {
                                                                        setEditingAutoRule(rule.id);
                                                                        setAutoRuleForm({
                                                                            name: rule.name,
                                                                            description: rule.description || '',
                                                                            trigger_type: rule.trigger_type as any,
                                                                            title: rule.title,
                                                                            message: rule.message,
                                                                            type: rule.type as any,
                                                                            priority: rule.priority || 2,
                                                                            send_after_days: rule.send_after_days,
                                                                            send_before_days: rule.send_before_days || 0,
                                                                            max_sends_per_user: rule.max_sends_per_user,
                                                                            is_active: rule.is_active,
                                                                        });
                                                                        setShowAutoRuleForm(true);
                                                                    }
                                                                }}
                                                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                                title="Edit rule"
                                                            >
                                                                ✎
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Course Due (1 Week)');
                                                                    if (rule) handleToggleAutoRule(rule.id, rule.is_active);
                                                                }}
                                                                className={`px-2 py-1 text-xs rounded transition-colors ${autoRules.find(r => r.name === 'Course Due (1 Week)')?.is_active
                                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                                                    }`}
                                                                title={autoRules.find(r => r.name === 'Course Due (1 Week)')?.is_active ? 'Disable' : 'Enable'}
                                                            >
                                                                {autoRules.find(r => r.name === 'Course Due (1 Week)')?.is_active ? '✓' : '⊘'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {!autoRules.find(r => r.name === 'Course Due (1 Week)') && (
                                                        <button
                                                            onClick={() => handleEnablePreset('course-1week')}
                                                            className="px-3 py-1 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                                        >
                                                            Enable
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <p>📅 When: 7 days before due date</p>
                                                <p>👥 Max per user: 1 time</p>
                                            </div>
                                        </div>

                                        {/* New Course Assignment */}
                                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-slate-800 text-sm">🆕 New Course Assigned</h5>
                                                    <p className="text-xs text-slate-500 mt-1">Notify when course is assigned</p>
                                                </div>
                                                <div className="flex gap-2 ml-3 flex-shrink-0">
                                                    {autoRules.find(r => r.name === 'New Course Assigned') && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'New Course Assigned');
                                                                    if (rule) {
                                                                        setEditingAutoRule(rule.id);
                                                                        setAutoRuleForm({
                                                                            name: rule.name,
                                                                            description: rule.description || '',
                                                                            trigger_type: rule.trigger_type as any,
                                                                            title: rule.title,
                                                                            message: rule.message,
                                                                            type: rule.type as any,
                                                                            priority: rule.priority || 2,
                                                                            send_after_days: rule.send_after_days,
                                                                            send_before_days: rule.send_before_days || 0,
                                                                            max_sends_per_user: rule.max_sends_per_user,
                                                                            is_active: rule.is_active,
                                                                        });
                                                                        setShowAutoRuleForm(true);
                                                                    }
                                                                }}
                                                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                                title="Edit rule"
                                                            >
                                                                ✎
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'New Course Assigned');
                                                                    if (rule) handleToggleAutoRule(rule.id, rule.is_active);
                                                                }}
                                                                className={`px-2 py-1 text-xs rounded transition-colors ${autoRules.find(r => r.name === 'New Course Assigned')?.is_active
                                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                                                    }`}
                                                                title={autoRules.find(r => r.name === 'New Course Assigned')?.is_active ? 'Disable' : 'Enable'}
                                                            >
                                                                {autoRules.find(r => r.name === 'New Course Assigned')?.is_active ? '✓' : '⊘'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {!autoRules.find(r => r.name === 'New Course Assigned') && (
                                                        <button
                                                            onClick={() => handleEnablePreset('course-assigned')}
                                                            className="px-3 py-1 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                                        >
                                                            Enable
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <p>📅 When: Immediately upon assignment</p>
                                                <p>👥 Max per user: 1 time</p>
                                            </div>
                                        </div>

                                        {/* Career Path Weekly */}
                                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-slate-800 text-sm">🎯 Career Path Weekly Check</h5>
                                                    <p className="text-xs text-slate-500 mt-1">Weekly progress reminder (Monday 9 AM)</p>
                                                </div>
                                                <div className="flex gap-2 ml-3 flex-shrink-0">
                                                    {autoRules.find(r => r.name === 'Career Path Weekly Check') && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Career Path Weekly Check');
                                                                    if (rule) {
                                                                        setEditingAutoRule(rule.id);
                                                                        setAutoRuleForm({
                                                                            name: rule.name,
                                                                            description: rule.description || '',
                                                                            trigger_type: rule.trigger_type as any,
                                                                            title: rule.title,
                                                                            message: rule.message,
                                                                            type: rule.type as any,
                                                                            priority: rule.priority || 2,
                                                                            send_after_days: rule.send_after_days,
                                                                            send_before_days: rule.send_before_days || 0,
                                                                            max_sends_per_user: rule.max_sends_per_user,
                                                                            is_active: rule.is_active,
                                                                        });
                                                                        setShowAutoRuleForm(true);
                                                                    }
                                                                }}
                                                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                                title="Edit rule"
                                                            >
                                                                ✎
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Career Path Weekly Check');
                                                                    if (rule) handleToggleAutoRule(rule.id, rule.is_active);
                                                                }}
                                                                className={`px-2 py-1 text-xs rounded transition-colors ${autoRules.find(r => r.name === 'Career Path Weekly Check')?.is_active
                                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                                                    }`}
                                                                title={autoRules.find(r => r.name === 'Career Path Weekly Check')?.is_active ? 'Disable' : 'Enable'}
                                                            >
                                                                {autoRules.find(r => r.name === 'Career Path Weekly Check')?.is_active ? '✓' : '⊘'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {!autoRules.find(r => r.name === 'Career Path Weekly Check') && (
                                                        <button
                                                            onClick={() => handleEnablePreset('careerpath-weekly')}
                                                            className="px-3 py-1 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                                        >
                                                            Enable
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <p>📅 When: Every Monday at 9:00 AM</p>
                                                <p>👥 Max per user: 1 per week</p>
                                            </div>
                                        </div>

                                        {/* Inactive User Recovery */}
                                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-slate-800 text-sm">😴 Re-engagement (14 Days Inactive)</h5>
                                                    <p className="text-xs text-slate-500 mt-1">Bring back inactive learners</p>
                                                </div>
                                                <div className="flex gap-2 ml-3 flex-shrink-0">
                                                    {autoRules.find(r => r.name === 'Re-engagement (14 Days Inactive)') && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Re-engagement (14 Days Inactive)');
                                                                    if (rule) {
                                                                        setEditingAutoRule(rule.id);
                                                                        setAutoRuleForm({
                                                                            name: rule.name,
                                                                            description: rule.description || '',
                                                                            trigger_type: rule.trigger_type as any,
                                                                            title: rule.title,
                                                                            message: rule.message,
                                                                            type: rule.type as any,
                                                                            priority: rule.priority || 2,
                                                                            send_after_days: rule.send_after_days,
                                                                            send_before_days: rule.send_before_days || 0,
                                                                            max_sends_per_user: rule.max_sends_per_user,
                                                                            is_active: rule.is_active,
                                                                        });
                                                                        setShowAutoRuleForm(true);
                                                                    }
                                                                }}
                                                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                                title="Edit rule"
                                                            >
                                                                ✎
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Re-engagement (14 Days Inactive)');
                                                                    if (rule) handleToggleAutoRule(rule.id, rule.is_active);
                                                                }}
                                                                className={`px-2 py-1 text-xs rounded transition-colors ${autoRules.find(r => r.name === 'Re-engagement (14 Days Inactive)')?.is_active
                                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                                                    }`}
                                                                title={autoRules.find(r => r.name === 'Re-engagement (14 Days Inactive)')?.is_active ? 'Disable' : 'Enable'}
                                                            >
                                                                {autoRules.find(r => r.name === 'Re-engagement (14 Days Inactive)')?.is_active ? '✓' : '⊘'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {!autoRules.find(r => r.name === 'Re-engagement (14 Days Inactive)') && (
                                                        <button
                                                            onClick={() => handleEnablePreset('reengagement-14day')}
                                                            className="px-3 py-1 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                                        >
                                                            Enable
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <p>📅 When: After 14 days of no activity</p>
                                                <p>👥 Max per user: 1 time</p>
                                            </div>
                                        </div>

                                        {/* Mid-Course Motivation */}
                                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-slate-800 text-sm">✨ Mid-Course Motivation</h5>
                                                    <p className="text-xs text-slate-500 mt-1">Encourage at 50% completion</p>
                                                </div>
                                                <div className="flex gap-2 ml-3 flex-shrink-0">
                                                    {autoRules.find(r => r.name === 'Mid-Course Motivation') && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Mid-Course Motivation');
                                                                    if (rule) {
                                                                        setEditingAutoRule(rule.id);
                                                                        setAutoRuleForm({
                                                                            name: rule.name,
                                                                            description: rule.description || '',
                                                                            trigger_type: rule.trigger_type as any,
                                                                            title: rule.title,
                                                                            message: rule.message,
                                                                            type: rule.type as any,
                                                                            priority: rule.priority || 2,
                                                                            send_after_days: rule.send_after_days,
                                                                            send_before_days: rule.send_before_days || 0,
                                                                            max_sends_per_user: rule.max_sends_per_user,
                                                                            is_active: rule.is_active,
                                                                        });
                                                                        setShowAutoRuleForm(true);
                                                                    }
                                                                }}
                                                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                                title="Edit rule"
                                                            >
                                                                ✎
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const rule = autoRules.find(r => r.name === 'Mid-Course Motivation');
                                                                    if (rule) handleToggleAutoRule(rule.id, rule.is_active);
                                                                }}
                                                                className={`px-2 py-1 text-xs rounded transition-colors ${autoRules.find(r => r.name === 'Mid-Course Motivation')?.is_active
                                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                                                    }`}
                                                                title={autoRules.find(r => r.name === 'Mid-Course Motivation')?.is_active ? 'Disable' : 'Enable'}
                                                            >
                                                                {autoRules.find(r => r.name === 'Mid-Course Motivation')?.is_active ? '✓' : '⊘'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {!autoRules.find(r => r.name === 'Mid-Course Motivation') && (
                                                        <button
                                                            onClick={() => handleEnablePreset('motivation-midcourse')}
                                                            className="px-3 py-1 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                                        >
                                                            Enable
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <p>📅 When: At 50% completion</p>
                                                <p>👥 Max per user: 1 time</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ACTIVE RULES SECTION */}
                                <div className="space-y-4 mt-8">
                                    <h4 className="font-semibold text-slate-700">Your Active Rules ({autoRules.filter(r => r.is_active).length})</h4>

                                    {autoRules.filter(r => r.is_active).length === 0 ? (
                                        <div className="p-6 bg-slate-50 rounded-lg text-center">
                                            <p className="text-slate-500">No active rules yet. Enable a preset rule above to get started! 👆</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {autoRules.filter(r => r.is_active).map(rule => (
                                                <div key={rule.id} className="p-4 bg-green-50 border border-green-200 rounded-lg hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex-1">
                                                            <h5 className="font-semibold text-slate-800 text-sm">✓ {rule.name}</h5>
                                                            <p className="text-xs text-slate-600 mt-1">{rule.description}</p>
                                                            <div className="text-xs text-slate-500 mt-2 space-y-1">
                                                                <p>• Trigger: <span className="font-medium">{rule.trigger_type}</span></p>
                                                                <p>• Max sends: <span className="font-medium">{rule.max_sends_per_user}</span> per user</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 ml-4 flex-shrink-0">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingAutoRule(rule.id);
                                                                    setAutoRuleForm({
                                                                        name: rule.name,
                                                                        description: rule.description || '',
                                                                        trigger_type: rule.trigger_type as any,
                                                                        title: rule.title,
                                                                        message: rule.message,
                                                                        type: rule.type as any,
                                                                        priority: rule.priority || 2,
                                                                        send_after_days: rule.send_after_days,
                                                                        send_before_days: rule.send_before_days || 0,
                                                                        max_sends_per_user: rule.max_sends_per_user,
                                                                        is_active: rule.is_active,
                                                                    });
                                                                    setShowAutoRuleForm(true);
                                                                }}
                                                                className="px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                                                                title="Edit rule"
                                                            >
                                                                <span className="material-symbols-rounded text-sm">edit</span>
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleAutoRule(rule.id, rule.is_active)}
                                                                className="px-3 py-2 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors flex items-center gap-1"
                                                                title="Disable this rule"
                                                            >
                                                                <span className="material-symbols-rounded text-sm">toggle_off</span>
                                                                Disable
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-slate-600 space-y-1 mt-3 pl-4 border-l-2 border-green-200">
                                                        <p><span className="font-medium">📝 Title:</span> {rule.title}</p>
                                                        <p><span className="font-medium">💬 Message:</span> {rule.message.substring(0, 60)}...</p>
                                                        <p><span className="font-medium">⏱️ Send after:</span> {rule.send_after_days} days</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* CUSTOM RULE FORM */}
                                {showAutoRuleForm && (
                                    <form onSubmit={handleSaveAutoRule} className="bg-slate-50 p-6 rounded-lg space-y-4 border-2 border-blue-500 mt-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-semibold text-slate-700">
                                                {editingAutoRule ? '✏️ Edit Auto-Rule' : '➕ Create Custom Auto-Rule'}
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAutoRuleForm(false);
                                                    setEditingAutoRule(null);
                                                    setAutoRuleForm({
                                                        name: '',
                                                        description: '',
                                                        trigger_type: 'task_pending',
                                                        title: '',
                                                        message: '',
                                                        type: 'reminder',
                                                        priority: 2,
                                                        send_after_days: 1,
                                                        send_before_days: 0,
                                                        max_sends_per_user: 1,
                                                        is_active: true,
                                                    });
                                                }}
                                                className="text-gray-500 hover:text-gray-700 text-lg font-bold"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            placeholder="Rule Name"
                                            value={autoRuleForm.name}
                                            onChange={(e) => setAutoRuleForm(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />

                                        <textarea
                                            placeholder="Description (optional)"
                                            value={autoRuleForm.description}
                                            onChange={(e) => setAutoRuleForm(prev => ({ ...prev, description: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={2}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1 block">Trigger Type</label>
                                                <select
                                                    value={autoRuleForm.trigger_type}
                                                    onChange={(e) => setAutoRuleForm(prev => ({ ...prev, trigger_type: e.target.value as any, trigger_params: {} }))}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="task_pending">📋 Task Pending</option>
                                                    <option value="course_due">📚 Course Due</option>
                                                    <option value="assignment_overdue">⚠️ Assignment Overdue</option>
                                                    <option value="low_engagement">📉 Low Engagement</option>
                                                    <option value="inactive_user">😴 Inactive User</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1 block">Type</label>
                                                <select
                                                    value={autoRuleForm.type}
                                                    onChange={(e) => setAutoRuleForm(prev => ({ ...prev, type: e.target.value as any }))}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="general">📢 General</option>
                                                    <option value="course">📚 Course</option>
                                                    <option value="assignment">📋 Assignment</option>
                                                    <option value="reminder">🔔 Reminder</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Trigger Specific Parameters */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Trigger Settings</p>

                                            {autoRuleForm.trigger_type === 'task_pending' && (
                                                <div>
                                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Days after assignment</label>
                                                    <input
                                                        type="number"
                                                        value={autoRuleForm.trigger_params.days_after_assignment || 0}
                                                        onChange={(e) => setAutoRuleForm(prev => ({
                                                            ...prev,
                                                            trigger_params: { ...prev.trigger_params, days_after_assignment: parseInt(e.target.value) }
                                                        }))}
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        min="0"
                                                    />
                                                </div>
                                            )}

                                            {autoRuleForm.trigger_type === 'course_due' && (
                                                <div>
                                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Days before due date</label>
                                                    <input
                                                        type="number"
                                                        value={autoRuleForm.trigger_params.days_before_due || 3}
                                                        onChange={(e) => setAutoRuleForm(prev => ({
                                                            ...prev,
                                                            trigger_params: { ...prev.trigger_params, days_before_due: parseInt(e.target.value) }
                                                        }))}
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        min="0"
                                                    />
                                                </div>
                                            )}

                                            {autoRuleForm.trigger_type === 'inactive_user' && (
                                                <div>
                                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Days inactive</label>
                                                    <input
                                                        type="number"
                                                        value={autoRuleForm.trigger_params.days_inactive || 14}
                                                        onChange={(e) => setAutoRuleForm(prev => ({
                                                            ...prev,
                                                            trigger_params: { ...prev.trigger_params, days_inactive: parseInt(e.target.value) }
                                                        }))}
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        min="1"
                                                    />
                                                </div>
                                            )}

                                            {autoRuleForm.trigger_type === 'low_engagement' && (
                                                <div>
                                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Completion threshold (%)</label>
                                                    <input
                                                        type="number"
                                                        value={autoRuleForm.trigger_params.completion_threshold || 50}
                                                        onChange={(e) => setAutoRuleForm(prev => ({
                                                            ...prev,
                                                            trigger_params: { ...prev.trigger_params, completion_threshold: parseInt(e.target.value) }
                                                        }))}
                                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        min="1"
                                                        max="100"
                                                    />
                                                </div>
                                            )}

                                            {(autoRuleForm.trigger_type === 'assignment_overdue') && (
                                                <p className="text-sm text-slate-500 italic">No additional parameters needed for this trigger.</p>
                                            )}
                                        </div>

                                        <input
                                            type="text"
                                            placeholder="Message Title"
                                            value={autoRuleForm.title}
                                            onChange={(e) => setAutoRuleForm(prev => ({ ...prev, title: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />

                                        <textarea
                                            placeholder="Message Content"
                                            value={autoRuleForm.message}
                                            onChange={(e) => setAutoRuleForm(prev => ({ ...prev, message: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={3}
                                            required
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1 block">Send After (days)</label>
                                                <input
                                                    type="number"
                                                    value={autoRuleForm.send_after_days}
                                                    onChange={(e) => setAutoRuleForm(prev => ({ ...prev, send_after_days: parseInt(e.target.value) }))}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1 block">Send Before (days)</label>
                                                <input
                                                    type="number"
                                                    value={autoRuleForm.send_before_days || 0}
                                                    onChange={(e) => setAutoRuleForm(prev => ({ ...prev, send_before_days: parseInt(e.target.value) }))}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    min="0"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1 block">Max Sends Per User</label>
                                                <input
                                                    type="number"
                                                    value={autoRuleForm.max_sends_per_user}
                                                    onChange={(e) => setAutoRuleForm(prev => ({ ...prev, max_sends_per_user: parseInt(e.target.value) }))}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    min="1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1 block">Priority</label>
                                                <select
                                                    value={autoRuleForm.priority}
                                                    onChange={(e) => setAutoRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="1">Low (1)</option>
                                                    <option value="2">Medium (2)</option>
                                                    <option value="3">High (3)</option>
                                                    <option value="4">Urgent (4)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <label className="flex items-center gap-3 bg-white p-3 rounded border border-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={autoRuleForm.is_active}
                                                onChange={(e) => setAutoRuleForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                                className="w-4 h-4 rounded"
                                            />
                                            <span className="font-medium text-slate-700">Activate this rule immediately</span>
                                        </label>

                                        <div className="flex gap-3">
                                            <button
                                                type="submit"
                                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                            >
                                                {editingAutoRule ? '💾 Update Rule' : '➕ Create Rule'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAutoRuleForm(false);
                                                    setEditingAutoRule(null);
                                                    setAutoRuleForm({
                                                        name: '',
                                                        description: '',
                                                        trigger_type: 'task_pending',
                                                        title: '',
                                                        message: '',
                                                        type: 'reminder',
                                                        priority: 2,
                                                        send_after_days: 1,
                                                        send_before_days: 0,
                                                        max_sends_per_user: 1,
                                                        is_active: true,
                                                    });
                                                }}
                                                className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors font-medium"
                                            >
                                                ✕ Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Notification Modal */}
            {isEditingNotification && editingNotification && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold">Edit Notification</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={editNotificationForm.title}
                                    onChange={(e) => setEditNotificationForm({ ...editNotificationForm, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Message</label>
                                <textarea
                                    value={editNotificationForm.message}
                                    onChange={(e) => setEditNotificationForm({ ...editNotificationForm, message: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setIsEditingNotification(false)}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveNotification}
                                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                                    <span className="material-symbols-rounded text-red-600 dark:text-red-400">warning</span>
                                </div>
                                <h3 className="text-lg font-semibold">Delete Notification</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 dark:text-slate-300">Are you sure you want to delete this notification? This action cannot be undone.</p>
                        </div>
                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirmation({ isOpen: false, notificationId: null })}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};


export default AdvancedNotificationsPage;
