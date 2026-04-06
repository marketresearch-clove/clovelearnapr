import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import useAuthGuard from '../hooks/useAuthGuard';
import { supabase } from '../lib/supabaseClient';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'general' | 'course' | 'assignment' | 'system' | 'announcement';
  image_url?: string;
  link_url?: string;
  link_label?: string;
  is_read: boolean;
  created_at: string;
  priority: number;
  sender_id?: string;
  metadata?: any;
}

interface UserProfile {
  id: string;
  fullname: string;
  email: string;
  department?: string;
}

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'general' as const,
    image_url: '',
    link_url: '',
    link_label: '',
    priority: 1,
    send_to_all: true,
    recipient_type: 'all' as 'all' | 'users' | 'departments'
  });

  useAuthGuard(['admin']);

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles!notifications_sender_id_fkey (
            fullname,
            email
          )
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, fullname, email, department')
        .eq('role', 'user')
        .order('fullname');

      if (error) throw error;
      setUsers(data || []);

      // Extract unique departments
      const uniqueDepts = [...new Set((data || [])
        .map(u => u.department)
        .filter(Boolean) as string[])]
        .sort();
      setDepartments(uniqueDepts);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let recipients: string[] = [];

      if (notificationForm.send_to_all) {
        recipients = users.map(u => u.id);
      } else if (notificationForm.recipient_type === 'departments') {
        recipients = users
          .filter(u => selectedDepartments.includes(u.department || ''))
          .map(u => u.id);
      } else {
        recipients = selectedUsers;
      }

      if (recipients.length === 0) {
        alert('Please select at least one recipient');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const notificationsToCreate = recipients.map(userId => ({
        user_id: userId,
        title: notificationForm.title,
        message: notificationForm.message,
        type: notificationForm.type,
        image_url: notificationForm.image_url || null,
        link_url: notificationForm.link_url || null,
        link_label: notificationForm.link_label || null,
        priority: notificationForm.priority,
        sender_id: user?.id
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notificationsToCreate);

      if (error) throw error;

      // Reset form
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
      setSelectedDepartments([]);
      setShowCreateForm(false);

      // Refresh notifications
      fetchNotifications();

      alert('Notification sent successfully!');
    } catch (error) {
      console.error('Error creating notification:', error);
      alert('Failed to send notification');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      general: 'bg-blue-100 text-blue-800',
      course: 'bg-green-100 text-green-800',
      assignment: 'bg-indigo-100 text-indigo-800',
      system: 'bg-gray-100 text-gray-800',
      announcement: 'bg-yellow-100 text-yellow-800'
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'bg-red-100 text-red-800';
    if (priority >= 3) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <AdminLayout title="Notifications">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-500">Manage and send notifications to learners</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-rounded">add</span>
            Send Notification
          </button>
        </div>

        {/* Create Notification Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl border border-gray-300 p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Create New Notification</h2>
            <form onSubmit={handleCreateNotification} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-gray-900"
                    placeholder="Enter notification title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Type
                  </label>
                  <select
                    value={notificationForm.type}
                    onChange={(e) => setNotificationForm({ ...notificationForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-gray-900"
                  >
                    <option value="general">General</option>
                    <option value="course">Course</option>
                    <option value="assignment">Assignment</option>
                    <option value="system">System</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  required
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-gray-900"
                  rows={3}
                  placeholder="Enter notification message"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Image URL (optional)
                  </label>
                  <input
                    type="url"
                    value={notificationForm.image_url}
                    onChange={(e) => setNotificationForm({ ...notificationForm, image_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-gray-900"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Priority
                  </label>
                  <select
                    value={notificationForm.priority}
                    onChange={(e) => setNotificationForm({ ...notificationForm, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-gray-900"
                  >
                    <option value={1}>Low</option>
                    <option value={2}>Normal</option>
                    <option value={3}>High</option>
                    <option value={4}>Urgent</option>
                    <option value={5}>Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Link URL (optional)
                  </label>
                  <input
                    type="url"
                    value={notificationForm.link_url}
                    onChange={(e) => setNotificationForm({ ...notificationForm, link_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-gray-900"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Link Label (optional)
                  </label>
                  <input
                    type="text"
                    value={notificationForm.link_label}
                    onChange={(e) => setNotificationForm({ ...notificationForm, link_label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-gray-900"
                    placeholder="View Details"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Recipients
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recipientType"
                      value="all"
                      checked={notificationForm.send_to_all}
                      onChange={() => setNotificationForm({ ...notificationForm, send_to_all: true, recipient_type: 'all' })}
                      className="mr-2"
                    />
                    Send to all users ({users.length})
                  </label>

                  {!notificationForm.send_to_all && (
                    <>
                      <div className="flex gap-4 ml-6">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="recipientType"
                            value="departments"
                            checked={notificationForm.recipient_type === 'departments'}
                            onChange={() => setNotificationForm({ ...notificationForm, send_to_all: false, recipient_type: 'departments' })}
                            className="mr-2"
                          />
                          By Department
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="recipientType"
                            value="users"
                            checked={notificationForm.recipient_type === 'users'}
                            onChange={() => setNotificationForm({ ...notificationForm, send_to_all: false, recipient_type: 'users' })}
                            className="mr-2"
                          />
                          Individual Users
                        </label>
                      </div>

                      {notificationForm.recipient_type === 'departments' && (
                        <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto ml-6">
                          {departments.map((dept) => (
                            <label key={dept} className="flex items-center block">
                              <input
                                type="checkbox"
                                checked={selectedDepartments.includes(dept)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDepartments([...selectedDepartments, dept]);
                                  } else {
                                    setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                                  }
                                }}
                                className="mr-2"
                              />
                              {dept} ({users.filter(u => u.department === dept).length} users)
                            </label>
                          ))}
                        </div>
                      )}

                      {notificationForm.recipient_type === 'users' && (
                        <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto ml-6">
                          {users.map((user) => (
                            <label key={user.id} className="flex items-center block">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUsers([...selectedUsers, user.id]);
                                  } else {
                                    setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                  }
                                }}
                                className="mr-2"
                              />
                              {user.fullname} ({user.email}) - {user.department || 'No Department'}
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Send Notification
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Recent Notifications</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
              <p className="text-gray-500">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-rounded text-5xl text-gray-300 block mb-3">notifications_off</span>
              <p className="text-gray-500">No notifications sent yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(notification.type)}`}>
                          {notification.type}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(notification.priority)}`}>
                          Priority {notification.priority}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{notification.message}</p>

                      {notification.image_url && (
                        <img
                          src={notification.image_url}
                          alt="Notification"
                          className="w-32 h-20 object-cover rounded-lg mb-3"
                        />
                      )}

                      {notification.link_url && (
                        <a
                          href={notification.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-primary hover:underline mb-3"
                        >
                          <span className="material-symbols-rounded text-sm mr-1">link</span>
                          {notification.link_label || 'View Link'}
                        </a>
                      )}

                      <div className="flex items-center text-sm text-gray-500">
                        <span className="material-symbols-rounded text-sm mr-1">schedule</span>
                        {new Date(notification.created_at).toLocaleString()}
                        <span className="mx-2">•</span>
                        <span className="material-symbols-rounded text-sm mr-1">person</span>
                        {(notification as any).profiles?.fullname || 'System'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                      title="Delete notification"
                    >
                      <span className="material-symbols-rounded">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default NotificationsPage;