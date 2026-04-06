/**
 * Hugging Face Kokoro-82M Browser-Based TTS Service
 * Uses public ONNX model - no authentication needed
 * Runs entirely in the browser using WebGPU/WASM
 */

import { pipeline, env } from '@huggingface/transformers';

// ✅ Public model — no HF token needed
const MODEL_ID = 'onnx-community/Kokoro-82M-ONNX';

// Disable local model cache to avoid stale 401 errors
env.allowLocalModels = false;
env.useBrowserCache = true; // cache in IndexedDB after first download

let pipelineInstance: Awaited<ReturnType<typeof pipeline>> | null = null;
let loadPromise: Promise<void> | null = null;

interface InitProgress {
    status: 'downloading' | 'initializing' | 'ready';
    progress?: number;
    message?: string;
}

type ProgressCallback = (progress: InitProgress) => void;
const progressCallbacks = new Set<ProgressCallback>();

export const onModelProgress = (callback: ProgressCallback) => {
    progressCallbacks.add(callback);
    return () => progressCallbacks.delete(callback);
};

const broadcastProgress = (progress: InitProgress) => {
    console.log('[HF:Kokoro]', progress.message || progress.status, progress.progress ? `${progress.progress}%` : '');
    progressCallbacks.forEach(cb => cb(progress));
};

async function initializeModel(): Promise<void> {
    if (pipelineInstance) return;
    if (loadPromise) return loadPromise; // ✅ prevent concurrent loads

    loadPromise = (async () => {
        try {
            broadcastProgress({
                status: 'downloading',
                message: '📥 Downloading Kokoro model (500MB)...',
            });

            pipelineInstance = await pipeline('text-to-speech', MODEL_ID, {
                device: 'webgpu', // falls back to wasm automatically
                dtype: 'q8', // quantized — smaller & faster
                progress_callback: (p: any) => {
                    if (p.status === 'downloading') {
                        const pct = p.progress ? Math.round(p.progress * 100) : 0;
                        broadcastProgress({
                            status: 'downloading',
                            message: `📥 Downloading Kokoro model...`,
                            progress: pct,
                        });
                    }
                },
            });

            broadcastProgress({
                status: 'ready',
                message: '✅ Kokoro model ready!',
                progress: 100,
            });

            console.log('[HF:Kokoro] ✅ Model loaded successfully');
        } catch (err) {
            pipelineInstance = null;
            loadPromise = null;
            console.error('[HF:Kokoro] ❌ Failed to load model:', err);
            broadcastProgress({
                status: 'ready',
                message: `❌ Model load failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
            throw err;
        }
    })();

    return loadPromise;
}

// ✅ Single active audio instance — prevents overlapping plays
let activeAudio: HTMLAudioElement | null = null;

const getKokoroVoice = (gender: 'male' | 'female'): string => {
    return gender === 'female' ? 'af_heart' : 'am_adam';
};

export async function synthesizeWithHuggingFace(
    text: string,
    voiceGender: 'male' | 'female' = 'female'
): Promise<Blob> {
    await initializeModel();

    if (!pipelineInstance) {
        throw new Error('Kokoro model not initialized');
    }

    const voice = getKokoroVoice(voiceGender);
    console.log(`[HF:Kokoro] 🎙️ Synthesizing with voice: ${voice}`);

    const result = await (pipelineInstance as any)(text, {
        voice,
    });

    // result.audio is Float32Array, result.sampling_rate is number
    const wavBlob = float32ToWavBlob(result.audio, result.sampling_rate);
    console.log(`[HF:Kokoro] ✅ Synthesis complete`);
    return wavBlob;
}

export function stopKokoro() {
    if (activeAudio) {
        activeAudio.pause();
        activeAudio.src = '';
        activeAudio = null;
    }
}

export async function playKokoroAudio(
    text: string,
    voiceGender: 'male' | 'female' = 'female'
): Promise<void> {
    stopKokoro(); // ✅ stop any previous playback first

    const wavBlob = await synthesizeWithHuggingFace(text, voiceGender);
    const url = URL.createObjectURL(wavBlob);

    const audio = new Audio(url);
    audio.onended = () => {
        URL.revokeObjectURL(url);
        activeAudio = null;
    };
    audio.onerror = () => {
        URL.revokeObjectURL(url);
        activeAudio = null;
    };

    activeAudio = audio;

    return new Promise((resolve, reject) => {
        audio.onended = () => {
            URL.revokeObjectURL(url);
            activeAudio = null;
            resolve();
        };
        audio.onerror = () => {
            URL.revokeObjectURL(url);
            activeAudio = null;
            reject(new Error('Audio playback failed'));
        };
        audio.play().catch(reject);
    });
}

export function isModelReady(): boolean {
    return pipelineInstance !== null;
}

export function getModelStatus(): string {
    if (pipelineInstance) return 'ready';
    if (loadPromise) return 'loading';
    return 'not-loaded';
}

// Convert Float32Array PCM to WAV Blob
function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const write = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };

    write(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}
