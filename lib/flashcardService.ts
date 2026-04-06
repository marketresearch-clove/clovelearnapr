import { supabase } from './supabaseClient';

// Internal helper function to update flashcard set card count
async function updateFlashcardSetCardCount(
    flashcardSetId: string
): Promise<void> {
    try {
        const { data: cards, error: fetchError } = await supabase
            .from('flashcards')
            .select('id, is_ai_generated')
            .eq('flashcard_set_id', flashcardSetId);

        if (fetchError) throw fetchError;

        const totalCards = cards?.length || 0;
        const aiGeneratedCount = cards?.filter((c) => c.is_ai_generated).length || 0;

        await supabase
            .from('flashcard_sets')
            .update({
                total_cards: totalCards,
                ai_generated_count: aiGeneratedCount,
            })
            .eq('id', flashcardSetId);
    } catch (error) {
        console.error('Error updating flashcard set card count:', error);
    }
}

export interface Flashcard {
    id: string;
    flashcard_set_id: string;
    front: string;
    back: string;
    order: number;
    is_ai_generated: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
    type?: 'card' | 'quiz';
    quiz_data?: {
        options: string[];
        correct_answer: number;
        explanation?: string;
    };
    tags: string[];
    created_at: string;
    updated_at: string;
}

export interface FlashcardSet {
    id: string;
    lesson_id: string;
    course_id: string;
    title: string;
    description?: string;
    total_cards: number;
    ai_generated_count: number;
    max_ai_cards: number;
    created_at: string;
    updated_at: string;
}

export interface FlashcardProgress {
    id: string;
    user_id: string;
    flashcard_id: string;
    flashcard_set_id: string;
    is_completed: boolean;
    review_count: number;
    easy_count: number;
    difficult_count: number;
    last_reviewed_at?: string;
    completed_at?: string;
}

export interface FlashcardSetCompletion {
    id: string;
    user_id: string;
    flashcard_set_id: string;
    completed_cards: number;
    total_cards: number;
    is_completed: boolean;
    completed_at?: string;
}

