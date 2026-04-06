import React, { useState, useEffect, useRef } from 'react';

interface TextToSpeechProps {
    text: string;
    voiceGender?: 'male' | 'female';
    onSentenceChange?: (sentenceIndex: number, totalSentences: number) => void;
    onWordChange?: (sentenceIndex: number, wordIndex: number, sentenceText: string) => void;
    onVoiceGenderChange?: (gender: 'male' | 'female') => void;
    enableBackgroundMusic?: boolean;
    playbackSpeed?: number;
    volume?: number;
}

export interface TextToSpeechRef {
    togglePlayPause: () => void;
    stop: () => void;
}

const TextToSpeech = React.forwardRef<TextToSpeechRef, TextToSpeechProps>(({ text, voiceGender = 'female', onSentenceChange, onWordChange, onVoiceGenderChange, enableBackgroundMusic = true, playbackSpeed = 1, volume = 1 }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [sentenceProgress, setSentenceProgress] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const sentencesRef = useRef<string[]>([]);
    const wordsRef = useRef<string[]>([]);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const isSpeakingRef = useRef<boolean>(false);
    const isPlayingRef = useRef<boolean>(false);
    const isPausedRef = useRef<boolean>(false);
    const isStartingRef = useRef<boolean>(false);
    const currentSentenceIndexRef = useRef<number>(0);
    const voiceGenderRef = useRef<'male' | 'female'>('female');

    // Extract sentences from HTML text
    const extractSentences = (html: string): string[] => {
        // Remove HTML tags
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';

        console.log('[TTS:extractSentences] Input text length:', html.length);
        console.log('[TTS:extractSentences] Extracted plain text length:', plainText.length);
        console.log('[TTS:extractSentences] Plain text:', plainText.substring(0, 200) + '...');

        // Normalize whitespace - fix missing spaces after punctuation
        let normalized = plainText
            .replace(/([.!?])([A-Z])/g, '$1 $2') // Add space after punctuation if missing
            .replace(/\s+/g, ' ') // Normalize multiple spaces
            .trim();

        // Split by sentence endings, keeping some intelligence about abbreviations
        let sentences = normalized
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 0)
            .map(s => s.trim());

        // If we only got one sentence and text is long (likely missing ending punctuation),
        // split on line breaks or paragraph breaks as fallback
        if (sentences.length <= 1 && normalized.length > 200) {
            console.log('[TTS:extractSentences] Only one sentence found in long text, attempting alternative split...');
            sentences = normalized
                .split(/[\n\r]+|,(?=\s*[A-Z])|;/)
                .filter(s => s.trim().length > 0)
                .map(s => s.trim());
        }

        // Further chunk sentences that are too long (browser TTS has issues with very long utterances)
        const maxSentenceLength = 300; // Browser TTS works best with ~300 char sentences
        const chunkedSentences: string[] = [];

        for (const sentence of sentences) {
            if (sentence.length > maxSentenceLength) {
                // Split on commas, semicolons, or conjunctions for long sentences
                const parts = sentence.split(/,|;|(?=\bbut\b|but(?=\s)|and(?=\s)|however|therefore|meanwhile|additionally|furthermore)/i)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                if (parts.length > 1) {
                    chunkedSentences.push(...parts);
                    console.log(`[TTS:extractSentences] Split long sentence (${sentence.length}ch) into ${parts.length} parts`);
                } else {
                    chunkedSentences.push(sentence);
                }
            } else {
                chunkedSentences.push(sentence);
            }
        }

        console.log('[TTS:extractSentences] Total sentences extracted:', chunkedSentences.length);
        console.log('[TTS:extractSentences] First 3 sentences:', chunkedSentences.slice(0, 3));
        chunkedSentences.forEach((s, i) => {
            console.log(`  Sentence ${i + 1}: ${s.length} chars - ${s.substring(0, 60)}...`);
        });

        return chunkedSentences;
    };

    // Extract words from a sentence
    const extractWords = (sentence: string): string[] => {
        return sentence
            .split(/\s+/)
            .filter(w => w.length > 0);
    };

    // Get voice based on gender preference - improved selection
    const getVoiceByGender = (gender: 'male' | 'female'): SpeechSynthesisVoice | undefined => {
        const voices = window.speechSynthesis.getVoices();

        if (voices.length === 0) {
            console.warn('[TTS] No voices available yet');
            return undefined;
        }

        console.log('[TTS] Available voices:', voices.map(v => v.name).join(', '));

        // Prioritized list of preferred voices by gender
        const preferredMaleVoices = [
            'Microsoft David',
            'Google UK English Male',
            'Alex',
            'Daniel',
            'David',
            'Marcus',
            'Ryan'
        ];

        const preferredFemaleVoices = [
            'Microsoft Zira',
            'Google UK English Female',
            'Victoria',
            'Samantha',
            'Moira',
            'Fiona',
            'Jennifer',
            'Amy'
        ];

        const preferredList = gender === 'male' ? preferredMaleVoices : preferredFemaleVoices;
        console.log('[TTS] Looking for', gender, 'voice. Preferred list:', preferredList.join(', '));

        // Try exact matches first
        for (const preference of preferredList) {
            const voice = voices.find(v => v.name === preference);
            if (voice) {
                console.log('[TTS] Selected voice:', preference);
                return voice;
            }
        }

        // Try keyword matching
        const keywords = gender === 'male'
            ? ['male', 'man', 'boy', 'deep']
            : ['female', 'woman', 'girl'];

        console.log('[TTS] No exact match found, trying keyword matching with:', keywords.join(', '));
        for (const keyword of keywords) {
            const voice = voices.find(v => v.name.toLowerCase().includes(keyword));
            if (voice) {
                console.log('[TTS] Selected voice by keyword:', keyword, '- Voice name:', voice.name);
                return voice;
            }
        }

        // Last resort: use first available voice
        console.log('[TTS] Using fallback voice:', voices[0].name);
        return voices[0];
    };

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle voice gender change - restart current sentence if speaking
    useEffect(() => {
        voiceGenderRef.current = voiceGender;
        console.log('[TTS:voiceGenderChange] ========== VOICE CHANGED ==========');
        console.log('[TTS:voiceGenderChange] New voice gender:', voiceGender);
        console.log('[TTS:voiceGenderChange] isPlayingRef.current:', isPlayingRef.current);
        console.log('[TTS:voiceGenderChange] isSpeakingRef.current:', isSpeakingRef.current);

        if ((isPlayingRef.current || isSpeakingRef.current) && synthRef.current) {
            console.log('[TTS:voiceGenderChange] Voice is playing, restarting with new voice...');
            console.log('[TTS:voiceGenderChange] Cancelling current speech');
            synthRef.current.cancel();

            // Restart from current sentence using the ref
            setTimeout(() => {
                if (isPlayingRef.current) {
                    console.log('[TTS:voiceGenderChange] Restarting from sentence:', currentSentenceIndexRef.current, 'with voice:', voiceGenderRef.current);
                    speak(currentSentenceIndexRef.current);
                }
            }, 50);
        } else {
            console.log('[TTS:voiceGenderChange] Not playing, voice change noted for next playback');
        }
        console.log('[TTS:voiceGenderChange] ====================================');
    }, [voiceGender]);

    useEffect(() => {
        sentencesRef.current = extractSentences(text);
        currentSentenceIndexRef.current = 0;
        setCurrentSentenceIndex(0);
    }, [text]);

    useEffect(() => {
        const synth = window.speechSynthesis;
        synthRef.current = synth;

        // Load voices when they become available
        const loadVoices = () => {
            synth.getVoices();
        };

        // Some browsers load voices asynchronously
        loadVoices();
        synth.onvoiceschanged = loadVoices;

        return () => {
            if (synth.speaking) {
                synth.cancel();
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            synth.onvoiceschanged = null;
        };
    }, []);

    // Main speak function - browser TTS only with slower playback
    const speak = (startIndex: number = 0) => {
        // Guard against concurrent calls (prevents duplicate playback)
        if (isSpeakingRef.current || isStartingRef.current) {
            console.log('[TTS:speak] Already speaking or starting, ignoring re-entry call');
            return;
        }

        isStartingRef.current = true;

        // Cancel any existing utterance before starting new playback
        const synth = synthRef.current;
        if (synth && synth.speaking) {
            synth.cancel();
        }

        isSpeakingRef.current = true;
        setIsSpeaking(true);
        isPlayingRef.current = true;
        setIsPlaying(true);
        isStartingRef.current = false;

        const playNextSentence = (startIdx: number) => {
            const sentences = sentencesRef.current;
            if (startIdx >= sentences.length || !isPlayingRef.current) {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                setIsPlaying(false);
                return;
            }

            const sentence = sentences[startIdx];
            currentSentenceIndexRef.current = startIdx;
            setCurrentSentenceIndex(startIdx);
            onSentenceChange?.(startIdx, sentences.length);

            console.log(`[TTS:speak] Starting sentence ${startIdx + 1}/${sentences.length}`);

            const synth = synthRef.current;
            if (!synth) {
                console.error('[TTS:speak] No speech synthesis available');
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                return;
            }

            const utterance = new SpeechSynthesisUtterance(sentence);

            // Use playback speed prop (0.5x to 2x)
            utterance.rate = playbackSpeed;
            utterance.pitch = 1;

            const selectedVoice = getVoiceByGender(voiceGenderRef.current);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log(`[TTS:speak] ✓ Voice assigned: "${selectedVoice.name}" (${voiceGenderRef.current})`);
            } else {
                console.log(`[TTS:speak] ⚠ No voice selected for gender: ${voiceGenderRef.current}`);
            }

            utteranceRef.current = utterance;

            // Track if we've already handled this utterance ending to prevent duplicate playback
            let hasHandledEnd = false;

            utterance.onend = () => {
                if (hasHandledEnd) return;
                hasHandledEnd = true;
                console.log(`[TTS:Browser] Sentence ${startIdx + 1} completed, isPlayingRef:`, isPlayingRef.current);
                // Clear paused state since we completed this utterance
                isPausedRef.current = false;
                // Continue to next sentence
                playNextSentence(startIdx + 1);
            };

            utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
                if (hasHandledEnd) return;
                // Only retry if it's not an "interrupted" error (which is expected when user pauses/stops)
                if (event.error !== 'interrupted') {
                    console.error('[TTS:Browser] Error speaking sentence:', event.error, 'Retrying...');
                    hasHandledEnd = true;
                    // Retry same sentence after a brief delay
                    setTimeout(() => playNextSentence(startIdx), 500);
                } else {
                    console.log('[TTS:Browser] Sentence interrupted (expected for pause/stop)');
                    hasHandledEnd = true;
                }
            };

            console.log('[TTS:Browser] Speaking sentence:', startIdx + 1, ':', sentence.substring(0, 100));
            try {
                synth.speak(utterance);
            } catch (err) {
                console.error('[TTS:Browser] Exception during speak:', err);
                hasHandledEnd = true;
                playNextSentence(startIdx + 1);
            }
        };

        // Start playing from the starting index
        playNextSentence(startIndex);
    };

    const handlePrevious = () => {
        const synth = synthRef.current;
        if (synth) {
            synth.cancel();
        }
        const newIndex = Math.max(0, currentSentenceIndex - 1);
        currentSentenceIndexRef.current = newIndex;
        onSentenceChange?.(newIndex, sentencesRef.current.length);

        if (isPlaying) {
            // Reset state and start from previous sentence
            isSpeakingRef.current = false;
            setCurrentSentenceIndex(newIndex);
            speak(newIndex);
        }
    };

    const handleNext = () => {
        const synth = synthRef.current;
        if (synth) {
            synth.cancel();
        }
        const newIndex = Math.min(sentencesRef.current.length - 1, currentSentenceIndex + 1);
        currentSentenceIndexRef.current = newIndex;
        onSentenceChange?.(newIndex, sentencesRef.current.length);

        if (isPlaying) {
            // Reset state and start from next sentence
            isSpeakingRef.current = false;
            setCurrentSentenceIndex(newIndex);
            speak(newIndex);
        }
    };

    const handleStop = () => {
        const synth = synthRef.current;
        if (!synth) return;

        synth.cancel();
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        currentSentenceIndexRef.current = 0;
        setIsPlaying(false);
        setIsSpeaking(false);
        setCurrentSentenceIndex(0);
        setCurrentWordIndex(0);
        setSentenceProgress(0);
    };

    const handleMouseEnter = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setIsExpanded(true);
        }, 300); // Delay expansion slightly for better UX
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setIsExpanded(false);
    };



    // Handle voice gender toggle
    const handleVoiceGenderToggle = () => {
        const newGender = voiceGender === 'female' ? 'male' : 'female';
        console.log('');
        console.log('[TTS:voiceGenderToggle] ▶▶▶ USER CLICKED VOICE TOGGLE ◀◀◀');
        console.log('[TTS:voiceGenderToggle] Current gender:', voiceGender);
        console.log('[TTS:voiceGenderToggle] New gender:', newGender);
        console.log('[TTS:voiceGenderToggle] Calling onVoiceGenderChange callback...');
        onVoiceGenderChange?.(newGender);
        console.log('[TTS:voiceGenderToggle] Callback sent to parent component');
    };

    // Expose ref methods for parent control
    React.useImperativeHandle(ref, () => ({
        togglePlayPause: () => {
            const synth = synthRef.current;
            if (!synth) {
                console.error('[TTS] Speech synthesis not available');
                return;
            }

            console.log('[TTS:togglePlayPause] Current state - isPlaying:', isPlaying, 'isSpeaking:', isSpeaking, 'isPaused:', isPausedRef.current);

            if (isPlaying) {
                // Pause playback
                console.log('[TTS:togglePlayPause] Pausing...');
                synth.pause();
                isPausedRef.current = true;
                isPlayingRef.current = false;
                setIsPlaying(false);
            } else {
                // Resume or start playback
                console.log('[TTS:togglePlayPause] isPaused:', isPausedRef.current, 'isSpeaking:', isSpeaking);

                if (isPausedRef.current && isSpeaking) {
                    // Resume from paused state
                    console.log('[TTS:togglePlayPause] Resuming paused synthesis...');
                    isPausedRef.current = false;
                    isPlayingRef.current = true;
                    setIsPlaying(true);
                    synth.resume();
                } else if (isSpeakingRef.current && isSpeaking) {
                    // Already speaking but play button clicked (shouldn't happen in normal flow)
                    console.log('[TTS:togglePlayPause] Already speaking, updating isPlaying state');
                    isPlayingRef.current = true;
                    setIsPlaying(true);
                } else {
                    // Start fresh - but check if already starting to prevent race conditions
                    if (isStartingRef.current) {
                        console.log('[TTS:togglePlayPause] Already starting, ignoring duplicate call');
                        return;
                    }
                    console.log('[TTS:togglePlayPause] Starting from beginning...');
                    isPausedRef.current = false;
                    isSpeakingRef.current = false; // Reset for new playback
                    setIsSpeaking(false); // Clear any stale state
                    isPlayingRef.current = true;
                    setIsPlaying(true);
                    speak(currentSentenceIndex);
                }
            }
        },
        stop: () => {
            console.log('[TTS:stop] Stopping TTS');
            const synth = synthRef.current;
            if (synth) {
                synth.cancel();
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            isPausedRef.current = false;
            isPlayingRef.current = false;
            isSpeakingRef.current = false;
            currentSentenceIndexRef.current = 0;
            setIsPlaying(false);
            setIsSpeaking(false);
            setCurrentSentenceIndex(0);
            setCurrentWordIndex(0);
            setSentenceProgress(0);
        }
    }), [isPlaying, currentSentenceIndex, isSpeaking, voiceGender]);

    const totalSentences = sentencesRef.current.length;
    const hasContent = totalSentences > 0;

    if (!hasContent) return null;

    // Get current sentence and words
    const currentSentence = sentencesRef.current[currentSentenceIndex] || '';
    const currentWords = wordsRef.current;

    // Render sentence with word highlighting
    const renderHighlightedSentence = () => {
        return currentWords.map((word, idx) => (
            <span
                key={idx}
                className={`transition-all duration-200 ${idx <= currentWordIndex
                    ? 'bg-green-200 dark:bg-green-700 font-semibold'
                    : ''
                    }`}
            >
                {word}
                {idx < currentWords.length - 1 ? ' ' : ''}
            </span>
        ));
    };

    return (
        <div className={`fixed z-40 transition-all duration-300 ${isMobile
            ? 'bottom-4 left-4 right-4'
            : 'bottom-8 right-8'
            }`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >


            {/* Tooltip */}
            {!isExpanded && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-1 rounded-md whitespace-nowrap pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-200">
                    Text to Speech
                </div>
            )}

            {/* Mobile Sentence Display */}
            {isMobile && isSpeaking && (
                <div className="absolute top-[-140px] left-0 right-0 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-3 border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom">
                    <p className="text-sm text-slate-600 dark:text-slate-400 break-words leading-relaxed">
                        {renderHighlightedSentence()}
                    </p>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {currentSentenceIndex + 1} / {totalSentences}
                    </div>
                </div>
            )}
        </div>
    );
});

TextToSpeech.displayName = 'TextToSpeech';
export default TextToSpeech;
