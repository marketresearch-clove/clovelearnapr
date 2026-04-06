/**
 * useEnhancedTTS Hook
 * Manages enhanced TTS integration with caching and content chunking
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ttsService } from '../lib/ttsService';
import { audioStorageService } from '../lib/audioStorageService';
import { ttsSettingsService, TTSSettings } from '../lib/ttsSettingsService';
import { contentChunker } from '../lib/contentChunker';

interface UseEnhancedTTSOptions {
    lessonId: string;
    courseId: string;
    contentType?: 'lecture' | 'summary' | 'quiz' | 'note';
    autoCache?: boolean;
    autoPreload?: boolean;
}

export function useEnhancedTTS(options: UseEnhancedTTSOptions) {
    const {
        lessonId,
        courseId,
        contentType = 'lecture',
        autoCache = true,
        autoPreload = false,
    } = options;

    const [settings, setSettings] = useState<TTSSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cacheStats, setCacheStats] = useState<{ totalEntries: number; totalSize: number }>({
        totalEntries: 0,
        totalSize: 0,
    });

    const settingsLoadedRef = useRef(false);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (settingsLoadedRef.current) return;
            settingsLoadedRef.current = true;

            try {
                setIsLoading(true);
                const mergedSettings = await ttsSettingsService.getMergedSettings(
                    lessonId,
                    courseId
                );
                setSettings(mergedSettings);

                // Validate settings
                const errors = ttsSettingsService.validateSettings(mergedSettings);
                if (errors.length > 0) {
                    console.warn('[useEnhancedTTS] Settings validation errors:', errors);
                }
            } catch (err) {
                console.error('[useEnhancedTTS] Error loading settings:', err);
                setError('Failed to load TTS settings');
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [lessonId, courseId]);

    // Get cache statistics
    useEffect(() => {
        const loadCacheStats = async () => {
            try {
                const stats = await audioStorageService.getCacheStats();
                setCacheStats(stats);
            } catch (err) {
                console.error('[useEnhancedTTS] Error loading cache stats:', err);
            }
        };

        loadCacheStats();
        // Refresh every 5 minutes
        const interval = setInterval(loadCacheStats, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Preload audio if enabled
    useEffect(() => {
        if (!autoPreload || !settings?.preload_audio) return;

        const preloadAudio = async (text: string) => {
            try {
                const blockIds = contentChunker.splitBySections(text).map((_, i) => `section-${i}`);
                await audioStorageService.preloadLessonAudio(lessonId, blockIds);
            } catch (err) {
                console.error('[useEnhancedTTS] Error preloading audio:', err);
            }
        };

        // Call from parent with actual content
        return () => {
            // Cleanup
        };
    }, [autoPreload, settings?.preload_audio, lessonId]);

    /**
     * Parse and chunk content for TTS
     */
    const parseContent = useCallback((text: string) => {
        try {
            return contentChunker.parse(text);
        } catch (err) {
            console.error('[useEnhancedTTS] Error parsing content:', err);
            setError('Failed to parse content for audio');
            return null;
        }
    }, []);

    /**
     * Synthesize audio with intelligent provider selection
     */
    const synthesizeAudio = useCallback(
        async (text: string, blockId: string, chunkIndex: number = 0) => {
            if (!settings) {
                setError('TTS settings not loaded');
                return null;
            }

            try {
                setIsLoading(true);
                setError(null);

                const result = await ttsService.synthesize(text, {
                    contentType: contentType as any,
                    lessonId,
                    blockId,
                    chunkIndex,
                    useCache: settings.cache_audio,
                });

                return result;
            } catch (err) {
                console.error('[useEnhancedTTS] Error synthesizing audio:', err);
                setError('Failed to synthesize audio');
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [lessonId, contentType, settings]
    );

    /**
     * Batch synthesize multiple content chunks
     */
    const synthesizeBatch = useCallback(
        async (texts: Array<{ text: string; blockId: string; chunkIndex: number }>) => {
            if (!settings) {
                setError('TTS settings not loaded');
                return [];
            }

            try {
                setIsLoading(true);
                setError(null);

                const results = await ttsService.synthesizeMultiple(
                    texts.map((item) => ({
                        text: item.text,
                        contentType,
                        blockId: item.blockId,
                        chunkIndex: item.chunkIndex,
                    })),
                    lessonId
                );

                return results;
            } catch (err) {
                console.error('[useEnhancedTTS] Error batch synthesizing:', err);
                setError('Failed to synthesize audio batch');
                return [];
            } finally {
                setIsLoading(false);
            }
        },
        [lessonId, contentType, settings]
    );

    /**
     * Clear cache for this lesson
     */
    const clearCache = useCallback(async () => {
        try {
            setIsLoading(true);
            await audioStorageService.clearLessonAudio(lessonId);
            setCacheStats({ totalEntries: 0, totalSize: 0 });
            setError(null);
        } catch (err) {
            console.error('[useEnhancedTTS] Error clearing cache:', err);
            setError('Failed to clear cache');
        } finally {
            setIsLoading(false);
        }
    }, [lessonId]);

    /**
     * Update settings
     */
    const updateSettings = useCallback(async (newSettings: Partial<TTSSettings>) => {
        if (!settings) return;

        try {
            setIsLoading(true);

            // Validate
            const errors = ttsSettingsService.validateSettings(newSettings);
            if (errors.length > 0) {
                setError(`Settings validation error: ${errors[0]}`);
                return;
            }

            // Save
            const updated = await ttsSettingsService.saveLessonSettings({
                ...settings,
                ...newSettings,
            });

            if (updated) {
                setSettings(updated);
                setError(null);
            }
        } catch (err) {
            console.error('[useEnhancedTTS] Error updating settings:', err);
            setError('Failed to update settings');
        } finally {
            setIsLoading(false);
        }
    }, [settings]);

    /**
     * Get recommended settings for content type
     */
    const getRecommendedSettings = useCallback((type: 'lecture' | 'summary' | 'quiz' | 'note') => {
        return ttsSettingsService.getRecommendedSettings(type);
    }, []);

    /**
     * Extract key terms from content
     */
    const getKeyTerms = useCallback((text: string) => {
        try {
            return contentChunker.extractKeyTerms(text);
        } catch (err) {
            console.error('[useEnhancedTTS] Error extracting key terms:', err);
            return [];
        }
    }, []);

    return {
        // State
        settings,
        isLoading,
        error,
        cacheStats,

        // Methods
        parseContent,
        synthesizeAudio,
        synthesizeBatch,
        clearCache,
        updateSettings,
        getRecommendedSettings,
        getKeyTerms,

        // Utils
        contentChunker: {
            splitBySections: (text: string) => contentChunker.splitBySections(text),
            extractKeyTerms: (text: string) => contentChunker.extractKeyTerms(text),
            createAudioChunks: (chunks: any[]) => contentChunker.createAudioChunks(chunks),
        },
    };
}
