#!/usr/bin/env node

// Direct API call to Supabase to check enrollment

const fetch = require('node-fetch');

const SUPABASE_URL = 'https://pbqnxdvxlbvqoxvngjwt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicW54ZHZ4bGJ2cW94dm5nand0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ3MDI4OTksImV4cCI6MjAyMDI3ODg5OX0.LMJ1PSIH9Lp1fIlRHmLNL5wKCkEfaB0UU-xCg2VVp5w';

async function checkEnrollment() {
    try {
        console.log('Fetching course...');

        // Search for course
        const courseUrl = `${SUPABASE_URL}/rest/v1/courses?select=id,title,totalstudents,averagerating&title=ilike.%Introduction%to%Risk%Management%`;

        const response = await fetch(courseUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.log('API Error:', response.status);
            return;
        }

        const courses = await response.json();
        console.log(`Found ${courses.length} course(s)`);

        if (courses.length > 0) {
            courses.forEach((course, idx) => {
                console.log(`\nCourse ${idx + 1}:`);
                console.log(`  Title: ${course.title}`);
                console.log(`  ID: ${course.id}`);
                console.log(`  Enrolled Learners: ${course.totalstudents}`);
                console.log(`  Average Rating: ${course.averagerating || 'N/A'}`);
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkEnrollment();
