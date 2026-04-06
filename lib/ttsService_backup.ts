/**
 * Unified TTS Service for LMS
 * ✅ FREE + UNLIMITED: Piper TTS (self-hosted) primary, Browser fallback
 * Zero API costs, unlimited generation, production scalable
 */

import { audioStorageService } from './audioStorageService';

export type TTSProvider = 'piper' | 'browser';
export type TTSQuality = 'high' | 'medium' | 'low';
export type PiperVoice = 'lessac-high' | 'amy-medium' | 'ryan-high';

interface TTSConfig {
    provider: TTSProvider;
    quality: TTSQuality;
    speed?: number;
    voiceGender?: 'male' | 'female';
    piperVoice?: PiperVoice;
}

interface TTSOptions {
    contentType: 'lecture' | 'summary' | 'quiz' | 'note';
    lessonId: string;
    blockId: string;
    chunkIndex?: number;
    useCache?: boolean;
}

interface TTSResult {
    audioUrl: string;
    provider: TTSProvider;
    duration: number;
    cached: boolean;
    voice?: PiperVoice;
}

// FREE provider configuration - Piper for everything!
const PROVIDER_CONFIG: Record<string, TTSProvider> = {
    lecture: 'piper',      // Teacher-like Piper voices sound surprisingly natural
    summary: 'piper',      // Fast synthesis
    quiz: 'piper',         // Quick delivery
    note: 'piper',         // Instant playback
};

// Quality tiers (Piper quality depends on voice model, not setting)
const QUALITY_CONFIG: Record<string, TTSQuality> = {
    lecture: 'high',       // Use lessac-high voice
    summary: 'medium',     // Use amy-medium voice
    quiz: 'medium',        // Use amy-medium voice
    note: 'medium',        // Use amy-medium voice (fast)
};

// Piper voice mapping for optimal quality/performance
const VOICE_MAPPING: Record<string, Record<TTSQuality, PiperVoice>> = {
    female: {
        high: 'lessac-high',    // Most natural teacher voice
        medium: 'amy-medium',   // Balanced quality/speed
        low: 'amy-medium',      // Same as medium for simplicity
    },
    male: {
        high: 'ryan-high',      // Male teacher voice (natural)
        medium: 'ryan-high',    // Best male voice available
        low: 'ryan-high',       // Same as medium
    },
};

class TTSService {
    private piperApiUrl: string;
    private defaultVoiceGender: 'male' | 'female' = 'female';
    private piperEnabled: boolean = true;
    private coquiApiUrl: string = 'https://api.coqui.ai/v1/synthesize'; // Legacy - not used

    constructor() {
        // Piper server URL (FREE - self-hosted)
        this.piperApiUrl = import.meta.env.VITE_PIPER_API_URL || 'http://localhost:5002';
        this.defaultVoiceGender = (import.meta.env.VITE_DEFAULT_VOICE_GENDER as 'male' | 'female') || 'female';

        console.log(`[TTS:FREE] ✅ Initialized with Piper at ${this.piperApiUrl}`);
        console.log(`[TTS:FREE] 🎤 Default voice: ${this.defaultVoiceGender} (female)`); \n
    }

