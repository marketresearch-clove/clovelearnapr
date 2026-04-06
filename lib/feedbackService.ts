import { supabase } from './supabaseClient';
import { cacheService } from './cacheService';

export interface CourseFeedback {
    id?: string;
    courseid: string;
    userid: string;
    rating: number;
    feedback?: string;
    created_at?: string;
    updated_at?: string;
}

export interface FeedbackStats {
    averageRating: number;
    totalRatings: number;
    ratingDistribution: {
        [key: number]: number;
    };
}

export const feedbackService = {
    async submitFeedback(courseid: string, userid: string, rating: number, feedback?: string) {
        try {
            const { data, error } = await supabase
                .from('course_feedback')
                .upsert(
                    {
                        courseid,
                        userid,
                        rating,
                        feedback: feedback || null,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'courseid,userid' }
                )
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error submitting feedback:', error);
            throw error;
        }
    },

    async getUserFeedback(courseid: string, userid: string) {
        try {
            const { data, error } = await supabase
                .from('course_feedback')
                .select('*')
                .eq('courseid', courseid)
                .eq('userid', userid)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching user feedback:', error);
            return null;
        }
    },

    async getCourseFeedback(courseid: string) {
        try {
            // Check cache first
            const cacheKey = `cache:course_feedback:${courseid}`;
            const cached = cacheService.get<any[]>(cacheKey);
            if (cached) {
                console.log('[FEEDBACK] Using cached feedback for course:', courseid);
                return cached;
            }

            const { data, error } = await supabase
                .from('course_feedback')
                .select('*, profiles(fullname)')
                .eq('courseid', courseid)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Cache with 10 minute expiration
            if (data && data.length > 0) {
                cacheService.set(cacheKey, data, 10 * 60 * 1000);
            }

            return data;
        } catch (error) {
            console.error('Error fetching course feedback:', error);
            return [];
        }
    },

    async getCourseFeedbackStats(courseid: string): Promise<FeedbackStats> {
        try {
            // Check cache first
            const cacheKey = `cache:course_feedback_stats:${courseid}`;
            const cached = cacheService.get<FeedbackStats>(cacheKey);
            if (cached) {
                console.log('[FEEDBACK] Using cached stats for course:', courseid);
                return cached;
            }

            const { data, error } = await supabase
                .from('course_feedback')
                .select('rating')
                .eq('courseid', courseid);

            if (error) throw error;

            if (!data || data.length === 0) {
                const emptyStats = {
                    averageRating: 0,
                    totalRatings: 0,
                    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                };
                // Cache empty result for 5 minutes
                cacheService.set(cacheKey, emptyStats, 5 * 60 * 1000);
                return emptyStats;
            }

            const ratings = data.map((item: any) => item.rating);
            const averageRating =
                ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length;

            const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            ratings.forEach((rating: number) => {
                ratingDistribution[rating as keyof typeof ratingDistribution]++;
            });

            const stats: FeedbackStats = {
                averageRating: Math.round(averageRating * 10) / 10,
                totalRatings: ratings.length,
                ratingDistribution,
            };

            // Cache with 10 minute expiration
            cacheService.set(cacheKey, stats, 10 * 60 * 1000);

            return stats;
        } catch (error) {
            console.error('Error fetching feedback stats:', error);
            return {
                averageRating: 0,
                totalRatings: 0,
                ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            };
        }
    },

    async deleteFeedback(courseid: string, userid: string) {
        try {
            const { error } = await supabase
                .from('course_feedback')
                .delete()
                .eq('courseid', courseid)
                .eq('userid', userid);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting feedback:', error);
            throw error;
        }
    },
};
