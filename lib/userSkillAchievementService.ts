import { supabase } from './supabaseClient';
import { getEFSETBadge } from './efsetHelper';

export const userSkillAchievementService = {

  async recordSkillAchievement(
    userId: string,
    skillId: string,
    skillName: string,
    courseLevel: 'Beginner' | 'Intermediate' | 'Advanced',
    courseId: string,
    courseTitle?: string,
    quizScore?: number
  ) {
    try {
      // Use the actual quiz score if provided, otherwise fallback to level-based defaults for backward compatibility
      const percentageToRecord = quizScore !== undefined ? quizScore : this.getLevelPercentage(courseLevel);

      const { data, error } = await supabase
        .from('user_skill_achievements')
        .upsert([{
          user_id: userId,
          skill_id: skillId,
          skill_name: skillName,
          course_level: courseLevel,
          course_id: courseId,
          course_title: courseTitle || 'Unknown Course',
          percentage_achieved: percentageToRecord,
          completed_at: new Date().toISOString()
        }], {
          onConflict: 'user_id,skill_id'
        })
        .select();

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error recording skill achievement:', error);
      return null;
    }
  },

  getLevelPercentage(courseLevel: string): number {
    // Deprecated: remove numerical defaults based on level.
    // Keep returning 0 to avoid implying progress from level alone.
    return 0;
  },

  async getUserSkillAchievementsByCareerPath(userId: string, careerPathId: string) {
    try {
      const { data: careerPath } = await supabase
        .from('career_paths')
        .select('skill_requirements')
        .eq('id', careerPathId)
        .single();

      if (!careerPath?.skill_requirements) {
        return [];
      }

      const skillIds = careerPath.skill_requirements.map((req: any) => req.skill_id || req.skillId);

      if (skillIds.length === 0) {
        return [];
      }

      const { data: achievements } = await supabase
        .from('user_skill_achievements')
        .select('*')
        .eq('user_id', userId)
        .in('skill_id', skillIds);

      return achievements || [];
    } catch (error) {
      console.error('Error fetching user skill achievements:', error);
      return [];
    }
  },

  async calculateSkillReadiness(
    userId: string,
    skillRequirements: Array<{
      skill_id?: string;
      skillId?: string;
      skill_name?: string;
      skillName?: string;
      level?: string;
      min_score_beginner?: number;
      min_score_intermediate?: number;
      min_score_advanced?: number;
    }>
  ) {
    try {
      if (!skillRequirements || skillRequirements.length === 0) {
        console.warn('[SKILL_READINESS_DEBUG] No skill requirements provided');
        return 0;
      }

      const skillIds = skillRequirements.map(req => req.skill_id || req.skillId).filter(Boolean);
      console.log('[SKILL_READINESS_DEBUG] Skill IDs to lookup:', skillIds);

      const [achievementsRes, assignmentsRes] = await Promise.all([
        supabase
          .from('user_skill_achievements')
          .select('*')
          .eq('user_id', userId), // Get ALL achievements for fallback matching
        skillIds.length > 0
          ? supabase
            .from('skill_assignments')
            .select('skillid, level')
            .eq('userid', userId)
            .in('skillid', skillIds)
          : Promise.resolve({ data: [], error: null } as any) // If no skill IDs, skip the query
      ]);

      const achievements = achievementsRes.data || [];
      const assignments = assignmentsRes.data || [];

      console.log('[SKILL_READINESS_DEBUG] User achievements:', achievements.length, 'records');
      console.log('[SKILL_READINESS_DEBUG] User skill assignments:', assignments.length, 'records');

      if (achievements.length > 0) {
        console.log('[SKILL_READINESS_DEBUG] Achievement sample:', JSON.stringify(achievements[0], null, 2));
      }

      let totalReadiness = 0;

      for (const req of skillRequirements) {
        const skillId = req.skill_id || req.skillId;
        const requiredLevel = req.level || 'Advanced';
        const skillName = req.skill_name || req.skillName || 'Unknown';

        // Check manual assignments first
        const manualAssignment = assignments.find(a => a.skillid === skillId);
        const isManuallyAssigned = !!manualAssignment;

        let achievedPercentage = 0;

        if (isManuallyAssigned) {
          // Calculate percentage based on assigned level vs requirement
          achievedPercentage = this.calculateSkillPercentage(
            manualAssignment.level || 'Advanced',
            requiredLevel,
            100,
            req.min_score_beginner || 30,
            req.min_score_intermediate || 60,
            req.min_score_advanced || 100,
            (req as any).min_score || (req as any).minScore
          );
          console.log('[SKILL_READINESS_DEBUG] Manual assignment found for', skillName, '(', skillId, '): ', achievedPercentage, '%');
        } else {
          // Try to match by skill_id first
          let userAchievements = achievements.filter(a => a.skill_id === skillId);

          // If no match by ID, try by skill_name (fallback for legacy/mismatched data)
          if (userAchievements.length === 0 && skillName) {
            userAchievements = achievements.filter(a =>
              (a.skill_name || '').toLowerCase() === skillName.toLowerCase()
            );
            if (userAchievements.length > 0) {
              console.log('[SKILL_READINESS_DEBUG] Fallback skill_name match found for:', skillName);
            }
          }

          if (userAchievements.length > 0) {
            // Calculate progress for each achievement and take the maximum
            const possiblePercentages = userAchievements.map(a =>
              this.calculateSkillPercentage(
                a.course_level,
                requiredLevel,
                a.percentage_achieved,
                req.min_score_beginner || 30,
                req.min_score_intermediate || 60,
                req.min_score_advanced || 100,
                (req as any).min_score || (req as any).minScore
              )
            );
            achievedPercentage = Math.max(...possiblePercentages);
            console.log('[SKILL_READINESS_DEBUG] Achievement found for', skillName, '(', skillId, '):', achievedPercentage, '%');
          } else {
            console.log('[SKILL_READINESS_DEBUG] NO achievement found for', skillName, '(', skillId, ')');
          }
        }

        totalReadiness += achievedPercentage;
      }

      const finalReadiness = Math.round(totalReadiness / skillRequirements.length);
      console.log('[SKILL_READINESS_DEBUG] Final readiness:', finalReadiness, '%');
      return finalReadiness;
    } catch (error) {
      console.error('Error calculating skill readiness:', error);
      return 0;
    }
  },

  getHighestAchievedLevel(achievements: any[]): string {
    const levels = ['Beginner', 'Intermediate', 'Advanced'];
    for (const level of levels.reverse()) {
      if (achievements.some(a => a.course_level === level)) {
        return level;
      }
    }
    return 'Beginner';
  },

  calculateSkillPercentage(
    achievedLevel: string,
    requiredLevel: string,
    achievedScore: number,
    minBeginner?: number,
    minIntermediate?: number,
    minAdvanced?: number,
    unifiedMinScore?: number
  ): number {
    // New level-based readiness logic:
    // - If achieved level >= required level => 100%
    // - If achieved level is one step below required => 50%
    // - Otherwise => 0%
    const order = (lvl: string) => {
      if (!lvl) return 0;
      const l = lvl.toLowerCase();
      if (l === 'beginner') return 1;
      if (l === 'intermediate') return 2;
      if (l === 'advanced') return 3;
      return 0;
    };

    const achievedOrd = order(achievedLevel || '');
    const requiredOrd = order(requiredLevel || 'Advanced');

    if (achievedOrd === 0) return 0;
    if (achievedOrd >= requiredOrd) return 100;
    if (achievedOrd === requiredOrd - 1) return 50;
    return 0;
  },

  async getSkillProgressForCareerPath(userId: string, careerPathId: string) {
    try {
      const { data: careerPath } = await supabase
        .from('career_paths')
        .select('skill_requirements')
        .eq('id', careerPathId)
        .single();

      if (!careerPath?.skill_requirements) {
        return [];
      }

      const skillRequirements = careerPath.skill_requirements as any[];
      const skillIds = skillRequirements.map(req => req.skill_id || req.skillId).filter(Boolean);

      const [achievementsRes, assignmentsRes] = await Promise.all([
        supabase
          .from('user_skill_achievements')
          .select('*')
          .eq('user_id', userId),  // Remove the skillId filter to get ALL achievements
        supabase
          .from('skill_assignments')
          .select('skillid, assignedat, expiry_date, level')
          .eq('userid', userId)
          .in('skillid', skillIds)
      ]);

      const achievements = achievementsRes.data || [];
      const assignments = assignmentsRes.data || [];

      console.log('[SKILL_PROGRESS_DEBUG] Career Path ID:', careerPathId);
      console.log('[SKILL_PROGRESS_DEBUG] Skill requirement count:', skillRequirements.length);
      console.log('[SKILL_PROGRESS_DEBUG] Total user achievements fetched:', achievements.length);
      if (achievements.length > 0) {
        console.log('[SKILL_PROGRESS_DEBUG] User achievement sample:', achievements.map((a: any) => ({ skill_id: a.skill_id, skill_name: a.skill_name })));
      }

      return skillRequirements.map(req => {
        const skillId = req.skill_id || req.skillId;
        const skillName = req.skill_name || req.skillName || 'Unknown';

        console.log('[SKILL_PROGRESS_DEBUG] Processing skill:', skillName, 'with ID:', skillId);

        // Check manual assignments first
        const manualAssignment = assignments.find(a => a.skillid === skillId);
        const isManuallyAssigned = !!manualAssignment;

        // TRY BOTH skill_id AND skill_name matching for achievements
        let userAchievements = achievements.filter(a => a.skill_id === skillId);
        console.log('[SKILL_PROGRESS_DEBUG]  - Matched by skill_id:', userAchievements.length);

        // If no match by ID, try by name (fallback for legacy data)
        if (userAchievements.length === 0 && skillName) {
          userAchievements = achievements.filter(a =>
            (a.skill_name || '').toLowerCase() === skillName.toLowerCase()
          );
          console.log('[SKILL_PROGRESS_DEBUG]  - Matched by skill_name:', userAchievements.length);
          if (userAchievements.length > 0) {
            console.log('[SKILL_PROGRESS_DEBUG]  - Fallback skill_name match found for:', skillName);
          }
        }

        let highestLevel = 'Beginner';
        let achievedScoreValue = 0;
        let displayedAchievements = [...userAchievements];
        let maxPercentage = 0;

        if (isManuallyAssigned) {
          highestLevel = manualAssignment.level || 'Advanced';
          achievedScoreValue = 100;
          // Calculate maxPercentage based on the manual assignment level vs requirement
          maxPercentage = this.calculateSkillPercentage(
            highestLevel,
            req.level || 'Advanced',
            100, // Manual assignment always counts as 100% completion of that level
            req.min_score_beginner,
            req.min_score_intermediate,
            req.min_score_advanced,
            req.min_score || req.minScore
          );

          // Add a pseudo-achievement for the manual assignment if it's the best one
          displayedAchievements.push({
            skill_id: skillId,
            course_level: highestLevel,
            percentage_achieved: 100,
            course_title: 'Manually Assigned',
            completed_at: manualAssignment.assignedat,
            expiry_date: (manualAssignment as any).expiry_date
          });
        } else if (userAchievements.length > 0) {
          // Calculate progress for each achievement to find the best one
          const percentages = userAchievements.map(a => ({
            level: a.course_level,
            score: a.percentage_achieved,
            percentage: this.calculateSkillPercentage(
              a.course_level,
              req.level || 'Advanced',
              a.percentage_achieved,
              req.min_score_beginner,
              req.min_score_intermediate,
              req.min_score_advanced,
              req.min_score || req.minScore
            )
          }));

          // Sort by percentage then by level
          const best = percentages.sort((a, b) => b.percentage - a.percentage || (a.level === 'Advanced' ? -1 : 1))[0];

          highestLevel = best.level;
          achievedScoreValue = best.score;
          maxPercentage = best.percentage;
        }

        const reqLevel = req.level || 'Advanced';
        const levelOrder = (lvl: string) => {
          if (!lvl) return 0;
          const l = lvl.toLowerCase();
          if (l === 'beginner') return 1;
          if (l === 'intermediate') return 2;
          if (l === 'advanced') return 3;
          return 0;
        };

        const achievedOrd = levelOrder(highestLevel);
        const requiredOrd = levelOrder(reqLevel);

        // Determine required percentage threshold based on required level or provided min scores
        const thresholdForLevel = (level: string) => {
          const l = (level || '').toLowerCase();
          if (l === 'beginner') return (req.min_score_beginner || 30);
          if (l === 'intermediate') return (req.min_score_intermediate || 60);
          if (l === 'advanced') return (req.min_score_advanced || 100);
          return 100;
        };

        const requiredThreshold = thresholdForLevel(reqLevel);

        // Consider requirement met only if percentage_achieved meets threshold OR manual assignment meets level
        const isReqMet = (Math.round(Math.min(100, Math.max(0, maxPercentage))) >= requiredThreshold) || (isManuallyAssigned && achievedOrd >= requiredOrd && achievedScoreValue > 0);

        return {
          ...req,
          skill_id: skillId,
          skill_name: req.skill_name || req.skillName || 'Unknown',
          skill_family: req.skill_family || req.skillFamily || 'General',
          required_level: reqLevel,
          user_achieved_level: highestLevel,
          user_achievement_score: achievedScoreValue,
          percentage_achieved: Math.round(Math.min(100, Math.max(0, maxPercentage))),
          completed_courses: displayedAchievements,
          // Evidence: requirement met if percentage meets threshold or manual assignment satisfies level
          is_requirement_met: isReqMet,
          evidence_course: displayedAchievements.length > 0 ? displayedAchievements[0].course_title : null,
          evidence_completion_date: displayedAchievements.length > 0 ? displayedAchievements[0].completed_at : null,
          evidence_level_achieved: displayedAchievements.length > 0 ? displayedAchievements[0].course_level : null,
          evidence_percentage: displayedAchievements.length > 0 ? displayedAchievements[0].percentage_achieved : 0
        };
      });
    } catch (error) {
      console.error('Error getting skill progress:', error);
      return [];
    }
  },

  async getUserBadges(userId: string) {
    try {
      // 1. Fetch all skill families
      const { data: families } = await supabase
        .from('skill_families')
        .select('*');

      if (!families || families.length === 0) return [];

      // 2. Fetch all skills
      const { data: allSkills } = await supabase
        .from('skills')
        .select('id, family');

      // 3. Fetch user achievements (skills earned via courses)
      const { data: achievements } = await supabase
        .from('user_skill_achievements')
        .select('skill_id')
        .eq('user_id', userId);

      // 4. Fetch user skill assignments (skills manually assigned by admin)
      const { data: assignments } = await supabase
        .from('skill_assignments')
        .select('skillid')
        .eq('userid', userId);

      const acquiredSkillIds = new Set([
        ...(achievements || []).map(a => a.skill_id),
        ...(assignments || []).map(a => a.skillid)
      ]);

      // 5. Filter families where all skills are acquired
      const earnedBadges = families.filter(family => {
        const familySkills = (allSkills || []).filter(s => s.family === family.name);
        if (familySkills.length === 0) return false;
        return familySkills.every(s => acquiredSkillIds.has(s.id));
      });

      // 6. Fetch EFSET results and convert to badges
      const { data: efsetResults } = await supabase
        .from('external_assessment_results')
        .select('score, cefr_level, assessment:external_assessments(provider)')
        .eq('user_id', userId)
        .eq('verification_status', 'approved');

      const efsetBadges = (efsetResults || [])
        .filter(r => (r.assessment as any)?.provider === 'EFSET' && r.score !== undefined)
        .map(r => {
          const badge = getEFSETBadge(r.score!);
          if (badge) {
            return {
              id: badge.id,
              name: `${badge.name} (${r.score})`,
              icon: badge.icon,
              isEFSET: true,
              color: badge.color,
              score: r.score,
              cefr: badge.cefrLevel
            };
          }
          return null;
        })
        .filter(b => b !== null);

      // Deduplicate EFSET badges (keep highest score)
      const highestEfsetBadges = efsetBadges.reduce((acc: any[], current: any) => {
        const existing = acc.find(b => b.id === current.id);
        if (!existing) {
          acc.push(current);
        } else if (current.score > existing.score) {
          acc[acc.indexOf(existing)] = current;
        }
        return acc;
      }, []);

      return [...earnedBadges, ...highestEfsetBadges];
    } catch (error) {
      console.error('Error fetching user badges:', error);
      return [];
    }
  }
};