export const flashcardService = {
    // ============ Flashcard Set Operations ============
    async createFlashcardSet(
        lessonId: string,
        courseId: string,
        title: string,
        description?: string,
        maxAiCards: number = 50
    ): Promise<FlashcardSet | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_sets')
                .insert([
                    {
                        lesson_id: lessonId,
                        course_id: courseId,
                        title,
                        description,
                        max_ai_cards: maxAiCards,
                        total_cards: 0,
                        ai_generated_count: 0,
                    },
                ])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating flashcard set:', error);
            return null;
        }
    },

    async getFlashcardSet(setId: string): Promise<FlashcardSet | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_sets')
                .select('*')
                .eq('id', setId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching flashcard set:', error);
            return null;
        }
    },

    async getLessonFlashcardSets(lessonId: string): Promise<FlashcardSet[]> {
        try {
            const { data, error } = await supabase
                .from('flashcard_sets')
                .select('*')
                .eq('lesson_id', lessonId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching lesson flashcard sets:', error);
            return [];
        }
    },

    async updateFlashcardSet(
        setId: string,
        updates: Partial<FlashcardSet>
    ): Promise<FlashcardSet | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_sets')
                .update(updates)
                .eq('id', setId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating flashcard set:', error);
            return null;
        }
    },

    async deleteFlashcardSet(setId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('flashcard_sets')
                .delete()
                .eq('id', setId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting flashcard set:', error);
            return false;
        }
    },

    // ============ Flashcard Operations ============
    async addFlashcard(
        flashcardSetId: string,
        front: string,
        back: string,
        order: number,
        isAiGenerated: boolean = false,
        difficulty: 'easy' | 'medium' | 'hard' = 'medium',
        tags: string[] = []
    ): Promise<Flashcard | null> {
        try {
            const { data, error } = await supabase
                .from('flashcards')
                .insert([
                    {
                        flashcard_set_id: flashcardSetId,
                        front,
                        back,
                        order,
                        is_ai_generated: isAiGenerated,
                        difficulty,
                        tags: tags || [],
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            // Update total cards count in the set
            await updateFlashcardSetCardCount(flashcardSetId);

            return data;
        } catch (error) {
            console.error('Error adding flashcard:', error);
            return null;
        }
    },

    async getFlashcards(flashcardSetId: string): Promise<Flashcard[]> {
        try {
            const { data, error } = await supabase
                .from('flashcards')
                .select('*')
                .eq('flashcard_set_id', flashcardSetId)
                .order('order', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching flashcards:', error);
            return [];
        }
    },

    async updateFlashcard(
        flashcardId: string,
        updates: Partial<Flashcard>
    ): Promise<Flashcard | null> {
        try {
            const { data, error } = await supabase
                .from('flashcards')
                .update(updates)
                .eq('id', flashcardId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating flashcard:', error);
            return null;
        }
    },

    async deleteFlashcard(flashcardId: string): Promise<boolean> {
        try {
            // Get the card to find the set
            const card = await supabase
                .from('flashcards')
                .select('flashcard_set_id')
                .eq('id', flashcardId)
                .single();

            const { error } = await supabase
                .from('flashcards')
                .delete()
                .eq('id', flashcardId);

            if (error) throw error;

            // Update card count
            if (card.data) {
                await updateFlashcardSetCardCount(card.data.flashcard_set_id);
            }

            return true;
        } catch (error) {
            console.error('Error deleting flashcard:', error);
            return false;
        }
    },

    async bulkAddFlashcards(
        flashcardSetId: string,
        flashcards: Array<{
            front: string;
            back: string;
            order: number;
            is_ai_generated?: boolean;
            difficulty?: 'easy' | 'medium' | 'hard';
            tags?: string[];
        }>
    ): Promise<Flashcard[]> {
        try {
            const cardsToInsert = flashcards.map((card) => ({
                flashcard_set_id: flashcardSetId,
                front: card.front,
                back: card.back,
                order: card.order,
                is_ai_generated: card.is_ai_generated || false,
                difficulty: card.difficulty || 'medium',
                tags: card.tags || [],
            }));

            const { data, error } = await supabase
                .from('flashcards')
                .insert(cardsToInsert)
                .select();

            if (error) throw error;

            // Update card count
            await updateFlashcardSetCardCount(flashcardSetId);

            return data || [];
        } catch (error) {
            console.error('Error bulk adding flashcards:', error);
            return [];
        }
    },

    // ============ Progress Tracking ============
    async markCardComplete(
        userId: string,
        flashcardId: string,
        flashcardSetId: string
    ): Promise<FlashcardProgress | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_progress')
                .upsert(
                    [
                        {
                            user_id: userId,
                            flashcard_id: flashcardId,
                            flashcard_set_id: flashcardSetId,
                            is_completed: true,
                            completed_at: new Date().toISOString(),
                        },
                    ],
                    { onConflict: 'user_id,flashcard_id' }
                )
                .select()
                .single();

            if (error) throw error;

            // Update set completion status
            await this.updateSetCompletion(userId, flashcardSetId);

            return data;
        } catch (error) {
            console.error('Error marking card complete:', error);
            return null;
        }
    },

    async markCardIncomplete(
        userId: string,
        flashcardId: string,
        flashcardSetId: string
    ): Promise<FlashcardProgress | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_progress')
                .update({ is_completed: false, completed_at: null })
                .eq('user_id', userId)
                .eq('flashcard_id', flashcardId)
                .select()
                .single();

            if (error) throw error;

            // Update set completion status
            await this.updateSetCompletion(userId, flashcardSetId);

            return data;
        } catch (error) {
            console.error('Error marking card incomplete:', error);
            return null;
        }
    },

    async recordCardReview(
        userId: string,
        flashcardId: string,
        flashcardSetId: string,
        difficulty: 'easy' | 'difficult'
    ): Promise<FlashcardProgress | null> {
        try {
            const { data: existing } = await supabase
                .from('flashcard_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('flashcard_id', flashcardId)
                .single();

            const updates = {
                user_id: userId,
                flashcard_id: flashcardId,
                flashcard_set_id: flashcardSetId,
                review_count: (existing?.review_count || 0) + 1,
                last_reviewed_at: new Date().toISOString(),
            } as any;

            if (difficulty === 'easy') {
                updates.easy_count = (existing?.easy_count || 0) + 1;
            } else {
                updates.difficult_count = (existing?.difficult_count || 0) + 1;
            }

            const { data, error } = await supabase
                .from('flashcard_progress')
                .upsert([updates], { onConflict: 'user_id,flashcard_id' })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error recording card review:', error);
            return null;
        }
    },

    async getCardProgress(
        userId: string,
        flashcardId: string
    ): Promise<FlashcardProgress | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('flashcard_id', flashcardId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (error) {
            console.error('Error fetching card progress:', error);
            return null;
        }
    },

    async getSetProgress(
        userId: string,
        flashcardSetId: string
    ): Promise<FlashcardProgress[]> {
        try {
            const { data, error } = await supabase
                .from('flashcard_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('flashcard_set_id', flashcardSetId);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching set progress:', error);
            return [];
        }
    },

    async updateSetCompletion(
        userId: string,
        flashcardSetId: string
    ): Promise<FlashcardSetCompletion | null> {
        try {
            // Get total cards in set
            const { data: setData, error: setError } = await supabase
                .from('flashcard_sets')
                .select('total_cards')
                .eq('id', flashcardSetId)
                .single();

            if (setError) throw setError;

            // Get completed cards for user
            const { data: progressData, error: progressError } = await supabase
                .from('flashcard_progress')
                .select('id')
                .eq('user_id', userId)
                .eq('flashcard_set_id', flashcardSetId)
                .eq('is_completed', true);

            if (progressError) throw progressError;

            const completedCards = progressData?.length || 0;
            const totalCards = setData?.total_cards || 0;
            const isCompleted = completedCards === totalCards && totalCards > 0;

            const { data, error } = await supabase
                .from('flashcard_set_completion')
                .upsert(
                    [
                        {
                            user_id: userId,
                            flashcard_set_id: flashcardSetId,
                            completed_cards: completedCards,
                            total_cards: totalCards,
                            is_completed: isCompleted,
                            completed_at: isCompleted ? new Date().toISOString() : null,
                        },
                    ],
                    { onConflict: 'user_id,flashcard_set_id' }
                )
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating set completion:', error);
            return null;
        }
    },

    async getSetCompletion(
        userId: string,
        flashcardSetId: string
    ): Promise<FlashcardSetCompletion | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_set_completion')
                .select('*')
                .eq('user_id', userId)
                .eq('flashcard_set_id', flashcardSetId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (error) {
            console.error('Error fetching set completion:', error);
            return null;
        }
    },
};
