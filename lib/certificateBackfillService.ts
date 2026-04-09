/**
 * Certificate Signatures Backfill Service
 *
 * Backfills missing certificate signatures for certificates that were issued
 * before the proper signature linking was implemented.
 *
 * Usage:
 *   - await certificateBackfillService.backfillAllMissingSignatures()
 *   - await certificateBackfillService.backfillCertificateSignatures(certificateId)
 */

import { supabase } from './supabaseClient';
import { getEnabledSignatures } from './certificateSignatureService';

export const certificateBackfillService = {
  /**
   * Find all certificates that don't have any signatures linked
   */
  findCertificatesWithoutSignatures: async () => {
    try {
      const { data: certificatesWithoutSigs, error } = await supabase
        .from('certificates')
        .select('id, user_id, course_id, issued_at, courses:course_id(title)')
        .not(
          'id',
          'in',
          '(SELECT DISTINCT certificate_id FROM certificate_signatures)'
        )
        .order('issued_at', { ascending: false });

      if (error) {
        console.error('Error finding certificates without signatures:', error);
        return { success: false, error, certificates: [] };
      }

      console.log(
        `[BACKFILL] Found ${certificatesWithoutSigs?.length || 0} certificates without signatures`
      );

      return {
        success: true,
        count: certificatesWithoutSigs?.length || 0,
        certificates: certificatesWithoutSigs || [],
      };
    } catch (error) {
      console.error('Exception in findCertificatesWithoutSignatures:', error);
      return { success: false, error, certificates: [] };
    }
  },

  /**
   * Backfill signatures for a single certificate
   */
  backfillCertificateSignatures: async (certificateId: string) => {
    try {
      // Get the certificate details
      const { data: certificate, error: certError } = await supabase
        .from('certificates')
        .select('id, user_id, course_id, courses:course_id(title)')
        .eq('id', certificateId)
        .single();

      if (certError || !certificate) {
        console.error('Certificate not found:', certError);
        return { success: false, error: certError };
      }

      // Get enabled signatures at the time of issuance
      // (or current enabled signatures as fallback)
      const enabledSignatures = await getEnabledSignatures();

      if (!enabledSignatures || enabledSignatures.length === 0) {
        console.log(
          `[BACKFILL] No enabled signatures found for certificate ${certificateId}`
        );
        return {
          success: true,
          certificateId,
          signaturesAdded: 0,
          message: 'No enabled signatures to backfill',
        };
      }

      // Prepare signature link data
      const signatureLinkData = enabledSignatures.map((sig: any) => ({
        certificate_id: certificateId,
        signature_id: sig.id,
        display_order: sig.display_order,
        signature_name: sig.name,
        signature_designation: sig.designation,
        signature_text: sig.signature_text,
        signature_image_url: sig.signature_image_url,
      }));

      // Insert signatures (with conflict handling)
      const { error: insertError, data: inserted } = await supabase
        .from('certificate_signatures')
        .insert(signatureLinkData)
        .select('id');

      if (insertError) {
        console.error('[BACKFILL] Error inserting signatures:', insertError);
        return { success: false, error: insertError };
      }

      console.log(
        `[BACKFILL] Backfilled ${inserted?.length || 0} signatures for certificate ${certificateId} (Course: "${certificate.courses?.title}")`
      );

      return {
        success: true,
        certificateId,
        signaturesAdded: inserted?.length || 0,
        message: `Successfully backfilled ${inserted?.length || 0} signatures`,
      };
    } catch (error) {
      console.error('Exception in backfillCertificateSignatures:', error);
      return { success: false, error };
    }
  },

  /**
   * Backfill signatures for all certificates without them
   */
  backfillAllMissingSignatures: async (dryRun = false) => {
    try {
      console.log(
        `[BACKFILL] Starting backfill process (dryRun: ${dryRun})...`
      );

      // Find all certificates without signatures
      const findResult =
        await certificateBackfillService.findCertificatesWithoutSignatures();

      if (!findResult.success || !findResult.certificates) {
        return { success: false, error: findResult.error, backfilled: 0 };
      }

      const certificatesToBackfill = findResult.certificates;

      if (certificatesToBackfill.length === 0) {
        console.log('[BACKFILL] No certificates need backfilling');
        return { success: true, backfilled: 0, message: 'No backfill needed' };
      }

      if (dryRun) {
        console.log(
          `[BACKFILL_DRY_RUN] Would backfill ${certificatesToBackfill.length} certificates`
        );
        return {
          success: true,
          dry_run: true,
          would_backfill: certificatesToBackfill.length,
          certificateIds: certificatesToBackfill.map((c: any) => c.id),
        };
      }

      // Backfill each certificate
      let successCount = 0;
      let failureCount = 0;
      const results = [];

      for (const cert of certificatesToBackfill) {
        const result = await certificateBackfillService.backfillCertificateSignatures(
          cert.id
        );

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }

        results.push({
          certificateId: cert.id,
          courseTitle: cert.courses?.title,
          ...result,
        });
      }

      console.log(
        `[BACKFILL_COMPLETE] Backfilled ${successCount} certificates, ${failureCount} failed`
      );

      return {
        success: true,
        backfilled: successCount,
        failed: failureCount,
        total: certificatesToBackfill.length,
        results,
        message: `Successfully backfilled ${successCount} of ${certificatesToBackfill.length} certificates`,
      };
    } catch (error) {
      console.error('Exception in backfillAllMissingSignatures:', error);
      return { success: false, error, backfilled: 0 };
    }
  },

  /**
   * Get backfill statistics
   */
  getBackfillStatistics: async () => {
    try {
      // Total certificates
      const { data: allCerts, error: certsError } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true });

      // Certificates with at least one signature
      const { data: certsWithSigs, error: sigsError } = await supabase
        .from('certificate_signatures')
        .select('certificate_id', { count: 'exact', head: true })
        .distinct();

      if (certsError || sigsError) {
        return {
          success: false,
          error: certsError || sigsError,
        };
      }

      const totalCerts = allCerts?.length || 0;
      const certsWithSignatures = certsWithSigs?.length || 0;
      const certsMissingSignatures = totalCerts - certsWithSignatures;

      return {
        success: true,
        statistics: {
          total_certificates: totalCerts,
          certificates_with_signatures: certsWithSignatures,
          certificates_missing_signatures: certsMissingSignatures,
          coverage_percentage:
            totalCerts > 0
              ? ((certsWithSignatures / totalCerts) * 100).toFixed(2)
              : '0',
        },
      };
    } catch (error) {
      console.error('Exception in getBackfillStatistics:', error);
      return { success: false, error };
    }
  },
};
