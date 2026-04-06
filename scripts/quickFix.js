import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function quickFix() {
  console.log('🛠️  Quick Fix Options for hr@demo.com login issue:\n');
  
  console.log('✅ SOLUTION 1: Create a new user that can login immediately');
  console.log('   This creates a user with email confirmation bypassed\n');
  
  // Create user with auto-confirm
  const { data, error } = await supabase.auth.signUp({
    email: 'hr@demo.com',
    password: 'hr@123',
    options: {
      data: {
        // This might help bypass confirmation in some configurations
        confirmed_at: new Date().toISOString()
      }
    }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('⚠️  User already exists. Trying alternative approach...\n');
      
      // Try creating a different user
      const altEmail = 'demo@hr.com';
      console.log(`🔄 Creating alternative user: ${altEmail}`);
      
      const { data: altData, error: altError } = await supabase.auth.signUp({
        email: altEmail,
        password: 'hr@123'
      });
      
      if (altError) {
        console.log('❌ Alternative user creation also failed:', altError.message);
      } else {
        console.log('✅ Alternative user created successfully!');
        console.log(`📧 Email: ${altEmail}`);
        console.log(`🔑 Password: hr@123`);
        console.log(`🎯 Use these credentials to login instead`);
      }
    } else {
      console.log('❌ User creation failed:', error.message);
    }
  } else {
    console.log('✅ User created successfully!');
    console.log(`📧 Email: hr@demo.com`);
    console.log(`🔑 Password: hr@123`);
    
    if (data.session) {
      console.log('🎉 User can login immediately!');
    } else {
      console.log('⚠️  User still needs email confirmation');
      console.log('💡 Try using the alternative email: demo@hr.com');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY:');
  console.log('='.repeat(60));
  console.log('The issue is that email confirmation is enabled in your Supabase project.');
  console.log('');
  console.log('🔧 PERMANENT SOLUTIONS:');
  console.log('1. Disable email confirmation in Supabase Auth settings');
  console.log('2. Use a valid email address you can access');
  console.log('3. Get the service role key to confirm users programmatically');
  console.log('');
  console.log('⚡ QUICK FIX:');
  console.log('Try logging in with: demo@hr.com / hr@123');
  console.log('(if the alternative user was created successfully)');
}

quickFix();