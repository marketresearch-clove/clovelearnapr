/**
 * Certificate Validation Service
 *
 * Ensures certificates are only issued for courses with certificate_enabled = true
 * Provides utilities to:
 * - Check certificate eligibility for courses
 * - Clean up invalid certificates
 * - Monitor certificate validation status
 */

import { supabase } from './supabaseClient';

export const certificateValidationService = {
  /**
   * Check if a course is eligible to issue certificates
   * @param courseId - The course ID to check
   * @returns true if certificate_enabled = true, false otherwise
   */
  isCertificateEnabledForCourse: async (courseId: string): Promise<boolean> => {
    try {
      const { data: course, error } = await supabase
        .from('courses')
        .select('certificate_enabled, title')
        .eq('id', courseId)
        .single();

      if (error || !course) {
        console.warn(`⚠️ [CERT_VALIDATION] Course not found: ${courseId}`);
        return false;
      }

      // Strict check: must be explicitly true
      const isEnabled = course.certificate_enabled === true;

      console.log(
        `[CERT_VALIDATION] Course "${course.title}" (${courseId}): ` +
        `certificate_enabled = ${course.certificate_enabled} → ${isEnabled ? 'ENABLED' : 'DISABLED'}`
      );

      return isEnabled;
    } catch (error) {
      console.error(`❌ [CERT_VALIDATION] Error checking course eligibility:`, error);
      return false;
    }
  },

  /**
   * Get all invalid certificates (certificates for courses with certificate_enabled != true)
   * @returns List of invalid certificates with course information
   */
  getInvalidCertificates: async () => {
    try {
      const { data: invalid, error } = await supabase
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
        .in('course_id', (
          await supabase
            .from('courses')
            .select('id')
            .not('certificate_enabled', 'eq', true)
        ).data?.map((c: any) => c.id) ?? []);

      if (error) {
        console.error('❌ Error fetching invalid certificates:', error);
        return [];
      }

      return invalid || [];
    } catch (error) {
      console.error('❌ Error in getInvalidCertificates:', error);
      return [];
    }
  },

  /**
   * Delete invalid certificates for disabled courses
   * This should be run as a cleanup operation
   * Returns count of deleted certificates
   */
  cleanupInvalidCertificates: async (): Promise<number> => {
    try {
      console.log('🧹 Starting certificate validation cleanup...');

      // Get invalid certificates before deletion (for audit trail)
      const invalid = await certificateValidationService.getInvalidCertificates();

      if (invalid.length === 0) {
        console.log('✅ No invalid certificates found. Database is clean.');
        return 0;
      }

      console.log(`⚠️ Found ${invalid.length} invalid certificates to delete`);

      // Log each invalid certificate
      for (const cert of invalid) {
        console.warn(
          `  - Certificate ${cert.id} for user ${cert.user_id} ` +
          `on course "${(cert as any).courses?.title}" ` +
          `(certificate_enabled: ${(cert as any).courses?.certificate_enabled})`
        );
      }

      // Delete invalid certificates
      const { error: deleteError } = await supabase
        .from('certificates')
        .delete()
        .in('course_id', (
          await supabase
            .from('courses')
            .select('id')
            .not('certificate_enabled', 'eq', true)
        ).data?.map((c: any) => c.id) ?? []);

      if (deleteError) {
        console.error('❌ Error deleting invalid certificates:', deleteError);
        return 0;
      }

      console.log(`✅ Successfully deleted ${invalid.length} invalid certificates`);
      return invalid.length;
    } catch (error) {
      console.error('❌ Error in cleanupInvalidCertificates:', error);
      return 0;
    }
  },

  /**
   * Get certificate validation status for all courses
   * Shows which courses can issue certificates and how many they've issued
   */
  getCertificateValidationStatus: async () => {
    try {
      const { data: status, error } = await supabase
        .from('certificate_validation_status')
        .select('*');

      if (error) {
        console.error('❌ Error fetching validation status:', error);
        return [];
      }

      return status || [];
    } catch (error) {
      console.error('❌ Error in getCertificateValidationStatus:', error);
      return [];
    }
  },

  /**
   * Validate that all existing certificates are for enabled courses
   * Returns validation result with any violations found
   */
  validateAllCertificates: async () => {
    try {
      const invalid = await certificateValidationService.getInvalidCertificates();
      const enabled = await supabase
        .from('certificates')
        .select('id')
        .in('course_id', (
          await supabase
            .from('courses')
            .select('id')
            .eq('certificate_enabled', true)
        ).data?.map((c: any) => c.id) ?? []);

      return {
        valid: enabled.data?.length ?? 0,
        invalid: invalid.length,
        isClean: invalid.length === 0,
        violations: invalid.map(cert => ({
          certificateId: cert.id,
          userId: cert.user_id,
          courseId: cert.course_id,
          courseTitle: (cert as any).courses?.title,
          certificateEnabled: (cert as any).courses?.certificate_enabled
        }))
      };
    } catch (error) {
      console.error('❌ Error validating certificates:', error);
      return {
        valid: -1,
        invalid: -1,
        isClean: false,
        error: String(error)
      };
    }
  },

  /**
   * Log certificate operation for audit trail
   */
  logCertificateOperation: async (
    action: 'ISSUED' | 'BLOCKED' | 'DELETED',
    userId: string,
    courseId: string,
    courseTitle: string,
    reason?: string
  ) => {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${action} - User: ${userId}, Course: "${courseTitle}" (${courseId}) ${reason ? `- Reason: ${reason}` : ''}`;

      console.log(logMessage);

      // Optionally store in database
      // Note: This would require a certificate_operations_log table
    } catch (error) {
      console.error('❌ Error logging certificate operation:', error);
    }
  }
};

/**
 * USAGE EXAMPLES:
 *
 * // Check if a course can issue certificates
 * const canIssue = await certificateValidationService.isCertificateEnabledForCourse('course-id');
 *
 * // Get all invalid certificates
 * const invalid = await certificateValidationService.getInvalidCertificates();
 *
 * // Clean up invalid certificates
 * const deleted = await certificateValidationService.cleanupInvalidCertificates();
 *
 * // Get validation status for monitoring
 * const status = await certificateValidationService.getCertificateValidationStatus();
 *
 * // Validate all certificates in the system
 * const validation = await certificateValidationService.validateAllCertificates();
 * if (!validation.isClean) {
 *   console.error('Found invalid certificates:', validation.violations);
 * }
 */
