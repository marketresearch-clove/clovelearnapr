const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://pbqnxdvxlbvqoxvngjwt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicW54ZHZ4bGJ2cW94dm5nand0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ3MDI4OTksImV4cCI6MjAyMDI3ODg5OX0.LMJ1PSIH9Lp1fIlRHmLNL5wKCkEfaB0UU-xCg2VVp5w'
);

async function debugEnrollments() {
    console.log('🔍 DEBUG: Checking course enrollments and ratings\n');
    console.log('='.repeat(80));

    try {
        // 1. Find the course
        console.log('\n1️⃣ SEARCHING FOR COURSE...');
        const { data: courses, error: courseError } = await supabase
            .from('courses')
            .select('id, title, averagerating, totalstudents')
            .ilike('title', '%Introduction to Risk Management%');

        if (courseError) {
            console.error('❌ Error fetching course:', courseError);
            return;
        }

        if (!courses || courses.length === 0) {
            console.log('❌ Course not found');
            return;
        }

        const course = courses[0];
        console.log(`✅ Found: ${course.title}`);
        console.log(`   Course ID: ${course.id}`);
        console.log(`   Current averagerating field: ${course.averagerating}`);
        console.log(`   Current totalstudents field: ${course.totalstudents}`);

        // 2. Count actual enrollments
        console.log('\n2️⃣ COUNTING ACTUAL ENROLLMENTS...');
        const { data: enrollments, error: enrollError, count: enrollCount } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact' })
            .eq('courseid', course.id);

        if (enrollError) {
            console.error('❌ Error fetching enrollments:', enrollError);
        } else {
            console.log(`✅ Total Enrollments: ${enrollments?.length || 0}`);
            if (enrollments && enrollments.length > 0) {
                const completed = enrollments.filter((e: any) => e.completed).length;
                console.log(`   Completed: ${completed}`);
                console.log(`   In Progress: ${enrollments.length - completed}`);
                console.log(`   Completion Rate: ${Math.round((completed / enrollments.length) * 100)}%`);
            }
        }

        // 3. Check for feedback/ratings
        console.log('\n3️⃣ CHECKING FEEDBACK...');
        const { data: feedback, error: feedbackError } = await supabase
            .from('course_feedback')
            .select('*')
            .eq('courseid', course.id);

        if (feedbackError) {
            console.error('⚠️ course_feedback table error:', feedbackError.message);
        } else {
            console.log(`✅ Feedback records: ${feedback?.length || 0}`);
            if (feedback && feedback.length > 0) {
                const ratings = feedback.map((f: any) => f.rating || f.score || 0).filter((r: number) => r > 0);
                if (ratings.length > 0) {
                    const avgRating = (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2);
                    console.log(`   Average Rating: ${avgRating}`);
                    console.log(`   Ratings found: ${ratings.join(', ')}`);
                }
            }
        }

        // 4. Check assessment results for average score
        console.log('\n4️⃣ CHECKING ASSESSMENT RESULTS...');
        const { data: assessments, error: assessmentError } = await supabase
            .from('assessment_results')
            .select('score')
            .eq('courseid', course.id);

        if (assessmentError) {
            console.error('⚠️ assessment_results table error:', assessmentError.message);
        } else {
            console.log(`✅ Assessment records: ${assessments?.length || 0}`);
            if (assessments && assessments.length > 0) {
                const scores = assessments.map((a: any) => a.score || 0).filter((s: number) => s > 0);
                if (scores.length > 0) {
                    const avgScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
                    console.log(`   Average Score: ${avgScore}%`);
                }
            }
        }

        // 5. Check all courses for comparison
        console.log('\n5️⃣ SAMPLE OF ALL COURSES...');
        const { data: allCourses } = await supabase
            .from('courses')
            .select('id, title, totalstudents, averagerating')
            .limit(5);

        if (allCourses) {
            console.log('Sample courses:');
            allCourses.forEach((c: any) => {
                console.log(`   - ${c.title}: students=${c.totalstudents}, rating=${c.averagerating}`);
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ Debug complete');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugEnrollments();
