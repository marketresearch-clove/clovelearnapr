import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import DocumentTemplateSettings from './DocumentTemplateSettings';

interface LetterheadTemplate {
    imageData: string;
    cropArea: { x: number; y: number; width: number; height: number };
    settings: any;
    createdAt: string;
    name: string;
}

interface AcknowledgementDocumentProps {
    lessonId: string;
    courseId: string;
    policyTitle: string;
    policyContent: string;
    userFullName: string;
    signature: string;
    acknowledgedAt: string;
    onClose?: () => void;
}

const AcknowledgementDocumentPrinter: React.FC<AcknowledgementDocumentProps> = ({
    lessonId,
    courseId,
    policyTitle,
    policyContent,
    userFullName,
    signature,
    acknowledgedAt,
    onClose,
}) => {
    const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
    const [letterheadPreview, setLetterheadPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showTemplateSettings, setShowTemplateSettings] = useState(false);
    const [savedTemplates, setSavedTemplates] = useState<LetterheadTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<LetterheadTemplate | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load saved templates on mount
    React.useEffect(() => {
        const templates = JSON.parse(localStorage.getItem('ackTemplates') || '[]');
        setSavedTemplates(templates);
        if (templates.length > 0) {
            setSelectedTemplate(templates[0]);
            setLetterheadPreview(templates[0].imageData);
        }
    }, []);

    const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLetterheadFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setLetterheadPreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePrint = () => {
        if (printRef.current) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printRef.current.innerHTML);
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    const handleDownloadPDF = async () => {
        try {
            if (printRef.current) {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(printRef.current.innerHTML);
                    printWindow.document.close();
                    // Use browser's print dialog with "Save as PDF" option
                    setTimeout(() => {
                        printWindow.print();
                    }, 250);
                }
            }
        } catch (error) {
            console.error('Error preparing PDF:', error);
            alert('Failed to prepare PDF. Please try again.');
        }
    };

    const dateFormatted = new Date(acknowledgedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const handleTemplateSaved = (template: LetterheadTemplate) => {
        const templates = JSON.parse(localStorage.getItem('ackTemplates') || '[]');
        const existingIndex = templates.findIndex((t: LetterheadTemplate) => t.name === template.name);

        if (existingIndex >= 0) {
            templates[existingIndex] = template;
        } else {
            templates.push(template);
        }

        localStorage.setItem('ackTemplates', JSON.stringify(templates));
        setSavedTemplates(templates);
        setSelectedTemplate(template);
        setLetterheadPreview(template.imageData);
        setShowTemplateSettings(false);
    };

    if (showTemplateSettings) {
        return (
            <div className="space-y-6">
                <DocumentTemplateSettings
                    onSave={handleTemplateSaved}
                    onClose={() => setShowTemplateSettings(false)}
                    initialTemplate={selectedTemplate || undefined}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Quick Letterhead Upload Section */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
                <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2 text-lg">
                    <span className="material-symbols-rounded text-blue-600 text-2xl">upload</span>
                    Upload Letterhead Image
                </h3>
                <p className="text-sm text-blue-800 mb-4">
                    Upload your company letterhead image (PNG, JPG, PDF). This will appear at the top of the acknowledgement document.
                </p>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium mb-4"
                >
                    <span className="material-symbols-rounded text-xl">image</span>
                    Choose Letterhead Image
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleLetterheadUpload}
                    className="hidden"
                    aria-label="Upload letterhead image"
                />

                {/* Letterhead Preview */}
                {letterheadPreview && (
                    <div className="mt-4 space-y-3">
                        <div className="bg-white rounded-lg border border-blue-200 p-4">
                            <p className="text-sm font-medium text-blue-900 mb-3">Preview:</p>
                            <div className="max-h-48 overflow-auto flex items-center justify-center bg-gray-100 rounded-lg">
                                <img
                                    src={letterheadPreview}
                                    alt="Letterhead Preview"
                                    className="max-w-full h-auto"
                                    style={{ maxHeight: '200px' }}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setLetterheadPreview(null);
                                    setLetterheadFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
                            >
                                Remove Image
                            </button>
                            <button
                                onClick={() => setShowTemplateSettings(true)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                            >
                                Advanced Settings
                            </button>
                        </div>
                    </div>
                )}

                {!letterheadPreview && (
                    <div className="bg-white rounded-lg border border-dashed border-blue-300 p-6 text-center">
                        <span className="material-symbols-rounded text-4xl text-blue-300 block mb-3">image_not_supported</span>
                        <p className="text-sm text-slate-600">No image uploaded yet</p>
                        <p className="text-xs text-slate-500 mt-1">Recommended: A4-sized image (210mm × 297mm)</p>
                    </div>
                )}
            </div>

            {/* Advanced Template Management Section */}
            {savedTemplates.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
                    <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                        <span className="material-symbols-rounded text-indigo-600">collections_bookmark</span>
                        Saved Templates
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {savedTemplates.map((template) => (
                            <button
                                key={template.name}
                                onClick={() => {
                                    setSelectedTemplate(template);
                                    setLetterheadPreview(template.imageData);
                                }}
                                className={`p-3 rounded-lg border-2 transition-all text-left ${selectedTemplate?.name === template.name
                                    ? 'border-indigo-600 bg-indigo-100'
                                    : 'border-indigo-200 bg-white hover:border-indigo-400'
                                    }`}
                            >
                                <p className="font-medium text-sm text-slate-900">{template.name}</p>
                                <p className="text-xs text-slate-600 mt-1">
                                    {new Date(template.createdAt).toLocaleDateString()}
                                </p>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowTemplateSettings(true)}
                        className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                    >
                        <span className="material-symbols-rounded">edit</span>
                        Manage & Customize Templates
                    </button>
                </div>
            )}

            {/* Document Preview */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Document Preview</h3>
                    <span className="text-xs text-slate-600">A4 Size with 1" Padding</span>
                </div>

                {/* Document Container */}
                <div className="p-6 bg-gray-50 min-h-full">
                    <div
                        ref={printRef}
                        className="bg-white shadow-lg"
                        style={{
                            width: '210mm',
                            height: '297mm',
                            margin: '0 auto',
                            padding: '25.4mm', // 1 inch
                            boxSizing: 'border-box',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '12px',
                            lineHeight: '1.6',
                            color: '#333',
                        }}
                    >
                        {/* Letterhead */}
                        {letterheadPreview && (
                            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                                <img
                                    src={letterheadPreview}
                                    alt="Company Letterhead"
                                    style={{
                                        maxWidth: '100%',
                                        height: 'auto',
                                        maxHeight: `${selectedTemplate?.settings?.letterheadHeight || 80}px`,
                                    }}
                                />
                            </div>
                        )}

                        {/* Divider */}
                        <div
                            style={{
                                borderTop: `2px solid ${selectedTemplate?.settings?.dividerColor || '#333'}`,
                                marginBottom: '24px',
                            }}
                        ></div>

                        {/* Company Name */}
                        {selectedTemplate?.settings?.showCompanyName && (
                            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                                <p style={{ fontSize: `${(selectedTemplate?.settings?.headerFontSize || 18) * 0.75}px`, fontWeight: 'bold', color: '#000' }}>
                                    {selectedTemplate?.settings?.companyName}
                                </p>
                            </div>
                        )}

                        {/* Title */}
                        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                            <h1
                                style={{
                                    fontSize: `${selectedTemplate?.settings?.headerFontSize || 18}px`,
                                    fontWeight: 'bold',
                                    marginBottom: '8px',
                                    color: '#000',
                                }}
                            >
                                {policyTitle}
                            </h1>
                            <p style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                Acknowledgement of Receipt and Understanding
                            </p>
                        </div>

                        {/* Policy Content */}
                        <div
                            style={{
                                marginBottom: '24px',
                                borderLeft: `3px solid ${selectedTemplate?.settings?.accentColor || '#0066cc'}`,
                                paddingLeft: '12px',
                            }}
                        >
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: policyContent.replace(/<[^>]*>/g, (tag) => {
                                        if (tag.match(/<\/?p/i)) return tag;
                                        if (tag.match(/<\/?strong/i)) return tag;
                                        if (tag.match(/<\/?em/i)) return tag;
                                        if (tag.match(/<\/?br/i)) return tag;
                                        return '';
                                    }),
                                }}
                                style={{
                                    fontSize: `${selectedTemplate?.settings?.bodyFontSize || 12}px`,
                                    lineHeight: '1.8',
                                    marginBottom: '12px',
                                }}
                            />
                        </div>

                        {/* Acknowledgement Statement */}
                        <div style={{ marginBottom: '24px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                            <p style={{ fontSize: '11px', marginBottom: '8px', fontWeight: 'bold' }}>
                                ACKNOWLEDGEMENT:
                            </p>
                            <p style={{ fontSize: '11px' }}>
                                I hereby acknowledge that I have received, read, and fully understand the above-stated policy. I agree to comply with all
                                policies and procedures outlined herein.
                            </p>
                        </div>

                        {/* Signature Section */}
                        <div style={{ marginTop: '32px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                {/* Signature Line 1 */}
                                <div>
                                    <div
                                        style={{
                                            borderBottom: '1px solid #000',
                                            marginBottom: '4px',
                                            height: '40px',
                                            fontFamily: 'cursive, Georgia, serif',
                                            fontSize: '20px',
                                            display: 'flex',
                                            alignItems: 'flex-end',
                                            paddingBottom: '4px',
                                        }}
                                    >
                                        {signature}
                                    </div>
                                    <p style={{ fontSize: '10px', fontWeight: 'bold' }}>Employee Signature</p>
                                </div>

                                {/* Date Line */}
                                <div>
                                    <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', height: '40px', paddingBottom: '4px' }}>
                                        {dateFormatted}
                                    </div>
                                    <p style={{ fontSize: '10px', fontWeight: 'bold' }}>Date</p>
                                </div>
                            </div>
                        </div>

                        {/* Employee Info */}
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #ccc', fontSize: '11px' }}>
                            <p>
                                <strong>Employee Name:</strong> {userFullName}
                            </p>
                            <p style={{ marginTop: '4px' }}>
                                <strong>Acknowledged:</strong> {dateFormatted}
                            </p>
                        </div>

                        {/* Footer */}
                        <div
                            style={{
                                marginTop: '32px',
                                paddingTop: '16px',
                                borderTop: '1px solid #ccc',
                                textAlign: 'center',
                                fontSize: '9px',
                                color: '#666',
                            }}
                        >
                            <p>This document is a digital acknowledgement and has legal validity.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                    <span className="material-symbols-rounded">print</span>
                    Print
                </button>
                <button
                    onClick={handleDownloadPDF}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                    <span className="material-symbols-rounded">download</span>
                    Download PDF
                </button>
            </div>

            {/* Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                <p className="flex items-start gap-2">
                    <span className="material-symbols-rounded text-base shrink-0 mt-0.5">info</span>
                    <span>
                        Make sure to <strong>upload your letterhead template</strong> before printing or downloading to ensure the document matches your company standards.
                    </span>
                </p>
            </div>
        </div>
    );
};

export default AcknowledgementDocumentPrinter;
