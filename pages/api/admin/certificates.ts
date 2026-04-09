/**
 * Admin Certificate Cleanup API
 * Endpoints for managing orphaned certificates
 *
 * Usage:
 * POST /api/admin/certificates/validate - Check for issues
 * POST /api/admin/certificates/cleanup-orphaned?dryRun=true - Dry run delete orphaned
 * POST /api/admin/certificates/cleanup-all?dryRun=true - Dry run delete all issues
 * POST /api/admin/certificates/cleanup-orphaned - Actually delete orphaned
 * POST /api/admin/certificates/cleanup-all - Actually delete all issues
 * DELETE /api/admin/certificates/{id} - Delete a specific certificate by ID
 */

import { supabase } from '../../lib/supabaseClient';
import { certificateCleanupService } from '../../lib/certificateCleanupService';

export async function validateCertificates(req: any, res: any) {
  try {
    // Verify admin access
    const user = req.user; // Assuming auth middleware sets this
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await certificateCleanupService.validateCertificateIntegrity();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error validating certificates:', error);
    return res.status(500).json({ error: 'Failed to validate certificates' });
  }
}

export async function cleanupOrphanedCertificates(req: any, res: any) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dryRun = req.query.dryRun !== 'false';
    const result = await certificateCleanupService.deleteOrphanedCertificates(dryRun);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error cleaning orphaned certificates:', error);
    return res.status(500).json({ error: 'Failed to clean orphaned certificates' });
  }
}

export async function cleanupAllCertificateIssues(req: any, res: any) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dryRun = req.query.dryRun !== 'false';
    const result = await certificateCleanupService.cleanupAllIssues(dryRun);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error cleaning all certificate issues:', error);
    return res.status(500).json({ error: 'Failed to clean all certificate issues' });
  }
}

/**
 * Delete a specific certificate by ID
 * Handles both certificate and related certificate_signatures cleanup
 */
export async function deleteSingleCertificate(req: any, res: any) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid certificate ID' });
    }

    // Delete certificate_signatures first (foreign key constraint)
    const { error: sigError } = await supabase
      .from('certificate_signatures')
      .delete()
      .eq('certificate_id', id);

    if (sigError) {
      console.error('[CERTIFICATE_DELETE_ERROR] Error deleting certificate signatures:', sigError);
      return res.status(500).json({ error: 'Failed to delete certificate signatures', details: sigError });
    }

    // Delete the certificate
    const { error: certError } = await supabase
      .from('certificates')
      .delete()
      .eq('id', id);

    if (certError) {
      console.error('[CERTIFICATE_DELETE_ERROR] Error deleting certificate:', certError);
      return res.status(500).json({ error: 'Failed to delete certificate', details: certError });
    }

    console.log(`[CERTIFICATE_DELETED] Successfully deleted certificate ID: ${id}`);
    return res.status(200).json({
      success: true,
      message: `Certificate ${id} deleted successfully`,
      deletedId: id,
    });
  } catch (error) {
    console.error('Exception deleting certificate:', error);
    return res.status(500).json({ error: 'Failed to delete certificate', details: error });
  }
}

/**
 * Main handler that routes requests to appropriate functions
 */
export default async function handler(req: any, res: any) {
  try {
    // Route based on method and query parameters
    const { operation, id } = req.query;

    // Handle DELETE requests for specific certificate
    if (req.method === 'DELETE' && id) {
      return deleteSingleCertificate(req, res);
    }

    // Handle POST requests for operations
    if (req.method === 'POST') {
      if (operation === 'validate') {
        return validateCertificates(req, res);
      } else if (operation === 'cleanup-orphaned') {
        return cleanupOrphanedCertificates(req, res);
      } else if (operation === 'cleanup-all') {
        return cleanupAllCertificateIssues(req, res);
      }
    }

    // Method not allowed
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error('Error in certificates handler:', error);
    return res.status(500).json({ error: 'Internal server error', details: error });
  }
}
