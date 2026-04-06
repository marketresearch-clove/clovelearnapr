import React, { useState, useEffect, useRef } from 'react';
import { ttsService, TTSProvider } from '../lib/ttsService';
import { contentChunker, type ContentChunk, type ParsedContent } from '../lib/contentChunker';
import {
    FaPlay,
    FaPause,
    FaStop,
    FaForward,
    FaBackward,
} from 'react-icons/fa';

interface EnhancedTextToSpeechProps {
    text: string;
    blockId: string;
    lessonId: string;
    contentType?: 'lecture' | 'summary' | 'quiz' | 'note';
    voiceGender?: 'male' | 'female';
    onSentenceChange?: (sentenceIndex: number, totalSentences: number) => void;
    onWordChange?: (sentenceIndex: number, wordIndex: number, sentenceText: string) => void;
    onPlayStateChange?: (isPlaying: boolean) => void;
    useCache?: boolean;
    enableBackgroundMusic?: boolean;
}

export interface EnhancedTextToSpeechRef {
    togglePlayPause: () => void;
    stop: () => void;
    playNext: () => void;
    playPrevious: () => void;
}

const EnhancedTextToSpeech = React.forwardRef<
    EnhancedTextToSpeechRef,
    EnhancedTextToSpeechProps
>(
    (
        {
            text,
            blockId,
            lessonId,
            contentType = 'lecture',
            voiceGender = 'female',
            onSentenceChange,
            onWordChange,
            onPlayStateChange,
            useCache = true,
            enableBackgroundMusic = true,
        },
        ref
    ) => {
        const [isPlaying, setIsPlaying] = useState(false);
        const [isPaused, setIsPaused] = useState(false);
        const [isLoading, setIsLoading] = useState(false);
        const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
        const [audioChunks, setAudioChunks] = useState<Array<any>>([]);
        const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);
        const [expandedView, setExpandedView] = useState(false);
        const [currentProvider, setCurrentProvider] = useState<TTSProvider>('browser');
        const [error, setError] = useState<string | null>(null);
        const [currentTime, setCurrentTime] = useState(0);
        const [totalDuration, setTotalDuration] = useState(0);

        const audioRef = useRef<HTMLAudioElement>(null);
        const playQueueRef = useRef<{ url: string; duration: number }[]>([]);
        const currentPlayQueueIndexRef = useRef(0);

        // Parse content on mount
        useEffect(() => {
            try {
                const parsed = contentChunker.parse(text);
                setParsedContent(parsed);

                // Create audio chunks
                const audioChks = contentChunker.createAudioChunks(parsed.chunks);
                setAudioChunks(audioChks);
            } catch (error) {
                console.error('[EnhancedTTS] Error parsing content:', error);
                setError('Failed to parse lesson content');
            }
        }, [text]);

        // Initialize audio fetching when play starts
        useEffect(() => {
            if (isPlaying && audioChunks.length > 0) {
                loadAudioChunk(currentChunkIndex);
            }
        }, [isPlaying, currentChunkIndex]);

        // Setup audio event listeners for time tracking
        useEffect(() => {
            const audio = audioRef.current;
            if (!audio) return;

            const handleTimeUpdate = () => {
                setCurrentTime(audio.currentTime);
            };

            const handleLoadedMetadata = () => {
                setTotalDuration(audio.duration);
            };

            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);

            return () => {
                audio.removeEventListener('timeupdate', handleTimeUpdate);
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            };
        }, []);

        /**
         * Load and play audio for a specific chunk
         */
        const loadAudioChunk = async (chunkIndex: number) => {
            if (chunkIndex >= audioChunks.length) {
                handlePlayComplete();
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                const audioChunk = audioChunks[chunkIndex];
                const combinedText = audioChunk.texts.join(' ');

                // Synthesize using TTS service
                const result = await ttsService.synthesize(combinedText, {
                    contentType: contentType as any,
                    lessonId,
                    blockId: `${blockId}_chunk_${chunkIndex}`,
                    chunkIndex,
                    useCache,
                    voiceGender,
                });

                setCurrentProvider(result.provider);

                if (audioRef.current) {
                    audioRef.current.src = result.audioUrl;
                    audioRef.current.play().catch((err) => {
                        console.error('[EnhancedTTS] Play error:', err);
                        setError('Failed to play audio');
                    });
                }

                setIsLoading(false);
            } catch (error) {
                console.error('[EnhancedTTS] Error loading audio chunk:', error);
                setError('Failed to load audio');
                setIsLoading(false);
            }
        };

        /**
         * Handle audio playback completion
         */
        const handlePlayComplete = () => {
            if (currentChunkIndex < audioChunks.length - 1) {
                setCurrentChunkIndex(currentChunkIndex + 1);
            } else {
                setIsPlaying(false);
                setCurrentChunkIndex(0);
                onPlayStateChange?.(false);
            }
        };

        /**
         * Toggle play/pause
         */
        const handleTogglePlay = async () => {
            if (isPlaying) {
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                setIsPlaying(false);
                setIsPaused(true);
            } else {
                if (isPaused && audioRef.current) {
                    audioRef.current.play();
                } else {
                    setCurrentChunkIndex(0);
                    setIsLoading(true);
                }
                setIsPlaying(true);
                setIsPaused(false);
            }
            onPlayStateChange?.(!isPlaying);
        };

        /**
         * Stop playback
         */
        const handleStop = () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentChunkIndex(0);
            onPlayStateChange?.(false);
        };

        /**
         * Play next chunk
         */
        const handleNext = () => {
            if (currentChunkIndex < audioChunks.length - 1) {
                setCurrentChunkIndex(currentChunkIndex + 1);
            }
        };

        /**
         * Play previous chunk
         */
        const handlePrevious = () => {
            if (currentChunkIndex > 0) {
                setCurrentChunkIndex(currentChunkIndex - 1);
            } else if (isPlaying) {
                // If at beginning, restart current chunk
                if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                }
            }
        };

        // Expose ref methods
        React.useImperativeHandle(ref, () => ({
            togglePlayPause: handleTogglePlay,
            stop: handleStop,
            playNext: handleNext,
            playPrevious: handlePrevious,
        }));

        if (!parsedContent || audioChunks.length === 0) {
            return null;
        }

        const totalChunks = audioChunks.length;
        const progress = totalChunks > 0 ? ((currentChunkIndex + 1) / totalChunks) * 100 : 0;

        /**
         * Format seconds to MM:SS or MM:SS format
         */
        const formatTime = (seconds: number): string => {
            if (!isFinite(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const remainingTime = totalDuration - currentTime;

        return (
            <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-md overflow-hidden">
                {/* Thin Progress Bar with Time Duration */}
                <div className="relative h-1.5 bg-gray-300 dark:bg-gray-600 overflow-hidden group cursor-pointer">
                    <div
                        className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(progress, 0)}%`, minWidth: progress > 0 ? '4px' : '0px' }}
                    />

                    {/* Time Info on Hover */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 dark:bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                        {formatTime(currentTime)} / {formatTime(totalDuration)} ({progress.toFixed(1)}%)
                    </div>
                </div>

                <div className="p-4">
                    {error && (
                        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded text-sm">
                            {error}
                        </div>
                    )}

                    {/* Main Controls */}
                    <div className="flex items-center gap-3 mb-4">
                        {/* Play/Pause Button */}
                        <button
                            onClick={handleTogglePlay}
                            disabled={isLoading}
                            className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white transition"
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isLoading ? (
                                <div className="animate-spin">⏳</div>
                            ) : isPlaying ? (
                                <FaPause />
                            ) : (
                                <FaPlay />
                            )}
                        </button>

                        {/* Stop Button */}
                        <button
                            onClick={handleStop}
                            className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition"
                            title="Stop"
                        >
                            <FaStop />
                        </button>

                        {/* Previous Button */}
                        <button
                            onClick={handlePrevious}
                            disabled={currentChunkIndex === 0 && !isPlaying}
                            className="p-2 rounded-full bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white transition"
                            title="Previous"
                        >
                            <FaBackward />
                        </button>

                        {/* Next Button */}
                        <button
                            onClick={handleNext}
                            disabled={currentChunkIndex >= totalChunks - 1}
                            className="p-2 rounded-full bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white transition"
                            title="Next"
                        >
                            <FaForward />
                        </button>

                        {/* Progress Display */}
                        <div className="flex-1">
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                    Chunk {currentChunkIndex + 1}/{totalChunks}
                                </span>
                            </div>
                            <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Current Provider Badge */}
                        <div className="text-xs font-semibold px-2 py-1 bg-white dark:bg-slate-700 rounded text-gray-700 dark:text-gray-300">
                            {currentProvider === 'browser' && '🌐 Browser'}
                        </div>

                    </div>

                    {/* Content Summary (for long lessons) */}
                    {parsedContent.summary && (
                        <details className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                            <summary className="cursor-pointer font-semibold hover:text-blue-600 dark:hover:text-blue-400">
                                📝 Lesson Summary
                            </summary>
                            <p className="mt-2 p-2 bg-white dark:bg-slate-700 rounded italic">
                                {parsedContent.summary}
                            </p>
                        </details>
                    )}

                    {/* Metadata */}
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 border-t dark:border-gray-600 pt-3">
                        <div>
                            📊 Total Words: <strong>{parsedContent.totalWordCount}</strong>
                        </div>
                        <div>
                            ⏱️ Estimated Time: <strong>{Math.ceil(parsedContent.totalEstimatedReadTime)}s</strong>
                        </div>
                        <div>
                            🎯 Content Type: <strong className="capitalize">{contentType}</strong>
                        </div>
                    </div>

                    {/* Hidden Audio Element */}
                    <audio ref={audioRef} onEnded={() => handlePlayComplete()} crossOrigin="anonymous" />
                </div>
            </div>
        );
    }
);

EnhancedTextToSpeech.displayName = 'EnhancedTextToSpeech';

export default EnhancedTextToSpeech;
