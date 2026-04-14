import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';
import { realTimeAnalyticsService } from '../../lib/realTimeAnalyticsService';
import { quizTrackingService } from '../../lib/quizTrackingService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Admin-only endpoint
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { action, courseId } = req.query;

    switch (action) {
      case 'peak-activity':
        const peakActivity = await realTimeAnalyticsService.getPeakActivityHour();
        return res.status(200).json(peakActivity);

      case 'avg-session-duration':
        const avgSessionDuration = await realTimeAnalyticsService.getAverageSessionDuration();
        return res.status(200).json(avgSessionDuration);

      case 'course-performance':
        const coursePerformance = await realTimeAnalyticsService.getCoursePerformanceRanking();
        return res.status(200).json(coursePerformance);

      case 'module-metrics':
        if (!courseId || typeof courseId !== 'string') {
          return res.status(400).json({ error: 'courseId required' });
        }
        const moduleMetrics = await realTimeAnalyticsService.getModuleWiseCompletionTime(courseId);
        return res.status(200).json(moduleMetrics);

      case 'time-learned':
        const timeLearned = await realTimeAnalyticsService.getTimeLearned();
        return res.status(200).json(timeLearned);

      case 'user-session-metrics':
        const userMetrics = await realTimeAnalyticsService.getUserSessionMetrics();
        return res.status(200).json(userMetrics);

      case 'active-users':
        const activeUsers = await realTimeAnalyticsService.getActiveUsersNow();
        return res.status(200).json({ activeUsers });

      case 'engagement-score':
        const { userId } = req.query;
        if (!userId || typeof userId !== 'string') {
          return res.status(400).json({ error: 'userId required' });
        }
        const engagementScore = await realTimeAnalyticsService.calculateEngagementScore(userId);
        return res.status(200).json(engagementScore);

      case 'quiz-stats':
        const { quizId } = req.query;
        if (!quizId || typeof quizId !== 'string') {
          return res.status(400).json({ error: 'quizId required' });
        }
        const quizStats = await quizTrackingService.getQuizStatistics(quizId);
        return res.status(200).json(quizStats);

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API] Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
