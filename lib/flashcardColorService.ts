import { supabase } from './supabaseClient';

export interface FlashcardColorSettings {
    id?: string;
    course_id: string;
    instructor_id?: string;
    card_front_gradient_start: string;
    card_front_gradient_end: string;
    card_back_gradient_start: string;
    card_back_gradient_end: string;
    flip_icon_color: string;
    apply_to_all: boolean;
    created_at?: string;
    updated_at?: string;
}

export const flashcardColorService = {
    async getColorSettings(courseId: string): Promise<FlashcardColorSettings | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_color_settings')
                .select('*')
                .eq('course_id', courseId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            return data || null;
        } catch (error) {
            console.error('Error fetching flashcard color settings:', error);
            return null;
        }
    },

    async getGlobalColorSettings(): Promise<FlashcardColorSettings | null> {
        try {
            const { data, error } = await supabase
                .from('flashcard_color_settings')
                .select('*')
                .eq('apply_to_all', true)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data || null;
        } catch (error) {
            console.error('Error fetching global flashcard color settings:', error);
            return null;
        }
    },

    async saveColorSettings(settings: FlashcardColorSettings): Promise<FlashcardColorSettings | null> {
        try {
            // Check if settings already exist for this course
            const existing = await this.getColorSettings(settings.course_id);

            if (existing) {
                // Update existing
                const { data, error } = await supabase
                    .from('flashcard_color_settings')
                    .update({
                        card_front_gradient_start: settings.card_front_gradient_start,
                        card_front_gradient_end: settings.card_front_gradient_end,
                        card_back_gradient_start: settings.card_back_gradient_start,
                        card_back_gradient_end: settings.card_back_gradient_end,
                        flip_icon_color: settings.flip_icon_color,
                        apply_to_all: settings.apply_to_all,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('course_id', settings.course_id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                // Create new
                const { data, error } = await supabase
                    .from('flashcard_color_settings')
                    .insert([settings])
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        } catch (error) {
            console.error('Error saving flashcard color settings:', error);
            throw error;
        }
    },

    async deleteColorSettings(courseId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('flashcard_color_settings')
                .delete()
                .eq('course_id', courseId);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting flashcard color settings:', error);
            throw error;
        }
    },
};
