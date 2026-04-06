import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import useAuthGuard from '../hooks/useAuthGuard';
import { advancedNotificationService, NotificationAuditLog } from '../lib/advancedNotificationService';
import { supabase } from '../lib/supabaseClient';

interface HistoryStats {
    sent: number;
    viewed: number;
    clicked: number;
    failed: number;
    bounced: number;
}

const NotificationHistoryPage: React.FC = () => {
    const [historyEntries, setHistoryEntries] = useState<any[]>([]);
    const [stats, setStats] = useState<HistoryStats>({
        sent: 0,
        viewed: 0,
        clicked: 0,
        failed: 0,
        bounced: 0,
    });
    const [loading, setLoading] = useState(true);
    const [filterAction, setFilterAction] = useState<string>('');
    const [filterUser, setFilterUser] = useState<string>('');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [paginationPage, setPaginationPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 20;

    useAuthGuard(['admin']);

    useEffect(() => {
        fetchHistory();
    }, [paginationPage, filterAction, filterUser, filterDateFrom, filterDateTo]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const allHistory = await advancedNotificationService.getNotificationHistory(
                undefined,
                filterUser || undefined,
                filterAction || undefined,
                1000
            );

            // Apply date filters
            let filtered = allHistory;
            if (filterDateFrom) {
                const fromDate = new Date(filterDateFrom);
                filtered = filtered.filter(h => new Date(h.created_at) >= fromDate);
            }
            if (filterDateTo) {
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                filtered = filtered.filter(h => new Date(h.created_at) <= toDate);
            }

            // Calculate stats
            const newStats: HistoryStats = {
                sent: 0,
                viewed: 0,
                clicked: 0,
                failed: 0,
                bounced: 0,
            };

            filtered.forEach(entry => {
                if (entry.action in newStats) {
                    newStats[entry.action as keyof HistoryStats]++;
                }
            });

            setStats(newStats);

            // Paginate
            const total = Math.ceil(filtered.length / itemsPerPage);
            setTotalPages(total);
            const start = (paginationPage - 1) * itemsPerPage;
            const paginated = filtered.slice(start, start + itemsPerPage);

            // Fetch user details
            const userIds = [...new Set(paginated.map(h => h.user_id))];
            if (userIds.length > 0) {
                const { data: users } = await supabase
                    .from('profiles')
                    .select('id, fullname, email')
                    .in('id', userIds);

                const usersMap = new Map(users?.map(u => [u.id, u]) || []);
                const enriched = paginated.map(h => ({
                    ...h,
                    user: usersMap.get(h.user_id),
                }));

                setHistoryEntries(enriched);
            } else {
                setHistoryEntries(paginated);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (historyEntries.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = ['Action', 'User', 'Email', 'Date', 'Error Message'];
        const rows = historyEntries.map(entry => [
            entry.action,
            entry.user?.fullname || 'Unknown',
            entry.user?.email || 'N/A',
            new Date(entry.created_at).toLocaleString(),
            entry.error_message || '',
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notification-history-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
        const colors: Record<string, string> = {
            sent: 'bg-green-100 text-green-800',
            viewed: 'bg-blue-100 text-blue-800',
            clicked: 'bg-indigo-100 text-indigo-800',
            failed: 'bg-red-100 text-red-800',
            bounced: 'bg-orange-100 text-orange-800',
        };

        return (
            <span className={`px-3 py-1 text-xs rounded-full font-semibold ${colors[action] || 'bg-gray-100 text-gray-800'}`}>
                {action.charAt(0).toUpperCase() + action.slice(1)}
            </span>
        );
    };

    if (loading) {
        return (
            <AdminLayout title="Notification History">
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">Loading...</div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Notification History">
            <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-sm text-slate-600 mb-2">Sent</div>
                        <div className="text-3xl font-bold text-green-600">{stats.sent}</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-sm text-slate-600 mb-2">Viewed</div>
                        <div className="text-3xl font-bold text-blue-600">{stats.viewed}</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-sm text-slate-600 mb-2">Clicked</div>
                        <div className="text-3xl font-bold text-indigo-600">{stats.clicked}</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-sm text-slate-600 mb-2">Failed</div>
                        <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-sm text-slate-600 mb-2">Bounced</div>
                        <div className="text-3xl font-bold text-orange-600">{stats.bounced}</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
                    <h3 className="font-semibold text-slate-800 mb-4">Filters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <select
                            value={filterAction}
                            onChange={(e) => {
                                setFilterAction(e.target.value);
                                setPaginationPage(1);
                            }}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Actions</option>
                            <option value="sent">Sent</option>
                            <option value="viewed">Viewed</option>
                            <option value="clicked">Clicked</option>
                            <option value="failed">Failed</option>
                            <option value="bounced">Bounced</option>
                        </select>

                        <input
                            type="text"
                            placeholder="Filter by user..."
                            value={filterUser}
                            onChange={(e) => {
                                setFilterUser(e.target.value);
                                setPaginationPage(1);
                            }}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => {
                                setFilterDateFrom(e.target.value);
                                setPaginationPage(1);
                            }}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="From Date"
                        />

                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => {
                                setFilterDateTo(e.target.value);
                                setPaginationPage(1);
                            }}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="To Date"
                        />

                        <button
                            onClick={handleExportCSV}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* History Table */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="px-6 py-4 text-left font-semibold text-slate-700">Action</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-700">User</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-700">Date & Time</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-700">Status</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyEntries.length > 0 ? (
                                    historyEntries.map(entry => (
                                        <tr key={entry.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <ActionBadge action={entry.action} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-800 font-medium">{entry.user?.fullname || 'Unknown'}</div>
                                                <div className="text-xs text-slate-500">{entry.user?.email || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {new Date(entry.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {entry.error_message ? (
                                                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                                        Error
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                                        Success
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedEntry(entry);
                                                        setShowDetailModal(true);
                                                    }}
                                                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                            No notification history found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <div className="text-sm text-slate-600">
                                Page {paginationPage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPaginationPage(prev => Math.max(1, prev - 1))}
                                    disabled={paginationPage === 1}
                                    className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-100 transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPaginationPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={paginationPage === totalPages}
                                    className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-100 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedEntry && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white p-6 border-b border-slate-200 flex justify-between items-start">
                            <h3 className="text-lg font-semibold text-slate-800">Notification Details</h3>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <div className="text-sm text-slate-600 mb-2">Action</div>
                                <div className="text-lg font-semibold text-slate-800">
                                    <ActionBadge action={selectedEntry.action} />
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4">
                                <div className="text-sm text-slate-600 mb-2">User</div>
                                <div>
                                    <div className="font-semibold text-slate-800">{selectedEntry.user?.fullname || 'Unknown'}</div>
                                    <div className="text-sm text-slate-600">{selectedEntry.user?.email || 'N/A'}</div>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4">
                                <div className="text-sm text-slate-600 mb-2">Date & Time</div>
                                <div className="font-semibold text-slate-800">
                                    {new Date(selectedEntry.created_at).toLocaleString()}
                                </div>
                            </div>

                            {selectedEntry.error_message && (
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="text-sm text-slate-600 mb-2">Error Message</div>
                                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                                        {selectedEntry.error_message}
                                    </div>
                                </div>
                            )}

                            {selectedEntry.details && Object.keys(selectedEntry.details).length > 0 && (
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="text-sm text-slate-600 mb-2">Additional Details</div>
                                    <pre className="bg-slate-50 p-3 rounded text-xs overflow-x-auto">
                                        {JSON.stringify(selectedEntry.details, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedEntry.notification_id && (
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="text-sm text-slate-600 mb-2">Notification ID</div>
                                    <div className="font-mono text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                        {selectedEntry.notification_id}
                                    </div>
                                </div>
                            )}

                            {selectedEntry.scheduled_notification_id && (
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="text-sm text-slate-600 mb-2">Scheduled Notification ID</div>
                                    <div className="font-mono text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                        {selectedEntry.scheduled_notification_id}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default NotificationHistoryPage;
