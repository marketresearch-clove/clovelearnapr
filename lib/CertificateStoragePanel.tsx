/**
 * Enhanced Certificate Signature Settings with Storage Management
 * 
 * Additions to integrate certificate storage cleanup:
 * - View storage usage statistics
 * - Identify orphaned images
 * - Delete unused images
 * - Bulk deletion of unused files
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface StorageStats {
    totalImages: number;
    totalSize: number;
    inUseImages: number;
    orphanedImages: number;
    orphanedSize: number;
}

interface ImageUsageStatus {
    path: string;
    name: string;
    inUse: boolean;
    usedBy?: string[];
    size: number;
    created_at: string;
}

/**
 * Certificate Storage Management Panel
 * Add this component to CertificateSignatureSettings.tsx
 */
export const CertificateStoragePanel: React.FC = () => {
    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [orphanedImages, setOrphanedImages] = useState<ImageUsageStatus[]>([]);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState('');

    // Load storage stats on mount
    useEffect(() => {
        loadStorageStats();
    }, []);

    const loadStorageStats = async () => {
        try {
            setLoading(true);
            setMessage('');

            // Call backend API to get storage stats
            const response = await fetch('/api/certificate-storage/stats', {
                headers: {
                    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to load storage stats');

            const stats = await response.json();
            setStorageStats(stats.stats);
            setOrphanedImages(stats.orphaned || []);
        } catch (error) {
            console.error('Error loading storage stats:', error);
            setMessage('Failed to load storage information');
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const toggleImageSelection = (imageName: string) => {
        const newSelected = new Set(selectedImages);
        if (newSelected.has(imageName)) {
            newSelected.delete(imageName);
        } else {
            newSelected.add(imageName);
        }
        setSelectedImages(newSelected);
    };

    const selectAllOrphaned = () => {
        if (selectedImages.size === orphanedImages.length) {
            setSelectedImages(new Set());
        } else {
            setSelectedImages(new Set(orphanedImages.map(img => img.name)));
        }
    };

    const deleteSelectedImages = async () => {
        if (selectedImages.size === 0) {
            setMessage('No images selected');
            return;
        }

        if (!confirm(`Delete ${selectedImages.size} image(s)?`)) return;

        try {
            setDeleting(true);
            setMessage('');

            const response = await fetch('/api/certificate-storage/delete-bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({
                    imageNames: Array.from(selectedImages),
                }),
            });

            if (!response.ok) throw new Error('Failed to delete images');

            const result = await response.json();
            setMessage(
                `Successfully deleted ${result.success} image(s). ${result.failed > 0 ? `Failed: ${result.failed}` : ''}`
            );
            setSelectedImages(new Set());
            await loadStorageStats();
        } catch (error) {
            console.error('Error deleting images:', error);
            setMessage('Failed to delete images');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Storage Management
                </h3>

                {message && (
                    <div className={`p-4 rounded-lg mb-4 ${message.includes('Success') || message.includes('successfully')
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                        {message}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-8 text-gray-600">
                        <span className="material-symbols-rounded animate-spin block mb-2">
                            sync
                        </span>
                        Loading storage information...
                    </div>
                ) : !storageStats ? (
                    <div className="text-center py-8 text-gray-600">
                        Unable to load storage information
                    </div>
                ) : (
                    <>
                        {/* Storage Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <div className="text-sm text-blue-700 font-medium">
                                    Total Images
                                </div>
                                <div className="text-2xl font-bold text-blue-900">
                                    {storageStats.totalImages}
                                </div>
                            </div>

                            <div className="bg-purple-50 p-4 rounded-lg">
                                <div className="text-sm text-purple-700 font-medium">
                                    Storage Used
                                </div>
                                <div className="text-2xl font-bold text-purple-900">
                                    {formatBytes(storageStats.totalSize)}
                                </div>
                            </div>

                            <div className="bg-green-50 p-4 rounded-lg">
                                <div className="text-sm text-green-700 font-medium">
                                    In Use
                                </div>
                                <div className="text-2xl font-bold text-green-900">
                                    {storageStats.inUseImages}
                                </div>
                            </div>

                            <div className="bg-red-50 p-4 rounded-lg">
                                <div className="text-sm text-red-700 font-medium">
                                    Orphaned
                                </div>
                                <div className="text-2xl font-bold text-red-900">
                                    {storageStats.orphanedImages}
                                </div>
                                <div className="text-xs text-red-600 mt-1">
                                    {formatBytes(storageStats.orphanedSize)}
                                </div>
                            </div>
                        </div>

                        {/* Orphaned Images Section */}
                        {storageStats.orphanedImages > 0 && (
                            <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-semibold text-red-900">
                                            Unused Images Found
                                        </h4>
                                        <p className="text-sm text-red-700 mt-1">
                                            {storageStats.orphanedImages} image(s) not used by any
                                            certificate or rule
                                        </p>
                                    </div>
                                    <button
                                        onClick={selectAllOrphaned}
                                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        {selectedImages.size === orphanedImages.length
                                            ? 'Deselect All'
                                            : 'Select All'}
                                    </button>
                                </div>

                                {/* Orphaned Images List */}
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {orphanedImages.map((img) => (
                                        <div
                                            key={img.name}
                                            className="flex items-center gap-3 p-3 bg-white rounded border border-red-200 hover:bg-red-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedImages.has(img.name)}
                                                onChange={() => toggleImageSelection(img.name)}
                                                className="w-4 h-4 rounded"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {img.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {formatBytes(img.size)} •{' '}
                                                    {new Date(img.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Delete Button */}
                                {selectedImages.size > 0 && (
                                    <button
                                        onClick={deleteSelectedImages}
                                        disabled={deleting}
                                        className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {deleting ? (
                                            <>
                                                <span className="material-symbols-rounded text-sm animate-spin">
                                                    sync
                                                </span>
                                                Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-rounded text-sm">
                                                    delete
                                                </span>
                                                Delete Selected ({selectedImages.size})
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}

                        {storageStats.orphanedImages === 0 && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-rounded">check_circle</span>
                                    All images are in use. No cleanup needed!
                                </div>
                            </div>
                        )}

                        {/* Refresh Button */}
                        <button
                            onClick={loadStorageStats}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 disabled:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-rounded text-sm">
                                refresh
                            </span>
                            Refresh Stats
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default CertificateStoragePanel;
