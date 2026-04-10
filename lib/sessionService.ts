import { supabase } from './supabaseClient';

export interface LearningSession {
  id: string;
  userId: string;
  courseId?: string;
  lessonId?: string;
  sessionStart: string;
  sessionEnd?: string;
  durationSeconds: number;
  isCompleted: boolean;
  idleTimeSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonTimeLog {
  id: string;
  userId: string;
  lessonId: string;
  courseId: string;
  sessionId?: string;
  timeSpentSeconds: number;
  startedAt: string;
  endedAt?: string;
  isCompleted: boolean;
  idempotencyKey: string;
  createdAt: string;
}

export const sessionService = {
  /**
   * Start a new learning session
   * All time values are in SECONDS
   */
  async startSession(
    userId: string,
    courseId: string,
    lessonId?: string
  ): Promise<LearningSession | null> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .insert([
          {
            user_id: userId,
            course_id: courseId,
            lesson_id: lessonId,
            session_start: new Date().toISOString(),
            duration_seconds: 0,
            is_completed: false,
            idle_time_seconds: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return this.mapSessionFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error starting session:', error);
      throw error;
    }
  },

  /**
   * End a session
   * CRITICAL: Duration now calculated from lesson logs, not wall clock
   */
  async endSession(sessionId: string): Promise<LearningSession | null> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .update({
          session_end: new Date().toISOString(),
          is_completed: true,
          updated_at: new Date().toISOString(),
          // duration_seconds will be auto-updated by trigger from lesson logs
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return this.mapSessionFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error ending session:', error);
      throw error;
    }
  },

  /**
   * Get active session for user
   */
  async getActiveSession(userId: string): Promise<LearningSession | null> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .order('session_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? this.mapSessionFromDb(data) : null;
    } catch (error) {
      console.error('[SESSION] Error getting active session:', error);
      return null;
    }
  },

  /**
   * Log time spent on a lesson (in seconds)
   * CRITICAL: Uses idempotency key to prevent double-counting
   */
  async logLessonTime(
    userId: string,
    lessonId: string,
    courseId: string,
    timeSpentSeconds: number,
    sessionId?: string,
    idempotencyKey?: string
  ): Promise<LessonTimeLog | null> {
    try {
      // Generate idempotency key if not provided
      const key = idempotencyKey || this.generateIdempotencyKey(userId, lessonId, sessionId);

      // Check if this was already processed
      const { data: existing } = await supabase
        .from('lesson_time_logs')
        .select('id')
        .eq('idempotency_key', key)
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log('[SESSION] Duplicate lesson time log (idempotency), skipping');
        // Return existing log to prevent re-processing
        const { data } = await supabase
          .from('lesson_time_logs')
          .select('*')
          .eq('idempotency_key', key)
          .single();
        return data ? this.mapLessonTimeLogFromDb(data) : null;
      }

      const { data, error } = await supabase
        .from('lesson_time_logs')
        .insert([
          {
            user_id: userId,
            lesson_id: lessonId,
            course_id: courseId,
            session_id: sessionId,
            time_spent_seconds: timeSpentSeconds,
            idempotency_key: key,
            started_at: new Date().toISOString(),
            is_completed: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      console.log('[SESSION] Logged lesson time:', {
        lesson: lessonId,
        seconds: timeSpentSeconds,
        key: key
      });

      return this.mapLessonTimeLogFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error logging lesson time:', error);
      throw error;
    }
  },

  /**
   * Complete lesson time log
   */
  async completeLessonTime(logId: string): Promise<LessonTimeLog | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_time_logs')
        .update({
          is_completed: true,
          ended_at: new Date().toISOString(),
        })
        .eq('id', logId)
        .select()
        .single();

      if (error) throw error;
      return this.mapLessonTimeLogFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error completing lesson time:', error);
      throw error;
    }
  },

  /**
   * Get total time spent on lesson (in seconds)
   */
  async getLessonTotalTime(userId: string, lessonId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('lesson_time_logs')
        .select('time_spent_seconds')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId);

      if (error) throw error;

      return (data || []).reduce((sum, log) => sum + log.time_spent_seconds, 0);
    } catch (error) {
      console.error('[SESSION] Error getting lesson total time:', error);
      return 0;
    }
  },

  /**
   * Get accurate session summary using view (not wall-clock time)
   * CRITICAL: Uses v_accurate_session_stats view for correct duration
   */
  async getSessionSummary(sessionId: string) {
    try {
      // Use accurate stats view instead of raw session duration
      const { data, error } = await supabase
        .from('v_accurate_session_stats')
        .select(
          `
          session_id,
          user_id,
          course_id,
          lesson_id,
          session_start,
          session_end,
          active_time_seconds,
          lesson_logs_count,
          unique_lessons,
          is_completed
        `
        )
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;

      return {
        session: data,
        sessionDuration: data.active_time_seconds, // Active time, not wall clock
      };
    } catch (error) {
      console.error('[SESSION] Error getting session summary:', error);
      return null;
    }
  },

  /**
   * Get user's session history
   */
  async getUserSessions(userId: string, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('session_start', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((session) => this.mapSessionFromDb(session));
    } catch (error) {
      console.error('[SESSION] Error getting user sessions:', error);
      return [];
    }
  },

  /**
   * Get daily stats for user
   */
  async getDailyStats(userId: string, date: Date) {
    try {
      const dateStr = date.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('lesson_time_logs')
        .select('time_spent_seconds, session_id')
        .eq('user_id', userId)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lte('created_at', `${dateStr}T23:59:59Z`);

      if (error) throw error;

      const totalSecondsSpent = (data || []).reduce(
        (sum, log) => sum + log.time_spent_seconds,
        0
      );
      const uniqueSessions = new Set((data || []).map((log) => log.session_id));

      return {
        totalSecondsSpent,
        totalHours: totalSecondsSpent / 3600,
        totalMinutes: totalSecondsSpent / 60,
        sessionCount: uniqueSessions.size,
      };
    } catch (error) {
      console.error('[SESSION] Error getting daily stats:', error);
      return {
        totalSecondsSpent: 0,
        totalHours: 0,
        totalMinutes: 0,
        sessionCount: 0,
      };
    }
  },

  /**
   * Check for time discrepancies (reconciliation)
   * CRITICAL: Identifies sessions where duration doesn't match lesson logs
   */
  async checkTimeDiscrepancies(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('v_time_discrepancies')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      return data || null; // null = no discrepancies
    } catch (error) {
      console.error('[SESSION] Error checking discrepancies:', error);
      return null;
    }
  },

  /**
   * Generate idempotency key
   * CRITICAL: Prevents duplicate lesson time logs on retries
   */
  generateIdempotencyKey(
    userId: string,
    lessonId: string,
    sessionId?: string
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${userId}:${lessonId}:${sessionId || 'no-session'}:${timestamp}:${random}`;
  },

  /**
   * Map database session to interface (snake_case to camelCase)
   */
  mapSessionFromDb(data: any): LearningSession {
    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      lessonId: data.lesson_id,
      sessionStart: data.session_start,
      sessionEnd: data.session_end,
      durationSeconds: data.duration_seconds,
      isCompleted: data.is_completed,
      idleTimeSeconds: data.idle_time_seconds,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Map database lesson time log to interface
   */
  mapLessonTimeLogFromDb(data: any): LessonTimeLog {
    return {
      id: data.id,
      userId: data.user_id,
      lessonId: data.lesson_id,
      courseId: data.course_id,
      sessionId: data.session_id,
      timeSpentSeconds: data.time_spent_seconds,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      isCompleted: data.is_completed,
      idempotencyKey: data.idempotency_key,
      createdAt: data.created_at,
    };
  },
};

export const sessionService = {
  /**
   * Start a new learning session
   * All time values are in SECONDS
   */
  async startSession(
    userId: string,
    courseId: string,
    lessonId?: string
  ): Promise<LearningSession | null> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .insert([
          {
            user_id: userId,
            course_id: courseId,
            lesson_id: lessonId,
            session_start: new Date().toISOString(),
            duration_seconds: 0,
            is_completed: false,
            idle_time_seconds: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return this.mapSessionFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error starting session:', error);
      throw error;
    }
  },

  /**
   * End a session and calculate duration
   */
  async endSession(sessionId: string): Promise<LearningSession | null> {
    try {
      // Get the session first
      const { data: session, error: fetchError } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate duration in seconds
      const startTime = new Date(session.session_start).getTime();
      const endTime = new Date().getTime();
      const durationSeconds = Math.floor((endTime - startTime) / 1000);

      // Update session
      const { data, error } = await supabase
        .from('learning_sessions')
        .update({
          session_end: new Date().toISOString(),
          duration_seconds: durationSeconds,
          is_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return this.mapSessionFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error ending session:', error);
      throw error;
    }
  },

  /**
   * Get active session for user
   */
  async getActiveSession(userId: string): Promise<LearningSession | null> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .order('session_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? this.mapSessionFromDb(data) : null;
    } catch (error) {
      console.error('[SESSION] Error getting active session:', error);
      return null;
    }
  },

  /**
   * Log time spent on a lesson (in seconds)
   */
  async logLessonTime(
    userId: string,
    lessonId: string,
    courseId: string,
    timeSpentSeconds: number,
    sessionId?: string
  ): Promise<LessonTimeLog | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_time_logs')
        .insert([
          {
            user_id: userId,
            lesson_id: lessonId,
            course_id: courseId,
            session_id: sessionId,
            time_spent_seconds: timeSpentSeconds,
            started_at: new Date().toISOString(),
            is_completed: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return this.mapLessonTimeLogFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error logging lesson time:', error);
      throw error;
    }
  },

  /**
   * Complete lesson time log
   */
  async completeLessonTime(logId: string): Promise<LessonTimeLog | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_time_logs')
        .update({
          is_completed: true,
          ended_at: new Date().toISOString(),
        })
        .eq('id', logId)
        .select()
        .single();

      if (error) throw error;
      return this.mapLessonTimeLogFromDb(data);
    } catch (error) {
      console.error('[SESSION] Error completing lesson time:', error);
      throw error;
    }
  },

  /**
   * Get total time spent on lesson (in seconds)
   */
  async getLessonTotalTime(userId: string, lessonId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('lesson_time_logs')
        .select('time_spent_seconds')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId);

      if (error) throw error;

      return (data || []).reduce((sum, log) => sum + log.time_spent_seconds, 0);
    } catch (error) {
      console.error('[SESSION] Error getting lesson total time:', error);
      return 0;
    }
  },

  /**
   * Get session summary with all lessons accessed
   */
  async getSessionSummary(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select(
          `
          *,
          lesson_time_logs (
            id,
            lesson_id,
            time_spent_seconds,
            is_completed
          )
        `
        )
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return {
        session: this.mapSessionFromDb(data),
        lessons: (data.lesson_time_logs || []).map((log: any) =>
          this.mapLessonTimeLogFromDb(log)
        ),
      };
    } catch (error) {
      console.error('[SESSION] Error getting session summary:', error);
      return null;
    }
  },

  /**
   * Get user's session history
   */
  async getUserSessions(userId: string, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('session_start', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((session) => this.mapSessionFromDb(session));
    } catch (error) {
      console.error('[SESSION] Error getting user sessions:', error);
      return [];
    }
  },

  /**
   * Get daily stats for user
   */
  async getDailyStats(userId: string, date: Date) {
    try {
      const dateStr = date.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('lesson_time_logs')
        .select('time_spent_seconds, session_id')
        .eq('user_id', userId)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lte('created_at', `${dateStr}T23:59:59Z`);

      if (error) throw error;

      const totalSecondsSpent = (data || []).reduce(
        (sum, log) => sum + log.time_spent_seconds,
        0
      );
      const uniqueSessions = new Set((data || []).map((log) => log.session_id));

      return {
        totalSecondsSpent,
        totalHours: totalSecondsSpent / 3600,
        totalMinutes: totalSecondsSpent / 60,
        sessionCount: uniqueSessions.size,
      };
    } catch (error) {
      console.error('[SESSION] Error getting daily stats:', error);
      return {
        totalSecondsSpent: 0,
        totalHours: 0,
        totalMinutes: 0,
        sessionCount: 0,
      };
    }
  },

  /**
   * Map database session to interface (snake_case to camelCase)
   */
  private mapSessionFromDb(data: any): LearningSession {
    return {
      id: data.id,
      userId: data.user_id,
      courseId: data.course_id,
      lessonId: data.lesson_id,
      sessionStart: data.session_start,
      sessionEnd: data.session_end,
      durationSeconds: data.duration_seconds,
      isCompleted: data.is_completed,
      idleTimeSeconds: data.idle_time_seconds,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Map database lesson time log to interface
   */
  private mapLessonTimeLogFromDb(data: any): LessonTimeLog {
    return {
      id: data.id,
      userId: data.user_id,
      lessonId: data.lesson_id,
      courseId: data.course_id,
      sessionId: data.session_id,
      timeSpentSeconds: data.time_spent_seconds,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      isCompleted: data.is_completed,
      createdAt: data.created_at,
    };
  },
};
