const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://pbqnxdvxlbvqoxvngjwt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicW54ZHZ4bGJ2cW94dm5nand0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ3MDI4OTksImV4cCI6MjAyMDI3ODg5OX0.LMJ1PSIH9Lp1fIlRHmLNL5wKCkEfaB0UU-xCg2VVp5w'
);

async function checkEnrollment() {
    try {
        console.log('Searching for "Introduction to Risk Management" course...\n');

        const { data: courses, error: courseError } = await supabase
            .from('courses')
            .select('id, title, totalstudents, status, is_hidden')
            .ilike('title', '%Introduction to Risk Management%');

        if (courseError) {
            console.error('Error fetching courses:', courseError);
            return;
        }

        if (!courses || courses.length === 0) {
            console.log('❌ Course not found');
            return;
        }

        console.log('✅ Found course(s):\n');

        for (const course of courses) {
            console.log(`Title: ${course.title}`);
            console.log(`Course ID: ${course.id}`);
            console.log(`Total Students (Enrolled): ${course.totalstudents || 0}`);
            console.log(`Status: ${course.status}`);
            console.log(`Hidden: ${course.is_hidden ? 'Yes' : 'No'}`);
            console.log('---');

            // Also get enrollment count from enrollments table
            const { data: enrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('id', { count: 'exact' })
                .eq('courseid', course.id);

            if (!enrollError) {
                console.log(`Enrollments (from enrollments table): ${enrollments?.length || 0}`);
            }
            console.log('\n');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkEnrollment();
