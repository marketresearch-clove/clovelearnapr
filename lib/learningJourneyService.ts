import { supabase } from './supabaseClient';
import { cacheService } from './cacheService';

export interface LearningJourney {
  id: string;
  title: string;
  description?: string;
  type: 'Standard' | 'Drip' | 'Flexible';
  created_at: string;
  created_by: string;
}

export interface JourneyModule {
  id: string;
  journey_id: string;
  title: string;
  type: 'Micro-Learning Module' | 'Classroom Module' | 'General feedback' | 'Course';
  course_id?: string;
  duration?: string;
  image_url?: string;
  provider?: string;
  sequence_order: number;
  unlock_days_after_start?: number;
}

export interface UserJourneyAssignment {
  id: string;
  user_id: string;
  journey_id: string;
  assigned_at: string;
  assigned_by: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  start_date?: string;
}

export interface UserJourneyModuleProgress {
  id: string;
  user_journey_id: string;
  module_id: string;
  status: 'locked' | 'unlocked' | 'completed';
  unlock_date?: string;
  due_date?: string;
  completed_at?: string;
}

export const learningJourneyService = {
  // --- Admin / Management ---

  async createJourney(journey: Omit<LearningJourney, 'id' | 'created_at' | 'created_by'>): Promise<LearningJourney> {
    const { data, error } = await supabase
      .from('learning_journeys')
      .insert([journey])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addModuleToJourney(module: Omit<JourneyModule, 'id'>): Promise<JourneyModule> {
    const { data, error } = await supabase
      .from('journey_modules')
      .insert([module])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getJourneys(): Promise<LearningJourney[]> {
    const { data, error } = await supabase
      .from('learning_journeys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getJourneyModules(journeyId: string): Promise<JourneyModule[]> {
    const { data, error } = await supabase
      .from('journey_modules')
      .select('*')
      .eq('journey_id', journeyId)
      .order('sequence_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async updateJourney(id: string, updates: Partial<LearningJourney>): Promise<LearningJourney> {
    const { data, error } = await supabase
      .from('learning_journeys')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteJourney(id: string): Promise<void> {
    const { error } = await supabase
      .from('learning_journeys')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteJourneyModules(journeyId: string): Promise<void> {
    const { error } = await supabase
      .from('journey_modules')
      .delete()
      .eq('journey_id', journeyId);

    if (error) throw error;
  },

  // --- Assignment ---

  async assignJourneyToUsers(
    userIds: string[],
    journeyId: string,
    assignedBy: string,
    assignedAtDate?: Date,
    startDate?: string | Date
  ): Promise<void> {
    const assignedAt = assignedAtDate ? assignedAtDate.toISOString() : new Date().toISOString();

    // Convert start date to ISO string, handling YYYY-MM-DD format properly
    let journeyStartDate: string | null = null;
    if (startDate) {
      if (typeof startDate === 'string') {
        // If it's a date string like "2026-04-06", create a proper ISO date
        // Parse as local date (00:00:00) to avoid timezone offset issues
        const parts = startDate.split('-');
        const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
        journeyStartDate = localDate.toISOString();
      } else {
        journeyStartDate = startDate.toISOString();
      }
    }

    const assignments = userIds.map(userId => ({
      user_id: userId,
      journey_id: journeyId,
      assigned_by: assignedBy,
      assigned_at: assignedAt,
      status: journeyStartDate ? 'in_progress' : 'not_started',
      progress: 0,
      start_date: journeyStartDate
    }));

    const { data: createdAssignments, error } = await supabase
      .from('user_journey_assignments')
      .upsert(assignments, { onConflict: 'user_id,journey_id' })
      .select();

    if (error) throw error;

    // Initialize module progress for each assignment
    if (createdAssignments) {
      const modules = await this.getJourneyModules(journeyId);

      for (const assignment of createdAssignments) {
        const moduleProgress = modules.map((module: JourneyModule, index: number) => {
          let status = index === 0 ? 'unlocked' : 'locked';
          let unlockDate = null;
          let dueDate = null;

          // If a start date was provided during assignment, calculate unlock dates immediately
          if (journeyStartDate) {
            const startDateObj = new Date(journeyStartDate);

            if (index === 0) {
              // First module unlocks immediately on the start date
              unlockDate = journeyStartDate;
            } else if (module.unlock_days_after_start !== undefined && module.unlock_days_after_start !== null) {
              // Calculate unlock date from the provided start date
              const unlockTime = new Date(startDateObj.getTime() + (module.unlock_days_after_start * 24 * 60 * 60 * 1000));
              unlockDate = unlockTime.toISOString();
            }

            // Due date is 7 days after unlock
            if (unlockDate) {
              const unlockDateObj = new Date(unlockDate);
              const dueTime = new Date(unlockDateObj.getTime() + (7 * 24 * 60 * 60 * 1000));
              dueDate = dueTime.toISOString();
            }
          }

          return {
            user_journey_id: assignment.id,
            module_id: module.id,
            status: status,
            unlock_date: unlockDate,
            due_date: dueDate
          };
        });

        if (moduleProgress.length > 0) {
          await supabase.from('user_journey_module_progress').insert(moduleProgress);
        }
      }
    }
  },

  async deleteAssignment(userJourneyId: string): Promise<void> {
    const { error } = await supabase
      .from('user_journey_assignments')
      .delete()
      .eq('id', userJourneyId);

    if (error) throw error;
  },

  // Helper function to calculate and update progress for an assignment
  async recalculateAssignmentProgress(assignmentId: string): Promise<number> {
    try {
      // Get all module progress for this assignment
      const { data: allModuleProgress, error: fetchError } = await supabase
        .from('user_journey_module_progress')
        .select('status')
        .eq('user_journey_id', assignmentId);

      if (fetchError) {
        console.error('Error fetching module progress:', fetchError);
        return 0;
      }

      // Calculate progress percentage
      const totalModules = (allModuleProgress || []).length;
      const completedModules = (allModuleProgress || []).filter((m: any) => m.status === 'completed').length;
      const progressPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

      // Determine journey status: completed if 100%, in_progress if any modules started, not_started otherwise
      let newStatus = 'not_started';
      if (progressPercentage === 100 && totalModules > 0) {
        newStatus = 'completed';
      } else if (completedModules > 0 || (allModuleProgress || []).some((m: any) => m.status === 'unlocked')) {
        newStatus = 'in_progress';
      }

      // Update the assignment progress and status
      const { error: updateError } = await supabase
        .from('user_journey_assignments')
        .update({ progress: progressPercentage, status: newStatus })
        .eq('id', assignmentId);

      if (updateError) {
        console.error('Error updating assignment progress:', updateError);
      }

      return progressPercentage;
    } catch (err) {
      console.error('Error recalculating assignment progress:', err);
      return 0;
    }
  },

  async getAssignmentsByJourney(journeyId: string): Promise<(UserJourneyAssignment & { user: any })[]> {
    // Note: This assumes 'user:auth.users' relation works, or we might need to fetch users separately if auth.users is not directly joinable via standard API depending on Supabase config.
    // Often auth.users is not exposed directly. We might need to fetch assignments and then map users.
    // However, let's assume we can join with a public profile table if it exists, or just fetch assignments and let the frontend map user details from the already loaded users list.

    const { data, error } = await supabase
      .from('user_journey_assignments')
      .select('*')
      .eq('journey_id', journeyId);

    if (error) throw error;

    // Ensure all assignments have up-to-date progress calculations
    const assignmentsWithProgress = await Promise.all(
      (data || []).map(async (assignment: any) => {
        // Recalculate progress to ensure it's up-to-date
        const updatedProgress = await this.recalculateAssignmentProgress(assignment.id);
        return { ...assignment, progress: updatedProgress };
      })
    );

    return assignmentsWithProgress;
  },

  // --- User Progress ---

  async getUserJourneys(userId: string): Promise<(UserJourneyAssignment & { journey: LearningJourney })[]> {
    const { data, error } = await supabase
      .from('user_journey_assignments')
      .select('*, journey:learning_journeys(*)')
      .eq('user_id', userId)
      .order('status', { ascending: true }) // 'completed' comes after 'in_progress' and 'not_started' alphabetically
      .order('assigned_at', { ascending: false }); // Most recent first within same status

    if (error) throw error;

    // Client-side sort to ensure correct order: not_started/in_progress first, then completed
    return (data || []).sort((a, b) => {
      const statusOrder: Record<string, number> = {
        'not_started': 0,
        'in_progress': 1,
        'completed': 2
      };
      const aOrder = statusOrder[a.status] || 0;
      const bOrder = statusOrder[b.status] || 0;

      if (aOrder !== bOrder) return aOrder - bOrder;
      // Within same status, sort by assigned_at (most recent first)
      return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
    });
  },

  async getUserJourneyProgress(userJourneyId: string): Promise<(UserJourneyModuleProgress & { module: JourneyModule })[]> {
    const { data, error } = await supabase
      .from('user_journey_module_progress')
      .select(`
        *,
        module:journey_modules(
          id,
          journey_id,
          title,
          type,
          course_id,
          duration,
          image_url,
          provider,
          sequence_order,
          unlock_days_after_start
        )
      `)
      .eq('user_journey_id', userJourneyId)
      .order('module(sequence_order)', { ascending: true });

    if (error) throw error;

    // Enhance module data with course thumbnail if module has course_id
    let enrichedData = (data || []).sort((a: any, b: any) => (a.module?.sequence_order || 0) - (b.module?.sequence_order || 0));

    // Fetch course thumbnails for modules that reference courses
    const courseIds = enrichedData
      .filter((item: any) => item.module?.course_id)
      .map((item: any) => item.module.course_id);

    if (courseIds.length > 0) {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, thumbnail')
        .in('id', courseIds);

      const courseMap = new Map((coursesData || []).map((c: any) => [c.id, c.thumbnail]));

      enrichedData = enrichedData.map((item: any) => {
        if (item.module?.course_id && !item.module?.image_url) {
          return {
            ...item,
            module: {
              ...item.module,
              image_url: courseMap.get(item.module.course_id) || item.module.image_url
            }
          };
        }
        return item;
      });
    }

    return enrichedData;
  },

  async startJourney(userJourneyId: string): Promise<void> {
    const startDate = new Date().toISOString();
    await this.setJourneyStartDate(userJourneyId, startDate);
  },

  async setJourneyStartDate(userJourneyId: string, startDate: string | Date): Promise<void> {
    const startDateIso = typeof startDate === 'string' ? startDate : startDate.toISOString();

    const { error } = await supabase
      .from('user_journey_assignments')
      .update({
        status: 'in_progress',
        start_date: startDateIso
      })
      .eq('id', userJourneyId);

    if (error) throw error;

    // Recalculate unlock dates based on the provided start date
    await this.recalculateUnlockDates(userJourneyId, startDateIso);
  },

  async recalculateUnlockDates(userJourneyId: string, startDate: string): Promise<void> {
    try {
      const { data: assignment, error: fetchError } = await supabase
        .from('user_journey_assignments')
        .select('journey_id')
        .eq('id', userJourneyId)
        .single();

      if (fetchError || !assignment) {
        console.error('Error fetching assignment:', fetchError);
        return;
      }

      const modules = await this.getJourneyModules(assignment.journey_id);
      const startDateObj = new Date(startDate);

      // Update all module progress records with correct unlock dates
      const updates = modules.map((module: JourneyModule, index: number) => {
        let unlockDate = null;
        let dueDate = null;

        if (index === 0) {
          // First module unlocks immediately on start date
          unlockDate = startDate;
        } else if (module.unlock_days_after_start !== undefined && module.unlock_days_after_start !== null) {
          // Calculate unlock date from the provided start date
          const unlockTime = new Date(startDateObj.getTime() + (module.unlock_days_after_start * 24 * 60 * 60 * 1000));
          unlockDate = unlockTime.toISOString();
        }

        // Due date is 7 days after unlock
        if (unlockDate) {
          const unlockDateObj = new Date(unlockDate);
          const dueTime = new Date(unlockDateObj.getTime() + (7 * 24 * 60 * 60 * 1000));
          dueDate = dueTime.toISOString();
        }

        return {
          module_id: module.id,
          unlock_date: unlockDate,
          due_date: dueDate
        };
      });

      // Update each module progress record
      for (const update of updates) {
        await supabase
          .from('user_journey_module_progress')
          .update({
            unlock_date: update.unlock_date,
            due_date: update.due_date
          })
          .eq('user_journey_id', userJourneyId)
          .eq('module_id', update.module_id);
      }
    } catch (err) {
      console.error('Error recalculating unlock dates:', err);
    }
  },

  async updateModuleStatus(progressId: string, status: 'locked' | 'unlocked' | 'completed'): Promise<void> {
    const updates: any = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('user_journey_module_progress')
      .update(updates)
      .eq('id', progressId);

    if (error) throw error;

    // Trigger progress recalculation for the journey assignment
    try {
      // Get the module progress record to find user_journey_id
      const { data: moduleProgress, error: fetchError } = await supabase
        .from('user_journey_module_progress')
        .select('user_journey_id')
        .eq('id', progressId)
        .single();

      if (fetchError || !moduleProgress) {
        console.error('Error fetching module progress:', fetchError);
        return;
      }

      // Get all module progress for this assignment
      const { data: allModuleProgress, error: allModulesError } = await supabase
        .from('user_journey_module_progress')
        .select('status')
        .eq('user_journey_id', moduleProgress.user_journey_id);

      if (allModulesError) {
        console.error('Error fetching all module progress:', allModulesError);
        return;
      }

      // Calculate progress percentage
      const totalModules = (allModuleProgress || []).length;
      const completedModules = (allModuleProgress || []).filter((m: any) => m.status === 'completed').length;
      const progressPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

      // Update the assignment progress
      const { error: updateError } = await supabase
        .from('user_journey_assignments')
        .update({ progress: progressPercentage })
        .eq('id', moduleProgress.user_journey_id);

      if (updateError) {
        console.error('Error updating assignment progress:', updateError);
      }
    } catch (err) {
      console.error('Error recalculating journey progress:', err);
    }
  },

  // --- Caching & Batch Operations ---

  async getUserJourneysCached(userId: string): Promise<(UserJourneyAssignment & { journey: LearningJourney })[]> {
    const cacheKey = `cache:user_journeys:${userId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      console.log('[CACHE HIT] getUserJourneys');
      return cached;
    }

    const journeys = await this.getUserJourneys(userId);
    cacheService.set(cacheKey, journeys, 5 * 60); // 5 min cache
    return journeys;
  },

  // NOTE: Progress data is NOT cached as it's too large when enriched with module relations
  // The batch enrollment fetching already provides most of the performance benefit

  async getCourseEnrollmentsBatch(userId: string, courseIds: string[]): Promise<Map<string, any>> {
    if (courseIds.length === 0) {
      return new Map();
    }

    // Fetch all enrollments in one query
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('userid, courseid, completed, progress')
      .eq('userid', userId)
      .in('courseid', courseIds);

    if (error) {
      console.error('Error fetching batch enrollments:', error);
      return new Map();
    }

    // Create map for fast lookup
    const enrollmentMap = new Map<string, any>();
    (enrollments || []).forEach((enrollment: any) => {
      enrollmentMap.set(enrollment.courseid, enrollment);
    });
    return enrollmentMap;
  },

  clearJourneyCaches(userId?: string): void {
    if (userId) {
      cacheService.remove(`cache:user_journeys:${userId}`);
    }
  }
};
