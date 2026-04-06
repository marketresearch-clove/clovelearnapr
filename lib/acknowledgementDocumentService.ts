/**
 * Acknowledgement Document Service
 * Handles printing and downloading of policy acknowledgement documents
 */

export interface AcknowledgementDocumentData {
  policyTitle: string;
  policyContent: string;
  userFullName: string;
  signature: string;
  acknowledgedAt: string;
  letterheadUrl?: string;
  documentId?: string;
  userEmail?: string;
  userDepartment?: string;
}

/**
 * Generate HTML for printed/PDF acknowledgement document
 */
export const generateAcknowledgementHTML = (
  data: AcknowledgementDocumentData
): string => {
  const dateFormatted = new Date(data.acknowledgedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeFormatted = new Date(data.acknowledgedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const cleanContent = data.policyContent
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '');

  // Use provided document ID or generate unique one
  const docId = data.documentId || Math.random().toString(36).substring(2, 12).toUpperCase();

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${data.policyTitle} - Acknowledgement Certificate</title>
        <style>
          @page {
            size: A4;
            margin: 0;
            padding: 0;
          }
          
          * {
            margin: 0;
            padding: 0;
          }
          
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
          }
          
          .certificate-container {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            background-color: #f5f5f5;
            overflow: hidden;
          }
          
          .certificate-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #f5f5f5 0%, #ffffff 50%, #f0f0f0 100%);
            border: 3px solid #d4af37;
            box-sizing: border-box;
          }
          
          .certificate-border {
            position: absolute;
            top: 10mm;
            left: 10mm;
            right: 10mm;
            bottom: 10mm;
            border: 2px solid #d4af37;
            box-sizing: border-box;
          }
          
          .certificate-content {
            position: relative;
            z-index: 10;
            width: 100%;
            height: 100%;
            padding: 30mm 30mm 25mm 30mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
          }
          
          .cert-header {
            margin-bottom: 20px;
          }

          .cert-logo {
            max-width: 120px;
            max-height: 60px;
            margin-left: 20px;
            margin-bottom: 15px;
            margin-right: auto;
            display: block;
            object-fit: contain;
          }

          .cert-decoration-top {
            height: 2px;
            background: #d4af37;
            margin-bottom: 15px;
          }
          
          .cert-title {
            font-size: 36px;
            font-weight: 700;
            color: #1a3a3a;
            letter-spacing: 2px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          
          .cert-subtitle {
            font-size: 16px;
            color: #c0823f;
            font-style: italic;
            margin-bottom: 5px;
          }
          
          .cert-official {
            font-size: 10px;
            color: #666;
          }
          
          .cert-divider {
            width: 80%;
            height: 1px;
            background: #333;
            margin: 20px auto;
          }
          
          .cert-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            margin: 10px 0;
          }
          
          .cert-statement {
            font-size: 13px;
            line-height: 1.8;
            color: #333;
            margin-bottom: 15px;
          }
          
          .cert-statement strong {
            font-weight: 700;
          }
          
          .cert-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
            font-size: 11px;
          }
          
          .detail-item {
            text-align: left;
          }
          
          .detail-label {
            font-size: 9px;
            font-weight: 700;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 3px;
          }
          
          .detail-value {
            color: #333;
            font-size: 12px;
          }
          
          .signature-area {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 30px;
            margin-bottom: 15px;
          }
          
          .signature-block {
            text-align: center;
          }
          
          .signature-line {
            border-bottom: 2px solid #333;
            height: 35px;
            margin-bottom: 5px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            font-family: 'Lucida Calligraphy', cursive;
            font-size: 22px;
            padding-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .signature-label {
            font-size: 10px;
            font-weight: 700;
            color: #333;
            text-transform: uppercase;
          }
          
          .cert-footer {
            text-align: center;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 9px;
            color: #999;
          }
          
          .doc-id {
            color: #c0823f;
            font-weight: 700;
          }
          
          @media print {
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
            }
            .certificate-container {
              width: 100%;
              height: auto;
              margin: 0;
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <div class="certificate-background"></div>
          <div class="certificate-border"></div>
          
          <div class="certificate-content">
            <div class="cert-header">
              ${data.letterheadUrl ? `<img src="${data.letterheadUrl}" alt="Letterhead" class="cert-logo">` : ''}
              <div class="cert-decoration-top"></div>
              <div class="cert-title">ACKNOWLEDGEMENT CERTIFICATE</div>
              <div class="cert-subtitle">${data.policyTitle}</div>
              <div class="cert-official">Official Record of Policy Acknowledgement</div>
            </div>
            
            <div class="cert-body">
              <p class="cert-statement">
                This document certifies that the individual named below, an employee of <strong>CLOVE TECHNOLOGIES PRIVATE LIMITED</strong>, has read, understood, and formally acknowledged the <strong>${data.policyTitle}</strong> as part of the course <strong>${data.policyTitle}</strong>.
              </p>
              
              <div class="cert-details">
                <div class="detail-item">
                  <div class="detail-label">Employee Name</div>
                  <div class="detail-value">${data.userFullName}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Email Address</div>
                  <div class="detail-value">${data.userEmail || '---'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Department</div>
                  <div class="detail-value">${data.userDepartment || '---'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Course</div>
                  <div class="detail-value">${data.policyTitle}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Policy / Document</div>
                  <div class="detail-value">${data.policyTitle}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Acknowledged On</div>
                  <div class="detail-value">${dateFormatted}</div>
                </div>
              </div>
            </div>
            
            <div class="signature-area" style="margin-top: 40px;">
              <div class="signature-block">
                <div class="signature-line">${data.signature}</div>
                <div class="signature-label">Employee / Learner Signature</div>
              </div>
              <div class="signature-block">
                <div style="height: 35px;"></div>
                <div class="signature-label">Acknowledgement</div>
              </div>
            </div>

            <div class="signature-area" style="margin-top: 40px;">
              <div class="signature-block">
                <div class="signature-line">Sreenath P</div>
                <div class="signature-label">HR – Lead</div>
              </div>
              <div class="signature-block">
                <div class="signature-line">Sidharth Kamasani</div>
                <div class="signature-label">Chief Operating Officer</div>
              </div>
            </div>
            
            <div class="cert-footer">
              <p>Document ID: <span class="doc-id">${docId}</span> | Generated: ${dateFormatted}, ${timeFormatted}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Print acknowledgement document
 */
export const printAcknowledgement = (data: AcknowledgementDocumentData) => {
  try {
    const html = generateAcknowledgementHTML(data);
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      throw new Error('Could not open print window. Please check popup blocker settings.');
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load before printing
    printWindow.onload = () => {
      printWindow.print();
    };

    setTimeout(() => {
      printWindow.print();
    }, 250);
  } catch (error) {
    console.error('Error printing acknowledgement:', error);
    throw error;
  }
};

/**
 * Download acknowledgement as PDF using browser's print-to-PDF functionality
 */
export const downloadAcknowledgementPDF = (
  data: AcknowledgementDocumentData,
  filename: string = `${data.policyTitle}-acknowledgement.pdf`
) => {
  try {
    const html = generateAcknowledgementHTML(data);
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      throw new Error('Could not open print window. Please check popup blocker settings.');
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then trigger print dialog
    printWindow.onload = () => {
      // Use print dialog which allows "Save as PDF" option
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } catch (error) {
    console.error('Error downloading acknowledgement PDF:', error);
    throw error;
  }
};

/**
 * Export acknowledgement as data URL for sharing/embedding
 */
export const exportAcknowledgementAsDataURL = (data: AcknowledgementDocumentData): string => {
  const html = generateAcknowledgementHTML(data);
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
};
