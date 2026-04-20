import React, { useEffect, useState, useRef } from 'react';
import { getCertificate } from '../lib/certificateService';
import { renderCertificateToCanvas } from '../lib/certificateHTMLGenerator';
import jsPDF from 'jspdf';

type CompletionMeta = {
    courseName: string;
    userName: string;
    completionDate: string;
    certificateUrl?: string;
    certificatePreviewUrl?: string;
    organization?: string;
    issueYear?: string;
    issueMonth?: string;
    credentialId?: string;
    certificateId?: string;
    skillsEarned?: string[];
    pointsEarned?: number;
    timeTakenSeconds?: number;
    quizPercentage?: number;
};

type Props = {
    meta: CompletionMeta;
    onClose: () => void;
};

const formatDuration = (seconds?: number, fallbackMinutes?: number) => {
    if (seconds && seconds > 0) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return [hours ? `${hours}h` : null, minutes ? `${minutes}m` : null, secs ? `${secs}s` : null].filter(Boolean).join(' ') || '0s';
    }
    if (fallbackMinutes && fallbackMinutes > 0) {
        return `${fallbackMinutes} min`;
    }
    return 'N/A';
};

const defaultPreview = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2364728b" font-family="Arial,Helvetica,sans-serif" font-size="28"%3ECertificate Preview%3C/text%3E%3C/svg%3E';

const buildSuggestedPost = (meta: CompletionMeta) => {
    const skillsText = meta.skillsEarned && meta.skillsEarned.length > 0
        ? `Skills gained: ${meta.skillsEarned.join(', ')}.`
        : 'Excited to apply these skills in real-world projects 🚀';

    return `🎉 I just completed "${meta.courseName}" on Clove Learning Portal by CloveTech!
Completed on ${meta.completionDate}.
${skillsText}
#CloveLearning #CloveTech #CareerGrowth`;
};

