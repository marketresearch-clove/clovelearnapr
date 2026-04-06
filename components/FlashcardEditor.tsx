import React, { useState, useEffect } from 'react';
import { flashcardService, Flashcard } from '../lib/flashcardService';
import { generateFlashcardContent, AIGenerationOptions } from '../lib/aiService';
import './FlashcardEditor.css';

interface FlashcardEditorProps {
    lessonId: string;
    courseId: string;
    flashcardSetId?: string;
    onSave: (flashcards: any[]) => void;
    onCancel: () => void;
    initialFlashcards?: Flashcard[];
}

const FlashcardEditor: React.FC<FlashcardEditorProps> = ({
    lessonId,
    courseId,
    flashcardSetId,
    onSave,
    onCancel,
    initialFlashcards = [],
}) => {
    const [flashcards, setFlashcards] = useState<Flashcard[]>(initialFlashcards);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingFront, setEditingFront] = useState('');
    const [editingBack, setEditingBack] = useState('');
    const [editingDifficulty, setEditingDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

    // AI Generation States
    const [showAiOptions, setShowAiOptions] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiCardCount, setAiCardCount] = useState(10);
    const [maxAiCards] = useState(50);
    const [aiDifficulty, setAiDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiError, setAiError] = useState('');

    const [newFront, setNewFront] = useState('');
    const [newBack, setNewBack] = useState('');
    const [newDifficulty, setNewDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

    // Ensure all flashcards have IDs for React keys
    useEffect(() => {
        const updatedFlashcards = flashcards.map(card => ({
            ...card,
            id: card.id || crypto.randomUUID(),
        }));
        if (updatedFlashcards.some((c, i) => c.id !== flashcards[i]?.id)) {
            setFlashcards(updatedFlashcards);
        }
    }, []);

    const aiGeneratedCount = flashcards.filter((f) => f.is_ai_generated).length;
    const remainingAiSlots = maxAiCards - aiGeneratedCount;

    // Handlers for manual card addition
    const addNewCard = () => {
        if (!newFront.trim() || !newBack.trim()) {
            alert('Please fill in both front and back of the card');
            return;
        }

        const newCard: Flashcard = {
            id: crypto.randomUUID(),
            flashcard_set_id: flashcardSetId || '',
            front: newFront,
            back: newBack,
            order: flashcards.length,
            is_ai_generated: false,
            difficulty: newDifficulty,
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        setFlashcards([...flashcards, newCard]);
        setNewFront('');
        setNewBack('');
        setNewDifficulty('medium');
    };

    // Edit card
    const startEditCard = (card: Flashcard) => {
        setEditingId(card.id);
        setEditingFront(card.front);
        setEditingBack(card.back);
        setEditingDifficulty(card.difficulty);
    };

    const saveEditCard = () => {
        if (!editingFront.trim() || !editingBack.trim()) {
            alert('Please fill in both front and back of the card');
            return;
        }

        setFlashcards((prev) =>
            prev.map((card) =>
                card.id === editingId
                    ? {
                        ...card,
                        front: editingFront,
                        back: editingBack,
                        difficulty: editingDifficulty,
                        updatedAt: new Date().toISOString(),
                    }
                    : card
            )
        );

        setEditingId(null);
        setEditingFront('');
        setEditingBack('');
    };

    const cancelEditCard = () => {
        setEditingId(null);
        setEditingFront('');
        setEditingBack('');
    };

    // Delete card
    const deleteCard = (cardId: string) => {
        if (confirm('Are you sure you want to delete this card?')) {
            setFlashcards((prev) => prev.filter((card) => card.id !== cardId));
        }
    };

    // AI Generation Handler
    const generateAiFlashcards = async () => {
        if (!aiTopic.trim()) {
            setAiError('Please enter a topic');
            return;
        }

        if (aiCardCount > remainingAiSlots) {
            setAiError(`You can only generate ${remainingAiSlots} more AI cards (max: ${maxAiCards})`);
            return;
        }

        if (aiCardCount < 1 || aiCardCount > 50) {
            setAiError('Card count must be between 1 and 50');
            return;
        }

        try {
            setAiGenerating(true);
            setAiError('');

            const options: AIGenerationOptions = {
                topic: aiTopic,
                type: 'flashcards',
                count: aiCardCount,
                difficulty: aiDifficulty,
                includeExplanations: true,
                language: 'english',
            };

            const generatedData = await generateFlashcardContent(options);

            if (!generatedData || generatedData.length === 0) {
                throw new Error('Failed to generate flashcards');
            }

            const aiCards: Flashcard[] = generatedData.map((item, index) => ({
                id: crypto.randomUUID(),
                flashcard_set_id: flashcardSetId || '',
                front: item.front,
                back: item.back,
                order: flashcards.length + index,
                is_ai_generated: true,
                difficulty: aiDifficulty === 'beginner' ? 'easy' : aiDifficulty === 'intermediate' ? 'medium' : 'hard',
                tags: [aiTopic],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }));

            setFlashcards([...flashcards, ...aiCards]);
            setAiTopic('');
            setAiCardCount(10);
            setShowAiOptions(false);
            setAiGenerating(false);
        } catch (error) {
            console.error('Error generating flashcards:', error);
            setAiError('Failed to generate flashcards. Please try again.');
            setAiGenerating(false);
        }
    };

    const moveCardUp = (index: number) => {
        if (index > 0) {
            const newFlashcards = [...flashcards];
            [newFlashcards[index], newFlashcards[index - 1]] = [newFlashcards[index - 1], newFlashcards[index]];
            // Update order
            newFlashcards.forEach((card, i) => {
                card.order = i;
            });
            setFlashcards(newFlashcards);
        }
    };

    const moveCardDown = (index: number) => {
        if (index < flashcards.length - 1) {
            const newFlashcards = [...flashcards];
            [newFlashcards[index], newFlashcards[index + 1]] = [newFlashcards[index + 1], newFlashcards[index]];
            // Update order
            newFlashcards.forEach((card, i) => {
                card.order = i;
            });
            setFlashcards(newFlashcards);
        }
    };

    const handleSave = () => {
        if (flashcards.length === 0) {
            alert('Please add at least one flashcard');
            return;
        }

        onSave(flashcards);
    };

    return (
        <div className="flashcard-editor">
            <div className="editor-header">
                <h2>Create/Edit Flashcards</h2>
            </div>

            {/* Set Information */}
            <div className="editor-section">
                <h3>Set Information</h3>
                <div className="form-group">
                    <label>Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="E.g., Biology Chapter 5 - Cell Structure"
                    />
                </div>
                <div className="form-group">
                    <label>Description (Optional)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the topic covered in these flashcards"
                        rows={2}
                    />
                </div>
            </div>

            {/* Card Counter */}
            <div className="card-counter">
                <span>Total Cards: <strong>{flashcards.length}</strong></span>
                <span>AI Generated: <strong>{aiGeneratedCount} / {maxAiCards}</strong></span>
                {remainingAiSlots > 0 && <span>Can add {remainingAiSlots} more AI cards</span>}
            </div>

            {/* Manual Card Creation */}
            <div className="editor-section">
                <h3>Add Manual Card (Unlimited)</h3>
                <div className="manual-card-form">
                    <div className="form-group">
                        <label>Front (Question/Main Content)</label>
                        <textarea
                            value={newFront}
                            onChange={(e) => setNewFront(e.target.value)}
                            placeholder="Enter question or main content"
                            rows={3}
                        />
                    </div>
                    <div className="form-group">
                        <label>Back (Answer/More Info)</label>
                        <textarea
                            value={newBack}
                            onChange={(e) => setNewBack(e.target.value)}
                            placeholder="Enter answer or explanation"
                            rows={3}
                        />
                    </div>
                    <div className="form-group">
                        <label>Difficulty</label>
                        <select
                            value={newDifficulty}
                            onChange={(e) => setNewDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                        >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                    <button className="btn btn-primary" onClick={addNewCard}>
                        + Add Card
                    </button>
                </div>
            </div>

            {/* AI Generation Section */}
            <div className="editor-section">
                <div className="ai-header">
                    <h3>AI Generate Flashcards</h3>
                    {remainingAiSlots > 0 && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowAiOptions(!showAiOptions)}
                        >
                            {showAiOptions ? '✕ Hide' : '✓ Show'}
                        </button>
                    )}
                    {remainingAiSlots === 0 && (
                        <span className="ai-limit-reached">AI limit reached ({maxAiCards}/{maxAiCards})</span>
                    )}
                </div>

                {showAiOptions && remainingAiSlots > 0 && (
                    <div className="ai-generation-form">
                        <div className="ai-info">
                            💡 AI can generate up to <strong>{remainingAiSlots}</strong> more flashcards. Manual cards are unlimited.
                        </div>

                        {aiError && <div className="error-message">{aiError}</div>}

                        <div className="form-group">
                            <label>Topic/Subject</label>
                            <input
                                type="text"
                                value={aiTopic}
                                onChange={(e) => setAiTopic(e.target.value)}
                                placeholder="E.g., Photosynthesis (AI generates up to 50 cards)"
                                disabled={aiGenerating}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Number of Cards (1-{maxAiCards})</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={maxAiCards}
                                    value={aiCardCount}
                                    placeholder="Enter 1-50"
                                    onChange={(e) => setAiCardCount(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxAiCards))}
                                    disabled={aiGenerating}
                                />
                            </div>

                            <div className="form-group">
                                <label>Difficulty Level</label>
                                <select
                                    value={aiDifficulty}
                                    onChange={(e) => setAiDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                                    disabled={aiGenerating}
                                >
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                </select>
                            </div>
                        </div>

                        <button
                            className="btn btn-ai"
                            onClick={generateAiFlashcards}
                            disabled={aiGenerating || remainingAiSlots === 0}
                        >
                            {aiGenerating ? '⏳ Generating...' : `✨ Generate ${aiCardCount} Cards`}
                        </button>
                    </div>
                )}
            </div>

            {/* Flashcards List */}
            <div className="editor-section">
                <h3>Cards ({flashcards.length})</h3>
                {flashcards.length === 0 ? (
                    <div className="empty-state">
                        No cards yet. Add a manual card or generate with AI.
                    </div>
                ) : (
                    <div className="flashcards-list">
                        {flashcards.map((card, index) => (
                            <div
                                key={card.id}
                                className={`card-item ${editingId === card.id ? 'editing' : ''} ${card.is_ai_generated ? 'ai-generated' : ''
                                    }`}
                            >
                                {editingId === card.id ? (
                                    // Edit Mode
                                    <div className="card-edit-form">
                                        <div className="form-group">
                                            <label>Front</label>
                                            <textarea
                                                value={editingFront}
                                                onChange={(e) => setEditingFront(e.target.value)}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Back</label>
                                            <textarea
                                                value={editingBack}
                                                onChange={(e) => setEditingBack(e.target.value)}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Difficulty</label>
                                            <select
                                                value={editingDifficulty}
                                                onChange={(e) => setEditingDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                                            >
                                                <option value="easy">Easy</option>
                                                <option value="medium">Medium</option>
                                                <option value="hard">Hard</option>
                                            </select>
                                        </div>
                                        <div className="card-edit-actions">
                                            <button className="btn btn-sm btn-success" onClick={saveEditCard}>
                                                Save
                                            </button>
                                            <button className="btn btn-sm btn-secondary" onClick={cancelEditCard}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // Display Mode
                                    <>
                                        <div className="card-header">
                                            <div className="card-number">Card {index + 1}</div>
                                            {card.is_ai_generated && <span className="ai-badge">🤖 AI Generated</span>}
                                            <span className={`difficulty-badge ${card.difficulty}`}>{card.difficulty}</span>
                                        </div>

                                        <div className="card-body">
                                            <div className="card-side">
                                                <strong>Front:</strong>
                                                <p>{card.front}</p>
                                            </div>
                                            <div className="card-side">
                                                <strong>Back:</strong>
                                                <p>{card.back}</p>
                                            </div>
                                        </div>

                                        <div className="card-actions">
                                            <button
                                                className="btn btn-sm btn-primary"
                                                onClick={() => startEditCard(card)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => moveCardUp(index)}
                                                disabled={index === 0}
                                            >
                                                ↑ Up
                                            </button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => moveCardDown(index)}
                                                disabled={index === flashcards.length - 1}
                                            >
                                                ↓ Down
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => deleteCard(card.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="editor-footer">
                <button className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
                <button
                    className="btn btn-success btn-large"
                    onClick={handleSave}
                    disabled={flashcards.length === 0}
                >
                    Save Flashcard Set
                </button>
            </div>
        </div>
    );
};

export default FlashcardEditor;
