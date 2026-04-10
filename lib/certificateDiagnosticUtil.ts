/**
 * Certificate Diagnostic Utility
 *
 * Run diagnostics and repair certificate signature issues
 *
 * Usage:
 * ```typescript
 * import { certificateDiagnosticUtil } from './lib/certificateDiagnosticUtil';
 *
 * // Check specific certificate
 * const diagnosis = await certificateDiagnosticUtil.diagnosticCertificate('cert-id-here');
 *
 * // Find all certificates without signatures
 * const broken = await certificateDiagnosticUtil.findCertificatesWithoutSignatures();
 *
 * // Auto-repair all broken certificates
 * const fixed = await certificateDiagnosticUtil.autoRepairAllCertificates();
 * ```
 */

import { supabase } from './supabaseClient';
import { certificateBackfillService } from './certificateBackfillService';
import { getEnabledSignatures } from './certificateSignatureService';

export interface CertificateDiagnosis {
  certificateId: string;
  userId: string;
  courseTitle: string;
  status: 'healthy' | 'missing_signatures' | 'no_enabled_signatures' | 'error';
  linkedSignatures: number;
  availableSignatures: number;
  retakeCount: number;
  canBackfill: boolean;
  issues: string[];
  recommendations: string[];
}

export const certificateDiagnosticUtil = {
  /**
   * Diagnose a specific certificate
   */
  diagnosticCertificate: async (certificateId: string): Promise<CertificateDiagnosis | null> => {
    try {
      // Get certificate
      const { data: cert } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          course_id,
          issued_at,
          courses:course_id (title, certificate_enabled),
          profiles:user_id (fullname)
        `)
        .eq('id', certificateId)
        .single();

      if (!cert) {
        return null;
      }

      // Get linked signatures
      const { data: linkedSigs } = await supabase
        .from('certificate_signatures')
        .select('id')
        .eq('certificate_id', certificateId);

      // Get enabled signatures
      const enabledSigs = await getEnabledSignatures();

      // Get enrollment
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('retake_count')
        .eq('userid', cert.user_id)
        .eq('courseid', cert.course_id)
        .single();

      const linkedCount = linkedSigs?.length || 0;
      const availableCount = enabledSigs?.length || 0;
      const retakeCount = enrollment?.retake_count || 0;

      const diagnosis: CertificateDiagnosis = {
        certificateId: cert.id,
        userId: cert.user_id,
        courseTitle: cert.courses?.title || 'Unknown',
        status: 'healthy',
        linkedSignatures: linkedCount,
        availableSignatures: availableCount,
        retakeCount,
        canBackfill: availableCount > 0 && linkedCount === 0,
        issues: [],
        recommendations: []
      };

      // Diagnose issues
      if (linkedCount === 0) {
        diagnosis.status = 'missing_signatures';
        diagnosis.issues.push('No signatures linked to certificate');

        if (availableCount === 0) {
          diagnosis.status = 'no_enabled_signatures';
          diagnosis.issues.push('No enabled signatures exist in system');
          diagnosis.recommendations.push('Create and enable certificate signatures first');
        } else {
          diagnosis.issues.push(`${availableCount} enabled signatures available but not linked`);
          diagnosis.recommendations.push('Run backfill to link available signatures');
        }
      }

      return diagnosis;
    } catch (error) {
      console.error('Error in diagnosticCertificate:', error);
      return null;
    }
  },

  /**
   * Find all certificates without signatures
   */
  findCertificatesWithoutSignatures: async (): Promise<CertificateDiagnosis[]> => {
    try {
      // Get all certificates
      const { data: allCerts } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          course_id,
          courses:course_id (title),
          profiles:user_id (fullname)
        `)
        .order('issued_at', { ascending: false });

      if (!allCerts || allCerts.length === 0) {
        return [];
      }

      // Get certificates with signatures
      const { data: certsWithSigs } = await supabase
        .from('certificate_signatures')
        .select('certificate_id')
        .distinct();

      const certIdsWithSigs = new Set((certsWithSigs || []).map(c => c.certificate_id));

      // Get enabled signatures
      const enabledSigs = await getEnabledSignatures();

      // Filter certificates without signatures
      const certificatesWithoutSigs = allCerts.filter(c => !certIdsWithSigs.has(c.id));

      const diagnoses: CertificateDiagnosis[] = [];

      for (const cert of certificatesWithoutSigs) {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('retake_count')
          .eq('userid', cert.user_id)
          .eq('courseid', cert.course_id)
          .single();

        diagnoses.push({
          certificateId: cert.id,
          userId: cert.user_id,
          courseTitle: cert.courses?.title || 'Unknown',
          status: enabledSigs && enabledSigs.length > 0 ? 'missing_signatures' : 'no_enabled_signatures',
          linkedSignatures: 0,
          availableSignatures: enabledSigs?.length || 0,
          retakeCount: enrollment?.retake_count || 0,
          canBackfill: !!enabledSigs && enabledSigs.length > 0,
          issues: ['No signatures linked'],
          recommendations: [
            enabledSigs && enabledSigs.length > 0
              ? 'Run backfill'
              : 'Create and enable signatures first'
          ]
        });
      }

      return diagnoses;
    } catch (error) {
      console.error('Error in findCertificatesWithoutSignatures:', error);
      return [];
    }
  },

  /**
   * Auto-repair a single certificate
   */
  repairCertificate: async (certificateId: string): Promise<{ success: boolean; message: string; signaturesAdded?: number }> => {
    try {
      const diagnosis = await certificateDiagnosticUtil.diagnosticCertificate(certificateId);

      if (!diagnosis) {
        return { success: false, message: 'Certificate not found' };
      }

      if (diagnosis.linkedSignatures > 0) {
        return { success: true, message: 'Certificate already has signatures' };
      }

      if (!diagnosis.canBackfill) {
        return { success: false, message: 'No enabled signatures to backfill' };
      }

      const result = await certificateBackfillService.backfillCertificateSignatures(certificateId);

      if (result.success) {
        return {
          success: true,
          message: `Backfilled ${result.signaturesAdded} signatures`,
          signaturesAdded: result.signaturesAdded
        };
      } else {
        return { success: false, message: `Backfill failed: ${result.error}` };
      }
    } catch (error) {
      return { success: false, message: `Exception: ${String(error)}` };
    }
  },

  /**
   * Auto-repair all certificates without signatures
   */
  autoRepairAllCertificates: async (): Promise<{
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    skipCount: number;
    results: Array<{ certificateId: string; status: string; message: string }>;
  }> => {
    try {
      const broken = await certificateDiagnosticUtil.findCertificatesWithoutSignatures();

      const results = [];
      let successCount = 0;
      let failureCount = 0;
      let skipCount = 0;

      for (const diagnosis of broken) {
        if (!diagnosis.canBackfill) {
          skipCount++;
          results.push({
            certificateId: diagnosis.certificateId,
            status: 'skipped',
            message: 'No enabled signatures available'
          });
          continue;
        }

        const repairResult = await certificateDiagnosticUtil.repairCertificate(diagnosis.certificateId);

        if (repairResult.success) {
          successCount++;
          results.push({
            certificateId: diagnosis.certificateId,
            status: 'success',
            message: repairResult.message
          });
        } else {
          failureCount++;
          results.push({
            certificateId: diagnosis.certificateId,
            status: 'failed',
            message: repairResult.message
          });
        }
      }

      return {
        totalProcessed: broken.length,
        successCount,
        failureCount,
        skipCount,
        results
      };
    } catch (error) {
      console.error('Error in autoRepairAllCertificates:', error);
      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        skipCount: 0,
        results: []
      };
    }
  },

  /**
   * Get overall certificate health statistics
   */
  getHealthStatistics: async (): Promise<{
    totalCertificates: number;
    certificatesWithSignatures: number;
    certificatesWithoutSignatures: number;
    enabledSignatures: number;
    disabledSignatures: number;
    healthPercentage: string;
  }> => {
    try {
      // Total certificates
      const { data: allCerts } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true });

      // Certificates with signatures
      const { data: certsWithSigs } = await supabase
        .from('certificate_signatures')
        .select('certificate_id', { count: 'exact', head: true })
        .distinct();

      // Enabled signatures
      const enabledSigs = await getEnabledSignatures();

      // Disabled signatures
      const { data: disabledSigs } = await supabase
        .from('certificate_signature_settings')
        .select('id', { count: 'exact', head: true })
        .eq('is_enabled', false);

      const totalCerts = allCerts?.length || 0;
      const withSigs = certsWithSigs?.length || 0;

      return {
        totalCertificates: totalCerts,
        certificatesWithSignatures: withSigs,
        certificatesWithoutSignatures: totalCerts - withSigs,
        enabledSignatures: enabledSigs?.length || 0,
        disabledSignatures: disabledSigs?.length || 0,
        healthPercentage: totalCerts > 0 ? ((withSigs / totalCerts) * 100).toFixed(1) : '0'
      };
    } catch (error) {
      console.error('Error in getHealthStatistics:', error);
      return {
        totalCertificates: 0,
        certificatesWithSignatures: 0,
        certificatesWithoutSignatures: 0,
        enabledSignatures: 0,
        disabledSignatures: 0,
        healthPercentage: '0'
      };
    }
  }
};