const CourseCompletionPopup: React.FC<Props> = ({ meta, onClose }) => {
    const [postText, setPostText] = useState(() => buildSuggestedPost(meta));
    const [certificateData, setCertificateData] = useState<any>(null);
    const [loadingCertificate, setLoadingCertificate] = useState(false);
    const [downloadingCertificate, setDownloadingCertificate] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const certificatePageUrl = meta.certificateId
        ? `${window.location.origin}/certificate/${meta.certificateId}`
        : (meta.certificateUrl || '');
    const hasCertificate = Boolean(meta.certificateId);

    useEffect(() => {
        if (hasCertificate && meta.certificateId) {
            loadCertificate();
        }
    }, [meta.certificateId, hasCertificate]);

    const loadCertificate = async () => {
        if (!meta.certificateId) return;
        setLoadingCertificate(true);
        try {
            const data = await getCertificate(meta.certificateId);
            if (data) {
                setCertificateData(data);
            }
        } catch (error) {
            console.error('Failed to load certificate:', error);
        } finally {
            setLoadingCertificate(false);
        }
    };

    const renderCertificatePreview = async () => {
        if (!canvasRef.current || !certificateData || !certificateData.template) return;
        try {
            await renderCertificateToCanvas(canvasRef.current, certificateData.template, {
                userName: certificateData.profiles?.full_name || 'Certificate Recipient',
                courseTitle: certificateData.courses?.title || 'Course',
                issueDate: new Date(certificateData.issued_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                certificateId: certificateData.id,
                userEmail: certificateData.profiles?.email || '',
                userDepartment: certificateData.profiles?.department || '',
                grade: 'Qualified',
                signatures: certificateData.signatures_data || []
            });
        } catch (error) {
            console.error('Failed to render certificate:', error);
        }
    };

    useEffect(() => {
        if (certificateData && canvasRef.current) {
            renderCertificatePreview();
        }
    }, [certificateData]);

    useEffect(() => {
        setPostText(buildSuggestedPost(meta));
    }, [meta.courseName, meta.completionDate, meta.skillsEarned?.join(',')]);

    const addToLinkedIn = () => {
        const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
            meta.courseName
        )}&organizationName=${encodeURIComponent(meta.organization || 'Clove Learning Portal')}&issueYear=${encodeURIComponent(
            meta.issueYear || new Date().getFullYear().toString()
        )}&issueMonth=${encodeURIComponent(meta.issueMonth || (new Date().getMonth() + 1).toString())}&credentialId=${encodeURIComponent(
            meta.credentialId || meta.courseName
        )}&credentialUrl=${encodeURIComponent(certificatePageUrl || window.location.href)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const shareOnLinkedIn = () => {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
            certificatePageUrl || window.location.href
        )}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const viewCertificate = () => {
        if (!hasCertificate || !certificatePageUrl) {
            alert('Certificate is not available yet.');
            return;
        }
        window.open(certificatePageUrl, '_blank', 'noopener,noreferrer');
    };

    const downloadCertificate = async () => {
        if (!hasCertificate || !canvasRef.current) {
            alert('Certificate is not available yet.');
            return;
        }

        setDownloadingCertificate(true);
        try {
            const canvas = canvasRef.current;
            const safeFileName = `Certificate-${meta.courseName.replace(/\s+/g, '_')}-${meta.userName.replace(/\s+/g, '_')}`;

            // Generate PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${safeFileName}.pdf`);
        } catch (error) {
            console.error('Certificate download failed:', error);
            alert('Failed to download certificate. Please try again.');
        } finally {
            setDownloadingCertificate(false);
        }
    };

    const copyPostText = async () => {
        try {
            await navigator.clipboard.writeText(postText);
            alert('Post text copied to clipboard!');
        } catch (error) {
            console.error('Copy failed:', error);
            alert('Unable to copy post text. Please copy it manually.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <div className="w-full max-w-5xl rounded-[32px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] overflow-hidden border border-slate-200 max-h-[90vh]">
                <div className="flex flex-col gap-4 p-4 md:p-8 max-h-[calc(90vh-2rem)] overflow-y-auto">
                    <div className="relative flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-xl">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">Congratulations</p>
                            <h2 className="mt-2 text-3xl font-bold text-slate-900">Course Completed!</h2>
                            <p className="mt-2 text-sm text-slate-600 max-w-xl">
                                You have finished <span className="font-semibold">{meta.courseName}</span> on <span className="font-semibold">Clove Learning Portal</span>. Share your achievement, view your certificate, and celebrate the skills you earned.
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">Presented by <a href="https://www.linkedin.com/company/clovetech/" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">CloveTech</a></p>
                        </div>
                        <button
                            onClick={onClose}
                            className="order-first h-11 w-11 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 sm:order-none"
                            aria-label="Close completion popup"
                        >
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                                {hasCertificate && certificateData ? (
                                    <div className="relative h-56 w-full bg-white overflow-auto flex items-center justify-center">
                                        {loadingCertificate ? (
                                            <div className="flex flex-col items-center justify-center h-full">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                                                <p className="text-xs text-gray-500">Rendering certificate...</p>
                                            </div>
                                        ) : (
                                            <canvas
                                                ref={canvasRef}
                                                className="max-w-full h-auto"
                                                style={{ maxHeight: '224px', width: 'auto' }}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <img
                                        src={defaultPreview}
                                        alt="Certificate preview"
                                        className="h-56 w-full object-cover"
                                    />
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4">
                                    <p className="text-sm font-semibold text-white">Certificate Preview</p>
                                </div>
                            </div>
                            <div className="mt-4 space-y-3">
                                <div className="rounded-2xl bg-white p-4 border border-slate-200">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Skills Earned</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {meta.skillsEarned && meta.skillsEarned.length > 0 ? (
                                            meta.skillsEarned.map((skill) => (
                                                <span key={skill} className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                                                    {skill}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-sm text-slate-500">Skills from this course will appear here.</span>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-white p-4 border border-slate-200">
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Points Earned</p>
                                        <p className="mt-2 text-xl font-semibold text-slate-900">{meta.pointsEarned ?? 0}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white p-4 border border-slate-200">
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Quiz Score</p>
                                        <p className="mt-2 text-xl font-semibold text-slate-900">{meta.quizPercentage != null ? `${meta.quizPercentage}%` : 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-white p-4 border border-slate-200">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Time Taken</p>
                                    <p className="mt-2 text-xl font-semibold text-slate-900">{formatDuration(meta.timeTakenSeconds, undefined)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Learner</p>
                                        <p className="mt-2 text-base font-semibold text-slate-900">{meta.userName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Completed</p>
                                        <p className="mt-2 text-base font-semibold text-slate-900">{meta.completionDate}</p>
                                    </div>
                                </div>
                                <div className="mt-5 rounded-3xl bg-white p-4 border border-slate-200">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Certificate</p>
                                    <p className="mt-3 text-sm text-slate-600">Add this achievement to LinkedIn or view your certificate with one click.</p>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                            onClick={addToLinkedIn}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                                        >
                                            <span className="material-symbols-rounded">link</span>
                                            Add to LinkedIn Profile
                                        </button>
                                        <button
                                            onClick={shareOnLinkedIn}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                        >
                                            <span className="material-symbols-rounded">share</span>
                                            Share on LinkedIn
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Suggested Post</p>
                                        <p className="text-xs text-slate-500">Edit your post copy before sharing.</p>
                                    </div>
                                    <button
                                        onClick={copyPostText}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                    >
                                        Copy Text
                                    </button>
                                </div>
                                <textarea
                                    value={postText}
                                    onChange={(event) => setPostText(event.target.value)}
                                    className="mt-4 h-36 w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                />
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        onClick={viewCertificate}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                    >
                                        <span className="material-symbols-rounded">visibility</span>
                                        View Certificate
                                    </button>
                                    <button
                                        onClick={downloadCertificate}
                                        disabled={downloadingCertificate || !hasCertificate}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {downloadingCertificate ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
                                                Downloading...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-rounded">download</span>
                                                Download Certificate
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseCompletionPopup;
