import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { sessionAutoCloseService } from '../../lib/sessionAutoCloseService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const supabase = createServerSupabaseClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin (optional - remove if not using roles)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    const { action } = req.query;

    /**
     * GET /api/session-admin?action=health
     * Check session and time tracking health
     * PUBLIC: anyone can check
     */
    if (req.method === 'GET' && action === 'health') {
      const health = await sessionAutoCloseService.getHealthStatus();
      return res.status(200).json(health);
    }

    /**
     * GET /api/session-admin?action=discrepancies
     * Find sessions with time discrepancies
     * ADMIN ONLY
     */
    if (req.method === 'GET' && action === 'discrepancies') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await sessionAutoCloseService.findDiscrepancies();
      return res.status(200).json(result);
    }

    /**
     * GET /api/session-admin?action=stale-sessions
     * Find stale sessions (open > 2 hours)
     * ADMIN ONLY
     */
    if (req.method === 'GET' && action === 'stale-sessions') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await sessionAutoCloseService.getStaleSessions();
      return res.status(200).json(result);
    }

    /**
     * POST /api/session-admin?action=close-stale
     * Close all stale sessions (> 2 hours)
     * ADMIN ONLY - CRITICAL FOR FIX #2
     */
    if (req.method === 'POST' && action === 'close-stale') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await sessionAutoCloseService.closeStaleSessionsJob();
      return res.status(200).json({
        success: result.success,
        closedCount: result.closedCount,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    }

    /**
     * POST /api/session-admin?action=reconcile-durations
     * Fix session durations based on lesson logs
     * ADMIN ONLY - CRITICAL FOR FIX #3
     */
    if (req.method === 'POST' && action === 'reconcile-durations') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await sessionAutoCloseService.reconcileSessionDurations();
      return res.status(200).json({
        success: result.success,
        updatedCount: result.updatedCount,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(400).json({
      error: `Unknown action: ${action}`,
      availableActions: [
        'health',             // public
        'discrepancies',      // admin
        'stale-sessions',     // admin
        'close-stale',        // admin
        'reconcile-durations' // admin
      ],
    });
  } catch (error) {
    console.error('[SESSION_ADMIN_API] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
