// Pre-configured Auto-Send Rule Templates
// Copy and paste these into the Auto-Send Rules tab to set them up quickly

// Quick-use templates for admins - copy title and message directly to Send Notifications
export const READY_TO_SEND_TEMPLATES = {
    instantNotifications: [
        {
            id: 'instant-welcome',
            title: '👋 Welcome to Skill Spire LMS',
            message: 'Welcome aboard! 🎉 We\'re excited to have you join our learning community. Start exploring courses, connect with peers, and begin your transformation today. Check out our Getting Started guide to learn the basics.',
            type: 'announcement',
            priority: 2,
            category: 'Welcome',
        },
        {
            id: 'instant-course-available',
            title: '📚 New Course Available: {course_name}',
            message: 'A new exciting course is now live! 🚀 "{course_name}" is designed to help you master {skill_name}. This course has already been completed by over 500 learners. Don\'t miss out - start learning today!',
            type: 'course',
            priority: 2,
            category: 'New Content',
        },
        {
            id: 'instant-achievement',
            title: '🏆 Recognition: Amazing Progress!',
            message: 'You deserve recognition! 👏 Our system has identified you as one of our top learners this month. Your dedication to continuous improvement is inspirational. Keep crushing your learning goals! 💪',
            type: 'announcement',
            priority: 1,
            category: 'Recognition',
        },
        {
            id: 'instant-maintenance',
            title: '⚙️ System Maintenance Notification',
            message: 'Heads up! 🔧 We\'ll be performing scheduled maintenance on {maintenance_date} at {time}. The system will be down for approximately {duration} minutes. Plan ahead and save your work!',
            type: 'system',
            priority: 3,
            category: 'System',
        },
        {
            id: 'instant-special-offer',
            title: '✨ Special Offer: Premium Path Access',
            message: 'Limited time offer! ⏰ For the next 48 hours, get 20% off our premium career paths. This special rate is exclusive for active learners like you. Upgrade and unlock advanced courses now!',
            type: 'announcement',
            priority: 2,
            category: 'Offers',
        },
    ],

    scheduledNotifications: [
        {
            id: 'scheduled-monday-motivation',
            title: '💪 Monday Motivation: Week of Learning Ahead',
            message: 'Good morning, champion! 🌅 A new week of learning opportunities awaits. Set your goals for this week and tackle them one course at a time. You\'ve got this! Let\'s make this an amazing learning week.',
            type: 'general',
            priority: 1,
            schedule: 'Every Monday at 9:00 AM',
            days_of_week: ['Monday'],
            recommended_recipients: 'All active users',
            category: 'Calendar-Based',
        },
        {
            id: 'scheduled-friday-review',
            title: '📊 Friday Learning Review',
            message: 'It\'s Friday! 🎉 Time to reflect on your learning journey this week. Pat yourself on the back for the effort you\'ve invested. Check out our Weekly Learning Report to see your progress and celebrate your wins!',
            type: 'general',
            priority: 1,
            schedule: 'Every Friday at 5:00 PM',
            days_of_week: ['Friday'],
            recommended_recipients: 'All engaged users',
            category: 'Calendar-Based',
        },
        {
            id: 'scheduled-monthly-summary',
            title: '📈 Your Monthly Learning Summary',
            message: 'Congratulations on completing another month! 🏅 This month you earned {points} points, completed {courses} courses, and ranked in the top {percentile}% of learners. Here\'s to next month\'s growth!',
            type: 'announcement',
            priority: 2,
            schedule: 'First day of every month at 10:00 AM',
            recommended_recipients: 'All users',
            category: 'Calendar-Based',
        },
    ],

    // Auto-send rules with specific reminder day configurations
    autoRulesWithReminders: [
        {
            id: 'assessment-3days',
            name: 'Assessment Due - 3 Days Before',
            title: '⏰ {assessment_name} Due in 3 Days',
            message: 'Your {assessment_type} "{assessment_name}" is due on {due_date}. You have 3 days to complete it. Here\'s a tip: review your notes and take it in a distraction-free environment. You\'re well-prepared! 💪',
            trigger_type: 'course_due',
            days_before_due: 3,
            priority: 3,
            max_sends_per_user: 2,
            category: 'Assessment Reminders',
        },
        {
            id: 'assessment-1day',
            name: 'Assessment Due - 1 Day Before (Final Reminder)',
            title: '🚨 Final Reminder: {assessment_name} Due Tomorrow!',
            message: 'Tomorrow is your last day to submit {assessment_name}! Don\'t wait until the last minute - complete it today if you can. Show what you\'ve learned! Go ace it! 🎯',
            trigger_type: 'course_due',
            days_before_due: 1,
            priority: 4,
            max_sends_per_user: 1,
            category: 'Assessment Reminders',
        },
        {
            id: 'course-due-7days',
            name: 'Course Due - 1 Week Before',
            title: '📚 {course_name} Due in 1 Week!',
            message: 'One week left for {course_name}! You\'re at {progress}% completion. Pick up the pace and finish strong. You only need to complete {remaining_lessons} more lessons. Let\'s go! 🚀',
            trigger_type: 'course_due',
            days_before_due: 7,
            priority: 2,
            max_sends_per_user: 1,
            category: 'Course Reminders',
        },
        {
            id: 'course-due-3days',
            name: 'Course Due - 3 Days Before',
            title: '⏳ {course_name} - Final Push (3 Days Left)',
            message: 'Only 3 days remaining for {course_name}! You\'re so close - you\'ve completed {progress}%. Dedicate 1-2 hours today to wrap it up. You\'ve got the skills! Finish strong! 💯',
            trigger_type: 'course_due',
            days_before_due: 3,
            priority: 3,
            max_sends_per_user: 1,
            category: 'Course Reminders',
        },
        {
            id: 'course-assigned-immediate',
            name: 'Course Assigned - Immediate Notification',
            title: '🆕 New Course Assigned: {course_name}',
            message: 'You\'ve been assigned a new course! 📖 {course_name} is now in your learning queue. This course will take approximately {duration} hours and is due by {due_date}. Start today to stay on schedule!',
            trigger_type: 'task_pending',
            days_after_assignment: 0,
            priority: 2,
            max_sends_per_user: 1,
            category: 'Course Assignment',
        },
        {
            id: 'career-path-weekly',
            name: 'Career Path - Weekly Progress Check',
            title: '🎯 Career Path Weekly Check-in',
            message: 'How\'s your career path journey going? 📈 This week, try to complete {suggested_courses} more courses. You\'re {progress}% through your path to becoming a {target_role}. Stay consistent!',
            trigger_type: 'low_engagement',
            frequency: 'weekly',
            recommended_day: 'Monday',
            priority: 1,
            max_sends_per_user: 1,
            category: 'Career Path',
        },
        {
            id: 'midpoint-motivation',
            name: 'Mid-Course Motivation (50% Complete)',
            title: '✨ You\'re Halfway There!',
            message: 'Fantastic progress! 🎉 You\'ve completed 50% of {course_name}. The hardest part is behind you - keep the momentum going and finish this course strong. Just a bit more to go! 💪',
            trigger_type: 'low_engagement',
            completion_threshold: 50,
            priority: 2,
            max_sends_per_user: 1,
            category: 'Engagement',
        },
        {
            id: 'skill-gap-recommendation',
            name: 'Skill Gap Recommendation',
            title: '💡 Recommended Skill to Learn',
            message: 'Based on your role as {role} and your learning journey so far, we recommend learning: {recommended_skill}. This skill is highly sought after and will boost your career prospects! 🚀',
            trigger_type: 'low_engagement',
            completion_threshold: 75,
            priority: 1,
            max_sends_per_user: 2,
            category: 'Recommendations',
        },
        {
            id: 'inactive-recovery-2weeks',
            name: 'Inactivity Recovery - 2 Weeks',
            title: '😴 We Miss You! Let\'s Get Back on Track',
            message: 'It\'s been 2 weeks since your last login! 👋 We miss having you here. You\'re close to your learning milestones - don\'t fall behind now. Come back and complete your next course today!',
            trigger_type: 'inactive_user',
            days_inactive: 14,
            priority: 2,
            max_sends_per_user: 1,
            category: 'Re-engagement',
        },
        {
            id: 'inactive-recovery-1month',
            name: 'Inactivity Recovery - 1 Month (Strong Reminder)',
            title: '🔴 Important: Get Back to Your Learning Goals',
            message: 'A full month has passed! ⚠️ You\'re at risk of losing momentum on your learning goals. Don\'t give up - your next course is waiting. Log in today and make progress. Your future self will thank you! 💪',
            trigger_type: 'inactive_user',
            days_inactive: 30,
            priority: 3,
            max_sends_per_user: 1,
            category: 'Re-engagement',
        },
    ],
};

