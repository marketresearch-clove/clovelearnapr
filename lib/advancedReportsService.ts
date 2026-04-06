import { supabase } from './supabaseClient';

// Types for advanced reports
export interface LearnerDetailReport {
    'Learner Name': string;
    'Email': string;
    'Department': string;
    'Role': string;
    'Courses Enrolled': number;
    'Courses Completed': number;
    'Overall Progress %': number;
    'Total Learning Hours': number;
    'Average Assessment Score': number;
    'Certificates Earned': number;
    'Last Active': string;
    'Status': string;
}

export interface LearningHoursReport {
    'Learner Name': string;
    'Email': string;
    'Department': string;
    'Total Hours': number;
    'This Month Hours': number;
    'Last Month Hours': number;
    'Courses Tracked': number;
    'Average Daily Minutes': number;
    'Most Used Course': string;
    'Engagement Level': string; // High, Medium, Low
}

export interface SkillProgressionReport {
    'Learner Name': string;
    'Email': string;
    'Skill Name': string;
    'Current Level': string;
    'Target Level': string;
    'Progress %': number;
    'Courses Completed for Skill': number;
    'Last Updated': string;
    'Status': string;
}

export interface DepartmentAnalyticsReport {
    'Department': string;
    'Total Employees': number;
    'Active Learners': number;
    'Enrollment Rate %': number;
    'Average Completion Rate %': number;
    'Total Courses Completed': number;
    'Total Hours Invested': number;
    'Average Score': number;
    'Top Performer': string;
    'Last Updated': string;
}

export interface AdminUserActivityReport {
    'Admin Name': string;
    'Email': string;
    'Role': string;
    'Courses Created': number;
    'Courses Assigned': number;
    'Total Students Managed': number;
    'Assessments Created': number;
    'Certificate Issues': number;
    'Last Active': string;
    'Status': string;
}

export interface CareerPathProgressReport {
    'Learner Name': string;
    'Email': string;
    'Career Path': string;
    'Progress %': number;
    'Modules Completed': number;
    'Total Modules': number;
    'Skills to Acquire': number;
    'Skills Acquired': number;
    'Estimated Completion': string;
    'Status': string;
}

export interface CourseAnalyticsDetailReport {
    'Course Title': string;
    'Category': string;
    'Total Enrolled': number;
    'Completed': number;
    'Completion Rate %': number;
    'Average Score %': number;
    'Average Hours': number;
    'Difficulty Level': string;
    'Rating': number;
    'Assessments': number;
    'Created Date': string;
}

export interface EngagementMetricsReport {
    'Learner Name': string;
    'Email': string;
    'Department': string;
    'Session Count': number;
    'Total Time Spent (Hours)': number;
    'Average Session Duration (Min)': number;
    'Days Active': number;
    'Streak (Days)': number;
    'Content Interaction Rate %': number;
    'Assessment Attempt Rate': number;
    'Last Activity': string;
}

/**
 * Fetch detailed learner analytics for all learners including learning progress
 */
export const fetchLearnerDetailedAnalytics = async (): Promise<LearnerDetailReport[]> => {
    try {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, fullname, email, department, role')
            .order('fullname');

        if (!profiles) return [];

        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('userid, completed, progress');

        const { data: assessmentResults } = await supabase
            .from('assessment_results')
            .select('userid, percentage');

        const { data: certificates } = await supabase
            .from('certificates')
            .select('user_id');

        const { data: learningHours } = await supabase
            .from('learning_hours')
            .select('userid, hoursspent');

        const report: LearnerDetailReport[] = profiles.map(profile => {
            const userEnrollments = enrollments?.filter(e => e.userid === profile.id) || [];
            const userAssessments = assessmentResults?.filter(a => a.userid === profile.id) || [];
            const userCerts = certificates?.filter(c => c.user_id === profile.id) || [];
            const userHours = learningHours?.filter(h => h.userid === profile.id) || [];

            const avgScore = userAssessments.length > 0
                ? Math.round(userAssessments.reduce((sum, a) => sum + a.percentage, 0) / userAssessments.length)
                : 0;

            const totalHours = userHours.reduce((sum, h) => sum + h.hoursspent, 0);

            return {
                'Learner Name': profile.fullname || 'Unknown',
                'Email': profile.email || 'N/A',
                'Department': profile.department || 'N/A',
                'Role': profile.role || 'learner',
                'Courses Enrolled': userEnrollments.length,
                'Courses Completed': userEnrollments.filter(e => e.completed).length,
                'Overall Progress %': userEnrollments.length > 0
                    ? Math.round(userEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / userEnrollments.length)
                    : 0,
                'Total Learning Hours': Math.round(totalHours * 10) / 10,
                'Average Assessment Score': avgScore,
                'Certificates Earned': userCerts.length,
                'Last Active': new Date().toLocaleDateString(),
                'Status': profile.role === 'admin' ? 'Manager' : 'Active'
            };
        });

        return report;
    } catch (error) {
        console.error('Error fetching learner details:', error);
        return [];
    }
};

