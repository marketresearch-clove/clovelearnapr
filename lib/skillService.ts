import { supabase } from './supabaseClient';

export interface Skill {
  id?: string;
  name: string;
  family: string;
  description?: string;
  createdby?: string;
  createdat?: string;
  updatedat?: string;
}

export interface SkillFamily {
  id?: string;
  name: string;
  description?: string;
  createdby?: string;
  createdat?: string;
  updatedat?: string;
}

export interface SkillCourseMapping {
  id?: string;
  skillid: string;
  courseid: string;
  skillname?: string;
  coursename?: string;
  required?: boolean;
  createdby?: string;
  createdat?: string;
}

export interface SkillAssignment {
  id?: string;
  userid: string;
  skillid: string;
  assignedat?: string;
  expiry_date?: string | null;
  visible?: boolean;
  hidden?: boolean;
  auto_assigned?: boolean;
}

export const skillService = {
  async deleteExpiredSkillAssignments() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error, count } = await supabase
        .from('skill_assignments')
        .delete({ count: 'exact' })
        .lt('expiry_date', today);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error deleting expired skill assignments:', error);
      return 0;
    }
  },

  async checkAndDeleteExpiredSkillAssignments(userId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error, count } = await supabase
        .from('skill_assignments')
        .delete({ count: 'exact' })
        .eq('userid', userId)
        .lt('expiry_date', today);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error checking/deleting user expired skills:', error);
      return 0;
    }
  },
  async getSkills() {
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching skills:', error);
      return [];
    }
  },

  async getSkillFamilies() {
    try {
      const { data, error } = await supabase
        .from('skill_families')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching skill families:', error);
      return [];
    }
  },

  async createSkillFamily(family: Omit<SkillFamily, 'id' | 'createdat'>) {
    try {
      const { data, error } = await supabase
        .from('skill_families')
        .insert([{ ...family, createdat: new Date().toISOString() }])
        .select();

      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error creating skill family:', error);
      throw error;
    }
  },

  async deleteSkillFamily(familyId: string) {
    try {
      const { error } = await supabase
        .from('skill_families')
        .delete()
        .eq('id', familyId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting skill family:', error);
      throw error;
    }
  },

  async getSkillCourseMappings() {
    try {
      const { data, error } = await supabase
        .from('skill_course_mappings')
        .select(`
          *,
          skills(id, name),
          courses(id, title)
        `)
        .order('createdat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching skill course mappings:', error);
      return [];
    }
  },

  async getSkillMappingsBySkill(skillId: string) {
    try {
      const { data, error } = await supabase
        .from('skill_course_mappings')
        .select(`
          *,
          courses(id, title)
        `)
        .eq('skillid', skillId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching skill mappings:', error);
      return [];
    }
  },

  async getSkillMappingsByCourse(courseId: string) {
    try {
      const { data, error } = await supabase
        .from('skill_course_mappings')
        .select(`
          *,
          skills(id, name, family)
        `)
        .eq('courseid', courseId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching skill mappings:', error);
      return [];
    }
  },

  async createSkill(skill: Omit<Skill, 'id' | 'createdat'>) {
    try {
      const { data, error } = await supabase
        .from('skills')
        .insert([{ ...skill, createdat: new Date().toISOString() }])
        .select();

      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error creating skill:', error);
      throw error;
    }
  },

  async createSkillMapping(mapping: Omit<SkillCourseMapping, 'id' | 'createdat'>) {
    try {
      const { data, error } = await supabase
        .from('skill_course_mappings')
        .insert([{ ...mapping, createdat: new Date().toISOString() }])
        .select();

      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error creating skill mapping:', error);
      throw error;
    }
  },

  async removeSkillMapping(mappingId: string) {
    try {
      const { error } = await supabase
        .from('skill_course_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing skill mapping:', error);
      throw error;
    }
  },

  async assignSkillToUser(assignment: Omit<SkillAssignment, 'id' | 'assignedat'>) {
    try {
      const { data, error } = await supabase
        .from('skill_assignments')
        .insert([{ ...assignment, assignedat: new Date().toISOString() }])
        .select();

      if (error) throw error;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Error assigning skill to user:', error);
      throw error;
    }
  },

  async getUserSkillAssignments(userId: string) {
    try {
      const { data, error } = await supabase
        .from('skill_assignments')
        .select(`
          *,
          skills(id, name, family)
        `)
        .eq('userid', userId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user skill assignments:', error);
      return [];
    }
  },

  async updateSkillAssignmentVisibility(assignmentId: string, visible: boolean) {
    try {
      const { error } = await supabase
        .from('skill_assignments')
        .update({ visible, hidden: !visible })
        .eq('id', assignmentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating skill assignment visibility:', error);
      throw error;
    }
  },

  async deleteSkill(skillId: string) {
    try {
      const { error } = await supabase
        .from('skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting skill:', error);
      throw error;
    }
  },

  async ensureSkillAndFamily(suggestion: { name: string; family: string; description?: string }) {
    try {
      // Check if family exists, if not create it
      let { data: existingFamily } = await supabase
        .from('skill_families')
        .select('*')
        .eq('name', suggestion.family)
        .maybeSingle();

      if (!existingFamily) {
        const { data: newFamily, error: familyError } = await supabase
          .from('skill_families')
          .insert([{ name: suggestion.family, description: '' }])
          .select()
          .single();

        if (familyError) throw familyError;
        existingFamily = newFamily;
      }

      // Check if skill exists, if not create it
      let { data: existingSkill } = await supabase
        .from('skills')
        .select('*')
        .eq('name', suggestion.name)
        .maybeSingle();

      if (!existingSkill) {
        const { data: newSkill, error: skillError } = await supabase
          .from('skills')
          .insert([
            {
              name: suggestion.name,
              family: suggestion.family,
              description: suggestion.description,
            },
          ])
          .select()
          .single();

        if (skillError) throw skillError;
        existingSkill = newSkill;
      }

      return { skill: existingSkill, family: existingFamily };
    } catch (error) {
      console.error('Error ensuring skill and family:', error);
      throw error;
    }
  },
  async searchSkills(query: string) {
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching skills:', error);
      return [];
    }
  },
};
