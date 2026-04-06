/**
 * Audio Storage Service
 * Manages caching of generated audio in Supabase Storage
 */

import { supabase } from './supabaseClient';
import { TTSResult } from './ttsService';

interface AudioCacheEntry {
    lesson_id: string;
    block_id: string;
    chunk_index: number;
    audio_url: string;
    provider: string;
    duration: number;
    created_at: string;
    file_path: string;
}

class AudioStorageService {
    private readonly bucketName = 'lesson-audio';
    private localCache: Map<string, AudioCacheEntry> = new Map();

    constructor() {
        this.initializeBucket();
    }

    /**
     * Initialize storage bucket if it doesn't exist
     */
    private async initializeBucket(): Promise<void> {
        try {
            const { data: buckets, error: listError } = await supabase.storage.listBuckets();

            if (listError) {
                console.warn('[AudioStorage] ⚠️ Could not list buckets (might lack permissions):', listError.message);
                return; // Skip bucket initialization if we can't list
            }

            const exists = buckets?.some(b => b.name === this.bucketName);

            if (!exists) {
                console.log('[AudioStorage] 📦 Creating bucket:', this.bucketName);
                const { data, error } = await supabase.storage.createBucket(this.bucketName, {
                    public: true,
                    fileSizeLimit: 52428800, // 50MB
                });

                if (error) {
                    // 400 usually means bucket already exists - this is fine
                    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
                        console.log('[AudioStorage] ✅ Bucket already exists:', this.bucketName);
                    } else {
                        console.warn('[AudioStorage] ⚠️ Could not create bucket:', error.message);
                    }
                } else {
                    console.log('[AudioStorage] ✅ Bucket created:', data?.name);
                }
            } else {
                console.log('[AudioStorage] ✅ Bucket exists:', this.bucketName);
            }
        } catch (error) {
            console.warn('[AudioStorage] ⚠️ Bucket initialization skipped (non-critical):', error);
            // Don't throw - bucket is optional, cache can work without storage
        }
    }

    /**
     * Generate storage path for audio file
     */
    private generatePath(lessonId: string, blockId: string, chunkIndex: number): string {
        return `${lessonId}/${blockId}/${chunkIndex}.mp3`;
    }

    /**
     * Get audio from cache or storage
     */
    async getAudio(lessonId: string, blockId: string, chunkIndex: number): Promise<TTSResult | null> {
        try {
            const cacheKey = `${lessonId}/${blockId}/${chunkIndex}`;

            // Check local cache first
            if (this.localCache.has(cacheKey)) {
                const cached = this.localCache.get(cacheKey)!;
                console.log('[AudioStorage] ✅ Local cache hit:', cacheKey);
                return {
                    audioUrl: cached.audio_url,
                    provider: cached.provider as any,
                    duration: cached.duration,
                    cached: true,
                };
            }

            // Check database
            const { data: entry, error } = await supabase
                .from('lesson_audio_cache')
                .select('*')
                .eq('lesson_id', lessonId)
                .eq('block_id', blockId)
                .eq('chunk_index', chunkIndex)
                .maybeSingle();

            if (error) {
                console.warn('[AudioStorage] ⚠️ Database query warning:', error.code, error.message);
                // Don't throw - cache is optional, TTS should continue
                return null;
            }

            if (entry) {
                console.log('[AudioStorage] ✅ Database cache hit:', cacheKey);
                // Cache in memory
                this.localCache.set(cacheKey, entry);

                // Get signed URL if stored in Supabase Storage
                if (entry.file_path) {
                    const { data } = await supabase.storage
                        .from(this.bucketName)
                        .createSignedUrl(entry.file_path, 3600 * 24); // 24 hour expiry

                    return {
                        audioUrl: data?.signedUrl || entry.audio_url,
                        provider: entry.provider as any,
                        duration: entry.duration,
                        cached: true,
                    };
                }

                return {
                    audioUrl: entry.audio_url,
                    provider: entry.provider as any,
                    duration: entry.duration,
                    cached: true,
                };
            }

            return null;
        } catch (error) {
            console.warn('[AudioStorage] ⚠️ Cache retrieval skipped (non-critical):', error);
            return null;
        }
    }

    /**
     * Save audio to storage and database
     */
    async saveAudio(
        lessonId: string,
        blockId: string,
        chunkIndex: number,
        result: TTSResult
    ): Promise<void> {
        try {
            const filePath = this.generatePath(lessonId, blockId, chunkIndex);
            const cacheKey = `${lessonId}/${blockId}/${chunkIndex}`;

            // Convert blob URL to blob if needed
            let audioBlob: Blob | null = null;
            if (result.audioUrl.startsWith('blob:')) {
                const response = await fetch(result.audioUrl);
                audioBlob = await response.blob();
            } else {
                // If it's already a URL, we'll store the URL directly
                try {
                    const response = await fetch(result.audioUrl);
                    audioBlob = await response.blob();
                } catch (e) {
                    console.warn('[AudioStorage] Could not fetch audio, storing URL only');
                }
            }

            let storedUrl = result.audioUrl;
            let storagePath = '';

            // Upload to Supabase Storage if blob available
            if (audioBlob) {
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from(this.bucketName)
                    .upload(filePath, audioBlob, {
                        cacheControl: '31536000', // 1 year cache
                        upsert: true,
                    });

                if (uploadError) {
                    console.warn('[AudioStorage] Upload error:', uploadError);
                } else {
                    storagePath = uploadData?.path || '';
                    console.log('[AudioStorage] Uploaded to Storage:', storagePath);
                }
            }

            // Save to database
            const { error: dbError } = await supabase
                .from('lesson_audio_cache')
                .upsert(
                    {
                        lesson_id: lessonId,
                        block_id: blockId,
                        chunk_index: chunkIndex,
                        audio_url: storedUrl,
                        provider: result.provider,
                        duration: result.duration,
                        file_path: storagePath,
                        created_at: new Date().toISOString(),
                    },
                    {
                        onConflict: 'lesson_id,block_id,chunk_index',
                    }
                );

            if (dbError) {
                console.error('[AudioStorage] Database save error:', dbError);
            } else {
                // Update local cache
                this.localCache.set(cacheKey, {
                    lesson_id: lessonId,
                    block_id: blockId,
                    chunk_index: chunkIndex,
                    audio_url: storedUrl,
                    provider: result.provider,
                    duration: result.duration,
                    file_path: storagePath,
                    created_at: new Date().toISOString(),
                });
                console.log('[AudioStorage] Saved to cache:', cacheKey);
            }
        } catch (error) {
            console.error('[AudioStorage] Error saving audio:', error);
        }
    }

    /**
     * Clear all audio for a lesson
     */
    async clearLessonAudio(lessonId: string): Promise<void> {
        try {
            // Delete from database
            const { error: dbError } = await supabase
                .from('lesson_audio_cache')
                .delete()
                .eq('lesson_id', lessonId);

            if (dbError) {
                console.error('[AudioStorage] Error clearing database cache:', dbError);
            }

            // Delete from storage
            const { data: files, error: listError } = await supabase.storage
                .from(this.bucketName)
                .list(lessonId);

            if (listError) {
                console.error('[AudioStorage] Error listing files:', listError);
                return;
            }

            if (files && files.length > 0) {
                const filePaths = files.map(f => `${lessonId}/${f.name}`);
                const { error: deleteError } = await supabase.storage
                    .from(this.bucketName)
                    .remove(filePaths);

                if (deleteError) {
                    console.error('[AudioStorage] Error deleting files:', deleteError);
                }
            }

            // Clear local cache for this lesson
            for (const key of this.localCache.keys()) {
                if (key.startsWith(lessonId)) {
                    this.localCache.delete(key);
                }
            }

            console.log('[AudioStorage] Cleared cache for lesson:', lessonId);
        } catch (error) {
            console.error('[AudioStorage] Error clearing audio:', error);
        }
    }

    /**
     * Clear old cache entries (older than 30 days)
     */
    async clearOldCache(): Promise<void> {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const { error } = await supabase
                .from('lesson_audio_cache')
                .delete()
                .lt('created_at', thirtyDaysAgo);

            if (error) {
                console.error('[AudioStorage] Error clearing old cache:', error);
            } else {
                console.log('[AudioStorage] Cleared cache entries older than 30 days');
            }
        } catch (error) {
            console.error('[AudioStorage] Error in cache cleanup:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<{
        totalEntries: number;
        totalSize: number;
    }> {
        try {
            const { count, error } = await supabase
                .from('lesson_audio_cache')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;

            return {
                totalEntries: count || 0,
                totalSize: 0, // TODO: Calculate total size
            };
        } catch (error) {
            console.error('[AudioStorage] Error getting stats:', error);
            return { totalEntries: 0, totalSize: 0 };
        }
    }

    /**
     * Preload audio for a lesson
     */
    async preloadLessonAudio(lessonId: string, blockIds: string[]): Promise<number> {
        let loadedCount = 0;

        for (const blockId of blockIds) {
            const cached = await this.getAudio(lessonId, blockId, 0);
            if (cached) {
                loadedCount++;
            }
        }

        console.log(`[AudioStorage] Preloaded ${loadedCount}/${blockIds.length} audio files`);
        return loadedCount;
    }
}

export const audioStorageService = new AudioStorageService();