/**
 * Fetch learning hours breakdown for all users
 */
export const fetchLearningHoursAnalytics = async (): Promise<LearningHoursReport[]> => {
    try {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, fullname, email, department')
            .order('fullname');

        if (!profiles) return [];

        const { data: learningHours } = await supabase
            .from('learning_hours')
            .select('userid, hoursspent, createdat');

        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('userid, courseid');

        const report: LearningHoursReport[] = profiles.map(profile => {
            const userHours = learningHours?.filter(h => h.userid === profile.id) || [];
            const totalHours = userHours.reduce((sum, h) => sum + h.hoursspent, 0);

            // Calculate monthly hours (simplified - last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const monthHours = userHours
                .filter(h => new Date(h.createdat) >= thirtyDaysAgo)
                .reduce((sum, h) => sum + h.hoursspent, 0);

            const userEnrollments = enrollments?.filter(e => e.userid === profile.id) || [];
            const uniqueCourses = new Set(userEnrollments.map(e => e.courseid)).size;

            const engagement = totalHours > 100 ? 'High' : totalHours > 20 ? 'Medium' : 'Low';

            return {
                'Learner Name': profile.fullname || 'Unknown',
                'Email': profile.email || 'N/A',
                'Department': profile.department || 'N/A',
                'Total Hours': Math.round(totalHours * 10) / 10,
                'This Month Hours': Math.round(monthHours * 10) / 10,
                'Last Month Hours': Math.round((totalHours - monthHours) * 10) / 10,
                'Courses Tracked': uniqueCourses,
                'Average Daily Minutes': totalHours > 0 ? Math.round((totalHours * 60) / Math.max(userHours.length, 1)) : 0,
                'Most Used Course': 'N/A',
                'Engagement Level': engagement
            };
        });

        return report;
    } catch (error) {
        console.error('Error fetching learning hours analytics:', error);
        return [];
    }
};

/**
 * Fetch skill progression for all learners
 */
export const fetchSkillProgressionAnalytics = async (): Promise<SkillProgressionReport[]> => {
    try {
        const { data: userSkills } = await supabase
            .from('user_skill_achievements')
            .select('user_id, skill_id, completed_at');

        const { data: skills } = await supabase
            .from('skills')
            .select('id, name');

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, fullname, email');

        if (!userSkills || !skills || !profiles) return [];

        const report: SkillProgressionReport[] = [];

        userSkills.forEach(us => {
            const skill = skills.find(s => s.id === us.skill_id);
            const profile = profiles.find(p => p.id === us.user_id);

            if (skill && profile) {
                report.push({
                    'Learner Name': profile.fullname || 'Unknown',
                    'Email': profile.email || 'N/A',
                    'Skill Name': skill.name,
                    'Current Level': 'Intermediate',
                    'Target Level': 'Expert',
                    'Progress %': 50,
                    'Courses Completed for Skill': 1,
                    'Last Updated': new Date(us.completed_at).toLocaleDateString(),
                    'Status': 'In Progress'
                });
            }
        });

        return report;
    } catch (error) {
        console.error('Error fetching skill progression:', error);
        return [];
    }
};

/**
 * Fetch department-wise analytics
 */
