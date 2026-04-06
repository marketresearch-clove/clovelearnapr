/**
 * TTS Service for LMS
 * Supports multiple providers: Browser Web Speech API and Kokoro Web TTS
 * - Browser: always available, native Web Speech API
 * - Kokoro: high-quality, self-hostable, OpenAI-compatible API
 */

import { audioStorageService } from './audioStorageService';

export type TTSProvider = 'browser' | 'kokoro';

interface TTSOptions {
    contentType: 'lecture' | 'summary' | 'quiz' | 'note';
    lessonId: string;
    blockId: string;
    chunkIndex?: number;
    useCache?: boolean;
    voiceGender?: 'male' | 'female';
}

interface TTSResult {
    audioUrl: string;
    provider: TTSProvider;
    duration: number;
    cached: boolean;
}

// Speed adjustments for naturalness
const SPEED_CONFIG: Record<string, number> = {
    lecture: 0.9,
    summary: 1.0,
    quiz: 1.0,
    note: 1.1,
};

class TTSService {
    private defaultVoiceGender: 'male' | 'female' = 'female';

    constructor() {
        this.defaultVoiceGender =
            (import.meta.env.VITE_DEFAULT_VOICE_GENDER as 'male' | 'female') || 'female';
        console.log(`[TTS] 🌐 Browser Web Speech API initialized`);
        console.log(`[TTS] 🎤 Default voice: ${this.defaultVoiceGender}`);
    }

