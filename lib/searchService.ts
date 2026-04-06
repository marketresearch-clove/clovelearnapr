import { supabase } from './supabaseClient';

export interface SearchCourseResult {
    id: string;
    title: string;
    description: string;
    category: string;
    instructorName: string;
    thumbnail: string;
    level: string;
    averageRating: number;
    totalStudents: number;
}

export interface SearchMentorResult {
    id: string;
    fullName: string;
    email: string;
    bio: string;
    avatarUrl: string;
    coursesCount: number;
}

export interface SearchSkillResult {
    id: string;
    name: string;
    description: string;
    coursesCount: number;
}

export interface SearchUserResult {
    id: string;
    fullName: string;
    email: string;
    role: string;
    department: string;
    user_status?: string;
    avatarUrl: string;
    joinDate: string;
}

export interface UserReportData {
    profile: SearchUserResult;
    enrolledCourses: any[];
    completedCourses: any[];
    certificates: any[];
    pendingAssignments: any[];
    careerPaths: any[];
    skills: any[];
    statistics: any;
    leaderboardRank: number;
}

class SearchService {
    /**
     * Search courses by title, description, or category
     */
    async searchCourses(query: string): Promise<SearchCourseResult[]> {
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('id, title, description, category, instructorname, thumbnail, level, averagerating, totalstudents')
                .eq('status', 'published')
                .neq('is_hidden', true)
                .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
                .limit(10);

            if (error) throw error;
            return (data || []).map((course: any) => ({
                id: course.id,
                title: course.title,
                description: course.description || '',
                category: course.category,
                instructorName: course.instructorname,
                thumbnail: course.thumbnail,
                level: course.level,
                averageRating: course.averagerating,
                totalStudents: course.totalstudents,
            }));
        } catch (error) {
            console.error('Error searching courses:', error);
            return [];
        }
    }

    /**
     * Search mentors/instructors by name or email
     */
    async searchMentors(query: string): Promise<SearchMentorResult[]> {
        try {
            // Search for users who are admins or have instructor role
            // Use separate queries to avoid URL encoding issues with complex OR clauses
            const { data: mentorsWithInstructor, error: error1 } = await supabase
                .from('profiles')
                .select(`id, fullname, email, bio, avatarurl`)
                .eq('role', 'instructor')
                .or(`fullname.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(10);

            const { data: mentorsWithAdmin, error: error2 } = await supabase
                .from('profiles')
                .select(`id, fullname, email, bio, avatarurl`)
                .eq('role', 'admin')
                .or(`fullname.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(10);

            const error = error1 || error2;
            const data = [...(mentorsWithInstructor || []), ...(mentorsWithAdmin || [])];

            // Remove duplicates by ID
            const uniqueData = Array.from(new Map(data.map(d => [d.id, d])).values());

            if (error && error1 && error2) {
                console.error('Error fetching mentors from profiles:', error);
                // Don't throw - continue with results from whichever queries succeeded
            }

            if (!uniqueData || uniqueData.length === 0) {
                console.log('No potential mentors found matching query:', query);
                return [];
            }

            console.log(`Found ${uniqueData.length} potential mentors matching query:`, query);

            // Get courses count for each mentor
            const mentorsWithCourses = await Promise.all(
                (uniqueData || []).map(async (mentor) => {
                    try {
                        const { count, error: courseError } = await supabase
                            .from('courses')
                            .select('id', { count: 'exact', head: true })
                            .eq('instructorid', mentor.id)
                            .eq('status', 'published')
                            .neq('is_hidden', true);

                        if (courseError) {
                            console.warn('Error fetching course count for mentor:', mentor.fullname, courseError);
                            return {
                                id: mentor.id,
                                fullName: mentor.fullname,
                                email: mentor.email,
                                bio: mentor.bio,
                                avatarUrl: mentor.avatarurl,
                                coursesCount: 0,
                            };
                        }

                        return {
                            id: mentor.id,
                            fullName: mentor.fullname,
                            email: mentor.email,
                            bio: mentor.bio,
                            avatarUrl: mentor.avatarurl,
                            coursesCount: count || 0,
                        };
                    } catch (err) {
                        console.warn('Error processing mentor:', mentor.fullname, err);
                        return {
                            id: mentor.id,
                            fullName: mentor.fullname,
                            email: mentor.email,
                            bio: mentor.bio,
                            avatarUrl: mentor.avatarurl,
                            coursesCount: 0,
                        };
                    }
                })
            );

            const result = mentorsWithCourses.filter(m => m !== null);
            console.log(`Returning ${result.length} mentors with course counts`);
            return result;
        } catch (error) {
            console.error('Error searching mentors:', error);
            return [];
        }
    }

    /**
     * Search skills/categories
     */
    async searchSkills(query: string): Promise<SearchSkillResult[]> {
        try {
            // Get unique categories from courses
            const { data: courses, error } = await supabase
                .from('courses')
                .select('category')
                .ilike('category', `%${query}%`)
                .eq('status', 'published')
                .neq('is_hidden', true)
                .limit(20);

            if (error) throw error;

            // Count courses per category
            const skillsMap = new Map<string, number>();
            (courses || []).forEach((course) => {
                const count = skillsMap.get(course.category) || 0;
                skillsMap.set(course.category, count + 1);
            });

            const skills: SearchSkillResult[] = Array.from(skillsMap.entries()).map(
                ([name, count], index) => ({
                    id: `skill-${index}`,
                    name,
                    description: `${count} courses available`,
                    coursesCount: count,
                })
            );

            return skills;
        } catch (error) {
            console.error('Error searching skills:', error);
            return [];
        }
    }

    /**
     * Search users (Admin only)
     */
    async searchUsers(query: string): Promise<SearchUserResult[]> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, fullname, email, role, department, avatarurl, joindate')
                .or(`fullname.ilike.%${query}%,email.ilike.%${query}%,department.ilike.%${query}%`)
                .limit(10);

            if (error) throw error;
            console.log('SearchUsers Raw Data:', data);
            return (data || []).map((user: any) => ({
                id: user.id,
                fullName: user.fullname,
                email: user.email,
                role: user.role,
                department: user.department || '',
                avatarUrl: user.avatarurl,
                joinDate: user.joindate,
            }));
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    /**
     * Get complete user report card
     */
    async getUserReportCard(userId: string): Promise<UserReportData | null> {
        try {
            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileError || !profile) throw profileError;

            // Get enrolled courses
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select(`
          id,
          courseid,
          progress,
          completed,
          hoursspent,
          enrolledat,
          completedat
        `)
                .eq('userid', userId);

            // Fetch course details for all enrolled courses
            const courseIds = (enrollments || []).map((e: any) => e.courseid).filter(Boolean);
            const { data: courseDetails } = courseIds.length > 0
                ? await supabase
                    .from('courses')
                    .select('id, title, thumbnail, category, duration, instructorname')
                    .in('id', courseIds)
                : { data: [] };

            // Create a map of courses by ID for quick lookup
            const courseMap = new Map((courseDetails || []).map((c: any) => [c.id, c]));

            // Map enrollments to courses
            const enrolledCourses = (enrollments || []).map((e: any) => {
                const course = courseMap.get(e.courseid) || {};
                return {
                    ...course,
                    enrollment: {
                        progress: e.progress,
                        completed: e.completed,
                        hoursSpent: e.hoursspent,
                        enrolledAt: e.enrolledat,
                        completedAt: e.completedat,
                    },
                };
            });

            const completedCourses = enrolledCourses.filter(
                (c: any) => c.enrollment.completed
            );

            // Get certificates
            const { data: certificatesData } = await supabase
                .from('certificates')
                .select('id, user_id, course_id, issued_at')
                .eq('user_id', userId);

            // Fetch certificate course details
            const certificateCourseIds = (certificatesData || []).map((c: any) => c.course_id).filter(Boolean);
            const { data: certificateCourseDetails } = certificateCourseIds.length > 0
                ? await supabase
                    .from('courses')
                    .select('id, title, thumbnail, category, instructorname')
                    .in('id', certificateCourseIds)
                : { data: [] };

            // Create a map of certificate courses by ID
            const certificateCourseMap = new Map((certificateCourseDetails || []).map((c: any) => [c.id, c]));

            // Map certificates with course details
            const certificates = (certificatesData || []).map((cert: any) => ({
                id: cert.id,
                userId: cert.user_id,
                courseId: cert.course_id,
                issuedAt: cert.issued_at,
                course: certificateCourseMap.get(cert.course_id) || {},
            }));

            // Get pending assignments with course details
            const { data: assignmentsData } = await supabase
                .from('course_assignments')
                .select(`
          id,
          courseid,
          due_date,
          is_mandatory,
          created_at
        `)
                .eq('userid', userId);

            // Fetch assignment course details
            const assignmentCourseIds = (assignmentsData || []).map((a: any) => a.courseid).filter(Boolean);
            const { data: assignmentCourseDetails } = assignmentCourseIds.length > 0
                ? await supabase
                    .from('courses')
                    .select('id, title, category, thumbnail')
                    .in('id', assignmentCourseIds)
                : { data: [] };

            // Create a map of assignment courses by ID
            const assignmentCourseMap = new Map((assignmentCourseDetails || []).map((c: any) => [c.id, c]));

            // Filter out assignments for courses that are already completed
            const completedCourseIds = new Set(completedCourses.map((c: any) => c.id));

            const pendingAssignments = (assignmentsData || [])
                .filter((a: any) => !completedCourseIds.has(a.courseid))
                .map((a: any) => ({
                    id: a.id,
                    courseId: a.courseid,
                    dueDate: a.due_date,
                    isMandatory: a.is_mandatory,
                    course: assignmentCourseMap.get(a.courseid) || {},
                    createdAt: a.created_at,
                }));

            // Get career paths
            const { data: careerPathsData } = await supabase
                .from('user_career_paths')
                .select(`
          *,
          career_paths:career_path_id (*)
        `)
                .eq('user_id', userId);

            // Map career paths with proper structure
            const careerPaths = (careerPathsData || []).map((cp: any) => ({
                id: cp.id,
                careerPathId: cp.career_path_id,
                userId: cp.user_id,
                title: cp.career_paths?.title || cp.career_paths?.source_role || 'Career Path',
                name: cp.career_paths?.source_role || '',
                description: cp.career_paths?.description || '',
                sourceRole: cp.career_paths?.source_role || '',
                targetRole: cp.career_paths?.target_role || '',
                progress: cp.readiness_percentage || 0,
                readinessPercentage: cp.readiness_percentage || 0,
                status: cp.status || 'pending',
                assignedAt: cp.assigned_at,
                targetDate: cp.target_date,
            }));

            // Get user skills
            const { data: userSkillsData } = await supabase
                .from('user_skill_achievements')
                .select('id, user_id, skill_id, level, proficiency_percentage')
                .eq('user_id', userId);

            // Fetch skill details
            const skillIds = (userSkillsData || []).map((s: any) => s.skill_id).filter(Boolean);
            const { data: skillDetails } = skillIds.length > 0
                ? await supabase
                    .from('skills')
                    .select('id, name, description')
                    .in('id', skillIds)
                : { data: [] };

            // Create a map of skills by ID
            const skillMap = new Map((skillDetails || []).map((s: any) => [s.id, s]));

            // Map user skills with skill details
            const userSkills = (userSkillsData || []).map((us: any) => ({
                ...us,
                skills: skillMap.get(us.skill_id) || { name: 'Unknown Skill', description: '' }
            }));

            // Get user statistics
            const { data: statistics } = await supabase
                .from('user_statistics')
                .select('*')
                .eq('user_id', userId)
                .single();

            const leaderboardRank = statistics?.leaderboard_rank || 0;
            const currentStreak = statistics?.currentstreak || 0;
            const totalLearningHours = statistics?.totallearninghours || 0;
            const totalPoints = statistics?.totalpoints || 0;

            return {
                profile: {
                    ...profile,
                    fullName: profile.fullname,
                    avatarUrl: profile.avatarurl,
                },
                enrolledCourses,
                completedCourses,
                certificates: certificates || [],
                pendingAssignments,
                careerPaths,
                skills: userSkills || [],
                statistics: {
                    ...statistics,
                    currentStreak,
                    totalLearningHours,
                    totalPoints,
                    leaderboardRank,
                },
                leaderboardRank,
            };
        } catch (error) {
            console.error('Error fetching user report card:', error);
            return null;
        }
    }

    /**
     * Get report card by filter type (courses, assignments, skills, etc.)
     */
    async getFilteredReportData(
        userId: string,
        filterType: 'courses' | 'assignments' | 'skills' | 'careerpath' | 'all'
    ) {
        const reportData = await this.getUserReportCard(userId);
        if (!reportData) return null;

        switch (filterType) {
            case 'courses':
                return {
                    ...reportData,
                    enrolledCourses: reportData.enrolledCourses,
                    completedCourses: reportData.completedCourses,
                };
            case 'assignments':
                return {
                    ...reportData,
                    pendingAssignments: reportData.pendingAssignments,
                };
            case 'skills':
                return {
                    ...reportData,
                    skills: reportData.skills,
                };
            case 'careerpath':
                return {
                    ...reportData,
                    careerPaths: reportData.careerPaths,
                };
            default:
                return reportData;
        }
    }

    /**
     * Search career paths by name or description
     */
    async searchCareerPaths(query: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('career_paths')
                .select('id, source_role, target_role, description')
                .or(`source_role.ilike.%${query}%,target_role.ilike.%${query}%,description.ilike.%${query}%`)
                .limit(10);

            if (error) throw error;
            return (data || []).map(cp => ({
                id: cp.id,
                name: `${cp.source_role} → ${cp.target_role}`,
                sourceRole: cp.source_role,
                targetRole: cp.target_role,
                description: cp.description,
            }));
        } catch (error) {
            console.error('Error searching career paths:', error);
            return [];
        }
    }

    /**
     * Search learning journeys by title or description
     */
    async searchLearningJourneys(query: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('learning_journeys')
                .select('id, title, description, type')
                .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
                .limit(10);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error searching learning journeys:', error);
            return [];
        }
    }
}

export const searchService = new SearchService();
