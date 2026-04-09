/**
 * Certificate Toggle with Warnings
 * Shows warning if disabling certificates for a course with existing issued certificates
 *
 * Installation:
 * 1. Add this to CourseDetailsForm.tsx imports
 * 2. Use instead of the inline toggle code
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CertificateToggleProps {
  courseId?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const CertificateToggleWithWarning: React.FC<CertificateToggleProps> = ({
  courseId,
  enabled,
  onToggle,
}) => {
  const [existingCertificates, setExistingCertificates] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showDisableWarning, setShowDisableWarning] = useState(false);

  // Check for existing certificates when component mounts or courseId changes
  useEffect(() => {
    if (courseId && enabled) {
      checkExistingCertificates();
    }
  }, [courseId, enabled]);

  const checkExistingCertificates = async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('certificates')
        .select('id')
        .eq('course_id', courseId);

      if (!error && data) {
        setExistingCertificates(data.length);
      }
    } catch (error) {
      console.error('Error checking certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (newState: boolean) => {
    // If enabling, just do it
    if (newState) {
      onToggle(true);
      setShowDisableWarning(false);
      return;
    }

    // If disabling and there are existing certificates, warn
    if (!newState && existingCertificates > 0) {
      setShowDisableWarning(true);
      return;
    }

    // If disabling with no certificates, just do it
    onToggle(false);
  };

  const confirmDisable = () => {
    onToggle(false);
    setShowDisableWarning(false);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <span
            className={`material-symbols-outlined text-2xl ${
              enabled ? 'text-amber-500' : 'text-gray-400'
            }`}
          >
            workspace_premium
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Certificate on Completion</p>
            <p className="text-xs text-gray-500">
              {enabled
                ? `Learners will receive a certificate when they complete this course.${
                    existingCertificates > 0
                      ? ` (${existingCertificates} issued)`
                      : ''
                  }`
                : 'No certificate will be issued for this course.'}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={loading}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-amber-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 disabled:opacity-50"></div>
        </label>
      </div>

      {/* Warning Dialog */}
      {showDisableWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <span className="material-symbols-outlined text-amber-500 text-2xl">
                warning
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  Disable Certificates?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  This course has {existingCertificates} issued certificate
                  {existingCertificates > 1 ? 's' : ''}.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Important:</strong> Disabling certificates will:
              </p>
              <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
                <li>Stop new certificates from being issued</li>
                <li>Not affect existing certificates</li>
                <li>Learners won't get certificates on future completions</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisableWarning(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Keep Enabled
              </button>
              <button
                onClick={confirmDisable}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Disable Certificates
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
