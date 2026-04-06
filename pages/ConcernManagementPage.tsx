import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import AdminLayout from '../components/AdminLayout';
import { FiSearch, FiFilter, FiCheckCircle, FiClock, FiAlertCircle, FiEye, FiMessageSquare } from 'react-icons/fi';

interface Concern {
    id: string;
    user_id: string;
    full_name: string;
    user_email: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    updated_at: string;
    admin_notes?: string;
    resolved_at?: string;
}

const ConcernManagementPage = () => {
    const [concerns, setConcerns] = useState<Concern[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedConcern, setSelectedConcern] = useState<Concern | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [adminNotes, setAdminNotes] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchConcerns();
    }, []);

    const fetchConcerns = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('concerns_tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setConcerns(data || []);
        } catch (err) {
            console.error('Error fetching concerns:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (concernId: string, newStatus: string) => {
        try {
            setUpdatingStatus(true);
            const { error } = await supabase
                .from('concerns_tickets')
                .update({
                    status: newStatus,
                    resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
                    admin_notes: adminNotes,
                })
                .eq('id', concernId);

            if (error) throw error;

            // Update local state
            setConcerns((prev) =>
                prev.map((c) =>
                    c.id === concernId
                        ? {
                            ...c,
                            status: newStatus,
                            admin_notes: adminNotes,
                            resolved_at: newStatus === 'resolved' ? new Date().toISOString() : undefined,
                        }
                        : c
                )
            );

            if (selectedConcern?.id === concernId) {
                setSelectedConcern({
                    ...selectedConcern,
                    status: newStatus,
                    admin_notes: adminNotes,
                });
            }

            setShowDetailModal(false);
            setAdminNotes('');
        } catch (err) {
            console.error('Error updating concern:', err);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const getStatusColor = (status: string) => {
        const colors: { [key: string]: string } = {
            open: 'bg-blue-100 text-blue-800 border-blue-300',
            'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
            resolved: 'bg-green-100 text-green-800 border-green-300',
            closed: 'bg-slate-100 text-slate-800 border-slate-300',
        };
        return colors[status] || 'bg-slate-100 text-slate-800';
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'open':
                return <FiAlertCircle size={16} />;
            case 'in-progress':
                return <FiClock size={16} />;
            case 'resolved':
                return <FiCheckCircle size={16} />;
            default:
                return null;
        }
    };

    const getCategoryLabel = (category: string) => {
        const labels: { [key: string]: string } = {
            'course-request': 'Course Request',
            issue: 'Report Issue',
            query: 'General Query',
            feedback: 'Feedback',
            other: 'Other',
        };
        return labels[category] || category;
    };

    // Filter concerns
    const filteredConcerns = concerns.filter((concern) => {
        const matchesSearch =
            concern.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            concern.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            concern.user_email.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || concern.status === statusFilter;
        const matchesCategory = categoryFilter === 'all' || concern.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesCategory;
    });

    // Pagination
    const totalPages = Math.ceil(filteredConcerns.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedConcerns = filteredConcerns.slice(startIndex, startIndex + itemsPerPage);

    return (
        <AdminLayout title="Concern Management">
            <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Total Concerns</p>
                        <p className="text-2xl font-bold text-slate-900">{concerns.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Open</p>
                        <p className="text-2xl font-bold text-blue-600">{concerns.filter((c) => c.status === 'open').length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">In Progress</p>
                        <p className="text-2xl font-bold text-yellow-600">{concerns.filter((c) => c.status === 'in-progress').length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Resolved</p>
                        <p className="text-2xl font-bold text-green-600">{concerns.filter((c) => c.status === 'resolved').length}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <FiSearch size={20} className="text-slate-400" />
                        <h3 className="font-semibold text-slate-900">Filters & Search</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search by name, email, or subject..."
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                            >
                                <option value="all">All Status</option>
                                <option value="open">Open</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => {
                                    setCategoryFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                            >
                                <option value="all">All Categories</option>
                                <option value="course-request">Course Request</option>
                                <option value="issue">Report Issue</option>
                                <option value="query">General Query</option>
                                <option value="feedback">Feedback</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                            <p className="text-slate-600">Loading concerns...</p>
                        </div>
                    ) : paginatedConcerns.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <FiMessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No concerns found</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Subject</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {paginatedConcerns.map((concern) => (
                                            <tr key={concern.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-slate-900 truncate max-w-xs">{concern.subject}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-slate-900">{concern.full_name}</p>
                                                    <p className="text-xs text-slate-500">{concern.user_email}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                        {getCategoryLabel(concern.category)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${getStatusColor(
                                                            concern.status
                                                        )}`}
                                                    >
                                                        {getStatusIcon(concern.status)}
                                                        {concern.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {new Date(concern.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedConcern(concern);
                                                            setAdminNotes(concern.admin_notes || '');
                                                            setShowDetailModal(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-700 font-semibold text-sm inline-flex items-center gap-1"
                                                    >
                                                        <FiEye size={16} />
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                                    <p className="text-sm text-slate-600">
                                        Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredConcerns.length)} of{' '}
                                        {filteredConcerns.length}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`px-3 py-2 text-sm font-semibold rounded-lg ${currentPage === page
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedConcern &&
                ReactDOM.createPortal(
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
                            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-slate-200 p-6">
                                <h2 className="text-xl font-bold text-slate-900">Concern Details</h2>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* User Info */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-600 uppercase mb-3">User Information</h3>
                                    <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                                        <p className="text-slate-900">
                                            <span className="font-semibold">Name:</span> {selectedConcern.full_name}
                                        </p>
                                        <p className="text-slate-900">
                                            <span className="font-semibold">Email:</span> {selectedConcern.user_email}
                                        </p>
                                    </div>
                                </div>

                                {/* Concern Content */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-600 uppercase mb-3">Concern Details</h3>
                                    <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-1">Category</p>
                                            <p className="text-slate-900 font-medium">{getCategoryLabel(selectedConcern.category)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-1">Subject</p>
                                            <p className="text-slate-900 font-medium">{selectedConcern.subject}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-1">Description</p>
                                            <p className="text-slate-700 whitespace-pre-wrap">{selectedConcern.description}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Dates */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold mb-2">Current Status</p>
                                        <span
                                            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full border ${getStatusColor(
                                                selectedConcern.status
                                            )}`}
                                        >
                                            {getStatusIcon(selectedConcern.status)}
                                            {selectedConcern.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold mb-2">Submitted</p>
                                        <p className="text-slate-900">{new Date(selectedConcern.created_at).toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Admin Notes */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Admin Notes</label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="Add internal notes about this concern..."
                                        rows={4}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                                        disabled={updatingStatus}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleStatusUpdate(selectedConcern.id, 'open')}
                                            disabled={updatingStatus || selectedConcern.status === 'open'}
                                            className="flex-1 bg-blue-100 hover:bg-blue-200 disabled:bg-slate-100 text-blue-800 disabled:text-slate-600 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                        >
                                            Mark as Open
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedConcern.id, 'in-progress')}
                                            disabled={updatingStatus || selectedConcern.status === 'in-progress'}
                                            className="flex-1 bg-yellow-100 hover:bg-yellow-200 disabled:bg-slate-100 text-yellow-800 disabled:text-slate-600 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                        >
                                            In Progress
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedConcern.id, 'resolved')}
                                            disabled={updatingStatus || selectedConcern.status === 'resolved'}
                                            className="flex-1 bg-green-100 hover:bg-green-200 disabled:bg-slate-100 text-green-800 disabled:text-slate-600 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                        >
                                            Resolved
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </AdminLayout>
    );
};

export default ConcernManagementPage;
