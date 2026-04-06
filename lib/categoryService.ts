import { supabase } from './supabaseClient';

export interface Category {
  id: string;
  name: string;
}

export const categoryService = {
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching categories from table:', error);
        return [];
      }
      return data as Category[];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  async addCategory(name: string) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name }])
        .select()
        .single();

      if (error) {
        // If category already exists (UNIQUE constraint), fetch and return it
        if (error.code === '23505' || error.message.includes('unique')) {
          const { data: existingCategory } = await supabase
            .from('categories')
            .select('*')
            .eq('name', name)
            .single();
          return existingCategory as Category;
        }
        throw error;
      }
      return data as Category;
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }
};