export const AUTO_SEND_RULE_TEMPLATES = {
    // Template 1: Welcome New Users
    welcomeNewUsers: {
        name: 'Welcome New Users',
        description: 'Send welcome message to newly registered users',
        trigger_type: 'inactive_user' as const,
        trigger_params: { days: 0 }, // 0 days = new users
        title: '👋 Welcome to Skill Spire!',
        message: 'We\'re excited to have you here! Start exploring our courses and begin your learning journey. Check out our Getting Started guide.',
        type: 'announcement' as const,
        link_url: '/getting-started',
        link_label: 'Get Started',
        priority: 2,
        send_after_days: 0,
        max_sends_per_user: 1,
        is_active: true,
    },

    // Template 2: Pending Task Reminder
    pendingTaskReminder: {
        name: '📝 Pending Task Reminder',
        description: 'Remind users who haven\'t started or completed tasks',
        trigger_type: 'task_pending' as const,
        trigger_params: { days_since: 7 },
        title: 'You Have Pending Tasks',
        message: 'Hi! We noticed you have some pending tasks. Complete them to progress in your learning journey. Your instructors are waiting to see your work!',
        type: 'reminder' as const,
        link_url: '/my-learning',
        link_label: 'View Tasks',
        priority: 2,
        send_after_days: 3,
        max_sends_per_user: 2,
        is_active: false, // Disabled by default, enable as needed
    },

    // Template 3: Assignment Overdue Alert
    assignmentOverdueAlert: {
        name: '⚠️ Assignment Overdue Alert',
        description: 'Alert users about overdue assignments',
        trigger_type: 'assignment_overdue' as const,
        trigger_params: {},
        title: 'Your Assignment is Overdue!',
        message: 'We\'ve noticed one of your assignments is now overdue. Please submit it as soon as possible. An extension may still be available - check with your instructor.',
        type: 'assignment' as const,
        link_url: '/my-learning',
        link_label: 'View Assignment',
        priority: 4, // High priority
        send_after_days: 1,
        send_before_days: 0,
        max_sends_per_user: 3,
        is_active: false,
    },

    // Template 4: Course Due Soon
    courseDueSoon: {
        name: '📅 Course Due Soon Reminder',
        description: 'Remind users of upcoming course deadlines',
        trigger_type: 'course_due' as const,
        trigger_params: { days: 3 },
        title: '⏰ Course Deadline Approaching',
        message: 'Your course deadline is coming up in a few days! Make sure to complete all remaining lessons and assessments.',
        type: 'course' as const,
        link_url: '/my-learning',
        link_label: 'Continue Course',
        priority: 3,
        send_after_days: 2,
        max_sends_per_user: 2,
        is_active: false,
    },

    // Template 5: Low Engagement Check
    lowEngagementReminder: {
        name: '🚀 Low Engagement Check',
        description: 'Encourage users with low completion rates',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 25 },
        title: 'Keep Your Learning Momentum!',
        message: 'You\'re off to a great start, but we\'ve noticed you haven\'t completed many courses yet. Choose one course and complete it this week!',
        type: 'reminder' as const,
        link_url: '/catalog',
        link_label: 'Browse Courses',
        priority: 1, // Low priority
        send_after_days: 7,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 6: Inactivity Alert
    inactivityAlert: {
        name: '😴 We Miss You!',
        description: 'Remind inactive users to come back',
        trigger_type: 'inactive_user' as const,
        trigger_params: { days: 14 },
        title: 'We Miss You! Come Back to Learning',
        message: 'It\'s been a while since we\'ve seen you. Don\'t fall behind on your learning goals. Come back and continue making progress!',
        type: 'announcement' as const,
        link_url: '/my-learning',
        link_label: 'Continue Learning',
        priority: 2,
        send_after_days: 14,
        max_sends_per_user: 2,
        is_active: false,
    },

    // Template 7: Course Completion Congratulation
    completionCongrats: {
        name: '🎉 Course Completion!',
        description: 'Celebrate when users complete courses',
        trigger_type: 'task_pending' as const, // Note: You may want a custom trigger for this
        trigger_params: {},
        title: 'Congratulations! Course Completed 🏆',
        message: 'Amazing work! You\'ve completed your course. Check out our recommended next courses to continue your learning journey.',
        type: 'announcement' as const,
        link_url: '/catalog',
        link_label: 'Explore More Courses',
        priority: 2,
        send_after_days: 0,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 8: Thursday Motivation
    thursdayMotivation: {
        name: '💪 Weekly Motivation',
        description: 'Send motivational message to all active users',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 100 }, // Everyone
        title: 'You\'ve Got This! 💪',
        message: 'Great week so far! Complete one more lesson before the week ends to keep your momentum going.',
        type: 'general' as const,
        link_url: '/my-learning',
        link_label: 'Learn Now',
        priority: 1,
        send_after_days: 3, // Maybe adjust based on your schedule
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 9: Certificate Reminder
    certificateReminder: {
        name: '📜 Get Your Certificate!',
        description: 'Remind users about certificate opportunities',
        trigger_type: 'task_pending' as const,
        trigger_params: { days_since: 30 },
        title: 'You\'re Close to Earning a Certificate!',
        message: 'You\'re almost at 100% completion! A few more lessons and you\'ll earn your certificate. Let\'s finish strong!',
        type: 'announcement' as const,
        link_url: '/my-certificates',
        link_label: 'View Certificates',
        priority: 2,
        send_after_days: 5,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 10: Pro Tips
    proTips: {
        name: '💡 Pro Learning Tips',
        description: 'Share learning tips and best practices',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 100 },
        title: '💡 Pro Tip: Study Technique',
        message: 'Did you know? Breaking your learning into 25-minute sessions (pomodoro technique) helps improve retention by 40%. Try it today!',
        type: 'general' as const,
        color: 'bg-blue-100',
        priority: 1,
        send_after_days: 4,
        max_sends_per_user: 2,
        is_active: false,
    },

    // Template 11: Career Path Milestone Reminder
    careerPathMilestone: {
        name: '🎯 Career Path Progress',
        description: 'Remind users to continue their career path learning',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 30 },
        title: '🎯 Continue Your Career Path Journey!',
        message: 'You\'re making progress on your career path! Complete 2 more courses this week to reach your next milestone and unlock new opportunities.',
        type: 'course' as const,
        link_url: '/learning-journeys',
        link_label: 'View Career Path',
        priority: 2,
        send_after_days: 7,
        max_sends_per_user: 2,
        is_active: false,
    },

    // Template 12: New Course Assigned Reminder
    newCourseAssigned: {
        name: '🆕 New Course Assigned',
        description: 'Notify when new course is assigned to user',
        trigger_type: 'task_pending' as const,
        trigger_params: { days_since: 1 },
        title: '📚 You Have a New Course!',
        message: 'A new course has been assigned to you: {course_name}. Start learning today and complete it by {due_date} to stay on track.',
        type: 'course' as const,
        link_url: '/my-learning',
        link_label: 'Start Learning',
        priority: 2,
        send_after_days: 1,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 13: Assessment Due Soon Reminder
    assessmentDueSoon: {
        name: '📋 Assessment Due Soon',
        description: 'Reminder before assessment due date',
        trigger_type: 'course_due' as const,
        trigger_params: { days: 3 },
        title: '⏰ Assessment Due in 3 Days',
        message: 'Your {assessment_name} is due on {due_date}. Take some time to review the material and complete the assessment. You\'ve got this! 💪',
        type: 'assignment' as const,
        link_url: '/my-learning',
        link_label: 'View Assessment',
        priority: 3,
        send_after_days: 3,
        max_sends_per_user: 2,
        is_active: false,
    },

    // Template 14: Calendar-Based Weekly Learning Reminder
    weeklyCalendarReminder: {
        name: '📅 Weekly Learning Reminder',
        description: 'Weekly reminder to keep learning goals on track (sends every Monday)',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 100 },
        title: '👋 Good Morning! It\'s Learning Day!',
        message: 'This week, complete {pending_count} courses and {pending_tasks} tasks to stay on schedule. You\'re doing amazing! 🌟 Make it a great week.',
        type: 'announcement' as const,
        link_url: '/my-learning',
        link_label: 'View Schedule',
        priority: 1,
        send_after_days: 7,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 15: Monthly Learning Achievement
    monthlyAchievement: {
        name: '🏆 Monthly Learning Achievement',
        description: 'Celebrate monthly learning achievements on specific dates',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 100 },
        title: '🏆 Monthly Achievement Report',
        message: 'Wow! This month you completed {completed_courses} courses and earned {points} points! Keep this momentum going next month. 🚀',
        type: 'announcement' as const,
        link_url: '/learning',
        link_label: 'View Progress',
        priority: 1,
        send_after_days: 30,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 16: Assigned Course Deadline Alert (Before Due)
    assignedCourseDueBefore: {
        name: '⏳ Assigned Course - Due Before Alert',
        description: 'Alert for assigned courses due in 2-7 days',
        trigger_type: 'course_due' as const,
        trigger_params: { days: 7 },
        title: '⏳ Assigned Course Due Soon!',
        message: 'Your assigned course "{course_name}" is due on {due_date}. You\'ve completed {progress}% so far. Push to finish strong! 💯',
        type: 'course' as const,
        link_url: '/my-learning',
        link_label: 'Continue Course',
        priority: 2,
        send_after_days: 2,
        max_sends_per_user: 2,
        is_active: false,
    },

    // Template 17: Mid-Course Checkpoint
    midCourseCheckpoint: {
        name: '✅ Mid-Course Checkpoint',
        description: 'Encourage completion at 50% progress milestone',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 50 },
        title: '✅ You\'re Halfway There!',
        message: 'Great job! You\'ve completed 50% of {course_name}. You\'re doing fantastic! Complete the remaining lessons this week to finish strong.',
        type: 'course' as const,
        link_url: '/my-learning',
        link_label: 'View Course',
        priority: 1,
        send_after_days: 3,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 18: Skill-Specific Learning Path
    skillPathReminder: {
        name: '🛣️ Skill Learning Path Track',
        description: 'Keep users on track with their learning path skills',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 40 },
        title: '🛣️ Your Learning Path Awaits',
        message: 'Next skill in your path: {skill_name}. This skill takes ~{hours_needed} hours. Start today and you\'ll be an expert by {completion_date}!',
        type: 'course' as const,
        link_url: '/learning-journeys',
        link_label: 'View Path',
        priority: 2,
        send_after_days: 5,
        max_sends_per_user: 2,
        is_active: false,
    },

    // Template 19: Quarterly Learning Review
    quarterlyReview: {
        name: '📑 Quarterly Learning Review',
        description: 'Quarterly insights and recommendations',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 100 },
        title: '📑 Your Q{quarter} Learning Summary',
        message: 'This quarter you completed {courses_count} courses! You\'re in the top {percentile}% of learners. See what\'s recommended for next quarter.',
        type: 'announcement' as const,
        link_url: '/dashboard',
        link_label: 'View Summary',
        priority: 1,
        send_after_days: 90,
        max_sends_per_user: 1,
        is_active: false,
    },

    // Template 20: Skill Gap Identification
    skillGapAlert: {
        name: '🎯 Skill Gap Alert',
        description: 'Identify and recommend courses for skill gaps',
        trigger_type: 'low_engagement' as const,
        trigger_params: { threshold: 100 },
        title: '🎯 Recommended Skills to Learn',
        message: 'Based on your role, you might benefit from learning: {recommended_skill}. We have a great course on this! Interested? 👀',
        type: 'course' as const,
        link_url: '/catalog',
        link_label: 'Preview Course',
        priority: 1,
        send_after_days: 14,
        max_sends_per_user: 2,
        is_active: false,
    },
};

