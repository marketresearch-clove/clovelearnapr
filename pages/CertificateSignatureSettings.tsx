import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';
import useAuthGuard from '../hooks/useAuthGuard';
import {
    getAllSignatures,
    CertificateSignature,
    CreateSignatureRequest,
    createSignature,
    updateSignature,
    deleteSignature,
    toggleSignatureStatus,
    reorderSignatures,
    uploadSignatureImage,
    deleteSignatureImage,
} from '../lib/certificateSignatureService';

interface FormData extends CreateSignatureRequest {
    id?: string;
}

const CertificateSignatureSettings: React.FC = () => {
    const [signatures, setSignatures] = useState<CertificateSignature[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [formData, setFormData] = useState<FormData>({
        name: '',
        designation: '',
        signature_text: '',
        signature_image_url: '',
        is_enabled: true,
        display_order: 0,
    });

    // Auth check
    useAuthGuard(['admin']);

    // Load signatures on mount
    useEffect(() => {
        fetchSignatures();
    }, []);

    const fetchSignatures = async () => {
        try {
            setLoading(true);
            const data = await getAllSignatures();
            setSignatures(data);
        } catch (error) {
            console.error('Error loading signatures:', error);
            setErrorMessage('Failed to load signatures');
        } finally {
            setLoading(false);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setImagePreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleEdit = (signature: CertificateSignature) => {
        setEditingId(signature.id);
        setFormData({
            id: signature.id,
            name: signature.name,
            designation: signature.designation,
            signature_text: signature.signature_text || '',
            signature_image_url: signature.signature_image_url || '',
            is_enabled: signature.is_enabled,
            display_order: signature.display_order,
        });
        setImagePreview(signature.signature_image_url || null);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const isEditing = !!editingId;
            let signatureUrl = formData.signature_image_url;

            // Upload image if selected
            if (imageFile) {
                try {
                    signatureUrl = await uploadSignatureImage(imageFile, formData.designation);
                } catch (error) {
                    throw new Error('Failed to upload signature image');
                }
            }

            const payload: CreateSignatureRequest = {
                name: formData.name,
                designation: formData.designation,
                signature_text: formData.signature_text,
                signature_image_url: signatureUrl,
                is_enabled: formData.is_enabled,
                display_order: formData.display_order,
            };

            if (isEditing) {
                await updateSignature({
                    id: editingId,
                    ...payload,
                });
                setSuccessMessage('Signature updated successfully');
            } else {
                await createSignature(payload);
                setSuccessMessage('Signature created successfully');
            }

            // Reset form and reload
            setFormData({
                name: '',
                designation: '',
                signature_text: '',
                signature_image_url: '',
                is_enabled: true,
                display_order: 0,
            });
            setImageFile(null);
            setImagePreview(null);
            setEditingId(null);
            setShowForm(false);
            await fetchSignatures();
        } catch (error) {
            console.error('Error saving signature:', error);
            setErrorMessage(
                error instanceof Error ? error.message : 'Failed to save signature'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, imageUrl?: string) => {
        if (!confirm('Are you sure you want to delete this signature?')) return;

        try {
            if (imageUrl) {
                await deleteSignatureImage(imageUrl);
            }
            await deleteSignature(id);
            setSuccessMessage('Signature deleted successfully');
            await fetchSignatures();
        } catch (error) {
            console.error('Error deleting signature:', error);
            setErrorMessage('Failed to delete signature');
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await toggleSignatureStatus(id, !currentStatus);
            setSuccessMessage(`Signature ${!currentStatus ? 'enabled' : 'disabled'}`);
            await fetchSignatures();
        } catch (error) {
            console.error('Error toggling status:', error);
            setErrorMessage('Failed to update signature status');
        }
    };

    const handleReorder = async (fromIndex: number, toIndex: number) => {
        const newSignatures = [...signatures];
        const [movedSignature] = newSignatures.splice(fromIndex, 1);
        newSignatures.splice(toIndex, 0, movedSignature);

        try {
            const updates = newSignatures.map((sig, index) => ({
                id: sig.id,
                display_order: index,
            }));
            await reorderSignatures(updates);
            setSignatures(newSignatures);
            setSuccessMessage('Order updated successfully');
        } catch (error) {
            console.error('Error reordering:', error);
            setErrorMessage('Failed to reorder signatures');
            // Revert on error
            await fetchSignatures();
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({
            name: '',
            designation: '',
            signature_text: '',
            signature_image_url: '',
            is_enabled: true,
            display_order: 0,
        });
        setImageFile(null);
        setImagePreview(null);
    };

    return (
        <AdminLayout title="Certificate Signature Settings">
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Certificate Signatures
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Manage certificate signature settings and designations
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                handleCancel();
                                setShowForm(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-rounded text-sm">add</span>
                            Add Signature
                        </button>
                    </div>

                    {/* Messages */}
                    {successMessage && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-between">
                            <span>{successMessage}</span>
                            <button
                                onClick={() => setSuccessMessage('')}
                                className="text-green-800"
                            >
                                <span className="material-symbols-rounded text-sm">close</span>
                            </button>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between">
                            <span>{errorMessage}</span>
                            <button
                                onClick={() => setErrorMessage('')}
                                className="text-red-800"
                            >
                                <span className="material-symbols-rounded text-sm">close</span>
                            </button>
                        </div>
                    )}

                    {/* Form Modal */}
                    {showForm && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {editingId ? 'Edit Signature' : 'Add New Signature'}
                                    </h2>
                                    <button
                                        onClick={handleCancel}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <span className="material-symbols-rounded">close</span>
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Signature Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleFormChange}
                                            placeholder="e.g., Sreenath P"
                                            required
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        />
                                    </div>

                                    {/* Designation */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Designation *
                                        </label>
                                        <input
                                            type="text"
                                            name="designation"
                                            value={formData.designation}
                                            onChange={handleFormChange}
                                            placeholder="e.g., HR, COO, Manager"
                                            required
                                            disabled={!!editingId}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">
                                            Cannot be changed after creation
                                        </p>
                                    </div>

                                    {/* Signature Text */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Signature Text
                                        </label>
                                        <input
                                            type="text"
                                            name="signature_text"
                                            value={formData.signature_text}
                                            onChange={handleFormChange}
                                            placeholder="Text representation of signature"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        />
                                    </div>

                                    {/* Image Upload */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Signature Image
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        />
                                        {imagePreview && (
                                            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                                <p className="text-xs text-gray-600 mb-2">Preview:</p>
                                                <img
                                                    src={imagePreview}
                                                    alt="Signature preview"
                                                    className="max-h-24 max-w-full"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Order */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Display Order
                                        </label>
                                        <input
                                            type="number"
                                            name="display_order"
                                            value={formData.display_order}
                                            onChange={handleFormChange}
                                            min="0"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">
                                            Lower numbers appear first on certificates
                                        </p>
                                    </div>

                                    {/* Enabled Toggle */}
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            name="is_enabled"
                                            id="is_enabled"
                                            checked={formData.is_enabled}
                                            onChange={handleFormChange}
                                            className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
                                        />
                                        <label htmlFor="is_enabled" className="text-sm font-medium text-gray-700">
                                            Enable this signature for certificates
                                        </label>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {submitting && <span className="material-symbols-rounded animate-spin">loading</span>}
                                            {editingId ? 'Update' : 'Create'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Signatures Table */}
                    <div className="bg-white rounded-lg shadow">
                        {loading ? (
                            <div className="text-center py-16 text-gray-600">
                                <span className="material-symbols-rounded text-4xl animate-spin block mb-3">sync</span>
                                Loading signatures...
                            </div>
                        ) : signatures.length === 0 ? (
                            <div className="p-8 text-center text-gray-600">
                                <p>No signatures configured yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-blue-100 border-b border-blue-300">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Order
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Designation
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Image
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {signatures.map((signature, index) => (
                                            <tr
                                                key={signature.id}
                                                className="hover:bg-gray-100 transition-colors"
                                            >
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    <div className="flex items-center gap-2">
                                                        {index > 0 && (
                                                            <button
                                                                onClick={() => handleReorder(index, index - 1)}
                                                                className="p-1 hover:bg-gray-300 rounded"
                                                            >
                                                                <span className="material-symbols-rounded text-base">
                                                                    arrow_upward
                                                                </span>
                                                            </button>
                                                        )}
                                                        {index < signatures.length - 1 && (
                                                            <button
                                                                onClick={() => handleReorder(index, index + 1)}
                                                                className="p-1 hover:bg-gray-300 rounded"
                                                            >
                                                                <span className="material-symbols-rounded text-base">
                                                                    arrow_downward
                                                                </span>
                                                            </button>
                                                        )}
                                                        <span className="ml-2">{index + 1}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                    {signature.name}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                        {signature.designation}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {signature.signature_image_url ? (
                                                        <div className="flex items-center gap-2">
                                                            <img
                                                                src={signature.signature_image_url}
                                                                alt={signature.designation}
                                                                className="h-8 max-w-[100px]"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <button
                                                        onClick={() =>
                                                            handleToggleStatus(signature.id, signature.is_enabled)
                                                        }
                                                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${signature.is_enabled
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-700'
                                                            }`}
                                                    >
                                                        {signature.is_enabled ? 'Enabled' : 'Disabled'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(signature)}
                                                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                        >
                                                            <span className="material-symbols-rounded text-base">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleDelete(signature.id, signature.signature_image_url)
                                                            }
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <span className="material-symbols-rounded text-base">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                        <div className="flex gap-3">
                            <span className="material-symbols-rounded text-blue-700 flex-shrink-0">
                                info
                            </span>
                            <div className="text-sm text-blue-900">
                                <p className="font-medium mb-1">Managing Certificate Signatures</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Add signatures for different designations (HR, COO, Manager, etc.)</li>
                                    <li>Enable/disable signatures to control which ones appear on certificates</li>
                                    <li>Upload signature images or use text representations</li>
                                    <li>Reorder signatures to control their appearance order on certificates</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default CertificateSignatureSettings;
