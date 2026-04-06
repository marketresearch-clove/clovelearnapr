import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import OrganizationHierarchy from '../components/OrganizationHierarchy';

const OrganizationHierarchyPage: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="w-full bg-gray-50 min-h-screen">
            {/* Page Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-8">
                <div className="w-full text-left">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Organization Hierarchy</h1>
                    <p className="text-gray-500 mt-2 text-lg font-medium max-w-2xl">
                        View your position in the organization, your manager, team members, and peers.
                    </p>
                </div>
            </div>

            {/* Hierarchy Content */}
            <div className="bg-gray-50 py-8">
                <OrganizationHierarchy userId={user.id} />
            </div>

            {/* Help Section */}
            <div className="bg-white border-t border-gray-200 px-6 py-8">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 p-6 rounded border border-blue-200">
                            <h3 className="text-lg font-semibold text-blue-900 mb-2">
                                <span className="material-symbols-rounded inline mr-2">info</span>
                                Understanding the Hierarchy
                            </h3>
                            <p className="text-blue-700 text-sm">
                                This page shows your organizational structure including your manager, team members, and peers under the same manager.
                            </p>
                        </div>

                        <div className="bg-green-50 p-6 rounded border border-green-200">
                            <h3 className="text-lg font-semibold text-green-900 mb-2">
                                <span className="material-symbols-rounded inline mr-2">person</span>
                                Your Profile Card
                            </h3>
                            <p className="text-green-700 text-sm">
                                The green highlighted card shows your current position, job title, grade, department, and role in the system.
                            </p>
                        </div>

                        <div className="bg-indigo-50 p-6 rounded border border-indigo-200">
                            <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                                <span className="material-symbols-rounded inline mr-2">group</span>
                                Team & Connectivity
                            </h3>
                            <p className="text-indigo-700 text-sm">
                                Connect with your team members, manager, and peers to collaborate on learning and development activities.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrganizationHierarchyPage;
