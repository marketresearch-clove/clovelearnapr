/**
 * Admin API: Certificate Signatures Backfill
 *
 * Endpoints for backfilling missing certificate signatures for certificates
 * that were issued before proper signature linking was implemented.
 *
 * Usage:
 * GET /api/admin/backfill-certificates?action=stats - Get backfill statistics
 * POST /api/admin/backfill-certificates?action=preview - Preview what would be backfilled (dry-run)
 * POST /api/admin/backfill-certificates?action=backfill - Execute backfill
 */

import { certificateBackfillService } from '../../lib/certificateBackfillService';

export default async function handler(req: any, res: any) {
  try {
    // Verify admin access
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action } = req.query;

    // GET: Get backfill statistics
    if (req.method === 'GET' && action === 'stats') {
      const stats = await certificateBackfillService.getBackfillStatistics();
      return res.status(200).json(stats);
    }

    // POST: Preview backfill (dry-run)
    if (req.method === 'POST' && action === 'preview') {
      const result = await certificateBackfillService.backfillAllMissingSignatures(true);
      return res.status(200).json(result);
    }

    // POST: Execute backfill
    if (req.method === 'POST' && action === 'backfill') {
      const result = await certificateBackfillService.backfillAllMissingSignatures(false);
      return res.status(200).json(result);
    }

    // POST: Backfill a single certificate
    if (req.method === 'POST' && action === 'backfill-single') {
      const { certificateId } = req.body;

      if (!certificateId) {
        return res.status(400).json({ error: 'certificateId is required' });
      }

      const result = await certificateBackfillService.backfillCertificateSignatures(
        certificateId
      );
      return res.status(200).json(result);
    }

    // GET: Find certificates needing backfill
    if (req.method === 'GET' && action === 'find-missing') {
      const result = await certificateBackfillService.findCertificatesWithoutSignatures();
      return res.status(200).json(result);
    }

    // Invalid action
    return res.status(400).json({
      error: 'Invalid action',
      validActions: ['stats', 'preview', 'backfill', 'backfill-single', 'find-missing'],
    });
  } catch (error) {
    console.error('Error in backfill-certificates endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error,
    });
  }
}
