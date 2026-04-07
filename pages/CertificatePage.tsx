import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCertificate } from '../lib/certificateService';
import { courseCompletionService } from '../lib/courseCompletionService';
import { generateCertificateHTML } from '../lib/certificateHTMLGenerator';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CertificatePage = () => {
  const { certificateId } = useParams<{ certificateId: string }>();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      if (certificateId) {
        try {
          console.log('Fetching certificate:', certificateId);
          const data = await getCertificate(certificateId);
          console.log('Certificate data:', data);

          if (!data) {
            setError('Certificate not found in database.');
          } else if (!data.html_template) {
            setError('Failed to load certificate template.');
          } else {
            setCertificate(data);
            setError(null);
          }
        } catch (error) {
          console.error('Failed to fetch certificate:', error);
          setError('Failed to load certificate. Please try again later.');
        }
      } else {
        setError('Certificate ID not provided in URL.');
      }
      setLoading(false);
    };

    fetchCertificate();
  }, [certificateId]);

  const getPopulatedTemplate = async () => {
    if (!certificate || !certificate.html_template) {
      return '';
    }

    const userName = certificate.profiles?.full_name || 'Certificate Recipient';
    const userEmail = certificate.profiles?.email || '---';
    const userDepartment = certificate.profiles?.department || '---';
    const courseTitle = certificate.courses?.title || 'Course';
    const issueDate = new Date(certificate.issued_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Use the dynamic certificate HTML generator with signatures
    const html = await generateCertificateHTML(certificate.html_template, {
      userName,
      courseTitle,
      issueDate,
      certificateId: certificate.id,
      userEmail,
      userDepartment,
    });

    return html;
  };

  useEffect(() => {
    if (certificate && certificate.user_id && certificate.courses?.id) {
      // Ensure skills are assigned and achievements recorded when certificate is viewed
      courseCompletionService.markCourseAsCompleted(certificate.user_id, certificate.courses.id)
        .catch(err => console.error('Error ensuring skills assigned:', err));
    }

    if (certificate && iframeRef.current) {
      getPopulatedTemplate().then((html) => {
        const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(html);
          iframeDoc.close();
        }
      });
    }
  }, [certificate]);

  const handleDownload = async () => {
    if (!iframeRef.current) {
      alert('Certificate not ready for download');
      return;
    }

    setDownloading(true);
    try {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Cannot access iframe content');
      }

      const canvas = await html2canvas(iframeDoc.documentElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        allowTaint: true,
        useCORS: true,
        proxy: null,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [268, 254]
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);

      const fileName = `Certificate_of_Completion_${certificate?.profiles?.full_name?.replace(/\s+/g, '_') || 'User'}.pdf`;
      pdf.save(fileName);

      console.log('Certificate downloaded successfully as PDF');
    } catch (err) {
      console.error('Failed to download certificate as PDF:', err);
      alert('Failed to download certificate as PDF. Please try using the Print function instead.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-red-100 border border-red-400 rounded-lg p-8 text-center max-w-md">
          <span className="material-symbols-rounded text-6xl text-red-700 block mb-4">error_outline</span>
          <p className="text-red-800 font-bold mb-2">Unable to Load Certificate</p>
          <p className="text-red-700 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/learning?tab=certificates')}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Certificates
          </button>
        </div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-center">
          <span className="material-symbols-rounded text-6xl text-gray-500 block mb-4">description</span>
          <p className="text-gray-700 font-medium mb-6">Certificate not found.</p>
          <button
            onClick={() => navigate('/learning?tab=certificates')}
            className="bg-indigo-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Certificates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/learning?tab=certificates')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            <span className="material-symbols-rounded">arrow_back</span>
            Back to Certificates
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Certificate of Completion</h1>
          <div className="w-24"></div>
        </div>

        <div className="bg-white shadow-2xl rounded-lg overflow-hidden">
          <iframe
            ref={iframeRef}
            title="Certificate"
            className="w-full border-0"
            style={{ height: '800px' }}
          />
        </div>

        <div
          ref={certificateRef}
          className="hidden"
          dangerouslySetInnerHTML={{ __html: getPopulatedTemplate() }}
        />

        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white transition-colors ${downloading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
          >
            <span className="material-symbols-rounded">download</span>
            {downloading ? 'Downloading...' : 'Download Certificate'}
          </button>
          <button
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.contentWindow?.print();
              }
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <span className="material-symbols-rounded">print</span>
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default CertificatePage;