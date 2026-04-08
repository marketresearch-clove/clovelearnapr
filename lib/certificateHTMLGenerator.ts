/**
 * Certificate Generator
 * Supports both legacy HTML-based and new image-based certificate rendering
 */

import { getEnabledSignatures, CertificateSignature } from './certificateSignatureService';
import { PlaceholderConfig } from './certificateTemplateService';

export interface CertificateGenerationData {
    userName: string;
    courseTitle: string;
    issueDate: string;
    certificateId: string;
    userEmail?: string;
    userDepartment?: string;
    grade?: string;
    signatures: CertificateSignature[];
}

/**
 * Renders an image-based certificate template to a canvas
 */
export const renderCertificateToCanvas = async (
    canvas: HTMLCanvasElement,
    template: { background_image_url: string, placeholder_config: PlaceholderConfig[], width: number, height: number },
    data: CertificateGenerationData
): Promise<void> => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = template.width || 3125;
    canvas.height = template.height || 2209;

    // Load and draw background
    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    bgImg.src = template.background_image_url;

    await new Promise((resolve) => {
        bgImg.onload = resolve;
        bgImg.onerror = () => {
            console.error("Failed to load certificate background image");
            resolve(null);
        };
    });

    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    // Prepare text data for placeholders
    const textData: Record<string, string> = {
        userName: data.userName,
        courseTitle: data.courseTitle,
        issueDate: data.issueDate,
        certificateId: data.certificateId,
        userEmail: data.userEmail || '',
        userDepartment: data.userDepartment || '',
        grade: data.grade || 'Qualified'
    };

    // Render placeholders
    for (const p of template.placeholder_config) {
        if (p.type === 'text') {
            const text = textData[p.id] || `{${p.id}}`;
            ctx.font = `${p.fontWeight || 'normal'} ${p.fontSize || 24}px ${p.fontFamily || 'Inter'}`;
            ctx.fillStyle = p.color || '#000000';
            ctx.textAlign = (p.textAlign as CanvasTextAlign) || 'center';
            ctx.fillText(text, p.x, p.y);
        } else if (p.type === 'signature') {
            const sigIndex = parseInt(p.id.split('_')[1]) - 1;
            const sig = data.signatures[sigIndex];

            if (sig && sig.signature_image_url) {
                const sigImg = new Image();
                sigImg.crossOrigin = "anonymous";
                sigImg.src = sig.signature_image_url;

                await new Promise((res) => {
                    sigImg.onload = res;
                    sigImg.onerror = () => res(null);
                });

                const maxWidth = p.maxWidth || 500;
                const maxHeight = p.maxHeight || 200;
                let drawWidth = sigImg.width;
                let drawHeight = sigImg.height;

                const ratio = Math.min(maxWidth / drawWidth, maxHeight / drawHeight);
                drawWidth *= ratio;
                drawHeight *= ratio;

                let drawX = p.x;
                if (p.textAlign === 'center') drawX -= drawWidth / 2;
                else if (p.textAlign === 'right') drawX -= drawWidth;

                ctx.drawImage(sigImg, drawX, p.y - drawHeight, drawWidth, drawHeight);
                
                // Labels below signature
                ctx.font = `bold 36px Inter`;
                ctx.fillStyle = '#0F3D47';
                ctx.textAlign = 'center';
                ctx.fillText(`Signed: ${sig.name}`, p.x, p.y + 50);
                ctx.font = `32px Inter`;
                ctx.fillStyle = '#000000';
                ctx.fillText(sig.designation, p.x, p.y + 100);
            } else if (sig) {
                // Text fallback for signature
                ctx.font = `italic 72px 'Dancing Script', cursive`;
                ctx.fillStyle = '#333333';
                ctx.textAlign = 'center';
                ctx.fillText(sig.signature_text || sig.name, p.x, p.y);
                
                ctx.font = `bold 36px Inter`;
                ctx.fillStyle = '#0F3D47';
                ctx.fillText(`Signed: ${sig.name}`, p.x, p.y + 50);
                ctx.font = `32px Inter`;
                ctx.fillStyle = '#000000';
                ctx.fillText(sig.designation, p.x, p.y + 100);
            }
        }
    }
};

/**
 * Legacy HTML Generator - Maintained for backward compatibility
 */
export const generateCertificateHTML = async (
    baseTemplate: string,
    data: CertificateGenerationData
): Promise<string> => {
    // Legacy logic...
    let html = baseTemplate;
    html = html.replace(/\{userName\}/g, data.userName);
    html = html.replace(/\{courseTitle\}/g, data.courseTitle);
    html = html.replace(/\{issueDate\}/g, data.issueDate);
    html = html.replace(/\{certificateId\}/g, data.certificateId);
    return html;
};