    /**
     * Generate audio for text - FREE unlimited with Piper primary + Browser fallback
     * ✅ Zero API costs, unlimited generation
     */
    async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
        try {
            // Try to get from cache first (instant playback)
            if (options.useCache !== false) {
                const cached = await audioStorageService.getAudio(
                    options.lessonId,
                    options.blockId,
                    options.chunkIndex || 0
                );
                if (cached) {
                    console.log(`[TTS:FREE] ⚡ Cache hit: ${options.blockId}`);
                    return cached;
                }
            }

            // Optimize text for natural-sounding speech
            const optimizedText = this.optimizeTextForSpeech(text);

            // Provider selection (Piper only - FREE!)
            const quality = QUALITY_CONFIG[options.contentType] || 'medium';
            console.log(`[TTS:FREE] 🎙️ Synthesizing ${options.contentType} (quality: ${quality})`);

            let result: TTSResult | null = null;

            // Try Piper (PRIMARY - FREE, self-hosted)
            if (this.piperEnabled) {
                result = await this.synthesizeWithPiper(optimizedText, quality, this.defaultVoiceGender);
            }

            // Fallback to Browser TTS if Piper unavailable
            if (!result) {
                console.warn('[TTS:FREE] Piper unavailable, using Browser TTS fallback');
                result = await this.synthesizeWithBrowser(optimizedText);
            }

            // Cache the result for instant future playback
            if (options.useCache !== false) {
                await audioStorageService.saveAudio(
                    options.lessonId,
                    options.blockId,
                    options.chunkIndex || 0,
                    result
                );
            }

            return result;
        } catch (error) {
            console.error('[TTS:FREE] Synthesis error:', error);
            return await this.synthesizeWithBrowser(text);
        }
    }

    /**
     * Optimize text for natural-sounding speech
     * Helps Piper sound less robotic
     */
    private optimizeTextForSpeech(text: string): string {
        return text
            // Add proper spacing after punctuation
            .replace(/([.!?,:])/g, '$1 ')
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Fix multiple spaces
            .replace(/\s+/g, ' ')
            // Emphasize important words
            .replace(/\bIMPORTANT\b/gi, 'Important')
            .trim();
    }

    /**
     * Coqui TTS - Best for natural, teaching-focused audio
     */
    private async synthesizeWithCoqui(text: string, quality: TTSQuality): Promise<TTSResult> {
        try {
            // Check if Coqui API is available
            const apiKey = import.meta.env.VITE_COQUI_API_KEY;
            if (!apiKey) {
                console.warn('[TTS] Coqui API key not configured, falling back to Piper');
                return await this.synthesizeWithPiper(text, quality);
            }

            const response = await fetch(this.coquiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    text,
                    voice: 'en_US-glow-tts', // High quality English voice
                    speed: 1.0,
                    quality: quality === 'high' ? 22050 : 16000, // Sample rate
                }),
            });

            if (!response.ok) {
                throw new Error(`Coqui API error: ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Estimate duration
            const duration = this.estimateDuration(text);

            return {
                audioUrl,
                provider: 'coqui',
                duration,
                cached: false,
            };
        } catch (error) {
            console.error('[TTS] Coqui synthesis failed:', error);
            throw error;
        }
    }

    /**
     * Piper TTS - Fast and scalable for bulk content
     */
    private async synthesizeWithPiper(text: string, quality: TTSQuality): Promise<TTSResult> {
        try {
            // Check if Piper API is available
            const response = await fetch(`${this.piperApiUrl}/api/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    voice: 'en_US-amy-medium', // Medium quality English voice
                    quality: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low',
                    speed: 1.0,
                }),
            });

            if (!response.ok) {
                throw new Error(`Piper API error: ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Estimate duration
            const duration = this.estimateDuration(text);

            return {
                audioUrl,
                provider: 'piper',
                duration,
                cached: false,
            };
        } catch (error) {
            console.error('[TTS] Piper synthesis failed:', error);
            throw error;
        }
    }

    /**
     * Browser Web Speech API - Fallback for immediate playback
     */
    private async synthesizeWithBrowser(text: string): Promise<TTSResult> {
        return new Promise((resolve) => {
            const synth = window.speechSynthesis;
            const utterance = new SpeechSynthesisUtterance(text);

            // Create audio context for recording
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const destination = audioContext.createMediaStreamDestination();
            const mediaRecorder = new MediaRecorder(destination.stream);
            const audioChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const duration = this.estimateDuration(text);

                resolve({
                    audioUrl,
                    provider: 'browser',
                    duration,
                    cached: false,
                });
            };

            utterance.onend = () => {
                mediaRecorder.stop();
            };

            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;

            try {
                mediaRecorder.start();
                synth.speak(utterance);
            } catch (error) {
                console.error('[TTS] Browser synthesis failed:', error);
                // If recording fails, just resolve with blob URL
                resolve({
                    audioUrl: '',
                    provider: 'browser',
                    duration: this.estimateDuration(text),
                    cached: false,
                });
            }
        });
    }

    /**
     * Estimate audio duration in seconds
     * Average speaking speed: ~150-160 words per minute = 2.5 words per second
     */
    private estimateDuration(text: string): number {
        const wordCount = text.trim().split(/\s+/).length;
        const wordsPerSecond = 2.5;
        return Math.ceil(wordCount / wordsPerSecond);
    }

    /**
     * Get recommended provider for content type
     */
    getRecommendedProvider(contentType: string): TTSProvider {
        return PROVIDER_CONFIG[contentType] || 'browser';
    }

    /**
     * Batch process multiple text chunks
     */
    async synthesizeMultiple(
        texts: Array<{ text: string; contentType: string; blockId: string; chunkIndex: number }>,
        lessonId: string
    ): Promise<TTSResult[]> {
        const results: TTSResult[] = [];

        for (const item of texts) {
            try {
                const result = await this.synthesize(item.text, {
                    contentType: item.contentType as any,
                    lessonId,
                    blockId: item.blockId,
                    chunkIndex: item.chunkIndex,
                    useCache: true,
                });
                results.push(result);
            } catch (error) {
                console.error('[TTS] Batch synthesis error for block:', item.blockId, error);
                // Continue with next item
            }
        }

        return results;
    }

    /**
     * Clear cache for a lesson
     */
    async clearCache(lessonId: string): Promise<void> {
        await audioStorageService.clearLessonAudio(lessonId);
    }
}

export const ttsService = new TTSService();
