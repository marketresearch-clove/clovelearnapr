import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { sessionService } from '../../lib/sessionService';
import { learningHoursService } from '../../lib/learningHoursService';
import { timeTrackingService } from '../../lib/timeTrackingService';

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

    const userId = session.user.id;
    const { action } = req.query;

    /**
     * POST /api/time-tracking?action=start-session
     * Start a new learning session
     */
    if (req.method === 'POST' && action === 'start-session') {
      const { courseId, lessonId } = req.body;

      if (!courseId) {
        return res.status(400).json({ error: 'courseId is required' });
      }

      const sessionObj = await sessionService.startSession(userId, courseId, lessonId);
      return res.status(200).json({
        success: true,
        session: sessionObj,
      });
    }

    /**
     * POST /api/time-tracking?action=end-session
     * End a learning session
     */
    if (req.method === 'POST' && action === 'end-session') {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      const session = await sessionService.endSession(sessionId);
      return res.status(200).json({
        success: true,
        session,
      });
    }

    /**
     * POST /api/time-tracking?action=log-lesson-time
     * Log time spent on a lesson
     */
    if (req.method === 'POST' && action === 'log-lesson-time') {
      const { lessonId, courseId, timeSpentSeconds, sessionId } = req.body;

      if (!lessonId || !courseId || timeSpentSeconds === undefined) {
        return res.status(400).json({
          error: 'lessonId, courseId, and timeSpentSeconds are required',
        });
      }

      if (!timeTrackingService.isValidTime(timeSpentSeconds)) {
        return res.status(400).json({
          error: 'timeSpentSeconds must be a non-negative number',
        });
      }

      const log = await sessionService.logLessonTime(
        userId,
        lessonId,
        courseId,
        timeSpentSeconds,
        sessionId
      );

      return res.status(200).json({
        success: true,
        log,
      });
    }

    /**
     * POST /api/time-tracking?action=record-learning-hours
     * Record aggregated learning hours (daily)
     */
    if (req.method === 'POST' && action === 'record-learning-hours') {
      const { courseId, timeSpentSeconds, date } = req.body;

      if (!courseId || timeSpentSeconds === undefined) {
        return res.status(400).json({
          error: 'courseId and timeSpentSeconds are required',
        });
      }

      const hours = await learningHoursService.recordLearningHours(
        userId,
        courseId,
        timeSpentSeconds,
        date
      );

      return res.status(200).json({
        success: true,
        hours,
      });
    }

    /**
     * GET /api/time-tracking?action=active-session
     * Get current active session for user
     */
    if (req.method === 'GET' && action === 'active-session') {
      const activeSession = await sessionService.getActiveSession(userId);

      return res.status(200).json({
        success: true,
        session: activeSession,
      });
    }

    /**
     * GET /api/time-tracking?action=today-stats
     * Get today's learning statistics
     */
    if (req.method === 'GET' && action === 'today-stats') {
      const stats = await sessionService.getDailyStats(userId, new Date());

      return res.status(200).json({
        success: true,
        stats: {
          ...stats,
          formatted: timeTrackingService.formatSeconds(stats.totalSecondsSpent),
        },
      });
    }

    /**
     * GET /api/time-tracking?action=daily-stats&date=YYYY-MM-DD
     * Get stats for specific date
     */
    if (req.method === 'GET' && action === 'daily-stats') {
      const { date } = req.query;

      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD)' });
      }

      const dateObj = new Date(date);
      const stats = await sessionService.getDailyStats(userId, dateObj);

      return res.status(200).json({
        success: true,
        date,
        stats: {
          ...stats,
          formatted: timeTrackingService.formatSeconds(stats.totalSecondsSpent),
        },
      });
    }

    /**
     * GET /api/time-tracking?action=weekly-stats
     * Get weekly learning statistics (last 7 days)
     */
    if (req.method === 'GET' && action === 'weekly-stats') {
      const result = await learningHoursService.getWeeklyLearningHours(userId);

      return res.status(200).json({
        success: true,
        stats: result,
      });
    }

    /**
     * GET /api/time-tracking?action=monthly-stats&year=2026&month=3
     * Get monthly statistics
     */
    if (req.method === 'GET' && action === 'monthly-stats') {
      const { year, month } = req.query;

      const yearNum = year ? parseInt(year as string) : undefined;
      const monthNum = month ? parseInt(month as string) - 1 : undefined; // Convert to 0-indexed

      const result = await learningHoursService.getMonthlyLearningHours(userId, yearNum, monthNum);

      return res.status(200).json({
        success: true,
        stats: result,
      });
    }

    /**
     * GET /api/time-tracking?action=course-hours&courseId=UUID
     * Get total hours spent on a course
     */
    if (req.method === 'GET' && action === 'course-hours') {
      const { courseId } = req.query;

      if (!courseId || typeof courseId !== 'string') {
        return res.status(400).json({ error: 'courseId query parameter is required' });
      }

      const result = await learningHoursService.getCourseLearningHours(userId, courseId);

      return res.status(200).json({
        success: true,
        courseId,
        hours: result,
      });
    }

    /**
     * GET /api/time-tracking?action=session-history&limit=10
     * Get user's session history
     */
    if (req.method === 'GET' && action === 'session-history') {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 10;

      const sessions = await sessionService.getUserSessions(userId, limitNum);

      return res.status(200).json({
        success: true,
        sessions,
      });
    }

    /**
     * GET /api/time-tracking?action=session-summary&sessionId=UUID
     * Get detailed session summary with lessons
     */
    if (req.method === 'GET' && action === 'session-summary') {
      const { sessionId } = req.query;

      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'sessionId query parameter is required' });
      }

      const summary = await sessionService.getSessionSummary(sessionId);

      return res.status(200).json({
        success: true,
        summary,
      });
    }

    // Default: action not found
    return res.status(400).json({
      error: `Unknown action: ${action}`,
      availableActions: [
        'start-session',
        'end-session',
        'log-lesson-time',
        'record-learning-hours',
        'active-session',
        'today-stats',
        'daily-stats',
        'weekly-stats',
        'monthly-stats',
        'course-hours',
        'session-history',
        'session-summary',
      ],
    });
  } catch (error) {
    console.error('[TIME_TRACKING_API] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
