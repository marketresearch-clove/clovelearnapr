import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createUserAndLogin() {
  console.log('Creating user: hr@demo.com with password: hr@123');
  
  // First, try to sign up the user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'hr@demo.com',
    password: 'hr@123',
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError.message);
    if (signUpError.message.includes('already registered')) {
      console.log('User already exists, trying to login...');
    }
  } else {
    console.log('User created successfully!');
    console.log('User ID:', signUpData.user?.id);
    console.log('Confirmation sent at:', signUpData.user?.confirmation_sent_at);
    
    if (signUpData.session) {
      console.log('✅ User can login immediately (no confirmation required)');
    } else {
      console.log('⚠️  User needs to confirm email before logging in');
    }
  }

  // Try to login regardless
  console.log('\nAttempting login...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'hr@demo.com',
    password: 'hr@123',
  });

  if (loginError) {
    console.error('❌ Login failed:', loginError.message);
    
    if (loginError.message.includes('Email not confirmed')) {
      console.log('\n📝 SOLUTION: The user needs to confirm their email first.');
      console.log('You have two options:');
      console.log('1. Check the email inbox for hr@demo.com and click the confirmation link');
      console.log('2. Disable email confirmation in Supabase Auth settings');
      console.log('3. Use Supabase Admin to manually confirm the user');
    }
  } else {
    console.log('✅ Login successful!');
    console.log('Session:', loginData.session ? 'Created' : 'None');
    console.log('User:', loginData.user?.email);
  }
}

// Run the function
createUserAndLogin().catch(console.error);