// Available messages to customize the above templates
export const NOTIFICATION_MESSAGE_TEMPLATES = {
    titles: {
        positive: [
            '🎉 Great News!',
            '✨ Exciting Update!',
            '🚀 New Opportunity!',
            '⭐ Special for You',
            '💫 Amazing Offer',
        ],
        reminder: [
            '📝 Friendly Reminder',
            '⏰ Time to Act',
            '📋 Task Pending',
            '⏳ Don\'t Forget',
            '📌 Important Update',
        ],
        urgent: [
            '⚠️ Action Required',
            '🚨 Important Notice',
            '❗ Urgent Alert',
            '⛔ Critical Update',
            '🔴 Deadline Alert',
        ],
        celebration: [
            '🏆 Achievement Unlocked!',
            '🎊 Milestone Reached!',
            '👏 Excellent Work!',
            '⭐ Outstanding!',
            '💯 Perfect!',
        ],
        careerPath: [
            '🎯 Career Path Progress',
            '📈 Advancing Your Career',
            '🚀 Career Milestone Achieved',
            '💼 Professional Growth',
            '🏅 Next Level Unlocked',
        ],
        course: [
            '📚 Course Update',
            '🎓 Learning Milestone',
            '📖 Course Progress',
            '💡 New Lesson Available',
            '🌟 Course Checkpoint',
        ],
        assessment: [
            '📋 Assessment Alert',
            '✏️ Quiz Time',
            '📝 Evaluation Reminder',
            '⏰ Assessment Due',
            '🎯 Test Preparation',
        ],
    },
    messages: {
        // Career path related messages
        careerPathEncouragement: [
            'You\'re building an impressive skill set! Keep going to unlock your career potential. 🚀',
            'Your career path is on track! One more milestone and you\'ll reach the next level. 💼',
            'You\'re {progress}% through your career path. Finish strong and advance to the next tier! 🎯',
            'Amazing progress on your professional development! Your dedication is inspiring. ⭐',
            'Your skills are growing! This career path will open amazing opportunities. 🌟',
        ],
        // Course assignment messages
        courseAssignment: [
            'A new course {course_name} has been assigned to you. Start today to stay on schedule!',
            'You\'ve been assigned {course_name}. This course will enhance your {skill_name} skills. 🎓',
            'New course ready: {course_name} - due by {due_date}. Let\'s get started! 📚',
            '{course_name} is waiting for you! Your team has assigned this course to help your growth. 💪',
            'Check out your newly assigned course: {course_name}. Your instructor left feedback for you! 👀',
        ],
        // Assessment/Quiz reminders
        assessmentReminder: [
            'Your {assessment_name} is due {days_remaining} days. Quick review: {duration} minutes to complete. ⏰',
            'Don\'t forget! {assessment_name} deadline is {due_date}. You\'ve been preparing well! 💪',
            '{assessment_type} "{assessment_name}" is due soon. Show off what you\'ve learned! 🌟',
            'Quick reminder: {assessment_name} closes on {due_date}. Complete it while the material is fresh! 🧠',
            'Your {assessment_name} is due {days_remaining} days. You\'ve got this! Take your time and do your best! ✨',
        ],
        // Calendar-wise reminders
        calendarBased: [
            'This week\'s learning plan: Complete {pending_count} courses and perform {pending_tasks} tasks. Let\'s go! 📅',
            'Weekly check-in: You\'re ahead of schedule! Keep up the momentum for next week. 🎯',
            'Calendar check: {pending_courses} courses due this month. Pace yourself and stay consistent. 📊',
            'This {day_of_week} reminder: You have {learning_hours} hours of content to complete this month. 🗓️',
            'Monthly milestone check: Complete {remaining_count} items to finish your learning goals! 🏁',
        ],
        // Encouragement and engagement
        encouragement: [
            'You\'re making great progress! Keep it up! 💪',
            'We believe in you! You\'re doing amazing! ✨',
            'Don\'t give up now! You\'re so close! 🎯',
            'You\'ve got this! One more step! 🚀',
            'Every lesson brings you closer to success! 📚',
            'Your dedication is paying off! Keep learning! 🌟',
            'Just a little more to go! You\'re almost there! 🔥',
            'You\'re crushing your learning goals! Fantastic! 💯',
        ],
        reminder: [
            'You have pending items waiting for you.',
            'Don\'t forget about your upcoming deadline.',
            'A few items still need your attention.',
            'Quick reminder: You have tasks to complete.',
            'Just checking in - do you need help?',
            'Your learning journey continues here.',
            'Time to check off some tasks! 📝',
            'A friendly nudge: let\'s keep going! ✨',
        ],
        appreciation: [
            'Thank you for being part of our learning community!',
            'We appreciate your dedication to learning!',
            'Your commitment to excellence is inspiring!',
            'Thank you for your hard work and effort!',
            'We\'re grateful to have you here!',
            'Your consistent effort makes a difference! 💖',
            'We\'re proud of your learning journey! 👏',
            'Your progress is remarkable! Keep it up! ⭐',
        ],
        // Achievement recognition
        achievement: [
            'Congratulations on completing {course_name}! You\'re unstoppable! 🏆',
            'You\'ve unlocked a new skill: {skill_name}. Awesome work! 🎉',
            'You earned {points} points this week! That\'s remarkable! 💫',
            'You\'re in the top {percentile}% of learners. Amazing! 🌟',
            'New badge unlocked: {badge_name}. Keep collecting! 🏅',
            'You\'ve reached {milestone}% completion! So close to finishing! 🎯',
        ],
    },
    // Pre-configured reminder day options for scheduled notifications
    reminderDayOptions: {
        beforeAssessment: [
            { days: 1, label: '1 day before', use: 'Final prep' },
            { days: 3, label: '3 days before', use: 'Start review' },
            { days: 7, label: 'One week before', use: 'Initial reminder' },
        ],
        beforeCourseEnd: [
            { days: 1, label: '1 day before due', use: 'Last chance warning' },
            { days: 3, label: '3 days before due', use: 'Final push' },
            { days: 7, label: 'One week before due', use: 'Early reminder' },
            { days: 14, label: '2 weeks before due', use: 'Planning window' },
        ],
        careerPathCheckpoints: [
            { days: 7, label: '1 week checkpoint', use: 'Weekly progress check' },
            { days: 14, label: '2 weeks checkpoint', use: 'Bi-weekly review' },
            { days: 30, label: 'Monthly checkpoint', use: 'Monthly assessment' },
            { days: 90, label: 'Quarterly checkpoint', use: 'Quarterly review' },
        ],
        courseAssignment: [
            { days: 0, label: 'Immediately', use: 'Instant notification' },
            { days: 1, label: '1 day later', use: 'Next day reminder' },
            { days: 3, label: '3 days later', use: 'Settle-in reminder' },
            { days: 7, label: '1 week later', use: 'Progress check' },
        ],
        calendarBased: [
            { days: 7, label: 'Every Monday (weekly)', use: 'Weekly kickoff' },
            { days: 14, label: 'Every 2 weeks (bi-weekly)', use: 'Bi-weekly check' },
            { days: 30, label: 'Monthly (same date)', use: 'Monthly review' },
        ],
        engagementRecovery: [
            { days: 3, label: '3 days inactive', use: 'First nudge' },
            { days: 7, label: '7 days inactive', use: 'Mid-check' },
            { days: 14, label: '14 days inactive', use: 'Strong reminder' },
            { days: 30, label: '30 days inactive', use: 'Re-engagement' },
        ],
    },
};

