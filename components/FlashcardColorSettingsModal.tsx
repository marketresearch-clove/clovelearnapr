import React, { useState, useEffect } from 'react';
import { flashcardColorService, FlashcardColorSettings } from '../lib/flashcardColorService';
import { useAuth } from '../contexts/AuthContext';

interface FlashcardColorSettingsModalProps {
    courseId: string;
    courseName: string;
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void;
}

const PRESET_GRADIENTS = [
    { label: 'Blue', start: '#3498db', end: '#2980b9' },
    { label: 'Green', start: '#2ecc71', end: '#27ae60' },
    { label: 'Purple', start: '#9b59b6', end: '#8e44ad' },
    { label: 'Red', start: '#e74c3c', end: '#c0392b' },
    { label: 'Orange', start: '#f39c12', end: '#d68910' },
    { label: 'Teal', start: '#1abc9c', end: '#16a085' },
    { label: 'Pink', start: '#ff69b4', end: '#ff1493' },
    { label: 'Indigo', start: '#6c5ce7', end: '#5f3dc4' },
];

const FlashcardColorSettingsModal: React.FC<FlashcardColorSettingsModalProps> = ({
    courseId,
    courseName,
    isOpen,
    onClose,
    onSave,
}) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<FlashcardColorSettings>({
        course_id: courseId,
        card_front_gradient_start: '#3498db',
        card_front_gradient_end: '#2980b9',
        card_back_gradient_start: '#2ecc71',
        card_back_gradient_end: '#27ae60',
        flip_icon_color: '#ffffff',
        apply_to_all: false,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const existing = await flashcardColorService.getColorSettings(courseId);
            if (existing) {
                setSettings(existing);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const handleSaveSettings = async (applyToAll: boolean) => {
        if (!user?.id) {
            setMessage('You must be logged in to save settings');
            return;
        }

        setIsLoading(true);
        try {
            const newSettings: FlashcardColorSettings = {
                ...settings,
                instructor_id: user.id,
                apply_to_all: applyToAll,
            };

            await flashcardColorService.saveColorSettings(newSettings);
            setMessage(applyToAll ? 'Settings applied to all courses!' : 'Settings applied to this course!');

            setTimeout(() => {
                setMessage('');
                onSave?.();
                onClose();
            }, 2000);
        } catch (error) {
            setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to save settings'}`);
            console.error('Error saving settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Flashcard Color Settings</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{courseName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {message && (
                        <div className={`p-4 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {message}
                        </div>
                    )}

                    {/* Card Front Gradient */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Card Front Gradient</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={settings.card_front_gradient_start}
                                        onChange={(e) => setSettings({ ...settings, card_front_gradient_start: e.target.value })}
                                        className="w-20 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={settings.card_front_gradient_start}
                                        onChange={(e) => setSettings({ ...settings, card_front_gradient_start: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={settings.card_front_gradient_end}
                                        onChange={(e) => setSettings({ ...settings, card_front_gradient_end: e.target.value })}
                                        className="w-20 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={settings.card_front_gradient_end}
                                        onChange={(e) => setSettings({ ...settings, card_front_gradient_end: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preset Front Gradients */}
                        <div className="grid grid-cols-4 gap-2">
                            {PRESET_GRADIENTS.map((preset) => (
                                <button
                                    key={`front-${preset.label}`}
                                    onClick={() =>
                                        setSettings({
                                            ...settings,
                                            card_front_gradient_start: preset.start,
                                            card_front_gradient_end: preset.end,
                                        })
                                    }
                                    className="p-3 rounded-lg hover:ring-2 ring-primary transition-all"
                                    style={{
                                        background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)`,
                                    }}
                                    title={preset.label}
                                />
                            ))}
                        </div>

                        {/* Preview */}
                        <div
                            className="mt-4 h-40 rounded-lg shadow-md flex items-center justify-center text-white font-semibold"
                            style={{
                                background: `linear-gradient(135deg, ${settings.card_front_gradient_start} 0%, ${settings.card_front_gradient_end} 100%)`,
                            }}
                        >
                            Front Preview
                        </div>
                    </div>

                    {/* Card Back Gradient */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Card Back Gradient</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={settings.card_back_gradient_start}
                                        onChange={(e) => setSettings({ ...settings, card_back_gradient_start: e.target.value })}
                                        className="w-20 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={settings.card_back_gradient_start}
                                        onChange={(e) => setSettings({ ...settings, card_back_gradient_start: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={settings.card_back_gradient_end}
                                        onChange={(e) => setSettings({ ...settings, card_back_gradient_end: e.target.value })}
                                        className="w-20 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={settings.card_back_gradient_end}
                                        onChange={(e) => setSettings({ ...settings, card_back_gradient_end: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preset Back Gradients */}
                        <div className="grid grid-cols-4 gap-2">
                            {PRESET_GRADIENTS.map((preset) => (
                                <button
                                    key={`back-${preset.label}`}
                                    onClick={() =>
                                        setSettings({
                                            ...settings,
                                            card_back_gradient_start: preset.start,
                                            card_back_gradient_end: preset.end,
                                        })
                                    }
                                    className="p-3 rounded-lg hover:ring-2 ring-primary transition-all"
                                    style={{
                                        background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)`,
                                    }}
                                    title={preset.label}
                                />
                            ))}
                        </div>

                        {/* Preview */}
                        <div
                            className="mt-4 h-40 rounded-lg shadow-md flex items-center justify-center text-white font-semibold"
                            style={{
                                background: `linear-gradient(135deg, ${settings.card_back_gradient_start} 0%, ${settings.card_back_gradient_end} 100%)`,
                            }}
                        >
                            Back Preview
                        </div>
                    </div>

                    {/* Flip Icon Color */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Flip Icon Color</h3>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={settings.flip_icon_color}
                                onChange={(e) => setSettings({ ...settings, flip_icon_color: e.target.value })}
                                className="w-20 h-10 rounded cursor-pointer"
                            />
                            <input
                                type="text"
                                value={settings.flip_icon_color}
                                onChange={(e) => setSettings({ ...settings, flip_icon_color: e.target.value })}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => handleSaveSettings(false)}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors"
                        >
                            {isLoading ? 'Saving...' : 'Apply to This Course'}
                        </button>
                        <button
                            onClick={() => handleSaveSettings(true)}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
                            title="Apply to all old and new flashcards across all courses"
                        >
                            {isLoading ? 'Saving...' : '✓ Apply to All'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlashcardColorSettingsModal;
