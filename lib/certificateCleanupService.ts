/**
 * Certificate Cleanup Service
 * Handles orphaned certificate detection and cleanup
 * for courses that have been disabled after certificates were issued
 */

import { supabase } from './supabaseClient';

export const certificateCleanupService = {
  /**
   * Find all orphaned certificates
   * Orphaned = issued for a course that currently has certificate_enabled = false
   */
  findOrphanedCertificates: async () => {
    try {
      const { data: orphaned, error } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          course_id,
          issued_at,
          courses:course_id (
            id,
            title,
            certificate_enabled
          )
        `)
        .eq('courses.certificate_enabled', false);

      if (error) {
        console.error('Error finding orphaned certificates:', error);
        return { success: false, error };
      }

      const orphanedList = orphaned || [];
      console.log(`[CERTIFICATE_CLEANUP] Found ${orphanedList.length} orphaned certificates`);

      return {
        success: true,
        count: orphanedList.length,
        certificates: orphanedList,
      };
    } catch (error) {
      console.error('Exception in findOrphanedCertificates:', error);
      return { success: false, error };
    }
  },

  /**
   * Delete orphaned certificates (certificates for disabled courses)
   * @param dryRun - if true, only report what would be deleted without actually deleting
   */
  deleteOrphanedCertificates: async (dryRun: boolean = true) => {
    try {
      // First, find orphaned certificates
      const findResult = await certificateCleanupService.findOrphanedCertificates();

      if (!findResult.success || !findResult.certificates) {
        return findResult;
      }

      const orphanedIds = findResult.certificates.map((cert: any) => cert.id);

      if (orphanedIds.length === 0) {
        console.log('[CERTIFICATE_CLEANUP] No orphaned certificates found');
        return {
          success: true,
          deleted: 0,
          message: 'No orphaned certificates to delete',
        };
      }

      if (dryRun) {
        console.log(`[CERTIFICATE_CLEANUP_DRY_RUN] Would delete ${orphanedIds.length} orphaned certificates:`, orphanedIds);
        return {
          success: true,
          dry_run: true,
          would_delete: orphanedIds.length,
          certificateIds: orphanedIds,
        };
      }

      // Delete certificate_signatures first (foreign key constraint)
      const { error: sigError } = await supabase
        .from('certificate_signatures')
        .delete()
        .in('certificate_id', orphanedIds);

      if (sigError) {
        console.error('[CERTIFICATE_CLEANUP_ERROR] Error deleting certificate signatures:', sigError);
        return { success: false, error: sigError };
      }

      // Delete certificates
      const { error: certError } = await supabase
        .from('certificates')
        .delete()
        .in('id', orphanedIds);

      if (certError) {
        console.error('[CERTIFICATE_CLEANUP_ERROR] Error deleting certificates:', certError);
        return { success: false, error: certError };
      }

      console.log(`[CERTIFICATE_CLEANUP_SUCCESS] Deleted ${orphanedIds.length} orphaned certificates`);
      return {
        success: true,
        deleted: orphanedIds.length,
        certificateIds: orphanedIds,
      };
    } catch (error) {
      console.error('[CERTIFICATE_CLEANUP_EXCEPTION] Exception in deleteOrphanedCertificates:', error);
      return { success: false, error };
    }
  },

  /**
   * Validate certificate integrity
   * Check for:
   * 1. Certificates for disabled courses
   * 2. Certificates without corresponding course
   * 3. Certificates without corresponding user
   */
  validateCertificateIntegrity: async () => {
    try {
      const issues = {
        orphaned_by_disabled_course: [] as any[],
        missing_course: [] as any[],
        missing_user: [] as any[],
      };

      // Check 1: Certificates for disabled courses
      const { data: disabledCourseCerts, error: err1 } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          course_id,
          courses:course_id (
            id,
            title,
            certificate_enabled
          )
        `);

      if (!err1 && disabledCourseCerts) {
        issues.orphaned_by_disabled_course = disabledCourseCerts.filter(
          (cert: any) => cert.courses && cert.courses.certificate_enabled === false
        );
      }

      // Check 2: Certificates with non-existent course
      const { data: allCerts, error: err2 } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          course_id,
          courses:course_id (id)
        `);

      if (!err2 && allCerts) {
        issues.missing_course = allCerts.filter((cert: any) => !cert.courses);
      }

      // Check 3: Certificates with non-existent user
      const { data: certsWithUsers, error: err3 } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          course_id,
          profiles:user_id (id)
        `);

      if (!err3 && certsWithUsers) {
        issues.missing_user = certsWithUsers.filter((cert: any) => !cert.profiles);
      }

      const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);

      console.log(`[CERTIFICATE_VALIDATION] Total issues found: ${totalIssues}`);
      console.log(`  - Orphaned (disabled course): ${issues.orphaned_by_disabled_course.length}`);
      console.log(`  - Missing course: ${issues.missing_course.length}`);
      console.log(`  - Missing user: ${issues.missing_user.length}`);

      return {
        success: true,
        total_issues: totalIssues,
        issues,
      };
    } catch (error) {
      console.error('[CERTIFICATE_VALIDATION_ERROR] Exception in validateCertificateIntegrity:', error);
      return { success: false, error };
    }
  },

  /**
   * Clean up ALL found issues (more aggressive)
   * Deletes:
   * - Certificates for disabled courses
   * - Certificates with missing course
   * - Certificates with missing user
   */
  cleanupAllIssues: async (dryRun: boolean = true) => {
    try {
      const validation = await certificateCleanupService.validateCertificateIntegrity();

      if (!validation.success) {
        return validation;
      }

      const { issues } = validation;
      const allIssueIds = [
        ...issues.orphaned_by_disabled_course.map((c: any) => c.id),
        ...issues.missing_course.map((c: any) => c.id),
        ...issues.missing_user.map((c: any) => c.id),
      ];

      // Deduplicate
      const uniqueIds = [...new Set(allIssueIds)];

      if (uniqueIds.length === 0) {
        return {
          success: true,
          message: 'No certificate issues to clean',
          cleaned: 0,
        };
      }

      if (dryRun) {
        console.log(`[CERTIFICATE_CLEANUP_DRY_RUN] Would delete ${uniqueIds.length} problematic certificates`);
        return {
          success: true,
          dry_run: true,
          would_delete: uniqueIds.length,
          certificateIds: uniqueIds,
        };
      }

      // Delete certificate_signatures first
      const { error: sigError } = await supabase
        .from('certificate_signatures')
        .delete()
        .in('certificate_id', uniqueIds);

      if (sigError) {
        console.error('[CERTIFICATE_CLEANUP_ERROR] Error deleting signatures:', sigError);
        return { success: false, error: sigError };
      }

      // Delete certificates
      const { error: certError } = await supabase
        .from('certificates')
        .delete()
        .in('id', uniqueIds);

      if (certError) {
        console.error('[CERTIFICATE_CLEANUP_ERROR] Error deleting certificates:', certError);
        return { success: false, error: certError };
      }

      console.log(`[CERTIFICATE_CLEANUP_SUCCESS] Cleaned ${uniqueIds.length} problematic certificates`);
      return {
        success: true,
        cleaned: uniqueIds.length,
        certificateIds: uniqueIds,
      };
    } catch (error) {
      console.error('[CERTIFICATE_CLEANUP_EXCEPTION] Exception in cleanupAllIssues:', error);
      return { success: false, error };
    }
  },
};
