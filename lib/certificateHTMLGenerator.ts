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

    // Pre-load Google Fonts before rendering
    const fontFamilies = new Set<string>();
    for (const p of template.placeholder_config) {
        if (p.fontFamily && p.fontFamily !== 'Inter') {
            fontFamilies.add(p.fontFamily);
        }
    }

    // Load fonts dynamically via Google Fonts API
    for (const font of fontFamilies) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap`;
        document.head.appendChild(link);
    }

    // Wait for fonts to load using the Font Loading API
    if (fontFamilies.size > 0) {
        try {
            // Use document.fonts.ready to ensure fonts are loaded
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            } else {
                // Fallback: wait with longer timeout for browsers without Font Loading API
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.warn('Font loading error, continuing with fallback:', error);
            // Continue even if font loading fails
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

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

            // Convert fontWeight values to numeric weight for canvas
            let fontWeight = '400';
            if (p.fontWeight) {
                switch (p.fontWeight.toLowerCase()) {
                    case 'normal': fontWeight = '400'; break;
                    case 'medium': fontWeight = '500'; break;
                    case 'bold': fontWeight = '700'; break;
                    case '900': fontWeight = '900'; break;
                    default: fontWeight = p.fontWeight;
                }
            }

            // Construct font string in correct canvas format
            const fontSize = p.fontSize || 24;
            const fontFamily = p.fontFamily || 'Inter';
            ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;

            ctx.fillStyle = p.color || '#000000';
            ctx.textAlign = (p.textAlign as CanvasTextAlign) || 'center';
            ctx.fillText(text, p.x, p.y);
        } else if (p.type === 'signature') {
            const sigIndex = parseInt(p.id.split('_')[1]) - 1;
            const sig = data.signatures[sigIndex];

            if (sig && sig.signature_image_url) {
                // Draw signature image if enabled
                if (p.signatureElements?.showSignatureImage ?? true) {
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
                }

                // Draw signature details below image
                let textYOffset = 50;
                const labelText = p.signatureLabelText || 'Signed:';

                // Prepare font for signature details - use configured font and weight
                let sigFontWeight = '400';
                if (p.fontWeight) {
                    switch (p.fontWeight.toLowerCase()) {
                        case 'normal': sigFontWeight = '400'; break;
                        case 'medium': sigFontWeight = '500'; break;
                        case 'bold': sigFontWeight = '700'; break;
                        case '900': sigFontWeight = '900'; break;
                        default: sigFontWeight = p.fontWeight;
                    }
                }
                const sigFontFamily = p.fontFamily || 'Inter';

                if (p.signatureElements?.showSignedLabel ?? true) {
                    ctx.font = `${sigFontWeight} 36px "${sigFontFamily}"`;
                    ctx.fillStyle = p.color || '#0F3D47';
                    ctx.textAlign = 'center';
                    ctx.fillText(labelText, p.x, p.y + textYOffset);
                    textYOffset += 50;
                }

                if (p.signatureElements?.showName ?? true) {
                    ctx.font = `${sigFontWeight} 36px "${sigFontFamily}"`;
                    ctx.fillStyle = p.color || '#0F3D47';
                    ctx.textAlign = 'center';
                    ctx.fillText(sig.name, p.x, p.y + textYOffset);
                    textYOffset += 50;
                }

                if (p.signatureElements?.showDesignation ?? true) {
                    ctx.font = `32px "${sigFontFamily}"`;
                    ctx.fillStyle = p.color || '#000000';
                    ctx.textAlign = 'center';
                    ctx.fillText(sig.designation, p.x, p.y + textYOffset);
                }
            } else if (sig) {
                // Text fallback for signature
                if (p.signatureElements?.showSignatureImage ?? true) {
                    ctx.font = `italic 72px 'Dancing Script', cursive`;
                    ctx.fillStyle = p.color || '#333333';
                    ctx.textAlign = 'center';
                    ctx.fillText(sig.signature_text || sig.name, p.x, p.y);
                }

                // Draw signature details - use configured font and weight
                let textYOffset = 50;
                const labelText = p.signatureLabelText || 'Signed:';

                // Prepare font for signature details
                let fallbackFontWeight = '400';
                if (p.fontWeight) {
                    switch (p.fontWeight.toLowerCase()) {
                        case 'normal': fallbackFontWeight = '400'; break;
                        case 'medium': fallbackFontWeight = '500'; break;
                        case 'bold': fallbackFontWeight = '700'; break;
                        case '900': fallbackFontWeight = '900'; break;
                        default: fallbackFontWeight = p.fontWeight;
                    }
                }
                const fallbackFontFamily = p.fontFamily || 'Inter';

                if (p.signatureElements?.showSignedLabel ?? true) {
                    ctx.font = `${fallbackFontWeight} 36px "${fallbackFontFamily}"`;
                    ctx.fillStyle = p.color || '#0F3D47';
                    ctx.textAlign = 'center';
                    ctx.fillText(labelText, p.x, p.y + textYOffset);
                    textYOffset += 50;
                }

                if (p.signatureElements?.showName ?? true) {
                    ctx.font = `${fallbackFontWeight} 36px "${fallbackFontFamily}"`;
                    ctx.fillStyle = p.color || '#0F3D47';
                    ctx.textAlign = 'center';
                    ctx.fillText(sig.name, p.x, p.y + textYOffset);
                    textYOffset += 50;
                }

                if (p.signatureElements?.showDesignation ?? true) {
                    ctx.font = `32px "${fallbackFontFamily}"`;
                    ctx.fillStyle = p.color || '#000000';
                    ctx.textAlign = 'center';
                    ctx.fillText(sig.designation, p.x, p.y + textYOffset);
                }
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
