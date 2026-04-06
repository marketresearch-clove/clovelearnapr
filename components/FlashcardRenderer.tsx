import React, { useState, useEffect, useRef } from 'react';
import { flashcardService, Flashcard, FlashcardSetCompletion } from '../lib/flashcardService';
import { flashcardColorService, FlashcardColorSettings } from '../lib/flashcardColorService';
import TextToSpeech, { TextToSpeechRef } from './TextToSpeech';
import './FlashcardRenderer.css';

interface FlashcardRendererProps {
    flashcardSetId: string;
    lessonId: string;
    courseId: string;
    title: string;
    description?: string;
    userId?: string;
    onComplete?: (completion: FlashcardSetCompletion) => void;
    inlineFlashcards?: any[]; // Flashcards stored inline in lesson content
}

interface CardState {
    cardId: string;
    isFlipped: boolean;
    isCompleted: boolean;
}

const FlashcardRenderer: React.FC<FlashcardRendererProps> = ({
    flashcardSetId,
    lessonId,
    courseId,
    title,
    description,
    userId,
    onComplete,
    inlineFlashcards = [],
}) => {
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [setCompletion, setSetCompletion] = useState<FlashcardSetCompletion | null>(null);
    const [showProgress, setShowProgress] = useState(true);
    const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
    const [quizFeedback, setQuizFeedback] = useState<Record<string, 'correct' | 'incorrect' | null>>({});
    const [colorSettings, setColorSettings] = useState<FlashcardColorSettings | null>(null);
    const [ttsText, setTtsText] = useState<string>('');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [playerVolume, setPlayerVolume] = useState(1);
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const ttsRef = useRef<TextToSpeechRef>(null);
    const playbackInitiatedRef = useRef<boolean>(false);

    useEffect(() => {
        loadFlashcards();
        loadColorSettings();
    }, [flashcardSetId, userId, courseId, inlineFlashcards]);

    // Auto-read the front side when card changes
    useEffect(() => {
        if (flashcards.length > 0 && currentCardIndex < flashcards.length) {
            const currentCard = flashcards[currentCardIndex];
            const currentState = cardStates[currentCard.id];

            // Stop previous speech and reset playback flag
            if (ttsRef.current) {
                ttsRef.current.stop();
            }
            playbackInitiatedRef.current = false;

            // Read front if not flipped
            if (!currentState?.isFlipped) {
                setTtsText(currentCard.front);
                // Give it a moment to update, then play
                // Only initiate playback once per card change
                if (!playbackInitiatedRef.current) {
                    playbackInitiatedRef.current = true;
                    setTimeout(() => {
                        if (ttsRef.current) {
                            ttsRef.current.togglePlayPause();
                        }
                    }, 100);
                }
            }
        }
    }, [currentCardIndex, flashcards]);

    const handleQuizAnswer = (cardId: string, answerIndex: number) => {
        const card = flashcards.find(c => c.id === cardId);
        if (!card || !card.quiz_data) return;

        setQuizAnswers(prev => ({ ...prev, [cardId]: answerIndex }));

        const isCorrect = answerIndex === card.quiz_data.correct_answer;
        setQuizFeedback(prev => ({
            ...prev,
            [cardId]: isCorrect ? 'correct' : 'incorrect'
        }));

        if (isCorrect && !cardStates[cardId]?.isCompleted) {
            toggleCardComplete(cardId);
        }
    };

    const loadColorSettings = async () => {
        try {
            // Try to load course-specific settings first
            let settings = await flashcardColorService.getColorSettings(courseId);

            // If no course-specific settings, try global settings
            if (!settings) {
                settings = await flashcardColorService.getGlobalColorSettings();
            }

            setColorSettings(settings);
        } catch (error) {
            console.error('Error loading color settings:', error);
            // Continue with default colors if loading fails
        }
    };

    const loadFlashcards = async () => {
        try {
            setIsLoading(true);

            // First, check if we have inline flashcards from lesson content
            if (inlineFlashcards && Array.isArray(inlineFlashcards) && inlineFlashcards.length > 0) {
                const cards = inlineFlashcards.map((card: any) => ({
                    ...card,
                    id: card.id || crypto.randomUUID(),
                    flashcard_set_id: flashcardSetId,
                }));
                setFlashcards(cards);

                // Initialize card states
                if (cards.length > 0 && userId) {
                    const initialStates: Record<string, CardState> = {};
                    cards.forEach((card) => {
                        initialStates[card.id] = {
                            cardId: card.id,
                            isFlipped: false,
                            isCompleted: false,
                        };
                    });
                    setCardStates(initialStates);
                } else if (cards.length > 0) {
                    const initialStates: Record<string, CardState> = {};
                    cards.forEach((card) => {
                        initialStates[card.id] = {
                            cardId: card.id,
                            isFlipped: false,
                            isCompleted: false,
                        };
                    });
                    setCardStates(initialStates);
                }
                setIsLoading(false);
                return;
            }

            // If no inline flashcards, try to fetch from flashcard_sets table (requires valid UUID)
            // Validate flashcardSetId is a proper UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(flashcardSetId)) {
                console.warn('Invalid flashcard set ID format:', flashcardSetId);
                setFlashcards([]);
                setIsLoading(false);
                return;
            }

            const cards = await flashcardService.getFlashcards(flashcardSetId);
            setFlashcards(cards);

            // Initialize card states
            if (cards.length > 0 && userId) {
                const progress = await flashcardService.getSetProgress(userId, flashcardSetId);
                const initialStates: Record<string, CardState> = {};

                cards.forEach((card) => {
                    const cardProgress = progress.find((p) => p.flashcard_id === card.id);
                    initialStates[card.id] = {
                        cardId: card.id,
                        isFlipped: false,
                        isCompleted: cardProgress?.is_completed || false,
                    };
                });

                setCardStates(initialStates);

                // Load set completion
                const completion = await flashcardService.getSetCompletion(userId, flashcardSetId);
                if (completion) {
                    setSetCompletion(completion);
                }
            } else if (cards.length > 0) {
                // No user - just initialize empty states
                const initialStates: Record<string, CardState> = {};
                cards.forEach((card) => {
                    initialStates[card.id] = {
                        cardId: card.id,
                        isFlipped: false,
                        isCompleted: false,
                    };
                });
                setCardStates(initialStates);
            }
        } catch (error) {
            console.error('Error loading flashcards:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFlip = (cardId: string) => {
        const currentCard = flashcards.find(c => c.id === cardId);
        if (!currentCard) return;

        // Stop current speech and reset playback flag
        if (ttsRef.current) {
            ttsRef.current.stop();
        }
        playbackInitiatedRef.current = false;

        // Toggle flip state
        setCardStates((prev) => {
            const newFlippedState = !prev[cardId]?.isFlipped;
            return {
                ...prev,
                [cardId]: {
                    ...prev[cardId],
                    isFlipped: newFlippedState,
                },
            };
        });

        // Get the new flipped state and set text accordingly
        const currentState = cardStates[cardId];
        const willBeFlipped = !currentState?.isFlipped;

        // Update TTS text and trigger playback
        if (willBeFlipped) {
            // Flipping to back side
            setTtsText(currentCard.back);
            setTimeout(() => {
                if (ttsRef.current && !playbackInitiatedRef.current) {
                    playbackInitiatedRef.current = true;
                    ttsRef.current.togglePlayPause();
                }
            }, 100);
        } else {
            // Flipping back to front side
            setTtsText(currentCard.front);
            setTimeout(() => {
                if (ttsRef.current && !playbackInitiatedRef.current) {
                    playbackInitiatedRef.current = true;
                    ttsRef.current.togglePlayPause();
                }
            }, 100);
        }
    };

    const toggleCardComplete = async (cardId: string) => {
        if (!userId) {
            alert('Please log in to track progress');
            return;
        }

        try {
            const currentState = cardStates[cardId];
            const newCompletedState = !currentState.isCompleted;

            if (newCompletedState) {
                await flashcardService.markCardComplete(userId, cardId, flashcardSetId);
            } else {
                await flashcardService.markCardIncomplete(userId, cardId, flashcardSetId);
            }

            // Update local state
            setCardStates((prev) => ({
                ...prev,
                [cardId]: {
                    ...prev[cardId],
                    isCompleted: newCompletedState,
                },
            }));

            // Update set completion
            const updatedCompletion = await flashcardService.updateSetCompletion(
                userId,
                flashcardSetId
            );
            if (updatedCompletion) {
                setSetCompletion(updatedCompletion);
                if (updatedCompletion.is_completed && onComplete) {
                    onComplete(updatedCompletion);
                }
            }
        } catch (error) {
            console.error('Error toggling card completion:', error);
        }
    };

    const handleCardDifficulty = async (cardId: string, difficulty: 'easy' | 'difficult') => {
        if (!userId) return;

        try {
            await flashcardService.recordCardReview(userId, cardId, flashcardSetId, difficulty);
        } catch (error) {
            console.error('Error recording difficulty:', error);
        }
    };

    const goToNextCard = () => {
        if (currentCardIndex < flashcards.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
        }
    };

    const goToPreviousCard = () => {
        if (currentCardIndex > 0) {
            setCurrentCardIndex(currentCardIndex - 1);
        }
    };

    const jumpToCard = (index: number) => {
        setCurrentCardIndex(index);
    };

    if (isLoading) {
        return <div className="flashcard-loader">Loading flashcards...</div>;
    }

    if (flashcards.length === 0) {
        return <div className="flashcard-empty">No flashcards available for this topic.</div>;
    }

    const currentCard = flashcards[currentCardIndex];
    const currentState = cardStates[currentCard.id];
    const completedCount = Object.values(cardStates).filter((s) => s.isCompleted).length;
    const progressPercentage = (completedCount / flashcards.length) * 100;

    return (
        <div className="flashcard-container">
            {/* TTS Component - Visible Controls Only */}
            {ttsText && (
                <TextToSpeech
                    ref={ttsRef}
                    text={ttsText}
                    voiceGender={voiceGender}
                    onVoiceGenderChange={setVoiceGender}
                    playbackSpeed={playbackSpeed}
                    volume={playerVolume}
                />
            )}

            {/* Header */}
            <div className="flashcard-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>{title}</h2>
                        {description && <p className="flashcard-description">{description}</p>}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            {showProgress && (
                <div className="flashcard-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                    <div className="progress-text">
                        {completedCount} / {flashcards.length} completed
                    </div>
                </div>
            )}

            {/* Main Card Display */}
            <div className="flashcard-viewer">
                {/* Flip Card */}
                <div
                    className={`flip-card ${currentState.isFlipped ? 'flipped' : ''} ${currentCard.type === 'quiz' ? 'quiz-card' : ''}`}
                    onClick={(e) => {
                        if ((e.target as HTMLElement).closest('.quiz-option')) return;
                        toggleFlip(currentCard.id);
                    }}
                >
                    <div className="flip-card-inner">
                        {/* Front */}
                        <div
                            className="flip-card-front"
                            style={{
                                background: colorSettings ? `linear-gradient(135deg, ${colorSettings.card_front_gradient_start} 0%, ${colorSettings.card_front_gradient_end} 100%)` : undefined
                            }}
                        >
                            {currentState.isCompleted && (
                                <div className="card-completed-badge">
                                    <span className="checkmark">✓</span> Completed
                                </div>
                            )}
                            <div className="card-content">
                                <div className="card-label">
                                    {currentCard.type === 'quiz' ? 'Test Your Knowledge' : 'Question / Main Content'}
                                </div>
                                <div className="card-text">{currentCard.front}</div>

                                {currentCard.type === 'quiz' && currentCard.quiz_data && (
                                    <div className="quiz-options">
                                        {currentCard.quiz_data.options.map((option, idx) => {
                                            const isSelected = quizAnswers[currentCard.id] === idx;
                                            const feedback = quizFeedback[currentCard.id];
                                            let optionClass = 'quiz-option';
                                            if (isSelected) {
                                                optionClass += feedback === 'correct' ? ' correct' : ' incorrect';
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    className={optionClass}
                                                    onClick={() => handleQuizAnswer(currentCard.id, idx)}
                                                    disabled={!!quizAnswers[currentCard.id]}
                                                >
                                                    <span className="option-index">{String.fromCharCode(65 + idx)}</span>
                                                    <span className="option-text">{option}</span>
                                                    {isSelected && feedback === 'correct' && <span className="feedback-icon">✓</span>}
                                                    {isSelected && feedback === 'incorrect' && <span className="feedback-icon">✗</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="flip-hint">
                                {currentCard.type === 'quiz'
                                    ? (quizAnswers[currentCard.id] ? 'Click to see explanation' : 'Select an answer to continue')
                                    : 'Click to reveal answer'}
                            </div>
                        </div>

                        {/* Back */}
                        <div
                            className="flip-card-back"
                            style={{
                                background: colorSettings ? `linear-gradient(135deg, ${colorSettings.card_back_gradient_start} 0%, ${colorSettings.card_back_gradient_end} 100%)` : undefined
                            }}
                        >
                            {currentState.isCompleted && (
                                <div className="card-completed-badge">
                                    <span className="checkmark">✓</span> Completed
                                </div>
                            )}
                            <div className="card-content">
                                <div className="card-label">
                                    {currentCard.type === 'quiz' ? 'Explanation' : 'Answer / More Info'}
                                </div>
                                <div className="card-text">{currentCard.back}</div>
                                {currentCard.type === 'quiz' && currentCard.quiz_data?.explanation && (
                                    <div className="explanation-text mt-4 text-sm opacity-90 italic">
                                        {currentCard.quiz_data.explanation}
                                    </div>
                                )}
                            </div>
                            <div className="flip-hint">Click to flip back</div>
                        </div>
                    </div>
                </div>

                {/* Card Actions */}
                <div className="card-actions">
                    <button
                        className={`action-btn complete-btn ${currentState.isCompleted ? 'completed' : ''
                            }`}
                        onClick={() => toggleCardComplete(currentCard.id)}
                        title="Mark as complete"
                    >
                        <span className="checkmark">✓</span>
                        {currentState.isCompleted ? 'Completed' : 'Mark as Complete'}
                    </button>

                    <div className="difficulty-buttons">
                        <button
                            className="difficulty-btn easy"
                            onClick={() => handleCardDifficulty(currentCard.id, 'easy')}
                            title="Easy to understand"
                        >
                            😊 Easy
                        </button>
                        <button
                            className="difficulty-btn difficult"
                            onClick={() => handleCardDifficulty(currentCard.id, 'difficult')}
                            title="Difficult - needs more review"
                        >
                            🤔 Difficult
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flashcard-navigation">
                <button
                    className="nav-btn prev-btn"
                    onClick={goToPreviousCard}
                    disabled={currentCardIndex === 0}
                    aria-label="Go to previous card"
                    title={currentCardIndex === 0 ? "You're on the first card" : "Go to previous card"}
                >
                    <span className="material-symbols-rounded" style={{ fontSize: '1.2em' }}>chevron_left</span>
                    <span className="nav-label">Previous</span>
                </button>

                <div className="card-counter">
                    <span className="material-symbols-rounded" style={{ fontSize: '1.1em' }}>bookmark</span>
                    <span>{currentCardIndex + 1} / {flashcards.length}</span>
                </div>

                <button
                    className="nav-btn next-btn"
                    onClick={goToNextCard}
                    disabled={currentCardIndex === flashcards.length - 1}
                    aria-label="Go to next card"
                    title={currentCardIndex === flashcards.length - 1 ? "You're on the last card" : "Go to next card"}
                >
                    <span className="nav-label">Next</span>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.2em' }}>chevron_right</span>
                </button>
            </div>

            {/* Card Grid Overview */}
            <div className="flashcard-grid">
                <div className="grid-title">
                    <span className="material-symbols-rounded" style={{ fontSize: '1em' }}>grid_on</span>
                    <span>Quick Navigation ({completedCount} / {flashcards.length} completed)</span>
                </div>
                <div className="grid-container">
                    {flashcards.map((card, index) => (
                        <button
                            key={card.id}
                            className={`grid-card ${index === currentCardIndex ? 'active' : ''
                                } ${cardStates[card.id]?.isCompleted ? 'completed' : ''}`}
                            onClick={() => jumpToCard(index)}
                            title={`Card ${index + 1}${cardStates[card.id]?.isCompleted ? ' (Completed)' : ''}`}
                            aria-label={`Card ${index + 1}${cardStates[card.id]?.isCompleted ? ' - Completed' : ''}${index === currentCardIndex ? ' - Current' : ''}`}
                        >
                            {cardStates[card.id]?.isCompleted ? (
                                <span className="material-symbols-rounded" style={{ fontSize: '1em' }}>check_circle</span>
                            ) : (
                                <span className="grid-number">{index + 1}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Completion Message */}
            {setCompletion?.is_completed && (
                <div className="completion-message">
                    🎉 You've completed all flashcards in this set!
                </div>
            )}
        </div>
    );
};

export default FlashcardRenderer;
