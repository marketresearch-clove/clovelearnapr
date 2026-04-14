import { supabase } from './supabaseClient';

/**
 * Idle Detection Service
 * Handles detection and management of idle sessions
 * 15-minute threshold: if no activity for 15 mins, session is considered idle
 */

export interface IdleSession {
  sessionId: string;
  userId: string;
  courseId: string;
  lessonId?: string;
  sessionStartTime: Date;
  lastActivityTime: Date;
  idleMinutes: number;
  isIdleExceeded: boolean;
}

export interface ActivityTracker {
  sessionId: string;
  userId: string;
  lastActivityAt: Date;
  currentIdleMinutes: number;
}

// In-memory store for tracking activity (in production, use Redis or database)
const activityTrackers = new Map<string, ActivityTracker>();
const IDLE_THRESHOLD_MINUTES = 15;
const IDLE_CHECK_INTERVAL_MINUTES = 5;

export const idleDetectionService = {
  /**
   * Track user activity for a session
   */
  recordActivity(sessionId: string, userId: string): void {
    const tracked = activityTrackers.get(sessionId);

    if (tracked) {
      tracked.lastActivityAt = new Date();
      tracked.currentIdleMinutes = 0;
    } else {
      activityTrackers.set(sessionId, {
        sessionId,
        userId,
        lastActivityAt: new Date(),
        currentIdleMinutes: 0,
      });
    }

    console.log(`[IDLE] Activity recorded for session ${sessionId}`);
  },

  /**
   * Check if a session is idle
   */
  isSessionIdle(sessionId: string): boolean {
    const tracked = activityTrackers.get(sessionId);
    if (!tracked) return false;

    const now = new Date();
    const diffMs = now.getTime() - tracked.lastActivityAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    return diffMinutes >= IDLE_THRESHOLD_MINUTES;
  },

  /**
   * Get idle time for session (in minutes)
   */
  getIdleMinutes(sessionId: string): number {
    const tracked = activityTrackers.get(sessionId);
    if (!tracked) return 0;

    const now = new Date();
    const diffMs = now.getTime() - tracked.lastActivityAt.getTime();
    return Math.floor(diffMs / (1000 * 60));
  },

  /**
   * End session due to idle
   */
  async endIdleSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('learning_sessions')
        .update({
          session_end: new Date().toISOString(),
          is_completed: true,
          idle_time_seconds: IDLE_THRESHOLD_MINUTES * 60,
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Remove from tracker
      activityTrackers.delete(sessionId);

      console.log(`[IDLE] Session ${sessionId} ended due to idle`);
      return true;
    } catch (error) {
      console.error('[IDLE] Error ending idle session:', error);
      return false;
    }
  },

  /**
   * Check all sessions for idle and end them if necessary
   */
  async checkAndEndIdleSessions(): Promise<string[]> {
    const endedSessionIds: string[] = [];

    for (const [sessionId, tracker] of activityTrackers) {
      const idleMinutes = this.getIdleMinutes(sessionId);

      if (idleMinutes >= IDLE_THRESHOLD_MINUTES) {
        const success = await this.endIdleSession(sessionId);
        if (success) {
          endedSessionIds.push(sessionId);
        }
      }
    }

    return endedSessionIds;
  },

  /**
   * Get all active sessions from database that are not ended
   */
  async getActiveSessions(): Promise<IdleSession[]> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('id, user_id, course_id, lesson_id, session_start, created_at')
        .eq('is_completed', false)
        .order('session_start', { ascending: false });

      if (error) throw error;

      const sessions: IdleSession[] = (data || []).map((session: any) => ({
        sessionId: session.id,
        userId: session.user_id,
        courseId: session.course_id,
        lessonId: session.lesson_id,
        sessionStartTime: new Date(session.session_start),
        lastActivityTime: new Date(session.created_at),
        idleMinutes: 0,
        isIdleExceeded: false,
      }));

      // Update idle minutes and check threshold
      return sessions.map((session) => {
        const now = new Date();
        const diffMs = now.getTime() - session.lastActivityTime.getTime();
        const idleMinutes = Math.floor(diffMs / (1000 * 60));

        return {
          ...session,
          idleMinutes,
          isIdleExceeded: idleMinutes >= IDLE_THRESHOLD_MINUTES,
        };
      });
    } catch (error) {
      console.error('[IDLE] Error getting active sessions:', error);
      return [];
    }
  },

  /**
   * Initialize idle detection service (background process)
   */
  initializeIdleDetection(intervalMinutes = IDLE_CHECK_INTERVAL_MINUTES): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;

    const checkInterval = setInterval(async () => {
      console.log('[IDLE] Running periodic idle check...');
      const endedSessions = await this.checkAndEndIdleSessions();

      if (endedSessions.length > 0) {
        console.log(
          `[IDLE] Ended ${endedSessions.length} idle sessions:`,
          endedSessions.join(', ')
        );
      }
    }, intervalMs);

    console.log(`[IDLE] Idle detection initialized (checking every ${intervalMinutes} minutes)`);
    return checkInterval;
  },

  /**
   * Clear activity tracker for testing
   */
  clearTrackers(): void {
    activityTrackers.clear();
  },

  /**
   * Get tracker stats (for debugging)
   */
  getTrackerStats(): {
    totalTracked: number;
    activeSessions: number;
    idleSessions: number;
  } {
    let activeSessions = 0;
    let idleSessions = 0;

    for (const [, tracker] of activityTrackers) {
      if (this.isSessionIdle(tracker.sessionId)) {
        idleSessions++;
      } else {
        activeSessions++;
      }
    }

    return {
      totalTracked: activityTrackers.size,
      activeSessions,
      idleSessions,
    };
  },
};