export const SETUP_CHECKLIST = [
    {
        category: 'Database Setup',
        items: [
            {
                title: 'Apply migrations',
                description: 'Run MIGRATION_NOTIFICATIONS_ADVANCED.sql in Supabase',
                status: 'pending' as const,
            },
            {
                title: 'Verify tables created',
                description: 'Check that all 6 new tables exist in database',
                status: 'pending' as const,
            },
            {
                title: 'Test RLS policies',
                description: 'Verify Row Level Security policies are working',
                status: 'pending' as const,
            },
        ],
    },
    {
        category: 'Frontend Integration',
        items: [
            {
                title: 'Add routes',
                description: 'Add AdvancedNotificationsPage and NotificationHistoryPage routes',
                status: 'pending' as const,
            },
            {
                title: 'Update sidebar',
                description: 'Add navigation links to admin menu',
                status: 'pending' as const,
            },
            {
                title: 'Test navigation',
                description: 'Verify pages load correctly and auth works',
                status: 'pending' as const,
            },
        ],
    },
    {
        category: 'Background Processing',
        items: [
            {
                title: 'Initialize processor',
                description: 'Add initializeNotificationProcessor() to App component',
                status: 'pending' as const,
            },
            {
                title: 'Test processor',
                description: 'Create a scheduled notification and verify it sends',
                status: 'pending' as const,
            },
            {
                title: 'Check logs',
                description: 'Verify notification processor logs appear in console',
                status: 'pending' as const,
            },
        ],
    },
    {
        category: 'Feature Testing',
        items: [
            {
                title: 'Test Send Now',
                description: 'Send a test notification to yourself',
                status: 'pending' as const,
            },
            {
                title: 'Test Drafts',
                description: 'Create a draft and load it for sending',
                status: 'pending' as const,
            },
            {
                title: 'Test Scheduling',
                description: 'Schedule a notification for 5 minutes from now',
                status: 'pending' as const,
            },
            {
                title: 'Test Auto-Rules',
                description: 'Create and activate an auto-send rule',
                status: 'pending' as const,
            },
            {
                title: 'Test History',
                description: 'View notifications in history with filters and export',
                status: 'pending' as const,
            },
        ],
    },
    {
        category: 'User Features',
        items: [
            {
                title: 'Test notification bell',
                description: 'Verify bell icon shows unread count in header',
                status: 'pending' as const,
            },
            {
                title: 'Test notification dropdown',
                description: 'Click bell to see notifications list',
                status: 'pending' as const,
            },
            {
                title: 'Test mark as read',
                description: 'Mark notification as read and verify count updates',
                status: 'pending' as const,
            },
            {
                title: 'Test notification links',
                description: 'Click notification links and verify navigation',
                status: 'pending' as const,
            },
        ],
    },
    {
        category: 'Production Readiness',
        items: [
            {
                title: 'Set up cron job',
                description: 'Configure background processing (optional but recommended)',
                status: 'pending' as const,
            },
            {
                title: 'Performance testing',
                description: 'Send notifications to test user base and monitor performance',
                status: 'pending' as const,
            },
            {
                title: 'Security review',
                description: 'Review RLS policies and permissions with security team',
                status: 'pending' as const,
            },
            {
                title: 'Documentation',
                description: 'Create admin guide for your team',
                status: 'pending' as const,
            },
        ],
    },
];