    /**
     * Main synthesis function - Browser Web Speech API
     */
    async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
        try {
            const contentType = options.contentType || 'lecture';

            // ⚡ Step 1: Try cache
            if (options.useCache !== false) {
                const cached = await audioStorageService.getAudio(
                    options.lessonId,
                    options.blockId,
                    options.chunkIndex || 0
                );
                if (cached) {
                    console.log(`[TTS] ⚡ CACHE HIT: ${options.blockId}`);
                    return cached;
                }
            }

            // 🎙️ Step 2: Optimize text
            const optimizedText = this.optimizeTextForSpeech(text);
            if (!optimizedText) {
                throw new Error('Empty text after optimization');
            }

            // 🎯 Step 3: Get settings
            const speed = SPEED_CONFIG[contentType] || 1.0;
            const voiceGender = options.voiceGender || this.defaultVoiceGender;
            console.log(`[TTS] 🎙️ Synthesizing ${contentType} (speed: ${speed}x, voice: ${voiceGender})`);

            // 🌐 Step 4: Use Browser TTS
            const result = await this.synthesizeWithBrowser(optimizedText, speed, voiceGender);

            if (!result) {
                throw new Error('Browser TTS failed');
            }

            // 💾 Step 5: Cache result
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
            console.error('[TTS] ❌ Synthesis error:', error);
            const voiceGender = options.voiceGender || this.defaultVoiceGender;
            return await this.synthesizeWithBrowser(text, 1.0, voiceGender);
        }
    }

    /**
     * Optimize text for natural-sounding speech
     */
    private optimizeTextForSpeech(text: string): string {
        if (!text || typeof text !== 'string') return '';

        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/([.!?,;:])\s*/g, '$1 ')
            .replace(/\s+/g, ' ')
            .replace(/\s+\./g, '.')
            .trim();
    }
    private synthesizeWithBrowser(text: string, speed: number, voiceGender: 'male' | 'female' = 'female'): Promise<TTSResult> {
        return new Promise((resolve) => {
            try {
                const utterance = new SpeechSynthesisUtterance(text);

                utterance.voice = this.selectBrowserVoice(voiceGender);

                // Gender-dependent voice settings for naturalness
                if (voiceGender === 'female') {
                    // Soft, gentle female voice: lower pitch and slightly slower rate
                    utterance.pitch = 0.85;
                    utterance.rate = speed * 0.85;
                } else {
                    // Male voice: slightly lower pitch
                    utterance.pitch = 0.95;
                    utterance.rate = speed * 0.9;
                }

                utterance.volume = 1.0;
                utterance.lang = 'en-US';

                const wordCount = text.split(/\s+/).length;
                const durationMs = (wordCount / 2.5) * 1000;

                utterance.onend = () => {
                    console.log(`[TTS:BROWSER] ✅ Playback complete (${Math.round(durationMs / 1000)}s)`);
                    resolve({
                        audioUrl: '',
                        provider: 'browser',
                        duration: Math.round(durationMs),
                        cached: false,
                    });
                };

                utterance.onerror = (event) => {
                    console.error('[TTS:BROWSER] ❌ Error:', event.error);
                    resolve({
                        audioUrl: '',
                        provider: 'browser',
                        duration: 0,
                        cached: false,
                    });
                };

                console.log(`[TTS:BROWSER] 🎤 Using Browser TTS (${utterance.voice?.name || 'default'})`);
                window.speechSynthesis.speak(utterance);
            } catch (error) {
                console.error('[TTS:BROWSER] ❌ Exception:', error);
                resolve({
                    audioUrl: '',
                    provider: 'browser',
                    duration: 0,
                    cached: false,
                });
            }
        });
    }

    /**
     * Synthesize with Kokoro Web TTS API
     * Supports both public (voice-generator.pages.dev) and self-hosted instances
     */
    private async synthesizeWithKokoro(text: string, voiceGender: 'male' | 'female' = 'female'): Promise<TTSResult> {
        try {
            const apiUrl = import.meta.env.VITE_KOKORO_API_URL;
            const apiKey = import.meta.env.VITE_KOKORO_API_KEY;

            if (!apiUrl) {
                console.warn('[TTS:KOKORO] ❌ Missing API URL, falling back to browser TTS');
                return await this.synthesizeWithBrowser(text, 1.0, voiceGender);
            }

            // Map gender to Kokoro voice
            const kokoroVoice = voiceGender === 'female' ? 'af_heart' : 'am_adam';

            console.log(`[TTS:KOKORO] 🎙️ Synthesizing with Kokoro (voice: ${kokoroVoice})`);

            // Build headers - API key is optional (not needed for public endpoints)
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (apiKey && apiKey.trim()) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            const response = await fetch(`${apiUrl}/audio/speech`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: 'kokoro',
                    voice: kokoroVoice,
                    input: text,
                }),
            });

            if (!response.ok) {
                console.error(`[TTS:KOKORO] ❌ API Error: ${response.status}`, await response.text());
                return await this.synthesizeWithBrowser(text, 1.0, voiceGender);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const wordCount = text.split(/\s+/).length;
            const estimatedDurationMs = (wordCount / 2.5) * 1000;

            console.log(`[TTS:KOKORO] ✅ Synthesis complete (${Math.round(estimatedDurationMs / 1000)}s)`);
            return {
                audioUrl,
                provider: 'kokoro',
                duration: Math.round(estimatedDurationMs),
                cached: false,
            };
        } catch (error) {
            console.error('[TTS:KOKORO] ❌ Exception:', error);
            // Fallback to browser TTS on error
            return await this.synthesizeWithBrowser(text, 1.0, voiceGender);
        }
    }

    /**
     * Select best browser voice matching gender and language
     */
    private selectBrowserVoice(gender: 'male' | 'female'): SpeechSynthesisVoice | undefined {
        try {
            const allVoices = window.speechSynthesis.getVoices();

            if (allVoices.length === 0) {
                console.warn('[TTS:BROWSER] No voices available');
                return undefined;
            }

            // First, try to get English US voices
            const enUSVoices = allVoices.filter(v => v.lang && v.lang.startsWith('en-US'));
            const fallbackVoices = allVoices.filter(v => v.lang && v.lang.startsWith('en'));
            const voicePool = enUSVoices.length > 0 ? enUSVoices : fallbackVoices.length > 0 ? fallbackVoices : allVoices;

            if (gender === 'female') {
                // Try exact match first
                let voice = voicePool.find(v => v.name.toLowerCase().includes('female'));
                if (voice) return voice;

                // Try common female voice names
                voice = voicePool.find(v => v.name.match(/\b(victoria|aria|zira|moira|samantha|fiona|jennifer)\b/i));
                if (voice) return voice;

                // Try voices that might be female (second half of voice list typically has female voices)
                return voicePool[Math.min(1, voicePool.length - 1)] || voicePool[0];
            } else {
                // Male voice detection
                let voice = voicePool.find(v => v.name.toLowerCase().includes('male'));
                if (voice) return voice;

                // Try common male voice names
                voice = voicePool.find(v => v.name.match(/\b(david|mark|daniel|adam|alex|james|george|andrew|michael)\b/i));
                if (voice) return voice;

                // Try voices that might be male (first half of voice list typically has male voices)
                return voicePool[0];
            }
        } catch (error) {
            console.warn('[TTS:BROWSER] Could not select voice:', error);
            const voices = window.speechSynthesis.getVoices();
            return voices.length > 0 ? voices[0] : undefined;
        }
    }

    /**
     * Batch synthesis for multiple chunks
     */
    async synthesizeBatch(
        items: Array<{ text: string; contentType: string; blockId: string; chunkIndex: number }>,
        lessonId: string
    ): Promise<TTSResult[]> {
        console.log(`[TTS] 📦 Starting batch synthesis (${items.length} items)`);
        const results: TTSResult[] = [];

        for (const item of items) {
            try {
                const result = await this.synthesize(item.text, {
                    contentType: item.contentType as any,
                    lessonId,
                    blockId: item.blockId,
                    chunkIndex: item.chunkIndex,
                    useCache: true,
                });
                results.push(result);

                await new Promise(r => setTimeout(r, 100));
            } catch (error) {
                console.error(`[TTS] ❌ Batch error for block ${item.blockId}:`, error);
            }
        }

        console.log(`[TTS] ✅ Batch complete (${results.length}/${items.length})`);
        return results;
    }

    /**
     * Clear all cached audio for a lesson
     */
    async clearCache(lessonId: string): Promise<void> {
        console.log(`[TTS] 🗑️ Clearing cache for lesson ${lessonId}`);
        await audioStorageService.clearLessonAudio(lessonId);
    }
}

export const ttsService = new TTSService();
