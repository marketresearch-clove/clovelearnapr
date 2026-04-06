/**
 * TTS Settings Service
 * Manages course and lesson-level TTS configuration
 */

import { supabase } from './supabaseClient';
import { TTSProvider, TTSQuality } from './ttsService';

export interface TTSSettings {
    id?: number;
    lesson_id: string;
    course_id: string;
    default_provider: TTSProvider;
    fallback_provider: TTSProvider;
    lecture_quality: TTSQuality;
    summary_quality: TTSQuality;
    voice_gender: 'male' | 'female';
    auto_pause_enabled: boolean;
    cache_audio: boolean;
    preload_audio: boolean;
    default_speed: number;
    min_speed: number;
    max_speed: number;
}

class TTSSettingsService {
    /**
     * Get TTS settings for a lesson
     */
    async getLessonSettings(lessonId: string): Promise<TTSSettings | null> {
        try {
            const { data, error } = await supabase
                .from('lesson_tts_settings')
                .select('*')
                .eq('lesson_id', lessonId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data || null;
        } catch (error) {
            console.error('[TTSSettings] Error fetching lesson settings:', error);
            return null;
        }
    }

    /**
     * Get TTS settings for a course
     */
    async getCourseSettings(courseId: string): Promise<TTSSettings | null> {
        try {
            const { data, error } = await supabase
                .from('lesson_tts_settings')
                .select('*')
                .eq('course_id', courseId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data || null;
        } catch (error) {
            console.error('[TTSSettings] Error fetching course settings:', error);
            return null;
        }
    }

    /**
     * Get default TTS settings
     */
    getDefaultSettings(lessonId: string, courseId: string): TTSSettings {
        return {
            lesson_id: lessonId,
            course_id: courseId,
            default_provider: 'coqui',
            fallback_provider: 'piper',
            lecture_quality: 'high',
            summary_quality: 'medium',
            voice_gender: 'female',
            auto_pause_enabled: true,
            cache_audio: true,
            preload_audio: false,
            default_speed: 1.0,
            min_speed: 0.5,
            max_speed: 2.0,
        };
    }

    /**
     * Save TTS settings for a lesson
     */
    async saveLessonSettings(settings: TTSSettings): Promise<TTSSettings | null> {
        try {
            const { data, error } = await supabase
                .from('lesson_tts_settings')
                .upsert(
                    {
                        lesson_id: settings.lesson_id,
                        course_id: settings.course_id,
                        default_provider: settings.default_provider,
                        fallback_provider: settings.fallback_provider,
                        lecture_quality: settings.lecture_quality,
                        summary_quality: settings.summary_quality,
                        voice_gender: settings.voice_gender,
                        auto_pause_enabled: settings.auto_pause_enabled,
                        cache_audio: settings.cache_audio,
                        preload_audio: settings.preload_audio,
                        default_speed: settings.default_speed,
                        min_speed: settings.min_speed,
                        max_speed: settings.max_speed,
                    },
                    {
                        onConflict: 'lesson_id',
                    }
                )
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('[TTSSettings] Saved lesson settings:', settings.lesson_id);
            return data;
        } catch (error) {
            console.error('[TTSSettings] Error saving lesson settings:', error);
            return null;
        }
    }

    /**
     * Save TTS settings for a course
     */
    async saveCourseSettings(settings: TTSSettings): Promise<TTSSettings | null> {
        try {
            const { data, error } = await supabase
                .from('lesson_tts_settings')
                .upsert(
                    {
                        course_id: settings.course_id,
                        lesson_id: settings.lesson_id,
                        default_provider: settings.default_provider,
                        fallback_provider: settings.fallback_provider,
                        lecture_quality: settings.lecture_quality,
                        summary_quality: settings.summary_quality,
                        voice_gender: settings.voice_gender,
                        auto_pause_enabled: settings.auto_pause_enabled,
                        cache_audio: settings.cache_audio,
                        preload_audio: settings.preload_audio,
                        default_speed: settings.default_speed,
                        min_speed: settings.min_speed,
                        max_speed: settings.max_speed,
                    },
                    {
                        onConflict: 'course_id',
                    }
                )
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('[TTSSettings] Saved course settings:', settings.course_id);
            return data;
        } catch (error) {
            console.error('[TTSSettings] Error saving course settings:', error);
            return null;
        }
    }

    /**
     * Merge lesson and course settings with priority
     * Lesson settings override course settings
     */
    async getMergedSettings(lessonId: string, courseId: string): Promise<TTSSettings> {
        try {
            // Get course settings as base
            const courseSettings = await this.getCourseSettings(courseId);
            const baseSettings = courseSettings || this.getDefaultSettings(lessonId, courseId);

            // Get lesson-specific settings
            const lessonSettings = await this.getLessonSettings(lessonId);

            // Merge: lesson overrides course
            if (lessonSettings) {
                return { ...baseSettings, ...lessonSettings };
            }

            return baseSettings;
        } catch (error) {
            console.error('[TTSSettings] Error merging settings:', error);
            return this.getDefaultSettings(lessonId, courseId);
        }
    }

    /**
     * Validate TTS settings
     */
    validateSettings(settings: Partial<TTSSettings>): string[] {
        const errors: string[] = [];

        if (settings.default_provider && !['coqui', 'piper', 'browser'].includes(settings.default_provider)) {
            errors.push('Invalid default_provider');
        }

        if (settings.fallback_provider && !['coqui', 'piper', 'browser'].includes(settings.fallback_provider)) {
            errors.push('Invalid fallback_provider');
        }

        if (settings.lecture_quality && !['high', 'medium', 'low'].includes(settings.lecture_quality)) {
            errors.push('Invalid lecture_quality');
        }

        if (settings.summary_quality && !['high', 'medium', 'low'].includes(settings.summary_quality)) {
            errors.push('Invalid summary_quality');
        }

        if (settings.voice_gender && !['male', 'female'].includes(settings.voice_gender)) {
            errors.push('Invalid voice_gender');
        }

        if (settings.default_speed !== undefined && (settings.default_speed < 0.5 || settings.default_speed > 2.0)) {
            errors.push('default_speed must be between 0.5 and 2.0');
        }

        if (settings.min_speed !== undefined && (settings.min_speed < 0.5 || settings.min_speed > 2.0)) {
            errors.push('min_speed must be between 0.5 and 2.0');
        }

        if (settings.max_speed !== undefined && (settings.max_speed < 0.5 || settings.max_speed > 2.0)) {
            errors.push('max_speed must be between 0.5 and 2.0');
        }

        if (
            settings.min_speed !== undefined &&
            settings.max_speed !== undefined &&
            settings.min_speed > settings.max_speed
        ) {
            errors.push('min_speed cannot be greater than max_speed');
        }

        return errors;
    }

    /**
     * Get recommended settings for content type
     */
    getRecommendedSettings(contentType: 'lecture' | 'summary' | 'quiz' | 'note'): Partial<TTSSettings> {
        switch (contentType) {
            case 'lecture':
                return {
                    default_provider: 'coqui',
                    fallback_provider: 'piper',
                    lecture_quality: 'high',
                    auto_pause_enabled: true,
                };
            case 'summary':
                return {
                    default_provider: 'piper',
                    fallback_provider: 'coqui',
                    summary_quality: 'medium',
                    auto_pause_enabled: false,
                };
            case 'quiz':
                return {
                    default_provider: 'piper',
                    fallback_provider: 'browser',
                    summary_quality: 'medium',
                    auto_pause_enabled: false,
                };
            case 'note':
                return {
                    default_provider: 'piper',
                    fallback_provider: 'browser',
                    summary_quality: 'low',
                    auto_pause_enabled: false,
                };
            default:
                return {};
        }
    }

    /**
     * Reset settings to defaults for a lesson
     */
    async resetLessonSettings(lessonId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('lesson_tts_settings')
                .delete()
                .eq('lesson_id', lessonId);

            if (error) {
                throw error;
            }

            console.log('[TTSSettings] Reset settings for lesson:', lessonId);
        } catch (error) {
            console.error('[TTSSettings] Error resetting settings:', error);
        }
    }
}

export const ttsSettingsService = new TTSSettingsService();
