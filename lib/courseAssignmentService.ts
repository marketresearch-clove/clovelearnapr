import { supabase } from './supabaseClient';
import { cacheService } from './cacheService';

export interface CourseAssignment {
  id?: string;
  userid: string;
  courseid: string;
  assignedat?: string;
  visibleto?: string;
}

export interface UserFilters {
  department?: string[];
  company?: string[];
  designation?: string[];
  employmentType?: string[];
  industry?: string[];
  leadershipRole?: string[];
  location?: string[];
  persona?: string[];
  team?: string[];
  managerId?: string;
}

export const courseAssignmentService = {
  async assignCoursesToUsers(
    userIds: string[],
    courseIds: string[],
    isMandatory: boolean = false,
    dueDate?: string,
    _notes?: string
  ): Promise<void> {
    const assignmentData = [];
    const currentUserId = (await supabase.auth.getUser()).data.user?.id;

    if (!currentUserId) {
      console.error('No authenticated user found when assigning courses');
      throw new Error('You must be logged in to assign courses');
    }

    console.log(`Assigning courses: Users=${userIds.length}, Courses=${courseIds.length}, Mandatory=${isMandatory}, DueDate=${dueDate}`);

    for (const userId of userIds) {
      for (const courseId of courseIds) {
        assignmentData.push({
          userid: userId,
          courseid: courseId,
          is_mandatory: isMandatory,
          assigned_by: currentUserId,
          due_date: dueDate || null, // Ensure null is passed if undefined to clear it or set it
        });
      }
    }

    console.log('Assignment payload:', assignmentData);

    const { error } = await supabase
      .from('course_assignments')
      .upsert(assignmentData, { onConflict: 'userid,courseid' });

    if (error) {
      console.error('Error assigning courses:', error);
      throw error;
    }
  },

  async removeCoursesFromUsers(userIds: string[], courseIds: string[]): Promise<void> {
    // Hide courses instead of deleting to preserve assignment history
    try {
      const { error } = await supabase
        .from('course_assignments')
        .update({ is_visible: false })
        .in('userid', userIds)
        .in('courseid', courseIds);

      if (error) {
        console.error('Error hiding courses from users:', error);
        // If is_visible column doesn't exist, try deleting instead
        if (error.message.includes('column') || error.message.includes('is_visible')) {
          console.warn('is_visible column not found, attempting to delete assignments instead');
          const { error: deleteError } = await supabase
            .from('course_assignments')
            .delete()
            .in('userid', userIds)
            .in('courseid', courseIds);

          if (deleteError) {
            console.error('Error deleting course assignments:', deleteError);
            throw deleteError;
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Fatal error removing courses from users:', error);
      throw error;
    }
  },

  async getUsersByFilters(filters: UserFilters): Promise<any[]> {
    let query = supabase
      .from('profiles')
      .select('id, user_id, fullname, email, department, company, designation, employment_type, industry, leadership_role, location, persona, team, manager_id, manager_name, manager_mapping');

    if (filters.department && filters.department.length > 0) {
      query = query.in('department', filters.department);
    }

    if (filters.company && filters.company.length > 0) {
      query = query.in('company', filters.company);
    }

    if (filters.designation && filters.designation.length > 0) {
      query = query.in('designation', filters.designation);
    }

    if (filters.employmentType && filters.employmentType.length > 0) {
      query = query.in('employment_type', filters.employmentType);
    }

    if (filters.industry && filters.industry.length > 0) {
      query = query.in('industry', filters.industry);
    }

    if (filters.leadershipRole && filters.leadershipRole.length > 0) {
      query = query.in('leadership_role', filters.leadershipRole);
    }

    if (filters.location && filters.location.length > 0) {
      query = query.in('location', filters.location);
    }

    if (filters.persona && filters.persona.length > 0) {
      query = query.in('persona', filters.persona);
    }

    if (filters.team && filters.team.length > 0) {
      query = query.in('team', filters.team);
    }

    if (filters.managerId) {
      query = query.eq('manager_id', filters.managerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAllUsers(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, fullname, email, department, company, designation, employment_type, industry, leadership_role, location, persona, team, manager_id, manager_name, manager_mapping, avatarurl')
        .order('fullname', { ascending: true });

      if (error) {
        console.error('Error fetching users from profiles:', error);
        throw error;
      }

      if (!data) {
        console.warn('No data returned from profiles query');
        return [];
      }

      return data;
    } catch (error) {
      console.error('Exception in getAllUsers:', error);
      throw error;
    }
  },

  async getUsersWithCourse(courseId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('course_assignments')
      .select('userid')
      .eq('courseid', courseId);

    if (error) throw error;
    return data?.map(d => d.userid) || [];
  },

  async getUniqueFilterValues() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('department, company, designation, employment_type, industry, leadership_role, location, persona, team');

    const uniqueValues = {
      departments: new Set<string>(),
      companies: new Set<string>(),
      designations: new Set<string>(),
      employmentTypes: new Set<string>(),
      industries: new Set<string>(),
      leadershipRoles: new Set<string>(),
      locations: new Set<string>(),
      personas: new Set<string>(),
      teams: new Set<string>(),
    };

    (profiles || []).forEach((profile: any) => {
      if (profile.department) uniqueValues.departments.add(profile.department);
      if (profile.company) uniqueValues.companies.add(profile.company);
      if (profile.designation) uniqueValues.designations.add(profile.designation);
      if (profile.employment_type) uniqueValues.employmentTypes.add(profile.employment_type);
      if (profile.industry) uniqueValues.industries.add(profile.industry);
      if (profile.leadership_role) uniqueValues.leadershipRoles.add(profile.leadership_role);
      if (profile.location) uniqueValues.locations.add(profile.location);
      if (profile.persona) uniqueValues.personas.add(profile.persona);
      if (profile.team) uniqueValues.teams.add(profile.team);
    });

    return {
      departments: Array.from(uniqueValues.departments).sort(),
      companies: Array.from(uniqueValues.companies).sort(),
      designations: Array.from(uniqueValues.designations).sort(),
      employmentTypes: Array.from(uniqueValues.employmentTypes).sort(),
      industries: Array.from(uniqueValues.industries).sort(),
      leadershipRoles: Array.from(uniqueValues.leadershipRoles).sort(),
      locations: Array.from(uniqueValues.locations).sort(),
      personas: Array.from(uniqueValues.personas).sort(),
      teams: Array.from(uniqueValues.teams).sort(),
    };
  },

  async getAssignmentsForUser(userId: string): Promise<any[]> {
    try {
      // Try to fetch with is_visible filter first (new column)
      const { data: assignments, error: assignmentError } = await supabase
        .from('course_assignments')
        .select('*')
        .eq('userid', userId)
        .eq('is_visible', true);

      if (assignmentError) {
        // If is_visible column doesn't exist, fetch all assignments for this user
        console.warn('is_visible column not found, fetching all assignments:', assignmentError.message);
        const { data: allAssignments, error: fallbackError } = await supabase
          .from('course_assignments')
          .select('*')
          .eq('userid', userId);

        if (fallbackError) throw fallbackError;

        // If no assignments, return empty array
        if (!allAssignments || allAssignments.length === 0) {
          return [];
        }

        const courseIds = allAssignments.map(a => a.courseid);
        const { data: courses, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', courseIds);

        if (courseError) throw courseError;

        const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

        return allAssignments.map(assignment => ({
          ...assignment,
          ...courseMap.get(assignment.courseid),
        }));
      }

      if (!assignments || assignments.length === 0) {
        return [];
      }

      const courseIds = assignments.map(a => a.courseid);
      const { data: courses, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .in('id', courseIds);

      if (courseError) throw courseError;

      const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

      return assignments.map(assignment => ({
        ...assignment,
        ...courseMap.get(assignment.courseid),
      }));
    } catch (error) {
      console.error('Error fetching user assigned courses:', error);
      return [];
    }
  },

  async getAllCourseAssignments(): Promise<any[]> {
    try {
      // Fetch ALL assignments (including hidden ones) for admin view
      const { data: assignments, error } = await supabase
        .from('course_assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!assignments || assignments.length === 0) {
        return [];
      }

      // Get all user and course IDs (including hidden assignments)
      const userIds = [...new Set(assignments.map(a => a.userid))];
      const courseIds = [...new Set(assignments.map(a => a.courseid))];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, fullname, email')
        .in('user_id', userIds);

      if (profilesError) {
        throw profilesError;
      }

      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds);

      if (coursesError) {
        throw coursesError;
      }

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

      // Return ALL assignments with visibility status indicator
      return assignments.map(assignment => ({
        ...assignment,
        username: profileMap.get(assignment.userid)?.fullname,
        email: profileMap.get(assignment.userid)?.email,
        course_title: courseMap.get(assignment.courseid)?.title,
        status: assignment.is_visible === false ? 'hidden' : 'active', // Add status indicator
      }));
    } catch (error) {
      console.error('Error fetching all course assignments:', error);
      return [];
    }
  },

  async updateCourseAssignment(assignmentId: string, updates: { is_mandatory?: boolean; due_date?: string; }): Promise<void> {
    const { error } = await supabase
      .from('course_assignments')
      .update(updates)
      .eq('id', assignmentId);

    if (error) {
      console.error('Error updating course assignment:', error);
      throw error;
    }
  },

  async getAllCourseAssignmentsWithHidden(): Promise<any[]> {
    /**
     * Fetches ALL assignments including hidden ones
     * Used for admin dashboard to see complete assignment history
     */
    try {
      const { data: assignments, error } = await supabase
        .from('course_assignments')
        .select('*');

      if (error) {
        throw error;
      }

      if (!assignments || assignments.length === 0) {
        return [];
      }

      const userIds = [...new Set(assignments.map(a => a.userid))];
      const courseIds = [...new Set(assignments.map(a => a.courseid))];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, fullname, email')
        .in('user_id', userIds);

      if (profilesError) {
        throw profilesError;
      }

      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds);

      if (coursesError) {
        throw coursesError;
      }

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

      return assignments.map(assignment => ({
        ...assignment,
        username: profileMap.get(assignment.userid)?.fullname,
        email: profileMap.get(assignment.userid)?.email,
        course_title: courseMap.get(assignment.courseid)?.title,
        status: assignment.is_visible === false ? 'hidden' : 'visible',
      }));
    } catch (error) {
      console.error('Error fetching all course assignments with hidden:', error);
      return [];
    }
  },

  async getUserAssignmentsWithHidden(userId: string): Promise<any[]> {
    /**
     * Fetches ALL assignments for a user including hidden ones
     * Used for admin to see what courses were previously assigned
     */
    try {
      const { data: assignments, error: assignmentError } = await supabase
        .from('course_assignments')
        .select('*')
        .eq('userid', userId);

      if (assignmentError) throw assignmentError;

      if (!assignments || assignments.length === 0) {
        return [];
      }

      const courseIds = assignments.map(a => a.courseid);
      const { data: courses, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .in('id', courseIds);

      if (courseError) throw courseError;

      const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

      return assignments.map(assignment => ({
        ...assignment,
        ...courseMap.get(assignment.courseid),
        status: assignment.is_visible === false ? 'hidden' : 'visible',
      }));
    } catch (error) {
      console.error('Error fetching user assignments with hidden:', error);
      return [];
    }
  },

  /**
   * Get all assignments with full details (courses, profiles, enrollments)
   * Uses caching to avoid redundant queries
   */
  async getAssignmentsWithDetails(): Promise<any[]> {
    try {
      // Check cache first
      const cacheKey = 'cache:course_assignments_with_details';
      const cached = cacheService.get<any[]>(cacheKey);
      if (cached) {
        console.log('[ASSIGNMENTS] Using cached assignments with details');
        return cached;
      }

      // Fetch assignments
      const { data: assignmentsData, error } = await supabase
        .from('course_assignments')
        .select(`
          *,
          courses (title, category)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!assignmentsData || assignmentsData.length === 0) {
        // Cache empty result
        cacheService.set(cacheKey, [], 10 * 60 * 1000);
        return [];
      }

      // Fetch profiles for user names and departments
      const userIds = new Set(assignmentsData.map((a: any) => a.userid));
      const assignerIds = new Set(assignmentsData.map((a: any) => a.assigned_by));
      const allIds = Array.from(new Set([...userIds, ...assignerIds]));

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, fullname, department, avatarurl, user_id')
        .in('id', allIds);

      // Fetch enrollments for status (using cached data if available)
      const enrollmentsCacheKey = 'cache:all_enrollments_summary';
      let enrollmentsData = cacheService.get<any[]>(enrollmentsCacheKey);

      if (!enrollmentsData) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('userid, courseid, completed, progress')
          .in('userid', Array.from(userIds));

        enrollmentsData = enrollments || [];
        cacheService.set(enrollmentsCacheKey, enrollmentsData, 10 * 60 * 1000);
      }

      const enrollmentMap = (enrollmentsData || []).reduce((acc: any, enrollment: any) => {
        acc[`${enrollment.userid}-${enrollment.courseid}`] = enrollment;
        return acc;
      }, {});

      const profileMap = (profilesData || []).reduce((acc: any, profile: any) => {
        acc[profile.id] = profile;
        return acc;
      }, {});

      const enrichedAssignments = assignmentsData.map((a: any) => ({
        ...a,
        user_profile: profileMap[a.userid],
        assigner_profile: profileMap[a.assigned_by],
        enrollment: enrollmentMap[`${a.userid}-${a.courseid}`],
      }));

      // Cache result with 10 minute expiration
      cacheService.set(cacheKey, enrichedAssignments, 10 * 60 * 1000);

      return enrichedAssignments;
    } catch (error) {
      console.error('Error fetching assignments with details:', error);
      return [];
    }
  },

  /**
   * Get form data for assignment UI (courses, profiles, filter values)
   * Uses caching to avoid redundant queries
   */
  async getFormDataForAssignments(): Promise<{
    courses: any[];
    profiles: any[];
    departments: string[];
    designations: string[];
    categories: string[];
  }> {
    try {
      // Check cache first
      const cacheKey = 'cache:assignment_form_data';
      const cached = cacheService.get<any>(cacheKey);
      if (cached) {
        console.log('[ASSIGNMENTS] Using cached form data');
        return cached;
      }

      // Fetch courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title, category');

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, fullname, department, designation, user_id');

      const courses = coursesData || [];
      const profiles = profilesData || [];

      // Extract unique values
      const categories = Array.from(new Set(courses.map((c: any) => c.category).filter(Boolean))) as string[];
      const departments = Array.from(new Set(profiles.map((p: any) => p.department).filter(Boolean))) as string[];
      const designations = Array.from(new Set(profiles.map((p: any) => p.designation).filter(Boolean))) as string[];

      const formData = {
        courses,
        profiles,
        departments: departments.sort(),
        designations: designations.sort(),
        categories: categories.sort(),
      };

      // Cache with 15 minute expiration (form data changes less frequently)
      cacheService.set(cacheKey, formData, 15 * 60 * 1000);

      return formData;
    } catch (error) {
      console.error('Error fetching form data for assignments:', error);
      return {
        courses: [],
        profiles: [],
        departments: [],
        designations: [],
        categories: [],
      };
    }
  },

  async getAssignedCoursesWithProgress(userId: string): Promise<any[]> {
    const cacheKey = `cache:assigned_courses_progress:${userId}`;
    const cached = cacheService.get<any[]>(cacheKey);
    if (cached) {
      console.log('[CACHE HIT] getAssignedCoursesWithProgress');
      return cached;
    }

    try {
      // Get assignments
      const assignments = await this.getAssignmentsForUser(userId);
      const courseIds = assignments.map((a: any) => a.courseid);

      if (courseIds.length === 0) {
        cacheService.set(cacheKey, [], 5 * 60 * 1000); // 5 min cache
        return [];
      }

      // Batch fetch courses, lesson progress, and lesson counts in parallel
      const [coursesResult, progressResult, lessonsResult] = await Promise.all([
        supabase
          .from('courses')
          .select('id, title, instructorname, thumbnail, category, averagerating, duration, level, totalstudents, description, status, certificate_enabled')
          .in('id', courseIds),
        supabase
          .from('lesson_progress')
          .select('courseid, completed')
          .eq('userid', userId)
          .in('courseid', courseIds),
        supabase
          .from('lessons')
          .select('courseid, id')
          .in('courseid', courseIds)
      ]);

      const { data: coursesData, error: coursesError } = coursesResult;
      const { data: progressData, error: progressError } = progressResult;
      const { data: lessonsData, error: lessonsError } = lessonsResult;

      if (coursesError || progressError || lessonsError) {
        throw new Error('Failed to fetch course data');
      }

      // Build maps for fast lookup
      const completedLessonsByCourse: Record<string, number> = {};
      (progressData || []).forEach((progress: any) => {
        if (progress.completed) {
          completedLessonsByCourse[progress.courseid] = (completedLessonsByCourse[progress.courseid] || 0) + 1;
        }
      });

      const lessonsByCourse: Record<string, string[]> = {};
      (lessonsData || []).forEach((lesson: any) => {
        if (!lessonsByCourse[lesson.courseid]) {
          lessonsByCourse[lesson.courseid] = [];
        }
        lessonsByCourse[lesson.courseid].push(lesson.id);
      });

      // Map courses with progress
      const result = (coursesData || []).map((course: any) => {
        const totalLessons = lessonsByCourse[course.id]?.length || 0;
        const completedLessons = completedLessonsByCourse[course.id] || 0;
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return {
          ...course,
          progress,
          assignment: assignments.find((a: any) => a.courseid === course.id),
        };
      });

      cacheService.set(cacheKey, result, 5 * 60 * 1000); // 5 min cache
      return result;
    } catch (error) {
      console.error('Error fetching assigned courses with progress:', error);
      return [];
    }
  },

  /**
   * Clear assignment-related caches (call after creating/updating/deleting assignments)
   */
  clearAssignmentCaches(userId?: string): void {
    cacheService.remove('cache:course_assignments_with_details');
    cacheService.remove('cache:assignment_form_data');
    if (userId) {
      cacheService.remove(`cache:assigned_courses_progress:${userId}`);
    }
    console.log('[ASSIGNMENTS] Cleared assignment caches');
  },
};