import { supabase } from './supabaseClient';

export interface Lesson {
  id?: string;
  courseid: string;
  module_title: string;
  module_order: number;
  title: string;
  content: any;
  order: number;
  type: 'video' | 'text' | 'pdf' | 'quiz';
  duration?: number;
  islocked?: boolean;
  created_at?: string;
}

export const lessonService = {
  async createLessons(lessons: Omit<Lesson, 'id' | 'created_at'>[]) {
    try {
      const lessonsToSave = lessons.map(lesson => ({
        ...lesson,
        content: typeof lesson.content === 'string' ? lesson.content : JSON.stringify(lesson.content)
      }));

      const { data, error } = await supabase
        .from('lessons')
        .insert(lessonsToSave)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating lessons:', error);
      throw error;
    }
  },
  async getLessonsByCourseId(courseId: string) {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('courseid', courseId)
        .order('module_order', { ascending: true })
        .order('order', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching lessons:', error);
      throw error;
    }
  },
  async updateLessons(lessons: Lesson[]) {
    try {
      const updates = lessons.map(lesson => {
        const { id, ...rest } = lesson;
        const contentToSave = typeof rest.content === 'string' ? rest.content : JSON.stringify(rest.content);
        return supabase.from('lessons').update({ ...rest, content: contentToSave }).eq('id', id);
      });

      const results = await Promise.all(updates);
      const error = results.find(res => res.error);

      if (error) throw error.error;
      return results.map(res => res.data);
    } catch (error) {
      console.error('Error updating lessons:', error);
      throw error;
    }
  },
  async deleteLessons(lessonIds: string[]) {
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .in('id', lessonIds);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting lessons:', error);
      throw error;
    }
  },
  calculateLessonDuration(lesson: any): number {
    // If duration is set and greater than 0, use it
    if (lesson.duration && lesson.duration > 0) {
      return lesson.duration;
    }

    // Calculate from content blocks
    let totalMinutes = 0;
    let contentBlocks: any[] = [];

    try {
      if (lesson.content) {
        if (typeof lesson.content === 'string') {
          contentBlocks = JSON.parse(lesson.content);
        } else {
          contentBlocks = Array.isArray(lesson.content) ? lesson.content : [];
        }
      }
    } catch (e) {
      console.error('Error parsing lesson content:', e);
      return 0;
    }

    contentBlocks.forEach((block: any) => {
      if (block.type === 'text') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = block.content || '';
        const text = tempDiv.textContent || tempDiv.innerText || '';
        const wordCount = text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
        // 100 words = 0.6 minutes (36 seconds)
        totalMinutes += (wordCount / 100) * 0.6;
      } else if (block.type === 'pdf') {
        // 2 minutes per page
        const pages = block.data?.pages || 1;
        totalMinutes += pages * 2;
      } else if (block.type === 'video') {
        // Default 5 mins for video if not specified
        totalMinutes += 5;
      } else if (block.type === 'quiz') {
        // Default 5 mins for quiz
        totalMinutes += 5;
      } else if (block.type === 'flashcard') {
        // 1-2 minutes per card on average
        const cardCount = block.data?.totalCards || 10;
        totalMinutes += Math.max(5, Math.ceil(cardCount * 1.5));
      }
    });

    return Math.ceil(totalMinutes || 0);
  },
};