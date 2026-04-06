const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://pbqnxdvxlbvqoxvngjwt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicW54ZHZ4bGJ2cW94dm5nand0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ3MDI4OTksImV4cCI6MjAyMDI3ODg5OX0.LMJ1PSIH9Lp1fIlRHmLNL5wKCkEfaB0UU-xCg2VVp5w'
);

async function checkCourseEnrollment() {
    try {
        console.log('🔍 Checking enrollment for: "Introduction to Risk Management: From Daily Life to Business"\n');
        console.log('='.repeat(80));

        // Find the exact course
        const { data: courses, error: courseError } = await supabase
            .from('courses')
            .select('id, title, totalstudents, averagerating, status')
            .ilike('title', '%Introduction to Risk Management%');

        if (courseError) {
            console.error('❌ Error:', courseError);
            return;
        }

        if (!courses || courses.length === 0) {
            console.log('❌ Course not found\n');
            return;
        }

        // Find the closest match
        const course = courses.find((c: any) => c.title.includes('From Daily Life to Business')) || courses[0];

        console.log(`\n✅ COURSE FOUND`);
        console.log(`   Title: ${course.title}`);
        console.log(`   Course ID: ${course.id}`);
        console.log(`   Status: ${course.status}`);

        // Get actual enrollment count
        const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact' })
            .eq('courseid', course.id);

        if (enrollError) {
            console.error('❌ Error fetching enrollments:', enrollError);
        } else {
            console.log(`\n📊 ENROLLMENT STATISTICS:`);
            console.log(`   Total Enrolled: ${enrollments?.length || 0} learners`);

            if (enrollments && enrollments.length > 0) {
                const completed = enrollments.filter((e: any) => e.completed).length;
                const inProgress = enrollments.length - completed;

                console.log(`   ✅ Completed: ${completed} learners`);
                console.log(`   ⏳ In Progress: ${inProgress} learners`);
                console.log(`   📈 Completion Rate: ${Math.round((completed / enrollments.length) * 100)}%`);
            }
        }

        // Get feedback/ratings
        console.log(`\n⭐ FEEDBACK & RATINGS:`);
        const { data: feedback } = await supabase
            .from('course_feedback')
            .select('rating')
            .eq('courseid', course.id);

        if (feedback && feedback.length > 0) {
            const validRatings = feedback.filter((f: any) => f.rating !== null && f.rating !== undefined);
            if (validRatings.length > 0) {
                const avgRating = (validRatings.reduce((sum: number, f: any) => sum + f.rating, 0) / validRatings.length).toFixed(1);
                console.log(`   Average Rating: ⭐ ${avgRating}/5`);
                console.log(`   Feedback Count: ${validRatings.length} reviews`);
            }
        } else {
            console.log(`   No feedback records yet`);
        }

        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkCourseEnrollment();
