/**
 * Certificate HTML Generator with Dynamic Signatures
 * Generates certificate HTML with enabled signatures from the database
 */

import { getEnabledSignatures, CertificateSignature } from './certificateSignatureService';

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
 * Generate signature section HTML
 */
const generateSignatureSectionHTML = (signatures: CertificateSignature[]): string => {
    if (signatures.length === 0) {
        return '';
    }

    const signatureBlocks = signatures
        .map((sig) => {
            const signatureContent = sig.signature_image_url
                ? `<img src="${sig.signature_image_url}" alt="${sig.designation}" style="max-height: 80px; max-width: 200px;" />`
                : `<div style="font-family: 'Dancing Script', cursive; font-size: 32px; color: #333; margin: 8px 0;">${sig.signature_text || sig.name}</div>`;

            return `
        <div style="flex: 1; text-align: center; padding: 0 20px;">
          <div style="margin-bottom: 20px;">
            ${signatureContent}
          </div>
          <div style="border-top: 2px solid #333; padding-top: 10px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${sig.name}</div>
            <div style="font-size: 12px; color: #666;">${sig.designation}</div>
          </div>
        </div>
      `;
        })
        .join('');

    return `
    <div style="display: flex; justify-content: space-around; margin-top: 60px; gap: 20px;">
      ${signatureBlocks}
    </div>
  `;
};

/**
 * Fetch enabled signatures and generate complete certificate HTML
 */
export const generateCertificateHTML = async (
    baseTemplate: string,
    data: CertificateGenerationData
): Promise<string> => {
    try {
        // Use provided signatures or fetch enabled ones
        const signatures = data.signatures.length > 0
            ? data.signatures
            : await getEnabledSignatures();

        let html = baseTemplate;

        // Replace basic information
        html = html.replace(/Yuva Subharam/g, data.userName);
        html = html.replace(/Risk Management from Daily Life to Business/g, data.courseTitle);
        html = html.replace(/07 September, 2023/g, data.issueDate);
        html = html.replace(/XXXXXXXXXXXXXXXXXXXXXXXXXXXXX/g, data.certificateId);

        // Replace grade if provided
        if (data.grade) {
            html = html.replace(/Grade: <span[^>]*>Qualified<\/span>/g, `Grade: <span>${data.grade}</span>`);
        }

        // Find the signature section placeholder and replace it with dynamic signatures
        const signatureHTML = generateSignatureSectionHTML(signatures);

        // Look for the old signature section and replace it
        const oldSignaturePattern = /<div[^>]*class="flex flex-col sm:flex-row gap-12 sm:gap-24 mt-auto">[^<]*<div[^>]*class="flex flex-col">[^<]*<div[^>]*class="h-16[^<]*<\/div>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

        if (oldSignaturePattern.test(html)) {
            html = html.replace(oldSignaturePattern, signatureHTML);
        }

        return html;
    } catch (error) {
        console.error('Error generating certificate HTML:', error);
        // Return template with basic replacements if signature fetch fails
        let html = baseTemplate;
        html = html.replace(/Yuva Subharam/g, data.userName);
        html = html.replace(/Risk Management from Daily Life to Business/g, data.courseTitle);
        html = html.replace(/07 September, 2023/g, data.issueDate);
        html = html.replace(/XXXXXXXXXXXXXXXXXXXXXXXXXXXXX/g, data.certificateId);
        return html;
    }
};

/**
 * Extract signatures from database for a certificate
 */
export const getCertificateSignatures = async (): Promise<CertificateSignature[]> => {
    try {
        return await getEnabledSignatures();
    } catch (error) {
        console.error('Error fetching certificate signatures:', error);
        return [];
    }
};