export const fetchDepartmentAnalytics = async (): Promise<DepartmentAnalyticsReport[]> => {
    try {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, department, role');

        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('userid, completed');

        const { data: assessmentResults } = await supabase
            .from('assessment_results')
            .select('userid, percentage');

        const { data: learningHours } = await supabase
            .from('learning_hours')
            .select('userid, hoursspent');

        if (!profiles) return [];

        // Group by department
        const departments = new Map<string, any>();

        profiles.forEach(profile => {
            const dept = profile.department || 'Unassigned';
            const userEnrollments = enrollments?.filter(e => e.userid === profile.id) || [];
            const userAssessments = assessmentResults?.filter(a => a.userid === profile.id) || [];
            const userHours = learningHours?.filter(h => h.userid === profile.id) || [];

            if (!departments.has(dept)) {
                departments.set(dept, {
                    names: [],
                    enrollments: [],
                    assessments: [],
                    hours: [],
                    roles: []
                });
            }

            const dept_data = departments.get(dept);
            dept_data.names.push(profile.id);
            dept_data.enrollments.push(...userEnrollments);
            dept_data.assessments.push(...userAssessments);
            dept_data.hours.push(...userHours);
            dept_data.roles.push(profile.role);
        });

        const report: DepartmentAnalyticsReport[] = Array.from(departments.entries()).map(([dept, data]) => {
            const completedCourses = data.enrollments.filter((e: any) => e.completed).length;
            const avgScore = data.assessments.length > 0
                ? Math.round(data.assessments.reduce((sum: number, a: any) => sum + a.percentage, 0) / data.assessments.length)
                : 0;
            const totalHours = data.hours.reduce((sum: number, h: any) => sum + h.hoursspent, 0);

            return {
                'Department': dept,
                'Total Employees': data.names.length,
                'Active Learners': data.enrollments.length > 0 ? data.names.length : 0,
                'Enrollment Rate %': data.names.length > 0 ? Math.round((data.enrollments.length / (data.names.length * 5)) * 100) : 0,
                'Average Completion Rate %': data.enrollments.length > 0 ? Math.round((completedCourses / data.enrollments.length) * 100) : 0,
                'Total Courses Completed': completedCourses,
                'Total Hours Invested': Math.round(totalHours * 10) / 10,
                'Average Score': avgScore,
                'Top Performer': 'N/A',
                'Last Updated': new Date().toLocaleDateString()
            };
        });

        return report;
    } catch (error) {
        console.error('Error fetching department analytics:', error);
        return [];
    }
};

/**
 * Fetch admin user activity report
 */
export const fetchAdminUserActivityReport = async (): Promise<AdminUserActivityReport[]> => {
    try {
        const { data: adminProfiles } = await supabase
            .from('profiles')
            .select('id, fullname, email, role')
            .in('role', ['admin', 'instructor'])
            .order('fullname');

        if (!adminProfiles) return [];

        const { data: courses } = await supabase
            .from('courses')
            .select('id, instructorid');

        const { data: courseAssignments } = await supabase
            .from('course_assignments')
            .select('assigned_by, courseid');

        const { data: assessments } = await supabase
            .from('assessments')
            .select('id');

        const { data: certificates } = await supabase
            .from('certificates')
            .select('id');

        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('userid');

        const report: AdminUserActivityReport[] = adminProfiles.map(admin => {
            const createdCourses = courses?.filter(c => c.instructorid === admin.id) || [];
            const assignedCourses = courseAssignments?.filter(ca => ca.assigned_by === admin.id) || [];

            // Get unique students managed
            const allEnrollments = enrollments || [];
            const managedStudents = new Set();
            assignedCourses.forEach((ac: any) => {
                allEnrollments.forEach((e: any) => {
                    managedStudents.add(e.userid);
                });
            });

            return {
                'Admin Name': admin.fullname || 'Unknown',
                'Email': admin.email || 'N/A',
                'Role': admin.role || 'staff',
                'Courses Created': createdCourses.length,
                'Courses Assigned': assignedCourses.length,
                'Total Students Managed': managedStudents.size,
                'Assessments Created': assessments?.length || 0,
                'Certificate Issues': certificates?.length || 0,
                'Last Active': new Date().toLocaleDateString(),
                'Status': 'Active'
            };
        });

        return report;
    } catch (error) {
        console.error('Error fetching admin user activity:', error);
        return [];
    }
};

/**
 * Fetch career path progress for all learners
 */
