import React, { useState, useEffect } from 'react';
import { notificationService, Notification } from '../lib/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface NotificationDropdownProps {
  className?: string;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      fetchUnreadCount();

      // Subscribe to new notifications
      const subscription = notificationService.subscribeToNotifications(
        user.id,
        (newNotification, event) => {
          if (event === 'DELETE') {
            // Notification was deleted, remove from local state
            setUnreadCount(prev => Math.max(0, prev - 1));
          } else if (event === 'INSERT') {
            // New notification arrived
            setNotifications(prev => [newNotification!, ...prev.slice(0, 9)]);
            setUnreadCount(prev => prev + 1);
          } else if (event === 'UPDATE' && newNotification) {
            // Notification was updated (e.g., marked as read)
            setNotifications(prev =>
              prev.map(n => n.id === newNotification.id ? newNotification : n)
            );
            if (!newNotification.is_read) {
              setUnreadCount(prev => prev - 1);
            }
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id]);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const userNotifications = await notificationService.getUserNotifications(user.id, 10);
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user?.id) return;

    try {
      const count = await notificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Log 'viewed' action to audit log
      await supabase.from('notification_audit_log').insert({
        user_id: user?.id,
        notification_id: notificationId,
        action: 'viewed',
        details: { source: 'dropdown_mark_read' }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await notificationService.markAllAsRead(user.id);

      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length > 0) {
        const logs = unreadIds.map(id => ({
          user_id: user.id,
          notification_id: id,
          action: 'viewed' as const,
          details: { source: 'dropdown_mark_all_read' }
        }));
        await supabase.from('notification_audit_log').insert(logs);
      }

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }

    await supabase.from('notification_audit_log').insert({
      user_id: user?.id,
      notification_id: notification.id,
      action: 'clicked',
      details: {
        has_link: !!notification.link_url,
        link_url: notification.link_url
      }
    });

    if (notification.link_url) {
      window.open(notification.link_url, '_blank');
    }

    setIsOpen(false);
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleClearAll = async () => {
    if (!user?.id) return;

    if (!confirm('Are you sure you want to clear all notifications?')) return;

    try {
      for (const notification of notifications) {
        await notificationService.deleteNotification(notification.id);
      }
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      general: 'notifications',
      course: 'school',
      assignment: 'assignment',
      system: 'settings',
      announcement: 'campaign'
    };
    return icons[type as keyof typeof icons] || 'notifications';
  };

  const getTypeColor = (type: string) => {
    const colors = {
      general: 'bg-blue-50 text-blue-600',
      course: 'bg-green-50 text-green-600',
      assignment: 'bg-indigo-50 text-indigo-600',
      system: 'bg-gray-50 text-gray-600',
      announcement: 'bg-yellow-50 text-yellow-600'
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <span className="material-symbols-rounded text-xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-40 bg-white/50 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown container */}
          <div className="fixed inset-x-4 top-16 sm:absolute sm:right-0 sm:inset-x-auto sm:top-full sm:mt-3 sm:w-[420px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-gray-200 z-[1001] max-h-[85vh] sm:max-h-[38rem] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-bold text-primary hover:underline transition-all"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <span className="material-symbols-rounded text-xl">close</span>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 custom-scrollbar bg-white">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Refreshing...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-rounded text-4xl text-gray-300">notifications_off</span>
                  </div>
                  <p className="text-gray-900 text-base font-bold">All caught up!</p>
                  <p className="text-gray-500 text-sm mt-2">You don't have any notifications at the moment.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-5 hover:bg-gray-50 transition-all flex items-start gap-4 group relative ${!notification.is_read ? 'bg-blue-50' : 'bg-white'
                        }`}
                    >
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 ${getTypeColor(notification.type)}`}>
                            <span className="material-symbols-rounded text-xl">
                              {getTypeIcon(notification.type)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1">
                              <h4 className={`text-sm font-bold text-gray-900 leading-snug ${!notification.is_read ? 'pr-6' : ''}`}>
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <div className="absolute top-6 right-6 w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)] animate-pulse"></div>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap break-words leading-relaxed">
                              {notification.message}
                            </p>

                            {notification.image_url && (
                              <div className="relative w-full h-44 mb-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group/img">
                                <img
                                  src={notification.image_url}
                                  alt="Notification"
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                              </div>
                            )}

                            {notification.link_url && (
                              <div className="inline-flex items-center text-xs font-black text-primary hover:text-primary-dark mb-4 transition-colors bg-primary/10 px-3 py-1.5 rounded-lg">
                                {notification.link_label || 'VIEW DETAILS'}
                                <span className="material-symbols-rounded text-sm ml-1.5">arrow_forward</span>
                              </div>
                            )}

                            <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">
                              <span className="material-symbols-rounded text-[14px] mr-1.5">schedule</span>
                              {formatTime(notification.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Remove"
                      >
                        <span className="material-symbols-rounded text-lg">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleClearAll}
                  className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest px-2"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-black text-gray-900 hover:text-primary transition-colors flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-200"
                >
                  FULL HISTORY
                  <span className="material-symbols-rounded text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationDropdown;