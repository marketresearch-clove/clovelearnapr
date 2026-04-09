import React, { useState, useEffect } from 'react';
import { certificateCleanupService } from '../lib/certificateCleanupService';

interface CertificateIssue {
  id: string;
  user_id: string;
  course_id: string;
  issue_type: 'disabled_course' | 'missing_course' | 'missing_user';
}

const CertificateManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [cleanupInProgress, setCleanupInProgress] = useState(false);
  const [cleanupType, setCleanupType] = useState<'orphaned' | 'all'>('orphaned');
  const [dryRun, setDryRun] = useState(true);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    try {
      const result = await certificateCleanupService.validateCertificateIntegrity();
      setValidationResult(result);
      console.log('Validation result:', result);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({ success: false, error });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!validationResult || validationResult.total_issues === 0) {
      alert('No issues to clean');
      return;
    }

    const confirmMsg = dryRun
      ? `DRY RUN: Preview deletion of ${validationResult.total_issues} problematic certificates?`
      : `WARNING: This will PERMANENTLY DELETE ${validationResult.total_issues} certificates. Are you Sure?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setCleanupInProgress(true);
    try {
      let result;
      if (cleanupType === 'orphaned') {
        result = await certificateCleanupService.deleteOrphanedCertificates(dryRun);
      } else {
        result = await certificateCleanupService.cleanupAllIssues(dryRun);
      }

      setCleanupResult(result);
      console.log('Cleanup result:', result);

      if (result.success && !dryRun) {
        alert(`✅ Cleaned ${result.cleaned || result.would_delete} certificates`);
        // Re-validate after cleanup
        setTimeout(handleValidate, 1000);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      setCleanupResult({ success: false, error });
    } finally {
      setCleanupInProgress(false);
    }
  };

  const hasIssues = validationResult?.total_issues > 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Certificate Management</h1>
        <p className="text-gray-600 text-sm">
          Find and clean up orphaned certificates (issued for disabled courses, or missing course/user references)
        </p>
      </div>

      {/* Validation Section */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Step 1: Validate Certificates</h2>
        <p className="text-sm text-gray-600">
          Check for any issues with your certificates
        </p>

        <button
          onClick={handleValidate}
          disabled={loading}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {loading ? 'Validating...' : 'Validate Certificates'}
        </button>

        {validationResult && (
          <div className="mt-4 p-4 rounded-lg border-2 border-gray-200">
            {validationResult.success ? (
              <>
                <h3 className="font-semibold text-lg mb-3">
                  {validationResult.total_issues === 0 ? '✅ All Good!' : '⚠️ Issues Found'}
                </h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Orphaned (disabled courses):</strong> {validationResult.issues?.orphaned_by_disabled_course?.length || 0}
                  </p>
                  <p>
                    <strong>Missing course:</strong> {validationResult.issues?.missing_course?.length || 0}
                  </p>
                  <p>
                    <strong>Missing user:</strong> {validationResult.issues?.missing_user?.length || 0}
                  </p>
                  <p className="font-bold text-lg mt-2">
                    Total Issues: {validationResult.total_issues}
                  </p>
                </div>

                {hasIssues && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {showDetails ? '▼ Hide Details' : '▶ Show Details'}
                  </button>
                )}

                {showDetails && hasIssues && (
                  <div className="mt-3 space-y-3">
                    {validationResult.issues?.orphaned_by_disabled_course?.length > 0 && (
                      <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-sm font-semibold text-yellow-900 mb-2">
                          Orphaned Certificates (Disabled Courses):
                        </p>
                        <ul className="text-xs text-yellow-800 space-y-1">
                          {validationResult.issues.orphaned_by_disabled_course.slice(0, 5).map((cert: any) => (
                            <li key={cert.id}>
                              User: {cert.user_id.slice(0, 8)}... | Course: {cert.course_id.slice(0, 8)}...
                            </li>
                          ))}
                          {validationResult.issues.orphaned_by_disabled_course.length > 5 && (
                            <li className="font-semibold">
                              ... and {validationResult.issues.orphaned_by_disabled_course.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {validationResult.issues?.missing_course?.length > 0 && (
                      <div className="p-3 bg-red-50 rounded border border-red-200">
                        <p className="text-sm font-semibold text-red-900 mb-2">
                          Missing Course References:
                        </p>
                        <p className="text-xs text-red-800">
                          {validationResult.issues.missing_course.length} certificate(s) reference non-existent courses
                        </p>
                      </div>
                    )}

                    {validationResult.issues?.missing_user?.length > 0 && (
                      <div className="p-3 bg-red-50 rounded border border-red-200">
                        <p className="text-sm font-semibold text-red-900 mb-2">
                          Missing User References:
                        </p>
                        <p className="text-xs text-red-800">
                          {validationResult.issues.missing_user.length} certificate(s) reference non-existent users
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-red-600">Error: {validationResult.error?.message || 'Unknown error'}</p>
            )}
          </div>
        )}
      </div>

      {/* Cleanup Section */}
      {hasIssues && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Step 2: Clean Up Issues</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cleanup Type:</label>
              <select
                value={cleanupType}
                onChange={(e) => setCleanupType(e.target.value as 'orphaned' | 'all')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="orphaned">Orphaned Only (Disabled Courses)</option>
                <option value="all">All Issues (Orphaned + Missing)</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Dry Run (Preview only, don't delete)
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={handleCleanup}
            disabled={cleanupInProgress || !hasIssues}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${cleanupInProgress || !hasIssues
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : dryRun
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
          >
            {cleanupInProgress ? 'Processing...' : dryRun ? 'Preview Cleanup' : 'Delete Certificates'}
          </button>

          {cleanupResult && (
            <div
              className={`p-4 rounded-lg border-2 ${cleanupResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
                }`}
            >
              {cleanupResult.success ? (
                <>
                  {cleanupResult.dry_run ? (
                    <>
                      <p className="font-semibold text-green-900 mb-2">
                        ✓ DRY RUN: Would delete {cleanupResult.would_delete} certificates
                      </p>
                      <p className="text-sm text-green-800">
                        When ready, uncheck "Dry Run" above and click again to permanently delete.
                      </p>
                    </>
                  ) : (
                    <p className="font-semibold text-green-900">
                      ✓ Successfully deleted {cleanupResult.cleaned} certificates
                    </p>
                  )}
                </>
              ) : (
                <p className="text-red-600 font-semibold">
                  Error: {cleanupResult.error?.message || 'Unknown error'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ What This Does</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Validate:</strong> Detects certificates for disabled courses or with invalid references</li>
          <li>• <strong>Orphaned Only:</strong> Removes certificates issued when the course had certificates enabled, but the course is now disabled</li>
          <li>• <strong>All Issues:</strong> Also removes certificates with missing course/user references</li>
          <li>• <strong>Dry Run:</strong> Preview what would be deleted without making changes</li>
        </ul>
      </div>
    </div>
  );
};

export default CertificateManagement;
