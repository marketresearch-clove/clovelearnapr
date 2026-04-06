/**
 * Hugging Face Kokoro-82M TTS Service (Browser-Based)
 *
 * Uses @huggingface/transformers to run Kokoro-82M directly in the browser
 * - No server needed
 * - Works offline after first load
 * - WebGPU acceleration if available, falls back to WASM
 */

let ttsModel: any = null;
let isModelLoading = false;
const modelLoadPromises: Promise<any>[] = [];

export interface HuggingFaceAudioResult {
    audio: Float32Array;
    samplingRate: number;
}

export interface HuggingFaceTTSResult {
    audioUrl: string;
    duration: number;
    modelLoaded: boolean;
}

/**
 * Load the Kokoro TTS model (with caching to avoid reloading)
 */
export async function loadKokoroModel(): Promise<any> {
    if (ttsModel) {
        console.log('[HF:TTS] ✅ Model already loaded');
        return ttsModel;
    }

    if (isModelLoading) {
        console.log('[HF:TTS] ⏳ Model loading in progress, waiting...');
        return Promise.race([
            ...modelLoadPromises,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Model load timeout')), 5 * 60 * 1000) // 5 min timeout
            )
        ]);
    }

    isModelLoading = true;

    try {
        const { pipeline } = await import('@huggingface/transformers');

        console.log('[HF:TTS] 📦 Loading Kokoro-82M model...');
        console.log('[HF:TTS] ℹ️ First load will download ~500MB (cached afterward)');
        console.log('[HF:TTS] 💡 Using WebGPU if available, falls back to WASM');

        const loadPromise = pipeline('text-to-speech', 'onnx-community/Kokoro-82M-v1.0', {
            device: 'webgpu',
            progress_callback: (progress: any) => {
                if (progress.status === 'downloading') {
                    const percent = Math.round((progress.progress / progress.total) * 100);
                    console.log(`[HF:TTS] 📥 Downloading: ${percent}%`);
                } else if (progress.status === 'progress') {
                    const percent = Math.round((progress.progress / progress.total) * 100);
                    console.log(`[HF:TTS] ⚙️  Processing: ${percent}%`);
                }
            },
        });

        modelLoadPromises.push(loadPromise);
        ttsModel = await loadPromise;

        console.log('[HF:TTS] ✅ Kokoro model loaded successfully!');
        console.log('[HF:TTS] 🚀 Ready for text-to-speech synthesis');
        return ttsModel;
    } catch (error) {
        console.error('[HF:TTS] ❌ Failed to load model:', error);
        isModelLoading = false;
        throw error;
    } finally {
        isModelLoading = false;
    }
}

/**
 * Synthesize text to speech using Kokoro-82M
 */
export async function synthesizeWithHuggingFace(
    text: string,
    voice: 'af_heart' | 'af_bella' | 'am_adam' | 'bf_emma' | 'bm_george' = 'af_heart'
): Promise<HuggingFaceTTSResult> {
    try {
        console.log(`[HF:TTS] 🎤 Synthesizing with voice: ${voice}`);

        // Load model if not already loaded
        const model = await loadKokoroModel();

        // Synthesize text
        console.log(`[HF:TTS] 📝 Input text length: ${text.length} chars`);
        const result = (await model(text, { voice })) as HuggingFaceAudioResult;

        // Convert to WAV blob
        const audioBlob = audioDataToWav(result.audio, result.samplingRate);
        const audioUrl = URL.createObjectURL(audioBlob);

        // Estimate duration (sample rate / audio length)
        const durationSeconds = result.audio.length / result.samplingRate;

        console.log(`[HF:TTS] ✅ Synthesis complete (${Math.round(durationSeconds)}s)`);

        return {
            audioUrl,
            duration: Math.round(durationSeconds * 1000),
            modelLoaded: true,
        };
    } catch (error) {
        console.error('[HF:TTS] ❌ Synthesis error:', error);
        throw error;
    }
}

/**
 * Convert Float32Array audio data to WAV blob
 * @param audioData Float32Array of audio samples
 * @param sampleRate Sample rate in Hz
 */
function audioDataToWav(audioData: Float32Array, sampleRate: number): Blob {
    const numberOfChannels = 1;
    const length = audioData.length * numberOfChannels * 2 + 36;

    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV file header
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // avg. byte rate
    view.setUint16(32, numberOfChannels * 2, true); // block-align
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Convert float samples to PCM
    let offset = 44;
    const volume = 0.8; // Slightly reduce volume to avoid clipping
    for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i] * volume)); // Clamp to [-1, 1]
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Get available voices
 */
export function getAvailableVoices() {
    return [
        { id: 'af_heart', label: '❤️ Heart (US Female)', gender: 'female' },
        { id: 'af_bella', label: '👩 Bella (US Female)', gender: 'female' },
        { id: 'am_adam', label: '👨 Adam (US Male)', gender: 'male' },
        { id: 'bf_emma', label: '👩 Emma (UK Female)', gender: 'female' },
        { id: 'bm_george', label: '👨 George (UK Male)', gender: 'male' },
    ];
}

/**
 * Check if model is currently loaded
 */
export function isModelLoaded(): boolean {
    return ttsModel !== null && !isModelLoading;
}

/**
 * Unload model to free memory (optional)
 */
export function unloadModel(): void {
    ttsModel = null;
    console.log('[HF:TTS] 🗑️ Model unloaded from memory');
}