export const ADMIN_QUICK_TIPS = [
    {
        title: 'Always test first',
        description: 'Send test notification to yourself before sending to all users',
        icon: '✓',
    },
    {
        title: 'Use templates',
        description: 'Save common messages as templates for quick reuse',
        icon: '💾',
    },
    {
        title: 'Schedule wisely',
        description: 'Send notifications during peak hours when users are online',
        icon: '⏰',
    },
    {
        title: 'Monitor metrics',
        description: 'Check history tab regularly to see engagement rates',
        icon: '📊',
    },
    {
        title: 'Prevention over cure',
        description: 'Use auto-rules to prevent problems before they happen',
        icon: '🛡️',
    },
    {
        title: 'Avoid notification fatigue',
        description: 'Limit max_sends_per_user in auto-rules to avoid spam',
        icon: '🚫',
    },
];

export const TROUBLESHOOTING_GUIDE = {
    'Scheduled notifications not sending': {
        cause: 'Notification processor not running or scheduled_for time hasn\'t passed',
        solutions: [
            'Verify processor is initialized in App component',
            'Check that scheduled_for is in the past',
            'Check notification status in database',
            'Look in notification_audit_log for errors',
        ],
    },
    'Auto-rules not triggering': {
        cause: 'Rule not active or trigger condition not met',
        solutions: [
            'Verify rule is_active is true',
            'Check trigger_type is correct',
            'Review auto_send_rule_execution_log',
            'Ensure users exist matching the trigger condition',
        ],
    },
    'Users not seeing notifications': {
        cause: 'RLS policy issue or notification not created',
        solutions: [
            'Check RLS policies allow user to view their notifications',
            'Verify user_id in database matches auth user',
            'Check NotificationDropdown component is rendered in Header',
            'Check browser console for errors',
        ],
    },
    'Performance issues': {
        cause: 'Too many notifications or large notification_audit_log table',
        solutions: [
            'Archive old notification history',
            'Create indexes on user_id and created_at',
            'Batch process notifications instead of all at once',
            'Monitor database query performance',
        ],
    },
};
