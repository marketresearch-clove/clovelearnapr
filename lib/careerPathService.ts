import { supabase } from './supabaseClient';
import { userSkillAchievementService } from './userSkillAchievementService';

export interface CareerPathSkillRequirement {
  skillId: string;
  skillName: string;
  skillFamily: string;
  minScore: number;
  proficiencyLevel: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface CareerPath {
  id: string;
  currentRole: string;
  nextRole: string;
  description?: string;
  skillRequirements: CareerPathSkillRequirement[];
  createdBy?: string;
  createdAt?: string;
}

export interface UserCareerPath {
  id: string;
  userId: string;
  careerPathId: string;
  currentRole: string;
  targetRole: string;
  readinessPercentage: number;
  status: 'In Progress' | 'Ready for Promotion' | 'Completed';
  assignedAt?: string;
  targetDate?: string;
}

export const careerPathService = {

  async createCareerPath(
    currentRole: string,
    nextRole: string,
    description: string,
    skillRequirements: Array<any>
  ) {
    try {
      const normalizedSkills = skillRequirements.map(req => ({
        skill_id: req.skillId || req.skill_id || '',
        skill_name: req.skillName || req.skill_name || 'Unknown Skill',
        skill_family: req.skillFamily || req.skill_family || 'General',
        level: req.level || 'Advanced',
        min_score: req.min_score || (req.level === 'Beginner' ? (req.minScoreBeginner || req.min_score_beginner || 30) : req.level === 'Intermediate' ? (req.minScoreIntermediate || req.min_score_intermediate || 60) : (req.minScoreAdvanced || req.min_score_advanced || 100)),
        min_score_beginner: req.minScoreBeginner || req.min_score_beginner || 30,
        min_score_intermediate: req.minScoreIntermediate || req.min_score_intermediate || 60,
        min_score_advanced: req.minScoreAdvanced || req.min_score_advanced || 100
      }));

      const { data, error } = await supabase
        .from('career_paths')
        .insert([{
          source_role: currentRole,
          target_role: nextRole,
          description: description,
          skill_requirements: normalizedSkills,
          created_by: 'admin',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error creating career path:', error);
      return null;
    }
  },

  async getCareerPaths() {
    try {
      const { data, error } = await supabase
        .from('career_paths')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching career paths:', error);
      return [];
    }
  },

  async getCareerPathById(id: string) {
    try {
      const { data, error } = await supabase
        .from('career_paths')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching career path:', error);
      return null;
    }
  },

  async updateCareerPath(
    id: string,
    updates: {
      currentRole?: string;
      nextRole?: string;
      description?: string;
      skillRequirements?: any[];
    }
  ) {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.currentRole) updateData.source_role = updates.currentRole;
      if (updates.nextRole) updateData.target_role = updates.nextRole;
      if (updates.description) updateData.description = updates.description;
      if (updates.skillRequirements) {
        const normalizedSkills = updates.skillRequirements.map(req => ({
          skill_id: req.skillId || req.skill_id || '',
          skill_name: req.skillName || req.skill_name || 'Unknown Skill',
          skill_family: req.skillFamily || req.skill_family || 'General',
          level: req.level || 'Advanced',
          min_score: req.min_score || (req.level === 'Beginner' ? (req.minScoreBeginner || req.min_score_beginner || 20) : req.level === 'Intermediate' ? (req.minScoreIntermediate || req.min_score_intermediate || 50) : (req.minScoreAdvanced || req.min_score_advanced || 70)),
          min_score_beginner: req.minScoreBeginner || req.min_score_beginner || 20,
          min_score_intermediate: req.minScoreIntermediate || req.min_score_intermediate || 50,
          min_score_advanced: req.minScoreAdvanced || req.min_score_advanced || 70
        }));
        updateData.skill_requirements = normalizedSkills;
      }

      const { data, error } = await supabase
        .from('career_paths')
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error updating career path:', error);
      return null;
    }
  },

  async deleteCareerPath(id: string) {
    try {
      const { error } = await supabase
        .from('career_paths')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting career path:', error);
      return false;
    }
  },

  async assignUserToCareerPath(userId: string, careerPathId: string, targetDate?: string) {
    try {
      const careerPath = await this.getCareerPathById(careerPathId);
      if (!careerPath) throw new Error('Career path not found');

      const { data, error } = await supabase
        .from('user_career_paths')
        .insert([{
          user_id: userId,
          career_path_id: careerPathId,
          source_role_name: careerPath.source_role,
          target_role_name: careerPath.target_role,
          readiness_percentage: 0,
          status: 'In Progress',
          assigned_at: new Date().toISOString(),
          target_date: targetDate
        }])
        .select();

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error assigning user to career path:', error);
      return null;
    }
  },

  async getUserCareerPaths(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_career_paths')
        .select(`
          id,
          user_id,
          career_path_id,
          source_role_name,
          target_role_name,
          readiness_percentage,
          status,
          assigned_at,
          target_date,
          career_paths (*)
        `)
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user career paths:', error);
      return [];
    }
  },

  async calculateCareerReadiness(userId: string, careerPathId: string) {
    try {
      const careerPath = await this.getCareerPathById(careerPathId);
      if (!careerPath || !careerPath.skill_requirements) {
        console.warn('[CAREER_PATH_DEBUG] No career path or skill requirements found for:', careerPathId);
        return 0;
      }

      const skillRequirements = careerPath.skill_requirements;
      if (skillRequirements.length === 0) {
        console.warn('[CAREER_PATH_DEBUG] Skill requirements empty for:', careerPathId);
        return 0;
      }

      console.log('[CAREER_PATH_DEBUG] ==== CAREER PATH DEBUG START ====');
      console.log('[CAREER_PATH_DEBUG] Career Path ID:', careerPathId);
      console.log('[CAREER_PATH_DEBUG] Target Role:', careerPath.target_role || careerPath.nextRole);
      console.log('[CAREER_PATH_DEBUG] Skill Requirements Count:', skillRequirements.length);

      // Show detailed structure of first skill requirement
      if (skillRequirements.length > 0) {
        console.log('[CAREER_PATH_DEBUG] First skill requirement structure:', JSON.stringify(skillRequirements[0], null, 2));
        console.log('[CAREER_PATH_DEBUG] All skill requirement names:', skillRequirements.map((sr: any) => sr.skill_name || sr.skillName || 'UNNAMED').join(', '));
        console.log('[CAREER_PATH_DEBUG] All skill requirement IDs:', skillRequirements.map((sr: any) => sr.skill_id || sr.skillId || 'NO_ID').join(', '));
      }

      const readiness = await userSkillAchievementService.calculateSkillReadiness(userId, skillRequirements);
      console.log('[CAREER_PATH_DEBUG] Calculated readiness:', readiness, '% for userId:', userId);
      console.log('[CAREER_PATH_DEBUG] ==== CAREER PATH DEBUG END ====');
      return readiness;
    } catch (error) {
      console.error('Error calculating career readiness:', error);
      return 0;
    }
  },

  async getUserSkillScore(userId: string, skillId: string) {
    try {
      // 1. Check manual assignments first - if assigned, it's 100% (Advanced)
      const { data: assignment, error: assignError } = await supabase
        .from('skill_assignments')
        .select('id')
        .eq('userid', userId)
        .eq('skillid', skillId)
        .maybeSingle();

      if (assignment) {
        return 100;
      }

      // 2. Check user_skill_achievements for recorded progress
      const { data: achievements } = await supabase
        .from('user_skill_achievements')
        .select('percentage_achieved')
        .eq('user_id', userId)
        .eq('skill_id', skillId)
        .order('percentage_achieved', { ascending: false })
        .limit(1);

      if (achievements && achievements.length > 0) {
        return achievements[0].percentage_achieved;
      }

      // Calculate based on completed courses and their levels
      const { data: completedCourses } = await supabase
        .from('enrollments')
        .select(`
          courseid,
          courses (
            id,
            level
          )
        `)
        .eq('userid', userId)
        .eq('completed', true);

      if (!completedCourses || completedCourses.length === 0) {
        return 0;
      }

      // Get mappings for this skill
      const { data: skillMappings } = await supabase
        .from('skill_course_mappings')
        .select('courseid')
        .eq('skillid', skillId);

      if (!skillMappings || skillMappings.length === 0) {
        return 0;
      }

      const mappedCourseIds = new Set(skillMappings.map(m => m.courseid));
      let maxPercentage = 0;

      for (const enrollment of completedCourses) {
        if (mappedCourseIds.has(enrollment.courseid)) {
          // @ts-ignore
          const courseLevel = enrollment.courses?.level;
          let percentage = 0;

          switch (courseLevel?.toLowerCase()) {
            case 'beginner':
              percentage = 30;
              break;
            case 'intermediate':
              percentage = 60;
              break;
            case 'advanced':
              percentage = 100;
              break;
            default:
              percentage = 0;
          }

          if (percentage > maxPercentage) {
            maxPercentage = percentage;
          }
        }
      }

      return maxPercentage;
    } catch (error) {
      console.error('Error calculating user skill score:', error);
      return 0;
    }
  },

  async updateCareerReadiness(userId: string, careerPathId: string) {
    try {
      const readinessPercentage = await this.calculateCareerReadiness(userId, careerPathId);
      const status = readinessPercentage >= 80 ? 'Ready for Promotion' : 'In Progress';

      const { data, error } = await supabase
        .from('user_career_paths')
        .update({
          readiness_percentage: readinessPercentage,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('career_path_id', careerPathId)
        .select();

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error updating career readiness:', error);
      return null;
    }
  },

  async removeUserFromCareerPath(userId: string, careerPathId: string) {
    try {
      const { error } = await supabase
        .from('user_career_paths')
        .delete()
        .eq('user_id', userId)
        .eq('career_path_id', careerPathId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing user from career path:', error);
      return false;
    }
  }
};
