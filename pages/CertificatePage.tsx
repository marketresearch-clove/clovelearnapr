import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCertificate } from '../lib/certificateService';
import { courseCompletionService } from '../lib/courseCompletionService';
import { renderCertificateToCanvas } from '../lib/certificateHTMLGenerator';
import jsPDF from 'jspdf';

const CertificatePage = () => {
  const { certificateId } = useParams<{ certificateId: string }>();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'png' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      if (certificateId) {
        try {
          const data = await getCertificate(certificateId);
          if (!data) {
            setError('Certificate not found.');
          } else if (!data.template) {
            setError('Certificate template not found.');
          } else {
            setCertificate(data);
          }
        } catch (error) {
          console.error('Failed to fetch certificate:', error);
          setError('Failed to load certificate.');
        }
      } else {
        setError('Certificate ID not provided.');
      }
      setLoading(false);
    };

    fetchCertificate();
  }, [certificateId]);

  useEffect(() => {
    if (certificate && certificate.user_id && certificate.courses?.id) {
      courseCompletionService.markCourseAsCompleted(certificate.user_id, certificate.courses.id)
        .catch(err => console.error('Error ensuring skills assigned:', err));
    }

    if (certificate && certificate.template) {
      renderCertificate();
    }
  }, [certificate]);

  const renderCertificate = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !certificate || !certificate.template) return;

    await renderCertificateToCanvas(canvas, certificate.template, {
      userName: certificate.profiles?.full_name || 'Certificate Recipient',
      courseTitle: certificate.courses?.title || 'Course',
      issueDate: new Date(certificate.issued_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      certificateId: certificate.id,
      userEmail: certificate.profiles?.email || '',
      userDepartment: certificate.profiles?.department || '',
      grade: 'Qualified',
      signatures: certificate.signatures_data || []
    });
  };

  const handleDownload = async (format: 'pdf' | 'png') => {
    if (!canvasRef.current) return;

    setDownloading(true);
    setDownloadFormat(format);

    try {
      const canvas = canvasRef.current;
      const fileName = `Certificate_${certificate?.profiles?.full_name?.replace(/\s+/g, '_') || 'Completion'}`;

      if (format === 'png') {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.png`;
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${fileName}.pdf`);
      }
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download certificate.');
    } finally {
      setDownloading(false);
      setDownloadFormat(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
        <span className="material-symbols-rounded text-6xl text-red-500 mb-4">error</span>
        <h2 className="text-2xl font-bold mb-2">Error</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={() => navigate('/learning')} className="bg-primary text-white px-6 py-2 rounded-lg">Back</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-12 px-4">
      <div className="max-w-6xl w-full flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-8">
          <button onClick={() => navigate('/learning?tab=certificates')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <span className="material-symbols-rounded">arrow_back</span>
            Back to Certificates
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Your Certificate</h1>
          <div className="w-32"></div>
        </div>

        <div className="bg-white p-2 rounded-lg shadow-2xl overflow-hidden max-w-full">
          <canvas 
            ref={canvasRef} 
            className="max-w-full h-auto shadow-inner"
            style={{ width: '100%', height: 'auto', maxHeight: '70vh' }}
          />
        </div>

        <div className="mt-12 flex gap-4 flex-wrap justify-center">
          <button
            onClick={() => handleDownload('png')}
            disabled={downloading}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-200"
          >
            <span className="material-symbols-rounded">image</span>
            {downloading && downloadFormat === 'png' ? 'Preparing PNG...' : 'Download PNG'}
          </button>

          <button
            onClick={() => {
              const win = window.open('', '_blank');
              if (win) {
                const dataUrl = canvasRef.current?.toDataURL('image/png');
                win.document.write(`<img src="${dataUrl}" style="width:100%" onload="window.print();window.close();">`);
                win.document.close();
              }
            }}
            className="flex items-center gap-2 px-8 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-all shadow-lg hover:shadow-gray-200"
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