export const fetchCareerPathProgressAnalytics = async (): Promise<CareerPathProgressReport[]> => {
    try {
        const { data: userCareerPaths } = await supabase
            .from('user_career_paths')
            .select('user_id, career_path_id, assigned_at');

        const { data: careerPaths } = await supabase
            .from('career_paths')
            .select('id, source_role, target_role');

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, fullname, email');
        
        if (!userCareerPaths || !careerPaths || !profiles) return [];

        const report: CareerPathProgressReport[] = userCareerPaths.map(ucp => {
            const careerPath = careerPaths.find(cp => cp.id === ucp.career_path_id);
            const profile = profiles.find(p => p.id === ucp.user_id);

            if (!careerPath || !profile) return null;

            // Calculate estimated completion (simplified)
            const daysEnrolled = Math.floor((new Date().getTime() - new Date(ucp.assigned_at).getTime()) / (1000 * 60 * 60 * 24));
            const estimatedDaysRemaining = Math.max(0, 180 - daysEnrolled);
            const estimatedCompletion = new Date(Date.now() + estimatedDaysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString();

            return {
                'Learner Name': profile.fullname || 'Unknown',
                'Email': profile.email || 'N/A',
                'Career Path': `${careerPath.source_role} → ${careerPath.target_role}`,
                'Progress %': Math.min(100, Math.round((daysEnrolled / 180) * 100)),
                'Modules Completed': Math.floor((daysEnrolled / 180) * 6),
                'Total Modules': 6,
                'Skills to Acquire': 12,
                'Skills Acquired': Math.floor((daysEnrolled / 180) * 12),
                'Estimated Completion': estimatedCompletion,
                'Status': daysEnrolled > 180 ? 'Completed' : 'In Progress'
            };
        });

        return report.filter(r => r !== null) as CareerPathProgressReport[];
    } catch (error) {
        console.error('Error fetching career path progress:', error);
        return [];
    }
};

/**
 * Fetch detailed course analytics
 */
export const fetchCourseAnalyticsDetail = async (): Promise<CourseAnalyticsDetailReport[]> => {
    try {
        const { data: courses } = await supabase
            .from('courses')
            .select('id, title, level, created_at');

        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('courseid, completed');

        if (!courses) return [];

        const report: CourseAnalyticsDetailReport[] = courses.map(course => {
            const courseEnrollments = enrollments?.filter(e => e.courseid === course.id) || [];

            const completedCount = courseEnrollments.filter(e => e.completed).length;
            const completionRate = courseEnrollments.length > 0
                ? Math.round((completedCount / courseEnrollments.length) * 100)
                : 0;

            return {
                'Course Title': course.title,
                'Category': 'General',
                'Total Enrolled': courseEnrollments.length,
                'Completed': completedCount,
                'Completion Rate %': completionRate,
                'Average Score %': 75,
                'Average Hours': 8,
                'Difficulty Level': course.level || 'Intermediate',
                'Rating': 4.5,
                'Assessments': 0,
                'Created Date': new Date(course.created_at).toLocaleDateString()
            };
        });

        return report;
    } catch (error) {
        console.error('Error fetching course analytics:', error);
        return [];
    }
};

/**
 * Fetch engagement metrics for all learners
 */
export const fetchEngagementMetricsAnalytics = async (): Promise<EngagementMetricsReport[]> => {
    try {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, fullname, email, department')
            .order('fullname');

        if (!profiles) return [];

        const { data: lessonProgress } = await supabase
            .from('lesson_progress')
            .select('userid, completed_at, completed');

        const { data: learningHours } = await supabase
            .from('learning_hours')
            .select('userid, hoursspent, createdat');

        const report: EngagementMetricsReport[] = profiles.map(profile => {
            const userLessons = lessonProgress?.filter(lp => lp.userid === profile.id) || [];
            const userHours = learningHours?.filter(h => h.userid === profile.id) || [];

            const totalHours = userHours.reduce((sum, h) => sum + h.hoursspent, 0);
            const completedLessons = userLessons.filter(lp => lp.completed).length;

            // Calculate activity days (unique dates with activity)
            const activeDates = new Set(
                userHours.map(h => new Date(h.createdat).toDateString())
            );
            const daysActive = activeDates.size;

            // Calculate streak (simplified)
            let streak = 0;
            if (daysActive > 0) {
                streak = Math.min(daysActive, 30);
            }

            const interactionRate = userLessons.length > 0 ? Math.round((completedLessons / userLessons.length) * 100) : 0;

            return {
                'Learner Name': profile.fullname || 'Unknown',
                'Email': profile.email || 'N/A',
                'Department': profile.department || 'N/A',
                'Session Count': userHours.length,
                'Total Time Spent (Hours)': Math.round(totalHours * 10) / 10,
                'Average Session Duration (Min)': userHours.length > 0 ? Math.round((totalHours * 60) / userHours.length) : 0,
                'Days Active': daysActive,
                'Streak (Days)': streak,
                'Content Interaction Rate %': interactionRate,
                'Assessment Attempt Rate': completedLessons,
                'Last Activity': userHours.length > 0 ? new Date(userHours[userHours.length - 1].createdat).toLocaleDateString() : 'N/A'
            };
        });

        return report;
    } catch (error) {
        console.error('Error fetching engagement metrics:', error);
        return [];
    }
};
