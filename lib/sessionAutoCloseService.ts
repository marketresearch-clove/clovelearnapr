/**
 * Session Auto-Close Service
 * Backend job to close stale sessions
 * Should be called by cron job every 30 minutes
 */

import { supabase } from './supabaseClient';

export const sessionAutoCloseService = {
  /**
   * Auto-close sessions that have been open > 2 hours
   * CRITICAL FIX #2: Ensures sessions don't stay open forever
   *
   * Call this via:
   * - Cron job every 30 minutes
   * - Scheduled Supabase function
   * - Manual endpoint in admin API
   */
  async closeStaleSessionsJob(): Promise<{
    success: boolean;
    closedCount: number;
    message: string;
  }> {
    try {
      const { data, error } = await supabase.rpc(
        'auto_close_stale_sessions'
      );

      if (error) throw error;

      const closedCount = data?.[0]?.closed_count || 0;

      console.log(
        `[SESSION_AUTO_CLOSE] Closed ${closedCount} stale sessions (older than 2 hours)`
      );

      return {
        success: true,
        closedCount,
        message: `Successfully closed ${closedCount} stale sessions`,
      };
    } catch (error) {
      console.error('[SESSION_AUTO_CLOSE] Error:', error);
      return {
        success: false,
        closedCount: 0,
        message: `Error closing stale sessions: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * Reconcile session durations
   * Fixes sessions where duration was calculated incorrectly
   * Duration should always be SUM(lesson_time_logs), not wall-clock time
   */
  async reconcileSessionDurations(): Promise<{
    success: boolean;
    updatedCount: number;
    message: string;
  }> {
    try {
      const { data, error } = await supabase.rpc(
        'recalculate_session_duration'
      );

      if (error) throw error;

      const updatedCount = data?.[0]?.updated_count || 0;

      console.log(
        `[SESSION_RECONCILE] Updated ${updatedCount} session durations`
      );

      return {
        success: true,
        updatedCount,
        message: `Successfully updated ${updatedCount} session durations`,
      };
    } catch (error) {
      console.error('[SESSION_RECONCILE] Error:', error);
      return {
        success: false,
        updatedCount: 0,
        message: `Error reconciling durations: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * Find sessions with discrepancies
   * CRITICAL: Use for monitoring and debugging
   */
  async findDiscrepancies() {
    try {
      const { data, error } = await supabase
        .from('v_time_discrepancies')
        .select('*')
        .order('discrepancy_seconds', { ascending: false })
        .limit(10);

      if (error) throw error;

      return {
        success: true,
        discrepancies: data || [],
      };
    } catch (error) {
      console.error('[SESSION_DISCREPANCIES] Error:', error);
      return {
        success: false,
        discrepancies: [],
      };
    }
  },

  /**
   * Get all stale sessions (open for > 2 hours)
   */
  async getStaleSessions() {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('is_completed', false)
        .lt('session_start', twoHoursAgo)
        .order('session_start', { ascending: true });

      if (error) throw error;

      console.log(`[STALE_SESSIONS] Found ${(data || []).length} stale sessions`);

      return {
        success: true,
        staleSessions: data || [],
        count: (data || []).length,
      };
    } catch (error) {
      console.error('[STALE_SESSIONS] Error:', error);
      return {
        success: false,
        staleSessions: [],
        count: 0,
      };
    }
  },

  /**
   * Health check: Show session and time tracking health
   */
  async getHealthStatus() {
    try {
      // Get stale sessions
      const staleResult = await this.getStaleSessions();

      // Get discrepancies
      const discrepResult = await this.findDiscrepancies();

      // Get session counts
      const { data: sessionData, error: sessionError } = await supabase
        .from('learning_sessions')
        .select('id, is_completed')
        .eq('is_completed', false);

      const activeSessions = (sessionData || []).length;

      return {
        success: true,
        health: {
          activeSessions,
          staleSessions: staleResult.count,
          discrepancies: discrepResult.discrepancies.length,
          status: activeSessions === 0 ? 'healthy' : staleResult.count > 0 ? 'warning' : 'good',
        },
      };
    } catch (error) {
      console.error('[HEALTH_CHECK] Error:', error);
      return {
        success: false,
        health: {
          activeSessions: 0,
          staleSessions: 0,
          discrepancies: 0,
          status: 'error',
        },
      };
    }
  },
};
