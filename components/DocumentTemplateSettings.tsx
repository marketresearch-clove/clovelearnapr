import React, { useState, useRef } from 'react';

interface TemplateSettings {
    letterheadHeight: number; // in mm
    topMargin: number;
    bottomMargin: number;
    leftMargin: number;
    rightMargin: number;
    headerFontSize: number;
    bodyFontSize: number;
    dividerColor: string;
    accentColor: string;
    showCompanyName: boolean;
    companyName: string;
}

interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface LetterheadTemplate {
    imageData: string; // base64
    cropArea: CropArea;
    settings: TemplateSettings;
    createdAt: string;
    name: string;
}

interface DocumentTemplateSettingsProps {
    onSave: (template: LetterheadTemplate) => void;
    onClose: () => void;
    initialTemplate?: LetterheadTemplate;
}

const DEFAULT_SETTINGS: TemplateSettings = {
    letterheadHeight: 80,
    topMargin: 25.4,
    bottomMargin: 25.4,
    leftMargin: 25.4,
    rightMargin: 25.4,
    headerFontSize: 18,
    bodyFontSize: 12,
    dividerColor: '#333333',
    accentColor: '#0066cc',
    showCompanyName: true,
    companyName: 'Company Name',
};

const DocumentTemplateSettings: React.FC<DocumentTemplateSettingsProps> = ({
    onSave,
    onClose,
    initialTemplate,
}) => {
    const [templateName, setTemplateName] = useState(initialTemplate?.name || 'Default Template');
    const [letterheadImage, setLetterheadImage] = useState<string | null>(
        initialTemplate?.imageData || null
    );
    const [cropArea, setCropArea] = useState<CropArea>(
        initialTemplate?.cropArea || { x: 0, y: 0, width: 100, height: 100 }
    );
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [settings, setSettings] = useState<TemplateSettings>(
        initialTemplate?.settings || DEFAULT_SETTINGS
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageData = event.target?.result as string;
                setLetterheadImage(imageData);
                // Reset crop area to full image
                setCropArea({ x: 0, y: 0, width: 100, height: 100 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setIsDragging(true);
        setDragStart({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = ((currentX - dragStart.x) / rect.width) * 100;
        const height = ((currentY - dragStart.y) / rect.height) * 100;

        if (width > 0 && height > 0) {
            setCropArea({
                x: (dragStart.x / rect.width) * 100,
                y: (dragStart.y / rect.height) * 100,
                width: Math.min(width, 100),
                height: Math.min(height, 100),
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleSaveTemplate = () => {
        if (!letterheadImage) {
            alert('Please upload a letterhead image first');
            return;
        }

        const template: LetterheadTemplate = {
            imageData: letterheadImage,
            cropArea,
            settings,
            createdAt: new Date().toISOString(),
            name: templateName,
        };

        // Save to localStorage
        const templates = JSON.parse(localStorage.getItem('ackTemplates') || '[]');
        const existingIndex = templates.findIndex(
            (t: LetterheadTemplate) => t.name === templateName
        );

        if (existingIndex >= 0) {
            templates[existingIndex] = template;
        } else {
            templates.push(template);
        }

        localStorage.setItem('ackTemplates', JSON.stringify(templates));
        onSave(template);
    };

    return (
        <div className="space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 pb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-rounded">settings</span>
                    Document Template Settings
                </h2>
                <p className="text-sm text-slate-600 mt-1">Customize your acknowledgement document layout and appearance</p>
            </div>

            {/* Template Name */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Template Name</label>
                <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="e.g., Company Standard Template"
                />
            </div>

            {/* Letterhead Upload & Crop */}
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-rounded">image</span>
                    Letterhead Template
                </h3>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors mb-4"
                >
                    <span className="material-symbols-rounded">upload_file</span>
                    Upload Letterhead Image
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                />

                {letterheadImage && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-medium text-slate-700 mb-2">Select Area to Use</p>
                            <p className="text-xs text-slate-600 mb-3">
                                Click and drag on the image to select the part you want to include in the document
                            </p>

                            {/* Canvas for image selection */}
                            <div
                                ref={containerRef}
                                className="relative border-2 border-dashed border-blue-400 rounded-lg overflow-hidden bg-white"
                                style={{ maxWidth: '100%', maxHeight: '300px' }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    className="cursor-crosshair w-full h-auto block"
                                    style={{
                                        backgroundImage: `url(${letterheadImage})`,
                                        backgroundSize: 'contain',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'center',
                                    }}
                                />

                                {/* Crop indicator */}
                                <div
                                    className="absolute border-2 border-green-500 bg-green-100/20 pointer-events-none mix-blend-multiply"
                                    style={{
                                        left: `${cropArea.x}%`,
                                        top: `${cropArea.y}%`,
                                        width: `${cropArea.width}%`,
                                        height: `${cropArea.height}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Preview */}
                        <div>
                            <p className="text-sm font-medium text-slate-700 mb-2">Preview (In Document)</p>
                            <div
                                className="border border-slate-300 rounded-lg p-4 bg-white max-h-24 overflow-hidden"
                                style={{
                                    backgroundImage: `url(${letterheadImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: `${cropArea.x}% ${cropArea.y}%`,
                                    backgroundClip: 'content-box',
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Layout Settings */}
            <div className="border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-rounded">layout</span>
                    Layout & Margins
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-2">
                            Letterhead Height (mm)
                        </label>
                        <input
                            type="number"
                            min="20"
                            max="150"
                            value={settings.letterheadHeight}
                            onChange={(e) =>
                                setSettings({ ...settings, letterheadHeight: parseFloat(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-2">
                            Header Font Size (pt)
                        </label>
                        <input
                            type="number"
                            min="12"
                            max="28"
                            value={settings.headerFontSize}
                            onChange={(e) =>
                                setSettings({ ...settings, headerFontSize: parseFloat(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-2">
                            Top/Bottom Margin (mm)
                        </label>
                        <input
                            type="number"
                            min="10"
                            max="50"
                            value={settings.topMargin}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({ ...settings, topMargin: val, bottomMargin: val });
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-2">
                            Left/Right Margin (mm)
                        </label>
                        <input
                            type="number"
                            min="10"
                            max="50"
                            value={settings.leftMargin}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({ ...settings, leftMargin: val, rightMargin: val });
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>
                </div>
            </div>

            {/* Style Settings */}
            <div className="border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-rounded">palette</span>
                    Colors & Styling
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-2">
                            Divider Color
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={settings.dividerColor}
                                onChange={(e) =>
                                    setSettings({ ...settings, dividerColor: e.target.value })
                                }
                                className="w-12 h-10 rounded-lg border border-slate-300 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={settings.dividerColor}
                                onChange={(e) =>
                                    setSettings({ ...settings, dividerColor: e.target.value })
                                }
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-2">
                            Accent Color (Policy Border)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={settings.accentColor}
                                onChange={(e) =>
                                    setSettings({ ...settings, accentColor: e.target.value })
                                }
                                className="w-12 h-10 rounded-lg border border-slate-300 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={settings.accentColor}
                                onChange={(e) =>
                                    setSettings({ ...settings, accentColor: e.target.value })
                                }
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Company Info */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.showCompanyName}
                            onChange={(e) =>
                                setSettings({ ...settings, showCompanyName: e.target.checked })
                            }
                            className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        <span className="text-sm font-medium text-slate-700">Include Company Name</span>
                    </label>

                    {settings.showCompanyName && (
                        <div className="mt-3">
                            <label className="text-sm font-medium text-slate-700 block mb-2">
                                Company Name
                            </label>
                            <input
                                type="text"
                                value={settings.companyName}
                                onChange={(e) =>
                                    setSettings({ ...settings, companyName: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="Enter your company name"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Body Font Size */}
            <div className="border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-4">Typography</h3>
                <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                        Body Font Size (pt)
                    </label>
                    <input
                        type="number"
                        min="10"
                        max="14"
                        value={settings.bodyFontSize}
                        onChange={(e) =>
                            setSettings({ ...settings, bodyFontSize: parseFloat(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 pt-4 flex gap-3 justify-end">
                <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSaveTemplate}
                    className="px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium inline-flex items-center gap-2"
                >
                    <span className="material-symbols-rounded text-base">save</span>
                    Save Template
                </button>
            </div>
        </div>
    );
};

export default DocumentTemplateSettings;
