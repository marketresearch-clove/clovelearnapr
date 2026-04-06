import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('Testing login with credentials:');
  console.log('Email: hr@demo.com');
  console.log('Password: hr@123');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'hr@demo.com',
    password: 'hr@123',
  });

  if (error) {
    console.error('Login failed:', error.message);
    console.error('Error details:', error);
  } else {
    console.log('Login successful!');
    console.log('User data:', data);
  }
}

async function checkUserExists() {
  console.log('\nChecking if user exists in auth.users...');
  
  // This would require service role key for admin access
  // For now, let's try to sign up the user again to see what happens
  const { data, error } = await supabase.auth.signUp({
    email: 'hr@demo.com',
    password: 'hr@123',
  });

  if (error) {
    console.error('Sign up failed:', error.message);
    if (error.message.includes('already registered')) {
      console.log('User already exists!');
    }
  } else {
    console.log('User created successfully:', data);
  }
}

async function main() {
  await testLogin();
  await checkUserExists();
}

main();