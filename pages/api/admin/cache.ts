import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { cacheService } from '../../lib/cacheService';

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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { action } = req.query;

    /**
     * POST /api/admin/cache?action=clear-all
     * Clear all cached data
     */
    if (req.method === 'POST' && action === 'clear-all') {
      cacheService.clearAll();
      return res.status(200).json({
        success: true,
        message: 'All cache cleared successfully',
      });
    }

    /**
     * POST /api/admin/cache?action=clear-progress
     * Clear progress-related cache (enrollments, lesson_progress, learning_hours)
     */
    if (req.method === 'POST' && action === 'clear-progress') {
      const cleared = {
        enrollments: cacheService.clearByPrefix('cache:enrollments:'),
        lesson_progress: cacheService.clearByPrefix('cache:lesson_progress:'),
        learning_hours: cacheService.clearByPrefix('cache:learning_hours:'),
        user_stats: cacheService.clearByPrefix('cache:user_stats:'),
      };

      return res.status(200).json({
        success: true,
        message: 'Progress cache cleared',
        cleared,
      });
    }

    /**
     * POST /api/admin/cache?action=clear-user&userId=UUID
     * Clear cache for specific user
     */
    if (req.method === 'POST' && action === 'clear-user') {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const cleared = {
        enrollments: cacheService.clearByPrefix(`cache:enrollments:${userId}`),
        lesson_progress: cacheService.clearByPrefix(`cache:lesson_progress:${userId}`),
        learning_hours: cacheService.clearByPrefix(`cache:learning_hours:${userId}`),
        user_stats: cacheService.clearByPrefix(`cache:user_stats:${userId}`),
      };

      return res.status(200).json({
        success: true,
        message: `Cache cleared for user ${userId}`,
        cleared,
      });
    }

    /**
     * GET /api/admin/cache?action=stats
     * Get cache statistics
     */
    if (req.method === 'GET' && action === 'stats') {
      return res.status(200).json({
        success: true,
        message: 'Cache statistics retrieved',
      });
    }

    return res.status(400).json({
      error: 'Unknown action',
      availableActions: [
        'clear-all',
        'clear-progress',
        'clear-user',
        'stats',
      ],
    });
  } catch (error) {
    console.error('[CACHE_ADMIN_API] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
